import { useMemo, useCallback, useState } from 'react';
import type { CampaignRegion, WorldConfig, WorkArea, CameraState } from '@jira-planner/shared';
import type { UnitState, CampaignAssignment } from '../../store/worldStore';

interface MiniMapProps {
  regions: CampaignRegion[];
  units: Record<string, UnitState>;
  config: WorldConfig | null;
  selectedUnitId: string | null;
  memberCampaignAssignments: Record<string, CampaignAssignment[]>;
  workAreas: WorkArea[];
  camera: CameraState;
  onPanTo: (x: number, y: number) => void;
}

// Work area colors
const AREA_COLORS: Record<string, string> = {
  'backend-tent': '#3498db',
  'frontend-tent': '#9b59b6',
  'fullstack-area': '#1abc9c',
  'ai-workshop': '#7f8c8d',
  'qa-grounds': '#27ae60',
  'supply-area': '#e67e22',
  'campfire': '#ff6b00',
};

export function MiniMap({
  regions,
  units,
  config,
  selectedUnitId,
  memberCampaignAssignments,
  workAreas,
  camera,
  onPanTo,
}: MiniMapProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const worldWidth = config?.width || 1920;
  const worldHeight = config?.height || 1280;

  // Calculate proportional minimap size based on aspect ratio
  const aspectRatio = worldWidth / worldHeight;
  const miniMapWidth = 220; // Slightly smaller for overlay
  const miniMapHeight = Math.round(miniMapWidth / aspectRatio);

  const scaleX = miniMapWidth / worldWidth;
  const scaleY = miniMapHeight / worldHeight;

  // Viewport dimensions (approximate)
  const viewportWidth = 1200;
  const viewportHeight = 800;

  // Handle click to pan camera
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scaleX;
      const y = (e.clientY - rect.top) / scaleY;
      onPanTo(x, y);
    },
    [scaleX, scaleY, onPanTo]
  );

  // Pre-calculate connection lines for SVG
  const connectionLines = useMemo(() => {
    const lines: Array<{
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      active: boolean;
      strokeWidth: number;
    }> = [];

    Object.entries(memberCampaignAssignments).forEach(([memberId, assignments]) => {
      const unit = units[memberId];
      if (!unit) return;

      assignments.forEach((assignment) => {
        const region = regions.find((r) => r.epicId === assignment.epicId);
        if (!region) return;

        const regionCenterX = region.bounds.x + region.bounds.width / 2;
        const regionCenterY = region.bounds.y + region.bounds.height / 2;

        lines.push({
          key: `${memberId}-${assignment.epicId}`,
          x1: unit.x * scaleX,
          y1: unit.y * scaleY,
          x2: regionCenterX * scaleX,
          y2: regionCenterY * scaleY,
          color: region.color,
          active: assignment.hasActiveWork,
          strokeWidth: Math.min(1 + assignment.ticketCount * 0.5, 3),
        });
      });
    });

    return lines;
  }, [memberCampaignAssignments, units, regions, scaleX, scaleY]);

  return (
    <div className="stone-panel p-2 bg-stone-primary/90 backdrop-blur-sm">
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-pixel text-pixel-sm text-gold">Map</h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-beige/60 hover:text-gold text-sm px-1"
          title={isCollapsed ? 'Expand map' : 'Collapse map'}
        >
          {isCollapsed ? '▲' : '▼'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div
            className="relative border border-border-gold/30 rounded overflow-hidden cursor-pointer"
            style={{
              width: miniMapWidth,
              height: miniMapHeight,
              backgroundColor: '#4a6741', // Grass color
            }}
            onClick={handleClick}
          >
            {/* Work Areas */}
            {workAreas.map((area) => (
              <div
                key={area.id}
                className="absolute rounded-full opacity-60"
                style={{
                  left: area.position.x * scaleX - area.radius * scaleX,
                  top: area.position.y * scaleY - area.radius * scaleY,
                  width: area.radius * 2 * scaleX,
                  height: area.radius * 2 * scaleY,
                  backgroundColor: AREA_COLORS[area.id] || '#4a4136',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                }}
                title={area.name}
              />
            ))}

            {/* SVG layer for connection lines */}
            <svg
              className="absolute inset-0"
              width={miniMapWidth}
              height={miniMapHeight}
              style={{ pointerEvents: 'none' }}
            >
              {connectionLines.map((line) => (
                <line
                  key={line.key}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth}
                  strokeOpacity={line.active ? 0.8 : 0.3}
                  className={line.active ? 'connection-line-active' : ''}
                />
              ))}
            </svg>

            {/* Units */}
            {Object.values(units).map((unit) => {
              const hasAssignments = memberCampaignAssignments[unit.memberId]?.length > 0;
              const hasActiveWork = memberCampaignAssignments[unit.memberId]?.some(
                (a) => a.hasActiveWork
              );

              return (
                <div
                  key={unit.memberId}
                  className={`absolute rounded-full transition-all ${
                    unit.memberId === selectedUnitId
                      ? 'ring-2 ring-gold ring-offset-1 ring-offset-stone-primary'
                      : ''
                  } ${hasActiveWork ? 'animate-pulse' : ''}`}
                  style={{
                    left: unit.x * scaleX - 3,
                    top: unit.y * scaleY - 3,
                    width: 6,
                    height: 6,
                    backgroundColor: getUnitMiniMapColor(unit.activityState),
                    boxShadow: hasAssignments ? '0 0 4px rgba(255, 215, 0, 0.5)' : 'none',
                  }}
                />
              );
            })}

            {/* Viewport indicator */}
            <div
              className="absolute border-2 border-white/50 pointer-events-none"
              style={{
                left: camera.x * scaleX,
                top: camera.y * scaleY,
                width: (viewportWidth / camera.zoom) * scaleX,
                height: (viewportHeight / camera.zoom) * scaleY,
                boxShadow: '0 0 4px rgba(255, 255, 255, 0.3)',
              }}
            />
          </div>

          {/* Compact legend */}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-beige/50">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Idle</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Work</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Move</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getUnitMiniMapColor(state: UnitState['activityState']): string {
  switch (state) {
    case 'idle':
      return '#4A90D9';
    case 'working':
      return '#4AD94A';
    case 'walking':
      return '#D9D94A';
    case 'completing':
      return '#FFD700';
    case 'leveling_up':
      return '#FF6B6B';
    default:
      return '#4A90D9';
  }
}
