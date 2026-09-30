import type { CardioWorkoutLogInput } from "@fitness/shared";
import type { ApiActivityOption } from "../../api/contracts";
import { ActivityIdentity } from "../catalog/ActivityIdentity";

export type CardioLogFormProps = {
  value: CardioWorkoutLogInput;
  onChange: (value: CardioWorkoutLogInput) => void;
  activityOption?: ApiActivityOption | null;
  legacyModality?: string | null;
  onSubmit?: () => void;
};

const fieldClassName =
  "focus-ring mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 text-sm text-gymbud-ink";

export function CardioLogForm({
  value,
  onChange,
  activityOption = null,
  legacyModality = null,
  onSubmit,
}: CardioLogFormProps) {
  return (
    <form
      className="grid gap-4 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-4 shadow-sm sm:grid-cols-2 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <div
        aria-label="Selected cardio activity"
        className="sm:col-span-2"
      >
        {activityOption ? (
          <ActivityIdentity
            activityType="CARDIO"
            activityOption={activityOption}
          />
        ) : (
          <p className="text-sm font-semibold text-gymbud-ink">
            {legacyModality ?? value.modality ?? "Cardio"}
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
        Distance (km)
        <input
          className={fieldClassName}
          type="number"
          min={0}
          step="any"
          value={value.distanceKm ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              distanceKm:
                event.target.value === ""
                  ? undefined
                  : Number(event.target.value),
            })
          }
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-gymbud-ink">
        Pace (seconds per km)
        <input
          className={fieldClassName}
          type="number"
          min={1}
          value={value.paceSecondsPerKm ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              paceSecondsPerKm:
                event.target.value === ""
                  ? undefined
                  : Number(event.target.value),
            })
          }
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-gymbud-ink">
        Speed (km/h)
        <input
          className={fieldClassName}
          type="number"
          min={0}
          step="any"
          value={value.speedKph ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              speedKph:
                event.target.value === ""
                  ? undefined
                  : Number(event.target.value),
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
                ? (event.target.value as CardioWorkoutLogInput["intensity"])
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
      {onSubmit ? (
        <button className="button-primary focus-ring sm:col-span-2" type="submit">
          Save cardio log
        </button>
      ) : null}
    </form>
  );
}
