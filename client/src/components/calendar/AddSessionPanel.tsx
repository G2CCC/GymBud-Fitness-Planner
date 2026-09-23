import { useEffect, useState, type FormEvent } from "react";
import type { ActivityType } from "@fitness/shared";
import { createWorkout, listExercises } from "../../api/client";
import type { ApiExercise } from "../../api/contracts";
import {
  StrengthPlanBuilder,
  type ManualPlannedExercise,
} from "../workouts/StrengthPlanBuilder";

export type AddSessionPanelProps = {
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  onMessage: (message: string) => void;
};

function systemDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return values.year + "-" + values.month + "-" + values.day;
}

export function AddSessionPanel({
  onClose,
  onCreated,
  onMessage,
}: AddSessionPanelProps) {
  const [addActivity, setAddActivity] = useState<ActivityType>("STRENGTH");
  const [addDate, setAddDate] = useState(systemDateKey());
  const [addDuration, setAddDuration] = useState(60);
  const [addExercises, setAddExercises] = useState<ApiExercise[]>([]);
  const [addPlannedExercises, setAddPlannedExercises] = useState<ManualPlannedExercise[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (addActivity !== "STRENGTH") {
      setAddExercises([]);
      setAddPlannedExercises([]);
      return;
    }

    let active = true;
    void listExercises()
      .then((exercises) => {
        if (active) setAddExercises(exercises);
      })
      .catch((loadError) => {
        if (active) {
          onMessage(
            loadError instanceof Error
              ? loadError.message
              : "The exercise list could not be loaded.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [addActivity, onMessage]);

  async function handleAddWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      addActivity === "STRENGTH" &&
      (addPlannedExercises.length === 0 ||
        addPlannedExercises.some((exercise) => !exercise.exerciseId))
    ) {
      onMessage("Add a valid exercise plan before creating a strength workout.");
      return;
    }

    setAdding(true);
    try {
      await createWorkout({
        activityType: addActivity,
        scheduledDate: new Date(addDate + "T12:00:00").toISOString(),
        durationMinutes: addDuration,
        ...(addActivity === "STRENGTH"
          ? { plannedExercises: addPlannedExercises }
          : {}),
      });
      await onCreated();
      setAddPlannedExercises([]);
      onMessage("Workout added without changing other sessions.");
    } catch (addError) {
      onMessage(
        addError instanceof Error
          ? addError.message
          : "The workout could not be added.",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <section
      data-testid="add-session-panel"
      className="cycle-gradient grid w-full max-w-2xl justify-self-start gap-4 rounded-[var(--radius-card)] border border-gymbud-border p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gymbud-ink">Add a session</h2>
          <p className="mt-1 text-sm text-gymbud-muted">
            Add a plan without changing any other workout.
          </p>
        </div>
        <button
          className="focus-ring min-h-11 min-w-11 rounded-full border border-gymbud-border text-xl text-gymbud-muted"
          type="button"
          aria-label="Close add session panel"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={(event) => void handleAddWorkout(event)}>
        <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
          Activity
          <select
            className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            value={addActivity}
            onChange={(event) => {
              const activity = event.target.value as ActivityType;
              setAddActivity(activity);
              if (activity !== "STRENGTH") setAddPlannedExercises([]);
            }}
          >
            <option value="STRENGTH">Strength</option>
            <option value="CARDIO">Cardio</option>
            <option value="SPORT">Sport</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
          Date
          <input
            className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            type="date"
            value={addDate}
            onChange={(event) => setAddDate(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
          Minutes
          <input
            className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            type="number"
            min={1}
            max={600}
            value={addDuration}
            onChange={(event) => setAddDuration(Number(event.target.value))}
          />
        </label>
        {addActivity === "STRENGTH" ? (
          <div className="sm:col-span-3">
            <StrengthPlanBuilder
              exercises={addExercises}
              value={addPlannedExercises}
              onChange={setAddPlannedExercises}
            />
          </div>
        ) : null}
        <button
          className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-ink px-4 text-sm font-semibold text-white sm:col-span-3"
          disabled={adding}
          type="submit"
        >
          {adding ? "Adding…" : "Add workout"}
        </button>
      </form>
    </section>
  );
}
