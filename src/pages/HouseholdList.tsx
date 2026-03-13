import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Household } from "../types";
import { loadHouseholds, deleteHousehold } from "../storage";
import { PageShell, PageHeader, Card, Button, EmptyState, Section } from "../components/ui";

export default function HouseholdList() {
  const [households, setHouseholds] = useState<Household[]>([]);

  useEffect(() => {
    setHouseholds(loadHouseholds());
  }, []);

  function handleDelete(id: string) {
    deleteHousehold(id);
    setHouseholds(loadHouseholds());
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
              <div>
                <Link to={`/household/${h.id}/home`} className="text-lg font-semibold text-brand hover:underline">
                  {h.name}
                </Link>
                <span className="ml-2 text-sm text-text-muted">
                  ({h.members.length} member{h.members.length !== 1 ? "s" : ""})
                </span>
              </div>
              <div className="flex gap-2">
                <Link to={`/household/${h.id}`}>
                  <Button small>Setup</Button>
                </Link>
                <Button variant="danger" small onClick={() => handleDelete(h.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
