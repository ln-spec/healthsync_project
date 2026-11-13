-- Stock movement log. Needed so the monthly report can compute medicine
-- consumption (medicine_inventory only stores the *current* balance).
-- Run once in the Supabase SQL editor.

create table if not exists public.inventory_movements (
  id                 uuid primary key default gen_random_uuid(),
  inventory_id       uuid not null references public.medicine_inventory(id) on delete cascade,
  facility_id        uuid not null,
  delta              integer not null,            -- negative = dispensed, positive = restock
  resulting_quantity integer not null,
  created_at         timestamptz not null default now()
);

create index if not exists inventory_movements_facility_created_idx
  on public.inventory_movements (facility_id, created_at);

alter table public.inventory_movements enable row level security;

-- Facility staff can read and append movements for their own facility only.
-- Adjust the claim path if your other policies read facility_id differently.
create policy "facility reads own movements" on public.inventory_movements
  for select using (facility_id::text = (auth.jwt() -> 'app_metadata' ->> 'facility_id'));

create policy "facility logs own movements" on public.inventory_movements
  for insert with check (facility_id::text = (auth.jwt() -> 'app_metadata' ->> 'facility_id'));
