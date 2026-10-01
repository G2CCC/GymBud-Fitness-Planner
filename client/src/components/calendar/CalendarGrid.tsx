import type { KeyboardEvent } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import type {
  DatesSetArg,
  DayCellContentArg,
  EventClickArg,
  EventContentArg,
} from "@fullcalendar/core";
import { WorkoutCard, type CalendarWorkout } from "./WorkoutCard";
import { getActivityDisplayName } from "../catalog/ActivityIdentity";

export type CalendarGridProps = {
  workouts: readonly CalendarWorkout[];
  initialDate: string;
  today?: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectWorkout: (workout: CalendarWorkout) => void;
  onVisibleRangeChange: (
    start: Date,
    endExclusive: Date,
    currentStart: Date,
  ) => void;
};

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAgendaDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

export function getMondayDateKey(value: string): string {
  const date = new Date(value + "T00:00:00.000Z");
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function handleDateKeyDown(
  event: KeyboardEvent<HTMLSpanElement>,
  date: string,
  onSelectDate: (date: string) => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    onSelectDate(date);
  }
}

export function CalendarGrid({
  workouts,
  initialDate,
  today = new Date().toISOString().slice(0, 10),
  selectedDate,
  onSelectDate,
  onSelectWorkout,
  onVisibleRangeChange,
}: CalendarGridProps) {
  const workoutsById = new Map(workouts.map((workout) => [workout.id, workout]));
  const workoutsByDate = new Map<string, CalendarWorkout[]>();
  for (const workout of workouts) {
    const key = dateKey(workout.scheduledDate);
    const onDate = workoutsByDate.get(key) ?? [];
    onDate.push(workout);
    workoutsByDate.set(key, onDate);
  }

  const events = workouts.map((workout) => ({
    id: workout.id,
    title: getActivityDisplayName(workout.activityType, workout.activityOption),
    date: dateKey(workout.scheduledDate),
    allDay: true,
    extendedProps: { workout },
  }));

  function renderEvent(content: EventContentArg) {
    const workout = content.event.extendedProps.workout as CalendarWorkout;
    return <WorkoutCard workout={workout} today={today} onSelect={onSelectWorkout} />;
  }

  function renderDayCell(content: DayCellContentArg) {
    const key = localDateKey(content.date);
    const dayWorkouts = workoutsByDate.get(key) ?? [];
    const activityTypes = [...new Set(dayWorkouts.map((workout) => workout.activityType))];

    return (
      <span
        className="calendar-date-control"
        role="button"
        tabIndex={0}
        aria-label={`View workouts on ${key}`}
        aria-pressed={selectedDate === key}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelectDate(key);
        }}
        onKeyDown={(event) => handleDateKeyDown(event, key, onSelectDate)}
      >
        <span className="calendar-date-control__number">{content.dayNumberText}</span>
        <span className="calendar-date-control__markers" aria-hidden="true">
          {activityTypes.slice(0, 3).map((activityType) => (
            <span
              key={activityType}
              className={`calendar-date-marker calendar-date-marker--${activityType.toLowerCase()}`}
            />
          ))}
          {dayWorkouts.length > activityTypes.length ? (
            <span className="calendar-date-control__count">{dayWorkouts.length}</span>
          ) : null}
        </span>
      </span>
    );
  }

  function getDateCellClassNames(content: DayCellContentArg) {
    const key = localDateKey(content.date);
    return [
      "calendar-day-cell",
      key === selectedDate ? "calendar-day-cell--selected" : "",
      key === dateKey(today) ? "calendar-day-cell--today" : "",
    ].filter(Boolean);
  }

  function handleClick(info: EventClickArg) {
    const workout = workoutsById.get(info.event.id);
    if (workout) {
      onSelectDate(dateKey(workout.scheduledDate));
      onSelectWorkout(workout);
    }
  }

  function handleDatesSet(info: DatesSetArg) {
    onVisibleRangeChange(info.start, info.end, info.view.currentStart);
  }

  const selectedWorkouts = workoutsByDate.get(selectedDate) ?? [];

  return (
    <section aria-label="Monthly training calendar" className="calendar-grid-shell">
      <div
        className="calendar-month-surface gymbud-calendar"
        data-testid="calendar-month-surface"
      >
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          initialDate={initialDate}
          firstDay={1}
          fixedWeekCount={false}
          showNonCurrentDates
          headerToolbar={{ left: "title", center: "", right: "prev,next today" }}
          datesSet={handleDatesSet}
          dayCellContent={renderDayCell}
          dayCellClassNames={getDateCellClassNames}
          events={events}
          eventContent={renderEvent}
          eventClick={handleClick}
          height="auto"
          dayMaxEvents={3}
        />
      </div>

      <section
        aria-label="Workouts for selected date"
        className="calendar-day-agenda"
        data-testid="selected-day-agenda"
      >
        <header className="calendar-day-agenda__header">
          <div>
            <p className="calendar-day-agenda__eyebrow">Selected day</p>
            <h2>{formatAgendaDate(selectedDate)}</h2>
          </div>
          <span className="calendar-day-agenda__count">
            {selectedWorkouts.length} {selectedWorkouts.length === 1 ? "workout" : "workouts"}
          </span>
        </header>

        {selectedWorkouts.length > 0 ? (
          <div className="calendar-day-agenda__workouts">
            {selectedWorkouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                today={today}
                onSelect={onSelectWorkout}
              />
            ))}
          </div>
        ) : (
          <div className="calendar-day-agenda__empty">
            <span className="calendar-day-agenda__empty-mark" aria-hidden="true" />
            <div>
              <p>No workouts planned</p>
              <span>Choose another date or add a session to this day.</span>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
