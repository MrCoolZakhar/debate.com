-- ============================================================================================
-- scratch-seat-kick-and-allowance.sql
-- STATUS: NOT APPLIED. Drafted 23 Oct 2026 (owner approved the behaviour: "kicking allow one
-- person to be kicked", "allowance should be counted per country"). The lead applies it.
--
-- The client works before AND after this file is applied:
--   * Section A: PeopleTab reads `claim_id` / `name` / `ordinal` on each seat claim when
--     present; without them it keeps the one Kick per seat (kick_delegate_seat). The
--     per-claim Kick calls kick_delegate_seat_claim; PGRST202 falls back to the seat kick.
--   * Section B: the delegate phone reads delegate_allowance / record_delegate_allowance;
--     PGRST202 (not applied) keeps today's per-phone localStorage limits.
--
-- Nothing here sends email, writes money, or touches a conference table.
-- Every function is SECURITY DEFINER with a pinned search_path, like the seat RPCs it sits
-- beside. Not a security boundary (AGENTS.md rule 15): the session code and the chair suffix
-- are anon-readable, these stop honest collisions and make the limits shared, nothing more.
-- ============================================================================================

begin;

-- ============================================================================================
-- SECTION A1. session_participants: one opaque id and a label per live seat claim.
-- Adds to each element of `seats`:
--   claim_id  the claim row's own uuid (delegate_seat_claims.id, gen_random_uuid(), RLS on and
--             no policies, so it is readable nowhere else and says nothing about the holder).
--             Never the holder key, a user id or a device hash.
--   name      the person's display name ONLY when the claim is the seat's allocated conference
--             account (the same people session_delegation_names already names to chairs);
--             null otherwise (a guest device, or a signed-in stranger on an open seat).
--   ordinal   1, 2, ... per seat in claim order, so the chair can tell "Device 1" from "Device 2".
-- Everything else is byte for byte the live body (read 23 Oct 2026).
-- ============================================================================================
create or replace function public.session_participants(p_code text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_c record; v_cc uuid; v_conf_ids uuid[] := '{}';
  v_seats jsonb; v_devices jsonb; v_conf jsonb; v_kicks jsonb;
begin
  select id, session_origin, chair_names, settings into v_c
    from committees where code = upper(trim(coalesce(p_code, '')));
  if v_c.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not public.is_session_chair(v_c.id) then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;

  if v_c.session_origin = 'conference' then
    v_cc := seat_claim_conference_committee(v_c.id);
    if v_cc is not null then
      select coalesce(cc.chair_user_ids, '{}'::uuid[]) into v_conf_ids
        from conference_committees cc where cc.id = v_cc;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'claim_id', x.id,
           'country', x.country,
           'kind', case when x.holder_key like 'u:%' then 'account' else 'device' end,
           'claimed_at', x.claimed_at,
           'last_seen_at', x.last_seen_at,
           'active', x.last_seen_at > now() - interval '2 minutes',
           'reserved', x.reserved,
           'name', case when x.reserved then (
                     select nullif(btrim(p.display_name), '') from profiles p
                      where 'u:' || p.id::text = x.holder_key) end,
           'ordinal', x.ordinal
         ) order by lower(x.country), x.claimed_at), '[]'::jsonb)
    into v_seats
    from (
      select s.id, s.country, s.holder_key, s.claimed_at, s.last_seen_at,
             seat_claim_holder_is_allocated(v_cc, s.country, s.holder_key) as reserved,
             row_number() over (partition by lower(s.country) order by s.claimed_at, s.id) as ordinal
        from delegate_seat_claims s
       where s.committee_id = v_c.id and s.last_seen_at >= now() - interval '65 minutes'
    ) x;

  -- `key` is salted with the committee id: opaque, and never the same for one account in
  -- two committees.
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', left(encode(sha256(convert_to(v_c.id::text || ':' || k.user_id::text, 'UTF8')), 'hex'), 16),
           'name', case when k.user_id = any(v_conf_ids) then nullif(btrim(p.display_name), '') end,
           'conference_chair', k.user_id = any(v_conf_ids),
           'last_seen_at', k.last_seen_at,
           'active', k.last_seen_at > now() - interval '90 seconds'
         ) order by k.last_seen_at desc), '[]'::jsonb)
    into v_devices
    from chair_device_claims k
    left join profiles p on p.id = k.user_id
   where k.committee_id = v_c.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'key', left(encode(sha256(convert_to(v_c.id::text || ':' || u.uid::text, 'UTF8')), 'hex'), 16),
           'name', nullif(btrim(p.display_name), ''),
           'joined', exists (select 1 from chair_device_claims k where k.committee_id = v_c.id and k.user_id = u.uid)
         ) order by p.display_name nulls last), '[]'::jsonb)
    into v_conf
    from unnest(v_conf_ids) as u(uid)
    left join profiles p on p.id = u.uid;

  select coalesce(jsonb_agg(jsonb_build_object('country', x.country, 'kicked_at', x.kicked_at)
           order by x.kicked_at desc), '[]'::jsonb)
    into v_kicks
    from (select k.country, max(k.kicked_at) kicked_at from delegate_seat_kicks k
           where k.committee_id = v_c.id and k.kicked_at > now() - interval '10 minutes'
           group by k.country) x;

  return jsonb_build_object(
    'ok', true,
    'is_conference', v_c.session_origin = 'conference',
    'chair_names', to_jsonb(coalesce(v_c.chair_names, '{}'::text[])),
    'head_chair', coalesce(nullif(v_c.settings->>'headChair', ''), (v_c.chair_names)[1]),
    'seats', v_seats,
    'chair_devices', v_devices,
    'conference_chairs', v_conf,
    'recent_kicks', v_kicks,
    'server_now', now()
  );
