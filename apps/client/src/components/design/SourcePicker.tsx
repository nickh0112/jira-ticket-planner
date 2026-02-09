import { useState, useEffect, useMemo } from 'react';
import type { DesignSourceType, Ticket, IdeaSession } from '@jira-planner/shared';
import { getTickets } from '../../utils/api';
import { getIdeaSessions } from '../../utils/api';

interface SourcePickerProps {
  onSubmit: (title: string, sourceType: DesignSourceType, sourceId?: string) => void;
  onClose: () => void;
}

const priorityColors: Record<string, string> = {
  highest: 'bg-red-500/20 text-red-300',
  high: 'bg-orange-500/20 text-orange-300',
  medium: 'bg-yellow-500/20 text-yellow-300',
  low: 'bg-blue-500/20 text-blue-300',
  lowest: 'bg-stone-500/20 text-stone-300',
};

const typeIcons: Record<string, string> = {
  feature: '&#9733;',
  bug: '&#128027;',
  improvement: '&#9889;',
  task: '&#9745;',
  design: '&#127912;',
};

const sessionStatusColors: Record<string, string> = {
  prd_generated: 'bg-purple-500/20 text-purple-300',
  tickets_created: 'bg-green-500/20 text-green-300',
};

export function SourcePicker({ onSubmit, onClose }: SourcePickerProps) {
  const [title, setTitle] = useState('');
  const [titleOverridden, setTitleOverridden] = useState(false);
  const [sourceType, setSourceType] = useState<DesignSourceType>('freeform');
  const [sourceId, setSourceId] = useState('');
  const [search, setSearch] = useState('');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sessions, setSessions] = useState<IdeaSession[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Fetch tickets on mount
  useEffect(() => {
    setLoadingTickets(true);
    getTickets()
      .then((res) => setTickets(res.tickets))
      .catch(() => {})
      .finally(() => setLoadingTickets(false));
  }, []);

  // Fetch idea sessions on mount
  useEffect(() => {
    setLoadingSessions(true);
    getIdeaSessions()
      .then((res) => setSessions(res.sessions))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  // Filter sessions to only those with PRDs
  const prdSessions = useMemo(
    () => sessions.filter((s) => s.status === 'prd_generated' || s.status === 'tickets_created'),
    [sessions]
  );

  // Client-side filtering
  const filteredTickets = useMemo(() => {
    if (!search.trim()) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.jiraKey && t.jiraKey.toLowerCase().includes(q))
    );
  }, [tickets, search]);

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return prdSessions;
    const q = search.toLowerCase();
    return prdSessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [prdSessions, search]);

  const handleSelect = (id: string, itemTitle: string) => {
    setSourceId(id);
    if (!titleOverridden) {
      setTitle(itemTitle);
    }
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setTitleOverridden(true);
  };

  // Reset search and selection when switching source type
  const handleSourceTypeChange = (type: DesignSourceType) => {
    setSourceType(type);
    setSearch('');
    setSourceId('');
    if (!titleOverridden) setTitle('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(
      title.trim(),
      sourceType,
      sourceType !== 'freeform' && sourceId ? sourceId : undefined
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-stone-secondary border border-stone-600 rounded-lg shadow-pixel w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-600 shrink-0">
          <h3 className="font-pixel text-gold">New Design Session</h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
            {/* Title */}
            <div>
              <label className="block text-sm text-beige/70 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Dashboard Metrics Card"
                className="w-full bg-stone-700 border border-stone-600 rounded-lg px-4 py-2 text-beige placeholder-beige/40 focus:outline-none focus:border-gold/50"
                autoFocus
              />
            </div>

            {/* Source Type */}
            <div>
              <label className="block text-sm text-beige/70 mb-1">Source</label>
              <div className="flex gap-2">
                {(['freeform', 'ticket', 'prd'] as DesignSourceType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSourceTypeChange(type)}
                    className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                      sourceType === type
                        ? 'border-gold/50 bg-gold/10 text-gold'
                        : 'border-stone-600 bg-stone-700 text-beige/60 hover:text-beige'
                    }`}
                  >
                    {type === 'freeform' && 'Freeform'}
                    {type === 'ticket' && 'From Ticket'}
                    {type === 'prd' && 'From PRD'}
                  </button>
                ))}
              </div>
            </div>

            {/* Ticket Picker */}
            {sourceType === 'ticket' && (
              <div>
                <label className="block text-sm text-beige/70 mb-1">Select Ticket</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or Jira key..."
                  className="w-full bg-stone-700 border border-stone-600 rounded-lg px-4 py-2 text-beige placeholder-beige/40 focus:outline-none focus:border-gold/50 mb-2"
                />
                <div className="max-h-48 overflow-y-auto border border-stone-600 rounded-lg bg-stone-700/50">
                  {loadingTickets ? (
                    <div className="text-center py-6 text-beige/50 text-sm">Loading tickets...</div>
                  ) : filteredTickets.length === 0 ? (
                    <div className="text-center py-6 text-beige/50 text-sm">
                      {search ? 'No tickets match your search' : 'No tickets found'}
                    </div>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => handleSelect(ticket.id, ticket.title)}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-b border-stone-600/50 last:border-b-0 ${
                          sourceId === ticket.id
                            ? 'bg-gold/10 text-gold'
                            : 'text-beige hover:bg-stone-600/50'
                        }`}
                      >
                        <span className="shrink-0 text-xs font-mono text-beige/50 w-16 truncate">
                          {ticket.jiraKey || 'LOCAL'}
                        </span>
                        <span className="flex-1 text-sm truncate">{ticket.title}</span>
                        <span
                          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${priorityColors[ticket.priority] || ''}`}
                        >
                          {ticket.priority}
                        </span>
                        <span
                          className="shrink-0 text-xs"
                          dangerouslySetInnerHTML={{ __html: typeIcons[ticket.ticketType] || '' }}
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* PRD Picker */}
            {sourceType === 'prd' && (
              <div>
                <label className="block text-sm text-beige/70 mb-1">Select PRD</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title..."
                  className="w-full bg-stone-700 border border-stone-600 rounded-lg px-4 py-2 text-beige placeholder-beige/40 focus:outline-none focus:border-gold/50 mb-2"
                />
                <div className="max-h-48 overflow-y-auto border border-stone-600 rounded-lg bg-stone-700/50">
                  {loadingSessions ? (
                    <div className="text-center py-6 text-beige/50 text-sm">Loading PRDs...</div>
                  ) : filteredSessions.length === 0 ? (
                    <div className="text-center py-6 text-beige/50 text-sm">
                      {search ? 'No PRDs match your search' : 'No PRDs found'}
                    </div>
                  ) : (
                    filteredSessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => handleSelect(session.id, session.title)}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-b border-stone-600/50 last:border-b-0 ${
                          sourceId === session.id
                            ? 'bg-gold/10 text-gold'
                            : 'text-beige hover:bg-stone-600/50'
                        }`}
                      >
                        <span className="flex-1 text-sm truncate">{session.title}</span>
                        <span
                          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                            sessionStatusColors[session.status] || 'bg-stone-500/20 text-stone-300'
                          }`}
                        >
                          {session.status === 'prd_generated' ? 'PRD' : 'Tickets'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions — pinned to bottom */}
          <div className="px-6 pb-6 pt-2 flex gap-2 shrink-0 border-t border-stone-600/50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 stone-button py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 stone-button stone-button-primary py-2 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
