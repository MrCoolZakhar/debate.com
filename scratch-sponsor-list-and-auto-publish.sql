-- Sponsor list campaign and the 3-day go-live (Peter, 20 Oct 2026).
-- Applied from Claude Code with Peter's one-off approval (migration
-- sponsor_list_and_auto_publish). Kept as the record of what is live.
--
-- PART 1: A new conference goes live by itself 3 days after it is created,
-- and only once it has a logo. The wizard no longer publishes on create.
-- PART 2: The sponsor list (Google Sheet, "anyone with the link can view")
-- is emailed once to every organiser of a verified conference, and a one-off
-- teaser goes to organisers who are not verified yet.

-- ── PART 1: go live in 3 days, logo required ─────────────────────────────

alter table public.conferences add column if not exists auto_publish_at timestamptz;

comment on column public.conferences.auto_publish_at is
  'When an organiser-made draft goes live by itself (publish_due_conferences). Set to created + 3 days on insert, cleared by any change to is_public. Needs a logo to go live.';

create or replace function public.conferences_set_auto_publish()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not coalesce(new.is_public, false)
       and coalesce(new.listed_by, 'organiser') <> 'gavelling'
       and new.auto_publish_at is null then
      new.auto_publish_at := now() + interval '3 days';
    end if;
  elsif new.is_public is distinct from old.is_public then
    -- Published or unpublished by hand (or by the job): the organiser has
    -- decided, so nothing publishes it again behind their back.
    new.auto_publish_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_conferences_auto_publish on public.conferences;
create trigger trg_conferences_auto_publish
  before insert or update of is_public on public.conferences
  for each row execute function public.conferences_set_auto_publish();

create or replace function public.publish_due_conferences()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  v_done int := 0;
begin
  for r in
    select id from conferences
     where auto_publish_at is not null
       and auto_publish_at <= now()
       and not coalesce(is_public, false)
       and status = 'private'
       and coalesce(listed_by, 'organiser') <> 'gavelling'
       and nullif(btrim(coalesce(logo_url, '')), '') is not null
  loop
    begin
      update conferences set is_public = true, status = 'public', auto_publish_at = null
       where id = r.id and not coalesce(is_public, false);
      if found then v_done := v_done + 1; end if;
    exception when others then
      -- One refused row never stops the others; it is tried again next run.
      raise warning 'publish_due_conferences: % not published: %', r.id, sqlerrm;
    end;
  end loop;
  return v_done;
end $$;

revoke all on function public.publish_due_conferences() from public, anon, authenticated;
revoke all on function public.conferences_set_auto_publish() from public, anon, authenticated;

select cron.schedule('auto-publish-conferences', '*/15 * * * *', 'select public.publish_due_conferences()');

-- ── PART 2: the sponsor list emails ──────────────────────────────────────

alter table public.conference_setup_nudges drop constraint conference_setup_nudges_cadence_check;
alter table public.conference_setup_nudges add constraint conference_setup_nudges_cadence_check
  check (cadence = any (array['daily','weekly','milestone','superseded','chairs','checkmark','intent','sponsors']));

