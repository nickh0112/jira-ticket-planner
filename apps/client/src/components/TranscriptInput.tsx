import { useState, useCallback, DragEvent } from 'react';
import { useStore } from '../store/useStore';
import { useProgressStore, XP_REWARDS } from '../store/progressStore';
import { parseTranscript } from '../utils/api';

export function TranscriptInput() {
  const [transcript, setTranscript] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const { isParsing, setIsParsing, addTickets, showToast } = useStore();
  const { addXp } = useProgressStore();

  const handleParse = async (e: React.MouseEvent) => {
    if (!transcript.trim()) {
      showToast('No intel to decode!', 'error');
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseTranscript(transcript);
      addTickets(result.tickets);
      setTranscript('');

      // Award XP for decoded quests
      const questXp = result.tickets.length * XP_REWARDS.questDecoded;
      addXp(questXp, e.clientX, e.clientY);

      showToast(
        `Decoded ${result.tickets.length} quest(s)! +${questXp} XP`,
        'success'
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to decode intel',
        'error'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
        showToast('Scrolls must be .txt or .md format', 'error');
        return;
      }

      try {
        const text = await file.text();
        setTranscript(text);
      } catch {
        showToast('Failed to read scroll', 'error');
      }
    },
    [showToast]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="panel p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📜</span>
        <h2 className="font-pixel text-pixel-sm text-gold">INCOMING TRANSMISSION</h2>
      </div>

      <div className="pixel-divider mb-4" />

      {/* Parchment scroll textarea */}
      <div
        className={`relative ${isDragging ? 'ring-4 ring-gold ring-offset-2 ring-offset-stone-primary' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="parchment p-4 rounded">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste intel here or drop a scroll (.txt / .md)..."
            className="w-full h-48 bg-transparent resize-none focus:outline-none font-readable text-lg text-text-dark placeholder:text-text-dark/40"
            disabled={isParsing}
          />
        </div>

        {isDragging && (
          <div className="absolute inset-0 bg-gold/20 flex items-center justify-center rounded border-4 border-dashed border-gold">
            <p className="font-pixel text-pixel-sm text-gold">Drop scroll here</p>
          </div>
        )}
      </div>

      {/* Footer with character count and button */}
      <div className="mt-4 flex items-center justify-between">
        <p className="font-readable text-lg text-beige/60">
          {transcript.length > 0
            ? `${transcript.length.toLocaleString()} characters of intel`
            : 'Awaiting transmission...'}
        </p>

        <button
          onClick={handleParse}
          disabled={isParsing || !transcript.trim()}
          className="pixel-btn pixel-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isParsing ? (
            <span className="flex items-center gap-2">
              <span className="pixel-spinner" />
              <span>Decoding...</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>⚔️</span>
              <span>DECODE ORDERS</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
