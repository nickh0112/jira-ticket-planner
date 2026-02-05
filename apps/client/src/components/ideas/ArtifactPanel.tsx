import { useIdeasStore } from '../../store/ideasStore';
import { ArtifactHeader } from './ArtifactHeader';
import { PRDArtifact } from './PRDArtifact';
import { TicketArtifacts } from './TicketArtifacts';

export function ArtifactPanel() {
  const { currentSession, artifactView, setArtifactView } = useIdeasStore();

  if (!currentSession) return null;

  const { prd, proposals } = currentSession;
  const hasPRD = !!prd;
  const hasProposals = proposals.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Tab Switcher (when both are available) */}
      {hasPRD && hasProposals && (
        <div className="flex border-b border-stone-600 bg-stone-secondary">
          <button
            onClick={() => setArtifactView('prd')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              artifactView === 'prd'
                ? 'text-gold border-b-2 border-gold bg-stone-700/30'
                : 'text-beige/60 hover:text-beige hover:bg-stone-700/20'
            }`}
          >
            📜 Blueprint
          </button>
          <button
            onClick={() => setArtifactView('tickets')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              artifactView === 'tickets'
                ? 'text-gold border-b-2 border-gold bg-stone-700/30'
                : 'text-beige/60 hover:text-beige hover:bg-stone-700/20'
            }`}
          >
            ⚔️ Quests ({proposals.filter(p => p.status === 'proposed').length})
          </button>
        </div>
      )}

      {/* Artifact Header */}
      <ArtifactHeader />

      {/* Artifact Content */}
      <div className="flex-1 overflow-y-auto">
        {artifactView === 'prd' && prd && (
          <PRDArtifact prd={prd} />
        )}
        {artifactView === 'tickets' && (
          <TicketArtifacts proposals={proposals} />
        )}
      </div>
    </div>
  );
}
