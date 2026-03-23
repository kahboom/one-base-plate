import type { Household } from "../types";
import type { RemoteHousehold } from "./types";
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
        version: 1, // LWW: version is advisory; updated_at is the tiebreaker
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
