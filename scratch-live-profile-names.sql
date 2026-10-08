-- ============================================================================
-- scratch-live-profile-names.sql   APPLIED 8 Oct 2026 (migration live_profile_names, with the catch-up)
--
-- Owner's report (8 Oct 2026): "if someone changes their name after registering
-- for a conference on their profile, the old name still stays the same".
--
-- Rule: when a row belongs to an ACCOUNT, profiles.display_name (live) wins.
-- A stored name (applications.invited_name, conference_chair_invites.invited_name,
-- conference_awards.recipient_name, ...) is only the fallback for people with no
-- account or a blank profile name.
--
-- Audit of every function that mentions invited_name / recipient_name /
-- display_chairs (8 Oct 2026). ALREADY profile-first, untouched:
--   _make_money_document, _queue_refund_email, admin_activity_feed,
--   allocation_co_delegates, close_money_todo, delegation_portal_overview,
--   financials_payments, financials_people, financials_person, money_things_to_do,
--   my_advisor_delegation, my_co_delegates, my_delegation_import,
--   my_delegation_roster, my_pay_overview, notify_co_delegate_on_allocation_sent,
--   queue_study_guide_release_emails, render_session_join_reminder,
--   cover_pledge_spot / settle_invoice_effects / _apply_pledge_cover_to_app
--     (they start from coalesce(invited_name, 'there') but then, when the
--      application has a user_id, overwrite it with
--      coalesce(profiles.display_name, v_name): profile-first already).
-- Only ever about people WITHOUT an account, untouched:
--   admin_pending_people (user_id is null + no profile with that email),
--   queue_claim_reminders, queue_invite_reminders (invited_user_id is null),
--   get_import_invite, my_pending_import_invites (unclaimed invites).
--
-- Changed here (each patched from pg_get_functiondef() with replace(), so the
-- rest of every body stays byte-identical; CREATE OR REPLACE keeps owner,
-- grants, SECURITY DEFINER and search_path; each patch raises if its pattern is
-- not found exactly as many times as expected, so a function edited since
-- 8 Oct 2026 stops the file instead of being half-patched):
--   1. conference_purchases       Store "Your Purchases": 'Imported <name>' and
--                                  'Import refunded: <name>' read invited_name first.
--   2. session_reserved_seat_hint the initial shown on a reserved seat read
--                                  invited_name before the profile.
--   3. create_chair_invite        re-inviting a chair who already has a pending
--                                  invite returned the invite's stored name.
-- New:
--   4. award_recipient_live_names(p_conference)  live names for award screens
--      (the client overlays them in src/lib/awardsService.ts; until this exists
--      the screens show the stored recipient_name exactly as before).
--   5. Trigger profiles_live_name_mirrors: when a profile's display_name or
--      avatar changes, refresh the two derived mirrors that copy it:
--        - conference_committees.display_chairs (built by sync_display_chairs
--          only when chair_user_ids / chair_titles change, so a chair who renames
--          keeps their old name on the public conference page, the committees,
--          assignment and live screens forever). Entries carry NO user id; they
--          are index-aligned with chair_user_ids, so only committees where the
--          two arrays have the same length are touched (5 committees are
--          misaligned today and are left alone, exactly like the screens that
--          rely on the alignment).
--        - conference_reviews.display_name (the reviewer's name copied at insert,
--          shown on the public conference page; anon cannot read profiles, so the
--          copy has to follow the profile).
--      These two are mirrors of the profile, not records, which is why they are
--      rewritten. Award recipient_name, chair-invite invited_name and
--      applications.invited_name are NOT rewritten: they record what was written
--      at the time, and the readers above prefer the live name instead.
-- ============================================================================

begin;

