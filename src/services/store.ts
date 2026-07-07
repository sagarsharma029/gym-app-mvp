import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ActiveTrackedExercise {
  workout_exercise_id: number;
  exercise_id: number;
  name: string;
  primary_muscle: string;
  sub_muscle: string;
  difficulty: number;
  gender: string;
  base_multiplier: number;
  sets: Array<{
    id: string;
    weight: string;
    reps: string;
    isCompleted: boolean;
  }>;
}

interface UserState {
  isOnboarded: boolean;
  age: number;
  weight: number; 
  height: number; 
  gender: 'M' | 'F' | 'U';
  experienceLevel: 'Beginner' | 'Familiar' | 'Advanced';
  activeSplit: '3_DAY' | '4_DAY' | '5_DAY' | 'CUSTOM';
  currentWorkoutDayOrder: number; 

  // 🌟 Temporary active workspace state cache to prevent data loss on unintended closeouts
  activeSessionCache: ActiveTrackedExercise[] | null;

  timerId: any | null; 
  isTimerRunning: boolean;
  timeRemaining: number; 

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
  updateActiveSessionCache: (cache: ActiveTrackedExercise[] | null) => void;
  
  setTimerId: (id: any | null) => void;
  setTimerRunning: (running: boolean) => void;
  tickTimer: () => void;
  resetTimer: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      isOnboarded: false,
      age: 0,
      weight: 0,
      height: 0,
      gender: 'M',
      experienceLevel: 'Beginner',
      activeSplit: '5_DAY',
      currentWorkoutDayOrder: 1,
      activeSessionCache: null, // Default empty state layer

      timerId: null,
      isTimerRunning: false,
      timeRemaining: 120,

      completeOnboarding: (params) =>
        set({
          isOnboarded: true,
          age: params.age,
          weight: params.weight,
          height: params.height,
          gender: params.gender,
          experienceLevel: params.experienceLevel,
          activeSplit: params.activeSplit,
          activeSessionCache: null, // Flush cache on fresh onboarding trigger
        }),

      resetAllData: () => {
        const state = get();
        if (state.timerId) clearInterval(state.timerId);
        set({
          isOnboarded: false,
          age: 0,
          weight: 0,
          height: 0,
          gender: 'M',
          experienceLevel: 'Beginner',
          activeSplit: '5_DAY',
          currentWorkoutDayOrder: 1,
          activeSessionCache: null,
          timerId: null,
          isTimerRunning: false,
          timeRemaining: 120,
        });
      },

      advanceToNextWorkoutDay: () =>
        set((state) => {
          let nextDay = state.currentWorkoutDayOrder + 1;
          const split = state.activeSplit;

          if (split === '5_DAY' && nextDay > 5) nextDay = 1;
          else if (split === '3_DAY' && nextDay > 6) nextDay = 1;
          else if (split === '4_DAY' && nextDay > 4) nextDay = 1;
          else if (split === 'CUSTOM' && nextDay > 7) nextDay = 1;

          return { currentWorkoutDayOrder: nextDay, activeSessionCache: null };
        }),

      updateActiveSessionCache: (cache) => set({ activeSessionCache: cache }),

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
      name: 'gym-core-user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isOnboarded: state.isOnboarded,
        age: state.age,
        weight: state.weight,
        height: state.height,
        gender: state.gender,
        experienceLevel: state.experienceLevel,
        activeSplit: state.activeSplit,
        currentWorkoutDayOrder: state.currentWorkoutDayOrder,
        activeSessionCache: state.activeSessionCache, // Persists active state rows safely across restarts
      }),
    }
  )
);