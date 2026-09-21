import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { confirmNextCyclePlan, generateNextCycleDraft, processWeeklyReview } from "../../api/client";
import type { ApiCycleReviewResult, ApiNextCycleDraft } from "../../api/contracts";
import { NextCycleDraftEditor } from "../../components/review/NextCycleDraftEditor";

export function ReviewPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [review, setReview] = useState<ApiCycleReviewResult | null>(null);
  const [draft, setDraft] = useState<ApiNextCycleDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!cycleId) return;
    void processWeeklyReview(cycleId)
      .then((result) => {
        setReview(result);
        setDraft(result?.nextWeeklyDraft ?? null);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "The weekly review could not be loaded."))
      .finally(() => setLoading(false));
  }, [cycleId]);

  if (!cycleId) return <ReviewMessage message="This review link is missing its cycle id." />;
  if (loading) return <ReviewMessage message="Loading your weekly review…" />;
  if (error && !review) return <ReviewMessage message={error} />;
  const reviewCycleId = cycleId;

  async function handleGenerateDraft() {
    if (!review) return;
    setSubmitting(true); setError(null);
    try {
      const result = await generateNextCycleDraft(reviewCycleId, review.reviewId);
      setDraft(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The next weekly draft could not be generated.");
    } finally { setSubmitting(false); }
  }

  async function handleConfirm(value: { plan?: ApiNextCycleDraft["plan"] }) {
    if (!value.plan) { setError("The draft is missing its validated plan payload."); return; }
    setSubmitting(true); setError(null);
    try {
      await confirmNextCyclePlan(value.plan.cycleId, value.plan);
      setSuccess("The next weekly plan is now active.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The next weekly plan could not be activated.");
    } finally { setSubmitting(false); }
  }

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-6 sm:px-8">
      <header>
        <Link className="text-sm font-semibold text-gymbud-accent-strong" to="/calendar">← Back to calendar</Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">Weekly review</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gymbud-ink">Review this week, then confirm next week.</h1>
        <p className="mt-2 text-sm leading-6 text-gymbud-muted">This review is generated from your actual training. The previous week is used only for a shallow comparison.</p>
      </header>
      {error ? <p role="alert" className="rounded-[var(--radius-control)] bg-gymbud-danger/10 p-3 text-sm text-gymbud-danger">{error}</p> : null}
      {success ? <p role="status" className="rounded-[var(--radius-control)] bg-gymbud-accent-soft p-3 text-sm text-gymbud-ink">{success}</p> : null}
      {review ? <section className="grid gap-4 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">This week</p>
        <p className="text-sm leading-6 text-gymbud-ink">{review.processedSummary}</p>
        <p className="text-sm text-gymbud-muted">Completed sessions: {readNumber(review.trainingVolume, "completedWorkoutCount")}</p>
        {review.previousCycle ? <p className="text-sm text-gymbud-muted">Compared with last week using a shallow volume comparison.</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">{review.conclusions.keyFindings.map((finding) => <p key={finding} className="rounded-[var(--radius-control)] bg-gymbud-surface-muted p-3 text-sm text-gymbud-ink">{finding}</p>)}</div>
      </section> : null}
      {review?.nextCycleEligibility === "RESET_REQUIRED" ? <p className="rounded-[var(--radius-card)] bg-gymbud-surface-muted p-4 text-sm text-gymbud-muted">No completed training was recorded this week, so GymBud will wait for a new reset before generating another plan.</p> : null}
      {review && review.nextCycleEligibility === "READY" && !draft ? <button type="button" onClick={() => void handleGenerateDraft()} disabled={submitting} className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 font-semibold text-white disabled:opacity-60">{submitting ? "Generating next week…" : "Generate next week"}</button> : null}
      {draft ? <NextCycleDraftEditor draft={{ cycleId: draft.cycle.id, title: "Next weekly plan", focus: review?.conclusions.recommendations[0] ?? "Continue building consistent training habits.", weeks: 1, plan: draft.plan }} submitting={submitting} onConfirm={(value) => void handleConfirm(value)} /> : null}
    </main>
  );
}

function readNumber(value: Record<string, unknown>, key: string): number { return typeof value[key] === "number" ? value[key] : 0; }
function ReviewMessage({ message }: { message: string }) { return <main className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-2xl content-center px-4 py-8"><p className="text-gymbud-danger">{message}</p></main>; }
