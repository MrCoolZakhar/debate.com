-- APPLIED 23 Oct 2026 from Claude Code at Peter's request (migrations delegation_allocation_notices_opt_in + _fix_order), WITH TWO CHANGES: (1) OPT-IN per conference: only an ENABLED delegation_allocations template row sends (no stub, no default ON); enabled for WorldMUN only. (2) applications has no created_at: ordered by submitted_at, id; head delegates by role OR is_head_delegate. Cron delegation-allocation-notices (every 5 min) scheduled. One-off send to WorldMUN: 12 leaders, 10 delegations, all sent. Section C NOT applied.
-- scratch-delegation-allocation-email.sql
-- DRAFT, NOT APPLIED. Apply only through the chat's Supabase work (CLAUDE.md:
-- every database object is changed only there). Written 21 Oct 2026.
--
-- Peter, 21 Oct 2026: "An email should go to the delegations once they receive
-- allocations. Think about when it is sent: about 15 minutes after no activity;
-- if there is still activity the timer resets. It is also shown on their
-- dashboard then."
--
-- Today a delegation's OPEN block seats (conference_allocations with society_id
-- set and no person: given by organiser_give_society_seats, taken back by
-- organiser_take_back_society_seat) send no email, and leaders see them at once
-- through my_delegation_open_seats. Individuals keep their own email
-- (allocation_assigned, src/lib/allocationEmail.ts); nothing here touches it.
--
-- DESIGN
--   A. societies.allocations_changed_at   stamped by a trigger every time an
--      OPEN block seat is inserted or deleted (the give and take-back RPCs, and
--      any later path that writes block seats). Debounce: each stamp resets the
--      15-minute timer.
--      societies.allocations_notified_at  stamped when the notice went out.
--   B. queue_delegation_allocation_notices(p_send boolean default false)
--      For each society whose changed_at is older than 15 minutes and newer than
--      its notified_at: ONE email per leader (accepted head delegates and
--      faculty advisors), listing every seat the delegation now holds (country,
--      committee) with a link to the conference page, then stamps notified_at.
--      p_send = false (THE DEFAULT) previews and inserts nothing: the only
--      `insert into email_outbox` is inside `if p_send then`.
--      The cron (every 5 minutes, section D, commented out) passes true.
--   C. OPTIONAL, separate file section after the commit: leaders see block seats
--      only once notified. Changes what leaders see; owners decide.
--
-- EMAIL RULES KEPT
--   * Template row enabled=false for event 'delegation_allocations' = no email,
--     but notified_at is still stamped (so the dashboard release in C never
--     waits on an email the organiser turned off).
--   * No row = ON (ESSENTIAL_DEFAULT_ON_EVENTS on the client), stub written the
--     first time it fires, exactly like co_delegate_assigned.
--   * profiles.notify_email_applications = false skips; email_address_failed()
--     skips; one row per address per society.
--   * email_send_id is null, so the bulk allowance does not count it.
--   * The two-per-hour cap (email_outbox_rate_cap) and email_pause apply on
--     insert, as for every sender.
--   * Copy mirrors DEFAULT_EMAILS.delegation_allocations in src/lib/defaultEmails.ts:
--     change one, change the other.
--
-- NEVER call queue_delegation_allocation_notices(true) to test. Testing is the
-- preview (no argument) or the rolled-back block at the end of this file.

begin;

-- ── A. Columns and the debounce stamp ──────────────────────────────────────
alter table public.societies
  add column if not exists allocations_changed_at timestamptz,
  add column if not exists allocations_notified_at timestamptz;

comment on column public.societies.allocations_changed_at is
  'Last time an open block seat was given to or taken back from this delegation. Set by trigger conference_allocations_society_changed.';
comment on column public.societies.allocations_notified_at is
  'Last time the leaders were told about the delegation''s seats (queue_delegation_allocation_notices).';

-- Backfill: every delegation that already holds seats counts as notified now,
-- so applying this emails nobody about old seats and (with section C) nobody
-- loses sight of a seat they already see.
update public.societies s
   set allocations_notified_at = now()
 where s.allocations_notified_at is null
   and exists (select 1 from public.conference_allocations ca where ca.society_id = s.id);

