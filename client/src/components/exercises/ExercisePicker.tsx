export type ExercisePickerOption = {
  id: string;
  name: string;
  equipment: string | null;
};

export type ExercisePickerProps = {
  exercises: ExercisePickerOption[];
  value?: string;
  selectedExercise?: ExercisePickerOption | null;
  label?: string;
  onChange: (exerciseId: string) => void;
};

export function ExercisePicker({
  exercises,
  value = "",
  selectedExercise: selectedExerciseDetails = null,
  label = "Exercise",
  onChange,
}: ExercisePickerProps) {
  const exerciseById = new Map(
    [...exercises, ...(selectedExerciseDetails ? [selectedExerciseDetails] : [])]
      .map((exercise) => [exercise.id, exercise] as const),
  );
  const allExercises = [...exerciseById.values()];

  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select an exercise</option>
        {allExercises.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
            {exercise.equipment && exercise.equipment !== "NONE"
              ? ` · ${exercise.equipment}`
              : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
