import { describe, expect, it, vi } from "vitest";
import { WorkoutService } from "../../src/workouts/service";

describe("get workout details", () => {
  it("loads the saved workout log with exercise sets", async () => {
    const savedLog = {
      actualDetails: null,
      exerciseLogs: [
        {
          exerciseId: "bench",
          sortOrder: 1,
          setLogs: [
            {
              setNumber: 1,
              actualReps: 7,
              actualWeight: 60,
              weightUnit: "KG",
            },
          ],
        },
      ],
    };
    const findFirst = vi.fn().mockResolvedValue({
      id: "workout-1",
      userId: "user-1",
      workoutLog: savedLog,
    });
    const findUnique = vi.fn().mockResolvedValue(savedLog);
    const prisma = {
      scheduledWorkout: { findFirst },
      workoutLog: { findUnique },
    } as unknown as ConstructorParameters<typeof WorkoutService>[0];
    const service = new WorkoutService(prisma);

    const workout = await service.getWorkout("user-1", "workout-1");

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          workoutLog: expect.objectContaining({
            select: expect.objectContaining({
              actualDetails: true,
              exerciseLogs: expect.any(Object),
            }),
          }),
        }),
      }),
    );
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workoutId: "workout-1" } }),
    );
    expect(workout).toMatchObject({ workoutLog: savedLog });
  });
});
