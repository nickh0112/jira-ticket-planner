import { create } from 'zustand';
import type {
  EngineerStatus,
  PMAlert,
  PMAssignment,
  AITicketSuggestion,
  PMConfig,
  PMMetrics,
  EngineerDetailData,
} from '@jira-planner/shared';
import {
  getPMDashboard,
  getPMAlerts,
  dismissPMAlert as apiDismissPMAlert,
  getPMSuggestions,
  generatePMSuggestions as apiGeneratePMSuggestions,
  approvePMSuggestion as apiApprovePMSuggestion,
  rejectPMSuggestion as apiRejectPMSuggestion,
  getPMConfig,
  updatePMConfig as apiUpdatePMConfig,
  triggerPMCheck,
  getPMEngineerDetail,
} from '../utils/api';

interface PMState {
  // Data
  engineers: EngineerStatus[];
  alerts: PMAlert[];
  suggestions: AITicketSuggestion[];
  assignments: PMAssignment[];
  metrics: PMMetrics | null;
  config: PMConfig | null;
  engineerDetail: EngineerDetailData | null;

  // UI State
  isLoading: boolean;
  isChecking: boolean;
  isLoadingDetail: boolean;
  selectedEngineerId: string | null;
  error: string | null;

  // Actions
  loadDashboard: () => Promise<void>;
  loadAlerts: () => Promise<void>;
  loadSuggestions: (memberId?: string) => Promise<void>;
  loadConfig: () => Promise<void>;
  loadEngineerDetail: (memberId: string) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
  generateSuggestions: (memberId: string) => Promise<void>;
  approveSuggestion: (id: string) => Promise<void>;
  rejectSuggestion: (id: string) => Promise<void>;
  updateConfig: (updates: Partial<PMConfig>) => Promise<void>;
  runCheck: () => Promise<void>;
  setSelectedEngineerId: (id: string | null) => void;
  setError: (error: string | null) => void;
}

export const usePMStore = create<PMState>((set, get) => ({
  // Initial state
  engineers: [],
  alerts: [],
  suggestions: [],
  assignments: [],
  metrics: null,
  config: null,
  engineerDetail: null,
  isLoading: false,
  isChecking: false,
  isLoadingDetail: false,
  selectedEngineerId: null,
  error: null,

  // Actions
  loadDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getPMDashboard();
      set({
        engineers: data.engineers,
        alerts: data.activeAlerts,
        assignments: data.recentAssignments,
        metrics: data.metrics,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load dashboard',
        isLoading: false,
      });
    }
  },

  loadAlerts: async () => {
    try {
      const alerts = await getPMAlerts();
      set({ alerts });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load alerts' });
    }
  },

  loadSuggestions: async (memberId?: string) => {
    try {
      const suggestions = await getPMSuggestions(memberId);
      set({ suggestions });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load suggestions' });
    }
  },

  loadConfig: async () => {
    try {
      const config = await getPMConfig();
      set({ config });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load config' });
    }
  },

  loadEngineerDetail: async (memberId: string) => {
    set({ isLoadingDetail: true, engineerDetail: null });
    try {
      const detail = await getPMEngineerDetail(memberId);
      set({ engineerDetail: detail, isLoadingDetail: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load engineer detail',
        isLoadingDetail: false,
      });
    }
  },

  dismissAlert: async (id: string) => {
    try {
      await apiDismissPMAlert(id);
      set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to dismiss alert' });
    }
  },

  generateSuggestions: async (memberId: string) => {
    set({ isLoading: true, error: null });
    try {
      const suggestions = await apiGeneratePMSuggestions(memberId);
      set((state) => {
        // Replace suggestions for this member
        const otherSuggestions = state.suggestions.filter(
          (s) => s.teamMemberId !== memberId
        );
        return {
          suggestions: [...otherSuggestions, ...suggestions],
          isLoading: false,
        };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to generate suggestions',
        isLoading: false,
      });
    }
  },

  approveSuggestion: async (id: string) => {
    try {
      const result = await apiApprovePMSuggestion(id);
      set((state) => ({
        suggestions: state.suggestions.filter((s) => s.id !== id),
        assignments: [result.assignment, ...state.assignments],
      }));
      // Refresh dashboard to update engineer status
      get().loadDashboard();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to approve suggestion' });
    }
  },

  rejectSuggestion: async (id: string) => {
    try {
      await apiRejectPMSuggestion(id);
      set((state) => ({
        suggestions: state.suggestions.filter((s) => s.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to reject suggestion' });
    }
  },

  updateConfig: async (updates: Partial<PMConfig>) => {
    try {
      const config = await apiUpdatePMConfig(updates);
      set({ config });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update config' });
    }
  },

  runCheck: async () => {
    set({ isChecking: true, error: null });
    try {
      await triggerPMCheck();
      // Refresh dashboard after check
      await get().loadDashboard();
      set({ isChecking: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Check failed',
        isChecking: false,
      });
    }
  },

  setSelectedEngineerId: (id) => set({ selectedEngineerId: id }),
  setError: (error) => set({ error }),
}));
