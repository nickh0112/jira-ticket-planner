import { useState } from 'react';
import type { DesignSession, DesignSourceType } from '@jira-planner/shared';
import { useDesignStore } from '../../store/designStore';
import { SourcePicker } from './SourcePicker';

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  designing: { label: 'Designing', color: 'bg-blue-500/20 text-blue-300', icon: '&#9998;' },
  prototype_generated: { label: 'Prototype', color: 'bg-purple-500/20 text-purple-300', icon: '&#9881;' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-300', icon: '&#10003;' },
  shared: { label: 'Shared', color: 'bg-amber-500/20 text-amber-300', icon: '&#128279;' },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function SessionCard({ session, isActive, onClick, onArchive }: {
  session: DesignSession;
  isActive: boolean;
  onClick: () => void;
  onArchive: () => void;
}) {
  const status = statusConfig[session.status] || statusConfig.designing;

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg cursor-pointer transition-all border group ${
        isActive
          ? 'bg-gold/10 border-gold/50'
          : 'bg-stone-700/30 border-transparent hover:bg-stone-700/50 hover:border-stone-500'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium truncate text-sm ${isActive ? 'text-gold' : 'text-beige'}`}>
            {session.title}
          </h4>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          className="p-1 text-beige/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Archive"
        >
          x
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}
          dangerouslySetInnerHTML={{ __html: `${status.icon} ${status.label}` }}
        />
        <span className="text-xs text-beige/40">
          {formatDate(session.updatedAt)}
        </span>
      </div>
    </div>
  );
}

export function DesignSessionSidebar() {
  const {
    sessions,
    currentSession,
    sidebarOpen,
    isLoading,
    toggleSidebar,
    createSession,
    loadSession,
    archiveSession,
  } = useDesignStore();

  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const handleNewSession = () => {
    setShowSourcePicker(true);
  };

  const handleSourcePickerSubmit = async (
    title: string,
    sourceType: DesignSourceType,
    sourceId?: string
  ) => {
    setShowSourcePicker(false);
    await createSession(title, sourceType, sourceId);
  };

  if (!sidebarOpen) {
    return (
      <>
        <div className="w-12 bg-stone-secondary border-r border-stone-600 flex flex-col items-center py-4">
          <button
            onClick={toggleSidebar}
            className="p-2 text-beige/60 hover:text-gold transition-colors"
            title="Open sidebar"
          >
            <span className="text-lg">&#127912;</span>
          </button>
          <button
            onClick={handleNewSession}
            className="mt-4 p-2 text-beige/60 hover:text-gold transition-colors"
            title="New design"
          >
            <span className="text-lg">+</span>
          </button>
        </div>
        {showSourcePicker && (
          <SourcePicker
            onSubmit={handleSourcePickerSubmit}
            onClose={() => setShowSourcePicker(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="w-64 bg-stone-secondary border-r border-stone-600 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-stone-600 flex items-center justify-between">
        <h3 className="font-pixel text-gold text-sm">DESIGNS</h3>
        <button
          onClick={toggleSidebar}
          className="p-1 text-beige/60 hover:text-gold transition-colors"
          title="Collapse sidebar"
        >
          <span>&laquo;</span>
        </button>
      </div>

      {/* New Session Button */}
      <div className="p-3 border-b border-stone-600">
        <button
          onClick={handleNewSession}
          className="w-full stone-button stone-button-primary flex items-center justify-center gap-2 py-2"
        >
          <span>&#127912;</span>
          <span className="text-sm">New Design</span>
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
            No designs yet.
            <br />
            Click "New Design" to begin!
          </div>
        ) : (
          sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              isActive={currentSession?.session.id === session.id}
              onClick={() => loadSession(session.id)}
              onArchive={() => {
                if (confirm('Archive this design session?')) {
                  archiveSession(session.id);
                }
              }}
            />
          ))
        )}
      </div>

      {showSourcePicker && (
        <SourcePicker
          onSubmit={handleSourcePickerSubmit}
          onClose={() => setShowSourcePicker(false)}
        />
      )}
    </div>
  );
}
