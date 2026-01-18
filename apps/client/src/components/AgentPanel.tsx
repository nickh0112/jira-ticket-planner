import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import {
  triggerAgentLearning,
  getAgentKnowledge,
  enhanceTicket,
  suggestEpic,
  suggestAssignees,
} from '../utils/api';
import type {
  LearningResult,
  AgentKnowledgeResponse,
  EnhanceTicketResponse,
  EpicSuggestion,
  AssigneeSuggestion,
  InferredSkill,
} from '@jira-planner/shared';
import { PixelSelect } from './PixelSelect';

interface GroupedSkills {
  [teamMemberId: string]: {
    memberId: string;
    memberName: string;
    memberRole?: string;
    skills: InferredSkill[];
  };
}

export function AgentPanel() {
  const { tickets, teamMembers, epics, showToast } = useStore();

  // Learning state
  const [isLearning, setIsLearning] = useState(false);
  const [learningResult, setLearningResult] = useState<LearningResult | null>(null);

  // Knowledge state
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);
  const [knowledge, setKnowledge] = useState<AgentKnowledgeResponse | null>(null);

  // Enhancement state
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceResult, setEnhanceResult] = useState<EnhanceTicketResponse | null>(null);

  // Suggestion state
  const [suggestionInput, setSuggestionInput] = useState({
    title: '',
    description: '',
    ticketType: 'feature',
  });
  const [isGettingSuggestions, setIsGettingSuggestions] = useState(false);
  const [epicSuggestion, setEpicSuggestion] = useState<EpicSuggestion | null>(null);
  const [assigneeSuggestions, setAssigneeSuggestions] = useState<AssigneeSuggestion[]>([]);

  // Expanded team members for knowledge base
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  // Group skills by team member
  const groupedSkills = useMemo((): GroupedSkills => {
    if (!knowledge) return {};

    const groups: GroupedSkills = {};
    for (const skill of knowledge.inferredSkills) {
      if (!groups[skill.teamMemberId]) {
        const member = teamMembers.find((m) => m.id === skill.teamMemberId);
        groups[skill.teamMemberId] = {
          memberId: skill.teamMemberId,
          memberName: member?.name || 'Unknown Member',
          memberRole: member?.role,
          skills: [],
        };
      }
      groups[skill.teamMemberId].skills.push(skill);
    }

    // Sort skills within each group by confidence
    for (const group of Object.values(groups)) {
      group.skills.sort((a, b) => b.confidence - a.confidence);
    }

    return groups;
  }, [knowledge, teamMembers]);

  const toggleMemberExpanded = (memberId: string) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleLearn = async () => {
    setIsLearning(true);
    setLearningResult(null);
    try {
      const result = await triggerAgentLearning();
      setLearningResult(result);
      showToast(
        `Learned from ${result.ticketsAnalyzed} tickets, inferred ${result.patternsLearned} patterns`,
        'success'
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to learn from Jira',
        'error'
      );
    } finally {
      setIsLearning(false);
    }
  };

  const handleLoadKnowledge = async () => {
    setIsLoadingKnowledge(true);
    try {
      const result = await getAgentKnowledge();
      setKnowledge(result);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to load knowledge',
        'error'
      );
    } finally {
      setIsLoadingKnowledge(false);
    }
  };

  const handleEnhance = async () => {
    if (!selectedTicketId) {
      showToast('Please select a ticket', 'error');
      return;
    }

    setIsEnhancing(true);
    setEnhanceResult(null);
    try {
      const result = await enhanceTicket(selectedTicketId, 'comprehensive');
      setEnhanceResult(result);
      showToast(
        `Ticket enhanced! Quality score: ${result.qualityScore}`,
        'success'
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to enhance ticket',
        'error'
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGetSuggestions = async () => {
    if (!suggestionInput.title || !suggestionInput.description) {
      showToast('Please enter title and description', 'error');
      return;
    }

    setIsGettingSuggestions(true);
    setEpicSuggestion(null);
    setAssigneeSuggestions([]);

    try {
      const [epicResult, assigneeResult] = await Promise.all([
        suggestEpic(suggestionInput),
        suggestAssignees(suggestionInput),
      ]);
      setEpicSuggestion(epicResult);
      setAssigneeSuggestions(assigneeResult);
      showToast('Got suggestions!', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to get suggestions',
        'error'
      );
    } finally {
      setIsGettingSuggestions(false);
    }
  };

  const pendingTickets = tickets.filter((t) => t.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🤖</span>
        <h2 className="font-pixel text-pixel-sm text-gold">AI AGENT</h2>
      </div>

      {/* Learning Section */}
      <div className="panel p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">📚</span>
          <h3 className="font-pixel text-pixel-xs text-gold">LEARN FROM JIRA</h3>
        </div>
        <div className="pixel-divider" />

        <p className="font-readable text-base text-beige/70">
          Analyze your Jira ticket history to infer team member skills, categorize epics,
          and learn quality patterns.
        </p>

        <button
          onClick={handleLearn}
          disabled={isLearning}
          className="pixel-btn pixel-btn-primary text-pixel-xs disabled:opacity-50"
        >
          {isLearning ? 'Learning...' : 'Start Learning'}
        </button>

        {learningResult && (
          <div className="p-4 bg-stone-primary border-2 border-quest-complete rounded">
            <p className="font-pixel text-pixel-xs text-quest-complete mb-2">
              Learning Complete!
            </p>
            <ul className="font-readable text-sm text-beige/70 space-y-1">
              <li>Tickets analyzed: {learningResult.ticketsAnalyzed}</li>
              <li>Patterns learned: {learningResult.patternsLearned}</li>
              <li>Team members with inferred skills: {learningResult.skillsInferred.length}</li>
              <li>Epics categorized: {learningResult.epicCategories.length}</li>
            </ul>
          </div>
        )}
      </div>

      {/* Knowledge Base Section */}
      <div className="panel p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">🧠</span>
          <h3 className="font-pixel text-pixel-xs text-gold">KNOWLEDGE BASE</h3>
        </div>
        <div className="pixel-divider" />

        <button
          onClick={handleLoadKnowledge}
          disabled={isLoadingKnowledge}
          className="pixel-btn text-pixel-xs disabled:opacity-50"
        >
          {isLoadingKnowledge ? 'Loading...' : 'View Knowledge'}
        </button>

        {knowledge && (
          <div className="space-y-4">
            {/* Inferred Skills - Grouped by Team Member */}
            <div>
              <h4 className="font-pixel text-pixel-xs text-beige/80 mb-2">
                Inferred Skills ({knowledge.inferredSkills.length} skills across {Object.keys(groupedSkills).length} members)
              </h4>
              {Object.keys(groupedSkills).length > 0 ? (
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {Object.values(groupedSkills)
                    .sort((a, b) => b.skills.length - a.skills.length)
                    .map((group) => {
                      const isExpanded = expandedMembers.has(group.memberId);
                      return (
                        <div
                          key={group.memberId}
                          className="bg-stone-primary border border-beige/20 rounded overflow-hidden"
                        >
                          {/* Team Member Header - Clickable */}
                          <button
                            onClick={() => toggleMemberExpanded(group.memberId)}
                            className="w-full p-3 flex items-center justify-between hover:bg-stone-secondary transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-beige/60">
                                {isExpanded ? '▼' : '▶'}
                              </span>
                              <span className="text-gold font-pixel text-pixel-xs">
                                {group.memberName}
                              </span>
                              {group.memberRole && (
                                <span className="text-beige/50 text-xs">
                                  ({group.memberRole})
                                </span>
                              )}
                            </div>
                            <span className="text-rarity-rare text-sm">
                              {group.skills.length} skill{group.skills.length !== 1 ? 's' : ''}
                            </span>
                          </button>

                          {/* Expanded Skills List */}
                          {isExpanded && (
                            <div className="border-t border-beige/10 p-2 space-y-2 bg-stone-secondary/50">
                              {group.skills.map((skill) => (
                                <div
                                  key={skill.id}
                                  className="p-2 bg-stone-primary border border-beige/10 rounded text-sm"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-rarity-rare font-medium">
                                      {skill.skill}
                                    </span>
                                    <span className="text-beige/60 text-xs">
                                      {(skill.confidence * 100).toFixed(0)}% confidence
                                    </span>
                                  </div>
                                  {skill.evidence && (
                                    <p className="text-beige/50 text-xs mt-1 italic">
                                      "{skill.evidence}"
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="font-readable text-sm text-beige/50">
                  No skills inferred yet. Run learning first.
                </p>
              )}
            </div>

            {/* Epic Categories */}
            <div>
              <h4 className="font-pixel text-pixel-xs text-beige/80 mb-2">
                Epic Categories ({knowledge.epicCategories.length})
              </h4>
              {knowledge.epicCategories.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {knowledge.epicCategories.slice(0, 10).map((cat) => {
                    const epic = epics.find((e) => e.id === cat.epicId);
                    return (
                      <div
                        key={cat.id}
                        className="p-2 bg-stone-primary border border-beige/20 rounded text-sm"
                      >
                        <span className="text-gold">{epic?.name || 'Unknown Epic'}</span>
                        <span className="text-beige/60"> - </span>
                        <span className="text-rarity-epic">{cat.category}</span>
                        {cat.keywords.length > 0 && (
                          <div className="text-beige/50 text-xs mt-1">
                            Keywords: {cat.keywords.join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="font-readable text-sm text-beige/50">
                  No epic categories yet. Run learning first.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Enhancement Section */}
      <div className="panel p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">✨</span>
          <h3 className="font-pixel text-pixel-xs text-gold">ENHANCE TICKET</h3>
        </div>
        <div className="pixel-divider" />

        <p className="font-readable text-base text-beige/70">
          Add technical context, acceptance criteria, success metrics, and AI coding notes
          to a ticket.
        </p>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Select Ticket
            </label>
            <PixelSelect
              options={pendingTickets.map((ticket) => ({
                value: ticket.id,
                label: ticket.title.length > 50 ? `${ticket.title.slice(0, 50)}...` : ticket.title,
                icon: ticket.ticketType === 'bug' ? '\uD83D\uDC1B' : ticket.ticketType === 'feature' ? '\u2694\uFE0F' : '\uD83D\uDCCB',
              }))}
              value={selectedTicketId || null}
              onChange={(val) => setSelectedTicketId(val || '')}
              placeholder="-- Select a ticket --"
              searchPlaceholder="Search tickets..."
            />
          </div>
          <button
            onClick={handleEnhance}
            disabled={isEnhancing || !selectedTicketId}
            className="pixel-btn pixel-btn-primary text-pixel-xs disabled:opacity-50"
          >
            {isEnhancing ? 'Enhancing...' : 'Enhance'}
          </button>
        </div>

        {enhanceResult && (
          <div className="p-4 bg-stone-primary border-2 border-rarity-epic rounded space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-pixel-xs text-rarity-epic">
                Enhancement Result
              </span>
              <span
                className={`font-pixel text-pixel-xs ${
                  enhanceResult.meetsQualityThreshold
                    ? 'text-quest-complete'
                    : 'text-quest-abandoned'
                }`}
              >
                Score: {enhanceResult.qualityScore}/100
              </span>
            </div>

            {enhanceResult.ticket.enhancements && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-beige/60">Enhanced Description:</span>
                  <p className="text-beige/90 mt-1">
                    {enhanceResult.ticket.enhancements.enhancedDescription.slice(0, 200)}...
                  </p>
                </div>
                <div>
                  <span className="text-beige/60">Added Acceptance Criteria:</span>
                  <ul className="list-disc list-inside text-beige/90 mt-1">
                    {enhanceResult.ticket.enhancements.addedAcceptanceCriteria
                      .slice(0, 3)
                      .map((ac, i) => (
                        <li key={i}>{ac}</li>
                      ))}
                    {enhanceResult.ticket.enhancements.addedAcceptanceCriteria.length > 3 && (
                      <li className="text-beige/50">
                        +{enhanceResult.ticket.enhancements.addedAcceptanceCriteria.length - 3} more
                      </li>
                    )}
                  </ul>
                </div>
                {enhanceResult.ticket.enhancements.aiCodingNotes && (
                  <div>
                    <span className="text-beige/60">AI Coding Notes:</span>
                    <p className="text-rarity-rare mt-1">
                      {enhanceResult.ticket.enhancements.aiCodingNotes.slice(0, 150)}...
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggestions Section */}
      <div className="panel p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">💡</span>
          <h3 className="font-pixel text-pixel-xs text-gold">GET SUGGESTIONS</h3>
        </div>
        <div className="pixel-divider" />

        <p className="font-readable text-base text-beige/70">
          Get epic and assignee suggestions for a ticket idea.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Title
            </label>
            <input
              type="text"
              value={suggestionInput.title}
              onChange={(e) =>
                setSuggestionInput((prev) => ({ ...prev, title: e.target.value }))
              }
              className="pixel-input w-full"
              placeholder="Add user authentication"
            />
          </div>
          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Description
            </label>
            <textarea
              value={suggestionInput.description}
              onChange={(e) =>
                setSuggestionInput((prev) => ({ ...prev, description: e.target.value }))
              }
              className="pixel-input w-full h-20"
              placeholder="Implement login and registration with email/password..."
            />
          </div>
          <div className="max-w-[200px]">
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Type
            </label>
            <PixelSelect
              options={[
                { value: 'feature', label: 'Feature', icon: '\u2694\uFE0F' },
                { value: 'bug', label: 'Bug', icon: '\uD83D\uDC1B' },
                { value: 'improvement', label: 'Improvement', icon: '\u2B06\uFE0F' },
                { value: 'task', label: 'Task', icon: '\uD83D\uDCCB' },
              ]}
              value={suggestionInput.ticketType}
              onChange={(val) =>
                setSuggestionInput((prev) => ({ ...prev, ticketType: val || 'feature' }))
              }
              searchable={false}
            />
          </div>
          <button
            onClick={handleGetSuggestions}
            disabled={isGettingSuggestions || !suggestionInput.title || !suggestionInput.description}
            className="pixel-btn pixel-btn-primary text-pixel-xs disabled:opacity-50"
          >
            {isGettingSuggestions ? 'Getting Suggestions...' : 'Get Suggestions'}
          </button>
        </div>

        {/* Epic Suggestion */}
        {epicSuggestion && (
          <div className="p-4 bg-stone-primary border-2 border-rarity-legendary rounded">
            <h4 className="font-pixel text-pixel-xs text-rarity-legendary mb-2">
              Epic Suggestion
            </h4>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-beige/60">Type: </span>
                <span className={epicSuggestion.type === 'match' ? 'text-quest-complete' : 'text-rarity-rare'}>
                  {epicSuggestion.type === 'match' ? 'Match Existing' : 'Create New'}
                </span>
              </p>
              <p>
                <span className="text-beige/60">Confidence: </span>
                <span className="text-gold">{(epicSuggestion.confidence * 100).toFixed(0)}%</span>
              </p>
              {epicSuggestion.epicId && (
                <p>
                  <span className="text-beige/60">Epic: </span>
                  <span className="text-beige/90">
                    {epics.find((e) => e.id === epicSuggestion.epicId)?.name || epicSuggestion.epicId}
                  </span>
                </p>
              )}
              {epicSuggestion.newEpicProposal && (
                <div className="mt-2 p-2 bg-stone-secondary rounded">
                  <p className="text-rarity-rare">Proposed New Epic:</p>
                  <p className="text-beige/90">{epicSuggestion.newEpicProposal.name}</p>
                  <p className="text-beige/60 text-xs">{epicSuggestion.newEpicProposal.description}</p>
                </div>
              )}
              <p className="text-beige/60 text-xs mt-2">{epicSuggestion.reasoning}</p>
            </div>
          </div>
        )}

        {/* Assignee Suggestions */}
        {assigneeSuggestions.length > 0 && (
          <div className="p-4 bg-stone-primary border-2 border-rarity-epic rounded">
            <h4 className="font-pixel text-pixel-xs text-rarity-epic mb-2">
              Assignee Suggestions
            </h4>
            <div className="space-y-2">
              {assigneeSuggestions.map((suggestion, i) => {
                const member = teamMembers.find((m) => m.id === suggestion.teamMemberId);
                return (
                  <div key={i} className="p-2 bg-stone-secondary rounded text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gold">{member?.name || 'Unknown'}</span>
                      <span className="text-beige/60">
                        {(suggestion.confidence * 100).toFixed(0)}% match
                      </span>
                    </div>
                    {suggestion.matchedSkills.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {suggestion.matchedSkills.map((skill, j) => (
                          <span
                            key={j}
                            className="px-2 py-0.5 bg-rarity-rare/20 text-rarity-rare text-xs rounded"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-beige/50 text-xs mt-1">{suggestion.reasoning}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