end $function$;

-- Check A1 (read only; as a chair the RPC needs the x-chair-suffix header, so check the shape
-- of the data it reads instead): every live claim has an id and an ordinal per seat.
--   select committee_id, lower(country) seat, count(*) claims,
--          array_agg(id order by claimed_at) claim_ids
--     from delegate_seat_claims
--    where last_seen_at >= now() - interval '65 minutes'
--    group by 1, 2 having count(*) > 1;
--   select pg_get_functiondef('public.session_participants(text)'::regprocedure) like '%claim_id%';

-- ============================================================================================
-- SECTION A2. kick_delegate_seat_claim(p_code, p_claim_id): remove ONE person from a seat.
-- Chair-gated exactly like kick_delegate_seat (is_session_chair: the x-chair-suffix header).
-- Takes the same seat lock, so it orders with claim_delegate_seat (holder -> device -> seat;
-- this takes only the seat lock, so it cannot deadlock). Writes the same 10-minute tombstone
-- for THAT holder and device only, so claim_delegate_seat answers `kicked` to the removed
-- phone alone; the other phone on a double delegation re-verifies as `mine` and stays.
-- The reserved-seat exception holds: a seat's allocated account is never removed.
-- Answers: {ok:true, released:1, country} | {ok:false, reason:'not_found'|'denied'|'gone'|'reserved'}
--   gone = no such live claim in this committee (already left, expired or kicked).
-- ============================================================================================
create or replace function public.kick_delegate_seat_claim(p_code text, p_claim_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid; v_origin text; v_cc uuid; v_seat text; v_row record;
begin
  select id, session_origin into v_id, v_origin from committees where code = upper(trim(coalesce(p_code, '')));
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not public.is_session_chair(v_id) then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  if p_claim_id is null then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;

  select lower(s.country) into v_seat from delegate_seat_claims s
   where s.id = p_claim_id and s.committee_id = v_id;
  if v_seat is null then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  if v_origin = 'conference' then
    v_cc := seat_claim_conference_committee(v_id);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('delegate_seat:' || v_id::text || ':' || v_seat, 0));

  -- Re-read under the lock: the claim may have moved or gone while we waited.
  select s.id, s.country, s.holder_key, s.device_hash into v_row from delegate_seat_claims s
   where s.id = p_claim_id and s.committee_id = v_id and lower(s.country) = v_seat;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  if seat_claim_holder_is_allocated(v_cc, v_row.country, v_row.holder_key) then
    return jsonb_build_object('ok', false, 'reason', 'reserved', 'released', 0);
  end if;

  delete from delegate_seat_kicks k where k.committee_id = v_id and k.kicked_at < now() - interval '1 day';
  delete from delegate_seat_claims s where s.id = v_row.id;
  insert into delegate_seat_kicks (committee_id, country, holder_key, device_hash)
  values (v_id, v_row.country, v_row.holder_key, v_row.device_hash);

  return jsonb_build_object('ok', true, 'released', 1, 'country', v_row.country);
end $function$;

