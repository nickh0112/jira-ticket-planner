import { Router } from 'express';
import type { ParseTranscriptRequest, ApiResponse, ParseTranscriptResponse, EnhancedTicket } from '@jira-planner/shared';
import { parseTranscript } from '../services/claudeService.js';
import type { createStorageService } from '../services/storageService.js';
import type { AgentService } from '../services/agentService.js';

export function createParseRouter(
  storage: ReturnType<typeof createStorageService>,
  agentService: AgentService
) {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
      const { transcript } = req.body as ParseTranscriptRequest;

      if (!transcript || typeof transcript !== 'string') {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Transcript is required and must be a string',
        };
        return res.status(400).json(response);
      }

      // Get context for the AI
      const teamMembers = storage.getTeamMembers();
      const epics = storage.getEpics();

      // Parse transcript with Claude
      const ticketInputs = await parseTranscript(transcript, { teamMembers, epics });

      // Save tickets to database
      const tickets = storage.createTickets(ticketInputs);

      // Enhance each ticket (runs in parallel for speed)
      const enhancedTickets: EnhancedTicket[] = await Promise.all(
        tickets.map(async (ticket) => {
          try {
            const result = await agentService.enhanceTicket(ticket.id, 'comprehensive');
            return result.ticket;
          } catch (e) {
            console.error(`Failed to enhance ticket ${ticket.id}:`, e);
            return ticket; // Return unenhanced if fails
          }
        })
      );

      const response: ApiResponse<ParseTranscriptResponse> = {
        success: true,
        data: { tickets: enhancedTickets },
      };
      res.json(response);
    } catch (error) {
      console.error('Parse error:', error);
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse transcript',
      };
      res.status(500).json(response);
    }
  });

  return router;
}
