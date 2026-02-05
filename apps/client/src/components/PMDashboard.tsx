import { useEffect, useState } from 'react';
import { usePMStore } from '../store/pmStore';
import { EngineerStatusGrid } from './pm/EngineerStatusGrid';
import { AlertPanel } from './pm/AlertPanel';
import { AISuggestionsPanel } from './pm/AISuggestionsPanel';
import { TeamHealthMeter } from './pm/TeamHealthMeter';
import { PMConfigModal } from './pm/PMConfigModal';
import { EngineerCardExpanded } from './pm/EngineerCardExpanded';

export function PMDashboard() {
  const {
    engineers,
    alerts,
    metrics,
    isLoading,
    isChecking,
    selectedEngineerId,
    engineerDetail,
    isLoadingDetail,
    error,
    loadDashboard,
    loadEngineerDetail,
    runCheck,
    setError,
    setSelectedEngineerId,
    generateSuggestions,
  } = usePMStore();

  // Modal state for expanded card
  const [expandedEngineerId, setExpandedEngineerId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Load detail when expanded
  useEffect(() => {
    if (expandedEngineerId) {
      loadEngineerDetail(expandedEngineerId);
    }
  }, [expandedEngineerId, loadEngineerDetail]);

  // Get selected engineer for suggestions
  const selectedEngineer = selectedEngineerId
    ? engineers.find((e) => e.memberId === selectedEngineerId)
    : null;

  // Get expanded engineer
  const expandedEngineer = expandedEngineerId
    ? engineers.find((e) => e.memberId === expandedEngineerId)
    : null;

  // Handle card click - opens expanded view
  const handleSelectEngineer = (id: string | null) => {
    if (id) {
      setExpandedEngineerId(id);
    }
    setSelectedEngineerId(id);
  };

  // Handle generate suggestions from expanded view
  const handleGenerateSuggestions = () => {
    if (expandedEngineerId) {
      generateSuggestions(expandedEngineerId);
      setExpandedEngineerId(null); // Close modal
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-pixel text-pixel-lg text-gold">PM Command Center</h2>
          <p className="font-readable text-beige/60">
            Monitor engineer workload and productivity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PMConfigModal />
          <button
            onClick={runCheck}
            disabled={isChecking}
            className="stone-button flex items-center gap-2"
          >
            {isChecking ? (
              <>
                <span className="animate-spin">&#8635;</span>
                <span>Checking...</span>
              </>
            ) : (
              <>
                <span>&#128269;</span>
                <span>Run Check</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="stone-card bg-red-900/30 border-red-500/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-red-400">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300"
            >
              &#10005;
            </button>
          </div>
        </div>
      )}

      {/* Team Health Meter (replaces PMMetricsBar) */}
      {metrics && <TeamHealthMeter metrics={metrics} engineers={engineers} />}

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Engineer Grid */}
        <div className="col-span-2">
          <EngineerStatusGrid
            engineers={engineers}
            isLoading={isLoading}
            selectedEngineerId={selectedEngineerId}
            onSelectEngineer={handleSelectEngineer}
          />
        </div>

        {/* Right: Alert Panel */}
        <div className="col-span-1">
          <AlertPanel alerts={alerts} engineers={engineers} />
        </div>
      </div>

      {/* AI Suggestions Panel (shows when engineer is selected) */}
      {selectedEngineer && (
        <AISuggestionsPanel engineer={selectedEngineer} />
      )}

      {/* Expanded Card Modal */}
      {expandedEngineer && (
        <EngineerCardExpanded
          engineer={expandedEngineer}
          detailData={engineerDetail}
          isLoading={isLoadingDetail}
          onClose={() => setExpandedEngineerId(null)}
          onGenerateSuggestions={handleGenerateSuggestions}
        />
      )}
    </div>
  );
}
