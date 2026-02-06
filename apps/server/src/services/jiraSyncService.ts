import { EventEmitter } from 'events';
import type { JiraConfig, SyncEvent, TicketCompletedEvent, XPAwardedEvent, MemberLevelUpEvent } from '@jira-planner/shared';
import type { JiraService, JiraTicketForLearning } from './jiraService.js';
import type { StorageService } from './storageService.js';

// XP rewards for ticket completions
export const XP_REWARDS = {
  ticketCompleted: 75,
  ticketCompletedBonus: 25, // Fast completion bonus (future)
};

interface JiraSyncServiceConfig {
  storage: StorageService;
  jiraService: JiraService | null;
}

export class JiraSyncService extends EventEmitter {
  private storage: StorageService;
  private jiraService: JiraService | null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(config: JiraSyncServiceConfig) {
    super();
    this.storage = config.storage;
    this.jiraService = config.jiraService;
  }

  /**
   * Start automatic sync polling
   */
  startAutoSync(): void {
    const syncState = this.storage.getJiraSyncState();

    if (!syncState.syncEnabled) {
      console.log('[sync] Auto-sync is disabled');
      return;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    console.log(`[sync] Starting auto-sync with interval ${syncState.syncIntervalMs}ms`);

    // Run initial sync
    this.runSync();

    // Set up polling
    this.syncTimer = setInterval(() => {
      this.runSync();
    }, syncState.syncIntervalMs);
  }

  /**
   * Stop automatic sync polling
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[sync] Auto-sync stopped');
    }
  }

  /**
   * Update sync configuration and restart if needed
   */
  updateSyncConfig(updates: { syncEnabled?: boolean; syncIntervalMs?: number; baselineDate?: string | null }): void {
    this.storage.updateJiraSyncState(updates);

    // Restart auto-sync if enabled
    this.stopAutoSync();
    if (updates.syncEnabled !== false) {
      const syncState = this.storage.getJiraSyncState();
      if (syncState.syncEnabled) {
        this.startAutoSync();
      }
    }
  }

  /**
   * Run a single sync cycle
   */
  async runSync(): Promise<{ success: boolean; ticketsProcessed: number; xpAwarded: number; error?: string }> {
    if (this.isSyncing) {
      console.log('[sync] Sync already in progress, skipping');
      return { success: false, ticketsProcessed: 0, xpAwarded: 0, error: 'Sync already in progress' };
    }

    if (!this.jiraService) {
      console.log('[sync] Jira service not configured');
      return { success: false, ticketsProcessed: 0, xpAwarded: 0, error: 'Jira not configured' };
    }

    this.isSyncing = true;
    const now = new Date().toISOString();

    // Emit sync started event
    this.emitEvent({
      type: 'sync_started',
      timestamp: now,
      data: {},
    });

    // Update last sync time
    this.storage.updateJiraSyncState({ lastSyncAt: now });

    try {
      const jiraConfig = this.storage.getJiraConfig();
      if (!jiraConfig) {
        throw new Error('Jira configuration not found');
      }

      const syncState = this.storage.getJiraSyncState();
      const result = await this.processCompletedTickets(jiraConfig, syncState.baselineDate);

      // Update successful sync time
      this.storage.updateJiraSyncState({
        lastSuccessfulSyncAt: now,
        errorCount: 0,
        lastError: null,
      });

      // Emit sync completed event
      this.emitEvent({
        type: 'sync_completed',
        timestamp: new Date().toISOString(),
        data: result,
      });

      console.log(`[sync] Completed: ${result.ticketsProcessed} tickets, ${result.xpAwarded} XP`);
      return { success: true, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const syncState = this.storage.getJiraSyncState();

      // Update error state
      this.storage.updateJiraSyncState({
        errorCount: syncState.errorCount + 1,
        lastError: errorMessage,
      });

      // Emit sync error event
      this.emitEvent({
        type: 'sync_error',
        timestamp: new Date().toISOString(),
        data: { error: errorMessage },
      });

      console.error('[sync] Error:', errorMessage);
      return { success: false, ticketsProcessed: 0, xpAwarded: 0, error: errorMessage };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process completed tickets from Jira
   */
  private async processCompletedTickets(
    jiraConfig: JiraConfig,
    baselineDate: string | null
  ): Promise<{ ticketsProcessed: number; xpAwarded: number }> {
    // Build JQL for completed tickets
    const jqlParts = [
      `project = ${jiraConfig.projectKey}`,
      `issuetype != Epic`,
      `status IN (Done, Closed, Resolved)`,
    ];

    // Only process tickets completed after baseline date
    if (baselineDate) {
      jqlParts.push(`resolved >= "${baselineDate}"`);
    }

    // Add team filter if configured
    if (jiraConfig.teamValue) {
      jqlParts.push(`cf[10104] = "${jiraConfig.teamValue}"`);
    }

    const jql = jqlParts.join(' AND ') + ' ORDER BY resolved DESC';
    console.log(`[sync] Fetching completed tickets: ${jql}`);

    const tickets = await this.jiraService!.getRecentTickets(jiraConfig, { jql });

    let ticketsProcessed = 0;
    let totalXpAwarded = 0;

    // Get team members for matching
    const teamMembers = this.storage.getTeamMembers();
    const memberByJiraUsername = new Map(
      teamMembers
        .filter(m => m.jiraUsername)
        .map(m => [m.jiraUsername!.toLowerCase(), m])
    );

    for (const ticket of tickets) {
      // Check if already processed
      const existing = this.storage.getTicketCompletion(ticket.key);
      if (existing) {
        continue; // Already awarded XP
      }

      // Find team member by assignee
      let teamMemberId: string | null = null;
      if (ticket.assignee) {
        // Try to match by display name or account ID
        const member = teamMembers.find(m => {
          if (!m.jiraUsername) return false;
          const jiraUsername = m.jiraUsername.toLowerCase();
          return jiraUsername === ticket.assignee!.displayName.toLowerCase() ||
                 jiraUsername === ticket.assignee!.accountId.toLowerCase();
        });
        teamMemberId = member?.id || null;
      }

      // Record completion and award XP
      const xpAmount = XP_REWARDS.ticketCompleted;
      const completion = this.storage.recordTicketCompletion(
        ticket.key,
        teamMemberId,
        xpAmount,
        'jira_sync'
      );

      if (completion) {
        ticketsProcessed++;
        totalXpAwarded += xpAmount;

        // Emit ticket completed event
        this.emitEvent({
          type: 'ticket_completed',
          timestamp: new Date().toISOString(),
          data: {
            jiraKey: ticket.key,
            teamMemberId,
            xpAwarded: xpAmount,
          },
        } as TicketCompletedEvent);

        // If we have a team member, emit XP awarded event
        if (teamMemberId) {
          const progress = this.storage.getMemberProgress(teamMemberId);
          if (progress) {
            this.emitEvent({
              type: 'xp_awarded',
              timestamp: new Date().toISOString(),
              data: {
                teamMemberId,
                amount: xpAmount,
                source: `Completed ${ticket.key}`,
                newTotal: progress.xp,
              },
            } as XPAwardedEvent);

            // Check for level up events
            const levelUpEvents = this.storage.getUnacknowledgedLevelUpEvents();
            for (const event of levelUpEvents) {
              if (event.entityId === teamMemberId) {
                this.emitEvent({
                  type: 'level_up',
                  timestamp: new Date().toISOString(),
                  data: event,
                } as MemberLevelUpEvent);
              }
            }
          }
        }
      }
    }

    return { ticketsProcessed, xpAwarded: totalXpAwarded };
  }

  /**
   * Emit an event to all listeners (for SSE)
   */
  private emitEvent(event: SyncEvent): void {
    this.emit('syncEvent', event);
  }

  /**
   * Subscribe to sync events (for SSE endpoint)
   */
  subscribe(callback: (event: SyncEvent) => void): () => void {
    this.on('syncEvent', callback);
    return () => this.off('syncEvent', callback);
  }

  /**
   * Get current sync status
   */
  getStatus(): {
    isRunning: boolean;
    syncState: ReturnType<StorageService['getJiraSyncState']>;
    hasTimer: boolean;
  } {
    return {
      isRunning: this.isSyncing,
      syncState: this.storage.getJiraSyncState(),
      hasTimer: this.syncTimer !== null,
    };
  }

  /**
   * Sync active (non-completed) tickets from Jira into local database
   * This populates the tickets table so PM Dashboard can show current assignments
   */
  async syncActiveTickets(): Promise<{ synced: number; errors: string[] }> {
    if (!this.jiraService) {
      return { synced: 0, errors: ['Jira service not configured'] };
    }

    const config = this.storage.getJiraConfig();
    if (!config) {
      return { synced: 0, errors: ['No Jira config'] };
    }

    const teamMembers = this.storage.getTeamMembers();
    const errors: string[] = [];
    let synced = 0;

    try {
      // Get active tickets from Jira (not done/closed)
      const activeTickets = await this.jiraService.getActiveTickets(config);

      for (const ticket of activeTickets) {
        try {
          // Find matching team member by jira_account_id, falling back to jiraUsername
          let assigneeId: string | null = null;
          if (ticket.assignee) {
            // First try exact accountId match
            let member = teamMembers.find(m =>
              m.jiraAccountId === ticket.assignee?.accountId
            );

            // Fall back to jiraUsername match (case-insensitive)
            if (!member) {
              member = teamMembers.find(m => {
                if (!m.jiraUsername) return false;
                const jiraUsername = m.jiraUsername.toLowerCase();
                return jiraUsername === ticket.assignee!.displayName.toLowerCase() ||
                       jiraUsername === ticket.assignee!.accountId.toLowerCase();
              });
            }

            // Third fallback: match by member name against displayName
            if (!member) {
              member = teamMembers.find(m =>
                m.name.toLowerCase() === ticket.assignee!.displayName.toLowerCase()
              );
              // Auto-populate jiraAccountId for future matches
              if (member && ticket.assignee?.accountId) {
                this.storage.updateTeamMember(member.id, {
                  jiraAccountId: ticket.assignee.accountId,
                });
                // Update local cache too
                member = { ...member, jiraAccountId: ticket.assignee.accountId };
              }
            }

            assigneeId = member?.id || null;

            if (!assigneeId && ticket.assignee) {
              console.log(`[sync] No team member match for Jira assignee: ${ticket.assignee.displayName} (${ticket.assignee.accountId})`);
            }
          }

          // Normalize priority to match database constraint (lowercase)
          const validPriorities = ['highest', 'high', 'medium', 'low', 'lowest'] as const;
          const normalizedPriority = validPriorities.includes(ticket.priority.toLowerCase() as any)
            ? (ticket.priority.toLowerCase() as typeof validPriorities[number])
            : 'medium';

          // Upsert ticket into local database
          this.storage.upsertJiraTicket({
            jiraKey: ticket.key,
            title: ticket.summary,
            description: ticket.description || '',
            assigneeId,
            status: ticket.status,
            priority: normalizedPriority,
          });
          synced++;
        } catch (e) {
          errors.push(`Failed to sync ${ticket.key}: ${e}`);
        }
      }

      console.log(`[sync] Synced ${synced} active tickets from Jira`);
      return { synced, errors };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      errors.push(`Failed to fetch active tickets: ${errorMessage}`);
      return { synced, errors };
    }
  }
}

export const createJiraSyncService = (config: JiraSyncServiceConfig): JiraSyncService => {
  return new JiraSyncService(config);
};
