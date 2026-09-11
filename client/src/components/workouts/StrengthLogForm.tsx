import type {
  StrengthWorkoutLogInput,
  WeightUnit,
} from "@fitness/shared";

export type StrengthLogFormProps = {
  value: StrengthWorkoutLogInput;
  onChange: (value: StrengthWorkoutLogInput) => void;
  onSubmit?: () => void;
};

export function StrengthLogForm({
  value,
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
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      {value.exercises.map((exercise, exerciseIndex) => (
        <fieldset key={`${exercise.exerciseId}-${exercise.sortOrder}`}>
          <legend>{exercise.exerciseId}</legend>
          {exercise.sets.map((set, setIndex) => (
            <div key={set.setNumber}>
              <span>Set {set.setNumber}</span>
              <label>
                Reps
                <input
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
                Weight
                <input
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
                Unit
                <select
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
          ))}
        </fieldset>
      ))}
      {onSubmit ? <button type="submit">Save strength log</button> : null}
    </form>
  );
}
