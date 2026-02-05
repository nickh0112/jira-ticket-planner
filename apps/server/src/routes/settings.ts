import { Router } from 'express';
import type { ApiResponse, ProjectContext, ProjectContextInput } from '@jira-planner/shared';
import type { createStorageService } from '../services/storageService.js';

export function createSettingsRouter(storage: ReturnType<typeof createStorageService>) {
  const router = Router();

  // Get project context
  router.get('/project-context', (req, res) => {
    try {
      const context = storage.getProjectContext();
      const response: ApiResponse<{ context: ProjectContext | null }> = {
        success: true,
        data: { context },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project context',
      };
      res.status(500).json(response);
    }
  });

  // Update project context
  router.put('/project-context', (req, res) => {
    try {
      const input = req.body.context as ProjectContextInput;
      if (!input) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Context data is required',
        };
        return res.status(400).json(response);
      }

      const context = storage.updateProjectContext(input);
      const response: ApiResponse<{ context: ProjectContext }> = {
        success: true,
        data: { context },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project context',
      };
      res.status(500).json(response);
    }
  });

  return router;
}
