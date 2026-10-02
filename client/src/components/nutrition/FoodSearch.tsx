import { useEffect, useRef, useState } from "react";
import type { FoodDto } from "@fitness/shared";
import { searchFoods } from "../../api/nutrition";
export function FoodSearch({
  onSelect,
}: {
  onSelect: (food: FoodDto) => void;
}) {
  const [query, setQuery] = useState(""),
    [items, setItems] = useState<FoodDto[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setItems([]);
    setCursor(null);
    setBusy(true);
    setError(null);
    const timer = setTimeout(() => {
      void searchFoods(query)
        .then((result) => {
          if (generation.current === current) {
            setItems(result.items);
            setCursor(result.nextCursor);
          }
        })
        .catch(() => {
          if (generation.current === current)
            setError("Food search failed. Please retry.");
        })
        .finally(() => {
          if (generation.current === current) setBusy(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [query, retry]);
  async function more() {
    if (!cursor) return;
    const current = generation.current;
    setBusy(true);
    setError(null);
    try {
      const result = await searchFoods(query, cursor);
      if (current === generation.current) {
        setItems((old) => [...old, ...result.items]);
        setCursor(result.nextCursor);
      }
    } catch {
      if (current === generation.current)
        setError("Food search failed. Please retry.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Search foods
        <input
          autoFocus
          className="focus-ring min-h-11 rounded-lg border border-gymbud-border bg-gymbud-surface px-3"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try egg, rice or apple"
        />
      </label>
      <p className="text-xs text-gymbud-muted">
        Basic foods · USDA SR Legacy · Keep raw and cooked foods distinct.
      </p>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button
            className="underline"
            onClick={() => (cursor ? void more() : setRetry((n) => n + 1))}
          >
            Retry search
          </button>
        </p>
      ) : null}
      {busy ? (
        <p role="status">Searching…</p>
      ) : items.length === 0 && !error ? (
        <p>No matching foods.</p>
      ) : null}
      <ul className="grid gap-1">
        {items.map((food) => (
          <li key={food.id}>
            <button
              className="focus-ring min-h-11 w-full rounded-lg border border-gymbud-border p-3 text-left hover:bg-gymbud-surface-muted"
              onClick={() => onSelect(food)}
            >
              {food.name}
            </button>
          </li>
        ))}
      </ul>
      {cursor ? (
        <button
          disabled={busy}
          className="focus-ring min-h-11 underline"
          onClick={() => void more()}
        >
          Load more foods
        </button>
      ) : null}
    </div>
  );
}
