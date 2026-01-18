import { useEffect, useState } from 'react';
import type { TeamMember, Epic, CampaignRegion, WorkArea } from '@jira-planner/shared';
import type { UnitState } from '../../store/worldStore';
import { getMemberProgress } from '../../utils/api';
import { calculateMemberLevel } from '../../store/memberProgressStore';
import { findWorkAreaForRole, getWorkAreas } from '../../utils/tilemapLoader';

interface UnitInfoPanelProps {
  unit: UnitState;
  member: TeamMember;
  epics: Epic[];
  regions: CampaignRegion[];
  onClose: () => void;
}

export function UnitInfoPanel({
  unit,
  member,
  epics,
  regions,
  onClose,
}: UnitInfoPanelProps) {
  const [progress, setProgress] = useState<{
    xp: number;
    level: number;
    title: string;
    ticketsCompleted: number;
  } | null>(null);

  useEffect(() => {
    getMemberProgress(member.id)
      .then(setProgress)
      .catch(console.error);
  }, [member.id]);

  const currentRegion = regions.find((r) => r.epicId === unit.currentEpicId);
  const currentEpic = currentRegion
    ? epics.find((e) => e.id === currentRegion.epicId)
    : null;

  // Find work area for this unit's role
  const workArea = findWorkAreaForRole(member.role);

  // Find closest work area to current position
  const allWorkAreas = getWorkAreas();
  let closestArea: WorkArea | null = null;
  let closestDist = Infinity;
  for (const area of allWorkAreas) {
    const dist = Math.sqrt(
      (unit.x - area.position.x) ** 2 + (unit.y - area.position.y) ** 2
    );
    if (dist < area.radius + 30 && dist < closestDist) {
      closestDist = dist;
      closestArea = area;
    }
  }

  const levelInfo = progress ? calculateMemberLevel(progress.xp) : null;
  const xpProgress = levelInfo
    ? ((progress!.xp - levelInfo.currentLevelXp) /
        (levelInfo.nextLevelXp - levelInfo.currentLevelXp)) *
      100
    : 0;

  return (
    <div className="stone-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-pixel text-pixel-md text-gold">{member.name}</h3>
        <button
          onClick={onClose}
          className="text-beige/60 hover:text-beige text-lg"
        >
          X
        </button>
      </div>

      {/* Role */}
      <div className="text-sm text-beige/80 mb-3">{member.role}</div>

      {/* Progress */}
      {progress && levelInfo && (
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gold">Level {progress.level}</span>
            <span className="text-beige/60">{progress.title}</span>
          </div>

          {/* XP Bar */}
          <div className="h-4 bg-stone-primary rounded-sm border border-border-gold/30 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold/60 to-gold transition-all duration-500"
              style={{ width: `${xpProgress}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-beige/50">
            <span>{progress.xp} XP</span>
            <span>{levelInfo.nextLevelXp} XP</span>
          </div>

          <div className="text-sm text-beige/70">
            Tickets Completed: {progress.ticketsCompleted}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="border-t border-border-gold/30 pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-beige/60">Status:</span>
          <span
            className={`text-sm font-medium ${getStatusColor(
              unit.activityState
            )}`}
          >
            {getStatusText(unit.activityState)}
          </span>
        </div>

        {currentEpic && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-beige/60">Working on:</span>
            <span className="text-sm text-gold">{currentEpic.name}</span>
          </div>
        )}

        {closestArea && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-beige/60">Location:</span>
            <span className="text-sm text-beige/80">{closestArea.name}</span>
          </div>
        )}

        {workArea && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-beige/60">Assigned area:</span>
            <span className="text-sm text-gold">{workArea.name}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-beige/60">Position:</span>
          <span className="text-sm text-beige/80">
            ({Math.round(unit.x)}, {Math.round(unit.y)})
          </span>
        </div>
      </div>

      {/* Skills */}
      {member.skills.length > 0 && (
        <div className="border-t border-border-gold/30 pt-3 mt-3">
          <div className="text-sm text-beige/60 mb-2">Skills:</div>
          <div className="flex flex-wrap gap-1">
            {member.skills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 text-xs bg-stone-primary rounded border border-border-gold/30 text-beige/80"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusText(state: UnitState['activityState']): string {
  switch (state) {
    case 'idle':
      return 'Idle at Basecamp';
    case 'walking':
      return 'Moving...';
    case 'working':
      return 'Working';
    case 'completing':
      return 'Completing Task!';
    case 'leveling_up':
      return 'LEVEL UP!';
    default:
      return 'Unknown';
  }
}

function getStatusColor(state: UnitState['activityState']): string {
  switch (state) {
    case 'idle':
      return 'text-blue-400';
    case 'walking':
      return 'text-yellow-400';
    case 'working':
      return 'text-green-400';
    case 'completing':
      return 'text-gold';
    case 'leveling_up':
      return 'text-red-400 animate-pulse';
    default:
      return 'text-beige';
  }
}
