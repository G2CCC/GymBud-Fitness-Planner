import type { SportWorkoutLogInput } from "@fitness/shared";

export type SportLogFormProps = {
  value: SportWorkoutLogInput;
  onChange: (value: SportWorkoutLogInput) => void;
  onSubmit?: () => void;
};

export function SportLogForm({ value, onChange, onSubmit }: SportLogFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <label>
        Sport
        <input
          value={value.sportName ?? ""}
          onChange={(event) =>
            onChange({ ...value, sportName: event.target.value || undefined })
          }
        />
      </label>
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
