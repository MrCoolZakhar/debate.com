-- =============================================================================
-- scratch-delegations-part1-people-and-seats.sql
-- DRAFT, NOT APPLIED. The owners apply it through the chat's Supabase work.
-- Part 1 of 2 of the delegations rebuild (was scratch-delegations-rebuild.sql,
-- sections 1, 0, 2 to 8, 11 to 13, function bodies copied verbatim, plus the new
-- section 14). Part 2 (scratch-delegations-part2-money-and-wording.sql) holds the
-- money read and the wording and waits for Christian.
--
-- SAFE TO APPLY BEFORE CHRISTIAN ANSWERS. Every DECISION NEEDED block below is a
-- comment; the drafted code already takes the cautious option. What each default
-- does, in plain words:
--   E (section 0, expected size): "Up to expected size" counts the tickets leaders
--     set plus members who paid their own ticket or were waived (E1).
--   A (section 2, a paid ticket and a role change): nothing changes; a ticket paid at
--     the old role's price counts as paid (A2), no difference line, no refund.
--   B (section 2, older pool coverage): a person the delegation covered stays
--     covered whatever their new role (B2).
--   C (sections 2 and 3, a leader holding the delegation's tickets): refused with
--     code holds_tickets; they stay a leader until the organiser moves the tickets (C1).
--   D (section 2, Advisor Tickets): they never cover anyone automatically, so a
--     delegate moved to faculty advisor owes the advisor fee (D2).
--
-- Written 19 Oct 2026 (section 14 on 20 Oct 2026) against the live schema of
-- luruhkwrgisytejswlas, read only. Decisions: docs/conferences/delegations.md.
-- Map: CLAUDE.md. Client flag: DELEGATIONS_V2_DB (both v2.ts files), flipped once
-- this part is applied.
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
--   * Application writes set app.trusted_write (guard_application_write) and, on a
--     role change, app.delegation_role_move (applications_credit_gate then takes no
--     second credit: every charged role costs exactly 1 credit, so a move is free).
--   * Grants: revoke from public and anon, grant execute to authenticated (as
--     delegation_set_head). Internal helpers are granted to nobody.
--
-- DECISION NEEDED (Christian) blocks are comments. Nothing inside them runs.
-- Search this file for "DECISION NEEDED".
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
-- 0. Internal helpers (used by sections 2 to 6). Not callable by clients.
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
--     of its active leaders, status settled), plus
--   * delegates and head delegates who paid their own ticket (self_paid) or whose
--     fee the organiser waived. A member covered by a delegation ticket is NOT
--     counted again (payment_status stays unpaid under fin_pledge_covers, or is
--     'paid' with self_paid false under the older pool, both excluded).
-- A free registration is 'paid' + self_paid (applications_mark_free_as_paid), so on
-- a free conference every member counts.
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
       and l.status not in ('rejected', 'withdrawn')
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

-- Expected size of a delegation (what the UI used to call "pledged").
-- DECISION NEEDED (Christian): what "Up to expected size" counts.
--   Today the number leaders set is applications.spots_pledged on their own
--   application, and every unit of it is a Delegate Ticket invoice they owe
--   (sync_participant_invoices). Members who pay their own ticket are NOT in it
--   (pledge_covered_application_ids skips them). So a delegation whose 10 members
--   all pay for themselves has an expected size of 0.
--   Option E1 (drafted below): tickets set by leaders + members who paid their own
--     ticket or were waived. "Expected" then is never smaller than "paid".
--   Option E2: tickets set by leaders only (sum of spots_pledged). Simpler, but a
--     self-paying delegation could be given no seats under "Up to expected size".
create or replace function public._society_expected_size(p_society uuid)
returns integer
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((
    select sum(coalesce(l.spots_pledged, 0)) from applications l
     where l.society_id = p_society
       and l.role in ('faculty-advisor', 'head-delegate')
       and l.status not in ('rejected', 'withdrawn')
  ), 0)::int + (
    select count(*) from applications a
     where a.society_id = p_society
       and a.role in ('delegate', 'head-delegate')
       and a.status not in ('rejected', 'withdrawn')
       and (a.payment_status = 'waived' or (a.payment_status = 'paid' and a.self_paid))
  )::int;
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

