import type {
  ActivityType,
  WeightUnit,
  WorkoutStatus,
} from "../enums";

export type CycleTrainingSetInput = {
  actualReps: number;
  actualWeight: number;
  weightUnit: WeightUnit;
};

export type CycleTrainingWorkoutInput = {
  id: string;
  activityType: ActivityType;
  status: WorkoutStatus;
  actualDetails?: {
    actualDurationMinutes?: number | null;
    distanceKm?: number | null;
  } | null;
  actualExercises?: Array<{
    sets: CycleTrainingSetInput[];
  }>;
};

export type CycleTrainingVolumeInput = {
  cycleId: string;
  startDate: Date;
  endDate: Date;
  workouts: CycleTrainingWorkoutInput[];
};

export type WeightedVolume = Record<WeightUnit, number>;

export type CycleTrainingVolume = {
  cycleId: string;
  startDate: string;
  endDate: string;
  completedWorkoutCount: number;
  strength: {
    completedWorkoutCount: number;
    completedSetCount: number;
    actualRepCount: number;
    unweightedRepCount: number;
    weightedVolume: WeightedVolume;
  };
  cardio: {
    completedWorkoutCount: number;
    actualDurationMinutes: number;
    actualDistanceKm: number;
  };
  sport: {
    completedWorkoutCount: number;
    actualDurationMinutes: number;
  };
};

export type CycleTrainingVolumeComparison = {
  completedWorkoutCountDelta: number;
  strength: {
    completedSetCountDelta: number;
    actualRepCountDelta: number;
    unweightedRepCountDelta: number;
    weightedVolumeDelta: WeightedVolume;
  };
  cardio: {
    actualDurationMinutesDelta: number;
    actualDistanceKmDelta: number;
  };
  sport: {
    actualDurationMinutesDelta: number;
  };
};

export type CycleTrainingVolumeAggregate = Omit<
  CycleTrainingVolume,
  "cycleId" | "startDate" | "endDate"
>;

export type CycleBatchTrainingVolume = {
  startCycleNumber: number;
  endCycleNumber: number;
  cycles: Array<{
    cycleNumber: number;
    trainingVolume: CycleTrainingVolume;
  }>;
  aggregate: CycleTrainingVolumeAggregate;
};

export function buildCycleTrainingVolume(
  input: CycleTrainingVolumeInput,
): CycleTrainingVolume {
  const completedWorkouts = input.workouts.filter(
    (workout) => workout.status === "COMPLETED",
  );
  const completedStrengthWorkouts = completedWorkouts.filter(
    (workout) => workout.activityType === "STRENGTH",
  );
  const completedCardioWorkouts = completedWorkouts.filter(
    (workout) => workout.activityType === "CARDIO",
  );
  const completedSportWorkouts = completedWorkouts.filter(
    (workout) => workout.activityType === "SPORT",
  );

  const strengthSets = completedStrengthWorkouts.flatMap((workout) =>
    (workout.actualExercises ?? []).flatMap((exercise) => exercise.sets),
  );
  const weightedVolume: WeightedVolume = { KG: 0, LB: 0 };

  for (const set of strengthSets) {
    weightedVolume[set.weightUnit] += set.actualWeight * set.actualReps;
  }

  return {
    cycleId: input.cycleId,
    startDate: input.startDate.toISOString(),
    endDate: input.endDate.toISOString(),
    completedWorkoutCount: completedWorkouts.length,
    strength: {
      completedWorkoutCount: completedStrengthWorkouts.length,
      completedSetCount: strengthSets.length,
      actualRepCount: strengthSets.reduce(
        (sum, set) => sum + set.actualReps,
        0,
      ),
      unweightedRepCount: strengthSets.reduce(
        (sum, set) =>
          sum + (set.actualWeight === 0 ? set.actualReps : 0),
        0,
      ),
      weightedVolume,
    },
    cardio: {
      completedWorkoutCount: completedCardioWorkouts.length,
      actualDurationMinutes: completedCardioWorkouts.reduce(
        (sum, workout) =>
          sum + (workout.actualDetails?.actualDurationMinutes ?? 0),
        0,
      ),
      actualDistanceKm: completedCardioWorkouts.reduce(
        (sum, workout) => sum + (workout.actualDetails?.distanceKm ?? 0),
        0,
      ),
    },
    sport: {
      completedWorkoutCount: completedSportWorkouts.length,
      actualDurationMinutes: completedSportWorkouts.reduce(
        (sum, workout) =>
          sum + (workout.actualDetails?.actualDurationMinutes ?? 0),
        0,
      ),
    },
  };
}

