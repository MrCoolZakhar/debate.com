-- APPLIED 23 Oct 2026 from Claude Code at Peter's request (backfill: 312 rooms, 3,849 seats, group crests resolved).
-- Backfill: give every existing committee its session code (owner, 23 Oct 2026).
--
-- New committees now get their room when they are created (the committee editor, and the
-- creation wizard through start_my_chair_session). This one-off covers the committees that
-- already exist without one. NOT APPLIED: for the chat's Supabase work.
--
-- Scope (checked 23 Oct 2026): 1,156 committees have no code. 719 belong to Gavelling
-- listings (no organiser, never a room) and are left out. Of the other 437, 312 belong to 75
-- conferences that have not ended; only those are backfilled. Drop the end_date line to
-- include past conferences too (125 more rooms nobody will open).
--
-- Each room is built exactly like start_my_chair_session builds one (same row, same
-- current_speaker, seats from committee_country_slots, the link in the same transaction).
-- If you change that function, change this too.
--
-- Email: nothing here writes email_outbox. Once a committee has a code, the existing cron
-- chair-session-reminders sends its assigned chairs the usual "day before" and "morning of"
-- emails when their conference starts. That is the intended effect, not a side effect.

-- 1. Preview (writes nothing).
select c.slug, count(*) as committees
  from conference_committees cc
  join conferences c on c.id = cc.conference_id
 where cc.session_id is null and cc.session_code is null
   and c.listed_by is distinct from 'gavelling'
   and (c.end_date is null or c.end_date >= current_date)
 group by c.slug order by 2 desc;

-- 2. Backfill.
do $$
declare
  v_cc record; v_code text; v_suffix text; v_session_id uuid; v_attempt int;
  v_made int := 0; v_failed int := 0;
begin
  for v_cc in
    select cc.id, cc.name, cc.topics
      from conference_committees cc
      join conferences c on c.id = cc.conference_id
     where cc.session_id is null and cc.session_code is null
       and c.listed_by is distinct from 'gavelling'
       and (c.end_date is null or c.end_date >= current_date)
  loop
    perform pg_advisory_xact_lock(hashtext('start_chair_session:' || v_cc.id::text));
    -- Someone may have pressed Start while this ran.
    if exists (select 1 from conference_committees where id = v_cc.id
                and (session_id is not null or session_code is not null)) then
      continue;
    end if;

    v_session_id := null;
    for v_attempt in 1..5 loop
      v_code   := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      v_suffix := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
      begin
        insert into committees (code, name, topic, chair_names, phase,
                                speaker_time_limit, settings, session_origin)
        values (v_code, v_cc.name,
                coalesce(nullif(btrim((v_cc.topics)[1]), ''), 'TBD'),
                '{}'::text[], 'pre-session', 90,
                jsonb_build_object('chairJoinSuffix', v_suffix, 'separateChairCode', true),
                'conference')
        returning id into v_session_id;
        exit;
      exception when unique_violation then
        v_session_id := null;
      end;
    end loop;

    if v_session_id is null then v_failed := v_failed + 1; continue; end if;

    insert into current_speaker (committee_id, delegate_id, country, time_remaining)
    values (v_session_id, null, null, 90);

    insert into delegates (committee_id, country, status, is_observer, logo_url)
    select v_session_id, s.country_name, 'absent', s.is_observer, s.logo_url
      from committee_country_slots s
     where s.conference_committee_id = v_cc.id
     order by s.country_name;

    update conference_committees
       set session_id = v_session_id, session_code = v_code
     where id = v_cc.id;

    v_made := v_made + 1;
  end loop;
  raise notice 'rooms created: %, code collisions given up: %', v_made, v_failed;
end $$;

-- 3. Check (expect 0).
select count(*) from conference_committees cc join conferences c on c.id = cc.conference_id
 where cc.session_id is null and cc.session_code is null
   and c.listed_by is distinct from 'gavelling'
   and (c.end_date is null or c.end_date >= current_date);
