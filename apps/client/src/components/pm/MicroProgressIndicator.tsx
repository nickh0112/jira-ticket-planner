interface MicroProgressIndicatorProps {
  lastActivityAt: string | null;
  showIcon?: boolean;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function getActivityColor(dateString: string | null): {
  textColor: string;
  icon: string;
  status: 'active' | 'recent' | 'stale' | 'inactive';
} {
  if (!dateString) {
    return { textColor: 'text-beige/40', icon: '💤', status: 'inactive' };
  }

  const date = new Date(dateString);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 4) {
    return { textColor: 'text-green-400', icon: '⚡', status: 'active' };
  }
  if (diffHours < 24) {
    return { textColor: 'text-yellow-400', icon: '⚡', status: 'recent' };
  }
  if (diffHours < 72) {
    return { textColor: 'text-orange-400', icon: '💤', status: 'stale' };
  }
  return { textColor: 'text-red-400', icon: '💤', status: 'inactive' };
}

export function MicroProgressIndicator({
  lastActivityAt,
  showIcon = true,
}: MicroProgressIndicatorProps) {
  const { textColor, icon, status } = getActivityColor(lastActivityAt);
  const timeAgo = lastActivityAt ? formatTimeAgo(lastActivityAt) : 'no activity';

  return (
    <div
      className={`flex items-center gap-1 text-xs ${textColor}`}
      title={`Last activity: ${lastActivityAt ? new Date(lastActivityAt).toLocaleString() : 'never'}`}
    >
      {showIcon && <span>{icon}</span>}
      <span className={status === 'active' ? 'font-medium' : ''}>{timeAgo}</span>
    </div>
  );
}
