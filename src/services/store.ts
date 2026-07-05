import { create } from 'zustand';

interface UserState {
  isOnboarded: boolean;
  experienceLevel: 'beginner' | 'intermediate' | null;
  selectedSplitDays: number | null;
  currentSequenceOrder: number; // 1 = Workout A, 2 = Workout B, 3 = Workout C
  completeOnboarding: (level: 'beginner' | 'intermediate', days: number) => void;
  resetOnboarding: () => void;
  advanceToNextWorkout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  isOnboarded: false,
  experienceLevel: null,
  selectedSplitDays: null,
  currentSequenceOrder: 1, 
  completeOnboarding: (level, days) =>
    set({ isOnboarded: true, experienceLevel: level, selectedSplitDays: days, currentSequenceOrder: 1 }),
  resetOnboarding: () =>
    set({ isOnboarded: false, experienceLevel: null, selectedSplitDays: null, currentSequenceOrder: 1 }),
  advanceToNextWorkout: () =>
    set((state) => {
      // Loop back to Workout A (1) after completing Workout C (3)
      const nextSequence = state.currentSequenceOrder >= 3 ? 1 : state.currentSequenceOrder + 1;
      return { currentSequenceOrder: nextSequence };
    }),
}));