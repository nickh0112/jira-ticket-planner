import { useEffect, useState, useMemo } from 'react';
import type {
  EngineerStatus,
  EngineerDetailData,
  TicketMicroStatus,
  ActivitySignal,
  JiraConfig,
} from '@jira-planner/shared';
import { AttentionBadge } from './AttentionBadge';
import { MicroProgressIndicator } from './MicroProgressIndicator';
import { getJiraConfig } from '../../utils/api';

interface EngineerCardExpandedProps {
  engineer: EngineerStatus;
  detailData: EngineerDetailData | null;
  isLoading: boolean;
  onClose: () => void;
  onGenerateSuggestions: () => void;
}

// Format relative date from timestamp (like character sheet)
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// Get status color for ticket
function getTicketStatusColor(status: string): string {
  const lower = status.toLowerCase();

  // Blocked/attention states (red)
  if (lower.includes('blocked') || lower.includes('hold') || lower.includes('waiting')) {
    return 'bg-red-600';
  }
  // Released/deployed (teal - positive completion)
  if (lower.includes('released') || lower.includes('deployed') || lower.includes('shipped')) {
    return 'bg-teal-500';
  }
  // Done/complete (green)
  if (lower.includes('done') || lower.includes('complete') || lower.includes('closed') || lower.includes('resolved')) {
    return 'bg-green-600';
  }
  // QA/Testing (purple)
  if (lower.includes('qa') || lower.includes('test')) {
    return 'bg-purple-600';
  }
  // Review states (yellow/amber)
  if (lower.includes('review')) {
    return 'bg-yellow-600';
  }
  // In progress (blue)
  if (lower.includes('progress')) {
    return 'bg-blue-600';
  }
  // To do / backlog / open (slate - not started)
  if (lower.includes('to do') || lower.includes('todo') || lower.includes('backlog') || lower.includes('open') || lower.includes('new')) {
    return 'bg-slate-500';
  }
  // Default fallback
  return 'bg-gray-600';
}

// Get activity icon
function getActivityIcon(type: ActivitySignal['type']): string {
  switch (type) {
    case 'status_change':
      return '🔄';
    case 'commit':
      return '💻';
    case 'pr_activity':
      return '🔀';
    case 'assignment':
      return '📋';
    case 'completion':
      return '✅';
    default:
      return '•';
  }
}

