import { Router } from 'express';
import type { IdeasService } from '../services/ideasService.js';
import type { ApiResponse } from '@jira-planner/shared';

export function createIdeasRouter(ideasService: IdeasService): Router {
  const router = Router();

  // ============================================================================
  // Session Endpoints
  // ============================================================================

  // GET /api/ideas - List all sessions
  router.get('/', (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const sessions = ideasService.getSessions(status ? { status } : undefined);
      const response: ApiResponse<{ sessions: typeof sessions; total: number }> = {
        success: true,
        data: { sessions, total: sessions.length },
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting sessions:', error);
      res.status(500).json({ success: false, error: 'Failed to get sessions' });
    }
  });

  // POST /api/ideas - Create new session
  router.post('/', (req, res) => {
    try {
      const { title, initialMessage } = req.body;
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ success: false, error: 'Title is required' });
      }

      const session = ideasService.createSession({ title, initialMessage });
      const response: ApiResponse<typeof session> = { success: true, data: session };
      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    }
  });

  // GET /api/ideas/:id - Get session with all data
  router.get('/:id', (req, res) => {
    try {
      const sessionFull = ideasService.getSessionFull(req.params.id);
      if (!sessionFull) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      const response: ApiResponse<typeof sessionFull> = { success: true, data: sessionFull };
      res.json(response);
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ success: false, error: 'Failed to get session' });
    }
  });

  // PUT /api/ideas/:id - Update session
  router.put('/:id', (req, res) => {
    try {
      const { title, summary, status } = req.body;
      const session = ideasService.updateSession(req.params.id, { title, summary, status });
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      const response: ApiResponse<typeof session> = { success: true, data: session };
      res.json(response);
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({ success: false, error: 'Failed to update session' });
    }
  });

  // DELETE /api/ideas/:id - Archive session
  router.delete('/:id', (req, res) => {
    try {
      const session = ideasService.archiveSession(req.params.id);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      const response: ApiResponse<{ archived: true }> = { success: true, data: { archived: true } };
      res.json(response);
    } catch (error) {
      console.error('Error archiving session:', error);
      res.status(500).json({ success: false, error: 'Failed to archive session' });
    }
  });

  // ============================================================================
  // Message Endpoints
  // ============================================================================

  // POST /api/ideas/:id/messages - Send message, get AI response
  router.post('/:id/messages', async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ success: false, error: 'Message content is required' });
      }

      const result = await ideasService.sendMessage(req.params.id, content);
      const response: ApiResponse<typeof result> = { success: true, data: result };
      res.json(response);
    } catch (error: any) {
      console.error('Error sending message:', error);
      res.status(error.message === 'Session not found' ? 404 : 500).json({
        success: false,
        error: error.message || 'Failed to send message',
      });
    }
  });

  // ============================================================================
  // PRD Endpoints
  // ============================================================================

  // POST /api/ideas/:id/generate-prd - Generate PRD from conversation
  router.post('/:id/generate-prd', async (req, res) => {
    try {
      const result = await ideasService.generatePRD(req.params.id);
      const response: ApiResponse<typeof result> = { success: true, data: result };
      res.json(response);
    } catch (error: any) {
      console.error('Error generating PRD:', error);
      const status = error.message?.includes('not found') ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Failed to generate PRD',
      });
    }
  });

  // PUT /api/ideas/:id/prd - Update PRD directly
  router.put('/:id/prd', (req, res) => {
    try {
      const prd = ideasService.updatePRD(req.params.id, req.body);
      if (!prd) {
        return res.status(404).json({ success: false, error: 'PRD not found' });
      }
      const response: ApiResponse<typeof prd> = { success: true, data: prd };
      res.json(response);
    } catch (error) {
      console.error('Error updating PRD:', error);
      res.status(500).json({ success: false, error: 'Failed to update PRD' });
    }
  });

  // ============================================================================
  // Ticket Proposal Endpoints
  // ============================================================================

  // POST /api/ideas/:id/generate-tickets - Generate ticket proposals from PRD
  router.post('/:id/generate-tickets', async (req, res) => {
    try {
      const result = await ideasService.generateTickets(req.params.id);
      const response: ApiResponse<typeof result> = { success: true, data: result };
      res.json(response);
    } catch (error: any) {
      console.error('Error generating tickets:', error);
      const status = error.message?.includes('not found') ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Failed to generate tickets',
      });
    }
  });

  // PUT /api/ideas/:id/proposals/:proposalId - Update a proposal
  router.put('/:id/proposals/:proposalId', (req, res) => {
    try {
      const proposal = ideasService.updateProposal(req.params.proposalId, req.body);
      if (!proposal) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }
      const response: ApiResponse<typeof proposal> = { success: true, data: proposal };
      res.json(response);
    } catch (error) {
      console.error('Error updating proposal:', error);
      res.status(500).json({ success: false, error: 'Failed to update proposal' });
    }
  });

  // POST /api/ideas/:id/proposals/approve - Approve selected proposals & create tickets
  router.post('/:id/proposals/approve', async (req, res) => {
    try {
      const { proposalIds } = req.body;
      if (!Array.isArray(proposalIds) || proposalIds.length === 0) {
        return res.status(400).json({ success: false, error: 'proposalIds array is required' });
      }

      const result = await ideasService.approveProposals(req.params.id, proposalIds);
      const response: ApiResponse<typeof result> = { success: true, data: result };
      res.json(response);
    } catch (error: any) {
      console.error('Error approving proposals:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to approve proposals',
      });
    }
  });

  // POST /api/ideas/:id/proposals/:proposalId/reject - Reject a proposal
  router.post('/:id/proposals/:proposalId/reject', (req, res) => {
    try {
      const proposal = ideasService.rejectProposal(req.params.proposalId);
      if (!proposal) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }
      const response: ApiResponse<typeof proposal> = { success: true, data: proposal };
      res.json(response);
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      res.status(500).json({ success: false, error: 'Failed to reject proposal' });
    }
  });

  return router;
}
