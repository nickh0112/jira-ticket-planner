import type {
  EngineerStatus,
  EngineerStatusType,
  PMDashboardData,
  PMMetrics,
  PMAlert,
  AITicketSuggestion,
  PMAssignment,
  CreatePMAssignmentInput,
  CreateAISuggestionInput,
  TeamMember,
  Ticket,
  EngineerDetailData,
  TicketMicroStatus,
  ActivitySignal,
  AttentionReason,
} from '@jira-planner/shared';
import type { StorageService } from './storageService.js';
import type { AgentService } from './agentService.js';
import type { JiraService } from './jiraService.js';

interface PMServiceConfig {
  storage: StorageService;
  agentService?: AgentService | null;
  jiraService?: JiraService | null;
}

export class PMService {
  private storage: StorageService;
  private agentService: AgentService | null;
  private jiraService: JiraService | null;

  constructor(config: PMServiceConfig) {
    this.storage = config.storage;
    this.agentService = config.agentService ?? null;
    this.jiraService = config.jiraService ?? null;
  }

  /**
   * Get status for a single engineer
   */
  getEngineerStatus(memberId: string): EngineerStatus | null {
    const member = this.storage.getTeamMember(memberId);
    if (!member) return null;

    const config = this.storage.getPMConfig();
    const now = new Date();

    // Get last assignment
    const lastAssignment = this.storage.getLastAssignmentForMember(memberId);
    const daysSinceLastAssignment = lastAssignment
      ? this.daysBetween(new Date(lastAssignment.assignedAt), now)
      : null;

    // Get last activity
    const lastActivity = this.storage.getLastActivityForMember(memberId);
    const daysSinceLastActivity = lastActivity?.lastActivityAt
      ? this.daysBetween(new Date(lastActivity.lastActivityAt), now)
      : null;

    // Get current tickets - combine PM assignments AND Jira-synced tickets
    const activeAssignments = this.storage.getActiveAssignmentsForMember(memberId);
    const activeJiraTickets = this.storage.getActiveJiraTicketsForMember(memberId);

    // Deduplicate: if a ticket appears in both sources, count once
    const pmJiraKeys = new Set(activeAssignments.map(a => a.jiraKey).filter(Boolean));
    const additionalJiraTickets = activeJiraTickets.filter(t =>
      t.jiraKey && !pmJiraKeys.has(t.jiraKey)
    );
    const currentTickets = activeAssignments.length + additionalJiraTickets.length;

    // Get completion stats
    const avgCompletionTime = this.storage.getAvgCompletionTimeForMember(memberId);
    const completions = this.storage.getTicketCompletions(memberId);

    // Calculate weekly completions
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ticketsCompletedThisWeek = completions.filter(
      c => new Date(c.completedAt) >= oneWeekAgo
    ).length;

    // Determine status
    const status = this.determineEngineerStatus(
      daysSinceLastAssignment,
      daysSinceLastActivity,
      currentTickets,
      config.underutilizationDays,
      config.inactivityDays
    );

    // Calculate attention reasons
    const attentionReasons = this.calculateAttentionReasons(
      status,
      currentTickets,
      daysSinceLastAssignment,
      daysSinceLastActivity,
      config
    );

    // Get tickets by status
    const ticketsByStatus = this.getTicketsByStatus(memberId);

    // Get last activity timestamp
    const lastActivityAt = lastActivity?.lastActivityAt ?? null;

    return {
      memberId,
      memberName: member.name,
      memberRole: member.role,
      status,
      currentTickets,
      daysSinceLastAssignment,
      daysSinceLastActivity,
      avgCompletionTimeHours: avgCompletionTime,
      ticketsCompletedThisWeek,
      ticketsCompletedTotal: completions.length,
      needsAttention: attentionReasons.length > 0,
      attentionReasons,
      lastActivityAt,
      ticketsByStatus,
    };
  }

  /**
   * Get status for all engineers
   */
  getAllEngineersStatus(): EngineerStatus[] {
    const members = this.storage.getTeamMembers();
    return members
      .filter(m => m.memberType === 'human')
      .map(m => this.getEngineerStatus(m.id)!)
      .filter(Boolean);
  }

  /**
   * Detect engineers who are underutilized (no assignment in X days)
   */
  detectUnderutilizedEngineers(): EngineerStatus[] {
    const statuses = this.getAllEngineersStatus();
    return statuses.filter(s => s.status === 'underutilized');
  }

