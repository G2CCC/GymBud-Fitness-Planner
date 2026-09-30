import { useState, type FormEvent } from "react";
import type { WorkoutStatus } from "@fitness/shared";
import type { CalendarWorkout } from "../calendar/WorkoutCard";

export type EditorWorkout = CalendarWorkout;

export type WorkoutEditorSubmitPayload = {
  completedAt?: string;
};

export type WorkoutEditorProps = {
  workout: EditorWorkout;
  mode?: "complete" | "backfill";
  saving?: boolean;
  onSubmit: (payload: WorkoutEditorSubmitPayload) => void;
};

function toLocalDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function WorkoutEditor({
  workout,
  mode = "complete",
  saving = false,
  onSubmit,
}: WorkoutEditorProps) {
  const [completedAt, setCompletedAt] = useState("");
  const [error, setError] = useState<string | null>(null);

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

      onSubmit({ completedAt: parsed.toISOString() });
      return;
    }

    onSubmit({});
  }

  return (
    <form
      aria-label={`${workout.activityType.toLowerCase()} workout completion`}
      className="grid gap-3 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5"
      onSubmit={handleSubmit}
    >
      {mode === "backfill" ? (
        <label className="grid min-w-0 gap-2 text-sm font-medium text-gymbud-ink">
          Completion date and time
          <input
            className="focus-ring min-h-11 w-full rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 text-gymbud-ink"
            type="datetime-local"
            value={completedAt}
            max={toLocalDateTime(new Date())}
            onChange={(event) => setCompletedAt(event.target.value)}
            aria-label="Completion date and time"
          />
        </label>
      ) : (
        <p className="text-sm text-gymbud-muted">
          Save the results you entered above to your workout history.
        </p>
      )}

      {error ? (
        <p
          role="alert"
          className="text-sm font-medium text-gymbud-danger sm:col-span-2"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="button-primary focus-ring w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {saving
          ? "Saving…"
          : mode === "backfill"
            ? "Save completion"
            : "Save workout"}
      </button>
    </form>
  );
}

export type { WorkoutStatus };
