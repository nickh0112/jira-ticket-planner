import { useEffect } from 'react';
import { useMemberProgressStore, MEMBER_LEVELS } from '../store/memberProgressStore';

interface TeamLeaderboardProps {
  onClose?: () => void;
}

export function TeamLeaderboard({ onClose }: TeamLeaderboardProps) {
  const { leaderboard, isLoading, loadLeaderboard } = useMemberProgressStore();

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <div className="stone-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-pixel text-pixel-md text-gold">Leaderboard</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-beige/60 hover:text-beige text-lg"
          >
            X
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center text-beige/60 py-4">Loading...</div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center text-beige/60 py-4">
          No team members yet. Sync with Jira to get started!
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => (
            <LeaderboardEntry key={entry.id} entry={entry} rank={index + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface LeaderboardEntryProps {
  entry: {
    id: string;
    name: string;
    role: string;
    xp: number;
    level: number;
    title: string;
    ticketsCompleted: number;
  };
  rank: number;
}

function LeaderboardEntry({ entry, rank }: LeaderboardEntryProps) {
  const currentLevelXp = MEMBER_LEVELS.find((l) => l.level === entry.level)?.xp || 0;
  const nextLevel = MEMBER_LEVELS.find((l) => l.level === entry.level + 1);
  const nextLevelXp = nextLevel?.xp || MEMBER_LEVELS[MEMBER_LEVELS.length - 1].xp;
  const xpProgress =
    ((entry.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  return (
    <div
      className={`p-3 rounded border ${
        rank <= 3
          ? 'border-gold/50 bg-stone-primary/50'
          : 'border-border-gold/20 bg-stone-primary/30'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Rank */}
        <div
          className={`w-8 h-8 flex items-center justify-center rounded font-pixel text-pixel-sm ${
            rank === 1
              ? 'bg-gold text-stone-primary'
              : rank === 2
              ? 'bg-gray-300 text-stone-primary'
              : rank === 3
              ? 'bg-amber-600 text-white'
              : 'bg-stone-secondary text-beige/60'
          }`}
        >
          {rank}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-beige truncate">{entry.name}</span>
            <span className="text-xs text-beige/50 truncate">{entry.role}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gold">Lv.{entry.level}</span>
            <span className="text-xs text-beige/60">{entry.title}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="text-right">
          <div className="font-pixel text-pixel-sm text-gold">{entry.xp} XP</div>
          <div className="text-xs text-beige/50">
            {entry.ticketsCompleted} tickets
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="mt-2 h-1.5 bg-stone-primary rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold/50 to-gold transition-all duration-300"
          style={{ width: `${Math.min(100, xpProgress)}%` }}
        />
      </div>
    </div>
  );
}
