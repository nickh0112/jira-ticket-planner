import { create } from 'zustand';
import type { DesignSession, DesignSessionFull, ShareDesignResponse } from '@jira-planner/shared';
import {
  getDesignSessions,
  createDesignSession as apiCreateSession,
  getDesignSession,
  archiveDesignSession,
  sendDesignMessage as apiSendMessage,
  generateDesignPrototype as apiGeneratePrototype,
  approveDesign as apiApprove,
  shareDesign as apiShare,
} from '../utils/api';

type ArtifactView = 'preview' | 'code' | 'none';

interface DesignState {
  // Data
  sessions: DesignSession[];
  currentSession: DesignSessionFull | null;

  // UI State
  isLoading: boolean;
  isSending: boolean;
  isGenerating: boolean;
  error: string | null;
  artifactView: ArtifactView;
  sidebarOpen: boolean;

  // Actions
  loadSessions: () => Promise<void>;
  createSession: (title: string, sourceType?: string, sourceId?: string, codebaseContextId?: string) => Promise<DesignSession>;
  loadSession: (id: string) => Promise<void>;
  archiveSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  generatePrototype: () => Promise<void>;
  approve: () => Promise<void>;
  share: (method: 'code' | 'jira') => Promise<ShareDesignResponse | null>;

  // UI Actions
  setArtifactView: (view: ArtifactView) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  clearCurrentSession: () => void;
  clearError: () => void;
}

export const useDesignStore = create<DesignState>((set, get) => ({
  // Initial state
  sessions: [],
  currentSession: null,
  isLoading: false,
  isSending: false,
  isGenerating: false,
  error: null,
  artifactView: 'none',
  sidebarOpen: true,

  // Load all sessions
  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await getDesignSessions();
      set({ sessions: result.sessions, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Create a new session
  createSession: async (title: string, sourceType?: string, sourceId?: string, codebaseContextId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await apiCreateSession(title, sourceType, sourceId, codebaseContextId);
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
      const sessionFull = await getDesignSession(id);

      // Determine artifact view based on session state
      let artifactView: ArtifactView = 'none';
      if (sessionFull.prototypes.length > 0) {
        artifactView = 'preview';
      }

      set({
        currentSession: sessionFull,
        artifactView,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Archive a session
  archiveSession: async (id: string) => {
    try {
      await archiveDesignSession(id);
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

    set({ isSending: true, error: null });
    try {
      const result = await apiSendMessage(currentSession.session.id, content);

      set((state) => {
        if (!state.currentSession) return state;

        const updatedPrototypes = result.newPrototype
          ? [...state.currentSession.prototypes, result.newPrototype]
          : state.currentSession.prototypes;

        return {
          currentSession: {
            ...state.currentSession,
            messages: [
              ...state.currentSession.messages,
              result.userMessage,
              result.assistantMessage,
            ],
            prototypes: updatedPrototypes,
          },
          artifactView: result.newPrototype ? 'preview' : state.artifactView,
          isSending: false,
        };
      });
    } catch (error: any) {
      set({ error: error.message, isSending: false });
    }
  },

  // Generate prototype
  generatePrototype: async () => {
    const { currentSession } = get();
    if (!currentSession) return;

    set({ isGenerating: true, error: null });
    try {
      const result = await apiGeneratePrototype(currentSession.session.id);

      set((state) => {
        if (!state.currentSession) return state;

        return {
          currentSession: {
            ...state.currentSession,
            prototypes: [...state.currentSession.prototypes, result.prototype],
            messages: [...state.currentSession.messages, result.message],
            session: { ...state.currentSession.session, status: 'prototype_generated' },
          },
          artifactView: 'preview',
          isGenerating: false,
        };
      });
    } catch (error: any) {
      set({ error: error.message, isGenerating: false });
    }
  },

  // Approve the design
  approve: async () => {
    const { currentSession } = get();
    if (!currentSession) return;

    set({ isGenerating: true, error: null });
    try {
      await apiApprove(currentSession.session.id);
      await get().loadSession(currentSession.session.id);
      set({ isGenerating: false });
    } catch (error: any) {
      set({ error: error.message, isGenerating: false });
    }
  },

  // Share the design
  share: async (method: 'code' | 'jira') => {
    const { currentSession } = get();
    if (!currentSession) return null;

    try {
      const result = await apiShare(currentSession.session.id, method);
      return result;
    } catch (error: any) {
      set({ error: error.message });
      return null;
    }
  },

  // UI Actions
  setArtifactView: (view: ArtifactView) => set({ artifactView: view }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  clearCurrentSession: () => set({
    currentSession: null,
    artifactView: 'none',
  }),

  clearError: () => set({ error: null }),
}));
