# GymBud Fitness Planner MVP Design Specification

**Date:** 2026-09-09  
**Status:** Consolidated design for implementation planning

## 1. Product goal

Build a web-first fitness planner that generates a four-week training plan, places sessions on a calendar, records completed training, recommends the next strength-training weight, and creates a reviewed draft for the next cycle.

The MVP prioritizes reliable history and explicit user control. AI may generate drafts and recommendations, but it never silently changes historical records or writes an unreviewed future plan into the calendar.

## 2. MVP scope

### Included

- Activity types: `STRENGTH`, `CARDIO`, `SPORT`.
- User profile with primary goal, optional secondary outcome, weekly training days, session duration, and default location.
- Locations: `GYM` and `HOME`.
- Four-week cycles and calendar scheduling.
- Per-workout location override.
- System exercises and confirmed user-owned custom exercises.
- Per-set strength planning and logging.
- Actual completion date/time for normal completion and backfill.
- Manual add, cancel, reschedule, and overdue handling.
- AI-generated plan drafts, replacement suggestions, weight recommendations, and cycle reviews.
- Optional cycle-review summary supplied by the user.
- Immutable closed-cycle snapshots.

### Excluded from MVP

- RPE or post-workout subjective difficulty fields.
- Automatic daily training-day rebalancing after calendar edits.
- Fixed equipment inventory management.
- Nutrition planning, body-fat tracking, circumference tracking, wearable integrations, and public exercise sharing.
- Editing closed cycles after the next cycle has been generated.
- Saving the user's raw cycle-review prompt.

## 2.1 Technical architecture

The project uses a small workspace monorepo so the web client and future iOS client share business contracts without sharing browser-specific UI.

```text
client/   React + Vite responsive web UI
server/   Node.js + Express REST API, Prisma, AI integration
shared/   TypeScript domain types, Zod schemas, pure business rules
mobile/   Reserved for the later Expo/React Native iOS client
```

The MVP builds `client`, `server`, and `shared`. The future `mobile` app consumes the same API and imports only platform-neutral code from `shared`. The web and iOS screens are separate because responsive DOM components should not be forced into native UI primitives. API contracts, validation, date rules, location rules, activity calculations, and AI response schemas must remain in `shared` or be exposed through the server contract.

The client never accesses Prisma or the database directly. Both clients use the same versioned JSON API. The server owns authentication context, database access, cycle transactions, and AI provider calls.

The web client uses React Router and responsive CSS. The future mobile client may use Expo Router and React Native. Platform-specific code must be isolated behind `.web`, `.native`, or `.ios` modules when a shared utility genuinely needs platform behavior; business rules must remain platform-neutral.

## 3. User and scheduling rules

The plan-setup form collects only the scheduling inputs needed for execution:

- `weeklyTrainingDays`: positive integer;
- `sessionDurationMinutes`: positive integer;
- `defaultLocation`: `GYM` or `HOME`.

The user is not required to enter a fixed list of calendar dates or an equipment inventory. A new four-week plan starts from the generation date and distributes sessions as evenly as possible over the following seven days for the first week. Later weeks use the same weekly cadence. The user may manually change dates in the calendar.

The profile also contains a primary goal and optional secondary outcome. If the user chooses fat loss and muscle gain together, the MVP stores fat loss as primary and muscle preservation as the secondary outcome.

Each scheduled workout stores one `location`. It defaults from `UserProfile.defaultLocation`, but the user may override it for that workout without changing the profile.

## 4. Exercise and location model

Every strength exercise stores `availableLocations`, a non-empty array containing `GYM`, `HOME`, or both.

Validation rules:

| Exercise capability | Valid location tags |
|---|---|
| Bodyweight/no equipment | `GYM`, `HOME`, or both |
| Requires equipment | `GYM` only |

The action picker filters exercises by the scheduled workout's location. An exercise tagged for both locations appears in both contexts.

System exercises are globally available. Custom exercises belong to one user and are available to that user only. A custom exercise is created through this flow:

1. User enters a name and description.
2. AI extracts equipment, target muscles, movement pattern, and location tags.
3. The server validates the extracted location tags.
4. User confirms or edits the extracted fields.
5. Only the confirmed exercise becomes AI-eligible.

If a workout location changes and a planned exercise becomes incompatible, the original exercise remains visible as incompatible. The user may ask AI for compatible replacements and then choose one. Replacing it affects only the current unfinished workout; it does not modify the exercise library, template, other dates, or future cycles. The replacement does not inherit the original exercise's weight history.

## 5. Activity data

### Strength

Plans and logs are separate:

```text
ScheduledWorkout
└── PlannedExercise
    └── PlannedSet

WorkoutLog
└── ExerciseLog
    └── SetLog
```

Each planned and actual set can contain weight, unit, and repetitions. Rest time belongs to the planned exercise/set configuration. RPE is not stored.

The initial cycle may contain a weight only for the first occurrence of an exercise when an existing verified record is available. If no history exists, the weight is blank and the user enters the actual weight during training.

### Cardio

Store modality, planned duration, optional distance, optional pace/speed, and target intensity. Actual logs store completed duration and any available distance or pace/speed.

