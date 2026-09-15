import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  isExerciseAvailableAtLocation,
  type ActivityType,
  type Location,
  type WorkoutStatus,
} from "@fitness/shared";
import { LocationSelector } from "./LocationSelector";
import type { CalendarWorkout } from "../calendar/WorkoutCard";

export type EditorWorkout = CalendarWorkout;

export type EditorExerciseOption = {
  id: string;
  name: string;
  equipment: string | null;
  availableLocations: Location[];
};

export type WorkoutEditorSubmitPayload = {
  location: Location;
  completedAt?: string;
};

export type WorkoutEditorProps = {
  workout: EditorWorkout;
  location: Location;
  legalExerciseOptions: EditorExerciseOption[];
  mode?: "complete" | "backfill";
  onLocationChange: (location: Location) => void;
  onSubmit: (payload: WorkoutEditorSubmitPayload) => void;
};

function formatActivity(activityType: ActivityType): string {
  return activityType === "STRENGTH"
    ? "Strength"
    : activityType === "CARDIO"
      ? "Cardio"
      : "Sport";
}

function toLocalDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function WorkoutEditor({
  workout,
  location,
  legalExerciseOptions,
  mode = "complete",
  onLocationChange,
  onSubmit,
}: WorkoutEditorProps) {
  const [selectedLocation, setSelectedLocation] = useState(location);
  const [completedAt, setCompletedAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedLocation(location);
  }, [location]);

  const availableExercises = useMemo(
    () =>
      legalExerciseOptions.filter((exercise) =>
        isExerciseAvailableAtLocation(exercise, selectedLocation),
      ),
    [legalExerciseOptions, selectedLocation],
  );

  function handleLocationChange(nextLocation: Location) {
    setSelectedLocation(nextLocation);
    onLocationChange(nextLocation);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === "backfill") {
      if (!completedAt) {
        setError("Completion date and time are required.");
        return;
      }

      const parsed = new Date(completedAt);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
        setError("Completion date and time cannot be in the future.");
        return;
      }

      onSubmit({
        location: selectedLocation,
        completedAt: parsed.toISOString(),
      });
      return;
    }

    onSubmit({ location: selectedLocation });
  }

  return (
    <form
      className="grid gap-5 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
          {formatActivity(workout.activityType)} workout
        </p>
        <h2 className="mt-1 text-xl font-semibold text-gymbud-ink">
          Log your actual session
        </h2>
      </div>

      <LocationSelector
        value={selectedLocation}
        onChange={handleLocationChange}
      />

      {workout.activityType === "STRENGTH" ? (
        <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
          Exercise options
          <select
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 text-gymbud-ink"
            aria-label="Exercise options"
            defaultValue=""
          >
            <option value="">Select an exercise</option>
            {availableExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {mode === "backfill" ? (
        <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
          Completion date and time
          <input
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 text-gymbud-ink"
            type="datetime-local"
            value={completedAt}
            max={toLocalDateTime(new Date())}
            onChange={(event) => setCompletedAt(event.target.value)}
            aria-label="Completion date and time"
          />
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-gymbud-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 font-semibold text-white"
      >
        {mode === "backfill" ? "Save completion" : "Save workout"}
      </button>
    </form>
  );
}

export type { ActivityType, Location, WorkoutStatus };
