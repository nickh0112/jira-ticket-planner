import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useWorldStore } from '../../store/worldStore';
import { useMemberProgressStore } from '../../store/memberProgressStore';
import { useSyncEvents } from '../../hooks/useSyncEvents';
import { WorldCanvas } from './WorldCanvas';
import { UnitInfoPanel } from './UnitInfoPanel';
import { MiniMap } from './MiniMap';
import { TeamLeaderboard } from '../TeamLeaderboard';
import { getSyncStatus, triggerSync, updateSyncConfig } from '../../utils/api';
import type { JiraSyncState } from '@jira-planner/shared';

export function RTSWorldView() {
  const { teamMembers, epics, showToast } = useStore();
  const {
    config,
    regions,
    units,
    selectedUnitId,
    isLoading,
    loadWorldState,
    initializeUnits,
    selectUnit,
    memberCampaignAssignments,
    basecampMapData,
    workAreas,
    camera,
    panCameraTo,
  } = useWorldStore();
  const { loadLeaderboard, loadLevelUpEvents } = useMemberProgressStore();

  const [syncStatus, setSyncStatus] = useState<{
    isRunning: boolean;
    syncState: JiraSyncState;
    hasTimer: boolean;
  } | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Connect to SSE for real-time updates
  useSyncEvents({
    enabled: true,
    onSyncCompleted: (result) => {
      showToast(
        `Sync complete: ${result.ticketsProcessed} tickets, +${result.xpAwarded} XP`,
        'success'
      );
      loadLeaderboard();
      loadSyncStatus();
    },
    onSyncError: (error) => {
      showToast(`Sync error: ${error}`, 'error');
      loadSyncStatus();
    },
  });

  // Load initial data
  useEffect(() => {
    loadWorldState();
    loadLeaderboard();
    loadLevelUpEvents();
    loadSyncStatus();
  }, []);

  // Initialize units when team members or config changes
  useEffect(() => {
    if (config && teamMembers.length > 0) {
      initializeUnits(teamMembers, epics);
    }
  }, [config, teamMembers, epics, initializeUnits]);

  const loadSyncStatus = async () => {
    try {
      const status = await getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const result = await triggerSync();
      if (result.success) {
        showToast(
          `Synced ${result.ticketsProcessed} tickets, awarded ${result.xpAwarded} XP`,
          'success'
        );
        loadLeaderboard();
      } else {
        showToast(`Sync failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showToast('Sync failed', 'error');
    } finally {
      setIsSyncing(false);
      loadSyncStatus();
    }
  };

  const handleToggleAutoSync = async () => {
    if (!syncStatus) return;
    try {
      await updateSyncConfig({
        syncEnabled: !syncStatus.syncState.syncEnabled,
      });
      loadSyncStatus();
      showToast(
        syncStatus.syncState.syncEnabled
          ? 'Auto-sync disabled'
          : 'Auto-sync enabled',
        'success'
      );
    } catch (error) {
      showToast('Failed to update sync settings', 'error');
    }
  };

  const selectedUnit = selectedUnitId ? units[selectedUnitId] : null;
  const selectedMember = selectedUnitId
    ? teamMembers.find((m) => m.id === selectedUnitId)
    : null;

  // Calculate stats for display
  const activeWorkers = Object.values(memberCampaignAssignments)
    .filter((assignments) => assignments.some((a) => a.hasActiveWork))
    .length;

  if (isLoading) {
    return (
      <div className="stone-panel p-8 text-center">
        <div className="font-pixel text-gold animate-pulse">
          Loading world...
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}
    >
      {/* Full-screen canvas */}
      <WorldCanvas
        regions={regions}
        units={units}
        teamMembers={teamMembers}
        epics={epics}
        selectedUnitId={selectedUnitId}
        onSelectUnit={selectUnit}
        basecampMapData={basecampMapData}
        workAreas={workAreas}
      />

      {/* Overlaid control bar - top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="stone-panel p-3 flex flex-wrap items-center justify-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-3 text-sm text-beige/70">
            <div className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  syncStatus?.hasTimer ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                }`}
              />
              <span className="hidden sm:inline">
                {syncStatus?.hasTimer ? 'Auto-sync' : 'Sync off'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gold">{Object.keys(units).length}</span>
              <span>units</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-green-400">{activeWorkers}</span>
              <span>active</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className={`stone-button text-sm ${showLeaderboard ? 'stone-button-active' : ''}`}
            >
              🏆
            </button>

            <button
              onClick={handleToggleAutoSync}
              className={`stone-button text-sm ${
                syncStatus?.syncState.syncEnabled ? 'stone-button-active' : ''
              }`}
              title={syncStatus?.syncState.syncEnabled ? 'Disable Auto-Sync' : 'Enable Auto-Sync'}
            >
              {syncStatus?.syncState.syncEnabled ? '⏸' : '▶'}
            </button>

            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="stone-button text-sm"
              title="Sync Now"
            >
              {isSyncing ? '...' : '🔄'}
            </button>
          </div>
        </div>
      </div>

      {/* Overlaid UnitInfoPanel - top left */}
      {selectedUnit && selectedMember && (
        <div className="absolute top-4 left-4 z-10 max-w-sm">
          <UnitInfoPanel
            unit={selectedUnit}
            member={selectedMember}
            epics={epics}
            regions={regions}
            onClose={() => selectUnit(null)}
          />
        </div>
      )}

      {/* Overlaid MiniMap - bottom right */}
      <div className="absolute bottom-4 right-4 z-10">
        <MiniMap
          regions={regions}
          units={units}
          config={config}
          selectedUnitId={selectedUnitId}
          memberCampaignAssignments={memberCampaignAssignments}
          workAreas={workAreas}
          camera={camera}
          onPanTo={panCameraTo}
        />
      </div>

      {/* Overlaid Leaderboard - top right */}
      {showLeaderboard && (
        <div className="absolute top-16 right-4 z-10 max-w-sm">
          <TeamLeaderboard onClose={() => setShowLeaderboard(false)} />
        </div>
      )}

      {/* Sync status tooltip - bottom left */}
      {syncStatus?.syncState.lastSuccessfulSyncAt && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="stone-panel p-2 text-xs text-beige/50">
            Last sync:{' '}
            {new Date(syncStatus.syncState.lastSuccessfulSyncAt).toLocaleString()}
            {syncStatus.syncState.lastError && (
              <span className="text-red-400 ml-2">
                Error: {syncStatus.syncState.lastError}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
