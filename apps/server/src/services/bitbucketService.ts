import type {
  BitbucketConfig,
  BitbucketTestConnectionResponse,
  BitbucketWorkspaceMember,
  BitbucketPullRequest,
  BitbucketCommit,
  BitbucketPipeline,
  BitbucketReviewer,
} from '@jira-planner/shared';

const BITBUCKET_API_BASE = 'https://api.bitbucket.org/2.0';

interface BitbucketServiceConfig {
  email: string; // Atlassian account email for API token auth
  appPassword: string; // API token (new Bitbucket auth method)
}

// Bitbucket API response types
interface BitbucketPaginatedResponse<T> {
  values: T[];
  pagelen: number;
  size?: number;
  page?: number;
  next?: string;
  previous?: string;
}

interface BitbucketAPIUser {
  account_id: string;
  uuid: string;
  username?: string;
  nickname?: string;
  display_name: string;
  links?: {
    avatar?: { href: string };
  };
}

interface BitbucketAPIPullRequest {
  id: number;
  title: string;
  description: string | null;
  state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';
  author: BitbucketAPIUser;
  source: {
    branch: { name: string };
    repository: { full_name: string };
  };
  destination: {
    branch: { name: string };
    repository: { full_name: string };
  };
  reviewers: BitbucketAPIUser[];
  participants: Array<{
    user: BitbucketAPIUser;
    role: 'PARTICIPANT' | 'REVIEWER';
    approved: boolean;
    participated_on: string | null;
  }>;
  created_on: string;
  updated_on: string;
  merge_commit?: { hash: string };
  closed_on?: string;
}

interface BitbucketAPICommit {
  hash: string;
  message: string;
  author: {
    raw: string;
    user?: BitbucketAPIUser;
  };
  date: string;
  repository?: {
    full_name: string;
  };
}

interface BitbucketAPIPipeline {
  uuid: string;
  build_number: number;
  state: {
    name: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED';
    result?: {
      name: 'SUCCESSFUL' | 'FAILED' | 'ERROR' | 'STOPPED';
    };
  };
  trigger: {
    name: 'PUSH' | 'PULL_REQUEST' | 'MANUAL' | 'SCHEDULE';
  };
  target: {
    ref_name: string;
    commit: { hash: string };
  };
  duration_in_seconds?: number;
  created_on: string;
  completed_on?: string;
}

interface BitbucketAPIRepository {
  slug: string;
  name: string;
  full_name: string;
  workspace: {
    slug: string;
    name: string;
  };
  updated_on: string;
}

export class BitbucketService {
  private email: string;
  private appPassword: string;

  constructor(config: BitbucketServiceConfig) {
    this.email = config.email;
    this.appPassword = config.appPassword;
  }

  private getAuthHeader(): string {
    // New Bitbucket API tokens require email for authentication
    const credentials = Buffer.from(`${this.email}:${this.appPassword}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retries = 3,
    delay = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[bitbucket] Attempt ${attempt + 1}/${retries}: ${options.method || 'GET'} ${url}`);

        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`[bitbucket] HTTP ${response.status}: ${errorBody}`);

