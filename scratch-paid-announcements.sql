-- ════════════════════════════════════════════════════════════════════════════
-- PAID ANNOUNCEMENTS ("Marketing")  draft 9 Oct 2026, reworked 11 Oct 2026.
-- APPLIED 11 Oct 2026 as migration `paid_announcements` (sections 0 to 7). Cron in section 8 NOT scheduled.
--
-- An organiser pays CONFERENCE CREDITS to send one announcement about their
-- conference to Gavelling delegates in THEIR CONFERENCE'S CITY, THEIR
-- CONFERENCE'S COUNTRY, or the WORLD. The place is never chosen by the client:
-- it is read from conferences.city / conferences.country at request time.
-- Submitting takes the credits and queues ONE email to the team inbox
-- (wearegavelling@gmail.com). NOTHING goes to any recipient until a platform
-- admin approves it in /admin → Data → Paid announcements. A rejection or a
-- cancel before review returns every credit.
--
-- WHO RECEIVES ONE (the ONLY audience rule, `_paid_announcement_people`):
--   Always: non-demo profile, CONFIRMED auth email, profiles.notify_email_marketing
--   on ("Conference Announcements"), a well-formed address, not opted out
--   (email_is_opted_out), not a failed address (email_address_failed), not sent
--   ANY paid announcement in the last `cap_days` days (14), and never sent one
--   by the same conference before.
--   A person's PLACES (the cities / countries of conferences they took part in):
--     a) on Gavelling: an application that is accepted / assigned / checked-in,
--        or a seat (conference_allocations.user_id), at a non-demo conference;
--     b) the MUN CV, every source (manual, gavelling_attended,
--        gavelling_verified), EXCEPT an entry the person marked private
--        (mun_cv_entries.is_private) and EXCEPT every entry of a CV the person
--        made private (profiles.cv_private). mun_cv_entries has NO city or
--        country column (checked 11 Oct 2026), so an entry's place is the
--        linked conference's city and country: mun_cv_entries.conference_id
--        when set; otherwise, when its free-text conference_name, trimmed and
--        case-insensitive, equals the full name or the acronym of EXACTLY ONE
--        non-demo conference, that conference. Ambiguous or unknown names
--        place nobody (no fuzzy matching on words like a city inside a name).
--   city    = one of the person's places has that city (trimmed, case
--             insensitive) AND the same country as the organiser's conference.
--   country = one of the person's places is in that country, OR
--             profiles.nationality is that country. Country names go through
--             admin_country_canonical().
--   world   = everyone eligible.
--
-- Nationality is used even when the person hid it on their public CV
-- (profiles.cv_hide_nationality): that switch is about what strangers see on
-- /cv, and the privacy policy names "the nationality on your profile".
--
-- Sizes on 11 Oct 2026, for orientation: mun_cv_entries 5,365 rows; 1,066 carry
-- a conference_id; of 4,299 unlinked manual entries 55 name exactly one
-- conference and 15 are ambiguous. So the CV adds little today beyond (a); a
-- city-word match would add about 145 more entries but is guesswork.
--
-- WHAT THE ORGANISER SEES: no counts. paid_announcement_targets returns, per
-- choice, the flat price and `has_people` (true / false), never a number, and
-- my_paid_announcements returns no reach. Admins still see counts:
-- admin_paid_announcements returns quoted_reach and reached, and the team email
-- names the reach at submit time.
--
-- Prices (paid_announcement_prices, the ONLY place they live): FLAT per scope.
--   city 50 credits, country 200 credits, world 500 credits.
--
-- The button: a label (1..30 characters) and a link that must be a page of THIS
-- conference on Gavelling: https://gavelling.com/conferences/<slug> or a path
-- under it (no query string, no dot segments). Default: the conference page.
--
-- WHAT WRITES email_outbox:
--   1. request_paid_announcement: ONE row to wearegavelling@gmail.com, after
--      the credits are taken. Wrapped so a failure there never loses the
--      request (a warning; the row still waits in /admin).
--   2. queue_paid_announcements_tick(false): the announcement itself, to the
--      audience, only for approved announcements. NOT scheduled here (see the
--      commented cron in section 8). Calling it with FALSE SENDS. Its default
--      (preview) inserts NOTHING.
--   Announcement campaigns live in email_campaigns with audience
--   'announcement' and started_at NULL, so queue_email_campaigns_tick() (which
--   only takes started campaigns) never touches them, and /r/<token>/<key>
--   plus record_campaign_click work for them unchanged.
--
-- STOP: select public.email_pause('...');  or
--       update paid_announcements set status = 'paused' where status = 'sending';
--
-- Validated 11 Oct 2026 by running sections 0 to 7 inside DO blocks that end
-- by raising (so everything rolled back; checked afterwards that no table,
-- function, constraint, credit lot or outbox row remained): every statement
-- compiles; on a real Noida, India conference with 600 test credits the three
-- choices came back with prices and has_people true and no numbers; links in
-- the text and a foreign button link were refused; a country submit took 200
-- credits, quoted 1,003 people (admin only) and queued exactly ONE outbox row,
-- to wearegavelling@gmail.com, "Announcement to review: VMUN, Country"; a
-- second submit was refused; reject without a reason was refused; cancel and
-- reject returned the credits; approve made an unstarted 'announcement'
-- campaign; the admin preview carried the unsubscribe link; the tick ran in
-- preview only (100 would queue now) and the real tick was never called.
--
-- Idempotent: re-running the file is safe (create if not exists, create or
-- replace, on conflict do nothing, constraints dropped if they exist and added
-- again). Section 0 REWRITES two existing CHECK constraints: re-read their
-- current definitions before applying in case another kind was added since.
-- ════════════════════════════════════════════════════════════════════════════

