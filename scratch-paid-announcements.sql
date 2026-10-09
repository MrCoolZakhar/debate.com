-- ════════════════════════════════════════════════════════════════════════════
-- PAID ANNOUNCEMENTS TO GAVELLING USERS  (draft, 9 Oct 2026, NOT APPLIED)
--
-- An organiser pays CONFERENCE CREDITS to send one announcement about their
-- conference to Gavelling users in a COUNTRY, a CONTINENT, or the WORLD.
-- Every announcement is reviewed by a platform admin before anything sends,
-- then goes out paced like the email campaigns, with /r/ click tracking.
--
-- Who receives one (the ONLY audience rule, `_paid_announcement_people`):
--   non-demo profile, CONFIRMED auth email, profiles.notify_email_marketing on
--   ("Conference Announcements"), valid address, not opted out
--   (email_is_opted_out), not a failed address (email_address_failed),
--   not sent ANY paid announcement in the last `cap_days` days (14),
--   never sent one by the same conference before.
-- "In a country" (nothing about where people live is stored, so this is the
-- honest definition): the profile's nationality is that country, OR the person
-- applied to a conference held in that country. Names go through
-- admin_country_canonical(). "In a continent" = any of those countries is in
-- the continent (country_continents). "World" = everyone eligible.
--
-- Audience sizes on 9 Oct 2026 (eligible, before the frequency cap):
--   world 4,582; with any known country 3,529;
--   continents: asia 2,431, europe 527, africa 371, north-america 280,
--               south-america 170, oceania 12;
--   countries: India 1,009, Türkiye 503, Kenya 232, Indonesia 214, Qatar 177,
--              Pakistan 170, Latvia 147, Mexico 129, Turkmenistan 109,
--              Germany 103, UAE 95, Egypt 71, United States 69, Slovakia 62,
--              United Kingdom 57.
--
-- Prices (paid_announcement_prices, the ONLY place they live):
--   credits = clamp(ceil(reach / 100) * per_hundred, min_credits, max_credits)
--   country    3 per 100 people, at least 5   (India ≈ 31, Kenya 9, UK 5)
--   continent  3 per 100 people, at least 15  (Asia ≈ 75, Europe 18, Africa 15)
--   world      4 per 100 people, at least 150 (today ≈ 184)
-- Compare: an email pack is 1 credit per 100 emails to your OWN participants;
-- a Country Spotlight is 1 credit a day. Reaching strangers who never heard of
-- the conference is worth 3 to 4 times an email to your own list.
--
-- The price is charged when the organiser submits (frozen with the reach it
-- quoted). A rejection or a cancel before review returns every credit.
--
-- WHAT SENDS: only queue_paid_announcements_tick(false). It is NOT scheduled
-- here (see the commented cron at the bottom). Calling it with false SENDS.
-- Preview (the default) inserts NOTHING, not even an unsubscribe token.
-- Announcement campaigns are stored in email_campaigns with audience
-- 'announcement' and started_at NULL, so queue_email_campaigns_tick() (which
-- only takes started campaigns) never touches them, and /r/<token>/<key> plus
-- record_campaign_click work for them unchanged.
--
-- STOP: select public.email_pause('...');  or
--       update paid_announcements set status = 'paused' where status = 'sending';
-- ════════════════════════════════════════════════════════════════════════════

-- 0 · Widen two existing checks ───────────────────────────────────────────────
alter table public.store_ledger drop constraint store_ledger_kind_check;
alter table public.store_ledger add constraint store_ledger_kind_check check (kind = any (array[
  'transfer_in','transfer_out','sponsor_add','sponsor_remove','spotlight_hold','spotlight_refund',
  'email_pack','import_charge','import_refund','bundle_credit','announcement']));

alter table public.email_campaigns drop constraint email_campaigns_audience_check;
alter table public.email_campaigns add constraint email_campaigns_audience_check
  check (audience = any (array['everyone','announcement']));

-- 1 · Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.paid_announcement_prices (
  scope        text primary key check (scope in ('country','continent','world')),
  per_hundred  int  not null check (per_hundred between 1 and 100),
  min_credits  int  not null check (min_credits between 1 and 1000),
  max_credits  int           check (max_credits is null or max_credits >= min_credits),
  label        text not null
);
insert into public.paid_announcement_prices (scope, per_hundred, min_credits, max_credits, label) values
  ('country',   3,   5, null, 'One country'),
  ('continent', 3,  15, null, 'One continent'),
  ('world',     4, 150, null, 'The whole world')
