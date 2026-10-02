import type { NutritionSummary, NutritionComparison } from "@fitness/shared";
import { nutritionNumber } from "./DailyNutritionSummary";
type Review = {
  status: "AVAILABLE" | "INSUFFICIENT_DATA";
  observations: string[];
  suggestions: string[];
};
export function NutritionReview({
  summary,
  comparison,
  review,
}: {
  summary: NutritionSummary;
  comparison: NutritionComparison | null;
  review: Review;
}) {
  const value = (n: number | null, unit = "kcal") =>
    n === null ? "No valid samples" : nutritionNumber(n) + " " + unit;
  return (
    <section
      className="grid gap-4 rounded-2xl border border-gymbud-border bg-gymbud-surface p-5"
      aria-label="Cycle nutrition report"
    >
      <h2 className="text-xl font-semibold">Nutrition this cycle</h2>
      <p className="text-sm text-gymbud-muted">
        {summary.startDate} – {summary.endDate} · {summary.completeFoodDays} of{" "}
        {summary.periodDays} days complete
      </p>
      <p className="text-xs text-gymbud-muted">
        Records frozen at {summary.generatedAt}. Later diary edits do not change
        this report.
      </p>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Average food intake", value(summary.averageFood?.kcal ?? null)],
          ["Average net intake", value(summary.averageNetKcal)],
          ["Average net − target", value(summary.averageNetGapKcal)],
        ].map(([label, text]) => (
          <div key={label} className="rounded-lg bg-gymbud-background p-3">
            <dt className="text-sm text-gymbud-muted">{label}</dt>
            <dd className="mt-1 font-semibold">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-gymbud-muted">
        Food: {summary.completeFoodDays} complete days · Macro comparison:{" "}
        {summary.targetDays} days with targets · Net comparison:{" "}
        {summary.netComparableDays} days with full exercise coverage and targets
      </p>
      {summary.averageFood ? (
        <p className="text-sm">
          Average protein {value(summary.averageFood.proteinG, "g")} · carbs{" "}
          {value(summary.averageFood.carbsG, "g")} · fat{" "}
          {value(summary.averageFood.fatG, "g")}
        </p>
      ) : null}
      {summary.averageMacroGap ? (
        <p className="text-sm">
          Average intake − target: protein{" "}
          {value(summary.averageMacroGap.proteinG, "g")} · carbs{" "}
          {value(summary.averageMacroGap.carbsG, "g")} · fat{" "}
          {value(summary.averageMacroGap.fatG, "g")}
        </p>
      ) : null}
      {summary.coverageGaps.length ? (
        <p className="text-sm text-gymbud-muted">
          Incomplete exercise estimates on: {summary.coverageGaps.join(", ")}.
          These days are excluded from net comparisons.
        </p>
      ) : null}
      {!summary.trendEligible ? (
        <p className="text-sm">
          Insufficient data for an intake trend. At least 3 complete diary days
          are needed.
        </p>
      ) : summary.netComparableDays < 3 ? (
        <p className="text-sm">
          Insufficient fully covered days for a net-target trend.
        </p>
      ) : null}
      {comparison ? (
        <div className="rounded-lg bg-gymbud-background p-3 text-sm">
          <p>
            Previous cycle comparison: average food change{" "}
            {value(comparison.foodKcalDelta)} ({comparison.current.foodDays}{" "}
            current / {comparison.previous.foodDays} previous days).
          </p>
          <p className="mt-1">
            Average net-target gap change {value(comparison.netGapKcalDelta)} (
            {comparison.current.netDays} current / {comparison.previous.netDays}{" "}
            previous comparable days).
          </p>
        </div>
      ) : null}
      <ul className="grid gap-2 text-sm">
        {review.observations.map((text, i) => (
          <li key={"o" + i}>{text}</li>
        ))}
        {review.suggestions.map((text, i) => (
          <li key={"s" + i}>{text}</li>
        ))}
      </ul>
    </section>
  );
}