-- 0 · Widen two existing checks (definitions read 11 Oct 2026) ────────────────
alter table public.store_ledger drop constraint if exists store_ledger_kind_check;
alter table public.store_ledger add constraint store_ledger_kind_check check (kind = any (array[
  'transfer_in','transfer_out','sponsor_add','sponsor_remove','spotlight_hold','spotlight_refund',
  'email_pack','import_charge','import_refund','bundle_credit','announcement']));

alter table public.email_campaigns drop constraint if exists email_campaigns_audience_check;
alter table public.email_campaigns add constraint email_campaigns_audience_check
  check (audience = any (array['everyone','announcement']));

-- 1 · Tables ──────────────────────────────────────────────────────────────────
-- Flat prices. The client reads them through paid_announcement_targets and
-- never types one.
create table if not exists public.paid_announcement_prices (
  scope    text primary key check (scope in ('city','country','world')),
  credits  int  not null check (credits between 1 and 10000),
  label    text not null
);
insert into public.paid_announcement_prices (scope, credits, label) values
  ('city',     50, 'Delegates in your city'),
  ('country', 200, 'Delegates in your country'),
  ('world',   500, 'The whole world')
on conflict (scope) do nothing;

create table if not exists public.paid_announcement_config (
  id         boolean primary key default true check (id),
  cap_days   int  not null default 14 check (cap_days between 1 and 90),
  per_run    int  not null default 100 check (per_run between 1 and 100),
  team_inbox text not null default 'wearegavelling@gmail.com'
);
alter table public.paid_announcement_config add column if not exists team_inbox text not null default 'wearegavelling@gmail.com';
insert into public.paid_announcement_config (id) values (true) on conflict do nothing;

create table if not exists public.paid_announcements (
  id              uuid primary key default gen_random_uuid(),
  conference_id   uuid not null references public.conferences(id) on delete cascade,
  requested_by    uuid references auth.users(id) on delete set null,
  scope           text not null check (scope in ('city','country','world')),
  target          text,                       -- city name / country name / null for world
  target_country  text,                       -- the city's country (city scope only)
  heading         text not null check (char_length(btrim(heading)) between 1 and 80),
  body            text not null check (char_length(btrim(body)) between 1 and 1200),
  button_label    text not null default 'See the conference' check (char_length(btrim(button_label)) between 1 and 30),
  button_url      text not null check (button_url ~ '^https://gavelling\.com/conferences/[a-z0-9-]+(/[A-Za-z0-9_~-][A-Za-z0-9._~-]*)*/?$'),
  quoted_reach    int  not null check (quoted_reach >= 0),   -- admins only
  credits         int  not null check (credits > 0),
  ledger_id       uuid references public.store_ledger(id) on delete set null,
  status          text not null default 'in_review'
                  check (status in ('in_review','rejected','cancelled','sending','paused','sent')),
  reject_reason   text check (reject_reason is null or char_length(reject_reason) <= 500),
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  campaign_id     uuid references public.email_campaigns(id) on delete set null,
  team_outbox_id  uuid,                       -- the review email to the team inbox
  created_at      timestamptz not null default now(),
  finished_at     timestamptz,
  check ((scope = 'world') = (target is null)),
  check ((scope = 'city') = (target_country is not null))
);
alter table public.paid_announcements add column if not exists team_outbox_id uuid;
create index if not exists paid_announcements_conf_idx on public.paid_announcements (conference_id, created_at desc);
create index if not exists paid_announcements_status_idx on public.paid_announcements (status, created_at);

