-- Create a snapshot table for household backup versions
create table if not exists household_backups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  sql_dump text not null,
  created_at timestamptz not null default now()
);

create index if not exists household_backups_household_id_idx on household_backups (household_id);
