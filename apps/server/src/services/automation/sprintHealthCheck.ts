import type { CheckModule, CheckContext, ProposedAction } from './types.js';
import { callClaudeWithRetry } from '../claudeService.js';
import { v4 as uuidv4 } from 'uuid';

interface PerEngineerData {
  memberId: string;
  name: string;
  assigned: number;
  completed: number;
  inProgress: number;
}

export class SprintHealthCheckModule implements CheckModule {
  name = 'sprint_health_check' as const;
  enabled = true;

  async run(context: CheckContext): Promise<ProposedAction[]> {
    const actions: ProposedAction[] = [];
    const { storage } = context;

    // 1. Get Jira config and active sprint
    const jiraConfig = storage.getJiraConfig();
    if (!jiraConfig) {
      console.log('[sprint-health] No Jira config found, skipping');
      return actions;
    }

    const sprints = storage.getSprints(jiraConfig.defaultBoardId ?? undefined);
    const activeSprint = sprints.find(s => s.state === 'active');
    if (!activeSprint) {
      console.log('[sprint-health] No active sprint found, skipping');
      return actions;
    }

    // 2. Get all tickets and team members
    const allTickets = storage.getTickets();
    const teamMembers = storage.getTeamMembers();

    // Categorize tickets by status
    const completedStatuses = ['created']; // 'created' is the mapped internal status for done
    const inProgressStatuses = ['approved'];
    const todoStatuses = ['pending'];

    // Use assignee-based analysis since tickets don't have sprint_id
    const assignedTickets = allTickets.filter(t => t.assigneeId !== null);

    let totalTickets = assignedTickets.length;
    let completedTickets = assignedTickets.filter(t => completedStatuses.includes(t.status)).length;
    let inProgressTickets = assignedTickets.filter(t => inProgressStatuses.includes(t.status)).length;
    let todoTickets = assignedTickets.filter(t => todoStatuses.includes(t.status)).length;

    // 3. Calculate per-engineer load
    const perEngineerData: PerEngineerData[] = teamMembers.map(member => {
      const memberTickets = assignedTickets.filter(t => t.assigneeId === member.id);
      return {
        memberId: member.id,
        name: member.name,
        assigned: memberTickets.length,
        completed: memberTickets.filter(t => completedStatuses.includes(t.status)).length,
        inProgress: memberTickets.filter(t => inProgressStatuses.includes(t.status)).length,
      };
    });

    // 4. Identify engineers with <2 remaining tickets or 0 in-progress
    const underloadedEngineers = perEngineerData.filter(e => {
      const remaining = e.assigned - e.completed;
      return remaining < 2 || e.inProgress === 0;
    });

    // 5. Calculate days remaining in sprint
    let daysRemaining: number | undefined;
    if (activeSprint.endDate) {
      const now = new Date();
      const endDate = new Date(activeSprint.endDate);
      daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // 6. Calculate health score (0-100)
    let healthScore = 50; // baseline
    if (totalTickets > 0) {
      const completionRate = completedTickets / totalTickets;
      const progressRate = (completedTickets + inProgressTickets) / totalTickets;

      // Weight completion more
      healthScore = Math.round(completionRate * 60 + progressRate * 40);

      // Bonus for having work in progress
      if (inProgressTickets > 0) healthScore = Math.min(100, healthScore + 5);

      // Penalty for underloaded engineers
      if (underloadedEngineers.length > teamMembers.length / 2) {
        healthScore = Math.max(0, healthScore - 15);
      }
    }

    // 7. Use Claude for trajectory analysis
    let aiAnalysis: string | null = null;
    try {
      const analysisPrompt = `Analyze this sprint health data and provide a brief trajectory analysis (2-3 sentences):

Sprint: ${activeSprint.name}
Days remaining: ${daysRemaining ?? 'unknown'}
Total tickets: ${totalTickets}
Completed: ${completedTickets}
In Progress: ${inProgressTickets}
To Do: ${todoTickets}
Health Score: ${healthScore}/100

Per-engineer breakdown:
${perEngineerData.map(e => `- ${e.name}: ${e.assigned} assigned, ${e.completed} completed, ${e.inProgress} in-progress`).join('\n')}

Underloaded engineers (< 2 remaining or 0 in-progress):
${underloadedEngineers.map(e => `- ${e.name}`).join('\n') || 'None'}

Provide a JSON response:
{
  "analysis": "Brief trajectory analysis...",
  "riskLevel": "low" | "medium" | "high",
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Only return JSON, no other text.`;

      const response = await callClaudeWithRetry({
        max_tokens: 1024,
        system: 'You are a sprint health analyst. Analyze sprint data and provide brief, actionable trajectory analysis. Only return JSON.',
        messages: [{ role: 'user', content: analysisPrompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        let jsonText = content.text.trim();
        if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
        else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
        if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
        jsonText = jsonText.trim();

        const result = JSON.parse(jsonText);
        aiAnalysis = result.analysis || null;
      }
    } catch (error) {
      console.error('[sprint-health] Claude analysis failed:', error);
    }

    // 8. Save sprint snapshot
    const snapshotId = uuidv4();
    storage.createSprintSnapshot({
      id: snapshotId,
      sprintId: activeSprint.id,
      sprintName: activeSprint.name,
      snapshotDate: new Date().toISOString().split('T')[0],
      totalTickets,
      completedTickets,
      inProgressTickets,
      todoTickets,
      totalStoryPoints: null,
      completedStoryPoints: null,
      perEngineerData,
      healthScore,
      aiAnalysis,
      daysRemaining: daysRemaining ?? null,
    });

    // 9. Produce actions for underloaded engineers
    for (const engineer of underloadedEngineers) {
      const remaining = engineer.assigned - engineer.completed;
      actions.push({
        type: 'sprint_gap_warning',
        checkModule: 'sprint_health_check',
        title: `Sprint gap: ${engineer.name} has ${remaining} remaining tickets`,
        description: `${engineer.name} has only ${remaining} remaining tickets and ${engineer.inProgress} in-progress. Consider assigning more work to maintain sprint velocity.`,
        confidence: remaining === 0 ? 0.85 : 0.65,
        metadata: {
          snapshotId,
          teamMemberId: engineer.memberId,
          memberName: engineer.name,
          remaining,
          inProgress: engineer.inProgress,
          daysRemaining,
        },
      });
    }

    // 10. Suggest backlog items that could be added
    const unassignedTickets = storage.getUnassignedJiraTickets();
    if (underloadedEngineers.length > 0 && unassignedTickets.length > 0) {
      for (const engineer of underloadedEngineers.slice(0, 3)) {
        const ticket = unassignedTickets.shift();
        if (!ticket) break;

        actions.push({
          type: 'assign_ticket',
          checkModule: 'sprint_health_check',
          title: `Assign "${ticket.title}" to ${engineer.name}`,
          description: `${engineer.name} is underloaded with ${engineer.assigned - engineer.completed} remaining tickets. Consider assigning "${ticket.title}" to balance sprint workload.`,
          confidence: 0.55,
          metadata: {
            snapshotId,
            teamMemberId: engineer.memberId,
            memberName: engineer.name,
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            jiraKey: ticket.jiraKey,
          },
        });
      }
    }

    console.log(`[sprint-health] Sprint "${activeSprint.name}" health: ${healthScore}/100, ${actions.length} actions proposed`);
    return actions;
  }
}