-- p_mode 'verified': every organiser of a verified conference who has not had
--   the list yet (variant 70). Scheduled hourly, so a newly verified
--   conference's team gets it within the hour.
-- p_mode 'teaser': organisers of active, unverified conferences who have no
--   verified conference and have not had the teaser (variant 71). One-off.
-- One email per ADDRESS per mode, whatever the number of conferences.
-- PREVIEW IS THE DEFAULT and inserts nothing. p_test_to sends exactly one
-- email (the first match) to that address and records nothing.
-- Sends are paced at 100 per 10 minutes through send_after.
create or replace function public.queue_sponsor_list_emails(
  p_mode text,
  p_preview boolean default true,
  p_test_to text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_limun constant uuid := 'c0ffee00-0000-4000-8000-000000000001';
  v_site  constant text := 'https://gavelling.com';
  v_sheet constant text := 'https://docs.google.com/spreadsheets/d/1KxwXAq_OheccHdwEhF4fu0X_4aLBQndssaDhOmhp1iM/edit?usp=sharing';
  v_variant int;
  r record;
  s jsonb;
  v_n int := 0;
  v_rows jsonb := '[]'::jsonb;
  v_name text; v_first text; v_dash text; v_minutes text;
  v_steps int; v_total int; v_done int;
  v_check jsonb; v_pending jsonb;
  v_subject text; v_txt text; v_html text; v_paras text[]; v_facts jsonb; v_card jsonb;
  v_to text;
begin
  if p_mode not in ('verified', 'teaser') then raise exception 'p_mode must be verified or teaser'; end if;
  v_variant := case when p_mode = 'verified' then 70 else 71 end;

  for r in
    with org as (
      select c.id as conference_id, c.created_at, c.is_verified, u.user_id
        from conferences c
        cross join lateral (
          select c.organizer_id as user_id
          union
          select co.user_id from conference_organizers co
           where co.conference_id = c.id and not coalesce(co.setup_nudges_opted_out, false)
        ) u
       where c.status <> 'archived'
         and c.id <> c_limun
         and coalesce(c.listed_by, 'organiser') <> 'gavelling'
         and (p_mode = 'verified' or public.is_active_conference(c.id))
         and (case when p_mode = 'verified' then coalesce(c.is_verified, false) else not coalesce(c.is_verified, false) end)
         and not exists (select 1 from conference_organizers co2
                          where co2.conference_id = c.id and co2.user_id = u.user_id
                            and coalesce(co2.setup_nudges_opted_out, false))
    ),
    people as (
      select distinct on (lower(p.email)) o.conference_id, p.email, p.display_name, p.id as user_id
        from org o join profiles p on p.id = o.user_id
       where p.email is not null
         and coalesce(p.notify_email_reminders, true)
       order by lower(p.email), o.created_at desc
    )
    select * from people pp
     where not exists (select 1 from conference_setup_nudges n
                        where lower(n.recipient_email) = lower(pp.email)
                          and n.cadence = 'sponsors' and n.variant = v_variant)
       -- The teaser never goes to someone who already holds a verified conference.
       and (p_mode = 'verified' or not exists (
             select 1 from conferences cv
              where cv.status <> 'archived' and coalesce(cv.is_verified, false)
                and (cv.organizer_id = pp.user_id
                     or exists (select 1 from conference_organizers co3
                                 where co3.conference_id = cv.id and co3.user_id = pp.user_id))))
     order by pp.email
  loop
    s := public.conference_setup_status(r.conference_id);
    if s is null then continue; end if;
    v_name := coalesce(s->>'display_name', (select full_name from conferences where id = r.conference_id));
    v_first := coalesce(nullif(split_part(coalesce(r.display_name, ''), ' ', 1), ''), 'there');
    v_dash := v_site || '/manage/' || (select slug from conferences where id = r.conference_id);

    if p_mode = 'verified' then
      v_subject := 'Your list of 300+ MUN sponsors';
      v_paras := array[
        'Hi ' || v_first || ',',
        'Because **' || v_name || '** is verified on Gavelling, you now have our list of **301 companies and brands that have sponsored or partnered with MUN conferences**: Red Bull, Coca-Cola, Mercedes-Benz, Starbucks, Deloitte, McKinsey, Barclays, Santander, Lufthansa, Turkish Airlines and hundreds more.',
        'Each one shows its industry, where it operates, which conferences it backed and how (sponsor, official airline, venue partner), with a source you can check before you reach out.',
        'The list is for your organising team only. Please do not share it outside your team.'
      ];
      v_facts := jsonb_build_array(
        jsonb_build_object('label', 'Sponsors', 'value', '**301** companies and brands'),
        jsonb_build_object('label', 'Unlocked by', 'value', v_name || '''s blue checkmark'));
      v_txt := 'Hi ' || v_first || ',' || chr(10) || chr(10)
        || 'Because ' || v_name || ' is verified on Gavelling, you now have our list of 301 companies and brands that have sponsored or partnered with MUN conferences: Red Bull, Coca-Cola, Mercedes-Benz, Starbucks, Deloitte, McKinsey, Barclays, Santander, Lufthansa, Turkish Airlines and hundreds more.' || chr(10) || chr(10)
        || 'Open the list: ' || v_sheet || chr(10) || chr(10)
        || 'The list is for your organising team only. Please do not share it outside your team.';
      v_card := jsonb_build_object(
        'seals', 'earned',
        'pill', 'Verified',
        'signoff', jsonb_build_object('line', 'Want help pitching a sponsor? Reply and I will help.', 'who', 'Peter, founder of Gavelling'),
        'footer_line', 'Sent by Gavelling because ' || v_name || ' is verified. This is a one-off.');
      v_html := public.gavelling_email_html(r.conference_id, '300+ MUN sponsors, unlocked', v_paras, v_facts,
        'Open the sponsor list', v_sheet, null, null, v_card);
    else
      v_minutes := coalesce(s->>'verification_minutes_left', '0');
      v_pending := coalesce(s->'verification_pending', '[]'::jsonb);
      v_steps := jsonb_array_length(v_pending);
      v_total := jsonb_array_length(coalesce(s->'items', '[]'::jsonb));
      select count(*) into v_done from jsonb_array_elements(coalesce(s->'items', '[]'::jsonb)) i
       where coalesce((i->>'done')::boolean, false);
      select coalesce(jsonb_agg(jsonb_build_object(
               'key', i->>'key',
               'done', coalesce((i->>'done')::boolean, false),
               'label', i->>'title',
               'detail', case when not coalesce((i->>'done')::boolean, false) and coalesce((i->>'minutes')::int, 0) > 0
                              then 'About ' || (i->>'minutes') || ' min' end,
               'url', case when nullif(i->>'href', '') is not null then v_dash || (i->>'href') end
             ) order by o), '[]'::jsonb)
        into v_check
        from jsonb_array_elements(coalesce(s->'items', '[]'::jsonb)) with ordinality as t(i, o);

      v_subject := '300+ MUN sponsors, free with your checkmark';
      v_paras := array[
        'Hi ' || v_first || ',',
        'We have put together a list of **301 companies and brands that have sponsored or partnered with MUN conferences**, from Red Bull, Coca-Cola and Mercedes-Benz to Starbucks, Deloitte, Barclays and Turkish Airlines. Each one comes with the conferences it backed and how.',
        'It is free for every **verified** conference. **' || v_name || '** is about **' || v_minutes || ' minutes** from its blue checkmark: finish set-up, launch your delegate applications, and the list arrives in your inbox automatically.'
      ];
      v_facts := jsonb_build_array(
        jsonb_build_object('label', 'Time left', 'value', 'About **' || v_minutes || ' minutes**'),
        jsonb_build_object('label', 'Set-up', 'value', v_done::text || ' of ' || v_total::text || ' stages done',
                           'sub', v_steps::text || ' step' || case when v_steps = 1 then '' else 's' end || ' to go'));
      v_txt := 'Hi ' || v_first || ',' || chr(10) || chr(10)
        || 'We have put together a list of 301 companies and brands that have sponsored or partnered with MUN conferences, from Red Bull, Coca-Cola and Mercedes-Benz to Starbucks, Deloitte, Barclays and Turkish Airlines.' || chr(10) || chr(10)
        || 'It is free for every verified conference. ' || v_name || ' is about ' || v_minutes || ' minutes from its blue checkmark. Finish set-up and the list arrives in your inbox automatically.' || chr(10) || chr(10)
        || 'Finish set-up: ' || v_dash;
      v_card := jsonb_build_object(
        'seals', 'pending',
        'pill', 'Not verified yet',
        'chip', 'About ' || v_minutes || ' min left',
        'checklist', v_check,
        'note', jsonb_build_object('eyebrow', 'Free for organisers',
                                   'text', 'Nothing here costs anything. The checkmark is earned, never bought.'),
        'signoff', jsonb_build_object('line', 'Stuck on a step? Reply and I will help.', 'who', 'Peter, founder of Gavelling'),
        'footer_line', 'Sent by Gavelling about ' || v_name || '. This is a one-off.');
      v_html := public.gavelling_email_html(r.conference_id, '300+ MUN sponsors are waiting', v_paras, v_facts,
        'Finish set-up', v_dash, null, null, v_card);
    end if;

    -- PREVIEW INSERTS NOTHING.
    if p_preview and p_test_to is null then
      v_n := v_n + 1;
      if jsonb_array_length(v_rows) < 300 then
        v_rows := v_rows || jsonb_build_object('conference', v_name, 'recipient', r.email, 'subject', v_subject);
      end if;
      continue;
    end if;

    v_to := coalesce(p_test_to, r.email);
    insert into email_outbox (conference_id, recipient_application_id, recipient_email, subject, body, body_html,
                              status, from_name, from_address, reply_to, send_after)
    values (r.conference_id, null, v_to,
            case when p_test_to is not null then '[Test] ' else '' end || v_subject,
            v_txt, v_html, 'pending',
            'Peter at Gavelling', 'peter@mail.gavelling.com', 'wearegavelling@gmail.com',
            now() + ((v_n / 100) * interval '10 minutes'));
    v_n := v_n + 1;

    if p_test_to is not null then
      -- A test sends exactly one email and records nothing.
      return jsonb_build_object('ok', true, 'test_to', p_test_to, 'based_on', r.email, 'subject', v_subject);
    end if;

    insert into conference_setup_nudges (conference_id, recipient_email, cadence, variant, milestone, pending_keys)
    values (r.conference_id, r.email, 'sponsors', v_variant, null, '{}'::text[]);
  end loop;

  return jsonb_build_object('ok', true, 'mode', p_mode, 'preview', p_preview and p_test_to is null,
                            'count', v_n, 'would_send', v_rows);
end $$;

revoke all on function public.queue_sponsor_list_emails(text, boolean, text) from public, anon, authenticated;

-- NOT scheduled here. After Peter approves the real send:
--   select public.queue_sponsor_list_emails('verified', false);
--   select public.queue_sponsor_list_emails('teaser', false);
--   select cron.schedule('sponsor-list-emails', '25 * * * *',
--     $$select public.queue_sponsor_list_emails('verified', false)$$);
