import { useState, useEffect, useCallback } from "react";
import { Card, Button, Chip, ConfirmDialog } from "./ui";
import AppModal from "./AppModal";
import { useAuth } from "../auth/useAuth";
import {
  getSyncState,
  onSyncStateChange,
  manualSync,
  pullRemoteHouseholds,
  isAuthenticated,
} from "../sync/sync-engine";
import {
  loadHouseholds,
  exportHouseholdsJSON,
  hydrateFromRemote,
} from "../storage";
import type { SyncState, ConflictChoice } from "../sync/types";

export default function SyncRecoveryPanel() {
  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>(getSyncState);
  const [syncing, setSyncing] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    return onSyncStateChange(setSyncState);
  }, []);

  const handleManualSync = useCallback(async () => {
    if (!isAuthenticated()) return;
    setSyncing(true);
    try {
      const result = await manualSync(loadHouseholds());
      const hasConflict = result.comparisons.some(
        (c) => c.remoteNewer && !c.onlyRemote,
      );
      if (hasConflict && syncState.hasPendingChanges) {
        setShowConflict(true);
      }
    } catch {
      // Error is surfaced via syncState
    } finally {
      setSyncing(false);
    }
  }, [syncState.hasPendingChanges]);

  function handleExportBackup() {
    const json = exportHouseholdsJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onebaseplate-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleReplaceFromCloud() {
    setReplacing(true);
    try {
      const remotes = await pullRemoteHouseholds();
      if (remotes.length === 0) {
        setReplacing(false);
        setShowReplaceConfirm(false);
        return;
      }
      const remoteDatas = remotes.map((r) => r.data);
      await hydrateFromRemote(remoteDatas);
      window.location.reload();
    } catch {
      setReplacing(false);
      setShowReplaceConfirm(false);
    }
  }

  async function handleConflictChoice(choice: ConflictChoice) {
    setShowConflict(false);
    if (choice === "keep-local") {
      setSyncing(true);
      try {
        await manualSync(loadHouseholds());
      } finally {
        setSyncing(false);
      }
    } else if (choice === "keep-remote") {
      await handleReplaceFromCloud();
    }
  }

  if (!user) return null;

  const statusChip = renderStatusChip(syncState, syncing);
  const errorGuidance = syncState.errorKind === "auth_expired"
    ? "Your session may have expired. Try signing out and back in."
    : syncState.errorKind === "remote_unavailable"
      ? "The sync server is temporarily unreachable. Your data is safe locally."
      : syncState.errorKind === "schema_missing"
        ? "Your Supabase project does not have the sync tables yet. Open SQL Editor in the dashboard and run, in order, the contents of supabase/migrations/001_households.sql then supabase/migrations/002_invites.sql from this repository, then reload the app."
        : null;

  return (
    <>
      <Card className="mb-6" data-testid="sync-recovery-panel">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Sync & backup</h2>

        <div className="flex items-center gap-2 mb-3" data-testid="sync-status-row">
          {statusChip}
          {syncState.lastSyncedAt && (
            <span className="text-xs text-text-muted" data-testid="last-synced-time">
              Last synced {new Date(syncState.lastSyncedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {syncState.error && (
          <div className="mb-3">
            <p className="text-xs text-danger" data-testid="sync-error-message">{syncState.error}</p>
            {errorGuidance && (
              <p className="mt-1 text-xs text-text-muted">{errorGuidance}</p>
            )}
            {syncState.errorKind === "schema_missing" && (
              <p className="mt-1 text-xs text-text-muted">
                If you signed up before running the first script, run once in SQL Editor:{" "}
                <code className="break-all text-[10px] text-text-primary">
                  insert into public.profiles (id, email) select id, email from auth.users on
                  conflict (id) do nothing;
                </code>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            small
            variant="primary"
            disabled={syncing || syncState.status === "syncing" || !isAuthenticated()}
            data-testid="manual-sync-btn"
            onClick={handleManualSync}
          >
            {syncing || syncState.status === "syncing" ? "Syncing..." : "Sync now"}
          </Button>

          <Button
            small
            data-testid="export-backup-btn"
            onClick={handleExportBackup}
          >
            Export backup
          </Button>

          <Button
            small
            data-testid="replace-from-cloud-btn"
            onClick={() => setShowReplaceConfirm(true)}
          >
            Re-download from cloud
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={showReplaceConfirm}
        title="Replace local data with cloud version?"
        message="This will overwrite everything on this device with the version stored in the cloud. Any unsynced local changes will be lost. Consider exporting a backup first."
        confirmLabel={replacing ? "Replacing..." : "Replace local data"}
        onConfirm={handleReplaceFromCloud}
        onCancel={() => setShowReplaceConfirm(false)}
      />

      <AppModal
        open={showConflict}
        onClose={() => setShowConflict(false)}
        ariaLabel="Sync conflict"
        className="max-w-md p-6"
        closeOnBackdropClick={false}
      >
        <h2 className="mb-2 text-lg font-bold text-text-primary">
          Cloud has newer data
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          The cloud version is newer than your local data, and you have unsynced
          local changes. How would you like to proceed?
        </p>
        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            data-testid="conflict-keep-local"
            onClick={() => handleConflictChoice("keep-local")}
          >
            Keep local changes and overwrite cloud
          </Button>
          <Button
            data-testid="conflict-keep-remote"
            onClick={() => handleConflictChoice("keep-remote")}
          >
            Use cloud version and discard local changes
          </Button>
          <Button
            variant="ghost"
            data-testid="conflict-cancel"
            onClick={() => setShowConflict(false)}
          >
            Cancel (keep both as-is for now)
          </Button>
        </div>
      </AppModal>
    </>
  );
}

function renderStatusChip(state: SyncState, syncing: boolean) {
  if (syncing || state.status === "syncing") {
    return <Chip variant="info" data-testid="sync-chip">Syncing...</Chip>;
  }
  if (!state.online) {
    return <Chip variant="neutral" data-testid="sync-chip">Offline</Chip>;
  }
  if (state.status === "error") {
    return <Chip variant="danger" data-testid="sync-chip">Sync error</Chip>;
  }
  if (state.hasPendingChanges) {
    return <Chip variant="warning" data-testid="sync-chip">Local changes pending</Chip>;
  }
  return <Chip variant="success" data-testid="sync-chip">Synced</Chip>;
}