  /**
   * Detect engineers who are inactive (no activity in X days)
   */
  detectInactiveEngineers(): EngineerStatus[] {
    const statuses = this.getAllEngineersStatus();
    return statuses.filter(s => s.status === 'inactive');
  }

  /**
   * Record a new assignment (when PM assigns a ticket)
   */
  recordAssignment(input: CreatePMAssignmentInput): PMAssignment {
    const assignment = this.storage.createPMAssignment(input);

    // Record activity
    this.storage.recordEngineerActivity(input.assigneeId, { ticketsAssigned: 1 });

    // Dismiss any underutilization alerts for this member
    this.storage.dismissAlertsForMember(input.assigneeId);

    // Clear pending suggestions since they now have work
    this.storage.clearPendingSuggestionsForMember(input.assigneeId);

    return assignment;
  }

  /**
   * Record assignment completion
   */
  recordCompletion(assignmentId: string): PMAssignment | null {
    const assignment = this.storage.completePMAssignment(assignmentId);

    if (assignment) {
      // Record activity
      this.storage.recordEngineerActivity(assignment.assigneeId, { ticketsCompleted: 1 });
    }

    return assignment;
  }

  /**
   * Generate AI suggestions for an underutilized engineer
   */
  async generateSuggestions(memberId: string): Promise<AITicketSuggestion[]> {
    const member = this.storage.getTeamMember(memberId);
    if (!member) return [];

    // Clear existing pending suggestions
    this.storage.clearPendingSuggestionsForMember(memberId);

    // Get unassigned tickets from Jira (not internal workflow status)
    const unassignedJiraTickets = this.storage.getUnassignedJiraTickets();

    // Also include locally-created approved tickets
    const approvedLocalTickets = this.storage.getTickets({ status: 'approved' })
      .filter(t => !t.assigneeId && !t.jiraKey);

    const unassignedTickets = [...unassignedJiraTickets, ...approvedLocalTickets];

    if (unassignedTickets.length === 0) {
      return [];
    }

    // Score tickets based on skill match
    const suggestions: CreateAISuggestionInput[] = [];

    for (const ticket of unassignedTickets.slice(0, 10)) {
      const skillMatchScore = this.calculateSkillMatch(member, ticket);

      if (skillMatchScore > 0.3) {
        const reasoning = this.generateSuggestionReasoning(member, ticket, skillMatchScore);

        suggestions.push({
          teamMemberId: memberId,
          ticketId: ticket.id,
          jiraKey: ticket.jiraKey ?? undefined,
          title: ticket.title,
          reasoning,
          skillMatchScore,
        });
      }
    }

    // Sort by skill match and take top 5
    suggestions.sort((a, b) => b.skillMatchScore - a.skillMatchScore);
    const topSuggestions = suggestions.slice(0, 5);

    // Save suggestions
    return topSuggestions.map(s => this.storage.createAISuggestion(s));
  }

  /**
   * Approve a suggestion and create assignment
   */
  async approveSuggestion(suggestionId: string): Promise<{ suggestion: AITicketSuggestion; assignment: PMAssignment } | null> {
    const suggestion = this.storage.getAISuggestion(suggestionId);
    if (!suggestion || suggestion.status !== 'pending') return null;

    // Update suggestion status
    const updatedSuggestion = this.storage.updateAISuggestionStatus(suggestionId, 'approved');
    if (!updatedSuggestion) return null;

    // Create assignment
    const assignment = this.recordAssignment({
      ticketId: suggestion.ticketId ?? undefined,
      jiraKey: suggestion.jiraKey ?? undefined,
      assigneeId: suggestion.teamMemberId,
      assignedBy: 'ai_suggestion',
    });

    // Update ticket assignee if we have a ticketId
    if (suggestion.ticketId) {
      this.storage.updateTicket(suggestion.ticketId, {
        assigneeId: suggestion.teamMemberId,
      });
    }

    // Best-effort: assign in Jira if possible
    if (this.jiraService) {
      const jiraConfig = this.storage.getJiraConfig();
      const ticket = suggestion.ticketId ? this.storage.getTicket(suggestion.ticketId) : null;
      const member = this.storage.getTeamMember(suggestion.teamMemberId);

      if (jiraConfig && ticket?.jiraKey && member?.jiraAccountId) {
        try {
          await this.jiraService.assignIssue(jiraConfig, ticket.jiraKey, member.jiraAccountId);
          console.log(`[pm] Assigned ${ticket.jiraKey} to ${member.name} in Jira`);
        } catch (error) {
          console.error(`[pm] Failed to assign ${ticket.jiraKey} in Jira:`, error);
          // Don't fail the local operation
        }
      }
    }

    return { suggestion: updatedSuggestion, assignment };
  }

