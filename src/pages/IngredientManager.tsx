import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Ingredient, IngredientCategory } from "../types";
import { loadHousehold, saveHousehold } from "../storage";

const CATEGORY_OPTIONS: IngredientCategory[] = [
  "protein",
  "carb",
  "veg",
  "fruit",
  "dairy",
  "snack",
  "freezer",
  "pantry",
];

const COMMON_TAGS = ["quick", "mashable", "rescue", "staple", "batch-friendly"];

function createEmptyIngredient(): Ingredient {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "pantry",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: false,
  };
}

function IngredientForm({
  ingredient,
  onChange,
  onRemove,
}: {
  ingredient: Ingredient;
  onChange: (updated: Ingredient) => void;
  onRemove: () => void;
}) {
  const [tagInput, setTagInput] = useState("");

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || ingredient.tags.includes(trimmed)) return;
    onChange({ ...ingredient, tags: [...ingredient.tags, trimmed] });
    setTagInput("");
  }

  function removeTag(tag: string) {
    onChange({
      ...ingredient,
      tags: ingredient.tags.filter((t) => t !== tag),
    });
  }

  return (
    <fieldset data-testid={`ingredient-${ingredient.id}`}>
      <legend>Ingredient</legend>

      <label>
        Name:{" "}
        <input
          type="text"
          value={ingredient.name}
          onChange={(e) => onChange({ ...ingredient, name: e.target.value })}
          placeholder="Ingredient name"
          required
        />
      </label>

      <label>
        Category:{" "}
        <select
          value={ingredient.category}
          onChange={(e) =>
            onChange({
              ...ingredient,
              category: e.target.value as IngredientCategory,
            })
          }
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={ingredient.freezerFriendly}
          onChange={(e) =>
            onChange({ ...ingredient, freezerFriendly: e.target.checked })
          }
        />{" "}
        Freezer friendly
      </label>

      <label>
        <input
          type="checkbox"
          checked={ingredient.babySafeWithAdaptation}
          onChange={(e) =>
            onChange({
              ...ingredient,
              babySafeWithAdaptation: e.target.checked,
            })
          }
        />{" "}
        Baby safe with adaptation
      </label>

      <div>
        <strong>Tags:</strong>{" "}
        {ingredient.tags.map((tag) => (
          <span key={tag} data-testid={`tag-${tag}`}>
            {tag}{" "}
            <button type="button" onClick={() => removeTag(tag)}>
              x
            </button>{" "}
          </span>
        ))}
      </div>

      <div>
        {COMMON_TAGS.filter((t) => !ingredient.tags.includes(t)).map((tag) => (
          <button key={tag} type="button" onClick={() => addTag(tag)}>
            +{tag}
          </button>
        ))}
      </div>

      <div>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Custom tag"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
        />
        <button type="button" onClick={() => addTag(tagInput)}>
          Add tag
        </button>
      </div>

      <button type="button" onClick={onRemove}>
        Remove ingredient
      </button>
    </fieldset>
  );
}

export default function IngredientManager() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setIngredients(household.ingredients);
      setHouseholdName(household.name);
    }
    setLoaded(true);
  }, [householdId]);

  function addIngredient() {
    setIngredients((prev) => [...prev, createEmptyIngredient()]);
  }

  function updateIngredient(index: number, updated: Ingredient) {
    setIngredients((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    household.ingredients = ingredients;
    saveHousehold(household);
    navigate(`/household/${householdId}`);
  }

  if (!loaded) return null;

  return (
    <div>
      <h1>Ingredients</h1>
      <p>Household: {householdName}</p>

      <h2>Items ({ingredients.length})</h2>

      {ingredients.map((ingredient, i) => (
        <IngredientForm
          key={ingredient.id}
          ingredient={ingredient}
          onChange={(updated) => updateIngredient(i, updated)}
          onRemove={() => removeIngredient(i)}
        />
      ))}

      <button type="button" onClick={addIngredient}>
        Add ingredient
      </button>

      <div>
        <button type="button" onClick={handleSave}>
          Save ingredients
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
