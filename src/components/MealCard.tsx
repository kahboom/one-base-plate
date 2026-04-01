import { Link } from 'react-router-dom';
import type { BaseMeal, HouseholdMember, Ingredient, MealOutcome, Recipe } from '../types';
import type { OverlapResult, LearnedPatterns } from '../planner';
import { computeMealOverlap, generateShortReason } from '../planner';
import { countMealRecipes } from '../lib/componentRecipes';
import { Chip, Button } from './ui';
import MealImageSlot from './MealImageSlot';

export interface MealCardProps {
  meal: BaseMeal;
  members: HouseholdMember[];
  ingredients: Ingredient[];
  /** Accepted but no longer used for image resolution; kept for backward compatibility with callers. */
  recipes?: Recipe[];
  overlap?: OverlapResult;
  outcomes?: MealOutcome[];
  patterns?: LearnedPatterns;
  onAssign?: () => void;
  onOpen?: () => void;
  onDetailClick?: () => void;
  onPin?: () => void;
  pinned?: boolean;
  detailUrl?: string;
  compact?: boolean;
  /** When compact, still render assign/pin/details (e.g. Weekly Planner tray). */
  showActionsWhenCompact?: boolean;
  draggable?: boolean;
  selected?: boolean;
  /** When this meal matches the active weekly theme anchor (weak signal). */
  themeMatch?: boolean;
}

const compatVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  direct: 'success',
  'with-adaptation': 'warning',
  conflict: 'danger',
};

const roleLabels: Record<string, string> = {
  adult: 'Adult',
  toddler: 'Toddler',
  baby: 'Baby',
};

/** Native tooltip (hover) for the overlap line on meal cards. */
const OVERLAP_TOOLTIP =
  'How many household members can eat this meal without an ingredient conflict. Adaptations may still be needed. Pets are not counted.';

export default function MealCard({
  meal,
  members,
  ingredients,
  overlap: overlapProp,
  outcomes = [],
  patterns,
  onAssign,
  onOpen,
  onDetailClick,
  onPin,
  pinned = false,
  detailUrl,
  compact = false,
  showActionsWhenCompact = false,
  draggable: isDraggable = false,
  selected = false,
  themeMatch = false,
}: MealCardProps) {
  const overlap = overlapProp ?? computeMealOverlap(meal, members, ingredients);
  const shortReason = generateShortReason(meal, members, ingredients, outcomes, patterns);
  const isHighOverlap = overlap.score === overlap.total;
  const needsExtraPrep = overlap.memberDetails.some((d) => d.compatibility === 'with-adaptation');
  const tightTray = compact && showActionsWhenCompact;
  const cardImageVariant = tightTray ? 'card-tight' : compact ? 'card-compact' : 'card';
  const recipeCount = countMealRecipes(meal);
  const displayImageUrl = meal.imageUrl;

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('application/meal-id', meal.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div
      data-testid={`meal-card-${meal.id}`}
      draggable={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      className={`w-full rounded-md border bg-surface shadow-card transition-shadow hover:shadow-card-hover sm:w-auto ${
        selected ? 'border-brand ring-2 ring-brand/40' : 'border-border-light'
      } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
        tightTray
          ? 'sm:min-w-[150px] p-2.5'
          : compact
            ? 'sm:min-w-[160px] p-3'
            : 'sm:min-w-[220px] p-4'
      } ${tightTray ? 'flex h-full min-h-0 flex-col' : ''}`}
    >
      <MealImageSlot
        variant={cardImageVariant}
        imageUrl={displayImageUrl}
        alt={meal.name}
        imageTestId="meal-card-image"
        placeholderTestId="meal-thumb-placeholder"
      />
      <div className={tightTray ? 'mb-1.5' : 'mb-2'}>
        <strong className={compact ? 'text-[0.95rem]' : 'text-lg'}>{meal.name}</strong>
      </div>

      <div
        className={`flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-text-secondary ${tightTray ? 'mb-1.5' : 'mb-2'}`}
      >
        <span data-testid="prep-time">{meal.estimatedTimeMinutes} min</span>
        <span data-testid="effort-level">{meal.difficulty}</span>
        <span
          data-testid="overlap-score"
          title={OVERLAP_TOOLTIP}
          className="cursor-help border-b border-dotted border-current/30"
        >
          {overlap.score}/{overlap.total} overlap
        </span>
        {recipeCount > 0 && (
          <span data-testid="recipe-count" className="text-text-muted">
            {recipeCount} recipe{recipeCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div
        data-testid="compatibility-chips"
        className={`flex flex-wrap gap-1 ${tightTray ? 'mb-1.5' : 'mb-2'}`}
      >
        {overlap.memberDetails.map((detail) => {
          const member = members.find((m) => m.id === detail.memberId);
          if (!member) return null;
          const variant = compatVariant[detail.compatibility] ?? 'success';
          const label = roleLabels[member.role] ?? member.role;
          return (
            <Chip
              key={detail.memberId}
              data-testid={`chip-${detail.memberId}`}
              variant={variant}
              title={
                detail.compatibility === 'conflict'
                  ? detail.conflicts.join(', ')
                  : detail.compatibility === 'with-adaptation'
                    ? 'Needs adaptation'
                    : 'Compatible'
              }
            >
              {member.name} ({label})
            </Chip>
          );
        })}
      </div>

      <p
        data-testid="short-reason"
        className={`text-xs italic text-text-muted ${tightTray ? 'mb-1.5 line-clamp-2' : 'mb-2'}`}
      >
        {shortReason}
      </p>

      <div
        data-testid="state-chips"
        className={`flex flex-wrap gap-1 ${tightTray ? 'mb-1.5' : 'mb-2'}`}
      >
        {pinned && <Chip variant="success">Pinned</Chip>}
        {isHighOverlap && <Chip variant="info">High overlap</Chip>}
        {needsExtraPrep && <Chip variant="warning">Needs extra prep</Chip>}
        {meal.rescueEligible && <Chip variant="neutral">Rescue eligible</Chip>}
        {themeMatch && (
          <Chip variant="info" data-testid="theme-match-chip">
            Matches theme
          </Chip>
        )}
      </div>

      {(!compact || showActionsWhenCompact) && (
        <div className={`flex flex-wrap ${tightTray ? 'mt-auto gap-1.5' : 'gap-2'}`}>
          {onAssign && (
            <Button
              small
              onClick={(e) => {
                e.stopPropagation();
                onAssign();
              }}
              data-testid={`assign-${meal.id}`}
            >
              Assign
            </Button>
          )}
          {onPin && (
            <Button
              small
              variant={pinned ? 'danger' : 'default'}
              onClick={(e) => {
                e.stopPropagation();
                onPin();
              }}
              data-testid={`pin-${meal.id}`}
            >
              {pinned ? 'Unpin' : 'Pin'}
            </Button>
          )}
          {onOpen && (
            <Button
              small
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              data-testid={`open-${meal.id}`}
            >
              Details
            </Button>
          )}
          {onDetailClick && !onOpen && (
            <Button
              small
              onClick={(e) => {
                e.stopPropagation();
                onDetailClick();
              }}
              data-testid={`detail-link-${meal.id}`}
            >
              Details
            </Button>
          )}
          {detailUrl && !onOpen && !onDetailClick && (
            <Link to={detailUrl} onClick={(e) => e.stopPropagation()}>
              <Button small data-testid={`detail-link-${meal.id}`}>
                Details
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