-- One row per person per announcement sent: the frequency cap reads it.
create table if not exists public.paid_announcement_sends (
  announcement_id uuid not null references public.paid_announcements(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  conference_id   uuid not null,
  sent_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create index if not exists paid_announcement_sends_user_idx on public.paid_announcement_sends (user_id, sent_at desc);
create index if not exists paid_announcement_sends_conf_idx on public.paid_announcement_sends (conference_id, user_id);

alter table public.paid_announcement_prices  enable row level security;
alter table public.paid_announcement_config  enable row level security;
alter table public.paid_announcements        enable row level security;
alter table public.paid_announcement_sends   enable row level security;
revoke all on public.paid_announcement_prices, public.paid_announcement_config,
              public.paid_announcements, public.paid_announcement_sends from public, anon, authenticated;
-- No policies: everything goes through the functions below.

-- 2 · Helpers ─────────────────────────────────────────────────────────────────
create or replace function public._html_escape(t text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select replace(replace(replace(replace(coalesce(t,''), '&','&amp;'), '<','&lt;'), '>','&gt;'), '"','&quot;')
$$;

-- Who is in the audience. p_city / p_country are the ORGANISER'S conference
-- city and country, read by the callers from the conferences row (never typed
-- by the client). See the header for the exact rule.
create or replace function public._paid_announcement_people(p_scope text, p_city text, p_country text, p_conf uuid)
returns table(user_id uuid, email text)
language sql stable security definer set search_path = public, pg_temp as $$
  with cfg as (select cap_days from paid_announcement_config where id),
  base as (
    select p.id, lower(btrim(p.email)) as email, p.nationality
      from profiles p join auth.users u on u.id = p.id
     where not coalesce(p.is_demo, false)
       and u.email_confirmed_at is not null
       and coalesce(p.notify_email_marketing, true)
       and p.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       and not public.email_is_opted_out(p.email)
       and not public.email_address_failed(p.email)
       and not exists (select 1 from paid_announcement_sends s
                        where s.user_id = p.id
                          and (s.sent_at > now() - make_interval(days => (select cap_days from cfg))
                               or (p_conf is not null and s.conference_id = p_conf)))),
  live_conf as (
    select id, city, country, lower(btrim(full_name)) as fname, lower(btrim(acronym)) as acr
      from conferences where not coalesce(is_demo, false)),
  -- A free-text CV conference name that names EXACTLY ONE conference.
  named as (
    select n, (array_agg(distinct id))[1] as conference_id
      from (select fname as n, id from live_conf where coalesce(fname, '') <> ''
            union all
            select acr, id from live_conf where coalesce(acr, '') <> '') x
     group by n having count(distinct id) = 1),
  places as (
    -- a) On Gavelling: accepted / assigned / checked-in, or seated.
    select a.user_id, c.city, c.country
      from applications a join live_conf c on c.id = a.conference_id
     where a.user_id is not null and a.status in ('accepted','assigned','checked-in')
    union
    select al.user_id, c.city, c.country
      from conference_allocations al join live_conf c on c.id = al.conference_id
     where al.user_id is not null
    union
    -- b) The MUN CV, every source; never a private entry, never a private CV.
    select e.user_id, c.city, c.country
      from mun_cv_entries e
      join profiles pr on pr.id = e.user_id and not coalesce(pr.cv_private, false)
      left join named nm on e.conference_id is null and nm.n = lower(btrim(e.conference_name))
      join live_conf c on c.id = coalesce(e.conference_id, nm.conference_id)
     where not coalesce(e.is_private, false))
  select b.id, b.email from base b
   where p_scope = 'world'
      or (p_scope = 'city'
          and nullif(btrim(p_city), '') is not null and nullif(btrim(p_country), '') is not null
          and exists (select 1 from places t where t.user_id = b.id
                        and lower(btrim(t.city)) = lower(btrim(p_city))
                        and public.admin_country_canonical(t.country) = public.admin_country_canonical(p_country)))
      or (p_scope = 'country'
          and nullif(btrim(p_country), '') is not null
          and (public.admin_country_canonical(b.nationality) = public.admin_country_canonical(p_country)
               or exists (select 1 from places t where t.user_id = b.id
                            and public.admin_country_canonical(t.country) = public.admin_country_canonical(p_country))))
$$;
revoke all on function public._paid_announcement_people(text, text, text, uuid) from public, anon, authenticated;

create or replace function public._paid_announcement_price(p_scope text)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select credits from paid_announcement_prices where scope = p_scope
$$;
revoke all on function public._paid_announcement_price(text) from public, anon, authenticated;

-- Plain sentence when the text is not acceptable, else null.
create or replace function public._paid_announcement_text_problem(p_heading text, p_body text, p_button text)
returns jsonb language sql immutable set search_path = public, pg_temp as $$
  select case
    when char_length(btrim(coalesce(p_heading,''))) = 0 then jsonb_build_object('field','heading','message','Add a heading.')
    when char_length(btrim(p_heading)) > 80 then jsonb_build_object('field','heading','message','Keep the heading under 80 characters.')
    when char_length(btrim(coalesce(p_body,''))) = 0 then jsonb_build_object('field','body','message','Write a short message.')
    when char_length(btrim(p_body)) > 1200 then jsonb_build_object('field','body','message','Keep the message under 1,200 characters.')
    when char_length(btrim(coalesce(p_button,''))) not between 1 and 30 then jsonb_build_object('field','button','message','The button needs a short label, up to 30 characters.')
    when concat_ws(' ', p_heading, p_body, p_button) ~* '(https?://|www\.|[a-z0-9-]+\.(com|org|net|io|co|me|ly|app)\y|@)'
      then jsonb_build_object('field','body','message','Links and email addresses are not allowed in the text. Put your link next to the button.')
  end
$$;

-- The button's link: a page of THIS conference on Gavelling, else a sentence.
create or replace function public._paid_announcement_url_problem(p_conf uuid, p_url text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when coalesce(btrim(p_url), '') !~ ('^https://gavelling\.com/conferences/' || c.slug || '(/[A-Za-z0-9_~-][A-Za-z0-9._~-]*)*/?$')
      then jsonb_build_object('field','button_url','message','The link must go to your conference on Gavelling, like gavelling.com/conferences/' || c.slug || '.')
  end
  from conferences c where c.id = p_conf
$$;
revoke all on function public._paid_announcement_url_problem(uuid, text) from public, anon, authenticated;

-- "delegates in Nairobi, Kenya" / "delegates in Kenya" / "the whole world".
create or replace function public._paid_announcement_place(p_scope text, p_target text, p_target_country text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case p_scope when 'world' then 'the whole world'
                      when 'city' then 'delegates in ' || concat_ws(', ', p_target, p_target_country)
                      else 'delegates in ' || coalesce(p_target, '') end
$$;

-- The email to the team inbox that asks for a review. Inserts ONE outbox row
-- and returns its id. Called only by request_paid_announcement.
create or replace function public._paid_announcement_notify_team(p_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare a record; c record; v_by text; v_reply text; v_conf text; v_place text; v_body text; v_html text; v_out uuid;
begin
  select * into a from paid_announcements where id = p_id;
  select * into c from conferences where id = a.conference_id;
  select nullif(btrim(p.display_name), ''), u.email into v_by, v_reply
    from auth.users u left join profiles p on p.id = u.id where u.id = a.requested_by;
  v_conf := c.full_name || coalesce(' (' || nullif(btrim(c.acronym), '') || ')', '');
  v_place := public._paid_announcement_place(a.scope, a.target, a.target_country);
  v_body := 'A conference paid for an announcement. Nothing goes out until you approve it.' || chr(10) || chr(10)
    || 'Conference: ' || v_conf || chr(10)
    || 'Page:       https://gavelling.com/conferences/' || c.slug || chr(10)
    || 'Who gets it: ' || initcap(a.scope) || ', ' || v_place
    || ' (about ' || a.quoted_reach || ' people right now)' || chr(10)
    || 'Paid:       ' || a.credits || ' conference credits (returned if you reject it)' || chr(10)
    || 'Sent by:    ' || coalesce(v_by, 'an organiser') || coalesce(' <' || v_reply || '>', '') || chr(10) || chr(10)
    || 'Heading:' || chr(10) || a.heading || chr(10) || chr(10)
    || 'Message:' || chr(10) || a.body || chr(10) || chr(10)
    || 'Button: ' || a.button_label || chr(10)
    || 'Link:   ' || a.button_url || chr(10) || chr(10)
    || 'Approve or reject it in /admin, Data tab, Paid announcements:' || chr(10)
    || 'https://gavelling.com/admin';
  v_html := '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1C1410;max-width:620px">'
    || '<p style="margin:0 0 14px"><strong>A conference paid for an announcement.</strong> Nothing goes out until you approve it.</p>'
    || '<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 18px">'
    || '<tr><td style="padding:2px 14px 2px 0;color:#5A4A3C">Conference</td><td><a href="https://gavelling.com/conferences/' || public._html_escape(c.slug) || '" style="color:#1B3828;font-weight:bold">' || public._html_escape(v_conf) || '</a></td></tr>'
    || '<tr><td style="padding:2px 14px 2px 0;color:#5A4A3C">Who gets it</td><td>' || public._html_escape(initcap(a.scope) || ', ' || v_place) || ' (about ' || a.quoted_reach || ' people right now)</td></tr>'
    || '<tr><td style="padding:2px 14px 2px 0;color:#5A4A3C">Paid</td><td>' || a.credits || ' conference credits, returned if you reject it</td></tr>'
    || '<tr><td style="padding:2px 14px 2px 0;color:#5A4A3C">Sent by</td><td>' || public._html_escape(coalesce(v_by, 'an organiser') || coalesce(' <' || v_reply || '>', '')) || '</td></tr>'
    || '</table>'
    || '<div style="border:1px solid rgba(27,56,40,0.15);border-radius:12px;padding:16px 18px;margin:0 0 18px">'
    || '<p style="margin:0 0 8px;font-size:20px;font-weight:bold;color:#1B3828">' || public._html_escape(a.heading) || '</p>'
    || '<p style="margin:0 0 14px;white-space:pre-wrap">' || public._html_escape(a.body) || '</p>'
    || '<p style="margin:0">Button: <strong>' || public._html_escape(a.button_label) || '</strong><br>Link: ' || public._html_escape(a.button_url) || '</p>'
    || '</div>'
    || '<p style="margin:0"><a href="https://gavelling.com/admin" style="display:inline-block;padding:11px 20px;background:#1B3828;color:#ffffff;border-radius:10px;font-weight:bold;text-decoration:none">Review it in /admin</a></p>'
    || '<p style="margin:8px 0 0;font-size:13px;color:#5A4A3C">Data tab, Paid announcements.</p>'
    || '</div>';
  insert into email_outbox (conference_id, recipient_application_id, recipient_email, reply_to, subject, body, body_html, status)
  values (null, null, (select team_inbox from paid_announcement_config where id), v_reply,
          'Announcement to review: ' || left(coalesce(nullif(btrim(c.acronym), ''), c.full_name), 60) || ', ' || initcap(a.scope),
          v_body, v_html, 'pending')
  returning id into v_out;
  return v_out;
end $$;
revoke all on function public._paid_announcement_notify_team(uuid) from public, anon, authenticated;

-- 3 · Organiser RPCs ──────────────────────────────────────────────────────────
-- The three choices with their flat price and whether anyone can get one
-- there (`has_people`, a yes / no, never a number), plus both balances.
-- Read only: inserts nothing.
create or replace function public.paid_announcement_targets(p_conf uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_city text; v_country text; v_opts jsonb := '[]'::jsonb; s text; v_any boolean; v_ok boolean;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'message','Please sign in again.'); end if;
  if not public.can_use_store(p_conf) then return jsonb_build_object('ok',false,'message','You do not have access to this conference''s Store.'); end if;
  select nullif(btrim(city), ''), nullif(public.admin_country_canonical(nullif(btrim(country), '')), '')
    into v_city, v_country from conferences where id = p_conf;
  foreach s in array array['city','country','world'] loop
    v_ok := case s when 'city' then v_city is not null and v_country is not null
                   when 'country' then v_country is not null else true end;
    v_any := case when v_ok then exists (select 1 from public._paid_announcement_people(s, v_city, v_country, p_conf)) end;
    v_opts := v_opts || jsonb_build_array(jsonb_build_object(
      'scope', s, 'credits', public._paid_announcement_price(s), 'has_people', v_any, 'available', v_ok,
      'reason', case when not v_ok then case s when 'city' then 'Add your conference''s city and country in Settings first.'
                                               else 'Add your conference''s country in Settings first.' end end));
  end loop;
  return jsonb_build_object('ok', true,
    'city', v_city, 'country', v_country,
    'cap_days', (select cap_days from paid_announcement_config where id),
    'options', v_opts,
    'conference_credits', public._conf_lot_sum(p_conf, 'conference', null),
    'your_credits', (select coalesce(sum(remaining),0)::int from credit_lots where holder_type='user' and user_id=v_uid and remaining>0 and (expires_at is null or expires_at>now())));
end $$;

-- Submit for review: takes the flat price now (returned on reject or cancel),
-- then queues ONE email to the team inbox. The place comes from the conference
-- row. Short of credits: {ok:false, need_credits} exactly like buy_email_pack,
-- so the client's useStoreBuy pattern works unchanged.
create or replace function public.request_paid_announcement(
  p_conf uuid, p_scope text, p_heading text, p_body text,
  p_button_label text default 'See the conference', p_button_url text default null, p_top_up boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_problem jsonb; v_parts jsonb; v_have int; v_mine int; v_price int; v_reach int;
        v_ledger uuid; v_id uuid; v_conf record; v_city text; v_country text; v_url text; v_out uuid;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'message','Please sign in again.'); end if;
  if not public.can_use_store(p_conf) then return jsonb_build_object('ok',false,'message','You do not have access to this conference''s Store.'); end if;
  if p_scope is null or p_scope not in ('city','country','world') then return jsonb_build_object('ok',false,'message','Choose your city, your country or the whole world.'); end if;
  select * into v_conf from conferences where id = p_conf;
  if coalesce(v_conf.is_demo, false) then return jsonb_build_object('ok',false,'message','Demo conferences cannot send announcements.'); end if;
  if v_conf.end_date is not null and v_conf.end_date < current_date then
    return jsonb_build_object('ok',false,'message','This conference has already ended.'); end if;
  if not coalesce(v_conf.is_public, false) then
    return jsonb_build_object('ok',false,'message','Publish your conference first, so the button has a page to open.'); end if;
  v_city := nullif(btrim(v_conf.city), '');
  v_country := nullif(public.admin_country_canonical(nullif(btrim(v_conf.country), '')), '');
  if p_scope = 'city' and (v_city is null or v_country is null) then
    return jsonb_build_object('ok',false,'message','Add your conference''s city and country in Settings first.'); end if;
  if p_scope = 'country' and v_country is null then
    return jsonb_build_object('ok',false,'message','Add your conference''s country in Settings first.'); end if;
  v_problem := public._paid_announcement_text_problem(p_heading, p_body, p_button_label);
  if v_problem is not null then return jsonb_build_object('ok',false) || v_problem; end if;
  v_url := coalesce(nullif(btrim(p_button_url), ''), 'https://gavelling.com/conferences/' || v_conf.slug);
  v_problem := public._paid_announcement_url_problem(p_conf, v_url);
  if v_problem is not null then return jsonb_build_object('ok',false) || v_problem; end if;
  -- One at a time per conference, decided under the lock so two presses
  -- cannot both pass.
  perform pg_advisory_xact_lock(hashtext('paid_announcement:' || p_conf::text));
  if exists (select 1 from paid_announcements where conference_id = p_conf and status in ('in_review','sending','paused')) then
    return jsonb_build_object('ok',false,'message','This conference already has an announcement waiting or sending. Wait until it is done.'); end if;
  v_price := public._paid_announcement_price(p_scope);
  select count(*) into v_reach from public._paid_announcement_people(p_scope, v_city, v_country, p_conf);
  if v_reach = 0 then return jsonb_build_object('ok',false,'field','scope','message','Nobody can receive an announcement there right now. Choose a bigger area.'); end if;
  v_parts := public._spend_conference_credits(p_conf, v_price, case when p_top_up then v_uid end);
  if v_parts is null then
    v_have := public._conf_lot_sum(p_conf, 'conference', null);
    v_mine := (select coalesce(sum(remaining),0)::int from credit_lots where holder_type='user' and user_id=v_uid and remaining>0 and (expires_at is null or expires_at>now()));
    return jsonb_build_object('ok',false,'credits',v_price,'conference_credits',v_have,
      'need_credits', v_price - v_have - case when p_top_up then v_mine else 0 end,
      'message','It seems you don''t have enough credits for this');
  end if;
  insert into store_ledger(conference_id, user_id, kind, quantity, ref, parts)
    values (p_conf, v_uid, 'announcement', v_price,
            p_scope || ':' || coalesce(case p_scope when 'city' then v_city || ', ' || v_country when 'country' then v_country end, 'world'),
            v_parts)
    returning id into v_ledger;
  insert into paid_announcements(conference_id, requested_by, scope, target, target_country, heading, body,
                                 button_label, button_url, quoted_reach, credits, ledger_id)
    values (p_conf, v_uid, p_scope,
            case p_scope when 'city' then v_city when 'country' then v_country end,
            case when p_scope = 'city' then v_country end,
            btrim(p_heading), btrim(p_body), btrim(p_button_label), v_url, v_reach, v_price, v_ledger)
    returning id into v_id;
  -- The review email to the team. A failure here must not lose the request
  -- (the credits are taken and the row waits in /admin either way).
  begin
    v_out := public._paid_announcement_notify_team(v_id);
    update paid_announcements set team_outbox_id = v_out where id = v_id;
  exception when others then
    raise warning 'paid announcement % team email failed: %', v_id, sqlerrm;
  end;
  return public._store_state(p_conf, v_uid) || jsonb_build_object('ok', true, 'id', v_id,
    'message', 'Sent for review. Our team checks it before it goes out, usually within a day.');
end $$;

create or replace function public._paid_announcement_refund(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare a record; l record;
begin
  select * into a from paid_announcements where id = p_id;
  select * into l from store_ledger where id = a.ledger_id for update;
  if l.id is null or l.refunded_at is not null then return; end if;
  perform public._return_conference_credits(a.conference_id,
    coalesce(l.parts, jsonb_build_array(jsonb_build_object('by', l.user_id, 'qty', l.quantity))));
  update store_ledger set refunded_at = now() where id = l.id;
end $$;
revoke all on function public._paid_announcement_refund(uuid) from public, anon, authenticated;

create or replace function public.cancel_paid_announcement(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare a record;
begin
  select * into a from paid_announcements where id = p_id for update;
  if a.id is null or not public.can_use_store(a.conference_id) then
    return jsonb_build_object('ok',false,'message','We could not find that announcement.'); end if;
  if a.status <> 'in_review' then
    return jsonb_build_object('ok',false,'message','Only an announcement still waiting for review can be cancelled.'); end if;
  update paid_announcements set status = 'cancelled', finished_at = now() where id = a.id;
  perform public._paid_announcement_refund(a.id);
  return jsonb_build_object('ok', true, 'message', a.credits || ' credits back in Conference credits.');
end $$;

-- The organiser's own list. No reach: only how many people opened the page.
create or replace function public.my_paid_announcements(p_conf uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.can_use_store(p_conf) then return jsonb_build_object('ok',false,'message','You do not have access to this conference''s Store.'); end if;
  return jsonb_build_object('ok', true, 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'scope', a.scope, 'target', a.target, 'target_country', a.target_country,
      'heading', a.heading, 'body', a.body,
      'button_label', a.button_label, 'button_url', a.button_url, 'status', a.status, 'reject_reason', a.reject_reason,
      'credits', a.credits, 'created_at', a.created_at,
      'reviewed_at', a.reviewed_at, 'finished_at', a.finished_at,
      'clicked', (select count(*) from email_campaign_recipients r where r.campaign_id = a.campaign_id and r.first_click_at is not null and not r.is_test)
    ) order by a.created_at desc)
    from paid_announcements a where a.conference_id = p_conf), '[]'::jsonb));
end $$;

-- 4 · Rendering (Gavelling's email look) ───────────────────────────────────────
create or replace function public._paid_announcement_render(p_id uuid)
returns table(subject text, body_text text, body_html text, links jsonb, from_name text, reply_to text)
language sql stable security definer set search_path = public, pg_temp as $$
  with a as (select * from paid_announcements where id = p_id),
  c as (select cf.* from conferences cf join a on a.conference_id = cf.id),
  w as (select case a.scope when 'world' then 'Gavelling delegates around the world'
                            when 'city' then 'Gavelling delegates who took part in a conference in ' || a.target
                            else 'Gavelling delegates in ' || a.target end as who from a)
  select
    coalesce(nullif(c.acronym,''), c.full_name) || ': ' || a.heading,
    a.heading || E'\n\n' || a.body || E'\n\n' || a.button_label || ': https://gavelling.com/r/{{CLICK_TOKEN}}/conference'
      || E'\n\n--\nYou are getting this because you turned on Conference Announcements on Gavelling. '
      || coalesce(nullif(c.acronym,''), c.full_name) || ' paid to send it to ' || w.who
      || ', and the Gavelling team checked it first. You get at most one of these every '
      || (select cap_days from paid_announcement_config where id) || ' days.'
      || E'\nUnsubscribe: {{UNSUBSCRIBE_URL}}',
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'
      || public._html_escape(a.heading) || '</title></head><body style="margin:0;padding:0;background:#EDE7D8;">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE7D8;"><tr><td align="center" style="padding:28px 16px;">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;"><tr><td style="padding:30px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1C1410;">'
      || case when c.logo_url is not null then '<img src="' || public._html_escape(c.logo_url) || '" width="64" height="64" alt="" style="display:block;border-radius:50%;margin:0 0 16px;">' else '' end
      || '<p style="margin:0 0 4px;font-size:13px;color:#5A4A3C;">' || public._html_escape(c.full_name) || '</p>'
      || '<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#1B3828;">' || public._html_escape(a.heading) || '</h1>'
      || '<p style="margin:0 0 24px;white-space:pre-wrap;">' || public._html_escape(a.body) || '</p>'
      || '<a href="https://gavelling.com/r/{{CLICK_TOKEN}}/conference" style="display:inline-block;background:#1B3828;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 24px;border-radius:10px;">'
      || public._html_escape(a.button_label) || '</a>'
      || '</td></tr></table>'
      || '<p style="max-width:560px;margin:18px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5A4A3C;">'
      || 'You are getting this because you turned on Conference Announcements on Gavelling. '
      || public._html_escape(coalesce(nullif(c.acronym,''), c.full_name)) || ' paid to send it to ' || public._html_escape(w.who)
      || ', and the Gavelling team checked it first. You get at most one of these every '
      || (select cap_days from paid_announcement_config where id) || ' days. '
      || '<a href="{{UNSUBSCRIBE_URL}}" style="color:#1B3828;font-weight:bold;">Unsubscribe</a></p>'
      || '</td></tr></table></body></html>',
    jsonb_build_object('home', 'https://gavelling.com/conferences/' || c.slug,
                       'conference', a.button_url),
    left(coalesce(nullif(c.acronym,''), c.full_name), 60) || ' via Gavelling',
    c.contact_email
  from a, c, w
$$;
revoke all on function public._paid_announcement_render(uuid) from public, anon, authenticated;

-- 5 · Admin review (platform admins only; counts are shown here) ──────────────
create or replace function public.admin_paid_announcements(p_status text default 'in_review')
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform admins only'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'conference_id', a.conference_id, 'conference', c.full_name, 'acronym', c.acronym, 'slug', c.slug,
      'scope', a.scope, 'target', a.target, 'target_country', a.target_country,
      'heading', a.heading, 'body', a.body, 'button_label', a.button_label, 'button_url', a.button_url,
      'credits', a.credits, 'quoted_reach', a.quoted_reach, 'status', a.status, 'reject_reason', a.reject_reason,
      'created_at', a.created_at, 'reviewed_at', a.reviewed_at,
      'reached', (select count(*) from paid_announcement_sends s where s.announcement_id = a.id),
      'clicked', (select count(*) from email_campaign_recipients r where r.campaign_id = a.campaign_id and r.first_click_at is not null and not r.is_test),
      'preview_html', (select replace(replace(r.body_html, '{{CLICK_TOKEN}}', 'preview'), '{{UNSUBSCRIBE_URL}}', 'https://gavelling.com/unsubscribe') from public._paid_announcement_render(a.id) r)
    ) order by a.created_at)
    from paid_announcements a join conferences c on c.id = a.conference_id
    where p_status is null or a.status = p_status), '[]'::jsonb);
