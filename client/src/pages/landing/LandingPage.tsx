import { Link } from "react-router-dom";
import { productName, productShortName } from "@fitness/shared/brand";

const steps = [
  ["01", "Plan", "Set a direction that respects your goals and your available week."],
  ["02", "Schedule", "Place purposeful sessions on a calendar you can actually follow."],
  ["03", "Train", "Log what you completed, including the details that really happened."],
  ["04", "Review", "Use clear training volume to decide what deserves attention next."],
] as const;

const features = [
  [
    "AI-assisted planning",
    "Get a considered starting point from your profile, then review it before it reaches your calendar.",
  ],
  [
    "A calmer calendar",
    "See the next session, the full cycle, and the space between ambition and recovery.",
  ],
  [
    "Training that reflects reality",
    "Record actual sets, reps, weight, time, and distance instead of relying on planned numbers.",
  ],
  [
    "Cycle-level progress",
    "Review each cycle with objective volume and make the next decision with context.",
  ],
] as const;

const previewDays = [
  { day: "", activities: [] },
  { day: "1", activities: [] },
  { day: "2", activities: ["Strength"] },
  { day: "3", activities: [] },
  { day: "4", activities: ["Cardio"] },
  { day: "5", activities: [] },
  { day: "6", activities: ["Sport"] },
  { day: "7", activities: [] },
  { day: "8", activities: [] },
  { day: "9", activities: ["Strength"] },
  { day: "10", activities: [] },
  { day: "11", activities: [] },
  { day: "12", activities: ["Cardio"] },
  { day: "13", activities: [] },
  { day: "14", activities: [] },
  { day: "15", activities: ["Strength"] },
  { day: "16", activities: [] },
  { day: "17", activities: [] },
  { day: "18", activities: [] },
  { day: "19", activities: ["Sport"] },
  { day: "20", activities: [] },
  { day: "21", activities: [] },
  { day: "22", activities: ["Strength"] },
  { day: "23", activities: [] },
  { day: "24", activities: [] },
  { day: "25", activities: ["Cardio"] },
  { day: "26", activities: [] },
  { day: "27", activities: [] },
  { day: "28", activities: [] },
  { day: "29", activities: ["Strength"] },
  { day: "30", activities: [] },
  { day: "", activities: [] },
  { day: "", activities: [] },
  { day: "", activities: [] },
  { day: "", activities: [] },
] as const;

const previewActivityClasses = {
  Strength: "calendar-workout-card--strength",
  Cardio: "calendar-workout-card--cardio",
  Sport: "calendar-workout-card--sport",
} as const;

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gymbud-background text-gymbud-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-8 lg:px-10">
        <Link className="focus-ring rounded-[var(--radius-control)]" to="/">
          <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-gymbud-muted">
            Fitness planner
          </span>
          <span className="mt-1 block text-xl font-semibold tracking-tight">
            {productShortName}
          </span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Account navigation">
          <Link
            className="focus-ring rounded-[var(--radius-control)] px-3 py-3 text-sm font-semibold text-gymbud-muted hover:text-gymbud-ink sm:px-4"
            to="/login"
          >
            Sign in
          </Link>
          <Link className="button-primary focus-ring" to="/signup">
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-10 lg:pb-28">
          <div>
            <p className="inline-flex rounded-full border border-gymbud-border bg-gymbud-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
              Athletic calm for consistent training
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
              Train with intention.
              <span className="block text-gymbud-accent-strong">Keep the next step clear.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-gymbud-muted">
              {productName} helps you plan, schedule, train, and review without
              turning fitness into another noisy dashboard.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="button-primary focus-ring px-5" to="/signup">
                Start planning
              </Link>
              <Link
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-5 py-3 text-sm font-semibold hover:border-gymbud-accent-strong"
                to="/login"
              >
                Sign in to GymBud
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[3rem] bg-gymbud-accent-soft/60 blur-3xl" aria-hidden="true" />
            <div className="relative rounded-[2rem] border border-gymbud-border bg-gymbud-surface p-5 shadow-[var(--shadow-card)] sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b border-gymbud-border pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
                    Calendar
                  </p>
                  <p className="mt-2 text-2xl font-semibold">September 2026</p>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-gymbud-muted" aria-hidden="true">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gymbud-surface-muted">←</span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gymbud-accent-soft text-gymbud-accent-strong">→</span>
                </div>
              </div>
              <div className="mt-5">
                <div className="grid grid-cols-7 gap-1 text-center text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-gymbud-muted">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {previewDays.map(({ day, activities }, index) => (
                    <div
                      key={`${day}-${index}`}
                      className={`min-h-14 rounded-[0.7rem] border p-1.5 ${day ? "border-gymbud-border bg-gymbud-background" : "border-transparent bg-transparent"}`}
                    >
                      {day ? <span className="text-xs font-semibold text-gymbud-ink">{day}</span> : null}
                      <div className="mt-1 grid gap-1">
                        {activities.map((activity) => (
                          <span
                            key={activity}
                            className={`calendar-workout-card ${previewActivityClasses[activity]} truncate rounded px-1 py-0.5 text-[0.58rem] font-semibold`}
                          >
                            {activity}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <LandingMetric label="Done" value="08" />
                <LandingMetric label="Rate" value="84%" />
                <LandingMetric label="Cycles" value="03" />
              </div>
              <p className="mt-5 text-sm leading-6 text-gymbud-muted">
                Open any session to see the plan, status, and next action.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-gymbud-border bg-gymbud-surface/60" aria-labelledby="flow-heading">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 lg:px-10">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
                A simple rhythm
              </p>
              <h2 id="flow-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Plan. Schedule. Train. Review.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(([number, title, description]) => (
                <article key={title} className="rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5">
                  <p className="text-sm font-semibold text-gymbud-accent-strong">{number}</p>
                  <h3 className="mt-10 text-xl font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-gymbud-muted">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8 lg:px-10 lg:py-24" aria-labelledby="features-heading">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
              Made for the long run
            </p>
            <h2 id="features-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Enough structure to move forward. Enough room to be human.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {features.map(([title, description]) => (
              <article key={title} className="rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-6 shadow-sm">
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-3 max-w-lg text-sm leading-6 text-gymbud-muted">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-8 lg:px-10" aria-labelledby="boundary-heading">
          <div className="rounded-[2rem] bg-gymbud-ink px-6 py-10 text-white sm:px-10 sm:py-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-accent-soft">
                Your calendar stays yours
              </p>
              <h2 id="boundary-heading" className="mt-3 text-3xl font-semibold tracking-tight">
                AI can suggest. You decide.
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/70">
                Any AI-generated plan is presented as a draft for your review.
                Nothing changes your calendar until you confirm it.
              </p>
            </div>
            <Link className="focus-ring mt-8 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-gymbud-accent px-5 py-3 text-sm font-semibold text-gymbud-ink lg:mt-0" to="/signup">
              Build your rhythm
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-8 text-sm text-gymbud-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p>{productName}</p>
        <p>Plan deliberately. Train consistently. Review honestly.</p>
      </footer>
    </div>
  );
}

function LandingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface p-3">
      <p className="text-xs text-gymbud-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
