# Validated AI plan drafts

## Boundary between AI and the server

The AI provider is an interchangeable dependency. `AiClient` accepts a
structured request and validates the provider's JSON with a Zod schema before
returning it to the plan service. The production implementation uses an
OpenAI-compatible `/chat/completions` endpoint; `FakeAiClient` is used by
tests and never makes a network request.

The server remains authoritative for:

- cycle ownership and `DRAFT` status;
- the four-week date range;
- exercise ownership and AI eligibility;
- strength exercise and set uniqueness;
- activation and calendar writes.

The model receives only the legal exercise pool. Its exercise names and
metadata claims are not trusted; the server reloads the exercise records and
adds authoritative metadata to the returned draft.

The profile context sent to the plan prompt includes the required training
preferences and required body fields: gender, age, height in centimeters, and
body weight in kilograms. These fields are planning context only; the prompt
does not authorize medical, calorie, or nutrition advice.

## Draft and confirmation flow

```text
POST /api/cycles
        |
        v
POST /api/ai/plans/:cycleId/generate
        |
        v
client reviews/edits PlanDraft
        |
        v
POST /api/ai/plans/:cycleId/confirm
        |
        v
one transaction: create workouts + planned exercises/sets + DRAFT -> ACTIVE
```

Generation does not insert `ScheduledWorkout` rows. The existing `DRAFT`
cycle is the persisted lifecycle container; the draft JSON is returned to the
client for review. Confirmation accepts the edited draft, validates all IDs
again, and writes the calendar only after validation succeeds.

If generation or confirmation validation fails, the cycle remains `DRAFT` and
the calendar remains unchanged. A future persistence model for resumable
server-side draft versions can be added without changing the `AiClient`
contract.

## Configuration

```text
AI_API_KEY=...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

The provider adapter uses `response_format: { type: "json_object" }`, but
structured output is still validated by the server. An absent key produces a
configuration error instead of silently using a fake provider in production.

## Endpoints

```text
POST /api/ai/plans/:cycleId/generate
POST /api/ai/plans/:cycleId/confirm
```

The confirm request body is the complete `PlanDraft` returned by the generate
endpoint, with user edits applied. This keeps the server stateless between
review steps and lets a future web or iOS client use the same contract.

The related exercise extraction, replacement, and next-weight recommendation
contracts are documented in `docs/development/ai-exercises.md`.