function TicketRow({ ticket, jiraBaseUrl }: { ticket: TicketMicroStatus; jiraBaseUrl: string | null }) {
  const isStale = ticket.isStale;

  // Open ticket in Jira when clicked
  const handleClick = () => {
    if (!jiraBaseUrl) return;
    const jiraUrl = `${jiraBaseUrl}/browse/${ticket.jiraKey}`;
    window.open(jiraUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleClick}
      className={`
        flex items-center gap-3 p-2 rounded cursor-pointer transition-colors
        ${isStale ? 'bg-orange-900/30 border border-orange-600/40 hover:bg-orange-900/50' : 'bg-stone-primary/50 hover:bg-stone-primary/80'}
      `}
    >
      <span
        className={`px-2 py-0.5 rounded text-xs text-white ${getTicketStatusColor(ticket.status)}`}
      >
        {ticket.status}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gold font-mono hover:underline">{ticket.jiraKey}</span>
          {isStale && (
            <span className="text-xs text-orange-400" title="Stuck for too long">
              ⚠️
            </span>
          )}
          {ticket.sprint && (
            <span className="text-xs text-beige/40 font-mono">{ticket.sprint.name}</span>
          )}
        </div>
        <p className="text-xs text-beige/60 truncate">{ticket.title}</p>
      </div>
      <div className="text-xs text-beige/50" title={`Updated: ${new Date(ticket.updated).toLocaleString()}`}>
        {formatRelativeDate(ticket.updated)}
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivitySignal }) {
  const timeAgo = new Date(activity.timestamp).toLocaleString();

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-base">{getActivityIcon(activity.type)}</span>
      <div className="flex-1">
        <p className="text-beige/80">{activity.description}</p>
        {activity.jiraKey && (
          <span className="text-xs text-gold font-mono">{activity.jiraKey}</span>
        )}
      </div>
      <span className="text-xs text-beige/40" title={timeAgo}>
        {new Date(activity.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
}

export function EngineerCardExpanded({
  engineer,
  detailData,
  isLoading,
  onClose,
  onGenerateSuggestions,
}: EngineerCardExpandedProps) {
  const [activeTab, setActiveTab] = useState<'tickets' | 'activity'>('tickets');
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);
  const [sortBy, setSortBy] = useState<'none' | 'status' | 'date' | 'priority'>('none');

  // Fetch Jira config on mount
  useEffect(() => {
    getJiraConfig()
      .then((res) => setJiraConfig(res.config))
      .catch(() => setJiraConfig(null));
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Sort tickets based on selected sort option
  const sortedTickets = useMemo(() => {
    if (!detailData?.tickets) return [];
    const tickets = [...detailData.tickets];

    const statusOrder: Record<string, number> = {
      'blocked': 0, 'hold': 0, 'waiting': 0,
      'progress': 1,
      'review': 2,
      'qa': 3, 'test': 3,
      'done': 4, 'complete': 4, 'closed': 4,
      'released': 5, 'deployed': 5,
    };

    const getStatusWeight = (status: string): number => {
      const lower = status.toLowerCase();
      for (const [key, weight] of Object.entries(statusOrder)) {
        if (lower.includes(key)) return weight;
      }
      return 10; // Unknown statuses at end
    };

    const priorityOrder: Record<string, number> = {
      'highest': 0, 'high': 1, 'medium': 2, 'low': 3, 'lowest': 4
    };

    switch (sortBy) {
      case 'status':
        return tickets.sort((a, b) => getStatusWeight(a.status) - getStatusWeight(b.status));
      case 'date':
        return tickets.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
      case 'priority':
        return tickets.sort((a, b) =>
          (priorityOrder[a.priority.toLowerCase()] ?? 5) - (priorityOrder[b.priority.toLowerCase()] ?? 5)
        );
      default:
        return tickets;
    }
  }, [detailData?.tickets, sortBy]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-lg border-2 border-gold bg-stone-secondary animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-stone">
          <div className="flex items-center gap-3">
            {engineer.needsAttention && (
              <AttentionBadge reasons={engineer.attentionReasons} size="lg" />
            )}
            <div>
              <h2 className="font-pixel text-pixel-md text-gold">
                {engineer.memberName}
              </h2>
              <p className="text-sm text-beige/60">{engineer.memberRole}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-beige/60 hover:text-beige text-xl"
          >
            ✕
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6 px-4 py-3 bg-stone-primary/50 border-b border-border-stone">
          <div className="text-center">
            <div className="text-lg font-bold text-beige">{engineer.currentTickets}</div>
            <div className="text-xs text-beige/50">Current</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">
              {engineer.ticketsCompletedThisWeek}
            </div>
            <div className="text-xs text-beige/50">This Week</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-beige">
              {engineer.avgCompletionTimeHours?.toFixed(1) || '--'}h
            </div>
            <div className="text-xs text-beige/50">Avg Time</div>
          </div>
          <div className="flex-1 flex justify-end">
            <MicroProgressIndicator lastActivityAt={engineer.lastActivityAt} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-stone">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === 'tickets'
                ? 'text-gold border-b-2 border-gold'
                : 'text-beige/60 hover:text-beige'
            }`}
          >
            Tickets ({detailData?.tickets.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === 'activity'
                ? 'text-gold border-b-2 border-gold'
                : 'text-beige/60 hover:text-beige'
            }`}
          >
            Activity ({detailData?.recentActivity.length || 0})
          </button>
        </div>

        {/* Sort controls */}
        {activeTab === 'tickets' && (detailData?.tickets?.length ?? 0) > 0 && (
          <div className="px-4 py-2 border-b border-border-stone bg-stone-primary/30">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-stone-primary text-beige text-sm rounded px-2 py-1 border border-border-stone"
            >
              <option value="none">Sort: Default</option>
              <option value="status">Sort: By Status</option>
              <option value="date">Sort: By Date</option>
              <option value="priority">Sort: By Priority</option>
            </select>
          </div>
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[40vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-beige/60 animate-pulse">Loading details...</span>
            </div>
          ) : activeTab === 'tickets' ? (
            <div className="space-y-2">
              {sortedTickets.length ? (
                sortedTickets.map((ticket) => (
                  <TicketRow key={ticket.jiraKey} ticket={ticket} jiraBaseUrl={jiraConfig?.baseUrl ?? null} />
                ))
              ) : (
                <div className="text-center py-8 text-beige/50">
                  No active tickets assigned
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {detailData?.recentActivity.length ? (
                detailData.recentActivity.map((activity, i) => (
                  <ActivityRow key={i} activity={activity} />
                ))
              ) : (
                <div className="text-center py-8 text-beige/50">
                  No recent activity
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-4 border-t border-border-stone bg-stone-primary/50">
          <div className="text-xs text-beige/40">
            {engineer.daysSinceLastAssignment !== null && (
              <span>Last assigned: {engineer.daysSinceLastAssignment}d ago</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onGenerateSuggestions}
              className="stone-button flex items-center gap-2"
            >
              <span>🎯</span>
              <span>Suggest Tickets</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