end $$;

-- Approve: makes the (unstarted) campaign row and marks it 'sending'. It
-- inserts NOTHING into email_outbox; only the tick does that, later.
-- Reject: needs a reason the organiser reads; every credit goes back.
create or replace function public.admin_review_paid_announcement(p_id uuid, p_approve boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare a record; r record; v_campaign uuid;
begin
  if not public.is_platform_admin() then raise exception 'Platform admins only'; end if;
  select * into a from paid_announcements where id = p_id for update;
  if a.id is null then return jsonb_build_object('ok',false,'message','We could not find that announcement.'); end if;
  if a.status <> 'in_review' then return jsonb_build_object('ok',false,'message','This announcement was already reviewed.'); end if;
  if not p_approve then
    if char_length(btrim(coalesce(p_reason,''))) = 0 then
      return jsonb_build_object('ok',false,'field','reason','message','Write the reason the organiser will read.'); end if;
    update paid_announcements set status = 'rejected', reject_reason = left(btrim(p_reason), 500),
           reviewed_by = auth.uid(), reviewed_at = now(), finished_at = now() where id = a.id;
    perform public._paid_announcement_refund(a.id);
    return jsonb_build_object('ok', true, 'status', 'rejected', 'message', 'Rejected. The credits went back to the conference.');
  end if;
  select * into r from public._paid_announcement_render(a.id);
  insert into email_campaigns (slug, subject, from_name, from_address, reply_to, body_html, body_text, links, audience, per_run)
    values ('ann-' || replace(a.id::text, '-', ''), r.subject, r.from_name, 'announcements@mail.gavelling.com',
            r.reply_to, r.body_html, r.body_text, r.links, 'announcement',
            (select per_run from paid_announcement_config where id))
    on conflict (slug) do update set subject = excluded.subject
    returning id into v_campaign;
  update paid_announcements set status = 'sending', reviewed_by = auth.uid(), reviewed_at = now(), campaign_id = v_campaign
   where id = a.id;
  return jsonb_build_object('ok', true, 'status', 'sending', 'message', 'Approved. It goes out over the next hours.');
end $$;

-- 6 · The sender ──────────────────────────────────────────────────────────────
-- p_preview TRUE (default): counts only, INSERTS NOTHING.
-- p_preview FALSE: SENDS the next batch, sharing the campaigns' pace
-- (at most per_run and at most 120 outbox rows per 10 minutes overall).
create or replace function public.queue_paid_announcements_tick(p_preview boolean default true)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare a record; c email_campaigns%rowtype; rec record; v_recent int; v_budget int; v_n int; v_total int := 0;
        v_token text; v_unsub uuid; v_outbox uuid; v_out jsonb := '[]'::jsonb;
begin
  if not p_preview then perform pg_advisory_xact_lock(hashtext('email_campaigns_queue')); end if;
  for a in select * from paid_announcements where status = 'sending' order by reviewed_at loop
    select * into c from email_campaigns where id = a.campaign_id;
    select count(*) into v_recent from email_outbox where created_at > now() - interval '10 minutes';
    v_budget := greatest(0, least(c.per_run, 120 - v_recent));
    if p_preview then
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', a.id, 'state', 'preview',
        'remaining', (select count(*) from public._paid_announcement_people(a.scope,
                        case when a.scope = 'city' then a.target end,
                        case a.scope when 'city' then a.target_country when 'country' then a.target end, a.conference_id)),
        'would_queue_now', v_budget, 'email_paused', public.email_sending_is_paused()));
      continue;
    end if;
    if public.email_sending_is_paused() then return jsonb_build_object('state','email_paused'); end if;
    if v_budget <= 0 then v_out := v_out || jsonb_build_array(jsonb_build_object('id',a.id,'state','throttled')); exit; end if;
    v_n := 0;
    for rec in select * from public._paid_announcement_people(a.scope,
                 case when a.scope = 'city' then a.target end,
                 case a.scope when 'city' then a.target_country when 'country' then a.target end, a.conference_id)
               order by md5(a.id::text || user_id::text) limit v_budget loop
      v_token := replace(gen_random_uuid()::text, '-', '');
      v_unsub := public.unsubscribe_token_for(rec.email);
      insert into email_outbox (recipient_email, subject, body, body_html, status, from_name, from_address, reply_to)
      values (rec.email, c.subject,
              public._email_campaign_fill(c.body_text, v_token, v_unsub),
              public._email_campaign_fill(c.body_html, v_token, v_unsub),
              'pending', c.from_name, c.from_address, c.reply_to)
      returning id into v_outbox;
      insert into email_campaign_recipients (campaign_id, user_id, email, click_token, outbox_id)
      values (c.id, rec.user_id, rec.email, v_token, v_outbox);
      insert into paid_announcement_sends (announcement_id, user_id, conference_id) values (a.id, rec.user_id, a.conference_id);
      v_n := v_n + 1;
    end loop;
    v_total := v_total + v_n;
    if v_n = 0 then
      update paid_announcements set status = 'sent', finished_at = now() where id = a.id;
      update email_campaigns set finished_at = now() where id = c.id and finished_at is null;
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', a.id, 'state', 'sent'));
    else
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', a.id, 'state', 'queued', 'queued', v_n));
      exit;   -- one announcement per run keeps the pace simple
    end if;
  end loop;
  return jsonb_build_object('preview', p_preview, 'queued', v_total, 'items', v_out);
