interface SegmentedProgressBarProps {
  filled: number;
  total: number;
  maxSegments?: number;
  color?: 'green' | 'yellow' | 'orange' | 'red' | 'blue';
  size?: 'sm' | 'md';
  label?: string;
  showCount?: boolean;
}

const colorClasses = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
};

const emptyColorClasses = {
  green: 'bg-green-900/30',
  yellow: 'bg-yellow-900/30',
  orange: 'bg-orange-900/30',
  red: 'bg-red-900/30',
  blue: 'bg-blue-900/30',
};

export function SegmentedProgressBar({
  filled,
  total,
  maxSegments = 5,
  color = 'green',
  size = 'md',
  label,
  showCount = true,
}: SegmentedProgressBarProps) {
  // Clamp values
  const displayTotal = Math.min(total, maxSegments);
  const displayFilled = Math.min(filled, displayTotal);
  const overflow = total > maxSegments;

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
  };

  const gapClasses = {
    sm: 'gap-0.5',
    md: 'gap-1',
  };

  return (
    <div className="flex items-center gap-2">
      {/* Segment dots */}
      <div className={`flex ${gapClasses[size]}`}>
        {Array.from({ length: displayTotal }).map((_, i) => (
          <div
            key={i}
            className={`
              ${sizeClasses[size]} rounded-sm transition-all duration-200
              ${i < displayFilled ? colorClasses[color] : emptyColorClasses[color]}
              ${i < displayFilled ? 'shadow-sm' : ''}
            `}
            title={`${i + 1} of ${total}`}
          />
        ))}
        {overflow && (
          <span className="text-xs text-beige/60 ml-0.5">+{total - maxSegments}</span>
        )}
      </div>

      {/* Label and count */}
      {(label || showCount) && (
        <span className="text-xs text-beige/60">
          {label && <span>{label} </span>}
          {showCount && <span>({filled})</span>}
        </span>
      )}
    </div>
  );
}
