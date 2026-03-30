import type {
  AssemblyVariant,
  BaseMeal,
  DayPlan,
  GroceryItem,
  HouseholdMember,
  Ingredient,
  IngredientCategory,
  MealComponent,
  MealOutcome,
  WeeklyAnchor,
} from './types';

function isHumanMember(member: HouseholdMember): boolean {
  return member.role !== 'pet';
}

function resolveIngredientName(ingredientId: string, ingredients: Ingredient[]): string {
  const found = ingredients.find((i) => i.id === ingredientId);
  return found ? found.name : ingredientId;
}

function matchesFood(food: string, ingredientName: string): boolean {
  return food.toLowerCase() === ingredientName.toLowerCase();
}

/**
 * Resolve an array of food name strings (from member safeFoods / hardNoFoods)
 * to a Set of household Ingredient entity IDs via case-insensitive name lookup.
 * F074: matching is direct id equality, not opaque name comparison.
 */
function resolveFoodIds(foods: string[], ingredients: Ingredient[]): Set<string> {
  const ids = new Set<string>();
  for (const food of foods) {
    const lower = food.toLowerCase();
    const match = ingredients.find((i) => i.name.toLowerCase() === lower);
    if (match) ids.add(match.id);
  }
  return ids;
}

// ── F074 Preference Scoring ────────────────────────────────────────────────
// Fixed, testable coefficients — not learned weights.

const SAFE_FOOD_BOOST_CHILD = 5; // toddler / baby
const SAFE_FOOD_BOOST_ADULT = 2; // adult
const HARD_NO_PENALTY = -10; // strong deprioritisation

export interface PreferenceMatch {
  memberName: string;
  memberId: string;
  ingredientName: string;
}

export interface PreferenceScore {
  score: number;
  safeFoodMatches: PreferenceMatch[];
  hardNoConflicts: PreferenceMatch[];
}

/**
 * Compute a deterministic preference score for a meal based on member
 * safeFoods / hardNoFoods resolved as ingredient IDs.
 * Role weighting: toddler/baby boosts are stronger than adult boosts.
 */
export function computePreferenceScore(
  meal: BaseMeal,
  members: HouseholdMember[],
  ingredients: Ingredient[],
): PreferenceScore {
  let score = 0;
  const safeFoodMatches: PreferenceMatch[] = [];
  const hardNoConflicts: PreferenceMatch[] = [];

  const mealIngredientIds = new Set(
    meal.components.flatMap((c) => getAllIngredientIds(c)),
  );

  for (const member of members.filter(isHumanMember)) {
    const safeIds = resolveFoodIds(member.safeFoods, ingredients);
    const hardNoIds = resolveFoodIds(member.hardNoFoods, ingredients);
    const boost =
      member.role === 'toddler' || member.role === 'baby'
        ? SAFE_FOOD_BOOST_CHILD
        : SAFE_FOOD_BOOST_ADULT;

    for (const id of mealIngredientIds) {
      if (safeIds.has(id)) {
        score += boost;
        safeFoodMatches.push({
          memberName: member.name,
          memberId: member.id,
          ingredientName: resolveIngredientName(id, ingredients),
        });
      }
      if (hardNoIds.has(id)) {
        score += HARD_NO_PENALTY;
        hardNoConflicts.push({
          memberName: member.name,
          memberId: member.id,
          ingredientName: resolveIngredientName(id, ingredients),
        });
      }
    }
  }

  return { score, safeFoodMatches, hardNoConflicts };
}

export function getAllIngredientIds(component: MealComponent): string[] {
  const ids = [component.ingredientId];
  if (component.alternativeIngredientIds) {
    ids.push(...component.alternativeIngredientIds);
  }
  return ids;
}

function getValidIngredientIds(component: MealComponent): string[] {
  const seen = new Set<string>();
  const validIds: string[] = [];
  for (const id of getAllIngredientIds(component)) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    validIds.push(trimmed);
  }
  return validIds;
}

