-- =============================================================================
-- scratch-delegations-remove-member.sql
-- FOR CHRISTIAN'S CHAT. DRAFT, NOT APPLIED. Peter's delegations rebuild asks
-- Christian's chat to read, test and apply this (request (b) in
-- docs/conferences/delegations-requests-for-christian.md). Written 20 Oct 2026
-- against the live schema of luruhkwrgisytejswlas, read only.
--
-- Depends on scratch-delegations-part1-people-and-seats.sql being applied first:
-- both functions call part 1's _delegation_leader_count, and
-- delegation_remove_member calls its _delegation_release_seat.
--
-- WHAT THIS FUNCTION WRITES ITSELF (and nothing else)
--   * conference_allocations: the member's seat becomes an Open seat of the
--     delegation (_delegation_release_seat: person cleared, committee, country and
--     seat kept, society_id set, allocation_sent false).
--   * applications: society_id -> null, assigned_committee_id /
--     assigned_country_code / assigned_country_name -> null, status 'assigned' ->
--     'accepted' (any other status is kept). role, is_head_delegate, payment_status,
--     self_paid, spots_pledged and advisors_pledged are NOT written.
--   It writes NO invoice, NO payment, NO payment_status and NO coverage, and calls
--   none of the functions on the do-not-move list. Money moves only through the
--   existing triggers that fire when society_id (and status) change, listed below
--   exactly as read live on 20 Oct 2026, so Christian can check them.
--
-- MONEY THAT HAPPENS THROUGH THE LIVE TRIGGERS (the one UPDATE of applications)
--   1. zz_app_society_changed -> _app_society_changed (AFTER UPDATE OF society_id,
--      when it changed; store flag fin_society_switch, ON). Voids the member's OWN
--      per-delegation registration fee: invoices of this application with kind
--      'app_fee', status open or partial, amount_paid_cents 0, whose config is an
--      application_surcharges row with applies_to = 'per_delegation', and no
--      succeeded or pending payment. void_reason 'society_changed'. Anything with
--      money on it stays.
--   2. zz_applications_pledge_coverage -> _applications_pledge_coverage (AFTER
--      UPDATE OF status, role, society_id, ...; flag fin_pledge_covers, ON). Fires
--      ONCE for the row. Calls apply_pledge_coverage_society(new.society_id), which
--      returns 0 for null, then apply_pledge_coverage_society(old society). That
--      re-runs coverage over the members STILL in the delegation only:
--        * The delegation ticket the removed member used (pledge_covered_application_ids,
--          earliest joiners first) now covers the next uncovered member: their
--          open role_fee goes to 0, status 'waived', label 'Covered by your
--          delegation', and _apply_pledge_cover_to_app inserts ONE email_outbox row
--          ("Your delegation covers your ticket at ...") unless app.quiet_coverage
--          is on.
--        * GAP FOR CHRISTIAN: the REMOVED member's own role_fee invoice, if it was
--          waived as 'Covered by your delegation', is NOT reopened. The loop only
--          visits applications whose society_id is still the old delegation, and
--          the call for the new society (null) does nothing. So after a removal one
--          delegation ticket covers two people: the removed member keeps a free
--          ticket and the next member is covered too. The owners' rule
--          (docs/conferences/delegations.md, "Removing someone") is that money paid
--          by the delegation stays with the delegation, so the removed member
--          should owe their own fee again (the reopen branch of
--          apply_pledge_coverage_society: amount role_fee_net_minor, status open,
--          label null). That is your function; we did not change it. Options: a
--          step after the update that reopens it (an internal helper of yours), or
--          apply_pledge_coverage_society also reopening a 'Covered by your
--          delegation' role_fee of an application with society_id null.
--        * A member who paid their own ticket (self_paid, paid role_fee) keeps it;
--          nothing moves. Matches "paid by the delegate, it stays with the
--          delegate".
--   3. zz_audit_applications -> _audit_applications: one money_audit row
--      (action 'application_money_changed', old and new society_id and status).
--   4. applications_credit_gate (AFTER UPDATE OF status, role): status moves
--      between live states only ('assigned' -> 'accepted') and role is unchanged,
--      so it returns without consuming or refunding a credit.
--   5. zz_void_closed_application_invoices: status never becomes rejected or
--      withdrawn here, so nothing.
--   6. NOT triggered: an independent's own registration fee (fin_independent_reg_fee)
--      is created by sync_participant_invoices, which this function does not call.
--      If a removed member should now owe an independent registration fee, that
--      needs your internal _sync_participant_invoices (request (e)).
--   7. Leaders holding tickets are refused (C1), so pledge_spot / advisor_spot
--      invoices, ticket numbering and spots_pledged never move here.
--
-- OPEN POINTS FOR CHRISTIAN
--   * The coverage gap in 2.
--   * A removed head delegate or faculty advisor keeps their role with no
--     delegation (we do not write role: zz_app_role_switched is yours). Say if you
--     want the function to refuse that, or to leave it to organiser_set_member_role.
--   * societies.advisor_user_id is left as it is (legacy, answer 11).
--   * No email is queued by this function; the client decides whether to queue
--     removed_from_delegation.
--
-- ALSO IN THIS FILE: organiser_set_head(p_application, p_head), the organiser's
-- delegate <-> head delegate move (the live delegation_set_head with an organiser
-- check instead of a leader check). It writes role and is_head_delegate only;
-- money happens exactly as today through your zz_app_role_switched trigger. See
-- its own block below.
--
-- WHO MAY CALL delegation_remove_member
--   An accepted leader of the member's delegation (is_society_leader) or an
--   organiser of the conference (is_conference_organizer). A leader may remove any
--   member, another leader included, themselves included.
-- REFUSALS ({ok:false, code, error})
--   signed_out, not_member (not in a delegation, or unknown id), not_leader,
--   last_leader (the member is the delegation's last accepted leader with an
--   account), holds_tickets (a leader with spots_pledged or advisors_pledged above
--   0, or any pledge_spot / advisor_spot invoice that is not void:
--   "Move this leader's tickets to another leader first.", answer C1).
-- OK
--   {ok:true, application_id, name, released_allocation_ids uuid[]}
-- =============================================================================

