import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Household, BaseMeal } from "../types";
import { loadHousehold, saveHousehold, toSentenceCase } from "../storage";
import {
  generateAssemblyVariants,
  computeMealOverlap,
  getAllIngredientIds,
} from "../planner";
import { PageShell, PageHeader, Card, Button, Chip, Section, HouseholdNav } from "../components/ui";

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

  return (
    <PageShell>
      <HouseholdNav householdId={householdId ?? ""} />
      <PageHeader
        title={meal.name}
        subtitle={`Household: ${household.name}`}
        subtitleTo={`/household/${householdId}/home`}
      />
      <MealDetailContent
        meal={meal}
        household={household}
        overlapLabel={`${overlap.score}/${overlap.total}`}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
      />
    </PageShell>
  );
}

interface MealDetailContentProps {
  meal: BaseMeal;
  household: Household;
  overlapLabel: string;
  isPinned: boolean;
  onTogglePin: () => void;
}

export function MealDetailContent({
  meal,
  household,
  overlapLabel,
  isPinned,
  onTogglePin,
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
        {meal.imageUrl && (
          <img
            src={meal.imageUrl}
            alt={meal.name}
            className="mb-4 w-full max-h-64 rounded-md border border-border-light object-cover"
            data-testid="meal-hero-image"
          />
        )}
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
        meal={meal}
        componentsByRole={componentsByRole}
        ingredientName={ingredientName}
      />

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
  meal,
  componentsByRole,
  ingredientName,
}: {
  meal: BaseMeal;
  componentsByRole: Map<string, typeof meal.components>;
  ingredientName: (id: string) => string;
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
                      {hasAlternatives && (
                        <div className="mt-1" data-testid="protein-alternatives">
                          <span className="text-xs text-text-muted">or: </span>
                          {comp.alternativeIngredientIds!.map((altId) => (
                            <Chip key={altId} variant="info" className="mr-1">
                              {ingredientName(altId)}
                            </Chip>
                          ))}
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
