import * as SQLite from 'expo-sqlite';
import { Exercise, Workout } from '../types/database';

const DB_NAME = 'gym_app_local.db';

export interface ActiveWorkoutData {
  workout: Workout;
  exercises: Exercise[];
}

export async function fetchWorkoutBySequence(sequenceOrder: number): Promise<ActiveWorkoutData | null> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // 1. Query the target workout matching the sequential order queue
  const workout = await db.getFirstAsync<Workout>(
    'SELECT * FROM workouts WHERE sequence_order = ?;',
    [sequenceOrder]
  );

  if (!workout) return null;

  // 2. Fetch the corresponding exercise list ordered sequentially
  const exercises = await db.getAllAsync<Exercise>(
    'SELECT * FROM exercises WHERE workout_id = ? ORDER BY sequence_order ASC;',
    [workout.id]
  );

  return {
    workout,
    exercises,
  };
}