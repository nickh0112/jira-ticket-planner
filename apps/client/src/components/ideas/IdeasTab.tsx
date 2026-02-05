import { useEffect } from 'react';
import { useIdeasStore } from '../../store/ideasStore';
import { SessionSidebar } from './SessionSidebar';
import { ChatPanel } from './ChatPanel';
import { ArtifactPanel } from './ArtifactPanel';

export function IdeasTab() {
  const {
    currentSession,
    artifactView,
    loadSessions,
  } = useIdeasStore();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Session Sidebar */}
      <SessionSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {!currentSession ? (
          // Empty state when no session is selected
          <div className="flex-1 flex items-center justify-center bg-stone-primary">
            <div className="text-center space-y-4 p-8">
              <div className="text-6xl">🧠</div>
              <h2 className="font-pixel text-pixel-lg text-gold">The Forge</h2>
              <p className="text-beige/70 max-w-md">
                Transform your ideas into actionable tickets through AI-powered brainstorming.
                Select a session or start forging a new idea.
              </p>
              <button
                onClick={() => {
                  const store = useIdeasStore.getState();
                  const title = prompt('Name your idea:');
                  if (title) {
                    store.createSession(title);
                  }
                }}
                className="stone-button stone-button-primary inline-flex items-center gap-2"
              >
                <span>⚒️</span>
                <span>Start Forging</span>
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
              <ChatPanel />
            </div>

            {/* Artifact Panel (Right) */}
            {artifactView !== 'none' && (
              <div className="w-1/2 flex flex-col bg-stone-primary">
                <ArtifactPanel />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
