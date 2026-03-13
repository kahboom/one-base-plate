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

function getTextureInstruction(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): string | null {
  if (member.textureLevel === "regular") return null;

  const name = resolveIngredientName(component.ingredientId, ingredients);
  const ing = ingredients.find((i) => i.id === component.ingredientId);

  if (member.textureLevel === "mashable" || member.textureLevel === "pureed") {
    if (ing && !ing.babySafeWithAdaptation) {
      return `${name}: may not be suitable — check texture safety`;
    }
    const verb = member.textureLevel === "pureed" ? "puree" : "mash or cut into small safe pieces";
    return `${name}: ${verb} before serving`;
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

    for (const component of meal.components) {
      if (isComponentExcluded(component, member, ingredients)) {
        const name = resolveIngredientName(component.ingredientId, ingredients);
        excludedNames.push(name);
      } else {
        includedComponents.push(component);
      }
    }

    if (excludedNames.length > 0) {
      instructions.push(`Exclude: ${excludedNames.join(", ")}`);
    }

    for (const component of includedComponents) {
      if (isSafeFoodComponent(component, member, ingredients)) {
        safeFoodIncluded = true;
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

    if (
      !safeFoodIncluded &&
      (member.role === "toddler" || member.role === "baby")
    ) {
      if (member.safeFoods.length > 0) {
        instructions.push(
          `Add a safe food on the side: ${member.safeFoods.slice(0, 3).join(", ")}`,
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
