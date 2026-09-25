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

export function CardioLogForm({
  value,
  onChange,
  activityOption = null,
  legacyModality = null,
  onSubmit,
}: CardioLogFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <div aria-label="Selected cardio activity">
        {activityOption ? (
          <ActivityIdentity
            activityType="CARDIO"
            activityOption={activityOption}
          />
        ) : (
          <p>
            Legacy activity: {legacyModality ?? value.modality ?? "Cardio"}
          </p>
        )}
      </div>
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
      {activityOption ? null : (
        <p aria-label="Legacy cardio modality">
          Existing modality is kept as read-only legacy context.
        </p>
      )}
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
        Pace (seconds per km)
        <input
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
      <label>
        Speed (km/h)
        <input
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
