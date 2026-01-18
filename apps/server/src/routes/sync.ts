import { Router, Request, Response } from 'express';
import type { ApiResponse, JiraSyncState, UpdateJiraSyncConfigInput } from '@jira-planner/shared';
import type { JiraSyncService } from '../services/jiraSyncService.js';
import type { StorageService } from '../services/storageService.js';

export function createSyncRouter(
  storage: StorageService,
  syncService: JiraSyncService
): Router {
  const router = Router();

  // Get sync status
  router.get('/status', (req: Request, res: Response) => {
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
  router.put('/config', (req: Request, res: Response) => {
    try {
      const updates: UpdateJiraSyncConfigInput = req.body;
      syncService.updateSyncConfig(updates);
      const syncState = storage.getJiraSyncState();

      const response: ApiResponse<JiraSyncState> = {
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

  // Trigger manual sync
  router.post('/trigger', async (req: Request, res: Response) => {
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

  // SSE endpoint for real-time events
  router.get('/events', (req: Request, res: Response) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

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

  // Get leaderboard (member progress sorted by XP)
  router.get('/leaderboard', (req: Request, res: Response) => {
    try {
      const progress = storage.getAllMemberProgress();
      const teamMembers = storage.getTeamMembers();

      // Join progress with team member info
      const leaderboard = progress.map(p => {
        const member = teamMembers.find(m => m.id === p.teamMemberId);
        return {
          ...p,
          memberName: member?.name || 'Unknown',
          memberRole: member?.role || 'Unknown',
        };
      });

      const response: ApiResponse<typeof leaderboard> = {
        success: true,
        data: leaderboard,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get leaderboard',
      });
    }
  });

  // Get unacknowledged level-up events
  router.get('/level-ups', (req: Request, res: Response) => {
    try {
      const events = storage.getUnacknowledgedLevelUpEvents();
      const response: ApiResponse<typeof events> = {
        success: true,
        data: events,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get level-up events',
      });
    }
  });

  // Acknowledge a level-up event
  router.post('/level-ups/:id/acknowledge', (req: Request, res: Response) => {
    try {
      storage.acknowledgeLevelUpEvent(req.params.id);
      const response: ApiResponse<{ acknowledged: true }> = {
        success: true,
        data: { acknowledged: true },
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to acknowledge level-up',
      });
    }
  });

  // Get member progress
  router.get('/member/:id/progress', (req: Request, res: Response) => {
    try {
      const progress = storage.getOrCreateMemberProgress(req.params.id);
      const response: ApiResponse<typeof progress> = {
        success: true,
        data: progress,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get member progress',
      });
    }
  });

  // Get ticket completions
  router.get('/completions', (req: Request, res: Response) => {
    try {
      const memberId = req.query.memberId as string | undefined;
      const completions = storage.getTicketCompletions(memberId);
      const response: ApiResponse<typeof completions> = {
        success: true,
        data: completions,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get completions',
      });
    }
  });

  return router;
}