function pickBestIngredient(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): string {
  const ids = getAllIngredientIds(component);
  if (ids.length === 1) return ids[0]!;

  const safeIds = resolveFoodIds(member.safeFoods, ingredients);

  let bestId = ids[0]!;
  let bestScore = -Infinity;

  for (const id of ids) {
    const name = resolveIngredientName(id, ingredients);
    const ing = ingredients.find((i) => i.id === id);
    const { compatibility } = getMemberIngredientCompatibility(name, ing, member, ingredients);

    let score = 0;
    if (compatibility === 'direct') score = 3;
    else if (compatibility === 'with-adaptation') score = 1;
    else score = -1; // conflict

    // F074: ID-based safe food bonus
    if (safeIds.has(id)) score += 2;

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
  const hardNoIds = resolveFoodIds(member.hardNoFoods, ingredients);
  return getAllIngredientIds(component).some((id) => hardNoIds.has(id));
}

function getPreparationInstruction(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): string | null {
  const name = resolveIngredientName(component.ingredientId, ingredients);
  const rule = member.preparationRules.find((r) => matchesFood(r.ingredient, name));
  return rule ? `${name}: ${rule.rule}` : null;
}

function isBabyUnsafe(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): boolean {
  if (member.role !== 'baby') return false;
  const ing = ingredients.find((i) => i.id === component.ingredientId);
  return !!ing && !ing.babySafeWithAdaptation;
}

function getBabyTextureGuidance(component: MealComponent, ingredients: Ingredient[]): string {
  const name = resolveIngredientName(component.ingredientId, ingredients);
  switch (component.role) {
    case 'protein':
      return `${name}: shred finely or blend to safe texture`;
    case 'carb':
      return `${name}: cook until very soft, cut into finger-safe pieces`;
    case 'veg':
      return `${name}: steam until very soft, mash or cut into finger-safe strips`;
    case 'sauce':
      return `${name}: ensure no chunks, serve smooth`;
    case 'topping':
      return `${name}: omit or blend into base`;
  }
}

function getTextureInstruction(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): string | null {
  if (member.textureLevel === 'regular') return null;

  if (
    member.role === 'baby' &&
    (member.textureLevel === 'mashable' || member.textureLevel === 'pureed')
  ) {
    return getBabyTextureGuidance(component, ingredients);
  }

  const name = resolveIngredientName(component.ingredientId, ingredients);

  if (member.textureLevel === 'pureed') {
    return `${name}: puree before serving`;
  }

  if (member.textureLevel === 'mashable') {
    return `${name}: mash or cut into small safe pieces`;
  }

  if (member.textureLevel === 'soft') {
    return `${name}: ensure soft texture`;
  }

  return null;
}

function isSafeFoodComponent(
  component: MealComponent,
  member: HouseholdMember,
  ingredients: Ingredient[],
): boolean {
  const safeIds = resolveFoodIds(member.safeFoods, ingredients);
  return getAllIngredientIds(component).some((id) => safeIds.has(id));
}

export type MemberCompatibility = 'direct' | 'with-adaptation' | 'conflict';

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
  allIngredients?: Ingredient[],
): { compatibility: MemberCompatibility; conflict: string | null } {
  // F074: ID-based hard-no matching when ingredient entity is available
  if (ingredient && allIngredients) {
    const hardNoIds = resolveFoodIds(member.hardNoFoods, allIngredients);
    if (hardNoIds.has(ingredient.id)) {
      return { compatibility: 'conflict', conflict: `${ingredientName} (hard-no)` };
    }
  } else if (member.hardNoFoods.some((h) => matchesFood(h, ingredientName))) {
    return { compatibility: 'conflict', conflict: `${ingredientName} (hard-no)` };
  }
  if (member.role === 'baby' && ingredient && !ingredient.babySafeWithAdaptation) {
    return { compatibility: 'conflict', conflict: `${ingredientName} (not baby-safe)` };
  }
  if (
    member.textureLevel !== 'regular' ||
    member.preparationRules.some((r) => matchesFood(r.ingredient, ingredientName))
  ) {
    return { compatibility: 'with-adaptation', conflict: null };
  }
  return { compatibility: 'direct', conflict: null };
}

export function computeIngredientOverlap(
  ingredientId: string,
  members: HouseholdMember[],
  ingredients: Ingredient[],
): OverlapResult {
  const humanMembers = members.filter(isHumanMember);
  const name = resolveIngredientName(ingredientId, ingredients);
  const ing = ingredients.find((i) => i.id === ingredientId);

  const memberDetails: MemberOverlap[] = humanMembers.map((member) => {
    const { compatibility, conflict } = getMemberIngredientCompatibility(name, ing, member, ingredients);
    return {
      memberId: member.id,
      memberName: member.name,
      compatibility,
      conflicts: conflict ? [conflict] : [],
    };
  });

  const compatible = memberDetails.filter((d) => d.compatibility !== 'conflict').length;

  return {
    score: compatible,
    total: humanMembers.length,
    memberDetails,
  };
}

