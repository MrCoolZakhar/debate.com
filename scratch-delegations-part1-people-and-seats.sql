-- =============================================================================
-- scratch-delegations-part1-people-and-seats.sql
-- APPLIED 20 Oct 2026 (sections 1-14 through a chat; 15-16 as migration delegations_part1_short_invites_and_member_details, Peter's one-off approval). Record of what is live.
-- People and seats only: the delegations rebuild WITHOUT any money (rewritten
-- 20 Oct 2026 after Christian's answers, ~/Downloads/delegations-answers-for-peter.md).
--
-- NO MONEY IN THIS FILE (Peter, 20 Oct 2026)
--   * No statement here writes invoices, payments, applications.payment_status,
--     self_paid, spots_pledged or advisors_pledged, and none calls a function on
--     Christian's do-not-move list (sync_participant_invoices, settle_invoice_effects,
--     cover_pledge_spot, pledge_covered_application_ids, _apply_pledge_cover_to_app,
--     apply_pledge_coverage_society / _all, renumber_pledge_spot_labels,
--     renumber_delegation_tickets, add_pledged_spots, add_pledged_advisor_spots,
--     remove_pledged_spot_invoice, trim_excess_spot_invoices, _app_role_switched,
--     invoice_price_locked, money_daily_check, my_pay_overview, fin_attention_due_v2)
--     or replaces one. Checked by grep on 20 Oct 2026. The only writes are:
--     conference_allocations (seats), applications.status ('accepted' <-> 'assigned')
--     and assigned_committee_id / assigned_country_code / assigned_country_name,
--     position_papers, position_paper_messages, two new conferences columns, and
--     delegation_invites (the new short_code column, and the delegation's one invite
--     row when a leader asks for its short link before it exists, section 15).
--   * Read only: _society_paid_delegate_spots reads invoices, payment_status and
--     self_paid; _society_expected_size reads spots_pledged. Nothing else reads money
--     (delegation_member_details, section 16, returns no payment data).
--   * Existing triggers: delegation_place_member and delegation_unplace_member flip
--     applications.status between 'accepted' and 'assigned', exactly as the live
--     delegation_assign_seat does today. That fires the existing
--     zz_applications_pledge_coverage trigger (Christian's, unchanged), the same as
--     every seat placement today. No status here ever becomes rejected or withdrawn,
--     and no role or society_id is written.
--
-- REMOVED from the earlier draft (money, so they belong to Christian's chat; see
-- docs/conferences/delegations-requests-for-christian.md):
--   delegation_set_role, _delegation_reprice_own_ticket, delegation_remove_member.
--   Only organisers move someone between delegate and faculty advisor, through a
--   function Christian builds. Delegate <-> head delegate stays on the live
--   delegation_set_head. Removing a member changes society_id, which moves ticket
--   coverage through Christian's triggers, so it is his too.
--
-- Leaders: every leader check is is_society_leader (an ACCEPTED head delegate or
-- faculty advisor of the delegation, answer 11), never societies.advisor_user_id.
--
-- Written 19 Oct 2026 (sections 14 to 16 on 20 Oct 2026) against the live schema of
-- luruhkwrgisytejswlas, read only. Decisions: docs/conferences/delegations.md.
-- Map: CLAUDE.md. Client flag: DELEGATIONS_V2_DB (both v2.ts files), flipped once
-- this file is applied.
--
-- Conventions copied from the live functions it builds on
--   * delegation_set_head, delegation_promote_to_advisor, delegation_assign_seat,
--     perform_delegation_swap: SECURITY DEFINER, search_path public (+ pg_temp),
--     refusals returned as jsonb {ok:false, error:'<sentence>'}. This draft adds a
--     machine `code` to every refusal; the client (participant/delegation/v2.ts)
--     reads `error` (or `message`) and shows it through plainOrFallback.
--   * Functions that RETURN TABLE cannot return a jsonb refusal: they RAISE with
--     errcode P0001, a plain sentence and the code in HINT (as guard_application_write
--     does). friendlyError passes a plain P0001 message through.
--   * Application writes set app.trusted_write (guard_application_write).
--   * Grants: revoke from public and anon, grant execute to authenticated (as
--     delegation_set_head). Internal helpers are granted to nobody. One exception:
--     resolve_delegation_short_invite is anon and authenticated, like
--     resolve_delegation_invite, because the invite page resolves before sign-in.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Settings columns on conferences
--    delegation_seat_limit: how many seats an organiser can give a delegation
--      'none'     No limit (default)
--      'paid'     Up to paid spots     (_society_paid_delegate_spots)
--      'expected' Up to expected size  (_society_expected_size)
--    delegation_reshuffle_until: leaders may move their own people across their
--      seats while conferences.allocation_swap_mode = 'self_serve' (the existing
--      switch perform_delegation_swap already honours) and, when this is set,
--      only before it. Null = no deadline.
--    conferences has table-level grants for authenticated, so the Settings page
--    can write both columns through the existing organiser UPDATE policy.
--    Client: add the sentence for conferences_delegation_seat_limit_check to
--    CONSTRAINT_MESSAGES in src/lib/friendlyError.ts in the same change.
-- -----------------------------------------------------------------------------

alter table public.conferences
  add column if not exists delegation_seat_limit text not null default 'none'
    constraint conferences_delegation_seat_limit_check
    check (delegation_seat_limit in ('none', 'paid', 'expected'));

alter table public.conferences
  add column if not exists delegation_reshuffle_until timestamptz null;

comment on column public.conferences.delegation_seat_limit is
  'Settings > Delegations: how many seats an organiser can give one delegation. none = no limit, paid = up to paid spots, expected = up to expected size.';
comment on column public.conferences.delegation_reshuffle_until is
  'Settings > Delegations: leaders may move their own people across their seats until this moment (only while allocation_swap_mode = self_serve). Null = no deadline.';


-- -----------------------------------------------------------------------------
-- 0. Internal helpers (used by sections 5, 6 and 14). Not callable by clients.
--    _delegation_leader_count is kept for Christian's role and removal functions
--    (the last-leader rule); nothing in this file calls it.
-- -----------------------------------------------------------------------------

-- Leaders of a society other than p_except: accepted head delegates and faculty
-- advisors WITH an account (is_society_leader needs auth.uid(), so a leader
-- without an account can never act).
create or replace function public._delegation_leader_count(p_society uuid, p_except uuid)
returns integer
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select count(*)::int from applications a
   where a.society_id = p_society
     and a.id is distinct from p_except
     and a.user_id is not null
     and a.role in ('faculty-advisor', 'head-delegate')
     and a.status in ('accepted', 'assigned', 'checked-in');
$function$;

-- Paid delegate places of a delegation, from the ledger, never societies.spots_purchased.
-- spots_purchased is a running counter (settle_invoice_effects +1, removals and
-- refunds -1, one-off corrections) and on 19 Oct 2026 it disagreed with the ledger
-- for 15 of the 118 delegations. This counts:
--   * the delegation's Delegate Tickets that are paid in full (pledge_spot invoices
--     of its accepted leaders, as is_society_leader counts them, status settled), plus
--   * delegates and head delegates who paid their own ticket (self_paid) or whose
--     fee the organiser waived. A member covered by a delegation ticket is NOT
--     counted again (payment_status stays unpaid under fin_pledge_covers, or is
--     'paid' with self_paid false under the older pool, both excluded).
-- A free registration is 'paid' + self_paid (applications_mark_free_as_paid), so on
-- a free conference every member counts. READ ONLY: nothing is written.
create or replace function public._society_paid_delegate_spots(p_society uuid)
returns integer
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select (
    select count(*) from invoices i
      join applications l on l.id = i.application_id
     where l.society_id = p_society
       and l.role in ('faculty-advisor', 'head-delegate')
       and l.status in ('accepted', 'assigned', 'checked-in')
       and i.kind = 'pledge_spot'
       and i.status = 'settled'
  )::int + (
    select count(*) from applications a
     where a.society_id = p_society
       and a.role in ('delegate', 'head-delegate')
       and a.status not in ('rejected', 'withdrawn')
       and (a.payment_status = 'waived' or (a.payment_status = 'paid' and a.self_paid))
  )::int;
$function$;

-- Expected size of a delegation (what the UI used to call "pledged"), as Christian's
-- answer 5 defines it: the sum of spots_pledged over the delegation's ACCEPTED leaders
-- (head delegates and faculty advisors, the is_society_leader test), plus one seat
-- for each accepted head delegate, who holds their own Delegate Ticket 1. Faculty
-- advisors are not delegate seats, so they add only the tickets they bought.
-- Expected size and the Delegate Tickets are one number on purpose (answer 8).
-- READ ONLY: nothing is written.
create or replace function public._society_expected_size(p_society uuid)
returns integer
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(sum(coalesce(l.spots_pledged, 0)
                      + case when l.role = 'head-delegate' then 1 else 0 end), 0)::int
    from applications l
   where l.society_id = p_society
     and l.role in ('faculty-advisor', 'head-delegate')
     and l.status in ('accepted', 'assigned', 'checked-in');
$function$;

-- Seats a delegation holds today: its block seats (society_id set) plus every seat
-- held by one of its members. On 19 Oct 2026 the 445 seats held by delegation
-- members all have society_id NULL (only block seats carry it), so membership is
-- read through the application. A double seat is two rows, so it counts as 2.
create or replace function public._society_seat_count(p_society uuid)
returns integer
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select count(*)::int
    from conference_allocations ca
    join societies s on s.id = p_society
   where ca.conference_id = s.conference_id
     and (ca.society_id = p_society
          or ca.application_id in (select a.id from applications a
                                    where a.society_id = p_society
                                      and a.status not in ('rejected', 'withdrawn')));
$function$;

-- Turns every seat a member holds in the conference into a block seat of p_society:
-- the person is cleared, the committee / country / seat stay, society_id is set,
-- allocation_sent goes back to false (as delegation_assign_seat and
-- delegation_promote_to_advisor do). Matches the seat by application OR by user, as
-- delegation_promote_to_advisor does. Returns the released allocation ids.
-- The caller clears the application's assigned_* fields and status.
create or replace function public._delegation_release_seat(p_application uuid, p_society uuid)
returns uuid[]
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  a record;
  v_ids uuid[];
begin
  select id, user_id, conference_id into a from applications where id = p_application;
  if a.id is null then return '{}'::uuid[]; end if;
  with u as (
    update conference_allocations ca
       set user_id = null, application_id = null,
           allocation_sent = false, allocation_sent_at = null,
           society_id = coalesce(p_society, ca.society_id)
     where ca.conference_id = a.conference_id
       and (ca.application_id = a.id or (a.user_id is not null and ca.user_id = a.user_id))
    returning ca.id
  )
  select coalesce(array_agg(u.id), '{}'::uuid[]) into v_ids from u;
  return v_ids;
end $function$;

revoke all on function public._delegation_leader_count(uuid, uuid) from public, anon, authenticated;
revoke all on function public._society_paid_delegate_spots(uuid) from public, anon, authenticated;
revoke all on function public._society_expected_size(uuid) from public, anon, authenticated;
revoke all on function public._society_seat_count(uuid) from public, anon, authenticated;
revoke all on function public._delegation_release_seat(uuid, uuid) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. my_delegation_open_seats(p_society)
--    For any member of the delegation (any application in it that is not rejected
--    or withdrawn, the same test as my_delegation_roster) and for the conference's
--    organisers: the delegation's block seats with nobody in them.
--    No emails, no user ids. Returns rows (supabase-js gives an array).
--    v2.ts reads allocation_id, conference_committee_id, committee (or name),
--    abbreviation, logo_url, country_code, seat (or country_name), delegation_size.
-- -----------------------------------------------------------------------------

create or replace function public.my_delegation_open_seats(p_society uuid)
returns table (
  allocation_id uuid,
  conference_committee_id uuid,
  committee text,
  abbreviation text,
  logo_url text,
  country_code text,
  country_name text,
  country_logo_url text,
  seat smallint,
  delegation_size integer
)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_conf uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in again.' using errcode = 'P0001', hint = 'signed_out';
  end if;
  select s.conference_id into v_conf from societies s where s.id = p_society;
  if v_conf is null then
    raise exception 'We could not find this delegation.' using errcode = 'P0001', hint = 'not_found';
  end if;
  if not exists (select 1 from applications a
                  where a.society_id = p_society and a.user_id = v_uid
                    and a.status not in ('rejected', 'withdrawn'))
     and not is_conference_organizer(v_conf) then
    raise exception 'You are not part of this delegation.' using errcode = 'P0001', hint = 'not_member';
  end if;

  return query
  select ca.id,
         ca.conference_committee_id,
         cc.name,
         cc.abbreviation,
         cc.logo_url,
         ca.country_code,
         ca.country_name,
         sl.logo_url,
         ca.seat,
         coalesce(sl.delegation_size, cc.delegation_size::int, 1)
    from conference_allocations ca
    join conference_committees cc on cc.id = ca.conference_committee_id
    left join committee_country_slots sl
      on sl.conference_committee_id = ca.conference_committee_id and sl.country_code = ca.country_code
   where ca.society_id = p_society
     and ca.conference_id = v_conf
     and ca.user_id is null
     and ca.application_id is null
   order by cc.name, ca.country_name, ca.seat;
end $function$;

revoke all on function public.my_delegation_open_seats(uuid) from public, anon;
grant execute on function public.my_delegation_open_seats(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 5. delegation_place_member(p_application, p_allocation)
--    A leader, or an organiser of the conference (is_conference_organizer, the same
--    permission as the applications page's writes), puts a delegate or head delegate
--    of the delegation
--    into one of its block seats (a row with society_id = the delegation and nobody
--    in it).
--      * Member with no seat: always allowed.
--      * Member who already holds a seat (moving): allowed for a leader only while
--        allocation_swap_mode = 'self_serve' and (delegation_reshuffle_until is null
--        or now() < it). Organisers are never limited. Their old seat becomes a block
--        seat of the delegation (Open).
--      * Unique indexes: the old seat is cleared BEFORE the new one is filled, so
--        conference_allocations_one_seat_per_delegate (conference_id, user_id) and
--        (conference_committee_id, user_id) never see two rows. One seat per
--        application per conference is checked here (the index on application_id is
--        only per committee). Double seats: seat 1 and seat 2 are separate rows; a
--        member takes whichever block row is given, guard_allocation_seat is not
--        touched (seat, country and committee never change here).
--      * allocation_sent goes back to false on both rows, as delegation_assign_seat
--        does: the organiser publishes the new allocation.
--    Imported members without an account yet are placed by application (user_id
--    stays null on the seat, as for the 211 imported seats today).
-- -----------------------------------------------------------------------------

create or replace function public.delegation_place_member(p_application uuid, p_allocation uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_seat record;
  v_m record;
  v_old record;
  v_conf record;
  v_is_org boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Sign in first.');
  end if;

  select ca.id, ca.conference_id, ca.conference_committee_id, ca.country_code, ca.country_name,
         ca.seat, ca.society_id, ca.user_id, ca.application_id
    into v_seat
    from conference_allocations ca
   where ca.id = p_allocation
   for update;
  if v_seat.id is null then
    return jsonb_build_object('ok', false, 'code', 'seat_not_found', 'error', 'We could not find that seat.');
  end if;
  if v_seat.society_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_block_seat', 'error', 'This seat does not belong to a delegation.');
  end if;

  v_is_org := is_conference_organizer(v_seat.conference_id);
  if not (v_is_org or is_society_leader(v_seat.society_id)) then
    return jsonb_build_object('ok', false, 'code', 'not_leader', 'error', 'Only a head delegate or faculty advisor of this delegation can place people.');
  end if;

  select a.id, a.user_id, a.role, a.status, a.conference_id, a.society_id
    into v_m
    from applications a
   where a.id = p_application
   for update;
  if v_m.id is null or v_m.society_id is distinct from v_seat.society_id then
    return jsonb_build_object('ok', false, 'code', 'not_member', 'error', 'That person is not in this delegation.');
  end if;
  if v_m.role not in ('delegate', 'head-delegate') then
    return jsonb_build_object('ok', false, 'code', 'not_seatable', 'error', 'Faculty advisors do not sit in a committee.');
  end if;
  if v_m.status not in ('accepted', 'assigned', 'checked-in') then
    return jsonb_build_object('ok', false, 'code', 'not_accepted', 'error', 'The organiser has to accept this application first.');
  end if;

  if v_seat.application_id = v_m.id then
    return jsonb_build_object('ok', true, 'unchanged', true, 'application_id', v_m.id, 'allocation_id', v_seat.id);
  end if;
  if v_seat.user_id is not null or v_seat.application_id is not null then
    return jsonb_build_object('ok', false, 'code', 'seat_taken', 'error', 'Someone already sits in this seat.');
  end if;

  -- Their current seat in this conference, if any.
  select ca.id, ca.society_id
    into v_old
    from conference_allocations ca
   where ca.conference_id = v_seat.conference_id
     and ca.id <> v_seat.id
     and (ca.application_id = v_m.id or (v_m.user_id is not null and ca.user_id = v_m.user_id))
   limit 1
   for update;

  if v_old.id is not null and not v_is_org then
    select c.allocation_swap_mode, c.delegation_reshuffle_until
      into v_conf
      from conferences c
     where c.id = v_seat.conference_id;
    if v_conf.allocation_swap_mode is distinct from 'self_serve' then
      return jsonb_build_object('ok', false, 'code', 'reshuffle_off', 'error', 'The organiser has not opened reshuffling. Ask them to move this delegate.');
    end if;
    if v_conf.delegation_reshuffle_until is not null and now() >= v_conf.delegation_reshuffle_until then
      return jsonb_build_object('ok', false, 'code', 'reshuffle_closed', 'error', 'Reshuffling has closed. Ask the organiser to move this delegate.');
    end if;
  end if;

  perform set_config('app.trusted_write', 'on', true);

  -- Old seat first (unique indexes), then the new one.
  if v_old.id is not null then
    perform public._delegation_release_seat(v_m.id, v_m.society_id);
  end if;

  update conference_allocations
     set user_id = v_m.user_id,
         application_id = v_m.id,
         allocation_sent = false,
         allocation_sent_at = null,
         assigned_by = v_uid
   where id = v_seat.id;

  update applications
     set status = case when status = 'accepted' then 'assigned' else status end,
         assigned_committee_id = v_seat.conference_committee_id,
         assigned_country_code = v_seat.country_code,
         assigned_country_name = v_seat.country_name
   where id = v_m.id;

  return jsonb_build_object(
    'ok', true,
    'application_id', v_m.id,
    'allocation_id', v_seat.id,
    'released_allocation_id', v_old.id);
end $function$;

revoke all on function public.delegation_place_member(uuid, uuid) from public, anon;
grant execute on function public.delegation_place_member(uuid, uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 6. Organiser seats
--    Authorised exactly like every allocation write today: the RLS policy
--    "Organizers manage allocations" is is_conference_organizer(<the committee's
--    conference>). Section permissions are UI only (CLAUDE.md), so no extra check.
--
--    organiser_give_society_seats(p_society, p_seats)
--      p_seats = [{conference_committee_id, country_code, seat}, ...], 1..200.
--      All or nothing: every seat is checked before anything is written; a seat
--      taken by someone else between the check and the insert raises 23505 and
--      the whole call rolls back. Each seat must be a country of that committee
--      (committee_country_slots), of this conference, with seat <= its delegation
--      size, and free. delegation_seat_limit is enforced against
--      _society_seat_count + the new seats.
--    organiser_take_back_society_seat(p_allocation)
--      Deletes one block seat with nobody in it.
-- -----------------------------------------------------------------------------

create or replace function public.organiser_give_society_seats(p_society uuid, p_seats jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_soc record;
  v_mode text;
  v_limit int;
  v_have int;
  v_more int;
  v_n int;
  v_word text;
  r record;
  v_ids uuid[];
  v_uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Sign in first.');
  end if;

  -- Locks the delegation: two organisers giving seats at once cannot pass the limit.
  select s.id, s.conference_id, s.name into v_soc from societies s where s.id = p_society for update;
  if v_soc.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'We could not find this delegation.');
  end if;
  if not is_conference_organizer(v_soc.conference_id) then
    return jsonb_build_object('ok', false, 'code', 'not_organiser', 'error', 'Only the conference''s organisers can give seats.');
  end if;

  if p_seats is null or jsonb_typeof(p_seats) <> 'array' or jsonb_array_length(p_seats) = 0 then
    return jsonb_build_object('ok', false, 'code', 'no_seats', 'error', 'Choose at least one seat.');
  end if;
  v_n := jsonb_array_length(p_seats);
  if v_n > 200 then
    return jsonb_build_object('ok', false, 'code', 'too_many', 'error', 'Give at most 200 seats at a time.');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_seats) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(e->>'conference_committee_id', '') !~ v_uuid_re
        or coalesce(btrim(e->>'country_code'), '') = ''
        or coalesce(e->>'seat', '1') !~ '^[12]$') then
    return jsonb_build_object('ok', false, 'code', 'bad_seat', 'error', 'Each seat needs a committee, a country and seat 1 or 2.');
  end if;
  if (select count(distinct (e->>'conference_committee_id', e->>'country_code', coalesce(e->>'seat', '1')))
        from jsonb_array_elements(p_seats) e) < v_n then
    return jsonb_build_object('ok', false, 'code', 'duplicate_seat', 'error', 'The same seat is in the list twice.');
  end if;

  -- Every seat is checked before anything is written.
  for r in
    select x.cc_id, x.code, x.seat, sl.country_name, sl.delegation_size, cc.conference_id,
           coalesce(cc.abbreviation, cc.name) as committee,
           (select 1 from conference_allocations t
             where t.conference_committee_id = x.cc_id and t.country_code = x.code and t.seat = x.seat) as taken
      from (select (e->>'conference_committee_id')::uuid as cc_id,
                   e->>'country_code' as code,
                   coalesce(e->>'seat', '1')::smallint as seat
              from jsonb_array_elements(p_seats) e) x
      left join conference_committees cc on cc.id = x.cc_id
      left join committee_country_slots sl on sl.conference_committee_id = x.cc_id and sl.country_code = x.code
  loop
    if r.conference_id is null or r.conference_id <> v_soc.conference_id then
      return jsonb_build_object('ok', false, 'code', 'not_a_committee', 'error', 'One of these committees is not part of this conference.');
    end if;
    if r.country_name is null then
      return jsonb_build_object('ok', false, 'code', 'not_a_seat', 'error', r.committee || ' has no country with the code ' || r.code || '.');
    end if;
    if r.seat > coalesce(r.delegation_size, 1) then
      return jsonb_build_object('ok', false, 'code', 'not_a_seat', 'error', r.country_name || ' in ' || r.committee || ' has only one seat.');
    end if;
    if r.taken is not null then
      return jsonb_build_object('ok', false, 'code', 'seat_taken', 'error', r.country_name || ' in ' || r.committee || ' is already given.');
    end if;
  end loop;

  -- The organiser's limit (Settings > Delegations).
  select c.delegation_seat_limit into v_mode from conferences c where c.id = v_soc.conference_id;
  if coalesce(v_mode, 'none') <> 'none' then
    v_limit := case v_mode when 'paid' then public._society_paid_delegate_spots(p_society)
                           else public._society_expected_size(p_society) end;
    v_have := public._society_seat_count(p_society);
    v_more := greatest(v_limit - v_have, 0);
    v_word := case v_mode when 'paid' then 'paid spots' else 'expected size' end;
    if v_n > v_more then
      return jsonb_build_object(
        'ok', false, 'code', 'seat_limit',
        'allowed_more', v_more, 'limit', v_limit, 'seats_now', v_have, 'limit_kind', v_mode,
        'error', case when v_more = 0
                      then 'This delegation already has all the seats its ' || v_word || ' allows.'
                      else 'You can give this delegation ' || v_more || ' more seat'
                           || case when v_more = 1 then '' else 's' end
                           || ', up to its ' || v_word || '.' end);
    end if;
  end if;

  with ins as (
    insert into conference_allocations
      (conference_id, conference_committee_id, country_code, country_name, seat, society_id, assigned_by)
    select v_soc.conference_id, x.cc_id, x.code, sl.country_name, x.seat, p_society, v_uid
      from (select (e->>'conference_committee_id')::uuid as cc_id,
                   e->>'country_code' as code,
                   coalesce(e->>'seat', '1')::smallint as seat
              from jsonb_array_elements(p_seats) e) x
      join committee_country_slots sl on sl.conference_committee_id = x.cc_id and sl.country_code = x.code
    returning id
  )
  select coalesce(array_agg(ins.id), '{}'::uuid[]) into v_ids from ins;

  return jsonb_build_object('ok', true, 'created', coalesce(array_length(v_ids, 1), 0), 'allocation_ids', to_jsonb(v_ids));
end $function$;

revoke all on function public.organiser_give_society_seats(uuid, jsonb) from public, anon;
grant execute on function public.organiser_give_society_seats(uuid, jsonb) to authenticated;


create or replace function public.organiser_take_back_society_seat(p_allocation uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_seat record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Sign in first.');
  end if;
  select ca.id, ca.society_id, ca.user_id, ca.application_id, cc.conference_id
    into v_seat
    from conference_allocations ca
    join conference_committees cc on cc.id = ca.conference_committee_id
   where ca.id = p_allocation
   for update of ca;
  if v_seat.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'We could not find that seat.');
  end if;
  if not is_conference_organizer(v_seat.conference_id) then
    return jsonb_build_object('ok', false, 'code', 'not_organiser', 'error', 'Only the conference''s organisers can take seats back.');
  end if;
  if v_seat.society_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_block_seat', 'error', 'This seat does not belong to a delegation.');
  end if;
  if v_seat.user_id is not null or v_seat.application_id is not null then
    return jsonb_build_object('ok', false, 'code', 'seat_filled', 'error', 'Someone sits in this seat. Move them out first.');
  end if;

  delete from conference_allocations where id = v_seat.id;
  return jsonb_build_object('ok', true, 'allocation_id', v_seat.id, 'society_id', v_seat.society_id);
end $function$;

revoke all on function public.organiser_take_back_society_seat(uuid) from public, anon;
grant execute on function public.organiser_take_back_society_seat(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 7. my_committee_roster(p_conference_committee)
--    Who may read it:
--      * an accepted delegate or head delegate seated in that committee whose own
--        seat has been sent (allocation_sent),
--      * a leader of a delegation with a member (or a block seat) in that committee
--        whose seat has been sent,
--      * the conference's organisers.
--    Rows: only seats whose allocation has been sent. A sent seat with nobody in it
--    comes back with delegate_name null. Names are profiles.display_name (live),
--    else the name the person was invited under; never an email or a user id.
--    Chairs are not included (the prompt did not list them; they already read
--    allocations through "Chairs read committee allocations").
-- -----------------------------------------------------------------------------

create or replace function public.my_committee_roster(p_conference_committee uuid)
returns table (
  country_code text,
  country_name text,
  seat smallint,
  delegate_name text,
  society_name text,
  is_mine boolean
)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_conf uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in again.' using errcode = 'P0001', hint = 'signed_out';
  end if;
  select cc.conference_id into v_conf from conference_committees cc where cc.id = p_conference_committee;
  if v_conf is null then
    raise exception 'We could not find this committee.' using errcode = 'P0001', hint = 'not_found';
  end if;

  if not (
    is_conference_organizer(v_conf)
    or exists (
      select 1 from conference_allocations ca
       where ca.conference_committee_id = p_conference_committee
         and ca.user_id = v_uid
         and ca.allocation_sent
         and exists (select 1 from applications a
                      where a.conference_id = v_conf and a.user_id = v_uid
                        and a.role in ('delegate', 'head-delegate')
                        and a.status in ('accepted', 'assigned', 'checked-in')))
    or exists (
      select 1 from conference_allocations ca
       left join applications m on m.id = ca.application_id
       where ca.conference_committee_id = p_conference_committee
         and ca.allocation_sent
         and coalesce(m.society_id, ca.society_id) is not null
         and is_society_leader(coalesce(m.society_id, ca.society_id)))
  ) then
    raise exception 'You can see this committee once your allocation in it is published.' using errcode = 'P0001', hint = 'not_allowed';
  end if;

  return query
  select ca.country_code,
         ca.country_name,
         ca.seat,
         case when ca.user_id is null and ca.application_id is null then null
              else coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(a.invited_name), ''), 'Delegate') end,
         s.name,
         coalesce(s.id in (select public.my_society_ids()), false)
    from conference_allocations ca
    left join applications a on a.id = ca.application_id
    left join profiles p on p.id = coalesce(ca.user_id, a.user_id)
    left join societies s on s.id = coalesce(a.society_id, ca.society_id)
   where ca.conference_committee_id = p_conference_committee
     and ca.allocation_sent
   order by ca.country_name, ca.seat;
end $function$;

revoke all on function public.my_committee_roster(uuid) from public, anon;
grant execute on function public.my_committee_roster(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 8. Leaders and position papers
--    Today (read live): a paper is ONE position_papers row per (committee, user)
--    (unique), file in the PUBLIC bucket 'position-papers' (5 MB, PDF only) at
--    <conference_id>/<committee_id>/<user_id>_<epoch>.pdf. The member's card
--    (participant/PositionPaperCard.tsx) inserts the row, and replaces by updating
--    file_url in place; trg_position_paper_resubmit puts a reviewed paper back to
--    'submitted'. RLS: own rows, seatmates (user_is_allocated_to), chairs,
--    organisers. Storage: pp_object_manageable / pp_object_readable + an INSERT
--    policy for the author and organisers.
--
--    Drafted: leaders of a member's delegation may
--      * READ the member's paper rows and files (new SELECT policies),
--      * UPLOAD a file under the member's path (new storage INSERT policy) and
--        INSERT the member's first row (new INSERT policy, status 'submitted' and
--        no review fields), which is what v2.ts uploadPaperForMember does today,
--      * REPLACE the member's paper through delegation_submit_member_paper: one
--        SECURITY DEFINER write that inserts or updates the member's row (latest
--        upload wins) and logs a system line. Leaders get NO direct UPDATE or DELETE
--        policy, because RLS cannot stop an UPDATE from also setting status
--        'approved' or the review fields.
--    The member can still replace it: their existing "Delegates manage own position
--    papers" policy covers the row (user_id = them) and pp_object_manageable covers
--    the file (path user = them). Latest wins either way.
--    A leader cannot delete the member's old file; the replaced object is left as an
--    orphan, which the paper flow already treats as harmless.
--    Not drafted: leaders in the paper's feedback thread (can_access_paper is
--    unchanged, so leaders do not read or post chair feedback messages).
--    Money: none. This section writes only position_papers, position_paper_messages
--    and storage policies; no invoice, payment, credit or application column.
-- -----------------------------------------------------------------------------

