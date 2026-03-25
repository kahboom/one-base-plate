-- Fix Postgres 42P17: infinite recursion in policy for relation "household_memberships"
-- Caused by policies that SELECT from household_memberships while evaluating RLS on that table.
-- Apply in SQL editor if you already ran 002_invites.sql before this fix.

drop policy if exists "Members can read memberships for their households" on public.household_memberships;
drop policy if exists "Members can read profiles of household co-members" on public.profiles;

create or replace function public.current_user_is_member_of_household(_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_memberships hm
    where hm.household_id = _household_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.current_user_shares_household_with(_other_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_memberships a
    inner join public.household_memberships b on a.household_id = b.household_id
    where a.user_id = auth.uid()
      and b.user_id = _other_user_id
  );
$$;

grant execute on function public.current_user_is_member_of_household(uuid) to authenticated;
grant execute on function public.current_user_shares_household_with(uuid) to authenticated;

create policy "Members can read memberships for their households"
  on public.household_memberships for select
  using (public.current_user_is_member_of_household(household_id));

create policy "Members can read profiles of household co-members"
  on public.profiles for select
  using (public.current_user_shares_household_with(id));
