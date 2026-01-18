import { useEffect, useState } from 'react';
import { useProgressStore } from '../store/progressStore';

export function LevelUpModal() {
  const { showLevelUp, newLevel, newTitle, dismissLevelUp } = useProgressStore();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (showLevelUp) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showLevelUp]);

  if (!showLevelUp) return null;

  return (
    <>
      {/* Full screen flash */}
      <div className="fixed inset-0 z-[200] animate-level-up pointer-events-none" />

      {/* Confetti particles */}
      {showConfetti && (
        <div className="fixed inset-0 z-[201] pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                backgroundColor: ['#FFD700', '#FF8C00', '#9C27B0', '#4CAF50', '#2196F3'][
                  Math.floor(Math.random() * 5)
                ],
                animation: `confetti-fall ${2 + Math.random() * 2}s linear forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <div
        className="fixed inset-0 z-[202] flex items-center justify-center bg-black/70"
        onClick={dismissLevelUp}
      >
        <div
          className="panel p-8 text-center max-w-md animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Stars decoration */}
          <div className="flex justify-center gap-2 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="text-2xl animate-sparkle"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                ✦
              </span>
            ))}
          </div>

          {/* Level up text */}
          <h2 className="font-pixel text-pixel-2xl text-gold mb-4 animate-glow-pulse">
            LEVEL UP!
          </h2>

          <div className="pixel-divider mb-4" />

          {/* New level */}
          <div className="mb-6">
            <span className="font-pixel text-pixel-xl text-beige">
              Level {newLevel}
            </span>
          </div>

          {/* New title */}
          <div className="mb-8">
            <span className="font-readable text-2xl text-gold-dark">
              New Title Unlocked:
            </span>
            <div className="font-pixel text-pixel-lg text-gold mt-2">
              {newTitle}
            </div>
          </div>

          {/* Continue button */}
          <button
            onClick={dismissLevelUp}
            className="pixel-btn pixel-btn-primary text-pixel-sm"
          >
            CONTINUE
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