on conflict (scope) do nothing;

create table if not exists public.paid_announcement_config (
  id        boolean primary key default true check (id),
  cap_days  int not null default 14 check (cap_days between 1 and 90),
  per_run   int not null default 100 check (per_run between 1 and 100)
);
insert into public.paid_announcement_config (id) values (true) on conflict do nothing;

create table if not exists public.paid_announcements (
  id              uuid primary key default gen_random_uuid(),
  conference_id   uuid not null references public.conferences(id) on delete cascade,
  requested_by    uuid references auth.users(id) on delete set null,
  scope           text not null check (scope in ('country','continent','world')),
  target          text,                       -- country name / continent key / null for world
  heading         text not null check (char_length(btrim(heading)) between 1 and 80),
  body            text not null check (char_length(btrim(body)) between 1 and 1200),
  button_label    text not null default 'See the conference' check (char_length(btrim(button_label)) between 1 and 30),
  quoted_reach    int  not null check (quoted_reach >= 0),
  credits         int  not null check (credits > 0),
  ledger_id       uuid references public.store_ledger(id) on delete set null,
  status          text not null default 'in_review'
                  check (status in ('in_review','rejected','cancelled','sending','paused','sent')),
  reject_reason   text check (reject_reason is null or char_length(reject_reason) <= 500),
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  campaign_id     uuid references public.email_campaigns(id) on delete set null,
  created_at      timestamptz not null default now(),
  finished_at     timestamptz,
  check ((scope = 'world') = (target is null))
);
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

alter table public.paid_announcement_prices  enable row level security;
alter table public.paid_announcement_config  enable row level security;
alter table public.paid_announcements        enable row level security;
alter table public.paid_announcement_sends   enable row level security;
revoke all on public.paid_announcement_prices, public.paid_announcement_config,
              public.paid_announcements, public.paid_announcement_sends from public, anon, authenticated;
-- No policies: everything goes through the functions below.

-- 2 · Who is in the audience ──────────────────────────────────────────────────
create or replace function public._paid_announcement_people(p_scope text, p_target text, p_conf uuid)
returns table(user_id uuid, email text)
language sql stable security definer set search_path = public, pg_temp as $$
  with cfg as (select cap_days from paid_announcement_config where id),
  base as (
    select p.id, lower(btrim(p.email)) as email, p.nationality
      from profiles p join auth.users u on u.id = p.id
     where not p.is_demo
       and u.email_confirmed_at is not null
       and coalesce(p.notify_email_marketing, true)
       and p.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       and not public.email_is_opted_out(p.email)
       and not public.email_address_failed(p.email)
       and not exists (select 1 from paid_announcement_sends s
                        where s.user_id = p.id
                          and (s.sent_at > now() - make_interval(days => (select cap_days from cfg))
                               or (p_conf is not null and s.conference_id = p_conf)))),
  places as (
    select b.id, public.admin_country_canonical(b.nationality) as country from base b where b.nationality is not null
    union
    select b.id, public.admin_country_canonical(cf.country)
      from base b join applications a on a.user_id = b.id join conferences cf on cf.id = a.conference_id
     where cf.country is not null and not coalesce(cf.is_demo, false))
  select b.id, b.email from base b
   where p_scope = 'world'
      or (p_scope = 'country' and exists (select 1 from places pl where pl.id = b.id
                                            and pl.country = public.admin_country_canonical(p_target)))
      or (p_scope = 'continent' and exists (select 1 from places pl join country_continents cc on cc.country = pl.country
                                              where pl.id = b.id and cc.continent = p_target))
$$;
revoke all on function public._paid_announcement_people(text, text, uuid) from public, anon, authenticated;

create or replace function public._paid_announcement_price(p_scope text, p_reach int)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select least(coalesce(max_credits, 2147483647),
               greatest(min_credits, ceil(greatest(p_reach, 0) / 100.0)::int * per_hundred))
    from paid_announcement_prices where scope = p_scope
