import { EventEmitter } from 'events';
import type {
  SlackEvent,
  SlackSyncState,
  SlackInsightType,
} from '@jira-planner/shared';
import type { SlackService } from './slackService.js';
import type { StorageService } from './storageService.js';
import { v4 as uuidv4 } from 'uuid';

const JIRA_KEY_REGEX = /[A-Z]{2,10}-\d+/g;

interface SlackSyncServiceConfig {
  storage: StorageService;
  getSlackService: () => SlackService | null;
}

export class SlackSyncService extends EventEmitter {
  private storage: StorageService;
  private getSlackService: () => SlackService | null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(config: SlackSyncServiceConfig) {
    super();
    this.storage = config.storage;
    this.getSlackService = config.getSlackService;
  }

  startAutoSync(): void {
    const config = this.storage.getSlackConfig();

    if (!config || !config.enabled) {
      console.log('[slack-sync] Auto-sync is disabled');
      return;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    const intervalMs = config.syncIntervalMinutes * 60 * 1000;
    console.log(`[slack-sync] Starting auto-sync with interval ${config.syncIntervalMinutes}m`);

    // Run initial sync
    this.runSync();

    // Set up polling
    this.syncTimer = setInterval(() => {
      this.runSync();
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[slack-sync] Auto-sync stopped');
    }
  }

  async runSync(): Promise<{
    success: boolean;
    channelsProcessed: number;
    messagesProcessed: number;
    insightsExtracted: number;
    error?: string;
  }> {
    if (this.isSyncing) {
      console.log('[slack-sync] Sync already in progress, skipping');
      return {
        success: false,
        channelsProcessed: 0,
        messagesProcessed: 0,
        insightsExtracted: 0,
        error: 'Sync already in progress',
      };
    }

    const config = this.storage.getSlackConfig();
    if (!config || !config.botToken) {
      console.log('[slack-sync] Slack not configured');
      return {
        success: false,
        channelsProcessed: 0,
        messagesProcessed: 0,
        insightsExtracted: 0,
        error: 'Slack not configured',
      };
    }

    const service = this.getSlackService();
    if (!service) {
      console.log('[slack-sync] Slack service not available');
      return {
        success: false,
        channelsProcessed: 0,
        messagesProcessed: 0,
        insightsExtracted: 0,
        error: 'Slack service not available',
      };
    }

    this.isSyncing = true;
    const now = new Date().toISOString();

    this.emitEvent({
      type: 'slack_sync_started',
      timestamp: now,
      data: {},
    });

    this.storage.updateSlackSyncState({
      lastSyncAt: now,
      isSyncing: true,
    });

    try {
      let totalChannels = 0;
      let totalMessages = 0;
      let totalInsights = 0;

      // Get monitored channels
      const monitoredChannels = this.storage.getSlackChannels(true);
      if (monitoredChannels.length === 0) {
        console.log('[slack-sync] No monitored channels');
      }

      // User cache to avoid repeated API calls
      const userCache = new Map<string, string>();

      for (const channel of monitoredChannels) {
        try {
          console.log(`[slack-sync] Syncing channel #${channel.name}...`);

          // Fetch messages since last cursor
          const messages = await service.getChannelHistory(
            channel.id,
            channel.lastSyncCursor ?? undefined,
            undefined,
            100
          );

          let latestTs: string | null = null;

          for (const msg of messages) {
            // Track the latest timestamp for watermark
            if (!latestTs || msg.ts > latestTs) {
              latestTs = msg.ts;
            }

            // Resolve username
            let userName: string | null = null;
            if (msg.userId) {
              if (userCache.has(msg.userId)) {
                userName = userCache.get(msg.userId)!;
              } else {
                const userInfo = await service.getUserInfo(msg.userId);
                if (userInfo) {
                  userName = userInfo.displayName;
                  userCache.set(msg.userId, userName);

                  // Upsert user mapping
                  this.storage.upsertSlackUserMapping({
                    slackUserId: msg.userId,
                    slackDisplayName: userName,
                  });
                }
              }
            }

            // Extract Jira keys
            const jiraKeys = msg.text.match(JIRA_KEY_REGEX) ?? [];

            // Store message
            const messageId = `${channel.id}:${msg.ts}`;
            this.storage.upsertSlackMessage({
              id: messageId,
              channelId: channel.id,
              userId: msg.userId,
              userName,
              text: msg.text,
              threadTs: msg.threadTs,
              ts: msg.ts,
              jiraKeys,
            });

            totalMessages++;

            // Process threads with replies for insights
            if (msg.replyCount > 0 && msg.threadTs === null) {
              const threadReplies = await service.getThreadReplies(channel.id, msg.ts);
              const threadText = threadReplies.map((r) => r.text).join('\n');

              // Extract Jira keys from all thread messages
              const threadJiraKeys = threadText.match(JIRA_KEY_REGEX) ?? [];
              const allJiraKeys = [...new Set([...jiraKeys, ...threadJiraKeys])];

              // Simple heuristic-based insight extraction (no Claude dependency)
              const insights = this.extractInsights(threadText, msg.text, allJiraKeys, channel.id, msg.ts, userCache, msg.userId);
              for (const insight of insights) {
                this.storage.createSlackInsight(insight);
                totalInsights++;
              }

              // Store thread replies
              for (const reply of threadReplies) {
                let replyUserName: string | null = null;
                if (reply.userId) {
                  if (userCache.has(reply.userId)) {
                    replyUserName = userCache.get(reply.userId)!;
                  } else {
                    const userInfo = await service.getUserInfo(reply.userId);
                    if (userInfo) {
                      replyUserName = userInfo.displayName;
                      userCache.set(reply.userId, replyUserName);
                    }
                  }
                }

                const replyJiraKeys = reply.text.match(JIRA_KEY_REGEX) ?? [];
                const replyId = `${channel.id}:${reply.ts}`;
                this.storage.upsertSlackMessage({
                  id: replyId,
                  channelId: channel.id,
                  userId: reply.userId,
                  userName: replyUserName,
                  text: reply.text,
                  threadTs: reply.threadTs,
                  ts: reply.ts,
                  jiraKeys: replyJiraKeys,
                });
              }
            }

            // Extract insights from standalone messages with Jira keys
            if (jiraKeys.length > 0 && !msg.threadTs) {
              const insights = this.extractInsights(msg.text, msg.text, jiraKeys, channel.id, msg.ts, userCache, msg.userId);
              for (const insight of insights) {
                this.storage.createSlackInsight(insight);
                totalInsights++;
              }
            }
          }

          // Update channel sync cursor
          if (latestTs) {
            this.storage.updateSlackChannelCursor(channel.id, latestTs, messages.length);
          }

          totalChannels++;
        } catch (error) {
          console.error(`[slack-sync] Error syncing channel #${channel.name}:`, error);
        }
      }

      // Retention cleanup: remove messages older than retention period
      const retentionDays = config.messageRetentionDays;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      this.storage.deleteOldSlackMessages(cutoffDate);

      // Update successful sync
      this.storage.updateSlackSyncState({
        lastSuccessfulSyncAt: new Date().toISOString(),
        isSyncing: false,
        errorCount: 0,
        lastError: null,
      });

      this.emitEvent({
        type: 'slack_sync_completed',
        timestamp: new Date().toISOString(),
        data: {
          channelsProcessed: totalChannels,
          messagesProcessed: totalMessages,
          insightsExtracted: totalInsights,
        },
      });

      console.log(`[slack-sync] Completed: ${totalChannels} channels, ${totalMessages} messages, ${totalInsights} insights`);

      return {
        success: true,
        channelsProcessed: totalChannels,
        messagesProcessed: totalMessages,
        insightsExtracted: totalInsights,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const syncState = this.storage.getSlackSyncState();

      this.storage.updateSlackSyncState({
        isSyncing: false,
        errorCount: syncState.errorCount + 1,
        lastError: errorMessage,
      });

      this.emitEvent({
        type: 'slack_sync_error',
        timestamp: new Date().toISOString(),
        data: { error: errorMessage },
      });

      console.error('[slack-sync] Error:', errorMessage);

      return {
        success: false,
        channelsProcessed: 0,
        messagesProcessed: 0,
        insightsExtracted: 0,
        error: errorMessage,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Simple heuristic-based insight extraction from message text
   */
  private extractInsights(
    fullText: string,
    messageText: string,
    jiraKeys: string[],
    channelId: string,
    messageTs: string,
    userCache: Map<string, string>,
    userId: string | null
  ): Array<{
    id: string;
    type: SlackInsightType;
    content: string;
    channelId: string;
    messageTs: string;
    jiraKey: string | null;
    teamMemberId: string | null;
  }> {
    const insights: Array<{
      id: string;
      type: SlackInsightType;
      content: string;
      channelId: string;
      messageTs: string;
      jiraKey: string | null;
      teamMemberId: string | null;
    }> = [];

    const textLower = fullText.toLowerCase();
    const primaryJiraKey = jiraKeys.length > 0 ? jiraKeys[0] : null;

    // Look up team member from user mapping
    let teamMemberId: string | null = null;
    if (userId) {
      const mapping = this.storage.getSlackUserMapping(userId);
      if (mapping?.teamMemberId) {
        teamMemberId = mapping.teamMemberId;
      }
    }

    // Decision detection
    if (
      textLower.includes('decided') ||
      textLower.includes('decision:') ||
      textLower.includes('we agreed') ||
      textLower.includes('going with') ||
      textLower.includes('let\'s go with')
    ) {
      insights.push({
        id: uuidv4(),
        type: 'decision',
        content: messageText.slice(0, 500),
        channelId,
        messageTs,
        jiraKey: primaryJiraKey,
        teamMemberId,
      });
    }

    // Blocker detection
    if (
      textLower.includes('blocked') ||
      textLower.includes('blocker') ||
      textLower.includes('blocking') ||
      textLower.includes('stuck on') ||
      textLower.includes('can\'t proceed')
    ) {
      insights.push({
        id: uuidv4(),
        type: 'blocker',
        content: messageText.slice(0, 500),
        channelId,
        messageTs,
        jiraKey: primaryJiraKey,
        teamMemberId,
      });
    }

    // Action item detection
    if (
      textLower.includes('action item') ||
      textLower.includes('todo:') ||
      textLower.includes('to-do:') ||
      textLower.includes('will do') ||
      textLower.includes('i\'ll take') ||
      textLower.includes('assigned to')
    ) {
      insights.push({
        id: uuidv4(),
        type: 'action_item',
        content: messageText.slice(0, 500),
        channelId,
        messageTs,
        jiraKey: primaryJiraKey,
        teamMemberId,
      });
    }

    // Update detection (messages referencing Jira keys)
    if (jiraKeys.length > 0 && insights.length === 0) {
      if (
        textLower.includes('update') ||
        textLower.includes('progress') ||
        textLower.includes('completed') ||
        textLower.includes('finished') ||
        textLower.includes('done with') ||
        textLower.includes('working on')
      ) {
        insights.push({
          id: uuidv4(),
          type: 'update',
          content: messageText.slice(0, 500),
          channelId,
          messageTs,
          jiraKey: primaryJiraKey,
          teamMemberId,
        });
      }
    }

    return insights;
  }

  private emitEvent(event: SlackEvent): void {
    this.emit('slackEvent', event);
  }

  subscribe(callback: (event: SlackEvent) => void): () => void {
    this.on('slackEvent', callback);
    return () => this.off('slackEvent', callback);
  }

  getStatus(): {
    isRunning: boolean;
    syncState: SlackSyncState;
    hasTimer: boolean;
  } {
    return {
      isRunning: this.isSyncing,
      syncState: this.storage.getSlackSyncState(),
      hasTimer: this.syncTimer !== null,
    };
  }
}

export const createSlackSyncService = (config: SlackSyncServiceConfig): SlackSyncService => {
  return new SlackSyncService(config);
};
