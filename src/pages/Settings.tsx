import { useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader, Card, Button, ConfirmDialog, useConfirm } from "../components/ui";
import {
  clearAllHouseholdsAndDefault,
  clearDefaultHouseholdId,
  exportHouseholdsJSON,
  importHouseholdsJSON,
  loadDefaultHouseholdId,
  resetToDefaultState,
  saveDefaultHouseholdId,
} from "../storage";
import { clearImportSession } from "../paprika-parser";

export default function Settings() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();
  const {
    pending: pendingResetDefault,
    requestConfirm: requestConfirmResetDefault,
    confirm: confirmResetDefault,
    cancel: cancelResetDefault,
  } = useConfirm();

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
        const storedDefault = loadDefaultHouseholdId();
        if (!storedDefault || !result.some((h) => h.id === storedDefault)) {
          const fallbackId = result[0]?.id ?? null;
          if (fallbackId) {
            saveDefaultHouseholdId(fallbackId);
          } else {
            clearDefaultHouseholdId();
          }
        }
      } catch {
        alert("Invalid JSON file. Please check the file format.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClearClick() {
    requestConfirm("", () => {
      clearAllHouseholdsAndDefault();
      clearImportSession();
      navigate("/households");
    });
  }

  function handleResetToDefaultClick() {
    requestConfirmResetDefault("", async () => {
      await resetToDefaultState();
      clearImportSession();
      navigate("/households");
    });
  }

  return (
    <>
      <PageHeader title="Settings" />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Data</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Export or import all households (members, ingredients, base meals, weekly plans). Import merges with
          existing data by household id.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button data-testid="settings-export-btn" onClick={handleExport}>
            Export data
          </Button>
          <Button data-testid="settings-import-btn" onClick={handleImportClick}>
            Import data
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
            data-testid="settings-import-file-input"
          />
          <Button
            variant="danger"
            data-testid="settings-reset-default-btn"
            onClick={handleResetToDefaultClick}
          >
            Reset to default state
          </Button>
          <Button variant="danger" data-testid="settings-clear-all-btn" onClick={handleClearClick}>
            Clear all data
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Paprika</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Import recipes from a Paprika .paprikarecipes export as draft base meals.
        </p>
        <Link to={`/household/${householdId}/import-paprika`}>
          <Button data-testid="import-paprika-btn">Import Paprika</Button>
        </Link>
      </Card>

      <ConfirmDialog
        open={!!pending}
        title="Clear all data"
        message="This will remove every household—including all base meals, ingredients, weekly plans, and related data—from this browser. In-progress Paprika imports are also cleared. This cannot be undone."
        confirmLabel="Clear all"
        onConfirm={confirm}
        onCancel={cancel}
      />
      <ConfirmDialog
        open={!!pendingResetDefault}
        title="Reset to default state"
        message="This removes all households and replaces them with the app’s bundled seed data. Your default household is set to the first seed household. In-progress Paprika imports are cleared. This cannot be undone."
        confirmLabel="Reset to defaults"
        onConfirm={confirmResetDefault}
        onCancel={cancelResetDefault}
      />
    </>
  );
}
