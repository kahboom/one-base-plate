import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { Household, HouseholdMember, MemberRole, TextureLevel } from "../types";
import { loadHousehold, saveHousehold } from "../storage";

function createEmptyMember(): HouseholdMember {
  return {
    id: crypto.randomUUID(),
    name: "",
    role: "adult",
    safeFoods: [],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: "regular",
    allergens: [],
    notes: "",
  };
}

function createEmptyHousehold(): Household {
  return {
    id: crypto.randomUUID(),
    name: "",
    members: [],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
  };
}

const ROLE_OPTIONS: MemberRole[] = ["adult", "toddler", "baby"];
const TEXTURE_OPTIONS: TextureLevel[] = ["regular", "soft", "mashable", "pureed"];

function MemberForm({
  member,
  onChange,
  onRemove,
  householdId,
}: {
  member: HouseholdMember;
  onChange: (updated: HouseholdMember) => void;
  onRemove: () => void;
  householdId: string | undefined;
}) {
  return (
    <fieldset data-testid={`member-${member.id}`}>
      <legend>Member</legend>

      <label>
        Name:{" "}
        <input
          type="text"
          value={member.name}
          onChange={(e) => onChange({ ...member, name: e.target.value })}
          placeholder="Member name"
          required
        />
      </label>

      <label>
        Role:{" "}
        <select
          value={member.role}
          onChange={(e) => onChange({ ...member, role: e.target.value as MemberRole })}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label>
        Texture level:{" "}
        <select
          value={member.textureLevel}
          onChange={(e) =>
            onChange({ ...member, textureLevel: e.target.value as TextureLevel })
          }
        >
          {TEXTURE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      {householdId && (
        <Link to={`/household/${householdId}/member/${member.id}`}>
          Edit profile
        </Link>
      )}

      <button type="button" onClick={onRemove}>
        Remove member
      </button>
    </fieldset>
  );
}

export default function HouseholdSetup() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [household, setHousehold] = useState<Household>(createEmptyHousehold);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      const existing = loadHousehold(id);
      if (existing) {
        setHousehold(existing);
      }
    }
    setLoaded(true);
  }, [id, isNew]);

  function addMember() {
    setHousehold((h) => ({
      ...h,
      members: [...h.members, createEmptyMember()],
    }));
  }

  function updateMember(index: number, updated: HouseholdMember) {
    setHousehold((h) => {
      const members = [...h.members];
      members[index] = updated;
      return { ...h, members };
    });
  }

  function removeMember(index: number) {
    setHousehold((h) => ({
      ...h,
      members: h.members.filter((_, i) => i !== index),
    }));
  }

  function handleSave() {
    saveHousehold(household);
    navigate("/");
  }

  if (!loaded) return null;

  return (
    <div>
      <h1>{isNew ? "Create Household" : "Edit Household"}</h1>

      <label>
        Household name:{" "}
        <input
          type="text"
          value={household.name}
          onChange={(e) => setHousehold((h) => ({ ...h, name: e.target.value }))}
          placeholder="Household name"
          required
        />
      </label>

      <h2>Members ({household.members.length})</h2>

      {household.members.map((member, i) => (
        <MemberForm
          key={member.id}
          member={member}
          onChange={(updated) => updateMember(i, updated)}
          onRemove={() => removeMember(i)}
          householdId={isNew ? undefined : id}
        />
      ))}

      <button type="button" onClick={addMember}>
        Add member
      </button>

      {!isNew && (
        <div>
          <Link to={`/household/${id}/ingredients`}>Manage ingredients</Link>
        </div>
      )}

      <div>
        <button type="button" onClick={handleSave}>
          Save household
        </button>
        <button type="button" onClick={() => navigate("/")}>
          Cancel
        </button>
      </div>
    </div>
  );
}
