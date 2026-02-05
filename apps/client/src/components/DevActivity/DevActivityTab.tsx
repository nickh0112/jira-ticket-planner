import { useState, useEffect } from 'react';
import { PRList } from './PRList';
import { CommitFeed } from './CommitFeed';
import { PipelineStatus } from './PipelineStatus';
import { DevLeaderboard } from './DevLeaderboard';
import { BitbucketSettings } from './BitbucketSettings';
import {
  getBitbucketConfig,
  getBitbucketSyncStatus,
  triggerBitbucketSync,
} from '../../utils/api';

type SubTab = 'activity' | 'prs' | 'commits' | 'pipelines' | 'leaderboard' | 'settings';

export function DevActivityTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('activity');
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const { config } = await getBitbucketConfig();
      setIsConfigured(!!config);

      if (config) {
        const status = await getBitbucketSyncStatus();
        setLastSync(status.syncState.lastSuccessfulSyncAt);
      }
    } catch {
      setIsConfigured(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await triggerBitbucketSync();
      const status = await getBitbucketSyncStatus();
      setLastSync(status.syncState.lastSuccessfulSyncAt);
    } finally {
      setIsSyncing(false);
    }
  };

  const subTabs = [
    { key: 'activity' as const, label: 'Activity' },
    { key: 'prs' as const, label: 'Pull Requests' },
    { key: 'commits' as const, label: 'Commits' },
    { key: 'pipelines' as const, label: 'Pipelines' },
    { key: 'leaderboard' as const, label: 'Leaderboard' },
    { key: 'settings' as const, label: 'Settings' },
  ];

  if (isConfigured === null) {
    return (
      <div className="stone-panel p-8 text-center">
        <div className="text-beige/60">Loading...</div>
      </div>
    );
  }

  if (!isConfigured && activeSubTab !== 'settings') {
    return (
      <div className="stone-panel p-8 text-center">
        <h3 className="font-pixel text-pixel-md text-gold mb-4">Bitbucket Not Configured</h3>
        <p className="text-beige/70 mb-6">
          Connect your Bitbucket workspace to track PRs, commits, and dev activity.
        </p>
        <button
          onClick={() => setActiveSubTab('settings')}
          className="stone-button stone-button-primary"
        >
          Configure Bitbucket
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with sub-tabs */}
      <div className="stone-panel p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-pixel-lg text-gold">Dev Activity</h2>
          {isConfigured && activeSubTab !== 'settings' && (
            <div className="flex items-center gap-4">
              {lastSync && (
                <span className="text-xs text-beige/50">
                  Last sync: {new Date(lastSync).toLocaleString()}
                </span>
              )}
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="stone-button stone-button-sm"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {subTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`stone-tab ${activeSubTab === tab.key ? 'stone-tab-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeSubTab === 'activity' && <ActivityFeed />}
      {activeSubTab === 'prs' && <PRList />}
      {activeSubTab === 'commits' && <CommitFeed />}
      {activeSubTab === 'pipelines' && <PipelineStatus />}
      {activeSubTab === 'leaderboard' && <DevLeaderboard />}
      {activeSubTab === 'settings' && (
        <BitbucketSettings onConfigured={() => {
          setIsConfigured(true);
          setActiveSubTab('activity');
        }} />
      )}
    </div>
  );
}

// Combined activity feed
function ActivityFeed() {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    setIsLoading(true);
    try {
      const { getBitbucketActivity } = await import('../../utils/api');
      const data = await getBitbucketActivity(30);
      setActivities(data);
    } catch (error) {
      console.error('Failed to load activity:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="stone-panel p-8 text-center">
        <div className="text-beige/60">Loading activity...</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="stone-panel p-8 text-center">
        <h3 className="font-pixel text-pixel-md text-beige/60 mb-2">No Activity Yet</h3>
        <p className="text-beige/50 text-sm">
          Activity will appear here after syncing with Bitbucket.
        </p>
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'pr_opened': return '🔀';
      case 'pr_merged': return '✅';
      case 'pr_reviewed': return '👀';
      case 'commit': return '📝';
      case 'pipeline_completed': return '🔧';
      default: return '📌';
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'pr_opened': return 'opened PR';
      case 'pr_merged': return 'merged PR';
      case 'pr_reviewed': return 'reviewed PR';
      case 'commit': return 'committed';
      case 'pipeline_completed': return 'pipeline';
      default: return type;
    }
  };

  return (
    <div className="stone-panel p-4">
      <h3 className="font-pixel text-pixel-md text-gold mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-3 bg-stone-primary/50 rounded border border-border-gold/20"
          >
            <div className="text-xl">{getActivityIcon(activity.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-beige">
                  {activity.authorDisplayName || activity.authorUsername}
                </span>
                <span className="text-beige/50 text-sm">
                  {getActivityLabel(activity.type)}
                </span>
                {activity.jiraKey && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                    {activity.jiraKey}
                  </span>
                )}
              </div>
              <p className="text-beige/70 text-sm truncate mt-1">{activity.title}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-beige/40">
                <span>{activity.repoSlug}</span>
                <span>•</span>
                <span>{new Date(activity.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
