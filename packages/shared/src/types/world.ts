// RTS World Types

export interface CampaignRegion {
  id: string;
  epicId: string;
  bounds: { x: number; y: number; width: number; height: number };
  color: string;
  createdAt: string;
}

// Work area within the basecamp (role-based zones)
export interface WorkArea {
  id: string;
  name: string;
  roleTypes: string[];
  position: { x: number; y: number };
  radius: number;
}

// Camera state for viewport control
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  isDragging: boolean;
}

export interface WorldConfig {
  id: string;
  width: number;
  height: number;
  basecamp: { x: number; y: number };
  updatedAt: string;
}

export interface LevelUpEvent {
  id: string;
  entityType: 'member' | 'ai';
  entityId: string;
  oldLevel: number;
  newLevel: number;
  newTitle: string;
  triggeredAt: string;
  acknowledged: boolean;
}

export interface MemberProgress {
  id: string;
  teamMemberId: string;
  xp: number;
  level: number;
  title: string;
  ticketsCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketCompletion {
  id: string;
  jiraKey: string;
  teamMemberId: string | null;
  completedAt: string;
  xpAwarded: number;
  completionSource: 'jira_sync' | 'manual';
  createdAt: string;
}

export interface JiraSyncState {
  id: string;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  syncIntervalMs: number;
  syncEnabled: boolean;
  baselineDate: string | null;
  errorCount: number;
  lastError: string | null;
  updatedAt: string;
}

export interface AIMember {
  id: string;
  name: string;
  persona: string;
  xp: number;
  level: number;
  title: string;
  actionsCompleted: number;
  createdAt: string;
}

// Activity states for RTS animations
export type ActivityState = 'idle' | 'walking' | 'working' | 'completing' | 'leveling_up';

// World state for client-side rendering
export interface WorldState {
  config: WorldConfig;
  regions: CampaignRegion[];
  memberPositions: Record<string, { x: number; y: number; state: ActivityState }>;
  pendingLevelUps: LevelUpEvent[];
}

// Sync event types for SSE
export type SyncEventType =
  | 'connected'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_error'
  | 'ticket_completed'
  | 'xp_awarded'
  | 'level_up'
  | 'member_moved'
  | 'region_updated';

export interface SyncEvent {
  type: SyncEventType;
  timestamp: string;
  data: unknown;
}

export interface TicketCompletedEvent extends SyncEvent {
  type: 'ticket_completed';
  data: {
    jiraKey: string;
    teamMemberId: string | null;
    xpAwarded: number;
  };
}

export interface XPAwardedEvent extends SyncEvent {
  type: 'xp_awarded';
  data: {
    teamMemberId: string;
    amount: number;
    source: string;
    newTotal: number;
  };
}

export interface MemberLevelUpEvent extends SyncEvent {
  type: 'level_up';
  data: LevelUpEvent;
}

// Input types for creating/updating
export interface CreateCampaignRegionInput {
  epicId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface UpdateWorldConfigInput {
  width?: number;
  height?: number;
  basecampX?: number;
  basecampY?: number;
}

export interface UpdateMemberPositionInput {
  x: number;
  y: number;
}

export interface UpdateJiraSyncConfigInput {
  syncIntervalMs?: number;
  syncEnabled?: boolean;
  baselineDate?: string | null;
}
