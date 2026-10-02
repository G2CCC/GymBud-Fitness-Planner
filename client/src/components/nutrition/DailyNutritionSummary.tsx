import { Link } from "react-router-dom";
import type { NutritionDayDto } from "@fitness/shared";
export const nutritionNumber = (n: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
export function DailyNutritionSummary({ day }: { day: NutritionDayDto }) {
  const complete = day.exercise.coverage === "COMPLETE";
  return (
    <section
      aria-label="Daily nutrition summary"
      className="grid gap-4 rounded-2xl border border-gymbud-border bg-gymbud-surface p-5"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-semibold">Daily balance</h2>
        <span>
          {!day.recorded
            ? "Not recorded"
            : day.completedAt
              ? "Diary complete"
              : "Diary incomplete"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Food", day.food.kcal],
          ["Exercise", day.exercise.estimatedKcal],
          ["Net intake", day.netKcal],
          ["Fixed net target", day.target?.kcal],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-gymbud-background p-3">
            <dt className="text-sm text-gymbud-muted">{label}</dt>
            <dd className="mt-1 font-semibold">
              {value == null ? "—" : nutritionNumber(Number(value)) + " kcal"}
            </dd>
          </div>
        ))}
      </dl>
      {day.remainingKcal !== null ? (
        <p className="font-medium">
          {day.remainingKcal < 0
            ? `Exceeded by ${nutritionNumber(-day.remainingKcal)} kcal`
            : `Remaining: ${nutritionNumber(day.remainingKcal)} kcal`}
          {!complete ? " (known estimates only)" : ""}
        </p>
      ) : (
        <Link to="/profile" className="underline">
          Save your profile to set nutrition targets
        </Link>
      )}
      {!complete ? (
        <p role="note" className="text-sm text-gymbud-muted">
          Known exercise subtotal. Some training has no supported estimate; this
          net value cannot be used to judge your full target.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {(["proteinG", "carbsG", "fatG"] as const).map((key, i) => (
          <div key={key}>
            <div className="flex justify-between text-sm">
              <span>{["Protein", "Carbs", "Fat"][i]}</span>
              <span>
                {nutritionNumber(day.food[key])} /{" "}
                {day.target ? nutritionNumber(day.target[key]) : "—"} g
              </span>
            </div>
            <progress
              aria-label={["Protein", "Carbs", "Fat"][i]}
              className="mt-2 h-2 w-full accent-gymbud-accent-strong"
              max={100}
              value={
                day.target && day.target[key] > 0
                  ? Math.min(
                      100,
                      Math.max(0, (day.food[key] / day.target[key]) * 100),
                    )
                  : 0
              }
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-gymbud-muted">
        Net intake = food − estimated extra exercise energy. Your net and macro
        targets stay fixed on training days. Estimates are a starting point, not
        a measured energy requirement.
      </p>
      {day.exercise.workouts.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {day.exercise.workouts.map((w) => (
            <li key={w.workoutId}>
              <Link className="underline" to={"/workouts/" + w.workoutId}>
                View training
              </Link>{" "}
              ·{" "}
              {w.estimatedKcal === null
                ? "Estimate unavailable"
                : `${w.estimatedKcal} kcal${w.coverage === "PARTIAL" ? " (partial)" : ""}`}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
