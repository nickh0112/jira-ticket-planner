import { create } from 'zustand';
import type {
  AutomationConfig,
  AutomationRun,
  AutomationAction,
  UpdateAutomationConfigInput,
} from '@jira-planner/shared';
import {
  getAutomationConfig,
  updateAutomationConfig as apiUpdateConfig,
  triggerAutomationRun,
  getAutomationRuns,
  getAutomationActions,
  approveAutomationAction as apiApproveAction,
  rejectAutomationAction as apiRejectAction,
} from '../utils/api';

interface AutomationState {
  // Data
  config: AutomationConfig | null;
  runs: AutomationRun[];
  actions: AutomationAction[];

  // UI State
  isLoading: boolean;
  isRunning: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  fetchConfig: () => Promise<void>;
  updateConfig: (input: UpdateAutomationConfigInput) => Promise<void>;
  triggerRun: () => Promise<void>;
  fetchRuns: (limit?: number) => Promise<void>;
  fetchActions: (filters?: { status?: string; type?: string }) => Promise<void>;
  approveAction: (id: string) => Promise<void>;
  rejectAction: (id: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  // Initial state
  config: null,
  runs: [],
  actions: [],
  isLoading: false,
  isRunning: false,
  isSaving: false,
  error: null,

  // Actions
  fetchConfig: async () => {
    try {
      const config = await getAutomationConfig();
      set({ config });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load config' });
    }
  },

  updateConfig: async (input: UpdateAutomationConfigInput) => {
    set({ isSaving: true, error: null });
    try {
      const config = await apiUpdateConfig(input);
      set({ config, isSaving: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update config',
        isSaving: false,
      });
    }
  },

  triggerRun: async () => {
    set({ isRunning: true, error: null });
    try {
      const run = await triggerAutomationRun();
      set((state) => ({
        runs: [run, ...state.runs],
        isRunning: false,
      }));
      // Refresh actions after a run
      await get().fetchActions();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to trigger run',
        isRunning: false,
      });
    }
  },

  fetchRuns: async (limit = 20) => {
    set({ isLoading: true, error: null });
    try {
      const runs = await getAutomationRuns(limit);
      set({ runs, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load runs',
        isLoading: false,
      });
    }
  },

  fetchActions: async (filters?: { status?: string; type?: string }) => {
    try {
      const actions = await getAutomationActions(filters);
      set({ actions });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load actions' });
    }
  },

  approveAction: async (id: string) => {
    try {
      const updated = await apiApproveAction(id);
      set((state) => ({
        actions: state.actions.map((a) => (a.id === id ? updated : a)),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to approve action' });
    }
  },

  rejectAction: async (id: string) => {
    try {
      const updated = await apiRejectAction(id);
      set((state) => ({
        actions: state.actions.map((a) => (a.id === id ? updated : a)),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to reject action' });
    }
  },

  setError: (error) => set({ error }),
}));