$$;
revoke all on function public._paid_announcement_price(text, int) from public, anon, authenticated;

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
      then jsonb_build_object('field','body','message','Links and email addresses are not allowed. The button already takes people to your conference page.')
  end
$$;

-- 3 · Organiser RPCs ──────────────────────────────────────────────────────────
-- Places to choose from, with their reach. Read only.
create or replace function public.paid_announcement_targets(p_conf uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_country text; v_continent text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'message','Please sign in again.'); end if;
  if not public.can_use_store(p_conf) then return jsonb_build_object('ok',false,'message','You do not have access to this conference''s Store.'); end if;
  select public.admin_country_canonical(country) into v_country from conferences where id = p_conf;
  select continent into v_continent from country_continents where country = v_country;
  return jsonb_build_object('ok', true,
    'home_country', v_country, 'home_continent', v_continent,
    'cap_days', (select cap_days from paid_announcement_config where id),
    'prices', (select jsonb_agg(jsonb_build_object('scope',scope,'per_hundred',per_hundred,'min_credits',min_credits,'max_credits',max_credits,'label',label)) from paid_announcement_prices),
    'continents', (select jsonb_agg(distinct continent) from country_continents),
    'countries', (select jsonb_agg(country order by country) from country_continents));
end $$;

-- Reach and price for one choice. Inserts nothing.
create or replace function public.paid_announcement_quote(p_conf uuid, p_scope text, p_target text default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_reach int; v_price int; v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok',false,'message','Please sign in again.'); end if;
  if not public.can_use_store(p_conf) then return jsonb_build_object('ok',false,'message','You do not have access to this conference''s Store.'); end if;
  if p_scope not in ('country','continent','world') then return jsonb_build_object('ok',false,'message','Choose a country, a continent or the world.'); end if;
  if p_scope = 'country' and not exists (select 1 from country_continents where country = public.admin_country_canonical(p_target)) then
    return jsonb_build_object('ok',false,'field','target','message','Choose a country from the list.'); end if;
  if p_scope = 'continent' and not exists (select 1 from country_continents where continent = p_target) then
    return jsonb_build_object('ok',false,'field','target','message','Choose a continent from the list.'); end if;
  select count(*) into v_reach from public._paid_announcement_people(p_scope, case when p_scope='world' then null else p_target end, p_conf);
  v_price := public._paid_announcement_price(p_scope, v_reach);
  return jsonb_build_object('ok', true, 'scope', p_scope, 'target', p_target,
    'reach', v_reach, 'credits', v_price,
    'conference_credits', public._conf_lot_sum(p_conf, 'conference', null),
    'your_credits', (select coalesce(sum(remaining),0)::int from credit_lots where holder_type='user' and user_id=v_uid and remaining>0 and (expires_at is null or expires_at>now())),
    'cap_days', (select cap_days from paid_announcement_config where id));
end $$;

-- Submit for review: charges the credits now (returned on reject or cancel).
-- Short of credits: {ok:false, need_credits} exactly like buy_email_pack, so
-- the client's useStoreBuy pattern works unchanged.
create or replace function public.request_paid_announcement(
  p_conf uuid, p_scope text, p_target text, p_heading text, p_body text,
  p_button_label text default 'See the conference', p_top_up boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_q jsonb; v_problem jsonb; v_parts jsonb; v_have int; v_mine int;
        v_ledger uuid; v_id uuid; v_conf record; v_target text;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'message','Please sign in again.'); end if;
  if not public.can_use_store(p_conf) then return jsonb_build_object('ok',false,'message','You do not have access to this conference''s Store.'); end if;
  select * into v_conf from conferences where id = p_conf;
  if v_conf.is_demo then return jsonb_build_object('ok',false,'message','Demo conferences cannot send announcements.'); end if;
  if v_conf.end_date is not null and v_conf.end_date < current_date then
    return jsonb_build_object('ok',false,'message','This conference has already ended.'); end if;
  if not coalesce(v_conf.is_public, false) then
    return jsonb_build_object('ok',false,'message','Publish your conference first, so the button has a page to open.'); end if;
  if exists (select 1 from paid_announcements where conference_id = p_conf and status in ('in_review','sending','paused')) then
    return jsonb_build_object('ok',false,'message','This conference already has an announcement waiting or sending. Wait until it is done.'); end if;
  v_problem := public._paid_announcement_text_problem(p_heading, p_body, p_button_label);
  if v_problem is not null then return jsonb_build_object('ok',false) || v_problem; end if;
  v_target := case when p_scope = 'world' then null
                   when p_scope = 'country' then public.admin_country_canonical(p_target)
                   else p_target end;
  perform pg_advisory_xact_lock(hashtext('paid_announcement:' || p_conf::text));
  v_q := public.paid_announcement_quote(p_conf, p_scope, v_target);
  if not (v_q->>'ok')::boolean then return v_q; end if;
  if (v_q->>'reach')::int = 0 then return jsonb_build_object('ok',false,'field','target','message','Nobody can receive an announcement there right now. Choose a bigger area.'); end if;
  v_parts := public._spend_conference_credits(p_conf, (v_q->>'credits')::int, case when p_top_up then v_uid end);
  if v_parts is null then
    v_have := public._conf_lot_sum(p_conf, 'conference', null);
    v_mine := (v_q->>'your_credits')::int;
    return jsonb_build_object('ok',false,'credits',(v_q->>'credits')::int,'conference_credits',v_have,
      'need_credits', (v_q->>'credits')::int - v_have - case when p_top_up then v_mine else 0 end,
      'message','It seems you don''t have enough credits for this');
  end if;
  insert into store_ledger(conference_id, user_id, kind, quantity, ref, parts)
    values (p_conf, v_uid, 'announcement', (v_q->>'credits')::int, p_scope || ':' || coalesce(v_target,'world'), v_parts)
    returning id into v_ledger;
  insert into paid_announcements(conference_id, requested_by, scope, target, heading, body, button_label, quoted_reach, credits, ledger_id)
    values (p_conf, v_uid, p_scope, v_target, btrim(p_heading), btrim(p_body), btrim(p_button_label),
            (v_q->>'reach')::int, (v_q->>'credits')::int, v_ledger)
    returning id into v_id;
  return public._store_state(p_conf, v_uid) || jsonb_build_object('ok', true, 'id', v_id,
    'message', 'Sent for review. We check every announcement within a day before it goes out.');
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

create or replace function public.my_paid_announcements(p_conf uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.can_use_store(p_conf) then return jsonb_build_object('ok',false,'message','You do not have access to this conference''s Store.'); end if;
  return jsonb_build_object('ok', true, 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'scope', a.scope, 'target', a.target, 'heading', a.heading, 'body', a.body,
      'button_label', a.button_label, 'status', a.status, 'reject_reason', a.reject_reason,
      'credits', a.credits, 'quoted_reach', a.quoted_reach, 'created_at', a.created_at,
      'reviewed_at', a.reviewed_at, 'finished_at', a.finished_at,
      'reached', (select count(*) from paid_announcement_sends s where s.announcement_id = a.id),
      'clicked', (select count(*) from email_campaign_recipients r where r.campaign_id = a.campaign_id and r.first_click_at is not null and not r.is_test)
    ) order by a.created_at desc)
    from paid_announcements a where a.conference_id = p_conf), '[]'::jsonb));
