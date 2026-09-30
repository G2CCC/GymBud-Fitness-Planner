import type { SportWorkoutLogInput } from "@fitness/shared";
import type { ApiActivityOption } from "../../api/contracts";
import { ActivityIdentity } from "../catalog/ActivityIdentity";

export type SportLogFormProps = {
  value: SportWorkoutLogInput;
  onChange: (value: SportWorkoutLogInput) => void;
  activityOption?: ApiActivityOption | null;
  legacySportName?: string | null;
  onSubmit?: () => void;
};

const fieldClassName =
  "focus-ring mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 text-sm text-gymbud-ink";

export function SportLogForm({
  value,
  onChange,
  activityOption = null,
  legacySportName = null,
  onSubmit,
}: SportLogFormProps) {
  return (
    <form
      className="grid gap-4 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-4 shadow-sm sm:grid-cols-2 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <div
        aria-label="Selected sport activity"
        className="sm:col-span-2"
      >
        {activityOption ? (
          <ActivityIdentity activityType="SPORT" activityOption={activityOption} />
        ) : (
          <p className="text-sm font-semibold text-gymbud-ink">
            {legacySportName ?? value.sportName ?? "Sport"}
          </p>
        )}
      </div>
      <label className="grid gap-1 text-sm font-semibold text-gymbud-ink">
        Actual duration (minutes)
        <input
          className={fieldClassName}
          type="number"
          min={1}
          value={value.actualDurationMinutes}
          onChange={(event) =>
            onChange({
              ...value,
              actualDurationMinutes: Number(event.target.value),
            })
          }
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-gymbud-ink">
        Intensity
        <select
          className={fieldClassName}
          value={value.intensity ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              intensity: event.target.value
                ? (event.target.value as SportWorkoutLogInput["intensity"])
                : undefined,
            })
          }
        >
          <option value="">Select intensity</option>
          <option value="LOW">Low</option>
          <option value="MODERATE">Moderate</option>
          <option value="HIGH">High</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-gymbud-ink sm:col-span-2">
        Notes
        <textarea
          className="focus-ring mt-1 min-h-24 w-full resize-y rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 py-2 text-sm text-gymbud-ink"
          value={value.notes ?? ""}
          onChange={(event) =>
            onChange({ ...value, notes: event.target.value || undefined })
          }
        />
      </label>
      {onSubmit ? (
        <button className="button-primary focus-ring sm:col-span-2" type="submit">
          Save sport log
        </button>
      ) : null}
    </form>
  );
}
