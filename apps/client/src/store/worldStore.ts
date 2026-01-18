import { create } from 'zustand';
import type {
  WorldConfig,
  CampaignRegion,
  ActivityState,
  TeamMember,
  Epic,
  Ticket,
  WorkArea,
  CameraState,
} from '@jira-planner/shared';
import {
  getWorldState,
  getCampaignRegions,
  autoGenerateRegions,
  updateMemberPosition,
} from '../utils/api';
import {
  loadBasecampMap,
  findWorkAreaForRole,
  getCampfireArea,
  getWorldDimensions,
  type BasecampMapData,
} from '../utils/tilemapLoader';

// Unit state for RTS visualization
export interface UnitState {
  memberId: string;
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
  activityState: ActivityState;
  currentEpicId: string | null;
}

// XP popup animation
export interface XPFloat {
  id: string;
  memberId: string;
  amount: number;
  x: number;
  y: number;
  createdAt: number;
}

// Campaign assignment for connection lines (Basecamp Hub model)
export interface CampaignAssignment {
  epicId: string;
  ticketCount: number;
  hasActiveWork: boolean; // true if any ticket is "In Progress"
}

interface WorldStore {
  // World data
  config: WorldConfig | null;
  regions: CampaignRegion[];
  units: Record<string, UnitState>;
  memberCampaignAssignments: Record<string, CampaignAssignment[]>;
  basecampMapData: BasecampMapData | null;
  workAreas: WorkArea[];

  // Camera state
  camera: CameraState;

  // UI state
  isLoading: boolean;
  selectedUnitId: string | null;
  xpFloats: XPFloat[];
  viewportOffset: { x: number; y: number };
  zoom: number;

  // Actions
  loadWorldState: () => Promise<void>;
  loadBasecampMap: () => Promise<void>;
  loadRegions: () => Promise<void>;
  generateRegions: () => Promise<void>;
  initializeUnits: (members: TeamMember[], epics: Epic[]) => void;
  selectUnit: (memberId: string | null) => void;
  moveUnit: (memberId: string, targetX: number, targetY: number, epicId?: string) => void;
  moveUnitToWorkArea: (memberId: string, role: string) => void;
  updateUnitPosition: (memberId: string, x: number, y: number) => void;
  setUnitActivityState: (memberId: string, state: ActivityState) => void;
  addXPFloat: (memberId: string, amount: number) => void;
  removeXPFloat: (id: string) => void;
  setViewportOffset: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  updateCampaignAssignments: (tickets: Ticket[]) => void;
  updateCamera: (camera: Partial<CameraState>) => void;
  panCameraTo: (x: number, y: number) => void;
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  // Initial state
  config: null,
  regions: [],
  units: {},
  memberCampaignAssignments: {},
  basecampMapData: null,
  workAreas: [],

