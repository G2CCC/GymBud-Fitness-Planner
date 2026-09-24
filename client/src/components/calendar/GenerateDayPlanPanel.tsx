import { useState, type FormEvent } from "react";
import type { ApiCycle, ApiPlanDraft } from "../../api/contracts";
import { SingleDayPlanDraftEditor } from "./SingleDayPlanDraftEditor";

export type GenerateDayPlanInput = {
  scheduledDate: string;
  focusAreas: string[];
};

export type GenerateDayPlanPanelProps = {
  cycle: ApiCycle;
  draft: ApiPlanDraft | null;
  onClose: () => void;
  onGenerate: (input: GenerateDayPlanInput) => Promise<void> | void;
  onConfirm: (draft: ApiPlanDraft) => Promise<void> | void;
  onDraftDiscard: () => void;
};

const focusOptions = [
  ["CHEST", "Chest"],
  ["SHOULDERS", "Shoulders"],
  ["BACK", "Back"],
  ["LEGS", "Legs"],
  ["ARMS", "Arms"],
  ["CORE", "Core"],
] as const;

function systemDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return values.year + "-" + values.month + "-" + values.day;
}

function dateKey(value: string): string {
  return value.slice(0, 10);
}

export function GenerateDayPlanPanel({
  cycle,
  draft,
  onClose,
  onGenerate,
  onConfirm,
  onDraftDiscard,
}: GenerateDayPlanPanelProps) {
  const today = systemDateKey();
  const minDate = today < dateKey(cycle.startDate) ? dateKey(cycle.startDate) : today;
  const [scheduledDate, setScheduledDate] = useState(minDate);
  const [focusAreas, setFocusAreas] = useState<string[]>(["CHEST"]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function toggleFocusArea(focusArea: string) {
    setFocusAreas((current) =>
      current.includes(focusArea)
        ? current.filter((value) => value !== focusArea)
        : [...current, focusArea],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (focusAreas.length === 0) {
      setError("Choose at least one Strength focus area.");
      return;
    }

    setError(null);
    setGenerating(true);
    try {
      await onGenerate({ scheduledDate, focusAreas });
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "The day plan could not be generated.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleConfirm(value: ApiPlanDraft) {
    setError(null);
    setConfirming(true);
    try {
      await onConfirm(value);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "The day plan could not be added.",
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <section
      data-testid="generate-day-plan-panel"
      className="cycle-gradient grid w-full max-w-2xl justify-self-start gap-4 rounded-[var(--radius-card)] border border-gymbud-border p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gymbud-ink">Generate a day plan</h2>
          <p className="mt-1 text-sm text-gymbud-muted">
            Generate one Strength session for an empty day, then review it before saving.
          </p>
        </div>
        <button
          className="focus-ring min-h-11 min-w-11 rounded-full border border-gymbud-border text-xl text-gymbud-muted"
          type="button"
          aria-label="Close generate plan panel"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
          Plan date
          <input
            className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
            type="date"
            min={minDate}
            max={dateKey(cycle.endDate)}
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.target.value)}
          />
        </label>
        <fieldset className="grid gap-2">
          <legend className="text-xs font-semibold text-gymbud-ink">Strength focus</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {focusOptions.map(([value, label]) => (
              <label
                className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 text-sm text-gymbud-ink"
                key={value}
              >
                <input
                  type="checkbox"
                  checked={focusAreas.includes(value)}
                  onChange={() => toggleFocusArea(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {error ? (
          <p className="rounded-[var(--radius-control)] bg-gymbud-danger/10 p-3 text-sm text-gymbud-danger" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="focus-ring min-h-11 justify-self-start rounded-[var(--radius-control)] bg-gymbud-ink px-4 text-sm font-semibold text-white"
          type="submit"
          disabled={generating}
        >
          {generating ? "Generating…" : "Generate day plan"}
        </button>
      </form>
      {draft ? (
        <SingleDayPlanDraftEditor
          plan={draft}
          submitting={confirming}
          onConfirm={(value) => void handleConfirm(value)}
          onCancel={onDraftDiscard}
        />
      ) : null}
    </section>
  );
}
