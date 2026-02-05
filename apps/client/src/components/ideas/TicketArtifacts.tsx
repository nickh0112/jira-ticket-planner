import type { IdeaTicketProposal } from '@jira-planner/shared';
import { useIdeasStore } from '../../store/ideasStore';
import { TicketCard } from './TicketCard';

interface TicketArtifactsProps {
  proposals: IdeaTicketProposal[];
}

export function TicketArtifacts({ proposals }: TicketArtifactsProps) {
  const {
    selectedProposalIds,
    isGenerating,
    selectAllProposals,
    deselectAllProposals,
    approveProposals,
  } = useIdeasStore();

  const proposedProposals = proposals.filter(p => p.status === 'proposed');
  const otherProposals = proposals.filter(p => p.status !== 'proposed');

  const selectedCount = proposedProposals.filter(p => selectedProposalIds.has(p.id)).length;
  const allSelected = selectedCount === proposedProposals.length && proposedProposals.length > 0;

  const handleApprove = async () => {
    await approveProposals();
  };

  return (
    <div className="p-4 space-y-4">
      {/* Bulk Actions */}
      {proposedProposals.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-stone-700/30 rounded-lg border border-stone-600">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => allSelected ? deselectAllProposals() : selectAllProposals()}
                className="w-4 h-4 rounded border-stone-500 bg-stone-700 text-gold focus:ring-gold"
              />
              <span className="text-sm text-beige">
                {selectedCount} of {proposedProposals.length} selected
              </span>
            </label>
          </div>
          <button
            onClick={handleApprove}
            disabled={selectedCount === 0 || isGenerating}
            className="stone-button stone-button-primary text-sm px-4 py-1.5 disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="animate-pulse">Creating...</span>
            ) : (
              <>Create {selectedCount} Quest{selectedCount !== 1 ? 's' : ''}</>
            )}
          </button>
        </div>
      )}

      {/* Proposed Proposals */}
      {proposedProposals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-beige/70">Pending Review</h3>
          {proposedProposals.map((proposal, index) => (
            <TicketCard
              key={proposal.id}
              proposal={proposal}
              index={index + 1}
            />
          ))}
        </div>
      )}

      {/* Other Proposals (created/rejected) */}
      {otherProposals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-beige/50">Processed</h3>
          {otherProposals.map((proposal, index) => (
            <TicketCard
              key={proposal.id}
              proposal={proposal}
              index={proposedProposals.length + index + 1}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {proposals.length === 0 && (
        <div className="text-center py-12 text-beige/50">
          <p>No quest proposals yet.</p>
          <p className="text-sm mt-2">Generate a Blueprint first, then split it into Quests.</p>
        </div>
      )}

      {/* Edit hint */}
      <div className="pt-4 border-t border-stone-600">
        <p className="text-xs text-beige/50 italic">
          💡 To edit Quests, ask me in the chat. For example:
          "Change ticket 2's priority to high" or "Update the auth ticket's description"
        </p>
      </div>
    </div>
  );
}
