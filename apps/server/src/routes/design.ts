import { Router } from 'express';
import type { DesignService } from '../services/designService.js';
import type { ApiResponse } from '@jira-planner/shared';

export function createDesignRouter(designService: DesignService): Router {
  const router = Router();

  // ============================================================================
  // Session Endpoints
  // ============================================================================

  // GET /api/design - List all sessions
  router.get('/', (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const sessions = designService.getSessions(status ? { status } : undefined);
      const response: ApiResponse<{ sessions: typeof sessions; total: number }> = {
        success: true,
        data: { sessions, total: sessions.length },
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting design sessions:', error);
      res.status(500).json({ success: false, error: 'Failed to get design sessions' });
    }
  });

  // POST /api/design - Create new session
  router.post('/', (req, res) => {
    try {
      const { title, sourceType, sourceId, codebaseContextId } = req.body;
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ success: false, error: 'Title is required' });
      }

      const session = designService.createSession({ title, sourceType, sourceId, codebaseContextId });
      const response: ApiResponse<typeof session> = { success: true, data: session };
      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating design session:', error);
      res.status(500).json({ success: false, error: 'Failed to create design session' });
    }
  });

  // GET /api/design/:id - Get full session
  router.get('/:id', (req, res) => {
    try {
      const sessionFull = designService.getSessionFull(req.params.id);
      if (!sessionFull) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      const response: ApiResponse<typeof sessionFull> = { success: true, data: sessionFull };
      res.json(response);
    } catch (error) {
      console.error('Error getting design session:', error);
      res.status(500).json({ success: false, error: 'Failed to get design session' });
    }
  });

  // PUT /api/design/:id - Update session
  router.put('/:id', (req, res) => {
    try {
      const { title, status, codebaseContextId } = req.body;
      const session = designService.updateSession(req.params.id, { title, status, codebaseContextId });
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      const response: ApiResponse<typeof session> = { success: true, data: session };
      res.json(response);
    } catch (error) {
      console.error('Error updating design session:', error);
      res.status(500).json({ success: false, error: 'Failed to update design session' });
    }
  });

  // DELETE /api/design/:id - Archive session
  router.delete('/:id', (req, res) => {
    try {
      designService.archiveSession(req.params.id);
      const response: ApiResponse<{ archived: true }> = { success: true, data: { archived: true } };
      res.json(response);
    } catch (error) {
      console.error('Error archiving design session:', error);
      res.status(500).json({ success: false, error: 'Failed to archive design session' });
    }
  });

  // ============================================================================
  // Message Endpoints
  // ============================================================================

  // POST /api/design/:id/messages - Send message, get AI response
  router.post('/:id/messages', async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ success: false, error: 'Message content is required' });
      }

      const result = await designService.sendMessage(req.params.id, content);
      const response: ApiResponse<typeof result> = { success: true, data: result };
      res.json(response);
    } catch (error: any) {
      console.error('Error sending design message:', error);
      res.status(error.message === 'Session not found' ? 404 : 500).json({
        success: false,
        error: error.message || 'Failed to send message',
      });
    }
  });

  // ============================================================================
  // Prototype Endpoints
  // ============================================================================

  // POST /api/design/:id/generate-prototype - Generate prototype
  router.post('/:id/generate-prototype', async (req, res) => {
    try {
      const result = await designService.generatePrototype(req.params.id);
      const response: ApiResponse<typeof result> = { success: true, data: result };
      res.json(response);
    } catch (error: any) {
      console.error('Error generating prototype:', error);
      const status = error.message?.includes('not found') ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Failed to generate prototype',
      });
    }
  });

  // PUT /api/design/:id/approve - Approve prototype
  router.put('/:id/approve', (req, res) => {
    try {
      const session = designService.approvePrototype(req.params.id);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      const response: ApiResponse<typeof session> = { success: true, data: session };
      res.json(response);
    } catch (error) {
      console.error('Error approving prototype:', error);
      res.status(500).json({ success: false, error: 'Failed to approve prototype' });
    }
  });

  // POST /api/design/:id/share - Share prototype
  router.post('/:id/share', async (req, res) => {
    try {
      const { method } = req.body;
      if (!method || !['code', 'jira'].includes(method)) {
        return res.status(400).json({ success: false, error: 'method must be "code" or "jira"' });
      }

      const result = await designService.sharePrototype(req.params.id, { method });
      const response: ApiResponse<typeof result> = { success: true, data: result };
      res.json(response);
    } catch (error: any) {
      console.error('Error sharing prototype:', error);
      const status = error.message?.includes('not found') || error.message?.includes('not configured') ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Failed to share prototype',
      });
    }
  });

  return router;
}
