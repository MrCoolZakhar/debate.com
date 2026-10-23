-- ============================================================================
-- scratch-conference-rooms.sql
--
-- NOT APPLIED. For the chat's Supabase work (owner rule: every database object
-- is changed only through the chat's Supabase work, never from a Claude Code run).
-- Drafted 23 Oct 2026 from the live definitions (read with pg_get_functiondef on
-- project luruhkwrgisytejswlas), owner-approved items of "conference committees and
-- their live rooms".
--
-- Every section is independent and can be applied on its own. Each one ends with a
-- READ-ONLY check query and a note of what the client expects. The client works
-- both before and after each section is applied.
--
-- !! SECTION C5 REWRITES A LIVE SENDER (queue_chair_session_reminders, cron
-- !! `chair-session-reminders`, hourly at :07). Applying it changes what real chairs
-- !! receive at the next :07. NEVER call the function to test it (CLAUDE.md §6):
-- !! test inside `begin; ... rollback;` only, or not at all.
--
-- Sections:
--   C1 + C8  start_my_chair_session: a retired room is replaced (fresh room, relinked);
--            seats get their group's flag in custom committees; duplicate slots skipped
--   C3       apply_due_broadcast_action: the organiser applies a due Pause / End from
--            the live wall when no chair device was open
--   C5       queue_chair_session_reminders: 'week_before' and 'day_before', no 'morning',
--            test conferences skipped
--   C6       send_press_release: only during the conference's days
--   C11      claim_delegate_seat + my_live_rooms: an allocation held through its
--            application (allocation user_id null) counts for the application's user
--   C12      enter_live_chair_room: an assigned chair takes the gavel from a holder
--            who is not an assigned chair
--   CP2      session_reserved_seat_hint: no address (not even masked) to anyone
--   CP3      (no database change; why)
-- ============================================================================


-- ============================================================================
-- C1 + C8. start_my_chair_session
--
-- C1 (owner, 23 Oct 2026: "fix it"). A conference room ended more than 24 hours ago
-- could never be used again: this function handed the ended room back, and Restart
-- only worked for 24 hours (7 rooms were stuck during their conferences). The client
-- now keeps a conference room restartable until the end of its conference's last day
-- (src/lib/roomRetention.ts `reopenWindowEndsAt`, src/lib/conferenceRoomWindow.ts).
-- Past that instant the room is RETIRED, and this function mints a fresh room and
-- relinks the committee to it. The retired room is kept (conference rooms are never
-- auto-deleted), only unlinked. Still idempotent: a live room, a suspended room, or
-- an ended room inside its window is handed back unchanged, under the same lock.
--
-- The window, mirrored EXACTLY from the client:
--   greatest(ended_at + 24 hours,
--            23:59 on coalesce(end_date, start_date) in the conference's timezone,
--            or in Etc/GMT+12 (UTC-12, where a day ends last) when none is stored)
--
-- C8. Seat flags. The editor resolves a seat's art as its own flag, else, in a CUSTOM
-- committee, its group's flag (resolveSeatArt in src/components/committeeSetupKit.tsx
-- -> effectiveSlotArt in src/lib/slotGroups.ts: own logo_url if set; else the group
-- whose id = slot.group_id, if that group has a logo_url; a group counts only when its
-- id and name are strings). This function copied only s.logo_url, so a seat that
-- inherits its party's flag showed nothing on the floor. Mirrored below.
--
-- Also: a duplicate country in the slots no longer fails the whole seat insert
-- (`delegates` is UNIQUE (committee_id, country)): `on conflict do nothing`.
-- ============================================================================

create or replace function public.start_my_chair_session(p_committee uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cc          record;
  v_uid         uuid := auth.uid();
  v_code        text;
  v_suffix      text;
  v_session_id  uuid;
  v_seats       int := 0;
  v_attempt     int;
  v_ended       timestamptz;
  v_conf        record;
  v_tz          text;
  v_limit       timestamptz;
  v_retired     uuid := null;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out',
      'message', 'Sign in to start your committee room.');
  end if;

  select cc.id, cc.conference_id, cc.name, cc.topics, cc.session_id, cc.session_code,
         cc.chair_user_ids, cc.committee_type, cc.groups
    into v_cc
    from conference_committees cc
   where cc.id = p_committee;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found',
      'message', 'That committee no longer exists.');
  end if;

  if not (v_uid = any (coalesce(v_cc.chair_user_ids, '{}'::uuid[]))
          or is_conference_organizer(v_cc.conference_id)) then
    return jsonb_build_object('ok', false, 'reason', 'denied',
      'message', 'Only this committee''s chairs and the organising team can start its room.');
  end if;

  -- One room per committee at a time: two chairs pressing in the same instant must
  -- produce one room, so take the committee's own lock before looking.
  perform pg_advisory_xact_lock(hashtext('start_chair_session:' || p_committee::text));

  select cc.session_id, cc.session_code into v_session_id, v_code
    from conference_committees cc where cc.id = p_committee;

  if v_session_id is not null and v_code is not null then
    select cm.ended_at into v_ended from committees cm where cm.id = v_session_id;
    if v_ended is null then
      -- Live, suspended, or (row missing: impossible, the FK sets session_id null).
      return jsonb_build_object('ok', true, 'created', false,
        'code', v_code, 'session_id', v_session_id);
    end if;

    select c.start_date, c.end_date, c.timezone into v_conf
      from conferences c where c.id = v_cc.conference_id;
    v_tz := case when v_conf.timezone is not null
                  and exists (select 1 from pg_timezone_names z where z.name = v_conf.timezone)
                 then v_conf.timezone else 'Etc/GMT+12' end;
    v_limit := v_ended + interval '24 hours';
    if coalesce(v_conf.end_date, v_conf.start_date) is not null then
      v_limit := greatest(v_limit,
        ((coalesce(v_conf.end_date, v_conf.start_date))::text || ' 23:59')::timestamp at time zone v_tz);
    end if;
    if now() < v_limit then
      -- Ended, but still restartable from the chair page: hand it back.
      return jsonb_build_object('ok', true, 'created', false,
        'code', v_code, 'session_id', v_session_id);
    end if;
    -- Retired: mint a fresh room below and relink. The old room stays as history.
    v_retired := v_session_id;
    v_session_id := null;
  end if;

  for v_attempt in 1..5 loop
    v_code   := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    v_suffix := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
    begin
      insert into committees (code, name, topic, chair_names, phase,
                              speaker_time_limit, settings, session_origin)
      values (v_code,
              v_cc.name,
              coalesce(nullif(btrim((v_cc.topics)[1]), ''), 'TBD'),
              '{}'::text[],
              'pre-session',
              90,
              jsonb_build_object('chairJoinSuffix', v_suffix, 'separateChairCode', true),
              'conference')
      returning id into v_session_id;
      exit;
    exception when unique_violation then
      v_session_id := null;   -- code collision, try another
    end;
  end loop;

  if v_session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_code',
      'message', 'Could not create a session code just now. Please try again.');
  end if;

  insert into current_speaker (committee_id, delegate_id, country, time_remaining)
  values (v_session_id, null, null, 90);

  -- C8: own flag, else (custom committees) the group's flag, exactly like resolveSeatArt.
  insert into delegates (committee_id, country, status, is_observer, logo_url)
  select v_session_id, s.country_name, 'absent', s.is_observer,
         coalesce(
           nullif(btrim(coalesce(s.logo_url, '')), ''),
           case when v_cc.committee_type = 'custom' and nullif(btrim(coalesce(s.group_id, '')), '') is not null then
             (select nullif(btrim(coalesce(g->>'logo_url', '')), '')
                from jsonb_array_elements(case when jsonb_typeof(v_cc.groups) = 'array' then v_cc.groups else '[]'::jsonb end) g
               where jsonb_typeof(g->'id') = 'string' and jsonb_typeof(g->'name') = 'string'
                 and g->>'id' = s.group_id
               limit 1)
           end)
    from committee_country_slots s
   where s.conference_committee_id = p_committee
   order by s.country_name
  on conflict (committee_id, country) do nothing;
  select count(*) into v_seats from delegates where committee_id = v_session_id;

  -- THE LINK IS THE WHOLE POINT, in the same transaction as the room, so a room can never
  -- exist unlinked.
  update conference_committees
     set session_id = v_session_id, session_code = v_code
   where id = p_committee;

  return jsonb_build_object('ok', true, 'created', true,
    'code', v_code, 'session_id', v_session_id, 'seats', v_seats,
    'replaced', v_retired);
