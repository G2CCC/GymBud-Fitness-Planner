import { useMemo, useState } from "react";
import {
  strengthFocusAreas,
  type StrengthFocusArea,
} from "@fitness/shared";

export type ExercisePickerOption = {
  id: string;
  name: string;
  equipment: string | null;
  focusAreas: StrengthFocusArea[];
  imageUrl: string | null;
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
  const [focusArea, setFocusArea] = useState<StrengthFocusArea | "">("");
  const exerciseById = new Map(
    [...exercises, ...(selectedExerciseDetails ? [selectedExerciseDetails] : [])]
      .map((exercise) => [exercise.id, exercise] as const),
  );
  const allExercises = useMemo(() => {
    const values = [...exerciseById.values()];
    return values.filter(
      (exercise) =>
        !focusArea ||
        exercise.focusAreas?.includes(focusArea) ||
        exercise.id === value,
    );
  }, [exerciseById, focusArea, value]);
  const selectedExercise = exerciseById.get(value);

  return (
    <div className="grid min-w-0 gap-2">
      <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
        {label} focus area
        <select
          className="min-h-10 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 text-sm"
          aria-label={`${label} focus area`}
          value={focusArea}
          onChange={(event) =>
            setFocusArea(event.target.value as StrengthFocusArea | "")
          }
        >
          <option value="">All focus areas</option>
          {strengthFocusAreas.map((area) => (
            <option key={area} value={area}>
              {area[0] + area.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <div className="flex min-w-0 items-center gap-3">
        {selectedExercise?.imageUrl ? (
          <img
            className="h-12 w-12 rounded-[var(--radius-control)] object-cover"
            src={selectedExercise.imageUrl}
            alt={`${selectedExercise.name} thumbnail`}
            loading="lazy"
          />
        ) : (
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-gymbud-border/40 text-[0.65rem] text-gymbud-muted"
            role="img"
            aria-label={`${selectedExercise?.name ?? "Exercise"} image unavailable`}
          >
            No image
          </span>
        )}
        <label className="grid min-w-0 flex-1 gap-1 text-xs font-semibold text-gymbud-ink">
          {label}
          <select
            className="min-h-10 min-w-0 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 text-sm"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
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
      </div>
    </div>
  );
}
