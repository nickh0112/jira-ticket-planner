import type { PMAlert, EngineerStatus } from '@jira-planner/shared';
import { usePMStore } from '../../store/pmStore';

interface AlertPanelProps {
  alerts: PMAlert[];
  engineers: EngineerStatus[];
}

export function AlertPanel({ alerts, engineers }: AlertPanelProps) {
  const { dismissAlert, setSelectedEngineerId } = usePMStore();

  const getEngineerName = (memberId: string) => {
    const engineer = engineers.find((e) => e.memberId === memberId);
    return engineer?.memberName || 'Unknown';
  };

  const getAlertIcon = (type: string, severity: string) => {
    if (severity === 'critical') {
      return '&#128680;'; // Red rotating light
    }
    return type === 'no_assignment' ? '&#128203;' : '&#128164;'; // Clipboard or Zzz
  };

  const getSeverityColor = (severity: string) => {
    return severity === 'critical'
      ? 'border-red-500/50 bg-red-900/20'
      : 'border-orange-500/50 bg-orange-900/20';
  };

  return (
    <div className="stone-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-pixel text-pixel-md text-gold">Alerts</h3>
        {alerts.length > 0 && (
          <span className="px-2 py-0.5 bg-red-600/80 text-white text-xs rounded">
            {alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <span className="text-4xl mb-2">&#9989;</span>
          <p className="text-beige/60">All clear! No alerts.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`
                p-3 rounded-lg border-2 transition-all
                ${getSeverityColor(alert.severity)}
              `}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-lg"
                    dangerouslySetInnerHTML={{
                      __html: getAlertIcon(alert.alertType, alert.severity),
                    }}
                  />
                  <span className="font-readable text-beige font-medium">
                    {getEngineerName(alert.teamMemberId)}
                  </span>
                </div>
                <span
                  className={`
                    px-2 py-0.5 text-xs rounded uppercase
                    ${alert.severity === 'critical'
                      ? 'bg-red-600 text-white'
                      : 'bg-orange-600 text-white'
                    }
                  `}
                >
                  {alert.severity}
                </span>
              </div>

              {/* Message */}
              <p className="text-sm text-beige/80 mb-3">{alert.message}</p>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedEngineerId(alert.teamMemberId)}
                  className="flex-1 px-3 py-1.5 text-sm bg-stone-secondary border border-border-stone rounded hover:border-gold transition-colors text-beige"
                >
                  View Engineer
                </button>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="px-3 py-1.5 text-sm bg-stone-secondary border border-border-stone rounded hover:border-red-500 transition-colors text-beige/60 hover:text-red-400"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
