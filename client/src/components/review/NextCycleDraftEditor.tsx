import { useState } from "react";
import type { ApiPlanDraft } from "../../api/contracts";
import { ActivityIdentity } from "../catalog/ActivityIdentity";

export type NextCycleDraft = {
  cycleId: string;
  title: string;
  focus: string;
  weeks: number;
  plan?: ApiPlanDraft;
};

export type NextCycleDraftEditorProps = {
  draft: NextCycleDraft;
  onConfirm: (draft: NextCycleDraft) => void;
  submitting?: boolean;
};

export function NextCycleDraftEditor({
  draft,
  onConfirm,
  submitting = false,
}: NextCycleDraftEditorProps) {
  const [value, setValue] = useState(draft);

  return (
    <form
      className="grid gap-5 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(value);
      }}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
          AI next-cycle draft
        </p>
        <h2 className="mt-1 text-xl font-semibold text-gymbud-ink">
          Review before scheduling
        </h2>
      </div>
      <p className="text-sm text-gymbud-muted">
        Review the AI draft before adding it to your calendar.
      </p>
      {value.plan ? (
        <div className="grid gap-3" aria-label="Weekly workout draft">
          {value.plan.workouts.map((workout, index) => (
            <fieldset key={`${workout.scheduledDate}-${index}`} className="grid gap-2 rounded-[var(--radius-control)] border border-gymbud-border p-3">
              <legend className="px-1 text-sm font-semibold text-gymbud-ink">
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
                <span className="mt-1 block text-xs font-normal text-gymbud-muted">
                  Workout {index + 1}
                </span>
              </legend>
              <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
                Date
                <input
                  className="min-h-10 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
                  type="date"
                  value={workout.scheduledDate.slice(0, 10)}
                  onChange={(event) => setValue((current) => current.plan ? {
                    ...current,
                    plan: {
                      ...current.plan,
                      workouts: current.plan.workouts.map((item, itemIndex) => itemIndex === index ? { ...item, scheduledDate: `${event.target.value}T00:00:00.000Z` } : item),
                    },
                  } : current)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
                Minutes
                <input
                  className="min-h-10 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
                  type="number"
                  min={1}
                  max={600}
                  value={workout.durationMinutes}
                  onChange={(event) => setValue((current) => current.plan ? {
                    ...current,
                    plan: {
                      ...current.plan,
                      workouts: current.plan.workouts.map((item, itemIndex) => itemIndex === index ? { ...item, durationMinutes: Number(event.target.value) } : item),
                    },
                  } : current)}
                />
              </label>
            </fieldset>
          ))}
        </div>
      ) : null}
      <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
        Cycle title
        <input
          className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
          value={value.title}
          onChange={(event) =>
            setValue((current) => ({ ...current, title: event.target.value }))
          }
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
        Training focus
        <textarea
          className="focus-ring rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface p-3"
          value={value.focus}
          rows={3}
          onChange={(event) =>
            setValue((current) => ({ ...current, focus: event.target.value }))
          }
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Adding to calendar…" : "Confirm and add to calendar"}
      </button>
    </form>
  );
}