create or replace function public._society_allocations_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r record;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  -- Only an OPEN block seat is the organiser giving or taking back. A seat
  -- with a person in it goes through allocation_assigned as before.
  if r.society_id is not null and r.user_id is null and r.application_id is null then
    update public.societies set allocations_changed_at = now() where id = r.society_id;
  end if;
  return null;
end $function$;

revoke all on function public._society_allocations_changed() from public, anon, authenticated;

drop trigger if exists conference_allocations_society_changed on public.conference_allocations;
create trigger conference_allocations_society_changed
  after insert or delete on public.conference_allocations
  for each row execute function public._society_allocations_changed();

-- ALTERNATIVE to the trigger (do not apply both): stamp inside the two RPCs.
--   organiser_give_society_seats, right after
--       select coalesce(array_agg(ins.id), '{}'::uuid[]) into v_ids from ins;
--     add
--       update societies set allocations_changed_at = now() where id = p_society;
--   organiser_take_back_society_seat, right after
--       delete from conference_allocations where id = v_seat.id;
--     add
--       update societies set allocations_changed_at = now() where id = v_seat.society_id;
-- The trigger is preferred: it also covers any later writer of block seats.

-- ── B. The notice ──────────────────────────────────────────────────────────
create or replace function public.queue_delegation_allocation_notices(p_send boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s record; conf record; tpl record; r record; seat record;
  v_quiet constant interval := interval '15 minutes';
  v_max_facts constant int := 20;
  v_facts jsonb; v_count int; v_more int;
  v_first boolean; v_drafted boolean;
  v_subject text; v_body text; v_heading text; v_paras text[]; v_html text; v_cta text;
  v_name text; v_list text;
  v_societies int := 0; v_queued int := 0; v_preview jsonb := '[]'::jsonb;
begin
  for s in
    select so.id, so.name, so.conference_id, so.allocations_changed_at, so.allocations_notified_at
      from societies so
     where so.allocations_changed_at is not null
       and so.allocations_changed_at < now() - v_quiet
       and (so.allocations_notified_at is null or so.allocations_changed_at > so.allocations_notified_at)
     order by so.allocations_changed_at
     for update skip locked
  loop
    v_societies := v_societies + 1;
    v_first := s.allocations_notified_at is null;
    select id, slug, full_name, acronym, end_date into conf from conferences where id = s.conference_id;

    -- Every seat the delegation holds now, open or filled.
    v_facts := jsonb_build_array(jsonb_build_object('label', 'Delegation', 'value', s.name));
    v_count := 0; v_list := '';
    for seat in
      select ca.country_code, ca.country_name, cc.name as committee, cc.abbreviation, cc.logo_url
        from conference_allocations ca
        join conference_committees cc on cc.id = ca.conference_committee_id
       where ca.society_id = s.id
       order by coalesce(nullif(btrim(coalesce(cc.abbreviation, '')), ''), cc.name), ca.country_name, ca.seat
    loop
      v_count := v_count + 1;
      v_list := v_list || E'\n' || seat.country_name || ', '
                || coalesce(nullif(btrim(coalesce(seat.abbreviation, '')), ''), seat.committee);
      if v_count <= v_max_facts then
        v_facts := v_facts || jsonb_build_array(jsonb_build_object(
          'label', coalesce(nullif(btrim(coalesce(seat.abbreviation, '')), ''), seat.committee),
          'value', seat.country_name,
          'flag', seat.country_code,
          'logo', seat.logo_url,
          'sub', case when nullif(btrim(coalesce(seat.abbreviation, '')), '') is not null then seat.committee end));
      end if;
    end loop;
    v_more := greatest(v_count - v_max_facts, 0);

    -- Template: an explicit OFF wins; a missing row is ON (stub written once).
    select id, enabled, subject, body into tpl from email_templates
     where conference_id = s.conference_id and event_key = 'delegation_allocations';
    if p_send and tpl.id is null then
      insert into email_templates (conference_id, event_key, name, subject, body, body_blocks, enabled, delivery)
      values (s.conference_id, 'delegation_allocations', 'Delegation allocations', '', '', '[]'::jsonb, true, 'immediate')
      on conflict (conference_id, event_key) do nothing;
      select id, enabled, subject, body into tpl from email_templates
       where conference_id = s.conference_id and event_key = 'delegation_allocations';
    end if;

    -- Nothing to say after the conference, or when the organiser turned it off,
    -- or when a first notice would list no seats. notified_at is still stamped.
    if (tpl.id is null or tpl.enabled)
       and (conf.end_date is null or conf.end_date >= current_date)
       and not (v_first and v_count = 0) then

      v_drafted := btrim(coalesce(tpl.subject, '')) <> '' and btrim(coalesce(tpl.body, '')) <> '';

      for r in
        select distinct on (lower(btrim(coalesce(nullif(btrim(p.email), ''), a.invited_email))))
               a.id as application_id,
               btrim(coalesce(nullif(btrim(p.email), ''), a.invited_email)) as email,
               coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(a.invited_name), '')) as name,
               p.notify_email_applications as pref
          from applications a
          left join profiles p on p.id = a.user_id
         where a.society_id = s.id
           and a.conference_id = s.conference_id
           and a.role in ('head-delegate', 'faculty-advisor')
           and a.status in ('accepted', 'assigned', 'checked-in')
           and coalesce(nullif(btrim(p.email), ''), nullif(btrim(a.invited_email), '')) is not null
         order by lower(btrim(coalesce(nullif(btrim(p.email), ''), a.invited_email))),
                  case a.role when 'faculty-advisor' then 0 else 1 end, a.created_at
      loop
        continue when r.pref is false;
        continue when public.email_address_failed(r.email);

        v_name := coalesce(r.name, 'there');
        if v_drafted then
          v_subject := replace(replace(replace(tpl.subject,
            '{{delegate_name}}', v_name), '{{delegation_name}}', s.name), '{{conference_name}}', coalesce(conf.full_name, ''));
          v_body := replace(replace(replace(tpl.body,
            '{{delegate_name}}', v_name), '{{delegation_name}}', s.name), '{{conference_name}}', coalesce(conf.full_name, ''));
          v_subject := regexp_replace(v_subject, '\{\{\w+\}\}', '', 'g');
          v_body := regexp_replace(v_body, '\{\{\w+\}\}', '', 'g');
          v_heading := btrim(regexp_replace(v_subject, '\s*[-—–:]\s*[^-—–:]+$', ''));
          select array_agg(btrim(x)) into v_paras
            from regexp_split_to_table(replace(v_body, chr(13), ''), '\n[ \t]*\n') x where btrim(x) <> '';
        else
          -- Mirror of DEFAULT_EMAILS.delegation_allocations (defaultEmails.ts).
          v_subject := 'Your delegation''s seats for ' || coalesce(conf.full_name, 'your conference');
          v_heading := case when v_first then 'Your delegation has its seats'
                            else 'Your delegation''s seats have changed' end;
          v_paras := array[
            'Hi ' || v_name || ',',
            case when v_count = 0
                 then 'The organising team has taken back the seats ' || s.name || ' held at '
                      || coalesce(conf.full_name, 'the conference') || '. Your delegation has no seats right now.'
                 else 'The organising team has given ' || s.name || ' its seats at '
                      || coalesce(conf.full_name, 'the conference') || '. Place your delegates in them from your delegation page.' end];
        end if;
        if v_more > 0 then
          v_paras := v_paras || ('And ' || v_more || ' more seat' || case when v_more = 1 then '' else 's' end
                                 || ' on your delegation page.');
        end if;
        if not v_drafted then
          v_body := array_to_string(v_paras, E'\n\n') || case when v_list <> '' then E'\n\nYour seats:' || v_list else '' end;
        end if;
        v_cta := 'https://gavelling.com/conferences/' || conf.slug || '/role';

        if p_send then
          v_html := public.gavelling_email_html(
            s.conference_id,
            coalesce(nullif(v_heading, ''), 'Your delegation has its seats'),
            coalesce(v_paras, array[v_body]),
            v_facts,
            'Open my delegation', v_cta);
          insert into email_outbox (conference_id, template_id, recipient_application_id, recipient_email,
                                    subject, body, body_html, status)
          values (s.conference_id, tpl.id, r.application_id, r.email, v_subject, v_body, v_html, 'pending');
          v_queued := v_queued + 1;
        else
          v_preview := v_preview || jsonb_build_array(jsonb_build_object(
            'society', s.name, 'conference', conf.acronym, 'to', r.email,
            'subject', v_subject, 'seats', v_count));
        end if;
      end loop;
    end if;

    if p_send then
      update societies set allocations_notified_at = now() where id = s.id;
    end if;
  end loop;

  return jsonb_build_object('sent', p_send, 'societies', v_societies, 'queued', v_queued,
                            'preview', case when p_send then null else v_preview end);
