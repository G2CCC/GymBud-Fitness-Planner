import type { FoodEntry, MealType } from "@fitness/shared";
import { nutritionNumber } from "./DailyNutritionSummary";
export const mealLabels: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};
export function MealSection({
  meal,
  entries,
  disabled,
  onAdd,
  onEdit,
  onDelete,
}: {
  meal: MealType;
  entries: FoodEntry[];
  disabled: boolean;
  onAdd: () => void;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (entry: FoodEntry) => void;
}) {
  const label = mealLabels[meal];
  return (
    <section className="rounded-2xl border border-gymbud-border bg-gymbud-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{label}</h2>
        <button
          type="button"
          className="focus-ring min-h-11 rounded-lg px-3 text-sm font-semibold text-gymbud-accent-strong"
          disabled={disabled}
          onClick={onAdd}
        >
          Add to {label}
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-gymbud-muted">No foods logged</p>
      ) : (
        <ul className="mt-2 divide-y divide-gymbud-border">
          {entries.map((e) => (
            <li key={e.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-medium">{e.snapshot.name}</p>
                <p className="text-sm text-gymbud-muted">
                  {nutritionNumber(e.quantity)} {e.unit} ·{" "}
                  {nutritionNumber(e.totals.kcal)} kcal
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="focus-ring min-h-11 px-2 text-sm underline"
                  disabled={disabled}
                  onClick={() => onEdit(e)}
                  aria-label={"Edit " + e.snapshot.name}
                >
                  Edit
                </button>
                <button
                  className="focus-ring min-h-11 px-2 text-sm text-gymbud-danger underline"
                  disabled={disabled}
                  onClick={() => onDelete(e)}
                  aria-label={"Delete " + e.snapshot.name}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
