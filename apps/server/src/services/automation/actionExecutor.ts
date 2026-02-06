import type { StorageService } from '../storageService.js';
import type { JiraService } from '../jiraService.js';
import type { AutomationAction } from '@jira-planner/shared';
import { v4 as uuidv4 } from 'uuid';

interface ActionExecutorConfig {
  storage: StorageService;
  jiraService: JiraService | null;
}

export class ActionExecutor {
  private storage: StorageService;
  private jiraService: JiraService | null;

  constructor(config: ActionExecutorConfig) {
    this.storage = config.storage;
    this.jiraService = config.jiraService;
  }

  async execute(action: AutomationAction): Promise<{ success: boolean; error?: string }> {
    const jiraConfig = this.storage.getJiraConfig();
    if (!this.jiraService || !jiraConfig) {
      return { success: true }; // No Jira configured, advisory only
    }

    try {
      switch (action.type) {
        case 'assign_ticket':
          return await this.executeAssignTicket(action, jiraConfig);
        case 'stale_ticket':
          return await this.executeStaleTicket(action, jiraConfig);
        case 'sprint_gap_warning':
          return await this.executeSprintGapWarning(action, jiraConfig);
        default:
          // pm_alert, accountability_flag, slack_insight, pm_suggestion are advisory
          return { success: true };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Record failure for retry
      this.storage.createSyncFailure({
        id: uuidv4(),
        entityType: 'automation_action',
        entityId: action.id,
        jiraKey: action.metadata?.jiraKey,
        errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  private async executeAssignTicket(action: AutomationAction, jiraConfig: any) {
    const { jiraKey, teamMemberId } = action.metadata || {};
    if (!jiraKey || !teamMemberId) return { success: true };

    const member = this.storage.getTeamMember(teamMemberId);
    if (!member?.jiraAccountId) return { success: true };

    await this.jiraService!.assignIssue(jiraConfig, jiraKey, member.jiraAccountId);
    return { success: true };
  }

  private async executeStaleTicket(action: AutomationAction, jiraConfig: any) {
    const { jiraKey, reason } = action.metadata || {};
    if (!jiraKey) return { success: true };

    if (reason === 'pr_merged') {
      // PR merged but ticket not closed -> transition to Done
      const transitions = await this.jiraService!.getTransitions(jiraConfig, jiraKey);
      const doneTransition = transitions.find(t =>
        t.to.statusCategory.key === 'done' ||
        t.name.toLowerCase().includes('done') ||
        t.name.toLowerCase().includes('closed')
      );
      if (doneTransition) {
        await this.jiraService!.transitionIssue(jiraConfig, jiraKey, doneTransition.id);
        await this.jiraService!.addComment(jiraConfig, jiraKey,
          `[Automated] PR merged — transitioning ticket to Done.`
        );
      }
    } else {
      // No progress -> transition to In Progress + comment
      const transitions = await this.jiraService!.getTransitions(jiraConfig, jiraKey);
      const inProgressTransition = transitions.find(t =>
        t.to.statusCategory.key === 'indeterminate' ||
        t.name.toLowerCase().includes('in progress')
      );
      if (inProgressTransition) {
        await this.jiraService!.transitionIssue(jiraConfig, jiraKey, inProgressTransition.id);
      }
      await this.jiraService!.addComment(jiraConfig, jiraKey,
        `[Automated] This ticket has been flagged as stale. Please update progress.`
      );
    }
    return { success: true };
  }

  private async executeSprintGapWarning(action: AutomationAction, jiraConfig: any) {
    const { jiraKey, teamMemberId } = action.metadata || {};
    if (!jiraKey || !teamMemberId) return { success: true };

    const member = this.storage.getTeamMember(teamMemberId);
    if (!member?.jiraAccountId) return { success: true };

    await this.jiraService!.assignIssue(jiraConfig, jiraKey, member.jiraAccountId);
    return { success: true };
  }
}