  /**
   * Reject a suggestion
   */
  rejectSuggestion(suggestionId: string): AITicketSuggestion | null {
    return this.storage.updateAISuggestionStatus(suggestionId, 'rejected');
  }

  /**
   * Get detailed data for a specific engineer (for expanded card view)
   * Uses Jira data directly for accurate ticket status and timestamps
   */
  async getEngineerDetailData(memberId: string): Promise<EngineerDetailData | null> {
    const member = this.storage.getTeamMember(memberId);
    if (!member) return null;

    const config = this.storage.getPMConfig();
    const jiraConfig = this.storage.getJiraConfig();
    const staleThresholdHours = config.underutilizationDays * 24;

    // Try to fetch real Jira tickets if jiraService and jiraAccountId are available
    let tickets: TicketMicroStatus[] = [];

    if (this.jiraService && jiraConfig && member.jiraAccountId) {
      try {
        const jiraTickets = await this.jiraService.getTicketsForMember(
          jiraConfig,
          member.jiraAccountId,
          { maxResults: 50 }
        );

        // Filter to only active tickets (not Done/Closed/Resolved)
        const activeJiraTickets = jiraTickets.filter(t => {
          const status = t.status.toLowerCase();
          return !status.includes('done') && !status.includes('closed') && !status.includes('resolved');
        });

        tickets = activeJiraTickets.map(t => {
          const hoursInStatus = this.hoursSince(new Date(t.updated));
          return {
            jiraKey: t.key,
            title: t.summary,
            status: t.status,
            priority: t.priority,
            updated: t.updated,
            hoursInStatus,
            isStale: hoursInStatus > staleThresholdHours && !t.status.toLowerCase().includes('released'),
            sprint: t.sprint ? { name: t.sprint.name } : null,
          };
        });
      } catch (error) {
        console.error(`Failed to fetch Jira tickets for member ${memberId}:`, error);
        // Fall back to local data on error
        tickets = this.getTicketsFromLocalData(memberId, staleThresholdHours);
      }
    } else {
      // Fall back to local data if jiraService not available
      tickets = this.getTicketsFromLocalData(memberId, staleThresholdHours);
    }

    // Build activity signals
    const recentActivity: ActivitySignal[] = [];

    // Add assignment events
    const recentAssignments = this.storage.getPMAssignments({ assigneeId: memberId })
      .slice(0, 10);
    for (const a of recentAssignments) {
      if (a.completedAt) {
        recentActivity.push({
          type: 'completion',
          timestamp: a.completedAt,
          description: `Completed ticket`,
          jiraKey: a.jiraKey || undefined,
        });
      }
      recentActivity.push({
        type: 'assignment',
        timestamp: a.assignedAt,
        description: `Assigned ticket`,
        jiraKey: a.jiraKey || undefined,
      });
    }

    // Sort by timestamp descending
    recentActivity.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Calculate attention reasons
    const status = this.getEngineerStatus(memberId);
    const ticketsByStatus = this.getTicketsByStatusFromTickets(tickets);

    return {
      tickets,
      recentActivity: recentActivity.slice(0, 20),
      needsAttention: status?.needsAttention || false,
      attentionReasons: status?.attentionReasons || [],
      ticketsByStatus,
    };
  }

  /**
   * Fallback: Get tickets from local storage data
   */
  private getTicketsFromLocalData(memberId: string, staleThresholdHours: number): TicketMicroStatus[] {
    const activeAssignments = this.storage.getActiveAssignmentsForMember(memberId);
    const activeJiraTickets = this.storage.getActiveJiraTicketsForMember(memberId);

    // Combine and deduplicate tickets
    const pmJiraKeys = new Set(activeAssignments.map(a => a.jiraKey).filter(Boolean));
    const allTickets = [
      ...activeAssignments.map(a => ({
        jiraKey: a.jiraKey || a.ticketId || 'N/A',
        ticketId: a.ticketId,
        assignedAt: a.assignedAt,
      })),
      ...activeJiraTickets
        .filter(t => t.jiraKey && !pmJiraKeys.has(t.jiraKey))
        .map(t => ({
          jiraKey: t.jiraKey!,
          ticketId: t.id,
          assignedAt: t.updatedAt || t.createdAt,
        })),
    ];

    return allTickets.map(t => {
      const ticket = t.ticketId ? this.storage.getTicket(t.ticketId) : null;
      const hoursInStatus = this.hoursSince(new Date(t.assignedAt));

      return {
        jiraKey: t.jiraKey,
        title: ticket?.title || 'Unknown ticket',
        status: ticket?.status || 'In Progress',
        priority: ticket?.priority || 'Medium',
        updated: t.assignedAt,
        hoursInStatus,
        isStale: hoursInStatus > staleThresholdHours && !(ticket?.status || '').toLowerCase().includes('released'),
        sprint: null,
      };
    });
  }

