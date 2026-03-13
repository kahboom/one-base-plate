import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import type { Household, WeeklyPlan, IngredientCategory } from "../types";
import { loadHousehold } from "../storage";
import { generateGroceryList, type GroceryListItem } from "../planner";
import { PageShell, PageHeader, Card, Button, Chip, EmptyState, NavBar } from "../components/ui";

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  protein: "Protein",
  carb: "Carbs",
  veg: "Vegetables",
  fruit: "Fruit",
  dairy: "Dairy",
  snack: "Snacks",
  freezer: "Freezer",
  pantry: "Pantry",
};

export default function GroceryList() {
  const { householdId } = useParams<{ householdId: string }>();

  const [household, setHousehold] = useState<Household | null>(null);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(() => {
    if (!householdId) return;
    const h = loadHousehold(householdId);
    if (h) {
      setHousehold(h);
      if (h.weeklyPlans.length > 0) {
        const latestPlan = h.weeklyPlans[h.weeklyPlans.length - 1]!;
        setPlan(latestPlan);
        setItems(generateGroceryList(latestPlan.days, h.baseMeals, h.ingredients));
      }
    }
    setLoaded(true);
  }, [householdId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleOwned(ingredientId: string) {
    setOwnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  }

  if (!loaded) return null;

  if (!household) {
    return <p>Household not found.</p>;
  }

  if (!plan || items.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Grocery List" subtitle={`Household: ${household.name}`} />
        <EmptyState>No weekly plan saved yet. Generate and save a plan first.</EmptyState>
        <NavBar>
          <Link to={`/household/${householdId}/weekly`} className="text-sm font-medium text-brand hover:underline">Weekly planner</Link>
          <Link to={`/household/${householdId}/home`} className="text-sm font-medium text-brand hover:underline">Home</Link>
        </NavBar>
      </PageShell>
    );
  }

  const grouped = new Map<IngredientCategory, GroceryListItem[]>();
  for (const item of items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  const visibleCount = items.filter((i) => !ownedIds.has(i.ingredientId)).length;

  return (
    <PageShell>
      <PageHeader title="Grocery List" subtitle={`${items.length} ingredients from ${plan.days.length}-day plan`} />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <span className="text-sm text-text-secondary" data-testid="grocery-summary">
          {visibleCount} to buy{ownedIds.size > 0 ? ` · ${ownedIds.size} already have` : ""}
        </span>
        {ownedIds.size > 0 && (
          <Button small onClick={() => setOwnedIds(new Set())} data-testid="clear-owned-btn">
            Show all
          </Button>
        )}
      </div>

      <div className="space-y-6" data-testid="grocery-categories">
        {[...grouped.entries()].map(([category, catItems]) => (
          <Card key={category} data-testid={`category-${category}`}>
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              {CATEGORY_LABELS[category] ?? category}
              <span className="ml-2 text-sm font-normal text-text-muted">({catItems.length})</span>
            </h2>
            <ul className="space-y-2">
              {catItems.map((item) => {
                const isOwned = ownedIds.has(item.ingredientId);
                return (
                  <li
                    key={item.ingredientId}
                    data-testid={`grocery-item-${item.ingredientId}`}
                    className={`flex flex-col gap-1 rounded-sm p-2 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      isOwned ? "bg-bg opacity-50" : "bg-surface"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleOwned(item.ingredientId)}
                        data-testid={`toggle-owned-${item.ingredientId}`}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border-2 transition-colors ${
                          isOwned
                            ? "border-success bg-success text-white"
                            : "border-border-default bg-surface hover:border-brand"
                        }`}
                        aria-label={isOwned ? `Mark ${item.name} as needed` : `Mark ${item.name} as already have`}
                      >
                        {isOwned && (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className={`text-sm font-medium ${isOwned ? "line-through text-text-muted" : "text-text-primary"}`}>
                        {item.name}
                      </span>
                      {item.quantity && (
                        <Chip variant="neutral">{item.quantity}</Chip>
                      )}
                    </div>
                    <div className="ml-9 flex flex-wrap gap-1 sm:ml-0">
                      {item.usedInMeals.map((mealName) => (
                        <span
                          key={mealName}
                          className="text-xs text-text-muted"
                          data-testid={`meal-link-${item.ingredientId}`}
                        >
                          {mealName}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      <NavBar>
        <Link to={`/household/${householdId}/weekly`} className="text-sm font-medium text-brand hover:underline">Weekly planner</Link>
        <Link to={`/household/${householdId}/home`} className="text-sm font-medium text-brand hover:underline">Home</Link>
      </NavBar>
    </PageShell>
  );
}
