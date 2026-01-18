import type { Ticket } from './ticket.js';
import type { TeamMember } from './team.js';
import type { Epic } from './epic.js';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ParseTranscriptRequest {
  transcript: string;
}

export interface ParseTranscriptResponse {
  tickets: Ticket[];
}

export interface TicketListResponse {
  tickets: Ticket[];
  total: number;
}

export interface TicketListParams {
  status?: string;
  epicId?: string;
  assigneeId?: string;
}

export interface TeamListResponse {
  members: TeamMember[];
}

export interface EpicListResponse {
  epics: Epic[];
}

export interface StatusUpdateRequest {
  status: 'pending' | 'approved' | 'denied' | 'created';
}
