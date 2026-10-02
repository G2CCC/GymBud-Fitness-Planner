import type { ApiWorkout } from "../../api/contracts";

export type WorkoutLogSummaryProps = {
  workout: ApiWorkout;
  exerciseNames: Record<string, string>;
  compact?: boolean;
};

function titleCase(value: string): string {
  return value[0] + value.slice(1).toLowerCase();
}

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = String(secondsPerKm % 60).padStart(2, "0");
  return minutes + ":" + seconds + " /km";
}

export function WorkoutLogSummary({
  workout,
  exerciseNames,
  compact = false,
}: WorkoutLogSummaryProps) {
  const details = workout.workoutLog?.actualDetails;
  const exerciseLogs = workout.workoutLog?.exerciseLogs ?? [];
  const setCount = exerciseLogs.reduce(
    (total, exercise) => total + exercise.setLogs.length,
    0,
  );

  return (
    <section
      aria-labelledby="workout-log-summary-title"
      className={
        compact
          ? "grid gap-3"
          : "grid gap-5 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-4 shadow-sm sm:gap-6 sm:p-6"
      }
    >
      <div>
        <h2
          id="workout-log-summary-title"
          className={
            compact
              ? "text-sm font-semibold text-gymbud-ink"
              : "text-xl font-semibold text-gymbud-ink"
          }
        >
          {compact ? "Completed session" : "What you completed"}
        </h2>
        {workout.activityType === "STRENGTH" && exerciseLogs.length > 0 ? (
          <p className="mt-1 text-sm text-gymbud-muted">
            {exerciseLogs.length} {exerciseLogs.length === 1 ? "exercise" : "exercises"} · {setCount} {setCount === 1 ? "set" : "sets"}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg bg-gymbud-background p-3 text-sm">
        <p className="font-semibold">Estimated exercise calories: {workout.energy?.estimatedKcal == null ? 'Unavailable' : `${workout.energy.estimatedKcal} kcal`}</p>
        <p className="mt-1 text-gymbud-muted">{workout.energy?.coverage==='PARTIAL'?'Some actions have no supported estimate. This is a known subtotal.':workout.energy?.coverage==='COMPLETE'?'Estimated extra energy above resting needs. Actual expenditure varies.':'No supported estimate is available for this session.'}</p>
        {typeof workout.energy?.inputs.assumption==='string' ? <p className="mt-1 text-gymbud-muted">Assumption: {workout.energy.inputs.assumption}</p> : null}
      </div>
      {workout.activityType === "STRENGTH" ? (
        exerciseLogs.length > 0 ? (
          <div className="grid gap-3">
            {exerciseLogs.map((exercise) => (
              <article
                key={exercise.exerciseId + "-" + exercise.sortOrder}
                className="rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-background p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-gymbud-ink">
                    {exerciseNames[exercise.exerciseId] ?? "Exercise"}
                  </h3>
                  <span className="text-xs font-medium text-gymbud-muted">
                    {exercise.setLogs.length} {exercise.setLogs.length === 1 ? "set" : "sets"}
                  </span>
                </div>
                <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                  {exercise.setLogs.map((set) => (
                    <li
                      key={set.setNumber}
                      className="flex items-center justify-between gap-3 rounded-lg bg-gymbud-surface px-3 py-2 text-sm"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-gymbud-muted">
                        Set {set.setNumber}
                      </span>
                      <span className="font-medium text-gymbud-ink">
                        {set.actualReps} reps · {set.actualWeight} {set.weightUnit.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-[var(--radius-control)] bg-gymbud-surface-muted p-4 text-sm text-gymbud-muted">
            No exercise details were saved for this workout.
          </p>
        )
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {details?.actualDurationMinutes != null ? (
            <SummaryMetric label="Duration" value={details.actualDurationMinutes + " min"} />
          ) : null}
          {workout.activityType === "CARDIO" && details?.distanceKm != null ? (
            <SummaryMetric label="Distance" value={details.distanceKm + " km"} />
          ) : null}
          {workout.activityType === "CARDIO" && details?.modality ? (
            <SummaryMetric label="Activity" value={details.modality} />
          ) : null}
          {workout.activityType === "CARDIO" && details?.paceSecondsPerKm != null ? (
            <SummaryMetric label="Pace" value={formatPace(details.paceSecondsPerKm)} />
          ) : null}
          {workout.activityType === "CARDIO" && details?.speedKph != null ? (
            <SummaryMetric label="Speed" value={details.speedKph + " km/h"} />
          ) : null}
          {workout.activityType === "SPORT" && details?.sportName ? (
            <SummaryMetric label="Sport" value={details.sportName} />
          ) : null}
          {details?.intensity ? (
            <SummaryMetric label="Intensity" value={titleCase(details.intensity)} />
          ) : null}
          {workout.activityType === "SPORT" && details?.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gymbud-muted">
                Notes
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-gymbud-ink">
                {details.notes}
              </dd>
            </div>
          ) : null}
          {!details ||
          (details.actualDurationMinutes == null &&
            details.distanceKm == null &&
            !details.modality &&
            details.paceSecondsPerKm == null &&
            details.speedKph == null &&
            !details.sportName &&
            !details.intensity &&
            !details.notes) ? (
            <p className="rounded-[var(--radius-control)] bg-gymbud-surface-muted p-4 text-sm text-gymbud-muted sm:col-span-2">
              No workout details were saved for this session.
            </p>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] bg-gymbud-background p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gymbud-muted">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-gymbud-ink">{value}</dd>
    </div>
  );
}
