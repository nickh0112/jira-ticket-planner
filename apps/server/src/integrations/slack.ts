/**
 * Slack Integration - User OAuth
 * 
 * This uses a user token (xoxp-) not a bot token, so it works without admin access.
 * Nick authorizes his own Slack account to read channels he's a member of.
 */

interface SlackMessage {
  ts: string;
  user: string;
  text: string;
  channel: string;
  threadTs?: string;
}

interface SlackChannel {
  id: string;
  name: string;
  isMember: boolean;
}

interface SlackUser {
  id: string;
  name: string;
  realName: string;
}

export class SlackService {
  private token: string;
  private baseUrl = 'https://slack.com/api';
  private userCache: Map<string, SlackUser> = new Map();

  constructor(userToken: string) {
    this.token = userToken;
  }

  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
  }

  async testConnection(): Promise<{ ok: boolean; user?: string; team?: string }> {
    try {
      const data = await this.fetch<{ user: string; team: string }>('auth.test');
      return { ok: true, user: data.user, team: data.team };
    } catch (error) {
      return { ok: false };
    }
  }

  async listChannels(): Promise<SlackChannel[]> {
    const data = await this.fetch<{ channels: any[] }>('conversations.list', {
      types: 'public_channel,private_channel',
      limit: '200',
    });

    return data.channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      isMember: ch.is_member,
    }));
  }

  async getUser(userId: string): Promise<SlackUser | null> {
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    try {
      const data = await this.fetch<{ user: any }>('users.info', { user: userId });
      const user: SlackUser = {
        id: data.user.id,
        name: data.user.name,
        realName: data.user.real_name || data.user.name,
      };
      this.userCache.set(userId, user);
      return user;
    } catch {
      return null;
    }
  }

  async getChannelHistory(
    channelId: string,
    options: { oldest?: string; limit?: number } = {}
  ): Promise<SlackMessage[]> {
    const params: Record<string, string> = {
      channel: channelId,
      limit: String(options.limit || 100),
    };
    if (options.oldest) {
      params.oldest = options.oldest;
    }

    const data = await this.fetch<{ messages: any[] }>('conversations.history', params);

    return data.messages.map((msg) => ({
      ts: msg.ts,
      user: msg.user,
      text: msg.text,
      channel: channelId,
      threadTs: msg.thread_ts,
    }));
  }

  /**
   * Get messages from multiple channels since a timestamp
   * Returns messages formatted for context/summarization
   */
  async getRecentMessages(
    channelIds: string[],
    sinceTs?: string
  ): Promise<{ channel: string; messages: SlackMessage[] }[]> {
    const results = await Promise.all(
      channelIds.map(async (channelId) => {
        const messages = await this.getChannelHistory(channelId, { oldest: sinceTs });
        return { channel: channelId, messages };
      })
    );
    return results;
  }

  /**
   * Format messages for AI processing
   */
  async formatMessagesForContext(
    messages: SlackMessage[]
  ): Promise<string> {
    const formatted: string[] = [];

    for (const msg of messages) {
      const user = await this.getUser(msg.user);
      const userName = user?.realName || msg.user;
      const time = new Date(parseFloat(msg.ts) * 1000).toISOString();
      formatted.push(`[${time}] ${userName}: ${msg.text}`);
    }

    return formatted.join('\n');
  }

  /**
   * Extract action items and commitments from messages
   * This can be fed to Claude for parsing
   */
  async getContextForTicketCreation(
    channelIds: string[],
    sinceTs?: string
  ): Promise<string> {
    const allResults = await this.getRecentMessages(channelIds, sinceTs);
    const sections: string[] = [];

    for (const { channel, messages } of allResults) {
      if (messages.length === 0) continue;
      const formatted = await this.formatMessagesForContext(messages);
      sections.push(`## Channel: ${channel}\n${formatted}`);
    }

    return sections.join('\n\n');
  }
}

/**
 * Slack User OAuth Setup Instructions
 * 
 * Since Nick isn't a Slack admin, we use User Token Scopes:
 * 
 * 1. Go to https://api.slack.com/apps and click "Create New App"
 * 2. Choose "From scratch", name it "Jira Planner Personal", select your workspace
 * 3. Go to "OAuth & Permissions" in the sidebar
 * 4. Under "User Token Scopes", add these scopes:
 *    - channels:history (read public channel messages)
 *    - channels:read (list public channels)
 *    - groups:history (read private channel messages you're in)
 *    - groups:read (list private channels you're in)
 *    - users:read (get user info for names)
 * 5. Click "Install to Workspace" at the top
 * 6. Authorize with YOUR account (not as admin)
 * 7. Copy the "User OAuth Token" (starts with xoxp-)
 * 8. Add to .env: SLACK_USER_TOKEN=xoxp-...
 */
export const SLACK_SETUP_INSTRUCTIONS = `
# Slack User OAuth Setup (No Admin Required)

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "Jira Planner Personal"
4. Select your workspace
5. Go to "OAuth & Permissions"
6. Add these User Token Scopes:
   - channels:history
   - channels:read
   - groups:history
   - groups:read
   - users:read
7. Click "Install to Workspace"
8. Authorize with your account
9. Copy the "User OAuth Token" (xoxp-...)
10. Add to your .env file:
    SLACK_USER_TOKEN=xoxp-your-token-here
`;

export const createSlackService = (): SlackService | null => {
  const token = process.env.SLACK_USER_TOKEN;
  if (!token) {
    console.log('[slack] No SLACK_USER_TOKEN configured');
    return null;
  }
  return new SlackService(token);
};
