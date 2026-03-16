import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Ingredient, BaseMeal, MealComponent, IngredientCategory } from "../types";
import { loadHousehold, saveHousehold, normalizeIngredientName } from "../storage";
import { catalogIngredientToHousehold } from "../catalog";
import type { CatalogIngredient } from "../catalog";
import { parseRecipeText, guessComponentRole } from "../recipe-parser";
import type { ParsedIngredientLine } from "../recipe-parser";
import { PageShell, PageHeader, Card, Button, Input, Select, ActionGroup, Chip, FieldLabel, EmptyState, HouseholdNav } from "../components/ui";

type Step = "input" | "review" | "draft";

const CATEGORY_OPTIONS: IngredientCategory[] = [
  "protein", "carb", "veg", "fruit", "dairy", "snack", "freezer", "pantry",
];

interface ReviewLine extends ParsedIngredientLine {
  action: "use" | "create" | "ignore";
  newCategory: IngredientCategory;
}

export default function RecipeImport() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [meals, setMeals] = useState<BaseMeal[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [step, setStep] = useState<Step>("input");
  const [recipeText, setRecipeText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [reviewLines, setReviewLines] = useState<ReviewLine[]>([]);

  // Draft meal state
  const [draftName, setDraftName] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftDifficulty, setDraftDifficulty] = useState<BaseMeal["difficulty"]>("medium");
  const [draftTime, setDraftTime] = useState(30);
  const [draftComponents, setDraftComponents] = useState<MealComponent[]>([]);

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

  function handleParse() {
    const result = parseRecipeText(recipeText, ingredients);
    const lines: ReviewLine[] = result.lines.map((line) => ({
      ...line,
      action: line.status === "unmatched" ? "ignore" : line.status === "catalog" ? "create" : "use",
      newCategory: line.matchedCatalog?.category ?? "pantry",
    }));
    setReviewLines(lines);
    setStep("review");
  }

  const matchedCount = useMemo(() => reviewLines.filter((l) => l.action === "use").length, [reviewLines]);
  const createCount = useMemo(() => reviewLines.filter((l) => l.action === "create").length, [reviewLines]);
  const ignoredCount = useMemo(() => reviewLines.filter((l) => l.action === "ignore").length, [reviewLines]);

  function handleBuildDraft() {
    const newIngredients: Ingredient[] = [];
    const components: MealComponent[] = [];

    for (const line of reviewLines) {
      if (line.action === "ignore") continue;

      if (line.action === "use" && line.matchedIngredient) {
        components.push({
          ingredientId: line.matchedIngredient.id,
          role: guessComponentRole(line.matchedIngredient.category),
          quantity: line.quantity,
        });
      } else if (line.action === "create") {
        let ing: Ingredient;
        if (line.matchedCatalog) {
          ing = catalogIngredientToHousehold(line.matchedCatalog);
        } else {
          ing = {
            id: crypto.randomUUID(),
            name: normalizeIngredientName(line.name),
            category: line.newCategory,
            tags: [],
            shelfLifeHint: "",
            freezerFriendly: false,
            babySafeWithAdaptation: false,
            source: "manual",
          };
        }
        newIngredients.push(ing);
        components.push({
          ingredientId: ing.id,
          role: guessComponentRole(ing.category),
          quantity: line.quantity,
        });
      }
    }

    // Add new ingredients to local state
    if (newIngredients.length > 0) {
      setIngredients((prev) => [...prev, ...newIngredients]);
    }

    setDraftComponents(components);
    setStep("draft");
  }

  function handleSaveDraft() {
    if (!householdId) return;
    const household = loadHousehold(householdId);
    if (!household) return;

    const newMeal: BaseMeal = {
      id: crypto.randomUUID(),
      name: draftName,
      components: draftComponents,
      defaultPrep: "",
      estimatedTimeMinutes: draftTime,
      difficulty: draftDifficulty,
      rescueEligible: false,
      wasteReuseHints: [],
      recipeLinks: sourceUrl.trim() ? [{ label: sourceUrl.trim(), url: sourceUrl.trim() }] : [],
      notes: draftNotes,
    };

    household.baseMeals = [...meals, newMeal];
    household.ingredients = ingredients;
    saveHousehold(household);
    navigate(`/household/${householdId}/meals`);
  }

  function updateReviewLine(index: number, updates: Partial<ReviewLine>) {
    setReviewLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, ...updates };
      return next;
    });
  }

  if (!loaded) return null;

  return (
    <PageShell>
      <HouseholdNav householdId={householdId ?? ""} />
      <PageHeader
        title="Import Recipe"
        subtitle={`Household: ${householdName}`}
        subtitleTo={`/household/${householdId}/home`}
      />

      {step === "input" && (
        <div data-testid="import-input-step">
          <Card className="mb-4">
            <FieldLabel label="Recipe URL (optional)">
              <Input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/recipe"
                data-testid="import-source-url"
              />
            </FieldLabel>

            <FieldLabel label="Paste ingredient list" className="mt-4">
              <textarea
                className="w-full rounded-lg border border-border-light bg-surface-card p-3 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                rows={10}
                value={recipeText}
                onChange={(e) => setRecipeText(e.target.value)}
                placeholder={"Paste recipe ingredients here, one per line.\n\nExample:\n200g chicken breast\n1 cup rice\n2 carrots, diced\n1 tbsp olive oil"}
                data-testid="import-recipe-text"
              />
            </FieldLabel>
          </Card>

          <ActionGroup>
            <Button
              variant="primary"
              onClick={handleParse}
              disabled={!recipeText.trim()}
              data-testid="import-parse-btn"
            >
              Parse ingredients
            </Button>
            <Button onClick={() => navigate(`/household/${householdId}/meals`)}>Cancel</Button>
          </ActionGroup>
        </div>
      )}

      {step === "review" && (
        <div data-testid="import-review-step">
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip variant="success">{matchedCount} matched</Chip>
            <Chip variant="warning">{createCount} to create</Chip>
            <Chip variant="neutral">{ignoredCount} ignored</Chip>
          </div>

          <div className="space-y-2" data-testid="review-lines">
            {reviewLines.map((line, i) => (
              <Card key={i} data-testid={`review-line-${i}`} className={
                line.action === "ignore" ? "opacity-50" : ""
              }>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate" data-testid={`review-line-raw-${i}`}>
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
                      onChange={(e) => updateReviewLine(i, { action: e.target.value as ReviewLine["action"] })}
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
                        onChange={(e) => updateReviewLine(i, { newCategory: e.target.value as IngredientCategory })}
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

          {reviewLines.length === 0 && (
            <EmptyState>No ingredient lines parsed. Go back and paste recipe text.</EmptyState>
          )}

          <ActionGroup className="mt-4">
            <Button variant="primary" onClick={handleBuildDraft} data-testid="import-build-draft-btn">
              Build meal draft
            </Button>
            <Button onClick={() => setStep("input")}>Back</Button>
          </ActionGroup>
        </div>
      )}

      {step === "draft" && (
        <div data-testid="import-draft-step">
          <Card className="mb-4">
            <FieldLabel label="Meal name">
              <Input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Name your meal"
                required
                data-testid="draft-meal-name"
              />
            </FieldLabel>

            <FieldLabel label="Time (minutes)" className="mt-4">
              <Input
                type="number"
                value={draftTime}
                onChange={(e) => setDraftTime(parseInt(e.target.value, 10) || 0)}
                min={0}
                className="max-w-[120px]"
                data-testid="draft-meal-time"
              />
            </FieldLabel>

            <FieldLabel label="Difficulty" className="mt-4">
              <Select
                value={draftDifficulty}
                onChange={(e) => setDraftDifficulty(e.target.value as BaseMeal["difficulty"])}
                data-testid="draft-meal-difficulty"
              >
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </Select>
            </FieldLabel>

            <FieldLabel label="Notes" className="mt-4">
              <textarea
                className="w-full rounded-lg border border-border-light bg-surface-card p-3 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                rows={3}
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="Any notes about this recipe"
                data-testid="draft-meal-notes"
              />
            </FieldLabel>

            {sourceUrl.trim() && (
              <div className="mt-4">
                <span className="text-sm font-medium text-text-secondary">Recipe link: </span>
                <span className="text-sm text-brand" data-testid="draft-recipe-link">{sourceUrl}</span>
              </div>
            )}
          </Card>

          <Card className="mb-4">
            <h3 className="mb-3 text-base font-semibold text-text-primary">
              Components ({draftComponents.length})
            </h3>
            {draftComponents.length === 0 ? (
              <EmptyState>No components mapped. Go back to review ingredient matches.</EmptyState>
            ) : (
              <div className="space-y-2" data-testid="draft-components">
                {draftComponents.map((comp, i) => {
                  const ing = ingredients.find((ii) => ii.id === comp.ingredientId);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-sm border border-border-light p-2"
                      data-testid={`draft-component-${i}`}
                    >
                      <Chip variant="info">{comp.role}</Chip>
                      <span className="flex-1 text-sm text-text-primary">{ing?.name ?? comp.ingredientId}</span>
                      {comp.quantity && <span className="text-xs text-text-muted">{comp.quantity}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <ActionGroup>
            <Button
              variant="primary"
              onClick={handleSaveDraft}
              disabled={!draftName.trim()}
              data-testid="import-save-btn"
            >
              Save meal
            </Button>
            <Button onClick={() => setStep("review")}>Back to review</Button>
            <Button onClick={() => navigate(`/household/${householdId}/meals`)}>Cancel</Button>
          </ActionGroup>
        </div>
      )}
    </PageShell>
  );
}
