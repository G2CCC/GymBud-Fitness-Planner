import type {
  ActivityType,
  Location,
  WeightUnit,
  WorkoutSource,
  WorkoutStatus,
} from "./enums";

export type ProfileInput = {
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
  defaultLocation: Location;
  primaryGoal: string;
  secondaryOutcome?: string;
};

export type ScheduledWorkoutInput = {
  activityType: ActivityType;
  scheduledDate: Date;
  location: Location;
  durationMinutes: number;
  source: WorkoutSource;
  status?: WorkoutStatus;
};

export type SetLogInput = {
  weight?: number;
  reps: number;
  weightUnit?: WeightUnit;
};
