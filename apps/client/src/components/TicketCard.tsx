import { useState } from 'react';
import type { Ticket, TicketPriority } from '@jira-planner/shared';
import { useStore } from '../store/useStore';
import { useProgressStore, XP_REWARDS } from '../store/progressStore';
import { CopyButton } from './CopyButton';
import { SprintSelectModal } from './SprintSelectModal';
import { SkillBadge } from './SkillBadge';
import { formatTicketForJira } from '../utils/formatTicket';
import { updateTicketStatus, updateTicket, createJiraIssue, syncTicketToJira } from '../utils/api';

interface TicketCardProps {
  ticket: Ticket;
}

// Map priority to rarity
const priorityToRarity: Record<TicketPriority, { name: string; stars: number; class: string }> = {
  highest: { name: 'LEGENDARY', stars: 5, class: 'quest-legendary' },
  high: { name: 'EPIC', stars: 4, class: 'quest-epic' },
  medium: { name: 'RARE', stars: 3, class: 'quest-rare' },
  low: { name: 'COMMON', stars: 2, class: 'quest-common' },
  lowest: { name: 'BASIC', stars: 1, class: 'quest-basic' },
};

// Ticket type icons
const typeIcons: Record<string, string> = {
  feature: '⚔️',
  bug: '🐛',
  improvement: '⬆️',
  task: '📋',
  design: '🎨',
};

// Status border colors
const statusBorderColors: Record<string, string> = {
  pending: 'border-l-quest-new',
  approved: 'border-l-quest-active',
  denied: 'border-l-quest-abandoned',
  created: 'border-l-quest-complete',
};

