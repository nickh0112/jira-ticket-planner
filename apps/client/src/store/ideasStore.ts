import { create } from 'zustand';
import type {
  IdeaSession,
  IdeaSessionFull,
  UpdateTicketProposalInput,
} from '@jira-planner/shared';
import {
  getIdeaSessions,
  createIdeaSession as apiCreateSession,
  getIdeaSession,
  archiveIdeaSession,
  sendIdeaMessage as apiSendMessage,
  generateIdeaPRD as apiGeneratePRD,
  generateIdeaTickets as apiGenerateTickets,
  approveIdeaProposals as apiApproveProposals,
  rejectIdeaProposal as apiRejectProposal,
  updateIdeaProposal as apiUpdateProposal,
} from '../utils/api';

type ArtifactView = 'prd' | 'tickets' | 'none';

interface IdeasState {
  // Data
  sessions: IdeaSession[];
  currentSession: IdeaSessionFull | null;

  // UI State
  isLoading: boolean;
  isSending: boolean;
  isGenerating: boolean;
  error: string | null;
  artifactView: ArtifactView;
  sidebarOpen: boolean;
  thinkingSteps: string[];
  selectedProposalIds: Set<string>;

  // Actions
  loadSessions: () => Promise<void>;
  createSession: (title: string) => Promise<IdeaSession>;
  loadSession: (id: string) => Promise<void>;
  archiveSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  generatePRD: () => Promise<void>;
  generateTickets: () => Promise<void>;
  approveProposals: () => Promise<void>;
  rejectProposal: (proposalId: string) => Promise<void>;
  updateProposal: (proposalId: string, updates: UpdateTicketProposalInput) => Promise<void>;

  // UI Actions
  setArtifactView: (view: ArtifactView) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleProposalSelection: (id: string) => void;
  selectAllProposals: () => void;
  deselectAllProposals: () => void;
  clearCurrentSession: () => void;
  clearError: () => void;
}

