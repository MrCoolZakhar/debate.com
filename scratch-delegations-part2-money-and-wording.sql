-- =============================================================================
-- scratch-delegations-part2-money-and-wording.sql
-- DRAFT, NOT APPLIED. WAITS FOR CHRISTIAN: answer the DECISION NEEDED blocks in
-- section 10 first. The owners apply it through the chat's Supabase work.
-- Part 2 of 2 of the delegations rebuild (was scratch-delegations-rebuild.sql,
-- sections 9 and 10, function bodies copied verbatim). Apply AFTER part 1
-- (scratch-delegations-part1-people-and-seats.sql), whose conventions it follows.
-- Client flag: DELEGATIONS_MONEY_DB (both v2.ts files), flipped once this part is
-- applied.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 9. Wording: "pledge" in database text that people can see
--    Searched every public function body for a quoted literal containing "pledg",
--    every email_templates / email_campaign_templates row, and
--    application_role_configs.custom_questions / submission_message.
--
--    Changed below (CREATE OR REPLACE with the live body, only the string changed):
--      add_pledged_spots
--        old: 'Only delegation leaders can pledge spots.'
--        new: 'Only delegation leaders can change the expected size.'
--      remove_pledged_spot_invoice
--        old: 'Only pledged spots and advisor tickets can be removed.'
--        new: 'Only spots in the expected size and advisor tickets can be removed.'
--      money_daily_check(boolean) (the daily money report to the owners, rewritten
--      in place with a guarded replace so the long body is not retyped)
--        old: 'Leaders covered by the tickets they pledged instead of paying their own ticket: '
--        new: 'Leaders covered by the tickets they bought for their expected size instead of paying their own ticket: '
--
--    NOT changed (organiser-written text; the owners decide, commented below):
--      email_templates 0d09824d-80bd-418e-9bbc-f35cf9ebaa84 (MUNBU, event pledge_received)
--        name 'Pledge Received'; subject 'MUNBU WORKSHOP''26 PLEDGE RECEIVED';
--        body "...your pledge to cover delegation spots has been marked as received..."
--      email_templates 87f30dd9-efa8-41a9-959d-4af2f5bd0fd2 (LIMUN 2027, a test)
--        name 'Pledge Received'; subject 'Test Email Pledge Received'
--      application_role_configs (turkmenistan-world-model-united-nations-lqivs,
--        delegate): "I pledge to maintain strict diplomatic courtesy..." is a code of
--        conduct, not a delegation pledge. Leave it.
--    Identifiers stay (never user-facing): event key pledge_received, invoice kind
--    pledge_spot, columns spots_pledged / advisors_pledged / pledge_type /
--    pledge_confirmed_at, store flag fin_pledge_covers, function names.
--    Client copy for pledge_received already says "Delegation Spots Paid"
--    (src/lib/emailEvents.ts); the client "Pledge" list is in delegations.md.
-- -----------------------------------------------------------------------------