end $$;

-- 4 · Rendering (Gavelling's email look) ───────────────────────────────────────
create or replace function public._html_escape(t text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select replace(replace(replace(replace(coalesce(t,''), '&','&amp;'), '<','&lt;'), '>','&gt;'), '"','&quot;')
$$;

create or replace function public._paid_announcement_render(p_id uuid)
returns table(subject text, body_text text, body_html text, links jsonb, from_name text, reply_to text)
language sql stable security definer set search_path = public, pg_temp as $$
  with a as (select * from paid_announcements where id = p_id),
  c as (select cf.* from conferences cf join a on a.conference_id = cf.id),
  w as (select case a.scope when 'world' then 'Gavelling users around the world'
                            when 'continent' then 'Gavelling users in ' || initcap(replace(a.target,'-',' '))
                            else 'Gavelling users in ' || a.target end as who from a)
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
                       'conference', 'https://gavelling.com/conferences/' || c.slug),
    left(coalesce(nullif(c.acronym,''), c.full_name), 60) || ' via Gavelling',
    c.contact_email
  from a, c, w
$$;
revoke all on function public._paid_announcement_render(uuid) from public, anon, authenticated;

-- 5 · Admin review ────────────────────────────────────────────────────────────
create or replace function public.admin_paid_announcements(p_status text default 'in_review')
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform admins only'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'conference_id', a.conference_id, 'conference', c.full_name, 'acronym', c.acronym, 'slug', c.slug,
      'scope', a.scope, 'target', a.target, 'heading', a.heading, 'body', a.body, 'button_label', a.button_label,
      'credits', a.credits, 'quoted_reach', a.quoted_reach, 'status', a.status, 'reject_reason', a.reject_reason,
      'created_at', a.created_at, 'reviewed_at', a.reviewed_at,
      'reached', (select count(*) from paid_announcement_sends s where s.announcement_id = a.id),
      'clicked', (select count(*) from email_campaign_recipients r where r.campaign_id = a.campaign_id and r.first_click_at is not null and not r.is_test),
      'preview_html', (select replace(replace(r.body_html, '{{CLICK_TOKEN}}', 'preview'), '{{UNSUBSCRIBE_URL}}', 'https://gavelling.com/unsubscribe') from public._paid_announcement_render(a.id) r)
    ) order by a.created_at)
    from paid_announcements a join conferences c on c.id = a.conference_id
    where p_status is null or a.status = p_status), '[]'::jsonb);
