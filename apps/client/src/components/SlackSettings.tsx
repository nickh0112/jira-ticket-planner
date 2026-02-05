import { useEffect, useState } from 'react';
import { useSlackStore } from '../store/slackStore';
import { useStore } from '../store/useStore';
import type { SlackInsightType } from '@jira-planner/shared';

const INSIGHT_TYPE_STYLES: Record<SlackInsightType, { bg: string; text: string; label: string }> = {
  decision: { bg: 'bg-green-900/40', text: 'text-green-400', label: 'Decision' },
  action_item: { bg: 'bg-blue-900/40', text: 'text-blue-400', label: 'Action Item' },
  blocker: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Blocker' },
  update: { bg: 'bg-cyan-900/40', text: 'text-cyan-400', label: 'Update' },
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SlackSettings() {
  const {
    config,
    channels,
    insights,
    userMappings,
    syncState,
    isLoading,
    isSaving,
    isTesting,
    isSyncing,
    testResult,
    error,
    fetchConfig,
    updateConfig,
    testConnection,
    fetchChannels,
    toggleMonitoring,
    fetchInsights,
    fetchSyncStatus,
    triggerSync,
    fetchUserMappings,
    updateUserMapping,
    setError,
  } = useSlackStore();

  const teamMembers = useStore((s) => s.teamMembers);

  const [botToken, setBotToken] = useState('');
  const [syncInterval, setSyncInterval] = useState(30);
  const [tokenDirty, setTokenDirty] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchChannels();
    fetchInsights(20);
    fetchSyncStatus();
    fetchUserMappings();
  }, [fetchConfig, fetchChannels, fetchInsights, fetchSyncStatus, fetchUserMappings]);

  useEffect(() => {
    if (config) {
      setBotToken(config.botToken || '');
      setSyncInterval(config.syncIntervalMinutes);
      setTokenDirty(false);
    }
  }, [config]);

  const handleSaveToken = async () => {
    await updateConfig({ botToken, syncIntervalMinutes: syncInterval });
    setTokenDirty(false);
  };

  const handleToggleEnabled = async () => {
    if (config) {
      await updateConfig({ enabled: !config.enabled });
    }
  };

  const handleSyncIntervalChange = async (value: number) => {
    setSyncInterval(value);
    // Auto-save interval changes
    await updateConfig({ syncIntervalMinutes: value });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-pixel text-pixel-lg text-gold">Slack Integration</h3>
          <p className="font-readable text-beige/60">
            Monitor Slack channels for insights, decisions, and action items
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
            onClick={triggerSync}
            disabled={isSyncing}
            className="stone-button flex items-center gap-2"
          >
            {isSyncing ? (
              <>
                <span className="animate-spin">&#8635;</span>
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <span>&#8635;</span>
                <span>Sync Now</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="stone-card bg-red-900/30 border-red-500/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-red-400 font-readable">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              &#10005;
            </button>
          </div>
        </div>
      )}

      {/* Connection Config */}
      <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
        <div className="px-4 py-3 border-b border-border-gold/30">
          <h3 className="font-pixel text-pixel-md text-gold">Connection</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-primary font-readable font-medium">Slack Integration Enabled</p>
              <p className="text-text-secondary text-sm font-readable">Monitor Slack channels automatically</p>
            </div>
            <button
              onClick={handleToggleEnabled}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config?.enabled ? 'bg-green-600' : 'bg-stone-600'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                config?.enabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Bot Token */}
          <div>
            <label className="block text-text-secondary text-sm font-readable mb-1">Bot Token</label>
            <div className="flex gap-3">
              <input
                type="password"
                value={botToken}
                onChange={(e) => { setBotToken(e.target.value); setTokenDirty(true); }}
                placeholder="xoxb-..."
                className="flex-1 px-3 py-2 bg-stone-primary border border-border-gold/40 rounded text-text-primary font-readable text-sm focus:outline-none focus:border-gold placeholder:text-text-secondary/50"
              />
              <button
                onClick={testConnection}
                disabled={isTesting || !botToken}
                className={`stone-button px-4 flex items-center gap-2 ${!botToken ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isTesting ? (
                  <>
                    <span className="animate-spin">&#8635;</span>
                    <span>Testing...</span>
                  </>
                ) : (
                  <span>Test Connection</span>
                )}
              </button>
            </div>
            {testResult && (
              <div className={`mt-2 px-3 py-2 rounded text-sm font-readable ${
                testResult.success
                  ? 'bg-green-900/30 text-green-400'
                  : 'bg-red-900/30 text-red-400'
              }`}>
                {testResult.success
                  ? `Connected to workspace: ${testResult.teamName || 'Unknown'}`
                  : `Connection failed: ${testResult.error || 'Unknown error'}`
                }
              </div>
            )}
          </div>

          {/* Sync Interval */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-primary font-readable font-medium">Sync Interval</p>
              <p className="text-text-secondary text-sm font-readable">Minutes between channel syncs</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={1440}
                value={syncInterval}
                onChange={(e) => handleSyncIntervalChange(Math.max(5, parseInt(e.target.value) || 5))}
                className="w-20 px-3 py-1.5 bg-stone-primary border border-border-gold/40 rounded text-text-primary font-readable text-sm text-center focus:outline-none focus:border-gold"
              />
              <span className="text-text-secondary text-sm font-readable">min</span>
            </div>
          </div>

          {/* Save */}
          {tokenDirty && (
            <div className="flex justify-end">
              <button
                onClick={handleSaveToken}
                disabled={isSaving}
                className="stone-button px-6"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          )}

          {/* Sync Status */}
          {syncState && (
            <div className="bg-stone-primary/40 rounded p-3">
              <p className="text-text-secondary text-sm font-readable">
                Last sync: {syncState.lastSyncAt ? formatTime(syncState.lastSyncAt) : 'Never'}
                {syncState.lastError && (
                  <span className="text-red-400 ml-3">Last error: {syncState.lastError}</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Channel Monitoring */}
      <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
        <div className="px-4 py-3 border-b border-border-gold/30 flex items-center justify-between">
          <h3 className="font-pixel text-pixel-md text-gold">Channels</h3>
          <span className="text-text-secondary text-sm font-readable">
            {channels.filter((c) => c.isMonitored).length} monitored
          </span>
        </div>
        {isLoading ? (
          <div className="text-text-secondary text-center py-8 font-readable">Loading channels...</div>
        ) : channels.length === 0 ? (
          <div className="text-text-secondary text-center py-8 font-readable">
            No channels found. Connect Slack and sync to discover channels.
          </div>
        ) : (
          <div className="divide-y divide-border-gold/10">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-stone-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-text-secondary">#</span>
                  <span className="font-readable text-text-primary">{channel.name}</span>
                  <span className="text-text-secondary text-xs font-readable">
                    {channel.messageCount} messages
                  </span>
                </div>
                <button
                  onClick={() => toggleMonitoring(channel.id, !channel.isMonitored)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    channel.isMonitored ? 'bg-green-600' : 'bg-stone-600'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    channel.isMonitored ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Mappings */}
      {userMappings.length > 0 && (
        <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
          <div className="px-4 py-3 border-b border-border-gold/30">
            <h3 className="font-pixel text-pixel-md text-gold">User Mappings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-readable">
              <thead>
                <tr className="border-b border-border-gold/20 text-text-secondary text-left">
                  <th className="px-4 py-2 font-medium">Slack User</th>
                  <th className="px-4 py-2 font-medium">Team Member</th>
                </tr>
              </thead>
              <tbody>
                {userMappings.map((mapping) => (
                  <tr
                    key={mapping.slackUserId}
                    className="border-b border-border-gold/10 hover:bg-stone-primary/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-text-primary">
                      {mapping.slackDisplayName || mapping.slackUserId}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={mapping.teamMemberId || ''}
                        onChange={(e) => updateUserMapping(
                          mapping.slackUserId,
                          e.target.value || null
                        )}
                        className="px-2 py-1 bg-stone-primary border border-border-gold/40 rounded text-text-primary text-sm focus:outline-none focus:border-gold"
                      >
                        <option value="">-- Not Mapped --</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Insights */}
      <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
        <div className="px-4 py-3 border-b border-border-gold/30 flex items-center justify-between">
          <h3 className="font-pixel text-pixel-md text-gold">Recent Insights</h3>
          <span className="text-text-secondary text-sm font-readable">
            {insights.length} insights
          </span>
        </div>
        {insights.length === 0 ? (
          <div className="text-text-secondary text-center py-8 font-readable">
            No insights detected yet. Monitor channels and sync to discover insights.
          </div>
        ) : (
          <div className="divide-y divide-border-gold/10">
            {insights.map((insight) => {
              const style = INSIGHT_TYPE_STYLES[insight.type] || INSIGHT_TYPE_STYLES.update;
              return (
                <div key={insight.id} className="px-4 py-3 hover:bg-stone-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-pixel ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    {insight.jiraKey && (
                      <span className="px-2 py-0.5 bg-purple-900/40 text-purple-400 rounded text-xs font-pixel">
                        {insight.jiraKey}
                      </span>
                    )}
                    <span className="text-text-secondary text-xs font-readable">
                      {formatTime(insight.createdAt)}
                    </span>
                  </div>
                  <p className="font-readable text-text-primary text-sm">{insight.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
