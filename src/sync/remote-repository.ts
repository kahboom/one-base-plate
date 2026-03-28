import type { Household } from '../types';
import type { RemoteHousehold, HouseholdMember } from './types';
import { getSupabaseClient } from '../supabase/client';

/** `households.id` / `household_memberships.household_id` are UUIDs; local app ids may be strings like `H001`. */
const REMOTE_HOUSEHOLD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRemoteHouseholdRowId(id: string): boolean {
  return REMOTE_HOUSEHOLD_ID_RE.test(id);
}

/** Supabase row UUID used for this household (local id may differ, e.g. H001). */
export function remoteRowIdForHousehold(household: Household): string | null {
  if (isRemoteHouseholdRowId(household.id)) return household.id;
  if (household.cloudHouseholdId && isRemoteHouseholdRowId(household.cloudHouseholdId)) {
    return household.cloudHouseholdId;
  }
  return null;
}

/** When hydrating from `households` rows, attach `cloudHouseholdId` if the row PK ≠ embedded `data.id`. */
export function mergeCloudHouseholdIdFromRemote(r: RemoteHousehold): Household {
  const d = r.data;
  if (d.id === r.id) return d;
  return { ...d, cloudHouseholdId: r.id };
}

export function findRemoteForLocal(
  local: Household,
  remotes: RemoteHousehold[],
): RemoteHousehold | undefined {
  return remotes.find((r) => localHouseholdMatchesRemote(local, r));
}

export function localHouseholdMatchesRemote(local: Household, remote: RemoteHousehold): boolean {
  return (
    local.id === remote.id ||
    (local.cloudHouseholdId !== undefined && local.cloudHouseholdId === remote.id) ||
    local.id === remote.data?.id
  );
}

/** Map a route/local household id to the Supabase `households.id` row PK. */
export function resolveRemoteHouseholdPkFromList(
  routeOrLocalHouseholdId: string,
  remotes: RemoteHousehold[],
): string | null {
  if (isRemoteHouseholdRowId(routeOrLocalHouseholdId)) return routeOrLocalHouseholdId;
  for (const r of remotes) {
    if (r.data?.id === routeOrLocalHouseholdId) return r.id;
  }
  return null;
}

export async function resolveRemoteHouseholdPk(
  routeOrLocalHouseholdId: string,
  userId: string,
  cloudHouseholdIdHint?: string | null,
): Promise<string | null> {
  if (cloudHouseholdIdHint && isRemoteHouseholdRowId(cloudHouseholdIdHint))
    return cloudHouseholdIdHint;
  if (isRemoteHouseholdRowId(routeOrLocalHouseholdId)) return routeOrLocalHouseholdId;
  const remotes = await fetchRemoteHouseholds(userId);
  return resolveRemoteHouseholdPkFromList(routeOrLocalHouseholdId, remotes);
}

/**
 * Choose `households.id` for upsert: reuse local UUID, stored cloud id, or allocate a new UUID for seed-style ids.
 */
export function planRemoteHouseholdRowId(household: Household): {
  rowId: string;
  isNewCloudRow: boolean;
} {
  if (isRemoteHouseholdRowId(household.id)) {
    return { rowId: household.id, isNewCloudRow: false };
  }
  if (household.cloudHouseholdId && isRemoteHouseholdRowId(household.cloudHouseholdId)) {
    return { rowId: household.cloudHouseholdId, isNewCloudRow: false };
  }
  return { rowId: crypto.randomUUID(), isNewCloudRow: true };
}

export type UpsertRemoteHouseholdResult = {
  remote: RemoteHousehold;
  /** Present after first cloud row is created for a non-UUID local id — persist on the local `Household`. */
  newCloudHouseholdId?: string;
};

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');
  return client;
}

export async function fetchRemoteHouseholds(userId: string): Promise<RemoteHousehold[]> {
  const client = requireClient();

  const { data: memberships, error: mErr } = await client
    .from('household_memberships')
    .select('household_id')
    .eq('user_id', userId);

  if (mErr) throw new Error(`Failed to fetch memberships: ${mErr.message}`);
  if (!memberships || memberships.length === 0) return [];

  const ids = memberships.map((m) => m.household_id as string);

  const { data, error } = await client.from('households').select('*').in('id', ids);

  if (error) throw new Error(`Failed to fetch households: ${error.message}`);
  return (data ?? []) as RemoteHousehold[];
}

export async function fetchRemoteHouseholdById(
  householdId: string,
): Promise<RemoteHousehold | null> {
  const client = requireClient();

  const { data, error } = await client
    .from('households')
    .select('*')
    .eq('id', householdId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch household: ${error.message}`);
  return data as RemoteHousehold | null;
}

export async function upsertRemoteHousehold(
  household: Household,
  userId: string,
): Promise<UpsertRemoteHouseholdResult> {
  const client = requireClient();
  const { rowId, isNewCloudRow } = planRemoteHouseholdRowId(household);

  const { data: existing } = await client
    .from('households')
    .select('id')
    .eq('id', rowId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await client
      .from('households')
      .update({
        data: household,
        updated_at: now,
        version: 1,
      })
      .eq('id', rowId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update household: ${error.message}`);
    return { remote: data as RemoteHousehold };
  }

  const { data, error } = await client
    .from('households')
    .insert({
      id: rowId,
      data: household,
      owner_id: userId,
      updated_at: now,
      version: 1,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to insert household: ${error.message}`);

  await client
    .from('household_memberships')
    .upsert(
      { household_id: rowId, user_id: userId, role: 'owner' },
      { onConflict: 'household_id,user_id' },
    );

  const remote = data as RemoteHousehold;
  return {
    remote,
    newCloudHouseholdId: isNewCloudRow ? rowId : undefined,
  };
}

export async function deleteRemoteHousehold(householdId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('households').delete().eq('id', householdId);
  if (error) throw new Error(`Failed to delete household: ${error.message}`);
}

export async function fetchHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const client = requireClient();

  const { data: memberships, error: mErr } = await client
    .from('household_memberships')
    .select('user_id, role, created_at')
    .eq('household_id', householdId);

  if (mErr) throw new Error(`Failed to fetch members: ${mErr.message}`);
  if (!memberships || memberships.length === 0) return [];

  const userIds = memberships.map((m) => m.user_id as string);

  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('id, email, display_name')
    .in('id', userIds);

  if (pErr) throw new Error(`Failed to fetch profiles: ${pErr.message}`);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  return memberships.map((m) => {
    const profile = profileMap.get(m.user_id as string);
    return {
      userId: m.user_id as string,
      email: (profile?.email as string) ?? null,
      displayName: (profile?.display_name as string) ?? null,
      role: m.role as 'owner' | 'editor',
      joinedAt: m.created_at as string,
    };
  });
}

export async function removeHouseholdMember(householdId: string, userId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('household_memberships')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to remove member: ${error.message}`);
}
