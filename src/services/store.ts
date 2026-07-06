import AsyncStorage from '@react-native-async-storage/async-storage'; // Pre-installed with your Expo stack layout
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Strict State Interfaces aligned with Phase 2 relational database filters
interface UserState {
  // Biometric & Profile States
  isOnboarded: boolean;
  age: number;
  weight: number; 
  height: number; 
  gender: 'M' | 'F' | 'U';
  experienceLevel: 'Beginner' | 'Familiar' | 'Advanced';
  activeSplit: '3_DAY' | '4_DAY' | '5_DAY' | 'CUSTOM';
  currentWorkoutDayOrder: number; 

  // Integrated Rest Timer States 
  timerId: any | null; 
  isTimerRunning: boolean;
  timeRemaining: number; 

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

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // Default Seed Parameters
      isOnboarded: false,
      age: 0,
      weight: 0,
      height: 0,
      gender: 'M',
      experienceLevel: 'Beginner',
      activeSplit: '5_DAY',
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
        }),

      // Action: Hard Factory Storage Reset with Explicit Thread Cleanup
      resetAllData: () => {
        const state = get();
        if (state.timerId) {
          clearInterval(state.timerId);
        }

        set({
          isOnboarded: false,
          age: 0,
          weight: 0,
          height: 0,
          gender: 'M',
          experienceLevel: 'Beginner',
          activeSplit: '5_DAY',
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

          if (split === '5_DAY' && nextDay > 5) {
            nextDay = 1;
          } else if (split === '3_DAY' && nextDay > 6) { 
            nextDay = 1;
          } else if (split === '4_DAY' && nextDay > 4) {
            nextDay = 1;
          } else if (split === 'CUSTOM' && nextDay > 7) { 
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
    }),
    {
      name: 'gym-core-user-storage', // Persistent key descriptor
      storage: createJSONStorage(() => AsyncStorage), // Native device filesystem engine proxy hook
      // Exclude running background interval processes loops from serialization graphs safely
      partialize: (state) => ({
        isOnboarded: state.isOnboarded,
        age: state.age,
        weight: state.weight,
        height: state.height,
        gender: state.gender,
        experienceLevel: state.experienceLevel,
        activeSplit: state.activeSplit,
        currentWorkoutDayOrder: state.currentWorkoutDayOrder,
      }),
    }
  )
);