import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Household, HouseholdMember, MemberRole, TextureLevel } from "../types";
import { loadHouseholds, deleteHousehold, exportHouseholdsJSON, importHouseholdsJSON, saveHousehold } from "../storage";
import { PageShell, Card, Button, EmptyState, ConfirmDialog, useConfirm, FieldLabel, Input, Select, HouseholdNav } from "../components/ui";
import AppModal from "../components/AppModal";

const ROLE_OPTIONS: MemberRole[] = ["adult", "toddler", "baby", "pet"];
const TEXTURE_OPTIONS: TextureLevel[] = ["regular", "soft", "mashable", "pureed"];

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

function HouseholdRow({
  household,
  onClick,
}: {
  household: Household;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-md border border-border-light bg-surface px-3 py-2.5 text-left transition-colors hover:bg-bg hover:shadow-card cursor-pointer min-h-[48px]"
      onClick={onClick}
      data-testid={`household-row-${household.id}`}
      aria-label={`Edit ${household.name || "unnamed household"}`}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-text-primary truncate">
          {household.name || <span className="italic text-text-muted">Unnamed</span>}
        </span>
        <span className="block text-xs text-text-muted truncate">
          {household.members.length} member{household.members.length !== 1 ? "s" : ""} · {household.members.map((m) => m.name || "Unnamed").join(", ") || "No members"}
        </span>
      </span>
    </button>
  );
}

function MemberEditor({
  householdId,
  member,
  onChange,
  onRemove,
}: {
  householdId: string;
  member: HouseholdMember;
  onChange: (updated: HouseholdMember) => void;
  onRemove: () => void;
}) {
  return (
    <Card data-testid={`modal-member-${member.id}`} className="mb-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-secondary">Member</span>
        <Button variant="danger" small onClick={onRemove}>Remove member</Button>
      </div>
      <div className="space-y-3">
        <FieldLabel label="Name">
          <Input
            type="text"
            value={member.name}
            onChange={(e) => onChange({ ...member, name: e.target.value })}
            placeholder="Member name"
          />
        </FieldLabel>
        <FieldLabel label="Role">
          <Select
            value={member.role}
            onChange={(e) => onChange({ ...member, role: e.target.value as MemberRole })}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel label="Texture level">
          <Select
            value={member.textureLevel}
            onChange={(e) => onChange({ ...member, textureLevel: e.target.value as TextureLevel })}
          >
            {TEXTURE_OPTIONS.map((texture) => (
              <option key={texture} value={texture}>{texture}</option>
            ))}
          </Select>
        </FieldLabel>
      </div>
      <div className="mt-3">
        <Link
          to={`/household/${householdId}/member/${member.id}`}
          className="text-sm font-medium text-brand hover:underline"
          data-testid={`modal-member-profile-${member.id}`}
        >
          Open profile
        </Link>
      </div>
    </Card>
  );
}

function HouseholdModal({
  household,
  onChange,
  onClose,
  onDelete,
}: {
  household: Household;
  onChange: (updated: Household) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  function addMember() {
    onChange({ ...household, members: [...household.members, createEmptyMember()] });
  }

  function updateMember(index: number, updated: HouseholdMember) {
    const members = [...household.members];
    members[index] = updated;
    onChange({ ...household, members });
  }

  function removeMember(index: number) {
    onChange({ ...household, members: household.members.filter((_, i) => i !== index) });
  }

  return (
    <AppModal
      open
      onClose={onClose}
      ariaLabel="Edit household"
      className="max-w-2xl max-h-[90vh] overflow-y-auto p-6"
    >
      <div data-testid="household-modal">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              {household.name || "New household"}
            </h2>
            <span className="text-xs text-text-muted">
              Quick household editing
            </span>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close modal">✕</Button>
        </div>
        <HouseholdNav householdId={household.id} />

        <FieldLabel label="Household name" className="mb-4">
          <Input
            type="text"
            value={household.name}
            onChange={(e) => onChange({ ...household, name: e.target.value })}
            placeholder="Household name"
            data-testid="modal-household-name"
          />
        </FieldLabel>

        <h3 className="mb-2 text-base font-semibold text-text-primary">
          Members ({household.members.length})
        </h3>

        {household.members.length === 0 && (
          <EmptyState>No members yet. Add a member to get started.</EmptyState>
        )}

        <div className="mt-3">
          {household.members.map((member, i) => (
            <MemberEditor
              key={member.id}
              householdId={household.id}
              member={member}
              onChange={(updated) => updateMember(i, updated)}
              onRemove={() => removeMember(i)}
            />
          ))}
        </div>

        <Button onClick={addMember} className="mb-4">Add member</Button>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="danger" small onClick={onDelete}>Delete household</Button>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </AppModal>
  );
}

export default function HouseholdList() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { pending, requestConfirm, confirm, cancel } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHouseholds(loadHouseholds());
  }, []);

  function handleDelete(household: Household) {
    requestConfirm(household.name || "Unnamed household", () => {
      deleteHousehold(household.id);
      setHouseholds(loadHouseholds());
      setEditingId((prev) => (prev === household.id ? null : prev));
    });
  }

  function updateHousehold(updated: Household) {
    saveHousehold(updated);
    setHouseholds(loadHouseholds());
  }

  function handleExport() {
    const json = exportHouseholdsJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "onebaseplate-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = importHouseholdsJSON(reader.result as string, "merge");
        setHouseholds(result);
      } catch {
        alert("Invalid JSON file. Please check the file format.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const filteredHouseholds = useMemo(() => {
    if (!searchQuery.trim()) return households;
    const q = searchQuery.toLowerCase();
    return households.filter((h) => {
      if (h.name.toLowerCase().includes(q)) return true;
      return h.members.some((m) => m.name.toLowerCase().includes(q));
    });
  }, [households, searchQuery]);

  const editingHousehold = editingId
    ? households.find((h) => h.id === editingId) ?? null
    : null;

  return (
    <PageShell>
      <HouseholdNav />
      <Card className="mb-4" data-testid="household-control-bar">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search households..."
              data-testid="household-search"
            />
          </div>
          <Link to="/household/new">
            <Button variant="primary">Create Household</Button>
          </Link>
        </div>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-text-secondary">
        Households ({households.length}){filteredHouseholds.length !== households.length && ` · showing ${filteredHouseholds.length}`}
      </h2>

      {households.length === 0 ? (
        <EmptyState>No households yet. Create one to get started.</EmptyState>
      ) : filteredHouseholds.length === 0 ? (
        <EmptyState>No households match your search.</EmptyState>
      ) : (
        <div className="space-y-1.5" data-testid="household-list">
          {filteredHouseholds.map((household) => (
            <HouseholdRow
              key={household.id}
              household={household}
              onClick={() => setEditingId(household.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button small onClick={handleExport}>Export data</Button>
        <Button small onClick={handleImportClick}>Import data</Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportFile}
          data-testid="import-file-input"
        />
      </div>

      {editingHousehold && (
        <HouseholdModal
          household={editingHousehold}
          onChange={updateHousehold}
          onClose={() => setEditingId(null)}
          onDelete={() => handleDelete(editingHousehold)}
        />
      )}

      <ConfirmDialog
        open={!!pending}
        title="Delete household"
        message={`Are you sure you want to delete "${pending?.entityName}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirm}
        onCancel={cancel}
      />
    </PageShell>
  );
}
