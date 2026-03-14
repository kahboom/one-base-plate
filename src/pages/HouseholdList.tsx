import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import type { Household } from "../types";
import { loadHouseholds, deleteHousehold, exportHouseholdsJSON, importHouseholdsJSON } from "../storage";
import { PageShell, PageHeader, Card, Button, EmptyState, Section, ConfirmDialog, useConfirm } from "../components/ui";

export default function HouseholdList() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHouseholds(loadHouseholds());
  }, []);

  function handleDelete(household: Household) {
    requestConfirm(household.name || "Unnamed household", () => {
      deleteHousehold(household.id);
      setHouseholds(loadHouseholds());
    });
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

  return (
    <PageShell>
      <PageHeader title="OneBasePlate" subtitle="One base meal, multiple household-specific assemblies." />

      <Section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">Households</h2>
          <Link to="/household/new">
            <Button variant="primary">Create Household</Button>
          </Link>
        </div>

        {households.length === 0 && (
          <EmptyState>No households yet. Create one to get started.</EmptyState>
        )}

        <div className="space-y-3">
          {households.map((h) => (
            <Card key={h.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <Link to={`/household/${h.id}`} className="text-lg font-semibold text-brand hover:underline">
                  {h.name}
                </Link>
                <span className="ml-2 text-sm text-text-muted">
                  ({h.members.length} member{h.members.length !== 1 ? "s" : ""})
                </span>
                {h.members.length > 0 && (
                  <div className="mt-2 text-sm text-text-secondary">
                    <span className="text-text-muted">Members: </span>
                    {h.members.map((m) => m.name || "Unnamed").join(", ") || "—"}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="danger" small onClick={() => handleDelete(h)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>

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
      </Section>
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
