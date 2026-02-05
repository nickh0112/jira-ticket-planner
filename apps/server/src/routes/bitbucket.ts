import { Router, Request, Response } from 'express';
import type {
  ApiResponse,
  BitbucketConfig,
  CreateBitbucketConfigInput,
  UpdateBitbucketConfigInput,
  BitbucketTestConnectionResponse,
  BitbucketRepo,
  BitbucketPullRequest,
  BitbucketCommit,
  BitbucketPipeline,
  BitbucketSyncState,
  UpdateBitbucketSyncConfigInput,
  BitbucketWorkspaceMember,
} from '@jira-planner/shared';
import type { StorageService } from '../services/storageService.js';
import type { BitbucketService } from '../services/bitbucketService.js';
import type { BitbucketSyncService } from '../services/bitbucketSyncService.js';

export function createBitbucketRouter(
  storage: StorageService,
  getBitbucketService: () => BitbucketService | null,
  syncService: BitbucketSyncService
): Router {
  const router = Router();

  // ============================================================================
  // Configuration Routes
  // ============================================================================

  // Get Bitbucket config
  router.get('/config', (req: Request, res: Response) => {
    try {
      const config = storage.getBitbucketConfig();
      // Don't expose the app password in responses
      const safeConfig = config ? {
        ...config,
        appPassword: config.appPassword ? '********' : '',
      } : null;

      const response: ApiResponse<typeof safeConfig> = {
        success: true,
        data: safeConfig,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Bitbucket config',
      });
    }
  });

  // Save/Update Bitbucket config
  router.put('/config', (req: Request, res: Response) => {
    try {
      const input: CreateBitbucketConfigInput = req.body;

      if (!input.workspace || !input.email || !input.appPassword) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: workspace, email, appPassword',
        });
        return;
      }

      const config = storage.saveBitbucketConfig(input);
      const safeConfig = {
        ...config,
        appPassword: '********',
      };

      const response: ApiResponse<typeof safeConfig> = {
        success: true,
        data: safeConfig,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save Bitbucket config',
      });
    }
  });

  // Test Bitbucket connection
  router.post('/test', async (req: Request, res: Response) => {
    try {
      const config = storage.getBitbucketConfig();
      if (!config) {
        res.status(400).json({
          success: false,
          error: 'Bitbucket not configured',
        });
        return;
      }

      const service = getBitbucketService();
      if (!service) {
        res.status(500).json({
          success: false,
          error: 'Failed to create Bitbucket service',
        });
        return;
      }

      const result = await service.testConnection(config.workspace);
      const response: ApiResponse<BitbucketTestConnectionResponse> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      });
    }
  });

  // ============================================================================
  // Team Mapping Routes
  // ============================================================================

  // Get workspace members for mapping
  router.get('/workspace-members', async (req: Request, res: Response) => {
    try {
      const config = storage.getBitbucketConfig();
      if (!config) {
        res.status(400).json({
          success: false,
          error: 'Bitbucket not configured',
        });
        return;
      }

      const service = getBitbucketService();
      if (!service) {
        res.status(500).json({
          success: false,
          error: 'Bitbucket service not available',
        });
        return;
      }

      const members = await service.getWorkspaceMembers(config.workspace);
      const response: ApiResponse<BitbucketWorkspaceMember[]> = {
        success: true,
        data: members,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch workspace members',
      });
    }
  });

  // Map team member to Bitbucket username
  router.put('/team/:id/bitbucket', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { bitbucketUsername } = req.body;

      const member = storage.updateTeamMember(id, { bitbucketUsername });
      if (!member) {
        res.status(404).json({
          success: false,
          error: 'Team member not found',
        });
        return;
      }

      const response: ApiResponse<typeof member> = {
        success: true,
        data: member,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update team member',
      });
    }
  });

  // ============================================================================
  // Repository Routes
  // ============================================================================

  // List discovered repos
  router.get('/repos', (req: Request, res: Response) => {
    try {
      const activeOnly = req.query.active === 'true';
      const repos = storage.getBitbucketRepos(activeOnly);

      const response: ApiResponse<BitbucketRepo[]> = {
        success: true,
        data: repos,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch repos',
      });
    }
  });

  // Trigger repo discovery from team activity
  router.post('/discover', async (req: Request, res: Response) => {
    try {
      const config = storage.getBitbucketConfig();
      if (!config) {
        res.status(400).json({
          success: false,
          error: 'Bitbucket not configured',
        });
        return;
      }

      const service = getBitbucketService();
      if (!service) {
        res.status(500).json({
          success: false,
          error: 'Bitbucket service not available',
        });
        return;
      }

      // Get team members with Bitbucket usernames
      const teamMembers = storage.getTeamMembers();
      const bitbucketUsernames = teamMembers
        .filter(m => m.bitbucketUsername)
        .map(m => m.bitbucketUsername!);

      if (bitbucketUsernames.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No team members have Bitbucket usernames mapped',
        });
        return;
      }

      // Discover active repos
      const activeRepoSlugs = await service.discoverActiveRepos(config.workspace, bitbucketUsernames);

      // Get repo details and save
      const allRepos = await service.getWorkspaceRepositories(config.workspace);
      const discoveredRepos: BitbucketRepo[] = [];

      for (const slug of activeRepoSlugs) {
        const repoDetails = allRepos.find(r => r.slug === slug);
        if (repoDetails) {
          const repo = storage.upsertBitbucketRepo({
            slug: repoDetails.slug,
            name: repoDetails.name,
            workspace: config.workspace,
            discoveredVia: 'auto',
          });
          discoveredRepos.push(repo);
        }
      }

      const response: ApiResponse<{ repos: BitbucketRepo[]; discovered: number }> = {
        success: true,
        data: {
          repos: discoveredRepos,
          discovered: discoveredRepos.length,
        },
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Repo discovery failed',
      });
    }
  });

  // Toggle repo tracking on/off
  router.put('/repos/:slug', (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const { isActive } = req.body;

      const repo = storage.updateBitbucketRepoActive(slug, isActive);
      if (!repo) {
        res.status(404).json({
          success: false,
          error: 'Repository not found',
        });
        return;
      }

      const response: ApiResponse<BitbucketRepo> = {
        success: true,
        data: repo,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update repo',
      });
    }
  });

  // ============================================================================
  // Sync Routes
  // ============================================================================

  // Trigger full sync
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      const result = await syncService.runSync();
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  });

  // Get sync status
  router.get('/sync/status', (req: Request, res: Response) => {
    try {
      const status = syncService.getStatus();
      const response: ApiResponse<typeof status> = {
        success: true,
        data: status,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sync status',
      });
    }
  });

  // Update sync configuration
  router.put('/sync/config', (req: Request, res: Response) => {
    try {
      const updates: UpdateBitbucketSyncConfigInput = req.body;
      syncService.updateSyncConfig(updates);
      const syncState = storage.getBitbucketSyncState();

      const response: ApiResponse<BitbucketSyncState> = {
        success: true,
        data: syncState,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update sync config',
      });
    }
  });

  // SSE endpoint for real-time updates
  router.get('/events', (req: Request, res: Response) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    // Subscribe to sync events
    const unsubscribe = syncService.subscribe((event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // ============================================================================
  // Dashboard Data Routes
  // ============================================================================

  // Get PRs with filters
  router.get('/prs', (req: Request, res: Response) => {
    try {
      const options: {
        repoSlug?: string;
        state?: 'OPEN' | 'MERGED' | 'DECLINED';
        authorUsername?: string;
        teamMemberId?: string;
        limit?: number;
      } = {};

      if (req.query.repo) options.repoSlug = req.query.repo as string;
      if (req.query.state) options.state = req.query.state as any;
      if (req.query.author) options.authorUsername = req.query.author as string;
      if (req.query.memberId) options.teamMemberId = req.query.memberId as string;
      if (req.query.limit) options.limit = parseInt(req.query.limit as string, 10);

      const prs = storage.getBitbucketPullRequests(options);
      const response: ApiResponse<BitbucketPullRequest[]> = {
        success: true,
        data: prs,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch PRs',
      });
    }
  });

  // Get single PR details
  router.get('/prs/:repo/:number', (req: Request, res: Response) => {
    try {
      const { repo, number } = req.params;
      const pr = storage.getBitbucketPullRequest(repo, parseInt(number, 10));

      if (!pr) {
        res.status(404).json({
          success: false,
          error: 'PR not found',
        });
        return;
      }

      const response: ApiResponse<BitbucketPullRequest> = {
        success: true,
        data: pr,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch PR',
      });
    }
  });

  // Get commits
  router.get('/commits', (req: Request, res: Response) => {
    try {
      const options: {
        repoSlug?: string;
        authorUsername?: string;
        teamMemberId?: string;
        since?: string;
        limit?: number;
      } = {};

      if (req.query.repo) options.repoSlug = req.query.repo as string;
      if (req.query.author) options.authorUsername = req.query.author as string;
      if (req.query.memberId) options.teamMemberId = req.query.memberId as string;
      if (req.query.since) options.since = req.query.since as string;
      if (req.query.limit) options.limit = parseInt(req.query.limit as string, 10);

      const commits = storage.getBitbucketCommits(options);
      const response: ApiResponse<BitbucketCommit[]> = {
        success: true,
        data: commits,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch commits',
      });
    }
  });

  // Get pipelines
  router.get('/pipelines', (req: Request, res: Response) => {
    try {
      const options: {
        repoSlug?: string;
        state?: string;
        since?: string;
        limit?: number;
      } = {};

      if (req.query.repo) options.repoSlug = req.query.repo as string;
      if (req.query.state) options.state = req.query.state as string;
      if (req.query.since) options.since = req.query.since as string;
      if (req.query.limit) options.limit = parseInt(req.query.limit as string, 10);

      const pipelines = storage.getBitbucketPipelines(options);
      const response: ApiResponse<BitbucketPipeline[]> = {
        success: true,
        data: pipelines,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pipelines',
      });
    }
  });

  // Get combined activity feed
  router.get('/activity', (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      // Get recent PRs, commits, and pipelines
      const prs = storage.getBitbucketPullRequests({ limit: limit / 3 });
      const commits = storage.getBitbucketCommits({ limit: limit / 3 });
      const pipelines = storage.getBitbucketPipelines({ limit: limit / 3 });

      // Convert to unified activity items
      const activities: Array<{
        id: string;
        type: string;
        timestamp: string;
        repoSlug: string;
        authorUsername: string;
        authorDisplayName: string;
        teamMemberId: string | null;
        title: string;
        description: string | null;
        jiraKey: string | null;
        metadata: Record<string, unknown>;
      }> = [];

      for (const pr of prs) {
        activities.push({
          id: `pr-${pr.repoSlug}-${pr.prNumber}`,
          type: pr.state === 'MERGED' ? 'pr_merged' : 'pr_opened',
          timestamp: pr.mergedAt || pr.updatedAt,
          repoSlug: pr.repoSlug,
          authorUsername: pr.authorUsername,
          authorDisplayName: pr.authorDisplayName,
          teamMemberId: pr.teamMemberId,
          title: pr.title,
          description: pr.description,
          jiraKey: pr.jiraKey,
          metadata: { state: pr.state, prNumber: pr.prNumber },
        });
      }

      for (const commit of commits) {
        activities.push({
          id: `commit-${commit.hash}`,
          type: 'commit',
          timestamp: commit.committedAt,
          repoSlug: commit.repoSlug,
          authorUsername: commit.authorUsername,
          authorDisplayName: commit.authorDisplayName,
          teamMemberId: commit.teamMemberId,
          title: commit.message,
          description: null,
          jiraKey: commit.jiraKey,
          metadata: { hash: commit.hash },
        });
      }

      for (const pipeline of pipelines) {
        if (pipeline.state === 'SUCCESSFUL' || pipeline.state === 'FAILED') {
          activities.push({
            id: `pipeline-${pipeline.uuid}`,
            type: 'pipeline_completed',
            timestamp: pipeline.completedAt || pipeline.createdAt,
            repoSlug: pipeline.repoSlug,
            authorUsername: '',
            authorDisplayName: '',
            teamMemberId: null,
            title: `Pipeline #${pipeline.buildNumber} ${pipeline.state.toLowerCase()}`,
            description: `Branch: ${pipeline.branch}`,
            jiraKey: null,
            metadata: { state: pipeline.state, result: pipeline.result, buildNumber: pipeline.buildNumber },
          });
        }
      }

      // Sort by timestamp descending
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const response: ApiResponse<typeof activities> = {
        success: true,
        data: activities.slice(0, limit),
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch activity',
      });
    }
  });

  // Get engineer metrics
  router.get('/metrics', (req: Request, res: Response) => {
    try {
      const metrics = storage.getBitbucketEngineerMetrics();
      const response: ApiResponse<typeof metrics> = {
        success: true,
        data: metrics,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
      });
    }
  });

  // Get XP leaderboard for Bitbucket activity
  router.get('/leaderboard', (req: Request, res: Response) => {
    try {
      const metrics = storage.getBitbucketEngineerMetrics();
      const leaderboard = metrics
        .filter(m => m.totalXP > 0)
        .map(m => ({
          teamMemberId: m.teamMemberId,
          memberName: m.memberName,
          bitbucketUsername: m.bitbucketUsername,
          totalXP: m.totalXP,
          prsMerged: m.prsMerged,
          prsReviewed: m.prsReviewed,
          commits: m.commits,
        }));

      const response: ApiResponse<typeof leaderboard> = {
        success: true,
        data: leaderboard,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch leaderboard',
      });
    }
  });

  return router;
}
