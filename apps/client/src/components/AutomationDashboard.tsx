import { useEffect, useState } from 'react';
import { useAutomationStore } from '../store/automationStore';
import type { AutomationActionType, AutomationRun, UpdateAutomationConfigInput } from '@jira-planner/shared';

const ACTION_TYPE_STYLES: Record<AutomationActionType, { bg: string; text: string; label: string }> = {
  stale_ticket: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Stale Ticket' },
  pm_alert: { bg: 'bg-orange-900/40', text: 'text-orange-400', label: 'PM Alert' },
  sprint_gap_warning: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', label: 'Sprint Gap' },
  accountability_flag: { bg: 'bg-purple-900/40', text: 'text-purple-400', label: 'Accountability' },
  pm_suggestion: { bg: 'bg-blue-900/40', text: 'text-blue-400', label: 'PM Suggestion' },
  assign_ticket: { bg: 'bg-green-900/40', text: 'text-green-400', label: 'Assign Ticket' },
  slack_insight: { bg: 'bg-cyan-900/40', text: 'text-cyan-400', label: 'Slack Insight' },
};

const RUN_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  running: { bg: 'bg-blue-900/40', text: 'text-blue-400' },
  completed: { bg: 'bg-green-900/40', text: 'text-green-400' },
  failed: { bg: 'bg-red-900/40', text: 'text-red-400' },
};

