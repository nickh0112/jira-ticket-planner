import { useState } from 'react';
import { useIdeasStore } from '../../store/ideasStore';
import { copyPRDToClipboard, downloadPRD } from '../../utils/prdExport';

export function ArtifactHeader() {
  const { currentSession, artifactView, setArtifactView } = useIdeasStore();
  const [copied, setCopied] = useState(false);

  if (!currentSession) return null;

  const { prd, proposals } = currentSession;

  const handleCopy = async () => {
    if (prd) {
      await copyPRDToClipboard(prd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (prd) {
      downloadPRD(prd);
    }
  };

  const handleClose = () => {
    setArtifactView('none');
  };

  return (
    <div className="px-4 py-3 border-b border-stone-600 bg-stone-secondary flex items-center justify-between">
      <div className="flex items-center gap-3">
        {artifactView === 'prd' && prd && (
          <>
            <span className="text-lg">📜</span>
            <div>
              <h3 className="font-medium text-beige">{prd.title}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                MD
              </span>
            </div>
          </>
        )}
        {artifactView === 'tickets' && (
          <>
            <span className="text-lg">⚔️</span>
            <div>
              <h3 className="font-medium text-beige">Quest Proposals</h3>
              <span className="text-xs text-beige/50">
                {proposals.filter(p => p.status === 'proposed').length} pending review
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {artifactView === 'prd' && prd && (
          <>
            <button
              onClick={handleCopy}
              className="stone-button text-xs px-3 py-1.5 flex items-center gap-1"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <span>✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="stone-button text-xs px-3 py-1.5 flex items-center gap-1"
              title="Download as Markdown"
            >
              <span>⬇️</span>
              <span>Download</span>
            </button>
          </>
        )}
        <button
          onClick={handleClose}
          className="p-1.5 text-beige/50 hover:text-beige transition-colors"
          title="Close panel"
        >
          ×
        </button>
      </div>
    </div>
  );
}
