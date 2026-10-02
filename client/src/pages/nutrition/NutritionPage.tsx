import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  nutritionLocalDate,
  type FoodEntry,
  type MealType,
  type NutritionDayDto,
} from "@fitness/shared";
import { ApiRequestError, getProfile } from "../../api/client";
import * as api from "../../api/nutrition";
import { DailyNutritionSummary } from "../../components/nutrition/DailyNutritionSummary";
import {
  MealSection,
  mealLabels,
} from "../../components/nutrition/MealSection";
import {
  FoodEntryEditor,
  type FoodEditValue,
} from "../../components/nutrition/FoodEntryEditor";
export function NutritionPage() {
  const [date, setDate] = useState(""),
    [today, setToday] = useState(""),
    [day, setDay] = useState<NutritionDayDto | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [editor, setEditor] = useState<{
      meal: MealType;
      entry?: FoodEntry;
    } | null>(null),
    [emptyConfirmation, setEmptyConfirmation] = useState(false);
  useEffect(() => {
    let active = true;
    void getProfile()
      .then((profile) => {
        if (!active) return;
        if (!profile) {
          setLoading(false);
          setError("Save your profile before recording nutrition.");
          return;
        }
        const localToday = nutritionLocalDate(
          new Date(),
          profile.recordingTimezone ?? "UTC",
        );
        setToday(localToday);
        setDate(localToday);
      })
      .catch((e) => {
        if (active) {
          setError(e instanceof Error ? e.message : "Unable to load profile");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!date) {
      setDay(null);
      return;
    }
    let active = true;
    setLoading(true);
    setDay(null);
    setError(null);
    setEmptyConfirmation(false);
    void api
      .getNutritionDay(date)
      .then((result) => {
        if (active) setDay(result);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Unable to load this day");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, reload]);
  async function refresh() {
    const result = await api.getNutritionDay(date);
    setDay(result);
    return result;
  }
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) {
        await refresh();
        throw new Error(
          "Day refreshed. Your inputs are preserved; review and save again.",
        );
      }
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function save(value: FoodEditValue) {
    if (!day) return;
    const { clientRequestId, ...input } = value;
    await mutate(() =>
      editor?.entry
        ? api.updateFoodEntry(editor.entry.id, {
            ...input,
            expectedRevision: day.revision,
          })
        : api.addFoodEntry({
            ...input,
            foodId: input.foodId!,
            clientRequestId,
            date,
            expectedRevision: day.revision,
          }),
    );
    setEditor(null);
  }
  async function remove(entry: FoodEntry) {
    if (!day) return;
    try {
      await mutate(() => api.deleteFoodEntry(entry.id, day.revision));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete entry");
    }
  }
  async function complete() {
    if (!day) return;
    if (!day.completedAt && !day.entries.length && !emptyConfirmation) {
      setEmptyConfirmation(true);
      return;
    }
    try {
      await mutate(() =>
        api.setNutritionDayCompletion(date, !day.completedAt, day.revision),
      );
      setEmptyConfirmation(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to confirm diary");
    }
  }
  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 pb-28 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gymbud-muted">
            Food & training
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Nutrition</h1>
          <p className="mt-2 text-sm text-gymbud-muted">
            Track your meals against a fixed daily target.
          </p>
        </div>
        <label className="grid gap-1 text-sm">
          Diary date
          <input
            type="date"
            className="focus-ring min-h-11 rounded-lg border border-gymbud-border bg-gymbud-surface px-3"
            value={date}
            max={today || undefined}
            disabled={busy || !!editor}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </header>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-gymbud-border p-4"
        >
          <p>{error}</p>
          <div className="mt-2 flex gap-4">
            <button
              className="underline"
              onClick={() => setReload((n) => n + 1)}
            >
              Retry
            </button>
            <Link className="underline" to="/profile">
              Profile
            </Link>
          </div>
        </div>
      ) : null}
      {loading ? <p role="status">Loading nutrition…</p> : null}
      {day && !loading ? (
        <>
          <DailyNutritionSummary day={day} />
          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(mealLabels) as MealType[]).map((meal) => (
              <MealSection
                key={meal}
                meal={meal}
                entries={day.entries.filter((e) => e.mealType === meal)}
                disabled={busy}
                onAdd={() => setEditor({ meal })}
                onEdit={(entry) => setEditor({ meal, entry })}
                onDelete={(entry) => void remove(entry)}
              />
            ))}
          </div>
          <section className="grid gap-3 rounded-2xl border border-gymbud-border bg-gymbud-surface p-5">
            <h2 className="text-lg font-semibold">
              Finished recording this day?
            </h2>
            <p className="text-sm text-gymbud-muted">
              Only days you confirm as complete count toward average daily
              intake in your cycle report. Changing food entries reopens the
              day.
            </p>
            {emptyConfirmation ? (
              <p role="alert" className="text-sm">
                No foods are logged. Check for missed meals before confirming an
                empty day.
              </p>
            ) : null}
            <button
              className="button-primary focus-ring w-fit"
              disabled={busy}
              onClick={() => void complete()}
            >
              {day.completedAt
                ? "Reopen diary"
                : emptyConfirmation
                  ? "Confirm empty day"
                  : "Mark diary complete"}
            </button>
            <p className="text-xs text-gymbud-muted">
              Recording timezone: {day.timezone}
            </p>
          </section>
        </>
      ) : null}
      {editor ? (
        <FoodEntryEditor
          meal={editor.meal}
          entry={editor.entry}
          onSave={save}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        />
      ) : null}
    </main>
  );
}