function ActionTypeBadge({ type }: { type: AutomationActionType }) {
  const style = ACTION_TYPE_STYLES[type] || { bg: 'bg-stone-700', text: 'text-text-secondary', label: type };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-pixel ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const style = RUN_STATUS_STYLES[status] || { bg: 'bg-stone-700', text: 'text-text-secondary' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-pixel ${style.bg} ${style.text}`}>
      {status}
    </span>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RunHistoryRow({ run }: { run: AutomationRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border-gold/20 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-primary/50 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <RunStatusBadge status={run.status} />
          <span className="text-text-secondary text-sm font-readable">
            {formatTime(run.startedAt)}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm font-readable">
          <span className="text-text-secondary">
            {run.checksRun.length} checks
          </span>
          <span className="text-text-secondary">
            {run.actionsProposed} proposed
          </span>
          {run.actionsAutoApproved > 0 && (
            <span className="text-green-400">
              {run.actionsAutoApproved} auto-approved
            </span>
          )}
          <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
            &#9660;
          </span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1">
          <div className="bg-stone-primary/60 rounded p-3 text-sm font-readable">
            <p className="text-text-secondary mb-2">Checks executed:</p>
            <div className="flex flex-wrap gap-2">
              {run.checksRun.map((check) => (
                <span key={check} className="px-2 py-0.5 bg-stone-secondary rounded text-text-primary text-xs">
                  {check}
                </span>
              ))}
            </div>
            {run.completedAt && (
              <p className="text-text-secondary mt-2">
                Completed: {formatTime(run.completedAt)}
              </p>
            )}
            {run.error && (
              <p className="text-red-400 mt-2">Error: {run.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AutomationDashboard() {
  const {
    config,
    runs,
    actions,
    isLoading,
    isRunning,
    isSaving,
    error,
    fetchConfig,
    fetchRuns,
    fetchActions,
    triggerRun,
    updateConfig,
    approveAction,
    rejectAction,
    setError,
  } = useAutomationStore();

  // Local config form state
  const [configForm, setConfigForm] = useState<UpdateAutomationConfigInput>({});
  const [configDirty, setConfigDirty] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchRuns();
    fetchActions();
  }, [fetchConfig, fetchRuns, fetchActions]);

  // Sync config form when config loads
  useEffect(() => {
    if (config) {
      setConfigForm({
        enabled: config.enabled,
        checkIntervalMinutes: config.checkIntervalMinutes,
        autoApproveThreshold: config.autoApproveThreshold,
        notifyOnNewActions: config.notifyOnNewActions,
      });
      setConfigDirty(false);
    }
  }, [config]);

  const pendingActions = actions.filter((a) => a.status === 'pending');

  const handleConfigChange = (key: keyof UpdateAutomationConfigInput, value: boolean | number) => {
    setConfigForm((prev) => ({ ...prev, [key]: value }));
    setConfigDirty(true);
  };

  const handleSaveConfig = async () => {
    await updateConfig(configForm);
    setConfigDirty(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-pixel text-pixel-lg text-gold">Automation Engine</h2>
          <p className="font-readable text-beige/60">
            Automated checks, actions, and team intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          {config && (
            <span className={`px-3 py-1 rounded text-xs font-pixel ${
              config.enabled ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
            }`}>
              {config.enabled ? 'ACTIVE' : 'DISABLED'}
            </span>
          )}
          <button
            onClick={triggerRun}
            disabled={isRunning}
            className="stone-button flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <span className="animate-spin">&#8635;</span>
                <span>Running...</span>
              </>
            ) : (
              <>
                <span>&#9881;</span>
                <span>Run Engine</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="stone-card bg-red-900/30 border-red-500/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-red-400 font-readable">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300"
            >
              &#10005;
            </button>
          </div>
        </div>
      )}

      {/* Action Queue */}
      <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
        <div className="px-4 py-3 border-b border-border-gold/30 flex items-center justify-between">
          <h3 className="font-pixel text-pixel-md text-gold">Action Queue</h3>
          <span className="text-text-secondary text-sm font-readable">
            {pendingActions.length} pending
          </span>
        </div>
        {pendingActions.length === 0 ? (
          <div className="text-text-secondary text-center py-12 font-readable">
            No pending actions
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-readable">
              <thead>
                <tr className="border-b border-border-gold/20 text-text-secondary text-left">
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium text-center">Confidence</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingActions.map((action) => (
                  <tr
                    key={action.id}
                    className="border-b border-border-gold/10 hover:bg-stone-primary/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <ActionTypeBadge type={action.type} />
                    </td>
                    <td className="px-4 py-3 text-text-primary">{action.title}</td>
                    <td className="px-4 py-3 text-text-secondary max-w-xs truncate">
                      {action.description}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-pixel text-xs ${
                        action.confidence >= 80 ? 'text-green-400' :
                        action.confidence >= 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {Math.round(action.confidence)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {formatTime(action.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => approveAction(action.id)}
                          className="px-3 py-1 bg-green-900/40 text-green-400 rounded text-xs font-pixel hover:bg-green-900/60 transition-colors border border-green-700/40"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectAction(action.id)}
                          className="px-3 py-1 bg-red-900/40 text-red-400 rounded text-xs font-pixel hover:bg-red-900/60 transition-colors border border-red-700/40"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run History */}
      <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
        <div className="px-4 py-3 border-b border-border-gold/30 flex items-center justify-between">
          <h3 className="font-pixel text-pixel-md text-gold">Run History</h3>
          <span className="text-text-secondary text-sm font-readable">
            {runs.length} runs
          </span>
        </div>
        {isLoading ? (
          <div className="text-text-secondary text-center py-8 font-readable">
            Loading runs...
          </div>
        ) : runs.length === 0 ? (
          <div className="text-text-secondary text-center py-8 font-readable">
            No runs yet. Click "Run Engine" to start.
          </div>
        ) : (
          <div>
            {runs.map((run) => (
              <RunHistoryRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>

      {/* Engine Config */}
      <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
        <div className="px-4 py-3 border-b border-border-gold/30">
          <h3 className="font-pixel text-pixel-md text-gold">Engine Configuration</h3>
        </div>
        {config ? (
          <div className="p-6 space-y-6">
            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-primary font-readable font-medium">Engine Enabled</p>
                <p className="text-text-secondary text-sm font-readable">Run automated checks on a schedule</p>
              </div>
              <button
                onClick={() => handleConfigChange('enabled', !configForm.enabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  configForm.enabled ? 'bg-green-600' : 'bg-stone-600'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  configForm.enabled ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Check interval */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-primary font-readable font-medium">Check Interval</p>
                <p className="text-text-secondary text-sm font-readable">Minutes between automated checks</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={configForm.checkIntervalMinutes ?? 30}
                  onChange={(e) => handleConfigChange('checkIntervalMinutes', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-3 py-1.5 bg-stone-primary border border-border-gold/40 rounded text-text-primary font-readable text-sm text-center focus:outline-none focus:border-gold"
                />
                <span className="text-text-secondary text-sm font-readable">min</span>
              </div>
            </div>

            {/* Auto-approve threshold */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-text-primary font-readable font-medium">Auto-Approve Threshold</p>
                  <p className="text-text-secondary text-sm font-readable">Actions above this confidence are auto-approved</p>
                </div>
                <span className="text-gold font-pixel text-sm">
                  {configForm.autoApproveThreshold ?? 0}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={configForm.autoApproveThreshold ?? 0}
                onChange={(e) => handleConfigChange('autoApproveThreshold', parseInt(e.target.value))}
                className="w-full h-2 bg-stone-primary rounded-lg appearance-none cursor-pointer accent-gold"
              />
              <div className="flex justify-between text-xs text-text-secondary font-readable mt-1">
                <span>0% (manual only)</span>
                <span>100% (auto all)</span>
              </div>
            </div>

            {/* Notify toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-primary font-readable font-medium">Notifications</p>
                <p className="text-text-secondary text-sm font-readable">Notify when new actions are proposed</p>
              </div>
              <button
                onClick={() => handleConfigChange('notifyOnNewActions', !configForm.notifyOnNewActions)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  configForm.notifyOnNewActions ? 'bg-green-600' : 'bg-stone-600'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  configForm.notifyOnNewActions ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Save button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveConfig}
                disabled={!configDirty || isSaving}
                className={`stone-button px-6 ${
                  !configDirty ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-text-secondary text-center py-8 font-readable">
            Loading configuration...
          </div>
        )}
      </div>
    </div>
  );
}