  // Camera state
  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    isDragging: false,
  },

  isLoading: false,
  selectedUnitId: null,
  xpFloats: [],
  viewportOffset: { x: 0, y: 0 },
  zoom: 1,

  // Load full world state from API
  loadWorldState: async () => {
    set({ isLoading: true });
    try {
      // Load basecamp map data first
      const mapData = await loadBasecampMap();
      const worldDimensions = getWorldDimensions();

      const state = await getWorldState();

      // Override config with new world dimensions
      const updatedConfig: WorldConfig = {
        ...state.config,
        width: worldDimensions.width,
        height: worldDimensions.height,
        basecamp: mapData.workAreas.find((a) => a.id === 'campfire')?.position || { x: 800, y: 512 },
      };

      set({
        config: updatedConfig,
        regions: state.regions,
        basecampMapData: mapData,
        workAreas: mapData.workAreas,
        isLoading: false,
      });

      // Initialize unit positions from state
      const units: Record<string, UnitState> = {};
      for (const [memberId, pos] of Object.entries(state.memberPositions)) {
        units[memberId] = {
          memberId,
          x: pos.x,
          y: pos.y,
          targetX: null,
          targetY: null,
          activityState: pos.state,
          currentEpicId: null,
        };
      }
      set({ units });
    } catch (error) {
      console.error('Failed to load world state:', error);
      set({ isLoading: false });
    }
  },

  // Load basecamp map data
  loadBasecampMap: async () => {
    try {
      const mapData = await loadBasecampMap();
      set({
        basecampMapData: mapData,
        workAreas: mapData.workAreas,
      });
    } catch (error) {
      console.error('Failed to load basecamp map:', error);
    }
  },

  // Load regions only
  loadRegions: async () => {
    try {
      const regions = await getCampaignRegions();
      set({ regions });
    } catch (error) {
      console.error('Failed to load regions:', error);
    }
  },

  // Auto-generate regions for all epics
  generateRegions: async () => {
    set({ isLoading: true });
    try {
      const result = await autoGenerateRegions();
      set({ regions: result.regions, isLoading: false });
    } catch (error) {
      console.error('Failed to generate regions:', error);
      set({ isLoading: false });
    }
  },

  // Initialize units from team members
  initializeUnits: (members, _epics) => {
    const state = get();
    const existingUnits = state.units;

    const units: Record<string, UnitState> = {};

    // Get campfire area for default positioning
    const campfire = getCampfireArea();
    const campfireX = campfire?.position.x || 800;
    const campfireY = campfire?.position.y || 512;

    members.forEach((member, index) => {
      // If unit already exists, keep its position
      if (existingUnits[member.id]) {
        units[member.id] = existingUnits[member.id];
        return;
      }

      // Check if member has a saved position
      if (member.position) {
        units[member.id] = {
          memberId: member.id,
          x: member.position.x,
          y: member.position.y,
          targetX: null,
          targetY: null,
          activityState: 'idle',
          currentEpicId: null,
        };
        return;
      }

      // Place new units around the campfire with randomization
      const angle = (index / members.length) * Math.PI * 2;
      const distance = 60 + Math.random() * 40;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;

      units[member.id] = {
        memberId: member.id,
        x: campfireX + offsetX,
        y: campfireY + offsetY,
        targetX: null,
        targetY: null,
        activityState: 'idle',
        currentEpicId: null,
      };
    });

    set({ units });
  },

  // Select a unit
  selectUnit: (memberId) => {
    set({ selectedUnitId: memberId });
  },

  // Move unit to target position
  moveUnit: (memberId, targetX, targetY, epicId) => {
    set((state) => {
      const unit = state.units[memberId];
      if (!unit) return state;

      return {
        units: {
          ...state.units,
          [memberId]: {
            ...unit,
            targetX,
            targetY,
            activityState: 'walking',
            currentEpicId: epicId || null,
          },
        },
      };
    });

    // Persist position to server
    updateMemberPosition(memberId, { x: targetX, y: targetY }).catch((err) =>
      console.error('Failed to save position:', err)
    );
  },

  // Move unit to work area based on role
  moveUnitToWorkArea: (memberId, role) => {
    const workArea = findWorkAreaForRole(role);
    if (!workArea) {
      const campfire = getCampfireArea();
      if (campfire) {
        get().moveUnit(memberId, campfire.position.x, campfire.position.y);
      }
      return;
    }

    // Add some randomization within the work area
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * (workArea.radius * 0.6);
    const targetX = workArea.position.x + Math.cos(angle) * distance;
    const targetY = workArea.position.y + Math.sin(angle) * distance;

    get().moveUnit(memberId, targetX, targetY);
  },

  // Update unit's current position (for animation)
  updateUnitPosition: (memberId, x, y) => {
    set((state) => {
      const unit = state.units[memberId];
      if (!unit) return state;

      // Check if reached target
      const reachedTarget =
        unit.targetX !== null &&
        unit.targetY !== null &&
        Math.abs(x - unit.targetX) < 5 &&
        Math.abs(y - unit.targetY) < 5;

      return {
        units: {
          ...state.units,
          [memberId]: {
            ...unit,
            x,
            y,
            targetX: reachedTarget ? null : unit.targetX,
            targetY: reachedTarget ? null : unit.targetY,
            activityState: reachedTarget
              ? unit.currentEpicId
                ? 'working'
                : 'idle'
              : unit.activityState,
          },
        },
      };
    });
  },

  // Set unit activity state
  setUnitActivityState: (memberId, activityState) => {
    set((state) => {
      const unit = state.units[memberId];
      if (!unit) return state;

      return {
        units: {
          ...state.units,
          [memberId]: {
            ...unit,
            activityState,
          },
        },
      };
    });
  },

  // Add XP float animation
  addXPFloat: (memberId, amount) => {
    const unit = get().units[memberId];
    if (!unit) return;

    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({
      xpFloats: [
        ...state.xpFloats,
        {
          id,
          memberId,
          amount,
          x: unit.x,
          y: unit.y - 20,
          createdAt: Date.now(),
        },
      ],
    }));

    // Auto-remove after animation
    setTimeout(() => {
      get().removeXPFloat(id);
    }, 2000);
  },

  // Remove XP float
  removeXPFloat: (id) => {
    set((state) => ({
      xpFloats: state.xpFloats.filter((f) => f.id !== id),
    }));
  },

  // Set viewport offset (for panning)
  setViewportOffset: (x, y) => {
    set({ viewportOffset: { x, y } });
  },

  // Set zoom level
  setZoom: (zoom) => {
    set({ zoom: Math.max(0.5, Math.min(2, zoom)) });
  },

  // Update campaign assignments from tickets
  updateCampaignAssignments: (tickets) => {
    const assignments = computeCampaignAssignments(tickets);
    set({ memberCampaignAssignments: assignments });
  },

  // Update camera state
  updateCamera: (cameraUpdate) => {
    set((state) => ({
      camera: {
        ...state.camera,
        ...cameraUpdate,
      },
    }));
  },

  // Pan camera to center on a specific point
  panCameraTo: (x, y) => {
    const state = get();
    const viewportWidth = 1200; // Default viewport width
    const viewportHeight = 800; // Default viewport height

    set({
      camera: {
        ...state.camera,
        x: Math.max(0, x - viewportWidth / (2 * state.camera.zoom)),
        y: Math.max(0, y - viewportHeight / (2 * state.camera.zoom)),
      },
    });
  },
}));