end
$function$;

-- Read-only check: rooms that would be RETIRED today (each would get a fresh room on
-- its next "Start your committee room"), and custom-committee seats whose group flag
-- the old function dropped.
--   select cc.id, c.slug, cm.code, cm.ended_at,
--          greatest(cm.ended_at + interval '24 hours',
--            ((coalesce(c.end_date, c.start_date))::text || ' 23:59')::timestamp at time zone
--              coalesce(nullif(c.timezone, ''), 'Etc/GMT+12')) as restartable_until
--     from conference_committees cc
--     join committees cm on cm.id = cc.session_id
--     join conferences c on c.id = cc.conference_id
--    where cm.ended_at is not null
--    order by restartable_until;
--   select cc.name, s.country_name, d.logo_url as room_flag
--     from conference_committees cc
--     join committee_country_slots s on s.conference_committee_id = cc.id
--     join delegates d on d.committee_id = cc.session_id and d.country = s.country_name
--    where cc.committee_type = 'custom' and nullif(s.logo_url, '') is null and s.group_id is not null;
--
-- What the client expects: `{ ok, created, code, session_id }` as before, plus
-- `replaced` (the retired room's id, or null). The editor (CommitteeEditorModal
-- doCreate) still fixes group flags up through the session client after this call;
-- with C8 applied it finds nothing to write. The chair's dashboard
-- (participant/ChairParticipant.tsx) shows "Start your committee room" for a retired
-- room; before C1 is applied this function hands the ended room back (`created:
-- false`) and the dashboard says "Your last room has ended and cannot be restarted.
-- Ask the organizing team for a new room."