begin;

create or replace function public.delegation_remove_member(p_application uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_m record;
  v_is_leader_role boolean;
  v_released uuid[] := '{}'::uuid[];
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Sign in first.');
  end if;

  select a.id, a.user_id, a.role, a.status, a.conference_id, a.society_id,
         coalesce(a.spots_pledged, 0) as spots_pledged,
         coalesce(a.advisors_pledged, 0) as advisors_pledged,
         coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(a.invited_name), '')) as name
    into v_m
    from applications a
    left join profiles p on p.id = a.user_id
   where a.id = p_application
   for update of a;
  if v_m.id is null or v_m.society_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_member', 'error', 'That person is not in a delegation.');
  end if;

  if not (is_conference_organizer(v_m.conference_id) or is_society_leader(v_m.society_id)) then
    return jsonb_build_object('ok', false, 'code', 'not_leader',
      'error', 'Only a head delegate or faculty advisor of this delegation can remove people from it.');
  end if;

  -- One removal per delegation at a time, so two leaders removing each other can
  -- never leave the delegation without one.
  perform 1 from societies s where s.id = v_m.society_id for update;

  v_is_leader_role := v_m.role in ('faculty-advisor', 'head-delegate');

  if v_is_leader_role
     and v_m.user_id is not null
     and v_m.status in ('accepted', 'assigned', 'checked-in')
     and public._delegation_leader_count(v_m.society_id, v_m.id) = 0 then
    return jsonb_build_object('ok', false, 'code', 'last_leader',
      'error', 'A delegation needs at least one head delegate or faculty advisor. Add another leader first.');
  end if;

  if v_is_leader_role
     and (v_m.spots_pledged > 0 or v_m.advisors_pledged > 0
          or exists (select 1 from invoices i
                      where i.application_id = v_m.id
                        and i.kind in ('pledge_spot', 'advisor_spot')
                        and i.status <> 'void')) then
    return jsonb_build_object('ok', false, 'code', 'holds_tickets',
      'error', 'Move this leader''s tickets to another leader first.');
  end if;

  perform set_config('app.trusted_write', 'on', true);

  -- Their seat goes back to the delegation as an Open seat (part 1).
  v_released := public._delegation_release_seat(v_m.id, v_m.society_id);

  -- ONE update, so the triggers above fire once.
  update applications
     set society_id = null,
         assigned_committee_id = null,
         assigned_country_code = null,
         assigned_country_name = null,
         status = case when status = 'assigned' then 'accepted' else status end
   where id = v_m.id;

  return jsonb_build_object(
    'ok', true,
    'application_id', v_m.id,
    'name', v_m.name,
    'released_allocation_ids', to_jsonb(v_released));
