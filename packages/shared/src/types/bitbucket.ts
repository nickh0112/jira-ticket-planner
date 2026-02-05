// Bitbucket configuration
export interface BitbucketConfig {
  id: string;
  workspace: string;
  email: string; // Atlassian account email for API token auth
  appPassword: string; // API token (not app password - deprecated)
  syncInterval: number; // seconds
  autoDiscoverRepos: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBitbucketConfigInput {
  workspace: string;
  email: string; // Atlassian account email
  appPassword: string; // API token
  syncInterval?: number;
  autoDiscoverRepos?: boolean;
}

export interface UpdateBitbucketConfigInput {
  workspace?: string;
  email?: string;
  appPassword?: string;
  syncInterval?: number;
  autoDiscoverRepos?: boolean;
}

// Bitbucket repository
export interface BitbucketRepo {
  slug: string;
  name: string;
  workspace: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  discoveredVia: 'auto' | 'manual';
}

// Pull request
export interface BitbucketPullRequest {
  id: number;
  repoSlug: string;
  prNumber: number;
  title: string;
  description: string | null;
  authorUsername: string;
  authorDisplayName: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED';
  sourceBranch: string;
  destinationBranch: string;
  reviewers: BitbucketReviewer[];
  jiraKey: string | null;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  teamMemberId: string | null;
}

export interface BitbucketReviewer {
  username: string;
  displayName: string;
  status: 'APPROVED' | 'CHANGES_REQUESTED' | 'PENDING' | null;
  approvedAt: string | null;
}

// Commit
export interface BitbucketCommit {
  hash: string;
  repoSlug: string;
  authorUsername: string;
  authorDisplayName: string;
  message: string;
  jiraKey: string | null;
  committedAt: string;
  teamMemberId: string | null;
}

// Pipeline
export interface BitbucketPipeline {
  uuid: string;
  repoSlug: string;
  buildNumber: number;
  state: 'PENDING' | 'IN_PROGRESS' | 'SUCCESSFUL' | 'FAILED' | 'STOPPED';
  result: 'successful' | 'failed' | 'error' | null;
  triggerType: 'push' | 'pull_request' | 'manual';
  branch: string;
  commitHash: string;
  durationSeconds: number | null;
  createdAt: string;
  completedAt: string | null;
}

// XP awards for Bitbucket activity
export interface BitbucketXPAward {
  id: string;
  teamMemberId: string;
  xpAmount: number;
  source: 'pr_merged' | 'pr_reviewed' | 'pr_reviewed_changes' | 'commit' | 'pipeline_fixed';
  referenceId: string;
  repoSlug: string;
  awardedAt: string;
}

// Sync state
export interface BitbucketSyncState {
  id: string;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  syncIntervalMs: number;
  syncEnabled: boolean;
  errorCount: number;
  lastError: string | null;
  updatedAt: string;
}

export interface UpdateBitbucketSyncConfigInput {
  syncEnabled?: boolean;
  syncIntervalMs?: number;
}

// SSE Events
export interface BitbucketSyncEvent {
  type: 'bitbucket_sync_started' | 'bitbucket_sync_completed' | 'bitbucket_sync_error';
  timestamp: string;
  data: Record<string, unknown>;
}

export interface BitbucketPRSyncedEvent {
  type: 'bitbucket_pr_synced';
  timestamp: string;
  data: {
    repoSlug: string;
    prNumber: number;
    state: string;
    authorUsername: string;
  };
}

export interface BitbucketXPAwardedEvent {
  type: 'bitbucket_xp_awarded';
  timestamp: string;
  data: {
    teamMemberId: string;
    amount: number;
    source: string;
    referenceId: string;
    newTotal: number;
  };
}

export type BitbucketEvent = BitbucketSyncEvent | BitbucketPRSyncedEvent | BitbucketXPAwardedEvent;

// API responses
export interface BitbucketTestConnectionResponse {
  success: boolean;
  workspaceName?: string;
  username?: string;
  error?: string;
}

// Workspace member from Bitbucket API
export interface BitbucketWorkspaceMember {
  accountId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

// Dashboard metrics
export interface BitbucketEngineerMetrics {
  teamMemberId: string;
  memberName: string;
  bitbucketUsername: string | null;
  prsOpened: number;
  prsMerged: number;
  prsReviewed: number;
  commits: number;
  totalXP: number;
}

export interface BitbucketLeaderboardEntry {
  teamMemberId: string;
  memberName: string;
  bitbucketUsername: string | null;
  totalXP: number;
  prsMerged: number;
  prsReviewed: number;
  commits: number;
}

// Activity feed item
export interface BitbucketActivityItem {
  id: string;
  type: 'pr_opened' | 'pr_merged' | 'pr_reviewed' | 'commit' | 'pipeline_completed';
  timestamp: string;
  repoSlug: string;
  authorUsername: string;
  authorDisplayName: string;
  teamMemberId: string | null;
  title: string;
  description: string | null;
  jiraKey: string | null;
  metadata: Record<string, unknown>;
}

// XP Reward configuration
export const BITBUCKET_XP_REWARDS = {
  prMerged: 50,
  prReviewedApproved: 20,
  prReviewedChangesRequested: 25,
  commit: 5,
  pipelineFixed: 30,
} as const;