-- Is the caller a leader of p_user's delegation, with p_user seated in p_committee?
create or replace function public.pp_leader_of_member(p_committee uuid, p_user uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select auth.uid() is not null and p_committee is not null and p_user is not null and exists (
    select 1
      from conference_allocations ca
      join applications m on m.conference_id = ca.conference_id and m.user_id = p_user
     where ca.conference_committee_id = p_committee
       and ca.user_id = p_user
       and m.society_id is not null
       and m.role in ('delegate', 'head-delegate')
       and m.status in ('accepted', 'assigned', 'checked-in')
       and public.is_society_leader(m.society_id));
$function$;

-- Same, and the row's country is the member's seat in that committee.
create or replace function public.pp_leader_can_write(p_committee uuid, p_user uuid, p_country text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.pp_leader_of_member(p_committee, p_user) and exists (
    select 1 from conference_allocations ca
     where ca.conference_committee_id = p_committee
       and ca.user_id = p_user
       and ca.country_code = p_country);
$function$;

revoke all on function public.pp_leader_of_member(uuid, uuid) from public, anon;
grant execute on function public.pp_leader_of_member(uuid, uuid) to authenticated;
revoke all on function public.pp_leader_can_write(uuid, uuid, text) from public, anon;
grant execute on function public.pp_leader_can_write(uuid, uuid, text) to authenticated;

drop policy if exists "Delegation leaders read member position papers" on public.position_papers;
create policy "Delegation leaders read member position papers"
  on public.position_papers for select to authenticated
  using (public.pp_leader_of_member(conference_committee_id, user_id));

drop policy if exists "Delegation leaders submit member position papers" on public.position_papers;
create policy "Delegation leaders submit member position papers"
  on public.position_papers for insert to authenticated
  with check (
    public.pp_leader_can_write(conference_committee_id, user_id, country_code)
    and status = 'submitted'
    and reviewed_by is null and reviewed_at is null and chair_feedback is null
  );

-- Storage. Policies on storage.objects are created from the SQL editor as postgres.
drop policy if exists "Position papers: upload for a delegation member" on storage.objects;
create policy "Position papers: upload for a delegation member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'position-papers'
    and public.pp_key_uuid(name, 1) is not null
    and exists (select 1 from public.conference_committees cc
                 where cc.id = public.pp_key_uuid(name, 2)
                   and cc.conference_id = public.pp_key_uuid(name, 1))
    and public.pp_leader_of_member(public.pp_key_uuid(name, 2), public.pp_key_uuid(name, 3))
  );

drop policy if exists "Position papers: read by delegation leaders" on storage.objects;
create policy "Position papers: read by delegation leaders"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'position-papers'
    and public.pp_leader_of_member(public.pp_key_uuid(name, 2), public.pp_key_uuid(name, 3))
  );