-- 1. conference_purchases ---------------------------------------------------
do $do$
declare
  d text := pg_get_functiondef('public.conference_purchases(uuid,integer)'::regprocedure);
  pat text := 'coalesce(a.invited_name, pr.display_name, ''a delegate'')';
  rep text := 'coalesce(nullif(btrim(pr.display_name), ''''), a.invited_name, ''a delegate'')';
begin
  if (length(d) - length(replace(d, pat, ''))) / length(pat) <> 2 then
    raise exception 'conference_purchases: expected 2 matches of the name coalesce';
  end if;
  execute replace(d, pat, rep);
end $do$;

-- 2. session_reserved_seat_hint ---------------------------------------------
do $do$
declare
  d text := pg_get_functiondef('public.session_reserved_seat_hint(text,text)'::regprocedure);
  pat text := 'coalesce(ap.invited_name, pa.display_name, pu.display_name, '''')';
  rep text := 'coalesce(nullif(btrim(pa.display_name), ''''), nullif(btrim(pu.display_name), ''''), ap.invited_name, '''')';
begin
  if (length(d) - length(replace(d, pat, ''))) / length(pat) <> 1 then
    raise exception 'session_reserved_seat_hint: expected 1 match';
  end if;
  execute replace(d, pat, rep);
end $do$;

-- 3. create_chair_invite (existing pending invite branch) --------------------
--    v_profile is the account found by this email; when the pending invite was
--    matched it is the same person (invited_user_id = v_user_id, or same email).
do $do$
declare
  d text := pg_get_functiondef('public.create_chair_invite(uuid,text,text,text)'::regprocedure);
  pat text := '''invited_name'', coalesce(v_invite.invited_name, v_resolved_name)';
  rep text := '''invited_name'', coalesce(nullif(btrim(v_profile.display_name), ''''), v_invite.invited_name, v_resolved_name)';
begin
  if (length(d) - length(replace(d, pat, ''))) / length(pat) <> 1 then
    raise exception 'create_chair_invite: expected 1 match';
  end if;
  execute replace(d, pat, rep);
end $do$;

-- 4. award_recipient_live_names ---------------------------------------------
--    {award id: current name} for individual awards held by an account.
--    A recipient_name with ' & ' was written for a whole seat (double
--    delegation, AwardsCard joins every holder): the seat's current holders,
--    profile first, by seat, but only while the award's own account still holds
--    that seat (a reallocated seat never renames a published award). Otherwise:
--    the award account's current display_name. Delegation (society) awards and
--    rows with no account are left out, so the screen keeps the stored name.
--    Visibility mirrors the conference_awards RLS: published rows for anyone,
--    every row for the conference's organisers and the committee's chairs.
create or replace function public.award_recipient_live_names(p_conference uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(jsonb_object_agg(aw.id::text, x.name), '{}'::jsonb)
  from conference_awards aw
  left join profiles up on up.id = aw.user_id
  left join lateral (
    select string_agg(s.nm, ' & ' order by s.seat nulls last) as name,
           bool_or(s.holder = aw.user_id) as has_recipient
    from (
      select al.seat,
             coalesce(al.user_id, ap.user_id) as holder,
             coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(ap.invited_name), '')) as nm
      from conference_allocations al
      left join applications ap on ap.id = al.application_id
      left join profiles p on p.id = coalesce(al.user_id, ap.user_id)
      where al.conference_committee_id = aw.conference_committee_id
        and (lower(al.country_code) = lower(aw.country_code)
             or lower(al.country_name) = lower(aw.country_name))
    ) s
    where s.nm is not null
  ) seat on true
  cross join lateral (
    select case
      when position(' & ' in coalesce(aw.recipient_name, '')) > 0
        then case when seat.has_recipient then seat.name end
      else nullif(btrim(up.display_name), '')
    end as name
  ) x
  where aw.conference_id = p_conference
    and aw.society_id is null
    and aw.user_id is not null
    and x.name is not null
    and (aw.status = 'published'
         or public.is_conference_organizer(aw.conference_id)
         or exists (select 1 from conference_committees cc
                     where cc.id = aw.conference_committee_id
                       and auth.uid() = any(cc.chair_user_ids)));
$fn$;

revoke all on function public.award_recipient_live_names(uuid) from public;
grant execute on function public.award_recipient_live_names(uuid) to anon, authenticated;

-- 5. Profile rename -> refresh the two mirrors --------------------------------
create or replace function public.profiles_live_name_mirrors()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  begin
    -- display_chairs: same entry shape sync_display_chairs builds
    -- ({name, avatar_url, title}); only the renamed account's entries change,
    -- every other key (title) is kept.
    update conference_committees cc
       set display_chairs = (
         select jsonb_agg(
                  case when cc.chair_user_ids[e.i::int] = new.id
                       then e.v || jsonb_build_object('name', new.display_name, 'avatar_url', new.avatar_url)
                       else e.v end
                  order by e.i)
           from jsonb_array_elements(cc.display_chairs) with ordinality e(v, i))
     where new.id = any(cc.chair_user_ids)
       and jsonb_typeof(cc.display_chairs) = 'array'
       and jsonb_array_length(cc.display_chairs) = cardinality(cc.chair_user_ids);

    if new.display_name is distinct from old.display_name then
      update conference_reviews
         set display_name = new.display_name
       where user_id = new.id
         and display_name is distinct from new.display_name;
    end if;
  exception when others then
    -- A mirror must never stop someone saving their profile.
    raise warning 'profiles_live_name_mirrors: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $fn$;

