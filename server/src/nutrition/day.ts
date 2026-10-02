import { Prisma, type PrismaClient } from "@prisma/client";
import {
  summarizeNutritionDay,
  type DayEnergy,
  type NutritionDayDto,
} from "@fitness/shared";
import { nutritionDateContext } from "./context";
import { getTargetForDate } from "./targets";
import { foodEntryDto } from "./serializers";

// Also used by cycle reports inside their single consistent snapshot transaction.
export async function readNutritionDay(
  tx: Prisma.TransactionClient,
  userId: string,
  date: string,
  fallbackTimezone: string,
): Promise<NutritionDayDto> {
  const [day, logs, target] = await Promise.all([
    tx.nutritionDay.findUnique({
      where: { userId_localDate: { userId, localDate: date } },
      include: {
        entries: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    }),
    tx.workoutLog.findMany({
      where: {
        completedLocalDate: date,
        workout: { userId, status: "COMPLETED" },
      },
      select: {
        workoutId: true,
        estimatedCaloriesKcal: true,
        energyCoverage: true,
      },
      orderBy: { workoutId: "asc" },
    }),
    getTargetForDate(tx, userId, date),
  ]);
  const workouts = logs.map((log) => ({
    workoutId: log.workoutId,
    estimatedKcal: log.estimatedCaloriesKcal,
    coverage: log.energyCoverage ?? "UNAVAILABLE",
  }));
  const exercise: DayEnergy = {
    workouts,
    estimatedKcal: workouts.reduce((sum, w) => sum + (w.estimatedKcal ?? 0), 0),
    coverage: workouts.every((w) => w.coverage === "COMPLETE")
      ? "COMPLETE"
      : workouts.every((w) => w.coverage === "UNAVAILABLE")
        ? "UNAVAILABLE"
        : "PARTIAL",
  };
  const entries = (day?.entries ?? []).map(foodEntryDto);
  return {
    date,
    timezone: day?.timezone ?? fallbackTimezone,
    revision: day?.revision ?? 0,
    completedAt: day?.completedAt?.toISOString() ?? null,
    target,
    entries,
    exercise,
    ...summarizeNutritionDay({ entries, target, exercise }),
    recorded: entries.length > 0 || Boolean(day?.completedAt),
  };
}
export class NutritionDays {
  constructor(
    private readonly db: PrismaClient,
    private readonly now = () => new Date(),
  ) {}
  async getDay(userId: string, date: string): Promise<NutritionDayDto> {
    return this.db.$transaction(
      async (tx) => {
        const context = await nutritionDateContext(
          tx,
          userId,
          date,
          this.now(),
        );
        return readNutritionDay(tx, userId, date, context.timezone);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
