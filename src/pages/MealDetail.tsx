import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Household, BaseMeal, Ingredient } from "../types";
import { loadHousehold, saveHousehold, toSentenceCase } from "../storage";
import {
  generateAssemblyVariants,
  computeMealOverlap,
  getAllIngredientIds,
} from "../planner";
import { summarizeRecipeRef } from "../lib/componentRecipes";
import { PageHeader, Card, Button, Chip, Section } from "../components/ui";
import MealImageSlot from "../components/MealImageSlot";
import ImportMappingAdjust from "../components/ImportMappingAdjust";
import { resolveMealImageUrl } from "../lib/mealImage";

export default function MealDetail() {
  const { householdId, mealId } = useParams<{
    householdId: string;
    mealId: string;
  }>();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    const h = loadHousehold(householdId);
    if (h) setHousehold(h);
    setLoaded(true);
  }, [householdId]);

  if (!loaded) return null;
  if (!household) return <p>Household not found.</p>;

  const meal = household.baseMeals.find((m) => m.id === mealId);
  if (!meal) return <p>Meal not found.</p>;

  const overlap = computeMealOverlap(meal, household.members, household.ingredients);
  const isPinned = (household.pinnedMealIds ?? []).includes(meal.id);

  function handleTogglePin() {
    if (!household || !meal) return;
    const current = household.pinnedMealIds ?? [];
    const updated = isPinned
      ? current.filter((id) => id !== meal.id)
      : [...current, meal.id];
    const updatedHousehold = { ...household, pinnedMealIds: updated };
    saveHousehold(updatedHousehold);
    setHousehold(updatedHousehold);
  }

  function handlePersistMeal(updatedMeal: BaseMeal, newIngredients: Ingredient[]) {
    if (!household) return;
    const extra = newIngredients.filter(
      (n) => !household.ingredients.some((x) => x.id === n.id),
    );
    const updatedHousehold: Household = {
      ...household,
      ingredients: [...household.ingredients, ...extra],
      baseMeals: household.baseMeals.map((m) =>
        m.id === updatedMeal.id ? updatedMeal : m,
      ),
    };
    saveHousehold(updatedHousehold);
    setHousehold(updatedHousehold);
  }

  return (
    <>
      <PageHeader
        title={meal.name}
        subtitle={`Household: ${household.name}`}
        subtitleTo={`/households?edit=${householdId}`}
      />
      <MealDetailContent
        meal={meal}
        household={household}
        overlapLabel={`${overlap.score}/${overlap.total}`}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
        onPersistMeal={handlePersistMeal}
      />
    </>
  );
}

interface MealDetailContentProps {
  meal: BaseMeal;
  household: Household;
  overlapLabel: string;
  isPinned: boolean;
  onTogglePin: () => void;
  /** Meal detail page only — enables post-import line editing */
  onPersistMeal?: (meal: BaseMeal, newIngredients: Ingredient[]) => void;
}

