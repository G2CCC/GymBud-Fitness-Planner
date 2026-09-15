import type {
  StrengthWorkoutLogInput,
  WeightUnit,
} from "@fitness/shared";
import type { ApiPlannedExercise } from "../../api/contracts";

export type StrengthLogFormProps = {
  value: StrengthWorkoutLogInput;
  plannedExercises?: ApiPlannedExercise[];
  exerciseNames?: Record<string, string>;
  onChange: (value: StrengthWorkoutLogInput) => void;
  onSubmit?: () => void;
};

export function StrengthLogForm({
  value,
  plannedExercises = [],
  exerciseNames = {},
  onChange,
  onSubmit,
}: StrengthLogFormProps) {
  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<StrengthWorkoutLogInput["exercises"][number]["sets"][number]>,
  ) {
    onChange({
      exercises: value.exercises.map((exercise, currentExerciseIndex) =>
        currentExerciseIndex !== exerciseIndex
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((set, currentSetIndex) =>
                currentSetIndex === setIndex ? { ...set, ...patch } : set,
              ),
            },
      ),
    });
  }

  return (
    <form className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      {value.exercises.map((exercise, exerciseIndex) => (
        <fieldset
          className="grid gap-4 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-sm"
          key={`${exercise.exerciseId}-${exercise.sortOrder}`}
        >
          <legend className="px-1 text-lg font-semibold text-gymbud-ink">
            {exerciseNames[exercise.exerciseId] ?? exercise.exerciseId}
          </legend>
          {exercise.sets.map((set, setIndex) => {
            const plannedExercise = plannedExercises.find(
              (planned) =>
                planned.exerciseId === exercise.exerciseId &&
                planned.sortOrder === exercise.sortOrder,
            );
            const plannedSet = plannedExercise?.plannedSets.find(
              (planned) => planned.setNumber === set.setNumber,
            );
            const exerciseName =
              exerciseNames[exercise.exerciseId] ?? exercise.exerciseId;
            const plannedTarget = plannedSet
              ? `Target: ${plannedSet.targetReps} reps${
                  plannedSet.plannedWeight === null
                    ? ""
                    : ` · ${plannedSet.plannedWeight} ${
                        plannedSet.weightUnit === "LB" ? "lb" : "kg"
                      }`
                }`
              : "Target: not specified";

            return (
              <div
                className="grid gap-3 rounded-[var(--radius-control)] border border-gymbud-border p-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
                key={set.setNumber}
              >
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gymbud-muted">
                    Set {set.setNumber}
                  </span>
                  <span className="text-xs text-gymbud-muted">
                    {plannedTarget}
                  </span>
                </div>
                <label>
                  <span className="block text-xs font-semibold text-gymbud-ink">
                    Actual reps
                  </span>
                  <input
                    aria-label={`Actual reps for ${exerciseName} set ${set.setNumber}`}
                    className="focus-ring mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
                    type="number"
                    min={0}
                    value={set.reps}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, {
                        reps: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  <span className="block text-xs font-semibold text-gymbud-ink">
                    Actual weight
                  </span>
                  <input
                    aria-label={`Actual weight for ${exerciseName} set ${set.setNumber}`}
                    className="focus-ring mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
                    type="number"
                    min={0}
                    step="any"
                    value={set.weight ?? ""}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, {
                        weight:
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  <span className="block text-xs font-semibold text-gymbud-ink">
                    Unit
                  </span>
                  <select
                    aria-label={`Actual weight unit for ${exerciseName} set ${set.setNumber}`}
                    className="focus-ring mt-1 min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
                    value={set.weightUnit ?? "KG"}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, {
                        weightUnit: event.target.value as WeightUnit,
                      })
                    }
                  >
                    <option value="KG">kg</option>
                    <option value="LB">lb</option>
                  </select>
                </label>
              </div>
            );
          })}
        </fieldset>
      ))}
      {onSubmit ? (
        <button
          className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 font-semibold text-white"
          type="submit"
        >
          Save strength log
        </button>
      ) : null}
    </form>
  );
}
