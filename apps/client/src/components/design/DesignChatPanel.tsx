import { useRef, useEffect } from 'react';
import type { DesignMessage } from '@jira-planner/shared';
import { useDesignStore } from '../../store/designStore';
import { MessageInput } from '../ideas/MessageInput';

function DesignChatBubble({ message }: { message: DesignMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-gold/20 border border-gold/30 text-beige'
            : 'bg-stone-700 border border-stone-600 text-beige/90'
        }`}
      >
        <div className={`text-xs mb-1 ${isUser ? 'text-gold/70' : 'text-beige/50'}`}>
          {isUser ? 'You' : 'Design AI'}
        </div>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
        <div className="text-xs text-beige/30 mt-2 text-right">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

export function DesignChatPanel() {
  const {
    currentSession,
    isSending,
    isGenerating,
    error,
    sendMessage,
    generatePrototype,
    clearError,
  } = useDesignStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  if (!currentSession) return null;

  const { session, messages, prototypes } = currentSession;
  const hasPrototype = prototypes.length > 0;

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
            {session.status === 'designing' && 'Describe your design...'}
            {session.status === 'prototype_generated' && 'Prototype ready - review and refine'}
            {session.status === 'approved' && 'Design approved'}
            {session.status === 'shared' && 'Design shared'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-beige/50">
            <p>Describe the component you want to build...</p>
            <p className="text-sm mt-2">
              I'll help you design and generate a React prototype.
            </p>
          </div>
        ) : (
          messages.map(message => (
            <DesignChatBubble key={message.id} message={message} />
          ))
        )}

        {/* Loading indicator */}
        {isSending && (
          <div className="flex items-center gap-2 text-beige/50">
            <div className="animate-pulse">&#127912;</div>
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-300">x</button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2 border-t border-stone-600 bg-stone-700/30">
        <div className="flex gap-2">
          {messages.length >= 2 && (
            <button
              onClick={generatePrototype}
              disabled={isGenerating}
              className="stone-button text-sm flex items-center gap-1 px-3 py-1.5"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">&#9881;</span>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span>&#9881;</span>
                  <span>{hasPrototype ? 'Regenerate Prototype' : 'Generate Prototype'}</span>
                </>
              )}
            </button>
          )}

          {hasPrototype && (
            <span className="text-xs text-beige/50 flex items-center">
              Preview prototype in the panel &rarr;
            </span>
          )}
        </div>
      </div>

      {/* Message Input */}
      <MessageInput
        onSend={handleSend}
        disabled={isSending || isGenerating}
        placeholder="Describe your design... (Enter to send, Shift+Enter for new line)"
      />
    </div>
  );
}
