import { Router } from 'express';
import type {
  ApiResponse,
  EpicListResponse,
  Epic,
  CreateEpicInput,
  UpdateEpicInput,
} from '@jira-planner/shared';
import type { createStorageService } from '../services/storageService.js';

export function createEpicsRouter(storage: ReturnType<typeof createStorageService>) {
  const router = Router();

  // List epics
  router.get('/', (req, res) => {
    try {
      const epics = storage.getEpics();
      const response: ApiResponse<EpicListResponse> = {
        success: true,
        data: { epics },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch epics',
      };
      res.status(500).json(response);
    }
  });

  // Get single epic
  router.get('/:id', (req, res) => {
    try {
      const epic = storage.getEpic(req.params.id);
      if (!epic) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Epic not found',
        };
        return res.status(404).json(response);
      }
      const response: ApiResponse<Epic> = {
        success: true,
        data: epic,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch epic',
      };
      res.status(500).json(response);
    }
  });

  // Create epic
  router.post('/', (req, res) => {
    try {
      const input = req.body as CreateEpicInput;

      if (!input.name || !input.key) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Name and key are required',
        };
        return res.status(400).json(response);
      }

      const epic = storage.createEpic({
        name: input.name,
        key: input.key,
        description: input.description || '',
      });

      const response: ApiResponse<Epic> = {
        success: true,
        data: epic,
      };
      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create epic',
      };
      res.status(500).json(response);
    }
  });

  // Update epic
  router.put('/:id', (req, res) => {
    try {
      const input = req.body as UpdateEpicInput;
      const epic = storage.updateEpic(req.params.id, input);
      if (!epic) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Epic not found',
        };
        return res.status(404).json(response);
      }
      const response: ApiResponse<Epic> = {
        success: true,
        data: epic,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update epic',
      };
      res.status(500).json(response);
    }
  });

  // Delete epic
  router.delete('/:id', (req, res) => {
    try {
      const deleted = storage.deleteEpic(req.params.id);
      if (!deleted) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Epic not found',
        };
        return res.status(404).json(response);
      }
      const response: ApiResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete epic',
      };
      res.status(500).json(response);
    }
  });

  return router;
}
