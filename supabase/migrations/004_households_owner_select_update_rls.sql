-- Fix: INSERT … RETURNING on households failed with RLS because SELECT only allowed rows
-- with an existing household_memberships row (membership is created after the household row).
-- Apply in Supabase SQL editor if you already ran 001_households.sql without these policies.

drop policy if exists "Owners can read households they own" on public.households;
create policy "Owners can read households they own"
  on public.households for select
  using (owner_id = auth.uid());

drop policy if exists "Owners can update households they own" on public.households;
create policy "Owners can update households they own"
  on public.households for update
  using (owner_id = auth.uid());
