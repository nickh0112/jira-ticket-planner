import type { CheckModule, CheckContext, ProposedAction } from './types.js';

export class StaleTicketCheckModule implements CheckModule {
  name = 'stale_ticket_check' as const;
  enabled = true;

  async run(context: CheckContext): Promise<ProposedAction[]> {
    const { storage } = context;
    const actions: ProposedAction[] = [];

    // a. PR merged but ticket still open
    const mergedPRs = storage.getBitbucketPullRequests({ state: 'MERGED', limit: 100 });
    for (const pr of mergedPRs) {
      if (!pr.jiraKey) continue;
      const ticket = storage.getTicketByJiraKey(pr.jiraKey);
      if (ticket && (ticket.status as string) !== 'done') {
        const existing = storage.getStaleDetections({ jiraKey: pr.jiraKey, detectionType: 'pr_merged_ticket_open', status: 'open' });
        if (existing.length === 0) {
          const detection = storage.createStaleDetection({
            jiraKey: pr.jiraKey,
            detectionType: 'pr_merged_ticket_open',
            severity: 'high',
            evidence: JSON.stringify({
              prNumber: pr.prNumber,
              prTitle: pr.title,
              mergedAt: pr.mergedAt,
              ticketStatus: ticket.status,
              repoSlug: pr.repoSlug,
            }),
            teamMemberId: pr.teamMemberId ?? undefined,
          });
          actions.push({
            type: 'stale_ticket',
            checkModule: 'stale_ticket_check',
            title: `PR merged but ticket ${pr.jiraKey} still ${ticket.status}`,
            description: `PR #${pr.prNumber} "${pr.title}" was merged on ${pr.mergedAt} but the ticket is still in "${ticket.status}" status.`,
            confidence: 0.85,
            metadata: { detectionId: detection.id, jiraKey: pr.jiraKey, detectionType: 'pr_merged_ticket_open' },
          });
        }
      }
    }

    // b. Commits exist but ticket shows no progress
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const recentCommits = storage.getBitbucketCommits({ since: threeDaysAgo, limit: 200 });
    const commitsByJiraKey = new Map<string, number>();
    for (const commit of recentCommits) {
      if (commit.jiraKey) {
        commitsByJiraKey.set(commit.jiraKey, (commitsByJiraKey.get(commit.jiraKey) || 0) + 1);
      }
    }

    for (const [jiraKey, commitCount] of commitsByJiraKey) {
      const ticket = storage.getTicketByJiraKey(jiraKey);
      if (ticket && ((ticket.status as string) === 'backlog' || (ticket.status as string) === 'todo')) {
        const existing = storage.getStaleDetections({ jiraKey, detectionType: 'commits_no_progress', status: 'open' });
        if (existing.length === 0) {
          const detection = storage.createStaleDetection({
            jiraKey,
            detectionType: 'commits_no_progress',
            severity: 'medium',
            evidence: JSON.stringify({ commitCount, since: threeDaysAgo, ticketStatus: ticket.status }),
            teamMemberId: ticket.assigneeId ?? undefined,
          });
          actions.push({
            type: 'stale_ticket',
            checkModule: 'stale_ticket_check',
            title: `${commitCount} commits for ${jiraKey} but ticket still in ${ticket.status}`,
            description: `${commitCount} commits found in the last 3 days for ${jiraKey}, but the ticket status is "${ticket.status}". The ticket should probably be moved to "In Progress".`,
            confidence: 0.7,
            metadata: { detectionId: detection.id, jiraKey, detectionType: 'commits_no_progress' },
          });
        }
      }
    }

    // c. Ticket stale in status (>5 days with no code activity)
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const tickets = storage.getTickets({ status: 'in_progress' as any });
    for (const ticket of tickets) {
      if (!ticket.jiraKey) continue;
      const recentCommitsForTicket = storage.getBitbucketCommits({ since: fiveDaysAgo, limit: 1 });
      const hasActivity = recentCommitsForTicket.some(c => c.jiraKey === ticket.jiraKey);
      if (!hasActivity) {
        const history = storage.getStatusHistory(ticket.jiraKey);
        const lastTransition = history[0];
        if (lastTransition && lastTransition.changedAt < fiveDaysAgo) {
          const existing = storage.getStaleDetections({ jiraKey: ticket.jiraKey, detectionType: 'ticket_stale_in_status', status: 'open' });
          if (existing.length === 0) {
            const detection = storage.createStaleDetection({
              jiraKey: ticket.jiraKey,
              detectionType: 'ticket_stale_in_status',
              severity: 'medium',
              evidence: JSON.stringify({ lastStatusChange: lastTransition.changedAt, currentStatus: ticket.status, daysSinceActivity: 5 }),
              teamMemberId: ticket.assigneeId ?? undefined,
            });
            actions.push({
              type: 'stale_ticket',
              checkModule: 'stale_ticket_check',
              title: `${ticket.jiraKey} stale in "${ticket.status}" for >5 days`,
              description: `Ticket ${ticket.jiraKey} "${ticket.title}" has been in "${ticket.status}" since ${lastTransition.changedAt} with no code activity.`,
              confidence: 0.65,
              metadata: { detectionId: detection.id, jiraKey: ticket.jiraKey, detectionType: 'ticket_stale_in_status' },
            });
          }
        }
      }
    }

    // d. PR open with no review activity (>48 hours)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const openPRs = storage.getBitbucketPullRequests({ state: 'OPEN', limit: 100 });
    for (const pr of openPRs) {
      if (pr.createdAt > twoDaysAgo) continue;
      const hasReviewActivity = pr.reviewers.some(r => r.approvedAt);
      if (!hasReviewActivity) {
        const jiraKey = pr.jiraKey || `PR-${pr.prNumber}`;
        const existing = storage.getStaleDetections({ jiraKey, detectionType: 'pr_open_no_review', status: 'open' });
        if (existing.length === 0) {
          const detection = storage.createStaleDetection({
            jiraKey,
            detectionType: 'pr_open_no_review',
            severity: 'medium',
            evidence: JSON.stringify({ prNumber: pr.prNumber, prTitle: pr.title, createdAt: pr.createdAt, reviewerCount: pr.reviewers.length, repoSlug: pr.repoSlug }),
            teamMemberId: pr.teamMemberId ?? undefined,
          });
          actions.push({
            type: 'stale_ticket',
            checkModule: 'stale_ticket_check',
            title: `PR #${pr.prNumber} open >48h with no review`,
            description: `PR "${pr.title}" in ${pr.repoSlug} has been open since ${pr.createdAt} with no approved reviews.`,
            confidence: 0.6,
            metadata: { detectionId: detection.id, jiraKey, detectionType: 'pr_open_no_review' },
          });
        }
      }
    }

    // e. Pipeline failing on ticket's branch
    const pipelines = storage.getBitbucketPipelines({ state: 'FAILED', since: threeDaysAgo, limit: 50 });
    for (const pipeline of pipelines) {
      // Try to extract jira key from branch name
      const branchMatch = pipeline.branch.match(/([A-Z]+-\d+)/);
      if (!branchMatch) continue;
      const jiraKey = branchMatch[1];
      const existing = storage.getStaleDetections({ jiraKey, detectionType: 'pipeline_failing', status: 'open' });
      if (existing.length === 0) {
        const ticket = storage.getTicketByJiraKey(jiraKey);
        const detection = storage.createStaleDetection({
          jiraKey,
          detectionType: 'pipeline_failing',
          severity: 'high',
          evidence: JSON.stringify({ branch: pipeline.branch, buildNumber: pipeline.buildNumber, repoSlug: pipeline.repoSlug, failedAt: pipeline.completedAt }),
          teamMemberId: ticket?.assigneeId ?? undefined,
        });
        actions.push({
          type: 'stale_ticket',
          checkModule: 'stale_ticket_check',
          title: `Pipeline failing for ${jiraKey} on branch ${pipeline.branch}`,
          description: `Build #${pipeline.buildNumber} in ${pipeline.repoSlug} failed for branch ${pipeline.branch} (linked to ${jiraKey}).`,
          confidence: 0.75,
          metadata: { detectionId: detection.id, jiraKey, detectionType: 'pipeline_failing' },
        });
      }
    }

    return actions;
  }
}
