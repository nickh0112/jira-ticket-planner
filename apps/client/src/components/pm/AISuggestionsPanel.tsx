import { useEffect } from 'react';
import type { EngineerStatus } from '@jira-planner/shared';
import { usePMStore } from '../../store/pmStore';

interface AISuggestionsPanelProps {
  engineer: EngineerStatus;
}

export function AISuggestionsPanel({ engineer }: AISuggestionsPanelProps) {
  const {
    suggestions,
    isLoading,
    loadSuggestions,
    generateSuggestions,
    approveSuggestion,
    rejectSuggestion,
    setSelectedEngineerId,
  } = usePMStore();

  // Load suggestions for this engineer
  useEffect(() => {
    loadSuggestions(engineer.memberId);
  }, [engineer.memberId, loadSuggestions]);

  const engineerSuggestions = suggestions.filter(
    (s) => s.teamMemberId === engineer.memberId
  );

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400 bg-green-900/30';
    if (score >= 0.6) return 'text-yellow-400 bg-yellow-900/30';
    return 'text-orange-400 bg-orange-900/30';
  };

  return (
    <div className="stone-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-pixel text-pixel-md text-gold">
            AI Suggestions for {engineer.memberName}
          </h3>
          <span className="px-2 py-0.5 bg-stone-secondary text-beige/60 text-sm rounded">
            {engineerSuggestions.length} suggestions
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generateSuggestions(engineer.memberId)}
            disabled={isLoading}
            className="stone-button text-sm flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">&#8635;</span>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <span>&#10024;</span>
                <span>Generate New</span>
              </>
            )}
          </button>
          <button
            onClick={() => setSelectedEngineerId(null)}
            className="stone-button-secondary text-sm"
          >
            Close
          </button>
        </div>
      </div>

      {/* Suggestions */}
      {engineerSuggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-4xl mb-3">&#128161;</span>
          <p className="text-beige/60 mb-4">
            No suggestions yet. Click "Generate New" to get AI-powered ticket recommendations.
          </p>
          <button
            onClick={() => generateSuggestions(engineer.memberId)}
            disabled={isLoading}
            className="stone-button"
          >
            Generate Suggestions
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {engineerSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="p-4 bg-stone-primary/50 rounded-lg border border-border-stone"
            >
              {/* Title and Score */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h4 className="font-readable text-lg text-beige">
                    {suggestion.title}
                  </h4>
                  {suggestion.jiraKey && (
                    <span className="text-sm text-beige/60">
                      {suggestion.jiraKey}
                    </span>
                  )}
                </div>
                <span
                  className={`
                    px-3 py-1 rounded text-sm font-medium
                    ${getScoreColor(suggestion.skillMatchScore)}
                  `}
                >
                  {Math.round(suggestion.skillMatchScore * 100)}% match
                </span>
              </div>

              {/* Reasoning */}
              <p className="text-sm text-beige/70 mb-4 leading-relaxed">
                {suggestion.reasoning}
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => approveSuggestion(suggestion.id)}
                  className="flex-1 px-4 py-2 bg-green-700/80 hover:bg-green-600 text-white rounded transition-colors flex items-center justify-center gap-2"
                >
                  <span>&#10003;</span>
                  <span>Approve & Assign</span>
                </button>
                <button
                  onClick={() => rejectSuggestion(suggestion.id)}
                  className="px-4 py-2 bg-stone-secondary border border-border-stone hover:border-red-500 text-beige/60 hover:text-red-400 rounded transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      <div className="mt-4 pt-4 border-t border-border-stone">
        <p className="text-sm text-beige/50">
          Suggestions are based on skill matching between the engineer's known skills and ticket requirements.
          Approving a suggestion will automatically assign the ticket to {engineer.memberName}.
        </p>
      </div>
    </div>
  );
}