-- A leader submits or replaces a seated member's paper. The leader uploads the file
-- first (policy above) to <conference>/<committee>/<member user id>_<epoch>.pdf, then
-- calls this with its public URL. Inserts the member's row, or points their existing
-- row at the new file (the chat thread hangs off the row id, as in the member's own
-- replace). trg_position_paper_resubmit puts a reviewed paper back to 'submitted'.
create or replace function public.delegation_submit_member_paper(
  p_application uuid,
  p_file_url text,
  p_file_name text,
  p_file_size integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_m record;
  v_seat record;
  v_prefix text;
  v_paper uuid;
  v_old_url text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Sign in first.');
  end if;

  select a.id, a.user_id, a.conference_id, a.society_id, a.role, a.status
    into v_m from applications a where a.id = p_application;
  if v_m.id is null or v_m.society_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_member', 'error', 'That person is not in a delegation.');
  end if;
  if not is_society_leader(v_m.society_id) then
    return jsonb_build_object('ok', false, 'code', 'not_leader', 'error', 'Only a head delegate or faculty advisor of this delegation can submit papers for its members.');
  end if;
  if v_m.user_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_account', 'error', 'This person has not created their account yet, so a paper cannot be submitted for them.');
  end if;
  if v_m.role not in ('delegate', 'head-delegate') or v_m.status not in ('accepted', 'assigned', 'checked-in') then
    return jsonb_build_object('ok', false, 'code', 'not_seatable', 'error', 'Only a seated delegate has a position paper.');
  end if;

  select ca.conference_committee_id, ca.country_code into v_seat
    from conference_allocations ca
   where ca.conference_id = v_m.conference_id and ca.user_id = v_m.user_id
   limit 1;
  if v_seat.conference_committee_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_seat', 'error', 'This delegate has no seat yet, so there is no paper to submit.');
  end if;

  v_prefix := '/position-papers/' || v_m.conference_id || '/' || v_seat.conference_committee_id || '/' || v_m.user_id || '_';
  if p_file_url is null or p_file_url !~ '^https://' or position(v_prefix in p_file_url) = 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_file', 'error', 'Upload the PDF again, then submit.');
  end if;
  if coalesce(btrim(p_file_name), '') = '' or p_file_size is null or p_file_size <= 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_file', 'error', 'Upload the PDF again, then submit.');
  end if;

  select pp.id, pp.file_url into v_paper, v_old_url
    from position_papers pp
   where pp.conference_committee_id = v_seat.conference_committee_id and pp.user_id = v_m.user_id
   for update;

  if v_paper is null then
    insert into position_papers
      (conference_id, conference_committee_id, user_id, country_code, file_url, file_name, file_size_bytes, status)
    values
      (v_m.conference_id, v_seat.conference_committee_id, v_m.user_id, v_seat.country_code,
       p_file_url, left(p_file_name, 255), p_file_size, 'submitted')
    on conflict (conference_committee_id, user_id) do update
      set file_url = excluded.file_url, file_name = excluded.file_name,
          file_size_bytes = excluded.file_size_bytes, submitted_at = now(), updated_at = now()
    returning id into v_paper;
  else
    update position_papers
       set file_url = p_file_url,
           file_name = left(p_file_name, 255),
           file_size_bytes = p_file_size,
           country_code = v_seat.country_code,
           submitted_at = now(),
           updated_at = now()
     where id = v_paper;
    -- Same line the member's own replace logs (log_paper_system_message would refuse
    -- a leader: can_access_paper does not include them).
    insert into position_paper_messages (paper_id, sender_user_id, is_reviewer, is_system, body)
    values (v_paper, v_uid, false, true, 'New version uploaded by the delegation''s leader.');
  end if;

  return jsonb_build_object('ok', true, 'paper_id', v_paper, 'replaced', v_old_url is not null, 'old_file_url', v_old_url);
