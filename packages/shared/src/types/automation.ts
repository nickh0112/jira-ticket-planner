// Automation Engine Types

export type AutomationActionType = 'pm_alert' | 'pm_suggestion' | 'stale_ticket' | 'accountability_flag' | 'sprint_gap_warning' | 'assign_ticket' | 'slack_insight';
export type AutomationActionStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
export type CheckModuleType = 'pm_check' | 'stale_ticket_check' | 'accountability_check' | 'sprint_health_check' | 'slack_check';

export interface AutomationConfig {
  id: string;
  enabled: boolean;
  checkIntervalMinutes: number;
  autoApproveThreshold: number;
  notifyOnNewActions: boolean;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  checksRun: string[];
  actionsProposed: number;
  actionsAutoApproved: number;
  status: 'running' | 'completed' | 'failed';
  error: string | null;
}

export interface AutomationAction {
  id: string;
  runId: string;
  type: AutomationActionType;
  checkModule: CheckModuleType;
  title: string;
  description: string;
  confidence: number;
  status: AutomationActionStatus;
  metadata: Record<string, any>;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface UpdateAutomationConfigInput {
  enabled?: boolean;
  checkIntervalMinutes?: number;
  autoApproveThreshold?: number;
  notifyOnNewActions?: boolean;
}
