export type PlanChoiceProps = {
  onChooseManual: () => void | Promise<void>;
  onChooseAi: () => void | Promise<void>;
  submitting?: boolean;
};

export function PlanChoice({
  onChooseManual,
  onChooseAi,
  submitting = false,
}: PlanChoiceProps) {
  return (
    <section className="grid gap-6 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-[var(--shadow-card)] sm:p-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
          First cycle
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gymbud-ink">
          How do you want to start?
        </h1>
        <p className="mt-2 text-sm leading-6 text-gymbud-muted">
          You can bring your own plan into the calendar or ask GymBud to draft
          one from your profile.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void onChooseManual()}
          disabled={submitting}
          className="focus-ring grid gap-2 rounded-[var(--radius-card)] border border-gymbud-border p-5 text-left transition hover:border-gymbud-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-base font-semibold text-gymbud-ink">
            I already have my own plan
          </span>
          <span className="text-sm leading-6 text-gymbud-muted">
            Activate an empty cycle and add your sessions manually on the
            calendar.
          </span>
        </button>
        <button
          type="button"
          onClick={() => void onChooseAi()}
          disabled={submitting}
          className="focus-ring grid gap-2 rounded-[var(--radius-card)] border border-gymbud-accent-strong bg-gymbud-accent-soft p-5 text-left transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-base font-semibold text-gymbud-ink">
            Generate a plan with AI
          </span>
          <span className="text-sm leading-6 text-gymbud-muted">
            Review the weekly draft before anything is added to your
            calendar.
          </span>
        </button>
      </div>
    </section>
  );
}
