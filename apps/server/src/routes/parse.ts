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
      console.log('[parse] Received transcript request, length:', transcript?.length);

      if (!transcript || typeof transcript !== 'string') {
        console.log('[parse] Validation failed: transcript missing or not a string');
        const response: ApiResponse<never> = {
          success: false,
          error: 'Transcript is required and must be a string',
        };
        return res.status(400).json(response);
      }

      // Get context for the AI
      const teamMembers = storage.getTeamMembers();
      const epics = storage.getEpics();
      console.log('[parse] Context loaded - team members:', teamMembers.length, 'epics:', epics.length);

      // Parse transcript with Claude
      console.log('[parse] Calling Claude API to parse transcript...');
      const ticketInputs = await parseTranscript(transcript, { teamMembers, epics });
      console.log('[parse] Claude returned', ticketInputs.length, 'tickets');

      // Save tickets to database
      console.log('[parse] Creating tickets in storage...');
      const tickets = storage.createTickets(ticketInputs);
      console.log('[parse] Created', tickets.length, 'tickets');

      // Enhance each ticket (runs in parallel for speed)
      console.log('[parse] Enhancing tickets...');
      const enhancedTickets: EnhancedTicket[] = await Promise.all(
        tickets.map(async (ticket) => {
          try {
            console.log('[parse] Enhancing ticket:', ticket.id);
            const result = await agentService.enhanceTicket(ticket.id, 'comprehensive');
            console.log('[parse] Enhanced ticket:', ticket.id);
            return result.ticket;
          } catch (e) {
            console.error(`[parse] Failed to enhance ticket ${ticket.id}:`, e);
            return ticket; // Return unenhanced if fails
          }
        })
      );

      console.log('[parse] Success! Returning', enhancedTickets.length, 'enhanced tickets');
      const response: ApiResponse<ParseTranscriptResponse> = {
        success: true,
        data: { tickets: enhancedTickets },
      };
      res.json(response);
    } catch (error) {
      console.error('[parse] ERROR:', error);
      console.error('[parse] Error stack:', error instanceof Error ? error.stack : 'No stack');
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse transcript',
      };
      res.status(500).json(response);
    }
  });

  return router;
}
