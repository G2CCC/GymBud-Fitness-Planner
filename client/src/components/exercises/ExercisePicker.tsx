import {
  isExerciseAvailableAtLocation,
  type Location,
} from "@fitness/shared";

export type ExercisePickerOption = {
  id: string;
  name: string;
  equipment: string | null;
  availableLocations: Location[];
};

export type ExercisePickerProps = {
  exercises: ExercisePickerOption[];
  location: Location;
  value?: string;
  selectedExercise?: ExercisePickerOption | null;
  label?: string;
  onChange: (exerciseId: string) => void;
};

export function ExercisePicker({
  exercises,
  location,
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
  const availableExercises = allExercises.filter((exercise) =>
    isExerciseAvailableAtLocation(exercise, location),
  );
  const selectedExercise = allExercises.find((exercise) => exercise.id === value);
  const selectedExerciseIsIncompatible = Boolean(
    selectedExercise &&
      !isExerciseAvailableAtLocation(selectedExercise, location),
  );

  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select an exercise</option>
        {selectedExerciseIsIncompatible && selectedExercise ? (
          <option value={selectedExercise.id}>
            {selectedExercise.name} (not available at {location})
          </option>
        ) : null}
        {availableExercises.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
            {exercise.equipment && exercise.equipment !== "NONE"
              ? ` · ${exercise.equipment}`
              : ""}
          </option>
        ))}
      </select>
      {selectedExerciseIsIncompatible ? (
        <span role="alert">
          This exercise is not available at {location}. Choose a replacement;
          the existing selection will not be changed automatically.
        </span>
      ) : null}
    </label>
  );
}