end $function$;

revoke all on function public.delegation_submit_member_paper(uuid, text, text, integer) from public, anon;
grant execute on function public.delegation_submit_member_paper(uuid, text, text, integer) to authenticated;



-- -----------------------------------------------------------------------------
-- 11. my_delegation_seats(p_society)
--     Members see each other's seats. A NEW function instead of extending
--     my_delegation_roster, because this changes less: the roster keeps its body,
--     columns and order, and its rule that only the person or a leader sees an
--     allocation and payment_status stays untouched for every current caller.
--     Who: any member of the delegation (application not rejected or withdrawn,
--     the roster's test) and the conference's organisers.
--     Rows: one per member (delegate, head delegate, faculty advisor), in the
--     roster's order (me first, advisors, head delegates, delegates, then name).
--     Seat columns are null when the member has no seat, and for a NON-leader also
--     while that seat's allocation has not been sent (the organiser has not
--     published it); leaders see every seat, since they place people.
--     No emails, no user ids, no payment data.
-- -----------------------------------------------------------------------------

create or replace function public.my_delegation_seats(p_society uuid)
returns table (
  application_id uuid,
  display_name text,
  role text,
  is_me boolean,
  conference_committee_id uuid,
  committee text,
  abbreviation text,
  logo_url text,
  country_code text,
  country_name text,
  seat smallint,
  allocation_sent boolean
)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_conf uuid;
  v_leader boolean;
