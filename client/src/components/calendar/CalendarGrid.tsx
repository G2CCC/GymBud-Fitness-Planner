import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import type { ApiCycle } from "../../api/contracts";
import { WorkoutCard, type CalendarWorkout } from "./WorkoutCard";

export type CalendarGridProps = {
  cycle: ApiCycle;
  today?: string;
  onSelectWorkout: (workout: CalendarWorkout) => void;
};

function dateKey(value: Date): string { return value.toISOString().slice(0, 10); }

export function getMondayDateKey(value: string): string {
  const date = new Date(value + "T00:00:00.000Z");
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return dateKey(date);
}

export function CalendarGrid({ cycle, onSelectWorkout }: CalendarGridProps) {
  const workouts = new Map(cycle.workouts.map((workout) => [workout.id, workout]));
  const events = cycle.workouts.map((workout) => ({
    id: workout.id,
    title: workout.activityType,
    date: dateKey(new Date(workout.scheduledDate)),
    extendedProps: { workout },
  }));

  function renderEvent(content: EventContentArg) {
    const workout = content.event.extendedProps.workout as CalendarWorkout;
    return <WorkoutCard workout={workout} onSelect={onSelectWorkout} />;
  }

  function handleClick(info: EventClickArg) {
    const workout = workouts.get(info.event.id);
    if (workout) onSelectWorkout(workout);
  }

  return (
    <section aria-label="Weekly training calendar" className="grid gap-3">
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridWeek"
        firstDay={1}
        initialDate={getMondayDateKey(cycle.startDate.slice(0, 10))}
        dateIncrement={{ weeks: 1 }}
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        events={events}
        eventContent={renderEvent}
        eventClick={handleClick}
        height="auto"
        dayMaxEvents={4}
      />
    </section>
  );
}
