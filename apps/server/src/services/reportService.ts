import { v4 as uuidv4 } from 'uuid';
import type { GenerateReportInput, Report, ReportType } from '@jira-planner/shared';
import type { StorageService } from './storageService.js';
import { callClaudeWithRetry } from './claudeService.js';

interface ReportContext {
  storage: StorageService;
}

function getDefaultPeriod(reportType: ReportType): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];

  if (reportType === 'daily_standup') {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    return { start: start.toISOString().split('T')[0], end };
  }

  if (reportType === 'weekly_leadership') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start: start.toISOString().split('T')[0], end };
  }

  // sprint_report: last 14 days
  const start = new Date(now);
  start.setDate(start.getDate() - 14);
  return { start: start.toISOString().split('T')[0], end };
}

function buildReportTitle(reportType: ReportType, periodStart: string, periodEnd: string): string {
  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  switch (reportType) {
    case 'daily_standup':
      return `Daily Standup - ${formatDate(periodEnd)}`;
    case 'weekly_leadership':
      return `Weekly Leadership Report - ${formatDate(periodStart)} to ${formatDate(periodEnd)}`;
    case 'sprint_report':
      return `Sprint Report - ${formatDate(periodStart)} to ${formatDate(periodEnd)}`;
  }
}

function gatherTicketData(storage: StorageService): {
  allTickets: any[];
  teamMembers: any[];
} {
  const allTickets = storage.getTickets();
  const teamMembers = storage.getTeamMembers();
  return { allTickets, teamMembers };
}

function gatherBitbucketData(storage: StorageService): {
  pullRequests: any[];
  commits: any[];
  pipelines: any[];
} {
  try {
    const pullRequests = storage.getBitbucketPullRequests({ limit: 50 });
    const commits = storage.getBitbucketCommits({ limit: 100 });
    const pipelines = storage.getBitbucketPipelines({ limit: 30 });
    return { pullRequests, commits, pipelines };
  } catch {
    return { pullRequests: [], commits: [], pipelines: [] };
  }
}

function gatherPMData(storage: StorageService): {
  alerts: any[];
  assignments: any[];
} {
  try {
    const alerts = storage.getActivePMAlerts();
    const assignments = storage.getPMAssignments();
    return { alerts, assignments };
  } catch {
    return { alerts: [], assignments: [] };
  }
}

function gatherSprintData(storage: StorageService): {
  latestSnapshot: any | null;
  sprints: any[];
} {
  try {
    const latestSnapshot = storage.getLatestSprintSnapshot();
    const sprints = storage.getSprints();
    return { latestSnapshot, sprints };
  } catch {
    return { latestSnapshot: null, sprints: [] };
  }
}

