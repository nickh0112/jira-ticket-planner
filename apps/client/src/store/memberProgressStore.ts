import { create } from 'zustand';
import type { MemberProgress, LevelUpEvent } from '@jira-planner/shared';
import { getTeamLeaderboard, getUnacknowledgedLevelUps, acknowledgeLevelUp } from '../utils/api';

// Level thresholds and titles for members
export const MEMBER_LEVELS = [
  { level: 1, xp: 0, title: 'Recruit' },
  { level: 2, xp: 200, title: 'Squire' },
  { level: 3, xp: 500, title: 'Adventurer' },
  { level: 4, xp: 1000, title: 'Veteran' },
  { level: 5, xp: 2000, title: 'Champion' },
  { level: 6, xp: 4000, title: 'Hero' },
  { level: 7, xp: 7000, title: 'Legend' },
  { level: 8, xp: 10000, title: 'Mythic' },
  { level: 9, xp: 15000, title: 'Paragon' },
  { level: 10, xp: 25000, title: 'Ascended' },
];

export interface LeaderboardEntry {
  id: string;
  name: string;
  role: string;
  xp: number;
  level: number;
  title: string;
  ticketsCompleted: number;
}

interface MemberProgressState {
  // Data
  leaderboard: LeaderboardEntry[];
  memberProgress: Record<string, MemberProgress>;
  pendingLevelUps: LevelUpEvent[];

  // UI State
  isLoading: boolean;
  showMemberLevelUp: boolean;
  currentLevelUpEvent: LevelUpEvent | null;

  // Actions
  loadLeaderboard: () => Promise<void>;
  loadLevelUpEvents: () => Promise<void>;
  updateMemberProgress: (memberId: string, progress: Partial<MemberProgress>) => void;
  addXpToMember: (memberId: string, amount: number) => void;
  showLevelUpModal: (event: LevelUpEvent) => void;
  dismissLevelUp: () => Promise<void>;
  processNextLevelUp: () => void;
}

export const useMemberProgressStore = create<MemberProgressState>((set, get) => ({
  // Initial state
  leaderboard: [],
  memberProgress: {},
  pendingLevelUps: [],
  isLoading: false,
  showMemberLevelUp: false,
  currentLevelUpEvent: null,

  // Load leaderboard from API
  loadLeaderboard: async () => {
    set({ isLoading: true });
    try {
      const leaderboard = await getTeamLeaderboard();
      set({ leaderboard, isLoading: false });
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      set({ isLoading: false });
    }
  },

  // Load pending level-up events
  loadLevelUpEvents: async () => {
    try {
      const events = await getUnacknowledgedLevelUps();
      set({ pendingLevelUps: events });

      // Auto-show first event if any
      if (events.length > 0 && !get().showMemberLevelUp) {
        get().processNextLevelUp();
      }
    } catch (error) {
      console.error('Failed to load level-up events:', error);
    }
  },

  // Update a specific member's progress
  updateMemberProgress: (memberId, progress) => {
    set((state) => ({
      memberProgress: {
        ...state.memberProgress,
        [memberId]: {
          ...state.memberProgress[memberId],
          ...progress,
        },
      },
      // Also update leaderboard if member exists
      leaderboard: state.leaderboard.map((entry) =>
        entry.id === memberId
          ? {
              ...entry,
              xp: progress.xp ?? entry.xp,
              level: progress.level ?? entry.level,
              title: progress.title ?? entry.title,
              ticketsCompleted: progress.ticketsCompleted ?? entry.ticketsCompleted,
            }
          : entry
      ).sort((a, b) => b.xp - a.xp),
    }));
  },

  // Add XP to a member (client-side update before server confirms)
  addXpToMember: (memberId, amount) => {
    const state = get();
    const current = state.memberProgress[memberId] || { xp: 0, level: 1, title: 'Recruit', ticketsCompleted: 0 };
    const newXp = current.xp + amount;

    // Calculate new level
    let newLevel = 1;
    let newTitle = 'Recruit';
    for (let i = MEMBER_LEVELS.length - 1; i >= 0; i--) {
      if (newXp >= MEMBER_LEVELS[i].xp) {
        newLevel = MEMBER_LEVELS[i].level;
        newTitle = MEMBER_LEVELS[i].title;
        break;
      }
    }

    get().updateMemberProgress(memberId, {
      ...current,
      xp: newXp,
      level: newLevel,
      title: newTitle,
    } as MemberProgress);
  },

  // Show level-up modal for a specific event
  showLevelUpModal: (event) => {
    set({
      showMemberLevelUp: true,
      currentLevelUpEvent: event,
    });
  },

  // Dismiss level-up modal and acknowledge on server
  dismissLevelUp: async () => {
    const { currentLevelUpEvent } = get();
    if (currentLevelUpEvent) {
      try {
        await acknowledgeLevelUp(currentLevelUpEvent.id);
      } catch (error) {
        console.error('Failed to acknowledge level-up:', error);
      }
    }

    set((state) => ({
      showMemberLevelUp: false,
      currentLevelUpEvent: null,
      pendingLevelUps: state.pendingLevelUps.filter(
        (e) => e.id !== currentLevelUpEvent?.id
      ),
    }));

    // Process next level-up if any
    setTimeout(() => {
      get().processNextLevelUp();
    }, 500);
  },

  // Process next pending level-up
  processNextLevelUp: () => {
    const { pendingLevelUps, showMemberLevelUp } = get();
    if (!showMemberLevelUp && pendingLevelUps.length > 0) {
      get().showLevelUpModal(pendingLevelUps[0]);
    }
  },
}));

// Helper to calculate level info
export function calculateMemberLevel(xp: number): { level: number; title: string; nextLevelXp: number; currentLevelXp: number } {
  let level = 1;
  let title = 'Recruit';
  let currentLevelXp = 0;

  for (let i = MEMBER_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= MEMBER_LEVELS[i].xp) {
      level = MEMBER_LEVELS[i].level;
      title = MEMBER_LEVELS[i].title;
      currentLevelXp = MEMBER_LEVELS[i].xp;
      break;
    }
  }

  const nextLevel = MEMBER_LEVELS.find((l) => l.level === level + 1);
  const nextLevelXp = nextLevel ? nextLevel.xp : MEMBER_LEVELS[MEMBER_LEVELS.length - 1].xp;

  return { level, title, nextLevelXp, currentLevelXp };
}
