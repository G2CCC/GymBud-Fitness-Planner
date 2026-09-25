import type { ApiActivityOption } from "../../api/contracts";
import { ActivityIcon } from "./ActivityIcon";

export type ActivityOptionPickerProps = {
  options: ApiActivityOption[];
  value: string;
  onChange: (activityOptionId: string) => void;
  label?: string;
};

export function ActivityOptionPicker({
  options,
  value,
  onChange,
  label = "Activity option",
}: ActivityOptionPickerProps) {
  return (
    <fieldset className="grid gap-2 sm:col-span-3">
      <legend className="text-xs font-semibold text-gymbud-ink">{label}</legend>
      {options.length === 0 ? (
        <p className="text-sm text-gymbud-muted">No catalog activities are available.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option) => {
            const selected = option.id === value;
            return (
              <button
                className={`focus-ring flex min-h-14 items-center gap-3 rounded-[var(--radius-control)] border p-3 text-left transition ${
                  selected
                    ? "border-gymbud-ink bg-gymbud-ink text-white"
                    : "border-gymbud-border bg-gymbud-surface text-gymbud-ink"
                }`}
                type="button"
                key={option.id}
                aria-pressed={selected}
                onClick={() => onChange(option.id)}
              >
                <ActivityIcon
                  iconKey={option.iconKey}
                  label={option.name}
                  size={22}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {option.name}
                  </span>
                  {option.description ? (
                    <span className="block truncate text-xs opacity-75">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
