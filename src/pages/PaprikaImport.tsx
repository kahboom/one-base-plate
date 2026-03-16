import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Ingredient, BaseMeal, IngredientCategory } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import {
  parsePaprikaFile,
  parsePaprikaRecipes,
  buildDraftMeal,
  computeBulkSummary,
  applyBulkAction,
  saveImportSession,
  loadImportSession,
  clearImportSession,
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
  Section,
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
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"all" | "ambiguous">("all");

  useEffect(() => {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (household) {
      setIngredients(household.ingredients);
      setMeals(household.baseMeals);
      setHouseholdName(household.name);
    }

    // Restore saved session if available
    const session = loadImportSession(householdId);
    if (session && session.step !== "done") {
      setParsedRecipes(session.parsedRecipes);
      setStep(session.step);
    }

    setLoaded(true);
  }, [householdId]);

  const persistSession = useCallback((recipes: ParsedPaprikaRecipe[], currentStep: Step) => {
    if (!householdId || currentStep === "done" || currentStep === "upload") return;
    saveImportSession({
      householdId,
      parsedRecipes: recipes,
      step: currentStep,
      savedAt: new Date().toISOString(),
    });
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
      persistSession(parsed, "select");
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

  const bulkSummary = useMemo(
    () => computeBulkSummary(selectedRecipes),
    [selectedRecipes],
  );

  const allReviewLines = useMemo(() => {
    const lines: { line: PaprikaReviewLine; globalRecipeIdx: number; lineIdx: number }[] = [];
    for (const recipe of parsedRecipes) {
      if (!recipe.selected) continue;
      const globalIdx = parsedRecipes.indexOf(recipe);
      recipe.parsedLines.forEach((line, lineIdx) => {
        lines.push({ line, globalRecipeIdx: globalIdx, lineIdx });
      });
    }
    return lines;
  }, [parsedRecipes]);

  const filteredReviewLines = useMemo(() => {
    if (reviewFilter === "ambiguous") {
      return allReviewLines.filter(
        ({ line }) => line.status === "unmatched" && line.name,
      );
    }
    return allReviewLines;
  }, [allReviewLines, reviewFilter]);

  function toggleRecipe(index: number) {
    setParsedRecipes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, selected: !next[index]!.selected };
      persistSession(next, step);
      return next;
    });
  }

  function selectAll() {
    setParsedRecipes((prev) => {
      const next = prev.map((r) => ({ ...r, selected: true }));
      persistSession(next, step);
      return next;
    });
  }

  function selectNone() {
    setParsedRecipes((prev) => {
      const next = prev.map((r) => ({ ...r, selected: false }));
      persistSession(next, step);
      return next;
    });
  }

  function selectByCategory(cat: string) {
    setParsedRecipes((prev) => {
      const next = prev.map((r) => ({
        ...r,
        selected: r.raw.categories.includes(cat),
      }));
      persistSession(next, step);
      return next;
    });
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
      persistSession(next, step);
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
      persistSession(next, "review");
      return next;
    });
  }

  function handleBulkAction(action: "approve-matched" | "create-all-new" | "ignore-instructions") {
    setParsedRecipes((prev) => {
      const next = applyBulkAction(prev, action);
      persistSession(next, "review");
      return next;
    });
  }

  function handleStartReview() {
    if (selectedRecipes.length === 0) return;
    setStep("review");
    persistSession(parsedRecipes, "review");
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
    clearImportSession();

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
              <Button onClick={() => { setStep("upload"); setParsedRecipes([]); clearImportSession(); }}>
                Back
              </Button>
            </ActionGroup>
          </div>
        </div>
      )}

      {step === "review" && (
        <div data-testid="paprika-review-step">
          <Section title="Bulk ingredient review">
            <div className="mb-4 flex flex-wrap gap-2" data-testid="bulk-summary">
              <Chip variant="success">{bulkSummary.matched.length} exact matches</Chip>
              <Chip variant="info">{bulkSummary.catalog.length} catalog matches</Chip>
              <Chip variant="warning">{bulkSummary.unmatched.length} unmatched</Chip>
              <Chip variant="neutral">{bulkSummary.instruction.length} instructions</Chip>
            </div>

            <div className="mb-4 flex flex-wrap gap-2" data-testid="bulk-actions">
              <Button
                small
                onClick={() => handleBulkAction("approve-matched")}
                data-testid="bulk-approve-matched"
              >
                Approve all matches
              </Button>
              <Button
                small
                onClick={() => handleBulkAction("create-all-new")}
                data-testid="bulk-create-new"
              >
                Create all new
              </Button>
              <Button
                small
                onClick={() => handleBulkAction("ignore-instructions")}
                data-testid="bulk-ignore-instructions"
              >
                Ignore all instructions
              </Button>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-text-secondary">Show:</span>
              <Button
                small
                variant={reviewFilter === "all" ? "primary" : "default"}
                onClick={() => setReviewFilter("all")}
                data-testid="filter-all"
              >
                All ({allReviewLines.length})
              </Button>
              <Button
                small
                variant={reviewFilter === "ambiguous" ? "primary" : "default"}
                onClick={() => setReviewFilter("ambiguous")}
                data-testid="filter-ambiguous"
              >
                Ambiguous only ({allReviewLines.filter(({ line }) => line.status === "unmatched" && line.name).length})
              </Button>
            </div>
          </Section>

          <div className="space-y-2" data-testid="review-lines">
            {filteredReviewLines.map(({ line, globalRecipeIdx, lineIdx }, i) => (
              <Card
                key={`${globalRecipeIdx}-${lineIdx}`}
                data-testid={`review-line-${i}`}
                className={line.action === "ignore" ? "opacity-50" : ""}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-muted mb-0.5" data-testid={`review-line-recipe-${i}`}>
                      {line.recipeName}
                    </p>
                    <p className="text-sm font-medium text-text-primary truncate">
                      {line.raw}
                    </p>
                    <p className="text-xs text-text-muted">
                      {line.quantity && <span>Qty: {line.quantity}{line.unit ? ` ${line.unit}` : ""} · </span>}
                      Parsed: {line.name || <em>instruction/note</em>}
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
                        updateReviewLine(globalRecipeIdx, lineIdx, {
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
                          updateReviewLine(globalRecipeIdx, lineIdx, {
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

          {filteredReviewLines.length === 0 && reviewFilter === "ambiguous" && (
            <EmptyState>No ambiguous lines to review. All ingredients are resolved.</EmptyState>
          )}

          <div className="mt-4">
            <ActionGroup>
              <Button
                variant="primary"
                onClick={handleSaveAll}
                data-testid="import-save-all-btn"
              >
                Import {selectedRecipes.length} recipe{selectedRecipes.length !== 1 ? "s" : ""}
              </Button>
              <Button onClick={() => { setStep("select"); persistSession(parsedRecipes, "select"); }}>
                Back to selection
              </Button>
              <Button
                onClick={() => { persistSession(parsedRecipes, "review"); navigate(`/household/${householdId}/home`); }}
                data-testid="pause-import-btn"
              >
                Save &amp; resume later
              </Button>
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
