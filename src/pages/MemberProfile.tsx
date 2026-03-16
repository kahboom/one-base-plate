import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { HouseholdMember, PreparationRule } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { PageShell, PageHeader, Card, Button, Input, Section, FormRow, Chip, ConfirmDialog, useConfirm, HouseholdNav } from "../components/ui";

export default function MemberProfile() {
  const { householdId, memberId } = useParams<{
    householdId: string;
    memberId: string;
  }>();
  const [member, setMember] = useState<HouseholdMember | null>(null);
  const [householdName, setHouseholdName] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [safeFoodInput, setSafeFoodInput] = useState("");
  const [hardNoInput, setHardNoInput] = useState("");
  const [ruleIngredient, setRuleIngredient] = useState("");
  const [ruleText, setRuleText] = useState("");

  useEffect(() => {
    if (!householdId || !memberId) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    setHouseholdName(household.name);
    const found = household.members.find((m) => m.id === memberId);
    if (found) {
      setMember({ ...found });
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
    saveHousehold(household);
  }, [householdId, loaded, member]);

  function addSafeFood() {
    const trimmed = safeFoodInput.trim();
    if (!trimmed || !member) return;
    if (member.safeFoods.includes(trimmed)) return;
    setMember({ ...member, safeFoods: [...member.safeFoods, trimmed] });
    setSafeFoodInput("");
  }

  function removeSafeFood(food: string) {
    if (!member) return;
    setMember({
      ...member,
      safeFoods: member.safeFoods.filter((f) => f !== food),
    });
  }

  function addHardNo() {
    const trimmed = hardNoInput.trim();
    if (!trimmed || !member) return;
    if (member.hardNoFoods.includes(trimmed)) return;
    setMember({ ...member, hardNoFoods: [...member.hardNoFoods, trimmed] });
    setHardNoInput("");
  }

  function removeHardNo(food: string) {
    if (!member) return;
    setMember({
      ...member,
      hardNoFoods: member.hardNoFoods.filter((f) => f !== food),
    });
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
    setRuleIngredient("");
    setRuleText("");
  }

  function removePreparationRule(index: number) {
    if (!member) return;
    setMember({
      ...member,
      preparationRules: member.preparationRules.filter((_, i) => i !== index),
    });
  }

  if (!member) return <p>Member not found.</p>;

  return (
    <PageShell>
      <HouseholdNav householdId={householdId} />
      <PageHeader
        title={`${member.name} — ${member.role}`}
        subtitle={`Household: ${householdName}`}
        subtitleTo={`/household/${householdId}/home`}
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
            <Input
              type="text"
              value={safeFoodInput}
              onChange={(e) => setSafeFoodInput(e.target.value)}
              placeholder="Add safe food"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSafeFood();
                }
              }}
            />
            <Button onClick={addSafeFood}>Add safe food</Button>
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
            <Input
              type="text"
              value={hardNoInput}
              onChange={(e) => setHardNoInput(e.target.value)}
              placeholder="Add hard-no food"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addHardNo();
                }
              }}
            />
            <Button onClick={addHardNo}>Add hard-no food</Button>
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
            <Input
              type="text"
              value={ruleIngredient}
              onChange={(e) => setRuleIngredient(e.target.value)}
              placeholder="Ingredient"
            />
            <Input
              type="text"
              value={ruleText}
              onChange={(e) => setRuleText(e.target.value)}
              placeholder="Preparation rule"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
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
        message={`Are you sure you want to remove "${pending?.entityName ?? ""}" from this profile?`}
        confirmLabel="Remove"
        onConfirm={confirm}
        onCancel={cancel}
      />
    </PageShell>
  );
}
