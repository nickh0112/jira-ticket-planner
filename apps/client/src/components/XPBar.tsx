import {
  useProgressStore,
  getCurrentLevelXp,
  getNextLevelXp,
} from '../store/progressStore';

export function XPBar() {
  const { xp, level, title, questsCompleted } = useProgressStore();

  const currentLevelXp = getCurrentLevelXp(level);
  const nextLevelXp = getNextLevelXp(level);
  const xpInCurrentLevel = xp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  const progressPercent = Math.min(
    (xpInCurrentLevel / xpNeededForNextLevel) * 100,
    100
  );

  const isMaxLevel = level >= 10;

  return (
    <div className="flex items-center gap-4">
      {/* Level badge */}
      <div className="flex items-center gap-2">
        <span className="font-pixel text-pixel-sm text-gold">Lv.{level}</span>
        <span className="font-pixel text-pixel-xs text-beige uppercase tracking-wider">
          {title}
        </span>
      </div>

      {/* XP Bar */}
      <div className="flex-1 max-w-[200px]">
        <div className="xp-bar h-4">
          <div
            className="xp-bar-fill h-full"
            style={{ width: `${isMaxLevel ? 100 : progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="font-readable text-sm text-beige/70">
            {xp.toLocaleString()} XP
          </span>
          {!isMaxLevel && (
            <span className="font-readable text-sm text-beige/50">
              {nextLevelXp.toLocaleString()} XP
            </span>
          )}
        </div>
      </div>

      {/* Quest counter */}
      <div className="text-right">
        <span className="font-readable text-sm text-beige/70">
          Quests Complete:
        </span>
        <span className="font-pixel text-pixel-sm text-quest-complete ml-2">
          {questsCompleted}
        </span>
      </div>
    </div>
  );
}
