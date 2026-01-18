interface SkillMatchMeterProps {
  confidence: number; // 0-1
  showPercentage?: boolean;
  size?: 'sm' | 'md';
}

export function SkillMatchMeter({
  confidence,
  showPercentage = true,
  size = 'sm',
}: SkillMatchMeterProps) {
  const percentage = Math.round(confidence * 100);

  // Color tiers: green (>80%), blue (50-80%), orange (<50%)
  const getColorClass = () => {
    if (percentage >= 80) {
      return 'bg-quest-complete';
    } else if (percentage >= 50) {
      return 'bg-quest-active';
    } else {
      return 'bg-rarity-legendary';
    }
  };

  const heightClass = size === 'sm' ? 'h-2' : 'h-3';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${heightClass} bg-stone-primary border border-border-gold rounded-sm overflow-hidden`}>
        <div
          className={`h-full ${getColorClass()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <span className="font-readable text-sm text-beige/70 min-w-[36px]">
          {percentage}%
        </span>
      )}
    </div>
  );
}
