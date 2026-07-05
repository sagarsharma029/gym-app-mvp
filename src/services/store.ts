import { create } from 'zustand';

// Strict State Interfaces aligned with Phase 2 relational database filters
interface UserState {
  // Biometric & Profile States
  isOnboarded: boolean;
  age: number;
  weight: number; // in kg
  height: number; // in cm
  gender: 'M' | 'F' | 'U';
  experienceLevel: 'Beginner' | 'Familiar' | 'Advanced';
  activeSplit: '3_DAY' | '4_DAY' | '5_DAY' | 'CUSTOM';
  currentWorkoutDayOrder: number; // Current step index within the active routine sequence queue

  // Integrated Rest Timer States (Thread Leaks Protection Sync)
  timerId: any | null; // Typed universally to pass React Native browser environment scopes
  isTimerRunning: boolean;
  timeRemaining: number; // Countdown from 120 seconds

  // Actions Mappings
  completeOnboarding: (params: {
    age: number;
    weight: number;
    height: number;
    gender: 'M' | 'F' | 'U';
    experienceLevel: 'Beginner' | 'Familiar' | 'Advanced';
    activeSplit: '3_DAY' | '4_DAY' | '5_DAY' | 'CUSTOM';
  }) => void;
  resetAllData: () => void;
  advanceToNextWorkoutDay: () => void;
  
  // Rest Timer Controller Actions
  setTimerId: (id: any | null) => void;
  setTimerRunning: (running: boolean) => void;
  tickTimer: () => void;
  resetTimer: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  // Default Seed Parameters
  isOnboarded: false,
  age: 0,
  weight: 0,
  height: 0,
  gender: 'U',
  experienceLevel: 'Beginner',
  activeSplit: '3_DAY',
  currentWorkoutDayOrder: 1,

  timerId: null,
  isTimerRunning: false,
  timeRemaining: 120,

  // Action: Commit Onboarding Configuration Inputs
  completeOnboarding: (params) =>
    set({
      isOnboarded: true,
      age: params.age,
      weight: params.weight,
      height: params.height,
      gender: params.gender,
      experienceLevel: params.experienceLevel,
      activeSplit: params.activeSplit,
      currentWorkoutDayOrder: 1, // Always initialize at Day 1 on fresh boot
    }),

  // Action: Hard Factory Storage Reset with Explicit Thread Cleanup (No Leak Bypassing)
  resetAllData: () => {
    const state = get();
    
    // Explicitly terminate the active background interval processor thread instantly
    if (state.timerId) {
      clearInterval(state.timerId);
    }

    set({
      isOnboarded: false,
      age: 0,
      weight: 0,
      height: 0,
      gender: 'U',
      experienceLevel: 'Beginner',
      activeSplit: '3_DAY',
      currentWorkoutDayOrder: 1,
      timerId: null,
      isTimerRunning: false,
      timeRemaining: 120,
    });
  },

  // Action: Advance the workout queue position cleanly based on routine split bounds
  advanceToNextWorkoutDay: () =>
    set((state) => {
      let nextDay = state.currentWorkoutDayOrder + 1;
      const split = state.activeSplit;

      // Wrap-around bounds limit check
      if (split === '5_DAY' && nextDay > 5) {
        nextDay = 1;
      } else if (split === '3_DAY' && nextDay > 6) { // 3-Day split holds Workouts A to F
        nextDay = 1;
      } else if (split === '4_DAY' && nextDay > 4) {
        nextDay = 1;
      } else if (split === 'CUSTOM' && nextDay > 7) { // Set dynamic maximum threshold for customizable frames
        nextDay = 1;
      }

      return { currentWorkoutDayOrder: nextDay };
    }),

  // Rest Timer Native Hooks Binding Mutations
  setTimerId: (id) => set({ timerId: id }),
  setTimerRunning: (running) => set({ isTimerRunning: running }),
  tickTimer: () =>
    set((state) => {
      if (state.timeRemaining <= 1) {
        if (state.timerId) clearInterval(state.timerId);
        return { timeRemaining: 120, isTimerRunning: false, timerId: null };
      }
      return { timeRemaining: state.timeRemaining - 1 };
    }),
  resetTimer: () => {
    const state = get();
    if (state.timerId) clearInterval(state.timerId);
    set({ timeRemaining: 120, isTimerRunning: false, timerId: null });
  },
}));