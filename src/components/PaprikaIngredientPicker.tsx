import { useMemo, useState } from "react";
import type { Ingredient } from "../types";
import { Input } from "./ui";

export default function PaprikaIngredientPicker({
  ingredients,
  valueId,
  onSelect,
  placeholder = "Search ingredients…",
  testId = "paprika-ingredient-picker",
}: {
  ingredients: Ingredient[];
  valueId?: string | null;
  onSelect: (ingredient: Ingredient) => void;
  placeholder?: string;
  testId?: string;
}) {
  const [q, setQ] = useState("");
  const sorted = useMemo(
    () => [...ingredients].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [ingredients],
  );
  const filtered = useMemo(() => {
    const n = q.toLowerCase().trim();
    if (!n) return sorted.slice(0, 50);
    return sorted.filter((i) => i.name.toLowerCase().includes(n)).slice(0, 50);
  }, [sorted, q]);

  return (
    <div data-testid={testId}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="mb-2"
        data-testid={`${testId}-search`}
      />
      <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-border-light bg-bg p-1 text-sm">
        {filtered.map((ing) => (
          <li key={ing.id}>
            <button
              type="button"
              className={`w-full rounded px-2 py-1.5 text-left hover:bg-bg-elevated ${
                valueId === ing.id ? "bg-brand/10 font-medium text-brand" : "text-text-primary"
              }`}
              onClick={() => onSelect(ing)}
              data-testid={`${testId}-option-${ing.id}`}
            >
              {ing.name}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-2 py-2 text-text-muted">No matches</li>
        )}
      </ul>
    </div>
  );
}
