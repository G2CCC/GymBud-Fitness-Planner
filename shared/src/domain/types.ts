import type {
  ActivityType,
  Sex,
  BodyGoal,
  WeightUnit,
  WorkoutStatus,
} from "./enums";

export type ProfileInput = {
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
  primaryGoal: BodyGoal;
  recordingTimezone?: string;
  sex: Sex;
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
