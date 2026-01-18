import { useEffect, useState } from 'react';
import { useMemberProgressStore } from '../store/memberProgressStore';
import { useStore } from '../store/useStore';

export function MemberLevelUpModal() {
  const { showMemberLevelUp, currentLevelUpEvent, dismissLevelUp } =
    useMemberProgressStore();
  const { teamMembers } = useStore();
  const [isAnimating, setIsAnimating] = useState(false);

  const member = currentLevelUpEvent
    ? teamMembers.find((m) => m.id === currentLevelUpEvent.entityId)
    : null;

  useEffect(() => {
    if (showMemberLevelUp) {
      setIsAnimating(true);
    }
  }, [showMemberLevelUp]);

  if (!showMemberLevelUp || !currentLevelUpEvent) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-gold rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div
        className={`stone-panel p-8 max-w-md w-full mx-4 text-center relative transform transition-all duration-500 ${
          isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Level up icon */}
        <div className="text-6xl mb-4 animate-bounce">UP</div>

        {/* Title */}
        <h2 className="font-pixel text-pixel-xl text-gold mb-2 animate-pulse">
          LEVEL UP!
        </h2>

        {/* Member name */}
        {member && (
          <p className="text-lg text-beige mb-4">{member.name}</p>
        )}

        {/* Level change */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="text-center">
            <div className="font-pixel text-pixel-lg text-beige/60">
              {currentLevelUpEvent.oldLevel}
            </div>
            <div className="text-xs text-beige/40">OLD</div>
          </div>

          <div className="text-2xl text-gold">-{'>'}</div>

          <div className="text-center">
            <div className="font-pixel text-pixel-xl text-gold animate-pulse">
              {currentLevelUpEvent.newLevel}
            </div>
            <div className="text-xs text-gold/60">NEW</div>
          </div>
        </div>

        {/* New title */}
        <div className="bg-stone-primary/50 rounded-lg py-3 px-4 mb-6 border border-gold/30">
          <p className="text-sm text-beige/60 mb-1">New Title</p>
          <p className="font-pixel text-pixel-md text-gold">
            {currentLevelUpEvent.newTitle}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => {
            setIsAnimating(false);
            setTimeout(dismissLevelUp, 200);
          }}
          className="stone-button px-6 py-2 text-lg"
        >
          Awesome!
        </button>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          50% {
            transform: translateY(-100px) rotate(180deg);
            opacity: 0.5;
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