export const useIdeasStore = create<IdeasState>((set, get) => ({
  // Initial state
  sessions: [],
  currentSession: null,
  isLoading: false,
  isSending: false,
  isGenerating: false,
  error: null,
  artifactView: 'none',
  sidebarOpen: true,
  thinkingSteps: [],
  selectedProposalIds: new Set(),

  // Load all sessions
  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await getIdeaSessions();
      set({ sessions: result.sessions, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Create a new session
  createSession: async (title: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await apiCreateSession(title);
      set((state) => ({
        sessions: [session, ...state.sessions],
        isLoading: false,
      }));
      // Load the full session
      await get().loadSession(session.id);
      return session;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Load a specific session with all data
  loadSession: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const sessionFull = await getIdeaSession(id);

      // Determine artifact view based on session state
      let artifactView: ArtifactView = 'none';
      if (sessionFull.proposals.length > 0) {
        artifactView = 'tickets';
      } else if (sessionFull.prd) {
        artifactView = 'prd';
      }

      // Select all proposed tickets by default
      const proposedIds = sessionFull.proposals
        .filter(p => p.status === 'proposed')
        .map(p => p.id);

      set({
        currentSession: sessionFull,
        artifactView,
        selectedProposalIds: new Set(proposedIds),
        thinkingSteps: [],
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Archive a session
  archiveSession: async (id: string) => {
    try {
      await archiveIdeaSession(id);
      set((state) => ({
        sessions: state.sessions.filter(s => s.id !== id),
        currentSession: state.currentSession?.session.id === id ? null : state.currentSession,
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Send a message
  sendMessage: async (content: string) => {
    const { currentSession } = get();
    if (!currentSession) return;

    set({ isSending: true, error: null, thinkingSteps: [] });
    try {
      const result = await apiSendMessage(currentSession.session.id, content);

      set((state) => {
        if (!state.currentSession) return state;

        return {
          currentSession: {
            ...state.currentSession,
            messages: [
              ...state.currentSession.messages,
              result.userMessage,
              result.assistantMessage,
            ],
          },
          thinkingSteps: result.thinkingSteps || [],
          isSending: false,
        };
      });

      // Reload session if PRD or tickets were updated
      if (result.prdUpdated || result.ticketsUpdated) {
        await get().loadSession(currentSession.session.id);
      }
    } catch (error: any) {
      set({ error: error.message, isSending: false });
    }
  },

  // Generate PRD
  generatePRD: async () => {
    const { currentSession } = get();
    if (!currentSession) return;

    set({ isGenerating: true, error: null });
    try {
      const result = await apiGeneratePRD(currentSession.session.id);

      set((state) => {
        if (!state.currentSession) return state;

        return {
          currentSession: {
            ...state.currentSession,
            prd: result.prd,
            messages: [...state.currentSession.messages, result.message],
            session: { ...state.currentSession.session, status: 'prd_generated' },
          },
          artifactView: 'prd',
          isGenerating: false,
        };
      });
    } catch (error: any) {
      set({ error: error.message, isGenerating: false });
    }
  },

  // Generate tickets
  generateTickets: async () => {
    const { currentSession } = get();
    if (!currentSession) return;

    set({ isGenerating: true, error: null });
    try {
      const result = await apiGenerateTickets(currentSession.session.id);

      // Select all new proposals by default
      const newProposalIds = result.proposals.map(p => p.id);

      set((state) => {
        if (!state.currentSession) return state;

        return {
          currentSession: {
            ...state.currentSession,
            proposals: result.proposals,
            messages: [...state.currentSession.messages, result.message],
          },
          artifactView: 'tickets',
          selectedProposalIds: new Set(newProposalIds),
          isGenerating: false,
        };
      });
    } catch (error: any) {
      set({ error: error.message, isGenerating: false });
    }
  },

  // Approve selected proposals
  approveProposals: async () => {
    const { currentSession, selectedProposalIds } = get();
    if (!currentSession || selectedProposalIds.size === 0) return;

    set({ isGenerating: true, error: null });
    try {
      await apiApproveProposals(
        currentSession.session.id,
        Array.from(selectedProposalIds)
      );

      // Reload session to get updated proposals
      await get().loadSession(currentSession.session.id);

      set({ isGenerating: false });
    } catch (error: any) {
      set({ error: error.message, isGenerating: false });
    }
  },

  // Reject a proposal
  rejectProposal: async (proposalId: string) => {
    const { currentSession } = get();
    if (!currentSession) return;

    try {
      await apiRejectProposal(currentSession.session.id, proposalId);

      set((state) => {
        if (!state.currentSession) return state;

        const newSelectedIds = new Set(state.selectedProposalIds);
        newSelectedIds.delete(proposalId);

        return {
          currentSession: {
            ...state.currentSession,
            proposals: state.currentSession.proposals.map(p =>
              p.id === proposalId ? { ...p, status: 'rejected' as const } : p
            ),
          },
          selectedProposalIds: newSelectedIds,
        };
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Update a proposal
  updateProposal: async (proposalId: string, updates: UpdateTicketProposalInput) => {
    const { currentSession } = get();
    if (!currentSession) return;

    try {
      const updated = await apiUpdateProposal(currentSession.session.id, proposalId, updates);

      set((state) => {
        if (!state.currentSession) return state;

        return {
          currentSession: {
            ...state.currentSession,
            proposals: state.currentSession.proposals.map(p =>
              p.id === proposalId ? updated : p
            ),
          },
        };
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // UI Actions
  setArtifactView: (view: ArtifactView) => set({ artifactView: view }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  toggleProposalSelection: (id: string) => set((state) => {
    const newSet = new Set(state.selectedProposalIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return { selectedProposalIds: newSet };
  }),

  selectAllProposals: () => set((state) => {
    if (!state.currentSession) return state;
    const proposedIds = state.currentSession.proposals
      .filter(p => p.status === 'proposed')
      .map(p => p.id);
    return { selectedProposalIds: new Set(proposedIds) };
  }),

  deselectAllProposals: () => set({ selectedProposalIds: new Set() }),

  clearCurrentSession: () => set({
    currentSession: null,
    artifactView: 'none',
    thinkingSteps: [],
    selectedProposalIds: new Set(),
  }),

  clearError: () => set({ error: null }),
}));
