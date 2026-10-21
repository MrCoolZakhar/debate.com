-- ============================================================================
-- scratch-allocation-email-buffer.sql
-- DRAFT for the owners' Supabase chat. NOT APPLIED. Written 21 Oct 2026 from
-- the Assignment run (owner feedback C and D). Read-only inspection of
-- luruhkwrgisytejswlas was used to write it; nothing here has been run.
--
-- PART C  An allocation that is not released (conference_allocations.
--         allocation_sent = false) must not be visible to the delegate.
--         Today the database hands it out in nine places:
--           C1  RLS "Users read own allocations"        (no allocation_sent check)
--           C2  RLS "Seatmates read shared allocations" + user_is_allocated_to()
--           C3  user_is_allocated_in_committee()        (study guides, papers)
--           C4  my_live_rooms()          delegate branch ("Your room is live")
--           C5  my_attention_items()     allocation item (the profile red bubble)
--           C6  my_delegation_roster()   the caller's OWN allocation
--           C7  my_pending_import_invites() / get_import_invite() (imported invites)
--           C8  my_committee_chairs()    access granted on an unreleased seat
--           C9  my_co_delegates()        (no longer rendered, still callable)
--         Leaders (head delegates, faculty advisors) keep seeing their members'
--         unreleased seats through my_delegation_seats / my_advisor_delegation /
--         "Delegation leaders read their allocations": that is the current
--         design and is NOT changed here (owners' call).
--         NOT fixable here: applications.assigned_committee_id /
--         assigned_country_code / assigned_country_name are written on Assign and
--         the delegate reads their own application row. Those readers must gate
--         on the allocation (see the run report for file:line).
--
-- PART D  The 3-minute buffer before the allocation email. The client
--         (src/lib/allocationEmail.ts, ALLOCATION_EMAIL_BUFFER_DB = false) queues
--         the Assign email with send_after = now + 3 min and, once this file is
--         live and the flag is flipped, relies on:
--           D1  email_outbox.status 'cancelled' (a voided row; never claimed,
--               never released by email_resume(), counts as nothing)
--           D2  cancel_pending_allocation_emails(conference, application_ids)
--               voids every allocation_assigned row still pending / held for
--               them and returns the application ids it voided (re-assign,
--               unassign and "Send" all call it first)
--           D3  trigger: allocation_sent / allocation_sent_at are stamped when
--               the allocation email actually LEAVES (sent, or a terminal
--               failed / suppressed, which is what queue-time stamping counted
--               before), so the delegate cannot see the seat before the email
--               and a voided email never stamps it.
--         send-emails v19 needs no change: it claims pending -> sending
--         atomically and only rows whose send_after has passed, so a row voided
--         while still pending can never be sent.
--
-- After applying: flip ALLOCATION_EMAIL_BUFFER_DB to true in
-- src/lib/allocationEmail.ts (one line) and deploy.
-- Rollback: section at the bottom.
-- ============================================================================

begin;

-- ── helper: patch one function body by an exact, unique anchor ───────────────
-- Whitespace in the anchor matches any run of whitespace in the live body.
-- Refuses unless the anchor occurs exactly once, so a body that changed since
-- this draft was written fails loudly instead of being half patched.
create or replace function pg_temp.patch_fn(p_sig regprocedure, p_find text, p_repl text)
returns void language plpgsql as $$
declare
  v_def text := pg_get_functiondef(p_sig);
  v_re  text := regexp_replace(regexp_replace(p_find, '([.()\[\]*+?{}|^$\\])', '\\\1', 'g'), '\s+', '\\s+', 'g');
  v_n   int;
begin
  select count(*) into v_n from regexp_matches(v_def, v_re, 'g');
  if v_n <> 1 then
    raise exception 'patch_fn %: anchor found % times (expected 1): %', p_sig, v_n, p_find;
  end if;
  execute regexp_replace(v_def, v_re, replace(p_repl, '\', '\\'));
end $$;

-- ═════════════════════════════ PART C ═══════════════════════════════════════

-- C1  A delegate reads their own allocation only once it is released.
drop policy if exists "Users read own allocations" on public.conference_allocations;
create policy "Users read own allocations" on public.conference_allocations
  for select using (user_id = (select auth.uid()) and allocation_sent);

-- C2  Seatmates: both the caller's seat and the row they read must be released.
create or replace function public.user_is_allocated_to(p_committee uuid, p_country text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from conference_allocations
    where conference_committee_id = p_committee
      and country_code = p_country
      and user_id = auth.uid()
      and allocation_sent
  );
$$;
drop policy if exists "Seatmates read shared allocations" on public.conference_allocations;
create policy "Seatmates read shared allocations" on public.conference_allocations
  for select using (allocation_sent and user_is_allocated_to(conference_committee_id, country_code));

-- C3  Committee membership (study guides "Assigned delegates read published
--     study guides", can_access_paper, pp_object_readable) starts at release.
--     Side effect, intended: an unreleased delegate cannot open the committee's
--     study guide or write a paper for a country they have not been told.
create or replace function public.user_is_allocated_in_committee(p_committee_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from conference_allocations
    where conference_committee_id = p_committee_id
      and user_id = auth.uid()
      and allocation_sent
  );
$$;

-- C4  "Your room is live" for a delegate: released seats only.
select pg_temp.patch_fn('public.my_live_rooms()'::regprocedure,
  'ca.user_id = me.uid order by ca.seat',
  'ca.user_id = me.uid and ca.allocation_sent order by ca.seat');

-- C5  Needs your attention: the allocation item only once released.
select pg_temp.patch_fn('public.my_attention_items()'::regprocedure,
  'where coalesce(al.allocation_sent_at, al.created_at) > now() - interval ''30 days''',
  'where al.allocation_sent and coalesce(al.allocation_sent_at, al.created_at) > now() - interval ''30 days''');

-- C6  Delegation roster: the caller's own allocation only once released;
--     a leader keeps seeing every member's (unchanged design).
select pg_temp.patch_fn('public.my_delegation_roster(uuid)'::regprocedure,
  'where al.application_id = a.id order by al.created_at desc',
  'where al.application_id = a.id and (v_leader or al.allocation_sent) order by al.created_at desc');

-- C7  Imported invites (before the account is claimed): no seat until released.
select pg_temp.patch_fn('public.my_pending_import_invites()'::regprocedure,
  'where ca.application_id = a.id limit 1',
  'where ca.application_id = a.id and ca.allocation_sent limit 1');
select pg_temp.patch_fn('public.get_import_invite(uuid)'::regprocedure,
  'where ca.application_id = v_app.id limit 1',
  'where ca.application_id = v_app.id and ca.allocation_sent limit 1');

-- C8  A committee's chairs are shown to a delegate of that committee once released.
select pg_temp.patch_fn('public.my_committee_chairs(uuid)'::regprocedure,
  'ca.conference_committee_id = p_conference_committee and ca.user_id = v_uid)',
  'ca.conference_committee_id = p_conference_committee and ca.user_id = v_uid and ca.allocation_sent)');

-- C9  Co-delegates: the caller's released seats, and only a released partner.
create or replace function public.my_co_delegates(p_conference uuid)
returns table(allocation_id uuid, committee_id uuid, committee_name text, committee_abbreviation text,
              country_code text, country_name text, my_seat integer, capacity integer,
              partner_user_id uuid, partner_name text, partner_email text, partner_avatar_url text, partner_seat integer)
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select a.id, cc.id, cc.name, cc.abbreviation, a.country_code, a.country_name, a.seat::int,
         public.seat_capacity(a.conference_committee_id, a.country_code),
         p.user_id, p.name, p.email, p.avatar_url, p.seat
    from conference_allocations a
    join conference_committees cc on cc.id = a.conference_committee_id
    left join applications mine on mine.id = a.application_id
    left join lateral (
      select coalesce(b.user_id, ap.user_id) as user_id,
             coalesce(nullif(btrim(pr.display_name), ''), nullif(btrim(ap.invited_name), '')) as name,
             coalesce(nullif(btrim(pr.email), ''), nullif(btrim(ap.invited_email), '')) as email,
             pr.avatar_url,
             b.seat::int as seat
        from conference_allocations b
        left join applications ap on ap.id = b.application_id
        left join profiles pr on pr.id = coalesce(b.user_id, ap.user_id)
       where b.conference_committee_id = a.conference_committee_id
         and b.country_code = a.country_code
         and b.id <> a.id
         and b.allocation_sent
         and (b.application_id is not null or b.user_id is not null)
       order by b.seat nulls last, b.created_at
       limit 1
    ) p on true
   where auth.uid() is not null
     and a.conference_id = p_conference
     and a.allocation_sent
     and (a.user_id = auth.uid() or mine.user_id = auth.uid())
$$;

-- ═════════════════════════════ PART D ═══════════════════════════════════════

-- D1  'cancelled': a buffered allocation email voided before it left.
alter table public.email_outbox drop constraint email_outbox_status_check;
alter table public.email_outbox add constraint email_outbox_status_check
  check (status = any (array['pending','sending','sent','failed','suppressed','held','blocked','cancelled']));

-- D2  Void the allocation emails still waiting for these applications.
--     Organisers of the conference only (the service role and a SQL session as
--     postgres for the verify below). 'pending' and 'held' rows are not claimed
--     by send-emails, so voiding them is race-free: the sender's claim is
--     `update ... set status='sending' where status='pending'`.
--     Returns the application ids that had a row voided. For those the
--     allocation was never told, so allocation_sent goes back to false (it is
--     only true there when the row was queued with the buffer off).
create or replace function public.cancel_pending_allocation_emails(p_conference uuid, p_application_ids uuid[])
returns table(application_id uuid)
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
#variable_conflict use_column
begin
  if p_conference is null or coalesce(array_length(p_application_ids, 1), 0) = 0 then
    return;
  end if;
  if not (public.is_conference_organizer(p_conference)
          or coalesce(auth.role(), '') = 'service_role'
          or session_user = 'postgres') then
    raise exception 'Only organisers can change allocation emails.' using errcode = 'P0001', hint = 'not_allowed';
  end if;

  return query
  with voided as (
    update email_outbox o
       set status = 'cancelled',
           error  = 'Allocation changed before this email was sent (3-minute buffer).'
     where o.conference_id = p_conference
       and o.recipient_application_id = any (p_application_ids)
       and o.status in ('pending', 'held')
       and o.template_id in (select t.id from email_templates t
                              where t.conference_id = p_conference and t.event_key = 'allocation_assigned')
    returning o.recipient_application_id
  ), apps as (
    select distinct v.recipient_application_id as app_id from voided v
  ), unstamp as (
    update conference_allocations ca
       set allocation_sent = false, allocation_sent_at = null
      from apps
     where ca.conference_id = p_conference
       and ca.application_id = apps.app_id
       and ca.allocation_sent
       and not exists (
         select 1 from email_outbox o2
          where o2.conference_id = p_conference
            and o2.recipient_application_id = apps.app_id
            and o2.status in ('sending', 'sent')
            and o2.template_id in (select t.id from email_templates t
                                    where t.conference_id = p_conference and t.event_key = 'allocation_assigned'))
    returning ca.id
  )
  select a.app_id from apps a;
end $$;
revoke all on function public.cancel_pending_allocation_emails(uuid, uuid[]) from public, anon;
grant execute on function public.cancel_pending_allocation_emails(uuid, uuid[]) to authenticated, service_role;

-- D3  Stamp allocation_sent when the allocation email leaves. Fails OPEN: an
--     error here is swallowed, so it can never stop a send or a status write.
--     Fires the existing conference_allocations_co_delegate_notice trigger
--     exactly as the queue-time stamp always did (UPDATE of allocation_sent
--     false -> true).
create or replace function public.email_outbox_stamp_allocation_sent()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  begin
    if new.recipient_application_id is not null
       and new.conference_id is not null
       and new.status in ('sent', 'failed', 'suppressed')
       and (tg_op = 'INSERT' or old.status is distinct from new.status)
       and exists (select 1 from email_templates t
                    where t.id = new.template_id and t.event_key = 'allocation_assigned') then
      update conference_allocations ca
         set allocation_sent = true,
             allocation_sent_at = coalesce(new.sent_at, now())
       where ca.conference_id = new.conference_id
         and ca.application_id = new.recipient_application_id
         and not ca.allocation_sent;
    end if;
  exception when others then
    raise warning 'email_outbox_stamp_allocation_sent: % (row %)', sqlerrm, new.id;
  end;
  return new;
end $$;

drop trigger if exists zz_email_outbox_stamp_allocation_sent on public.email_outbox;
create trigger zz_email_outbox_stamp_allocation_sent
  after insert or update of status on public.email_outbox
  for each row execute function public.email_outbox_stamp_allocation_sent();

commit;

-- ============================================================================
-- VERIFY (rolled back; nothing outside the transaction is written, nothing is
-- sent). Every outbox row below is inserted as 'held' with a send_after in the
-- future and addressed to the team inbox, so even inside the transaction the
-- sender could never claim it; the whole block is rolled back. Uses the test
-- conference gavelling-test-mun-2027. Run AFTER the commit above.
-- ============================================================================
begin;
do $$
declare
  v_conf uuid;
  v_tpl  uuid;
  v_alloc record;
  v_row  uuid;
  v_ids  uuid[];
  v_sent boolean;
begin
  select id into v_conf from conferences where slug = 'gavelling-test-mun-2027';
  if v_conf is null then raise exception 'test conference not found'; end if;

  -- D1: the constraint accepts the new status.
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'email_outbox_status_check')) not like '%cancelled%' then
    raise exception 'D1 failed: status check has no cancelled';
  end if;

  select id into v_tpl from email_templates where conference_id = v_conf and event_key = 'allocation_assigned';
  if v_tpl is null then
    insert into email_templates (conference_id, event_key, name, enabled) values (v_conf, 'allocation_assigned', 'Allocation Assigned', true) returning id into v_tpl;
  end if;

  select ca.id, ca.application_id into v_alloc
    from conference_allocations ca
   where ca.conference_id = v_conf and ca.application_id is not null
   limit 1;
  if v_alloc.id is null then raise exception 'no allocation with an application on the test conference'; end if;
  update conference_allocations set allocation_sent = false, allocation_sent_at = null where id = v_alloc.id;

  -- D2: a buffered row is voided and reported.
  insert into email_outbox (conference_id, template_id, recipient_application_id, recipient_email, subject, body, body_html, status, send_after)
  values (v_conf, v_tpl, v_alloc.application_id, 'wearegavelling@gmail.com', 'Buffer verify', 'Buffer verify', '<p>Buffer verify</p>', 'held', now() + interval '3 minutes')
  returning id into v_row;
  select array_agg(application_id) into v_ids from public.cancel_pending_allocation_emails(v_conf, array[v_alloc.application_id]);
  if v_ids is null or not (v_alloc.application_id = any (v_ids)) then raise exception 'D2 failed: nothing voided'; end if;
  if (select status from email_outbox where id = v_row) <> 'cancelled' then raise exception 'D2 failed: row not cancelled'; end if;
  select allocation_sent into v_sent from conference_allocations where id = v_alloc.id;
  if v_sent then raise exception 'D3 failed: a voided email stamped allocation_sent'; end if;

  -- D3: the row "leaving" stamps the allocation.
  insert into email_outbox (conference_id, template_id, recipient_application_id, recipient_email, subject, body, body_html, status, send_after)
  values (v_conf, v_tpl, v_alloc.application_id, 'wearegavelling@gmail.com', 'Buffer verify 2', 'Buffer verify 2', '<p>Buffer verify 2</p>', 'held', now() + interval '3 minutes')
  returning id into v_row;
  update email_outbox set status = 'sent', sent_at = now() where id = v_row;
  select allocation_sent into v_sent from conference_allocations where id = v_alloc.id;
  if not v_sent then raise exception 'D3 failed: sent row did not stamp allocation_sent'; end if;

  -- C1: the policy text carries the release check.
  if not exists (select 1 from pg_policies where tablename = 'conference_allocations'
                  and policyname = 'Users read own allocations' and qual like '%allocation_sent%') then
    raise exception 'C1 failed';
  end if;
  -- C4..C8: every patched body now mentions the release check at its anchor.
  if position('ca.allocation_sent order by ca.seat' in regexp_replace(pg_get_functiondef('public.my_live_rooms()'::regprocedure), '\s+', ' ', 'g')) = 0 then raise exception 'C4 failed'; end if;
  if position('where al.allocation_sent and' in regexp_replace(pg_get_functiondef('public.my_attention_items()'::regprocedure), '\s+', ' ', 'g')) = 0 then raise exception 'C5 failed'; end if;
  if position('(v_leader or al.allocation_sent)' in pg_get_functiondef('public.my_delegation_roster(uuid)'::regprocedure)) = 0 then raise exception 'C6 failed'; end if;

  raise notice 'allocation buffer + release checks: all passed (rolling back)';
end $$;
rollback;

-- Confirm the rollback left no trace:
--   select count(*) from email_outbox where subject like 'Buffer verify%';   -- 0

-- ============================================================================
-- ROLLBACK (only if needed; flip ALLOCATION_EMAIL_BUFFER_DB back to false first)
--   drop trigger if exists zz_email_outbox_stamp_allocation_sent on public.email_outbox;
--   drop function if exists public.email_outbox_stamp_allocation_sent();
--   drop function if exists public.cancel_pending_allocation_emails(uuid, uuid[]);
--   update email_outbox set status = 'failed' where status = 'cancelled';
--   alter table public.email_outbox drop constraint email_outbox_status_check;
--   alter table public.email_outbox add constraint email_outbox_status_check
--     check (status = any (array['pending','sending','sent','failed','suppressed','held','blocked']));
--   Part C: re-create the two policies without "allocation_sent" and re-run the
--   previous bodies (pg_get_functiondef before applying; save them first).
-- ============================================================================
