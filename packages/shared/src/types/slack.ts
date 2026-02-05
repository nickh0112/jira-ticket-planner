// Slack configuration
export interface SlackConfig {
  id: string;
  botToken: string | null;
  monitoredChannels: string[];
  syncIntervalMinutes: number;
  messageRetentionDays: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSlackConfigInput {
  botToken: string;
  monitoredChannels?: string[];
  syncIntervalMinutes?: number;
  messageRetentionDays?: number;
  enabled?: boolean;
}

export interface UpdateSlackConfigInput {
  botToken?: string;
  monitoredChannels?: string[];
  syncIntervalMinutes?: number;
  messageRetentionDays?: number;
  enabled?: boolean;
}

// Slack channel
export interface SlackChannel {
  id: string;
  name: string;
  isMonitored: boolean;
  lastSyncCursor: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

// Slack message
export interface SlackMessage {
  id: string;
  channelId: string;
  userId: string | null;
  userName: string | null;
  text: string;
  threadTs: string | null;
  ts: string;
  jiraKeys: string[];
  createdAt: string;
}

// Thread summary
export interface SlackThreadSummary {
  id: string;
  channelId: string;
  threadTs: string;
  summary: string;
  decisions: string[];
  actionItems: string[];
  createdAt: string;
}

// Slack insight
export type SlackInsightType = 'decision' | 'action_item' | 'blocker' | 'update';

export interface SlackInsight {
  id: string;
  type: SlackInsightType;
  content: string;
  channelId: string;
  messageTs: string;
  jiraKey: string | null;
  teamMemberId: string | null;
  createdAt: string;
}

// User mapping
export interface SlackUserMapping {
  slackUserId: string;
  teamMemberId: string | null;
  slackDisplayName: string | null;
  createdAt: string;
}

// Sync state
export interface SlackSyncState {
  id: string;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  isSyncing: boolean;
  errorCount: number;
  lastError: string | null;
  updatedAt: string;
}

// SSE Events
export interface SlackSyncEvent {
  type: 'slack_sync_started' | 'slack_sync_completed' | 'slack_sync_error';
  timestamp: string;
  data: Record<string, unknown>;
}

export type SlackEvent = SlackSyncEvent;

// API responses
export interface SlackTestConnectionResponse {
  success: boolean;
  teamName?: string;
  botName?: string;
  error?: string;
}
