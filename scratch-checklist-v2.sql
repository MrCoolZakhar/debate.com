-- ═════════════════════════════════════════════════════════════════════════════
-- scratch-checklist-v2.sql  — the organiser set-up checklist, version 2
-- Written 12 Oct 2026. APPLIED 12 Oct 2026 as migration organiser_checklist_v2 (sections 0-7, section 7 kept). Applying it is the owner's call, through the
-- chat's Supabase work (CLAUDE.md: never from a Claude Code run).
--
-- Owner (Peter): the checklist is exactly these 7 steps, in this order:
--   1 page            Conference Page             (unchanged)
--   2 committees      Committees                  (unchanged)
--   3 applications    Launch applications         (NEW)
--   4 financials      Financials                  (unchanged: conference_payments_ready)
--   5 communications  Go to the Communications page (NEW, replaces 'email')
--   6 chairs          Invite chairs               (unchanged)
--   7 store           Visit the Store             (NEW)
-- Gone: 'email' (folded into 'communications'), 'secretariat', 'publish'.
--
-- Blue checkmark (v_ver_keys): the first six, i.e. everything except 'store'.
--
-- What reads conference_setup_status() (all checked read-only on 12 Oct 2026):
--   * refresh_conference_verification()  -> verification_ready (the mark)
--     refresh_all_conference_verifications(), cron 'refresh-conference-verifications' (:20 hourly)
--   * my_incomplete_conferences()        -> SetupReminderGate (titles + hrefs from items)
--   * queue_checkmark_emails()           -> cron 'checkmark-emails' 10:30 daily
--   * send-setup-nudges edge fn v14      -> cron 'organiser-setup-nudges' 09:00 daily
--                                           ("STILL TO DO" = items where not done)
--   * admin_conference_overview()        -> /admin Conferences (fallback total, pending_keys)
--   * admin_conference_detail()          -> filters items to verification_keys (generic)
--   * admin_platform_metrics()           -> setup_complete count (generic)
--   Nothing hardcodes the old keys except conference_setup_status itself and the
--   fallback 8 in admin_conference_overview (fixed below; it was already stale).
--
-- EMAIL SAFETY. Applying this sends nothing by itself: no trigger on
-- conferences sends email, and is_verified has no AFTER trigger. But two daily
-- crons would react to the new list, so sections 6 and 7 below pre-record the
-- bookkeeping rows those crons check, inside the same transaction:
--   * send-setup-nudges skips later milestones ONLY while a conference has
--     nothing pending. 'store' is pending everywhere on day one, so every
--     conference whose set-up was complete becomes eligible again: measured on
--     12 Oct 2026, 73 organiser addresses across 22 conferences would get a
--     catch-up drip email at 09:00 the next morning ("Last one about X",
--     "Still N things to finish"). Section 6 marks their already-due
--     milestones 'superseded' (exactly what the function itself writes for the
--     milestones it skips), so only FUTURE milestones go out on their normal
--     schedule.
--   * queue_checkmark_emails sends "X is now verified" (variant 61) once to every
--     organiser of a newly verified conference, and "about N minutes from its
--     checkmark" (60) to a conference that lost it and was never sent 60. On
--     12 Oct 2026 that is 3 active gainers (UGMUN, LSYC, BDMUN) and 1 loser (KMK).
--     Section 7 runs the refresh now and pre-records those rows, so nobody is
--     emailed because of this change. DELETE SECTION 7 if the owner wants the
--     three congratulations to go out at 10:30 instead (that is 3 conferences'
--     organisers, one email each; KMK's would get the 60 reminder).
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Baseline, taken with the OLD function, for the email guards below ────
create temp table _ckv2_before on commit drop as
select c.id,
       c.is_verified as was_verified,
       coalesce((public.conference_setup_status(c.id)->>'setup_complete')::boolean, false) as was_complete
  from conferences c
 where c.status <> 'archived';

-- ── 1. Two server-owned "visited" stamps ─────────────────────────────────────
alter table public.conferences
  add column if not exists comms_visited_at timestamptz,
  add column if not exists store_visited_at timestamptz;

comment on column public.conferences.comms_visited_at is
  'First time an organiser of this conference opened /manage/[slug]/communications. Written only by mark_organiser_visit(). Checklist step "Go to the Communications page".';
comment on column public.conferences.store_visited_at is
  'First time an organiser of this conference opened /manage/[slug]/store. Written only by mark_organiser_visit(). Checklist step "Visit the Store".';

-- authenticated holds a table-level UPDATE on conferences (organisers edit their
-- conference through RLS), so a column REVOKE would not stop a direct write.
-- This trigger does: outside mark_organiser_visit() (or the service role) a
-- write to either stamp is silently ignored, and an INSERT starts them null.
create or replace function public.guard_organiser_visit_stamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_bypass boolean :=
    coalesce(current_setting('gavelling.allow_visit_stamp', true), '') = 'on'
    or current_user in ('postgres', 'supabase_admin', 'service_role');
begin
  if v_bypass then return new; end if;
  if tg_op = 'INSERT' then
    new.comms_visited_at := null;
    new.store_visited_at := null;
  else
    new.comms_visited_at := old.comms_visited_at;
    new.store_visited_at := old.store_visited_at;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_organiser_visit_stamps on public.conferences;
create trigger trg_guard_organiser_visit_stamps
  before insert or update on public.conferences
  for each row execute function public.guard_organiser_visit_stamps();

-- ── 2. mark_organiser_visit(conference, page) ────────────────────────────────
-- Called once per page load by the Communications page and the Store page,
-- fire-and-forget. Only 'communications' or 'store'; only a REAL organiser
-- (the owner or a conference_organizers row: deliberately not
-- is_conference_organizer(), which also lets platform admins in, so staff
-- looking at a conference never tick its checklist). Sets the stamp once and
-- returns nothing to anyone, so it reveals nothing about a conference the
-- caller does not run.
create or replace function public.mark_organiser_visit(p_conference uuid, p_page text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_changed int := 0;
begin
  if v_uid is null or p_conference is null or p_page is null
     or p_page not in ('communications', 'store') then
    return;
  end if;
  if not exists (select 1 from conferences x where x.id = p_conference and x.organizer_id = v_uid)
     and not exists (select 1 from conference_organizers o
                      where o.conference_id = p_conference and o.user_id = v_uid) then
    return;
  end if;

  perform set_config('gavelling.allow_visit_stamp', 'on', true);
  if p_page = 'communications' then
    update conferences set comms_visited_at = now()
     where id = p_conference and comms_visited_at is null;
  else
    update conferences set store_visited_at = now()
     where id = p_conference and store_visited_at is null;
  end if;
  get diagnostics v_changed = row_count;
  perform set_config('gavelling.allow_visit_stamp', 'off', true);

  -- 'communications' is a checkmark criterion: keep the stored mark in step
  -- now instead of at the next hourly sweep. Idempotent, sends nothing.
  if v_changed > 0 and p_page = 'communications' then
    perform public.refresh_conference_verification(p_conference);
  end if;
end $$;

revoke all on function public.mark_organiser_visit(uuid, text) from public, anon;
grant execute on function public.mark_organiser_visit(uuid, text) to authenticated;

-- ── 3. conference_setup_status(): the 7 items ────────────────────────────────
-- Same output shape as before (every key kept). setup_total stays
-- jsonb_array_length(v_items) = 7. verification_* now covers the first six.
-- REFRESHED 21 Oct 2026 (Christian's chat): this block is now the LIVE definition of
-- conference_setup_status() as of 21 Oct (financials before applications; the 'chairs' stage is
-- 'List Chair, Secretariat or Staff Positions', done by a chair, a published job listing or
-- conferences.jobs_later_at). The older copy that stood here would have undone that if re-run.
-- The database is the truth: before re-running, compare with pg_get_functiondef.
CREATE OR REPLACE FUNCTION public.conference_setup_status(p_conference_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c                 conferences%rowtype;
  v_committees      int;
  v_missing_chairs  int;
  v_capacity        int;
  v_expected        int;
  v_required        int;
  v_roles_enabled   int;
  v_roles_live      int;
  v_self_apps       boolean;
  v_apps_done       boolean;
  v_comms_done      boolean;
  v_payments_ready  boolean;
  v_items           jsonb;
  v_year            text;
  v_base            text;
  v_display         text;
  v_ver_keys        text[] := array['page','committees','applications','financials','communications','chairs','store'];
  v_ver_pending     jsonb;
  v_ver_minutes     int;
begin
  if auth.uid() is not null
     and not public.is_conference_organizer(p_conference_id) then
    return null;
  end if;

  select * into c from conferences where id = p_conference_id;
  if not found then return null; end if;

  v_base := coalesce(nullif(btrim(c.acronym), ''), c.full_name);
  v_year := to_char(coalesce(c.start_date, c.end_date), 'YYYY');
  v_display := case
    when v_year is null then v_base
    when v_base like '%' || v_year || '%' then v_base
    when v_base like '%''' || right(v_year, 2) || '%' then v_base
    when v_base ~ ('(^|[^0-9])' || right(v_year, 2) || '$') then v_base
    else v_base || ' ' || v_year
  end;

  select count(*) into v_committees from conference_committees where conference_id = c.id;

  select count(*) into v_missing_chairs from conference_committees cc
   where cc.conference_id = c.id
     and (cc.chair_user_ids is null or cardinality(cc.chair_user_ids) = 0)
     and not exists (
       select 1 from conference_chair_invites ci
        where ci.committee_id = cc.id
          and ci.conference_id = c.id
          and ci.status = 'pending');

  select coalesce(sum(s.delegation_size), 0) into v_capacity
    from conference_committees cc
    join committee_country_slots s on s.conference_committee_id = cc.id
   where cc.conference_id = c.id;

  v_expected := coalesce(c.expected_delegates, 0);
  v_required := ceil(v_expected * 0.7);

  v_payments_ready := public.conference_payments_ready(c.id);

  select count(*) filter (where r.is_enabled),
         count(*) filter (where r.is_enabled
                            and (r.applications_close_at is null or r.applications_close_at > now()))
    into v_roles_enabled, v_roles_live
    from application_role_configs r
   where r.conference_id = c.id;
  v_self_apps := exists (select 1 from applications a
                          where a.conference_id = c.id and a.invited_email is null);
  v_apps_done := v_roles_live > 0 or v_self_apps;

  v_comms_done := c.comms_visited_at is not null or c.emails_explored_at is not null;

  v_items := jsonb_build_array(
    jsonb_build_object('key','page','title','Set up your conference page','minutes',5,
      'done', (c.banner_url is not null and coalesce(btrim(c.description),'') <> ''
                and not c.dates_tbd and c.start_date is not null),
      'todo', case
        when (c.dates_tbd or c.start_date is null)
         and (c.banner_url is null or coalesce(btrim(c.description),'') = '')
          then 'Add your conference dates, a banner image and a description.'
        when (c.dates_tbd or c.start_date is null)
          then 'Add your conference dates so delegates can plan their trip.'
        else 'Add a banner image and a description delegates will actually read.' end,
      'href', case when (c.dates_tbd or c.start_date is null)
        then '/settings?tab=general&focus=dates' else '/settings?tab=general' end),
    jsonb_build_object('key','committees','title','Add committees with enough seats','minutes',10,
      'done', (v_committees > 0 and (v_expected = 0 or v_capacity >= v_required)),
      'todo', case when v_committees = 0 then 'Create your committees and set their country lists, so they appear in applications.'
        when v_expected > 0 and v_capacity < v_required then
          format('You are expecting %s delegates but your committees only seat %s. About %s more seats would cover most of them.',
                 v_expected, v_capacity, v_required - v_capacity)
        else 'Committees are ready.' end, 'href','/committees'),
    jsonb_build_object('key','financials','title','Add financial information','minutes',5,'done', v_payments_ready,
      'todo','Choose how you get paid, or tell us it is free, so delegates know how to pay.',
      'href','/financials?open=payment'),
    jsonb_build_object('key','applications','title','Launch applications','minutes',5,
      'done', v_apps_done,
      'todo', case
        when v_apps_done then 'Applications are open.'
        when v_roles_enabled > 0 then 'Your application windows have closed. Reopen a role or move its closing date.'
        when false then ''
        else 'Open applications for at least one role so delegates can apply.' end,
      'href','/settings?tab=applications'),
    jsonb_build_object('key','communications','title','Go to the Communications page','minutes',2,
      'done', v_comms_done,
      'todo','Take a look at the emails applicants get automatically and the questions they send you.',
      'href','/communications'),
    jsonb_build_object('key','chairs','title','List Chair, Secretariat or Staff Positions','minutes',3,
      -- 21 Oct 2026 (owner): a listing on the Job Board, a chair already invited or assigned, or "Do it Later" ticks it.
      'done', ((v_committees > 0 and v_missing_chairs < v_committees)
               or exists (select 1 from job_listings l where l.conference_id = c.id and l.published_at is not null)
               or c.jobs_later_at is not null),
      'todo', 'Post your chair, secretariat and staff roles on the Job Board so people can apply.',
      'href','/jobs'),
    jsonb_build_object('key','store','title','Visit the Store','minutes',1,
      'done', (c.store_visited_at is not null),
      'todo','See how Spotlights and email packs can bring your conference more delegates.',
      'href','/store')
  );

  select coalesce(jsonb_agg(i->>'key'), '[]'::jsonb), coalesce(sum((i->>'minutes')::int), 0)
    into v_ver_pending, v_ver_minutes
    from jsonb_array_elements(v_items) i
   where not (i->>'done')::boolean and (i->>'key') = any (v_ver_keys)
     and not ((i->>'key') = 'store'
              and exists (select 1 from checkmark_store_exempt e where e.conference_id = c.id));

  return jsonb_build_object(
    'conference_id', c.id, 'slug', c.slug, 'acronym', c.acronym, 'full_name', c.full_name,
    'display_name', v_display, 'year', v_year,
    'is_public', c.is_public, 'status', c.status,
    'expected_delegates', v_expected, 'seat_capacity', v_capacity, 'required_seats', v_required,
    'items', v_items,
    'setup_total', jsonb_array_length(v_items),
    'setup_done', (select count(*) from jsonb_array_elements(v_items) i
                    where (i->>'done')::boolean),
    'setup_complete', not exists (select 1 from jsonb_array_elements(v_items) i
                                   where not (i->>'done')::boolean),
    'verification_keys', to_jsonb(v_ver_keys),
    'verification_pending', v_ver_pending,
    'verification_minutes_left', v_ver_minutes,
    'verification_ready', (jsonb_array_length(v_ver_pending) = 0),
    'is_verified', c.is_verified,
    'verified_at', c.verified_at);
end;
$function$;

-- ── 4. admin_conference_overview(): the hardcoded fallback total ─────────────
-- Only the `8` (already stale: the list was 7) changes, to 7. The rest of the
-- body is the live definition as read on 12 Oct 2026.
create or replace function public.admin_conference_overview()
 returns table(id uuid, slug text, acronym text, full_name text, is_public boolean, status text, dates_tbd boolean, start_date date, end_date date, city text, country text, expected_delegates integer, seat_capacity integer, setup_done integer, setup_total integer, setup_complete boolean, pending_keys text[], committees integer, chairs_missing integer, applications integer, paid_applications integer, organizer_name text, organizer_email text, created_at timestamp with time zone, updated_at timestamp with time zone, last_nudge_at timestamp with time zone, intent jsonb, is_verified boolean, verified_at timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorised';
  end if;

  return query
  select
    c.id, c.slug, c.acronym, c.full_name,
    c.is_public, c.status, c.dates_tbd,
    c.start_date, c.end_date, c.city, c.country,
    coalesce(c.expected_delegates, 0)::int,
    coalesce((s->>'seat_capacity')::int, 0),
    coalesce((s->>'setup_done')::int, 0),
    coalesce((s->>'setup_total')::int, 7),
    coalesce((s->>'setup_complete')::boolean, false),
    coalesce((select array_agg(i->>'key' order by ord)
                from jsonb_array_elements(s->'items') with ordinality as t(i, ord)
               where not (i->>'done')::boolean), '{}'::text[]),
    (select count(*)::int from conference_committees cc where cc.conference_id = c.id),
    (select count(*)::int from conference_committees cc
      where cc.conference_id = c.id
        and (cc.chair_user_ids is null or cardinality(cc.chair_user_ids) = 0)),
    (select count(*)::int from applications a where a.conference_id = c.id),
    (select count(distinct i.application_id)::int from invoices i join payments pay on pay.invoice_id = i.id
      where i.conference_id = c.id and pay.status = 'succeeded'),
    p.display_name, p.email,
    c.created_at, c.updated_at,
    (select max(n.sent_at) from conference_setup_nudges n where n.conference_id = c.id),
    coalesce(c.intent, '{}'::jsonb),
    -- The stored mark, not a recomputation: refresh_conference_verification()
    -- is the only writer and a guard trigger rejects direct writes, so this
    -- column is the same truth the public seal renders from.
    coalesce(c.is_verified, false),
    c.verified_at
  from conferences c
  left join profiles p on p.id = c.organizer_id
  cross join lateral public.conference_setup_status(c.id) as s
  order by c.is_public, c.updated_at desc;
end;
$function$;

-- ── 5. Recompute the stored checkmark NOW (sends nothing) ────────────────────
-- The hourly cron would do this at :20 anyway; doing it here makes section 7
-- exact. refresh_all_conference_verifications() only flips is_verified /
-- verified_at (verified_at is kept on a loss, set on a first gain).
select public.refresh_all_conference_verifications() as verification_flips;

-- ── 6. Guard: no catch-up drip from send-setup-nudges ───────────────────────
-- For every conference whose OLD set-up was complete and whose NEW one is not
-- (on day one: all of them, because nobody has visited the Store yet), mark
-- every milestone that is ALREADY due and not yet recorded for each organiser
-- address as 'superseded', the row the edge function itself writes for skipped
-- milestones. First contact on a track (1, 100) is excluded: the function sends
-- it whatever is pending, so this change does not affect it. Run-up (-7, -1)
-- is untouched for the same reason. Future milestones are not touched and go
-- out on their normal schedule, now listing the new steps.
with confs as (
  select c.id, c.organizer_id, c.created_at, c.published_at, c.is_public
    from conferences c
    join _ckv2_before b on b.id = c.id
   where b.was_complete
     and not coalesce((public.conference_setup_status(c.id)->>'setup_complete')::boolean, false)
     and coalesce(c.end_date, c.start_date, current_date) >= current_date
), recips as (
  select distinct f.*, p.email
    from confs f
    join lateral (select f.organizer_id as uid
                  union select o.user_id from conference_organizers o where o.conference_id = f.id) u on true
    join profiles p on p.id = u.uid
   where p.email is not null
), due as (
  select r.id, r.email, t.code
    from recips r
    cross join lateral unnest(
      case when r.is_public and r.published_at is not null
           then array[103,107,114,130] else array[3,7,14,30] end) as t(code)
   where (case when t.code > 100 then t.code - 100 else t.code end)
         <= floor(extract(epoch from now() - case when r.is_public and r.published_at is not null
                                                  then r.published_at else r.created_at end) / 86400)
)
insert into conference_setup_nudges (conference_id, recipient_email, cadence, variant, milestone, pending_keys)
select d.id, d.email, 'superseded', d.code, d.code, '{}'::text[]
  from due d
on conflict do nothing;

-- ── 7. Guard: no checkmark email caused by this change (OPTIONAL) ────────────
-- Delete this section to let queue_checkmark_emails congratulate the newly
-- verified conferences at 10:30 (and send the 60 reminder to those that lost
-- the mark). Rows mirror exactly what that function records after a send.
with changed as (
  select c.id, c.organizer_id, c.is_verified
    from conferences c
    join _ckv2_before b on b.id = c.id
   where c.is_verified is distinct from b.was_verified
), recips as (
  select distinct ch.id, ch.is_verified, p.email
    from changed ch
    join lateral (select ch.organizer_id as uid
                  union select o.user_id from conference_organizers o where o.conference_id = ch.id) u on true
    join profiles p on p.id = u.uid
   where p.email is not null
)
insert into conference_setup_nudges (conference_id, recipient_email, cadence, variant, milestone, pending_keys)
select r.id, r.email, 'checkmark', case when r.is_verified then 61 else 60 end, null, '{}'::text[]
  from recips r
 where not exists (select 1 from conference_setup_nudges n
                    where n.conference_id = r.id and n.recipient_email = r.email
                      and n.cadence = 'checkmark'
                      and n.variant = case when r.is_verified then 61 else 60 end);

commit;


-- ═════════════════════════════════════════════════════════════════════════════
-- READ-ONLY: who would gain or lose the blue checkmark (run BEFORE applying).
-- Mirrors the new rules with today's data. Non-archived conferences, like the
-- hourly sweep. On 12 Oct 2026: 30 verified now; 1 would lose it (KMK: no role
-- open and no applicant of its own); 4 would gain it (UGMUN, LSYC, BDMUN,
-- SMITMUN, all held back only by 'secretariat' / 'publish' / 'email').
-- For comparison, requiring a role to be inside its window today (no
-- "applications already received" allowance) would cost 13 verified
-- conferences their mark.
-- ═════════════════════════════════════════════════════════════════════════════
/*
with base as (
  select c.id, c.acronym, c.is_verified,
    (c.banner_url is not null and coalesce(btrim(c.description),'')<>'' and not c.dates_tbd and c.start_date is not null) page,
    (select count(*) from conference_committees cc where cc.conference_id=c.id) ncom,
    (select coalesce(sum(s.delegation_size),0) from conference_committees cc
       join committee_country_slots s on s.conference_committee_id=cc.id where cc.conference_id=c.id) cap,
    coalesce(c.expected_delegates,0) exp,
    (select count(*) from conference_committees cc where cc.conference_id=c.id
        and (cc.chair_user_ids is null or cardinality(cc.chair_user_ids)=0)
        and not exists (select 1 from conference_chair_invites ci
                         where ci.committee_id=cc.id and ci.conference_id=c.id and ci.status='pending')) miss,
    public.conference_payments_ready(c.id) fin,
    exists (select 1 from application_role_configs r where r.conference_id=c.id and r.is_enabled
             and (r.applications_close_at is null or r.applications_close_at > now()))
      or exists (select 1 from applications a where a.conference_id=c.id and a.invited_email is null) apps,
    (c.emails_explored_at is not null) comms   -- + comms_visited_at once the column exists
  from conferences c where c.status <> 'archived'
), s as (
  select *, (page and ncom>0 and (exp=0 or cap>=ceil(exp*0.7)) and apps and fin and comms and ncom>0 and miss<ncom) as new_verified
    from base
)
select count(*) filter (where is_verified)                       as verified_now,
       count(*) filter (where is_verified and not new_verified)  as would_lose,
       count(*) filter (where not is_verified and new_verified)  as would_gain,
       string_agg(acronym, ', ') filter (where is_verified and not new_verified) as losers,
       string_agg(acronym, ', ') filter (where not is_verified and new_verified) as gainers
  from s;
*/


-- ═════════════════════════════════════════════════════════════════════════════
-- ROLLED-BACK TEST. Run AFTER applying. Changes nothing, sends nothing
-- (it calls no sending function: only conference_setup_status,
-- mark_organiser_visit and plain reads).
-- ═════════════════════════════════════════════════════════════════════════════
/*
begin;
do $$
declare
  v_conf uuid; v_owner uuid; v_stranger uuid; s jsonb; v_keys text;
  v_store timestamptz; v_comms timestamptz;
begin
  select c.id, c.organizer_id into v_conf, v_owner
    from conferences c where c.organizer_id is not null and c.status <> 'archived'
     and c.store_visited_at is null limit 1;
  select p.id into v_stranger from profiles p
   where p.id <> v_owner
     and not exists (select 1 from conference_organizers o where o.conference_id = v_conf and o.user_id = p.id)
   limit 1;

  -- shape and order
  s := public.conference_setup_status(v_conf);
  select string_agg(i->>'key', ',' order by o) into v_keys
    from jsonb_array_elements(s->'items') with ordinality t(i, o);
  assert v_keys = 'page,committees,applications,financials,communications,chairs,store', v_keys;
  assert (s->>'setup_total')::int = 7;
  assert s->'verification_keys' = '["page","committees","applications","financials","communications","chairs"]'::jsonb;
  assert s ? 'verification_minutes_left' and s ? 'verification_ready' and s ? 'seat_capacity';

  -- a stranger: nothing stamped
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);
  perform public.mark_organiser_visit(v_conf, 'store');
  perform set_config('request.jwt.claims', '', true);
  select store_visited_at into v_store from conferences where id = v_conf;
  assert v_store is null, 'stranger stamped the store';

  -- the owner: a bad page does nothing, 'store' stamps once
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform public.mark_organiser_visit(v_conf, 'settings');
  perform public.mark_organiser_visit(v_conf, 'store');
  perform set_config('request.jwt.claims', '', true);
  select store_visited_at into v_store from conferences where id = v_conf;
  assert v_store is not null, 'owner visit not stamped';
  s := public.conference_setup_status(v_conf);
  assert exists (select 1 from jsonb_array_elements(s->'items') i
                  where i->>'key' = 'store' and (i->>'done')::boolean), 'store item not done';
  assert not (s->'verification_pending') ? 'store';

  -- a second visit keeps the first stamp
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform public.mark_organiser_visit(v_conf, 'store');
  perform set_config('request.jwt.claims', '', true);
  assert (select store_visited_at from conferences where id = v_conf) = v_store;

  -- a direct client write is ignored by the guard trigger
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  update conferences set comms_visited_at = now() where id = v_conf;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  select comms_visited_at into v_comms from conferences where id = v_conf;
  assert v_comms is null or v_comms < now() - interval '1 second', 'direct write was not ignored';

  raise notice 'checklist v2 test passed on conference %', v_conf;
end $$;
rollback;
*/