end $$;

-- 7 · Grants ──────────────────────────────────────────────────────────────────
revoke all on function public._paid_announcement_text_problem(text, text, text)                 from public, anon, authenticated;
revoke all on function public._paid_announcement_place(text, text, text)                        from public, anon, authenticated;
revoke all on function public.paid_announcement_targets(uuid)                                   from public, anon;
revoke all on function public.request_paid_announcement(uuid, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.cancel_paid_announcement(uuid)                                    from public, anon;
revoke all on function public.my_paid_announcements(uuid)                                       from public, anon;
revoke all on function public.admin_paid_announcements(text)                                    from public, anon;
revoke all on function public.admin_review_paid_announcement(uuid, boolean, text)               from public, anon;
revoke all on function public.queue_paid_announcements_tick(boolean)                            from public, anon, authenticated;
grant execute on function public.paid_announcement_targets(uuid)                                   to authenticated;
grant execute on function public.request_paid_announcement(uuid, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.cancel_paid_announcement(uuid)                                    to authenticated;
grant execute on function public.my_paid_announcements(uuid)                                       to authenticated;
grant execute on function public.admin_paid_announcements(text)                                    to authenticated;
grant execute on function public.admin_review_paid_announcement(uuid, boolean, text)               to authenticated;
grant execute on function public.queue_paid_announcements_tick(boolean)                            to service_role;

-- 8 · Schedule (commented: start it only after the first approval) ────────────
-- select cron.schedule('paid-announcements', '5-59/10 * * * *',
--   $$select public.queue_paid_announcements_tick(false)$$);
-- Stop: select cron.unschedule('paid-announcements');

-- 9 · Rolled-back test ─────────────────────────────────────────────────────────
-- Run it as ONE statement batch. Everything it writes, the team email row in
-- email_outbox included, is undone: the DO block ENDS BY RAISING, which rolls
-- the whole transaction back, and the result comes back in the error text.
-- send-emails only ever reads committed rows, so nothing can leave. It never
-- calls queue_paid_announcements_tick(false). Replace the three ids first.
--
-- begin;
-- do $t$
-- declare v_conf uuid := '<a public, non-demo, upcoming conference with a city and country>';
--         v_org  uuid := '<one of its organisers>';
--         v_adm  uuid := '<a platform admin>';
--         v_outbox_before int; r jsonb; v_id uuid; v_log jsonb := '{}'::jsonb;
-- begin
--   select count(*) into v_outbox_before from email_outbox;
--   insert into credit_lots(holder_type, conference_id, amount, remaining, source, contributed_by)
--     values ('conference', v_conf, 600, 600, 'pool', v_org);              -- test credits, rolled back
--   perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
--   v_log := v_log || jsonb_build_object('targets', public.paid_announcement_targets(v_conf));          -- no numbers
--   v_log := v_log || jsonb_build_object('links_refused', public.request_paid_announcement(v_conf, 'city', 'x', 'see www.site.com', 'Go', null, false));
--   v_log := v_log || jsonb_build_object('url_refused', public.request_paid_announcement(v_conf, 'city', 'x', 'y', 'Go', 'https://evil.com', false));
--   r := public.request_paid_announcement(v_conf, 'country', 'Applications are open', 'Join us this December.', 'See the conference', null, false);
--   v_id := (r->>'id')::uuid;
--   v_log := v_log || jsonb_build_object('submitted', r->>'ok', 'team_email',
--     (select jsonb_build_object('to', recipient_email, 'subject', subject) from email_outbox
--       where id = (select team_outbox_id from paid_announcements where id = v_id)));
--   v_log := v_log || jsonb_build_object('second_refused', public.request_paid_announcement(v_conf, 'world', 'a', 'b', 'Go', null, false)->>'message');
--   perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
--   v_log := v_log || jsonb_build_object('reject_needs_reason', public.admin_review_paid_announcement(v_id, false, '')->>'message');
--   v_log := v_log || jsonb_build_object('approve', public.admin_review_paid_announcement(v_id, true, null)->>'status');
--   v_log := v_log || jsonb_build_object('tick_preview', public.queue_paid_announcements_tick());   -- PREVIEW ONLY
--   v_log := v_log || jsonb_build_object('outbox_rows_added', (select count(*) from email_outbox) - v_outbox_before);  -- 1: the team email
--   raise exception 'ROLLED BACK. %', v_log;
-- end $t$;
-- rollback;
