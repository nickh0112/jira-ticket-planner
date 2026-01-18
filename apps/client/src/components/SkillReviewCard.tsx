import { SkillMatchMeter } from './SkillMatchMeter';

interface SkillReviewCardProps {
  skill: string;
  confidence: number;
  evidence?: string;
  status: 'pending' | 'accepted' | 'rejected';
  onAccept: () => void;
  onReject: () => void;
}

export function SkillReviewCard({
  skill,
  confidence,
  evidence,
  status,
  onAccept,
  onReject,
}: SkillReviewCardProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'accepted':
        return 'border-quest-complete bg-quest-complete/10';
      case 'rejected':
        return 'border-quest-abandoned bg-quest-abandoned/10 opacity-60';
      case 'pending':
      default:
        return 'border-gold bg-gold/5 skill-review-pending';
    }
  };

  return (
    <div
      className={`
        p-3 border-2 rounded
        ${getStatusStyles()}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <span className={`font-pixel text-pixel-xs ${status === 'rejected' ? 'line-through text-beige/50' : 'text-beige'}`}>
            {skill}
          </span>
        </div>
        {status !== 'pending' && (
          <span className={`font-pixel text-pixel-xs ${status === 'accepted' ? 'text-quest-complete' : 'text-quest-abandoned'}`}>
            {status === 'accepted' ? '✓ ACCEPTED' : '✗ REJECTED'}
          </span>
        )}
      </div>

      <div className="mb-2">
        <div className="font-readable text-sm text-beige/60 mb-1">Confidence</div>
        <SkillMatchMeter confidence={confidence} size="sm" />
      </div>

      {evidence && (
        <div className="mb-3">
          <div className="font-readable text-sm text-beige/60 mb-1">Evidence</div>
          <p className="font-readable text-sm text-beige/70 italic">
            "{evidence}"
          </p>
        </div>
      )}

      {status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onAccept}
            className="pixel-btn pixel-btn-success text-pixel-xs flex-1"
          >
            ✓ Accept
          </button>
          <button
            onClick={onReject}
            className="pixel-btn pixel-btn-danger text-pixel-xs flex-1"
          >
            ✗ Reject
          </button>
        </div>
      )}
    </div>
  );
}