-- ============================================================================
-- C3. apply_due_broadcast_action (NEW)
--
-- A scheduled organiser Pause / End is carried out by the Moderator's chair device,
-- and only when that device is open within five minutes of `action_at` (the chair
-- page's grace, BROADCAST_LATE_FIRE_GRACE_MS). The live wall now says per room "Not
-- applied yet in UNSC, no chair device open" and offers "Pause now" / "End it now",
-- which calls this function per broadcast row.
--
-- The same single-update shape as the chair console (suspendDebateInDB /
-- endDebateInDB in src/lib/committeeService.ts): the caucus total frozen at its live
-- value (a moderated caucus capped at the running speaker clock's zero, like
-- moderatedCaucusRemainingNow), the speaker clock paused at its live value, one
-- conditional update of the committee row.
--
-- Honest limits (the chair console does these, a server cannot): the floor speech is
-- not logged. On a PAUSE the floor holder stays seated with the clock paused, so the
-- first Next after the resume logs the whole speech once (nothing is logged twice).
-- On an END the floor is cleared (an ended room may be restarted and must not come
-- back with a phantom speaker), so that last speech is not logged; held GSL turns and
-- a Room Order tour are not credited.
--
-- Refuses when the room has been written to since `action_at` (a chair device was
-- active, so it either applied the action or the room carried on deliberately): an
-- organiser press must never re-pause a room a chair resumed.
-- ============================================================================

create or replace function public.apply_due_broadcast_action(p_broadcast uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_b        session_broadcasts%rowtype;
  v_cm       committees%rowtype;
  v_cs       record;
  v_caucus   jsonb;
  v_base     numeric;
  v_until    timestamptz;
  v_elapsed  numeric;
  v_live     int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out', 'message', 'Sign in again to do this.');
  end if;
  select * into v_b from session_broadcasts where id = p_broadcast;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'That broadcast no longer exists.');
  end if;
  if v_b.conference_id is null or not is_conference_organizer(v_b.conference_id) then
    return jsonb_build_object('ok', false, 'reason', 'denied', 'message', 'Only the organising team can do this.');
  end if;
  if v_b.kind <> 'actionable' or v_b.action is null or v_b.action not in ('pause', 'end') or v_b.action_at is null then
    return jsonb_build_object('ok', false, 'reason', 'not_actionable', 'message', 'That broadcast does not pause or end anything.');
  end if;
  if v_b.action_at > now() then
    return jsonb_build_object('ok', false, 'reason', 'not_due', 'message', 'It is not due yet.');
  end if;
  if v_b.expires_at is not null and v_b.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'That broadcast has expired. Send a new one.');
  end if;

  select * into v_cm from committees where id = v_b.committee_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'That room no longer exists.');
  end if;
  if v_cm.ended_at is not null or (v_b.action = 'pause' and v_cm.suspended_at is not null) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  -- The live wall's own test (APPLIED_SLACK_MS in BroadcastComposer.tsx): any write to
  -- the room since one minute before the moment means a chair device was active.
  if v_cm.updated_at is not null and v_cm.updated_at >= v_b.action_at - interval '1 minute' then
    return jsonb_build_object('ok', false, 'reason', 'chair_active',
      'message', 'A chair device has been active in this room since then. Ask the chairs.');
  end if;

  select time_remaining, started_at into v_cs from current_speaker where committee_id = v_cm.id;

  -- The caucus total, frozen at its live value (pauseCaucusLive).
  v_caucus := v_cm.caucus;
  if v_caucus is not null and jsonb_typeof(v_caucus) = 'object' and nullif(v_caucus->>'totalStartedAt', '') is not null then
    v_base := coalesce((v_caucus->>'remainingTime')::numeric, 0);
    v_until := now();
    if v_caucus->>'type' = 'moderated' and v_cs.started_at is not null then
      v_until := least(now(), v_cs.started_at + make_interval(secs => greatest(0, coalesce(v_cs.time_remaining, 0))));
    end if;
    v_elapsed := greatest(0, round(extract(epoch from (v_until - (v_caucus->>'totalStartedAt')::timestamptz))));
    v_caucus := v_caucus || jsonb_build_object('remainingTime', greatest(0, round(v_base - v_elapsed)), 'totalStartedAt', null);
  end if;

  -- The speaker clock, paused at its live value (pauseSpeakerClockLive).
  if v_cs.started_at is not null then
    v_live := greatest(0, round(coalesce(v_cs.time_remaining, 0) - extract(epoch from (now() - v_cs.started_at))))::int;
    update current_speaker set started_at = null, time_remaining = v_live
     where committee_id = v_cm.id and started_at = v_cs.started_at;
  end if;

  if v_b.action = 'pause' then
    update committees
       set suspended_at = now(), phase = 'adjourned', caucus = v_caucus
     where id = v_cm.id and ended_at is null and suspended_at is null;
  else
    if v_caucus is not null and jsonb_typeof(v_caucus) = 'object' then
      v_caucus := v_caucus || jsonb_build_object('currentSpeaker', null, 'floorSince', null);
    end if;
    update current_speaker
       set delegate_id = null, country = null, time_remaining = 0, started_at = null, seated_at = null
     where committee_id = v_cm.id;
    update committees
       set ended_at = now(), expires_at = now() + interval '24 hours', phase = 'adjourned', caucus = v_caucus
     where id = v_cm.id and ended_at is null;
  end if;

  return jsonb_build_object('ok', true, 'applied', v_b.action);
end
$function$;

revoke all on function public.apply_due_broadcast_action(uuid) from public, anon;
grant execute on function public.apply_due_broadcast_action(uuid) to authenticated;

-- Read-only check: due actionable broadcasts whose room shows no sign of them.
--   select b.id, b.action, b.action_at, cm.code, cm.suspended_at, cm.ended_at, cm.updated_at
--     from session_broadcasts b join committees cm on cm.id = b.committee_id
--    where b.kind = 'actionable' and b.action_at <= now()
--      and (b.expires_at is null or b.expires_at > now())
--      and cm.ended_at is null
--      and not (b.action = 'pause' and cm.suspended_at is not null)
--      and (cm.updated_at is null or cm.updated_at < b.action_at - interval '1 minute');
--
-- What the client expects: `rpc('apply_due_broadcast_action', { p_broadcast })` ->
-- `{ ok: true, applied | already }` or `{ ok: false, message }` (shown as is). Before
-- this exists the call answers PGRST202 and the wall says "Applying it from here is
-- not switched on yet. Ask a chair to open their room."


-- ============================================================================
-- C5. queue_chair_session_reminders: a week before and a day before
--
-- Owner, 23 Oct 2026: "there should be no organisers release date anymore anyways, so
-- it just goes out 1 week before and 1 day before." Milestones are now:
--   'week_before'  from 08:00 conference time 7 days before the start, and kept
--                  open until the day-before email's moment, so a chair assigned
--                  during that week still gets it once (the copy names the date
--                  rather than saying "in a week");
--   'day_before'   08:00 conference time the day before, a 6-hour window as before.
-- 'morning' is dropped (old rows stay; the CHECK still allows them). Test conferences
-- (`conference_is_test`) are skipped. Dedupe stays `chair_session_reminders`
-- (PK conference_committee_id, chair_user_id, milestone). No em dashes in the copy.
--
-- The chair's page shows the room code from 7 days before the start too
-- (participant/shared.tsx `chairRoomOpensAt`), the same day as the first email.
--
-- DO NOT RUN THE FUNCTION. It sends to real chairs. Cron `chair-session-reminders`
-- (hourly at :07) picks the new body up on its own.
-- ============================================================================

alter table public.chair_session_reminders drop constraint if exists chair_session_reminders_milestone_check;
alter table public.chair_session_reminders add constraint chair_session_reminders_milestone_check
  check (milestone = any (array['week_before'::text, 'day_before'::text, 'morning'::text]));

create or replace function public.queue_chair_session_reminders()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record; v_queued int := 0; v_considered int := 0;
  v_chair_code text; v_join_url text; v_heading text; v_paras text[]; v_committee text;
  v_when text; v_subject text;
