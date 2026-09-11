import type { CardioWorkoutLogInput } from "@fitness/shared";

export type CardioLogFormProps = {
  value: CardioWorkoutLogInput;
  onChange: (value: CardioWorkoutLogInput) => void;
  onSubmit?: () => void;
};

export function CardioLogForm({
  value,
  onChange,
  onSubmit,
}: CardioLogFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
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
        Modality
        <input
          value={value.modality ?? ""}
          onChange={(event) =>
            onChange({ ...value, modality: event.target.value || undefined })
          }
        />
      </label>
      <label>
        Distance (km)
        <input
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
      <label>
        Intensity
        <select
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
      {onSubmit ? <button type="submit">Save cardio log</button> : null}
    </form>
  );
}
