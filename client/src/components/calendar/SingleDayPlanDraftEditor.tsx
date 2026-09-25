import { useEffect, useState } from "react";
import type { ApiPlanDraft } from "../../api/contracts";
import { ActivityIdentity } from "../catalog/ActivityIdentity";

export type SingleDayPlanDraftEditorProps = {
  plan: ApiPlanDraft;
  submitting?: boolean;
  onConfirm: (plan: ApiPlanDraft) => void | Promise<void>;
  onCancel: () => void;
};

export function SingleDayPlanDraftEditor({
  plan,
  submitting = false,
  onConfirm,
  onCancel,
}: SingleDayPlanDraftEditorProps) {
  const [value, setValue] = useState(plan);

  useEffect(() => {
    setValue(plan);
  }, [plan]);

  const workout = value.workouts[0];

  return (
    <form
      data-testid="single-day-plan-draft"
      className="grid gap-4 rounded-[var(--radius-control)] border border-gymbud-accent-strong/30 bg-gymbud-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onConfirm(value);
      }}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-accent-strong">
          AI draft ready
        </p>
        <h3 className="mt-1 text-lg font-semibold text-gymbud-ink">
          Review before adding to your calendar
        </h3>
        <p className="mt-1 text-sm text-gymbud-muted">
          Nothing is saved until you confirm this Strength session.
        </p>
      </div>

      {workout ? (
        <article className="grid gap-3 rounded-[var(--radius-control)] border border-gymbud-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <ActivityIdentity activityType="STRENGTH" size={18} />
              <p className="mt-1 text-xs text-gymbud-muted">
                {workout.scheduledDate.slice(0, 10)} · {workout.exercises.length} exercises
              </p>
            </div>
            <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
              Minutes
              <input
                className="min-h-10 w-24 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-2"
                type="number"
                min={1}
                max={600}
                value={workout.durationMinutes}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    workouts: current.workouts.map((item, index) =>
                      index === 0
                        ? { ...item, durationMinutes: Number(event.target.value) }
                        : item,
                    ),
                  }))
                }
              />
            </label>
          </div>
          <div className="grid gap-2">
            {workout.exercises.map((exercise) => (
              <div
                className="rounded-[var(--radius-control)] bg-gymbud-surface-muted p-3"
                key={`${exercise.exerciseId}-${exercise.sortOrder}`}
              >
                <p className="text-sm font-semibold text-gymbud-ink">{exercise.name}</p>
                <p className="mt-1 text-xs text-gymbud-muted">
                  {exercise.sets.length} sets · {exercise.equipment ?? "No equipment"}
                </p>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Adding to calendar…" : "Confirm and add to calendar"}
        </button>
        <button
          className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border px-4 text-sm font-semibold text-gymbud-ink"
          type="button"
          onClick={onCancel}
          disabled={submitting}
        >
          Discard draft
        </button>
      </div>
    </form>
  );
}