begin
  for r in
    select cc.id as committee_id, cc.name as committee_name, cc.abbreviation,
           cc.logo_url as committee_logo, cc.session_code,
           s.settings->>'chairJoinSuffix' as chair_suffix,
           c.id as conference_id, c.slug, c.full_name as conference_name, c.acronym, c.start_date,
           u.chair_user_id, p.email as chair_email, coalesce(p.display_name,'there') as chair_name,
           m.milestone
      from conference_committees cc
      join conferences c on c.id = cc.conference_id
      left join committees s on s.id = cc.session_id
      cross join lateral unnest(coalesce(cc.chair_user_ids, array[]::uuid[])) as u(chair_user_id)
      join profiles p on p.id = u.chair_user_id
      cross join lateral (values ('week_before'), ('day_before')) as m(milestone)
     where c.start_date is not null and cc.session_code is not null
       and p.email is not null and c.status <> 'archived'
       and not coalesce(c.dates_tbd, false)
       and not public.conference_is_test(c.slug, c.full_name, c.is_demo)
       and (
         (m.milestone = 'week_before'
           and now() >= (((c.start_date - 7)::text || ' 08:00')::timestamp
                         at time zone public.conference_timezone(c.country, c.timezone))
           and now() <  (((c.start_date - 1)::text || ' 08:00')::timestamp
                         at time zone public.conference_timezone(c.country, c.timezone)))
         or
         (m.milestone = 'day_before'
           and now() >= (((c.start_date - 1)::text || ' 08:00')::timestamp
                         at time zone public.conference_timezone(c.country, c.timezone))
           and now() <  (((c.start_date - 1)::text || ' 08:00')::timestamp
                         at time zone public.conference_timezone(c.country, c.timezone)) + interval '6 hours')
       )
       and not exists (select 1 from chair_session_reminders x
                        where x.conference_committee_id = cc.id
                          and x.chair_user_id = u.chair_user_id and x.milestone = m.milestone)
  loop
    v_considered := v_considered + 1;
    v_committee := coalesce(nullif(r.abbreviation,''), r.committee_name);
    v_chair_code := case when coalesce(r.chair_suffix,'') <> ''
                         then r.chair_suffix else null end;
    v_join_url := 'https://gavelling.com/join?mode=chair&code=' || r.session_code;
    v_when := to_char(r.start_date, 'FMDay FMDD FMMonth');

    if r.milestone = 'week_before' then
      v_heading := 'Your committee room is ready';
      v_subject := 'Your ' || v_committee || ' room is ready';
      v_paras := array[
        'Hi ' || r.chair_name || ',' || chr(10) || chr(10) ||
        coalesce(r.conference_name, r.acronym, 'Your conference') ||
        ' starts on **' || v_when || '** and you are on the dais for **' || v_committee ||
        '**. Your room is ready and your codes are below.',
        'Everything you need to run the room is in one screen:',
        '- **Roll call**, then the general **speakers list**, with the timer running' || chr(10) ||
        '- **Moderated and unmoderated caucuses**, started straight from a motion' || chr(10) ||
        '- **Motions** raised from delegates'' own devices, sorted by disruptiveness' || chr(10) ||
        '- **Voting**, including rights of reply and veto rules if your committee uses them' || chr(10) ||
        '- **Working papers and draft resolutions**, submitted and introduced in the room' || chr(10) ||
        '- **Speaking time** recorded per delegate, so your awards rest on evidence rather than memory',
        'Open it **once before the day**, so the first time is not in front of your delegates. It runs in a browser, so there is nothing to install.',
        'Delegates join with the **session code**. The **chair password** is what gives you the dais.'
      ];
    else
      v_heading := 'You are chairing tomorrow';
      v_subject := 'You are chairing ' || v_committee || ' tomorrow';
      v_paras := array[
        'Hi ' || r.chair_name || ',' || chr(10) || chr(10) ||
        coalesce(r.conference_name, r.acronym, 'Your conference') ||
        ' opens **tomorrow** and you are on the dais for **' || v_committee || '**. Your codes are below.',
        'Once you are in: take **roll call**, open the **speakers list**, and run caucuses, motions and voting from the same screen. Delegates raise motions from their own phones, and **speaking time is recorded** as you go.',
        'Worth opening it **once tonight** rather than for the first time in front of your delegates. Nothing to install: it runs in a browser.',
        'Delegates join with the **session code**. The **chair password** is what gives you the dais.'
      ];
    end if;

    insert into email_outbox (conference_id, recipient_email, subject, body, body_html, status)
    values (
      r.conference_id, r.chair_email,
      v_subject,
      replace(array_to_string(v_paras, chr(10) || chr(10)), '**', '') || chr(10) || chr(10) ||
        'Committee: ' || r.committee_name || chr(10) ||
        'Session code (delegates use this): ' || r.session_code || chr(10) ||
        coalesce('Your chair password: ' || v_chair_code || chr(10), '') ||
        'Open your committee: ' || v_join_url,
      public.gavelling_email_html(
        r.conference_id, v_heading, v_paras,
        (jsonb_build_array(
            jsonb_build_object('label','Committee','value', r.committee_name,
                               'icon', coalesce(r.committee_logo,'')),
            jsonb_build_object('label','Session code','value', r.session_code))
         || case when v_chair_code is not null
              then jsonb_build_array(jsonb_build_object('label','Your chair password','value', v_chair_code))
              else '[]'::jsonb end),
        'Open my committee', v_join_url, null
      ),
      'pending'
    );

    insert into chair_session_reminders (conference_committee_id, chair_user_id, milestone)
    values (r.committee_id, r.chair_user_id, r.milestone) on conflict do nothing;
    v_queued := v_queued + 1;
  end loop;

  return jsonb_build_object('ok', true, 'considered', v_considered, 'queued', v_queued);
end $function$;

-- Read-only check (sends nothing): who the next runs would email, per milestone.
--   select m.milestone, c.slug, cc.name, count(*) as chairs
--     from conference_committees cc
--     join conferences c on c.id = cc.conference_id
--     cross join lateral unnest(coalesce(cc.chair_user_ids, array[]::uuid[])) as u(chair_user_id)
--     join profiles p on p.id = u.chair_user_id
--     cross join lateral (values ('week_before'), ('day_before')) as m(milestone)
--    where c.start_date between current_date and current_date + 8
--      and cc.session_code is not null and p.email is not null and c.status <> 'archived'
--      and not coalesce(c.dates_tbd, false)
--      and not public.conference_is_test(c.slug, c.full_name, c.is_demo)
--      and not exists (select 1 from chair_session_reminders x where x.conference_committee_id = cc.id
--                        and x.chair_user_id = u.chair_user_id and x.milestone = m.milestone)
--    group by 1, 2, 3 order by 2, 1;
--
-- What the client expects: nothing reads the milestones. The chair's page shows the
-- code from 7 days before the start; the organiser release columns
-- (released_to_chairs_at, released_to_delegates_at, session_release_*) are no longer
-- written by any client and no longer decide anything (see the report for readers).


