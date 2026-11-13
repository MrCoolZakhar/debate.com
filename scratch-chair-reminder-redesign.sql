-- =============================================================================
-- scratch-chair-reminder-redesign.sql
--
-- APPLIED 28 Oct 2026 from Claude Code at Peter's request, after the production deploy carried public/email/shots.
-- they should reflect and show what they can actually do through some images").
-- Apply through the chat's Supabase work, never from a Claude Code run.
--
-- What it changes: ONLY the content of the two chair reminder emails queued by
-- public.queue_chair_session_reminders() (cron `chair-session-reminders`, hourly).
-- Everything else is the live function exactly: the same two milestones (the
-- morning BEFORE the first day and the morning OF it, 08:00 conference time, a
-- 6-hour window), the same dedupe (chair_session_reminders), the same recipients,
-- the same facts (committee, session code, chair password), the same button
-- (Open my committee -> /join?mode=chair&code=...), the same renderer
-- (public.gavelling_email_html) and the same return value. No week-before email.
--
-- The images are real product screens captured from a standalone session
-- (public/email/shots, listed in public/email/README.md), served from
-- https://gavelling.com/email/shots/ through gavelling_email_asset_base_v2().
-- THEY ONLY EXIST THERE ONCE PRODUCTION DEPLOYS: apply this after the deploy
-- that carries public/email/shots/chair-*.jpg and delegate-phone.jpg.
--
--   Day before ("You are chairing <committee> tomorrow"): greeting, then four
--   things the chair can do, each a screenshot with one plain line (speakers
--   list and caucuses, motions ranked, voting with rights and veto, the
--   scoreboard for awards), then the codes, then "open it once tonight", then
--   the button. The four are drawn in p_hero_html (the renderer puts it under
--   the heading); the codes paragraph is p_card.split = 1 so it sits above the
--   facts.
--
--   Morning of ("<committee> opens today - your codes"): shorter and practical.
--   Greeting, the codes first, three steps for the first minutes, then two
--   screens as the renderer's own snapshots (the speakers list, and a delegate's
--   phone), then the button.
--
-- Preview without sending (a rolled-back transaction, nothing queued):
--   begin;
--   select public.gavelling_email_html(...);   -- the calls below, with sample values
--   rollback;
-- NEVER call queue_chair_session_reminders() to test: it inserts real email_outbox
-- rows for every chair in the window (CLAUDE.md §6).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.queue_chair_session_reminders()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record; v_queued int := 0; v_considered int := 0;
  v_chair_code text; v_join_url text; v_heading text; v_paras text[]; v_committee text;
  v_conf text; v_hero text; v_card jsonb; v_text text; f jsonb; v_i int;
  v_shots constant text := public.gavelling_email_asset_base_v2() || 'shots/';
  v_sans constant text := '''Helvetica Neue'',Helvetica,Arial,sans-serif';
  -- The day-before email's four things, in order. One plain line each.
  v_features constant jsonb := jsonb_build_array(
    jsonb_build_object(
      'img', 'chair-moderated-caucus.jpg',
      'alt', 'The chair console in a moderated caucus: Japan speaking with 0:41 left, the caucus clock at 14:41 and the queue down the side.',
      'title', 'Run the speakers list and every caucus from one screen',
      'line', 'Add delegations, start the clock and press Next. Caucuses start straight from a motion, and the speakers list is waiting for you when they end.'),
    jsonb_build_object(
      'img', 'chair-motions.jpg',
      'alt', 'Three motions on the floor, ranked: a Tour de Table first, then an unmoderated and a moderated caucus, each with the majority it needs.',
      'title', 'Motions, ranked for you',
      'line', 'Raised motions line up from most to least disruptive, with the majority each one needs. Accept one and the rest fall.'),
    jsonb_build_object(
      'img', 'chair-voting.jpg',
      'alt', 'Voting on a draft resolution: Kenya called to vote, with In favour, with rights, Pass and Against, and the tally below.',
      'title', 'Voting with rights and veto',
      'line', 'Call each delegation in turn. Votes with rights, passes and vetoes are handled, and the result is counted for you.'),
    jsonb_build_object(
      'img', 'chair-scoreboard.jpg',
      'alt', 'The scoreboard: delegations ranked by points, with their speeches and speaking time.',
      'title', 'A scoreboard for your awards',
      'line', 'Speeches, motions and papers are scored as they happen, so your awards rest on a record, not on memory.')
  );
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
      cross join lateral (values ('day_before'), ('morning')) as m(milestone)
     where c.start_date is not null and cc.session_code is not null
       and p.email is not null and c.status <> 'archived'
       and now() >= (((c.start_date - case when m.milestone='day_before' then 1 else 0 end)::text || ' 08:00')::timestamp
                     at time zone public.conference_timezone(c.country, c.timezone))
       and now() <  (((c.start_date - case when m.milestone='day_before' then 1 else 0 end)::text || ' 08:00')::timestamp
                     at time zone public.conference_timezone(c.country, c.timezone)) + interval '6 hours'
       and not exists (select 1 from chair_session_reminders x
                        where x.conference_committee_id = cc.id
                          and x.chair_user_id = u.chair_user_id and x.milestone = m.milestone)
  loop
    v_considered := v_considered + 1;
    v_committee := coalesce(nullif(r.abbreviation,''), r.committee_name);
    v_conf := coalesce(r.conference_name, r.acronym, 'Your conference');
    v_chair_code := case when coalesce(r.chair_suffix,'') <> ''
                         then r.chair_suffix else null end;
    v_join_url := 'https://gavelling.com/join?mode=chair&code=' || r.session_code;

    if r.milestone = 'day_before' then
      v_heading := 'You are chairing tomorrow';
      -- Greeting and intro, then the four things (screenshot, title, one line).
      v_hero := '<tr><td style="padding:4px 0 0 0;">'
        || public.gavelling_email_para_v2('Hi ' || r.chair_name || ',')
        || public.gavelling_email_para_v2(v_conf || ' opens **tomorrow** and you are on the dais for **' || v_committee || '**. Here is what you can do from your chair console.')
        || '</td></tr>';
      v_i := 0;
      for f in select * from jsonb_array_elements(v_features) loop
        v_i := v_i + 1;
        v_hero := v_hero || '<tr><td style="padding:' || case when v_i = 1 then '14' else '30' end || 'px 0 0 0;">'
          || '<img src="' || public.gavelling_email_esc(v_shots || (f->>'img')) || '" width="528" alt="' || public.gavelling_email_esc(f->>'alt') || '" '
          || 'style="display:block;width:100%;max-width:528px;height:auto;border:1px solid #DDD4C0;border-radius:14px;margin:0;box-shadow:0 14px 30px -16px rgba(27,56,40,0.45);font-family:' || v_sans || ';font-size:13px;line-height:1.5;color:#574B40;" />'
          || '<div class="e-ink" style="font-family:' || v_sans || ';font-size:17px;line-height:1.35;font-weight:bold;color:#1C1410;padding-top:16px;">' || public.gavelling_email_esc(f->>'title') || '</div>'
          || '<div class="e-soft" style="font-family:' || v_sans || ';font-size:15px;line-height:1.55;color:#574B40;padding-top:4px;">' || public.gavelling_email_esc(f->>'line') || '</div>'
          || '</td></tr>';
      end loop;
      v_paras := array[
        'Your codes for tomorrow. Delegates join with the **session code**; the **chair password** gives you the dais.',
        'Open it **once tonight** and try a few buttons, so the first time is not in front of your delegates. Nothing to install: it runs in a browser.'
      ];
      v_card := jsonb_build_object('split', 1, 'pill_icon', 'chairs',
        'preheader', v_conf || ' opens tomorrow. What you can do from your chair console, and your codes for ' || v_committee || '.');
      v_text := 'Hi ' || r.chair_name || ',' || chr(10) || chr(10)
        || v_conf || ' opens tomorrow and you are on the dais for ' || v_committee || '. Here is what you can do from your chair console:' || chr(10) || chr(10)
        || (select string_agg('- ' || (x->>'title') || ': ' || (x->>'line'), chr(10)) from jsonb_array_elements(v_features) x) || chr(10) || chr(10)
        || 'Open it once tonight and try a few buttons, so the first time is not in front of your delegates. Nothing to install: it runs in a browser.';
    else
      v_heading := 'Your committee opens today';
      v_hero := null;
      v_paras := array[
        'Hi ' || r.chair_name || ',' || chr(10) || chr(10) ||
        'Today is the day. Here is everything you need to gavel in **' || v_committee || '**.',
        '- [icon:checkin] Take **roll call** first, then press **Begin Session**' || chr(10) ||
        '- [icon:sessions] Press the **session code** at the top of your screen to show it full size with a QR code, so delegates can join on their phones' || chr(10) ||
        '- [icon:clock] Add speakers and press **Start**. Motions, caucuses and voting all run from the same screen'
      ];
      v_card := jsonb_build_object('split', 1, 'pill_icon', 'chairs',
        'preheader', 'Your codes for ' || v_committee || ' today, and how to start.',
        'snapshots', jsonb_build_array(
          jsonb_build_object('url', v_shots || 'chair-speakers-list.jpg', 'width', 528,
            'alt', 'The chair console: France speaking with 1:07 left, and the speakers list along the top and down the side.',
            'caption', 'Your console: the speakers list and the clock, with motions, documents and voting one tap away.'),
          jsonb_build_object('url', v_shots || 'delegate-phone.jpg', 'width', 260,
            'alt', 'A delegate''s phone: Kenya is first in the queue, with the speakers list, Submit document and Chat.',
            'caption', 'What delegates see on their phones once they join with the session code.')
        ));
      v_text := 'Hi ' || r.chair_name || ',' || chr(10) || chr(10)
        || 'Today is the day. Here is everything you need to gavel in ' || v_committee || '.' || chr(10) || chr(10)
        || '- Take roll call first, then press Begin Session' || chr(10)
        || '- Press the session code at the top of your screen to show it full size with a QR code, so delegates can join on their phones' || chr(10)
        || '- Add speakers and press Start. Motions, caucuses and voting all run from the same screen';
    end if;

    insert into email_outbox (conference_id, recipient_email, subject, body, body_html, status)
    values (
      r.conference_id, r.chair_email,
      case when r.milestone='day_before'
        then 'You are chairing ' || v_committee || ' tomorrow'
        else v_committee || ' opens today - your codes' end,
      v_text || chr(10) || chr(10) ||
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
        'Open my committee', v_join_url, null, v_hero, v_card
      ),
      'pending'
    );

    insert into chair_session_reminders (conference_committee_id, chair_user_id, milestone)
    values (r.committee_id, r.chair_user_id, r.milestone) on conflict do nothing;
    v_queued := v_queued + 1;
  end loop;

  return jsonb_build_object('ok', true, 'considered', v_considered, 'queued', v_queued);
end $function$;

-- Check after applying (read only):
-- select pg_get_functiondef('public.queue_chair_session_reminders'::regproc);
