import type { ApiCycle } from "../../api/contracts";
import { WorkoutCard, type CalendarWorkout } from "./WorkoutCard";

export type CalendarGridProps = {
  cycle: ApiCycle;
  today?: string;
  onSelectWorkout: (workout: CalendarWorkout) => void;
};

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function cycleDates(startDate: string): string[] {
  const start = new Date(startDate);
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return dateKey(date);
  });
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(date + "T00:00:00"));
}

export function CalendarGrid({
  cycle,
  today = dateKey(new Date()),
  onSelectWorkout,
}: CalendarGridProps) {
  const workoutsByDate = new Map<string, CalendarWorkout[]>();
  for (const workout of cycle.workouts) {
    const key = dateKey(new Date(workout.scheduledDate));
    const workouts = workoutsByDate.get(key) ?? [];
    workouts.push(workout);
    workoutsByDate.set(key, workouts);
  }

  return (
    <section aria-label="Four-week training calendar" className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cycleDates(cycle.startDate).map((date) => (
          <article
            key={date}
            className={
              "grid min-h-36 content-start gap-3 rounded-[var(--radius-card)] border p-3 " +
              (date === today
                ? "border-gymbud-accent-strong bg-gymbud-surface"
                : "border-gymbud-border bg-gymbud-surface/75")
            }
          >
            <header className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gymbud-ink">
                {formatDate(date)}
              </h2>
              {date === today ? (
                <span className="rounded-full bg-gymbud-accent-soft px-2 py-1 text-[0.7rem] font-semibold text-gymbud-ink">
                  Today
                </span>
              ) : null}
            </header>
            <div className="grid gap-2">
              {(workoutsByDate.get(date) ?? []).map((workout) => (
                <WorkoutCard
                  key={workout.id}
                  workout={workout}
                  today={today}
                  onSelect={onSelectWorkout}
                />
              ))}
              {(workoutsByDate.get(date) ?? []).length === 0 ? (
                <p className="py-3 text-xs text-gymbud-muted">Rest day</p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