function buildDataSummary(
  reportType: ReportType,
  periodStart: string,
  periodEnd: string,
  ticketData: ReturnType<typeof gatherTicketData>,
  bbData: ReturnType<typeof gatherBitbucketData>,
  pmData: ReturnType<typeof gatherPMData>,
  sprintData: ReturnType<typeof gatherSprintData>,
): string {
  const { allTickets, teamMembers } = ticketData;
  const { pullRequests, commits, pipelines } = bbData;
  const { alerts, assignments } = pmData;
  const { latestSnapshot, sprints } = sprintData;

  const activeSprint = sprints.find((s: any) => s.state === 'active');

  // Ticket summary
  const completedTickets = allTickets.filter(t => t.status === 'created');
  const inProgressTickets = allTickets.filter(t => t.status === 'approved');
  const pendingTickets = allTickets.filter(t => t.status === 'pending');

  // Per-engineer breakdown
  const engineerBreakdown = teamMembers.map((m: any) => {
    const memberTickets = allTickets.filter((t: any) => t.assigneeId === m.id);
    const memberPRs = pullRequests.filter((pr: any) => pr.teamMemberId === m.id);
    const memberCommits = commits.filter((c: any) => c.teamMemberId === m.id);
    return {
      name: m.name,
      role: m.role,
      assignedTickets: memberTickets.length,
      completedTickets: memberTickets.filter((t: any) => t.status === 'created').length,
      inProgressTickets: memberTickets.filter((t: any) => t.status === 'approved').length,
      prsCreated: memberPRs.length,
      prsMerged: memberPRs.filter((pr: any) => pr.state === 'MERGED').length,
      commitsCount: memberCommits.length,
    };
  });

  // Pipeline success rate
  const completedPipelines = pipelines.filter((p: any) => p.state === 'SUCCESSFUL' || p.state === 'FAILED');
  const successfulPipelines = pipelines.filter((p: any) => p.state === 'SUCCESSFUL');
  const pipelineSuccessRate = completedPipelines.length > 0
    ? Math.round((successfulPipelines.length / completedPipelines.length) * 100)
    : null;

  let summary = `=== DATA FOR ${reportType.toUpperCase()} REPORT ===
Period: ${periodStart} to ${periodEnd}

--- JIRA TICKETS ---
Total tickets: ${allTickets.length}
Completed: ${completedTickets.length}
In Progress: ${inProgressTickets.length}
Pending/To Do: ${pendingTickets.length}

--- BITBUCKET ACTIVITY ---
Pull Requests: ${pullRequests.length} total, ${pullRequests.filter((pr: any) => pr.state === 'MERGED').length} merged, ${pullRequests.filter((pr: any) => pr.state === 'OPEN').length} open
Commits: ${commits.length}
Pipeline Success Rate: ${pipelineSuccessRate !== null ? `${pipelineSuccessRate}%` : 'N/A'}

--- PM ALERTS ---
Active Alerts: ${alerts.filter((a: any) => !a.isDismissed).length}
Total Assignments: ${assignments.length}

--- PER-ENGINEER BREAKDOWN ---
${engineerBreakdown.map(e =>
  `- ${e.name} (${e.role}): ${e.assignedTickets} assigned, ${e.completedTickets} completed, ${e.inProgressTickets} in-progress, ${e.commitsCount} commits, ${e.prsMerged} PRs merged`
).join('\n')}
`;

  if (activeSprint) {
    summary += `\n--- ACTIVE SPRINT ---
Sprint: ${activeSprint.name}
State: ${activeSprint.state}
Start: ${activeSprint.startDate || 'N/A'}
End: ${activeSprint.endDate || 'N/A'}
`;
  }

  if (latestSnapshot) {
    summary += `\n--- LATEST SPRINT HEALTH SNAPSHOT ---
Health Score: ${latestSnapshot.healthScore}/100
Total Tickets: ${latestSnapshot.totalTickets}
Completed: ${latestSnapshot.completedTickets}
In Progress: ${latestSnapshot.inProgressTickets}
To Do: ${latestSnapshot.todoTickets}
Days Remaining: ${latestSnapshot.daysRemaining ?? 'N/A'}
AI Analysis: ${latestSnapshot.aiAnalysis || 'N/A'}
`;
  }

  return summary;
}

