import { useState } from 'react';
import { useIdeasStore } from '../../store/ideasStore';
import { SessionCard } from './SessionCard';
import { ImportPRDModal } from './ImportPRDModal';

export function SessionSidebar() {
  const {
    sessions,
    currentSession,
    sidebarOpen,
    isLoading,
    toggleSidebar,
    createSession,
    loadSession,
    archiveSession,
  } = useIdeasStore();

  const [showImportModal, setShowImportModal] = useState(false);

  const handleNewSession = async () => {
    const title = prompt('Name your idea:');
    if (title) {
      await createSession(title);
    }
  };

  if (!sidebarOpen) {
    return (
      <div className="w-12 bg-stone-secondary border-r border-stone-600 flex flex-col items-center py-4">
        <button
          onClick={toggleSidebar}
          className="p-2 text-beige/60 hover:text-gold transition-colors"
          title="Open sidebar"
        >
          <span className="text-lg">📋</span>
        </button>
        <button
          onClick={handleNewSession}
          className="mt-4 p-2 text-beige/60 hover:text-gold transition-colors"
          title="New idea"
        >
          <span className="text-lg">➕</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-stone-secondary border-r border-stone-600 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-stone-600 flex items-center justify-between">
        <h3 className="font-pixel text-gold text-sm">IDEAS</h3>
        <button
          onClick={toggleSidebar}
          className="p-1 text-beige/60 hover:text-gold transition-colors"
          title="Collapse sidebar"
        >
          <span>«</span>
        </button>
      </div>

      {/* New Session Button */}
      <div className="p-3 border-b border-stone-600">
        <button
          onClick={handleNewSession}
          className="w-full stone-button stone-button-primary flex items-center justify-center gap-2 py-2"
        >
          <span>⚒️</span>
          <span className="text-sm">Start Forging</span>
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          className="w-full stone-button flex items-center justify-center gap-2 py-2 mt-2"
        >
          <span>📄</span>
          <span className="text-sm">Import PRD</span>
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading && sessions.length === 0 ? (
          <div className="text-center py-8 text-beige/50 text-sm">
            Loading...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-beige/50 text-sm">
            No ideas yet.
            <br />
            Click "Start Forging" to begin!
          </div>
        ) : (
          sessions
            .filter(s => s.status !== 'archived')
            .map(session => (
              <SessionCard
                key={session.id}
                session={session}
                isActive={currentSession?.session.id === session.id}
                onClick={() => loadSession(session.id)}
                onArchive={() => {
                  if (confirm('Archive this idea session?')) {
                    archiveSession(session.id);
                  }
                }}
              />
            ))
        )}
      </div>

      {/* Footer - Archived sessions toggle */}
      <div className="p-3 border-t border-stone-600">
        <details className="text-beige/50 text-xs">
          <summary className="cursor-pointer hover:text-beige/70">
            Archived ({sessions.filter(s => s.status === 'archived').length})
          </summary>
          <div className="mt-2 space-y-1">
            {sessions
              .filter(s => s.status === 'archived')
              .map(session => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className="w-full text-left p-2 rounded hover:bg-stone-600/30 truncate"
                >
                  {session.title}
                </button>
              ))}
          </div>
        </details>
      </div>

      <ImportPRDModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