function RarityStars({ count }: { count: number }) {
  return (
    <div className="rarity-stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`star ${i < count ? 'star-filled' : 'star-empty'}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function TicketCard({ ticket }: TicketCardProps) {
  const {
    teamMembers,
    epics,
    updateTicket: updateTicketInStore,
    setEditingTicket,
    showToast,
  } = useStore();

  const { addXp, incrementQuestsCompleted } = useProgressStore();
  const [isCreatingInJira, setIsCreatingInJira] = useState(false);
  const [isSyncingToJira, setIsSyncingToJira] = useState(false);
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [clickEvent, setClickEvent] = useState<{ x: number; y: number } | null>(null);

  const assignee = ticket.assigneeId
    ? teamMembers.find((m) => m.id === ticket.assigneeId)
    : null;
  const epic = ticket.epicId
    ? epics.find((e) => e.id === ticket.epicId)
    : null;

  const rarity = priorityToRarity[ticket.priority];
  const typeIcon = typeIcons[ticket.ticketType] || '📋';

  const handleStatusChange = async (
    status: 'pending' | 'approved' | 'denied' | 'created',
    e: React.MouseEvent
  ) => {
    try {
      const updated = await updateTicketStatus(ticket.id, status);
      updateTicketInStore(ticket.id, updated);

      if (status === 'approved') {
        addXp(XP_REWARDS.questApproved, e.clientX, e.clientY);
        showToast('Quest accepted!', 'success');
      } else if (status === 'denied') {
        showToast('Quest abandoned', 'success');
      }
    } catch (error) {
      showToast('Failed to update quest status', 'error');
    }
  };

  const handleCompleteClick = (e: React.MouseEvent) => {
    // Store click coordinates for XP popup
    setClickEvent({ x: e.clientX, y: e.clientY });
    setShowSprintModal(true);
  };

  const handleCreateInJira = async (sprintId?: number) => {
    setShowSprintModal(false);
    setIsCreatingInJira(true);
    try {
      // Try to create in Jira first
      const result = await createJiraIssue(ticket.id, sprintId ? { sprintId } : undefined);
      updateTicketInStore(ticket.id, result.ticket);
      if (clickEvent) {
        addXp(XP_REWARDS.questCreated, clickEvent.x, clickEvent.y);
      }
      incrementQuestsCompleted();
      showToast(`Quest complete! Created ${result.jira.key}`, 'success');
    } catch (error) {
      // If Jira creation fails, offer to mark as complete without Jira
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not configured')) {
        // Just mark as complete locally if Jira isn't configured
        try {
          const updated = await updateTicket(ticket.id, {
            status: 'created',
            createdInJira: true,
          });
          updateTicketInStore(ticket.id, updated);
          if (clickEvent) {
            addXp(XP_REWARDS.questCreated, clickEvent.x, clickEvent.y);
          }
          incrementQuestsCompleted();
          showToast('Quest complete! (Jira not configured)', 'success');
        } catch {
          showToast('Failed to complete quest', 'error');
        }
      } else {
        showToast(`Jira error: ${errorMessage}`, 'error');
      }
    } finally {
      setIsCreatingInJira(false);
      setClickEvent(null);
    }
  };

  const handleCancelModal = () => {
    setShowSprintModal(false);
    setClickEvent(null);
  };

  const handleSyncToJira = async () => {
    setIsSyncingToJira(true);
    try {
      await syncTicketToJira(ticket.id);
      showToast('Synced enhancements to Jira', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to sync to Jira', 'error');
    } finally {
      setIsSyncingToJira(false);
    }
  };

  const hasEnhancements = !!(ticket as any).enhancements;

  return (
    <div
      className={`panel border-l-4 ${statusBorderColors[ticket.status]} ${rarity.class} p-4 hover:brightness-110 transition-all cursor-pointer`}
      onClick={() => setEditingTicket(ticket)}
    >
      {/* Rarity header */}
      <div className="flex items-center justify-between mb-2">
        <RarityStars count={rarity.stars} />
        <span
          className={`font-pixel text-pixel-xs ${
            rarity.name === 'LEGENDARY'
              ? 'text-rarity-legendary'
              : rarity.name === 'EPIC'
              ? 'text-rarity-epic'
              : rarity.name === 'RARE'
              ? 'text-rarity-rare'
              : rarity.name === 'COMMON'
              ? 'text-rarity-common'
              : 'text-rarity-basic'
          }`}
        >
          {rarity.name}
        </span>
      </div>

      <div className="pixel-divider mb-3" />

      {/* Quest title */}
      <h3 className="font-pixel text-pixel-xs text-beige mb-2 line-clamp-2 leading-relaxed">
        {ticket.title}
      </h3>

      {/* Description */}
      <p className="font-readable text-base text-beige/70 line-clamp-2 mb-3">
        {ticket.description}
      </p>

      {/* Quest info */}
      <div className="space-y-1 mb-3">
        {ticket.acceptanceCriteria.length > 0 && (
          <div className="flex items-center gap-2 font-readable text-sm text-beige/60">
            <span>📋</span>
            <span>Objectives: {ticket.acceptanceCriteria.length}</span>
          </div>
        )}
        {assignee && (
          <div className="flex items-center gap-2 font-readable text-sm text-beige/60">
            <span>👤</span>
            <span>@{assignee.jiraUsername || assignee.name}</span>
          </div>
        )}
        {epic && (
          <div className="flex items-center gap-2 font-readable text-sm text-beige/60">
            <span>🏰</span>
            <span>{epic.key}</span>
          </div>
        )}
        <div className="flex items-center gap-2 font-readable text-sm text-beige/60">
          <span>{typeIcon}</span>
          <span className="capitalize">{ticket.ticketType}</span>
        </div>
        {ticket.labels && ticket.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {ticket.labels.slice(0, 3).map((label) => (
              <span
                key={label}
                className="px-1.5 py-0.5 text-xs bg-stone-panel border border-border-gold/50 rounded text-beige/70"
              >
                {label}
              </span>
            ))}
            {ticket.labels.length > 3 && (
              <span className="px-1.5 py-0.5 text-xs text-beige/50">
                +{ticket.labels.length - 3}
              </span>
            )}
          </div>
        )}
        {/* Required Skills */}
        {ticket.requiredSkills && ticket.requiredSkills.length > 0 && (
          <div className="mt-2">
            <div className="font-pixel text-pixel-xs text-beige/50 mb-1">⚡ REQUIRED SKILLS</div>
            <div className="flex flex-wrap gap-1">
              {ticket.requiredSkills.slice(0, 3).map((skill) => (
                <SkillBadge key={skill} skill={skill} isInferred={true} />
              ))}
              {ticket.requiredSkills.length > 3 && (
                <span className="text-xs text-beige/50">+{ticket.requiredSkills.length - 3}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div
        className="flex gap-2 mt-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {ticket.status === 'pending' && (
          <>
            <button
              onClick={(e) => handleStatusChange('approved', e)}
              className="pixel-btn pixel-btn-success text-pixel-xs flex-1"
            >
              ✓ Accept
            </button>
            <button
              onClick={(e) => handleStatusChange('denied', e)}
              className="pixel-btn pixel-btn-danger text-pixel-xs flex-1"
            >
              ✗ Abandon
            </button>
          </>
        )}

        {ticket.status === 'approved' && !ticket.createdInJira && (
          <button
            onClick={handleCompleteClick}
            disabled={isCreatingInJira}
            className="pixel-btn pixel-btn-primary text-pixel-xs flex-1 disabled:opacity-50"
          >
            {isCreatingInJira ? '⏳ Creating...' : '📤 Create in Jira'}
          </button>
        )}

        {/* Sprint Selection Modal */}
        {showSprintModal && (
          <SprintSelectModal
            ticket={ticket}
            onConfirm={handleCreateInJira}
            onCancel={handleCancelModal}
          />
        )}

        {ticket.createdInJira && (
          <div className="flex items-center gap-2 px-3 py-2 bg-quest-complete/20 border-2 border-quest-complete rounded">
            <span>🏆</span>
            {ticket.jiraKey && ticket.jiraUrl ? (
              <a
                href={ticket.jiraUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-pixel text-pixel-xs text-quest-complete hover:underline"
              >
                {ticket.jiraKey}
              </a>
            ) : (
              <span className="font-pixel text-pixel-xs text-quest-complete">
                QUEST COMPLETE
              </span>
            )}
          </div>
        )}

        {ticket.jiraKey && hasEnhancements && (
          <button
            onClick={handleSyncToJira}
            disabled={isSyncingToJira}
            className="pixel-btn text-pixel-xs disabled:opacity-50"
            title="Sync enhancements to Jira"
          >
            {isSyncingToJira ? '⏳' : '🔄'} Sync
          </button>
        )}

        <CopyButton
          getText={() => formatTicketForJira(ticket, { teamMembers, epics })}
          label="📋"
          className="pixel-btn text-pixel-xs"
        />
      </div>
    </div>
  );
}
