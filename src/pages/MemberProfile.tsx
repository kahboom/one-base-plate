import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { HouseholdMember, Ingredient, PreparationRule } from '../types';
import { loadHousehold, normalizeIngredientName, saveHousehold } from '../storage';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Section,
  FormRow,
  Chip,
  ConfirmDialog,
  useConfirm,
} from '../components/ui';
import IngredientCombobox, {
  type IngredientComboboxHandle,
} from '../components/IngredientCombobox';
import TagSuggestInput from '../components/TagSuggestInput';

function norm(s: string): string {
  return normalizeIngredientName(s);
}

export default function MemberProfile() {
  const { householdId, memberId } = useParams<{
    householdId: string;
    memberId: string;
  }>();
  const [member, setMember] = useState<HouseholdMember | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [householdName, setHouseholdName] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [safeFoodInput, setSafeFoodInput] = useState('');
  const [hardNoInput, setHardNoInput] = useState('');
  const [ruleIngredient, setRuleIngredient] = useState('');
  const [ruleText, setRuleText] = useState('');

  const [safeFamilyInput, setSafeFamilyInput] = useState('');
  const [hardNoFamilyInput, setHardNoFamilyInput] = useState('');

  const safeCombRef = useRef<IngredientComboboxHandle>(null);
  const hardCombRef = useRef<IngredientComboboxHandle>(null);

  const householdFamilyKeys = useMemo(() => {
    const set = new Set<string>();
    for (const ing of ingredients) {
      for (const fk of ing.familyKeys ?? []) {
        set.add(fk);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [ingredients]);

  useEffect(() => {
    if (!householdId || !memberId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    setHouseholdName(household.name);
    const found = household.members.find((m) => m.id === memberId);
    if (found) {
      setMember({ ...found });
      setIngredients([...household.ingredients]);
      setLoaded(true);
    }
  }, [householdId, memberId]);

  const { pending, requestConfirm, confirm, cancel } = useConfirm();
  useEffect(() => {
    if (!householdId || !member || !loaded) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    const index = household.members.findIndex((m) => m.id === member.id);
    if (index < 0) return;
    household.members[index] = member;
    household.ingredients = ingredients;
    saveHousehold(household);
  }, [householdId, loaded, member, ingredients]);

  function commitSafePlain(trimmed: string) {
    if (!member) return;
    const n = norm(trimmed);
    if (member.safeFoods.some((f) => norm(f) === n)) return;
    setMember({ ...member, safeFoods: [...member.safeFoods, trimmed] });
    setSafeFoodInput('');
  }

  function commitSafeFromIngredient(ing: Ingredient) {
    if (!member) return;
    const n = norm(ing.name);
    if (member.safeFoods.some((f) => norm(f) === n)) return;
    setMember({ ...member, safeFoods: [...member.safeFoods, ing.name] });
    setSafeFoodInput('');
  }

  function commitSafeCreate(ing: Ingredient) {
    if (!member) return;
    const n = norm(ing.name);
    if (member.safeFoods.some((f) => norm(f) === n)) return;
    setIngredients((prev) => [...prev, ing]);
    setMember({ ...member, safeFoods: [...member.safeFoods, ing.name] });
    setSafeFoodInput('');
  }

  function removeSafeFood(food: string) {
    if (!member) return;
    setMember({
      ...member,
      safeFoods: member.safeFoods.filter((f) => f !== food),
    });
  }

  function commitHardPlain(trimmed: string) {
    if (!member) return;
    const n = norm(trimmed);
    if (member.hardNoFoods.some((f) => norm(f) === n)) return;
    setMember({ ...member, hardNoFoods: [...member.hardNoFoods, trimmed] });
    setHardNoInput('');
  }

  function commitHardFromIngredient(ing: Ingredient) {
    if (!member) return;
    const n = norm(ing.name);
    if (member.hardNoFoods.some((f) => norm(f) === n)) return;
    setMember({ ...member, hardNoFoods: [...member.hardNoFoods, ing.name] });
    setHardNoInput('');
  }

  function commitHardCreate(ing: Ingredient) {
    if (!member) return;
    const n = norm(ing.name);
    if (member.hardNoFoods.some((f) => norm(f) === n)) return;
    setIngredients((prev) => [...prev, ing]);
    setMember({ ...member, hardNoFoods: [...member.hardNoFoods, ing.name] });
    setHardNoInput('');
  }

  function removeHardNo(food: string) {
    if (!member) return;
    setMember({
      ...member,
      hardNoFoods: member.hardNoFoods.filter((f) => f !== food),
    });
  }

  function commitRuleIngredientPlain(trimmed: string) {
    setRuleIngredient(trimmed);
  }

  function commitRuleIngredientFromIngredient(ing: Ingredient) {
    setRuleIngredient(ing.name);
  }

  function commitRuleIngredientCreate(ing: Ingredient) {
    setIngredients((prev) => [...prev, ing]);
    setRuleIngredient(ing.name);
  }

  function addPreparationRule() {
    const ingredient = ruleIngredient.trim();
    const rule = ruleText.trim();
    if (!ingredient || !rule || !member) return;
    const newRule: PreparationRule = { ingredient, rule };
    setMember({
      ...member,
      preparationRules: [...member.preparationRules, newRule],
    });
    setRuleIngredient('');
    setRuleText('');
  }

  function removePreparationRule(index: number) {
    if (!member) return;
    setMember({
      ...member,
      preparationRules: member.preparationRules.filter((_, i) => i !== index),
    });
  }

  function addSafeFamilyKey(key: string) {
    if (!member) return;
    const normalized = key.trim().toLowerCase();
    if (!normalized) return;
    const current = member.safeFoodFamilyKeys ?? [];
    if (current.includes(normalized)) return;
    setMember({ ...member, safeFoodFamilyKeys: [...current, normalized] });
    setSafeFamilyInput('');
  }

  function removeSafeFamilyKey(key: string) {
    if (!member) return;
    setMember({
      ...member,
      safeFoodFamilyKeys: (member.safeFoodFamilyKeys ?? []).filter((k) => k !== key),
    });
  }

  function addHardNoFamilyKey(key: string) {
    if (!member) return;
    const normalized = key.trim().toLowerCase();
    if (!normalized) return;
    const current = member.hardNoFoodFamilyKeys ?? [];
    if (current.includes(normalized)) return;
    setMember({ ...member, hardNoFoodFamilyKeys: [...current, normalized] });
    setHardNoFamilyInput('');
  }

  function removeHardNoFamilyKey(key: string) {
    if (!member) return;
    setMember({
      ...member,
      hardNoFoodFamilyKeys: (member.hardNoFoodFamilyKeys ?? []).filter((k) => k !== key),
    });
  }

  if (!member) return <p>Member not found.</p>;

  return (
    <>
      <PageHeader
        title={`${member.name} — ${member.role}`}
        subtitle={`Household: ${householdName}`}
        subtitleTo={`/households?edit=${householdId}`}
      />

      <Section title="Safe Foods">
        <Card>
          {member.safeFoods.length === 0 ? (
            <p className="mb-3 text-sm text-text-muted">No safe foods added yet.</p>
          ) : (
            <ul data-testid="safe-foods-list" className="mb-3 space-y-1">
              {member.safeFoods.map((food) => (
                <li key={food} className="flex items-center gap-2">
                  <Chip variant="success">{food}</Chip>
                  <Button
                    variant="danger"
                    small
                    className="!h-6 !w-6 !min-h-[24px] !px-0 !py-0 !text-[12px] leading-none"
                    aria-label={`Remove safe food ${food}`}
                    onClick={() =>
                      requestConfirm(food, () => {
                        removeSafeFood(food);
                      })
                    }
                  >
                    x
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <FormRow>
            <IngredientCombobox
              ref={safeCombRef}
              value={safeFoodInput}
              onChange={setSafeFoodInput}
              placeholder="Add safe food"
              ingredients={ingredients}
              isBlocked={(n) => member.safeFoods.some((f) => norm(f) === n)}
              onCommitPlain={commitSafePlain}
              onCommitFromIngredient={commitSafeFromIngredient}
              onCreateIngredientAndCommit={commitSafeCreate}
            />
            <Button onClick={() => safeCombRef.current?.submitPlain()}>Add safe food</Button>
          </FormRow>
        </Card>
      </Section>

      <Section title="Safe Food Families">
        <Card>
          <p className="mb-2 text-xs text-text-muted">
            Grouped preferences — broader than exact ingredients. A &quot;sausage&quot; family preference boosts any ingredient in the sausage family.
          </p>
          {(member.safeFoodFamilyKeys ?? []).length === 0 ? (
            <p className="mb-3 text-sm text-text-muted">No safe food families added yet.</p>
          ) : (
            <ul data-testid="safe-food-families-list" className="mb-3 space-y-1">
              {(member.safeFoodFamilyKeys ?? []).map((fk) => (
                <li key={fk} className="flex items-center gap-2">
                  <Chip variant="warning">{fk}</Chip>
                  <Button
                    variant="danger"
                    small
                    className="!h-6 !w-6 !min-h-[24px] !px-0 !py-0 !text-[12px] leading-none"
                    aria-label={`Remove safe food family ${fk}`}
                    onClick={() =>
                      requestConfirm(fk, () => {
                        removeSafeFamilyKey(fk);
                      })
                    }
                  >
                    x
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <FormRow>
            <TagSuggestInput
              mode="single"
              value={safeFamilyInput}
              onChange={setSafeFamilyInput}
              suggestions={householdFamilyKeys}
              exclude={new Set(member.safeFoodFamilyKeys ?? [])}
              placeholder="Add safe food family"
              className="max-w-[220px]"
              onPick={(key) => addSafeFamilyKey(key)}
              onSubmitPlain={() => addSafeFamilyKey(safeFamilyInput)}
            />
            <Button onClick={() => addSafeFamilyKey(safeFamilyInput)}>Add family</Button>
          </FormRow>
        </Card>
      </Section>

      <Section title="Hard-No Foods">
        <Card>
          {member.hardNoFoods.length === 0 ? (
            <p className="mb-3 text-sm text-text-muted">No hard-no foods added yet.</p>
          ) : (
            <ul data-testid="hard-no-foods-list" className="mb-3 space-y-1">
              {member.hardNoFoods.map((food) => (
                <li key={food} className="flex items-center gap-2">
                  <Chip variant="danger">{food}</Chip>
                  <Button
                    variant="danger"
                    small
                    className="!h-6 !w-6 !min-h-[24px] !px-0 !py-0 !text-[12px] leading-none"
                    aria-label={`Remove hard-no food ${food}`}
                    onClick={() =>
                      requestConfirm(food, () => {
                        removeHardNo(food);
                      })
                    }
                  >
                    x
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <FormRow>
            <IngredientCombobox
              ref={hardCombRef}
              value={hardNoInput}
              onChange={setHardNoInput}
              placeholder="Add hard-no food"
              ingredients={ingredients}
              isBlocked={(n) => member.hardNoFoods.some((f) => norm(f) === n)}
              onCommitPlain={commitHardPlain}
              onCommitFromIngredient={commitHardFromIngredient}
              onCreateIngredientAndCommit={commitHardCreate}
            />
            <Button onClick={() => hardCombRef.current?.submitPlain()}>Add hard-no food</Button>
          </FormRow>
        </Card>
      </Section>

      <Section title="Hard-No Food Families">
        <Card>
          <p className="mb-2 text-xs text-text-muted">
            Grouped exclusions — penalizes any ingredient in the family. Weaker than an exact hard-no.
          </p>
          {(member.hardNoFoodFamilyKeys ?? []).length === 0 ? (
            <p className="mb-3 text-sm text-text-muted">No hard-no food families added yet.</p>
          ) : (
            <ul data-testid="hard-no-food-families-list" className="mb-3 space-y-1">
              {(member.hardNoFoodFamilyKeys ?? []).map((fk) => (
                <li key={fk} className="flex items-center gap-2">
                  <Chip variant="danger">{fk}</Chip>
                  <Button
                    variant="danger"
                    small
                    className="!h-6 !w-6 !min-h-[24px] !px-0 !py-0 !text-[12px] leading-none"
                    aria-label={`Remove hard-no food family ${fk}`}
                    onClick={() =>
                      requestConfirm(fk, () => {
                        removeHardNoFamilyKey(fk);
                      })
                    }
                  >
                    x
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <FormRow>
            <TagSuggestInput
              mode="single"
              value={hardNoFamilyInput}
              onChange={setHardNoFamilyInput}
              suggestions={householdFamilyKeys}
              exclude={new Set(member.hardNoFoodFamilyKeys ?? [])}
              placeholder="Add hard-no food family"
              className="max-w-[220px]"
              onPick={(key) => addHardNoFamilyKey(key)}
              onSubmitPlain={() => addHardNoFamilyKey(hardNoFamilyInput)}
            />
            <Button onClick={() => addHardNoFamilyKey(hardNoFamilyInput)}>Add family</Button>
          </FormRow>
        </Card>
      </Section>

      <Section title="Preparation Rules">
        <Card>
          {member.preparationRules.length === 0 ? (
            <p className="mb-3 text-sm text-text-muted">No preparation rules added yet.</p>
          ) : (
            <ul data-testid="preparation-rules-list" className="mb-3 space-y-1">
              {member.preparationRules.map((rule, i) => (
                <li key={`${rule.ingredient}-${rule.rule}`} className="flex items-center gap-2">
                  <span className="text-sm">
                    <strong>{rule.ingredient}:</strong> {rule.rule}
                  </span>
                  <Button
                    variant="danger"
                    small
                    className="!min-h-[24px] !px-1.5 !py-0.5 !text-[10px] leading-none"
                    onClick={() => removePreparationRule(i)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <FormRow>
            <IngredientCombobox
              value={ruleIngredient}
              onChange={setRuleIngredient}
              placeholder="Ingredient"
              ingredients={ingredients}
              isBlocked={() => false}
              onCommitPlain={commitRuleIngredientPlain}
              onCommitFromIngredient={commitRuleIngredientFromIngredient}
              onCreateIngredientAndCommit={commitRuleIngredientCreate}
            />
            <Input
              type="text"
              value={ruleText}
              onChange={(e) => setRuleText(e.target.value)}
              placeholder="Preparation rule"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPreparationRule();
                }
              }}
            />
            <Button onClick={addPreparationRule}>Add rule</Button>
          </FormRow>
        </Card>
      </Section>
      <ConfirmDialog
        open={!!pending}
        title="Remove food"
        message={`Are you sure you want to remove "${pending?.entityName ?? ''}" from this profile?`}
        confirmLabel="Remove"
        onConfirm={confirm}
        onCancel={cancel}
      />
    </>
  );
}
