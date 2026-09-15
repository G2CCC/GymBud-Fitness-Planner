import type {
  Location,
  PlannedExerciseInput,
  PlannedSetInput,
  WeightUnit,
} from "@fitness/shared";
import { ExercisePicker, type ExercisePickerOption } from "../exercises/ExercisePicker";

export type ManualPlannedExercise = PlannedExerciseInput;

type StrengthPlanBuilderProps = {
  location: Location;
  exercises: ExercisePickerOption[];
  value: ManualPlannedExercise[];
  onChange: (value: ManualPlannedExercise[]) => void;
};

const inputClassName =
  "min-h-10 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 text-sm";

function createSet(setNumber: number): PlannedSetInput {
  return { setNumber, targetReps: 8 };
}

export function StrengthPlanBuilder({
  location,
  exercises,
  value,
  onChange,
}: StrengthPlanBuilderProps) {
  function updateExercise(
    exerciseIndex: number,
    update: Partial<ManualPlannedExercise>,
  ) {
    onChange(
      value.map((exercise, index) =>
        index === exerciseIndex ? { ...exercise, ...update } : exercise,
      ),
    );
  }

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    update: Partial<PlannedSetInput>,
  ) {
    onChange(
      value.map((exercise, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, currentSetIndex) =>
                currentSetIndex === setIndex ? { ...set, ...update } : set,
              ),
            }
          : exercise,
      ),
    );
  }

  function addExercise() {
    onChange([
      ...value,
      {
        exerciseId: "",
        sortOrder: value.length + 1,
        sets: [createSet(1)],
      },
    ]);
  }

  function removeExercise(exerciseIndex: number) {
    onChange(
      value
        .filter((_, index) => index !== exerciseIndex)
        .map((exercise, index) => ({ ...exercise, sortOrder: index + 1 })),
    );
  }

  function addSet(exerciseIndex: number) {
    const exercise = value[exerciseIndex];
    if (!exercise) {
      return;
    }
    updateExercise(exerciseIndex, {
      sets: [...exercise.sets, createSet(exercise.sets.length + 1)],
    });
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    const exercise = value[exerciseIndex];
    if (!exercise || exercise.sets.length <= 1) {
      return;
    }
    updateExercise(exerciseIndex, {
      sets: exercise.sets
        .filter((_, index) => index !== setIndex)
        .map((set, index) => ({ ...set, setNumber: index + 1 })),
    });
  }

  return (
    <fieldset className="grid gap-4 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface/60 p-4">
      <legend className="px-1 text-sm font-semibold text-gymbud-ink">
        Strength plan · {location === "GYM" ? "Gym" : "Home"}
      </legend>

      {value.length === 0 ? (
        <p className="text-sm text-gymbud-muted">
          Add at least one exercise and its planned sets.
        </p>
      ) : null}

      {value.map((exercise, exerciseIndex) => (
        <article
          className="grid gap-3 rounded-[var(--radius-control)] border border-gymbud-border p-3"
          key={`${exercise.sortOrder}-${exercise.exerciseId || "new"}`}
        >
          <div className="flex items-end justify-between gap-3">
            <ExercisePicker
              exercises={exercises}
              location={location}
              value={exercise.exerciseId}
              label={`Exercise ${exerciseIndex + 1}`}
              onChange={(exerciseId) =>
                updateExercise(exerciseIndex, { exerciseId })
              }
            />
            <button
              className="focus-ring min-h-10 rounded-[var(--radius-control)] border border-gymbud-danger px-3 text-xs font-semibold text-gymbud-danger"
              type="button"
              onClick={() => removeExercise(exerciseIndex)}
            >
              Remove
            </button>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gymbud-muted">
              Planned sets
            </p>
            {exercise.sets.map((set, setIndex) => (
              <div
                className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
                key={set.setNumber}
              >
                <span className="pb-2 text-xs font-semibold text-gymbud-muted">
                  Set {set.setNumber}
                </span>
                <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
                  Reps
                  <input
                    className={inputClassName}
                    type="number"
                    min={1}
                    max={1000}
                    value={set.targetReps}
                    aria-label={`Exercise ${exerciseIndex + 1} Set ${setIndex + 1} reps`}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, {
                        targetReps: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
                  Target weight (optional)
                  <input
                    className={inputClassName}
                    type="number"
                    min={0}
                    step="0.1"
                    value={set.plannedWeight ?? ""}
                    aria-label={`Exercise ${exerciseIndex + 1} Set ${setIndex + 1} target weight`}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, {
                        plannedWeight:
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <div className="flex items-end gap-2">
                  <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
                    Unit
                    <select
                      className={inputClassName}
                      value={set.weightUnit ?? "KG"}
                      aria-label={`Exercise ${exerciseIndex + 1} Set ${setIndex + 1} weight unit`}
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
                  <button
                    className="focus-ring min-h-10 rounded-[var(--radius-control)] border border-gymbud-border px-2 text-xs text-gymbud-muted"
                    type="button"
                    disabled={exercise.sets.length <= 1}
                    onClick={() => removeSet(exerciseIndex, setIndex)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            className="focus-ring min-h-10 justify-self-start rounded-[var(--radius-control)] border border-gymbud-border px-3 text-xs font-semibold text-gymbud-ink"
            type="button"
            onClick={() => addSet(exerciseIndex)}
          >
            Add set to exercise {exerciseIndex + 1}
          </button>
        </article>
      ))}

      <button
        className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-ink px-4 text-sm font-semibold text-gymbud-ink"
        type="button"
        onClick={addExercise}
      >
        Add exercise
      </button>
    </fieldset>
  );
}
