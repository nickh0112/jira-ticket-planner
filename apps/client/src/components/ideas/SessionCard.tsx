import type { IdeaSession } from '@jira-planner/shared';

interface SessionCardProps {
  session: IdeaSession;
  isActive: boolean;
  onClick: () => void;
  onArchive: () => void;
}

const statusConfig = {
  brainstorming: { label: 'Brainstorming', color: 'bg-blue-500/20 text-blue-300', icon: '💭' },
  prd_generated: { label: 'Blueprint', color: 'bg-purple-500/20 text-purple-300', icon: '📜' },
  tickets_created: { label: 'Quests Ready', color: 'bg-green-500/20 text-green-300', icon: '✅' },
  archived: { label: 'Archived', color: 'bg-stone-500/20 text-stone-400', icon: '📦' },
};

export function SessionCard({ session, isActive, onClick, onArchive }: SessionCardProps) {
  const status = statusConfig[session.status];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
      }
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg cursor-pointer transition-all border ${
        isActive
          ? 'bg-gold/10 border-gold/50'
          : 'bg-stone-700/30 border-transparent hover:bg-stone-700/50 hover:border-stone-500'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium truncate ${isActive ? 'text-gold' : 'text-beige'}`}>
            {session.title}
          </h4>
          {session.summary && (
            <p className="text-xs text-beige/50 truncate mt-1">
              {session.summary}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          className="p-1 text-beige/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Archive"
        >
          ×
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
          {status.icon} {status.label}
        </span>
        <span className="text-xs text-beige/40">
          {formatDate(session.updatedAt)}
        </span>
      </div>
    </div>
  );
}
