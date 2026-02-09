import { useEffect } from 'react';
import { useDesignStore } from '../../store/designStore';
import { DesignSessionSidebar } from './DesignSessionSidebar';
import { DesignChatPanel } from './DesignChatPanel';
import { DesignArtifactPanel } from './DesignArtifactPanel';

export function DesignTab() {
  const {
    currentSession,
    artifactView,
    loadSessions,
  } = useDesignStore();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Session Sidebar */}
      <DesignSessionSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {!currentSession ? (
          // Empty state when no session is selected
          <div className="flex-1 flex items-center justify-center bg-stone-primary">
            <div className="text-center space-y-4 p-8">
              <div className="text-6xl">&#127912;</div>
              <h2 className="font-pixel text-pixel-lg text-gold">Design Studio</h2>
              <p className="text-beige/70 max-w-md">
                Transform your ideas into production-quality React prototypes through AI-powered design sessions.
              </p>
              <button
                onClick={() => {
                  const store = useDesignStore.getState();
                  const title = prompt('Name your design:');
                  if (title) {
                    store.createSession(title);
                  }
                }}
                className="stone-button stone-button-primary inline-flex items-center gap-2"
              >
                <span>&#127912;</span>
                <span>Start Designing</span>
              </button>
            </div>
          </div>
        ) : (
          // Split screen when session is active
          <>
            {/* Chat Panel (Left) */}
            <div className={`flex flex-col bg-stone-secondary border-r border-stone-600 ${
              artifactView !== 'none' ? 'w-1/2' : 'flex-1'
            }`}>
              <DesignChatPanel />
            </div>

            {/* Artifact Panel (Right) */}
            {artifactView !== 'none' && (
              <div className="w-1/2 flex flex-col bg-stone-primary">
                <DesignArtifactPanel />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
