import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Ingredient, BaseMeal, IngredientCategory } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import {
  parsePaprikaFile,
  parsePaprikaRecipes,
  buildDraftMeal,
} from "../paprika-parser";
import type { ParsedPaprikaRecipe, PaprikaReviewLine } from "../paprika-parser";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Select,
  ActionGroup,
  Chip,
  FieldLabel,
  EmptyState,
  HouseholdNav,
} from "../components/ui";

type Step = "upload" | "select" | "review" | "done";

const CATEGORY_OPTIONS: IngredientCategory[] = [
  "protein", "carb", "veg", "fruit", "dairy", "snack", "freezer", "pantry",
];

export default function PaprikaImport() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [meals, setMeals] = useState<BaseMeal[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [step, setStep] = useState<Step>("upload");
  const [parsedRecipes, setParsedRecipes] = useState<ParsedPaprikaRecipe[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setIngredients(household.ingredients);
      setMeals(household.baseMeals);
      setHouseholdName(household.name);
    }
    setLoaded(true);
  }, [householdId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    try {
      const recipes = await parsePaprikaFile(file);
      if (recipes.length === 0) {
        setError("No recipes found in this file.");
        return;
      }
      const parsed = parsePaprikaRecipes(recipes, ingredients, meals);
      setParsedRecipes(parsed);
      setStep("select");
    } catch {
      setError("Failed to parse file. Make sure it is a valid .paprikarecipes export.");
    }
  }

  const selectedRecipes = useMemo(
    () => parsedRecipes.filter((r) => r.selected),
    [parsedRecipes],
  );

  const duplicateCount = useMemo(
    () => parsedRecipes.filter((r) => r.isDuplicate).length,
    [parsedRecipes],
  );

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const r of parsedRecipes) {
      for (const c of r.raw.categories) {
        cats.add(c);
      }
    }
    return [...cats].sort();
  }, [parsedRecipes]);

  function toggleRecipe(index: number) {
    setParsedRecipes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, selected: !next[index]!.selected };
      return next;
    });
  }

  function selectAll() {
    setParsedRecipes((prev) => prev.map((r) => ({ ...r, selected: true })));
  }

  function selectNone() {
    setParsedRecipes((prev) => prev.map((r) => ({ ...r, selected: false })));
  }

  function selectByCategory(cat: string) {
    setParsedRecipes((prev) =>
      prev.map((r) => ({
        ...r,
        selected: r.raw.categories.includes(cat),
      })),
    );
  }

  function handleDuplicateAction(index: number, action: "skip" | "merge" | "keep-both") {
    setParsedRecipes((prev) => {
      const next = [...prev];
      const recipe = { ...next[index]! };
      if (action === "skip") {
        recipe.selected = false;
      } else if (action === "merge" || action === "keep-both") {
        recipe.selected = true;
        if (action === "keep-both") {
          recipe.isDuplicate = false;
          recipe.existingMealId = undefined;
        }
      }
      next[index] = recipe;
      return next;
    });
  }

  function updateReviewLine(recipeIdx: number, lineIdx: number, updates: Partial<PaprikaReviewLine>) {
    setParsedRecipes((prev) => {
      const next = [...prev];
      const recipe = { ...next[recipeIdx]! };
      const lines = [...recipe.parsedLines];
      lines[lineIdx] = { ...lines[lineIdx]!, ...updates };
      recipe.parsedLines = lines;
      next[recipeIdx] = recipe;
      return next;
    });
  }

  function handleStartReview() {
    if (selectedRecipes.length === 0) return;
    setReviewIndex(0);
    setStep("review");
  }

  function handleSaveAll() {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (!household) return;

    let allNewIngredients: Ingredient[] = [];
    const newMeals: BaseMeal[] = [];
    let currentIngredients = [...household.ingredients];

    for (const parsed of selectedRecipes) {
      const { meal, newIngredients } = buildDraftMeal(
        parsed.raw,
        parsed.parsedLines,
      );

      // Handle merge: replace existing meal
      if (parsed.isDuplicate && parsed.existingMealId) {
        const existingIdx = household.baseMeals.findIndex((m) => m.id === parsed.existingMealId);
        if (existingIdx >= 0) {
          meal.id = parsed.existingMealId;
          household.baseMeals[existingIdx] = meal;
        } else {
          newMeals.push(meal);
        }
      } else {
        newMeals.push(meal);
      }

      allNewIngredients = [...allNewIngredients, ...newIngredients];
      currentIngredients = [...currentIngredients, ...newIngredients];
    }

    household.ingredients = [...household.ingredients, ...allNewIngredients];
    household.baseMeals = [...household.baseMeals, ...newMeals];
    saveHousehold(household);

    setImportedCount(selectedRecipes.length);
    setStep("done");
  }

  if (!loaded) return null;

  return (
    <PageShell>
      <HouseholdNav householdId={householdId ?? ""} />
      <PageHeader
        title="Import from Paprika"
        subtitle={`Household: ${householdName}`}
        subtitleTo={`/household/${householdId}/home`}
      />

      {step === "upload" && (
        <div data-testid="paprika-upload-step">
          <Card className="mb-4">
            <FieldLabel label="Upload .paprikarecipes file">
              <input
                type="file"
                accept=".paprikarecipes"
                onChange={handleFileUpload}
                className="block w-full text-sm text-text-primary file:mr-4 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark"
                data-testid="paprika-file-input"
              />
            </FieldLabel>
            <p className="mt-2 text-sm text-text-muted">
              Export your recipes from Paprika as a .paprikarecipes file, then upload it here.
            </p>
          </Card>

          {error && (
            <Card className="mb-4 border-danger bg-danger/5">
              <p className="text-sm text-danger" data-testid="paprika-error">{error}</p>
            </Card>
          )}

          <ActionGroup>
            <Button onClick={() => navigate(`/household/${householdId}/meals`)}>Cancel</Button>
          </ActionGroup>
        </div>
      )}

      {step === "select" && (
        <div data-testid="paprika-select-step">
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip variant="info">{parsedRecipes.length} recipes found</Chip>
            <Chip variant="success">{selectedRecipes.length} selected</Chip>
            {duplicateCount > 0 && (
              <Chip variant="warning">{duplicateCount} duplicates</Chip>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button small onClick={selectAll} data-testid="select-all-btn">Select all</Button>
            <Button small onClick={selectNone} data-testid="select-none-btn">Select none</Button>
            {categories.length > 0 && (
              <Select
                onChange={(e) => {
                  if (e.target.value) selectByCategory(e.target.value);
                }}
                className="w-auto"
                data-testid="select-by-category"
              >
                <option value="">Select by category...</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            )}
          </div>

          <div className="space-y-2" data-testid="recipe-list">
            {parsedRecipes.map((recipe, i) => (
              <Card
                key={i}
                data-testid={`recipe-item-${i}`}
                className={!recipe.selected ? "opacity-60" : ""}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={recipe.selected}
                    onChange={() => toggleRecipe(i)}
                    className="h-5 w-5 rounded"
                    data-testid={`recipe-checkbox-${i}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {recipe.raw.name}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {recipe.raw.total_time && (
                        <Chip variant="neutral">{recipe.raw.total_time}</Chip>
                      )}
                      {recipe.raw.categories.map((c) => (
                        <Chip key={c} variant="info">{c}</Chip>
                      ))}
                      {recipe.parsedLines.length > 0 && (
                        <Chip variant="neutral">{recipe.parsedLines.length} ingredients</Chip>
                      )}
                    </div>
                  </div>

                  {recipe.isDuplicate && (
                    <div className="flex items-center gap-1">
                      <Chip variant="warning">Duplicate</Chip>
                      <Select
                        onChange={(e) => handleDuplicateAction(i, e.target.value as "skip" | "merge" | "keep-both")}
                        className="w-auto text-xs"
                        data-testid={`duplicate-action-${i}`}
                      >
                        <option value="skip">Skip</option>
                        <option value="merge">Merge</option>
                        <option value="keep-both">Keep both</option>
                      </Select>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {parsedRecipes.length === 0 && (
            <EmptyState>No recipes found in the uploaded file.</EmptyState>
          )}

          <div className="mt-4">
            <ActionGroup>
              <Button
                variant="primary"
                onClick={handleStartReview}
                disabled={selectedRecipes.length === 0}
                data-testid="start-review-btn"
              >
                Review {selectedRecipes.length} recipe{selectedRecipes.length !== 1 ? "s" : ""}
              </Button>
              <Button onClick={() => { setStep("upload"); setParsedRecipes([]); }}>
                Back
              </Button>
            </ActionGroup>
          </div>
        </div>
      )}

      {step === "review" && selectedRecipes.length > 0 && (
        <div data-testid="paprika-review-step">
          <div className="mb-4 flex items-center gap-2">
            <Chip variant="info">
              Recipe {reviewIndex + 1} of {selectedRecipes.length}
            </Chip>
            <h3 className="text-lg font-semibold text-text-primary">
              {selectedRecipes[reviewIndex]?.raw.name}
            </h3>
          </div>

          {selectedRecipes[reviewIndex] && (
            <RecipeReviewCard
              recipe={selectedRecipes[reviewIndex]}
              recipeIndex={parsedRecipes.indexOf(selectedRecipes[reviewIndex]!)}
              onUpdateLine={updateReviewLine}
            />
          )}

          <div className="mt-4">
            <ActionGroup>
              {reviewIndex > 0 && (
                <Button onClick={() => setReviewIndex((i) => i - 1)}>
                  Previous
                </Button>
              )}
              {reviewIndex < selectedRecipes.length - 1 ? (
                <Button
                  variant="primary"
                  onClick={() => setReviewIndex((i) => i + 1)}
                  data-testid="next-recipe-btn"
                >
                  Next recipe
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleSaveAll}
                  data-testid="import-save-all-btn"
                >
                  Import {selectedRecipes.length} recipe{selectedRecipes.length !== 1 ? "s" : ""}
                </Button>
              )}
              <Button onClick={() => setStep("select")}>Back to selection</Button>
            </ActionGroup>
          </div>
        </div>
      )}

      {step === "done" && (
        <div data-testid="paprika-done-step">
          <Card className="mb-4">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Import complete
            </h3>
            <p className="text-sm text-text-secondary">
              Successfully imported {importedCount} recipe{importedCount !== 1 ? "s" : ""} from Paprika.
            </p>
          </Card>
          <ActionGroup>
            <Button
              variant="primary"
              onClick={() => navigate(`/household/${householdId}/meals`)}
              data-testid="go-to-meals-btn"
            >
              View meals
            </Button>
            <Button onClick={() => navigate(`/household/${householdId}/home`)}>
              Home
            </Button>
          </ActionGroup>
        </div>
      )}
    </PageShell>
  );
}

function RecipeReviewCard({
  recipe,
  recipeIndex,
  onUpdateLine,
}: {
  recipe: ParsedPaprikaRecipe;
  recipeIndex: number;
  onUpdateLine: (recipeIdx: number, lineIdx: number, updates: Partial<PaprikaReviewLine>) => void;
}) {
  const matchedCount = recipe.parsedLines.filter((l) => l.action === "use").length;
  const createCount = recipe.parsedLines.filter((l) => l.action === "create").length;
  const ignoredCount = recipe.parsedLines.filter((l) => l.action === "ignore").length;

  return (
    <>
      {(recipe.raw.total_time || recipe.raw.servings || recipe.raw.source) && (
        <Card className="mb-3">
          <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
            {recipe.raw.total_time && <span>Time: {recipe.raw.total_time}</span>}
            {recipe.raw.prep_time && <span>Prep: {recipe.raw.prep_time}</span>}
            {recipe.raw.cook_time && <span>Cook: {recipe.raw.cook_time}</span>}
            {recipe.raw.servings && <span>Servings: {recipe.raw.servings}</span>}
            {recipe.raw.source && <span>Source: {recipe.raw.source}</span>}
          </div>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <Chip variant="success">{matchedCount} matched</Chip>
        <Chip variant="warning">{createCount} to create</Chip>
        <Chip variant="neutral">{ignoredCount} ignored</Chip>
      </div>

      <div className="space-y-2" data-testid="review-lines">
        {recipe.parsedLines.map((line, i) => (
          <Card
            key={i}
            data-testid={`review-line-${i}`}
            className={line.action === "ignore" ? "opacity-50" : ""}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {line.raw}
                </p>
                <p className="text-xs text-text-muted">
                  {line.quantity && <span>Qty: {line.quantity} · </span>}
                  Parsed: {line.name || <em>empty</em>}
                </p>
                {line.matchedIngredient && (
                  <Chip variant="success" className="mt-1 text-[10px]">
                    Matched: {line.matchedIngredient.name}
                  </Chip>
                )}
                {line.matchedCatalog && !line.matchedIngredient && (
                  <Chip variant="info" className="mt-1 text-[10px]">
                    Catalog: {line.matchedCatalog.name}
                  </Chip>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={line.action}
                  onChange={(e) =>
                    onUpdateLine(recipeIndex, i, {
                      action: e.target.value as PaprikaReviewLine["action"],
                    })
                  }
                  className="w-28"
                  data-testid={`review-action-${i}`}
                >
                  {line.matchedIngredient && <option value="use">Use match</option>}
                  <option value="create">Create new</option>
                  <option value="ignore">Ignore</option>
                </Select>

                {line.action === "create" && !line.matchedCatalog && (
                  <Select
                    value={line.newCategory}
                    onChange={(e) =>
                      onUpdateLine(recipeIndex, i, {
                        newCategory: e.target.value as IngredientCategory,
                      })
                    }
                    className="w-28"
                    data-testid={`review-category-${i}`}
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
