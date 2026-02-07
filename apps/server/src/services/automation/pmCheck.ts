import type { CheckModule, CheckContext, ProposedAction } from './types.js';
import type { PMService } from '../pmService.js';
import type { JiraSyncService } from '../jiraSyncService.js';

export class PMCheckModule implements CheckModule {
  name = 'pm_check' as const;
  enabled = true;
  private pmService: PMService;
  private jiraSyncService: JiraSyncService;

  constructor(pmService: PMService, jiraSyncService: JiraSyncService) {
    this.pmService = pmService;
    this.jiraSyncService = jiraSyncService;
  }

  async run(context: CheckContext): Promise<ProposedAction[]> {
    const actions: ProposedAction[] = [];

    // Sync active tickets from Jira before generating alerts/suggestions
    try {
      const syncResult = await this.jiraSyncService.syncActiveTickets();
      console.log(`[pm_check] Synced ${syncResult.synced} active tickets from Jira`);
      if (syncResult.errors.length > 0) {
        console.warn(`[pm_check] Sync errors: ${syncResult.errors.join(', ')}`);
      }
    } catch (e) {
      console.error('[pm_check] Failed to sync tickets from Jira, continuing with stale data:', e);
    }

    // 1. Detect problematic engineers and create alert actions
    const alerts = this.pmService.createAlertsForProblematicEngineers();
    for (const alert of alerts) {
      actions.push({
        type: 'pm_alert',
        checkModule: 'pm_check',
        title: `Alert: ${alert.alertType} - ${alert.teamMemberId}`,
        description: alert.message,
        confidence: alert.severity === 'critical' ? 0.9 : alert.severity === 'warning' ? 0.7 : 0.5,
        metadata: {
          alertId: alert.id,
          teamMemberId: alert.teamMemberId,
          alertType: alert.alertType,
          severity: alert.severity,
        },
      });
    }

    // 2. Detect underutilized engineers and generate suggestions
    const underutilized = this.pmService.detectUnderutilizedEngineers();
    for (const engineer of underutilized) {
      const suggestions = await this.pmService.generateSuggestions(engineer.memberId);
      for (const suggestion of suggestions) {
        actions.push({
          type: 'pm_suggestion',
          checkModule: 'pm_check',
          title: `Suggestion for ${engineer.memberName}: ${suggestion.title}`,
          description: suggestion.reasoning,
          confidence: suggestion.skillMatchScore,
          metadata: {
            suggestionId: suggestion.id,
            teamMemberId: engineer.memberId,
            memberName: engineer.memberName,
            suggestedTitle: suggestion.title,
          },
        });
      }
    }

    return actions;
  }
}