-- ============================================================================
-- C6. send_press_release: only during the conference
--
-- Owner, 23 Oct 2026: press releases only during the conference. Refused outside the
-- conference's days: from 00:00 on the start day to 23:59:59 on the last day, in the
-- conference's time (conference_timezone, which maps the country when no timezone is
-- stored); dates to be decided (or no start date): refused. Everything else unchanged.
-- The Press Desk (src/app/conferences/[slug]/press/PressReleaseComposer.tsx) hides the
-- form outside those days with one line; with no timezone stored it uses the widest
-- window on earth, so the form never hides when this function would accept, and this
-- function's sentence covers the rest.
-- ============================================================================

create or replace function public.send_press_release(p_conference uuid, p_message text, p_image_url text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_access jsonb;
  v_allow jsonb;
  v_msg text := btrim(coalesce(p_message, ''));
  v_img text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_label text;
  v_release uuid;
  v_sent int := 0;
  v_rooms int;
  v_conf record;
  v_tz text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out', 'message', 'Sign in to send a press release.');
  end if;
  v_access := _press_access(p_conference, v_uid);
  if not coalesce((v_access->>'can_release')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'denied',
      'message', 'Only the press of this conference can send a press release.');
  end if;

  -- C6: only during the conference's days.
  select c.start_date, coalesce(c.end_date, c.start_date) as last_day, coalesce(c.dates_tbd, false) as tbd,
         public.conference_timezone(c.country, c.timezone) as tz
    into v_conf from conferences c where c.id = p_conference;
  if v_conf.start_date is null or v_conf.tbd then
    return jsonb_build_object('ok', false, 'reason', 'not_during',
      'message', 'Press releases open once the conference has dates.');
  end if;
  v_tz := case when exists (select 1 from pg_timezone_names z where z.name = v_conf.tz) then v_conf.tz else 'UTC' end;
  if now() < (v_conf.start_date::timestamp at time zone v_tz) then
    return jsonb_build_object('ok', false, 'reason', 'not_during',
      'message', 'Press releases open when the conference starts.');
  end if;
  if now() >= ((v_conf.last_day + 1)::timestamp at time zone v_tz) then
    return jsonb_build_object('ok', false, 'reason', 'not_during',
      'message', 'The conference has ended, so press releases are closed.');
  end if;

  if char_length(v_msg) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty', 'message', 'Write your press release first.');
  end if;
  if char_length(v_msg) > 600 then
    return jsonb_build_object('ok', false, 'reason', 'too_long', 'message', 'A press release can be up to 600 characters.');
  end if;
  if v_img is not null and v_img !~ (
       '^https://luruhkwrgisytejswlas\.supabase\.co/storage/v1/object/public/conference-assets/broadcasts/'
       || p_conference::text || '-[0-9]{10,16}\.[a-z0-9]{1,8}$') then
    return jsonb_build_object('ok', false, 'reason', 'image', 'message', 'That image could not be attached. Upload it again.');
  end if;

  perform pg_advisory_xact_lock(hashtext('press_release:' || p_conference::text || ':' || v_uid::text));
  v_allow := _press_allowance(p_conference, v_uid);
  if (v_allow->>'releases_left')::int <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'limit',
      'message', 'You have sent 3 press releases in the last 24 hours.',
      'next_release_at', v_allow->'next_release_at', 'releases_left', 0);
  end if;

  select count(*) into v_rooms
    from conference_committees cc
    join committees c on c.id = cc.session_id
   where cc.conference_id = p_conference and c.ended_at is null;
  if v_rooms = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_rooms',
      'message', 'No committee room is open yet. Send it once the rooms have started.');
  end if;

  v_label := left(btrim(v_access->>'label'), 80);
  insert into press_releases (conference_id, author_id, author_label, author_role, message, image_url)
  values (p_conference, v_uid, v_label, v_access->>'role', v_msg, v_img)
  returning id into v_release;

  insert into session_broadcasts (committee_id, conference_id, kind, message, image_url, action, action_at,
                                  created_by, expires_at, source, author_label)
  select c.id, p_conference, 'informational', v_msg, v_img, null, null, v_uid, now(), 'press', v_label
    from conference_committees cc
    join committees c on c.id = cc.session_id
   where cc.conference_id = p_conference and c.ended_at is null;
  get diagnostics v_sent = row_count;

  update press_releases set sent_to = v_sent where id = v_release;

  return jsonb_build_object('ok', true, 'sent_to', v_sent, 'release_id', v_release)
         || _press_allowance(p_conference, v_uid);
end;
$function$;

-- Read-only check: conferences whose press desk is open right now.
--   select c.slug, c.start_date, coalesce(c.end_date, c.start_date) as last_day,
--          public.conference_timezone(c.country, c.timezone) as tz
--     from conferences c
--    where exists (select 1 from conference_committees cc where cc.conference_id = c.id and cc.committee_type = 'press')
--      and not coalesce(c.dates_tbd, false) and c.start_date is not null
--      and now() >= (c.start_date::timestamp at time zone public.conference_timezone(c.country, c.timezone))
--      and now() <  ((coalesce(c.end_date, c.start_date) + 1)::timestamp at time zone public.conference_timezone(c.country, c.timezone));
--
-- What the client expects: the same answer shape; a refusal's `message` is shown as is
-- (`sendPressRelease` in src/lib/press.ts).


-- ============================================================================
-- C11. An allocation held through its application
--
-- Seat reservation matched only `conference_allocations.user_id`; 8 allocations carry
-- the application's user (`applications.user_id` through `application_id`) with a null
-- allocation user, so their delegates were refused their own seat ('reserved') and
-- never saw the room in my_live_rooms. `seat_claim_is_reserved` already counts such an
-- allocation as reserved (user_id OR application_id), so it is unchanged. Both
-- functions below are the live text with that one match widened.
-- ============================================================================

