import { useState } from 'react';
import { useDesignStore } from '../../store/designStore';
import { PrototypePreview } from './PrototypePreview';
import { PrototypeCode } from './PrototypeCode';
import { ShareDialog } from './ShareDialog';

export function DesignArtifactPanel() {
  const { currentSession, designCSS, artifactView, setArtifactView, approve, isGenerating } = useDesignStore();
  const [showShareDialog, setShowShareDialog] = useState(false);

  if (!currentSession) return null;

  const { prototypes, session } = currentSession;
  if (prototypes.length === 0) return null;

  // Show the latest prototype (highest version)
  const latestPrototype = [...prototypes].sort((a, b) => b.version - a.version)[0];
  const isApproved = session.status === 'approved' || session.status === 'shared';

  return (
    <div className="flex flex-col h-full">
      {/* Tab Switcher */}
      <div className="flex border-b border-stone-600 bg-stone-secondary">
        <button
          onClick={() => setArtifactView('preview')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            artifactView === 'preview'
              ? 'text-gold border-b-2 border-gold bg-stone-700/30'
              : 'text-beige/60 hover:text-beige hover:bg-stone-700/20'
          }`}
        >
          Preview
        </button>
        <button
          onClick={() => setArtifactView('code')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            artifactView === 'code'
              ? 'text-gold border-b-2 border-gold bg-stone-700/30'
              : 'text-beige/60 hover:text-beige hover:bg-stone-700/20'
          }`}
        >
          Code
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {artifactView === 'preview' && (
          <PrototypePreview code={latestPrototype.componentCode} designCSS={designCSS ?? undefined} />
        )}
        {artifactView === 'code' && (
          <PrototypeCode prototype={latestPrototype} />
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-stone-600 bg-stone-secondary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-beige/50">
            {latestPrototype.name} v{latestPrototype.version}
            {prototypes.length > 1 && ` (${prototypes.length} versions)`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isApproved && (
            <button
              onClick={approve}
              disabled={isGenerating}
              className="stone-button stone-button-primary text-sm px-3 py-1.5 flex items-center gap-1"
            >
              <span>&#10003;</span>
              <span>Approve</span>
            </button>
          )}
          <button
            onClick={() => setShowShareDialog(true)}
            className="stone-button text-sm px-3 py-1.5 flex items-center gap-1"
          >
            <span>&#128279;</span>
            <span>Share</span>
          </button>
        </div>
      </div>

      {showShareDialog && (
        <ShareDialog
          prototype={latestPrototype}
          sourceId={session.sourceId}
          onClose={() => setShowShareDialog(false)}
        />
      )}
    </div>
  );
}
