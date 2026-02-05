import { create } from 'zustand';
import type {
  SlackConfig,
  SlackChannel,
  SlackInsight,
  SlackUserMapping,
  SlackSyncState,
  UpdateSlackConfigInput,
} from '@jira-planner/shared';
import {
  getSlackConfig,
  updateSlackConfig as apiUpdateConfig,
  testSlackConnection,
  getSlackChannels,
  toggleSlackChannel as apiToggleChannel,
  getSlackInsights,
  triggerSlackSync,
  getSlackSyncStatus,
  getSlackUserMappings,
  updateSlackUserMapping as apiUpdateUserMapping,
} from '../utils/api';

interface SlackState {
  // Data
  config: SlackConfig | null;
  channels: SlackChannel[];
  insights: SlackInsight[];
  userMappings: SlackUserMapping[];
  syncState: SlackSyncState | null;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  isSyncing: boolean;
  testResult: { success: boolean; teamName?: string; error?: string } | null;
  error: string | null;

  // Actions
  fetchConfig: () => Promise<void>;
  updateConfig: (input: UpdateSlackConfigInput) => Promise<void>;
  testConnection: () => Promise<void>;
  fetchChannels: () => Promise<void>;
  toggleMonitoring: (channelId: string, isMonitored: boolean) => Promise<void>;
  fetchInsights: (limit?: number) => Promise<void>;
  fetchSyncStatus: () => Promise<void>;
  triggerSync: () => Promise<void>;
  fetchUserMappings: () => Promise<void>;
  updateUserMapping: (slackUserId: string, teamMemberId: string | null) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useSlackStore = create<SlackState>((set) => ({
  config: null,
  channels: [],
  insights: [],
  userMappings: [],
  syncState: null,
  isLoading: false,
  isSaving: false,
  isTesting: false,
  isSyncing: false,
  testResult: null,
  error: null,

  fetchConfig: async () => {
    try {
      const { config } = await getSlackConfig();
      set({ config });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load Slack config' });
    }
  },

  updateConfig: async (input) => {
    set({ isSaving: true, error: null });
    try {
      const config = await apiUpdateConfig(input);
      set({ config, isSaving: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update Slack config',
        isSaving: false,
      });
    }
  },

  testConnection: async () => {
    set({ isTesting: true, testResult: null, error: null });
    try {
      const result = await testSlackConnection();
      set({ testResult: result, isTesting: false });
    } catch (error) {
      set({
        testResult: { success: false, error: error instanceof Error ? error.message : 'Connection test failed' },
        isTesting: false,
      });
    }
  },

  fetchChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const channels = await getSlackChannels();
      set({ channels, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load channels',
        isLoading: false,
      });
    }
  },

  toggleMonitoring: async (channelId, isMonitored) => {
    try {
      const updated = await apiToggleChannel(channelId, isMonitored);
      set((state) => ({
        channels: state.channels.map((c) => (c.id === channelId ? updated : c)),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to toggle channel' });
    }
  },

  fetchInsights: async (limit = 50) => {
    try {
      const insights = await getSlackInsights(limit);
      set({ insights });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load insights' });
    }
  },

  fetchSyncStatus: async () => {
    try {
      const syncState = await getSlackSyncStatus();
      set({ syncState });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load sync status' });
    }
  },

  triggerSync: async () => {
    set({ isSyncing: true, error: null });
    try {
      const syncState = await triggerSlackSync();
      set({ syncState, isSyncing: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to trigger sync',
        isSyncing: false,
      });
    }
  },

  fetchUserMappings: async () => {
    try {
      const userMappings = await getSlackUserMappings();
      set({ userMappings });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load user mappings' });
    }
  },

  updateUserMapping: async (slackUserId, teamMemberId) => {
    try {
      const updated = await apiUpdateUserMapping(slackUserId, teamMemberId);
      set((state) => ({
        userMappings: state.userMappings.map((m) =>
          m.slackUserId === slackUserId ? updated : m
        ),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update user mapping' });
    }
  },

  setError: (error) => set({ error }),
}));