/**
 * Compute campaign assignments from tickets
 * Groups tickets by assignee and epicId to determine connection lines
 */
export function computeCampaignAssignments(
  tickets: Ticket[]
): Record<string, CampaignAssignment[]> {
  const result: Record<string, CampaignAssignment[]> = {};

  // Filter tickets that have both an assignee and an epicId
  const relevantTickets = tickets.filter(
    (t) => t.assigneeId !== null && t.epicId !== null
  );

  // Group by assigneeId, then by epicId
  const grouped: Record<string, Record<string, { count: number; hasActive: boolean }>> = {};

  for (const ticket of relevantTickets) {
    const assigneeId = ticket.assigneeId!;
    const epicId = ticket.epicId!;

    if (!grouped[assigneeId]) {
      grouped[assigneeId] = {};
    }
    if (!grouped[assigneeId][epicId]) {
      grouped[assigneeId][epicId] = { count: 0, hasActive: false };
    }

    grouped[assigneeId][epicId].count++;

    // Check if ticket status indicates active work (approved/created = in progress)
    // Using 'approved' as the closest to "In Progress" based on the TicketStatus type
    if (ticket.status === 'approved' || ticket.status === 'created') {
      grouped[assigneeId][epicId].hasActive = true;
    }
  }

  // Convert to CampaignAssignment arrays
  for (const [assigneeId, epics] of Object.entries(grouped)) {
    result[assigneeId] = Object.entries(epics).map(([epicId, data]) => ({
      epicId,
      ticketCount: data.count,
      hasActiveWork: data.hasActive,
    }));
  }

  return result;
}

// Helper to find which region a point is in
export function findRegionAtPoint(
  regions: CampaignRegion[],
  x: number,
  y: number
): CampaignRegion | null {
  return (
    regions.find(
      (r) =>
        x >= r.bounds.x &&
        x <= r.bounds.x + r.bounds.width &&
        y >= r.bounds.y &&
        y <= r.bounds.y + r.bounds.height
    ) || null
  );
}

// Map role to sprite type for RTS units
export function getRoleSpriteType(role: string): string {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('frontend') || roleLower.includes('ui')) return 'wizard';
  if (roleLower.includes('backend') || roleLower.includes('api')) return 'knight';
  if (roleLower.includes('fullstack') || roleLower.includes('full stack')) return 'paladin';
  if (roleLower.includes('design')) return 'ranger';
  if (roleLower.includes('qa') || roleLower.includes('test')) return 'ranger';
  if (roleLower.includes('devops') || roleLower.includes('ops')) return 'knight';
  if (roleLower.includes('ai') || roleLower.includes('ml')) return 'golem';
  return 'knight'; // Default
}