create or replace function public.add_pledged_spots(p_application_id uuid, p_count integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare a record;
begin
  select id, user_id, role, society_id, spots_pledged into a from applications where id=p_application_id;
  if a.id is null then return jsonb_build_object('ok',false,'error','Application not found'); end if;
  if a.user_id is distinct from auth.uid() then return jsonb_build_object('ok',false,'error','Not authorized'); end if;
  if a.role not in ('faculty-advisor','head-delegate') or a.society_id is null then
    return jsonb_build_object('ok',false,'error','Only delegation leaders can change the expected size.'); end if;
  if coalesce(p_count,0) <= 0 or p_count > 100 then
    return jsonb_build_object('ok',false,'error','Choose a valid number of spots to add.'); end if;

  update applications set spots_pledged=coalesce(spots_pledged,0)+p_count,
    pledge_type=coalesce(pledge_type,'delegation') where id=a.id;
  perform sync_participant_invoices(a.id);
  return jsonb_build_object('ok', true, 'spots_pledged', (select spots_pledged from applications where id=p_application_id));
end $function$;

create or replace function public.remove_pledged_spot_invoice(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inv record; v_app record; v_is_owner boolean; v_is_org boolean;
begin
  select * into v_inv from invoices where id = p_invoice_id;
  if v_inv.id is null then return jsonb_build_object('ok',false,'error','Invoice not found'); end if;
  if v_inv.kind not in ('pledge_spot','advisor_spot') then
    return jsonb_build_object('ok',false,'error','Only spots in the expected size and advisor tickets can be removed.'); end if;
  if v_inv.status <> 'open' or v_inv.amount_paid_cents > 0 or coalesce(v_inv.aid_applied_cents,0) > 0 then
    return jsonb_build_object('ok',false,'error','This spot has payment or aid attached and cannot be removed.'); end if;

  select id, user_id, spots_pledged, advisors_pledged into v_app
    from applications where id = v_inv.application_id;
  if v_app.id is null then return jsonb_build_object('ok',false,'error','Application not found'); end if;

  v_is_owner := (v_app.user_id = auth.uid());
  v_is_org := is_conference_organizer(v_inv.conference_id);
  if not (v_is_owner or v_is_org) then
    return jsonb_build_object('ok',false,'error','Not authorized'); end if;

  update invoices set status='void', updated_at=now() where id = p_invoice_id;

  if v_inv.kind = 'pledge_spot' then
    update applications set spots_pledged = greatest(0, coalesce(spots_pledged,0) - 1) where id = v_app.id;
  else
    update applications set advisors_pledged = greatest(0, coalesce(advisors_pledged,0) - 1) where id = v_app.id;
  end if;

  return jsonb_build_object('ok', true,
    'kind', v_inv.kind,
    'remaining', case when v_inv.kind='pledge_spot'
      then (select spots_pledged from applications where id=v_app.id)
      else (select advisors_pledged from applications where id=v_app.id) end);
end $function$;

-- money_daily_check(boolean): replace the one literal in place. Refuses (and rolls
-- the whole file back) if the live body no longer contains the old text exactly once.
do $do$
declare
  v_def text;
  v_old constant text := 'Leaders covered by the tickets they pledged instead of paying their own ticket: ';
  v_new constant text := 'Leaders covered by the tickets they bought for their expected size instead of paying their own ticket: ';
begin
  v_def := pg_get_functiondef('public.money_daily_check(boolean)'::regprocedure);
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'money_daily_check changed since 19 Oct 2026: review section 9 before applying.';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;

-- Organiser-written templates: NOT run. Uncomment only with the organisers' consent.
-- update public.email_templates
--    set name = 'Delegation Spots Paid',
--        subject = 'MUNBU WORKSHOP''26 DELEGATION SPOTS PAID',
--        body = replace(body, 'your pledge to cover delegation spots has been marked as received', 'the delegation spots you paid for have been marked as received'),
--        body_blocks = replace(body_blocks::text, 'your pledge to cover delegation spots has been marked as received', 'the delegation spots you paid for have been marked as received')::jsonb
--  where id = '0d09824d-80bd-418e-9bbc-f35cf9ebaa84';
-- update public.email_templates
--    set name = 'Delegation Spots Paid', subject = 'Test Email Delegation Spots Paid'
--  where id = '87f30dd9-efa8-41a9-959d-4af2f5bd0fd2';

-- The pledge_received email (listed only, nothing to run here).
--   Wanted wording:
--     subject  'Delegation spots paid: {{conference_name}}'
--     heading  'Delegation spots paid'
--     body     'Hi {{delegate_name}},\n\nThe delegation spots you are paying for
--              {{delegation_name}} at {{conference_name}} have been marked received.
--              Thank you for handling payment on behalf of your delegation.\n\nYour
--              conference view shows which spots are covered and who is currently
--              holding them.'
--   Where the text lives: NOT in the database. No function body contains
--   pledge_received or its copy; the default is the client's src/lib/defaultEmails.ts
--   (pledge_received, lines 224-231), and it ALREADY reads exactly as above. The
--   email is queued from the client (manage/[slug]/assignment/DelegationsView.tsx:478,
--   queueEventEmail 'pledge_received', defined in src/lib/emailEvents.ts, which
--   reads the conference's email_templates row and falls back to
--   getDefaultEventEmail from defaultEmails.ts). The only database copies are the two organiser rows above (MUNBU's own
--   wording, and LIMUN's test): they override the default for those conferences and
--   are the organisers' text, so they stay commented.


-- -----------------------------------------------------------------------------
-- 10. my_delegation_money(p_society)
--     The leader card's Financials section: the WHOLE delegation's money (every
--     leader's and member's items), for the delegation's leaders only
--     (is_society_leader). Organisers already have financials_dashboard.
--     Definitions are conference_money_summary's, narrowed to the delegation:
--       scope       = invoices of the delegation's active applications (not rejected
--                     or withdrawn) plus invoices carrying society_id = the delegation
--                     (Delegate / Advisor Tickets, the per-delegation Registration Fee)
--       received    = succeeded payments by card (method 'stripe'), reversals included
--       offline     = succeeded payments any other way (manual)
--       left to pay = open / partial invoices of ACCEPTED people, amount minus paid
--       one currency: the conference's (conferences.fee_currency)
--     Never applications.payment_status.
--
-- DECISION NEEDED (Christian): the headline "paid" number.
--   CLAUDE.md §2: "received = Stripe, offline = manual, never added". The client asked
--   for one paid_cents. Drafted: received_cents and offline_cents separately, no sum.
--   P1. Keep them apart; the card shows two lines (card, other ways).
--   P2. Add 'paid_cents', received_cents + offline_cents, for the leader card only
--       (one line in the jsonb below), and record the exception in CLAUDE.md.
-- DECISION NEEDED (Christian): what a "fee" is in the paid / total counts.
--   Drafted: one fee = one ticket. Delegate fees = Delegate Tickets (pledge_spot) +
--   the own tickets (role_fee) of delegates and head delegates; advisor fees =
--   Advisor Tickets (advisor_spot) + faculty advisors' own tickets. A member ticket
--   waived because a Delegate Ticket covers it ("Covered by your delegation" /
--   "Covered by delegation") is NOT counted (the Delegate Ticket already is). Paid =
--   settled, or waived by the organiser ("Fee waived"); partly paid is not paid.
--   Alternatives: count cents instead of tickets; count an organiser waiver as
--   neither paid nor owed; leave out the per-delegation Registration Fee entirely
--   (drafted: it is in received / offline / left to pay, never in the fee counts).
-- members_owing: people of the delegation (any role) who are accepted and whose OWN
--   ticket (role_fee) is open or partly paid with something left, i.e. they pay for
--   themselves and have not finished.
-- -----------------------------------------------------------------------------

create or replace function public.my_delegation_money(p_society uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_conf uuid;
  v_cur text;
  v jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'signed_out', 'error', 'Please sign in again.');
  end if;
  select s.conference_id into v_conf from societies s where s.id = p_society;
  if v_conf is null then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'We could not find this delegation.');
  end if;
  if not is_society_leader(p_society) then
    return jsonb_build_object('ok', false, 'code', 'not_leader', 'error', 'Only the delegation''s head delegates and faculty advisors can see its payments.');
  end if;

  select upper(coalesce(c.fee_currency, 'USD')) into v_cur from conferences c where c.id = v_conf;

  with apps as (
    select a.id, a.role, a.status
      from applications a
     where a.society_id = p_society
       and a.conference_id = v_conf
       and a.status not in ('rejected', 'withdrawn')
  ), scope as (
    select i.id, i.kind, i.status, i.label, i.amount_cents, coalesce(i.amount_paid_cents, 0) as amount_paid_cents,
           upper(i.currency) as cur, i.application_id, ap.role as app_role, ap.status as app_status
      from invoices i
      left join applications ap on ap.id = i.application_id
     where i.conference_id = v_conf
       and (i.application_id in (select id from apps) or i.society_id = p_society)
  ), pays as (
    select p.method, p.amount_cents
      from payments p
      join scope s on s.id = p.invoice_id
     where p.status = 'succeeded'
       and upper(p.currency) = v_cur
  ), owed as (
    select s.application_id, s.kind, greatest(0, s.amount_cents - s.amount_paid_cents) as due
      from scope s
     where s.cur = v_cur
       and s.status in ('open', 'partial')
       and s.app_status in ('accepted', 'assigned', 'checked-in')
       and s.amount_cents - s.amount_paid_cents > 0
  ), fees as (
    select case when s.kind = 'pledge_spot' or (s.kind = 'role_fee' and s.app_role in ('delegate', 'head-delegate')) then 'delegate'
                when s.kind = 'advisor_spot' or (s.kind = 'role_fee' and s.app_role = 'faculty-advisor') then 'advisor'
           end as pool,
           (s.status = 'settled' or (s.status = 'waived' and s.label is distinct from 'Covered by your delegation'
                                     and s.label is distinct from 'Covered by delegation'))::int as paid
      from scope s
     where s.cur = v_cur
       and s.status <> 'void'
       and s.kind in ('role_fee', 'pledge_spot', 'advisor_spot')
       and not (s.kind = 'role_fee' and s.status = 'waived'
                and s.label in ('Covered by your delegation', 'Covered by delegation'))
  )
  select jsonb_build_object(
    'ok', true,
    'currency', v_cur,
    'received_cents', coalesce((select sum(amount_cents) from pays where method = 'stripe'), 0)::bigint,
    'offline_cents', coalesce((select sum(amount_cents) from pays where method is distinct from 'stripe'), 0)::bigint,
    'left_to_pay_cents', coalesce((select sum(due) from owed), 0)::bigint,
    'delegate_fees_paid', coalesce((select sum(paid) from fees where pool = 'delegate'), 0)::int,
    'delegate_fees_total', (select count(*) from fees where pool = 'delegate')::int,
    'advisor_fees_paid', coalesce((select sum(paid) from fees where pool = 'advisor'), 0)::int,
    'advisor_fees_total', (select count(*) from fees where pool = 'advisor')::int,
    'members_owing', (select count(distinct o.application_id) from owed o
                       where o.kind = 'role_fee' and o.application_id in (select id from apps))::int
  ) into v;

  return v;
end $function$;

revoke all on function public.my_delegation_money(uuid) from public, anon;
grant execute on function public.my_delegation_money(uuid) to authenticated;

commit;


-- =============================================================================
-- CLIENT CONTRACT (part 2). Same conventions as part 1: {ok:true, ...} or
-- {ok:false, code, error}.
--
-- my_delegation_money(p_society uuid)                              -> jsonb
--   Leaders of that delegation only. Whole delegation, conference currency.
--   ok: {ok, currency, received_cents, offline_cents, left_to_pay_cents,
--        delegate_fees_paid, delegate_fees_total, advisor_fees_paid,
--        advisor_fees_total, members_owing}   (amounts in minor units, bigint)
--   No paid_cents yet: received and offline are kept apart (CLAUDE.md §2); see the
--   DECISION NEEDED in section 10. Format every amount with formatCents.
--   codes: signed_out, not_found, not_leader
--
-- =============================================================================
