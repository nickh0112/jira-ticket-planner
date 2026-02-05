import { useState } from 'react';

interface ThinkingStepsProps {
  steps: string[];
}

export function ThinkingSteps({ steps }: ThinkingStepsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (steps.length === 0) return null;

  return (
    <div className="mx-4 mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs hover:bg-purple-500/20 transition-colors"
      >
        <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
        <span>🧠 AI Reasoning ({steps.length} steps)</span>
      </button>

      {isExpanded && (
        <div className="mt-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-2 text-xs text-beige/70">
              <span className="text-purple-400 font-mono">{index + 1}.</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
