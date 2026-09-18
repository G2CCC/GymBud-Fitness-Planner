import type {
  ActivityType,
  Gender,
  WeightUnit,
  WorkoutStatus,
} from "./enums";

export type ProfileInput = {
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
  primaryGoal: string;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
};

export type ScheduledWorkoutInput = {
  activityType: ActivityType;
  scheduledDate: Date;
  durationMinutes: number;
  status?: WorkoutStatus;
};

export type SetLogInput = {
  weight: number;
  reps: number;
  weightUnit: WeightUnit;
};
