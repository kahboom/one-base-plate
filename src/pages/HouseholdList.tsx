import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Household } from "../types";
import { loadHouseholds, deleteHousehold } from "../storage";
import { PageShell, PageHeader, Card, Button, EmptyState, Section, ConfirmDialog, useConfirm } from "../components/ui";

export default function HouseholdList() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();

  useEffect(() => {
    setHouseholds(loadHouseholds());
  }, []);

  function handleDelete(household: Household) {
    requestConfirm(household.name || "Unnamed household", () => {
      deleteHousehold(household.id);
      setHouseholds(loadHouseholds());
    });
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
                <Link to={`/household/${h.id}/home`} className="text-lg font-semibold text-brand hover:underline">
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
                <Link to={`/household/${h.id}`}>
                  <Button small>Setup</Button>
                </Link>
                <Button variant="danger" small onClick={() => handleDelete(h)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
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
