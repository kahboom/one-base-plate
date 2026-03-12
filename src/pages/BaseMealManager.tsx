import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { BaseMeal, MealComponent, Ingredient } from "../types";
import { loadHousehold, saveHousehold } from "../storage";

type ComponentRole = MealComponent["role"];
const COMPONENT_ROLES: ComponentRole[] = [
  "protein",
  "carb",
  "veg",
  "sauce",
  "topping",
];
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
    <div data-testid={`component-${component.ingredientId || "empty"}`}>
      <label>
        Ingredient:{" "}
        <select
          value={component.ingredientId}
          onChange={(e) =>
            onChange({ ...component, ingredientId: e.target.value })
          }
        >
          <option value="">Select ingredient</option>
          {ingredients.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.name} ({ing.category})
            </option>
          ))}
        </select>
      </label>

      <label>
        Role:{" "}
        <select
          value={component.role}
          onChange={(e) =>
            onChange({ ...component, role: e.target.value as ComponentRole })
          }
        >
          {COMPONENT_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label>
        Quantity:{" "}
        <input
          type="text"
          value={component.quantity}
          onChange={(e) => onChange({ ...component, quantity: e.target.value })}
          placeholder="e.g. 200g"
        />
      </label>

      <button type="button" onClick={onRemove}>
        Remove component
      </button>
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
    <fieldset data-testid={`meal-${meal.id}`}>
      <legend>Base Meal</legend>

      <label>
        Name:{" "}
        <input
          type="text"
          value={meal.name}
          onChange={(e) => onChange({ ...meal, name: e.target.value })}
          placeholder="Meal name"
          required
        />
      </label>

      <label>
        Default prep:{" "}
        <input
          type="text"
          value={meal.defaultPrep}
          onChange={(e) => onChange({ ...meal, defaultPrep: e.target.value })}
          placeholder="e.g. stir-fry, roast"
        />
      </label>

      <label>
        Time (minutes):{" "}
        <input
          type="number"
          value={meal.estimatedTimeMinutes}
          onChange={(e) =>
            onChange({
              ...meal,
              estimatedTimeMinutes: parseInt(e.target.value, 10) || 0,
            })
          }
          min={0}
        />
      </label>

      <label>
        Difficulty:{" "}
        <select
          value={meal.difficulty}
          onChange={(e) =>
            onChange({
              ...meal,
              difficulty: e.target.value as BaseMeal["difficulty"],
            })
          }
        >
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={meal.rescueEligible}
          onChange={(e) =>
            onChange({ ...meal, rescueEligible: e.target.checked })
          }
        />{" "}
        Rescue eligible
      </label>

      <h3>Components ({meal.components.length})</h3>
      {meal.components.map((comp, i) => (
        <ComponentForm
          key={i}
          component={comp}
          ingredients={ingredients}
          onChange={(updated) => updateComponent(i, updated)}
          onRemove={() => removeComponent(i)}
        />
      ))}

      <button type="button" onClick={addComponent}>
        Add component
      </button>

      <br />
      <button type="button" onClick={onRemove}>
        Remove meal
      </button>
    </fieldset>
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
    <div>
      <h1>Base Meals</h1>
      <p>Household: {householdName}</p>

      <h2>Meals ({meals.length})</h2>

      {meals.map((meal, i) => (
        <MealForm
          key={meal.id}
          meal={meal}
          ingredients={ingredients}
          onChange={(updated) => updateMeal(i, updated)}
          onRemove={() => removeMeal(i)}
        />
      ))}

      <button type="button" onClick={addMeal}>
        Add meal
      </button>

      <div>
        <button type="button" onClick={handleSave}>
          Save meals
        </button>
        <button
          type="button"
          onClick={() => navigate(`/household/${householdId}`)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
