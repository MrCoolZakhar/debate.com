-- scratch-session-block-seats.sql
-- DRAFT for the owners' Supabase chat. Not applied. Read from the live project on 19 Oct 2026.
--
-- 1. Block seats must not lock a country in the live room.
--    A delegation block seat (docs/conferences/delegations.md) is a conference_allocations
--    row with society_id set and NO person: user_id null AND application_id null. Today
--    seat_claim_is_reserved() treats ANY allocation row for the country as reserved, so
--    session_join_rules lists the country in reserved_countries and claim_delegate_seat
--    answers 'signin' / 'reserved' to everyone (nobody's user_id matches a row that has
--    none). The country could never be taken in the room.
--
--    Rule (the smallest correct one): an allocation row reserves its country only when
--    it names a person, i.e. user_id is not null OR application_id is not null.
--      * registered delegate (user_id set)                     -> reserved, as today
--      * imported application, no account yet (app id set,
--        user_id null)                                         -> reserved, as today
--      * block seat / orphaned row (neither set)               -> NOT reserved (open seat)
--    A country with a person on seat 1 and a block on seat 2 stays reserved (the person
--    row); only its allocated account can sit there, as today.
--
--    seat_claim_is_reserved is the ONE definition: session_join_rules, claim_delegate_seat
--    and session_reserved_seat_hint all call it, so changing the helper changes all three.
--    delegate_seat_availability does not read reservation. kick_delegate_seat's
--    seat_claim_holder_is_allocated already requires user_id, unchanged.
--    session_reserved_seat_hint also lists the hint rows: it now lists only rows with a
--    person, so a block row never shows as an empty "seat 2" hint.
--
-- 2. perform_delegation_swap fails with a unique violation when both people have accounts.
--    It moves user_id/application_id onto alloc_a while alloc_b still holds them, which
--    hits conference_allocations_one_seat_per_delegate (conference_id, user_id) always,
--    and, inside one committee, conference_allocations_conference_committee_id_user_id_key
--    and conference_allocations_committee_application_key (the last one even for imported
--    people without accounts). None of these is deferrable. Fix: clear the holders of both
--    rows first, then fill each, in the same function call (one transaction). Permission
--    checks, return shape, SECURITY DEFINER and search_path are unchanged.
--
-- CREATE OR REPLACE keeps each function's owner and ACL, and the signatures, volatility,
-- SECURITY setting and SET search_path below are copied from the live definitions.

begin;

-- ---------------------------------------------------------------------------------------
-- 1a. The helper (SECURITY INVOKER, STABLE; EXECUTE: postgres, service_role)
-- ---------------------------------------------------------------------------------------
create or replace function public.seat_claim_is_reserved(p_cc uuid, p_country text)
 returns boolean
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  -- A country is reserved only by an allocation that names a person: an account
  -- (user_id) or an application, including an imported one with no account yet. A
  -- delegation block seat (society_id, no person) reserves nothing until a person is
  -- put on it, so anyone with the session code may take that country.
  select p_cc is not null and exists (
    select 1 from conference_allocations a
    where a.conference_committee_id = p_cc
      and (a.user_id is not null or a.application_id is not null)
      and (lower(a.country_name) = lower(p_country) or lower(a.country_code) = lower(p_country))
  );
$function$;

