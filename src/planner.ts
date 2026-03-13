import type {
  AssemblyVariant,
  BaseMeal,
  DayPlan,
  HouseholdMember,
  Ingredient,
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
      const name = resolveIngredientName(component.ingredientId, ingredients);
      const ing = ingredients.find((i) => i.id === component.ingredientId);
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
      const name = resolveIngredientName(c.ingredientId, ingredients);
      return member.safeFoods.some((s) => matchesFood(s, name));
    });
    if (!hasSafeFood) {
      tradeOffs.push(`${member.name} has no safe food in this meal — add a side`);
    }
  }

  return { summary, tradeOffs };
}

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function generateWeeklyPlan(
  meals: BaseMeal[],
  members: HouseholdMember[],
  ingredients: Ingredient[],
  numDays: number = 7,
): DayPlan[] {
  if (meals.length === 0 || numDays <= 0) return [];

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

        const score = overlap.score + reuseBonus * 0.5 - repeatPenalty;
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
      if (isComponentExcluded(component, member, ingredients)) {
        const name = resolveIngredientName(component.ingredientId, ingredients);
        excludedNames.push(name);
      } else if (isBabyUnsafe(component, member, ingredients)) {
        const name = resolveIngredientName(component.ingredientId, ingredients);
        babyUnsafeNames.push(name);
      } else {
        includedComponents.push(component);
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
