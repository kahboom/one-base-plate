import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import type { HouseholdMember, PreparationRule } from "../types";
import { loadHousehold, saveHousehold } from "../storage";

export default function MemberProfile() {
  const { householdId, memberId } = useParams<{
    householdId: string;
    memberId: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [member, setMember] = useState<HouseholdMember | null>(null);
  const [householdName, setHouseholdName] = useState("");

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
    if (found) setMember({ ...found });
  }, [householdId, memberId]);

  const defaultReturn = `/household/${householdId}`;
  const navigateBack = returnTo || defaultReturn;

  function handleSave() {
    if (!householdId || !member) return;
    const household = loadHousehold(householdId);
    if (!household) return;
    const index = household.members.findIndex((m) => m.id === member.id);
    if (index < 0) return;
    household.members[index] = member;
    saveHousehold(household);
    navigate(navigateBack);
  }

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
    <div>
      <h1>
        {member.name} — {member.role}
      </h1>
      <p>Household: {householdName}</p>

      <section>
        <h2>Safe Foods</h2>
        <ul data-testid="safe-foods-list">
          {member.safeFoods.map((food) => (
            <li key={food}>
              {food}{" "}
              <button type="button" onClick={() => removeSafeFood(food)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div>
          <input
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
          <button type="button" onClick={addSafeFood}>
            Add safe food
          </button>
        </div>
      </section>

      <section>
        <h2>Hard-No Foods</h2>
        <ul data-testid="hard-no-foods-list">
          {member.hardNoFoods.map((food) => (
            <li key={food}>
              {food}{" "}
              <button type="button" onClick={() => removeHardNo(food)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div>
          <input
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
          <button type="button" onClick={addHardNo}>
            Add hard-no food
          </button>
        </div>
      </section>

      <section>
        <h2>Preparation Rules</h2>
        <ul data-testid="preparation-rules-list">
          {member.preparationRules.map((rule, i) => (
            <li key={`${rule.ingredient}-${rule.rule}`}>
              <strong>{rule.ingredient}:</strong> {rule.rule}{" "}
              <button type="button" onClick={() => removePreparationRule(i)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div>
          <input
            type="text"
            value={ruleIngredient}
            onChange={(e) => setRuleIngredient(e.target.value)}
            placeholder="Ingredient"
          />
          <input
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
          <button type="button" onClick={addPreparationRule}>
            Add rule
          </button>
        </div>
      </section>

      <div>
        <button type="button" onClick={handleSave}>
          Save profile
        </button>
        <button
          type="button"
          onClick={() => navigate(navigateBack)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
