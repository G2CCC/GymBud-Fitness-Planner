# GymBud Calendar and Global Visual Theme Design

**Date:** 2026-09-23  
**Status:** Design proposal for review  
**Scope:** Calendar information architecture, Today removal, and application-wide visual theme

## 1. Goal

Make Calendar the authenticated user's primary workspace and align the entire
GymBud product with the approved Calendar visual direction: warm white surfaces,
deep navy text, emerald primary actions, and blue/violet activity accents.

The redesign must change how the user navigates and reads scheduled workouts
without changing the existing workout, weekly-cycle, review, AI confirmation,
authentication, or logging rules.

## 2. Current state

- The authenticated shell currently exposes Today, Calendar, Progress, and
  Profile in both desktop and mobile navigation.
- Authenticated redirects from the landing route and auth page point to
  `/today`.
- Today is a complete page with its own view-model, loading states, cycle
  summaries, and workout actions.
- Calendar uses FullCalendar's `dayGridWeek` view and loads the current cycle
  through `/cycles/current`.
- The design tokens currently use a pale green background and lime accent.
- Shared CSS utilities such as `.button-primary`, `.glass-surface`, and the
  gradient classes already provide a suitable central styling seam.

## 3. Product behavior

### 3.1 Navigation and routes

- Remove Today from desktop and mobile primary navigation.
- Authenticated `/` redirects to `/calendar`.
- Login and signup success redirects go to `/calendar`.
- Remove the independent `/today` route and Today page imports after all
  navigation and test references are migrated.
- Keep workout, onboarding, review, progress, and profile routes unchanged.
- Keep the Calendar page's `Today` control only as a utility that jumps the
  displayed month to the user's current local month; it is not a page.

The primary navigation remains Calendar, Progress, and Profile. Onboarding and
review remain contextual flows rather than primary navigation items.

### 3.2 Monthly Calendar

Calendar uses FullCalendar's `dayGridMonth` view with:

- Monday as the first day of the week;
- one displayed month at a time;
- previous/next month controls;
- a current-month jump control;
- seven columns ordered Monday through Sunday;
- month cells that remain usable for keyboard and screen-reader users;
- multiple workouts stacked in one date cell;
- muted adjacent-month dates for grid alignment, without making them the focus
  of the current page.

The calendar should read from a URL month parameter such as
`/calendar?month=2026-09` so refresh, browser navigation, and shared state do
not silently return to a different month. The selected workout remains local
state in the first implementation; a shareable workout query parameter is not
required yet.

### 3.3 Workout events

Event color represents activity type:

| Activity | Accent |
| --- | --- |
| Strength | Emerald |
| Cardio | Blue |
| Sport | Violet |

Status must remain visible independently of activity color:

- Planned: solid type accent and normal text;
- Completed: check indicator and softer background;
- Cancelled: muted/struck-through treatment with a danger indicator;
- Overdue planned workouts: warning indicator without changing their state.

Each event is a real button or FullCalendar event target, not a clickable
non-semantic container. Its accessible name includes activity, date, and
status.

### 3.4 Workout details

Clicking an event opens a right-side details drawer on desktop. The drawer
contains:

- date and status;
- activity type and duration;
- planned exercise/set information when available;
- a link or action to open the existing workout page;
- existing valid actions such as start, reschedule, cancel, or view history;
- close button, Escape handling, and focus-safe behavior.

On narrow screens the drawer becomes a bottom sheet or full-screen panel. The
calendar remains the source of truth; the drawer must not duplicate workout
state-machine rules in the client.

## 4. Calendar data contract

The current-cycle endpoint is not sufficient for a month view because weekly
cycles and historical cycles can cross month boundaries. Add a user-scoped
range endpoint:

```text
GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
```

The server queries `ScheduledWorkout` by authenticated `userId` and scheduled
date range, including planned details required by the drawer. It returns a
calendar summary collection ordered by date and creation time. The endpoint
must include completed and cancelled historical workouts so the monthly view is
an honest record, and must not expose another user's records.

The client uses the visible month/grid range for the request, while the
existing `GET /api/workouts/:workoutId` remains the detailed workout source.
The shared API contract owns the response types. No Prisma or server module is
imported into the client.

## 5. Global visual system

The visual system remains light-only and uses semantic CSS variables so the
future mobile client can reuse the design vocabulary without copying web
components.

### 5.1 Target tokens