revoke all on function public.profiles_live_name_mirrors() from public, anon, authenticated;

drop trigger if exists profiles_live_name_mirrors on public.profiles;
create trigger profiles_live_name_mirrors
  after update of display_name, avatar_url on public.profiles
  for each row
  when (old.display_name is distinct from new.display_name
        or old.avatar_url is distinct from new.avatar_url)
  execute function public.profiles_live_name_mirrors();

commit;

-- ----------------------------------------------------------------------------
-- OPTIONAL one-time catch-up of the two mirrors (renames that happened before
-- the trigger). Read-only check on 8 Oct 2026: 15 committees would change,
-- 3 of them a chair's name, the rest an avatar added later. Same rules as the
-- trigger. Not part of the main block; run only if wanted.
-- ----------------------------------------------------------------------------
-- update conference_committees cc
--    set display_chairs = (
--      select jsonb_agg(
--               case when p.id is not null
--                    then e.v || jsonb_build_object('name', p.display_name, 'avatar_url', p.avatar_url)
--                    else e.v end
--               order by e.i)
--        from jsonb_array_elements(cc.display_chairs) with ordinality e(v, i)
--        left join profiles p on p.id = cc.chair_user_ids[e.i::int])
--  where jsonb_typeof(cc.display_chairs) = 'array'
--    and jsonb_array_length(cc.display_chairs) > 0
--    and jsonb_array_length(cc.display_chairs) = cardinality(cc.chair_user_ids)
--    and exists (select 1 from jsonb_array_elements(cc.display_chairs) with ordinality e(v, i)
--                  join profiles p on p.id = cc.chair_user_ids[e.i::int]
--                 where e.v->>'name' is distinct from p.display_name
--                    or e.v->>'avatar_url' is distinct from p.avatar_url);
-- update conference_reviews r set display_name = p.display_name
--   from profiles p where p.id = r.user_id and r.display_name is distinct from p.display_name;

-- ----------------------------------------------------------------------------
-- TEST (after applying). Everything rolls back. Run as the SQL editor (postgres).
-- ----------------------------------------------------------------------------
-- begin;
--   -- a) display_chairs follows a chair's rename
--   with c as (
--     select cc.id, cc.chair_user_ids[1] as uid from conference_committees cc
--      where cardinality(cc.chair_user_ids) > 0
--        and jsonb_array_length(cc.display_chairs) = cardinality(cc.chair_user_ids)
--      limit 1)
--   update profiles p set display_name = 'Renamed For Test' from c where p.id = c.uid;
--   select cc.id, cc.display_chairs from conference_committees cc
--    where cc.display_chairs @> '[{"name":"Renamed For Test"}]';          -- expect >= 1 row
--
--   -- b) conference_purchases / seat hint / chair invite now read the profile
--   select pg_get_functiondef('public.conference_purchases(uuid,integer)'::regprocedure)
--          like '%nullif(btrim(pr.display_name), ''''), a.invited_name%';  -- expect true
--   select pg_get_functiondef('public.session_reserved_seat_hint(text,text)'::regprocedure)
--          like '%nullif(btrim(pa.display_name), ''''), nullif(btrim(pu.display_name)%'; -- true
--   select pg_get_functiondef('public.create_chair_invite(uuid,text,text,text)'::regprocedure)
--          like '%nullif(btrim(v_profile.display_name), ''''), v_invite.invited_name%'; -- true
--
--   -- c) award live names: rename a nominee, read as an organiser of that conference
--   with aw as (select id, user_id, conference_id from conference_awards
--                where user_id is not null and society_id is null limit 1)
--   update profiles p set display_name = 'Award Rename Test' from aw where p.id = aw.user_id;
--   select set_config('request.jwt.claims', json_build_object('sub',
--          (select co.user_id from conference_organizers co
--             join conference_awards aw on aw.conference_id = co.conference_id
--            where aw.user_id is not null limit 1))::text, true);
--   set local role authenticated;
--   select public.award_recipient_live_names(
--            (select conference_id from conference_awards where user_id is not null limit 1));
--   -- expect the renamed award's id -> 'Award Rename Test'
--   reset role;
--   -- d) as anon, unpublished awards are not answered
--   set local role anon;
--   select public.award_recipient_live_names(
--            (select conference_id from conference_awards where user_id is not null limit 1));
--   -- expect {} while nothing is published
--   reset role;
-- rollback;
