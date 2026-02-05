import { WebClient } from '@slack/web-api';
import type { SlackTestConnectionResponse } from '@jira-planner/shared';

interface SlackChannelInfo {
  id: string;
  name: string;
  numMembers: number;
  topic: string;
  purpose: string;
}

interface SlackMessageInfo {
  ts: string;
  userId: string | null;
  text: string;
  threadTs: string | null;
  replyCount: number;
}

interface SlackUserInfo {
  id: string;
  name: string;
  realName: string;
  displayName: string;
}

export class SlackService {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async testConnection(): Promise<SlackTestConnectionResponse> {
    try {
      const result = await this.client.auth.test();

      if (!result.ok) {
        return {
          success: false,
          error: result.error || 'Authentication failed',
        };
      }

      return {
        success: true,
        teamName: result.team as string,
        botName: result.user as string,
      };
    } catch (error) {
      console.error('[slack] Connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async listChannels(): Promise<SlackChannelInfo[]> {
    try {
      const result = await this.client.conversations.list({
        types: 'public_channel',
        exclude_archived: true,
        limit: 200,
      });

      if (!result.ok || !result.channels) {
        console.error('[slack] Failed to list channels:', result.error);
        return [];
      }

      return result.channels
        .filter((ch) => ch.id && ch.name)
        .map((ch) => ({
          id: ch.id!,
          name: ch.name!,
          numMembers: ch.num_members ?? 0,
          topic: (ch.topic as any)?.value ?? '',
          purpose: (ch.purpose as any)?.value ?? '',
        }));
    } catch (error) {
      console.error('[slack] Failed to list channels:', error);
      return [];
    }
  }

  async getChannelHistory(
    channelId: string,
    oldest?: string,
    latest?: string,
    limit = 100
  ): Promise<SlackMessageInfo[]> {
    try {
      const result = await this.client.conversations.history({
        channel: channelId,
        limit,
        ...(oldest ? { oldest } : {}),
        ...(latest ? { latest } : {}),
      });

      if (!result.ok || !result.messages) {
        console.error('[slack] Failed to get channel history:', result.error);
        return [];
      }

      return result.messages.map((msg) => ({
        ts: msg.ts!,
        userId: msg.user ?? null,
        text: msg.text ?? '',
        threadTs: msg.thread_ts ?? null,
        replyCount: (msg as any).reply_count ?? 0,
      }));
    } catch (error) {
      console.error(`[slack] Failed to get history for channel ${channelId}:`, error);
      return [];
    }
  }

  async getThreadReplies(
    channelId: string,
    threadTs: string
  ): Promise<SlackMessageInfo[]> {
    try {
      const result = await this.client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: 200,
      });

      if (!result.ok || !result.messages) {
        console.error('[slack] Failed to get thread replies:', result.error);
        return [];
      }

      return result.messages.map((msg) => ({
        ts: msg.ts!,
        userId: msg.user ?? null,
        text: msg.text ?? '',
        threadTs: msg.thread_ts ?? null,
        replyCount: (msg as any).reply_count ?? 0,
      }));
    } catch (error) {
      console.error(`[slack] Failed to get thread replies for ${threadTs}:`, error);
      return [];
    }
  }

  async getUserInfo(userId: string): Promise<SlackUserInfo | null> {
    try {
      const result = await this.client.users.info({ user: userId });

      if (!result.ok || !result.user) {
        console.error('[slack] Failed to get user info:', result.error);
        return null;
      }

      const user = result.user;
      return {
        id: user.id!,
        name: user.name ?? user.id!,
        realName: user.real_name ?? user.name ?? user.id!,
        displayName: user.profile?.display_name || user.real_name || user.name || user.id!,
      };
    } catch (error) {
      console.error(`[slack] Failed to get user info for ${userId}:`, error);
      return null;
    }
  }
}

export const createSlackService = (token?: string | null): SlackService | null => {
  if (!token) {
    return null;
  }
  return new SlackService(token);
};
