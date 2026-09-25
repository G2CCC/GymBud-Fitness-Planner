import { Prisma, PrismaClient } from "@prisma/client";
import type {
  CalendarDateRangeBounds,
  CalendarWorkoutSummary,
} from "@fitness/shared";
import { serializeActivityOption } from "../catalog/service";

const calendarWorkoutSelect = {
  id: true,
  cycleId: true,
  activityType: true,
  scheduledDate: true,
  durationMinutes: true,
  status: true,
  completedAt: true,
  rescheduleCount: true,
  activityOption: {
    select: {
      id: true,
      activityType: true,
      slug: true,
      name: true,
      iconKey: true,
      aiEligible: true,
      sortOrder: true,
      description: true,
    },
  },
} satisfies Prisma.ScheduledWorkoutSelect;

type CalendarWorkoutRecord = Prisma.ScheduledWorkoutGetPayload<{
  select: typeof calendarWorkoutSelect;
}>;

export class CalendarService {
  constructor(private readonly prisma: PrismaClient) {}

  async listWorkouts(
    userId: string,
    bounds: CalendarDateRangeBounds,
  ): Promise<CalendarWorkoutSummary[]> {
    const workouts: CalendarWorkoutRecord[] =
      await this.prisma.scheduledWorkout.findMany({
        where: {
          userId,
          scheduledDate: {
            gte: bounds.from,
            lt: bounds.toExclusive,
          },
        },
        orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
        select: calendarWorkoutSelect,
      });

    return workouts.map((workout) => ({
      ...workout,
      activityOption: serializeActivityOption(workout.activityOption),
    }));
  }
}
