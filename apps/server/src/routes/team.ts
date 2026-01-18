import { Router } from 'express';
import type {
  ApiResponse,
  TeamListResponse,
  TeamMember,
  CreateTeamMemberInput,
  UpdateTeamMemberInput,
} from '@jira-planner/shared';
import type { createStorageService } from '../services/storageService.js';

export function createTeamRouter(storage: ReturnType<typeof createStorageService>) {
  const router = Router();

  // List team members
  router.get('/', (req, res) => {
    try {
      const members = storage.getTeamMembers();
      const response: ApiResponse<TeamListResponse> = {
        success: true,
        data: { members },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch team members',
      };
      res.status(500).json(response);
    }
  });

  // Get single team member
  router.get('/:id', (req, res) => {
    try {
      const member = storage.getTeamMember(req.params.id);
      if (!member) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Team member not found',
        };
        return res.status(404).json(response);
      }
      const response: ApiResponse<TeamMember> = {
        success: true,
        data: member,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch team member',
      };
      res.status(500).json(response);
    }
  });

  // Create team member
  router.post('/', (req, res) => {
    try {
      const input = req.body as CreateTeamMemberInput;

      if (!input.name || !input.role) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Name and role are required',
        };
        return res.status(400).json(response);
      }

      const member = storage.createTeamMember({
        name: input.name,
        role: input.role,
        skills: input.skills || [],
        jiraUsername: input.jiraUsername,
      });

      const response: ApiResponse<TeamMember> = {
        success: true,
        data: member,
      };
      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create team member',
      };
      res.status(500).json(response);
    }
  });

  // Update team member
  router.put('/:id', (req, res) => {
    try {
      const input = req.body as UpdateTeamMemberInput;
      const member = storage.updateTeamMember(req.params.id, input);
      if (!member) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Team member not found',
        };
        return res.status(404).json(response);
      }
      const response: ApiResponse<TeamMember> = {
        success: true,
        data: member,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update team member',
      };
      res.status(500).json(response);
    }
  });

  // Delete team member
  router.delete('/:id', (req, res) => {
    try {
      const deleted = storage.deleteTeamMember(req.params.id);
      if (!deleted) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Team member not found',
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
        error: error instanceof Error ? error.message : 'Failed to delete team member',
      };
      res.status(500).json(response);
    }
  });

  return router;
}
