import type {
  AssemblyVariant,
  BaseMeal,
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
