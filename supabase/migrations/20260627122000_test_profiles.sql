-- Reusable test profiles for faster invoice test selection.

create extension if not exists pg_trgm with schema public;

create table if not exists public.test_profile (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.test_profile_item (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.test_profile(id) on delete cascade,
  test_type_id uuid not null references public.test_type(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (profile_id, test_type_id)
);

create index if not exists idx_test_profile_name_trgm
  on public.test_profile using gin (name gin_trgm_ops);

create index if not exists idx_test_profile_item_profile_order
  on public.test_profile_item(profile_id, sort_order, created_at);

create index if not exists idx_test_profile_item_test_type
  on public.test_profile_item(test_type_id);

alter table public.test_profile enable row level security;
alter table public.test_profile_item enable row level security;

drop policy if exists "Allow all access for authenticated users" on public.test_profile;
create policy "Allow all access for authenticated users" on public.test_profile
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow all access for authenticated users" on public.test_profile_item;
create policy "Allow all access for authenticated users" on public.test_profile_item
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
