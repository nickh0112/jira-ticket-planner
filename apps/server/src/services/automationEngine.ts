import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { AutomationRun, AutomationAction } from '@jira-planner/shared';
import type { StorageService } from './storageService.js';
import type { CheckModule, ProposedAction } from './automation/types.js';

export interface AutomationEvent {
  type: string;
  timestamp: string;
  data: any;
}

interface AutomationEngineConfig {
  storage: StorageService;
}

export class AutomationEngine extends EventEmitter {
  private storage: StorageService;
  private checks: CheckModule[] = [];
  private checkTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: AutomationEngineConfig) {
    super();
    this.storage = config.storage;
  }

  registerCheck(check: CheckModule): void {
    this.checks.push(check);
    console.log(`[automation] Registered check module: ${check.name}`);
  }

  startEngine(): void {
    const config = this.storage.getAutomationConfig();
    if (!config.enabled) {
      console.log('[automation] Engine is disabled, not starting');
      return;
    }

    const intervalMs = config.checkIntervalMinutes * 60 * 1000;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    console.log(`[automation] Starting engine with interval ${config.checkIntervalMinutes}m`);

    this.checkTimer = setInterval(() => {
      this.runCycle();
    }, intervalMs);
  }

  stopEngine(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      console.log('[automation] Engine stopped');
    }
  }

  async runCycle(): Promise<AutomationRun> {
    if (this.isRunning) {
      console.log('[automation] Cycle already in progress, skipping');
      const existing = this.storage.getAutomationRuns(1);
      return existing[0];
    }

    this.isRunning = true;
    const runId = uuidv4();
    const config = this.storage.getAutomationConfig();
    const enabledChecks = this.checks.filter(c => c.enabled);

    const run = this.storage.createAutomationRun({
      id: runId,
      checksRun: enabledChecks.map(c => c.name),
    });

    this.emitEvent({
      type: 'cycle_started',
      timestamp: new Date().toISOString(),
      data: { runId, checks: enabledChecks.map(c => c.name) },
    });

    try {
      let totalActions = 0;
      let autoApproved = 0;

      for (const check of enabledChecks) {
        try {
          const proposed = await check.run({ storage: this.storage, runId });

          for (const action of proposed) {
            const savedAction = this.storage.createAutomationAction({
              id: uuidv4(),
              runId,
              type: action.type,
              checkModule: action.checkModule,
              title: action.title,
              description: action.description,
              confidence: action.confidence,
              metadata: action.metadata,
            });

            totalActions++;

            // Auto-approve if confidence meets threshold
            if (action.confidence >= config.autoApproveThreshold) {
              this.storage.updateAutomationActionStatus(savedAction.id, 'approved', 'auto');
              autoApproved++;

              this.emitEvent({
                type: 'action_auto_approved',
                timestamp: new Date().toISOString(),
                data: savedAction,
              });
            } else {
              this.emitEvent({
                type: 'action_proposed',
                timestamp: new Date().toISOString(),
                data: savedAction,
              });
            }
          }
        } catch (err) {
          console.error(`[automation] Check ${check.name} failed:`, err);
        }
      }

      const completedRun = this.storage.updateAutomationRun(runId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        actionsProposed: totalActions,
        actionsAutoApproved: autoApproved,
      });

      this.emitEvent({
        type: 'cycle_completed',
        timestamp: new Date().toISOString(),
        data: completedRun,
      });

      console.log(`[automation] Cycle completed: ${totalActions} actions proposed, ${autoApproved} auto-approved`);
      return completedRun;
    } catch (error) {
      const failedRun = this.storage.updateAutomationRun(runId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.emitEvent({
        type: 'cycle_failed',
        timestamp: new Date().toISOString(),
        data: { runId, error: failedRun.error },
      });

      console.error('[automation] Cycle failed:', error);
      return failedRun;
    } finally {
      this.isRunning = false;
    }
  }

  subscribe(callback: (event: AutomationEvent) => void): () => void {
    this.on('automationEvent', callback);
    return () => this.off('automationEvent', callback);
  }

  getStatus(): {
    isRunning: boolean;
    hasTimer: boolean;
    registeredChecks: string[];
    config: ReturnType<StorageService['getAutomationConfig']>;
  } {
    return {
      isRunning: this.isRunning,
      hasTimer: this.checkTimer !== null,
      registeredChecks: this.checks.map(c => c.name),
      config: this.storage.getAutomationConfig(),
    };
  }

  private emitEvent(event: AutomationEvent): void {
    this.emit('automationEvent', event);
  }
}

export const createAutomationEngine = (config: AutomationEngineConfig): AutomationEngine => {
  return new AutomationEngine(config);
};
