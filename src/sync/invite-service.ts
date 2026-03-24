import { getSupabaseClient } from "../supabase/client";
import type { HouseholdInvite, RemoteHousehold } from "./types";

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase client not configured");
  return client;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let code = "";
  const values = crypto.getRandomValues(new Uint8Array(8));
  for (const v of values) {
    code += chars[v % chars.length];
  }
  return code;
}

export async function createInvite(
  householdId: string,
  expiresInHours = 72,
): Promise<{ code: string; link: string; invite: HouseholdInvite }> {
  const client = requireClient();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await client
    .from("household_invites")
    .insert({
      household_id: householdId,
      code,
      created_by: user.id,
      expires_at: expiresAt,
      max_uses: 5,
      use_count: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create invite: ${error.message}`);

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${code}`;

  return {
    code,
    link,
    invite: mapRow(data),
  };
}

export async function acceptInvite(
  code: string,
  userId: string,
): Promise<{ household: RemoteHousehold }> {
  const client = requireClient();

  const { data: invite, error: lookupErr } = await client
    .from("household_invites")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (lookupErr) throw new Error(`Failed to look up invite: ${lookupErr.message}`);
  if (!invite) throw new Error("Invite not found or has been revoked.");

  if (new Date(invite.expires_at as string) < new Date()) {
    throw new Error("This invite has expired.");
  }

  if ((invite.use_count as number) >= (invite.max_uses as number)) {
    throw new Error("This invite has reached its maximum number of uses.");
  }

  const { data: existingMembership } = await client
    .from("household_memberships")
    .select("id")
    .eq("household_id", invite.household_id as string)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMembership) {
    throw new Error("You are already a member of this household.");
  }

  const { error: memberErr } = await client
    .from("household_memberships")
    .insert({
      household_id: invite.household_id,
      user_id: userId,
      role: "editor",
    });

  if (memberErr) throw new Error(`Failed to join household: ${memberErr.message}`);

  await client
    .from("household_invites")
    .update({ use_count: (invite.use_count as number) + 1 })
    .eq("id", invite.id as string);

  const { data: household, error: hhErr } = await client
    .from("households")
    .select("*")
    .eq("id", invite.household_id as string)
    .single();

  if (hhErr) throw new Error(`Failed to fetch household: ${hhErr.message}`);

  return { household: household as RemoteHousehold };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("household_invites")
    .delete()
    .eq("id", inviteId);

  if (error) throw new Error(`Failed to revoke invite: ${error.message}`);
}

export async function listInvites(householdId: string): Promise<HouseholdInvite[]> {
  const client = requireClient();
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("household_invites")
    .select("*")
    .eq("household_id", householdId)
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list invites: ${error.message}`);
  return (data ?? []).filter((r) => (r.use_count as number) < (r.max_uses as number)).map(mapRow);
}

function mapRow(row: Record<string, unknown>): HouseholdInvite {
  return {
    id: row.id as string,
    householdId: row.household_id as string,
    code: row.code as string,
    createdBy: row.created_by as string,
    expiresAt: row.expires_at as string,
    maxUses: row.max_uses as number,
    useCount: row.use_count as number,
    createdAt: row.created_at as string,
  };
}
