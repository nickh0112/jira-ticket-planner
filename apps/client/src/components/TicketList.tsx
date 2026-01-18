import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useProgressStore, XP_REWARDS } from '../store/progressStore';
import { TicketCard } from './TicketCard';
import { CopyButton } from './CopyButton';
import { formatAllApprovedTickets } from '../utils/formatTicket';
import { updateTicketStatus, createAllJiraIssues, getTickets } from '../utils/api';
import type { TicketStatus } from '@jira-planner/shared';

const statusTabs: { key: TicketStatus | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'pending', label: 'New', icon: '✨' },
  { key: 'approved', label: 'Accepted', icon: '✓' },
  { key: 'denied', label: 'Abandoned', icon: '✗' },
  { key: 'created', label: 'Complete', icon: '🏆' },
];

export function TicketList() {
  const {
    tickets,
    teamMembers,
    epics,
    statusFilter,
    setStatusFilter,
    updateTicket,
    setTickets,
    showToast,
  } = useStore();

  const { addXp, incrementQuestsCompleted } = useProgressStore();
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [isCreatingAll, setIsCreatingAll] = useState(false);

  const filteredTickets =
    statusFilter === 'all'
      ? tickets
      : tickets.filter((t) => t.status === statusFilter);

  const pendingCount = tickets.filter((t) => t.status === 'pending').length;
  const approvedCount = tickets.filter((t) => t.status === 'approved').length;
  const createdCount = tickets.filter((t) => t.createdInJira).length;

  const handleApproveAll = async (e: React.MouseEvent) => {
    const pendingTickets = tickets.filter((t) => t.status === 'pending');
    try {
      await Promise.all(
        pendingTickets.map(async (ticket) => {
          const updated = await updateTicketStatus(ticket.id, 'approved');
          updateTicket(ticket.id, updated);
        })
      );
      // Award XP for each approved quest
      const totalXp = pendingTickets.length * XP_REWARDS.questApproved;
      addXp(totalXp, e.clientX, e.clientY);
      showToast(`Accepted ${pendingTickets.length} quest(s)!`, 'success');
    } catch (error) {
      showToast('Failed to accept all quests', 'error');
    }
  };

  const handleBulkCreateClick = () => {
    setShowBulkCreateModal(true);
  };

  const handleBulkCreate = async () => {
    setShowBulkCreateModal(false);
    setIsCreatingAll(true);
    try {
      const result = await createAllJiraIssues();
      // Refresh tickets from server to get updated statuses
      const { tickets: updatedTickets } = await getTickets();
      setTickets(updatedTickets);
      // Award XP for each created ticket
      const totalXp = result.successful * XP_REWARDS.questCreated;
      if (totalXp > 0) {
        addXp(totalXp, window.innerWidth / 2, window.innerHeight / 2);
        for (let i = 0; i < result.successful; i++) {
          incrementQuestsCompleted();
        }
      }
      if (result.successful === result.total) {
        showToast(`Created ${result.successful} tickets in Jira!`, 'success');
      } else {
        showToast(`Created ${result.successful}/${result.total} tickets in Jira`, 'success');
      }
    } catch (error) {
      showToast('Failed to create tickets in Jira', 'error');
    } finally {
      setIsCreatingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quest Board Header */}
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📜</span>
              <span className="font-pixel text-pixel-sm text-gold">
                ACTIVE QUESTS: {tickets.length}
              </span>
            </div>
            <div className="font-readable text-lg text-beige/70">
              Progress:{' '}
              <span className="text-quest-complete">
                {createdCount}/{tickets.length}
              </span>{' '}
              complete
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={handleApproveAll}
                className="pixel-btn pixel-btn-success text-pixel-xs"
              >
                Accept All ({pendingCount})
              </button>
            )}

            {approvedCount > 0 && (
              <>
                <button
                  onClick={handleBulkCreateClick}
                  disabled={isCreatingAll}
                  className="pixel-btn pixel-btn-primary text-pixel-xs disabled:opacity-50"
                >
                  {isCreatingAll ? '⏳ Creating...' : `📤 Create ${approvedCount} in Jira`}
                </button>
                <CopyButton
                  getText={() =>
                    formatAllApprovedTickets(tickets, { teamMembers, epics })
                  }
                  label={`Copy Briefing (${approvedCount})`}
                  className="pixel-btn text-pixel-xs"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter tabs - Stone tablets */}
      <div className="flex gap-1 panel p-2">
        {statusTabs.map((tab) => {
          const count =
            tab.key === 'all'
              ? tickets.length
              : tickets.filter((t) => t.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex-1 stone-tab flex items-center justify-center gap-2 ${
                statusFilter === tab.key ? 'stone-tab-active' : ''
              }`}
            >
              <span>{tab.icon}</span>
              <span>
                {tab.label} ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Quest cards - Grid layout */}
      {filteredTickets.length === 0 ? (
        <div className="panel p-8 text-center">
          <div className="text-4xl mb-4">📜</div>
          <p className="font-readable text-xl text-beige/70">
            {tickets.length === 0
              ? 'No quests available. Decode intel to receive new orders.'
              : `No ${statusFilter} quests.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}

      {/* Bulk Create Confirmation Modal */}
      {showBulkCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowBulkCreateModal(false)}
          />
          <div className="relative panel p-6 max-w-md w-full mx-4 animate-slide-up">
            <h3 className="font-pixel text-pixel-sm text-gold mb-4">
              📤 Create {approvedCount} Tickets in Jira
            </h3>
            <p className="font-readable text-base text-beige/80 mb-6">
              This will create all {approvedCount} approved tickets in Jira. Tickets will not be assigned to a sprint automatically.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBulkCreateModal(false)}
                className="pixel-btn text-pixel-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCreate}
                className="pixel-btn pixel-btn-primary text-pixel-xs"
              >
                Create All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