export function computeMealOverlap(
  meal: BaseMeal,
  members: HouseholdMember[],
  ingredients: Ingredient[],
): OverlapResult {
  const humanMembers = members.filter(isHumanMember);
  const memberDetails: MemberOverlap[] = humanMembers.map((member) => {
    const conflicts: string[] = [];
    let hasConflict = false;
    let needsAdaptation = false;

    for (const component of meal.components) {
      const bestId = pickBestIngredient(component, member, ingredients);
      const name = resolveIngredientName(bestId, ingredients);
      const ing = ingredients.find((i) => i.id === bestId);
      const { compatibility, conflict } = getMemberIngredientCompatibility(name, ing, member, ingredients);

      if (compatibility === 'conflict') {
        hasConflict = true;
        if (conflict) conflicts.push(conflict);
      } else if (compatibility === 'with-adaptation') {
        needsAdaptation = true;
      }
    }

    let compatibility: MemberCompatibility;
    if (hasConflict) {
      compatibility = 'conflict';
    } else if (needsAdaptation) {
      compatibility = 'with-adaptation';
    } else {
      compatibility = 'direct';
    }

    return {
      memberId: member.id,
      memberName: member.name,
      compatibility,
      conflicts,
    };
  });

  const compatible = memberDetails.filter((d) => d.compatibility !== 'conflict').length;

  return {
    score: compatible,
    total: humanMembers.length,
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
  outcomes: MealOutcome[] = [],
  patterns?: LearnedPatterns,
): MealExplanation {
  const humanMembers = members.filter(isHumanMember);
  const overlap = computeMealOverlap(meal, humanMembers, ingredients);
  const tradeOffs: string[] = [];

  const adaptMembers = overlap.memberDetails.filter((d) => d.compatibility === 'with-adaptation');
  const conflictMembers = overlap.memberDetails.filter((d) => d.compatibility === 'conflict');

  // Build summary
  let summary: string;
  if (overlap.score === overlap.total) {
    if (adaptMembers.length === 0) {
      summary = 'Works for everyone — no modifications needed.';
    } else {
      summary = `Works for everyone — ${adaptMembers.length === 1 ? `${adaptMembers[0]!.memberName} needs` : `${adaptMembers.length} members need`} adaptation.`;
    }
  } else if (overlap.score === 0) {
    summary = 'No members can eat this meal without conflicts.';
  } else {
    const names = conflictMembers.map((d) => d.memberName).join(', ');
    summary = `Works for ${overlap.score}/${overlap.total} members — ${names} ${conflictMembers.length === 1 ? 'has' : 'have'} conflicts.`;
  }

  // Trade-offs: conflicts
  for (const d of conflictMembers) {
    tradeOffs.push(`${d.memberName}: ${d.conflicts.join(', ')}`);
  }

  // Trade-offs: extra prep needed
  if (adaptMembers.length > 0) {
    const names = adaptMembers.map((d) => d.memberName).join(', ');
    tradeOffs.push(`Extra prep needed for ${names}`);
  }

  // F074: preference-based explanations from the deterministic ledger
  const prefScore = computePreferenceScore(meal, humanMembers, ingredients);

  // Safe food matches (cite member name + ingredient display name)
  if (prefScore.safeFoodMatches.length > 0) {
    const grouped = new Map<string, string[]>();
    for (const m of prefScore.safeFoodMatches) {
      const arr = grouped.get(m.memberName) ?? [];
      arr.push(m.ingredientName);
      grouped.set(m.memberName, arr);
    }
    for (const [name, foods] of grouped) {
      tradeOffs.push(`includes ${name}-safe ${foods.join(', ')}`);
    }
  }

  // Trade-offs: toddler/baby safe food coverage gap
  for (const member of humanMembers) {
    if (member.role !== 'toddler' && member.role !== 'baby') continue;
    const hasSafeFood = meal.components.some((c) =>
      isSafeFoodComponent(c, member, ingredients),
    );
    if (!hasSafeFood) {
      if (member.safeFoods.length > 0) {
        tradeOffs.push(
          `${member.name} has no safe food in this meal — add on the side: ${member.safeFoods.slice(0, 3).join(', ')}`,
        );
      } else {
        tradeOffs.push(`${member.name} has no safe food in this meal — add a side`);
      }
    }
  }

  // Outcome-based insights
  const outcomeScore = computeOutcomeScore(meal.id, outcomes);
  if (outcomeScore.total > 0) {
    if (outcomeScore.label) {
      tradeOffs.push(
        `Past results: ${outcomeScore.label} (${outcomeScore.successCount} success, ${outcomeScore.failureCount} failure)`,
      );
    }
  }

  // Pattern-based insights
  if (patterns && patterns.insights.length > 0) {
    const mealIngredientIds = new Set(meal.components.flatMap((c) => getAllIngredientIds(c)));
    const relevantInsights = patterns.insights.filter((insight) => {
      // Show prep rule and safe food insights if relevant to this meal
      if (insight.includes('prep tend to work') || insight.includes('safe foods for kids')) {
        return true;
      }
      // Show ingredient insights only if this meal uses the ingredient
      for (const id of mealIngredientIds) {
        const name = resolveIngredientName(id, ingredients);
        if (insight.toLowerCase().includes(name.toLowerCase())) return true;
      }
      return false;
    });
    for (const insight of relevantInsights.slice(0, 3)) {
      tradeOffs.push(`Learned: ${insight}`);
    }
  }

  return { summary, tradeOffs };
}

export function generateShortReason(
  meal: BaseMeal,
  members: HouseholdMember[],
  ingredients: Ingredient[],
  outcomes: MealOutcome[] = [],
  patterns?: LearnedPatterns,
): string {
  const humanMembers = members.filter(isHumanMember);
  // Outcome-based reasons take priority when strong signal
  const outcomeScore = computeOutcomeScore(meal.id, outcomes);
  if (outcomeScore.successCount >= 3) return 'Household favorite';
  if (outcomeScore.failureCount > 0 && outcomeScore.successCount === 0) return "Often doesn't work";

  // Pattern-based reasons when patterns are learned
  if (patterns && patterns.insights.length > 0) {
    const patternScore = computePatternScore(meal, patterns, humanMembers, ingredients);
    if (patternScore >= 3) return 'Matches household patterns';
    if (patternScore <= -3) return 'Clashes with learned preferences';
  }

  // F074: preference-based short reasons
  const prefScore = computePreferenceScore(meal, humanMembers, ingredients);

  const overlap = computeMealOverlap(meal, humanMembers, ingredients);

  if (overlap.score === overlap.total) {
    const adaptMembers = overlap.memberDetails.filter((d) => d.compatibility === 'with-adaptation');
    if (adaptMembers.length === 0) {
      // Surface safe food match as reason when all members fit
      if (prefScore.safeFoodMatches.length > 0) {
        const first = prefScore.safeFoodMatches[0]!;
        return `includes ${first.memberName}-safe ${first.ingredientName}`;
      }
      return 'Works for everyone';
    }

    // Find the most interesting adaptation reason
    for (const member of humanMembers) {
      if (member.role === 'toddler' || member.role === 'baby') {
        const hasSafe = meal.components.some((c) =>
          isSafeFoodComponent(c, member, ingredients),
        );
        if (hasSafe) return `${member.name}'s safe food included`;
      }
      if (member.preparationRules.length > 0) {
        const matched = member.preparationRules.find((r) =>
          meal.components.some((c) =>
            matchesFood(r.ingredient, resolveIngredientName(c.ingredientId, ingredients)),
          ),
        );
        if (matched)
          return `${matched.rule.toLowerCase().includes('separate') ? 'sauce separate works' : 'prep rules handled'}`;
      }
    }
    return 'Works with small adaptations';
  }

  if (overlap.score === 0) {
    if (prefScore.hardNoConflicts.length > 0) {
      const first = prefScore.hardNoConflicts[0]!;
      return `${first.memberName} hard-no: ${first.ingredientName}`;
    }
    return 'Conflicts for all members';
  }

  // F074: surface hard-no detail in partial-fit reason
  if (prefScore.hardNoConflicts.length > 0) {
    const first = prefScore.hardNoConflicts[0]!;
    return `Fits ${overlap.score} of ${overlap.total} — ${first.memberName} hard-no: ${first.ingredientName}`;
  }

  return `Fits ${overlap.score} of ${overlap.total} members`;
}

export interface OutcomeScore {
  score: number;
  successCount: number;
  partialCount: number;
  failureCount: number;
  total: number;
  label: string;
}

export function computeOutcomeScore(mealId: string, outcomes: MealOutcome[]): OutcomeScore {
  const mealOutcomes = outcomes.filter((o) => o.baseMealId === mealId);
  const successCount = mealOutcomes.filter((o) => o.outcome === 'success').length;
  const partialCount = mealOutcomes.filter((o) => o.outcome === 'partial').length;
  const failureCount = mealOutcomes.filter((o) => o.outcome === 'failure').length;
  const total = mealOutcomes.length;

  // +2 per success, +0.5 per partial, -3 per failure
  const score = successCount * 2 + partialCount * 0.5 - failureCount * 3;

  let label = '';
  if (total === 0) {
    label = '';
  } else if (failureCount > 0 && successCount === 0) {
    label = 'repeated failures';
  } else if (failureCount > successCount) {
    label = "often doesn't work";
  } else if (successCount >= 3) {
    label = 'household favorite';
  } else if (successCount >= 1 && failureCount === 0) {
    label = 'reliable choice';
  } else if (successCount > failureCount) {
    label = 'mostly works';
  } else {
    label = 'mixed results';
  }

  return { score, successCount, partialCount, failureCount, total, label };
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
      for (const id of getValidIngredientIds(component)) {
        ingredientIds.add(id);
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

export function computeWeekEffortBalance(days: DayPlan[], meals: BaseMeal[]): WeekEffortBalance {
  const effortCounts = { easy: 0, medium: 0, hard: 0 };
  let totalPrepMinutes = 0;
  const highEffortDays: string[] = [];

  for (const day of days) {
    const meal = meals.find((m) => m.id === day.baseMealId);
    if (!meal) continue;
    effortCounts[meal.difficulty] += 1;
    totalPrepMinutes += meal.estimatedTimeMinutes;
    if (meal.difficulty === 'hard') {
      highEffortDays.push(day.day);
    }
  }

  return { totalPrepMinutes, effortCounts, highEffortDays };
}

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function generateWeeklyPlan(
  meals: BaseMeal[],
  members: HouseholdMember[],
  ingredients: Ingredient[],
  numDays: number = 7,
  pinnedMealIds: string[] = [],
  outcomes: MealOutcome[] = [],
): DayPlan[] {
  if (meals.length === 0 || numDays <= 0) return [];

  const pinnedSet = new Set(pinnedMealIds);

  const outcomeScores = new Map<string, number>();
  for (const meal of meals) {
    const os = computeOutcomeScore(meal.id, outcomes);
    outcomeScores.set(meal.id, os.score);
  }

  // Learn compatibility patterns from outcomes and member edits
  const patterns = learnCompatibilityPatterns(outcomes, meals, members, ingredients);
  const patternScores = new Map<string, number>();
  for (const meal of meals) {
    patternScores.set(meal.id, computePatternScore(meal, patterns, members, ingredients));
  }

  // F074: pre-compute preference scores for all meals
  const preferenceScores = new Map<string, number>();
  for (const meal of meals) {
    preferenceScores.set(meal.id, computePreferenceScore(meal, members, ingredients).score);
  }

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

        // Outcome-based bonus/penalty
        const outcomeBonus = outcomeScores.get(meal.id) ?? 0;

        // Pattern-based bonus from learned compatibility patterns
        const patternBonus = patternScores.get(meal.id) ?? 0;

        // F074: member preference bonus (safe food boosts, hard-no penalties)
        // Scaled to 0.1× so it acts as a meaningful tiebreaker without
        // overwhelming overlap, pinned, or outcome signals.
        const preferenceBonus = (preferenceScores.get(meal.id) ?? 0) * 0.1;

        const score =
          overlap.score +
          reuseBonus * 0.5 -
          repeatPenalty +
          pinnedBonus +
          outcomeBonus +
          patternBonus +
          preferenceBonus;
        if (score > bestScore) {
          bestScore = score;
          bestMeal = meal;
        }
      }
    }

    // Track ingredient usage
    for (const c of bestMeal.components) {
      usedIngredientCounts.set(c.ingredientId, (usedIngredientCounts.get(c.ingredientId) ?? 0) + 1);
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

function difficultySortKey(difficulty: BaseMeal['difficulty']): number {
  if (difficulty === 'easy') return 0;
  if (difficulty === 'medium') return 1;
  return 2;
}

function collectIngredientIdsFromPlanDays(days: DayPlan[], meals: BaseMeal[]): Set<string> {
  const ids = new Set<string>();
  for (const day of days) {
    const meal = meals.find((m) => m.id === day.baseMealId);
    if (!meal) continue;
    for (const c of meal.components) {
      for (const id of getValidIngredientIds(c)) {
        ids.add(id);
      }
    }
  }
  return ids;
}

function countMealIngredientReuse(meal: BaseMeal, planIngredientIds: Set<string>): number {
  let n = 0;
  for (const c of meal.components) {
    for (const id of getValidIngredientIds(c)) {
      if (planIngredientIds.has(id)) n += 1;
    }
  }
  return n;
}

/** One fully-ranked row for weekly “suggested meals” (tray + browse). */
export interface WeeklySuggestedMealRow {
  meal: BaseMeal;
  overlap: OverlapResult;
  /** 0 = default; 1 = already on this week (unless strong repeat); 2 = repeated failure signal */
  tier: number;
  outcomeScore: number;
  patternScore: number;
  /** F074: deterministic score from member safeFoods/hardNoFoods ID matching */
  preferenceScore: number;
  ingredientReuse: number;
  pinned: boolean;
  /** True when an optional weekly theme anchor matches; used only as a late tie-breaker. */
  themeMatch: boolean;
}

/** Values used when matching weekly theme anchors to meals (see deriveMealStructureTypes). */
export const MEAL_STRUCTURE_TYPE_OPTIONS = ['single-protein', 'multi-protein'] as const;

/** For soft theme matching on weekday anchors (multi-protein vs single, etc.). */
export function deriveMealStructureTypes(meal: BaseMeal): string[] {
  const proteinCount = meal.components.filter((c) => c.role === 'protein').length;
  return [proteinCount > 1 ? 'multi-protein' : 'single-protein'];
}

/**
 * Whether a meal matches a household’s weekly theme anchor. Disabled anchors never match.
 */
export function mealMatchesWeeklyAnchor(
  meal: BaseMeal,
  anchor: WeeklyAnchor | null | undefined,
): boolean {
  if (!anchor || anchor.enabled === false) return false;
  if (anchor.matchMealIds?.includes(meal.id)) return true;
  const tags = meal.tags ?? [];
  for (const t of anchor.matchTags) {
    if (tags.includes(t)) return true;
  }
  const structures = deriveMealStructureTypes(meal);
  for (const s of anchor.matchStructureTypes) {
    if (structures.includes(s)) return true;
  }
  return false;
}

/**
 * Rank meals for the Weekly Planner suggestion tray: household fit first, then learned
 * outcome/pattern signals, ingredient reuse vs the current plan, pins, optional weak theme
 * tie-breaker, then time/effort.
 */
export function rankWeeklySuggestedMeals(
  meals: BaseMeal[],
  members: HouseholdMember[],
  ingredients: Ingredient[],
  outcomes: MealOutcome[],
  pinnedMealIds: string[],
  planDays: DayPlan[],
  themeAnchor?: WeeklyAnchor | null,
): WeeklySuggestedMealRow[] {
  if (meals.length === 0) return [];

  const pinnedSet = new Set(pinnedMealIds);
  const patterns = learnCompatibilityPatterns(outcomes, meals, members, ingredients);
  const planIngredientIds = collectIngredientIdsFromPlanDays(planDays, meals);
  const assignedMealIds = new Set(planDays.map((d) => d.baseMealId));

  type SortRow = WeeklySuggestedMealRow & {
    _time: number;
    _difficulty: number;
  };

  const sortRows: SortRow[] = meals.map((meal) => {
    const overlap = computeMealOverlap(meal, members, ingredients);
    const os = computeOutcomeScore(meal.id, outcomes);
    const patternScore = computePatternScore(meal, patterns, members, ingredients);
    const prefScore = computePreferenceScore(meal, members, ingredients);
    const ingredientReuse = countMealIngredientReuse(meal, planIngredientIds);
    const pinned = pinnedSet.has(meal.id);
    const inWeek = assignedMealIds.has(meal.id);
    const strongRepeatOk = pinned || os.successCount >= 3;

    let tier = 0;
    const failureOnly = os.failureCount > 0 && os.successCount === 0;
    if (failureOnly && !pinned) {
      tier = 2;
    } else if (inWeek && !strongRepeatOk) {
      tier = 1;
    }

    const themeMatch = mealMatchesWeeklyAnchor(meal, themeAnchor);

    return {
      meal,
      overlap,
      tier,
      outcomeScore: os.score,
      patternScore,
      preferenceScore: prefScore.score,
      ingredientReuse,
      pinned,
      themeMatch,
      _time: meal.estimatedTimeMinutes,
      _difficulty: difficultySortKey(meal.difficulty),
    };
  });

  sortRows.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.overlap.score !== b.overlap.score) return b.overlap.score - a.overlap.score;
    if (a.overlap.total !== b.overlap.total) return b.overlap.total - a.overlap.total;
    if (a.outcomeScore !== b.outcomeScore) return b.outcomeScore - a.outcomeScore;
    if (a.patternScore !== b.patternScore) return b.patternScore - a.patternScore;
    if (a.preferenceScore !== b.preferenceScore) return b.preferenceScore - a.preferenceScore;
    if (a.ingredientReuse !== b.ingredientReuse) return b.ingredientReuse - a.ingredientReuse;
    const pa = a.pinned ? 1 : 0;
    const pb = b.pinned ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const ta = a.themeMatch ? 1 : 0;
    const tb = b.themeMatch ? 1 : 0;
    if (ta !== tb) return tb - ta;
    if (a._time !== b._time) return a._time - b._time;
    return a._difficulty - b._difficulty;
  });

  return sortRows.map((row) => {
    // Internal sort fields are not part of the public row shape.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip _time, _difficulty from spread
    const { _time, _difficulty, ...rest } = row;
    return rest;
  });
}

