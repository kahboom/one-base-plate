import type { BaseMeal, HouseholdMember, Ingredient } from "../types";
import type { OverlapResult } from "../planner";
import { computeMealOverlap, generateShortReason } from "../planner";
import { Chip, Button } from "./ui";

export interface MealCardProps {
  meal: BaseMeal;
  members: HouseholdMember[];
  ingredients: Ingredient[];
  overlap?: OverlapResult;
  onAssign?: () => void;
  onOpen?: () => void;
  compact?: boolean;
}

const compatVariant: Record<string, "success" | "warning" | "danger"> = {
  direct: "success",
  "with-adaptation": "warning",
  conflict: "danger",
};

const roleLabels: Record<string, string> = {
  adult: "Adult",
  toddler: "Toddler",
  baby: "Baby",
};

export default function MealCard({
  meal,
  members,
  ingredients,
  overlap: overlapProp,
  onAssign,
  onOpen,
  compact = false,
}: MealCardProps) {
  const overlap = overlapProp ?? computeMealOverlap(meal, members, ingredients);
  const shortReason = generateShortReason(meal, members, ingredients);
  const isHighOverlap = overlap.score === overlap.total;
  const needsExtraPrep = overlap.memberDetails.some(
    (d) => d.compatibility === "with-adaptation",
  );

  return (
    <div
      data-testid={`meal-card-${meal.id}`}
      className={`rounded-md border border-border-light bg-surface shadow-card transition-shadow hover:shadow-card-hover ${compact ? "min-w-[160px] p-3" : "min-w-[220px] p-4"}`}
    >
      <div className="mb-2">
        <strong className={compact ? "text-[0.95rem]" : "text-lg"}>
          {meal.name}
        </strong>
      </div>

      <div className="mb-2 flex gap-3 text-sm text-text-secondary">
        <span data-testid="prep-time">{meal.estimatedTimeMinutes} min</span>
        <span data-testid="effort-level">{meal.difficulty}</span>
        <span data-testid="overlap-score">{overlap.score}/{overlap.total} overlap</span>
      </div>

      <div data-testid="compatibility-chips" className="mb-2 flex flex-wrap gap-1">
        {overlap.memberDetails.map((detail) => {
          const member = members.find((m) => m.id === detail.memberId);
          if (!member) return null;
          const variant = compatVariant[detail.compatibility] ?? "success";
          const label = roleLabels[member.role] ?? member.role;
          return (
            <Chip
              key={detail.memberId}
              data-testid={`chip-${detail.memberId}`}
              variant={variant}
              title={
                detail.compatibility === "conflict"
                  ? detail.conflicts.join(", ")
                  : detail.compatibility === "with-adaptation"
                    ? "Needs adaptation"
                    : "Compatible"
              }
            >
              {member.name} ({label})
            </Chip>
          );
        })}
      </div>

      <p
        data-testid="short-reason"
        className="mb-2 text-xs italic text-text-muted"
      >
        {shortReason}
      </p>

      <div data-testid="state-chips" className="mb-2 flex flex-wrap gap-1">
        {isHighOverlap && <Chip variant="info">High overlap</Chip>}
        {needsExtraPrep && <Chip variant="warning">Needs extra prep</Chip>}
        {meal.rescueEligible && <Chip variant="neutral">Rescue eligible</Chip>}
      </div>

      {!compact && (
        <div className="flex gap-2">
          {onAssign && (
            <Button
              small
              onClick={onAssign}
              data-testid={`assign-${meal.id}`}
            >
              Assign
            </Button>
          )}
          {onOpen && (
            <Button
              small
              onClick={onOpen}
              data-testid={`open-${meal.id}`}
            >
              Details
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
