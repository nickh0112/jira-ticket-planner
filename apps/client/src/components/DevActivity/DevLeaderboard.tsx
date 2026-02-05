import { useState, useEffect } from 'react';
import { getBitbucketLeaderboard, getBitbucketMetrics } from '../../utils/api';
import type { BitbucketLeaderboardEntry, BitbucketEngineerMetrics } from '@jira-planner/shared';

export function DevLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<BitbucketLeaderboardEntry[]>([]);
  const [metrics, setMetrics] = useState<BitbucketEngineerMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'leaderboard' | 'metrics'>('leaderboard');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leaderboardData, metricsData] = await Promise.all([
        getBitbucketLeaderboard(),
        getBitbucketMetrics(),
      ]);
      setLeaderboard(leaderboardData);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="stone-panel p-8 text-center">
        <div className="text-beige/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="stone-panel p-4">
      {/* View Toggle */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setView('leaderboard')}
          className={`stone-tab ${view === 'leaderboard' ? 'stone-tab-active' : ''}`}
        >
          XP Leaderboard
        </button>
        <button
          onClick={() => setView('metrics')}
          className={`stone-tab ${view === 'metrics' ? 'stone-tab-active' : ''}`}
        >
          All Metrics
        </button>
      </div>

      {view === 'leaderboard' ? (
        <LeaderboardView entries={leaderboard} />
      ) : (
        <MetricsView metrics={metrics} />
      )}
    </div>
  );
}

function LeaderboardView({ entries }: { entries: BitbucketLeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-beige/60 py-8">
        No leaderboard data yet. Sync Bitbucket and start earning XP!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <div
          key={entry.teamMemberId}
          className={`p-3 rounded border ${
            index < 3
              ? 'border-gold/50 bg-stone-primary/50'
              : 'border-border-gold/20 bg-stone-primary/30'
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Rank */}
            <div
              className={`w-8 h-8 flex items-center justify-center rounded font-pixel text-pixel-sm ${
                index === 0
                  ? 'bg-gold text-stone-primary'
                  : index === 1
                  ? 'bg-gray-300 text-stone-primary'
                  : index === 2
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-secondary text-beige/60'
              }`}
            >
              {index + 1}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-beige">{entry.memberName}</span>
                {entry.bitbucketUsername && (
                  <span className="text-xs text-beige/40">@{entry.bitbucketUsername}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-beige/50">
                <span>{entry.prsMerged} PRs merged</span>
                <span>{entry.prsReviewed} reviews</span>
                <span>{entry.commits} commits</span>
              </div>
            </div>

            {/* XP */}
            <div className="text-right">
              <div className="font-pixel text-pixel-sm text-gold">{entry.totalXP} XP</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricsView({ metrics }: { metrics: BitbucketEngineerMetrics[] }) {
  if (metrics.length === 0) {
    return (
      <div className="text-center text-beige/60 py-8">
        No metrics data yet. Map team members to Bitbucket usernames and sync.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-border-gold/30">
            <th className="pb-2 text-beige/50">Engineer</th>
            <th className="pb-2 text-beige/50 text-center">PRs Opened</th>
            <th className="pb-2 text-beige/50 text-center">PRs Merged</th>
            <th className="pb-2 text-beige/50 text-center">Reviews</th>
            <th className="pb-2 text-beige/50 text-center">Commits</th>
            <th className="pb-2 text-beige/50 text-right">Total XP</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr
              key={m.teamMemberId}
              className="border-b border-border-gold/10 hover:bg-stone-primary/30"
            >
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <span className="text-beige">{m.memberName}</span>
                  {m.bitbucketUsername && (
                    <span className="text-xs text-beige/40">@{m.bitbucketUsername}</span>
                  )}
                </div>
              </td>
              <td className="py-2 text-center text-beige/70">{m.prsOpened}</td>
              <td className="py-2 text-center text-beige/70">{m.prsMerged}</td>
              <td className="py-2 text-center text-beige/70">{m.prsReviewed}</td>
              <td className="py-2 text-center text-beige/70">{m.commits}</td>
              <td className="py-2 text-right font-pixel text-gold">{m.totalXP}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
