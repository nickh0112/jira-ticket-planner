import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PlayerProgress {
  xp: number;
  level: number;
  questsCompleted: number;
  title: string;
}

export interface LevelInfo {
  level: number;
  xp: number;
  title: string;
}

// XP rewards for different actions
export const XP_REWARDS = {
  questCreated: 50,      // Marking a ticket as created in JIRA
  questApproved: 10,     // Approving a quest
  questDecoded: 25,      // For each quest decoded from transcript
  batchComplete: 100,    // Completing all quests from a transcript
} as const;

// Level thresholds and titles
export const LEVELS: LevelInfo[] = [
  { level: 1, xp: 0, title: 'Novice Planner' },
  { level: 2, xp: 200, title: 'Apprentice' },
  { level: 3, xp: 500, title: 'Journeyman' },
  { level: 4, xp: 1000, title: 'Adept' },
  { level: 5, xp: 2000, title: 'Expert' },
  { level: 6, xp: 4000, title: 'Master Planner' },
  { level: 7, xp: 7000, title: 'Grandmaster' },
  { level: 8, xp: 10000, title: 'Legendary' },
  { level: 9, xp: 15000, title: 'Mythic' },
  { level: 10, xp: 25000, title: 'Quest God' },
];

// Calculate level from XP
export function calculateLevel(xp: number): LevelInfo {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

// Get XP needed for next level
export function getNextLevelXp(currentLevel: number): number {
  const nextLevel = LEVELS.find((l) => l.level === currentLevel + 1);
  return nextLevel ? nextLevel.xp : LEVELS[LEVELS.length - 1].xp;
}

// Get current level XP threshold
export function getCurrentLevelXp(currentLevel: number): number {
  const level = LEVELS.find((l) => l.level === currentLevel);
  return level ? level.xp : 0;
}

interface XPPopup {
  id: string;
  amount: number;
  x: number;
  y: number;
}

interface ProgressState {
  // Player progress
  xp: number;
  level: number;
  title: string;
  questsCompleted: number;

  // UI state
  showLevelUp: boolean;
  newLevel: number | null;
  newTitle: string | null;
  xpPopups: XPPopup[];

  // Actions
  addXp: (amount: number, x?: number, y?: number) => void;
  incrementQuestsCompleted: () => void;
  dismissLevelUp: () => void;
  removeXpPopup: (id: string) => void;
  resetProgress: () => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      // Initial state
      xp: 0,
      level: 1,
      title: 'Novice Planner',
      questsCompleted: 0,

      // UI state
      showLevelUp: false,
      newLevel: null,
      newTitle: null,
      xpPopups: [],

      // Add XP and check for level up
      addXp: (amount, x = window.innerWidth / 2, y = window.innerHeight / 2) => {
        const state = get();
        const newXp = state.xp + amount;
        const newLevelInfo = calculateLevel(newXp);
        const didLevelUp = newLevelInfo.level > state.level;

        // Create popup for XP gain
        const popupId = `${Date.now()}-${Math.random()}`;

        set({
          xp: newXp,
          level: newLevelInfo.level,
          title: newLevelInfo.title,
          showLevelUp: didLevelUp,
          newLevel: didLevelUp ? newLevelInfo.level : null,
          newTitle: didLevelUp ? newLevelInfo.title : null,
          xpPopups: [...state.xpPopups, { id: popupId, amount, x, y }],
        });

        // Auto-remove popup after animation
        setTimeout(() => {
          set((s) => ({
            xpPopups: s.xpPopups.filter((p) => p.id !== popupId),
          }));
        }, 1000);
      },

      incrementQuestsCompleted: () => {
        set((state) => ({
          questsCompleted: state.questsCompleted + 1,
        }));
      },

      dismissLevelUp: () => {
        set({
          showLevelUp: false,
          newLevel: null,
          newTitle: null,
        });
      },

      removeXpPopup: (id) => {
        set((state) => ({
          xpPopups: state.xpPopups.filter((p) => p.id !== id),
        }));
      },

      resetProgress: () => {
        set({
          xp: 0,
          level: 1,
          title: 'Novice Planner',
          questsCompleted: 0,
          showLevelUp: false,
          newLevel: null,
          newTitle: null,
          xpPopups: [],
        });
      },
    }),
    {
      name: 'quest-log-progress',
      partialize: (state) => ({
        xp: state.xp,
        level: state.level,
        title: state.title,
        questsCompleted: state.questsCompleted,
      }),
    }
  )
);
