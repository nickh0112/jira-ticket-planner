import { useState } from 'react';
import type { DesignPrototype } from '@jira-planner/shared';
import { useDesignStore } from '../../store/designStore';

interface ShareDialogProps {
  prototype: DesignPrototype;
  sourceId: string | null;
  onClose: () => void;
}

export function ShareDialog({ prototype, sourceId, onClose }: ShareDialogProps) {
  const { share } = useDesignStore();
  const [copied, setCopied] = useState(false);
  const [jiraResult, setJiraResult] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(prototype.componentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([prototype.componentCode], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prototype.name}.tsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleJiraShare = async () => {
    setIsSharing(true);
    const result = await share('jira');
    if (result?.jiraCommentUrl) {
      setJiraResult(result.jiraCommentUrl);
    }
    setIsSharing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-stone-secondary border border-stone-600 rounded-lg shadow-pixel w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-600">
          <h3 className="font-pixel text-gold">Share Design</h3>
          <p className="text-xs text-beige/50 mt-1">{prototype.name} v{prototype.version}</p>
        </div>

        {/* Actions */}
        <div className="p-6 space-y-3">
          <button
            onClick={handleCopyCode}
            className="w-full stone-button flex items-center justify-center gap-2 py-3"
          >
            <span>{copied ? '&#10003;' : '&#128203;'}</span>
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="w-full stone-button flex items-center justify-center gap-2 py-3"
          >
            <span>&#11015;</span>
            <span>Download .tsx</span>
          </button>

          <button
            onClick={handleJiraShare}
            disabled={!sourceId || isSharing}
            className="w-full stone-button flex items-center justify-center gap-2 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
            title={!sourceId ? 'No source ticket linked' : undefined}
          >
            <span>&#127919;</span>
            <span>{isSharing ? 'Attaching...' : 'Attach to Jira'}</span>
          </button>
          {!sourceId && (
            <p className="text-xs text-beige/40 text-center">
              Jira attachment requires a linked source ticket
            </p>
          )}
          {jiraResult && (
            <p className="text-xs text-green-400 text-center">
              Attached to Jira successfully
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-600">
          <button
            onClick={onClose}
            className="w-full stone-button flex items-center justify-center gap-2 py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
