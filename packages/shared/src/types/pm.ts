// PM Operating System Types

// ============================================================================
// Micro-Progress Types (Command Center Redesign)
// ============================================================================

// Individual ticket micro-status for detailed progress tracking
export interface TicketMicroStatus {
  jiraKey: string;
  title: string;
  status: string;           // From Jira (In Progress, In Review, Done, etc.)
  priority: string;         // From Jira
  updated: string;          // Jira's updated timestamp
  hoursInStatus: number;    // Calculated from `updated`
  isStale: boolean;
  sprint?: { name: string } | null;
}

// Activity signal for tracking recent engineer activity
export interface ActivitySignal {
  type: 'status_change' | 'commit' | 'pr_activity' | 'assignment' | 'completion';
  timestamp: string;
  description: string;
  jiraKey?: string;
}

// Reasons why an engineer needs attention
export type AttentionReason =
  | 'no_active_work'
  | 'stale_ticket'
  | 'overloaded'
  | 'long_idle'
  | 'blocked';

// Engineer detail data for expanded card view
export interface EngineerDetailData {
  tickets: TicketMicroStatus[];
  recentActivity: ActivitySignal[];
  needsAttention: boolean;
  attentionReasons: AttentionReason[];
  ticketsByStatus: Record<string, number>;
}

// ============================================================================
// PM Assignment tracking
// ============================================================================

// PM Assignment tracking
export interface PMAssignment {
  id: string;
  ticketId: string | null;
  jiraKey: string | null;
  assigneeId: string;
  assignedBy: string;
  assignedAt: string;
  completedAt: string | null;
  timeToCompletionHours: number | null;
  createdAt: string;
}

export interface CreatePMAssignmentInput {
  ticketId?: string;
  jiraKey?: string;
  assigneeId: string;
  assignedBy?: string;
}

// Engineer Activity (daily summary)
export interface EngineerActivity {
  id: string;
  teamMemberId: string;
  activityDate: string;
  ticketsAssigned: number;
  ticketsCompleted: number;
  lastActivityAt: string | null;
}

// PM Alert types
export type PMAlertType = 'no_assignment' | 'no_activity';
export type PMAlertSeverity = 'warning' | 'critical';

export interface PMAlert {
  id: string;
  teamMemberId: string;
  alertType: PMAlertType;
  severity: PMAlertSeverity;
  message: string;
  isDismissed: boolean;
  createdAt: string;
}

export interface CreatePMAlertInput {
  teamMemberId: string;
  alertType: PMAlertType;
  severity: PMAlertSeverity;
  message: string;
}

// AI Ticket Suggestion
export type AISuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface AITicketSuggestion {
  id: string;
  teamMemberId: string;
  ticketId: string | null;
  jiraKey: string | null;
  title: string;
  reasoning: string;
  skillMatchScore: number;
  status: AISuggestionStatus;
  createdAt: string;
}

export interface CreateAISuggestionInput {
  teamMemberId: string;
  ticketId?: string;
  jiraKey?: string;
  title: string;
  reasoning: string;
  skillMatchScore: number;
}

// PM Configuration
export interface PMConfig {
  id: string;
  underutilizationDays: number;
  inactivityDays: number;
  checkIntervalHours: number;
  updatedAt: string;
}

export interface UpdatePMConfigInput {
  underutilizationDays?: number;
  inactivityDays?: number;
  checkIntervalHours?: number;
}

// Engineer Status for dashboard
export type EngineerStatusType = 'active' | 'idle' | 'underutilized' | 'inactive';

export interface EngineerStatus {
  memberId: string;
  memberName: string;
  memberRole: string;
  status: EngineerStatusType;
  currentTickets: number;
  daysSinceLastAssignment: number | null;
  daysSinceLastActivity: number | null;
  avgCompletionTimeHours: number | null;
  ticketsCompletedThisWeek: number;
  ticketsCompletedTotal: number;
  // Command Center extensions
  needsAttention: boolean;
  attentionReasons: AttentionReason[];
  lastActivityAt: string | null;
  ticketsByStatus: Record<string, number>;
}

// PM Dashboard data
export interface PMDashboardData {
  engineers: EngineerStatus[];
  activeAlerts: PMAlert[];
  metrics: PMMetrics;
  recentAssignments: PMAssignment[];
}

export interface PMMetrics {
  totalEngineers: number;
  activeEngineers: number;
  idleEngineers: number;
  avgTeamCompletionTime: number | null;
  ticketsCompletedToday: number;
  ticketsCompletedThisWeek: number;
  alertsCount: number;
}

// SSE Events for PM
export interface PMEvent {
  type: PMEventType;
  timestamp: string;
  data: unknown;
}

export type PMEventType =
  | 'pm_check_started'
  | 'pm_check_completed'
  | 'alert_created'
  | 'alert_dismissed'
  | 'suggestion_created'
  | 'assignment_recorded'
  | 'assignment_completed';

export interface PMCheckCompletedEvent extends PMEvent {
  type: 'pm_check_completed';
  data: {
    alertsCreated: number;
    suggestionsGenerated: number;
  };
}

export interface AlertCreatedEvent extends PMEvent {
  type: 'alert_created';
  data: PMAlert;
}

export interface SuggestionCreatedEvent extends PMEvent {
  type: 'suggestion_created';
  data: AITicketSuggestion;
}
