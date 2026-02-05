import { Router, Request, Response } from 'express';
import type {
  ApiResponse,
  SlackConfig,
  UpdateSlackConfigInput,
  SlackChannel,
  SlackInsight,
  SlackSyncState,
  SlackUserMapping,
  SlackTestConnectionResponse,
} from '@jira-planner/shared';
import type { StorageService } from '../services/storageService.js';
import type { SlackService } from '../services/slackService.js';
import type { SlackSyncService } from '../services/slackSyncService.js';

export function createSlackRouter(
  storage: StorageService,
  getSlackService: () => SlackService | null,
  syncService: SlackSyncService
): Router {
  const router = Router();

  // ============================================================================
  // Configuration Routes
  // ============================================================================

  // Get Slack config (token masked)
  router.get('/config', (req: Request, res: Response) => {
    try {
      const config = storage.getSlackConfig();
      const safeConfig = config ? {
        ...config,
        botToken: config.botToken
          ? '****' + config.botToken.slice(-4)
          : null,
      } : null;

      const response: ApiResponse<typeof safeConfig> = {
        success: true,
        data: safeConfig,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Slack config',
      });
    }
  });

  // Update Slack config
  router.put('/config', (req: Request, res: Response) => {
    try {
      const input: UpdateSlackConfigInput = req.body;
      const config = storage.updateSlackConfig(input);
      const safeConfig = {
        ...config,
        botToken: config.botToken
          ? '****' + config.botToken.slice(-4)
          : null,
      };

      const response: ApiResponse<typeof safeConfig> = {
        success: true,
        data: safeConfig,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Slack config',
      });
    }
  });

  // Test Slack connection
  router.post('/test', async (req: Request, res: Response) => {
    try {
      const config = storage.getSlackConfig();
      if (!config || !config.botToken) {
        res.status(400).json({
          success: false,
          error: 'Slack not configured. Please set a bot token first.',
        });
        return;
      }

      const service = getSlackService();
      if (!service) {
        res.status(500).json({
          success: false,
          error: 'Failed to create Slack service',
        });
        return;
      }

      const result = await service.testConnection();
      const response: ApiResponse<SlackTestConnectionResponse> = {
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
  // Channel Routes
  // ============================================================================

  // List available channels from Slack API
  router.get('/channels', async (req: Request, res: Response) => {
    try {
      const service = getSlackService();
      if (!service) {
        res.status(400).json({
          success: false,
          error: 'Slack not configured',
        });
        return;
      }

      // Fetch channels from Slack API
      const apiChannels = await service.listChannels();

      // Merge with local DB state
      const localChannels = storage.getSlackChannels();
      const monitoredIds = new Set(
        localChannels.filter((ch) => ch.isMonitored).map((ch) => ch.id)
      );

      // Upsert channels into DB
      for (const ch of apiChannels) {
        storage.upsertSlackChannel({
          id: ch.id,
          name: ch.name,
          isMonitored: monitoredIds.has(ch.id),
        });
      }

      const channels = storage.getSlackChannels();
      const response: ApiResponse<SlackChannel[]> = {
        success: true,
        data: channels,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch channels',
      });
    }
  });

  // Toggle channel monitoring
  router.post('/channels/:id/monitor', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { isMonitored } = req.body;

      const channel = storage.updateSlackChannelMonitored(id, isMonitored ?? true);
      if (!channel) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      const response: ApiResponse<SlackChannel> = {
        success: true,
        data: channel,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update channel',
      });
    }
  });

  // ============================================================================
  // Insights Routes
  // ============================================================================

  // Get insights with filters
  router.get('/insights', (req: Request, res: Response) => {
    try {
      const options: {
        type?: string;
        jiraKey?: string;
        channelId?: string;
        limit?: number;
      } = {};

      if (req.query.type) options.type = req.query.type as string;
      if (req.query.jiraKey) options.jiraKey = req.query.jiraKey as string;
      if (req.query.channelId) options.channelId = req.query.channelId as string;
      if (req.query.limit) options.limit = parseInt(req.query.limit as string, 10);

      const insights = storage.getSlackInsights(options);
      const response: ApiResponse<SlackInsight[]> = {
        success: true,
        data: insights,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch insights',
      });
    }
  });

  // ============================================================================
  // Sync Routes
  // ============================================================================

  // Trigger manual sync
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

  // SSE endpoint for real-time updates
  router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    const unsubscribe = syncService.subscribe((event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // ============================================================================
  // User Mapping Routes
  // ============================================================================

  // Get user mappings
  router.get('/user-mappings', (req: Request, res: Response) => {
    try {
      const mappings = storage.getSlackUserMappings();
      const response: ApiResponse<SlackUserMapping[]> = {
        success: true,
        data: mappings,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user mappings',
      });
    }
  });

  // Map Slack user to team member
  router.put('/user-mappings/:slackUserId', (req: Request, res: Response) => {
    try {
      const { slackUserId } = req.params;
      const { teamMemberId } = req.body;

      const mapping = storage.updateSlackUserMappingTeamMember(slackUserId, teamMemberId);
      if (!mapping) {
        res.status(404).json({
          success: false,
          error: 'Slack user mapping not found',
        });
        return;
      }

      const response: ApiResponse<SlackUserMapping> = {
        success: true,
        data: mapping,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user mapping',
      });
    }
  });

  return router;
}