| Token | Target direction | Example value |
| --- | --- | --- |
| Background | soft warm white | `#F7F9F8` |
| Surface | pure white | `#FFFFFF` |
| Surface muted | very light slate | `#F1F4F5` |
| Border | cool pale slate | `#E1E7EA` |
| Ink | deep navy | `#10213F` |
| Muted | slate blue-gray | `#5E6B80` |
| Accent | emerald | `#119B61` |
| Accent strong | deep emerald | `#087A4A` |
| Accent soft | pale mint | `#DDF5E9` |
| Cardio | clear blue | `#2B7DE9` |
| Sport | violet | `#7355D8` |
| Success | emerald | `#138A5B` |
| Warning | amber | `#B7791F` |
| Danger | muted red | `#C05656` |

The exact values may be adjusted slightly during browser QA for contrast, but
the semantic roles and visual relationships must remain stable.

### 5.2 Global application of the theme

Update the central token and Tailwind theme files first. Migrate hard-coded
green/lime values and repeated status styles to semantic utilities where they
are part of the shared UI language.

Apply the palette consistently to:

- landing page hero, preview card, feature cards, CTA section, and footer;
- authentication and onboarding forms;
- shell sidebar, mobile navigation, links, buttons, and focus rings;
- Calendar cells, activity events, drawer, empty states, and action forms;
- workout detail/logging screens;
- progress and review cards;
- profile and settings forms;
- loading, error, success, warning, and cancellation messages.

The landing page's hero preview should visually reinforce Calendar rather than
Today: it may show a small month-grid/calendar preview with emerald, blue, and
violet event chips while preserving the existing marketing copy and routes.

Use restrained gradients only where they support hierarchy. Replace the old
lime-heavy gradients with white-to-mint or white-to-slate treatments. Avoid
introducing dark mode, photographs, new brand marks, or unrelated layout
changes in this pass.

## 6. Proposed implementation units

### Client

- `client/src/App.tsx`: remove Today navigation and update shell layout.
- `client/src/router.tsx`: update authenticated redirects and remove Today
  route.
- `client/src/pages/auth/AuthPage.tsx`: redirect successful auth to Calendar.
- `client/src/pages/calendar/CalendarPage.tsx`: own month state, loading/error
  states, event selection, and details drawer composition.
- `client/src/components/calendar/CalendarGrid.tsx`: switch to month view and
  render calendar events.
- `client/src/components/calendar/WorkoutCard.tsx`: type/status visual states
  and accessible event presentation.
- Add a focused details drawer component under
  `client/src/components/calendar/`.
- `client/src/api/contracts.ts` and `client/src/api/client.ts`: add the calendar
  range response and request helper.
- `client/src/styles/tokens.css`, `tailwind.css`, `global.css`, and
  `effects.css`: implement the semantic theme.
- `client/src/pages/landing/LandingPage.tsx`: align the marketing preview and
  surfaces with the new theme.
- Delete Today-only client modules after tests no longer reference them.

### Server and shared

- Add a calendar service and authenticated range route.
- Add shared calendar response types and date-range validation.
- Add service/integration tests for date boundaries, user scoping, status
  inclusion, and month transitions.

## 7. Testing and acceptance

### Route and UI tests

- Authenticated landing redirect targets `/calendar`.
- Auth success redirects target `/calendar`.
- Desktop and mobile navigation contain no Today item.
- Calendar renders Monday through Sunday in month view.
- Previous/next and Today controls update the displayed month.
- Clicking an event opens the correct details drawer.
- Closing the drawer does not mutate the workout.
- Workout type and status styles remain distinguishable.
- Landing, auth, onboarding, calendar, workout, progress, review, and profile
  screens render with the new semantic tokens.

### Server and shared tests

- Calendar range validation rejects invalid or reversed dates.
- Range queries include records at both boundaries.
- Results are limited to the authenticated user.
- Completed and cancelled workouts are returned.
- Existing workout/cycle/AI tests remain unchanged and pass.

### Verification commands

```text
npm test
npm run typecheck
npm run build --workspace @fitness/client
npm run build --workspace @fitness/server
```

## 8. Non-goals and preserved rules

- No changes to workout statuses: `PLANNED`, `COMPLETED`, `CANCELLED`.
- No changes to weekly cycle length or review logic.
- No changes to AI plan generation, validation, confirmation, or weight
  recommendations.
- No changes to planned-versus-actual workout logging.
- No changes to timezone/date business rules.
- No new nutrition, social, wearable, or dark-mode features.
- No automatic rescheduling or silent mutation when browsing the calendar.