create or replace function public.claim_delegate_seat(p_code text, p_country text, p_token text default null::text, p_takeover boolean default true)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_c record; v_cc uuid; v_seat text; v_cap int; v_uid uuid := auth.uid();
  v_dev text := seat_claim_device_hash(p_token); v_holder text; v_mine uuid; v_n int;
  v_req text := trim(coalesce(p_country, '')); v_match text; v_elsewhere boolean := false;
  v_expired timestamptz := now() - interval '65 minutes';
begin
  select id, session_origin, ended_at into v_c
    from committees where code = upper(trim(coalesce(p_code, '')));
  if v_c.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_c.session_origin = 'conference' then
    v_cc := seat_claim_conference_committee(v_c.id);
  end if;

  select d.country into v_seat from delegates d
   where d.committee_id = v_c.id and lower(d.country) = lower(v_req)
   order by d.country limit 1;

  v_match := coalesce(v_seat, v_req);
  if v_match <> '' and seat_claim_is_reserved(v_cc, v_match) then
    if v_uid is null then
      return jsonb_build_object('ok', false, 'reason', 'signin');
    end if;
    -- C11: the allocation's own user, OR (when it has none) its application's user.
    if not exists (select 1 from conference_allocations a
                   left join applications ap on ap.id = a.application_id
                   where a.conference_committee_id = v_cc
                     and (a.user_id = v_uid or (a.user_id is null and ap.user_id = v_uid))
                     and (lower(a.country_name) = lower(v_match) or lower(a.country_code) = lower(v_match))) then
      return jsonb_build_object('ok', false, 'reason', 'reserved');
    end if;
  end if;

  if v_seat is null then
    return jsonb_build_object('ok', false, 'reason', 'no_seat');
  end if;

  if v_c.ended_at is not null then
    return jsonb_build_object('ok', true, 'reason', 'ended');
  end if;

  if v_uid is not null then
    v_holder := 'u:' || v_uid::text;
  elsif v_dev is not null then
    v_holder := 'd:' || v_dev;
  else
    return jsonb_build_object('ok', false, 'reason', 'no_token');
  end if;

  v_cap := seat_claim_capacity(v_cc, v_seat);

  perform pg_advisory_xact_lock(hashtextextended('delegate_seat_holder:' || v_c.id::text || ':' || v_holder, 0));
  if v_dev is not null and v_holder <> 'd:' || v_dev then
    perform pg_advisory_xact_lock(hashtextextended('delegate_seat_holder:' || v_c.id::text || ':d:' || v_dev, 0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('delegate_seat:' || v_c.id::text || ':' || lower(v_seat), 0));

  if exists (select 1 from delegate_seat_kicks k
              where k.committee_id = v_c.id and lower(k.country) = lower(v_seat)
                and k.kicked_at > now() - interval '10 minutes'
                and (k.holder_key = v_holder or (v_dev is not null and k.device_hash = v_dev))) then
    delete from delegate_seat_claims s
     where s.committee_id = v_c.id and lower(s.country) = lower(v_seat)
       and (s.holder_key = v_holder or (v_dev is not null and s.device_hash = v_dev));
    return jsonb_build_object('ok', false, 'reason', 'kicked');
  end if;

  delete from delegate_seat_claims s
   where s.committee_id = v_c.id and s.last_seen_at < v_expired
     and (lower(s.country) = lower(v_seat)
          or s.holder_key = v_holder
          or (v_dev is not null and s.device_hash = v_dev));

  if v_uid is not null then
    select exists (select 1 from delegate_seat_claims s
                    where s.committee_id = v_c.id and s.holder_key = v_holder
                      and s.device_hash is distinct from v_dev)
      into v_elsewhere;
    if v_elsewhere and not coalesce(p_takeover, true) then
      return jsonb_build_object('ok', false, 'reason', 'other_device', 'capacity', v_cap);
    end if;
  end if;

  select s.id into v_mine from delegate_seat_claims s
   where s.committee_id = v_c.id and lower(s.country) = lower(v_seat)
     and (s.holder_key = v_holder
          or (v_dev is not null and s.device_hash = v_dev and (v_uid is null or s.holder_key like 'd:%')))
   order by (s.holder_key = v_holder) desc
   limit 1;

  if v_mine is null then
    select count(*) into v_n from delegate_seat_claims s
     where s.committee_id = v_c.id and lower(s.country) = lower(v_seat);
    if v_n >= v_cap then
      return jsonb_build_object('ok', false, 'reason', 'taken', 'capacity', v_cap);
    end if;
    insert into delegate_seat_claims (committee_id, country, holder_key, device_hash)
    values (v_c.id, v_seat, v_holder, v_dev)
    returning id into v_mine;
  else
    update delegate_seat_claims
       set last_seen_at = now(),
           holder_key = case when v_uid is not null then v_holder else holder_key end,
           device_hash = case when v_uid is not null then v_dev else coalesce(v_dev, device_hash) end
     where id = v_mine;
  end if;

  delete from delegate_seat_claims s
   where s.committee_id = v_c.id and s.id <> v_mine
     and (s.holder_key = v_holder
          or (v_dev is not null and s.device_hash = v_dev and (v_uid is null or s.holder_key like 'd:%')));

  return jsonb_build_object('ok', true,
                            'reason', case when v_n is null and not v_elsewhere then 'mine' else 'claimed' end,
                            'capacity', v_cap);
end $function$;

create or replace function public.my_live_rooms()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with me as (
    select auth.uid() as uid
  ),
  confs as (
    select c.*
    from conferences c
    where c.start_date is not null
      and (now() at time zone (
            case
              when c.timezone is not null
                and exists (select 1 from pg_timezone_names z where z.name = c.timezone)
              then c.timezone
              else 'UTC'
            end
          ))::date between c.start_date and coalesce(c.end_date, c.start_date)
  ),
  rooms as (
    select
      cc.id as cc_id, cc.conference_id, cc.chair_user_ids,
      jsonb_build_object(
        'conference_committee_id', cc.id,
        'conference_id', cc.conference_id,
        'session_id', cm.id,
        'committee_name', cc.name,
        'committee_abbreviation', cc.abbreviation,
        'committee_logo_url', cc.logo_url,
        'conference_name', c.full_name,
        'conference_acronym', c.acronym,
        'conference_logo_url', c.logo_url,
        'conference_country', c.country,
        'conference_slug', c.slug,
        'start_date', c.start_date,
        'end_date', coalesce(c.end_date, c.start_date),
        'session_code', cm.code,
        'topic', coalesce(
          nullif(nullif(btrim(cm.topic), ''), 'TBD'),
          nullif(btrim(cc.topics[1]), ''),
          nullif(btrim(cm.topic), '')
        ),
        'phase', cm.phase,
        'suspended', cm.suspended_at is not null,
        'started', cm.phase is distinct from 'pre-session',
        'chair_names', coalesce(cm.chair_names, '{}'::text[]),
        'chair_count', coalesce(array_length(cm.chair_names, 1), 0),
        'head_chair', nullif(btrim(coalesce(cm.settings->>'headChair', '')), ''),
        'delegate_count', (select count(*) from delegates d where d.committee_id = cm.id),
        'present_count', (select count(*) from delegates d where d.committee_id = cm.id and d.status <> 'absent'),
        'present_countries', coalesce((
          select jsonb_agg(x.country order by x.country)
          from (
            select d.country from delegates d
            where d.committee_id = cm.id and d.status <> 'absent'
            order by d.country limit 10
          ) x
        ), '[]'::jsonb)
      ) as base,
      (cm.phase is distinct from 'pre-session' and cm.suspended_at is null) as in_session,
      c.full_name as conf_name, cc.name as cc_name, c.start_date
    from conference_committees cc
    join confs c on c.id = cc.conference_id
    join committees cm on cm.id = cc.session_id
    where cm.ended_at is null and cm.code is not null
  ),
  items as (
    select 1 as prio, c.start_date, c.full_name as conf_name, '' as cc_name,
      jsonb_build_object(
        'role', 'organiser',
        'conference_id', c.id,
        'conference_name', c.full_name,
        'conference_acronym', c.acronym,
        'conference_logo_url', c.logo_url,
        'conference_country', c.country,
        'conference_slug', c.slug,
        'start_date', c.start_date,
        'end_date', coalesce(c.end_date, c.start_date),
        'live_count', (select count(*) from rooms r where r.conference_id = c.id),
        'in_session_count', (select count(*) from rooms r where r.conference_id = c.id and r.in_session)
      ) as item
    from me
    join conference_organizers o on o.user_id = me.uid
    join confs c on c.id = o.conference_id
    where exists (select 1 from rooms r where r.conference_id = c.id)
    union all
    select 2, r.start_date, r.conf_name, r.cc_name, r.base || jsonb_build_object('role', 'chair')
    from me join rooms r on me.uid = any(coalesce(r.chair_user_ids, '{}'::uuid[]))
    union all
    select 3, r.start_date, r.conf_name, r.cc_name,
      r.base || jsonb_build_object('role', 'delegate', 'country_name', a.country_name, 'country_code', a.country_code, 'seat', a.seat)
    from me
    join rooms r on true
    join lateral (
      select ca.country_name, ca.country_code, ca.seat
      from conference_allocations ca
      left join applications ap on ap.id = ca.application_id
      -- C11: the allocation's own user, OR (when it has none) its application's user.
      where ca.conference_committee_id = r.cc_id
        and (ca.user_id = me.uid or (ca.user_id is null and ap.user_id = me.uid))
      order by ca.seat nulls last, ca.created_at
      limit 1
    ) a on true
    union all
    select 4, r.start_date, r.conf_name, r.cc_name,
      r.base || jsonb_build_object(
        'role', 'advisor',
        'students_in_room', (
          select count(*)
          from conference_allocations ca
          left join applications ap2 on ap2.id = ca.application_id
          where ca.conference_committee_id = r.cc_id
            and adv.society_id is not null
            and (ca.society_id = adv.society_id or ap2.society_id = adv.society_id)
            and (ca.user_id is not null or ap2.id is not null)
            and (ap2.id is null or ap2.status not in ('withdrawn', 'rejected'))
        )
      )
    from me
    join rooms r on true
    join lateral (
      select coalesce(ap.society_id, (
        select s.id from societies s
        where s.conference_id = r.conference_id and s.advisor_user_id = me.uid
        order by s.created_at limit 1
      )) as society_id
      from applications ap
      where ap.conference_id = r.conference_id and ap.user_id = me.uid
        and ap.role = 'faculty-advisor' and ap.status in ('accepted', 'assigned', 'checked-in')
      order by (ap.society_id is null), ap.submitted_at nulls last, ap.id
      limit 1
    ) adv on true
  )
  select coalesce(jsonb_agg(i.item order by i.prio, i.start_date, i.conf_name, i.cc_name), '[]'::jsonb)
  from items i
  where (select uid from me) is not null;
$function$;

-- Read-only check: the allocations this widens (expected 8 on 23 Oct 2026).
--   select a.id, a.conference_committee_id, a.country_name, ap.user_id
--     from conference_allocations a join applications ap on ap.id = a.application_id
--    where a.user_id is null and ap.user_id is not null;
--
-- What the client expects: nothing new. A delegate whose allocation is held through
-- their application now gets 'mine' / 'claimed' instead of 'reserved' on /delegate,
-- and their room in the profile menu's Live now and the "Your room is live" prompt.
-- Client readers that still match `conference_allocations.user_id` only (not changed
-- here): verifyConferenceAccess in src/lib/conferenceAccess.ts (the join page's
-- locked-seat shortcut), see the report.


-- ============================================================================
-- C12. enter_live_chair_room: assigned chairs take the gavel from an open-dais holder
--
-- Whoever joined an open dais first (by the chair password, before chairs were
-- assigned) kept the gavel after real chairs were assigned, because this function
-- claims the gavel only when nobody holds it. Now: when an ASSIGNED chair (in
-- chair_user_ids) enters and the current holder's NAME is not an assigned chair's
-- name, the assigned chair takes the gavel (headChair + headChairDevice, a key-level
-- merge, never the blob). An assigned chair's names are their profile name (trimmed),
-- the local part of their email (chairIdentity in src/lib/liveRooms.ts), and the
-- "<name> (chair)" / "<name> (chair N)" forms safeChairName gives a name that equals a
-- seat. A holder who IS an assigned chair keeps the gavel exactly as before.
-- ============================================================================

create or replace function public.enter_live_chair_room(p_code text, p_name text, p_device text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_cm committees%rowtype;
  v_head text;
  v_started boolean := false;
  v_took_over boolean := false;
  v_holder_assigned boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if v_name = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_name');
  end if;
  v_name := left(v_name, 80);

  select cm.* into v_cm
  from committees cm
  join conference_committees cc on cc.session_id = cm.id
  where upper(cm.code) = upper(btrim(coalesce(p_code, '')))
    and cm.ended_at is null
    and v_uid = any(coalesce(cc.chair_user_ids, '{}'::uuid[]))
  limit 1
  for update of cm;

  if v_cm.id is null then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;

  if not (coalesce(v_cm.chair_names, '{}'::text[]) @> array[v_name]) then
    update committees
       set chair_names = array_append(coalesce(chair_names, '{}'::text[]), v_name)
     where id = v_cm.id;
  end if;

  v_head := nullif(btrim(coalesce(v_cm.settings->>'headChair', '')), '');

  if v_head is not null and v_head <> v_name then
    -- C12: is the holder one of this committee's assigned chairs?
    select exists (
      select 1
        from conference_committees cc2
        join profiles p on p.id = any(coalesce(cc2.chair_user_ids, '{}'::uuid[]))
       where cc2.session_id = v_cm.id
         and (
           (nullif(btrim(coalesce(p.display_name, '')), '') is not null
             and (v_head = btrim(p.display_name) or v_head like btrim(p.display_name) || ' (chair%'))
           or (nullif(split_part(coalesce(p.email, ''), '@', 1), '') is not null
             and (v_head = split_part(p.email, '@', 1) or v_head like split_part(p.email, '@', 1) || ' (chair%'))
         )
    ) into v_holder_assigned;
    if not v_holder_assigned then
      update committees
         set settings = coalesce(settings, '{}'::jsonb)
           || jsonb_build_object('headChair', v_name, 'headChairDevice', nullif(btrim(coalesce(p_device, '')), ''))
       where id = v_cm.id;
      v_head := v_name;
      v_took_over := true;
    end if;
  end if;

  if v_head is null then
    update committees
       set settings = coalesce(settings, '{}'::jsonb)
         || jsonb_build_object('headChair', v_name, 'headChairDevice', nullif(btrim(coalesce(p_device, '')), ''))
     where id = v_cm.id;
    v_head := v_name;
    v_started := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'started', v_started,
    'took_over', v_took_over,
    'moderator', v_head = v_name,
    'head_chair', v_head,
    'chair_name', v_name,
    'chair_count', (select coalesce(array_length(chair_names, 1), 0) from committees where id = v_cm.id),
    'phase', v_cm.phase,
    'present_count', (select count(*) from delegates d where d.committee_id = v_cm.id and d.status <> 'absent')
  );
end;
$function$;

-- Read-only check: live conference rooms whose gavel is held by a name that is not
-- an assigned chair's (each would move to the next assigned chair who enters).
--   select cm.code, cm.settings->>'headChair' as holder, cc.chair_user_ids
--     from committees cm join conference_committees cc on cc.session_id = cm.id
--    where cm.ended_at is null and cardinality(coalesce(cc.chair_user_ids, '{}')) > 0
--      and nullif(btrim(coalesce(cm.settings->>'headChair', '')), '') is not null
--      and not exists (select 1 from profiles p where p.id = any(cc.chair_user_ids)
--                        and (cm.settings->>'headChair' in (btrim(coalesce(p.display_name, '')), split_part(coalesce(p.email, ''), '@', 1))
--                             or cm.settings->>'headChair' like btrim(coalesce(p.display_name, '')) || ' (chair%'));
--
-- What the client expects: `moderator: true` when the take happened (plus the new
-- `took_over`). resolveEntryHref (src/lib/liveRooms.ts) then opens the chair page,
-- whose name now holds the gavel, so that device claims it on load (newest wins);
-- the old holder's device drops to Commenter with the usual handover card. No client
-- change is needed.


-- ============================================================================
-- CP2. session_reserved_seat_hint: no address to anyone
--
-- Owner, 23 Oct 2026: a seat reserved by an unclaimed import tells the person to
-- create an account (or sign in) with the email the conference invited them with,
-- and "never reveal the email to an anonymous visitor". The join page
-- (src/app/join/page.tsx ReservedHintPanel) already stopped showing the masked
-- address and the initial; it reads only `has_account` (false = an unclaimed import:
-- create an account; true: sign in). This stops the RPC returning them at all, so the
-- masked address and the initial are not even in the response.
-- ============================================================================

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
      'email', null,
      'initial', null,
      'has_account', (a.user_id is not null or ap.user_id is not null)
    ) as h
    from conference_allocations a
    left join applications ap on ap.id = a.application_id
    where a.conference_committee_id = v_cc
      and (a.user_id is not null or a.application_id is not null)
      and (lower(a.country_name) = lower(trim(p_country)) or lower(a.country_code) = lower(trim(p_country)))
    limit 4
  ) s;
  return jsonb_build_object('ok', true, 'hints', v_hints);
end $function$;

-- Read-only check: the answer for one reserved seat carries no address.
--   select public.session_reserved_seat_hint('<CODE>', '<Country>');   -- STABLE, writes nothing
--
-- What the client expects: `{ ok, hints: [{ seat, email: null, initial: null,
-- has_account }] }`. `getReservedSeatHint` (src/app/join/reservedSeatHint.ts) already
-- treats a null email and initial as normal.


-- ============================================================================
-- CP3. The secretariat's silent view of a chair room: NO DATABASE CHANGE
--
-- The live wall's "Open chair room" opens /chair/<CODE>?secretariat=1
-- (src/lib/secretariatView.ts). The chair page already admits a conference organiser
-- of THIS conference (verifyConferenceAccess answers 'organizer', which the chair
-- page allows) without the chair password, and the silent view never calls
-- enter_live_chair_room: it has no chair name, so it is never appended to chair_names,
-- never claims the gavel, takes no chair_device_claims row, joins no presence channel
-- and is forced to a read-only Commenter on the page. So enter_live_chair_room does not
-- need an organiser mode, and adding one would only create a way to write a name. If
-- the owners want the server to record secretariat visits, that is a separate,
-- write-free function to draft later.
-- ============================================================================