  /**
   * Calculate tickets by status from the ticket list
   */
  private getTicketsByStatusFromTickets(tickets: TicketMicroStatus[]): Record<string, number> {
    const statusCounts: Record<string, number> = {};
    for (const ticket of tickets) {
      statusCounts[ticket.status] = (statusCounts[ticket.status] || 0) + 1;
    }
    return statusCounts;
  }

  /**
   * Get full dashboard data
   */
  getDashboardData(): PMDashboardData {
    const engineers = this.getAllEngineersStatus();
    const activeAlerts = this.storage.getActivePMAlerts();
    const recentAssignments = this.storage.getPMAssignments().slice(0, 20);

    const metrics = this.calculateMetrics(engineers);

    return {
      engineers,
      activeAlerts,
      metrics,
      recentAssignments,
    };
  }

  /**
   * Create alerts for underutilized/inactive engineers
   */
  createAlertsForProblematicEngineers(): PMAlert[] {
    const config = this.storage.getPMConfig();
    const engineers = this.getAllEngineersStatus();
    const newAlerts: PMAlert[] = [];

    for (const engineer of engineers) {
      // Check for no assignment alert
      if (engineer.daysSinceLastAssignment === null ||
          engineer.daysSinceLastAssignment >= config.underutilizationDays) {
        // Only create if no existing active alert of this type
        if (!this.storage.hasActiveAlertForMember(engineer.memberId, 'no_assignment')) {
          const severity = engineer.daysSinceLastAssignment !== null &&
            engineer.daysSinceLastAssignment >= config.underutilizationDays * 2
            ? 'critical'
            : 'warning';

          const message = engineer.daysSinceLastAssignment === null
            ? `${engineer.memberName} has never been assigned a ticket`
            : `${engineer.memberName} has not been assigned a ticket in ${engineer.daysSinceLastAssignment} days`;

          const alert = this.storage.createPMAlert({
            teamMemberId: engineer.memberId,
            alertType: 'no_assignment',
            severity,
            message,
          });
          newAlerts.push(alert);
        }
      }

      // Check for no activity alert
      if (engineer.daysSinceLastActivity === null ||
          engineer.daysSinceLastActivity >= config.inactivityDays) {
        // Only create if no existing active alert of this type
        if (!this.storage.hasActiveAlertForMember(engineer.memberId, 'no_activity')) {
          const severity = engineer.daysSinceLastActivity !== null &&
            engineer.daysSinceLastActivity >= config.inactivityDays * 2
            ? 'critical'
            : 'warning';

          const message = engineer.daysSinceLastActivity === null
            ? `${engineer.memberName} has no recorded activity`
            : `${engineer.memberName} has had no activity in ${engineer.daysSinceLastActivity} days`;

          const alert = this.storage.createPMAlert({
            teamMemberId: engineer.memberId,
            alertType: 'no_activity',
            severity,
            message,
          });
          newAlerts.push(alert);
        }
      }
    }

    return newAlerts;
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  private determineEngineerStatus(
    daysSinceLastAssignment: number | null,
    daysSinceLastActivity: number | null,
    currentTickets: number,
    underutilizationThreshold: number,
    inactivityThreshold: number
  ): EngineerStatusType {
    // Inactive: no activity for X days, or never had activity
    if (daysSinceLastActivity !== null && daysSinceLastActivity >= inactivityThreshold) {
      return 'inactive';
    }

    // Underutilized: no assignment for X days, or never assigned
    if (currentTickets === 0) {
      if (daysSinceLastAssignment === null || daysSinceLastAssignment >= underutilizationThreshold) {
        return 'underutilized';
      }
    }

    // Idle: no current work but was recently assigned
    if (currentTickets === 0) {
      return 'idle';
    }

    // Active: has current work
    return 'active';
  }

  private daysBetween(date1: Date, date2: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
  }

  private calculateSkillMatch(member: TeamMember, ticket: Ticket): number {
    const memberSkills = new Set(member.skills.map(s => s.toLowerCase()));
    const ticketSkills = ticket.requiredSkills ?? [];

    if (ticketSkills.length === 0) {
      // No specific skills required, give a base score
      return 0.5;
    }

    // Calculate overlap
    const matchingSkills = ticketSkills.filter(s =>
      memberSkills.has(s.toLowerCase())
    );

    return matchingSkills.length / ticketSkills.length;
  }

  private generateSuggestionReasoning(member: TeamMember, ticket: Ticket, score: number): string {
    const memberSkills = new Set(member.skills.map(s => s.toLowerCase()));
    const ticketSkills = ticket.requiredSkills ?? [];
    const matchingSkills = ticketSkills.filter(s => memberSkills.has(s.toLowerCase()));

    if (matchingSkills.length > 0) {
      return `${member.name} has skills in ${matchingSkills.join(', ')} which match this ticket's requirements. Skill match: ${Math.round(score * 100)}%.`;
    }

    return `This ticket type (${ticket.ticketType}) may be suitable for ${member.name}'s role as ${member.role}. Score: ${Math.round(score * 100)}%.`;
  }

  private calculateMetrics(engineers: EngineerStatus[]): PMMetrics {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count by status
    const activeEngineers = engineers.filter(e => e.status === 'active').length;
    const idleEngineers = engineers.filter(e =>
      e.status === 'idle' || e.status === 'underutilized' || e.status === 'inactive'
    ).length;

    // Calculate average completion time across all engineers
    const completionTimes = engineers
      .map(e => e.avgCompletionTimeHours)
      .filter((t): t is number => t !== null);
    const avgTeamCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : null;

    // Get all completions
    const allCompletions = this.storage.getTicketCompletions();
    const todayCompletions = allCompletions.filter(
      c => c.completedAt.split('T')[0] === today
    );
    const weekCompletions = allCompletions.filter(
      c => new Date(c.completedAt) >= oneWeekAgo
    );

    // Get alerts count
    const activeAlerts = this.storage.getActivePMAlerts();

    return {
      totalEngineers: engineers.length,
      activeEngineers,
      idleEngineers,
      avgTeamCompletionTime,
      ticketsCompletedToday: todayCompletions.length,
      ticketsCompletedThisWeek: weekCompletions.length,
      alertsCount: activeAlerts.length,
    };
  }

  private calculateAttentionReasons(
    status: EngineerStatusType,
    currentTickets: number,
    daysSinceLastAssignment: number | null,
    daysSinceLastActivity: number | null,
    config: { underutilizationDays: number; inactivityDays: number }
  ): AttentionReason[] {
    const reasons: AttentionReason[] = [];

    // No active work
    if (currentTickets === 0) {
      reasons.push('no_active_work');
    }

    // Long idle (no activity, or never had activity)
    if (daysSinceLastActivity === null || daysSinceLastActivity >= config.inactivityDays) {
      reasons.push('long_idle');
    }

    // Stale ticket (underutilized, or never assigned)
    if (daysSinceLastAssignment === null || daysSinceLastAssignment >= config.underutilizationDays) {
      reasons.push('stale_ticket');
    }

    // Overloaded (too many tickets - threshold: 5+)
    if (currentTickets >= 5) {
      reasons.push('overloaded');
    }

    return reasons;
  }

  private getTicketsByStatus(memberId: string): Record<string, number> {
    const activeAssignments = this.storage.getActiveAssignmentsForMember(memberId);
    const activeJiraTickets = this.storage.getActiveJiraTicketsForMember(memberId);

    const statusCounts: Record<string, number> = {};

    // Count from assignments
    for (const a of activeAssignments) {
      if (a.ticketId) {
        const ticket = this.storage.getTicket(a.ticketId);
        const status = ticket?.status || 'In Progress';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      } else {
        statusCounts['In Progress'] = (statusCounts['In Progress'] || 0) + 1;
      }
    }

    // Add Jira tickets not in assignments
    const pmJiraKeys = new Set(activeAssignments.map(a => a.jiraKey).filter(Boolean));
    for (const t of activeJiraTickets) {
      if (t.jiraKey && !pmJiraKeys.has(t.jiraKey)) {
        const status = t.status || 'In Progress';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
    }

    return statusCounts;
  }

  private hoursSince(date: Date): number {
    const now = new Date();
    return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  }
}

export const createPMService = (config: PMServiceConfig): PMService => {
  return new PMService(config);
};
