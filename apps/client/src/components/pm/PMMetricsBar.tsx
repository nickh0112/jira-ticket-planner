import type { PMMetrics } from '@jira-planner/shared';

interface PMMetricsBarProps {
  metrics: PMMetrics;
}

export function PMMetricsBar({ metrics }: PMMetricsBarProps) {
  const metricItems = [
    {
      label: 'Total Engineers',
      value: metrics.totalEngineers,
      icon: '&#128101;', // Group icon
    },
    {
      label: 'Active',
      value: metrics.activeEngineers,
      icon: '&#9989;', // Check mark
      color: 'text-green-400',
    },
    {
      label: 'Idle/Underutilized',
      value: metrics.idleEngineers,
      icon: '&#9888;', // Warning
      color: metrics.idleEngineers > 0 ? 'text-orange-400' : 'text-beige',
    },
    {
      label: 'Completed Today',
      value: metrics.ticketsCompletedToday,
      icon: '&#128203;', // Clipboard
    },
    {
      label: 'Completed This Week',
      value: metrics.ticketsCompletedThisWeek,
      icon: '&#128197;', // Calendar
    },
    {
      label: 'Avg Completion Time',
      value: metrics.avgTeamCompletionTime
        ? `${metrics.avgTeamCompletionTime.toFixed(1)}h`
        : '--',
      icon: '&#9201;', // Timer
    },
    {
      label: 'Active Alerts',
      value: metrics.alertsCount,
      icon: '&#128276;', // Bell
      color: metrics.alertsCount > 0 ? 'text-red-400' : 'text-beige',
    },
  ];

  return (
    <div className="stone-card p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {metricItems.map((item, index) => (
          <div
            key={item.label}
            className={`
              flex items-center gap-3
              ${index < metricItems.length - 1 ? 'pr-4 border-r border-border-stone' : ''}
            `}
          >
            <span
              className="text-2xl"
              dangerouslySetInnerHTML={{ __html: item.icon }}
            />
            <div>
              <p className="text-xs text-beige/60 uppercase tracking-wide">
                {item.label}
              </p>
              <p className={`text-xl font-pixel ${item.color || 'text-beige'}`}>
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
