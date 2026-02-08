import { useRef, useEffect } from 'react';
import { useIdeasStore } from '../../store/ideasStore';
import { ChatBubble } from './ChatBubble';
import { MessageInput } from './MessageInput';
import { ThinkingSteps } from './ThinkingSteps';

export function ChatPanel() {
  const {
    currentSession,
    isSending,
    isGenerating,
    thinkingSteps,
    error,
    sendMessage,
    generatePRD,
    generateTickets,
    clearError,
    codebaseContexts,
    selectedCodebaseContextId,
    loadCodebaseContexts,
    setSelectedCodebaseContext,
  } = useIdeasStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  useEffect(() => {
    loadCodebaseContexts();
  }, [loadCodebaseContexts]);

  if (!currentSession) return null;

  const { session, messages, prd, proposals } = currentSession;
  const hasProposedTickets = proposals.some(p => p.status === 'proposed');

  const handleSend = async (content: string) => {
    await sendMessage(content);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-stone-600 flex items-center justify-between">
        <div>
          <h2 className="font-pixel text-gold">{session.title}</h2>
          <p className="text-xs text-beige/50 mt-1">
            {session.status === 'brainstorming' && 'Brainstorming your idea...'}
            {session.status === 'prd_generated' && 'Blueprint generated - review and refine'}
            {session.status === 'tickets_created' && 'Quests created!'}
          </p>
        </div>
      </div>

      {/* Thinking Steps (collapsible) */}
      {thinkingSteps.length > 0 && (
        <ThinkingSteps steps={thinkingSteps} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-beige/50">
            <p>Start describing your idea...</p>
            <p className="text-sm mt-2">
              I'll help you refine it into actionable requirements.
            </p>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <ChatBubble key={message.id} message={message} />
            ))}
          </>
        )}

        {/* Loading indicator */}
        {isSending && (
          <div className="flex items-center gap-2 text-beige/50">
            <div className="animate-pulse">🧠</div>
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-300">×</button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2 border-t border-stone-600 bg-stone-700/30">
        <div className="flex gap-2">
          {!prd && messages.length >= 2 && (
            <button
              onClick={generatePRD}
              disabled={isGenerating}
              className="stone-button text-sm flex items-center gap-1 px-3 py-1.5"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">⚙️</span>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span>📜</span>
                  <span>Generate Blueprint</span>
                </>
              )}
            </button>
          )}

          {prd && proposals.length === 0 && codebaseContexts.length > 0 && (
            <select
              value={selectedCodebaseContextId || ''}
              onChange={(e) => setSelectedCodebaseContext(e.target.value || null)}
              className="text-sm bg-stone-700 border border-stone-600 rounded px-2 py-1.5 text-beige"
            >
              <option value="">No codebase context</option>
              {codebaseContexts.map((ctx) => (
                <option key={ctx.id} value={ctx.id}>
                  {ctx.name} ({ctx.totalFiles} files)
                </option>
              ))}
            </select>
          )}

          {prd && proposals.length === 0 && (
            <button
              onClick={generateTickets}
              disabled={isGenerating}
              className="stone-button text-sm flex items-center gap-1 px-3 py-1.5"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">⚙️</span>
                  <span>Splitting...</span>
                </>
              ) : (
                <>
                  <span>⚔️</span>
                  <span>Generate Quests</span>
                </>
              )}
            </button>
          )}

          {hasProposedTickets && (
            <span className="text-xs text-beige/50 flex items-center">
              Review quests in the panel →
            </span>
          )}
        </div>
      </div>

      {/* Message Input */}
      <MessageInput onSend={handleSend} disabled={isSending || isGenerating} />
    </div>
  );
}