end $function$;

-- Cron and the chat only. Never callable from the client.
revoke all on function public.queue_delegation_allocation_notices(boolean) from public, anon, authenticated;

commit;

-- ── D. Schedule (owners, after a preview and a test to the team inbox) ─────
-- select cron.schedule('delegation-allocation-notices', '*/5 * * * *',
--   $$select public.queue_delegation_allocation_notices(true)$$);


-- ═══════════════════════════════════════════════════════════════════════════
-- C. OPTIONAL: SEATS SHOW ON LEADERS' DASHBOARDS ONLY ONCE NOTIFIED
--    Changes what leaders see. Apply only on an owner's yes.
--    Rule: an OPEN block seat is shown to a leader once it existed when the
--    delegation was last notified (created_at <= allocations_notified_at).
--    Organisers still see every seat at once. A taken-back seat disappears at
--    once (it is deleted). The backfill in section A keeps every existing seat
--    visible. A seat given while the email template is OFF is still released
--    by the cron (notified_at is stamped either way).
--    Only my_delegation_open_seats changes: my_delegation_seats lists PEOPLE,
--    and a leader can only place someone in a seat they can see.
-- ═══════════════════════════════════════════════════════════════════════════
/*
begin;

create or replace function public.my_delegation_open_seats(p_society uuid)
 returns table(allocation_id uuid, conference_committee_id uuid, committee text, abbreviation text, logo_url text, country_code text, country_name text, country_logo_url text, seat smallint, delegation_size integer)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_conf uuid;
  v_released timestamptz;
  v_org boolean;
begin
  if v_uid is null then
    raise exception 'Please sign in again.' using errcode = 'P0001', hint = 'signed_out';
  end if;
  select s.conference_id, s.allocations_notified_at into v_conf, v_released from societies s where s.id = p_society;
  if v_conf is null then
    raise exception 'We could not find this delegation.' using errcode = 'P0001', hint = 'not_found';
  end if;
  v_org := is_conference_organizer(v_conf);
  if not exists (select 1 from applications a
                  where a.society_id = p_society and a.user_id = v_uid
                    and a.status not in ('rejected', 'withdrawn'))
     and not v_org then
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
     -- NEW: released once the delegation was notified (organisers see all).
     and (v_org or (v_released is not null and ca.created_at <= v_released))
   order by cc.name, ca.country_name, ca.seat;
end $function$;

-- And in delegation_place_member, right after the not_block_seat check, so a
-- stale screen cannot place someone in a seat not yet released:
--   if not is_conference_organizer(v_seat.conference_id)
--      and not exists (select 1 from conference_allocations ca join societies so on so.id = ca.society_id
--                       where ca.id = v_seat.id and so.allocations_notified_at is not null
--                         and ca.created_at <= so.allocations_notified_at) then
--     return jsonb_build_object('ok', false, 'code', 'seat_not_released',
--       'error', 'This seat is not ready yet. Try again in a few minutes.');
--   end if;
-- (add 'seat_not_released' to CONSTRAINT_MESSAGES only if the client surfaces codes that way)

commit;
*/


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY (run AFTER the migration; everything here ROLLS BACK)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Preview: inserts nothing, stamps nothing.
--    select public.queue_delegation_allocation_notices();
--
-- 2. Rolled-back send, with an assertion that nothing survives:
/*
begin;
do $$
declare v_before int; v_after int; v_res jsonb;
begin
  select count(*) into v_before from email_outbox;
  v_res := public.queue_delegation_allocation_notices();          -- preview
  select count(*) into v_after from email_outbox;
  if v_after <> v_before then raise exception 'preview wrote % outbox rows', v_after - v_before; end if;
  v_res := public.queue_delegation_allocation_notices(true);      -- inside this transaction only
  raise notice 'would queue: %', v_res;
end $$;
rollback;

-- After the rollback: nothing from this event may exist in the outbox.
select count(*) as must_be_zero
  from email_outbox o join email_templates t on t.id = o.template_id
 where t.event_key = 'delegation_allocations';
*/