begin
  if v_uid is null then
    raise exception 'Please sign in again.' using errcode = 'P0001', hint = 'signed_out';
  end if;
  select s.conference_id into v_conf from societies s where s.id = p_society;
  if v_conf is null then
    raise exception 'We could not find this delegation.' using errcode = 'P0001', hint = 'not_found';
  end if;
  if not exists (select 1 from applications a
                  where a.society_id = p_society and a.user_id = v_uid
                    and a.status not in ('rejected', 'withdrawn'))
     and not is_conference_organizer(v_conf) then
    raise exception 'You are not part of this delegation.' using errcode = 'P0001', hint = 'not_member';
  end if;
  v_leader := is_society_leader(p_society) or is_conference_organizer(v_conf);

  return query
  select a.id,
         coalesce(nullif(btrim(p.display_name), ''), a.invited_name, 'Invited delegate'),
         a.role,
         coalesce(a.user_id = v_uid, false),
         case when vis.ok then al.conference_committee_id end,
         case when vis.ok then cc.name end,
         case when vis.ok then cc.abbreviation end,
         case when vis.ok then cc.logo_url end,
         case when vis.ok then al.country_code end,
         case when vis.ok then al.country_name end,
         case when vis.ok then al.seat end,
         case when vis.ok then al.allocation_sent end
    from applications a
    left join profiles p on p.id = a.user_id
    left join lateral (
      select ca.conference_committee_id, ca.country_code, ca.country_name, ca.seat, ca.allocation_sent
        from conference_allocations ca
       where ca.conference_id = v_conf
         and (ca.application_id = a.id or (a.user_id is not null and ca.user_id = a.user_id))
       order by ca.created_at desc
       limit 1
    ) al on true
    left join conference_committees cc on cc.id = al.conference_committee_id
    cross join lateral (select (al.conference_committee_id is not null and (v_leader or al.allocation_sent)) as ok) vis
   where a.society_id = p_society
     and a.conference_id = v_conf
     and a.status not in ('rejected', 'withdrawn')
     and a.role in ('faculty-advisor', 'head-delegate', 'delegate')
   order by (a.user_id = v_uid) desc nulls last,
            case a.role when 'faculty-advisor' then 0 when 'head-delegate' then 1 else 2 end,
            coalesce(p.display_name, a.invited_name);
end $function$;

