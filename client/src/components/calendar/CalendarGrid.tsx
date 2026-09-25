import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
} from "@fullcalendar/core";
import { WorkoutCard, type CalendarWorkout } from "./WorkoutCard";
import { getActivityDisplayName } from "../catalog/ActivityIdentity";

export type CalendarGridProps = {
  workouts: readonly CalendarWorkout[];
  initialDate: string;
  today?: string;
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

export function getMondayDateKey(value: string): string {
  const date = new Date(value + "T00:00:00.000Z");
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export function CalendarGrid({
  workouts,
  initialDate,
  today,
  onSelectWorkout,
  onVisibleRangeChange,
}: CalendarGridProps) {
  const workoutsById = new Map(workouts.map((workout) => [workout.id, workout]));
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

  function handleClick(info: EventClickArg) {
    const workout = workoutsById.get(info.event.id);
    if (workout) {
      onSelectWorkout(workout);
    }
  }

  function handleDatesSet(info: DatesSetArg) {
    onVisibleRangeChange(info.start, info.end, info.view.currentStart);
  }

  return (
    <section aria-label="Monthly training calendar" className="grid gap-3">
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        initialDate={initialDate}
        firstDay={1}
        fixedWeekCount={false}
        showNonCurrentDates
        headerToolbar={{ left: "prev", center: "title", right: "next today" }}
        datesSet={handleDatesSet}
        events={events}
        eventContent={renderEvent}
        eventClick={handleClick}
        height="auto"
        dayMaxEvents={4}
      />
    </section>
  );
}
