import type { ActivityType, WorkoutStatus } from "../enums";

export type CalendarWorkoutSummary = {
  id: string;
  cycleId: string;
  activityType: ActivityType;
  scheduledDate: Date;
  durationMinutes: number;
  status: WorkoutStatus;
  completedAt: Date | null;
  rescheduleCount: number;
};