export interface GroceryMealRef {
  id: string;
  name: string;
}

export interface GroceryListItem extends GroceryItem {
  usedInMeals: GroceryMealRef[];
}

const CATEGORY_ORDER: IngredientCategory[] = [
  'protein',
  'carb',
  'veg',
  'fruit',
  'dairy',
  'snack',
  'freezer',
  'pantry',
];

export function generateGroceryList(
  days: DayPlan[],
  meals: BaseMeal[],
  ingredients: Ingredient[],
): GroceryListItem[] {
  const itemMap = new Map<string, { quantity: number; mealIds: Set<string> }>();

  for (const day of days) {
    const meal = meals.find((m) => m.id === day.baseMealId);
    if (!meal) continue;

    for (const component of meal.components) {
      const allIds = getValidIngredientIds(component);
      for (const id of allIds) {
        const existing = itemMap.get(id);
        if (existing) {
          existing.quantity += 1;
          existing.mealIds.add(meal.id);
        } else {
          itemMap.set(id, { quantity: 1, mealIds: new Set([meal.id]) });
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
      category: ing?.category ?? 'pantry',
      quantity: data.quantity > 1 ? `×${data.quantity}` : '',
      owned: false,
      usedInMeals: [...data.mealIds]
        .map((mealId) => {
          const m = meals.find((mm) => mm.id === mealId);
          return { id: mealId, name: m?.name ?? mealId };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  items.sort((a, b) => {
    const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });

  return items;
}

export function formatPlanForExport(
  days: DayPlan[],
  meals: BaseMeal[],
  members: HouseholdMember[],
  ingredients: Ingredient[],
  householdName: string,
): string {
  const lines: string[] = [];
  lines.push(`Weekly Meal Plan — ${householdName}`);
  lines.push('='.repeat(40));
  lines.push('');

  for (const day of days) {
    const meal = meals.find((m) => m.id === day.baseMealId);
    const mealName = meal?.name ?? day.baseMealId;
    lines.push(`${day.day}`);
    lines.push(`  Base meal: ${mealName}`);
    if (meal) {
      lines.push(`  Prep: ${meal.estimatedTimeMinutes} min · ${meal.difficulty}`);
    }

    for (const variant of day.variants) {
      const member = members.find((m) => m.id === variant.memberId);
      if (!member) continue;
      lines.push(`  ${member.name} (${member.role}):`);
      for (const instr of variant.instructions) {
        lines.push(`    - ${instr}`);
      }
    }
    lines.push('');
  }

  const groceryItems = generateGroceryList(days, meals, ingredients);
  if (groceryItems.length > 0) {
    lines.push('Grocery List');
    lines.push('-'.repeat(40));

    const grouped = new Map<IngredientCategory, GroceryListItem[]>();
    for (const item of groceryItems) {
      const list = grouped.get(item.category) ?? [];
      list.push(item);
      grouped.set(item.category, list);
    }

    for (const [category, catItems] of grouped) {
      lines.push(`  ${category.charAt(0).toUpperCase() + category.slice(1)}:`);
      for (const item of catItems) {
        const qty = item.quantity ? ` ${item.quantity}` : '';
        const meals_used =
          item.usedInMeals.length > 0 ? ` (${item.usedInMeals.map((m) => m.name).join(', ')})` : '';
        lines.push(`    - ${item.name}${qty}${meals_used}`);
      }
    }
  }

  return lines.join('\n');
}

export type RescueScenario = 'low-energy' | 'low-time' | 'everyone-melting-down';

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
  const humanMembers = members.filter(isHumanMember);
  const rescueEligible = meals.filter((m) => m.rescueEligible);
  const pool = rescueEligible.length > 0 ? rescueEligible : meals;
  if (pool.length === 0) return [];

  const stapleCategories = new Set(['freezer', 'pantry']);

  const scored = pool.map((meal) => {
    const overlap = computeMealOverlap(meal, humanMembers, ingredients);

    // Base score: overlap
    let score = overlap.score * 10;

    // F074: preference score (safe food boosts + hard-no penalties)
    const prefScore = computePreferenceScore(meal, humanMembers, ingredients);
    score += prefScore.score;

    // Bonus for using freezer/pantry staples
    const stapleCount = meal.components.filter((c) => {
      const ing = ingredients.find((i) => i.id === c.ingredientId);
      return ing && (stapleCategories.has(ing.category) || ing.freezerFriendly);
    }).length;
    score += stapleCount * 3;

    // Scenario-specific scoring
    if (scenario === 'low-time') {
      score -= meal.estimatedTimeMinutes * 0.5;
      if (meal.difficulty === 'easy') score += 5;
    } else if (scenario === 'low-energy') {
      if (meal.difficulty === 'easy') score += 8;
      else if (meal.difficulty === 'medium') score += 2;
      else score -= 5;
      score -= meal.estimatedTimeMinutes * 0.3;
    } else {
      // everyone-melting-down: maximize safe food coverage
      for (const member of humanMembers) {
        if (member.role !== 'toddler' && member.role !== 'baby') continue;
        const hasSafe = meal.components.some((c) =>
          isSafeFoodComponent(c, member, ingredients),
        );
        if (hasSafe) score += 5;
      }
      if (meal.difficulty === 'easy') score += 5;
      score -= meal.estimatedTimeMinutes * 0.4;
    }

    return { meal, overlap, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map(({ meal, overlap }) => {
    const variants = generateAssemblyVariants(meal, humanMembers, ingredients);
    const prepSummary = `${meal.estimatedTimeMinutes} min · ${meal.difficulty} effort`;
    const confidence =
      meal.estimatedTimeMinutes <= 15
        ? `${meal.estimatedTimeMinutes}-minute save`
        : meal.difficulty === 'easy'
          ? 'good for tired nights'
          : 'doable with a little prep';
    return { meal, overlap, variants, prepSummary, confidence };
  });
}

export interface LearnedPatterns {
  ingredientScores: Map<string, number>;
  prepRuleBoost: number;
  safeFoodBoost: number;
  insights: string[];
}

export function learnCompatibilityPatterns(
  outcomes: MealOutcome[],
  meals: BaseMeal[],
  members: HouseholdMember[],
  ingredients: Ingredient[],
): LearnedPatterns {
  const humanMembers = members.filter(isHumanMember);
  const ingredientScores = new Map<string, number>();
  const insights: string[] = [];

  if (outcomes.length === 0) {
    return { ingredientScores, prepRuleBoost: 0, safeFoodBoost: 0, insights };
  }

  // Track per-ingredient success/failure from outcomes
  const ingredientSuccesses = new Map<string, number>();
  const ingredientFailures = new Map<string, number>();

  // Track prep rule and safe food correlation
  let prepRuleMealsSuccess = 0;
  let prepRuleMealsTotal = 0;
  let safeFoodMealsSuccess = 0;
  let safeFoodMealsTotal = 0;

  // Track protein choices in successful vs failed meals
  const proteinSuccesses = new Map<string, number>();
  const proteinFailures = new Map<string, number>();

  for (const outcome of outcomes) {
    const meal = meals.find((m) => m.id === outcome.baseMealId);
    if (!meal) continue;

    const delta = outcome.outcome === 'success' ? 1 : outcome.outcome === 'failure' ? -1 : 0.25;

    // Score each ingredient in the meal
    for (const component of meal.components) {
      const allIds = getAllIngredientIds(component);
      for (const id of allIds) {
        ingredientScores.set(id, (ingredientScores.get(id) ?? 0) + delta);
      }

      if (outcome.outcome === 'success') {
        for (const id of allIds) {
          ingredientSuccesses.set(id, (ingredientSuccesses.get(id) ?? 0) + 1);
        }
      } else if (outcome.outcome === 'failure') {
        for (const id of allIds) {
          ingredientFailures.set(id, (ingredientFailures.get(id) ?? 0) + 1);
        }
      }

      // Track protein preferences
      if (component.role === 'protein') {
        const bestIds = new Set<string>();
        for (const member of humanMembers) {
          bestIds.add(pickBestIngredient(component, member, ingredients));
        }
        for (const pid of bestIds) {
          if (outcome.outcome === 'success') {
            proteinSuccesses.set(pid, (proteinSuccesses.get(pid) ?? 0) + 1);
          } else if (outcome.outcome === 'failure') {
            proteinFailures.set(pid, (proteinFailures.get(pid) ?? 0) + 1);
          }
        }
      }
    }

    // Check if prep rules were relevant to this meal
    const hasPrepRuleRelevance = humanMembers.some((member) =>
      member.preparationRules.some((rule) =>
        meal.components.some((c) => {
          const name = resolveIngredientName(c.ingredientId, ingredients);
          return matchesFood(rule.ingredient, name);
        }),
      ),
    );
    if (hasPrepRuleRelevance) {
      prepRuleMealsTotal++;
      if (outcome.outcome === 'success') prepRuleMealsSuccess++;
    }

    // Check safe food coverage for toddlers/babies
    const childMembers = humanMembers.filter((m) => m.role === 'toddler' || m.role === 'baby');
    if (childMembers.length > 0) {
      const hasSafeFoodCoverage = childMembers.some((member) =>
        meal.components.some((c) => {
          const bestId = pickBestIngredient(c, member, ingredients);
          const name = resolveIngredientName(bestId, ingredients);
          return member.safeFoods.some((s) => matchesFood(s, name));
        }),
      );
      if (hasSafeFoodCoverage) {
        safeFoodMealsTotal++;
        if (outcome.outcome === 'success') safeFoodMealsSuccess++;
      }
    }
  }

  // Compute prep rule boost
  let prepRuleBoost = 0;
  if (prepRuleMealsTotal >= 2) {
    const rate = prepRuleMealsSuccess / prepRuleMealsTotal;
    if (rate >= 0.7) {
      prepRuleBoost = 1.5;
      const ruleNames = [
        ...new Set(
          humanMembers.flatMap((m) => m.preparationRules.map((r) => r.rule.toLowerCase())),
        ),
      ];
      if (ruleNames.length > 0) {
        insights.push(`Meals with "${ruleNames[0]}" prep tend to work well`);
      }
    }
  }

  // Compute safe food boost
  let safeFoodBoost = 0;
  if (safeFoodMealsTotal >= 2) {
    const rate = safeFoodMealsSuccess / safeFoodMealsTotal;
    if (rate >= 0.7) {
      safeFoodBoost = 1.5;
      insights.push('Meals including safe foods for kids succeed more often');
    }
  }

  // Generate ingredient-level insights
  for (const [id, successes] of ingredientSuccesses) {
    const failures = ingredientFailures.get(id) ?? 0;
    const total = successes + failures;
    if (total >= 2 && successes > failures) {
      const name = resolveIngredientName(id, ingredients);
      insights.push(`${name} appears in successful meals`);
    }
  }
  for (const [id, failures] of ingredientFailures) {
    const successes = ingredientSuccesses.get(id) ?? 0;
    const total = successes + failures;
    if (total >= 2 && failures > successes) {
      const name = resolveIngredientName(id, ingredients);
      insights.push(`${name} often appears in failed meals`);
    }
  }

  // Protein preference insights
  for (const [pid, successes] of proteinSuccesses) {
    const failures = proteinFailures.get(pid) ?? 0;
    if (successes >= 2 && successes > failures) {
      const name = resolveIngredientName(pid, ingredients);
      insights.push(`${name} is a preferred protein choice`);
    }
  }

  return { ingredientScores, prepRuleBoost, safeFoodBoost, insights };
}

export function computePatternScore(
  meal: BaseMeal,
  patterns: LearnedPatterns,
  members: HouseholdMember[],
  ingredients: Ingredient[],
): number {
  const humanMembers = members.filter(isHumanMember);
  let score = 0;

  // Sum ingredient-level scores
  for (const component of meal.components) {
    const allIds = getAllIngredientIds(component);
    for (const id of allIds) {
      score += patterns.ingredientScores.get(id) ?? 0;
    }
  }

  // Apply prep rule boost if meal uses prep rules
  if (patterns.prepRuleBoost > 0) {
    const hasPrepRuleRelevance = humanMembers.some((member) =>
      member.preparationRules.some((rule) =>
        meal.components.some((c) => {
          const name = resolveIngredientName(c.ingredientId, ingredients);
          return matchesFood(rule.ingredient, name);
        }),
      ),
    );
    if (hasPrepRuleRelevance) {
      score += patterns.prepRuleBoost;
    }
  }

  // Apply safe food boost if meal covers child safe foods
  if (patterns.safeFoodBoost > 0) {
    const childMembers = humanMembers.filter((m) => m.role === 'toddler' || m.role === 'baby');
    const hasSafeFoodCoverage = childMembers.some((member) =>
      meal.components.some((c) => {
        const bestId = pickBestIngredient(c, member, ingredients);
        const name = resolveIngredientName(bestId, ingredients);
        return member.safeFoods.some((s) => matchesFood(s, name));
      }),
    );
    if (hasSafeFoodCoverage) {
      score += patterns.safeFoodBoost;
    }
  }

  return score;
}

export function generateAssemblyVariants(
  meal: BaseMeal,
  members: HouseholdMember[],
  ingredients: Ingredient[],
): AssemblyVariant[] {
  return members.filter(isHumanMember).map((member) => {
    const instructions: string[] = [];
    let requiresExtraPrep = false;
    let safeFoodIncluded = false;

    const includedComponents: MealComponent[] = [];
    const excludedNames: string[] = [];

    const babyUnsafeNames: string[] = [];

    for (const component of meal.components) {
      // For multi-option components, pick the best ingredient for this member
      const hasAlternatives =
        component.alternativeIngredientIds && component.alternativeIngredientIds.length > 0;
      let resolvedComponent = component;

      if (hasAlternatives) {
        const bestId = pickBestIngredient(component, member, ingredients);
        if (bestId !== component.ingredientId) {
          resolvedComponent = {
            ...component,
            ingredientId: bestId,
            alternativeIngredientIds: undefined,
          };
          const chosenName = resolveIngredientName(bestId, ingredients);
          const allNames = getAllIngredientIds(component).map((id) =>
            resolveIngredientName(id, ingredients),
          );
          instructions.push(`Protein option: ${chosenName} (from ${allNames.join(', ')})`);
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
      instructions.push(`Exclude: ${excludedNames.join(', ')}`);
    }

    if (babyUnsafeNames.length > 0) {
      instructions.push(`Not suitable for baby — skip: ${babyUnsafeNames.join(', ')}`);
      requiresExtraPrep = true;
    }

    const matchedSafeFoods: string[] = [];

    for (const component of includedComponents) {
      if (isSafeFoodComponent(component, member, ingredients)) {
        safeFoodIncluded = true;
        const name = resolveIngredientName(component.ingredientId, ingredients);
        matchedSafeFoods.push(name);
      }

      const prepInstruction = getPreparationInstruction(component, member, ingredients);
      if (prepInstruction) {
        instructions.push(prepInstruction);
        requiresExtraPrep = true;
      }

      const textureInstruction = getTextureInstruction(component, member, ingredients);
      if (textureInstruction) {
        instructions.push(textureInstruction);
        requiresExtraPrep = true;
      }
    }

    if (includedComponents.length === 0) {
      instructions.push('No compatible components — serve a fallback safe food instead');
    } else if (instructions.length === 0) {
      instructions.push('Serve as prepared — no modifications needed');
    }

    if (member.role === 'toddler' || member.role === 'baby') {
      if (safeFoodIncluded) {
        instructions.push(`Includes safe food: ${matchedSafeFoods.join(', ')}`);
      } else if (member.safeFoods.length > 0) {
        instructions.push(
          `No safe food in this meal — add on the side: ${member.safeFoods.slice(0, 3).join(', ')}`,
        );
      } else {
        instructions.push('No safe food matched — consider adding a familiar side');
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
