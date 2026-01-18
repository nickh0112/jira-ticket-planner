import { Router } from 'express';
import type {
  ApiResponse,
  AgentKnowledgeResponse,
  LearningResult,
  EnhanceTicketResponse,
  EpicSuggestion,
  AssigneeSuggestion,
  ProcessTranscriptRequest,
  ProcessTranscriptResponse,
  AgentOptions,
  ReprocessPendingResponse,
} from '@jira-planner/shared';
import type { AgentService } from '../services/agentService.js';

export function createAgentRouter(agentService: AgentService) {
  const router = Router();

  /**
   * POST /api/agent/learn
   * Trigger learning from Jira history to build/update knowledge base
   */
  router.post('/learn', async (req, res) => {
    try {
      const result = await agentService.learnFromJira();

      const response: ApiResponse<LearningResult> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      console.error('Learn error:', error);
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to learn from Jira',
      };
      res.status(500).json(response);
    }
  });

  /**
   * GET /api/agent/knowledge
   * View learned patterns and knowledge base
   */
  router.get('/knowledge', (req, res) => {
    try {
      const knowledge = agentService.getKnowledge();

      const response: ApiResponse<AgentKnowledgeResponse> = {
        success: true,
        data: knowledge,
      };
      res.json(response);
    } catch (error) {
      console.error('Knowledge error:', error);
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get knowledge',
      };
      res.status(500).json(response);
    }
  });

  /**
   * POST /api/agent/enhance/:ticketId
   * Enhance a specific ticket with technical context and AI coding notes
   */
  router.post('/enhance/:ticketId', async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { qualityThreshold } = req.body as { qualityThreshold?: 'basic' | 'standard' | 'comprehensive' };

      const result = await agentService.enhanceTicket(ticketId, qualityThreshold);

      const response: ApiResponse<EnhanceTicketResponse> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      console.error('Enhance error:', error);
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enhance ticket',
      };
      res.status(500).json(response);
    }
  });

  /**
   * POST /api/agent/suggest-epic
   * Get epic suggestions for a ticket
   */
  router.post('/suggest-epic', async (req, res) => {
    try {
      const { title, description, ticketType } = req.body as {
        title: string;
        description: string;
        ticketType: string;
      };

      if (!title || !description) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Title and description are required',
        };
        return res.status(400).json(response);
      }

      const suggestion = await agentService.suggestEpicForTicket({ title, description, ticketType });

      const response: ApiResponse<EpicSuggestion> = {
        success: true,
        data: suggestion,
      };
      res.json(response);
    } catch (error) {
      console.error('Suggest epic error:', error);
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to suggest epic',
      };
      res.status(500).json(response);
    }
  });

  /**
   * POST /api/agent/suggest-assignee
   * Get assignee suggestions for a ticket
   */
  router.post('/suggest-assignee', async (req, res) => {
    try {
      const { title, description, ticketType, requiredSkills } = req.body as {
        title: string;
        description: string;
        ticketType: string;
        requiredSkills?: string[];
      };

      if (!title || !description) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Title and description are required',
        };
        return res.status(400).json(response);
      }

      const suggestions = await agentService.suggestAssigneesForTicket({
        title,
        description,
        ticketType,
        requiredSkills,
      });

      const response: ApiResponse<AssigneeSuggestion[]> = {
        success: true,
        data: suggestions,
      };
      res.json(response);
    } catch (error) {
      console.error('Suggest assignee error:', error);
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to suggest assignees',
      };
      res.status(500).json(response);
    }
  });

  /**
   * POST /api/agent/process
   * Full enhanced parsing pipeline - parse, enhance, and route tickets
   */
  router.post('/process', async (req, res) => {
    try {
      const { tickets, options } = req.body as {
        tickets: any[];
        options?: AgentOptions;
      };

      if (!tickets || !Array.isArray(tickets)) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Tickets array is required',
        };
        return res.status(400).json(response);
      }

      const result = await agentService.processTranscript(tickets, options);

      const response: ApiResponse<ProcessTranscriptResponse> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      console.error('Process error:', error);
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process tickets',
      };
      res.status(500).json(response);
    }
  });

  /**
   * POST /api/agent/reprocess-pending
   * Reprocess all pending/approved tickets through the assignment logic
   * Uses learned data to suggest epics and assignees, auto-assigning high-confidence matches
   */
  router.post('/reprocess-pending', async (req, res) => {
    try {
      const result = await agentService.reprocessPendingTickets();

      const response: ApiResponse<ReprocessPendingResponse> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      console.error('Reprocess pending error:', error);
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reprocess pending tickets',
      };
      res.status(500).json(response);
    }
  });

  /**
   * POST /api/agent/epic-proposals/:proposalId/approve
   * Approve a pending epic proposal
   */
  router.post('/epic-proposals/:proposalId/approve', async (req, res) => {
    try {
      const { proposalId } = req.params;
      const result = await agentService.approveEpicProposal(proposalId);

      const response: ApiResponse<{ epicId: string }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      console.error('Approve proposal error:', error);
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve proposal',
      };
      res.status(500).json(response);
    }
  });

  /**
   * POST /api/agent/epic-proposals/:proposalId/reject
   * Reject a pending epic proposal
   */
  router.post('/epic-proposals/:proposalId/reject', async (req, res) => {
    try {
      const { proposalId } = req.params;
      agentService.rejectEpicProposal(proposalId);

      const response: ApiResponse<{ success: true }> = {
        success: true,
        data: { success: true },
      };
      res.json(response);
    } catch (error) {
      console.error('Reject proposal error:', error);
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject proposal',
      };
      res.status(500).json(response);
    }
  });

  return router;
}
