import { useState } from "react";
import type { ApiPlanDraft } from "../../api/contracts";

export type NextCycleDraft = {
  cycleId: string;
  title: string;
  focus: string;
  weeks: number;
  plan?: ApiPlanDraft;
};

export type NextCycleDraftEditorProps = {
  draft: NextCycleDraft;
  onConfirm: (draft: NextCycleDraft) => void;
  submitting?: boolean;
};

export function NextCycleDraftEditor({
  draft,
  onConfirm,
  submitting = false,
}: NextCycleDraftEditorProps) {
  const [value, setValue] = useState(draft);

  return (
    <form
      className="grid gap-5 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(value);
      }}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
          AI next-cycle draft
        </p>
        <h2 className="mt-1 text-xl font-semibold text-gymbud-ink">
          Review before scheduling
        </h2>
      </div>
      <p className="text-sm text-gymbud-muted">
        Review the AI draft before adding it to your calendar.
      </p>
      <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
        Cycle title
        <input
          className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
          value={value.title}
          onChange={(event) =>
            setValue((current) => ({ ...current, title: event.target.value }))
          }
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
        Training focus
        <textarea
          className="focus-ring rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface p-3"
          value={value.focus}
          rows={3}
          onChange={(event) =>
            setValue((current) => ({ ...current, focus: event.target.value }))
          }
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Adding to calendar…" : "Confirm and add to calendar"}
      </button>
    </form>
  );
}
