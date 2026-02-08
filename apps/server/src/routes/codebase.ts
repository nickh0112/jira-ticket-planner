import { Router } from 'express';
import type { StorageService } from '../services/storageService.js';
import type { ApiResponse } from '@jira-planner/shared';

export function createCodebaseRouter(storage: StorageService): Router {
  const router = Router();

  // GET /api/codebase-context - List all contexts
  router.get('/', (req, res) => {
    try {
      const contexts = storage.getCodebaseContexts();
      const response: ApiResponse<typeof contexts> = { success: true, data: contexts };
      res.json(response);
    } catch (error) {
      console.error('Error getting codebase contexts:', error);
      res.status(500).json({ success: false, error: 'Failed to get codebase contexts' });
    }
  });

  // GET /api/codebase-context/:id - Get full context
  router.get('/:id', (req, res) => {
    try {
      const context = storage.getCodebaseContext(req.params.id);
      if (!context) {
        return res.status(404).json({ success: false, error: 'Context not found' });
      }
      const response: ApiResponse<typeof context> = { success: true, data: context };
      res.json(response);
    } catch (error) {
      console.error('Error getting codebase context:', error);
      res.status(500).json({ success: false, error: 'Failed to get codebase context' });
    }
  });

  // POST /api/codebase-context - Ingest analysis
  router.post('/', (req, res) => {
    try {
      const { name, rootPath, analyzedAt, totalFiles, totalDirectories, languageBreakdown, contextSummary, rawAnalysis } = req.body;
      if (!name || !rootPath || !contextSummary) {
        return res.status(400).json({ success: false, error: 'name, rootPath, and contextSummary are required' });
      }

      const context = storage.createCodebaseContext({
        name,
        rootPath,
        analyzedAt: analyzedAt || new Date().toISOString(),
        totalFiles: totalFiles || 0,
        totalDirectories: totalDirectories || 0,
        languageBreakdown: languageBreakdown || {},
        contextSummary,
        rawAnalysis: typeof rawAnalysis === 'string' ? rawAnalysis : JSON.stringify(rawAnalysis || {}),
      });

      const response: ApiResponse<typeof context> = { success: true, data: context };
      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating codebase context:', error);
      res.status(500).json({ success: false, error: 'Failed to create codebase context' });
    }
  });

  // DELETE /api/codebase-context/:id - Delete context
  router.delete('/:id', (req, res) => {
    try {
      const deleted = storage.deleteCodebaseContext(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Context not found' });
      }
      const response: ApiResponse<{ deleted: true }> = { success: true, data: { deleted: true } };
      res.json(response);
    } catch (error) {
      console.error('Error deleting codebase context:', error);
      res.status(500).json({ success: false, error: 'Failed to delete codebase context' });
    }
  });

  return router;
}
