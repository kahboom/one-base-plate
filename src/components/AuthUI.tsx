import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { Button, Input, Card, Chip } from "./ui";
import FirstLoginMigrationDialog from "./FirstLoginMigrationDialog";
import { loadHouseholds, hydrateFromRemote } from "../storage";
import {
  setCurrentUserId,
  detectFirstLoginContext,
  resolveFirstLogin,
  getSyncState,
  onSyncStateChange,
} from "../sync/sync-engine";
import type { FirstLoginContext, ConflictChoice, SyncState } from "../sync/types";
import { useEffect } from "react";

type AuthTab = "signin" | "signup";

export default function AuthUI() {
  const { user, loading, configured, signIn, signUp, signOut } = useAuth();
  const [tab, setTab] = useState<AuthTab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(getSyncState);

  const [migrationContext, setMigrationContext] = useState<FirstLoginContext | null>(null);
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    return onSyncStateChange(setSyncState);
  }, []);

  if (!configured) {
    return (
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Account</h2>
        <p className="text-sm text-text-muted">
          Cloud sync is not configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> environment variables to enable accounts.
        </p>
        <div className="mt-2">
          <Chip variant="neutral" data-testid="sync-mode-badge">Local only</Chip>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Account</h2>
        <p className="text-sm text-text-muted">Loading...</p>
      </Card>
    );
  }

  if (user) {
    const chipVariant =
      syncState.status === "error" ? "danger" as const
        : !syncState.online ? "neutral" as const
          : syncState.hasPendingChanges ? "warning" as const
            : syncState.status === "syncing" ? "info" as const
              : "success" as const;

    const chipLabel =
      syncState.status === "syncing" ? "Syncing..."
        : !syncState.online ? "Offline"
          : syncState.status === "error" ? "Sync error"
            : syncState.hasPendingChanges ? "Local changes pending"
              : "Cloud synced";

    return (
      <Card className="mb-6" data-testid="auth-signed-in">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Account</h2>
        <p className="text-sm text-text-secondary" data-testid="auth-email">
          Signed in as <strong>{user.email}</strong>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Chip variant={chipVariant} data-testid="sync-mode-badge">
            {chipLabel}
          </Chip>
        </div>
        <div className="mt-4">
          <Button
            variant="danger"
            small
            data-testid="auth-signout-btn"
            onClick={async () => {
              await signOut();
              setCurrentUserId(null);
            }}
          >
            Sign out
          </Button>
        </div>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const result = tab === "signup"
      ? await signUp(email, password)
      : await signIn(email, password);

    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    const authState = await import("../auth/auth-service").then((m) => m.getSession());
    const userId = authState.session?.user?.id;
    if (!userId) {
      setError("Sign-in succeeded but no user session found");
      setBusy(false);
      return;
    }

    setCurrentUserId(userId);

    try {
      const localHouseholds = loadHouseholds();
      const ctx = await detectFirstLoginContext(localHouseholds);

      if (ctx.needsResolution) {
        setMigrationContext(ctx);
        setShowMigration(true);
        setBusy(false);
        return;
      }

      const resolved = await resolveFirstLogin(ctx);
      if (resolved.length > 0 && ctx.remoteHouseholds.length > 0) {
        await hydrateFromRemote(resolved);
      }
    } catch (err) {
      console.error("[AuthUI] first-login sync failed:", err);
    }

    setBusy(false);
    setEmail("");
    setPassword("");
  }

  async function handleMigrationResolve(choice: ConflictChoice) {
    if (!migrationContext) return;

    try {
      const resolved = await resolveFirstLogin(migrationContext, choice);
      if (choice === "keep-remote" || choice === "merge") {
        await hydrateFromRemote(resolved);
      }
    } catch (err) {
      console.error("[AuthUI] migration resolve failed:", err);
    }

    setShowMigration(false);
    setMigrationContext(null);
    setBusy(false);
    setEmail("");
    setPassword("");
  }

  function handleMigrationCancel() {
    setCurrentUserId(null);
    signOut();
    setShowMigration(false);
    setMigrationContext(null);
    setBusy(false);
  }

  return (
    <>
      <Card className="mb-6" data-testid="auth-card">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Account</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Sign in to sync your household data across browsers and devices.
        </p>

        <div className="mb-4 flex gap-2" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "signin"}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "signin"
                ? "bg-brand-light text-brand"
                : "text-text-secondary hover:text-text-primary"
            }`}
            data-testid="auth-tab-signin"
            onClick={() => { setTab("signin"); setError(null); }}
          >
            Sign in
          </button>
          <button
            role="tab"
            aria-selected={tab === "signup"}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "signup"
                ? "bg-brand-light text-brand"
                : "text-text-secondary hover:text-text-primary"
            }`}
            data-testid="auth-tab-signup"
            onClick={() => { setTab("signup"); setError(null); }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            required
            data-testid="auth-email-input"
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            required
            minLength={6}
            data-testid="auth-password-input"
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="text-sm text-danger" data-testid="auth-error">{error}</p>
          )}
          <Button variant="primary" type="submit" disabled={busy} data-testid="auth-submit-btn">
            {busy ? "Working..." : tab === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="mt-3">
          <Chip variant="neutral" data-testid="sync-mode-badge">Local only</Chip>
        </div>
      </Card>

      {migrationContext && (
        <FirstLoginMigrationDialog
          open={showMigration}
          context={migrationContext}
          onResolve={handleMigrationResolve}
          onCancel={handleMigrationCancel}
        />
      )}
    </>
  );
}
