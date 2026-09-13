-- The Board — database schema.
-- Paste this whole file into the Supabase SQL editor and press Run.

create table if not exists members (
  id text primary key,
  name text not null,
  goal int default 4,
  unit text default 'lb',
  created_at timestamptz default now()
);

create table if not exists sessions (
  id bigserial primary key,
  member_id text references members(id) on delete cascade,
  date date not null,
  split text,
  note text,
  created_at timestamptz default now()
);

create table if not exists prs (
  id bigserial primary key,
  member_id text references members(id) on delete cascade,
  lift text not null,
  weight numeric,
  reps int,
  date date default current_date
);

create table if not exists weights (
  id bigserial primary key,
  member_id text references members(id) on delete cascade,
  date date default current_date,
  lb numeric
);

create index if not exists sessions_member_date on sessions (member_id, date desc);
create index if not exists prs_member_lift on prs (member_id, lift);

-- Open access. This is deliberate: the group code is the only gate.
-- Anyone with the site URL and the public key can read and write everything.
-- Do not store anything private here.

alter table members enable row level security;
alter table sessions enable row level security;
alter table prs enable row level security;
alter table weights enable row level security;

drop policy if exists "open" on members;
drop policy if exists "open" on sessions;
drop policy if exists "open" on prs;
drop policy if exists "open" on weights;

create policy "open" on members for all using (true) with check (true);
create policy "open" on sessions for all using (true) with check (true);
create policy "open" on prs for all using (true) with check (true);
create policy "open" on weights for all using (true) with check (true);
