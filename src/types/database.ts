export interface Workout {
  id: number;
  name: string;
  sequence_order: number;
}

export interface Exercise {
  id: number;
  workout_id: number;
  name: string;
  default_sets: number;
  default_reps: number;
  suggested_weight: number;
  sequence_order: number;
}