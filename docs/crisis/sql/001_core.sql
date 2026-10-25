-- Gavelling Crisis, part 1: core tables, access helpers, directives, news, resources, map.
-- Applied from the crisis chat with Peter's approval (25 Oct 2026, plan question 38).
-- Every table is new and prefixed crisis_; the only existing object touched is the
-- session_broadcasts source / author_label CHECKs (crisis news reaches live rooms).

-- ─────────────────────────── Tables ───────────────────────────

create table public.crises (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  kind text not null default 'single' check (kind in ('single','joint')),
  package text not null default 'full' check (package in ('basic','full')),
  features jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  scenario_at timestamp,                       -- in-world date and time, set by hand, static until changed
  directives_open boolean not null default true,
  directives_paused_note text,
  next_directive_no integer not null default 1,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conference_id, slug)
);

create table public.crisis_cabinets (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  conference_committee_id uuid unique references public.conference_committees(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  short_name text check (short_name is null or char_length(short_name) <= 24),
  color text not null default '#8E2424' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.crisis_members (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('director','assistant_director','backroomer','chair','press','delegate')),
  cabinet_id uuid references public.crisis_cabinets(id) on delete set null,
  character_id uuid,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  email text,
  access_code text unique check (access_code is null or access_code ~ '^[A-Z0-9]{6,12}$'),
  password_hash text,
  token_hash text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index crisis_members_one_per_user on public.crisis_members(crisis_id, user_id) where user_id is not null;
create index crisis_members_token on public.crisis_members(token_hash) where token_hash is not null;

create table public.crisis_characters (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  cabinet_id uuid references public.crisis_cabinets(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  title text check (title is null or char_length(title) <= 160),
  bio text check (bio is null or char_length(bio) <= 6000),
  picture_url text,
  powers text check (powers is null or char_length(powers) <= 3000),
  location text check (location is null or char_length(location) <= 160),
  status text not null default 'active' check (status in ('active','spare','dead','arrested','missing')),
  status_note text check (status_note is null or char_length(status_note) <= 300),
  owner_member_id uuid references public.crisis_members(id) on delete set null,
  slot_id uuid references public.committee_country_slots(id) on delete set null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index crisis_characters_slot on public.crisis_characters(slot_id) where slot_id is not null;
alter table public.crisis_members add constraint crisis_members_character_fk
  foreign key (character_id) references public.crisis_characters(id) on delete set null;

create table public.crisis_character_secrets (
  character_id uuid primary key references public.crisis_characters(id) on delete cascade,
  crisis_id uuid not null references public.crises(id) on delete cascade,
  goals text check (goals is null or char_length(goals) <= 4000),
  staff_notes text check (staff_notes is null or char_length(staff_notes) <= 8000),
  updated_at timestamptz not null default now()
);

create table public.crisis_directives (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  no integer not null,
  kind text not null default 'personal' check (kind in ('personal','joint','committee','press_release','communique')),
  cabinet_id uuid references public.crisis_cabinets(id) on delete set null,
  author_member_id uuid references public.crisis_members(id) on delete set null,
  author_character_id uuid references public.crisis_characters(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  receiver text not null check (char_length(btrim(receiver)) between 1 and 160),
  themes text[] not null default '{}',
  body text not null check (char_length(btrim(body)) between 1 and 8000),
  resources_used text check (resources_used is null or char_length(resources_used) <= 600),
  goal text check (goal is null or char_length(goal) <= 600),
  affects text check (affects is null or char_length(affects) <= 300),
  covert boolean not null default true,
  status text not null default 'queued' check (status in ('queued','claimed','clarify','answered','withdrawn')),
  outcome text check (outcome is null or outcome in ('approved','partial','denied','clarify','later')),
  reply text check (reply is null or char_length(reply) <= 8000),
  assigned_member_id uuid references public.crisis_members(id) on delete set null,
  claimed_at timestamptz,
  answered_at timestamptz,
  answered_by uuid references public.crisis_members(id) on delete set null,
  waiting_since timestamptz not null default now(),   -- when it last started waiting for staff
  word_count integer generated always as (coalesce(array_length(regexp_split_to_array(btrim(body), '\s+'), 1), 0)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crisis_id, no)
);
create index crisis_directives_queue on public.crisis_directives(crisis_id, status, waiting_since);
create index crisis_directives_author on public.crisis_directives(author_member_id);

create table public.crisis_directive_coauthors (
  directive_id uuid not null references public.crisis_directives(id) on delete cascade,
  character_id uuid not null references public.crisis_characters(id) on delete cascade,
  primary key (directive_id, character_id)
);

create table public.crisis_directive_notes (
  id uuid primary key default gen_random_uuid(),
  directive_id uuid not null references public.crisis_directives(id) on delete cascade,
  crisis_id uuid not null references public.crises(id) on delete cascade,
  member_id uuid references public.crisis_members(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index crisis_directive_notes_dir on public.crisis_directive_notes(directive_id, created_at);

create table public.crisis_news (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  source_label text check (source_label is null or char_length(btrim(source_label)) between 1 and 80),
  image_url text,
  audience_cabinet_id uuid references public.crisis_cabinets(id) on delete set null,  -- null = every room
  status text not null default 'draft' check (status in ('draft','published')),
  author_member_id uuid references public.crisis_members(id) on delete set null,
  published_by uuid references public.crisis_members(id) on delete set null,
  published_at timestamptz,
  directive_id uuid references public.crisis_directives(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crisis_resource_types (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  unit text check (unit is null or char_length(unit) <= 24),
  scope text not null default 'cabinet' check (scope in ('character','cabinet')),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.crisis_resources (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  type_id uuid not null references public.crisis_resource_types(id) on delete cascade,
  character_id uuid references public.crisis_characters(id) on delete cascade,
  cabinet_id uuid references public.crisis_cabinets(id) on delete cascade,
  amount numeric not null default 0,
  updated_at timestamptz not null default now(),
  check ((character_id is null) <> (cabinet_id is null))
);
create unique index crisis_resources_one on public.crisis_resources(type_id, coalesce(character_id, cabinet_id));

create table public.crisis_resource_log (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  resource_id uuid not null references public.crisis_resources(id) on delete cascade,
  delta numeric not null,
  amount_after numeric not null,
  reason text check (reason is null or char_length(reason) <= 300),
  directive_id uuid references public.crisis_directives(id) on delete set null,
  member_id uuid references public.crisis_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.crisis_map_regions (
  crisis_id uuid not null references public.crises(id) on delete cascade,
  region_key text not null check (char_length(region_key) between 1 and 40),
  owner_cabinet_id uuid references public.crisis_cabinets(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (crisis_id, region_key)
);

create table public.crisis_units (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  owner_cabinet_id uuid references public.crisis_cabinets(id) on delete set null,
  kind text not null default 'army' check (kind in ('army','navy','air','missile','base','spy','sub','custom')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  strength integer not null default 1 check (strength between 0 and 1000000),
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  note text check (note is null or char_length(note) <= 600),
  revealed_to uuid[] not null default '{}',     -- cabinets that see it fully
  suspected_by uuid[] not null default '{}',    -- cabinets that see a "suspected" marker
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crisis_shapes (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  kind text not null check (kind in ('line','area')),
  owner_cabinet_id uuid references public.crisis_cabinets(id) on delete set null,
  label text check (label is null or char_length(label) <= 120),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  geometry jsonb not null,
  public boolean not null default false,
  revealed_to uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crisis_map_log (
  id bigint generated always as identity primary key,
  crisis_id uuid not null references public.crises(id) on delete cascade,
  member_id uuid references public.crisis_members(id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index crisis_map_log_crisis on public.crisis_map_log(crisis_id, id);

-- ─────────────────────────── Access helpers ───────────────────────────

-- The caller's member row: by account, or by the personal-code token header.
create or replace function public.crisis_me(p_crisis uuid)
returns public.crisis_members
language sql stable security definer set search_path = public, extensions as $$
  select m.* from public.crisis_members m
  where m.crisis_id = p_crisis
    and (
      (auth.uid() is not null and m.user_id = auth.uid())
      or (m.token_hash is not null and m.token_hash = encode(extensions.digest(
            coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-crisis-token', ''), 'sha256'), 'hex'))
    )
  order by (m.user_id is not distinct from auth.uid()) desc
  limit 1
$$;

-- 'organiser' for a conference organiser with no member row.
create or replace function public.crisis_role(p_crisis uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare r text; conf uuid;
begin
  select role into r from public.crisis_me(p_crisis);
  if r is not null then return r; end if;
  select conference_id into conf from public.crises where id = p_crisis;
  if conf is not null and public.is_conference_organizer(conf) then return 'organiser'; end if;
  return null;
end $$;

create or replace function public.crisis_is_director(p_crisis uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.crisis_role(p_crisis) in ('director','assistant_director','organiser'), false)
$$;

create or replace function public.crisis_is_staff(p_crisis uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.crisis_role(p_crisis) in ('director','assistant_director','organiser','backroomer'), false)
$$;

create or replace function public.crisis_is_member(p_crisis uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.crisis_role(p_crisis) is not null
$$;

-- A backroom power (map, resources, fog, units, news, seeAll). Directors always have every power.
-- Powers are one setting for all backroomers (Peter, 25 Oct 2026): settings.backroomPowers.
create or replace function public.crisis_can(p_crisis uuid, p_power text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare r text; s jsonb;
begin
  r := public.crisis_role(p_crisis);
  if r in ('director','assistant_director','organiser') then return true; end if;
  if r <> 'backroomer' or r is null then return false; end if;
  select settings into s from public.crises where id = p_crisis;
  return coalesce((s -> 'backroomPowers' ->> p_power)::boolean,
                  p_power in ('map','resources','fog','units','seeAll'));
end $$;

create or replace function public.crisis_my_cabinet(p_crisis uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select cabinet_id from public.crisis_me(p_crisis)
$$;

-- ─────────────────────────── RLS ───────────────────────────

alter table public.crises enable row level security;
alter table public.crisis_cabinets enable row level security;
alter table public.crisis_members enable row level security;
alter table public.crisis_characters enable row level security;
alter table public.crisis_character_secrets enable row level security;
alter table public.crisis_directives enable row level security;
alter table public.crisis_directive_coauthors enable row level security;
alter table public.crisis_directive_notes enable row level security;
alter table public.crisis_news enable row level security;
alter table public.crisis_resource_types enable row level security;
alter table public.crisis_resources enable row level security;
alter table public.crisis_resource_log enable row level security;
alter table public.crisis_map_regions enable row level security;
alter table public.crisis_units enable row level security;
alter table public.crisis_shapes enable row level security;
alter table public.crisis_map_log enable row level security;

create policy crises_read on public.crises for select using (public.crisis_is_member(id));
create policy crises_director_update on public.crises for update using (public.crisis_is_director(id)) with check (public.crisis_is_director(id));

create policy cabinets_read on public.crisis_cabinets for select using (public.crisis_is_member(crisis_id));
create policy cabinets_director_write on public.crisis_cabinets for all using (public.crisis_is_director(crisis_id)) with check (public.crisis_is_director(crisis_id));

-- Members: staff see everyone (never the secrets columns through the app); a delegate sees their own row.
create policy members_read on public.crisis_members for select
  using (public.crisis_is_staff(crisis_id) or id = (public.crisis_me(crisis_id)).id
         or (public.crisis_role(crisis_id) = 'chair'));
create policy members_director_write on public.crisis_members for all
  using (public.crisis_is_director(crisis_id)) with check (public.crisis_is_director(crisis_id));
-- Hashes never leave the database: only these columns are selectable.
revoke select on public.crisis_members from anon, authenticated;
grant select (id, crisis_id, user_id, role, cabinet_id, character_id, display_name, email, access_code, last_seen_at, created_at, updated_at)
  on public.crisis_members to anon, authenticated;

create policy characters_read on public.crisis_characters for select
  using (public.crisis_is_staff(crisis_id) or public.crisis_role(crisis_id) in ('chair','press')
         or (cabinet_id is not null and cabinet_id = public.crisis_my_cabinet(crisis_id)));
create policy characters_director_write on public.crisis_characters for all
  using (public.crisis_is_director(crisis_id)) with check (public.crisis_is_director(crisis_id));

create policy secrets_read on public.crisis_character_secrets for select
  using (public.crisis_is_staff(crisis_id) or character_id = (public.crisis_me(crisis_id)).character_id);
create policy secrets_staff_write on public.crisis_character_secrets for all
  using (public.crisis_is_staff(crisis_id)) with check (public.crisis_is_staff(crisis_id));

-- Directives: written only through RPCs. Read by staff (seeAll power or assigned), the author,
-- co-authors, and chairs when settings.chairReadsPersonal (committee kinds always).
create policy directives_read on public.crisis_directives for select using (
  (public.crisis_is_staff(crisis_id) and (public.crisis_can(crisis_id, 'seeAll') or assigned_member_id = (public.crisis_me(crisis_id)).id or assigned_member_id is null))
  or author_member_id = (public.crisis_me(crisis_id)).id
  or exists (select 1 from public.crisis_directive_coauthors ca where ca.directive_id = crisis_directives.id and ca.character_id = (public.crisis_me(crisis_id)).character_id)
  or (public.crisis_role(crisis_id) = 'chair' and (kind in ('committee','communique','press_release')
      or coalesce((select (settings ->> 'chairReadsPersonal')::boolean from public.crises c where c.id = crisis_id), false)))
);
create policy coauthors_read on public.crisis_directive_coauthors for select using (
  exists (select 1 from public.crisis_directives d where d.id = directive_id));
create policy notes_read on public.crisis_directive_notes for select using (
  exists (select 1 from public.crisis_directives d where d.id = directive_id)
  and (not internal or public.crisis_is_staff(crisis_id)));

create policy news_read on public.crisis_news for select using (
  public.crisis_is_staff(crisis_id)
  or (status = 'published' and public.crisis_is_member(crisis_id)
      and (audience_cabinet_id is null or audience_cabinet_id = public.crisis_my_cabinet(crisis_id)
           or public.crisis_role(crisis_id) in ('chair','press'))));

create policy rtypes_read on public.crisis_resource_types for select using (public.crisis_is_member(crisis_id));
create policy rtypes_write on public.crisis_resource_types for all using (public.crisis_can(crisis_id, 'resources')) with check (public.crisis_can(crisis_id, 'resources'));
create policy resources_read on public.crisis_resources for select using (
  public.crisis_is_staff(crisis_id) or public.crisis_role(crisis_id) = 'chair'
  or cabinet_id = public.crisis_my_cabinet(crisis_id)
  or character_id = (public.crisis_me(crisis_id)).character_id);
create policy resources_create on public.crisis_resources for insert with check (public.crisis_can(crisis_id, 'resources'));
create policy resources_delete on public.crisis_resources for delete using (public.crisis_can(crisis_id, 'resources'));
create policy rlog_read on public.crisis_resource_log for select using (public.crisis_is_staff(crisis_id));

create policy regions_read on public.crisis_map_regions for select using (public.crisis_is_member(crisis_id));
create policy regions_write on public.crisis_map_regions for all using (public.crisis_can(crisis_id, 'map')) with check (public.crisis_can(crisis_id, 'map'));

create policy units_read on public.crisis_units for select using (
  public.crisis_is_staff(crisis_id)
  or (owner_cabinet_id is not null and owner_cabinet_id = public.crisis_my_cabinet(crisis_id))
  or public.crisis_my_cabinet(crisis_id) = any (revealed_to)
  or public.crisis_my_cabinet(crisis_id) = any (suspected_by));
create policy units_write on public.crisis_units for all using (public.crisis_can(crisis_id, 'units')) with check (public.crisis_can(crisis_id, 'units'));

create policy shapes_read on public.crisis_shapes for select using (
  public.crisis_is_staff(crisis_id)
  or (public.crisis_is_member(crisis_id) and (public or owner_cabinet_id = public.crisis_my_cabinet(crisis_id)
      or public.crisis_my_cabinet(crisis_id) = any (revealed_to))));
create policy shapes_write on public.crisis_shapes for all using (public.crisis_can(crisis_id, 'map')) with check (public.crisis_can(crisis_id, 'map'));

create policy maplog_read on public.crisis_map_log for select using (public.crisis_is_staff(crisis_id));

-- ─────────────────────────── Triggers ───────────────────────────

create or replace function public.crisis_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger crises_touch before update on public.crises for each row execute function public.crisis_touch();
create trigger crisis_members_touch before update on public.crisis_members for each row execute function public.crisis_touch();
create trigger crisis_characters_touch before update on public.crisis_characters for each row execute function public.crisis_touch();
create trigger crisis_directives_touch before update on public.crisis_directives for each row execute function public.crisis_touch();
create trigger crisis_news_touch before update on public.crisis_news for each row execute function public.crisis_touch();
create trigger crisis_units_touch before update on public.crisis_units for each row execute function public.crisis_touch();
create trigger crisis_shapes_touch before update on public.crisis_shapes for each row execute function public.crisis_touch();

-- Every map change is logged for replay.
create or replace function public.crisis_map_logger() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid; mid uuid;
begin
  cid := coalesce(new.crisis_id, old.crisis_id);
  mid := (public.crisis_me(cid)).id;
  insert into public.crisis_map_log(crisis_id, member_id, action, payload)
  values (cid, mid, tg_table_name || ':' || lower(tg_op),
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger crisis_units_log after insert or update or delete on public.crisis_units for each row execute function public.crisis_map_logger();
create trigger crisis_shapes_log after insert or update or delete on public.crisis_shapes for each row execute function public.crisis_map_logger();
create trigger crisis_regions_log after insert or update or delete on public.crisis_map_regions for each row execute function public.crisis_map_logger();

-- ─────────────────────────── Room broadcasts accept crisis news ───────────────────────────

alter table public.session_broadcasts drop constraint session_broadcasts_source_check;
alter table public.session_broadcasts add constraint session_broadcasts_source_check
  check (source = any (array['organiser','press','crisis']));
alter table public.session_broadcasts drop constraint session_broadcasts_author_label_check;
alter table public.session_broadcasts add constraint session_broadcasts_author_label_check check (
  ((source = 'organiser') and (author_label is null))
  or ((source in ('press','crisis')) and (author_label is not null)
      and (char_length(btrim(author_label)) between 1 and 80) and (kind = 'informational')));

-- ─────────────────────────── RPCs ───────────────────────────

-- The caller's crises, for /crisis.
create or replace function public.crisis_my_list()
returns table (crisis_id uuid, crisis_slug text, crisis_name text, conference_slug text, conference_name text,
               conference_acronym text, logo_url text, start_date date, role text)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, f.slug, f.full_name, f.acronym, f.logo_url, f.start_date,
         coalesce(m.role, 'organiser')
  from public.crises c
  join public.conferences f on f.id = c.conference_id
  left join public.crisis_members m on m.crisis_id = c.id and m.user_id = auth.uid()
  where auth.uid() is not null and (m.id is not null or public.is_conference_organizer(c.conference_id))
  order by f.start_date desc nulls last, c.name
$$;

-- Resolve /crisis/<conference>/<crisis> and say who the caller is there.
create or replace function public.crisis_resolve(p_conference_slug text, p_crisis_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c record; r text; me public.crisis_members;
begin
  select cr.*, f.slug as conf_slug, f.full_name as conf_name, f.acronym as conf_acronym, f.logo_url as conf_logo
    into c from public.crises cr join public.conferences f on f.id = cr.conference_id
   where f.slug = p_conference_slug and cr.slug = p_crisis_slug;
  if not found then return jsonb_build_object('found', false); end if;
  r := public.crisis_role(c.id);
  if r is null then return jsonb_build_object('found', true, 'allowed', false); end if;
  me := public.crisis_me(c.id);
  return jsonb_build_object('found', true, 'allowed', true, 'crisis_id', c.id, 'role', r,
    'member_id', me.id, 'cabinet_id', me.cabinet_id, 'character_id', me.character_id, 'display_name', me.display_name,
    'conference', jsonb_build_object('id', c.conference_id, 'slug', c.conf_slug, 'name', c.conf_name, 'acronym', c.conf_acronym, 'logo_url', c.conf_logo));
end $$;

-- Organiser switches Gavelling Crisis on for a crisis committee (creates the crisis and its first cabinet).
create or replace function public.crisis_enable(p_conference_committee uuid, p_package text default 'full', p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cc record; base text; s text; n int := 1; cid uuid; existing uuid;
begin
  select * into cc from public.conference_committees where id = p_conference_committee;
  if not found then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
  if not public.is_conference_organizer(cc.conference_id) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  select crisis_id into existing from public.crisis_cabinets where conference_committee_id = p_conference_committee;
  if existing is not null then
    return jsonb_build_object('ok', true, 'crisis_id', existing, 'created', false,
      'slug', (select slug from public.crises where id = existing));
  end if;
  base := lower(regexp_replace(coalesce(nullif(btrim(cc.abbreviation), ''), cc.name), '[^A-Za-z0-9]+', '-', 'g'));
  base := btrim(left(base, 50), '-');
  if base = '' then base := 'crisis'; end if;
  s := base;
  while exists (select 1 from public.crises where conference_id = cc.conference_id and slug = s) loop
    n := n + 1; s := base || '-' || n;
  end loop;
  insert into public.crises(conference_id, slug, name, package)
  values (cc.conference_id, s, coalesce(nullif(btrim(p_name), ''), cc.name), case when p_package in ('basic','full') then p_package else 'full' end)
  returning id into cid;
  insert into public.crisis_cabinets(crisis_id, conference_committee_id, name, short_name)
  values (cid, cc.id, cc.name, nullif(btrim(cc.abbreviation), ''));
  return jsonb_build_object('ok', true, 'crisis_id', cid, 'created', true, 'slug', s);
end $$;

-- Link a second crisis committee as another cabinet (joint crisis).
create or replace function public.crisis_add_cabinet(p_crisis uuid, p_conference_committee uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cc record; cab uuid;
begin
  if not public.crisis_is_director(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  select * into cc from public.conference_committees where id = p_conference_committee
    and conference_id = (select conference_id from public.crises where id = p_crisis);
  if not found then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
  insert into public.crisis_cabinets(crisis_id, conference_committee_id, name, short_name, color, sort)
  values (p_crisis, cc.id, cc.name, nullif(btrim(cc.abbreviation), ''), '#3E6A9A',
          (select coalesce(max(sort), 0) + 1 from public.crisis_cabinets where crisis_id = p_crisis))
  returning id into cab;
  update public.crises set kind = 'joint' where id = p_crisis;
  return cab;
end $$;

-- Characters from each cabinet's seats, delegates from allocations. Idempotent.
create or replace function public.crisis_sync_roster(p_crisis uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cab record; s record; a record; chr uuid; added_c int := 0; added_m int := 0;
begin
  if not public.crisis_is_director(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  for cab in select * from public.crisis_cabinets where crisis_id = p_crisis and conference_committee_id is not null loop
    for s in select * from public.committee_country_slots where conference_committee_id = cab.conference_committee_id order by country_name loop
      if not exists (select 1 from public.crisis_characters where slot_id = s.id) then
        insert into public.crisis_characters(crisis_id, cabinet_id, name, picture_url, slot_id)
        values (p_crisis, cab.id, coalesce(nullif(btrim(s.country_name), ''), s.country_code), s.logo_url, s.id);
        added_c := added_c + 1;
      end if;
    end loop;
    for a in select al.*, p.display_name, u.email
               from public.conference_allocations al
               left join public.profiles p on p.id = al.user_id
               left join auth.users u on u.id = al.user_id
              where al.conference_committee_id = cab.conference_committee_id and al.user_id is not null loop
      chr := null;
      select ch.id into chr from public.crisis_characters ch
        join public.committee_country_slots sl on sl.id = ch.slot_id
       where ch.cabinet_id = cab.id and (sl.country_code = a.country_code or sl.country_name = a.country_name) limit 1;
      if not exists (select 1 from public.crisis_members where crisis_id = p_crisis and user_id = a.user_id) then
        insert into public.crisis_members(crisis_id, user_id, role, cabinet_id, character_id, display_name, email)
        values (p_crisis, a.user_id, 'delegate', cab.id, chr, coalesce(nullif(btrim(a.display_name), ''), a.country_name, 'Delegate'), a.email);
        added_m := added_m + 1;
      end if;
    end loop;
    -- Chairs of the committee join as chairs.
    insert into public.crisis_members(crisis_id, user_id, role, cabinet_id, display_name, email)
    select p_crisis, u.id, 'chair', cab.id, coalesce(nullif(btrim(p.display_name), ''), 'Chair'), u.email
      from public.conference_committees cc
      cross join lateral unnest(cc.chair_user_ids) as ch(uid)
      join auth.users u on u.id = ch.uid
      left join public.profiles p on p.id = u.id
     where cc.id = cab.conference_committee_id
       and not exists (select 1 from public.crisis_members m where m.crisis_id = p_crisis and m.user_id = u.id);
  end loop;
  return jsonb_build_object('characters_added', added_c, 'members_added', added_m);
end $$;

-- A delegate sends a directive.
create or replace function public.crisis_submit_directive(p_crisis uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.crisis_members; c record; cooldown int; wlimit int; last_at timestamptz; nno int;
        did uuid; words int; owner uuid; k text; co uuid;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null or me.role <> 'delegate' then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  select * into c from public.crises where id = p_crisis for update;
  if not c.directives_open then return jsonb_build_object('ok', false, 'reason', 'paused', 'note', c.directives_paused_note); end if;
  cooldown := coalesce((c.settings ->> 'cooldownSeconds')::int, 180);
  wlimit := coalesce((c.settings ->> 'wordLimit')::int, 300);
  select max(created_at) into last_at from public.crisis_directives where author_member_id = me.id;
  if last_at is not null and cooldown > 0 and now() < last_at + make_interval(secs => cooldown) then
    return jsonb_build_object('ok', false, 'reason', 'cooldown',
      'wait_seconds', ceil(extract(epoch from (last_at + make_interval(secs => cooldown) - now())))::int);
  end if;
  words := coalesce(array_length(regexp_split_to_array(btrim(coalesce(p ->> 'body', '')), '\s+'), 1), 0);
  if wlimit > 0 and words > wlimit then return jsonb_build_object('ok', false, 'reason', 'too_long', 'limit', wlimit); end if;
  k := coalesce(nullif(p ->> 'kind', ''), 'personal');
  nno := c.next_directive_no;
  update public.crises set next_directive_no = next_directive_no + 1 where id = p_crisis;
  select owner_member_id into owner from public.crisis_characters where id = me.character_id;
  insert into public.crisis_directives(crisis_id, no, kind, cabinet_id, author_member_id, author_character_id, title, receiver,
         themes, body, resources_used, goal, affects, covert, assigned_member_id)
  values (p_crisis, nno, k, me.cabinet_id, me.id, me.character_id, btrim(p ->> 'title'), btrim(p ->> 'receiver'),
          coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'themes', '[]'::jsonb))), '{}'),
          btrim(p ->> 'body'), nullif(btrim(p ->> 'resources_used'), ''), nullif(btrim(p ->> 'goal'), ''),
          nullif(btrim(p ->> 'affects'), ''), coalesce((p ->> 'covert')::boolean, true), owner)
  returning id into did;
  if k = 'joint' then
    for co in select (jsonb_array_elements_text(coalesce(p -> 'coauthors', '[]'::jsonb)))::uuid loop
      insert into public.crisis_directive_coauthors(directive_id, character_id)
      select did, co where exists (select 1 from public.crisis_characters where id = co and crisis_id = p_crisis)
      on conflict do nothing;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'id', did, 'no', nno);
end $$;

-- Staff take a directive (claim), or hand it to someone (assign). Directors and backroomers can do both.
create or replace function public.crisis_assign_directive(p_directive uuid, p_member uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare d record; me public.crisis_members; target uuid;
begin
  select * into d from public.crisis_directives where id = p_directive;
  if not found or not public.crisis_is_staff(d.crisis_id) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  me := public.crisis_me(d.crisis_id);
  target := coalesce(p_member, me.id);
  if target is not null and not exists (select 1 from public.crisis_members where id = target and crisis_id = d.crisis_id
       and role in ('director','assistant_director','backroomer')) then
    raise exception 'crisis_not_found' using errcode = 'P0002';
  end if;
  update public.crisis_directives
     set assigned_member_id = target,
         status = case when status = 'queued' and p_member is null then 'claimed' else status end,
         claimed_at = case when p_member is null then now() else claimed_at end
   where id = p_directive;
  return true;
end $$;

-- Staff answer. p_effects: {"resources":[{"id":uuid,"delta":n}], "news":{"title","body","source_label","audience_cabinet_id"}}
create or replace function public.crisis_answer_directive(p_directive uuid, p_outcome text, p_reply text, p_effects jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d record; me public.crisis_members; e jsonb; r record; nid uuid;
begin
  select * into d from public.crisis_directives where id = p_directive for update;
  if not found or not public.crisis_is_staff(d.crisis_id) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  if p_outcome not in ('approved','partial','denied','clarify','later') then raise exception 'crisis_bad_outcome' using errcode = '22023'; end if;
  if coalesce(btrim(p_reply), '') = '' then raise exception 'crisis_reply_required' using errcode = '22023'; end if;
  me := public.crisis_me(d.crisis_id);
  update public.crisis_directives
     set outcome = p_outcome, reply = btrim(p_reply),
         status = case when p_outcome = 'clarify' then 'clarify' else 'answered' end,
         answered_at = now(), answered_by = me.id,
         assigned_member_id = coalesce(assigned_member_id, me.id)
   where id = p_directive;
  for e in select * from jsonb_array_elements(coalesce(p_effects -> 'resources', '[]'::jsonb)) loop
    if public.crisis_can(d.crisis_id, 'resources') then
      r := null;
      update public.crisis_resources set amount = amount + (e ->> 'delta')::numeric, updated_at = now()
       where id = (e ->> 'id')::uuid and crisis_id = d.crisis_id returning * into r;
      if r.id is not null then
        insert into public.crisis_resource_log(crisis_id, resource_id, delta, amount_after, reason, directive_id, member_id)
        values (d.crisis_id, r.id, (e ->> 'delta')::numeric, r.amount, 'Directive ' || d.no, d.id, me.id);
      end if;
    end if;
  end loop;
  if p_effects ? 'news' and coalesce(btrim(p_effects -> 'news' ->> 'title'), '') <> '' then
    insert into public.crisis_news(crisis_id, title, body, source_label, audience_cabinet_id, author_member_id, directive_id)
    values (d.crisis_id, btrim(p_effects -> 'news' ->> 'title'), coalesce(nullif(btrim(p_effects -> 'news' ->> 'body'), ''), btrim(p_effects -> 'news' ->> 'title')),
            nullif(btrim(p_effects -> 'news' ->> 'source_label'), ''), nullif(p_effects -> 'news' ->> 'audience_cabinet_id', '')::uuid, me.id, d.id)
    returning id into nid;
  end if;
  return jsonb_build_object('ok', true, 'news_id', nid);
end $$;

-- A note on a directive: staff (optionally internal) or the author answering a clarification.
create or replace function public.crisis_add_directive_note(p_directive uuid, p_body text, p_internal boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare d record; me public.crisis_members; staff boolean; nid uuid;
begin
  select * into d from public.crisis_directives where id = p_directive;
  if not found then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
  me := public.crisis_me(d.crisis_id);
  staff := public.crisis_is_staff(d.crisis_id);
  if not staff and (me.id is null or me.id is distinct from d.author_member_id) then
    raise exception 'crisis_forbidden' using errcode = '42501';
  end if;
  insert into public.crisis_directive_notes(directive_id, crisis_id, member_id, body, internal)
  values (p_directive, d.crisis_id, me.id, btrim(p_body), staff and coalesce(p_internal, false))
  returning id into nid;
  if not staff and d.status = 'clarify' then
    update public.crisis_directives set status = 'queued', waiting_since = now() where id = p_directive;
  end if;
  return nid;
end $$;

-- Save a news draft (staff).
create or replace function public.crisis_save_news(p_crisis uuid, p_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare me public.crisis_members; nid uuid;
begin
  if not public.crisis_is_staff(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  me := public.crisis_me(p_crisis);
  if p_id is null then
    insert into public.crisis_news(crisis_id, title, body, source_label, image_url, audience_cabinet_id, author_member_id)
    values (p_crisis, btrim(p ->> 'title'), btrim(p ->> 'body'), nullif(btrim(p ->> 'source_label'), ''),
            nullif(p ->> 'image_url', ''), nullif(p ->> 'audience_cabinet_id', '')::uuid, me.id)
    returning id into nid;
  else
    update public.crisis_news set title = btrim(p ->> 'title'), body = btrim(p ->> 'body'),
           source_label = nullif(btrim(p ->> 'source_label'), ''), image_url = nullif(p ->> 'image_url', ''),
           audience_cabinet_id = nullif(p ->> 'audience_cabinet_id', '')::uuid
     where id = p_id and crisis_id = p_crisis and status = 'draft'
    returning id into nid;
  end if;
  return nid;
end $$;

-- Publish news: marks it published and puts it into every target cabinet's live room as a pop-up.
create or replace function public.crisis_publish_news(p_news uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n record; c record; me public.crisis_members; needs boolean; rooms int := 0; cab record;
begin
  select * into n from public.crisis_news where id = p_news for update;
  if not found then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
  select * into c from public.crises where id = n.crisis_id;
  needs := coalesce((c.settings ->> 'newsNeedsApproval')::boolean, true);
  if not (public.crisis_is_director(n.crisis_id) or (not needs and public.crisis_can(n.crisis_id, 'news'))) then
    raise exception 'crisis_forbidden' using errcode = '42501';
  end if;
  if n.status = 'published' then return jsonb_build_object('ok', true, 'rooms', 0, 'already', true); end if;
  me := public.crisis_me(n.crisis_id);
  update public.crisis_news set status = 'published', published_at = now(), published_by = me.id where id = p_news;
  for cab in select cc.session_id from public.crisis_cabinets cb
               join public.conference_committees cc on cc.id = cb.conference_committee_id
              where cb.crisis_id = n.crisis_id and cc.session_id is not null
                and (n.audience_cabinet_id is null or cb.id = n.audience_cabinet_id) loop
    insert into public.session_broadcasts(committee_id, conference_id, kind, message, image_url, source, author_label, created_by, expires_at)
    values (cab.session_id, c.conference_id, 'informational', n.title || E'\n\n' || n.body, n.image_url, 'crisis',
            coalesce(n.source_label, 'Crisis update'), auth.uid(), now() + interval '20 minutes');
    rooms := rooms + 1;
  end loop;
  return jsonb_build_object('ok', true, 'rooms', rooms);
end $$;

-- Set or change a resource (staff with the resources power).
create or replace function public.crisis_adjust_resource(p_resource uuid, p_delta numeric, p_reason text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare r record; me public.crisis_members;
begin
  select * into r from public.crisis_resources where id = p_resource for update;
  if not found or not public.crisis_can(r.crisis_id, 'resources') then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  me := public.crisis_me(r.crisis_id);
  update public.crisis_resources set amount = amount + p_delta, updated_at = now() where id = p_resource returning * into r;
  insert into public.crisis_resource_log(crisis_id, resource_id, delta, amount_after, reason, member_id)
  values (r.crisis_id, r.id, p_delta, r.amount, nullif(btrim(p_reason), ''), me.id);
  return r.amount;
end $$;

-- What a delegate may see of other cabinets (settings.otherCabinets: hidden | names | full).
create or replace function public.crisis_world(p_crisis uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare vis text; mine uuid; staff boolean;
begin
  if not public.crisis_is_member(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  staff := public.crisis_is_staff(p_crisis) or public.crisis_role(p_crisis) in ('chair','press');
  mine := public.crisis_my_cabinet(p_crisis);
  select coalesce(settings ->> 'otherCabinets', 'names') into vis from public.crises where id = p_crisis;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', ch.id, 'cabinet_id', ch.cabinet_id, 'name', ch.name, 'status', ch.status,
      'title', case when staff or ch.cabinet_id = mine or vis = 'full' then ch.title end,
      'bio', case when staff or ch.cabinet_id = mine or vis = 'full' then ch.bio end,
      'picture_url', case when staff or ch.cabinet_id = mine or vis = 'full' then ch.picture_url end)
      order by ch.sort, ch.name)
    from public.crisis_characters ch
    where ch.crisis_id = p_crisis and ch.status <> 'spare'
      and (staff or ch.cabinet_id = mine or vis <> 'hidden')), '[]'::jsonb);
end $$;

grant execute on function public.crisis_me(uuid), public.crisis_role(uuid), public.crisis_is_director(uuid),
  public.crisis_is_staff(uuid), public.crisis_is_member(uuid), public.crisis_can(uuid, text), public.crisis_my_cabinet(uuid),
  public.crisis_resolve(text, text), public.crisis_submit_directive(uuid, jsonb), public.crisis_assign_directive(uuid, uuid),
  public.crisis_answer_directive(uuid, text, text, jsonb), public.crisis_add_directive_note(uuid, text, boolean),
  public.crisis_save_news(uuid, uuid, jsonb), public.crisis_publish_news(uuid), public.crisis_adjust_resource(uuid, numeric, text),
  public.crisis_world(uuid)
  to anon, authenticated;
grant execute on function public.crisis_my_list(), public.crisis_enable(uuid, text, text), public.crisis_add_cabinet(uuid, uuid),
  public.crisis_sync_roster(uuid) to authenticated;
revoke execute on function public.crisis_my_list(), public.crisis_enable(uuid, text, text), public.crisis_add_cabinet(uuid, uuid),
  public.crisis_sync_roster(uuid) from anon, public;

-- Realtime (applied as crisis_part1_core, then crisis_part1_unpublish_members)
alter publication supabase_realtime add table public.crises, public.crisis_directives, public.crisis_directive_notes,
  public.crisis_news, public.crisis_units, public.crisis_shapes, public.crisis_map_regions, public.crisis_resources,
  public.crisis_characters;
-- crisis_members is not published: its column grants hide the hashes, so clients poll it.
