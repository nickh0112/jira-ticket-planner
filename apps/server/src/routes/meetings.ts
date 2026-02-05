import { Router, Request, Response } from 'express';
import type { ApiResponse, MeetingProcessResult, MeetingFull } from '@jira-planner/shared';
import type { StorageService } from '../services/storageService.js';
import type { MeetingService } from '../services/meetingService.js';

export function createMeetingsRouter(
  storage: StorageService,
  meetingService: MeetingService
): Router {
  const router = Router();

  // Process meeting notes
  router.post('/process', async (req: Request, res: Response) => {
    try {
      const { title, type, rawInput } = req.body;

      if (!title || !type || !rawInput) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, type, rawInput',
        });
      }

      const teamMembers = storage.getTeamMembers();
      const epics = storage.getEpics();

      const result = await meetingService.processMeetingNotes(
        { title, type, rawInput },
        { teamMembers, epics }
      );

      const response: ApiResponse<MeetingProcessResult> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process meeting notes',
      });
    }
  });

  // List meetings
  router.get('/', (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const meetingType = req.query.type as string | undefined;

      const meetings = storage.getMeetings({ meetingType, limit });
      const response: ApiResponse<typeof meetings> = {
        success: true,
        data: meetings,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list meetings',
      });
    }
  });

  // Get meeting with full details
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const meeting = storage.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          error: 'Meeting not found',
        });
      }

      const objectives = storage.getMeetingObjectives(req.params.id);
      const decisions = storage.getMeetingDecisions(req.params.id);
      const actionItems = storage.getMeetingActionItems({ meetingId: req.params.id });

      const full: MeetingFull = {
        meeting,
        objectives: objectives as any,
        decisions,
        actionItems: actionItems as any,
      };

      const response: ApiResponse<MeetingFull> = {
        success: true,
        data: full,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get meeting',
      });
    }
  });

  // Update action item status
  router.put('/action-items/:id', (req: Request, res: Response) => {
    try {
      const updates = req.body;
      const actionItem = storage.updateMeetingActionItem(req.params.id, updates);
      if (!actionItem) {
        return res.status(404).json({
          success: false,
          error: 'Action item not found',
        });
      }

      const response: ApiResponse<typeof actionItem> = {
        success: true,
        data: actionItem,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update action item',
      });
    }
  });

  // Convert action item to Jira ticket
  router.post('/action-items/:id/convert-to-ticket', (req: Request, res: Response) => {
    try {
      const actionItems = storage.getMeetingActionItems({});
      const actionItem = actionItems.find(ai => ai.id === req.params.id);
      if (!actionItem) {
        return res.status(404).json({
          success: false,
          error: 'Action item not found',
        });
      }

      // Create a ticket from the action item
      const ticket = storage.createTicket({
        title: actionItem.action,
        description: `Created from meeting action item.\n\nAction: ${actionItem.action}`,
        acceptanceCriteria: ['Complete the action item as described'],
        ticketType: 'task',
        priority: 'medium',
        assigneeId: actionItem.assigneeId ?? undefined,
      });

      // Link the ticket back to the action item
      storage.updateMeetingActionItem(req.params.id, {
        jiraTicketId: ticket.id,
      });

      const response: ApiResponse<typeof ticket> = {
        success: true,
        data: ticket,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert action item to ticket',
      });
    }
  });

  return router;
}
