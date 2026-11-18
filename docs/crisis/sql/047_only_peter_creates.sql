-- Gavelling Crisis part 47 (18 Nov 2026): Gavelling Crisis stays private to Peter for now.
-- Owner: "why are other crises appearing on the /crisis tab? for now it should only be the ones i create" and "there should be
-- no trace of the crisis software beyond what i tell you". Four organisers had found "Switch on Gavelling Crisis" on their own
-- crisis committees in Manage > Committees and made a crisis, and /crisis listed every crisis to Peter because a platform
-- admin counts as the organiser of every conference.
--
-- 1. crisis_creators: the accounts that may switch Gavelling Crisis on. Peter only. RLS on, no policies: read only through
--    crisis_can_create().
-- 2. crisis_enable refuses anyone else (an existing crisis is still opened for its organisers, as before).
-- 3. crisis_my_list lists a crisis only to its members, to the account that created it, and to the real organisers of its
--    conference (a conference_organizers row; the platform admin bypass no longer counts here).

set local lock_timeout = '3s';

create table if not exists public.crisis_creators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.crisis_creators enable row level security;
revoke all on public.crisis_creators from anon, authenticated;
insert into public.crisis_creators (user_id)
select id from auth.users where lower(email) = 'petizakhar@gmail.com'
on conflict do nothing;

create or replace function public.crisis_can_create()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.crisis_creators where user_id = auth.uid())
$$;
revoke all on function public.crisis_can_create() from public;
grant execute on function public.crisis_can_create() to anon, authenticated;

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
  -- Only the accounts in crisis_creators switch Gavelling Crisis on (part 47).
  if not public.crisis_can_create() then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
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

create or replace function public.crisis_my_list()
returns table(crisis_id uuid, crisis_slug text, crisis_name text, conference_slug text, conference_name text, conference_acronym text, logo_url text, start_date date, role text)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, f.slug, f.full_name, f.acronym, f.logo_url, f.start_date,
         coalesce(m.role, 'organiser')
  from public.crises c
  join public.conferences f on f.id = c.conference_id
  left join public.crisis_members m on m.crisis_id = c.id and m.user_id = auth.uid()
  where auth.uid() is not null
    and (m.id is not null
      or c.created_by = auth.uid()
      or exists (select 1 from public.conference_organizers o where o.conference_id = c.conference_id and o.user_id = auth.uid()))
  order by f.start_date desc nulls last, c.name
$$;
