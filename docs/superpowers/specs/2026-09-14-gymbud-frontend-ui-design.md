# GymBud Frontend UI Design Specification

**Status:** Draft for user review
**Date:** 2026-09-14
**Decision:** Athletic Calm with controlled premium visual effects; no dark mode

## 1. Design decision

GymBud will use **Athletic Calm** as its first visual system:

- light theme only;
- calm green accents on warm neutral surfaces;
- clear information hierarchy;
- generous spacing and rounded cards;
- professional training data without making the whole product feel like a
  performance dashboard;
- restrained gradients, glass surfaces, and micro-interactions for a premium
  finish;
- responsive web first, with semantic structure that can be reproduced in a
  future iOS client.

The previously discussed Training Lab dark mode is explicitly out of scope for
this phase. The implementation should still use semantic design-token names so
that a dark theme can be added later without rewriting component markup.

## 2. Product experience goal

GymBud should feel like a reliable training partner that makes the next action
obvious:

1. open the app and immediately understand today's training;
2. see the current four-week cycle without reading a dense table;
3. start or complete a workout with minimal friction;
4. understand what has been completed, moved, cancelled, or needs attention;
5. receive the cycle review prompt only when the lifecycle rules make it due.

The visual system must support both strength-training details and simpler
CARDIO/SPORT records. Strength data can be detailed inside a workout screen,
but the dashboard should remain approachable for all activity types.

## 3. Visual language

### 3.1 Color roles

Components must reference semantic roles rather than hard-coded color names.
The initial light palette is:

| Token role | Initial value | Use |
|---|---|---|
| `color.background` | `#F3F5EF` | App canvas and page background |
| `color.surface` | `#FFFFFF` | Cards, panels, dialogs |
| `color.surfaceSubtle` | `#E1E8DC` | Navigation and secondary regions |
| `color.textPrimary` | `#17201B` | Main headings and important values |
| `color.textSecondary` | `#6A746C` | Supporting labels and metadata |
| `color.border` | `#DCE3DC` | Dividers, input borders, card outlines |
| `color.accent` | `#93C465` | Primary progress and selected state |
| `color.accentStrong` | `#77A85A` | Primary actions and emphasized links |
| `color.accentSoft` | `#C8E88C` | Active calendar day and soft highlights |
| `color.success` | `#4E8B62` | Completed state |
| `color.warning` | `#B9823C` | Attention and overdue state |
| `color.danger` | `#B85C55` | Cancellation or destructive action |

Status meaning must not rely on color alone. Every status badge includes text;
icons may be added when they improve scanning.

### 3.2 Typography

Use a system-first font stack so the web and future iOS client retain a native
feel without introducing an external font dependency:

