import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader, Card, Button, ConfirmDialog, useConfirm, FieldLabel } from "../components/ui";
import {
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "../theme";
import {
  clearAllHouseholdsAndDefault,
  clearDefaultHouseholdId,
  clearHouseholdBaseMealsAndPlanning,
  clearHouseholdRecipes,
  exportHouseholdsJSON,
  importHouseholdsJSON,
  countSeedIngredientsForHousehold,
  countSeedRecipesForHousehold,
  loadDefaultHouseholdId,
  mergeSeedRecipesForHousehold,
  resetHouseholdIngredientsToSeed,
  saveDefaultHouseholdId,
} from "../storage";
import { clearImportSession } from "../paprika-parser";
import AuthUI from "../components/AuthUI";
import SyncRecoveryPanel from "../components/SyncRecoveryPanel";
import HouseholdSharingPanel from "../components/HouseholdSharingPanel";
import { useAuth } from "../auth/useAuth";

export default function Settings() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const [dataImportMessage, setDataImportMessage] = useState<"success" | null>(null);
  const { pending, requestConfirm, confirm, cancel } = useConfirm();
  const {
    pending: pendingBaseMeals,
    requestConfirm: requestConfirmBaseMeals,
    confirm: confirmBaseMeals,
    cancel: cancelBaseMeals,
  } = useConfirm();
  const {
    pending: pendingRecipes,
    requestConfirm: requestConfirmRecipes,
    confirm: confirmRecipes,
    cancel: cancelRecipes,
  } = useConfirm();
  const {
    pending: pendingSeedRecipes,
    requestConfirm: requestConfirmSeedRecipes,
    confirm: confirmSeedRecipes,
    cancel: cancelSeedRecipes,
  } = useConfirm();
  const {
    pending: pendingSeedIngredients,
    requestConfirm: requestConfirmSeedIngredients,
    confirm: confirmSeedIngredients,
    cancel: cancelSeedIngredients,
  } = useConfirm();
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => loadThemePreference());

  function setTheme(pref: ThemePreference) {
    saveThemePreference(pref);
    setThemePreference(pref);
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
    setDataImportMessage(null);
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
        setDataImportMessage("success");
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

  function handleClearBaseMealsClick() {
    if (!householdId) return;
    requestConfirmBaseMeals("", () => {
      clearHouseholdBaseMealsAndPlanning(householdId);
      clearImportSession();
    });
  }

  function handleClearRecipesClick() {
    if (!householdId) return;
    requestConfirmRecipes("", () => {
      clearHouseholdRecipes(householdId);
      clearImportSession();
    });
  }

  function handleRestoreSeedRecipesClick() {
    if (!householdId) return;
    requestConfirmSeedRecipes("", () => {
      const ok = mergeSeedRecipesForHousehold(householdId);
      if (!ok) {
        alert("No bundled seed recipes are available for this household id.");
      }
    });
  }

  function handleResetSeedIngredientsClick() {
    if (!householdId) return;
    requestConfirmSeedIngredients("", () => {
      const ok = resetHouseholdIngredientsToSeed(householdId);
      if (!ok) {
        alert("No bundled seed ingredients are available for this household id.");
      }
    });
  }

  const seedRecipeCount = householdId ? countSeedRecipesForHousehold(householdId) : 0;
  const seedIngredientCount = householdId ? countSeedIngredientsForHousehold(householdId) : 0;

  return (
    <>
      <PageHeader title="Settings" />

      <AuthUI />

      {user && <SyncRecoveryPanel />}
      {user && householdId && <HouseholdSharingPanel householdId={householdId} />}

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Appearance</h2>
        <FieldLabel label="Theme">
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Theme"
            data-testid="settings-theme-group"
          >
            {(
              [
                { value: "light" as const, label: "Light" },
                { value: "dark" as const, label: "Dark" },
                { value: "system" as const, label: "System" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={themePreference === value}
                data-testid={`settings-theme-${value}`}
                className={`rounded-sm border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                  themePreference === value
                    ? "border-brand bg-brand-light text-brand"
                    : "border-border-default bg-surface text-text-primary hover:bg-bg"
                }`}
                onClick={() => setTheme(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </FieldLabel>
        <p className="mt-2 text-xs text-text-muted">
          System follows your device setting (light or dark).
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Data</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Export or import all households (members, ingredients, recipe library, base meals, weekly plans). Import
          merges with existing data by household id. You can remove only this household&apos;s base meals and plans,
          or only its recipe library, while keeping members. For households that include bundled seed data, you can
          restore seed recipes or reset the ingredient catalog to the default list.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button data-testid="settings-export-btn" onClick={handleExport}>
            Export data
          </Button>
          <Button data-testid="settings-import-btn" onClick={handleImportClick}>
            Import data
          </Button>
          {dataImportMessage === "success" && (
            <p className="w-full text-sm text-success-text" data-testid="settings-import-success">
              Data imported and merged successfully.
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
            data-testid="settings-import-file-input"
          />
          <Button variant="danger" data-testid="settings-clear-base-meals-btn" onClick={handleClearBaseMealsClick}>
            Remove all base meals
          </Button>
          <Button variant="danger" data-testid="settings-clear-recipes-btn" onClick={handleClearRecipesClick}>
            Remove all recipes
          </Button>
          {seedRecipeCount > 0 && (
            <Button data-testid="settings-restore-seed-recipes-btn" onClick={handleRestoreSeedRecipesClick}>
              Restore seed recipes ({seedRecipeCount})
            </Button>
          )}
          {seedIngredientCount > 0 && (
            <Button variant="danger" data-testid="settings-reset-seed-ingredients-btn" onClick={handleResetSeedIngredientsClick}>
              Reset ingredients to defaults ({seedIngredientCount})
            </Button>
          )}
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
        <Button
          type="button"
          variant="primary"
          data-testid="import-paprika-btn"
          onClick={() => householdId && navigate(`/household/${householdId}/import-paprika`)}
        >
          Import Paprika
        </Button>
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
        open={!!pendingBaseMeals}
        title="Remove all base meals"
        message="This removes all base meals, weekly plans, pinned meals, and meal history for this household. The recipe library, members, and ingredients are kept. In-progress Paprika imports are also cleared. This cannot be undone."
        confirmLabel="Remove base meals"
        onConfirm={confirmBaseMeals}
        onCancel={cancelBaseMeals}
      />
      <ConfirmDialog
        open={!!pendingRecipes}
        title="Remove all recipes"
        message="This removes every recipe in the library for this household. Base meals stay, but links to those recipes (including promote-from-recipe traces) are removed from meals, ingredients, and planner overrides. In-progress Paprika imports are also cleared. This cannot be undone."
        confirmLabel="Remove recipes"
        onConfirm={confirmRecipes}
        onCancel={cancelRecipes}
      />
      <ConfirmDialog
        open={!!pendingSeedRecipes}
        title="Restore seed recipes"
        message="This adds (or refreshes) the app’s bundled seed recipes for this household. Recipes you added with other ids are kept. Matching ids are replaced with the seed copy. Base meal links to recipes are not changed—re-attach in the meal editor if needed."
        confirmLabel="Restore recipes"
        onConfirm={confirmSeedRecipes}
        onCancel={cancelSeedRecipes}
      />
      <ConfirmDialog
        open={!!pendingSeedIngredients}
        title="Reset ingredients to defaults"
        message="This replaces your entire ingredient catalog for this household with the app’s bundled default list. Custom ingredients are removed. Base meals, recipes, and plans may still reference ingredient ids that no longer exist until you edit or re-link them. This cannot be undone."
        confirmLabel="Reset ingredients"
        onConfirm={confirmSeedIngredients}
        onCancel={cancelSeedIngredients}
      />
    </>
  );
}