function getSystemPromptForType(reportType: ReportType, customInstructions?: string): string {
  const base = 'You are a report generator for a software engineering team. Generate a well-formatted markdown report based on the provided data.';

  const typePrompts: Record<ReportType, string> = {
    daily_standup: `${base}

Generate a **Daily Standup Report** with these sections:
1. **Team Summary** - Brief overview of team activity
2. **Per-Engineer Update** - For each engineer:
   - Yesterday: What they completed
   - Today: What they're working on (in-progress tickets)
   - Blockers: Any alerts or issues
3. **Key Metrics** - Quick stats (commits, PRs, pipeline status)

Keep it concise and scannable. Use bullet points.`,

    weekly_leadership: `${base}

Generate a **Weekly Leadership Report** with these sections:
1. **Executive Summary** - 2-3 sentence overview of the week
2. **Accomplishments by Epic/Area** - What was completed, grouped by area
3. **Work In Progress** - Current active work and expected completions
4. **Risks & Blockers** - Any issues requiring leadership attention
5. **Next Week Outlook** - Planned priorities for next week
6. **Team Health** - Sprint health score, velocity indicators, and team utilization

Make it professional and suitable for leadership review. Focus on outcomes and impact.`,

    sprint_report: `${base}

Generate a **Sprint Report** with these sections:
1. **Sprint Overview** - Sprint name, dates, goals
2. **Completion Metrics** - Tickets completed vs planned, story points, completion percentage
3. **Velocity Analysis** - How this sprint compares to expectations
4. **Carryover Items** - Tickets not completed that will carry to next sprint
5. **Per-Engineer Breakdown** - Individual contributions and metrics
6. **Pipeline & Code Quality** - Build success rates, PR review cycles
7. **Retrospective Data Points** - Observations for the team retro

Include specific numbers and percentages. Be data-driven.`,
  };

  let prompt = typePrompts[reportType];
  if (customInstructions) {
    prompt += `\n\nAdditional instructions from user: ${customInstructions}`;
  }

  prompt += '\n\nReturn ONLY the markdown report content. Do not wrap in code blocks.';
  return prompt;
}

export async function generateReport(
  input: GenerateReportInput,
  ctx: ReportContext,
): Promise<Report> {
  const { storage } = ctx;
  const period = getDefaultPeriod(input.reportType);
  const periodStart = input.periodStart || period.start;
  const periodEnd = input.periodEnd || period.end;

  // Gather data from all sources
  const ticketData = gatherTicketData(storage);
  const bbData = gatherBitbucketData(storage);
  const pmData = gatherPMData(storage);
  const sprintData = gatherSprintData(storage);

  // Build data summary for Claude
  const dataSummary = buildDataSummary(
    input.reportType,
    periodStart,
    periodEnd,
    ticketData,
    bbData,
    pmData,
    sprintData,
  );

  // Check for custom template instructions
  const template = storage.getReportTemplate(input.reportType);
  const customInstructions = input.customInstructions || template?.customInstructions || undefined;

  // Generate report with Claude
  const systemPrompt = getSystemPromptForType(input.reportType, customInstructions);

  const response = await callClaudeWithRetry({
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Generate the report from this data:\n\n${dataSummary}`,
    }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  let markdownContent = content.text.trim();
  // Strip markdown code block wrappers if present
  if (markdownContent.startsWith('```markdown')) {
    markdownContent = markdownContent.slice(11);
  } else if (markdownContent.startsWith('```')) {
    markdownContent = markdownContent.slice(3);
  }
  if (markdownContent.endsWith('```')) {
    markdownContent = markdownContent.slice(0, -3);
  }
  markdownContent = markdownContent.trim();

  // Build structured data
  const structuredData = {
    ticketStats: {
      total: ticketData.allTickets.length,
      completed: ticketData.allTickets.filter(t => t.status === 'created').length,
      inProgress: ticketData.allTickets.filter(t => t.status === 'approved').length,
      pending: ticketData.allTickets.filter(t => t.status === 'pending').length,
    },
    bitbucketStats: {
      pullRequests: bbData.pullRequests.length,
      prsMerged: bbData.pullRequests.filter((pr: any) => pr.state === 'MERGED').length,
      commits: bbData.commits.length,
    },
    sprintHealth: sprintData.latestSnapshot?.healthScore ?? null,
    engineerCount: ticketData.teamMembers.length,
  };

  // Save to DB
  const id = uuidv4();
  const title = buildReportTitle(input.reportType, periodStart, periodEnd);

  storage.createReport({
    id,
    reportType: input.reportType,
    title,
    periodStart,
    periodEnd,
    markdownContent,
    structuredData,
  });

  const report: Report = {
    id,
    reportType: input.reportType,
    title,
    periodStart,
    periodEnd,
    markdownContent,
    structuredData,
    createdAt: new Date().toISOString(),
  };

  console.log(`[reports] Generated ${input.reportType} report: ${title}`);
  return report;
}