end $function$;

revoke all on function public.delegation_remove_member(uuid) from public, anon;
grant execute on function public.delegation_remove_member(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- organiser_set_head(p_application, p_head)  (added 20 Oct 2026)
--   The organiser's twin of the live delegation_set_head(p_society,
--   p_application_id, p_head): the same body and checks, but the caller must be an
--   organiser of the conference (is_conference_organizer, the permission the
--   applications page's writes rely on) instead of a leader, and the delegation is
--   read from the application. Moves ONLY between delegate and head delegate.
--   Writes role and is_head_delegate in one update with app.trusted_write and
--   app.delegation_role_move on, exactly as delegation_set_head does.
--   Money: none written here. It happens exactly as today through your existing
--   triggers: zz_app_role_switched -> _app_role_switched (delegate <-> head
--   delegate, flag fin_role_switch_diff: a "<Role> Ticket difference" line or a
--   refund-due item), zz_applications_pledge_coverage (coverage re-run for the
--   delegation), zz_audit_applications ('role_changed'), and
--   applications_credit_gate, which takes no credit because
--   app.delegation_role_move is on.
--   Two checks the live delegation_set_head does NOT have (please confirm):
--     * last_leader: a head delegate who is the delegation's last accepted leader
--       with an account cannot be made a delegate.
--     * holds_tickets: a head delegate with spots_pledged / advisors_pledged above
--       0 (or a non-void pledge_spot / advisor_spot invoice) cannot be made a
--       delegate, so tickets never sit on a non-leader (answers C1 and C3).
--   ok: {ok:true, application_id, role, name}
--   codes: signed_out, not_member, not_organiser, not_accepted, already_head,
--          not_delegate, no_account, not_head, duplicate_role, last_leader,
--          holds_tickets
-- -----------------------------------------------------------------------------

create or replace function public.organiser_set_head(p_application uuid, p_head boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_to record;
  v_name text;
  v_new_role text := case when p_head then 'head-delegate' else 'delegate' end;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Sign in first.');
  end if;

  select a.id, a.user_id, a.role, a.status, a.conference_id, a.society_id,
         coalesce(a.spots_pledged, 0) as spots_pledged,
         coalesce(a.advisors_pledged, 0) as advisors_pledged
    into v_to
    from applications a
   where a.id = p_application
   for update;
  if v_to.id is null or v_to.society_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_member', 'error', 'That person is not in a delegation.');
  end if;
  if not is_conference_organizer(v_to.conference_id) then
    return jsonb_build_object('ok', false, 'code', 'not_organiser', 'error', 'Only the conference''s organisers can change this.');
  end if;

  perform 1 from societies s where s.id = v_to.society_id for update;

  if v_to.status not in ('accepted', 'assigned', 'checked-in') then
    return jsonb_build_object('ok', false, 'code', 'not_accepted', 'error', 'Accept this application first.');
  end if;

  if p_head then
    if v_to.role = 'head-delegate' then
      return jsonb_build_object('ok', false, 'code', 'already_head', 'error', 'They are already a head delegate.');
    end if;
    if v_to.role <> 'delegate' then
      return jsonb_build_object('ok', false, 'code', 'not_delegate', 'error', 'Only a delegate can become head delegate.');
    end if;
    if v_to.user_id is null then
      return jsonb_build_object('ok', false, 'code', 'no_account', 'error', 'This person has not created their account yet. They need one before they can lead.');
    end if;
  else
    if v_to.role <> 'head-delegate' then
      return jsonb_build_object('ok', false, 'code', 'not_head', 'error', 'Only a head delegate can be made a delegate.');
    end if;
    if v_to.user_id is not null and public._delegation_leader_count(v_to.society_id, v_to.id) = 0 then
      return jsonb_build_object('ok', false, 'code', 'last_leader',
        'error', 'A delegation needs at least one head delegate or faculty advisor. Add another leader first.');
    end if;
    if v_to.spots_pledged > 0 or v_to.advisors_pledged > 0
       or exists (select 1 from invoices i
                   where i.application_id = v_to.id
                     and i.kind in ('pledge_spot', 'advisor_spot')
                     and i.status <> 'void') then
      return jsonb_build_object('ok', false, 'code', 'holds_tickets',
        'error', 'Move this leader''s tickets to another leader first.');
    end if;
  end if;

  if v_to.user_id is not null and exists (
    select 1 from applications o where o.conference_id = v_to.conference_id and o.user_id = v_to.user_id
      and o.role = v_new_role and o.id <> v_to.id) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_role',
      'error', 'This person already has another ' || replace(v_new_role, '-', ' ') || ' application at this conference. Sort that one out first.');
  end if;

  perform set_config('app.trusted_write', 'on', true);
  perform set_config('app.delegation_role_move', 'on', true);

  update applications set role = v_new_role, is_head_delegate = p_head where id = v_to.id;

  select coalesce(nullif(btrim(display_name), ''), 'them') into v_name from profiles where id = v_to.user_id;
  return jsonb_build_object('ok', true, 'application_id', v_to.id, 'role', v_new_role, 'name', coalesce(v_name, 'them'));
end $function$;

revoke all on function public.organiser_set_head(uuid, boolean) from public, anon;
grant execute on function public.organiser_set_head(uuid, boolean) to authenticated;

commit;


-- =============================================================================
-- VERIFICATION (rolled back: it ends in RAISE EXCEPTION, then ROLLBACK, so nothing
-- it does is kept). Run AFTER the two functions above exist (applied, or pasted above
-- inside the same transaction in place of its begin / commit). It impersonates
-- real accounts for this transaction only (set_config(..., true)).
-- Email: the only email anything here can queue is the coverage email in
-- _apply_pledge_cover_to_app; app.quiet_coverage = 'on' is its skip line
-- ("if v_email is not null and coalesce(current_setting('app.quiet_coverage',
-- true), '') <> 'on'"), set first. Rolled back either way.
-- Success = an error reading "REMOVE MEMBER TEST PASSED ...", with the money that
-- moved in the delegation listed. Any other error names the check that failed.
-- =============================================================================
begin;
do $verify$
declare
  v_member uuid; v_soc uuid; v_leader uuid; v_conf uuid;
  v_seats uuid[]; v_before jsonb; v_after jsonb; v_changed jsonb;
  v_r jsonb; v_a record; v_u uuid; v_x uuid; v_msg text := '';
