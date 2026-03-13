import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { BaseMeal, MealComponent, Ingredient } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { PageShell, Card, Button, Input, Select, ActionGroup } from "../components/ui";

type ComponentRole = MealComponent["role"];
const COMPONENT_ROLES: ComponentRole[] = ["protein", "carb", "veg", "sauce", "topping"];
const DIFFICULTY_OPTIONS: BaseMeal["difficulty"][] = ["easy", "medium", "hard"];

function createEmptyMeal(): BaseMeal {
  return {
    id: crypto.randomUUID(),
    name: "",
    components: [],
    defaultPrep: "",
    estimatedTimeMinutes: 30,
    difficulty: "easy",
    rescueEligible: false,
    wasteReuseHints: [],
  };
}

function ComponentForm({
  component,
  ingredients,
  onChange,
  onRemove,
}: {
  component: MealComponent;
  ingredients: Ingredient[];
  onChange: (updated: MealComponent) => void;
  onRemove: () => void;
}) {
  return (
    <div data-testid={`component-${component.ingredientId || "empty"}`} className="mb-3 rounded-sm border border-border-light p-3">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          Ingredient:
          <Select
            value={component.ingredientId}
            onChange={(e) => onChange({ ...component, ingredientId: e.target.value })}
          >
            <option value="">Select ingredient</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name} ({ing.category})
              </option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          Role:
          <Select
            value={component.role}
            onChange={(e) => onChange({ ...component, role: e.target.value as ComponentRole })}
          >
            {COMPONENT_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          Quantity:
          <Input
            type="text"
            value={component.quantity}
            onChange={(e) => onChange({ ...component, quantity: e.target.value })}
            placeholder="e.g. 200g"
            className="max-w-[200px]"
          />
        </label>
      </div>
      <Button variant="danger" small onClick={onRemove} className="mt-2">Remove component</Button>
    </div>
  );
}

function MealForm({
  meal,
  ingredients,
  onChange,
  onRemove,
}: {
  meal: BaseMeal;
  ingredients: Ingredient[];
  onChange: (updated: BaseMeal) => void;
  onRemove: () => void;
}) {
  function addComponent() {
    const newComponent: MealComponent = {
      ingredientId: "",
      role: "protein",
      quantity: "",
    };
    onChange({ ...meal, components: [...meal.components, newComponent] });
  }

  function updateComponent(index: number, updated: MealComponent) {
    const components = [...meal.components];
    components[index] = updated;
    onChange({ ...meal, components });
  }

  function removeComponent(index: number) {
    onChange({
      ...meal,
      components: meal.components.filter((_, i) => i !== index),
    });
  }

  return (
    <Card data-testid={`meal-${meal.id}`} className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-secondary">Base Meal</span>
        <Button variant="danger" small onClick={onRemove}>Remove meal</Button>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          Name:
          <Input
            type="text"
            value={meal.name}
            onChange={(e) => onChange({ ...meal, name: e.target.value })}
            placeholder="Meal name"
            required
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          Default prep:
          <Input
            type="text"
            value={meal.defaultPrep}
            onChange={(e) => onChange({ ...meal, defaultPrep: e.target.value })}
            placeholder="e.g. stir-fry, roast"
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          Time (minutes):
          <Input
            type="number"
            value={meal.estimatedTimeMinutes}
            onChange={(e) =>
              onChange({ ...meal, estimatedTimeMinutes: parseInt(e.target.value, 10) || 0 })
            }
            min={0}
            className="max-w-[120px]"
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          Difficulty:
          <Select
            value={meal.difficulty}
            onChange={(e) =>
              onChange({ ...meal, difficulty: e.target.value as BaseMeal["difficulty"] })
            }
          >
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <input
            type="checkbox"
            className="h-[18px] w-[18px] accent-brand"
            checked={meal.rescueEligible}
            onChange={(e) => onChange({ ...meal, rescueEligible: e.target.checked })}
          />
          Rescue eligible
        </label>
      </div>

      <h3 className="mt-4 mb-2 text-base font-semibold text-text-primary">
        Components ({meal.components.length})
      </h3>
      {meal.components.map((comp, i) => (
        <ComponentForm
          key={i}
          component={comp}
          ingredients={ingredients}
          onChange={(updated) => updateComponent(i, updated)}
          onRemove={() => removeComponent(i)}
        />
      ))}

      <Button small onClick={addComponent}>Add component</Button>
    </Card>
  );
}

export default function BaseMealManager() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [meals, setMeals] = useState<BaseMeal[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setMeals(household.baseMeals);
      setIngredients(household.ingredients);
      setHouseholdName(household.name);
    }
    setLoaded(true);
  }, [householdId]);

  function addMeal() {
    setMeals((prev) => [...prev, createEmptyMeal()]);
  }

  function updateMeal(index: number, updated: BaseMeal) {
    setMeals((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }

  function removeMeal(index: number) {
    setMeals((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    household.baseMeals = meals;
    saveHousehold(household);
    navigate(`/household/${householdId}`);
  }

  if (!loaded) return null;

  return (
    <PageShell>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-text-primary">Base Meals</h1>
      <p className="mb-6 text-sm text-text-muted">Household: {householdName}</p>

      <h2 className="mb-3 text-xl font-semibold text-text-primary">Meals ({meals.length})</h2>

      {meals.map((meal, i) => (
        <MealForm
          key={meal.id}
          meal={meal}
          ingredients={ingredients}
          onChange={(updated) => updateMeal(i, updated)}
          onRemove={() => removeMeal(i)}
        />
      ))}

      <Button onClick={addMeal} className="mb-4">Add meal</Button>

      <ActionGroup>
        <Button variant="primary" onClick={handleSave}>Save meals</Button>
        <Button onClick={() => navigate(`/household/${householdId}`)}>Cancel</Button>
      </ActionGroup>
    </PageShell>
  );
}
