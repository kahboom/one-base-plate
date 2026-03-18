import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { Household, HouseholdMember, MemberRole, TextureLevel } from "../types";
import { loadHousehold, saveHousehold } from "../storage";
import { PageShell, Card, Button, Input, Select, HouseholdNav, FieldLabel, Chip, ConfirmDialog, useConfirm } from "../components/ui";

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
  expanded,
  onToggleExpand,
  onChange,
  onRemove,
  householdId,
}: {
  member: HouseholdMember;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (updated: HouseholdMember) => void;
  onRemove: () => void;
  householdId: string | undefined;
}) {
  const memberName = member.name.trim() || "Unnamed member";

  return (
    <Card data-testid={`member-${member.id}`} className="mb-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{memberName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Chip variant="neutral">{member.role}</Chip>
            <Chip variant="info">{member.textureLevel}</Chip>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button small onClick={onToggleExpand}>
            {expanded ? "Done" : "Edit"}
          </Button>
          <Button
            variant="ghost"
            className="text-danger hover:bg-transparent hover:text-danger"
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
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

          {householdId && (
            <div className="sm:col-span-3">
              <Link
                to={`/household/${householdId}/member/${member.id}`}
                className="inline-block text-sm font-medium text-brand hover:underline"
              >
                Edit profile details
              </Link>
            </div>
          )}
        </div>
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
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
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
    const newMember = createEmptyMember();
    setHousehold((h) => ({
      ...h,
      members: [...h.members, newMember],
    }));
    setEditingMemberId(newMember.id);
  }

  function updateMember(index: number, updated: HouseholdMember) {
    setHousehold((h) => {
      const members = [...h.members];
      members[index] = updated;
      return { ...h, members };
    });
  }

  function removeMember(memberId: string) {
    const memberName = household.members.find((member) => member.id === memberId)?.name || "Unnamed member";
    requestConfirm(memberName, () => {
      setHousehold((h) => ({
        ...h,
        members: h.members.filter((member) => member.id !== memberId),
      }));
      setEditingMemberId((current) => (current === memberId ? null : current));
    });
  }

  function handleSaveHousehold() {
    saveHousehold(household);
    navigate(`/household/${household.id}/home`);
  }

  if (!loaded) return null;

  return (
    <PageShell>
      <HouseholdNav householdId={isNew ? undefined : id} />

      <section className="mb-5">
        {isNew && (
          <p className="mb-2">
            <Link to="/households" className="text-sm font-medium text-brand hover:underline">
              Back to households
            </Link>
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          {isNew ? "Create Household" : "Edit Household"}
        </h1>
        {isNew && (
          <p className="mt-2 text-sm text-text-secondary">
            Add your household name and members so planning can stay personalized.
          </p>
        )}
      </section>

      <Card className="mb-4">
        <h2 className="mb-3 text-base font-semibold text-text-primary">Household details</h2>
        <FieldLabel label="Household name" className="max-w-xl">
          <Input
            type="text"
            value={household.name}
            onChange={(e) => setHousehold((h) => ({ ...h, name: e.target.value }))}
            placeholder="Household name"
            required
          />
        </FieldLabel>
      </Card>

      <Card className="mb-4" data-testid="members-section">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text-primary">
            Members ({household.members.length})
          </h2>
          <Button onClick={addMember}>Add member</Button>
        </div>

        {household.members.length === 0 && (
          <div className="rounded-sm border border-border-light bg-bg p-4 text-sm text-text-muted">
            <p className="mb-3">No members yet.</p>
            <Button small onClick={addMember}>
              Add your first member
            </Button>
          </div>
        )}

        {household.members.map((member, i) => (
          <MemberForm
            key={member.id}
            member={member}
            expanded={editingMemberId === member.id}
            onToggleExpand={() => {
              setEditingMemberId((current) => (current === member.id ? null : member.id));
            }}
            onChange={(updated) => updateMember(i, updated)}
            onRemove={() => removeMember(member.id)}
            householdId={isNew ? undefined : id}
          />
        ))}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button onClick={addMember}>Add member</Button>
          <Button variant="primary" onClick={handleSaveHousehold}>
            {isNew ? "Create household" : "Save household"}
          </Button>
        </div>
      </Card>

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