```css
font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Typography hierarchy:

- page title: 28–32px, weight 700–800;
- section title: 18–22px, weight 700;
- card title: 15–17px, weight 700;
- body: 14–16px, weight 400–500;
- metadata: 12–13px, weight 500;
- numeric training metrics: use a heavier weight and tabular numerals when
  available.

The interface should use sentence case. All-caps labels are reserved for small
metadata such as `THIS WEEK` or `CYCLE PROGRESS`, not for user actions.

### 3.3 Shape, spacing, and depth

- base spacing unit: 4px;
- common spacing values: 8, 12, 16, 24, 32px;
- card radius: 16px;
- larger feature panel radius: 20–24px;
- button and input radius: 10–12px;
- use borders and surface contrast as the primary separation mechanism;
- use subtle shadows only for dialogs, menus, and elevated interactive cards;
- keep visual effects subordinate to content and actions.

### 3.4 Controlled premium effects

Premium effects are part of the first UI implementation, but each effect has a
limited purpose:

- **Gradients:** use one or two soft green gradients for the Today hero card,
  cycle progress, and selected empty states. Do not apply a gradient to every
  card or to dense data tables.
- **Glass surfaces:** use a translucent blurred surface only for sticky
  navigation, mobile bottom navigation, dialogs, and detail sheets. Main
  calendar cells and workout forms use solid surfaces so text and inputs remain
  readable.
- **Micro-interactions:** use short opacity/transform transitions for route
  changes, hover/focus feedback, button confirmation, card elevation, and the
  first progress-bar fill. Avoid continuous decorative loops, particles, 3D
  transforms, or animations that compete with data entry.
- **Fallbacks:** every glass effect must have an opaque fallback for browsers
  without `backdrop-filter`. Every animation must remain understandable when
  motion is reduced or disabled.
- **Performance:** prefer compositor-friendly `opacity` and `transform`; do
  not animate layout properties or apply expensive blur filters across large
  scrolling regions.

The effect names should be semantic, such as `hero-gradient`, `glass-surface`,
and `motion-progress-enter`, rather than tied to a specific page or color.

## 4. Information architecture

The first UI pass will organize the product around four primary destinations:

| Destination | Main purpose |
|---|---|
| Today | Show the next action and today's planned/completed workout |
| Calendar | Browse the four-week cycle and manually manage workouts |
| Progress | Review completion, training volume, and cycle summaries |
| Profile | Manage planning inputs, training location, and preferences |

On desktop, these destinations use a left navigation rail. On narrow screens,
they use a fixed bottom navigation bar with the same labels and icons. The
content hierarchy must not depend on the navigation shape, so the future iOS
client can use a native tab bar without changing the underlying information
architecture.

## 5. Core screen patterns

### 5.1 Today dashboard

The Today screen is the default landing page.

Order from top to bottom:

1. current date and short greeting;
2. primary card for the next workout;
3. compact weekly progress summary;
4. current cycle progress;
5. secondary actions such as viewing the calendar or adding an extra workout.

The primary action should be obvious:

- `Start workout` for a planned workout due today;
- `View workout` when the workout is already in progress or has a saved log;
- `Review cycle` when the cycle review is eligible.

### 5.2 Calendar

The calendar must make the following distinctions visible without opening a
detail page:

- `PLANNED`;
- `COMPLETED`;
- `CANCELLED`;
- overdue planned workout;
- original versus extra workout when that distinction is useful.

The month/week view should prioritize readable workout cards over showing every
possible calendar detail. Selecting a workout opens a detail drawer on desktop
and a full-screen sheet on mobile. Moving or cancelling a workout remains an
explicit action and must not silently modify other workouts.

### 5.3 Workout detail and log

The workout screen is action-oriented rather than report-oriented.

- show activity type, date, location, and planned duration first;
- for `STRENGTH`, show exercises grouped by exercise and sets grouped by set
  number;
- prefill planned values where appropriate, while keeping actual log fields
  separate;
- for `CARDIO` and `SPORT`, show the activity-specific fields without forcing
  strength-training concepts into the form;
- place `Complete workout` as the primary action;
- keep reschedule and cancel as secondary actions;
- when backfilling a workout, require actual completion date and time before
  submission.

### 5.4 Cycle review

The review screen should explain why the user is being asked to act:

1. show the cycle date range and objective summary;
2. show unresolved planned workouts that will be auto-cancelled when the review
   is submitted;
3. provide an optional user summary field;
4. show the AI processed summary and conclusions after generation;
5. offer next-cycle draft generation only when the objective summary marks the
   cycle as eligible.

The optional user summary is context for the AI request and is not presented as
permanent raw history in the UI.

## 6. Responsive behavior

Breakpoints are implementation details, but the behavior is fixed:

- **mobile:** single-column layout, bottom navigation, full-screen sheets,
  minimum 44px touch targets;
- **tablet:** single main column with wider cards and optional two-column detail
  regions;
- **desktop:** left navigation, centered content column, two-column layouts for
  dashboard summaries and workout detail where useful.

The design must remain usable at a 320px viewport width. The calendar may
switch from a seven-column grid to a stacked agenda when a grid becomes too
dense.

## 7. Frontend implementation architecture

The current client is a minimal React/Vite application without a component
library. The first UI implementation should use:

- Tailwind CSS v4 for layout, spacing, responsive utilities, and ordinary
  component styling;
- CSS custom properties for semantic design tokens;
- small CSS Modules or named effect classes for gradients, glass surfaces, and
  animation behavior;
- a small shared UI layer under `client/src/components/ui/`;
- page-level compositions under `client/src/pages/`;
- no large component framework that hides the product's interaction model.

Tailwind utility classes should not contain scattered raw hex values. The
design tokens remain the source of truth, and components expose semantic
variants such as `primary`, `secondary`, `completed`, and `cancelled`.

Recommended style structure:

```text
client/src/styles/
├── tokens.css
├── tailwind.css
├── effects.css
├── global.css
└── accessibility.css

client/src/components/ui/
├── AppShell/
├── Button/
├── Card/
├── Badge/
├── ProgressBar/
└── BottomNavigation/
```

The shared package continues to own domain enums and validation. It should not
own browser-specific CSS. The semantic token names and visual rules in this
document are the contract that a future iOS design-token file can mirror.

Tailwind classes are not expected to transfer directly to iOS. If the future
client uses SwiftUI, the same semantic tokens and component behavior will be
implemented with native SwiftUI primitives. If it uses React Native, a
Tailwind-compatible layer may be evaluated later, but web-only layout and
effects must not become product-domain dependencies.

## 8. Accessibility and interaction rules

- keyboard focus must be visible on every interactive element;
- text and controls must maintain sufficient contrast against their surfaces;
- controls must expose accessible names and status text;
- touch targets must be at least 44px on mobile;
- status is communicated with text and, where useful, an icon—not color alone;
- respect `prefers-reduced-motion`;
- loading, disabled, empty, and error states must be designed alongside the
  successful state;
- destructive actions such as cancellation require a clear confirmation step.

## 9. Out of scope for this phase

- dark mode;
- native iOS implementation;
- nutrition, body measurements, social features, or messaging;
- custom illustration system;
- large decorative animation, continuous particles, 3D effects, and
  gamification;
- redesign of the server domain model;
- changing the existing cycle lifecycle or workout persistence rules.

## 10. Acceptance criteria for the UI phase

The implementation can be considered complete when:

1. the default route renders the GymBud shell and Today experience;
2. desktop and mobile navigation expose the same four destinations;
3. the light palette uses semantic tokens rather than scattered hex values;
4. calendar and workout states are visually distinguishable and accessible;
5. strength, cardio, and sport forms each show only relevant fields;
6. the responsive layout works at 320px, tablet, and desktop widths;
7. loading, empty, error, and disabled states are present for API-backed views;
8. gradients and glass surfaces have readable fallbacks;
9. reduced-motion behavior is implemented for animated states;
10. component tests cover key interactive states and the production build
    passes.

This document does not authorize implementation of the UI yet. It is the design
baseline for user review before the implementation plan is written.
