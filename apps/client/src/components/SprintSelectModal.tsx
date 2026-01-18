import { useState, useEffect, useMemo } from 'react';
import type { Ticket, JiraSprint, JiraConfig } from '@jira-planner/shared';
import { getJiraSprints, getCachedSprints, getJiraConfig } from '../utils/api';
import { useStore } from '../store/useStore';
import { PixelSelect, PixelSelectOption } from './PixelSelect';

interface SprintSelectModalProps {
  ticket: Ticket;
  onConfirm: (sprintId?: number) => void;
  onCancel: () => void;
}

export function SprintSelectModal({ ticket, onConfirm, onCancel }: SprintSelectModalProps) {
  const { showToast } = useStore();
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<JiraConfig | null>(null);

  useEffect(() => {
    loadSprintsAndConfig();
  }, [ticket.ticketType]);

  const loadSprintsAndConfig = async () => {
    setIsLoading(true);
    try {
      // Get Jira config to determine which board to use
      const { config: jiraConfig } = await getJiraConfig();
      setConfig(jiraConfig);

      if (!jiraConfig) {
        showToast('Jira configuration not found', 'error');
        return;
      }

      // Determine board ID based on ticket type
      const boardId =
        ticket.ticketType === 'design' && jiraConfig.designBoardId
          ? jiraConfig.designBoardId
          : jiraConfig.defaultBoardId;

      if (!boardId) {
        showToast('No board ID configured', 'error');
        return;
      }

      // Try to get fresh sprints from Jira, fall back to cached
      try {
        const { sprints: freshSprints } = await getJiraSprints(boardId);
        setSprints(freshSprints);
      } catch {
        // Fall back to cached sprints
        const { sprints: cachedSprints } = await getCachedSprints(boardId);
        setSprints(cachedSprints);
        if (cachedSprints.length === 0) {
          showToast('No sprints found. Try syncing from Jira settings.', 'error');
        }
      }
    } catch (error) {
      showToast('Failed to load sprints', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedSprintId);
  };

  const sprintOptions = useMemo((): PixelSelectOption[] => {
    const activeSprints = sprints.filter((s) => s.state === 'active');
    const futureSprints = sprints.filter((s) => s.state === 'future');

    const options: PixelSelectOption[] = [];

    for (const sprint of activeSprints) {
      options.push({
        value: String(sprint.id),
        label: sprint.name,
        group: 'Active Sprints',
        icon: '\uD83C\uDFC3',
      });
    }

    for (const sprint of futureSprints) {
      options.push({
        value: String(sprint.id),
        label: sprint.name,
        group: 'Future Sprints',
        icon: '\uD83D\uDCC5',
      });
    }

    return options;
  }, [sprints]);

  const getBoardName = () => {
    if (!config) return 'Board';
    if (ticket.ticketType === 'design' && config.designBoardId) {
      return 'Design Board';
    }
    return 'Default Board';
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
      <div
        className="panel p-6 max-w-md w-full mx-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">rocket</span>
          <h2 className="font-pixel text-pixel-sm text-gold">CREATE IN JIRA</h2>
        </div>

        <div className="pixel-divider mb-4" />

        {/* Ticket Info */}
        <div className="mb-4 p-3 bg-stone-secondary rounded">
          <p className="font-readable text-base text-beige mb-1">
            <strong>Ticket:</strong> {ticket.title}
          </p>
          <p className="font-readable text-sm text-beige/70">
            <strong>Type:</strong> {ticket.ticketType} | <strong>Board:</strong> {getBoardName()}
          </p>
        </div>

        {/* Sprint Selection */}
        <div className="mb-6">
          <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
            Select Sprint (Optional)
          </label>

          {isLoading ? (
            <div className="text-center py-4">
              <span className="font-readable text-beige/70">Loading sprints...</span>
            </div>
          ) : sprints.length === 0 ? (
            <div className="text-center py-4">
              <span className="font-readable text-beige/70">No sprints available</span>
            </div>
          ) : (
            <PixelSelect
              options={sprintOptions}
              value={selectedSprintId !== undefined ? String(selectedSprintId) : null}
              onChange={(val) =>
                setSelectedSprintId(val ? parseInt(val, 10) : undefined)
              }
              allowClear
              clearLabel="No sprint (backlog)"
              placeholder="Select sprint..."
              searchPlaceholder="Search sprints..."
              groupOrder={['Active Sprints', 'Future Sprints']}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="pixel-btn text-pixel-xs">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="pixel-btn pixel-btn-primary text-pixel-xs disabled:opacity-50"
          >
            Create in Jira
          </button>
        </div>
      </div>
    </div>
  );
}
