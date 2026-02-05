import type { EngineerStatus, EngineerStatusType } from '@jira-planner/shared';
import { EngineerCard } from './EngineerCard';

interface EngineerStatusGridProps {
  engineers: EngineerStatus[];
  isLoading: boolean;
  selectedEngineerId: string | null;
  onSelectEngineer: (id: string | null) => void;
}

// Sort priority: critical issues first, then stale, then idle, then active
const statusPriority: Record<EngineerStatusType, number> = {
  inactive: 0,
  underutilized: 1,
  idle: 2,
  active: 3,
};

function sortEngineers(engineers: EngineerStatus[]): EngineerStatus[] {
  return [...engineers].sort((a, b) => {
    // First, sort by needsAttention (attention-needing engineers first)
    if (a.needsAttention && !b.needsAttention) return -1;
    if (!a.needsAttention && b.needsAttention) return 1;

    // Then by status priority
    const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
    if (priorityDiff !== 0) return priorityDiff;

    // Finally by name
    return a.memberName.localeCompare(b.memberName);
  });
}

export function EngineerStatusGrid({
  engineers,
  isLoading,
  selectedEngineerId,
  onSelectEngineer,
}: EngineerStatusGridProps) {
  if (isLoading) {
    return (
      <div className="stone-card p-6">
        <h3 className="font-pixel text-pixel-md text-gold mb-4">Squad Status</h3>
        <div className="flex items-center justify-center h-48">
          <span className="text-beige/60 animate-pulse">Loading engineers...</span>
        </div>
      </div>
    );
  }

  if (engineers.length === 0) {
    return (
      <div className="stone-card p-6">
        <h3 className="font-pixel text-pixel-md text-gold mb-4">Squad Status</h3>
        <div className="flex items-center justify-center h-48">
          <span className="text-beige/60">No engineers found</span>
        </div>
      </div>
    );
  }

  const sortedEngineers = sortEngineers(engineers);
  const attentionCount = engineers.filter((e) => e.needsAttention).length;

  return (
    <div className="stone-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-pixel text-pixel-md text-gold">Squad Status</h3>
        {attentionCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-1 rounded bg-red-900/30 text-red-400 text-xs">
            <span className="animate-attention-pulse">!</span>
            <span>{attentionCount} need{attentionCount === 1 ? 's' : ''} attention</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sortedEngineers.map((engineer) => (
          <EngineerCard
            key={engineer.memberId}
            engineer={engineer}
            isSelected={engineer.memberId === selectedEngineerId}
            onClick={() =>
              onSelectEngineer(
                engineer.memberId === selectedEngineerId ? null : engineer.memberId
              )
            }
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-border-stone flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-green-600" />
          <span className="text-beige/60">Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-yellow-600" />
          <span className="text-beige/60">Idle</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-orange-600" />
          <span className="text-beige/60">Stale</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-red-600" />
          <span className="text-beige/60">Critical</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-beige/40">Click card for details</span>
        </div>
      </div>
    </div>
  );
}
