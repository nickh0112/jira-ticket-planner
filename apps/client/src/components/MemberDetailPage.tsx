import { useState, useEffect, useMemo } from 'react';
import type { MemberTicket, MemberProgress, JiraConfig } from '@jira-planner/shared';
import { useStore } from '../store/useStore';
import { getMemberTickets, getMemberProgress, getJiraConfig } from '../utils/api';

type SortKey = 'state' | 'date' | 'sprint';

// Status ordering for "doneness" sorting
const statusOrder: Record<string, number> = {
  'In Progress': 1,
  'In Review': 2,
  'To Do': 3,
  'Open': 4,
  'Backlog': 5,
  'Done': 6,
  'Closed': 7,
  'Resolved': 8,
};

const getStatusOrder = (status: string): number => {
  return statusOrder[status] ?? 5;
};

// Class icons based on role keywords
const getClassIcon = (role: string): string => {
  const lowerRole = role.toLowerCase();
  if (lowerRole.includes('frontend') || lowerRole.includes('ui')) return '🧙';
  if (lowerRole.includes('backend') || lowerRole.includes('server')) return '🛡️';
  if (lowerRole.includes('full')) return '⚔️';
  if (lowerRole.includes('devops') || lowerRole.includes('infra')) return '🏰';
  if (lowerRole.includes('qa') || lowerRole.includes('test')) return '🔍';
  if (lowerRole.includes('design')) return '🎨';
  if (lowerRole.includes('lead') || lowerRole.includes('manager')) return '👑';
  return '⚔️';
};

// Format relative date
const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
};

// Get status badge style
const getStatusStyle = (status: string): string => {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('done') || lowerStatus.includes('closed') || lowerStatus.includes('resolved')) {
    return 'bg-quest-complete/20 text-quest-complete border-quest-complete';
  }
  if (lowerStatus.includes('progress') || lowerStatus.includes('review')) {
    return 'bg-quest-active/20 text-quest-active border-quest-active';
  }
  return 'bg-beige/20 text-beige border-beige/50';
};

// Get sprint badge style
const getSprintStyle = (state: string): string => {
  if (state === 'active') return 'bg-quest-active/20 text-quest-active border-quest-active';
  if (state === 'future') return 'bg-gold/20 text-gold border-gold';
  return 'bg-beige/20 text-beige/60 border-beige/30';
};

// XP required per level
const XP_PER_LEVEL = [0, 200, 500, 1000, 2000, 4000, 7000, 10000, 15000, 25000];

