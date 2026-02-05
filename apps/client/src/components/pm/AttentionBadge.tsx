import type { AttentionReason } from '@jira-planner/shared';

interface AttentionBadgeProps {
  reasons: AttentionReason[];
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const reasonLabels: Record<AttentionReason, string> = {
  no_active_work: 'No active work assigned',
  stale_ticket: 'Ticket stuck for too long',
  overloaded: 'Too many tickets assigned',
  long_idle: 'No recent activity',
  blocked: 'Blocked on something',
};

const severityOrder: AttentionReason[] = [
  'blocked',
  'long_idle',
  'stale_ticket',
  'no_active_work',
  'overloaded',
];

export function AttentionBadge({
  reasons,
  size = 'md',
  showTooltip = true,
}: AttentionBadgeProps) {
  if (reasons.length === 0) return null;

  // Sort by severity and get the most critical
  const sortedReasons = [...reasons].sort(
    (a, b) => severityOrder.indexOf(a) - severityOrder.indexOf(b)
  );
  const primaryReason = sortedReasons[0];

  // Determine severity color based on primary reason
  const isCritical = ['blocked', 'long_idle'].includes(primaryReason);

  const sizeClasses = {
    sm: 'w-4 h-4 text-[10px]',
    md: 'w-5 h-5 text-xs',
    lg: 'w-6 h-6 text-sm',
  };

  const tooltipContent = sortedReasons.map((r) => reasonLabels[r]).join('\n');

  return (
    <div
      className={`
        ${sizeClasses[size]}
        flex items-center justify-center
        rounded-full font-bold
        ${isCritical
          ? 'bg-red-500 text-white animate-attention-pulse'
          : 'bg-orange-500 text-white animate-attention-pulse-soft'
        }
        cursor-help
      `}
      title={showTooltip ? tooltipContent : undefined}
    >
      !
    </div>
  );
}
