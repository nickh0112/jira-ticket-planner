import { Router, Request, Response } from 'express';
import type {
  ApiResponse,
  AutomationConfig,
  AutomationRun,
  AutomationAction,
  AutomationActionStatus,
  UpdateAutomationConfigInput,
} from '@jira-planner/shared';
import type { StorageService } from '../services/storageService.js';
import type { AutomationEngine } from '../services/automationEngine.js';

export function createAutomationRouter(
  storage: StorageService,
  automationEngine: AutomationEngine
): Router {
  const router = Router();

  // GET /config - get automation config
  router.get('/config', (req: Request, res: Response) => {
    try {
      const config = storage.getAutomationConfig();
      const response: ApiResponse<AutomationConfig> = { success: true, data: config };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get automation config',
      });
    }
  });

  // PUT /config - update automation config
  router.put('/config', (req: Request, res: Response) => {
    try {
      const input: UpdateAutomationConfigInput = req.body;
      const config = storage.updateAutomationConfig(input);

      // Restart engine if config changed
      automationEngine.stopEngine();
      if (config.enabled) {
        automationEngine.startEngine();
      }

      const response: ApiResponse<AutomationConfig> = { success: true, data: config };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update automation config',
      });
    }
  });

  // POST /run - trigger manual cycle
  router.post('/run', async (req: Request, res: Response) => {
    try {
      const run = await automationEngine.runCycle();
      const response: ApiResponse<AutomationRun> = { success: true, data: run };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run automation cycle',
      });
    }
  });

  // GET /runs - get run history
  router.get('/runs', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const runs = storage.getAutomationRuns(limit);
      const response: ApiResponse<AutomationRun[]> = { success: true, data: runs };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get automation runs',
      });
    }
  });

  // GET /actions - get actions with filters
  router.get('/actions', (req: Request, res: Response) => {
    try {
      const status = req.query.status as AutomationActionStatus | undefined;
      const type = req.query.type as string | undefined;
      const actions = storage.getAutomationActions({ status, type });
      const response: ApiResponse<AutomationAction[]> = { success: true, data: actions };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get automation actions',
      });
    }
  });

  // POST /actions/:id/approve - approve an action
  router.post('/actions/:id/approve', (req: Request, res: Response) => {
    try {
      const action = storage.updateAutomationActionStatus(req.params.id, 'approved', 'user');
      if (!action) {
        return res.status(404).json({ success: false, error: 'Action not found' });
      }
      const response: ApiResponse<AutomationAction> = { success: true, data: action };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve action',
      });
    }
  });

  // POST /actions/:id/reject - reject an action
  router.post('/actions/:id/reject', (req: Request, res: Response) => {
    try {
      const action = storage.updateAutomationActionStatus(req.params.id, 'rejected', 'user');
      if (!action) {
        return res.status(404).json({ success: false, error: 'Action not found' });
      }
      const response: ApiResponse<AutomationAction> = { success: true, data: action };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject action',
      });
    }
  });

  // GET /events - SSE endpoint
  router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    const unsubscribe = automationEngine.subscribe((event) => {
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

  return router;
}
