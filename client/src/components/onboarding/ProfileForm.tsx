import { useState, type FormEvent } from "react";
import {
  genders,
  profileInputSchema,
  type Gender,
  type ProfileInput,
} from "@fitness/shared";

export type ProfileFormProps = {
  initialValue?: ProfileInput;
  onSubmit: (value: ProfileInput) => void | Promise<void>;
  submitting?: boolean;
  error?: string | null;
  title?: string;
  heading?: string;
  description?: string;
  submitLabel?: string;
};

type ProfileFormValue = Omit<ProfileInput, "gender" | "age" | "heightCm" | "weightKg"> & {
  gender: Gender | "";
  age: number | "";
  heightCm: number | "";
  weightKg: number | "";
};

const defaultValue: ProfileFormValue = {
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  primaryGoal: "FAT_LOSS",
  gender: "",
  age: "",
  heightCm: "",
  weightKg: "",
};

function toFormValue(input?: ProfileInput): ProfileFormValue {
  return input
    ? {
        ...input,
      }
    : defaultValue;
}

export function ProfileForm({
  initialValue,
  onSubmit,
  submitting = false,
  error: externalError = null,
  title = "Your training setup",
  heading = "Give GymBud the rhythm of your week.",
  description = "Training frequency, body context, and goals are required so GymBud can build a more relevant plan.",
  submitLabel = "Save and open calendar",
}: ProfileFormProps) {
  const [value, setValue] = useState<ProfileFormValue>(() =>
    toFormValue(initialValue),
  );
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ProfileFormValue>(
    key: K,
    nextValue: ProfileFormValue[K],
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
          {heading}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gymbud-muted">{description}</p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
          Gender <span className="font-normal text-gymbud-muted">Required</span>
          <select
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            required
            value={value.gender}
            onChange={(event) =>
              update(
                "gender",
                event.target.value as Gender | "",
              )
            }
          >
            <option value="">Select gender</option>
            {genders.map((gender) => (
              <option key={gender} value={gender}>
                {gender === "NON_BINARY"
                  ? "Non-binary"
                  : gender === "PREFER_NOT_TO_SAY"
                    ? "Prefer not to say"
                    : gender.charAt(0) + gender.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
          Age <span className="font-normal text-gymbud-muted">Required</span>
          <input
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            type="number"
            min={13}
            max={100}
            required
            value={value.age}
            onChange={(event) =>
              update(
                "age",
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
          Height (cm) <span className="font-normal text-gymbud-muted">Required</span>
          <input
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            type="number"
            min={50}
            max={250}
            step="0.1"
            required
            value={value.heightCm}
            onChange={(event) =>
              update(
                "heightCm",
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
          Body weight (kg) <span className="font-normal text-gymbud-muted">Required</span>
          <input
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            type="number"
            min={20}
            max={350}
            step="0.1"
            required
            value={value.weightKg}
            onChange={(event) =>
              update(
                "weightKg",
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
          />
        </label>
      </div>

      <div>
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
        {submitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
