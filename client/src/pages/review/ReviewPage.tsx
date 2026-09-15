import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CycleReviewForm } from "../../components/reviews/CycleReviewForm";
import { NextCycleDraftEditor } from "../../components/review/NextCycleDraftEditor";
import {
  confirmNextCyclePlan,
  generateBatchReview,
  generateCycleReview,
  generateNextCycleDraft,
  getBatchReviewStatus,
} from "../../api/client";
import type {
  ApiBatchReviewStatus,
  ApiCycleBatchReviewResult,
  ApiCycleReviewResult,
  ApiNextCycleDraft,
} from "../../api/contracts";

export function ReviewPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [summary, setSummary] = useState("");
  const [review, setReview] = useState<ApiCycleReviewResult | null>(null);
  const [batchStatus, setBatchStatus] = useState<ApiBatchReviewStatus | null>(null);
  const [batchReview, setBatchReview] = useState<ApiCycleBatchReviewResult | null>(null);
  const [batchSummary, setBatchSummary] = useState("");
  const [nextDraft, setNextDraft] = useState<ApiNextCycleDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reviewCycleId = cycleId ?? "";

  useEffect(() => {
    if (!reviewCycleId) {
      return;
    }

    void getBatchReviewStatus(reviewCycleId)
      .then(setBatchStatus)
      .catch(() => setBatchStatus(null));
  }, [reviewCycleId]);

  if (!cycleId) {
    return <ReviewMessage message="This review link is missing its cycle id." />;
  }

  async function handleReview() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await generateCycleReview(reviewCycleId, summary);
      setReview(result);
      setBatchStatus(
        result.batchReview
          ? {
              eligible: result.batchReview.eligible,
              reviewId: result.batchReview.reviewId,
              startCycleNumber:
                Math.floor((result.cycleNumber - 1) / 4) * 4 + 1,
              endCycleNumber:
                Math.floor((result.cycleNumber - 1) / 4) * 4 + 4,
              status: result.batchReview.status,
            }
          : null,
      );
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

  async function handleBatchReview() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await generateBatchReview(reviewCycleId, batchSummary);
      setBatchReview(result);
      setBatchStatus((current) =>
        current
          ? { ...current, eligible: true, status: "READY", reviewId: result.reviewId }
          : current,
      );
    } catch (batchError) {
      setError(
        batchError instanceof Error
          ? batchError.message
          : "The four-cycle review could not be generated.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBatchDraft() {
    if (!batchReview) {
      setError("Generate the four-cycle review before requesting a plan draft.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      setNextDraft(
        await generateNextCycleDraft(reviewCycleId, batchReview.reviewId),
      );
    } catch (draftError) {
      setError(
        draftError instanceof Error
          ? draftError.message
          : "The next-cycle draft could not be generated.",
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
          <p className="text-sm text-gymbud-muted">
            Completed sessions: {readNumber(review.trainingVolume, "completedWorkoutCount")}
          </p>
          {review.previousCycle ? (
            <p className="text-sm text-gymbud-muted">
              Compared with cycle {readNumber(review.previousCycle, "cycleNumber")} using a shallow volume comparison.
            </p>
          ) : null}
        </section>
      ) : null}

      {batchStatus?.eligible ? (
        <section className="grid gap-4 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
              Four-cycle review
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gymbud-ink">
              Review cycles {batchStatus.startCycleNumber}–{batchStatus.endCycleNumber}
            </h2>
            <p className="mt-2 text-sm text-gymbud-muted">
              This fixed batch is reviewed separately. Earlier cycles are not included.
            </p>
          </div>
          {!batchReview ? (
            <>
              <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
                Optional four-cycle summary
                <textarea
                  value={batchSummary}
                  onChange={(event) => setBatchSummary(event.target.value)}
                  rows={4}
                  placeholder="Anything you want the AI to consider for these four cycles?"
                  className="focus-ring rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface p-3"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleBatchReview()}
                disabled={submitting || batchStatus.status === "GENERATING"}
                className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Generating four-cycle review…" : "Review these four cycles"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-gymbud-ink">
                {batchReview.processedSummary}
              </p>
              <button
                type="button"
                onClick={() => void handleBatchDraft()}
                disabled={submitting || batchReview.nextCycleDraftStatus === "RESET_REQUIRED"}
                className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Generating next plan…" : "Generate next-cycle draft"}
              </button>
            </>
          )}
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

function readNumber(value: Record<string, unknown>, key: string): number {
  return typeof value[key] === "number" ? value[key] : 0;
}

function ReviewMessage({ message }: { message: string }) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-2xl content-center px-4 py-8">
      <p className="text-gymbud-danger">{message}</p>
    </main>
  );
}
