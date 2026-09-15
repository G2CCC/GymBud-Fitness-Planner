# Unified Planned Workouts and Profile Context Design

**Status:** Approved for implementation on 2026-09-15

## Goal

Simplify the workout domain so every calendar workout is a plan without a source classification, and add optional user body context to AI-generated training plans.

## Decisions

1. WorkoutSource is removed completely. ScheduledWorkout no longer stores whether a workout came from AI or from the user.
2. Existing rows that currently use EXTRA remain valid scheduled workouts; the migration removes the source column without deleting workouts.
3. User-created workouts and AI-created workouts follow the same calendar and logging behavior.
4. UserProfile adds nullable gender, age, heightCm, and weightKg fields.
5. The profile stores height and body weight in normalized metric units. Existing workout-set weight units remain unchanged.
6. AI plan prompts include only body fields that are present. Missing profile fields do not block plan generation.
7. Body fields are planning context only. This phase does not add medical, calorie, BMI, or nutrition recommendations.
8. Weekly review aggregation and fixed four-cycle review batches are separate follow-up work. This phase removes source-dependent review behavior only where required for the new model to compile.

## Data model

TrainingCycle continues to own ScheduledWorkout records. A scheduled workout is a plan regardless of whether the user created it or AI generated it. Actual completion remains in WorkoutLog, ExerciseLog, and SetLog.

The profile fields use these normalized shapes:

- gender: nullable enum value;
- age: nullable integer;
- heightCm: nullable number;
- weightKg: nullable number.

The initial validation range is:

- age: 13 through 100;
- height: 50 through 250 cm;
- body weight: 20 through 350 kg.

These limits protect data quality without requiring the new fields for users who do not want to provide them.

## Migration

The Prisma migration removes the WorkoutSource enum and the ScheduledWorkout.source column. It does not delete or rewrite scheduled workout records. The existing source value is no longer used by application code.

The migration adds nullable profile columns so existing users remain valid. No existing profile receives fabricated demographic values.

## AI prompt behavior

The plan prompt includes the normalized profile context:

```
json
{
  "age": 27,
  "gender": "MALE",
  "heightCm": 178,
  "weightKg": 82
}
```

The prompt builder omits fields whose values are null. The server validates the final AI response exactly as before; profile context never grants the model permission to create invalid exercises, locations, dates, or activity details.

## Out of scope for this phase

- weekly training-volume aggregation;
- current-cycle manual review;
- four-cycle review prompts;
- rolling or fixed four-cycle review windows;
- onboarding manual/AI choice UI;
- Supabase Auth;
- Progress and Today pages.

## Acceptance criteria

- No application type, Prisma model, API contract, or review input refers to WorkoutSource, ORIGINAL, MANUAL, or EXTRA.
- Existing scheduled workout records remain queryable after migration.
- Profile GET/PUT can read and validate the four new fields.
- AI plan prompt tests prove supplied body context is included and absent optional fields do not block the request.
- Shared tests, typecheck, client build, and the available test suite pass.
