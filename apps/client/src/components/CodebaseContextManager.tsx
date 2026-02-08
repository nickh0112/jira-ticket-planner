import { useState, useEffect } from 'react';
import type { CodebaseContextListItem } from '@jira-planner/shared';
import { getCodebaseContexts, deleteCodebaseContext, uploadCodebaseContext } from '../utils/api';

export function CodebaseContextManager() {
  const [contexts, setContexts] = useState<CodebaseContextListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pasteMode, setPasteMode] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadContexts = async () => {
    setLoading(true);
    try {
      const data = await getCodebaseContexts();
      setContexts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContexts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this codebase context?')) return;
    try {
      await deleteCodebaseContext(id);
      setContexts(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePasteUpload = async () => {
    setError(null);
    try {
      const parsed = JSON.parse(jsonInput);
      await uploadCodebaseContext(parsed);
      setJsonInput('');
      setPasteMode(false);
      await loadContexts();
    } catch (err: any) {
      setError(err.message || 'Invalid JSON');
    }
  };

  const topLanguages = (breakdown: Record<string, number>) => {
    return Object.entries(breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([lang, count]) => `${lang}: ${count}`)
      .join(', ');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-pixel text-gold">Codebase Contexts</h3>
        <button
          onClick={() => setPasteMode(!pasteMode)}
          className="stone-button text-sm px-3 py-1"
        >
          {pasteMode ? 'Cancel' : 'Paste JSON'}
        </button>
      </div>

      <div className="bg-stone-700/30 rounded-lg p-3 text-sm text-beige/60">
        <p>Run the analyzer to index a codebase:</p>
        <code className="block mt-1 text-xs font-mono text-gold/80 bg-stone-800 rounded p-2">
          npx tsx scripts/analyze-codebase.ts /path/to/project --name "my-project" --output post
        </code>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}

      {pasteMode && (
        <div className="space-y-2">
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste analyzer JSON output here..."
            rows={8}
            className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-beige placeholder-beige/40 focus:outline-none focus:border-gold/50 font-mono text-xs resize-y"
          />
          <button
            onClick={handlePasteUpload}
            disabled={!jsonInput.trim()}
            className="stone-button stone-button-primary text-sm px-4 py-1.5"
          >
            Upload
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4 text-beige/50 text-sm">Loading...</div>
      ) : contexts.length === 0 ? (
        <div className="text-center py-8 text-beige/50 text-sm">
          No codebase contexts yet.
          <br />
          Run the analyzer script to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {contexts.map(ctx => (
            <div
              key={ctx.id}
              className="bg-stone-700/30 border border-stone-600 rounded-lg p-3 flex items-start justify-between"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-beige">{ctx.name}</h4>
                <p className="text-xs text-beige/50 font-mono truncate">{ctx.rootPath}</p>
                <div className="flex gap-4 mt-1 text-xs text-beige/60">
                  <span>{ctx.totalFiles} files</span>
                  <span>{topLanguages(ctx.languageBreakdown)}</span>
                  <span>{new Date(ctx.analyzedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(ctx.id)}
                className="text-red-400 hover:text-red-300 text-sm ml-3"
                title="Delete context"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
