import { useEffect, useState } from 'react';
import { useMeetingsStore, type MeetingView } from '../store/meetingsStore';
import type { MeetingType, MeetingActionItemStatus } from '@jira-planner/shared';

const MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: 'standup', label: 'Standup' },
  { value: 'sprint_planning', label: 'Sprint Planning' },
  { value: 'retro', label: 'Retrospective' },
  { value: 'one_on_one', label: '1:1' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'technical', label: 'Technical' },
  { value: 'other', label: 'Other' },
];

const MEETING_TYPE_STYLES: Record<MeetingType, { bg: string; text: string }> = {
  standup: { bg: 'bg-blue-900/40', text: 'text-blue-400' },
  sprint_planning: { bg: 'bg-purple-900/40', text: 'text-purple-400' },
  retro: { bg: 'bg-green-900/40', text: 'text-green-400' },
  one_on_one: { bg: 'bg-cyan-900/40', text: 'text-cyan-400' },
  leadership: { bg: 'bg-orange-900/40', text: 'text-orange-400' },
  technical: { bg: 'bg-yellow-900/40', text: 'text-yellow-400' },
  other: { bg: 'bg-stone-700', text: 'text-text-secondary' },
};

const ACTION_STATUS_STYLES: Record<MeetingActionItemStatus, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', label: 'Open' },
  in_progress: { bg: 'bg-blue-900/40', text: 'text-blue-400', label: 'In Progress' },
  completed: { bg: 'bg-green-900/40', text: 'text-green-400', label: 'Done' },
  cancelled: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Cancelled' },
};

