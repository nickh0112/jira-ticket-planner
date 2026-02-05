import type { IdeaMessage } from '@jira-planner/shared';

interface ChatBubbleProps {
  message: IdeaMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
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
        {/* Role indicator */}
        <div className={`text-xs mb-1 ${isUser ? 'text-gold/70' : 'text-beige/50'}`}>
          {isUser ? 'You' : '🧠 Forge AI'}
        </div>

        {/* Message content - render with basic markdown support */}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {renderMarkdown(message.content)}
        </div>

        {/* Timestamp */}
        <div className="text-xs text-beige/30 mt-2 text-right">
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMarkdown(content: string): React.ReactNode {
  // Simple markdown rendering for chat messages
  // Bold: **text** or __text__
  // Italic: *text* or _text_
  // Code: `code`
  // Lists: - item or * item

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    // Check for list items
    if (line.match(/^[\-\*]\s/)) {
      elements.push(
        <div key={lineIndex} className="flex gap-2 ml-2">
          <span className="text-gold">•</span>
          <span>{processInlineMarkdown(line.slice(2))}</span>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={lineIndex} className="flex gap-2 ml-2">
            <span className="text-gold">{match[1]}.</span>
            <span>{processInlineMarkdown(match[2])}</span>
          </div>
        );
      }
    } else {
      elements.push(
        <span key={lineIndex}>
          {processInlineMarkdown(line)}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      );
    }
  });

  return elements;
}

function processInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Pattern for **bold**, *italic*, and `code`
  const pattern = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|`([^`]+)`/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Bold
      parts.push(<strong key={match.index} className="font-bold">{match[2]}</strong>);
    } else if (match[3]) {
      // Italic
      parts.push(<em key={match.index} className="italic">{match[4]}</em>);
    } else if (match[5]) {
      // Code
      parts.push(
        <code key={match.index} className="bg-stone-800 px-1 rounded text-gold font-mono text-xs">
          {match[5]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