begin
  perform set_config('app.quiet_coverage', 'on', true);

  -- 1. A seated delegate whose delegation has an accepted leader with an account.
  select a.id, a.society_id, a.conference_id, l.user_id
    into v_member, v_soc, v_conf, v_leader
    from applications a
    join lateral (select x.user_id from applications x
                   where x.society_id = a.society_id and x.user_id is not null
                     and x.role in ('faculty-advisor', 'head-delegate')
                     and x.status in ('accepted', 'assigned', 'checked-in')
                   limit 1) l on true
   where a.role = 'delegate' and a.status in ('accepted', 'assigned')
     and a.society_id is not null
     and exists (select 1 from conference_allocations ca where ca.application_id = a.id)
   order by a.created_at desc
   limit 1;
  if v_member is null then raise exception 'no seated delegate with a leader to test on'; end if;

  select array_agg(ca.id) into v_seats from conference_allocations ca where ca.application_id = v_member;
  select coalesce(jsonb_object_agg(i.id, jsonb_build_object('app', i.application_id, 'kind', i.kind,
           'status', i.status, 'label', i.label, 'amount_cents', i.amount_cents)), '{}'::jsonb)
    into v_before
    from invoices i join applications a on a.id = i.application_id
   where a.society_id = v_soc or a.id = v_member;

  perform set_config('request.jwt.claims', json_build_object('sub', v_leader, 'role', 'authenticated')::text, true);
  v_r := public.delegation_remove_member(v_member);
  if (v_r->>'ok')::boolean is not true then raise exception 'leader remove refused: %', v_r; end if;

  select society_id, status, role, assigned_committee_id into v_a from applications where id = v_member;
  if v_a.society_id is not null then raise exception 'society_id not cleared'; end if;
  if v_a.status = 'assigned' then raise exception 'status still assigned'; end if;
  if v_a.assigned_committee_id is not null then raise exception 'assigned_committee_id not cleared'; end if;
  if v_a.role <> 'delegate' then raise exception 'role changed to %', v_a.role; end if;
  if exists (select 1 from conference_allocations ca where ca.id = any(v_seats)
              and (ca.application_id is not null or ca.user_id is not null
                   or ca.society_id is distinct from v_soc or ca.allocation_sent))
    then raise exception 'seat did not become an Open seat of the delegation'; end if;
  -- _delegation_release_seat also frees a seat held by the same account, so at least these.
  if jsonb_array_length(v_r->'released_allocation_ids') < coalesce(array_length(v_seats, 1), 0)
    then raise exception 'released ids %, seats %', v_r->'released_allocation_ids', v_seats; end if;

  select coalesce(jsonb_object_agg(i.id, jsonb_build_object('app', i.application_id, 'kind', i.kind,
           'status', i.status, 'label', i.label, 'amount_cents', i.amount_cents)), '{}'::jsonb)
    into v_after
    from invoices i where i.id in (select (jsonb_object_keys(v_before))::uuid);
  select coalesce(jsonb_agg(jsonb_build_object('invoice', k, 'before', v_before->k, 'after', v_after->k)), '[]'::jsonb)
    into v_changed
    from jsonb_object_keys(v_before) k
   where v_before->k is distinct from v_after->k;
  v_msg := format('removed %s from %s, seats released %s; invoices changed: %s',
                  v_member, v_soc, v_r->'released_allocation_ids', v_changed);

  -- 2. not_leader: an account that is neither a leader there nor an organiser.
  select p.id into v_u from profiles p
   where not exists (select 1 from conference_organizers co where co.conference_id = v_conf and co.user_id = p.id)
     and not exists (select 1 from platform_admins pa where pa.user_id = p.id)
     and not exists (select 1 from applications x where x.user_id = p.id and x.conference_id = v_conf)
   limit 1;
  select a.id into v_x from applications a
   where a.society_id = v_soc and a.id <> v_member and a.role = 'delegate' limit 1;
  if v_u is not null and v_x is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_u, 'role', 'authenticated')::text, true);
    v_r := public.delegation_remove_member(v_x);
    if v_r->>'code' is distinct from 'not_leader' then raise exception 'stranger: %', v_r; end if;
    v_msg := v_msg || '; not_leader ok';
  else
    v_msg := v_msg || '; not_leader skipped (no data)';
  end if;

  -- 3. last_leader: the only counted leader of a delegation, holding no tickets,
  --    removes themselves.
  select a.id, a.user_id into v_x, v_u from applications a
   where a.society_id is not null and a.user_id is not null
     and a.role in ('faculty-advisor', 'head-delegate')
     and a.status in ('accepted', 'assigned', 'checked-in')
     and coalesce(a.spots_pledged, 0) = 0 and coalesce(a.advisors_pledged, 0) = 0
     and public._delegation_leader_count(a.society_id, a.id) = 0
   limit 1;
  if v_x is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_u, 'role', 'authenticated')::text, true);
    v_r := public.delegation_remove_member(v_x);
    if v_r->>'code' is distinct from 'last_leader' then raise exception 'last leader: %', v_r; end if;
    v_msg := v_msg || '; last_leader ok';
  else
    v_msg := v_msg || '; last_leader skipped (no data)';
  end if;

  -- 4. holds_tickets: a leader with tickets, removed by another leader.
  select a.id, o.user_id into v_x, v_u from applications a
    join lateral (select y.user_id from applications y
                   where y.society_id = a.society_id and y.id <> a.id and y.user_id is not null
                     and y.role in ('faculty-advisor', 'head-delegate')
                     and y.status in ('accepted', 'assigned', 'checked-in')
                   limit 1) o on true
   where a.society_id is not null
     and a.role in ('faculty-advisor', 'head-delegate')
     and a.status in ('accepted', 'assigned', 'checked-in')
     and (coalesce(a.spots_pledged, 0) > 0 or coalesce(a.advisors_pledged, 0) > 0)
   limit 1;
  if v_x is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_u, 'role', 'authenticated')::text, true);
    v_r := public.delegation_remove_member(v_x);
    if v_r->>'code' is distinct from 'holds_tickets' then raise exception 'holds tickets: %', v_r; end if;
    v_msg := v_msg || '; holds_tickets ok';
  else
    v_msg := v_msg || '; holds_tickets skipped (no data)';
  end if;

  -- 5. organiser_set_head: an organiser makes an accepted delegate with an account
  --    head delegate and back; a leader who is not an organiser is refused.
  --    _app_role_switched writes no email (checked 20 Oct 2026); rolled back anyway.
  select a.id, co.user_id into v_x, v_u from applications a
    join conference_organizers co on co.conference_id = a.conference_id
   where a.society_id is not null and a.role = 'delegate' and a.user_id is not null
     and a.status in ('accepted', 'assigned', 'checked-in')
     and coalesce(a.spots_pledged, 0) = 0 and coalesce(a.advisors_pledged, 0) = 0
     and public._delegation_leader_count(a.society_id, a.id) > 0   -- so the demotion is allowed
     and not exists (select 1 from applications o where o.conference_id = a.conference_id
                      and o.user_id = a.user_id and o.role = 'head-delegate')
   limit 1;
  if v_x is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_u, 'role', 'authenticated')::text, true);
    v_r := public.organiser_set_head(v_x, true);
    if (v_r->>'ok')::boolean is not true or (select role from applications where id = v_x) <> 'head-delegate'
      then raise exception 'organiser promote: %', v_r; end if;
    v_r := public.organiser_set_head(v_x, false);
    if (v_r->>'ok')::boolean is not true or (select role from applications where id = v_x) <> 'delegate'
      then raise exception 'organiser demote: %', v_r; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_leader, 'role', 'authenticated')::text, true);
    if not public.is_conference_organizer((select conference_id from applications where id = v_x)) then
      v_r := public.organiser_set_head(v_x, true);
      if v_r->>'code' is distinct from 'not_organiser' then raise exception 'non-organiser: %', v_r; end if;
    end if;
    v_msg := v_msg || '; organiser_set_head ok';
  else
    v_msg := v_msg || '; organiser_set_head skipped (no data)';
  end if;

  raise exception 'REMOVE MEMBER TEST PASSED: %', v_msg;
end $verify$;
rollback;