-- Reprices a person's OWN open, unpaid ticket to their current role, exactly as the
-- "not covered" branch of sync_participant_invoices does, then re-runs their aid
-- pool and the ticket names. Needed because sync_participant_invoices returns
-- silently unless the caller is the applicant or an organiser, so a leader acting on
-- a member never reaches it (the member's /pay page would fix it on their next visit,
-- Financials would show the old price until then). Paid, partly paid, proof-pending
-- and price-locked tickets are never touched (invoice_price_locked).
create or replace function public._delegation_reprice_own_ticket(p_application uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  update invoices i
     set amount_cents = public.role_fee_net_minor(p_application),
         label = case when i.label in ('Covered by delegation', 'Fee waived', 'Covered by your delegation') then null else i.label end,
         updated_at = now()
   where i.application_id = p_application
     and i.kind = 'role_fee'
     and i.status = 'open'
     and coalesce(i.amount_paid_cents, 0) = 0
     and not public.invoice_price_locked(i.id);
  perform public.apply_aid_pool(p_application);
  perform public.renumber_pledge_spot_labels(p_application);
end $function$;

revoke all on function public._delegation_leader_count(uuid, uuid) from public, anon, authenticated;
revoke all on function public._society_paid_delegate_spots(uuid) from public, anon, authenticated;
revoke all on function public._society_expected_size(uuid) from public, anon, authenticated;
revoke all on function public._society_seat_count(uuid) from public, anon, authenticated;
revoke all on function public._delegation_release_seat(uuid, uuid) from public, anon, authenticated;
revoke all on function public._delegation_reprice_own_ticket(uuid) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. delegation_set_role(p_application, p_role)
--    Any leader of the member's delegation, or an organiser of the conference (the
--    delegation pop-up; same permission as the applications page's writes, RLS
--    "Organizers update applications" = is_conference_organizer), moves them between
--    delegate, head-delegate and faculty-advisor, in any direction. Every rule below
--    holds for organisers too (the last leader stays, tickets stay with a leader). Replaces the old owner
--    rule "delegate and faculty advisor never swap" (CLAUDE.md Owner Decisions
--    still says it; the owners update that line).
--    delegation_set_head and delegation_promote_to_advisor stay as they are (the
--    client calls delegation_set_head today); this supersedes both.
--
--    What it does
--      * Never leaves the delegation with no leader with an account.
--      * A new leader needs an account (as delegation_set_head).
--      * Faculty advisor only when the conference takes advisors (as
--        delegation_promote_to_advisor).
--      * Refuses when the person already holds another application of the new role
--        at this conference (unique conference_id, user_id, role).
--      * To faculty advisor: their seat becomes a block seat of the delegation
--        (committee, country and seat kept, person cleared), their assigned_*
--        fields clear and 'assigned' drops back to 'accepted'.
--      * Credits: none taken (app.delegation_role_move).
--      * Money, automatic through existing triggers on the role UPDATE:
--          zz_applications_pledge_coverage -> apply_pledge_coverage_society
--            - delegate -> advisor: they leave the set the delegation's Delegate
--              Tickets cover (pledge_covered_application_ids), so the ticket that
--              covered them now covers the next uncovered member, or sits free.
--              Their "Covered by your delegation" ticket reopens at the ADVISOR
--              price (role_fee_net_minor reads the new role). = "they owe the
--              faculty advisor fee if they have not paid it".
--            - advisor -> delegate: if a Delegate Ticket is free they are covered
--              (and _apply_pledge_cover_to_app queues its existing "Your delegation
--              covers your ticket" email: an existing trigger side effect).
--          zz_app_role_switched (delegate <-> head delegate only): unchanged.
--      * Money, done here: their own OPEN, UNPAID ticket is repriced to the new role
--        (_delegation_reprice_own_ticket). = "advisor to delegate: they owe a
--        delegate fee unless covered".
-- -----------------------------------------------------------------------------

-- DECISION NEEDED (Christian): money cases this function does NOT decide.
--
-- (A) A person who already PAID their own ticket at the old role's price (role_fee
--     settled / partial / price locked) moves delegate <-> faculty advisor.
--     zz_app_role_switched only fires for delegate <-> head-delegate.
--     A1. Extend it to all three roles, so a dearer role gets a "<Role> Ticket
--         difference" surcharge line and a cheaper role a refund_due money_todo,
--         exactly as today for delegate <-> head delegate. The function body already
--         handles any role; only the trigger's WHEN changes:
--           drop trigger if exists zz_app_role_switched on public.applications;
--           create trigger zz_app_role_switched after update of role on public.applications
--             for each row when (old.role is distinct from new.role
--               and old.role = any (array['delegate','head-delegate','faculty-advisor'])
--               and new.role = any (array['delegate','head-delegate','faculty-advisor']))
--             execute function _app_role_switched();
--         (still gated by store flag fin_role_switch_diff)
--     A2. A paid ticket of any of the three roles counts as paid; nothing changes.
--
-- (B) The OLDER pool coverage: settle_invoice_effects / cover_pledge_spot mark a
--     member payment_status 'paid', self_paid false when a ticket is settled.
--     apply_pledge_coverage_society treats such a member as covered_other and leaves
--     them alone, so after delegate -> advisor they stay "paid" and owe nothing.
--     B1. Mirror the organiser's removeFromDelegation (assignment/delegationShared.ts):
--         set payment_status 'unpaid' when paid and not self_paid, then
--         _delegation_reprice_own_ticket, so they owe the advisor fee; the pool spot
--         stays with the delegation (counted in societies.spots_purchased).
--           update applications set payment_status = 'unpaid' where id = v_to.id
--             and payment_status = 'paid' and self_paid is not true;
--     B2. Leave it: a covered person stays covered whatever their role.
--     Same question in reverse for an advisor covered by an Advisor Ticket who
--     becomes a delegate.
--
-- (C) A leader who holds the delegation's tickets (spots_pledged > 0 or
--     advisors_pledged > 0) becomes a delegate, or is removed (section 3).
--     Those tickets, their invoices and payments hang on the leader's application,
--     and pledge_covered_application_ids only sums spots_pledged of LEADERS, so the
--     delegation's coverage would silently drop.
--     C1. (drafted) Refuse with code holds_tickets until the tickets are moved.
--     C2. A new function that moves spots_pledged / advisors_pledged and their open
--         and paid pledge_spot / advisor_spot invoices to another leader of the same
--         delegation, in one transaction (Christian's design: receipts, refunds and
--         the ticket numbering all key on application_id).
--     C3. Allow it and let the tickets stay on a non-leader application (needs
--         pledge_covered_application_ids and sync_participant_invoices to count
--         them for any role).
--
-- (D) Advisor Tickets (advisors_pledged / advisor_spot) never cover anyone
--     automatically under fin_pledge_covers (only Delegate Tickets do, through
--     pledge_covered_application_ids). So a delegate moved to faculty advisor
--     always owes the advisor fee even when the delegation bought Advisor Tickets.
--     D1. Add an advisor twin of pledge_covered_application_ids / coverage.
--     D2. Keep: advisor tickets are only for the advisors a faculty advisor brings
--         (CLAUDE.md: "advisors_pledged counts only the advisors coming with a
--         faculty advisor; their own ticket is their role fee").

create or replace function public.delegation_set_role(p_application uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_to record;
  v_enabled boolean;
  v_was_leader boolean;
  v_will_lead boolean;
  v_seat text;
  v_released uuid[] := '{}'::uuid[];
  v_name text;
  v_is_org boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Sign in first.');
  end if;
  if p_role is null or p_role not in ('delegate', 'head-delegate', 'faculty-advisor') then
    return jsonb_build_object('ok', false, 'code', 'bad_role', 'error', 'Choose delegate, head delegate or faculty advisor.');
  end if;

  select a.id, a.user_id, a.role, a.status, a.conference_id, a.society_id,
         coalesce(a.spots_pledged, 0) as spots, coalesce(a.advisors_pledged, 0) as adv_spots
    into v_to
    from applications a
   where a.id = p_application
   for update;
  if v_to.id is null or v_to.society_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_member', 'error', 'That person is not in a delegation.');
  end if;
  -- Leaders of the delegation, or an organiser of the conference (the same test the
  -- applications page's writes rely on: RLS "Organizers update applications" =
  -- is_conference_organizer(conference_id)).
  v_is_org := is_conference_organizer(v_to.conference_id);
  if not (v_is_org or is_society_leader(v_to.society_id)) then
    return jsonb_build_object('ok', false, 'code', 'not_leader', 'error', 'Only a head delegate or faculty advisor of this delegation, or the organiser, can change roles.');
  end if;

  -- One leadership change per delegation at a time: two leaders demoting each other
  -- at the same moment can never leave it with none.
  perform 1 from societies where id = v_to.society_id for update;

  if v_to.role not in ('delegate', 'head-delegate', 'faculty-advisor') then
    return jsonb_build_object('ok', false, 'code', 'other_role', 'error', 'This person''s role cannot be changed here. Ask the organiser.');
  end if;
  if v_to.status not in ('accepted', 'assigned', 'checked-in') then
    return jsonb_build_object('ok', false, 'code', 'not_accepted', 'error', 'The organiser has to accept this application first.');
  end if;
  if v_to.role = p_role then
    return jsonb_build_object('ok', false, 'code', 'same_role', 'error', 'They already have this role.');
  end if;

  v_was_leader := v_to.role in ('head-delegate', 'faculty-advisor');
  v_will_lead := p_role in ('head-delegate', 'faculty-advisor');

  if v_will_lead and v_to.user_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_account', 'error', 'This person has not created their account yet. They need one before they can lead.');
  end if;

  if p_role = 'faculty-advisor' then
    select coalesce(rc.is_enabled, false) into v_enabled
      from application_role_configs rc
     where rc.conference_id = v_to.conference_id and rc.role = 'faculty-advisor';
    if not coalesce(v_enabled, false) then
      return jsonb_build_object('ok', false, 'code', 'advisor_closed', 'error', 'This conference does not take faculty advisors. Ask the organiser to open the role first.');
    end if;
  end if;

  if v_was_leader and not v_will_lead then
    if public._delegation_leader_count(v_to.society_id, v_to.id) = 0 then
      return jsonb_build_object('ok', false, 'code', 'last_leader', 'error', 'A delegation needs at least one head delegate or faculty advisor. Make someone else a leader first.');
    end if;
    -- DECISION NEEDED (Christian) (C): C1 drafted.
    if v_to.spots > 0 or v_to.adv_spots > 0 then
      return jsonb_build_object('ok', false, 'code', 'holds_tickets', 'error', 'This leader holds the delegation''s tickets, so they stay a leader for now. Ask the organiser to move the tickets first.');
    end if;
  end if;

  if v_to.user_id is not null and exists (
    select 1 from applications o
     where o.conference_id = v_to.conference_id and o.user_id = v_to.user_id
       and o.role = p_role and o.id <> v_to.id) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_role', 'error', 'This person already has another ' || replace(p_role, '-', ' ') || ' application at this conference. Ask the organiser to sort it out first.');
  end if;

  perform set_config('app.trusted_write', 'on', true);
  perform set_config('app.delegation_role_move', 'on', true);

  -- A faculty advisor never sits in a committee: the seat stays with the delegation.
  if p_role = 'faculty-advisor' then
    select coalesce(cc.abbreviation, cc.name) || ' (' || ca.country_name || ')' into v_seat
      from conference_allocations ca
      join conference_committees cc on cc.id = ca.conference_committee_id
     where ca.conference_id = v_to.conference_id
       and (ca.application_id = v_to.id or (v_to.user_id is not null and ca.user_id = v_to.user_id))
     limit 1;
    v_released := public._delegation_release_seat(v_to.id, v_to.society_id);
  end if;

  update applications
     set role = p_role,
         is_head_delegate = (p_role = 'head-delegate'),
         assigned_committee_id = case when p_role = 'faculty-advisor' then null else assigned_committee_id end,
         assigned_country_code = case when p_role = 'faculty-advisor' then null else assigned_country_code end,
         assigned_country_name = case when p_role = 'faculty-advisor' then null else assigned_country_name end,
         status = case when p_role = 'faculty-advisor' and status = 'assigned' then 'accepted' else status end
   where id = v_to.id;

  -- Their own open, unpaid ticket now costs what the new role costs.
  perform public._delegation_reprice_own_ticket(v_to.id);

  select coalesce(nullif(btrim(display_name), ''), 'them') into v_name from profiles where id = v_to.user_id;
  return jsonb_build_object(
    'ok', true,
    'application_id', v_to.id,
    'role', p_role,
    'name', coalesce(v_name, 'them'),
    'released_seat', v_seat,
    'released_allocation_ids', to_jsonb(v_released),
    'by_organiser', v_is_org and not is_society_leader(v_to.society_id),
    'self', v_to.user_id = v_uid);
end $function$;

revoke all on function public.delegation_set_role(uuid, text) from public, anon;
grant execute on function public.delegation_set_role(uuid, text) to authenticated;


-- -----------------------------------------------------------------------------
-- 3. delegation_remove_member(p_application)
--    Any leader, or an organiser of the conference (is_conference_organizer, as the
--    applications page's writes), removes a member (another leader or an advisor
--    included), never the last leader. The organiser's older Assignment path
--    (removeFromDelegation) can then be moved onto this RPC. The person LEAVES THE DELEGATION AND STAYS AN APPLICANT of the
--    conference: society_id null, is_independent true, status unchanged.
--    Why not the withdraw path: withdrawing refunds their Gavelling credit
--    (applications_credit_gate), voids their open invoices
--    (zz_void_closed_application_invoices) and ends their application. The owner's
--    rule is "money stays with whoever paid it", and the organiser's existing
--    "Remove from delegation" (assignment/delegationShared.ts removeFromDelegation)
--    also keeps them as an applicant. This mirrors that function, in the database.
--
--    Seat: every seat they hold becomes a block seat of the delegation (Open).
--    Money (no refund here):
--      * Paid their own ticket (self_paid): it stays with them. As the organiser
--        path does, the delegation's legacy pool counter (spots_purchased, or
--        advisor_spots_purchased for an advisor) drops by 1, because
--        settle_invoice_effects added 1 when they paid.
--      * Covered by the delegation under the older pool (paid, not self_paid): the
--        place stays with the delegation, they become 'unpaid' (organiser path's
--        dropToUnpaid).
--      * Covered by a Delegate Ticket (fin_pledge_covers, "Covered by your
--        delegation" waived ticket): the ticket stays with the delegation and covers
--        the next member (the coverage trigger re-runs for the old delegation); their
--        own ticket reopens at their role's price, as apply_pledge_coverage_society
--        does for anyone no longer covered.
--      * A per-delegation Registration Fee invoice hanging on a removed leader is
--        voided by the existing _app_society_changed trigger when unpaid.
--    Email: none from here. The organiser path queues the 'removed_from_delegation'
--    event from the client (queueEventEmail); whether a leader's removal sends it is
--    for the client prompt, never a direct email_outbox insert.
--    DECISION NEEDED (Christian) (C) applies: a leader holding tickets is refused.
-- -----------------------------------------------------------------------------

create or replace function public.delegation_remove_member(p_application uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_m record;
  v_society uuid;
  v_is_leader boolean;
  v_released uuid[] := '{}'::uuid[];
  v_pool text;
  v_money text;
  v_name text;
  v_is_org boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Sign in first.');
  end if;

  select a.id, a.user_id, a.role, a.status, a.conference_id, a.society_id,
         a.payment_status, a.self_paid, a.invited_name,
         coalesce(a.spots_pledged, 0) as spots, coalesce(a.advisors_pledged, 0) as adv_spots
    into v_m
    from applications a
   where a.id = p_application
   for update;
  if v_m.id is null or v_m.society_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_member', 'error', 'That person is not in a delegation.');
  end if;
  v_society := v_m.society_id;
  v_is_org := is_conference_organizer(v_m.conference_id);
  if not (v_is_org or is_society_leader(v_society)) then
    return jsonb_build_object('ok', false, 'code', 'not_leader', 'error', 'Only a head delegate or faculty advisor of this delegation, or the organiser, can remove people.');
  end if;

  perform 1 from societies where id = v_society for update;

  v_is_leader := v_m.role in ('head-delegate', 'faculty-advisor')
                 and v_m.status in ('accepted', 'assigned', 'checked-in')
                 and v_m.user_id is not null;
  if v_is_leader and public._delegation_leader_count(v_society, v_m.id) = 0 then
    return jsonb_build_object('ok', false, 'code', 'last_leader', 'error', 'A delegation needs at least one head delegate or faculty advisor. Make someone else a leader first.');
  end if;
  -- DECISION NEEDED (Christian) (C): C1 drafted.
  if v_m.spots > 0 or v_m.adv_spots > 0 then
    return jsonb_build_object('ok', false, 'code', 'holds_tickets', 'error', 'This leader holds the delegation''s tickets, so they cannot be removed yet. Ask the organiser to move the tickets first.');
  end if;

  perform set_config('app.trusted_write', 'on', true);

  -- Their seat goes back to the delegation as an Open seat.
  v_released := public._delegation_release_seat(v_m.id, v_society);

  -- Money stays with whoever paid it (mirrors removeFromDelegation / releasePoolSpot).
  if v_m.payment_status = 'paid' and coalesce(v_m.self_paid, false) then
    v_pool := case when v_m.role = 'faculty-advisor' then 'advisor_spots_purchased' else 'spots_purchased' end;
    execute format('update societies set %I = greatest(0, coalesce(%I, 0) - 1) where id = $1', v_pool, v_pool) using v_society;
    v_money := 'kept_by_member';
  elsif v_m.payment_status = 'paid' then
    v_money := 'kept_by_delegation';
  elsif v_m.payment_status = 'waived' then
    v_money := 'waived';
  else
    v_money := 'unpaid';
  end if;

  update applications
     set society_id = null,
         is_independent = true,
         payment_status = case when payment_status = 'paid' and self_paid is not true then 'unpaid' else payment_status end,
         assigned_committee_id = null,
         assigned_country_code = null,
         assigned_country_name = null,
         status = case when status = 'assigned' then 'accepted' else status end
   where id = v_m.id;

  -- A ticket the delegation covered reopens for them at their role's price.
  update invoices i
     set amount_cents = public.role_fee_net_minor(v_m.id), status = 'open', label = null, updated_at = now()
   where i.application_id = v_m.id
     and i.kind = 'role_fee'
     and i.status = 'waived'
     and i.label in ('Covered by your delegation', 'Covered by delegation')
     and coalesce(i.amount_paid_cents, 0) = 0
     and not public.invoice_price_locked(i.id);
  perform public._delegation_reprice_own_ticket(v_m.id);

  select coalesce(nullif(btrim(p.display_name), ''), v_m.invited_name, 'them') into v_name
    from profiles p where p.id = v_m.user_id;
  return jsonb_build_object(
    'ok', true,
    'application_id', v_m.id,
    'name', coalesce(v_name, v_m.invited_name, 'them'),
    'released_allocation_ids', to_jsonb(v_released),
    'money', v_money,
    'by_organiser', v_is_org and not is_society_leader(v_society),
    'self', v_m.user_id = v_uid);
end $function$;

revoke all on function public.delegation_remove_member(uuid) from public, anon;
grant execute on function public.delegation_remove_member(uuid) to authenticated;


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
--         _delegation_release_seat exactly as delegation_remove_member does.
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

commit;


-- =============================================================================
-- CLIENT CONTRACT
-- Every jsonb RPC answers {ok:true, ...} or {ok:false, code, error}. `error` is a
-- plain sentence safe to show (v2.ts call() already reads it). Table RPCs answer
-- rows, or raise P0001 with a plain sentence and the code in `hint`.
--
-- WHO CALLS: delegation_set_role, delegation_remove_member,
-- delegation_place_member and delegation_unplace_member accept a leader of the member's delegation OR an organiser
-- of the conference (is_conference_organizer, the permission the applications page's
-- writes rely on: RLS "Organizers update applications"). So the organiser's
-- delegation pop-up calls the same four RPCs. Organisers obey the same rules (last
-- leader, tickets, faculty advisors never seated), except that place_member and
-- unplace_member never apply the reshuffle switch or deadline to an organiser.
-- A refusal for anyone else
-- is code not_leader. set_role and remove_member answer by_organiser: true when the
-- caller acted as organiser only.
--
-- delegation_set_role(p_application uuid, p_role text)            -> jsonb
--   p_role: 'delegate' | 'head-delegate' | 'faculty-advisor'
--   ok: {ok, application_id, role, name, released_seat text|null,
--        released_allocation_ids uuid[], by_organiser boolean, self boolean}
--   codes: signed_out, bad_role, not_member, not_leader, other_role, not_accepted,
--          same_role, no_account, advisor_closed, last_leader, holds_tickets,
--          duplicate_role
--   Side effects: seat -> Open seat when moved to faculty advisor; own open unpaid
--   ticket repriced; delegation ticket coverage re-runs (may queue the existing
--   "Your delegation covers your ticket" email from _apply_pledge_cover_to_app).
--   Re-read my_delegation_roster, my_delegation_open_seats and my_pay_overview.
--
-- delegation_remove_member(p_application uuid)                     -> jsonb
--   ok: {ok, application_id, name, released_allocation_ids uuid[],
--        money: 'kept_by_member'|'kept_by_delegation'|'waived'|'unpaid',
--        by_organiser boolean, self boolean}
--   codes: signed_out, not_member, not_leader, last_leader, holds_tickets
--   The person stays an applicant of the conference (independent). No email is sent.
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
-- conferences.delegation_seat_limit 'none'|'paid'|'expected' (default 'none'),
-- conferences.delegation_reshuffle_until timestamptz|null: plain columns, written by
-- the Settings page like allocation_swap_mode. Add CONSTRAINT_MESSAGES sentence for
-- conferences_delegation_seat_limit_check.
-- =============================================================================