export function MealDetailContent({
  meal,
  household,
  overlapLabel,
  isPinned,
  onTogglePin,
  onPersistMeal,
}: MealDetailContentProps) {
  const overlap = computeMealOverlap(meal, household.members, household.ingredients);
  const variants = generateAssemblyVariants(meal, household.members, household.ingredients);

  const componentsByRole = new Map<string, typeof meal.components>();
  for (const comp of meal.components) {
    const existing = componentsByRole.get(comp.role) ?? [];
    existing.push(comp);
    componentsByRole.set(comp.role, existing);
  }

  function ingredientName(id: string): string {
    const name = household.ingredients.find((i) => i.id === id)?.name ?? id;
    return toSentenceCase(name);
  }

  return (
    <>
      <Card data-testid="meal-hero" className="mb-6">
        <MealImageSlot
          variant="detail"
          imageUrl={resolveMealImageUrl(meal, household.recipes ?? [])}
          alt={meal.name}
          imageTestId="meal-hero-image"
          placeholderTestId="meal-hero-image-placeholder"
        />
        <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
          <span>Prep: {meal.defaultPrep || "—"}</span>
          <span>{meal.estimatedTimeMinutes} min</span>
          <span>{meal.difficulty}</span>
          <span>Overlap: {overlapLabel}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isPinned && <Chip variant="success">Pinned</Chip>}
          {meal.rescueEligible && <Chip variant="neutral">Rescue eligible</Chip>}
          <Button
            small
            variant={isPinned ? "danger" : "default"}
            onClick={onTogglePin}
            data-testid="pin-toggle"
          >
            {isPinned ? "Unpin from rotation" : "Pin to rotation"}
          </Button>
        </div>
      </Card>

      <MealStructure
        componentsByRole={componentsByRole}
        ingredientName={ingredientName}
        household={household}
      />

      {((meal.recipeRefs ?? []).length > 0 || meal.components.some((c) => (c.recipeRefs ?? []).length > 0)) && (
        <Section title="Recipes">
          {(meal.recipeRefs ?? []).length > 0 && (
            <div data-testid="meal-recipe-refs" className="mb-4">
              <h4 className="mb-1 text-sm font-semibold text-text-secondary">Library recipes</h4>
              <div className="space-y-2">
                {(meal.recipeRefs ?? []).map((ref, i) => {
                  const recipe = (household.recipes ?? []).find((r) => r.id === ref.recipeId);
                  const name = ref.label ?? recipe?.name ?? ref.recipeId;
                  return (
                    <div key={ref.recipeId || i} className="flex flex-wrap items-center gap-2 rounded-sm border border-border-light bg-surface-card p-2" data-testid={`meal-ref-card-${i}`}>
                      <span className="text-sm font-medium text-text-primary">{name}</span>
                      {ref.role && (
                        <Chip variant="neutral" className="text-[10px]">{ref.role}</Chip>
                      )}
                      {ref.notes && (
                        <span className="text-xs text-text-muted">{ref.notes}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {meal.components.some((c) => (c.recipeRefs ?? []).length > 0) && (
            <div data-testid="component-recipe-refs">
              <h4 className="mb-1 text-sm font-semibold text-text-secondary">Component recipes</h4>
              <div className="space-y-1">
                {meal.components
                  .filter((c) => (c.recipeRefs ?? []).length > 0)
                  .map((c, ci) => {
                    const ingName = ingredientName(c.ingredientId);
                    return (c.recipeRefs ?? []).map((cr, ri) => {
                      const isAlt = cr.notes?.startsWith("alt:");
                      const altIngId = isAlt ? cr.notes!.slice(4) : null;
                      const altIngName = altIngId ? ingredientName(altIngId) : null;
                      return (
                        <div
                          key={`${c.id}-${ri}`}
                          className="flex flex-wrap items-center gap-2 text-sm"
                          data-testid={`comp-recipe-${ci}-${ri}`}
                        >
                          <span className="text-text-muted">{c.role}:</span>
                          <span className="font-medium text-text-primary">
                            {isAlt ? `Alt (${altIngName ?? altIngId})` : ingName}
                          </span>
                          <span className="text-text-secondary">
                            {summarizeRecipeRef(cr, {
                              linkedMealName: household.baseMeals.find((m) => m.id === cr.linkedBaseMealId)?.name,
                            })}
                          </span>
                          {cr.isDefault && (
                            <Chip variant="success" className="text-[10px]">default</Chip>
                          )}
                        </div>
                      );
                    });
                  })}
              </div>
            </div>
          )}
        </Section>
      )}

      {meal.recipeLinks && meal.recipeLinks.length > 0 && (
        <Section title="Recipe links">
          <div className="space-y-2" data-testid="recipe-links">
            {meal.recipeLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-brand hover:underline"
                  data-testid={`recipe-link-${i}`}
                >
                  {link.label}
                </a>
              </div>
            ))}
          </div>
        </Section>
      )}

      {meal.provenance && (
        <Section title="Import info">
          <div className="flex flex-wrap gap-3 text-sm text-text-secondary" data-testid="meal-provenance">
            <span>Source: {meal.provenance.sourceSystem}</span>
            {meal.provenance.sourceUrl && (
              <a
                href={meal.provenance.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                Original recipe
              </a>
            )}
            <span>Imported: {new Date(meal.provenance.importTimestamp).toLocaleDateString()}</span>
            {meal.prepTimeMinutes != null && meal.prepTimeMinutes > 0 && (
              <span>Prep: {meal.prepTimeMinutes} min</span>
            )}
            {meal.cookTimeMinutes != null && meal.cookTimeMinutes > 0 && (
              <span>Cook: {meal.cookTimeMinutes} min</span>
            )}
            {meal.servings && <span>Servings: {meal.servings}</span>}
          </div>
        </Section>
      )}

      {meal.importMappings && meal.importMappings.length > 0 && (
        <Section title="Original recipe lines">
          <div className="space-y-1" data-testid="import-mappings">
            {meal.importMappings.map((mapping, i) => {
              const finalName =
                mapping.finalCanonicalName ??
                (mapping.finalMatchedIngredientId
                  ? household.ingredients.find((i) => i.id === mapping.finalMatchedIngredientId)?.name
                  : undefined);
              return (
                <div key={i} className="flex flex-col gap-0.5 border-b border-border-light/60 py-2 last:border-0 sm:flex-row sm:flex-wrap sm:items-start sm:gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip
                      variant={
                        mapping.action === "use" ? "success"
                        : mapping.action === "create" ? "warning"
                        : "neutral"
                      }
                      className="text-[10px]"
                    >
                      {mapping.chosenAction ?? mapping.action}
                    </Chip>
                    {mapping.confidenceBand && (
                      <Chip variant="neutral" className="text-[10px]">
                        {mapping.confidenceBand}
                      </Chip>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-text-muted">
                      <span className="font-medium text-text-secondary">Raw</span> {mapping.originalLine}
                    </p>
                    {mapping.parsedName && (
                      <p className="text-text-muted">
                        <span className="font-medium text-text-secondary">Parsed</span>{" "}
                        {toSentenceCase(mapping.parsedName)}
                      </p>
                    )}
                    {finalName && (
                      <p className="text-text-primary">
                        <span className="font-medium text-text-secondary">Result</span>{" "}
                        {toSentenceCase(finalName)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {meal.provenance && onPersistMeal && (
            <ImportMappingAdjust meal={meal} household={household} onPersist={onPersistMeal} />
          )}
        </Section>
      )}

      {meal.notes && (
        <Section title="Notes">
          <p className="text-sm text-text-secondary whitespace-pre-wrap" data-testid="meal-notes">
            {meal.notes}
          </p>
        </Section>
      )}

      <Section title="Per-member assembly">
        <div className="space-y-3" data-testid="member-variants">
          {variants.map((variant) => {
            const member = household.members.find(
              (m) => m.id === variant.memberId,
            );
            if (!member) return null;
            const memberOverlap = overlap.memberDetails.find(
              (d) => d.memberId === member.id,
            );
            const compatVariant =
              memberOverlap?.compatibility === "direct" ? "success"
              : memberOverlap?.compatibility === "with-adaptation" ? "warning"
              : "danger";

            return (
              <Card
                key={variant.id}
                data-testid={`variant-${member.id}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-base font-semibold text-text-primary">
                    {member.name} ({member.role})
                  </h3>
                  <Chip variant={compatVariant as "success" | "warning" | "danger"}>
                    {memberOverlap?.compatibility === "direct"
                      ? "compatible"
                      : memberOverlap?.compatibility === "with-adaptation"
                        ? "needs adaptation"
                        : "conflict"}
                  </Chip>
                  {variant.requiresExtraPrep && (
                    <Chip variant="warning">extra prep</Chip>
                  )}
                </div>
                <ul className="space-y-0.5 pl-5 text-sm">
                  {variant.instructions.map((instr, i) => (
                    <li key={i}>{instr}</li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </Section>
    </>
  );
}

function MealStructure({
  componentsByRole,
  ingredientName,
  household,
}: {
  componentsByRole: Map<string, BaseMeal["components"]>;
  ingredientName: (id: string) => string;
  household: Household;
}) {
  const roleLabels: Record<string, string> = {
    protein: "Protein options",
    carb: "Carb options",
    veg: "Vegetables",
    sauce: "Sauces",
    topping: "Toppings",
  };

  const roleOrder = ["protein", "carb", "veg", "sauce", "topping"];

  return (
    <Section title="Meal structure">
      <div className="space-y-4" data-testid="meal-structure">
        {roleOrder.map((role) => {
          const components = componentsByRole.get(role);
          if (!components || components.length === 0) return null;

          return (
            <div key={role} data-testid={`structure-${role}`}>
              <h3 className="mb-1 text-sm font-semibold text-text-secondary">
                {roleLabels[role] ?? role}
              </h3>
              <div className="flex flex-wrap gap-2">
                {components.map((comp, i) => {
                  const allIds = getAllIngredientIds(comp);
                  const hasAlternatives = allIds.length > 1;

                  return (
                    <Card key={i} className="!p-3">
                      <span className="text-sm font-medium text-text-primary">
                        {ingredientName(comp.ingredientId)}
                      </span>
                      {comp.quantity && (
                        <span className="ml-1 text-xs text-text-muted">({comp.quantity})</span>
                      )}
                      {(comp.recipeRefs ?? []).filter((r) => !r.notes?.startsWith("alt:")).length > 0 && (
                        <div className="mt-1">
                          <span className="text-xs text-text-muted">Recipe: </span>
                          <span className="text-xs text-text-secondary">
                            {summarizeRecipeRef(
                              (comp.recipeRefs ?? []).find((r) => !r.notes?.startsWith("alt:") && r.isDefault) ??
                              (comp.recipeRefs ?? []).find((r) => !r.notes?.startsWith("alt:")),
                              { linkedMealName: household.baseMeals.find((m) => m.id === (comp.recipeRefs ?? [])[0]?.linkedBaseMealId)?.name },
                            )}
                          </span>
                        </div>
                      )}
                      {hasAlternatives && (
                        <div className="mt-1" data-testid="protein-alternatives">
                          <span className="text-xs text-text-muted">or: </span>
                          {comp.alternativeIngredientIds!.map((altId) => {
                            const altRef = (comp.recipeRefs ?? []).find(
                              (r) => r.notes?.startsWith(`alt:${altId}`),
                            );
                            return (
                              <span key={altId} className="mr-1 inline-flex items-center gap-0.5">
                                <Chip variant="info">
                                  {ingredientName(altId)}
                                </Chip>
                                {altRef && (
                                  <span className="text-[10px] text-text-muted">
                                    ({summarizeRecipeRef(altRef, {
                                      linkedMealName: household.baseMeals.find((m) => m.id === altRef.linkedBaseMealId)?.name,
                                    })})
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
