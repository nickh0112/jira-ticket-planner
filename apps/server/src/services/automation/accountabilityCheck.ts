import type { CheckModule, CheckContext, ProposedAction } from './types.js';

export class AccountabilityCheckModule implements CheckModule {
  name = 'accountability_check' as const;
  enabled = true;

  async run(context: CheckContext): Promise<ProposedAction[]> {
    const { storage } = context;
    const actions: ProposedAction[] = [];

    const teamMembers = storage.getTeamMembers();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // a. Record ticket status transitions by comparing current Jira status with history
    const tickets = storage.getTickets();
    for (const ticket of tickets) {
      if (!ticket.jiraKey) continue;
      const history = storage.getStatusHistory(ticket.jiraKey);
      const lastRecorded = history[0];
      if (!lastRecorded || lastRecorded.newStatus !== ticket.status) {
        storage.recordStatusTransition({
          jiraKey: ticket.jiraKey,
          oldStatus: lastRecorded?.newStatus ?? null,
          newStatus: ticket.status,
        });
      }
    }

    // b. Flag tickets "In Progress" >3 days with zero Bitbucket commits
    const inProgressTickets = storage.getTickets({ status: 'created' as any });
    for (const ticket of inProgressTickets) {
      if (!ticket.jiraKey || !ticket.assigneeId) continue;
      const commits = storage.getBitbucketCommits({ since: threeDaysAgo, limit: 500 });
      const hasCommits = commits.some(c => c.jiraKey === ticket.jiraKey);
      if (!hasCommits) {
        const history = storage.getStatusHistory(ticket.jiraKey);
        const lastTransition = history[0];
        if (lastTransition && lastTransition.changedAt < threeDaysAgo) {
          const existingFlags = storage.getAccountabilityFlags({
            teamMemberId: ticket.assigneeId,
            flagType: 'no_commits',
            status: 'active',
          });
          const alreadyFlagged = existingFlags.some(
            f => f.metadata?.jiraKey === ticket.jiraKey
          );
          if (!alreadyFlagged) {
            const flag = storage.createAccountabilityFlag({
              teamMemberId: ticket.assigneeId,
              flagType: 'no_commits',
              severity: 'medium',
              message: `Ticket ${ticket.jiraKey} "${ticket.title}" has been in progress for >3 days with no commits.`,
              metadata: JSON.stringify({ jiraKey: ticket.jiraKey, ticketTitle: ticket.title, daysSinceLastCommit: 3 }),
            });
            actions.push({
              type: 'accountability_flag',
              checkModule: 'accountability_check',
              title: `No commits for ${ticket.jiraKey} in 3+ days`,
              description: `${ticket.jiraKey} "${ticket.title}" assigned to team member has had no commit activity in the last 3 days despite being in progress.`,
              confidence: 0.7,
              metadata: { flagId: flag.id, jiraKey: ticket.jiraKey, flagType: 'no_commits' },
            });
          }
        }
      }
    }

    // c. Flag engineers at risk of not completing sprint commitment
    for (const member of teamMembers) {
      const memberTickets = storage.getTickets({ assigneeId: member.id });
      const inProgress = memberTickets.filter(t => t.status === 'created');
      const totalAssigned = memberTickets.length;

      if (inProgress.length > 3 && totalAssigned > 5) {
        const existingFlags = storage.getAccountabilityFlags({
          teamMemberId: member.id,
          flagType: 'sprint_risk',
          status: 'active',
        });
        if (existingFlags.length === 0) {
          const flag = storage.createAccountabilityFlag({
            teamMemberId: member.id,
            flagType: 'sprint_risk',
            severity: 'high',
            message: `${member.name} has ${inProgress.length} tickets in progress and ${totalAssigned} total assigned. Sprint completion at risk.`,
            metadata: JSON.stringify({ inProgressCount: inProgress.length, totalAssigned, memberName: member.name }),
          });
          actions.push({
            type: 'accountability_flag',
            checkModule: 'accountability_check',
            title: `Sprint risk for ${member.name}`,
            description: `${member.name} has ${inProgress.length} tickets in progress with ${totalAssigned} total assigned. Sprint completion may be at risk.`,
            confidence: 0.6,
            metadata: { flagId: flag.id, memberId: member.id, flagType: 'sprint_risk' },
          });
        }
      }
    }

    // d. Weekly pattern aggregation into engineer_patterns
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekStartISO = weekStart.toISOString();

    for (const member of teamMembers) {
      const memberTickets = storage.getTickets({ assigneeId: member.id });
      const ticketsCompleted = memberTickets.filter(t => t.status === 'approved').length;
      const ticketsStarted = memberTickets.filter(t => t.status === 'created').length;
      const commits = storage.getBitbucketCommits({ teamMemberId: member.id, since: weekStartISO, limit: 1000 });
      const prs = storage.getBitbucketPullRequests({ state: 'MERGED', limit: 100 });
      const memberPRs = prs.filter(pr => pr.teamMemberId === member.id && pr.mergedAt && pr.mergedAt >= weekStartISO);

      storage.upsertEngineerPattern({
        teamMemberId: member.id,
        weekStart: weekStartStr,
        ticketsCompleted,
        ticketsStarted,
        commitsCount: commits.length,
        prsMerged: memberPRs.length,
        avgCycleTimeHours: undefined,
        aiAnalysis: undefined,
      });
    }

    return actions;
  }
}
