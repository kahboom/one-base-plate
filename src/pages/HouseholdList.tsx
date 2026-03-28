import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Household, HouseholdMember, MemberRole, TextureLevel } from '../types';
import {
  loadHouseholds,
  deleteHousehold,
  exportHouseholdsJSON,
  importHouseholdsJSON,
  saveHousehold,
  loadDefaultHouseholdId,
  saveDefaultHouseholdId,
  clearDefaultHouseholdId,
} from '../storage';
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  EmptyState,
  ConfirmDialog,
  useConfirm,
  FieldLabel,
  Input,
  Select,
  HouseholdNavStack,
} from '../components/ui';
import AppModal from '../components/AppModal';

const ROLE_OPTIONS: MemberRole[] = ['adult', 'toddler', 'baby', 'pet'];
const TEXTURE_OPTIONS: TextureLevel[] = ['regular', 'soft', 'mashable', 'pureed'];

function createEmptyMember(): HouseholdMember {
  return {
    id: crypto.randomUUID(),
    name: '',
    role: 'adult',
    safeFoods: [],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: 'regular',
    allergens: [],
    notes: '',
  };
}

function HouseholdRow({
  household,
  isCurrent,
  onEdit,
  onSetCurrent,
}: {
  household: Household;
  isCurrent: boolean;
  onEdit: () => void;
  onSetCurrent: () => void;
}) {
  return (
    <div
      className="flex w-full items-center gap-3 rounded-md border border-border-light bg-surface px-3 py-2.5 text-left transition-colors hover:bg-bg hover:shadow-card min-h-[48px]"
      data-testid={`household-row-${household.id}`}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-text-primary truncate">
          {household.name || <span className="italic text-text-muted">Unnamed</span>}{' '}
          {isCurrent && (
            <span
              className="text-xs font-semibold text-brand"
              data-testid={`household-current-${household.id}`}
            >
              (Current)
            </span>
          )}
        </span>
        <span className="block text-xs text-text-muted truncate">
          {household.members.length} member{household.members.length !== 1 ? 's' : ''} ·{' '}
          {household.members.map((m) => m.name || 'Unnamed').join(', ') || 'No members'}
        </span>
      </span>
      <div className="flex items-center gap-2">
        {!isCurrent && (
          <Button
            small
            onClick={onSetCurrent}
            aria-label={`Set ${household.name || 'unnamed household'} as current`}
            data-testid={`set-current-household-${household.id}`}
          >
            Set current
          </Button>
        )}
        <Button small onClick={onEdit} aria-label={`Edit ${household.name || 'unnamed household'}`}>
          Edit
        </Button>
      </div>
    </div>
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
        <Button variant="danger" small onClick={onRemove}>
          Remove member
        </Button>
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
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel label="Texture level">
          <Select
            value={member.textureLevel}
            onChange={(e) => onChange({ ...member, textureLevel: e.target.value as TextureLevel })}
          >
            {TEXTURE_OPTIONS.map((texture) => (
              <option key={texture} value={texture}>
                {texture}
              </option>
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
  onSave,
  onClose,
  onDelete,
}: {
  household: Household;
  onSave: (updated: Household) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Household>(household);

  useEffect(() => {
    setDraft(household);
  }, [household]);

  function addMember() {
    setDraft((prev) => ({ ...prev, members: [...prev.members, createEmptyMember()] }));
  }

  function updateMember(index: number, updated: HouseholdMember) {
    const members = [...draft.members];
    members[index] = updated;
    setDraft((prev) => ({ ...prev, members }));
  }

  function removeMember(index: number) {
    setDraft((prev) => ({ ...prev, members: prev.members.filter((_, i) => i !== index) }));
  }

  function handleSave() {
    onSave(draft);
    onClose();
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
              {household.name || 'New household'}
            </h2>
            <span className="text-xs text-text-muted">Quick household editing</span>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close modal">
            ✕
          </Button>
        </div>

        <FieldLabel label="Household name" className="mb-4">
          <Input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Household name"
            data-testid="modal-household-name"
          />
        </FieldLabel>

        <h3 className="mb-2 text-base font-semibold text-text-primary">
          Members ({draft.members.length})
        </h3>

        {draft.members.length === 0 && (
          <EmptyState>No members yet. Add a member to get started.</EmptyState>
        )}

        <div className="mt-3">
          {draft.members.map((member, i) => (
            <MemberEditor
              key={member.id}
              householdId={draft.id}
              member={member}
              onChange={(updated) => updateMember(i, updated)}
              onRemove={() => removeMember(i)}
            />
          ))}
        </div>

        <Button onClick={addMember} className="mb-4">
          Add member
        </Button>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="danger" small onClick={onDelete}>
            Delete household
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </AppModal>
  );
}

export default function HouseholdList() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [defaultHouseholdId, setDefaultHouseholdId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { pending, requestConfirm, confirm, cancel } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = loadHouseholds();
    setHouseholds(loaded);
    const storedDefault = loadDefaultHouseholdId();
    if (storedDefault && loaded.some((household) => household.id === storedDefault)) {
      setDefaultHouseholdId(storedDefault);
      return;
    }
    const fallbackId = loaded[0]?.id ?? null;
    setDefaultHouseholdId(fallbackId);
    if (fallbackId) {
      saveDefaultHouseholdId(fallbackId);
    } else {
      clearDefaultHouseholdId();
    }
  }, []);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    if (households.some((household) => household.id === editId)) {
      setEditingId(editId);
    }
  }, [households, searchParams]);

  function openEditModal(householdId: string) {
    setEditingId(householdId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('edit', householdId);
    setSearchParams(nextParams, { replace: true });
  }

  function closeEditModal() {
    setEditingId(null);
    const nextParams = new URLSearchParams(searchParams);
    if (nextParams.has('edit')) {
      nextParams.delete('edit');
      setSearchParams(nextParams, { replace: true });
    }
  }

  function handleDelete(household: Household) {
    requestConfirm(household.name || 'Unnamed household', () => {
      deleteHousehold(household.id);
      const updatedHouseholds = loadHouseholds();
      setHouseholds(updatedHouseholds);
      if (defaultHouseholdId === household.id) {
        const fallbackId = updatedHouseholds[0]?.id ?? null;
        setDefaultHouseholdId(fallbackId);
        if (fallbackId) {
          saveDefaultHouseholdId(fallbackId);
        } else {
          clearDefaultHouseholdId();
        }
      } else if (
        defaultHouseholdId &&
        !updatedHouseholds.some((existingHousehold) => existingHousehold.id === defaultHouseholdId)
      ) {
        const fallbackId = updatedHouseholds[0]?.id ?? null;
        setDefaultHouseholdId(fallbackId);
        if (fallbackId) {
          saveDefaultHouseholdId(fallbackId);
        } else {
          clearDefaultHouseholdId();
        }
      }
      setEditingId((prev) => (prev === household.id ? null : prev));
    });
  }

  function saveEditedHousehold(updated: Household) {
    saveHousehold(updated);
    setHouseholds(loadHouseholds());
  }

  function setCurrentHousehold(householdId: string) {
    saveDefaultHouseholdId(householdId);
    setDefaultHouseholdId(householdId);
  }

  function handleExport() {
    const json = exportHouseholdsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onebaseplate-export.json';
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
        const result = importHouseholdsJSON(reader.result as string, 'merge');
        setHouseholds(result);
        if (
          !defaultHouseholdId ||
          !result.some((household) => household.id === defaultHouseholdId)
        ) {
          const fallbackId = result[0]?.id ?? null;
          setDefaultHouseholdId(fallbackId);
          if (fallbackId) {
            saveDefaultHouseholdId(fallbackId);
          } else {
            clearDefaultHouseholdId();
          }
        }
      } catch {
        alert('Invalid JSON file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const editingHousehold = editingId ? (households.find((h) => h.id === editingId) ?? null) : null;
  const currentHousehold =
    (defaultHouseholdId
      ? (households.find((household) => household.id === defaultHouseholdId) ?? null)
      : null) ??
    households[0] ??
    null;

  return (
    <PageShell>
      <HouseholdNavStack householdId={currentHousehold?.id} />
      <PageHeader title="Households" />
      <div className="mb-4 flex" data-testid="household-control-bar">
        <div className="w-full sm:w-auto sm:ml-auto">
          <Link to="/household/new">
            <Button variant="primary" className="w-full sm:w-auto">
              Create Household
            </Button>
          </Link>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-medium text-text-secondary">
        Households ({households.length})
      </h2>

      {households.length === 0 ? (
        <EmptyState>No households yet. Create one to get started.</EmptyState>
      ) : (
        <div className="space-y-1.5" data-testid="household-list">
          {households.map((household) => (
            <HouseholdRow
              key={household.id}
              household={household}
              isCurrent={household.id === currentHousehold?.id}
              onSetCurrent={() => setCurrentHousehold(household.id)}
              onEdit={() => openEditModal(household.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button small onClick={handleExport}>
          Export data
        </Button>
        <Button small onClick={handleImportClick}>
          Import data
        </Button>
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
          onSave={saveEditedHousehold}
          onClose={closeEditModal}
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
