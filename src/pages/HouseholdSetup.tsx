import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { Household, HouseholdMember, MemberRole, TextureLevel } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { PageShell, PageHeader, Card, Button, Input, Select, ActionGroup, HouseholdNav, FieldLabel, EmptyState, ConfirmDialog, useConfirm } from "../components/ui";

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
    pinnedMealIds: [],
  };
}

const ROLE_OPTIONS: MemberRole[] = ["adult", "toddler", "baby", "pet"];
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
    <Card data-testid={`member-${member.id}`} className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-secondary">Member</span>
        <Button variant="danger" small onClick={onRemove}>Remove member</Button>
      </div>

      <div className="space-y-4">
        <FieldLabel label="Name">
          <Input
            type="text"
            value={member.name}
            onChange={(e) => onChange({ ...member, name: e.target.value })}
            placeholder="Member name"
            required
          />
        </FieldLabel>

        <FieldLabel label="Role">
          <Select
            value={member.role}
            onChange={(e) => onChange({ ...member, role: e.target.value as MemberRole })}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel label="Texture level">
          <Select
            value={member.textureLevel}
            onChange={(e) => onChange({ ...member, textureLevel: e.target.value as TextureLevel })}
          >
            {TEXTURE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </FieldLabel>
      </div>

      {householdId && (
        <Link
          to={`/household/${householdId}/member/${member.id}`}
          className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
        >
          Edit profile
        </Link>
      )}
    </Card>
  );
}

export default function HouseholdSetup() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [household, setHousehold] = useState<Household>(createEmptyHousehold);
  const [loaded, setLoaded] = useState(false);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();

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
    const memberName = household.members[index]?.name || "Unnamed member";
    requestConfirm(memberName, () => {
      setHousehold((h) => ({
        ...h,
        members: h.members.filter((_, i) => i !== index),
      }));
    });
  }

  function handleSave() {
    saveHousehold(household);
    navigate("/");
  }

  if (!loaded) return null;

  return (
    <PageShell>
      {!isNew && <HouseholdNav householdId={id ?? ""} />}
      <PageHeader title={isNew ? "Create Household" : "Edit Household"} />

      <FieldLabel label="Household name" className="mb-6">
        <Input
          type="text"
          value={household.name}
          onChange={(e) => setHousehold((h) => ({ ...h, name: e.target.value }))}
          placeholder="Household name"
          required
        />
      </FieldLabel>

      <h2 className="mb-4 text-xl font-semibold text-text-primary">
        Members ({household.members.length})
      </h2>

      {household.members.length === 0 && (
        <EmptyState>No members yet. Add a member to get started.</EmptyState>
      )}

      {household.members.map((member, i) => (
        <MemberForm
          key={member.id}
          member={member}
          onChange={(updated) => updateMember(i, updated)}
          onRemove={() => removeMember(i)}
          householdId={isNew ? undefined : id}
        />
      ))}

      <Button onClick={addMember} className="mb-4">Add member</Button>

      <ActionGroup>
        <Button variant="primary" onClick={handleSave}>Save household</Button>
        <Button onClick={() => navigate("/")}>Cancel</Button>
      </ActionGroup>

      <ConfirmDialog
        open={!!pending}
        title="Remove member"
        message={`Are you sure you want to remove "${pending?.entityName}"? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={confirm}
        onCancel={cancel}
      />
    </PageShell>
  );
}
