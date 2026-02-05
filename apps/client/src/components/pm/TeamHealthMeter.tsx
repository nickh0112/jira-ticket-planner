import type { PMMetrics, EngineerStatus } from '@jira-planner/shared';

interface TeamHealthMeterProps {
  metrics: PMMetrics;
  engineers: EngineerStatus[];
}

interface HealthBarProps {
  label: string;
  current: number;
  total: number;
  color: 'green' | 'yellow' | 'red';
}

function HealthBar({ label, current, total, color }: HealthBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const segments = 10;
  const filledSegments = Math.round((percentage / 100) * segments);

  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  const bgColorClasses = {
    green: 'bg-green-900/30',
    yellow: 'bg-yellow-900/30',
    red: 'bg-red-900/30',
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-beige/70 w-20">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-4 rounded-sm ${
              i < filledSegments ? colorClasses[color] : bgColorClasses[color]
            }`}
          />
        ))}
      </div>
      <span className="text-sm text-beige font-mono w-12">
        {current}/{total}
      </span>
    </div>
  );
}

export function TeamHealthMeter({ metrics, engineers }: TeamHealthMeterProps) {
  // Calculate engineers needing help
  const needsHelpCount = engineers.filter((e) => e.needsAttention).length;

  // Calculate velocity trend (mock - could be enhanced with historical data)
  const velocityTrend = metrics.ticketsCompletedThisWeek > 0 ? '+' : '';
  const velocityPercent = metrics.ticketsCompletedThisWeek > 0
    ? Math.min(99, Math.round((metrics.ticketsCompletedThisWeek / Math.max(metrics.totalEngineers, 1)) * 20))
    : 0;

  return (
    <div className="stone-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-pixel text-pixel-sm text-gold">TEAM HEALTH</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-beige/50">Velocity:</span>
          <span
            className={`text-sm font-bold ${
              velocityPercent > 50 ? 'text-green-400' : velocityPercent > 25 ? 'text-yellow-400' : 'text-red-400'
            }`}
          >
            {velocityTrend}{velocityPercent}%
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <HealthBar
          label="Active"
          current={metrics.activeEngineers}
          total={metrics.totalEngineers}
          color="green"
        />
        <HealthBar
          label="Idle"
          current={metrics.idleEngineers}
          total={metrics.totalEngineers}
          color="yellow"
        />
        <HealthBar
          label="Needs Help"
          current={needsHelpCount}
          total={metrics.totalEngineers}
          color="red"
        />
      </div>

      {/* Quick stats row */}
      <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border-stone/30 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-beige/50">Today:</span>
          <span className="text-green-400 font-bold">{metrics.ticketsCompletedToday}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-beige/50">This Week:</span>
          <span className="text-green-400 font-bold">{metrics.ticketsCompletedThisWeek}</span>
        </div>
        {metrics.avgTeamCompletionTime !== null && (
          <div className="flex items-center gap-2">
            <span className="text-beige/50">Avg Time:</span>
            <span className="text-beige font-bold">{metrics.avgTeamCompletionTime.toFixed(1)}h</span>
          </div>
        )}
        {metrics.alertsCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-red-400">⚠️ {metrics.alertsCount} alerts</span>
          </div>
        )}
      </div>
    </div>
  );
}
