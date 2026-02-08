import { useState, useEffect } from 'react';
import { useIdeasStore } from '../../store/ideasStore';

interface ImportPRDModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportPRDModal({ isOpen, onClose }: ImportPRDModalProps) {
  const { importPRD, isLoading } = useIdeasStore();
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto-extract title from first # heading
  useEffect(() => {
    if (markdown && !title) {
      const match = markdown.match(/^#\s+(.+)$/m);
      if (match) {
        setTitle(match[1].trim());
      }
    }
  }, [markdown, title]);

  if (!isOpen) return null;

  const handleImport = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (markdown.length < 50) {
      setError('PRD content must be at least 50 characters');
      return;
    }

    try {
      await importPRD(title.trim(), markdown);
      setTitle('');
      setMarkdown('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import PRD');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
      <div className="bg-stone-800 border border-stone-600 rounded-lg w-full max-w-2xl mx-4 animate-slide-up">
        <div className="p-4 border-b border-stone-600">
          <h2 className="font-pixel text-gold text-lg">Import PRD</h2>
          <p className="text-sm text-beige/60 mt-1">
            Paste your existing PRD markdown to skip brainstorming
          </p>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-beige/70 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-extracted from # heading..."
              className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-beige placeholder-beige/40 focus:outline-none focus:border-gold/50"
            />
          </div>

          <div>
            <label className="block text-sm text-beige/70 mb-1">PRD Markdown</label>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Paste your PRD markdown here..."
              rows={20}
              className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-beige placeholder-beige/40 focus:outline-none focus:border-gold/50 font-mono text-sm resize-y"
            />
          </div>
        </div>

        <div className="p-4 border-t border-stone-600 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="stone-button px-4 py-2 text-sm"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isLoading || !title.trim() || markdown.length < 50}
            className="stone-button stone-button-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">&#9881;&#65039;</span>
                <span>Importing...</span>
              </>
            ) : (
              <>
                <span>&#128196;</span>
                <span>Import</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
