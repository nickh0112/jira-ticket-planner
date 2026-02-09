import { useState } from 'react';
import type { DesignPrototype } from '@jira-planner/shared';

interface PrototypeCodeProps {
  prototype: DesignPrototype;
}

export function PrototypeCode({ prototype }: PrototypeCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prototype.componentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-600 bg-stone-700/30">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-gold text-sm">{prototype.name}</span>
          <span className="text-xs text-beige/50 px-2 py-0.5 bg-stone-700 rounded">
            v{prototype.version}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="stone-button text-xs px-3 py-1.5 flex items-center gap-1"
        >
          {copied ? (
            <>
              <span>&#10003;</span>
              <span>Copied</span>
            </>
          ) : (
            <>
              <span>&#128203;</span>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Block */}
      <div className="flex-1 overflow-auto p-4 bg-stone-800">
        <pre className="text-sm text-beige/90 font-mono leading-relaxed whitespace-pre-wrap break-words">
          <code>{prototype.componentCode}</code>
        </pre>
      </div>
    </div>
  );
}
