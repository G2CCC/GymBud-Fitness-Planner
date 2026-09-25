import type { ActivityType, WorkoutStatus } from "../enums";
import type { ActivityOptionRecord } from "../catalog/types";

export type CalendarWorkoutSummary = {
  id: string;
  cycleId: string;
  activityType: ActivityType;
  scheduledDate: Date;
  durationMinutes: number;
  status: WorkoutStatus;
  completedAt: Date | null;
  rescheduleCount: number;
  activityOption: ActivityOptionRecord | null;
};