revoke all on function public.my_delegation_seats(uuid) from public, anon;
grant execute on function public.my_delegation_seats(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 12. Study guides of every committee the delegation sits in
--     Today (read live):
--       * study_guides rows: "Assigned delegates read published study guides" =
--         (is_published OR sg_publish_due(committee)) AND (the caller holds an
--         allocation in that committee OR is an organiser); "Chairs read their
--         committee study guides" (same release test); "Organizers manage".
--       * The release rule is the (is_published OR sg_publish_due) pair:
--         sg_publish_due = conference_committees.study_guides_publish_at <= now().
--         save_committee_documents clears is_published when a release date is
--         saved; on 19 Oct 2026 the 44 guides with is_published true all have NO
--         date (published before the date rule), and every dated guide follows its
--         date. So the pair IS "a study guide follows its release date only".
--       * Storage: bucket 'study-guides' is PUBLIC and any signed-in user may read,
--         upload, update and delete in it (policies "Authenticated users can ...
--         study guides"). The file is therefore never the gate; the row (which
--         holds file_url) is. No storage change is needed for this section. (The
--         open insert / update / delete policies are a separate problem, listed in
--         the report, not changed here.)
--     Drafted: ONE extra SELECT policy on study_guides with the SAME release test,
--     for an accepted member of a delegation that sits in that committee: a member
--     of the delegation holds a seat there, or the delegation has an Open seat there.
--     For a non-leader the seat must have been sent (published), matching section
--     11; leaders see guides for every committee they hold seats in.
--     useCommitteeGuides.ts needs no change: it already reads study_guides by
--     committee id and treats a hidden row as "no guide yet".
-- -----------------------------------------------------------------------------

create or replace function public.sg_delegation_sits_in(p_committee uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select auth.uid() is not null and p_committee is not null and exists (
    select 1
      from applications me
      join conference_allocations ca
        on ca.conference_committee_id = p_committee and ca.conference_id = me.conference_id
      left join applications m on m.id = ca.application_id
     where me.user_id = auth.uid()
       and me.society_id is not null
       and me.status in ('accepted', 'assigned', 'checked-in')
       and coalesce(m.society_id, ca.society_id) = me.society_id
       and (m.id is null or m.status in ('accepted', 'assigned', 'checked-in'))
       and (ca.allocation_sent or public.is_society_leader(me.society_id)));
$function$;

revoke all on function public.sg_delegation_sits_in(uuid) from public, anon;
grant execute on function public.sg_delegation_sits_in(uuid) to authenticated;

drop policy if exists "Delegation members read their committees' study guides" on public.study_guides;
create policy "Delegation members read their committees' study guides"
  on public.study_guides for select to authenticated
  using (
    ((is_published = true) or public.sg_publish_due(conference_committee_id))
    and public.sg_delegation_sits_in(conference_committee_id)
  );


-- -----------------------------------------------------------------------------
-- 13. my_committee_chairs(p_conference_committee)
--     The committee's chairs by name: conference_committees.chair_user_ids in
--     their stored order, each as profiles.display_name (live). No emails, no ids.
--     Who: anyone seated in that committee (an allocation row holds them), a leader
--     of a delegation with a member or an Open seat in it, and the conference's
--     organisers.
--     Chairs with no display name are left out (never "Unknown"). The organiser's
--     public line-up (conference_committees.display_chairs, names the organiser
--     typed) is already readable by anyone; this returns the real chair accounts.
--     If the client wants the typed line-up when no chair account is linked yet,
--     it can read display_chairs itself; this function does not mix the two.
-- -----------------------------------------------------------------------------

create or replace function public.my_committee_chairs(p_conference_committee uuid)
returns table (display_name text)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_conf uuid;
  v_chairs uuid[];
begin
  if v_uid is null then
    raise exception 'Please sign in again.' using errcode = 'P0001', hint = 'signed_out';
  end if;
  select cc.conference_id, coalesce(cc.chair_user_ids, '{}'::uuid[])
    into v_conf, v_chairs
    from conference_committees cc
   where cc.id = p_conference_committee;
  if v_conf is null then
    raise exception 'We could not find this committee.' using errcode = 'P0001', hint = 'not_found';
  end if;

  if not (
    is_conference_organizer(v_conf)
    or exists (select 1 from conference_allocations ca
                where ca.conference_committee_id = p_conference_committee and ca.user_id = v_uid)
    or exists (
      select 1 from conference_allocations ca
       left join applications m on m.id = ca.application_id
       where ca.conference_committee_id = p_conference_committee
         and coalesce(m.society_id, ca.society_id) is not null
         and is_society_leader(coalesce(m.society_id, ca.society_id)))
  ) then
    raise exception 'You can see this committee''s chairs once you have a seat in it.' using errcode = 'P0001', hint = 'not_allowed';
  end if;

  return query
  select btrim(p.display_name)
    from unnest(v_chairs) with ordinality as c(user_id, ord)
    join profiles p on p.id = c.user_id
   where nullif(btrim(p.display_name), '') is not null
   order by c.ord;
end $function$;

revoke all on function public.my_committee_chairs(uuid) from public, anon;
grant execute on function public.my_committee_chairs(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 14. delegation_unplace_member(p_application)
--     A leader of the member's delegation (is_society_leader, the same test as
--     delegation_place_member), or an organiser of the conference
--     (is_conference_organizer), takes a delegate or head delegate out of their seat.
--       * The seat becomes a block seat of the delegation (Open): committee, country
--         and seat kept, person cleared, allocation_sent back to false, through
--         _delegation_release_seat, as delegation_place_member does for a moved member.
--       * The member STAYS in the delegation: society_id, role and money untouched;
--         assigned_* cleared and 'assigned' drops back to 'accepted'.
--       * Leaders: the same rule as moving a seated member in delegation_place_member,
--         only while allocation_swap_mode = 'self_serve' and (delegation_reshuffle_until
--         is null or now() < it). Organisers are never limited.
--       * No credit, invoice or email changes. A member with no seat answers
--         {ok:true, unchanged:true}.
-- -----------------------------------------------------------------------------

create or replace function public.delegation_unplace_member(p_application uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_m record;
  v_seat_id uuid;
  v_conf record;
  v_is_org boolean;
  v_released uuid[] := '{}'::uuid[];
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Sign in first.');
  end if;

  select a.id, a.user_id, a.role, a.status, a.conference_id, a.society_id
    into v_m
    from applications a
   where a.id = p_application
   for update;
  if v_m.id is null or v_m.society_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_member', 'error', 'That person is not in a delegation.');
  end if;

  v_is_org := is_conference_organizer(v_m.conference_id);
  if not (v_is_org or is_society_leader(v_m.society_id)) then
    return jsonb_build_object('ok', false, 'code', 'not_leader', 'error', 'Only a head delegate or faculty advisor of this delegation can take people out of a seat.');
  end if;

  -- Their seat in this conference, matched by application OR by user, as
  -- _delegation_release_seat matches it.
  select ca.id
    into v_seat_id
    from conference_allocations ca
   where ca.conference_id = v_m.conference_id
     and (ca.application_id = v_m.id or (v_m.user_id is not null and ca.user_id = v_m.user_id))
   limit 1
   for update;
  if v_seat_id is null then
    return jsonb_build_object('ok', true, 'unchanged', true, 'application_id', v_m.id, 'allocation_id', null);
  end if;

  if not v_is_org then
    select c.allocation_swap_mode, c.delegation_reshuffle_until
      into v_conf
      from conferences c
     where c.id = v_m.conference_id;
    if v_conf.allocation_swap_mode is distinct from 'self_serve' then
      return jsonb_build_object('ok', false, 'code', 'reshuffle_off', 'error', 'The organiser has not opened reshuffling. Ask them to take this delegate out of the seat.');
    end if;
    if v_conf.delegation_reshuffle_until is not null and now() >= v_conf.delegation_reshuffle_until then
      return jsonb_build_object('ok', false, 'code', 'reshuffle_closed', 'error', 'Reshuffling has closed. Ask the organiser to take this delegate out of the seat.');
    end if;
  end if;

  perform set_config('app.trusted_write', 'on', true);

  -- The seat goes back to the delegation as an Open seat.
  v_released := public._delegation_release_seat(v_m.id, v_m.society_id);

  update applications
     set assigned_committee_id = null,
         assigned_country_code = null,
         assigned_country_name = null,
         status = case when status = 'assigned' then 'accepted' else status end
   where id = v_m.id;

  return jsonb_build_object(
    'ok', true,
    'application_id', v_m.id,
    'allocation_id', v_seat_id,
    'released_allocation_ids', to_jsonb(v_released));
end $function$;

revoke all on function public.delegation_unplace_member(uuid) from public, anon;
grant execute on function public.delegation_unplace_member(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 15. Short invite links (20 Oct 2026)
--     Today (read live): delegation_invites (id, token text unique default a uuid,
--     society_id, conference_id, created_by, expires_at, created_at), unique on
--     (society_id, conference_id), RLS "Leaders manage their delegation invites"
--     (ALL, is_society_leader(society_id)); 11 rows. create_delegation_invite
--     (leader only) inserts or returns the one invite of the delegation;
--     resolve_delegation_invite(p_token) is callable by anon and authenticated and
--     answers the delegation and conference names. The page is
--     /invites/delegation/[token].
--     New:
--       * delegation_invites.short_code text unique, e.g. westbrook-academy-k7q3mx:
--         a slug of the delegation name (accents folded, lowercase a-z0-9 and
--         single dashes, at most 24 characters, cut at a word end when there is
--         one, 'delegation' when nothing is left) + '-' + 6 random
--         characters from abcdefghjkmnpqrstuvwxyz23456789 (31 characters, no
--         0 / o / 1 / l / i): 31^6 = about 887 million codes per slug, so the slug
--         (guessable from the name) never makes the link guessable. Random bytes
--         come from extensions.gen_random_bytes (pgcrypto) with rejection sampling
--         (bytes 248..255 are skipped), so every character is equally likely.
--         A CHECK keeps the shape, because the existing RLS policy lets a leader
--         UPDATE their own invite row directly.
--       * The code is made once and never changes, so a link already shared keeps
--         working after the delegation is renamed.
--       * delegation_invite_short_code(p_society uuid) returns text: for an
--         accepted leader of the society (is_society_leader) the invite's short
--         code, creating the invite (as create_delegation_invite does) and the code
--         when missing. A collision with an existing code is retried with new
--         random characters. Anyone else gets the P0001 sentence (hint not_leader).
--       * resolve_delegation_short_invite(p_code text) returns text: the invite's
--         full token, or null for an unknown code. Same exposure as
--         resolve_delegation_invite (anon and authenticated): it returns only the
--         token the short code already stands for. Matching ignores case and spaces
--         around the code. An expired invite still answers its token, so the page's
--         existing resolve_delegation_invite / delegation_join_via_invite say
--         "This invite link has expired." as they do today.
--     No money: nothing here reads or writes invoices, payments or applications.
-- -----------------------------------------------------------------------------

alter table public.delegation_invites
  add column if not exists short_code text null;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'delegation_invites_short_code_key') then
    alter table public.delegation_invites
      add constraint delegation_invites_short_code_key unique (short_code);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'delegation_invites_short_code_check') then
    alter table public.delegation_invites
      add constraint delegation_invites_short_code_check
      check (short_code is null
             or (length(short_code) <= 31
                 and short_code ~ '^([a-z0-9]+-)+[abcdefghjkmnpqrstuvwxyz2-9]{6}$'));
  end if;
end $do$;

comment on column public.delegation_invites.short_code is
  'Readable invite code: slug of the delegation name (max 24) + "-" + 6 random characters (no 0/o/1/l/i). Made once by delegation_invite_short_code, resolved by resolve_delegation_short_invite.';

-- The slug part. Immutable, so it can be tested on its own.
create or replace function public._delegation_invite_slug(p_name text)
returns text
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v text := lower(coalesce(p_name, ''));
begin
  v := regexp_replace(v, '[\u0300-\u036f]', '', 'g');  -- combining marks (lower('İ') = 'i' + U+0307)
  v := replace(v, 'ß', 'ss');
  v := translate(v,
    'àáâãäåāăą' || 'çćč' || 'ď' || 'èéêëēėęě' || 'ğ' || 'ìíîïīįı' || 'ł' || 'ñńň' || 'òóôõöøōő' || 'ř' || 'śšş' || 'ţť' || 'ùúûüūůűų' || 'ýÿ' || 'žźż',
    'aaaaaaaaa' || 'ccc' || 'd' || 'eeeeeeee' || 'g' || 'iiiiiii' || 'l' || 'nnn' || 'oooooooo' || 'r' || 'sss' || 'tt' || 'uuuuuuuu' || 'yy' || 'zzz');
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := btrim(v, '-');
  -- At most 24 characters, cut at a word end when there is one.
  if length(v) > 24 then
    v := case when strpos(left(v, 25), '-') > 0
              then btrim(regexp_replace(left(v, 25), '-[^-]*$', ''), '-')
              else left(v, 24) end;
  end if;
  if v = '' then v := 'delegation'; end if;
  return v;
end $function$;

-- Six random characters from the unambiguous alphabet.
create or replace function public._delegation_invite_random6()
returns text
language plpgsql
volatile
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_alpha constant text := 'abcdefghjkmnpqrstuvwxyz23456789';  -- 31, no 0 o 1 l i
  v_out text := '';
  v_bytes bytea;
  v_b int;
  i int;
begin
  while length(v_out) < 6 loop
    v_bytes := extensions.gen_random_bytes(16);
    for i in 0..15 loop
      v_b := get_byte(v_bytes, i);
      if v_b < 248 then                        -- 248 = 31 * 8: no modulo bias
        v_out := v_out || substr(v_alpha, (v_b % 31) + 1, 1);
        exit when length(v_out) = 6;
      end if;
    end loop;
  end loop;
  return v_out;
end $function$;

create or replace function public.delegation_invite_short_code(p_society uuid)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_soc record;
  v_inv record;
  v_slug text;
  v_code text;
  v_try int := 0;
begin
  if v_uid is null then
    raise exception 'Please sign in again.' using errcode = 'P0001', hint = 'signed_out';
  end if;
  if not is_society_leader(p_society) then
    raise exception 'Only a head delegate or faculty advisor of this delegation can share its invite link.'
      using errcode = 'P0001', hint = 'not_leader';
  end if;
  select s.id, s.conference_id, s.name into v_soc from societies s where s.id = p_society;
  if v_soc.id is null then
    raise exception 'We could not find this delegation.' using errcode = 'P0001', hint = 'not_found';
  end if;

  -- The one invite of the delegation, as create_delegation_invite makes it.
  insert into delegation_invites (society_id, conference_id, created_by)
  values (v_soc.id, v_soc.conference_id, v_uid)
  on conflict (society_id, conference_id) do nothing;

  select i.id, i.short_code into v_inv
    from delegation_invites i
   where i.society_id = v_soc.id and i.conference_id = v_soc.conference_id
   for update;
  if v_inv.short_code is not null then
    return v_inv.short_code;
  end if;

  v_slug := public._delegation_invite_slug(v_soc.name);
  loop
    v_try := v_try + 1;
    v_code := v_slug || '-' || public._delegation_invite_random6();
    begin
      update delegation_invites set short_code = v_code
       where id = v_inv.id and short_code is null;
      exit;
    exception when unique_violation then
      if v_try >= 20 then
        raise exception 'We could not make a short link. Try again.' using errcode = 'P0001', hint = 'no_code';
      end if;
    end;
  end loop;

  select i.short_code into v_code from delegation_invites i where i.id = v_inv.id;
  return v_code;
end $function$;

create or replace function public.resolve_delegation_short_invite(p_code text)
returns text
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select i.token
    from delegation_invites i
   where i.short_code = lower(btrim(coalesce(p_code, '')))
   limit 1;
$function$;

revoke all on function public._delegation_invite_slug(text) from public, anon, authenticated;
revoke all on function public._delegation_invite_random6() from public, anon, authenticated;
revoke all on function public.delegation_invite_short_code(uuid) from public, anon;
grant execute on function public.delegation_invite_short_code(uuid) to authenticated;
revoke all on function public.resolve_delegation_short_invite(text) from public;
grant execute on function public.resolve_delegation_short_invite(text) to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 16. delegation_member_details(p_application) (20 Oct 2026)
--     What a leader sees when they open a member: who they are and their answers
--     to the role's application questions.
--     Who: an accepted leader of the member's delegation (is_society_leader) or an
--     organiser of the conference (is_conference_organizer). Anyone else, and an
--     id that does not exist, get the same refusal (no probing for ids).
--     Returns: {ok:true, application_id, name, email, role, status, nationality,
--       society_id, society, answers: [{id, question, type, answer}]}
--       name        profiles.display_name (live), else applications.invited_name
--       email       profiles.email, else applications.invited_email
--       nationality profiles.nationality (null for an imported member with no account)
--       society     the delegation's name
--       answers     the role's custom questions (application_role_configs.custom_questions
--                   of this conference and the member's role), in form order: question
--                   blocks only (kind 'question' or no kind; title and section blocks
--                   skipped), archived questions only when this member answered them,
--                   matched to applications.custom_answers by question id. answer is the
--                   stored value (a string, or an array for checkboxes), null when
--                   unanswered or empty.
--     Never: date of birth (profiles.date_of_birth is not read, and a custom
--     question whose label mentions a birth date is left out, so a typed birth date
--     never shows either), payment data (no payment_status, invoices, fees, aid),
--     the financial aid form (applications.aid_custom_answers is a separate form
--     and is never read), user ids.
-- -----------------------------------------------------------------------------

create or replace function public.delegation_member_details(p_application uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_a record;
  v_answers jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Sign in first.');
  end if;

  select a.id, a.conference_id, a.society_id, a.role, a.status, a.user_id,
         a.invited_name, a.invited_email, a.custom_answers,
         p.display_name, p.email, p.nationality,
         s.name as society_name
    into v_a
    from applications a
    left join profiles p on p.id = a.user_id
    left join societies s on s.id = a.society_id
   where a.id = p_application;

  if v_a.id is null
     or not (is_conference_organizer(v_a.conference_id)
             or (v_a.society_id is not null and is_society_leader(v_a.society_id))) then
    return jsonb_build_object('ok', false, 'code', 'not_leader',
      'error', 'Only a head delegate or faculty advisor of this delegation can see these details.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.e->>'id',
           'question', coalesce(q.e->>'label', ''),
           'type', q.e->>'type',
           'answer', case
                       when ans.v is null or ans.v = 'null'::jsonb then null
                       when jsonb_typeof(ans.v) = 'string' and btrim(ans.v #>> '{}') = '' then null
                       when jsonb_typeof(ans.v) = 'array' and jsonb_array_length(ans.v) = 0 then null
                       else ans.v
                     end)
           order by q.ord), '[]'::jsonb)
    into v_answers
    from application_role_configs rc
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(rc.custom_questions) = 'array' then rc.custom_questions else '[]'::jsonb end
    ) with ordinality as q(e, ord)
    cross join lateral (
      select case when jsonb_typeof(v_a.custom_answers) = 'object'
                  then v_a.custom_answers -> (q.e->>'id') end as v
    ) ans
   where rc.conference_id = v_a.conference_id
     and rc.role = v_a.role
     and coalesce(q.e->>'kind', 'question') = 'question'
     and q.e ? 'id'
     and coalesce(q.e->>'label', '') !~* '(birth|\mdob\M|doğum|nacimiento|naissance|geburt)'
     and (coalesce(q.e->'archived', 'false'::jsonb) <> 'true'::jsonb or ans.v is not null);

  return jsonb_build_object(
    'ok', true,
    'application_id', v_a.id,
    'name', coalesce(nullif(btrim(v_a.display_name), ''), nullif(btrim(v_a.invited_name), '')),
    'email', coalesce(nullif(btrim(v_a.email), ''), nullif(btrim(v_a.invited_email), '')),
    'role', v_a.role,
    'status', v_a.status,
    'nationality', v_a.nationality,
    'society_id', v_a.society_id,
    'society', v_a.society_name,
    'answers', coalesce(v_answers, '[]'::jsonb));
end $function$;

revoke all on function public.delegation_member_details(uuid) from public, anon;
grant execute on function public.delegation_member_details(uuid) to authenticated;

commit;


-- =============================================================================
-- CLIENT CONTRACT
-- Every jsonb RPC answers {ok:true, ...} or {ok:false, code, error}. `error` is a
-- plain sentence safe to show (v2.ts call() already reads it). Table RPCs answer
-- rows, or raise P0001 with a plain sentence and the code in `hint`.
--
-- WHO CALLS: delegation_place_member and delegation_unplace_member accept a leader of
-- the member's delegation (is_society_leader: an accepted head delegate or faculty
-- advisor) OR an organiser of the conference (is_conference_organizer, the
-- permission the applications page's writes rely on: RLS "Organizers update
-- applications"). So the organiser's delegation pop-up calls the same two RPCs.
-- Organisers obey the same rules (faculty advisors never seated), except that they
-- are never held by the reshuffle switch or deadline. A refusal for anyone else is
-- code not_leader.
--
-- NOT HERE (Christian's chat builds them; docs/conferences/delegations-requests-for-christian.md):
--   role moves between delegate and faculty advisor (organisers only), removing a
--   member from a delegation, and any money. Delegate <-> head delegate stays on
--   the live delegation_set_head. Money on the leader card reads my_pay_overview.
--
-- my_delegation_open_seats(p_society uuid)                         -> setof rows
--   allocation_id is the conference_allocations.id to pass as p_allocation to
--   delegation_place_member.
--   {allocation_id, conference_committee_id, committee, abbreviation, logo_url
--    (committee logo), country_code, country_name, country_logo_url (custom crest
--    from committee_country_slots), seat smallint, delegation_size int}
--   ordered by committee, country, seat. v2.ts: map `seat` with String(r.seat).
--   raises (hint): signed_out, not_found, not_member
--
-- delegation_place_member(p_application uuid, p_allocation uuid)   -> jsonb
--   ok: {ok, application_id, allocation_id, released_allocation_id uuid|null}
--       or {ok:true, unchanged:true, ...} when they already sit there
--   codes: signed_out, seat_not_found, not_block_seat, not_leader, not_member,
--          not_seatable, not_accepted, seat_taken, reshuffle_off, reshuffle_closed
--   Both touched seats go back to allocation_sent = false (organiser republishes).
--
-- delegation_unplace_member(p_application uuid)                  -> jsonb
--   A leader of the member's delegation or an organiser. Takes a delegate or head
--   delegate out of their seat; they stay in the delegation.
--   ok: {ok, application_id, allocation_id, released_allocation_ids uuid[]}
--       or {ok:true, unchanged:true, allocation_id:null} when they hold no seat
--   codes: signed_out, not_member, not_leader, reshuffle_off, reshuffle_closed
--   The seat becomes an Open seat of the delegation (allocation_sent = false);
--   the application's assigned_* clear and 'assigned' goes back to 'accepted'.
--   Re-read my_delegation_roster, my_delegation_open_seats and my_delegation_seats.
--
-- organiser_give_society_seats(p_society uuid, p_seats jsonb)      -> jsonb
--   p_seats: [{conference_committee_id: uuid, country_code: text, seat: 1|2}] (1..200;
--            seat defaults to 1). All or nothing.
--   ok: {ok, created int, allocation_ids uuid[]}
--   codes: signed_out, not_found, not_organiser, no_seats, too_many, bad_seat,
--          duplicate_seat, not_a_committee, not_a_seat, seat_taken,
--          seat_limit (+ allowed_more, limit, seats_now, limit_kind 'paid'|'expected')
--
-- organiser_take_back_society_seat(p_allocation uuid)              -> jsonb
--   ok: {ok, allocation_id, society_id}
--   codes: signed_out, not_found, not_organiser, not_block_seat, seat_filled
--
-- my_committee_roster(p_conference_committee uuid)                 -> setof rows
--   {country_code, country_name, seat smallint, delegate_name text|null,
--    society_name text|null, is_mine boolean}, sent seats only, ordered by country, seat
--   raises (hint): signed_out, not_found, not_allowed
--
-- delegation_submit_member_paper(p_application uuid, p_file_url text,
--                                p_file_name text, p_file_size integer) -> jsonb
--   Upload first to position-papers/<conference>/<committee>/<member user id>_<epoch>.pdf
--   (the bucket's limit is 5 MB; v2.ts PAPER_MAX_BYTES says 10 MB), then call this.
--   ok: {ok, paper_id, replaced boolean, old_file_url text|null}
--   codes: signed_out, not_member, not_leader, no_account, not_seatable, no_seat, bad_file
--   v2.ts uploadPaperForMember's direct insert also works for a FIRST paper (new
--   INSERT policy); a second upload needs this RPC (a direct insert hits the unique
--   (committee, user) index). Leaders read member rows directly from position_papers
--   (new SELECT policy) and signed URLs from storage (new SELECT policy).
--
-- my_delegation_seats(p_society uuid)                              -> setof rows
--   Any member of the delegation, or an organiser.
--   {application_id, display_name, role, is_me, conference_committee_id, committee,
--    abbreviation, logo_url (committee logo), country_code, country_name,
--    seat smallint, allocation_sent}
--   One row per delegate / head delegate / faculty advisor, roster order. Seat
--   columns null when unseated, or (non-leaders) while the seat is unpublished.
--   raises (hint): signed_out, not_found, not_member
--
-- Study guides (no new RPC): read study_guides by conference_committee_id as today
--   (useCommitteeGuides.ts). A new SELECT policy also shows an accepted member the
--   released guides of every committee their delegation sits in (published seats
--   for non-leaders). Same release test as the seated delegate's.
--
-- my_committee_chairs(p_conference_committee uuid)                 -> setof rows
--   {display_name}, the chair accounts in stored order, unnamed chairs left out.
--   Anyone seated in the committee, a leader of a delegation with a member or an
--   Open seat in it, or an organiser.
--   raises (hint): signed_out, not_found, not_allowed
--
-- delegation_invite_short_code(p_society uuid)                    -> text
--   An accepted leader of the delegation (is_society_leader). The delegation's
--   short invite code, e.g. 'westbrook-academy-k7q3mx', made (with the invite
--   itself) on the first call and never changed after, so a shared link survives a
--   rename. The client builds the short link around it (gavelling.com/i/<code>,
--   src/app/i/[code]), which resolves the code to the token and opens
--   /invites/delegation/<token>.
--   raises (hint): signed_out, not_leader, not_found, no_code
--
-- resolve_delegation_short_invite(p_code text)                     -> text | null
--   anon and authenticated. The invite's full token, or null (show "This invite
--   link is not valid."). Case and surrounding spaces ignored. Then call
--   resolve_delegation_invite / delegation_join_via_invite with the token as today
--   (they report an expired invite).
--
-- delegation_member_details(p_application uuid)                    -> jsonb
--   An accepted leader of the member's delegation, or an organiser.
--   ok: {ok, application_id, name text|null, email text|null, role, status,
--        nationality text|null, society_id uuid|null, society text|null,
--        answers: [{id, question, type, answer}]}
--       answers follow the role's form order; answer is a string, a string[]
--       (checkboxes) or null (unanswered). Title / section blocks, the aid form and
--       any question about a birth date are left out.
--   codes: signed_out, not_leader (also for an unknown id)
--   Never a date of birth, payment data or a user id.
--
-- conferences.delegation_seat_limit 'none'|'paid'|'expected' (default 'none'),
-- conferences.delegation_reshuffle_until timestamptz|null: plain columns, written by
-- the Settings page like allocation_swap_mode. Add CONSTRAINT_MESSAGES sentence for
-- conferences_delegation_seat_limit_check.
-- =============================================================================
