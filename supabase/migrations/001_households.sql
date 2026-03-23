-- F062: Account-based cloud persistence — reference DDL
-- Run this against your Supabase project via the SQL editor or Supabase CLI.
-- The app does NOT auto-run migrations; this file is checked in for documentation.

-- Profiles (lightweight user metadata, auto-populated on sign-up via trigger)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Household aggregate snapshots (JSONB)
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  owner_id uuid not null references auth.users on delete cascade,
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

alter table public.households enable row level security;

-- Household memberships (access control)
create table if not exists public.household_memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

alter table public.household_memberships enable row level security;

-- RLS: users can only access households they have a membership for
create policy "Users can read their households"
  on public.households for select
  using (
    exists (
      select 1 from public.household_memberships
      where household_memberships.household_id = households.id
        and household_memberships.user_id = auth.uid()
    )
  );

create policy "Users can insert households they own"
  on public.households for insert
  with check (owner_id = auth.uid());

create policy "Users can update their households"
  on public.households for update
  using (
    exists (
      select 1 from public.household_memberships
      where household_memberships.household_id = households.id
        and household_memberships.user_id = auth.uid()
    )
  );

create policy "Users can delete households they own"
  on public.households for delete
  using (owner_id = auth.uid());

-- Membership RLS
create policy "Users can read their memberships"
  on public.household_memberships for select
  using (user_id = auth.uid());

create policy "Owners can insert memberships"
  on public.household_memberships for insert
  with check (
    exists (
      select 1 from public.households
      where households.id = household_memberships.household_id
        and households.owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

create policy "Owners can delete memberships"
  on public.household_memberships for delete
  using (
    exists (
      select 1 from public.households
      where households.id = household_memberships.household_id
        and households.owner_id = auth.uid()
    )
  );
