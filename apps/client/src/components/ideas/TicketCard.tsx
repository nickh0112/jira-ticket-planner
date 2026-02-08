import { useState } from 'react';
import type { IdeaTicketProposal } from '@jira-planner/shared';
import { useIdeasStore } from '../../store/ideasStore';
import { useStore } from '../../store/useStore';

interface TicketCardProps {
  proposal: IdeaTicketProposal;
  index: number;
}

const layerConfig = {
  frontend: { label: 'Frontend', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: '🎨' },
  backend: { label: 'Backend', color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: '⚙️' },
  design: { label: 'Design', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30', icon: '✏️' },
  fullstack: { label: 'Fullstack', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: '🔧' },
  infrastructure: { label: 'Infra', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: '🏗️' },
  data: { label: 'Data', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', icon: '📊' },
};

const priorityConfig = {
  highest: { label: 'Highest', color: 'text-red-400' },
  high: { label: 'High', color: 'text-orange-400' },
  medium: { label: 'Medium', color: 'text-yellow-400' },
  low: { label: 'Low', color: 'text-green-400' },
  lowest: { label: 'Lowest', color: 'text-blue-400' },
};

const statusConfig = {
  proposed: { label: 'Proposed', color: 'bg-yellow-500/20 text-yellow-300' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-300' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-300' },
  created: { label: 'Created', color: 'bg-green-500/20 text-green-300' },
};

export function TicketCard({ proposal, index }: TicketCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { selectedProposalIds, toggleProposalSelection, rejectProposal } = useIdeasStore();
  const { teamMembers, epics } = useStore();

  const layer = layerConfig[proposal.layer] || layerConfig.fullstack;
  const priority = priorityConfig[proposal.priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const status = statusConfig[proposal.status] || statusConfig.proposed;

  const isSelected = selectedProposalIds.has(proposal.id);
  const isProposed = proposal.status === 'proposed';
  const isCreated = proposal.status === 'created';
  const isRejected = proposal.status === 'rejected';

  const assignee = proposal.suggestedAssigneeId
    ? teamMembers.find(m => m.id === proposal.suggestedAssigneeId)
    : null;

  const epic = proposal.suggestedEpicId
    ? epics.find(e => e.id === proposal.suggestedEpicId)
    : null;

  return (
    <div
      className={`rounded-lg border transition-all ${
        isRejected
          ? 'bg-stone-800/30 border-stone-700 opacity-60'
          : isCreated
          ? 'bg-green-500/5 border-green-500/30'
          : isSelected
          ? 'bg-gold/10 border-gold/50'
          : 'bg-stone-700/30 border-stone-600 hover:border-stone-500'
      }`}
    >
      {/* Header */}
      <div className="p-3 flex items-start gap-3">
        {/* Selection checkbox (only for proposed) */}
        {isProposed && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleProposalSelection(proposal.id)}
            className="mt-1 w-4 h-4 rounded border-stone-500 bg-stone-700 text-gold focus:ring-gold"
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-beige/50 text-xs font-mono">#{index}</span>
                <span className={`px-2 py-0.5 rounded text-xs border ${layer.color}`}>
                  {layer.icon} {layer.label}
                </span>
                <span className={`text-xs ${priority.color}`}>
                  {priority.label}
                </span>
              </div>
              <h4 className="font-medium text-beige">{proposal.title}</h4>
            </div>

            {/* Status badge */}
            <span className={`px-2 py-0.5 rounded text-xs ${status.color}`}>
              {status.label}
            </span>
          </div>

          {/* Description preview */}
          <p className="text-sm text-beige/70 mt-2 line-clamp-2">
            {proposal.description}
          </p>

          {/* Expand/collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-beige/50 hover:text-beige mt-2"
          >
            {isExpanded ? '▲ Show less' : '▼ Show more'}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-stone-600 pt-3 ml-7">
          {/* Full description */}
          <div>
            <h5 className="text-xs font-medium text-beige/60 mb-1">Description</h5>
            <p className="text-sm text-beige/80 whitespace-pre-wrap">
              {proposal.description}
            </p>
          </div>

          {/* Acceptance criteria */}
          <div>
            <h5 className="text-xs font-medium text-beige/60 mb-1">Acceptance Criteria</h5>
            <ul className="space-y-1">
              {proposal.acceptanceCriteria.map((ac, i) => (
                <li key={i} className="flex gap-2 text-sm text-beige/80">
                  <span className="text-beige/40">☐</span>
                  <span>{ac}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Required skills */}
          {proposal.requiredSkills.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-beige/60 mb-1">Required Skills</h5>
              <div className="flex flex-wrap gap-1">
                {proposal.requiredSkills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-stone-600/50 rounded text-xs text-beige/70"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Assignee suggestion */}
          {assignee && (
            <div>
              <h5 className="text-xs font-medium text-beige/60 mb-1">Suggested Assignee</h5>
              <div className="flex items-center gap-2">
                <span className="text-sm text-beige">{assignee.name}</span>
                <span className="text-xs text-beige/50">({assignee.role})</span>
                <span className="text-xs text-green-400">
                  {Math.round(proposal.assignmentConfidence * 100)}% match
                </span>
              </div>
              {proposal.assignmentReasoning && (
                <p className="text-xs text-beige/50 mt-1">{proposal.assignmentReasoning}</p>
              )}
            </div>
          )}

          {/* Epic suggestion */}
          {epic && (
            <div>
              <h5 className="text-xs font-medium text-beige/60 mb-1">Suggested Epic</h5>
              <span className="text-sm text-beige">{epic.name}</span>
            </div>
          )}

          {/* Affected files */}
          {proposal.affectedFiles && proposal.affectedFiles.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-beige/60 mb-1">Affected Files</h5>
              <div className="bg-stone-800/50 rounded p-2 max-h-32 overflow-y-auto">
                {proposal.affectedFiles.map((file, i) => (
                  <div key={i} className="text-xs font-mono text-beige/70">
                    {file}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Implementation hints */}
          {proposal.implementationHints && (
            <div>
              <h5 className="text-xs font-medium text-beige/60 mb-1">Implementation Hints</h5>
              <p className="text-sm text-beige/70 whitespace-pre-wrap bg-stone-800/50 rounded p-2">
                {proposal.implementationHints}
              </p>
            </div>
          )}

          {/* Actions (for proposed) */}
          {isProposed && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => rejectProposal(proposal.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
