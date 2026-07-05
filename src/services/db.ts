import * as SQLite from 'expo-sqlite';

const DB_NAME = 'gym_app_local.db';

export async function initDatabase(): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // 1. Create Tables (Adding completed_workouts history table)
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sequence_order INTEGER NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      default_sets INTEGER NOT NULL,
      default_reps INTEGER NOT NULL,
      suggested_weight REAL NOT NULL,
      sequence_order INTEGER NOT NULL,
      FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS completed_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_name TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      total_sets INTEGER NOT NULL
    );
  `);

  const existingWorkouts = await db.getAllAsync<{ id: number }>('SELECT id FROM workouts LIMIT 1;');
  
  if (existingWorkouts.length === 0) {
    console.log('--- Seeding Initial 3-Day Sequential Workout Split ---');

    const resultA = await db.runAsync(
      'INSERT INTO workouts (name, sequence_order) VALUES (?, ?);',
      ['Workout A (Push Day)', 1]
    );
    const workoutAId = resultA.lastInsertRowId;

    await db.runAsync(
      'INSERT INTO exercises (workout_id, name, default_sets, default_reps, suggested_weight, sequence_order) VALUES (?, ?, ?, ?, ?, ?);',
      [workoutAId, 'Chest Press Machine', 3, 10, 20.0, 1]
    );
    await db.runAsync(
      'INSERT INTO exercises (workout_id, name, default_sets, default_reps, suggested_weight, sequence_order) VALUES (?, ?, ?, ?, ?, ?);',
      [workoutAId, 'Shoulder Press Machine', 3, 10, 15.0, 2]
    );

    const resultB = await db.runAsync(
      'INSERT INTO workouts (name, sequence_order) VALUES (?, ?);',
      ['Workout B (Pull Day)', 2]
    );
    const workoutBId = resultB.lastInsertRowId;

    await db.runAsync(
      'INSERT INTO exercises (workout_id, name, default_sets, default_reps, suggested_weight, sequence_order) VALUES (?, ?, ?, ?, ?, ?);',
      [workoutBId, 'Lat Pulldown', 3, 10, 30.0, 1]
    );
    await db.runAsync(
      'INSERT INTO exercises (workout_id, name, default_sets, default_reps, suggested_weight, sequence_order) VALUES (?, ?, ?, ?, ?, ?);',
      [workoutBId, 'Seated Cable Row', 3, 10, 25.0, 2]
    );

    const resultC = await db.runAsync(
      'INSERT INTO workouts (name, sequence_order) VALUES (?, ?);',
      ['Workout C (Legs Day)', 3]
    );
    const workoutCId = resultC.lastInsertRowId;

    await db.runAsync(
      'INSERT INTO exercises (workout_id, name, default_sets, default_reps, suggested_weight, sequence_order) VALUES (?, ?, ?, ?, ?, ?);',
      [workoutCId, 'Leg Press', 3, 10, 50.0, 1]
    );
    
    console.log('--- Database Seeding Completed Successfully ---');
  }
}

// Helper query function to log a session
export async function logWorkoutCompletion(name: string, totalSets: number): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const timestamp = new Date().toLocaleDateString();
  await db.runAsync(
    'INSERT INTO completed_workouts (workout_name, completed_at, total_sets) VALUES (?, ?, ?);',
    [name, timestamp, totalSets]
  );
}

// Helper query function to fetch historical logs
export async function fetchWorkoutLogs(): Promise<Array<{ id: number; workout_name: string; completed_at: string; total_sets: number }>> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  return await db.getAllAsync<any>('SELECT * FROM completed_workouts ORDER BY id DESC;');
}