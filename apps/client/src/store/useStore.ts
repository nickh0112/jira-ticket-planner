import { create } from 'zustand';
import type {
  Ticket,
  TeamMember,
  Epic,
  TicketStatus,
  UpdateTicketInput,
} from '@jira-planner/shared';

interface AppState {
  // Data
  tickets: Ticket[];
  teamMembers: TeamMember[];
  epics: Epic[];

  // UI State
  isLoading: boolean;
  isParsing: boolean;
  error: string | null;
  statusFilter: TicketStatus | 'all';
  editingTicket: Ticket | null;
  activeTab: 'tickets' | 'team' | 'epics' | 'settings' | 'agent' | 'world';
  toast: { message: string; type: 'success' | 'error' } | null;

  // Actions
  setTickets: (tickets: Ticket[]) => void;
  addTickets: (tickets: Ticket[]) => void;
  updateTicket: (id: string, updates: UpdateTicketInput) => void;
  removeTicket: (id: string) => void;
  setTeamMembers: (members: TeamMember[]) => void;
  addTeamMember: (member: TeamMember) => void;
  updateTeamMember: (id: string, member: TeamMember) => void;
  removeTeamMember: (id: string) => void;
  setEpics: (epics: Epic[]) => void;
  addEpic: (epic: Epic) => void;
  updateEpic: (id: string, epic: Epic) => void;
  removeEpic: (id: string) => void;
  setIsLoading: (loading: boolean) => void;
  setIsParsing: (parsing: boolean) => void;
  setError: (error: string | null) => void;
  setStatusFilter: (filter: TicketStatus | 'all') => void;
  setEditingTicket: (ticket: Ticket | null) => void;
  setActiveTab: (tab: 'tickets' | 'team' | 'epics' | 'settings' | 'agent' | 'world') => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  hideToast: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  tickets: [],
  teamMembers: [],
  epics: [],
  isLoading: false,
  isParsing: false,
  error: null,
  statusFilter: 'all',
  editingTicket: null,
  activeTab: 'tickets',
  toast: null,

  // Actions
  setTickets: (tickets) => set({ tickets }),
  addTickets: (newTickets) =>
    set((state) => ({ tickets: [...newTickets, ...state.tickets] })),
  updateTicket: (id, updates) =>
    set((state) => ({
      tickets: state.tickets.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    })),
  removeTicket: (id) =>
    set((state) => ({
      tickets: state.tickets.filter((t) => t.id !== id),
    })),
  setTeamMembers: (members) => set({ teamMembers: members }),
  addTeamMember: (member) =>
    set((state) => ({ teamMembers: [...state.teamMembers, member] })),
  updateTeamMember: (id, member) =>
    set((state) => ({
      teamMembers: state.teamMembers.map((m) => (m.id === id ? member : m)),
    })),
  removeTeamMember: (id) =>
    set((state) => ({
      teamMembers: state.teamMembers.filter((m) => m.id !== id),
    })),
  setEpics: (epics) => set({ epics }),
  addEpic: (epic) => set((state) => ({ epics: [...state.epics, epic] })),
  updateEpic: (id, epic) =>
    set((state) => ({
      epics: state.epics.map((e) => (e.id === id ? epic : e)),
    })),
  removeEpic: (id) =>
    set((state) => ({
      epics: state.epics.filter((e) => e.id !== id),
    })),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsParsing: (parsing) => set({ isParsing: parsing }),
  setError: (error) => set({ error }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setEditingTicket: (ticket) => set({ editingTicket: ticket }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  showToast: (message, type) => set({ toast: { message, type } }),
  hideToast: () => set({ toast: null }),
}));
