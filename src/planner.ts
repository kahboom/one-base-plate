import type {
  AssemblyVariant,
  BaseMeal,
  DayPlan,
  GroceryItem,
  HouseholdMember,
  Ingredient,
  IngredientCategory,
  MealComponent,
} from "./types";

function resolveIngredientName(
  ingredientId: string,
  ingredients: Ingredient[],
): string {
  const found = ingredients.find((i) => i.id === ingredientId);
  return found ? found.name : ingredientId;
}

function matchesFood(food: string, ingredientName: string): boolean {
  return food.toLowerCase() === ingredientName.toLowerCase();
}

export function getAllIngredientIds(component: MealComponent): string[] {
  const ids = [component.ingredientId];
  if (component.alternativeIngredientIds) {
    ids.push(...component.alternativeIngredientIds);
  }
  return ids;
}

function pickBestIngredient(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): string {
  const ids = getAllIngredientIds(component);
  if (ids.length === 1) return ids[0]!;

  let bestId = ids[0]!;
  let bestScore = -Infinity;

  for (const id of ids) {
    const name = resolveIngredientName(id, ingredients);
    const ing = ingredients.find((i) => i.id === id);
    const { compatibility } = getMemberIngredientCompatibility(name, ing, member);

    let score = 0;
    if (compatibility === "direct") score = 3;
    else if (compatibility === "with-adaptation") score = 1;
    else score = -1; // conflict

    // Bonus for safe food match
    if (member.safeFoods.some((s) => matchesFood(s, name))) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId;
}

function isComponentExcluded(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): boolean {
  const name = resolveIngredientName(component.ingredientId, ingredients);
  return member.hardNoFoods.some((h) => matchesFood(h, name));
}

function getPreparationInstruction(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): string | null {
  const name = resolveIngredientName(component.ingredientId, ingredients);
  const rule = member.preparationRules.find((r) =>
    matchesFood(r.ingredient, name),
  );
  return rule ? `${name}: ${rule.rule}` : null;
}

function isBabyUnsafe(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): boolean {
  if (member.role !== "baby") return false;
  const ing = ingredients.find((i) => i.id === component.ingredientId);
  return !!ing && !ing.babySafeWithAdaptation;
}

function getBabyTextureGuidance(
  component: MealComponent,
  ingredients: Ingredient[],
): string {
  const name = resolveIngredientName(component.ingredientId, ingredients);
  switch (component.role) {
    case "protein":
      return `${name}: shred finely or blend to safe texture`;
    case "carb":
      return `${name}: cook until very soft, cut into finger-safe pieces`;
    case "veg":
      return `${name}: steam until very soft, mash or cut into finger-safe strips`;
    case "sauce":
      return `${name}: ensure no chunks, serve smooth`;
    case "topping":
      return `${name}: omit or blend into base`;
  }
}

function getTextureInstruction(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): string | null {
  if (member.textureLevel === "regular") return null;

  if (member.role === "baby" && (member.textureLevel === "mashable" || member.textureLevel === "pureed")) {
    return getBabyTextureGuidance(component, ingredients);
  }

  const name = resolveIngredientName(component.ingredientId, ingredients);

  if (member.textureLevel === "pureed") {
    return `${name}: puree before serving`;
  }

  if (member.textureLevel === "mashable") {
    return `${name}: mash or cut into small safe pieces`;
  }

  if (member.textureLevel === "soft") {
    return `${name}: ensure soft texture`;
  }

  return null;
}

function isSafeFoodComponent(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): boolean {
  const name = resolveIngredientName(component.ingredientId, ingredients);
  return member.safeFoods.some((s) => matchesFood(s, name));
}

export type MemberCompatibility = "direct" | "with-adaptation" | "conflict";

export interface MemberOverlap {
  memberId: string;
  memberName: string;
  compatibility: MemberCompatibility;
  conflicts: string[];
}

export interface OverlapResult {
  score: number;
  total: number;
  memberDetails: MemberOverlap[];
}

function getMemberIngredientCompatibility(
  ingredientName: string,
  ingredient: Ingredient | undefined,
  member: HouseholdMember,
): { compatibility: MemberCompatibility; conflict: string | null } {
  if (member.hardNoFoods.some((h) => matchesFood(h, ingredientName))) {
    return { compatibility: "conflict", conflict: `${ingredientName} (hard-no)` };
  }
  if (member.role === "baby" && ingredient && !ingredient.babySafeWithAdaptation) {
    return { compatibility: "conflict", conflict: `${ingredientName} (not baby-safe)` };
  }
  if (
    member.textureLevel !== "regular" ||
    member.preparationRules.some((r) => matchesFood(r.ingredient, ingredientName))
  ) {
    return { compatibility: "with-adaptation", conflict: null };
  }
  return { compatibility: "direct", conflict: null };
}

export function computeIngredientOverlap(
  ingredientId: string,
  members: HouseholdMember[],
  ingredients: Ingredient[],
): OverlapResult {
  const name = resolveIngredientName(ingredientId, ingredients);
  const ing = ingredients.find((i) => i.id === ingredientId);

  const memberDetails: MemberOverlap[] = members.map((member) => {
    const { compatibility, conflict } = getMemberIngredientCompatibility(name, ing, member);
    return {
      memberId: member.id,
      memberName: member.name,
      compatibility,
      conflicts: conflict ? [conflict] : [],
    };
  });

  const compatible = memberDetails.filter((d) => d.compatibility !== "conflict").length;

  return {
    score: compatible,
    total: members.length,
    memberDetails,
  };
}

export function computeMealOverlap(
  meal: BaseMeal,
  members: HouseholdMember[],
  ingredients: Ingredient[],
): OverlapResult {
  const memberDetails: MemberOverlap[] = members.map((member) => {
    const conflicts: string[] = [];
    let hasConflict = false;
    let needsAdaptation = false;

    for (const component of meal.components) {
      const bestId = pickBestIngredient(component, member, ingredients);
      const name = resolveIngredientName(bestId, ingredients);
      const ing = ingredients.find((i) => i.id === bestId);
      const { compatibility, conflict } = getMemberIngredientCompatibility(name, ing, member);

      if (compatibility === "conflict") {
        hasConflict = true;
        if (conflict) conflicts.push(conflict);
      } else if (compatibility === "with-adaptation") {
        needsAdaptation = true;
      }
    }

    let compatibility: MemberCompatibility;
    if (hasConflict) {
      compatibility = "conflict";
    } else if (needsAdaptation) {
      compatibility = "with-adaptation";
    } else {
      compatibility = "direct";
    }

    return {
      memberId: member.id,
      memberName: member.name,
      compatibility,
      conflicts,
    };
  });

  const compatible = memberDetails.filter((d) => d.compatibility !== "conflict").length;

  return {
    score: compatible,
    total: members.length,
    memberDetails,
  };
}

export interface MealExplanation {
  summary: string;
  tradeOffs: string[];
}

export function generateMealExplanation(
  meal: BaseMeal,
  members: HouseholdMember[],
  ingredients: Ingredient[],
): MealExplanation {
  const overlap = computeMealOverlap(meal, members, ingredients);
  const tradeOffs: string[] = [];

  const adaptMembers = overlap.memberDetails.filter((d) => d.compatibility === "with-adaptation");
  const conflictMembers = overlap.memberDetails.filter((d) => d.compatibility === "conflict");

  // Build summary
  let summary: string;
  if (overlap.score === overlap.total) {
    if (adaptMembers.length === 0) {
      summary = "Works for everyone — no modifications needed.";
    } else {
      summary = `Works for everyone — ${adaptMembers.length === 1 ? `${adaptMembers[0]!.memberName} needs` : `${adaptMembers.length} members need`} adaptation.`;
    }
  } else if (overlap.score === 0) {
    summary = "No members can eat this meal without conflicts.";
  } else {
    const names = conflictMembers.map((d) => d.memberName).join(", ");
    summary = `Works for ${overlap.score}/${overlap.total} members — ${names} ${conflictMembers.length === 1 ? "has" : "have"} conflicts.`;
  }

  // Trade-offs: conflicts
  for (const d of conflictMembers) {
    tradeOffs.push(`${d.memberName}: ${d.conflicts.join(", ")}`);
  }

  // Trade-offs: extra prep needed
  if (adaptMembers.length > 0) {
    const names = adaptMembers.map((d) => d.memberName).join(", ");
    tradeOffs.push(`Extra prep needed for ${names}`);
  }

  // Trade-offs: toddler/baby safe food coverage
  for (const member of members) {
    if (member.role !== "toddler" && member.role !== "baby") continue;
    const hasSafeFood = meal.components.some((c) => {
      const bestId = pickBestIngredient(c, member, ingredients);
      const name = resolveIngredientName(bestId, ingredients);
      return member.safeFoods.some((s) => matchesFood(s, name));
    });
    if (!hasSafeFood) {
      tradeOffs.push(`${member.name} has no safe food in this meal — add a side`);
    }
  }

  return { summary, tradeOffs };
}

export function generateShortReason(
  meal: BaseMeal,
  members: HouseholdMember[],
  ingredients: Ingredient[],
): string {
  const overlap = computeMealOverlap(meal, members, ingredients);

  if (overlap.score === overlap.total) {
    const adaptMembers = overlap.memberDetails.filter((d) => d.compatibility === "with-adaptation");
    if (adaptMembers.length === 0) return "Works for everyone";

    // Find the most interesting adaptation reason
    for (const member of members) {
      if (member.role === "toddler" || member.role === "baby") {
        const hasSafe = meal.components.some((c) => {
          const bestId = pickBestIngredient(c, member, ingredients);
          const name = resolveIngredientName(bestId, ingredients);
          return member.safeFoods.some((s) => matchesFood(s, name));
        });
        if (hasSafe) return `${member.name}'s safe food included`;
      }
      if (member.preparationRules.length > 0) {
        const matched = member.preparationRules.find((r) =>
          meal.components.some((c) => matchesFood(r.ingredient, resolveIngredientName(c.ingredientId, ingredients))),
        );
        if (matched) return `${matched.rule.toLowerCase().includes("separate") ? "sauce separate works" : "prep rules handled"}`;
      }
    }
    return "Works with small adaptations";
  }

  if (overlap.score === 0) return "Conflicts for all members";

  return `Fits ${overlap.score} of ${overlap.total} members`;
}

export interface GroceryPreview {
  uniqueIngredientCount: number;
  categoryBreakdown: Record<string, number>;
}

export function computeGroceryPreview(
  days: DayPlan[],
  meals: BaseMeal[],
  ingredients: Ingredient[],
): GroceryPreview {
  const ingredientIds = new Set<string>();

  for (const day of days) {
    const meal = meals.find((m) => m.id === day.baseMealId);
    if (!meal) continue;
    for (const component of meal.components) {
      ingredientIds.add(component.ingredientId);
      if (component.alternativeIngredientIds) {
        for (const altId of component.alternativeIngredientIds) {
          ingredientIds.add(altId);
        }
      }
    }
  }

  const categoryBreakdown: Record<string, number> = {};
  for (const id of ingredientIds) {
    const ing = ingredients.find((i) => i.id === id);
    if (ing) {
      categoryBreakdown[ing.category] = (categoryBreakdown[ing.category] ?? 0) + 1;
    }
  }

  return { uniqueIngredientCount: ingredientIds.size, categoryBreakdown };
}

export interface WeekEffortBalance {
  totalPrepMinutes: number;
  effortCounts: { easy: number; medium: number; hard: number };
  highEffortDays: string[];
}

export function computeWeekEffortBalance(
  days: DayPlan[],
  meals: BaseMeal[],
): WeekEffortBalance {
  const effortCounts = { easy: 0, medium: 0, hard: 0 };
  let totalPrepMinutes = 0;
  const highEffortDays: string[] = [];

  for (const day of days) {
    const meal = meals.find((m) => m.id === day.baseMealId);
    if (!meal) continue;
    effortCounts[meal.difficulty] += 1;
    totalPrepMinutes += meal.estimatedTimeMinutes;
    if (meal.difficulty === "hard") {
      highEffortDays.push(day.day);
    }
  }

  return { totalPrepMinutes, effortCounts, highEffortDays };
}

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function generateWeeklyPlan(
  meals: BaseMeal[],
  members: HouseholdMember[],
  ingredients: Ingredient[],
  numDays: number = 7,
  pinnedMealIds: string[] = [],
): DayPlan[] {
  if (meals.length === 0 || numDays <= 0) return [];

  const pinnedSet = new Set(pinnedMealIds);

  const rankedMeals = [...meals]
    .map((meal) => ({
      meal,
      overlap: computeMealOverlap(meal, members, ingredients),
    }))
    .sort((a, b) => b.overlap.score - a.overlap.score);

  const days: DayPlan[] = [];
  const usedIngredientCounts = new Map<string, number>();

  for (let d = 0; d < numDays; d++) {
    let bestMeal: BaseMeal;

    if (d === 0 || meals.length === 1) {
      bestMeal = rankedMeals[0]!.meal;
    } else {
      // Score each meal by overlap + ingredient reuse bonus
      let bestScore = -Infinity;
      bestMeal = rankedMeals[0]!.meal;

      for (const { meal, overlap } of rankedMeals) {
        let reuseBonus = 0;
        for (const c of meal.components) {
          if (usedIngredientCounts.has(c.ingredientId)) {
            reuseBonus += 1;
          }
        }
        // Penalize repeating the same meal on consecutive days
        const prevMealId = days[d - 1]?.baseMealId;
        const repeatPenalty = meal.id === prevMealId ? 3 : 0;

        // Bonus for pinned meals
        const pinnedBonus = pinnedSet.has(meal.id) ? 2 : 0;

        const score = overlap.score + reuseBonus * 0.5 - repeatPenalty + pinnedBonus;
        if (score > bestScore) {
          bestScore = score;
          bestMeal = meal;
        }
      }
    }

    // Track ingredient usage
    for (const c of bestMeal.components) {
      usedIngredientCounts.set(
        c.ingredientId,
        (usedIngredientCounts.get(c.ingredientId) ?? 0) + 1,
      );
    }

    const variants = generateAssemblyVariants(bestMeal, members, ingredients);
    days.push({
      day: DAY_LABELS[d % DAY_LABELS.length]!,
      baseMealId: bestMeal.id,
      variants,
    });
  }

  return days;
}

export interface GroceryListItem extends GroceryItem {
  usedInMeals: string[];
}

const CATEGORY_ORDER: IngredientCategory[] = [
  "protein", "carb", "veg", "fruit", "dairy", "snack", "freezer", "pantry",
];

export function generateGroceryList(
  days: DayPlan[],
  meals: BaseMeal[],
  ingredients: Ingredient[],
): GroceryListItem[] {
  const itemMap = new Map<string, { quantity: number; mealNames: Set<string> }>();

  for (const day of days) {
    const meal = meals.find((m) => m.id === day.baseMealId);
    if (!meal) continue;

    for (const component of meal.components) {
      const allIds = getAllIngredientIds(component);
      for (const id of allIds) {
        const existing = itemMap.get(id);
        if (existing) {
          existing.quantity += 1;
          existing.mealNames.add(meal.name);
        } else {
          itemMap.set(id, { quantity: 1, mealNames: new Set([meal.name]) });
        }
      }
    }
  }

  const items: GroceryListItem[] = [];
  for (const [id, data] of itemMap) {
    const ing = ingredients.find((i) => i.id === id);
    items.push({
      ingredientId: id,
      name: ing?.name ?? id,
      category: ing?.category ?? "pantry",
      quantity: data.quantity > 1 ? `×${data.quantity}` : "",
      owned: false,
      usedInMeals: [...data.mealNames],
    });
  }

  items.sort((a, b) => {
    const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });

  return items;
}

export type RescueScenario = "low-energy" | "low-time" | "everyone-melting-down";

export interface RescueMeal {
  meal: BaseMeal;
  overlap: OverlapResult;
  variants: AssemblyVariant[];
  prepSummary: string;
  confidence: string;
}

export function generateRescueMeals(
  meals: BaseMeal[],
  members: HouseholdMember[],
  ingredients: Ingredient[],
  scenario: RescueScenario,
): RescueMeal[] {
  const rescueEligible = meals.filter((m) => m.rescueEligible);
  const pool = rescueEligible.length > 0 ? rescueEligible : meals;
  if (pool.length === 0) return [];

  const stapleCategories = new Set(["freezer", "pantry"]);

  const scored = pool.map((meal) => {
    const overlap = computeMealOverlap(meal, members, ingredients);

    // Base score: overlap
    let score = overlap.score * 10;

    // Bonus for using freezer/pantry staples
    const stapleCount = meal.components.filter((c) => {
      const ing = ingredients.find((i) => i.id === c.ingredientId);
      return ing && (stapleCategories.has(ing.category) || ing.freezerFriendly);
    }).length;
    score += stapleCount * 3;

    // Scenario-specific scoring
    if (scenario === "low-time") {
      score -= meal.estimatedTimeMinutes * 0.5;
      if (meal.difficulty === "easy") score += 5;
    } else if (scenario === "low-energy") {
      if (meal.difficulty === "easy") score += 8;
      else if (meal.difficulty === "medium") score += 2;
      else score -= 5;
      score -= meal.estimatedTimeMinutes * 0.3;
    } else {
      // everyone-melting-down: maximize safe food coverage
      for (const member of members) {
        if (member.role !== "toddler" && member.role !== "baby") continue;
        const hasSafe = meal.components.some((c) => {
          const bestId = pickBestIngredient(c, member, ingredients);
          const name = resolveIngredientName(bestId, ingredients);
          return member.safeFoods.some((s) => matchesFood(s, name));
        });
        if (hasSafe) score += 5;
      }
      if (meal.difficulty === "easy") score += 5;
      score -= meal.estimatedTimeMinutes * 0.4;
    }

    return { meal, overlap, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map(({ meal, overlap }) => {
    const variants = generateAssemblyVariants(meal, members, ingredients);
    const prepSummary = `${meal.estimatedTimeMinutes} min · ${meal.difficulty} effort`;
    const confidence =
      meal.estimatedTimeMinutes <= 15
        ? `${meal.estimatedTimeMinutes}-minute save`
        : meal.difficulty === "easy"
          ? "good for tired nights"
          : "doable with a little prep";
    return { meal, overlap, variants, prepSummary, confidence };
  });
}

export function generateAssemblyVariants(
  meal: BaseMeal,
  members: HouseholdMember[],
  ingredients: Ingredient[],
): AssemblyVariant[] {
  return members.map((member) => {
    const instructions: string[] = [];
    let requiresExtraPrep = false;
    let safeFoodIncluded = false;

    const includedComponents: MealComponent[] = [];
    const excludedNames: string[] = [];

    const babyUnsafeNames: string[] = [];

    for (const component of meal.components) {
      // For multi-option components, pick the best ingredient for this member
      const hasAlternatives = component.alternativeIngredientIds && component.alternativeIngredientIds.length > 0;
      let resolvedComponent = component;

      if (hasAlternatives) {
        const bestId = pickBestIngredient(component, member, ingredients);
        if (bestId !== component.ingredientId) {
          resolvedComponent = { ...component, ingredientId: bestId, alternativeIngredientIds: undefined };
          const chosenName = resolveIngredientName(bestId, ingredients);
          const allNames = getAllIngredientIds(component).map((id) => resolveIngredientName(id, ingredients));
          instructions.push(`Protein option: ${chosenName} (from ${allNames.join(", ")})`);
        }
      }

      if (isComponentExcluded(resolvedComponent, member, ingredients)) {
        const name = resolveIngredientName(resolvedComponent.ingredientId, ingredients);
        excludedNames.push(name);
      } else if (isBabyUnsafe(resolvedComponent, member, ingredients)) {
        const name = resolveIngredientName(resolvedComponent.ingredientId, ingredients);
        babyUnsafeNames.push(name);
      } else {
        includedComponents.push(resolvedComponent);
      }
    }

    if (excludedNames.length > 0) {
      instructions.push(`Exclude: ${excludedNames.join(", ")}`);
    }

    if (babyUnsafeNames.length > 0) {
      instructions.push(`Not suitable for baby — skip: ${babyUnsafeNames.join(", ")}`);
      requiresExtraPrep = true;
    }

    const matchedSafeFoods: string[] = [];

    for (const component of includedComponents) {
      if (isSafeFoodComponent(component, member, ingredients)) {
        safeFoodIncluded = true;
        const name = resolveIngredientName(component.ingredientId, ingredients);
        matchedSafeFoods.push(name);
      }

      const prepInstruction = getPreparationInstruction(
        component,
        member,
        ingredients,
      );
      if (prepInstruction) {
        instructions.push(prepInstruction);
        requiresExtraPrep = true;
      }

      const textureInstruction = getTextureInstruction(
        component,
        member,
        ingredients,
      );
      if (textureInstruction) {
        instructions.push(textureInstruction);
        requiresExtraPrep = true;
      }
    }

    if (includedComponents.length === 0) {
      instructions.push(
        "No compatible components — serve a fallback safe food instead",
      );
    } else if (instructions.length === 0) {
      instructions.push("Serve as prepared — no modifications needed");
    }

    if (member.role === "toddler" || member.role === "baby") {
      if (safeFoodIncluded) {
        instructions.push(`Includes safe food: ${matchedSafeFoods.join(", ")}`);
      } else if (member.safeFoods.length > 0) {
        instructions.push(
          `No safe food in this meal — add on the side: ${member.safeFoods.slice(0, 3).join(", ")}`,
        );
      } else {
        instructions.push("No safe food matched — consider adding a familiar side");
      }
    }

    return {
      id: `${meal.id}-${member.id}`,
      baseMealId: meal.id,
      memberId: member.id,
      instructions,
      requiresExtraPrep,
      safeFoodIncluded,
    };
  });
}