          let errorMessage = `Bitbucket API error: ${response.status} ${response.statusText}`;
          try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error?.message) {
              errorMessage = errorJson.error.message;
            }
          } catch {
            if (errorBody) {
              errorMessage = `Bitbucket API error (${response.status}): ${errorBody.slice(0, 200)}`;
            }
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log(`[bitbucket] Success: ${options.method || 'GET'} ${url}`);
        return data;
      } catch (error) {
        const isNetworkError = error instanceof TypeError ||
          (error instanceof Error && error.message.includes('fetch'));

        if (isNetworkError) {
          console.error(`[bitbucket] Network error on attempt ${attempt + 1}: ${error}`);
        }

        if (attempt === retries - 1) {
          if (isNetworkError) {
            throw new Error(`Unable to connect to Bitbucket. Please verify your network connection: ${url}`);
          }
          throw error;
        }

        console.log(`[bitbucket] Retrying in ${delay * Math.pow(2, attempt)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Fetch all pages of a paginated endpoint
   */
  private async fetchAllPages<T>(
    initialUrl: string,
    maxPages = 10
  ): Promise<T[]> {
    const allItems: T[] = [];
    let url: string | undefined = initialUrl;
    let pageCount = 0;

    while (url && pageCount < maxPages) {
      const response: BitbucketPaginatedResponse<T> = await this.fetchWithRetry<BitbucketPaginatedResponse<T>>(url);
      allItems.push(...response.values);
      url = response.next;
      pageCount++;
    }

    return allItems;
  }

  /**
   * Test connection to Bitbucket
   */
  async testConnection(workspace: string): Promise<BitbucketTestConnectionResponse> {
    try {
      // First verify the user credentials work
      const userUrl = `${BITBUCKET_API_BASE}/user`;
      const userResult = await this.fetchWithRetry<BitbucketAPIUser>(userUrl);

      // Verify access to the workspace by listing repos (doesn't require workspace:read scope)
      const reposUrl = `${BITBUCKET_API_BASE}/repositories/${workspace}?pagelen=1`;
      const reposResult = await this.fetchWithRetry<{ values: BitbucketAPIRepository[] }>(reposUrl);

      return {
        success: true,
        workspaceName: workspace, // Use the workspace slug since we can't get the name without workspace:read
        username: userResult.display_name || userResult.username || this.email,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Get workspace members
   */
  async getWorkspaceMembers(workspace: string): Promise<BitbucketWorkspaceMember[]> {
    try {
      const url = `${BITBUCKET_API_BASE}/workspaces/${workspace}/members`;
      const members = await this.fetchAllPages<{
        user: BitbucketAPIUser;
      }>(url);

      return members.map((member) => ({
        accountId: member.user.account_id,
        username: member.user.username || member.user.nickname || member.user.account_id,
        displayName: member.user.display_name,
        avatarUrl: member.user.links?.avatar?.href || null,
      }));
    } catch (error) {
      console.error('[bitbucket] Failed to fetch workspace members:', error);
      return [];
    }
  }

  /**
   * Get repositories that a user contributes to
   */
  async getUserRepositories(workspace: string): Promise<BitbucketAPIRepository[]> {
    try {
      // Get repos where the authenticated user has contributor role
      const url = `${BITBUCKET_API_BASE}/repositories/${workspace}?role=contributor&pagelen=100`;
      return await this.fetchAllPages<BitbucketAPIRepository>(url);
    } catch (error) {
      console.error('[bitbucket] Failed to fetch user repositories:', error);
      return [];
    }
  }

  /**
   * Get all repositories in a workspace
   */
  async getWorkspaceRepositories(workspace: string): Promise<BitbucketAPIRepository[]> {
    try {
      const url = `${BITBUCKET_API_BASE}/repositories/${workspace}?pagelen=100`;
      return await this.fetchAllPages<BitbucketAPIRepository>(url);
    } catch (error) {
      console.error('[bitbucket] Failed to fetch workspace repositories:', error);
      return [];
    }
  }

  /**
   * Get pull requests for a repository
   */
  async getPullRequests(
    workspace: string,
    repoSlug: string,
    options: {
      state?: 'OPEN' | 'MERGED' | 'DECLINED' | 'ALL';
      updatedAfter?: string;
    } = {}
  ): Promise<BitbucketPullRequest[]> {
    try {
      let url = `${BITBUCKET_API_BASE}/repositories/${workspace}/${repoSlug}/pullrequests?pagelen=50`;

      if (options.state && options.state !== 'ALL') {
        url += `&state=${options.state}`;
      } else {
        // Fetch all states
        url += '&state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED';
      }

      const prs = await this.fetchAllPages<BitbucketAPIPullRequest>(url, 5);

      return prs
        .filter(pr => {
          if (options.updatedAfter) {
            return new Date(pr.updated_on) >= new Date(options.updatedAfter);
          }
          return true;
        })
        .map((pr) => this.mapPullRequest(pr, repoSlug));
    } catch (error) {
      console.error(`[bitbucket] Failed to fetch PRs for ${workspace}/${repoSlug}:`, error);
      return [];
    }
  }

  /**
   * Get a single pull request
   */
  async getPullRequest(
    workspace: string,
    repoSlug: string,
    prNumber: number
  ): Promise<BitbucketPullRequest | null> {
    try {
      const url = `${BITBUCKET_API_BASE}/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}`;
      const pr = await this.fetchWithRetry<BitbucketAPIPullRequest>(url);
      return this.mapPullRequest(pr, repoSlug);
    } catch (error) {
      console.error(`[bitbucket] Failed to fetch PR ${prNumber} for ${workspace}/${repoSlug}:`, error);
      return null;
    }
  }

  /**
   * Get commits for a repository
   */
  async getCommits(
    workspace: string,
    repoSlug: string,
    options: {
      branch?: string;
      author?: string;
      since?: string;
    } = {}
  ): Promise<BitbucketCommit[]> {
    try {
      let url = `${BITBUCKET_API_BASE}/repositories/${workspace}/${repoSlug}/commits?pagelen=50`;

      if (options.branch) {
        url = `${BITBUCKET_API_BASE}/repositories/${workspace}/${repoSlug}/commits/${options.branch}?pagelen=50`;
      }

      const commits = await this.fetchAllPages<BitbucketAPICommit>(url, 5);

      return commits
        .filter(commit => {
          if (options.since) {
            return new Date(commit.date) >= new Date(options.since);
          }
          return true;
        })
        .map((commit) => this.mapCommit(commit, repoSlug));
    } catch (error) {
      console.error(`[bitbucket] Failed to fetch commits for ${workspace}/${repoSlug}:`, error);
      return [];
    }
  }

  /**
   * Get pipelines for a repository
   */
  async getPipelines(
    workspace: string,
    repoSlug: string,
    options: {
      since?: string;
    } = {}
  ): Promise<BitbucketPipeline[]> {
    try {
      const url = `${BITBUCKET_API_BASE}/repositories/${workspace}/${repoSlug}/pipelines/?pagelen=50&sort=-created_on`;
      const pipelines = await this.fetchAllPages<BitbucketAPIPipeline>(url, 3);

      return pipelines
        .filter(pipeline => {
          if (options.since) {
            return new Date(pipeline.created_on) >= new Date(options.since);
          }
          return true;
        })
        .map((pipeline) => this.mapPipeline(pipeline, repoSlug));
    } catch (error) {
      console.error(`[bitbucket] Failed to fetch pipelines for ${workspace}/${repoSlug}:`, error);
      return [];
    }
  }

  /**
   * Get user's PRs across the workspace
   */
  async getUserPullRequests(
    workspace: string,
    username: string,
    options: { state?: 'OPEN' | 'MERGED' | 'DECLINED' | 'ALL' } = {}
  ): Promise<{ prs: BitbucketPullRequest[]; repos: Set<string> }> {
    try {
      // Use search API to find PRs authored by user
      let url = `${BITBUCKET_API_BASE}/repositories/${workspace}?q=has_issues=true&pagelen=100`;

      // Get repos first, then search for user's PRs in each
      const repos = await this.getWorkspaceRepositories(workspace);
      const allPRs: BitbucketPullRequest[] = [];
      const activeRepos = new Set<string>();

      // Limit to recent repos (sorted by update time in API)
      const recentRepos = repos.slice(0, 30);

      for (const repo of recentRepos) {
        const prs = await this.getPullRequests(workspace, repo.slug, {
          state: options.state,
        });

        const userPRs = prs.filter(
          pr => pr.authorUsername.toLowerCase() === username.toLowerCase() ||
                pr.authorDisplayName.toLowerCase().includes(username.toLowerCase())
        );

        if (userPRs.length > 0) {
          activeRepos.add(repo.slug);
          allPRs.push(...userPRs);
        }
      }

      return { prs: allPRs, repos: activeRepos };
    } catch (error) {
      console.error(`[bitbucket] Failed to fetch user PRs for ${username}:`, error);
      return { prs: [], repos: new Set() };
    }
  }

  /**
   * Discover repos based on team activity
   * Searches for recent PRs/commits from team members
   */
  async discoverActiveRepos(
    workspace: string,
    teamUsernames: string[]
  ): Promise<string[]> {
    const activeRepos = new Set<string>();

    // Get all workspace repos
    const repos = await this.getWorkspaceRepositories(workspace);

    // For each repo, check if any team member has recent activity
    for (const repo of repos.slice(0, 50)) {
      // Get recent PRs
      const prs = await this.getPullRequests(workspace, repo.slug, {
        state: 'ALL',
      });

      // Check if any team member authored or reviewed a PR
      const hasTeamActivity = prs.some(pr => {
        const authorMatch = teamUsernames.some(
          u => u.toLowerCase() === pr.authorUsername.toLowerCase() ||
               pr.authorDisplayName.toLowerCase().includes(u.toLowerCase())
        );
        const reviewerMatch = pr.reviewers.some(r =>
          teamUsernames.some(
            u => u.toLowerCase() === r.username.toLowerCase() ||
                 r.displayName.toLowerCase().includes(u.toLowerCase())
          )
        );
        return authorMatch || reviewerMatch;
      });

      if (hasTeamActivity) {
        activeRepos.add(repo.slug);
      }
    }

    return Array.from(activeRepos);
  }

  /**
   * Map Bitbucket API PR to our type
   */
  private mapPullRequest(pr: BitbucketAPIPullRequest, repoSlug: string): BitbucketPullRequest {
    // Map participants who are reviewers
    const reviewers: BitbucketReviewer[] = pr.participants
      .filter(p => p.role === 'REVIEWER')
      .map(p => ({
        username: p.user.username || p.user.nickname || p.user.account_id,
        displayName: p.user.display_name,
        status: p.approved ? 'APPROVED' : (p.participated_on ? 'PENDING' : null),
        approvedAt: p.approved && p.participated_on ? p.participated_on : null,
      }));

    // Extract Jira key from branch name or title
    const jiraKey = this.extractJiraKey(pr.source.branch.name) ||
                    this.extractJiraKey(pr.title);

    return {
      id: pr.id,
      repoSlug,
      prNumber: pr.id,
      title: pr.title,
      description: pr.description,
      authorUsername: pr.author.username || pr.author.nickname || pr.author.account_id,
      authorDisplayName: pr.author.display_name,
      state: pr.state === 'SUPERSEDED' ? 'DECLINED' : pr.state,
      sourceBranch: pr.source.branch.name,
      destinationBranch: pr.destination.branch.name,
      reviewers,
      jiraKey,
      createdAt: pr.created_on,
      updatedAt: pr.updated_on,
      mergedAt: pr.state === 'MERGED' ? (pr.closed_on || pr.updated_on) : null,
      teamMemberId: null, // Set by sync service
    };
  }

  /**
   * Map Bitbucket API commit to our type
   */
  private mapCommit(commit: BitbucketAPICommit, repoSlug: string): BitbucketCommit {
    // Extract username from author
    let authorUsername = 'unknown';
    let authorDisplayName = commit.author.raw;

    if (commit.author.user) {
      authorUsername = commit.author.user.username || commit.author.user.nickname || commit.author.user.account_id;
      authorDisplayName = commit.author.user.display_name;
    } else {
      // Parse from raw (e.g., "Name <email@example.com>")
      const match = commit.author.raw.match(/^([^<]+)/);
      if (match) {
        authorDisplayName = match[1].trim();
        authorUsername = authorDisplayName.toLowerCase().replace(/\s+/g, '.');
      }
    }

    // Extract Jira key from commit message
    const jiraKey = this.extractJiraKey(commit.message);

    return {
      hash: commit.hash,
      repoSlug,
      authorUsername,
      authorDisplayName,
      message: commit.message.split('\n')[0].slice(0, 255), // First line, max 255 chars
      jiraKey,
      committedAt: commit.date,
      teamMemberId: null, // Set by sync service
    };
  }

  /**
   * Map Bitbucket API pipeline to our type
   */
  private mapPipeline(pipeline: BitbucketAPIPipeline, repoSlug: string): BitbucketPipeline {
    let state: BitbucketPipeline['state'] = 'PENDING';
    let result: BitbucketPipeline['result'] = null;

    if (pipeline.state.name === 'COMPLETED') {
      if (pipeline.state.result) {
        switch (pipeline.state.result.name) {
          case 'SUCCESSFUL':
            state = 'SUCCESSFUL';
            result = 'successful';
            break;
          case 'FAILED':
            state = 'FAILED';
            result = 'failed';
            break;
          case 'ERROR':
            state = 'FAILED';
            result = 'error';
            break;
          case 'STOPPED':
            state = 'STOPPED';
            result = null;
            break;
        }
      }
    } else {
      state = pipeline.state.name as BitbucketPipeline['state'];
    }

    let triggerType: BitbucketPipeline['triggerType'] = 'push';
    switch (pipeline.trigger.name) {
      case 'PULL_REQUEST':
        triggerType = 'pull_request';
        break;
      case 'MANUAL':
        triggerType = 'manual';
        break;
    }

    return {
      uuid: pipeline.uuid,
      repoSlug,
      buildNumber: pipeline.build_number,
      state,
      result,
      triggerType,
      branch: pipeline.target.ref_name,
      commitHash: pipeline.target.commit.hash,
      durationSeconds: pipeline.duration_in_seconds || null,
      createdAt: pipeline.created_on,
      completedAt: pipeline.completed_on || null,
    };
  }

  /**
   * Extract Jira key from text (branch name, PR title, commit message)
   */
  private extractJiraKey(text: string): string | null {
    if (!text) return null;
    // Match patterns like: FOAM-123, KRILL-456, feature/FOAM-789-description
    const match = text.match(/([A-Z]{2,10}-\d+)/);
    return match ? match[1] : null;
  }
}

export const createBitbucketService = (config?: { email: string; appPassword: string }): BitbucketService | null => {
  if (!config?.email || !config?.appPassword) {
    return null;
  }

  return new BitbucketService(config);
};
