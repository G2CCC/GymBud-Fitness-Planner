import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CycleReviewForm } from "../../components/reviews/CycleReviewForm";
import { NextCycleDraftEditor } from "../../components/review/NextCycleDraftEditor";
import {
  confirmNextCyclePlan,
  generateCycleReview,
  generateNextCycleDraft,
} from "../../api/client";
import type { ApiCycleReviewResult, ApiNextCycleDraft } from "../../api/contracts";

export function ReviewPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [summary, setSummary] = useState("");
  const [review, setReview] = useState<ApiCycleReviewResult | null>(null);
  const [nextDraft, setNextDraft] = useState<ApiNextCycleDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!cycleId) {
    return <ReviewMessage message="This review link is missing its cycle id." />;
  }
  const reviewCycleId = cycleId;

  async function handleReview() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await generateCycleReview(reviewCycleId, summary);
      setReview(result);
      if (result.nextCycleEligibility === "ELIGIBLE") {
        setNextDraft(
          await generateNextCycleDraft(reviewCycleId, result.reviewId),
        );
      }
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "The cycle review could not be generated.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDraft(draft: {
    plan?: ApiNextCycleDraft["plan"];
  }) {
    if (!draft.plan) {
      setError("The draft is missing its validated plan payload.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await confirmNextCyclePlan(reviewCycleId, draft.plan);
      setSuccess("The reviewed plan was added to your calendar.");
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "The next cycle could not be added.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const draftEditorValue = nextDraft
    ? {
        cycleId: nextDraft.cycle.id,
        title: "Next four-week cycle",
        focus:
          review?.conclusions.recommendations[0] ??
          "Continue building consistent training habits.",
        weeks: 4,
        plan: nextDraft.plan,
      }
    : null;

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-6 sm:px-8">
      <header>
        <Link className="text-sm font-semibold text-gymbud-accent-strong" to="/calendar">
          ← Back to calendar
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
          Four-week review
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gymbud-ink">
          Close the loop before the next plan.
        </h1>
        <p className="mt-2 text-sm leading-6 text-gymbud-muted">
          Your optional note is sent to the AI for this review only. GymBud does
          not save the original text.
        </p>
      </header>

      <CycleReviewForm
        value={summary}
        onChange={setSummary}
        onSubmit={() => void handleReview()}
        submitting={submitting}
      />

      {error ? (
        <p role="alert" className="rounded-[var(--radius-control)] bg-gymbud-danger/10 p-3 text-sm text-gymbud-danger">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="rounded-[var(--radius-control)] bg-gymbud-accent-soft p-3 text-sm text-gymbud-ink">
          {success}
        </p>
      ) : null}

      {review ? (
        <section className="grid gap-4 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
              AI review result
            </p>
            <p className="mt-3 text-sm leading-6 text-gymbud-ink">
              {review.processedSummary}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {review.conclusions.keyFindings.map((finding) => (
              <p key={finding} className="rounded-[var(--radius-control)] bg-gymbud-surface-muted p-3 text-sm text-gymbud-ink">
                {finding}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {draftEditorValue ? (
        <NextCycleDraftEditor
          draft={draftEditorValue}
          submitting={submitting}
          onConfirm={(draft) => void handleConfirmDraft(draft)}
        />
      ) : null}
    </main>
  );
}

function ReviewMessage({ message }: { message: string }) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-2xl content-center px-4 py-8">
      <p className="text-gymbud-danger">{message}</p>
    </main>
  );
}
