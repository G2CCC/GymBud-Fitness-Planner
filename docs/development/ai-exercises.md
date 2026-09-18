# AI exercise workflows

Task 7 adds three AI-assisted workflows without giving the model write access
to the calendar or training history.

## Custom exercise extraction

```text
POST /api/ai/exercises/extract
```

Request:

```json
{
  "name": "Reverse lunge",
  "description": "A bodyweight unilateral leg exercise"
}
```

The response is a metadata draft. It is not persisted. The client can let the
user edit the draft and then submit the final values to the existing
`POST /api/exercises` endpoint. Only that confirmed write creates a custom
exercise with `aiEligible = true`.

The server validates and normalizes the extracted equipment metadata before it
is returned. The draft remains unpersisted until the user confirms it through
the normal exercise endpoint.

## Compatible replacements

```text
POST /api/ai/workouts/:workoutId/replace
```

Request:

```json
{
  "exerciseId": "system-barbell-bench-press"
}
```

The service loads the unfinished strength workout and builds a candidate pool
from system exercises and the current user's confirmed AI-eligible exercises.
The AI may only return IDs from that pool. The response is a set of replacement
suggestions; it does not mutate the workout. A later client confirmation flow
can apply one replacement to this unfinished workout only. The exercise's
historical weight data is not copied to the replacement.

## Next-workout weight recommendation

```text
POST /api/ai/exercises/:exerciseId/weight
```

Request:

```json
{
  "nextWorkoutId": "workout-id"
}
```

The server creates a pending `AIRecommendation` after assembling a structured
context containing:

- at most the five latest completed records for the same exercise;
- the latest completed workout records without plan-source labels;
- a computed current-cycle summary;
- the all-time best in the selected weight unit;
  - the user's primary goal;
  - the next workout's planned sets, reps, and existing planned weights.

Raw cycle-review prompts are never copied into this context.

The user decides what to do with the recommendation:

```text
POST /api/ai/weight-recommendations/:recommendationId/decision
```

Accepted or modified decisions update only matching planned sets in the next
workout. A rejection changes the recommendation status but leaves an existing
planned weight unchanged; a blank planned weight stays blank. Historical
`WorkoutLog`, `ExerciseLog`, and `SetLog` rows are never updated by this flow.

## Ownership and lifecycle checks

Every service query filters by the current user. An AI exercise ID is accepted
only when it belongs to the system pool or the current user and is AI eligible.
Recommendations and decisions are allowed only while the workout belongs to the
current active cycle and no newer cycle exists.
