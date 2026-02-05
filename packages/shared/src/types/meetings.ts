// Meeting Notes Processor Types

export type MeetingType = 'standup' | 'sprint_planning' | 'retro' | 'one_on_one' | 'leadership' | 'technical' | 'other';
export type MeetingActionItemStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type MeetingObjectiveStatus = 'active' | 'completed' | 'cancelled';

export interface Meeting {
  id: string;
  title: string;
  meetingType: MeetingType;
  rawInput: string;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingObjective {
  id: string;
  meetingId: string;
  objective: string;
  ownerId: string | null;
  dueDate: string | null;
  status: MeetingObjectiveStatus;
  createdAt: string;
}

export interface MeetingDecision {
  id: string;
  meetingId: string;
  decision: string;
  context: string | null;
  createdAt: string;
}

export interface MeetingActionItem {
  id: string;
  meetingId: string;
  action: string;
  assigneeId: string | null;
  dueDate: string | null;
  status: MeetingActionItemStatus;
  jiraTicketId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessMeetingNotesInput {
  title: string;
  type: MeetingType;
  rawInput: string;
}

export type CreateMeetingInput = ProcessMeetingNotesInput;

export type ActionItemStatus = MeetingActionItemStatus;

export interface MeetingSuggestedTicket {
  title: string;
  description: string;
  ticketType: string;
  priority: string;
  assigneeId?: string;
}

export interface UpdateMeetingActionItemInput {
  status?: MeetingActionItemStatus;
  assigneeId?: string;
  dueDate?: string;
  jiraTicketId?: string;
}

export interface MeetingProcessResult {
  meeting: Meeting;
  summary: string;
  objectives: MeetingObjective[];
  decisions: MeetingDecision[];
  actionItems: MeetingActionItem[];
  ticketSuggestions: {
    title: string;
    description: string;
    ticketType: string;
    priority: string;
    assigneeId?: string;
  }[];
}

export interface MeetingFull {
  meeting: Meeting;
  objectives: MeetingObjective[];
  decisions: MeetingDecision[];
  actionItems: MeetingActionItem[];
}
