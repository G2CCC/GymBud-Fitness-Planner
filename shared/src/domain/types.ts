import type {
  ActivityType,
  Gender,
  Location,
  WeightUnit,
  WorkoutStatus,
} from "./enums";

export type ProfileInput = {
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
  defaultLocation: Location;
  primaryGoal: string;
  secondaryOutcome?: string | null;
  gender?: Gender | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
};

export type ScheduledWorkoutInput = {
  activityType: ActivityType;
  scheduledDate: Date;
  location: Location;
  durationMinutes: number;
  status?: WorkoutStatus;
};

export type SetLogInput = {
  weight?: number;
  reps: number;
  weightUnit?: WeightUnit;
};
