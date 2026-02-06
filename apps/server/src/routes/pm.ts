import { Router, Request, Response } from 'express';
import type {
  ApiResponse,
  PMDashboardData,
  EngineerStatus,
  EngineerDetailData,
  PMAlert,
  PMAssignment,
  AITicketSuggestion,
  PMConfig,
  CreatePMAssignmentInput,
  UpdatePMConfigInput,
} from '@jira-planner/shared';
import type { StorageService } from '../services/storageService.js';
import type { PMService } from '../services/pmService.js';

// Accept either the old PMBackgroundService or the new AutomationEngine
interface BackgroundServiceLike {
  subscribe(callback: (event: any) => void): () => void;
  getStatus(): any;
  runChecks?(): Promise<any>;
  runCycle?(): Promise<any>;
  updateCheckInterval?(hours: number): void;
  stopEngine?(): void;
  startEngine?(): void;
}

export function createPMRouter(
  storage: StorageService,
  pmService: PMService,
  pmBackgroundService: BackgroundServiceLike
): Router {
  const router = Router();

  // ============================================================================
  // Dashboard
  // ============================================================================

  // Get full dashboard data
  router.get('/dashboard', (req: Request, res: Response) => {
    try {
      const data = pmService.getDashboardData();
      const response: ApiResponse<PMDashboardData> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get dashboard data',
      });
    }
  });

  // ============================================================================
  // Engineers
  // ============================================================================

  // Get all engineers with status
  router.get('/engineers', (req: Request, res: Response) => {
    try {
      const engineers = pmService.getAllEngineersStatus();
      const response: ApiResponse<EngineerStatus[]> = {
        success: true,
        data: engineers,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get engineers',
      });
    }
  });

  // Get single engineer status
  router.get('/engineers/:id', (req: Request, res: Response) => {
    try {
      const engineer = pmService.getEngineerStatus(req.params.id);
      if (!engineer) {
        return res.status(404).json({
          success: false,
          error: 'Engineer not found',
        });
      }
      const response: ApiResponse<EngineerStatus> = {
        success: true,
        data: engineer,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get engineer',
      });
    }
  });

  // Get engineer detail data (tickets, activity)
  router.get('/engineers/:id/detail', async (req: Request, res: Response) => {
    try {
      const detail = await pmService.getEngineerDetailData(req.params.id);
      if (!detail) {
        return res.status(404).json({
          success: false,
          error: 'Engineer not found',
        });
      }
      const response: ApiResponse<EngineerDetailData> = {
        success: true,
        data: detail,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get engineer detail',
      });
    }
  });

  // ============================================================================
  // Alerts
  // ============================================================================

  // Get active alerts
  router.get('/alerts', (req: Request, res: Response) => {
    try {
      const alerts = storage.getActivePMAlerts();
      const response: ApiResponse<PMAlert[]> = {
        success: true,
        data: alerts,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get alerts',
      });
    }
  });

  // Dismiss an alert
  router.post('/alerts/:id/dismiss', (req: Request, res: Response) => {
    try {
      storage.dismissPMAlert(req.params.id);
      const response: ApiResponse<{ dismissed: true }> = {
        success: true,
        data: { dismissed: true },
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to dismiss alert',
      });
    }
  });

  // ============================================================================
  // Assignments
  // ============================================================================

  // Get assignment history
  router.get('/assignments', (req: Request, res: Response) => {
    try {
      const assigneeId = req.query.assigneeId as string | undefined;
      const completedStr = req.query.completed as string | undefined;
      const completed = completedStr === 'true' ? true : completedStr === 'false' ? false : undefined;

      const assignments = storage.getPMAssignments({ assigneeId, completed });
      const response: ApiResponse<PMAssignment[]> = {
        success: true,
        data: assignments,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get assignments',
      });
    }
  });

  // Record new assignment
  router.post('/assignments', (req: Request, res: Response) => {
    try {
      const input: CreatePMAssignmentInput = req.body;
      const assignment = pmService.recordAssignment(input);
      const response: ApiResponse<PMAssignment> = {
        success: true,
        data: assignment,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record assignment',
      });
    }
  });

  // Complete an assignment
  router.post('/assignments/:id/complete', (req: Request, res: Response) => {
    try {
      const assignment = pmService.recordCompletion(req.params.id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found',
        });
      }
      const response: ApiResponse<PMAssignment> = {
        success: true,
        data: assignment,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete assignment',
      });
    }
  });

  // ============================================================================
  // Suggestions
  // ============================================================================

  // Get pending suggestions
  router.get('/suggestions', (req: Request, res: Response) => {
    try {
      const memberId = req.query.memberId as string | undefined;
      const suggestions = storage.getPendingAISuggestions(memberId);
      const response: ApiResponse<AITicketSuggestion[]> = {
        success: true,
        data: suggestions,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get suggestions',
      });
    }
  });

  // Generate new suggestions for a member
  router.post('/suggestions/generate/:memberId', async (req: Request, res: Response) => {
    try {
      const suggestions = await pmService.generateSuggestions(req.params.memberId);
      const response: ApiResponse<AITicketSuggestion[]> = {
        success: true,
        data: suggestions,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate suggestions',
      });
    }
  });

  // Approve a suggestion (and create assignment)
  router.post('/suggestions/:id/approve', async (req: Request, res: Response) => {
    try {
      const result = await pmService.approveSuggestion(req.params.id);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Suggestion not found or already processed',
        });
      }
      const response: ApiResponse<{ suggestion: AITicketSuggestion; assignment: PMAssignment }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve suggestion',
      });
    }
  });

  // Reject a suggestion
  router.post('/suggestions/:id/reject', (req: Request, res: Response) => {
    try {
      const suggestion = pmService.rejectSuggestion(req.params.id);
      if (!suggestion) {
        return res.status(404).json({
          success: false,
          error: 'Suggestion not found',
        });
      }
      const response: ApiResponse<AITicketSuggestion> = {
        success: true,
        data: suggestion,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject suggestion',
      });
    }
  });

  // ============================================================================
  // Configuration
  // ============================================================================

  // Get PM config
  router.get('/config', (req: Request, res: Response) => {
    try {
      const config = storage.getPMConfig();
      const response: ApiResponse<PMConfig> = {
        success: true,
        data: config,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get config',
      });
    }
  });

  // Update PM config
  router.put('/config', (req: Request, res: Response) => {
    try {
      const updates: UpdatePMConfigInput = req.body;
      const config = storage.updatePMConfig(updates);

      // If check interval changed, restart the background service
      if (updates.checkIntervalHours !== undefined) {
        if (pmBackgroundService.updateCheckInterval) {
          pmBackgroundService.updateCheckInterval(updates.checkIntervalHours);
        } else if (pmBackgroundService.stopEngine && pmBackgroundService.startEngine) {
          // Automation engine: restart to pick up new config
          pmBackgroundService.stopEngine();
          pmBackgroundService.startEngine();
        }
      }

      const response: ApiResponse<PMConfig> = {
        success: true,
        data: config,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update config',
      });
    }
  });

  // ============================================================================
  // Background Service
  // ============================================================================

  // Get service status
  router.get('/status', (req: Request, res: Response) => {
    try {
      const status = pmBackgroundService.getStatus();
      const response: ApiResponse<typeof status> = {
        success: true,
        data: status,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status',
      });
    }
  });

  // Trigger manual check
  router.post('/check', async (req: Request, res: Response) => {
    try {
      const result = pmBackgroundService.runChecks
        ? await pmBackgroundService.runChecks()
        : await pmBackgroundService.runCycle!();
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Check failed',
      });
    }
  });

  // ============================================================================
  // SSE Events
  // ============================================================================

  // SSE endpoint for real-time events
  router.get('/events', (req: Request, res: Response) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    // Subscribe to PM events
    const unsubscribe = pmBackgroundService.subscribe((event) => {
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

  return router;
}
