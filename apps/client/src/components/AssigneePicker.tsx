import { useState, useEffect } from 'react';
import type { TeamMember, AssigneeSuggestion } from '@jira-planner/shared';
import { SkillMatchMeter } from './SkillMatchMeter';
import { suggestAssignees } from '../utils/api';

interface AssigneePickerProps {
  teamMembers: TeamMember[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  ticketData?: {
    title: string;
    description: string;
    ticketType: string;
    requiredSkills?: string[];
  };
}

interface AssigneeOption {
  member: TeamMember;
  suggestion?: AssigneeSuggestion;
}

export function AssigneePicker({
  teamMembers,
  selectedId,
  onSelect,
  ticketData,
}: AssigneePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AssigneeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch suggestions when ticket data is available
  useEffect(() => {
    if (ticketData && ticketData.title && ticketData.description) {
      fetchSuggestions();
    }
  }, [ticketData?.title, ticketData?.description, ticketData?.requiredSkills?.join(',')]);

  const fetchSuggestions = async () => {
    if (!ticketData) return;
    setIsLoading(true);
    try {
      const result = await suggestAssignees({
        title: ticketData.title,
        description: ticketData.description,
        ticketType: ticketData.ticketType,
        requiredSkills: ticketData.requiredSkills,
      });
      setSuggestions(result);
    } catch (error) {
      console.error('Failed to fetch assignee suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build sorted options list: AI suggestions first, then others
  const buildOptions = (): AssigneeOption[] => {
    const suggestionMap = new Map(
      suggestions.map((s) => [s.teamMemberId, s])
    );

    const options: AssigneeOption[] = teamMembers.map((member) => ({
      member,
      suggestion: suggestionMap.get(member.id),
    }));

    // Sort: suggested members first (by confidence), then others alphabetically
    return options.sort((a, b) => {
      if (a.suggestion && b.suggestion) {
        return b.suggestion.confidence - a.suggestion.confidence;
      }
      if (a.suggestion) return -1;
      if (b.suggestion) return 1;
      return a.member.name.localeCompare(b.member.name);
    });
  };

  const options = buildOptions();
  const selectedMember = teamMembers.find((m) => m.id === selectedId);
  const selectedSuggestion = suggestions.find((s) => s.teamMemberId === selectedId);

  return (
    <div className="relative">
      {/* Selected value / trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="pixel-input w-full text-left flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          {selectedMember ? (
            <>
              <span>⚔️</span>
              <span>{selectedMember.name}</span>
              {selectedSuggestion && (
                <span className="text-xs text-gold ml-1">
                  🤖 {Math.round(selectedSuggestion.confidence * 100)}%
                </span>
              )}
            </>
          ) : (
            <span className="text-beige/50">Unassigned</span>
          )}
        </span>
        <span className="text-beige/50">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-stone-panel border-2 border-border-gold shadow-pixel">
          {/* Unassigned option */}
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setIsOpen(false);
            }}
            className={`
              w-full px-3 py-2 text-left hover:bg-stone-secondary transition-colors
              ${!selectedId ? 'bg-gold/20' : ''}
            `}
          >
            <span className="text-beige/70">Unassigned</span>
          </button>

          {/* AI suggestion header */}
          {suggestions.length > 0 && (
            <div className="px-3 py-1 bg-gold/10 border-y border-border-gold/50">
              <span className="font-pixel text-pixel-xs text-gold">
                🤖 AI SUGGESTIONS
              </span>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="px-3 py-2 text-beige/50 text-sm">
              Loading suggestions...
            </div>
          )}

          {/* Team member options */}
          {options.map(({ member, suggestion }) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                onSelect(member.id);
                setIsOpen(false);
              }}
              className={`
                w-full px-3 py-2 text-left hover:bg-stone-secondary transition-colors
                ${selectedId === member.id ? 'bg-gold/20' : ''}
                ${suggestion ? 'border-l-2 border-l-gold' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span>⚔️</span>
                  <span className="font-readable text-beige">{member.name}</span>
                  <span className="text-xs text-beige/50">{member.role}</span>
                </div>
                {suggestion && (
                  <span className="text-xs text-gold">🤖</span>
                )}
              </div>

              {/* Show skill match meter for AI suggestions */}
              {suggestion && (
                <div className="ml-6">
                  <SkillMatchMeter confidence={suggestion.confidence} size="sm" />

                  {/* Matched skills */}
                  {suggestion.matchedSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {suggestion.matchedSkills.slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="px-1 py-0.5 text-xs bg-quest-complete/20 border border-quest-complete/50 rounded text-quest-complete"
                        >
                          ✓ {skill}
                        </span>
                      ))}
                      {suggestion.matchedSkills.length > 3 && (
                        <span className="text-xs text-beige/50">
                          +{suggestion.matchedSkills.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Show regular skills for non-suggested members */}
              {!suggestion && member.skills.length > 0 && (
                <div className="ml-6 flex flex-wrap gap-1">
                  {member.skills.slice(0, 3).map((skill) => (
                    <span
                      key={skill}
                      className="px-1 py-0.5 text-xs bg-stone-secondary border border-border-gold/30 rounded text-beige/60"
                    >
                      {skill}
                    </span>
                  ))}
                  {member.skills.length > 3 && (
                    <span className="text-xs text-beige/50">
                      +{member.skills.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
