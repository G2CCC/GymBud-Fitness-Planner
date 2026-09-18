import type { ApiWorkout } from "../../api/contracts";

export type ProgressSummary = {
  totalSessions: number;
  completedSessions: number;
  plannedSessions: number;
  cancelledSessions: number;
  completionRate: number;
  rescheduleCount: number;
  activityTotals: {
    strength: {
      completedWorkouts: number;
      completedSets: number;
      actualReps: number;
      weightedVolume: { KG: number; LB: number };
    };
    cardio: {
      completedWorkouts: number;
      actualDurationMinutes: number;
      actualDistanceKm: number;
    };
    sport: {
      completedWorkouts: number;
      actualDurationMinutes: number;
    };
  };
};

export function buildProgressSummary(
  workouts: readonly ApiWorkout[],
): ProgressSummary {
  const completedWorkouts = workouts.filter(
    (workout) => workout.status === "COMPLETED",
  );
  const summary: ProgressSummary = {
    totalSessions: workouts.length,
    completedSessions: completedWorkouts.length,
    plannedSessions: workouts.filter((workout) => workout.status === "PLANNED")
      .length,
    cancelledSessions: workouts.filter(
      (workout) => workout.status === "CANCELLED",
    ).length,
    completionRate:
      workouts.length === 0 ? 0 : completedWorkouts.length / workouts.length,
    rescheduleCount: workouts.reduce(
      (total, workout) => total + workout.rescheduleCount,
      0,
    ),
    activityTotals: {
      strength: {
        completedWorkouts: 0,
        completedSets: 0,
        actualReps: 0,
        weightedVolume: { KG: 0, LB: 0 },
      },
      cardio: {
        completedWorkouts: 0,
        actualDurationMinutes: 0,
        actualDistanceKm: 0,
      },
      sport: { completedWorkouts: 0, actualDurationMinutes: 0 },
    },
  };

  for (const workout of completedWorkouts) {
    if (workout.activityType === "STRENGTH") {
      summary.activityTotals.strength.completedWorkouts += 1;
      for (const exercise of workout.actualExercises ?? []) {
        for (const set of exercise.sets) {
          summary.activityTotals.strength.completedSets += 1;
          summary.activityTotals.strength.actualReps += set.actualReps;
          summary.activityTotals.strength.weightedVolume[set.weightUnit] +=
            set.actualWeight * set.actualReps;
        }
      }
    }

    if (workout.activityType === "CARDIO") {
      summary.activityTotals.cardio.completedWorkouts += 1;
      summary.activityTotals.cardio.actualDurationMinutes +=
        workout.actualDetails?.actualDurationMinutes ?? 0;
      summary.activityTotals.cardio.actualDistanceKm +=
        workout.actualDetails?.distanceKm ?? 0;
    }

    if (workout.activityType === "SPORT") {
      summary.activityTotals.sport.completedWorkouts += 1;
      summary.activityTotals.sport.actualDurationMinutes +=
        workout.actualDetails?.actualDurationMinutes ?? 0;
    }
  }

  return summary;
}