end $$;

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
        'remaining', (select count(*) from public._paid_announcement_people(a.scope, a.target, a.conference_id)),
        'would_queue_now', v_budget, 'email_paused', public.email_sending_is_paused()));
      continue;
    end if;
    if public.email_sending_is_paused() then return jsonb_build_object('state','email_paused'); end if;
    if v_budget <= 0 then v_out := v_out || jsonb_build_array(jsonb_build_object('id',a.id,'state','throttled')); exit; end if;
    v_n := 0;
    for rec in select * from public._paid_announcement_people(a.scope, a.target, a.conference_id)
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
revoke all on function public.paid_announcement_targets(uuid)                                   from public, anon;
revoke all on function public.paid_announcement_quote(uuid, text, text)                         from public, anon;
revoke all on function public.request_paid_announcement(uuid, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.cancel_paid_announcement(uuid)                                    from public, anon;
revoke all on function public.my_paid_announcements(uuid)                                       from public, anon;
revoke all on function public.admin_paid_announcements(text)                                    from public, anon;
revoke all on function public.admin_review_paid_announcement(uuid, boolean, text)               from public, anon;
revoke all on function public.queue_paid_announcements_tick(boolean)                            from public, anon, authenticated;
grant execute on function public.paid_announcement_targets(uuid)                                   to authenticated;
grant execute on function public.paid_announcement_quote(uuid, text, text)                         to authenticated;
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

-- 9 · Rolled-back test (sends NOTHING: the tick runs only in preview) ─────────
-- begin;
--   -- as the organiser of a test conference with conference credits:
--   select set_config('request.jwt.claims', json_build_object('sub','<organiser uuid>','role','authenticated')::text, true);
--   set local role authenticated;
--   select public.paid_announcement_quote('<conf>', 'country', 'Kenya');          -- reach + price, no insert
--   select public.request_paid_announcement('<conf>', 'country', 'Kenya',
--          'Applications are open', 'Join us in Nairobi this December.', 'See the conference', false);
--   select public.request_paid_announcement('<conf>', 'country', 'Kenya', 'x', 'see www.site.com', 'Go', false); -- refused: links
--   select public.my_paid_announcements('<conf>');                                 -- status in_review
--   reset role;
--   -- as a platform admin:
--   select set_config('request.jwt.claims', json_build_object('sub','<admin uuid>','role','authenticated')::text, true);
--   set local role authenticated;
--   select public.admin_review_paid_announcement('<id>', false, '');               -- refused: needs reason
--   select public.admin_review_paid_announcement('<id>', true, null);              -- approved, campaign row
--   reset role;
--   select public.queue_paid_announcements_tick();                                 -- PREVIEW ONLY
--   select count(*) from email_outbox where created_at > now() - interval '1 minute'; -- must be unchanged
-- rollback;
