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

export function SportLogForm({
  value,
  onChange,
  activityOption = null,
  legacySportName = null,
  onSubmit,
}: SportLogFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <div aria-label="Selected sport activity">
        {activityOption ? (
          <ActivityIdentity activityType="SPORT" activityOption={activityOption} />
        ) : (
          <p>Legacy activity: {legacySportName ?? value.sportName ?? "Sport"}</p>
        )}
      </div>
      {!activityOption ? (
        <p aria-label="Legacy sport name">
          Existing sport name is kept as read-only legacy context.
        </p>
      ) : null}
      <label>
        Actual duration (minutes)
        <input
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
      <label>
        Intensity
        <select
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
      <label>
        Notes
        <textarea
          value={value.notes ?? ""}
          onChange={(event) =>
            onChange({ ...value, notes: event.target.value || undefined })
          }
        />
      </label>
      {onSubmit ? <button type="submit">Save sport log</button> : null}
    </form>
  );
}
