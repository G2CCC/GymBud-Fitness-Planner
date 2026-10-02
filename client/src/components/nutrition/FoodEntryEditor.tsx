import { useEffect, useRef, useState } from "react";
import {
  calculateFoodPortion,
  type FoodDto,
  type FoodEntry,
  type FoodUnit,
  type MealType,
  type EntryPatch,
} from "@fitness/shared";
import { FoodSearch } from "./FoodSearch";
import { mealLabels } from "./MealSection";
import { nutritionNumber } from "./DailyNutritionSummary";
export type FoodEditValue = Omit<EntryPatch, "expectedRevision"> & {
  foodId?: string;
  clientRequestId: string;
};
export function FoodEntryEditor({
  meal,
  entry,
  onSave,
  onClose,
}: {
  meal: MealType;
  entry?: FoodEntry;
  onSave: (value: FoodEditValue) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    intent = useRef({ key: "", id: crypto.randomUUID() });
  const [food, setFood] = useState<FoodDto | null>(null),
    [searching, setSearching] = useState(!entry),
    [quantity, setQuantity] = useState(String(entry?.quantity ?? 100)),
    [unit, setUnit] = useState<FoodUnit>(entry?.unit ?? "g"),
    [portionId, setPortionId] = useState(""),
    [mealType, setMeal] = useState(meal),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const el = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    if (typeof el.showModal === "function") el.showModal();
    else el.setAttribute("open", "");
    el.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      el.close?.();
      previous?.focus();
    };
  }, []);
  const portion = food?.portions.find((p) => p.id === portionId);
  const snapshot = food
    ? {
        name: food.name,
        per100g: food.per100g,
        unitGrams: portion?.unitGrams ?? null,
      }
    : entry?.snapshot;
  let preview: ReturnType<typeof calculateFoodPortion> | null = null;
  try {
    if (snapshot)
      preview = calculateFoodPortion(snapshot, unit, Number(quantity));
  } catch {
    /* Invalid input stays editable. */
  }
  async function save() {
    if (!snapshot || !preview || saving) return;
    const value = {
      mealType,
      quantity: Number(quantity),
      unit,
      ...(food ? { foodId: food.id, ...(portionId ? { portionId } : {}) } : {}),
    };
    const key = JSON.stringify(value);
    if (intent.current.key !== key)
      intent.current = { key, id: crypto.randomUUID() };
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...value, clientRequestId: intent.current.id });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save food. Retry with your inputs below.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="food-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-gymbud-border bg-gymbud-surface p-5 text-gymbud-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="food-editor-title" className="text-xl font-semibold">
          {entry ? "Edit food" : "Add food"}
        </h2>
        <button
          className="focus-ring min-h-11 px-3"
          disabled={saving}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
      {searching ? (
        <FoodSearch
          onSelect={(selected) => {
            setFood(selected);
            setPortionId(selected.portions[0]?.id ?? "");
            setUnit("g");
            setSearching(false);
          }}
        />
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h3 className="font-semibold">{snapshot?.name}</h3>
          <button
            type="button"
            disabled={saving}
            className="w-fit text-sm underline"
            onClick={() => setSearching(true)}
          >
            Choose another food
          </button>
          <label className="grid gap-1 text-sm">
            Meal
            <select
              className="min-h-11 rounded-lg border border-gymbud-border bg-gymbud-surface px-3"
              disabled={saving}
              value={mealType}
              onChange={(e) => setMeal(e.target.value as MealType)}
            >
              {Object.entries(mealLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              Quantity
              <input
                autoFocus
                required
                type="number"
                min="0.0001"
                max="100000"
                step="any"
                className="focus-ring min-h-11 w-full rounded-lg border border-gymbud-border bg-gymbud-surface px-3"
                value={quantity}
                disabled={saving}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Unit
              <select
                className="min-h-11 rounded-lg border border-gymbud-border bg-gymbud-surface px-3"
                disabled={saving}
                value={unit}
                onChange={(e) => setUnit(e.target.value as FoodUnit)}
              >
                <option value="g">g</option>
                {snapshot?.unitGrams ? <option value="ea">ea</option> : null}
              </select>
            </label>
          </div>
          {unit === "ea" && food ? (
            <label className="grid gap-1 text-sm">
              Each size
              <select
                value={portionId}
                disabled={saving}
                className="min-h-11 rounded-lg border border-gymbud-border bg-gymbud-surface px-3"
                onChange={(e) => setPortionId(e.target.value)}
              >
                {food.portions.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {unit === "ea" ? (
            <p className="text-sm text-gymbud-muted">
              1 ea = {snapshot?.unitGrams} g edible weight{" "}
              {food ? "(USDA portion)" : "(saved portion)"}
            </p>
          ) : null}
          {preview ? (
            <p className="rounded-lg bg-gymbud-background p-3 text-sm">
              {nutritionNumber(preview.totals.kcal)} kcal · P{" "}
              {nutritionNumber(preview.totals.proteinG)} g · C{" "}
              {nutritionNumber(preview.totals.carbsG)} g · F{" "}
              {nutritionNumber(preview.totals.fatG)} g
            </p>
          ) : (
            <p>Enter a positive quantity to preview nutrition.</p>
          )}
          {error ? (
            <p role="alert" className="text-sm text-gymbud-danger">
              {error}
            </p>
          ) : null}
          <button
            disabled={saving || !preview}
            className="button-primary focus-ring"
            type="submit"
          >
            {saving ? "Saving…" : "Save food"}
          </button>
        </form>
      )}
    </dialog>
  );
}
