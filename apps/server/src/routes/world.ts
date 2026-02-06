import { Router, Request, Response } from 'express';
import type {
  ApiResponse,
  WorldConfig,
  CampaignRegion,
  WorldState,
  UpdateWorldConfigInput,
  CreateCampaignRegionInput,
  UpdateMemberPositionInput,
} from '@jira-planner/shared';
import type { StorageService } from '../services/storageService.js';

export function createWorldRouter(storage: StorageService): Router {
  const router = Router();

  // Get world configuration
  router.get('/config', (req: Request, res: Response) => {
    try {
      const config = storage.getWorldConfig();
      const response: ApiResponse<WorldConfig> = {
        success: true,
        data: config,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get world config',
      });
    }
  });

  // Update world configuration
  router.put('/config', (req: Request, res: Response) => {
    try {
      const updates: UpdateWorldConfigInput = req.body;
      const config = storage.updateWorldConfig(updates);
      const response: ApiResponse<WorldConfig> = {
        success: true,
        data: config,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update world config',
      });
    }
  });

  // Get full world state (for initial load or polling fallback)
  router.get('/state', (req: Request, res: Response) => {
    try {
      const config = storage.getWorldConfig();
      const regions = storage.getCampaignRegions();
      const teamMembers = storage.getTeamMembers();
      const levelUpEvents = storage.getUnacknowledgedLevelUpEvents();

      // Build member positions from team members
      const memberPositions: WorldState['memberPositions'] = {};
      for (const member of teamMembers) {
        if (member.position) {
          memberPositions[member.id] = {
            x: member.position.x,
            y: member.position.y,
            state: 'idle', // Default state, client should manage activity states
          };
        }
      }

      const worldState: WorldState = {
        config,
        regions,
        memberPositions,
        pendingLevelUps: levelUpEvents,
      };

      const response: ApiResponse<WorldState> = {
        success: true,
        data: worldState,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get world state',
      });
    }
  });

  // Get all campaign regions
  router.get('/regions', (req: Request, res: Response) => {
    try {
      const regions = storage.getCampaignRegions();
      const response: ApiResponse<CampaignRegion[]> = {
        success: true,
        data: regions,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get regions',
      });
    }
  });

  // Create a new campaign region
  router.post('/regions', (req: Request, res: Response) => {
    try {
      const input: CreateCampaignRegionInput = req.body;

      // Validate required fields
      if (!input.epicId || input.x === undefined || input.y === undefined ||
          input.width === undefined || input.height === undefined) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: epicId, x, y, width, height',
        });
        return;
      }

      // Check if epic exists
      const epic = storage.getEpic(input.epicId);
      if (!epic) {
        res.status(404).json({
          success: false,
          error: 'Epic not found',
        });
        return;
      }

      // Check if region already exists for this epic
      const existing = storage.getCampaignRegionByEpic(input.epicId);
      if (existing) {
        // Update existing region instead
        const updated = storage.updateCampaignRegion(existing.id, input);
        const response: ApiResponse<CampaignRegion> = {
          success: true,
          data: updated!,
        };
        res.json(response);
        return;
      }

      const region = storage.createCampaignRegion(input);
      const response: ApiResponse<CampaignRegion> = {
        success: true,
        data: region,
      };
      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create region',
      });
    }
  });

  // Update a campaign region
  router.put('/regions/:id', (req: Request, res: Response) => {
    try {
      const updates: Partial<CreateCampaignRegionInput> = req.body;
      const region = storage.updateCampaignRegion(req.params.id, updates);

      if (!region) {
        res.status(404).json({
          success: false,
          error: 'Region not found',
        });
        return;
      }

      const response: ApiResponse<CampaignRegion> = {
        success: true,
        data: region,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update region',
      });
    }
  });

  // Delete a campaign region
  router.delete('/regions/:id', (req: Request, res: Response) => {
    try {
      const deleted = storage.deleteCampaignRegion(req.params.id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Region not found',
        });
        return;
      }

      const response: ApiResponse<{ deleted: true }> = {
        success: true,
        data: { deleted: true },
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete region',
      });
    }
  });

  // Auto-generate regions for all epics
  router.post('/regions/auto-generate', (req: Request, res: Response) => {
    try {
      const epics = storage.getEpics();
      const worldConfig = storage.getWorldConfig();
      const existingRegions = storage.getCampaignRegions();
      const existingEpicIds = new Set(existingRegions.map(r => r.epicId));

      // Filter out epics that already have regions
      const epicsWithoutRegions = epics.filter(e => !existingEpicIds.has(e.id));

      if (epicsWithoutRegions.length === 0) {
        const response: ApiResponse<{ created: number; regions: CampaignRegion[] }> = {
          success: true,
          data: { created: 0, regions: existingRegions },
        };
        res.json(response);
        return;
      }

      // Calculate grid layout for new regions
      const regionWidth = 180;
      const regionHeight = 140;
      const startX = 300; // Leave space for basecamp
      const startY = 50;
      const cols = Math.floor((worldConfig.width - startX - 50) / (regionWidth + 20));
      const existingCount = existingRegions.length;

      // Generate colors for regions
      const colors = [
        '#5D4E37', // Dark brown
        '#4A5D4E', // Forest green
        '#5D4A4A', // Dusty red
        '#4A4A5D', // Slate blue
        '#5D5D4A', // Olive
        '#4A5D5D', // Teal
        '#5D4A5D', // Purple
        '#5D5A4A', // Tan
      ];

      const newRegions: CampaignRegion[] = [];
      epicsWithoutRegions.forEach((epic, index) => {
        const totalIndex = existingCount + index;
        const col = totalIndex % cols;
        const row = Math.floor(totalIndex / cols);

        const region = storage.createCampaignRegion({
          epicId: epic.id,
          x: startX + col * (regionWidth + 20),
          y: startY + row * (regionHeight + 20),
          width: regionWidth,
          height: regionHeight,
          color: colors[totalIndex % colors.length],
        });
        newRegions.push(region);
      });

      const response: ApiResponse<{ created: number; regions: CampaignRegion[] }> = {
        success: true,
        data: {
          created: newRegions.length,
          regions: [...existingRegions, ...newRegions],
        },
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to auto-generate regions',
      });
    }
  });

  return router;
}

// Extended team routes for RTS
export function createTeamExtensionRouter(storage: StorageService): Router {
  const router = Router();

  // Update member position
  router.put('/:id/position', (req: Request, res: Response) => {
    try {
      const input: UpdateMemberPositionInput = req.body;

      if (input.x === undefined || input.y === undefined) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: x, y',
        });
        return;
      }

      const member = storage.updateMemberPosition(req.params.id, input);

      if (!member) {
        res.status(404).json({
          success: false,
          error: 'Team member not found',
        });
        return;
      }

      const response: ApiResponse<typeof member> = {
        success: true,
        data: member,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update position',
      });
    }
  });

  // Get member progress
  router.get('/:id/progress', (req: Request, res: Response) => {
    try {
      const progress = storage.getOrCreateMemberProgress(req.params.id);
      const response: ApiResponse<typeof progress> = {
        success: true,
        data: progress,
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get progress',
      });
    }
  });

  return router;
}
