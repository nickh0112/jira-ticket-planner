import { EventEmitter } from 'events';
import type { PMEvent, PMAlert, AITicketSuggestion } from '@jira-planner/shared';
import type { StorageService } from './storageService.js';
import type { PMService } from './pmService.js';
import type { JiraSyncService } from './jiraSyncService.js';

interface PMBackgroundServiceConfig {
  storage: StorageService;
  pmService: PMService;
  jiraSyncService: JiraSyncService;
}

export class PMBackgroundService extends EventEmitter {
  private storage: StorageService;
  private pmService: PMService;
  private jiraSyncService: JiraSyncService;
  private checkTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: PMBackgroundServiceConfig) {
    super();
    this.storage = config.storage;
    this.pmService = config.pmService;
    this.jiraSyncService = config.jiraSyncService;
  }

  /**
   * Start periodic checks
   */
  startPeriodicChecks(): void {
    const config = this.storage.getPMConfig();
    const intervalMs = config.checkIntervalHours * 60 * 60 * 1000;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    console.log(`[pm] Starting PM checks with interval ${config.checkIntervalHours}h`);

    // Run initial check
    this.runChecks();

    // Set up periodic checks
    this.checkTimer = setInterval(() => {
      this.runChecks();
    }, intervalMs);
  }

  /**
   * Stop periodic checks
   */
  stopPeriodicChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      console.log('[pm] PM checks stopped');
    }
  }

  /**
   * Update check interval and restart
   */
  updateCheckInterval(hours: number): void {
    this.storage.updatePMConfig({ checkIntervalHours: hours });
    this.stopPeriodicChecks();
    this.startPeriodicChecks();
  }

  /**
   * Run a single check cycle
   */
  async runChecks(): Promise<{ alertsCreated: number; suggestionsGenerated: number }> {
    if (this.isRunning) {
      console.log('[pm] Check already in progress, skipping');
      return { alertsCreated: 0, suggestionsGenerated: 0 };
    }

    this.isRunning = true;
    const now = new Date().toISOString();

    console.log('[pm] Running PM checks...');

    // Sync active tickets from Jira first
    await this.jiraSyncService.syncActiveTickets();

    // Emit check started event
    this.emitEvent({
      type: 'pm_check_started',
      timestamp: now,
      data: {},
    });

    try {
      // 1. Create alerts for problematic engineers
      const newAlerts = this.pmService.createAlertsForProblematicEngineers();

      // Emit alert events
      for (const alert of newAlerts) {
        this.emitEvent({
          type: 'alert_created',
          timestamp: new Date().toISOString(),
          data: alert,
        });
      }

      // 2. Generate suggestions for underutilized engineers
      const underutilized = this.pmService.detectUnderutilizedEngineers();
      let totalSuggestions = 0;

      for (const engineer of underutilized) {
        const suggestions = await this.pmService.generateSuggestions(engineer.memberId);
        totalSuggestions += suggestions.length;

        // Emit suggestion events
        for (const suggestion of suggestions) {
          this.emitEvent({
            type: 'suggestion_created',
            timestamp: new Date().toISOString(),
            data: suggestion,
          });
        }
      }

      const result = {
        alertsCreated: newAlerts.length,
        suggestionsGenerated: totalSuggestions,
      };

      // Emit check completed event
      this.emitEvent({
        type: 'pm_check_completed',
        timestamp: new Date().toISOString(),
        data: result,
      });

      console.log(`[pm] Check completed: ${result.alertsCreated} alerts, ${result.suggestionsGenerated} suggestions`);
      return result;
    } catch (error) {
      console.error('[pm] Check failed:', error);
      return { alertsCreated: 0, suggestionsGenerated: 0 };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Emit an event to all listeners (for SSE)
   */
  private emitEvent(event: PMEvent): void {
    this.emit('pmEvent', event);
  }

  /**
   * Subscribe to PM events (for SSE endpoint)
   */
  subscribe(callback: (event: PMEvent) => void): () => void {
    this.on('pmEvent', callback);
    return () => this.off('pmEvent', callback);
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    hasTimer: boolean;
    config: ReturnType<StorageService['getPMConfig']>;
  } {
    return {
      isRunning: this.isRunning,
      hasTimer: this.checkTimer !== null,
      config: this.storage.getPMConfig(),
    };
  }
}

export const createPMBackgroundService = (config: PMBackgroundServiceConfig): PMBackgroundService => {
  return new PMBackgroundService(config);
};