### Sport

Store sport name, planned duration, target intensity, and training focus. Actual logs store completed duration, intensity category, and notes.

## 6. Workout states and calendar behavior

The only workout statuses are:

```text
PLANNED | COMPLETED | CANCELLED
```

- Rescheduling changes `scheduledDate` and keeps `PLANNED`.
- Multiple workouts may exist on one date.
- Moving one workout never automatically moves another workout.
- Completing a workout stores both its scheduled date and `completedAt`.
- Completed workouts cannot be deleted, but their actual data can be edited.
- Cancelled workouts retain only their current status; cancellation history is not counted.

Manual extra-workout flow:

1. User chooses date, activity type, duration, and location.
2. AI generates a one-off workout.
3. User previews and edits it.
4. User confirms before the `PLANNED` record is created.

An extra workout does not modify the current four-week template. Its completion is reported separately from original-plan completion, but its completed data can be used as secondary evidence for future AI recommendations.

## 7. Backfill, overdue, and cycle closure

During a cycle, an overdue `PLANNED` workout remains `PLANNED` and is marked overdue in the UI. The user can:

- backfill it as completed, with an actual completion date and time required;
- reschedule it to a new date;
- cancel it.

The actual completion date/time must not be in the future and must not default silently to confirmation time.

Before the next cycle is generated:

1. The system lists every unresolved planned workout from the old cycle.
2. The user is reminded to register or resolve them.
3. Any unresolved workout is automatically changed to `CANCELLED` and remains part of the old cycle.
4. The old cycle is closed and its report snapshot becomes immutable.
5. A new cycle draft may then be generated.

An auto-cancelled workout can be restored only before the next cycle is generated. Restoring it changes it back to `PLANNED` and requires a new date. Once the next cycle exists, the old cycle is read-only.

If the cycle has zero completed workouts, the system does not generate a new cycle. It pauses and asks the user to reset goal, weekly days, duration, and default location. Historical cycles, logs, and exercises remain intact.

## 8. AI behavior

All AI outputs are structured JSON validated by the server. AI cannot reference another user's exercise, cannot use an incompatible location, cannot change historical records, and cannot directly insert an unreviewed plan into the calendar.

### Plan generation

The AI receives the user's goals, scheduling constraints, current location context, legal exercise pool, and activity-type rules. It returns a four-week draft. The user reviews, edits, and confirms before calendar insertion.

### Replacement generation

For a location-incompatible exercise, the AI returns compatible exercises from the legal pool and a replacement proposal containing sets, repetitions, rest, and any available initial weight. The user selects and confirms it. No RPE is returned.

### Weight recommendation

After a completed strength workout, the AI may recommend a weight for the next occurrence of the same exercise. The context contains:

- the most recent 3–5 same-exercise records;
- current-cycle summary;
- all-time best performance;
- current goal;
- the next workout's planned sets and repetitions.

The recommendation applies only to the next matching scheduled workout. The user may accept, modify, or reject it. Rejection does not automatically carry forward the previous weight.

### Cycle review

The review uses final saved plan parameters, not the original AI values, and compares them with actual logs. It includes objective data such as completion, cancellation, rescheduling, planned-versus-actual sets/repetitions/weight, and cardio data.

The user may optionally enter a cycle summary. If empty, the AI uses objective data only. If supplied, the summary influences both the review and the next-cycle draft. The raw text is not stored; only the AI-processed summary and conclusions are stored. The AI result is saved directly. The next-cycle draft still requires user review before calendar insertion.

If AI generation fails or returns invalid data, the server keeps the cycle data unchanged, does not insert a draft into the calendar, and shows a retryable error.

## 9. Core data model

```text
User
UserProfile
TrainingCycle
ScheduledWorkout
PlannedExercise
PlannedSet
WorkoutLog
ExerciseLog
SetLog
Exercise
AIRecommendation
CycleReviewSnapshot
```

Important fields:

```text
UserProfile:
  primaryGoal
  secondaryOutcome
  weeklyTrainingDays
  sessionDurationMinutes
  defaultLocation

ScheduledWorkout:
  cycleId
  activityType
  scheduledDate
  location
  durationMinutes
  status
  source: ORIGINAL | EXTRA
  completedAt

Exercise:
  ownerId nullable for system exercises
  name
  equipment
  targetMuscles
  movementPattern
  availableLocations
  aiEligible
```

## 10. Acceptance criteria

The MVP is acceptable when:

1. A user can generate, edit, confirm, and view a four-week calendar plan.
2. Every strength exercise shown for a workout is valid for that workout's location.
3. A user can manually add, reschedule, cancel, complete, and backfill workouts.
4. Backfilled completion always requires the actual date and time.
5. Cycle closure resolves all unresolved planned workouts into the original cycle.
6. Closed cycles cannot be edited after the next cycle is generated.
7. Strength logs preserve planned sets separately from actual sets.
8. Weight recommendations affect only the next matching workout after user action.
9. Optional review summaries behave correctly whether empty or supplied, without storing raw text.
10. A failed or invalid AI response cannot modify the calendar or historical records.
