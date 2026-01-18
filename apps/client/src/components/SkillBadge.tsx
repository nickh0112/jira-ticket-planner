interface SkillBadgeProps {
  skill: string;
  isInferred?: boolean;
  confidence?: number;
  status?: 'pending' | 'accepted' | 'rejected';
  size?: 'sm' | 'md';
  onAccept?: () => void;
  onReject?: () => void;
}

export function SkillBadge({
  skill,
  isInferred = false,
  confidence,
  status = 'pending',
  size = 'sm',
  onAccept,
  onReject,
}: SkillBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-xs'
    : 'px-2 py-1 text-sm';

  const getStatusClasses = () => {
    if (!isInferred) {
      return 'border-border-gold bg-stone-panel text-beige';
    }

    switch (status) {
      case 'accepted':
        return 'border-quest-complete bg-quest-complete/20 text-quest-complete';
      case 'rejected':
        return 'border-quest-abandoned bg-quest-abandoned/20 text-quest-abandoned line-through opacity-60';
      case 'pending':
      default:
        return 'border-gold bg-gold/10 text-gold skill-badge-pending';
    }
  };

  const showConfidence = isInferred && confidence !== undefined && status === 'pending';

  return (
    <span
      className={`
        inline-flex items-center gap-1 border-2 rounded font-readable
        ${sizeClasses}
        ${getStatusClasses()}
      `}
    >
      {isInferred && <span className="text-[10px]">🤖</span>}
      <span>{skill}</span>
      {showConfidence && (
        <span className="text-[10px] opacity-80">{Math.round(confidence * 100)}%</span>
      )}
      {isInferred && status === 'pending' && onAccept && onReject && (
        <span className="inline-flex gap-0.5 ml-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept();
            }}
            className="hover:text-quest-complete transition-colors"
            title="Accept skill"
          >
            ✓
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
            className="hover:text-quest-abandoned transition-colors"
            title="Reject skill"
          >
            ✗
          </button>
        </span>
      )}
    </span>
  );
}
