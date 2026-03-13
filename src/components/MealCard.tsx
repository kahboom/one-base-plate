import type { BaseMeal, HouseholdMember, Ingredient } from "../types";
import type { OverlapResult } from "../planner";
import { computeMealOverlap, generateShortReason } from "../planner";

export interface MealCardProps {
  meal: BaseMeal;
  members: HouseholdMember[];
  ingredients: Ingredient[];
  overlap?: OverlapResult;
  onAssign?: () => void;
  onOpen?: () => void;
  compact?: boolean;
}

const chipStyle = (bg: string, color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "0.15rem 0.5rem",
  borderRadius: "999px",
  fontSize: "0.75rem",
  fontWeight: 500,
  background: bg,
  color,
  marginRight: "0.25rem",
  marginBottom: "0.25rem",
});

const compatColors: Record<string, { bg: string; color: string }> = {
  direct: { bg: "#d4edda", color: "#155724" },
  "with-adaptation": { bg: "#fff3cd", color: "#856404" },
  conflict: { bg: "#f8d7da", color: "#721c24" },
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
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: compact ? "0.75rem" : "1rem",
        background: "#fff",
        minWidth: compact ? "160px" : "220px",
      }}
    >
      <div style={{ marginBottom: "0.5rem" }}>
        <strong style={{ fontSize: compact ? "0.95rem" : "1.1rem" }}>
          {meal.name}
        </strong>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.85rem", color: "#555", marginBottom: "0.5rem" }}>
        <span data-testid="prep-time">{meal.estimatedTimeMinutes} min</span>
        <span data-testid="effort-level">{meal.difficulty}</span>
        <span data-testid="overlap-score">{overlap.score}/{overlap.total} overlap</span>
      </div>

      <div data-testid="compatibility-chips" style={{ marginBottom: "0.5rem" }}>
        {overlap.memberDetails.map((detail) => {
          const member = members.find((m) => m.id === detail.memberId);
          if (!member) return null;
          const colors = compatColors[detail.compatibility] ?? compatColors.direct!;
          const label = roleLabels[member.role] ?? member.role;
          return (
            <span
              key={detail.memberId}
              data-testid={`chip-${detail.memberId}`}
              style={chipStyle(colors.bg, colors.color)}
              title={
                detail.compatibility === "conflict"
                  ? detail.conflicts.join(", ")
                  : detail.compatibility === "with-adaptation"
                    ? "Needs adaptation"
                    : "Compatible"
              }
            >
              {member.name} ({label})
            </span>
          );
        })}
      </div>

      <p
        data-testid="short-reason"
        style={{ fontSize: "0.8rem", color: "#666", margin: "0 0 0.5rem", fontStyle: "italic" }}
      >
        {shortReason}
      </p>

      <div data-testid="state-chips" style={{ marginBottom: "0.5rem" }}>
        {isHighOverlap && (
          <span style={chipStyle("#cce5ff", "#004085")}>High overlap</span>
        )}
        {needsExtraPrep && (
          <span style={chipStyle("#fff3cd", "#856404")}>Needs extra prep</span>
        )}
        {meal.rescueEligible && (
          <span style={chipStyle("#e2e3e5", "#383d41")}>Rescue eligible</span>
        )}
      </div>

      {!compact && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {onAssign && (
            <button
              type="button"
              onClick={onAssign}
              data-testid={`assign-${meal.id}`}
              style={{ fontSize: "0.8rem" }}
            >
              Assign
            </button>
          )}
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              data-testid={`open-${meal.id}`}
              style={{ fontSize: "0.8rem" }}
            >
              Details
            </button>
          )}
        </div>
      )}
    </div>
  );
}