revoke all on function public.kick_delegate_seat_claim(text, uuid) from public;
grant execute on function public.kick_delegate_seat_claim(text, uuid) to anon, authenticated;

-- Check A2 (read only):
--   select p.proname, p.prosecdef, has_function_privilege('anon', p.oid, 'execute') anon_x
--     from pg_proc p where p.proname = 'kick_delegate_seat_claim';

-- ============================================================================================
-- SECTION B1. delegate_allowance_events: the shared per-delegation allowance ledger.
-- One row per counted event for a delegation (committee + the seat's lower-cased name):
--   status       a self status change from a delegate phone (3 per rolling 3 hours)
--   gsl_request  a request to speak (re-sendable after 60 s with no answer)
--   gsl_denied   a pending request to speak that was removed while the delegation was NOT
--                on the GSL or the floor (the phone's own reading of a denial; written by
--                the motions trigger in B4) -> 15-minute lockout
--   gsl_clear    the delegation reached the GSL or the floor: earlier request / denial
--                stamps stop counting (written by B4 on an approval, and by a phone that
--                sees itself queued after a chair added it directly)
-- No personal data: no holder, device, account or name. RLS on with no policies: read and
-- written only through the functions below. No foreign key on purpose: the motions trigger
-- may fire inside a committee's cascade delete, and a child insert there must never be able
-- to fail that delete. Old rows (over a day) are swept by record_delegate_allowance.
-- ============================================================================================
create table if not exists public.delegate_allowance_events (
  id bigint generated always as identity primary key,
  committee_id uuid not null,
  country_key text not null,
  kind text not null check (kind in ('status', 'gsl_request', 'gsl_denied', 'gsl_clear')),
  at timestamptz not null default now()
);
create index if not exists delegate_allowance_events_lookup
  on public.delegate_allowance_events (committee_id, country_key, kind, at desc);
create index if not exists delegate_allowance_events_at
  on public.delegate_allowance_events (at);
alter table public.delegate_allowance_events enable row level security;
revoke all on table public.delegate_allowance_events from anon, authenticated;

-- Check B1 (read only):
--   select relname, relrowsecurity from pg_class where relname = 'delegate_allowance_events';
--   select count(*) from public.delegate_allowance_events;

-- ============================================================================================
-- SECTION B2. _delegate_allowance_state(committee, country_key): the one read of the
-- ledger, shared by B3's two RPCs so the read and the write answers can never disagree.
-- Not executable by clients.
--   status_left     3 minus self status changes in the last 3 hours (never below 0)
--   status_next_ms  ms until the oldest counted change leaves the window (0 when none)
--   gsl_retry_left_ms   60 s since the latest request to speak (the later of a recorded
--                       request and this delegation's pending gsl-request row), 0 when past
--   gsl_denied_left_ms  15 min since the latest denial, 0 when past
-- Request and denial stamps older than the latest gsl_clear never count.
-- ============================================================================================
create or replace function public._delegate_allowance_state(p_committee uuid, p_key text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_used int; v_oldest timestamptz; v_clear timestamptz; v_req timestamptz; v_den timestamptz;
  v_pending timestamptz;
begin
  select count(*), min(e.at) into v_used, v_oldest from delegate_allowance_events e
   where e.committee_id = p_committee and e.country_key = p_key and e.kind = 'status'
     and e.at > now() - interval '3 hours';

  select max(e.at) into v_clear from delegate_allowance_events e
   where e.committee_id = p_committee and e.country_key = p_key and e.kind = 'gsl_clear';
  select max(e.at) into v_req from delegate_allowance_events e
   where e.committee_id = p_committee and e.country_key = p_key and e.kind = 'gsl_request';
  select max(e.at) into v_den from delegate_allowance_events e
   where e.committee_id = p_committee and e.country_key = p_key and e.kind = 'gsl_denied';
  -- A request sent by an older phone bundle is still a request: its pending row counts.
  select max(m.created_at) into v_pending from motions m
   where m.committee_id = p_committee and m.type = 'gsl-request' and m.status = 'pending'
     and lower(trim(m.proposed_by)) = p_key;

  v_req := greatest(v_req, v_pending);
  if v_clear is not null then
    if v_req is not null and v_req <= v_clear then v_req := null; end if;
    if v_den is not null and v_den <= v_clear then v_den := null; end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status_limit', 3,
    'status_left', greatest(0, 3 - v_used),
    'status_next_ms', case when v_oldest is null then 0
      else greatest(0, floor(extract(epoch from (v_oldest + interval '3 hours' - now())) * 1000))::bigint end,
    'gsl_retry_left_ms', case when v_req is null then 0
      else greatest(0, floor(extract(epoch from (v_req + interval '60 seconds' - now())) * 1000))::bigint end,
    'gsl_denied_left_ms', case when v_den is null then 0
      else greatest(0, floor(extract(epoch from (v_den + interval '15 minutes' - now())) * 1000))::bigint end
  );
end $function$;

revoke all on function public._delegate_allowance_state(uuid, text) from public, anon, authenticated;

-- ============================================================================================
-- SECTION B3. The two anon-callable RPCs (with the session code, like claim_delegate_seat).
--   delegate_allowance(p_code, p_country)            read only
--   record_delegate_allowance(p_code, p_country, p_kind)
--     p_kind 'status'        counts one self status change; refused with
--                            {ok:false, reason:'limit', ...state} when 3 were used in 3 hours
--     p_kind 'status_refund' gives back the newest status change of the last 2 minutes
--                            (the phone's write was refused); a no-op otherwise
--     p_kind 'gsl_request'   stamps a request to speak; a no-op inside 60 s of the last one
--     p_kind 'gsl_clear'     the delegation is on the GSL or the floor; a no-op unless a
--                            request or denial newer than the last clear exists
--   Both answer the state from B2 ({ok, status_left, status_next_ms, gsl_retry_left_ms,
--   gsl_denied_left_ms, status_limit}) or {ok:false, reason:'not_found'|'no_seat'|'bad_kind'}.
-- Rate limited by construction: every call writes at most one row, 'status' at most 3 per
-- 3 hours, 'gsl_request' at most one a minute, 'gsl_clear' at most one per request or denial.
-- One advisory lock per delegation serialises two phones pressing at once, so the third
-- change of two simultaneous presses is counted once and the fourth refused.
-- ============================================================================================
create or replace function public.delegate_allowance(p_code text, p_country text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid; v_seat text;
begin
  select id into v_id from committees where code = upper(trim(coalesce(p_code, '')));
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select d.country into v_seat from delegates d
   where d.committee_id = v_id and lower(d.country) = lower(trim(coalesce(p_country, '')))
   order by d.country limit 1;
  if v_seat is null then
    return jsonb_build_object('ok', false, 'reason', 'no_seat');
  end if;
  return public._delegate_allowance_state(v_id, lower(trim(v_seat)));
end $function$;

create or replace function public.record_delegate_allowance(p_code text, p_country text, p_kind text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid; v_seat text; v_key text; v_state jsonb; v_last timestamptz; v_clear timestamptz;
  v_newest bigint;
begin
  if p_kind is null or p_kind not in ('status', 'status_refund', 'gsl_request', 'gsl_clear') then
    return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;
  select id into v_id from committees where code = upper(trim(coalesce(p_code, '')));
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select d.country into v_seat from delegates d
   where d.committee_id = v_id and lower(d.country) = lower(trim(coalesce(p_country, '')))
   order by d.country limit 1;
  if v_seat is null then
    return jsonb_build_object('ok', false, 'reason', 'no_seat');
  end if;
  v_key := lower(trim(v_seat));

  perform pg_advisory_xact_lock(hashtextextended('delegate_allowance:' || v_id::text || ':' || v_key, 0));

  -- Housekeeping: nothing older than a day is ever read (the longest window is 3 hours).
  delete from delegate_allowance_events e
   where e.id in (select e2.id from delegate_allowance_events e2
                   where e2.at < now() - interval '1 day' order by e2.at limit 500);

  if p_kind = 'status' then
    v_state := public._delegate_allowance_state(v_id, v_key);
    if (v_state->>'status_left')::int <= 0 then
      return v_state || jsonb_build_object('ok', false, 'reason', 'limit');
    end if;
    insert into delegate_allowance_events (committee_id, country_key, kind) values (v_id, v_key, 'status');

  elsif p_kind = 'status_refund' then
    select e.id into v_newest from delegate_allowance_events e
     where e.committee_id = v_id and e.country_key = v_key and e.kind = 'status'
       and e.at > now() - interval '2 minutes'
     order by e.at desc limit 1;
    if v_newest is not null then
      delete from delegate_allowance_events where id = v_newest;
    end if;

  elsif p_kind = 'gsl_request' then
    select max(e.at) into v_last from delegate_allowance_events e
     where e.committee_id = v_id and e.country_key = v_key and e.kind = 'gsl_request';
    select max(e.at) into v_clear from delegate_allowance_events e
     where e.committee_id = v_id and e.country_key = v_key and e.kind = 'gsl_clear';
    if v_last is null or v_last < now() - interval '60 seconds' or (v_clear is not null and v_last <= v_clear) then
      insert into delegate_allowance_events (committee_id, country_key, kind) values (v_id, v_key, 'gsl_request');
    end if;

  elsif p_kind = 'gsl_clear' then
    select max(e.at) into v_clear from delegate_allowance_events e
     where e.committee_id = v_id and e.country_key = v_key and e.kind = 'gsl_clear';
    if exists (select 1 from delegate_allowance_events e
                where e.committee_id = v_id and e.country_key = v_key
                  and e.kind in ('gsl_request', 'gsl_denied')
                  and (v_clear is null or e.at > v_clear)) then
      insert into delegate_allowance_events (committee_id, country_key, kind) values (v_id, v_key, 'gsl_clear');
    end if;
  end if;

  return public._delegate_allowance_state(v_id, v_key);
end $function$;

revoke all on function public.delegate_allowance(text, text) from public;
revoke all on function public.record_delegate_allowance(text, text, text) from public;
grant execute on function public.delegate_allowance(text, text) to anon, authenticated;
grant execute on function public.record_delegate_allowance(text, text, text) to anon, authenticated;

-- Check B3 (read only):
--   select p.proname, pg_get_function_identity_arguments(p.oid),
--          has_function_privilege('anon', p.oid, 'execute') anon_x
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('delegate_allowance', 'record_delegate_allowance', '_delegate_allowance_state');
--   -- delegate_allowance is STABLE and writes nothing, so this read is safe on a live code:
--   select public.delegate_allowance(c.code, d.country)
--     from committees c join delegates d on d.committee_id = c.id
--    where c.ended_at is null limit 3;

-- ============================================================================================
-- SECTION B4. The denial is recorded where it happens: a pending gsl-request row deleted.
-- The chair's Approve adds the delegation to the GSL and THEN deletes the request (awaited,
-- in that order: approveGslRequest), so at the delete an approved delegation is already on
-- the list (-> gsl_clear) and a refused one is not (-> gsl_denied). This is exactly the
-- phone's own rule ("request gone and not on the list"), now kept once for every phone of
-- the delegation instead of in each phone's localStorage.
-- AFTER DELETE, per row, only for pending gsl-request rows (WHEN clause: every other motion
-- delete costs nothing). Swallows its own errors: bookkeeping never fails a chair's write.
-- Skips a delete that is part of the committee's own deletion (no committee row any more).
-- ============================================================================================
create or replace function public.delegate_allowance_on_gsl_request_delete()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_key text; v_on boolean;
begin
  begin
    if not exists (select 1 from committees c where c.id = old.committee_id) then
      return null;
    end if;
    v_key := lower(trim(coalesce(old.proposed_by, '')));
    if v_key = '' then return null; end if;
    v_on := exists (select 1 from speakers_list s
                     where s.committee_id = old.committee_id and s.list_type = 'gsl'
                       and lower(trim(s.country)) = v_key)
         or exists (select 1 from current_speaker cs
                     where cs.committee_id = old.committee_id and lower(trim(cs.country)) = v_key);
    insert into delegate_allowance_events (committee_id, country_key, kind)
    values (old.committee_id, v_key, case when v_on then 'gsl_clear' else 'gsl_denied' end);
  exception when others then
    null;
  end;
  return null;
end $function$;

revoke all on function public.delegate_allowance_on_gsl_request_delete() from public, anon, authenticated;

drop trigger if exists motions_gsl_request_allowance on public.motions;
create trigger motions_gsl_request_allowance
  after delete on public.motions
  for each row
  when (old.type = 'gsl-request' and old.status = 'pending')
  execute function public.delegate_allowance_on_gsl_request_delete();

-- Check B4 (read only):
--   select tgname, pg_get_triggerdef(t.oid) from pg_trigger t
--    where t.tgrelid = 'public.motions'::regclass and tgname = 'motions_gsl_request_allowance';
--   -- after a chair approves or refuses a request in a test room:
--   select kind, country_key, at from public.delegate_allowance_events order by at desc limit 10;

commit;