export function MemberDetailPage() {
  const { teamMembers, selectedMemberId, setSelectedMemberId, showToast } = useStore();
  const [tickets, setTickets] = useState<MemberTicket[]>([]);
  const [progress, setProgress] = useState<MemberProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('state');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedTicketKey, setExpandedTicketKey] = useState<string | null>(null);
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);

  const member = teamMembers.find((m) => m.id === selectedMemberId);

  useEffect(() => {
    if (!member?.jiraAccountId) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [ticketsRes, progressRes, configRes] = await Promise.all([
          getMemberTickets(member.jiraAccountId!),
          getMemberProgress(member.id).catch(() => null),
          getJiraConfig().catch(() => ({ config: null })),
        ]);
        setTickets(ticketsRes.tickets);
        setProgress(progressRes);
        setJiraConfig(configRes.config);
      } catch (error) {
        showToast('Failed to load member data', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [member?.id, member?.jiraAccountId, showToast]);

  const sortedTickets = useMemo(() => {
    const sorted = [...tickets].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'state':
          comparison = getStatusOrder(a.status) - getStatusOrder(b.status);
          break;
        case 'date':
          comparison = new Date(b.updated).getTime() - new Date(a.updated).getTime();
          break;
        case 'sprint':
          // Active > Future > Closed > No Sprint
          const getSprintOrder = (t: MemberTicket) => {
            if (!t.sprint) return 4;
            if (t.sprint.state === 'active') return 1;
            if (t.sprint.state === 'future') return 2;
            return 3;
          };
          comparison = getSprintOrder(a) - getSprintOrder(b);
          break;
      }

      return sortAsc ? comparison : -comparison;
    });

    return sorted;
  }, [tickets, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleTicketExpand = (ticketKey: string) => {
    setExpandedTicketKey(expandedTicketKey === ticketKey ? null : ticketKey);
  };

  const getJiraUrl = (ticketKey: string): string | null => {
    if (!jiraConfig?.baseUrl) return null;
    return `${jiraConfig.baseUrl}/browse/${ticketKey}`;
  };

  if (!member) {
    return (
      <div className="panel p-8 text-center">
        <p className="font-readable text-xl text-beige/70">Member not found</p>
        <button
          onClick={() => setSelectedMemberId(null)}
          className="pixel-btn mt-4"
        >
          Back to Squad
        </button>
      </div>
    );
  }

  // Calculate XP progress
  const currentLevel = progress?.level ?? 1;
  const currentXP = progress?.xp ?? 0;
  const currentLevelXP = XP_PER_LEVEL[currentLevel - 1] ?? 0;
  const nextLevelXP = XP_PER_LEVEL[currentLevel] ?? XP_PER_LEVEL[XP_PER_LEVEL.length - 1];
  const xpIntoLevel = currentXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  const xpProgress = Math.min((xpIntoLevel / xpNeededForLevel) * 100, 100);

  return (
    <div className="space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSelectedMemberId(null)}
          className="pixel-btn text-pixel-xs flex items-center gap-2"
        >
          <span>&larr;</span>
          <span>Back</span>
        </button>
        <h2 className="font-pixel text-pixel-sm text-gold">CHARACTER SHEET</h2>
      </div>

      {/* Character Info Panel */}
      <div className="panel p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 bg-stone-panel border-4 border-border-gold rounded flex items-center justify-center text-5xl">
            {getClassIcon(member.role)}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h3 className="font-pixel text-pixel-md text-gold uppercase">
                {member.name}
              </h3>
              <span className="px-3 py-1 bg-stone-panel border border-border-gold rounded font-pixel text-pixel-xs text-beige">
                Level {progress?.level ?? 1}
              </span>
            </div>

            <p className="font-readable text-lg text-beige/70 mt-1">
              {member.role}
            </p>

            {/* XP Bar */}
            <div className="mt-3">
              <div className="flex justify-between text-sm font-readable text-beige/60 mb-1">
                <span>{progress?.title ?? 'Recruit'}</span>
                <span>{currentXP} / {nextLevelXP} XP</span>
              </div>
              <div className="h-4 bg-stone-panel border-2 border-border-gold rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold to-gold-light transition-all duration-500"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>

            {/* Skills */}
            {member.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {member.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-stone-panel border border-border-gold text-beige/80 text-sm font-readable rounded"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="mt-3 flex items-center gap-6 text-sm font-readable">
              <span className="text-quest-complete">
                Quests Completed: {progress?.ticketsCompleted ?? 0}
              </span>
              {member.jiraUsername && (
                <span className="text-beige/50">@{member.jiraUsername}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="font-pixel text-pixel-xs text-beige/70">Sort:</span>
        {(['state', 'date', 'sprint'] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className={`pixel-btn text-pixel-xs ${sortKey === key ? 'pixel-btn-primary' : ''}`}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
            {sortKey === key && (
              <span className="ml-1">{sortAsc ? '▲' : '▼'}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="panel p-8 text-center">
          <div className="animate-pulse font-pixel text-pixel-xs text-beige/70">
            Loading quests...
          </div>
        </div>
      ) : sortedTickets.length === 0 ? (
        <div className="panel p-8 text-center">
          <div className="text-4xl mb-4">📜</div>
          <p className="font-readable text-xl text-beige/70">
            No quests assigned yet
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTickets.map((ticket) => {
            const isExpanded = expandedTicketKey === ticket.key;
            const jiraUrl = getJiraUrl(ticket.key);

            return (
              <div key={ticket.key} className="panel overflow-hidden">
                {/* Ticket Header - Clickable */}
                <div
                  className="p-4 cursor-pointer hover:bg-stone-panel/50 transition-colors"
                  onClick={() => toggleTicketExpand(ticket.key)}
                >
                  <div className="flex items-center gap-4">
                    {/* Expand/Collapse Indicator */}
                    <span className="text-beige/50 text-sm w-4">
                      {isExpanded ? '▼' : '▶'}
                    </span>

                    {/* Ticket Key */}
                    <span className="font-mono text-sm text-gold font-bold min-w-[100px]">
                      {ticket.key}
                    </span>

                    {/* Summary */}
                    <div className="flex-1">
                      <p className="font-readable text-lg text-beige">
                        {ticket.summary}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-1 text-xs font-readable rounded border ${getStatusStyle(ticket.status)}`}
                    >
                      {ticket.status}
                    </span>

                    {/* Sprint Badge */}
                    {ticket.sprint ? (
                      <span
                        className={`px-2 py-1 text-xs font-readable rounded border ${getSprintStyle(ticket.sprint.state)}`}
                      >
                        {ticket.sprint.name}
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-readable rounded border bg-stone-panel border-beige/30 text-beige/50">
                        No Sprint
                      </span>
                    )}

                    {/* Date */}
                    <span className="text-xs font-readable text-beige/50 min-w-[80px] text-right">
                      {formatRelativeDate(ticket.updated)}
                    </span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border-gold bg-stone-panel/30 p-4 space-y-3">
                    {/* Description */}
                    <div>
                      <h4 className="font-pixel text-pixel-xs text-gold mb-2">DESCRIPTION</h4>
                      <p className="font-readable text-beige/80 whitespace-pre-wrap">
                        {ticket.description || 'No description available'}
                      </p>
                    </div>

                    {/* Priority */}
                    <div className="flex items-center gap-4">
                      <span className="font-pixel text-pixel-xs text-gold">PRIORITY:</span>
                      <span className="font-readable text-beige">{ticket.priority}</span>
                    </div>

                    {/* Open in Jira Link */}
                    {jiraUrl && (
                      <a
                        href={jiraUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pixel-btn text-pixel-xs inline-flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open in Jira
                        <span className="text-xs">↗</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
