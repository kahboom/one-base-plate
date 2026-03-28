import { describe, it, expect } from 'vitest';
import {
  findRemoteForLocal,
  isRemoteHouseholdRowId,
  mergeCloudHouseholdIdFromRemote,
  planRemoteHouseholdRowId,
  resolveRemoteHouseholdPkFromList,
} from '../src/sync/remote-repository';
import type { RemoteHousehold } from '../src/sync/types';
import type { Household } from '../src/types';

function rh(cloudId: string, localId: string): RemoteHousehold {
  const data = {
    id: localId,
    name: 'x',
    members: [],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
  } as Household;
  return {
    id: cloudId,
    data,
    owner_id: 'o1',
    updated_at: new Date().toISOString(),
    version: 1,
  };
}

describe('remote household id resolution', () => {
  it('treats standard UUID strings as cloud row ids', () => {
    const u = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    expect(isRemoteHouseholdRowId(u)).toBe(true);
    expect(resolveRemoteHouseholdPkFromList(u, [])).toBe(u);
  });

  it('does not treat H001-style ids as UUIDs', () => {
    expect(isRemoteHouseholdRowId('H001')).toBe(false);
  });

  it('maps local id to cloud pk via embedded household data', () => {
    const remotes = [rh('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'H001')];
    expect(resolveRemoteHouseholdPkFromList('H001', remotes)).toBe(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
  });

  it('returns null when local id is unknown', () => {
    expect(
      resolveRemoteHouseholdPkFromList('H999', [
        rh('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'H001'),
      ]),
    ).toBeNull();
  });

  it('planRemoteHouseholdRowId allocates a UUID for seed-style ids', () => {
    const h = {
      id: 'H001',
      name: 'x',
      members: [],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    } as Household;
    const a = planRemoteHouseholdRowId(h);
    const b = planRemoteHouseholdRowId(h);
    expect(a.isNewCloudRow).toBe(true);
    expect(b.isNewCloudRow).toBe(true);
    expect(isRemoteHouseholdRowId(a.rowId)).toBe(true);
    expect(a.rowId).not.toBe(b.rowId);
  });

  it('planRemoteHouseholdRowId reuses cloudHouseholdId when set', () => {
    const cloud = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const h = {
      id: 'H001',
      cloudHouseholdId: cloud,
      name: 'x',
      members: [],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    } as Household;
    const p = planRemoteHouseholdRowId(h);
    expect(p).toEqual({ rowId: cloud, isNewCloudRow: false });
  });

  it('mergeCloudHouseholdIdFromRemote attaches row PK when embedded id differs', () => {
    const cloudPk = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const merged = mergeCloudHouseholdIdFromRemote(rh(cloudPk, 'H001'));
    expect(merged.id).toBe('H001');
    expect(merged.cloudHouseholdId).toBe(cloudPk);
  });

  it('findRemoteForLocal matches seed id to remote row via data.id', () => {
    const local = {
      id: 'H001',
      name: 'x',
      members: [],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    } as Household;
    const remotes = [rh('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'H001')];
    expect(findRemoteForLocal(local, remotes)?.id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
