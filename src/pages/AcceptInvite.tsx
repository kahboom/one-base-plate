import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { PageShell, Card, Button, Chip } from "../components/ui";
import { acceptInvite } from "../sync/invite-service";
import { hydrateFromRemote, loadHouseholds, saveHouseholds } from "../storage";
import { getCurrentUserId } from "../sync/sync-engine";

type InviteState = "loading" | "needs-auth" | "accepting" | "success" | "error";

export default function AcceptInvite() {
  const { code } = useParams<{ code: string }>();
  const { user, loading: authLoading, configured } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<InviteState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!configured || !user) {
      setState("needs-auth");
      return;
    }

    const userId = getCurrentUserId();
    if (!userId || !code) {
      setState("needs-auth");
      return;
    }

    setState("accepting");

    acceptInvite(code, userId)
      .then(async ({ household }) => {
        const hhData = household.data;
        setHouseholdName(hhData.name ?? "Shared Household");

        const existing = loadHouseholds();
        const alreadyLocal = existing.find((h) => h.id === hhData.id);
        if (alreadyLocal) {
          setState("success");
          return;
        }

        const merged = [...existing, hhData];
        await hydrateFromRemote(merged);
        saveHouseholds(merged);
        setState("success");
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : "Failed to accept invite");
        setState("error");
      });
  }, [authLoading, configured, user, code]);

  if (state === "loading") {
    return (
      <PageShell>
        <Card className="max-w-md mx-auto mt-12 text-center">
          <p className="text-sm text-text-muted">Loading...</p>
        </Card>
      </PageShell>
    );
  }

  if (state === "needs-auth") {
    return (
      <PageShell>
        <Card className="max-w-md mx-auto mt-12" data-testid="invite-needs-auth">
          <h2 className="mb-3 text-lg font-bold text-text-primary">Join a household</h2>
          <p className="mb-4 text-sm text-text-secondary">
            You've been invited to join a shared household. Sign in or create an account to accept.
          </p>
          <Chip variant="info" className="mb-4">Invite code: {code}</Chip>
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate("/")}>
              Go to app to sign in
            </Button>
          </div>
          <p className="mt-3 text-xs text-text-muted">
            After signing in, visit this link again to join the household.
          </p>
        </Card>
      </PageShell>
    );
  }

  if (state === "accepting") {
    return (
      <PageShell>
        <Card className="max-w-md mx-auto mt-12 text-center" data-testid="invite-accepting">
          <p className="text-sm text-text-muted">Joining household...</p>
        </Card>
      </PageShell>
    );
  }

  if (state === "error") {
    return (
      <PageShell>
        <Card className="max-w-md mx-auto mt-12" data-testid="invite-error">
          <h2 className="mb-3 text-lg font-bold text-text-primary">Couldn't join household</h2>
          <p className="mb-4 text-sm text-danger">{errorMessage}</p>
          <Button onClick={() => navigate("/")}>Go to app</Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card className="max-w-md mx-auto mt-12" data-testid="invite-success">
        <h2 className="mb-3 text-lg font-bold text-text-primary">You're in!</h2>
        <p className="mb-4 text-sm text-text-secondary">
          You've joined <strong>{householdName}</strong>. You can now view and edit shared meal plans,
          ingredients, and recipes.
        </p>
        <Button
          variant="primary"
          onClick={() => {
            const households = loadHouseholds();
            const shared = households.find((h) => h.name === householdName);
            if (shared) {
              navigate(`/household/${shared.id}/home`);
            } else {
              navigate("/");
            }
          }}
        >
          Go to household
        </Button>
      </Card>
    </PageShell>
  );
}