-- ---------------------------------------------------------------------------------------
-- 1b. The sign-in hint (SECURITY DEFINER, STABLE; EXECUTE: anon, authenticated, service_role)
--     Only change: the hint rows are the rows that name a person (same rule as above).
-- ---------------------------------------------------------------------------------------
create or replace function public.session_reserved_seat_hint(p_code text, p_country text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_c record; v_cc uuid; v_hints jsonb;
begin
  if coalesce(trim(p_country), '') = '' or length(p_country) > 120 then
    return jsonb_build_object('ok', false, 'reason', 'bad_country');
  end if;
  select id, session_origin into v_c from committees where code = upper(trim(coalesce(p_code, '')));
  if v_c.id is null or v_c.session_origin is distinct from 'conference' then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  v_cc := seat_claim_conference_committee(v_c.id);
  if v_cc is null or not seat_claim_is_reserved(v_cc, trim(p_country)) then
    return jsonb_build_object('ok', false, 'reason', 'not_reserved');
  end if;

  select coalesce(jsonb_agg(h order by (h->>'seat')::int nulls last), '[]'::jsonb) into v_hints
  from (
    select jsonb_build_object(
      'seat', a.seat,
      'email', mask_email_hint(coalesce(ap.invited_email, pa.email, pu.email)),
      'initial', nullif(upper(left(trim(coalesce(nullif(btrim(pa.display_name), ''), nullif(btrim(pu.display_name), ''), ap.invited_name, '')), 1)), ''),
      'has_account', (a.user_id is not null or ap.user_id is not null)
    ) as h
    from conference_allocations a
    left join applications ap on ap.id = a.application_id
    left join profiles pa on pa.id = ap.user_id
    left join profiles pu on pu.id = a.user_id
    where a.conference_committee_id = v_cc
      -- block seats (no person) are not a hint: same rule as seat_claim_is_reserved
      and (a.user_id is not null or a.application_id is not null)
      and (lower(a.country_name) = lower(trim(p_country)) or lower(a.country_code) = lower(trim(p_country)))
    limit 4
  ) s;

  return jsonb_build_object('ok', true, 'hints', v_hints);
end $function$;

-- ---------------------------------------------------------------------------------------
-- 2. The swap (SECURITY DEFINER, VOLATILE; EXECUTE: PUBLIC, anon, authenticated, service_role)
--    Only change: clear both allocation rows' holders before filling them.
-- ---------------------------------------------------------------------------------------
create or replace function public.perform_delegation_swap(p_app_a uuid, p_app_b uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a record; b record; v_mode text; alloc_a uuid; alloc_b uuid;
  a_name text; b_name text; a_new_committee text; b_new_committee text;
begin
  select * into a from applications where id = p_app_a;
  select * into b from applications where id = p_app_b;
  if a.id is null or b.id is null then return jsonb_build_object('ok', false, 'error', 'Application not found'); end if;
  if a.society_id is null or a.society_id is distinct from b.society_id then
    return jsonb_build_object('ok', false, 'error', 'Both members must belong to the same delegation'); end if;
  if a.assigned_committee_id is null or b.assigned_committee_id is null then
    return jsonb_build_object('ok', false, 'error', 'Both members must hold an allocation'); end if;

  select allocation_swap_mode into v_mode from conferences where id = a.conference_id;
  if not (
    is_conference_organizer(a.conference_id)
    or (v_mode = 'self_serve' and is_society_leader(a.society_id))
  ) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted to swap allocations'); end if;

  -- This function IS the authorization for the writes below; let them through
  -- the applications tampering guard (transaction-local, resets on commit).
  perform set_config('app.trusted_write', 'on', true);

  -- capture the allocation rows by id BEFORE touching anything
  select id into alloc_a from conference_allocations where application_id = a.id limit 1;
  select id into alloc_b from conference_allocations where application_id = b.id limit 1;

  -- swap the applications' assigned fields
  update applications set assigned_committee_id = b.assigned_committee_id,
    assigned_country_code = b.assigned_country_code, assigned_country_name = b.assigned_country_name
    where id = a.id;
  update applications set assigned_committee_id = a.assigned_committee_id,
    assigned_country_code = a.assigned_country_code, assigned_country_name = a.assigned_country_name
    where id = b.id;

  -- Clear BOTH holders first. The unique indexes on (conference_id, user_id),
  -- (conference_committee_id, user_id) and (conference_committee_id, application_id) are
  -- checked row by row and are not deferrable, so writing b's person onto alloc_a while
  -- alloc_b still holds b raised a duplicate-key error. Same transaction: nobody ever
  -- sees the cleared rows.
  update conference_allocations set user_id = null, application_id = null
   where id in (alloc_a, alloc_b);

  -- then fill each row by primary key (no ambiguity)
  if alloc_a is not null then
    update conference_allocations set user_id = b.user_id, application_id = b.id where id = alloc_a;
  end if;
  if alloc_b is not null then
    update conference_allocations set user_id = a.user_id, application_id = a.id where id = alloc_b;
  end if;

  select display_name into a_name from profiles where id = a.user_id;
  select display_name into b_name from profiles where id = b.user_id;
  select coalesce(abbreviation, name) into a_new_committee from conference_committees where id = b.assigned_committee_id;
  select coalesce(abbreviation, name) into b_new_committee from conference_committees where id = a.assigned_committee_id;

  return jsonb_build_object(
    'ok', true,
    'a', jsonb_build_object('application_id', a.id, 'name', a_name, 'new_committee', a_new_committee, 'new_country', b.assigned_country_name),
    'b', jsonb_build_object('application_id', b.id, 'name', b_name, 'new_committee', b_new_committee, 'new_country', a.assigned_country_name)
  );
end $function$;

commit;

-- =======================================================================================
-- VERIFICATION (run AFTER the above, separately; everything is rolled back).
-- Fill the placeholders. <CODE> = a conference session code whose committee has a block
-- seat for <BLOCK_COUNTRY> and a personal allocation for <PERSON_COUNTRY>.
-- =======================================================================================
begin;
  set local role anon;
  set local request.jwt.claims = '{"role":"anon"}';

  -- Expect <PERSON_COUNTRY> in reserved_countries and <BLOCK_COUNTRY> NOT in it.
  select public.session_join_rules('<CODE>');

  -- Expect {"ok": false, "reason": "not_reserved"} for the block country.
  select public.session_reserved_seat_hint('<CODE>', '<BLOCK_COUNTRY>');

  -- claim_delegate_seat writes delegate_seat_claims; harmless here because of the rollback.
  -- Expect ok true (claimed) for the block country, and 'signin' for the person country.
  select public.claim_delegate_seat('<CODE>', '<BLOCK_COUNTRY>', 'verification-token-0123456789', true);
  select public.claim_delegate_seat('<CODE>', '<PERSON_COUNTRY>', 'verification-token-0123456789', true);
rollback;

-- Swap check: two members of one delegation who both have accounts.
-- <ORGANISER_UID> = an organiser of that conference; <APP_A>, <APP_B> = their applications.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<ORGANISER_UID>","role":"authenticated"}';
  -- Expect {"ok": true, ...} (today: duplicate key value violates unique constraint).
  select public.perform_delegation_swap('<APP_A>'::uuid, '<APP_B>'::uuid);
  select id, application_id, user_id, country_name from public.conference_allocations
   where application_id in ('<APP_A>'::uuid, '<APP_B>'::uuid);
rollback;
