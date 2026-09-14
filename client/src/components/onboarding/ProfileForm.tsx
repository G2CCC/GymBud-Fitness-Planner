import { useState, type FormEvent } from "react";
import {
  locations,
  profileInputSchema,
  type Location,
  type ProfileInput,
} from "@fitness/shared";

export type ProfileFormProps = {
  initialValue?: ProfileInput;
  onSubmit: (value: ProfileInput) => void | Promise<void>;
  submitting?: boolean;
  error?: string | null;
};

const defaultValue: ProfileInput = {
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  defaultLocation: "GYM",
  primaryGoal: "FAT_LOSS",
  secondaryOutcome: "MUSCLE_PRESERVATION",
};

export function ProfileForm({
  initialValue = defaultValue,
  onSubmit,
  submitting = false,
  error: externalError = null,
}: ProfileFormProps) {
  const [value, setValue] = useState<ProfileInput>(initialValue);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ProfileInput>(
    key: K,
    nextValue: ProfileInput[K],
  ) {
    setValue((current) => ({ ...current, [key]: nextValue }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = profileInputSchema.safeParse(value);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your profile details.");
      return;
    }

    setError(null);
    void onSubmit(parsed.data);
  }

  return (
    <form
      className="grid gap-6 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-[var(--shadow-card)] sm:p-7"
      onSubmit={handleSubmit}
      noValidate
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
          Your training setup
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gymbud-ink">
          Give GymBud the rhythm of your week.
        </h1>
        <p className="mt-2 text-sm leading-6 text-gymbud-muted">
          We only need your training frequency and available time. Equipment is
          inferred from the location, so gym plans have no equipment restriction
          and home plans default to bodyweight movements.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
          Training days per week
          <input
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            type="number"
            min={1}
            max={7}
            value={value.weeklyTrainingDays}
            onChange={(event) =>
              update("weeklyTrainingDays", Number(event.target.value))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
          Minutes per session
          <input
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            type="number"
            min={10}
            max={360}
            value={value.sessionDurationMinutes}
            onChange={(event) =>
              update("sessionDurationMinutes", Number(event.target.value))
            }
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
        Default training location
        <select
          className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
          value={value.defaultLocation}
          onChange={(event) =>
            update("defaultLocation", event.target.value as Location)
          }
        >
          {locations.map((location) => (
            <option key={location} value={location}>
              {location === "GYM" ? "Gym" : "Home"}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
          Primary goal
          <select
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            value={value.primaryGoal}
            onChange={(event) => update("primaryGoal", event.target.value)}
          >
            <option value="FAT_LOSS">Fat loss</option>
            <option value="MUSCLE_GAIN">Muscle gain</option>
            <option value="PERFORMANCE">Performance</option>
            <option value="GENERAL_HEALTH">General health</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
          Secondary outcome
          <input
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            value={value.secondaryOutcome ?? ""}
            placeholder="Optional"
            onChange={(event) =>
              update(
                "secondaryOutcome",
                event.target.value.trim() || undefined,
              )
            }
          />
        </label>
      </div>

      {error || externalError ? (
        <p role="alert" className="text-sm font-medium text-gymbud-danger">
          {error ?? externalError}
        </p>
      ) : null}

      <button
        className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={submitting}
      >
        {submitting ? "Saving setup…" : "Save and open calendar"}
      </button>
    </form>
  );
}
