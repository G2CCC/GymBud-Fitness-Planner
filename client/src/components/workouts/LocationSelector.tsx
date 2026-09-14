import { locations, type Location } from "@fitness/shared";

export type LocationSelectorProps = {
  value: Location;
  onChange: (location: Location) => void;
};

export function LocationSelector({
  value,
  onChange,
}: LocationSelectorProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
      Training location
      <select
        className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3 text-gymbud-ink"
        value={value}
        onChange={(event) => onChange(event.target.value as Location)}
      >
        {locations.map((location) => (
          <option key={location} value={location}>
            {location === "GYM" ? "Gym" : "Home"}
          </option>
        ))}
      </select>
    </label>
  );
}