const STATUS_CYCLE: MeetingActionItemStatus[] = ['open', 'in_progress', 'completed'];

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function MeetingTypeBadge({ type }: { type: MeetingType }) {
  const style = MEETING_TYPE_STYLES[type];
  const label = MEETING_TYPES.find((t) => t.value === type)?.label ?? type;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-pixel ${style.bg} ${style.text}`}>
      {label}
    </span>
  );
}

function MeetingResults({ meeting }: { meeting: MeetingView }) {
  const { updateActionItem, convertToTicket } = useMeetingsStore();

  const handleStatusCycle = (actionItemId: string, currentStatus: MeetingActionItemStatus) => {
    const idx = STATUS_CYCLE.indexOf(currentStatus);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    updateActionItem(meeting.id, actionItemId, next);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      {meeting.summary && (
        <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
          <div className="px-4 py-3 border-b border-border-gold/30">
            <h3 className="font-pixel text-pixel-md text-gold">AI Summary</h3>
          </div>
          <div className="p-4">
            <p className="font-readable text-text-primary leading-relaxed">{meeting.summary}</p>
          </div>
        </div>
      )}

      {/* Objectives */}
      {meeting.objectives.length > 0 && (
        <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
          <div className="px-4 py-3 border-b border-border-gold/30">
            <h3 className="font-pixel text-pixel-md text-gold">Objectives</h3>
          </div>
          <div className="p-4 space-y-2">
            {meeting.objectives.map((obj) => (
              <div key={obj.id} className="flex items-start gap-3 bg-stone-primary/40 rounded p-3">
                <span className="text-gold mt-0.5">&#9670;</span>
                <div className="flex-1">
                  <p className="font-readable text-text-primary">{obj.objective}</p>
                  {obj.ownerId && (
                    <p className="font-readable text-text-secondary text-sm mt-1">Owner: {obj.ownerId}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decisions */}
      {meeting.decisions.length > 0 && (
        <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
          <div className="px-4 py-3 border-b border-border-gold/30">
            <h3 className="font-pixel text-pixel-md text-gold">Decisions</h3>
          </div>
          <div className="p-4 space-y-2">
            {meeting.decisions.map((dec) => (
              <div key={dec.id} className="flex items-start gap-3 bg-stone-primary/40 rounded p-3">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                <div className="flex-1">
                  <p className="font-readable text-text-primary">{dec.decision}</p>
                  {dec.context && (
                    <p className="font-readable text-text-secondary text-sm mt-1">Context: {dec.context}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {meeting.actionItems.length > 0 && (
        <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
          <div className="px-4 py-3 border-b border-border-gold/30 flex items-center justify-between">
            <h3 className="font-pixel text-pixel-md text-gold">Action Items</h3>
            <span className="text-text-secondary text-sm font-readable">
              {meeting.actionItems.filter((a) => a.status === 'completed').length}/{meeting.actionItems.length} done
            </span>
          </div>
          <div className="p-4 space-y-2">
            {meeting.actionItems.map((item) => {
              const statusStyle = ACTION_STATUS_STYLES[item.status];
              return (
                <div key={item.id} className="flex items-center gap-3 bg-stone-primary/40 rounded p-3">
                  <button
                    onClick={() => handleStatusCycle(item.id, item.status)}
                    className={`px-2 py-0.5 rounded text-xs font-pixel ${statusStyle.bg} ${statusStyle.text} hover:opacity-80 transition-opacity`}
                    title="Click to cycle status"
                  >
                    {statusStyle.label}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-readable ${item.status === 'completed' ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
                      {item.action}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary font-readable">
                      {item.assigneeId && <span>Assignee: {item.assigneeId}</span>}
                      {item.dueDate && <span>Due: {item.dueDate}</span>}
                    </div>
                  </div>
                  {item.jiraTicketId ? (
                    <span className="px-2 py-0.5 bg-green-900/40 text-green-400 rounded text-xs font-pixel">
                      Ticket Created
                    </span>
                  ) : (
                    <button
                      onClick={() => convertToTicket(meeting.id, item.id)}
                      className="px-2 py-1 bg-blue-900/40 text-blue-400 rounded text-xs font-pixel hover:bg-blue-900/60 transition-colors border border-blue-700/40"
                    >
                      Create Ticket
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested Tickets */}
      {meeting.suggestedTickets.length > 0 && (
        <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
          <div className="px-4 py-3 border-b border-border-gold/30">
            <h3 className="font-pixel text-pixel-md text-gold">Suggested Tickets</h3>
          </div>
          <div className="p-4 space-y-3">
            {meeting.suggestedTickets.map((ticket, idx) => (
              <div key={idx} className="bg-stone-primary/40 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-purple-900/40 text-purple-400 rounded text-xs font-pixel">
                    {ticket.ticketType}
                  </span>
                  <span className="px-2 py-0.5 bg-orange-900/40 text-orange-400 rounded text-xs font-pixel">
                    {ticket.priority}
                  </span>
                </div>
                <p className="font-readable text-text-primary font-medium">{ticket.title}</p>
                <p className="font-readable text-text-secondary text-sm mt-1">{ticket.description}</p>
                {ticket.assigneeId && (
                  <p className="font-readable text-text-secondary text-xs mt-1">Suggested assignee: {ticket.assigneeId}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MeetingNotesProcessor() {
  const {
    meetings,
    currentMeeting,
    isProcessing,
    isLoading,
    error,
    processMeetingNotes,
    fetchMeetings,
    fetchMeeting,
    setCurrentMeeting,
    setError,
  } = useMeetingsStore();

  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingType>('standup');
  const [rawNotes, setRawNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleProcess = async () => {
    if (!title.trim() || !rawNotes.trim()) return;
    await processMeetingNotes(title.trim(), meetingType, rawNotes.trim());
    setTitle('');
    setRawNotes('');
  };

  const handleSelectMeeting = (m: MeetingView) => {
    // Fetch full details when selecting from history
    fetchMeeting(m.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-pixel text-pixel-lg text-gold">Meeting Notes Processor</h2>
          <p className="font-readable text-beige/60">
            Paste meeting notes and let AI extract action items, decisions, and more
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="stone-button flex items-center gap-2"
        >
          <span>&#128218;</span>
          <span>{showHistory ? 'New Meeting' : 'History'}</span>
          {meetings.length > 0 && (
            <span className="px-1.5 py-0.5 bg-gold/20 text-gold rounded text-xs font-pixel">
              {meetings.length}
            </span>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="stone-card bg-red-900/30 border-red-500/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-red-400 font-readable">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              &#10005;
            </button>
          </div>
        </div>
      )}

      {showHistory ? (
        /* Meeting History */
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-text-secondary text-center py-12 font-readable">Loading meetings...</div>
          ) : meetings.length === 0 ? (
            <div className="text-text-secondary text-center py-12 font-readable">
              No meetings processed yet. Switch to "New Meeting" to get started.
            </div>
          ) : (
            <>
              {currentMeeting && (
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() => setCurrentMeeting(null)}
                      className="text-text-secondary hover:text-text-primary font-readable text-sm"
                    >
                      &#8592; Back to list
                    </button>
                    <h3 className="font-pixel text-pixel-md text-gold">{currentMeeting.title}</h3>
                    <MeetingTypeBadge type={currentMeeting.meetingType} />
                  </div>
                  <MeetingResults meeting={currentMeeting} />
                </div>
              )}
              {!currentMeeting && (
                <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-gold/30">
                    <h3 className="font-pixel text-pixel-md text-gold">Meeting History</h3>
                  </div>
                  <div className="divide-y divide-border-gold/10">
                    {meetings.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleSelectMeeting(m)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-primary/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <MeetingTypeBadge type={m.meetingType} />
                          <span className="font-readable text-text-primary">{m.title}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm font-readable text-text-secondary">
                          <span>{formatTime(m.createdAt)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* New Meeting Input */
        <div className="space-y-6">
          {/* Input Form */}
          <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
            <div className="px-4 py-3 border-b border-border-gold/30">
              <h3 className="font-pixel text-pixel-md text-gold">New Meeting Notes</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-text-secondary text-sm font-readable mb-1">Meeting Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Sprint 12 Planning"
                    className="w-full px-3 py-2 bg-stone-primary border border-border-gold/40 rounded text-text-primary font-readable text-sm focus:outline-none focus:border-gold placeholder:text-text-secondary/50"
                  />
                </div>
                <div className="w-48">
                  <label className="block text-text-secondary text-sm font-readable mb-1">Meeting Type</label>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                    className="w-full px-3 py-2 bg-stone-primary border border-border-gold/40 rounded text-text-primary font-readable text-sm focus:outline-none focus:border-gold"
                  >
                    {MEETING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-text-secondary text-sm font-readable mb-1">Meeting Notes</label>
                <textarea
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                  placeholder="Paste your meeting notes, transcript, or summary here..."
                  rows={12}
                  className="w-full px-3 py-2 bg-stone-primary border border-border-gold/40 rounded text-text-primary font-readable text-sm focus:outline-none focus:border-gold resize-y placeholder:text-text-secondary/50"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleProcess}
                  disabled={isProcessing || !title.trim() || !rawNotes.trim()}
                  className={`stone-button px-6 flex items-center gap-2 ${
                    (!title.trim() || !rawNotes.trim()) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <span className="animate-spin">&#8635;</span>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>&#9881;</span>
                      <span>Process Notes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          {currentMeeting && <MeetingResults meeting={currentMeeting} />}
        </div>
      )}
    </div>
  );
}
