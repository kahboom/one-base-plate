import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Chip, ConfirmDialog } from "./ui";
import { useAuth } from "../auth/useAuth";
import { getCurrentUserId } from "../sync/sync-engine";
import { fetchHouseholdMembers, removeHouseholdMember } from "../sync/remote-repository";
import { createInvite, listInvites, revokeInvite } from "../sync/invite-service";
import type { HouseholdMember, HouseholdInvite } from "../sync/types";

interface Props {
  householdId: string;
}

export default function HouseholdSharingPanel({ householdId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();

  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [removingMember, setRemovingMember] = useState<HouseholdMember | null>(null);
  const [leavingHousehold, setLeavingHousehold] = useState(false);

  const isOwner = members.some((m) => m.userId === currentUserId && m.role === "owner");

  const refresh = useCallback(async () => {
    try {
      const [memberData, inviteData] = await Promise.all([
        fetchHouseholdMembers(householdId),
        listInvites(householdId).catch(() => [] as HouseholdInvite[]),
      ]);
      setMembers(memberData);
      setInvites(inviteData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sharing info");
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (!user || !currentUserId) return;
    void refresh();
  }, [user, currentUserId, refresh]);

  async function handleCreateInvite() {
    setCreatingInvite(true);
    try {
      const result = await createInvite(householdId);
      setInvites((prev) => [result.invite, ...prev]);
      await copyToClipboard(result.link, result.invite.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setCreatingInvite(false);
    }
  }

  async function copyToClipboard(link: string, code: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      await revokeInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invite");
    }
  }

  async function handleRemoveMember() {
    if (!removingMember) return;
    try {
      await removeHouseholdMember(householdId, removingMember.userId);
      setMembers((prev) => prev.filter((m) => m.userId !== removingMember.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemovingMember(null);
    }
  }

  async function handleLeaveHousehold() {
    if (!currentUserId) return;
    try {
      await removeHouseholdMember(householdId, currentUserId);
      navigate("/households");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave household");
    } finally {
      setLeavingHousehold(false);
    }
  }

  if (!user || !currentUserId) return null;

  if (loading) {
    return (
      <Card className="mb-6" data-testid="sharing-panel">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Household sharing</h2>
        <p className="text-sm text-text-muted">Loading...</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-6" data-testid="sharing-panel">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Household sharing</h2>

        {error && (
          <p className="mb-3 text-xs text-danger" data-testid="sharing-error">{error}</p>
        )}

        <div className="mb-4">
          <h3 className="mb-2 text-xs font-medium text-text-secondary uppercase tracking-wide">Members</h3>
          <div className="space-y-2" data-testid="member-list">
            {members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between rounded-sm border border-border-light px-3 py-2"
                data-testid={`member-row-${member.userId}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-text-primary truncate">
                    {member.displayName || member.email || "Unknown"}
                  </span>
                  <Chip variant={member.role === "owner" ? "info" : "neutral"}>
                    {member.role}
                  </Chip>
                  {member.userId === currentUserId && (
                    <span className="text-xs text-text-muted">(you)</span>
                  )}
                </div>
                {isOwner && member.userId !== currentUserId && (
                  <Button
                    variant="ghost"
                    small
                    data-testid={`remove-member-${member.userId}`}
                    onClick={() => setRemovingMember(member)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {isOwner && (
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-medium text-text-secondary uppercase tracking-wide">Invite</h3>
            <p className="mb-3 text-xs text-text-muted">
              Share an invite link so someone else can join this household. They'll need to sign in first.
            </p>
            <Button
              small
              variant="primary"
              disabled={creatingInvite}
              data-testid="create-invite-btn"
              onClick={handleCreateInvite}
            >
              {creatingInvite ? "Creating..." : "Generate invite link"}
            </Button>

            {invites.length > 0 && (
              <div className="mt-3 space-y-2" data-testid="invite-list">
                {invites.map((invite) => {
                  const link = `${window.location.origin}/invite/${invite.code}`;
                  const isCopied = copiedCode === invite.code;
                  return (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-sm border border-border-light px-3 py-2"
                      data-testid={`invite-row-${invite.code}`}
                    >
                      <div className="min-w-0 flex-1">
                        <code className="text-xs text-text-primary">{invite.code}</code>
                        <span className="ml-2 text-xs text-text-muted">
                          {invite.useCount}/{invite.maxUses} used
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          small
                          data-testid={`copy-invite-${invite.code}`}
                          onClick={() => copyToClipboard(link, invite.code)}
                        >
                          {isCopied ? "Copied!" : "Copy link"}
                        </Button>
                        <Button
                          variant="ghost"
                          small
                          data-testid={`revoke-invite-${invite.code}`}
                          onClick={() => handleRevokeInvite(invite.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!isOwner && (
          <div className="mt-4 pt-4 border-t border-border-light">
            <Button
              variant="danger"
              small
              data-testid="leave-household-btn"
              onClick={() => setLeavingHousehold(true)}
            >
              Leave household
            </Button>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!removingMember}
        title="Remove member"
        message={`Remove ${removingMember?.displayName || removingMember?.email || "this member"} from the household? They will lose access to shared data.`}
        confirmLabel="Remove"
        onConfirm={handleRemoveMember}
        onCancel={() => setRemovingMember(null)}
      />

      <ConfirmDialog
        open={leavingHousehold}
        title="Leave household"
        message="Are you sure you want to leave this household? You will lose access to shared data. You can rejoin later with a new invite link."
        confirmLabel="Leave"
        onConfirm={handleLeaveHousehold}
        onCancel={() => setLeavingHousehold(false)}
      />
    </>
  );
}
