import { useEffect, useState } from "react";
import type { ApiPlanDraft } from "../../api/contracts";
import { ActivityIdentity } from "../catalog/ActivityIdentity";

export type InitialPlanDraftEditorProps = {
  plan: ApiPlanDraft;
  onConfirm: (plan: ApiPlanDraft) => void | Promise<void>;
  submitting?: boolean;
};

export function InitialPlanDraftEditor({
  plan,
  onConfirm,
  submitting = false,
}: InitialPlanDraftEditorProps) {
  const [value, setValue] = useState(plan);

  useEffect(() => {
    setValue(plan);
  }, [plan]);

  function updateWorkout(
    index: number,
    update: Partial<ApiPlanDraft["workouts"][number]>,
  ) {
    setValue((current) => ({
      ...current,
      workouts: current.workouts.map((workout, workoutIndex) =>
        workoutIndex === index ? { ...workout, ...update } : workout,
      ),
    }));
  }

  return (
    <form
      className="grid gap-5 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-[var(--shadow-card)] sm:p-7"
      onSubmit={(event) => {
        event.preventDefault();
        void onConfirm(value);
      }}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
          AI draft
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gymbud-ink">
          AI plan ready for review
        </h1>
        <p className="mt-2 text-sm leading-6 text-gymbud-muted">
          You can adjust each session before confirming. Nothing is added to
          the calendar until you confirm this plan.
        </p>
      </div>

      <div className="grid gap-4">
        {value.workouts.map((workout, index) => (
          <article
            key={`${workout.scheduledDate}-${index}`}
            className="grid gap-3 rounded-[var(--radius-control)] border border-gymbud-border p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-gymbud-ink">
                <span className="mb-1 block text-xs font-normal text-gymbud-muted">
                  Session {index + 1}
                </span>
                <ActivityIdentity
                  activityType={workout.activityType}
                  activityOption={
                    workout.activityOptionName && workout.activityOptionIconKey
                      ? {
                          name: workout.activityOptionName,
                          iconKey: workout.activityOptionIconKey,
                        }
                      : null
                  }
                  size={18}
                />
              </h2>
              <span className="text-xs text-gymbud-muted">
                {workout.exercises.length} exercises
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
                Date
                <input
                  aria-label={`Session ${index + 1} date`}
                  type="date"
                  value={workout.scheduledDate.slice(0, 10)}
                  onChange={(event) =>
                    updateWorkout(index, {
                      scheduledDate: `${event.target.value}T12:00:00.000Z`,
                    })
                  }
                  className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
                Minutes
                <input
                  aria-label={`Session ${index + 1} duration`}
                  type="number"
                  min={1}
                  max={600}
                  value={workout.durationMinutes}
                  onChange={(event) =>
                    updateWorkout(index, {
                      durationMinutes: Number(event.target.value),
                    })
                  }
                  className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
                />
              </label>
            </div>
          </article>
        ))}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Adding AI plan…" : "Confirm and add AI plan"}
      </button>
    </form>
  );
}
