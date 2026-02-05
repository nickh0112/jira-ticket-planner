import type { EngineerStatus, EngineerStatusType } from '@jira-planner/shared';
import { SegmentedProgressBar } from './SegmentedProgressBar';
import { AttentionBadge } from './AttentionBadge';
import { MicroProgressIndicator } from './MicroProgressIndicator';

interface EngineerCardProps {
  engineer: EngineerStatus;
  isSelected: boolean;
  onClick: () => void;
}

// Status configuration for background colors and badges
const statusConfig: Record<
  EngineerStatusType,
  { bg: string; border: string; badge: string; badgeText: string }
> = {
  active: {
    bg: 'bg-green-900/20',
    border: 'border-green-600/40',
    badge: 'bg-green-600',
    badgeText: 'Active',
  },
  idle: {
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-600/40',
    badge: 'bg-yellow-600',
    badgeText: 'Idle',
  },
  underutilized: {
    bg: 'bg-orange-900/20',
    border: 'border-orange-600/40',
    badge: 'bg-orange-600',
    badgeText: 'Stale',
  },
  inactive: {
    bg: 'bg-red-900/20',
    border: 'border-red-600/40',
    badge: 'bg-red-600',
    badgeText: 'Critical',
  },
};

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Map ticket status to display-friendly names
const statusLabels: Record<string, { label: string; color: 'blue' | 'yellow' | 'green' | 'orange' }> = {
  'In Progress': { label: 'In Progress', color: 'blue' },
  'in progress': { label: 'In Progress', color: 'blue' },
  'In Review': { label: 'In Review', color: 'yellow' },
  'in review': { label: 'In Review', color: 'yellow' },
  'Code Review': { label: 'Code Review', color: 'yellow' },
  'To Do': { label: 'To Do', color: 'orange' },
  'to do': { label: 'To Do', color: 'orange' },
  'Done': { label: 'Done', color: 'green' },
  'done': { label: 'Done', color: 'green' },
};

export function EngineerCard({ engineer, isSelected, onClick }: EngineerCardProps) {
  const config = statusConfig[engineer.status];
  const initials = getInitials(engineer.memberName);

  // Calculate total ticket segments (max 5 shown)
  const totalTickets = engineer.currentTickets;

  // Get status breakdown from ticketsByStatus
  const statusBreakdown = Object.entries(engineer.ticketsByStatus || {})
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      count,
      config: statusLabels[status] || { label: status, color: 'blue' as const },
    }));

  return (
    <button
      onClick={onClick}
      className={`
        relative w-full p-3 rounded-lg border-2 transition-all text-left
        ${config.bg} ${config.border}
        ${isSelected ? 'ring-2 ring-gold shadow-lg scale-[1.02]' : 'hover:border-beige/50'}
      `}
    >
      {/* Top row: Attention badge + Ticket segments */}
      <div className="flex items-center justify-between mb-2">
        <div className="w-5">
          {engineer.needsAttention && (
            <AttentionBadge reasons={engineer.attentionReasons} size="sm" />
          )}
        </div>
        <SegmentedProgressBar
          filled={totalTickets}
          total={Math.max(totalTickets, 5)}
          maxSegments={5}
          color={engineer.status === 'active' ? 'green' : engineer.status === 'idle' ? 'yellow' : 'orange'}
          size="sm"
          showCount={false}
        />
      </div>

      {/* Avatar + Name row */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`
            w-8 h-8 rounded flex items-center justify-center
            text-xs font-bold text-white
            ${config.badge}
          `}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-readable text-sm text-beige truncate">
            {engineer.memberName}
          </h4>
          <p className="text-xs text-beige/50 truncate">{engineer.memberRole}</p>
        </div>
      </div>

      {/* Status bars */}
      <div className="space-y-1 mb-2">
        {statusBreakdown.length > 0 ? (
          statusBreakdown.slice(0, 2).map(({ status, count, config: statusCfg }) => (
            <div key={status} className="flex items-center gap-2">
              <SegmentedProgressBar
                filled={count}
                total={5}
                maxSegments={5}
                color={statusCfg.color}
                size="sm"
                label={statusCfg.label}
                showCount={true}
              />
            </div>
          ))
        ) : (
          <div className="text-xs text-beige/40 italic">No active tickets</div>
        )}
      </div>

      {/* Bottom row: Activity + Status badge */}
      <div className="flex items-center justify-between pt-2 border-t border-border-stone/30">
        <MicroProgressIndicator lastActivityAt={engineer.lastActivityAt} />
        <span
          className={`
            px-2 py-0.5 rounded text-xs font-medium text-white
            ${config.badge}
          `}
        >
          {config.badgeText}
        </span>
      </div>
    </button>
  );
}
