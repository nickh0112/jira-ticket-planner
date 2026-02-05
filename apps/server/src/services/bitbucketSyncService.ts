import { EventEmitter } from 'events';
import type {
  BitbucketEvent,
  BitbucketPullRequest,
  BitbucketCommit,
  BitbucketPipeline,
  BitbucketSyncState,
  UpdateBitbucketSyncConfigInput,
  BITBUCKET_XP_REWARDS,
} from '@jira-planner/shared';
import type { BitbucketService } from './bitbucketService.js';
import type { StorageService } from './storageService.js';

// XP rewards for Bitbucket activity
export const XP_REWARDS = {
  prMerged: 50,
  prReviewedApproved: 20,
  prReviewedChangesRequested: 25,
  commit: 5,
  pipelineFixed: 30,
};

interface BitbucketSyncServiceConfig {
  storage: StorageService;
  getBitbucketService: () => BitbucketService | null;
}

export class BitbucketSyncService extends EventEmitter {
  private storage: StorageService;
  private getBitbucketService: () => BitbucketService | null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(config: BitbucketSyncServiceConfig) {
    super();
    this.storage = config.storage;
    this.getBitbucketService = config.getBitbucketService;
  }

  /**
   * Start automatic sync polling
   */
  startAutoSync(): void {
    const syncState = this.storage.getBitbucketSyncState();

    if (!syncState.syncEnabled) {
      console.log('[bitbucket-sync] Auto-sync is disabled');
      return;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    console.log(`[bitbucket-sync] Starting auto-sync with interval ${syncState.syncIntervalMs}ms`);

    // Run initial sync
    this.runSync();

    // Set up polling
    this.syncTimer = setInterval(() => {
      this.runSync();
    }, syncState.syncIntervalMs);
  }

  /**
   * Stop automatic sync polling
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[bitbucket-sync] Auto-sync stopped');
    }
  }

  /**
   * Update sync configuration and restart if needed
   */
  updateSyncConfig(updates: UpdateBitbucketSyncConfigInput): void {
    this.storage.updateBitbucketSyncState(updates);

    // Restart auto-sync if enabled
    this.stopAutoSync();
    if (updates.syncEnabled !== false) {
      const syncState = this.storage.getBitbucketSyncState();
      if (syncState.syncEnabled) {
        this.startAutoSync();
      }
    }
  }

  /**
   * Run a single sync cycle
   */
  async runSync(): Promise<{
    success: boolean;
    prsProcessed: number;
    commitsProcessed: number;
    pipelinesProcessed: number;
    xpAwarded: number;
    error?: string;
  }> {
    if (this.isSyncing) {
      console.log('[bitbucket-sync] Sync already in progress, skipping');
      return {
        success: false,
        prsProcessed: 0,
        commitsProcessed: 0,
        pipelinesProcessed: 0,
        xpAwarded: 0,
        error: 'Sync already in progress',
      };
    }

    const config = this.storage.getBitbucketConfig();
    if (!config) {
      console.log('[bitbucket-sync] Bitbucket not configured');
      return {
        success: false,
        prsProcessed: 0,
        commitsProcessed: 0,
        pipelinesProcessed: 0,
        xpAwarded: 0,
        error: 'Bitbucket not configured',
      };
    }

    const service = this.getBitbucketService();
    if (!service) {
      console.log('[bitbucket-sync] Bitbucket service not available');
      return {
        success: false,
        prsProcessed: 0,
        commitsProcessed: 0,
        pipelinesProcessed: 0,
        xpAwarded: 0,
        error: 'Bitbucket service not available',
      };
    }

    this.isSyncing = true;
    const now = new Date().toISOString();

    // Emit sync started event
    this.emitEvent({
      type: 'bitbucket_sync_started',
      timestamp: now,
      data: {},
    });

    // Update last sync time
    this.storage.updateBitbucketSyncState({ lastSyncAt: now });

    try {
      let totalPRs = 0;
      let totalCommits = 0;
      let totalPipelines = 0;
      let totalXP = 0;

      // Get active repos
      const repos = this.storage.getBitbucketRepos(true);
      if (repos.length === 0) {
        console.log('[bitbucket-sync] No active repos to sync');
      }

      // Get team members for mapping
      const teamMembers = this.storage.getTeamMembers();
      const memberByBitbucketUsername = new Map(
        teamMembers
          .filter(m => m.bitbucketUsername)
          .map(m => [m.bitbucketUsername!.toLowerCase(), m])
      );

      // Sync each repo
      for (const repo of repos) {
        try {
          console.log(`[bitbucket-sync] Syncing ${repo.slug}...`);

          // Calculate sync window (last 7 days or since last sync)
          const lastSync = repo.lastSyncedAt;
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const since = lastSync || sevenDaysAgo;

          // Sync PRs
          const prs = await service.getPullRequests(config.workspace, repo.slug, {
            state: 'ALL',
            updatedAfter: since,
          });

          for (const pr of prs) {
            const result = await this.processPullRequest(pr, memberByBitbucketUsername);
            totalPRs++;
            totalXP += result.xpAwarded;
          }

          // Sync commits
          const commits = await service.getCommits(config.workspace, repo.slug, {
            since,
          });

          for (const commit of commits) {
            const result = await this.processCommit(commit, memberByBitbucketUsername);
            totalCommits++;
            totalXP += result.xpAwarded;
          }

          // Sync pipelines
          const pipelines = await service.getPipelines(config.workspace, repo.slug, {
            since,
          });

          for (const pipeline of pipelines) {
            await this.processPipeline(pipeline, memberByBitbucketUsername);
            totalPipelines++;
          }

          // Update repo sync time
          this.storage.updateBitbucketRepoSyncTime(repo.slug);
        } catch (error) {
          console.error(`[bitbucket-sync] Error syncing ${repo.slug}:`, error);
        }
      }

      // Update successful sync time
      this.storage.updateBitbucketSyncState({
        lastSuccessfulSyncAt: new Date().toISOString(),
        errorCount: 0,
        lastError: null,
      });

      // Emit sync completed event
      this.emitEvent({
        type: 'bitbucket_sync_completed',
        timestamp: new Date().toISOString(),
        data: {
          prsProcessed: totalPRs,
          commitsProcessed: totalCommits,
          pipelinesProcessed: totalPipelines,
          xpAwarded: totalXP,
        },
      });

      console.log(`[bitbucket-sync] Completed: ${totalPRs} PRs, ${totalCommits} commits, ${totalPipelines} pipelines, ${totalXP} XP`);

      return {
        success: true,
        prsProcessed: totalPRs,
        commitsProcessed: totalCommits,
        pipelinesProcessed: totalPipelines,
        xpAwarded: totalXP,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const syncState = this.storage.getBitbucketSyncState();

      // Update error state
      this.storage.updateBitbucketSyncState({
        errorCount: syncState.errorCount + 1,
        lastError: errorMessage,
      });

      // Emit sync error event
      this.emitEvent({
        type: 'bitbucket_sync_error',
        timestamp: new Date().toISOString(),
        data: { error: errorMessage },
      });

      console.error('[bitbucket-sync] Error:', errorMessage);

      return {
        success: false,
        prsProcessed: 0,
        commitsProcessed: 0,
        pipelinesProcessed: 0,
        xpAwarded: 0,
        error: errorMessage,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process a pull request
   */
  private async processPullRequest(
    pr: BitbucketPullRequest,
    memberByUsername: Map<string, { id: string; name: string }>
  ): Promise<{ xpAwarded: number }> {
    let xpAwarded = 0;

    // Match author to team member
    const author = memberByUsername.get(pr.authorUsername.toLowerCase());
    pr.teamMemberId = author?.id || null;

    // Check if PR was just merged (state changed to MERGED)
    const existingPR = this.storage.getBitbucketPullRequest(pr.repoSlug, pr.prNumber);
    const wasMerged = pr.state === 'MERGED' && existingPR?.state !== 'MERGED';

    // Save/update PR
    this.storage.upsertBitbucketPullRequest(pr);

    // Award XP for merged PR (if author is a team member)
    if (wasMerged && pr.teamMemberId) {
      const award = this.storage.createBitbucketXPAward({
        teamMemberId: pr.teamMemberId,
        xpAmount: XP_REWARDS.prMerged,
        source: 'pr_merged',
        referenceId: `${pr.repoSlug}/${pr.prNumber}`,
        repoSlug: pr.repoSlug,
      });

      if (award) {
        xpAwarded += XP_REWARDS.prMerged;
        this.emitEvent({
          type: 'bitbucket_xp_awarded',
          timestamp: new Date().toISOString(),
          data: {
            teamMemberId: pr.teamMemberId,
            amount: XP_REWARDS.prMerged,
            source: 'pr_merged',
            referenceId: award.referenceId,
            newTotal: this.storage.getTotalBitbucketXP(pr.teamMemberId),
          },
        });
      }
    }

    // Award XP for reviews
    if (pr.state === 'MERGED') {
      for (const reviewer of pr.reviewers) {
        const reviewerMember = memberByUsername.get(reviewer.username.toLowerCase());
        if (reviewerMember && reviewer.status) {
          const isApproval = reviewer.status === 'APPROVED';
          const xpAmount = isApproval ? XP_REWARDS.prReviewedApproved : XP_REWARDS.prReviewedChangesRequested;
          const source = isApproval ? 'pr_reviewed' : 'pr_reviewed_changes';

          const award = this.storage.createBitbucketXPAward({
            teamMemberId: reviewerMember.id,
            xpAmount,
            source: source as any,
            referenceId: `${pr.repoSlug}/${pr.prNumber}/${reviewer.username}`,
            repoSlug: pr.repoSlug,
          });

          if (award) {
            xpAwarded += xpAmount;
            this.emitEvent({
              type: 'bitbucket_xp_awarded',
              timestamp: new Date().toISOString(),
              data: {
                teamMemberId: reviewerMember.id,
                amount: xpAmount,
                source,
                referenceId: award.referenceId,
                newTotal: this.storage.getTotalBitbucketXP(reviewerMember.id),
              },
            });
          }
        }
      }
    }

    return { xpAwarded };
  }

  /**
   * Process a commit
   */
  private async processCommit(
    commit: BitbucketCommit,
    memberByUsername: Map<string, { id: string; name: string }>
  ): Promise<{ xpAwarded: number }> {
    let xpAwarded = 0;

    // Match author to team member
    const author = memberByUsername.get(commit.authorUsername.toLowerCase());
    commit.teamMemberId = author?.id || null;

    // Check if this is a new commit
    const existingCommit = this.storage.getBitbucketCommit(commit.hash);
    const isNew = !existingCommit;

    // Save/update commit
    this.storage.upsertBitbucketCommit(commit);

    // Award XP for new commits (if author is a team member)
    if (isNew && commit.teamMemberId) {
      const award = this.storage.createBitbucketXPAward({
        teamMemberId: commit.teamMemberId,
        xpAmount: XP_REWARDS.commit,
        source: 'commit',
        referenceId: commit.hash,
        repoSlug: commit.repoSlug,
      });

      if (award) {
        xpAwarded += XP_REWARDS.commit;
        this.emitEvent({
          type: 'bitbucket_xp_awarded',
          timestamp: new Date().toISOString(),
          data: {
            teamMemberId: commit.teamMemberId,
            amount: XP_REWARDS.commit,
            source: 'commit',
            referenceId: commit.hash,
            newTotal: this.storage.getTotalBitbucketXP(commit.teamMemberId),
          },
        });
      }
    }

    return { xpAwarded };
  }

  /**
   * Process a pipeline
   */
  private async processPipeline(
    pipeline: BitbucketPipeline,
    memberByUsername: Map<string, { id: string; name: string }>
  ): Promise<{ xpAwarded: number }> {
    let xpAwarded = 0;

    // Check if pipeline was just fixed (previous was FAILED, now SUCCESSFUL)
    const existingPipeline = this.storage.getBitbucketPipeline(pipeline.uuid);

    // Save/update pipeline
    this.storage.upsertBitbucketPipeline(pipeline);

    // Check if this pipeline fixed a previously failed one
    // (Would need to track the last pipeline state per branch - simplified for now)
    if (pipeline.state === 'SUCCESSFUL') {
      // Get recent failed pipelines for the same branch
      const recentPipelines = this.storage.getBitbucketPipelines({
        repoSlug: pipeline.repoSlug,
        limit: 5,
      });

      const hadRecentFailure = recentPipelines.some(
        p => p.branch === pipeline.branch &&
             p.state === 'FAILED' &&
             p.uuid !== pipeline.uuid &&
             new Date(p.createdAt) < new Date(pipeline.createdAt)
      );

      if (hadRecentFailure) {
        // Try to find who fixed it by looking at the commit
        const commit = this.storage.getBitbucketCommit(pipeline.commitHash);
        if (commit?.teamMemberId) {
          const award = this.storage.createBitbucketXPAward({
            teamMemberId: commit.teamMemberId,
            xpAmount: XP_REWARDS.pipelineFixed,
            source: 'pipeline_fixed',
            referenceId: pipeline.uuid,
            repoSlug: pipeline.repoSlug,
          });

          if (award) {
            xpAwarded += XP_REWARDS.pipelineFixed;
            this.emitEvent({
              type: 'bitbucket_xp_awarded',
              timestamp: new Date().toISOString(),
              data: {
                teamMemberId: commit.teamMemberId,
                amount: XP_REWARDS.pipelineFixed,
                source: 'pipeline_fixed',
                referenceId: pipeline.uuid,
                newTotal: this.storage.getTotalBitbucketXP(commit.teamMemberId),
              },
            });
          }
        }
      }
    }

    return { xpAwarded };
  }

  /**
   * Emit an event to all listeners (for SSE)
   */
  private emitEvent(event: BitbucketEvent): void {
    this.emit('bitbucketEvent', event);
  }

  /**
   * Subscribe to sync events (for SSE endpoint)
   */
  subscribe(callback: (event: BitbucketEvent) => void): () => void {
    this.on('bitbucketEvent', callback);
    return () => this.off('bitbucketEvent', callback);
  }

  /**
   * Get current sync status
   */
  getStatus(): {
    isRunning: boolean;
    syncState: BitbucketSyncState;
    hasTimer: boolean;
  } {
    return {
      isRunning: this.isSyncing,
      syncState: this.storage.getBitbucketSyncState(),
      hasTimer: this.syncTimer !== null,
    };
  }
}

export const createBitbucketSyncService = (config: BitbucketSyncServiceConfig): BitbucketSyncService => {
  return new BitbucketSyncService(config);
};
