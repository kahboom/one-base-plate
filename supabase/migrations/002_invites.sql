-- F063: Household sharing — invite codes
-- Run this against your Supabase project via the SQL editor or Supabase CLI.
-- The app does NOT auto-run migrations; this file is checked in for documentation.

-- Household invites (lightweight sharing via code/link)
create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null,
  max_uses integer not null default 1,
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.household_invites enable row level security;

-- Owners can manage invites for their households
create policy "Owners can create invites"
  on public.household_invites for insert
  with check (
    exists (
      select 1 from public.households
      where households.id = household_invites.household_id
        and households.owner_id = auth.uid()
    )
  );

create policy "Owners can view invites for their households"
  on public.household_invites for select
  using (
    exists (
      select 1 from public.households
      where households.id = household_invites.household_id
        and households.owner_id = auth.uid()
    )
  );

-- Any authenticated user can look up an invite by code (needed to accept)
create policy "Authenticated users can look up invites by code"
  on public.household_invites for select
  using (auth.uid() is not null);

create policy "Owners can revoke invites"
  on public.household_invites for delete
  using (
    exists (
      select 1 from public.households
      where households.id = household_invites.household_id
        and households.owner_id = auth.uid()
    )
  );

-- Allow the app to increment use_count when an invite is accepted
create policy "Authenticated users can update invite use_count"
  on public.household_invites for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Allow members to see other members in their shared households
-- (needed so the owner can list members and editors can see who else is in the household)
create policy "Members can read memberships for their households"
  on public.household_memberships for select
  using (
    exists (
      select 1 from public.household_memberships as my_membership
      where my_membership.household_id = household_memberships.household_id
        and my_membership.user_id = auth.uid()
    )
  );

-- Allow reading profiles of other household members (for display names/emails)
create policy "Members can read profiles of household co-members"
  on public.profiles for select
  using (
    exists (
      select 1 from public.household_memberships m1
      join public.household_memberships m2 on m1.household_id = m2.household_id
      where m1.user_id = auth.uid()
        and m2.user_id = profiles.id
    )
  );
