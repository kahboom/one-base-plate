import type { Household } from "../types";
import type { RemoteHousehold, HouseholdMember } from "./types";
import { getSupabaseClient } from "../supabase/client";

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase client not configured");
  return client;
}

export async function fetchRemoteHouseholds(userId: string): Promise<RemoteHousehold[]> {
  const client = requireClient();

  const { data: memberships, error: mErr } = await client
    .from("household_memberships")
    .select("household_id")
    .eq("user_id", userId);

  if (mErr) throw new Error(`Failed to fetch memberships: ${mErr.message}`);
  if (!memberships || memberships.length === 0) return [];

  const ids = memberships.map((m) => m.household_id as string);

  const { data, error } = await client
    .from("households")
    .select("*")
    .in("id", ids);

  if (error) throw new Error(`Failed to fetch households: ${error.message}`);
  return (data ?? []) as RemoteHousehold[];
}

export async function fetchRemoteHouseholdById(householdId: string): Promise<RemoteHousehold | null> {
  const client = requireClient();

  const { data, error } = await client
    .from("households")
    .select("*")
    .eq("id", householdId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch household: ${error.message}`);
  return data as RemoteHousehold | null;
}

export async function upsertRemoteHousehold(
  household: Household,
  userId: string,
): Promise<RemoteHousehold> {
  const client = requireClient();

  const { data: existing } = await client
    .from("households")
    .select("id")
    .eq("id", household.id)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await client
      .from("households")
      .update({
        data: household,
        updated_at: now,
        version: 1,
      })
      .eq("id", household.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update household: ${error.message}`);
    return data as RemoteHousehold;
  }

  const { data, error } = await client
    .from("households")
    .insert({
      id: household.id,
      data: household,
      owner_id: userId,
      updated_at: now,
      version: 1,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to insert household: ${error.message}`);

  await client
    .from("household_memberships")
    .upsert(
      { household_id: household.id, user_id: userId, role: "owner" },
      { onConflict: "household_id,user_id" },
    );

  return data as RemoteHousehold;
}

export async function deleteRemoteHousehold(householdId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("households").delete().eq("id", householdId);
  if (error) throw new Error(`Failed to delete household: ${error.message}`);
}

export async function fetchHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const client = requireClient();

  const { data: memberships, error: mErr } = await client
    .from("household_memberships")
    .select("user_id, role, created_at")
    .eq("household_id", householdId);

  if (mErr) throw new Error(`Failed to fetch members: ${mErr.message}`);
  if (!memberships || memberships.length === 0) return [];

  const userIds = memberships.map((m) => m.user_id as string);

  const { data: profiles, error: pErr } = await client
    .from("profiles")
    .select("id, email, display_name")
    .in("id", userIds);

  if (pErr) throw new Error(`Failed to fetch profiles: ${pErr.message}`);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  return memberships.map((m) => {
    const profile = profileMap.get(m.user_id as string);
    return {
      userId: m.user_id as string,
      email: (profile?.email as string) ?? null,
      displayName: (profile?.display_name as string) ?? null,
      role: m.role as "owner" | "editor",
      joinedAt: m.created_at as string,
    };
  });
}

export async function removeHouseholdMember(householdId: string, userId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("household_memberships")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to remove member: ${error.message}`);
}
