import type { AutomationActionType, CheckModuleType } from '@jira-planner/shared';
import type { StorageService } from '../storageService.js';

export interface CheckModule {
  name: CheckModuleType;
  enabled: boolean;
  run(context: CheckContext): Promise<ProposedAction[]>;
}

export interface CheckContext {
  storage: StorageService;
  runId: string;
}

export interface ProposedAction {
  type: AutomationActionType;
  checkModule: CheckModuleType;
  title: string;
  description: string;
  confidence: number;
  metadata: Record<string, any>;
}