export function compareCycleTrainingVolume(
  current: CycleTrainingVolume,
  previous: CycleTrainingVolume,
): CycleTrainingVolumeComparison {
  return {
    completedWorkoutCountDelta:
      current.completedWorkoutCount - previous.completedWorkoutCount,
    strength: {
      completedSetCountDelta:
        current.strength.completedSetCount - previous.strength.completedSetCount,
      actualRepCountDelta:
        current.strength.actualRepCount - previous.strength.actualRepCount,
      unweightedRepCountDelta:
        current.strength.unweightedRepCount - previous.strength.unweightedRepCount,
      weightedVolumeDelta: {
        KG:
          current.strength.weightedVolume.KG -
          previous.strength.weightedVolume.KG,
        LB:
          current.strength.weightedVolume.LB -
          previous.strength.weightedVolume.LB,
      },
    },
    cardio: {
      actualDurationMinutesDelta:
        current.cardio.actualDurationMinutes - previous.cardio.actualDurationMinutes,
      actualDistanceKmDelta:
        current.cardio.actualDistanceKm - previous.cardio.actualDistanceKm,
    },
    sport: {
      actualDurationMinutesDelta:
        current.sport.actualDurationMinutes -
        previous.sport.actualDurationMinutes,
    },
  };
}

export function aggregateCycleTrainingVolumes(input: {
  startCycleNumber: number;
  endCycleNumber: number;
  cycles: Array<{
    cycleNumber: number;
    trainingVolume: CycleTrainingVolume;
  }>;
}): CycleBatchTrainingVolume {
  const expectedNumbers = Array.from(
    { length: input.endCycleNumber - input.startCycleNumber + 1 },
    (_, index) => input.startCycleNumber + index,
  );
  const actualNumbers = input.cycles.map((cycle) => cycle.cycleNumber);

  if (
    expectedNumbers.length !== 4 ||
    actualNumbers.length !== 4 ||
    expectedNumbers.some((cycleNumber) => !actualNumbers.includes(cycleNumber))
  ) {
    throw new RangeError("A batch review requires exactly four consecutive cycles");
  }

  return {
    startCycleNumber: input.startCycleNumber,
    endCycleNumber: input.endCycleNumber,
    cycles: input.cycles,
    aggregate: input.cycles.reduce(
      (total, cycle) => addVolume(total, cycle.trainingVolume),
      emptyVolumeAggregate(),
    ),
  };
}

function emptyVolumeAggregate(): CycleTrainingVolumeAggregate {
  return {
    completedWorkoutCount: 0,
    strength: {
      completedWorkoutCount: 0,
      completedSetCount: 0,
      actualRepCount: 0,
      unweightedRepCount: 0,
      weightedVolume: { KG: 0, LB: 0 },
    },
    cardio: {
      completedWorkoutCount: 0,
      actualDurationMinutes: 0,
      actualDistanceKm: 0,
    },
    sport: {
      completedWorkoutCount: 0,
      actualDurationMinutes: 0,
    },
  };
}

function addVolume(
  total: CycleTrainingVolumeAggregate,
  volume: CycleTrainingVolume,
): CycleTrainingVolumeAggregate {
  return {
    completedWorkoutCount:
      total.completedWorkoutCount + volume.completedWorkoutCount,
    strength: {
      completedWorkoutCount:
        total.strength.completedWorkoutCount +
        volume.strength.completedWorkoutCount,
      completedSetCount:
        total.strength.completedSetCount + volume.strength.completedSetCount,
      actualRepCount:
        total.strength.actualRepCount + volume.strength.actualRepCount,
      unweightedRepCount:
        total.strength.unweightedRepCount + volume.strength.unweightedRepCount,
      weightedVolume: {
        KG:
          total.strength.weightedVolume.KG +
          volume.strength.weightedVolume.KG,
        LB:
          total.strength.weightedVolume.LB +
          volume.strength.weightedVolume.LB,
      },
    },
    cardio: {
      completedWorkoutCount:
        total.cardio.completedWorkoutCount +
        volume.cardio.completedWorkoutCount,
      actualDurationMinutes:
        total.cardio.actualDurationMinutes +
        volume.cardio.actualDurationMinutes,
      actualDistanceKm:
        total.cardio.actualDistanceKm + volume.cardio.actualDistanceKm,
    },
    sport: {
      completedWorkoutCount:
        total.sport.completedWorkoutCount +
        volume.sport.completedWorkoutCount,
      actualDurationMinutes:
        total.sport.actualDurationMinutes +
        volume.sport.actualDurationMinutes,
    },
  };
}
