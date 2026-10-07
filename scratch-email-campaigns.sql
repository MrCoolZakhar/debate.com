-- ─────────────────────────────────────────────────────────────────────────────
-- Email campaigns: a paced newsletter to every account, with a conversion
-- read-out (who clicked, and whether recipients then actually used Gavelling).
--
-- DRAFT. NOT APPLIED. Written 7 Oct 2026 by a Claude Code run, which may not
-- change the database (CLAUDE.md, Owner Decisions). Paste the whole file into
-- the chat's Supabase work as ONE statement block; it is wrapped in
-- begin / commit.
--
-- What it creates
--   email_campaigns            one row per mass email (the edition)
--   email_campaign_recipients  one row per account per campaign, with an
--                              unguessable click token
--   email_campaign_clicks      one row per counted click (campaign, recipient,
--                              link key, time) and nothing else
--   queue_email_campaign(slug, preview default TRUE)   preview inserts NOTHING
--   queue_email_campaigns_tick()   what the (commented-out) cron calls
--   queue_email_campaign_test(slug, email)   one copy to one address, now
--   record_campaign_click(token, key, record default true)   the /r route
--   admin_email_campaigns()            list, platform admins only
--   admin_email_campaign_report(slug)  report, platform admins only
--
-- Pacing (the prereg campaign's rule, CLAUDE.md §6): each run queues at most
-- per_run (<= 100) and at most 120 minus every email_outbox row created in the
-- last 10 minutes, so the burst alarm (150 due in 10 min) never fires and the
-- auto-pause (600) is never near. The two-per-hour per-address cap still
-- applies on insert (it can only defer a row, never drop it).
--
-- Link contract: every tracked link in body_html / body_text is
--   https://gavelling.com/r/{{CLICK_TOKEN}}/<key>
-- with <key> a key of email_campaigns.links (key -> destination URL). The
-- unsubscribe link is {{UNSUBSCRIBE_URL}}. Both are filled per recipient at
-- queue time, so body_html is complete on insert and the render trigger leaves
-- it alone.
--
-- Privacy: a click stores the campaign, the recipient row it belongs to, the
-- link key and the time. No IP, no user agent, no cookie, no referrer, no
-- third party. Opens are NOT tracked (no pixel).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.email_campaigns (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  subject      text not null check (btrim(subject) <> ''),
  from_name    text not null default 'Peter from Gavelling',
  reply_to     text default 'wearegavelling@gmail.com',
  body_html    text not null check (btrim(body_html) <> ''),
  body_text    text not null check (btrim(body_text) <> ''),
  -- key -> destination URL. 'home' is where an unknown key lands.
  links        jsonb not null default '{}'::jsonb check (jsonb_typeof(links) = 'object'),
  -- 'everyone' = every non-demo account with a confirmed email (see below).
  audience     text not null default 'everyone' check (audience in ('everyone')),
  per_run      int  not null default 100 check (per_run between 1 and 100),
  started_at   timestamptz,          -- null = nothing is sent by the tick
  paused_at    timestamptz,          -- set = the tick and live runs stop
  finished_at  timestamptz,          -- set by the queue when nobody is left
  created_at   timestamptz not null default now()
);

create table if not exists public.email_campaign_recipients (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.email_campaigns(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete set null,
  email           text not null,
  -- 128 random bits as 32 hex characters. Unguessable; the only thing in the URL.
  click_token     text not null unique default replace(gen_random_uuid()::text, '-', ''),
  outbox_id       uuid,             -- email_outbox.id (no FK: the outbox is pruned independently)
  is_test         boolean not null default false,
  queued_at       timestamptz not null default now(),
  first_click_at  timestamptz,
  clicks          int not null default 0
);
-- One real send per account per campaign (tests are exempt so a test to the
-- owner never stops his real copy).
create unique index if not exists email_campaign_recipients_one_per_user
  on public.email_campaign_recipients (campaign_id, user_id) where not is_test;
create unique index if not exists email_campaign_recipients_one_per_email
  on public.email_campaign_recipients (campaign_id, lower(email)) where not is_test;
create index if not exists email_campaign_recipients_user_idx
  on public.email_campaign_recipients (user_id);

create table if not exists public.email_campaign_clicks (
  id            bigint generated always as identity primary key,
  campaign_id   uuid not null references public.email_campaigns(id) on delete cascade,
  recipient_id  uuid not null references public.email_campaign_recipients(id) on delete cascade,
  link_key      text not null,
  clicked_at    timestamptz not null default now()
);
create index if not exists email_campaign_clicks_campaign_idx
  on public.email_campaign_clicks (campaign_id, link_key);

-- RLS on, NO policies, no table grants: only the SECURITY DEFINER functions
-- below read or write these.
alter table public.email_campaigns           enable row level security;
alter table public.email_campaign_recipients enable row level security;
alter table public.email_campaign_clicks     enable row level security;
revoke all on public.email_campaigns, public.email_campaign_recipients, public.email_campaign_clicks
  from public, anon, authenticated;
revoke all on sequence public.email_campaign_clicks_id_seq from public, anon, authenticated;

-- ── Who is in the audience ──────────────────────────────────────────────────
-- 'everyone' = every profile that is not a demo account, whose auth email is
-- CONFIRMED (84 unconfirmed sign-ups on 7 Oct 2026 are skipped: they are the
-- likeliest bounces and a bounce hurts the whole domain), that has not turned
-- off product email (profiles.notify_email_marketing, 13 people), is not on
-- the global unsubscribe list, is not a failed address, and has not already
-- been sent this campaign. Ordered by a stable hash, so the send order is
-- effectively random: early and late recipients are comparable cohorts.
create or replace function public._email_campaign_candidates(p_campaign uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, lower(btrim(p.email))
    from profiles p
    join auth.users u on u.id = p.id
   where not p.is_demo
     and u.email_confirmed_at is not null
     and coalesce(p.notify_email_marketing, true)
     and p.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     and not exists (select 1 from email_campaign_recipients r
                      where r.campaign_id = p_campaign and not r.is_test
                        and (r.user_id = p.id or lower(r.email) = lower(btrim(p.email))))
     and not public.email_is_opted_out(p.email)
     and not public.email_address_failed(p.email)
   order by md5(p_campaign::text || p.id::text)
$$;
revoke all on function public._email_campaign_candidates(uuid) from public, anon, authenticated;

-- Fill the two per-recipient placeholders.
create or replace function public._email_campaign_fill(p_body text, p_token text, p_unsub uuid)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select replace(replace(p_body, '{{CLICK_TOKEN}}', p_token),
                 '{{UNSUBSCRIBE_URL}}',
                 coalesce('https://gavelling.com/unsubscribe?t=' || p_unsub::text, 'https://gavelling.com/unsubscribe'))
$$;
revoke all on function public._email_campaign_fill(text, text, uuid) from public, anon, authenticated;

-- ── queue_email_campaign ────────────────────────────────────────────────────
-- p_preview TRUE (the default): INSERTS NOTHING ANYWHERE. It does not even
-- call unsubscribe_token_for (which writes email_optouts). It returns the
-- counts and a sample of five addresses.
-- p_preview FALSE: CALLING IT SENDS. Queues the next batch into email_outbox.
-- The line that skips the insert in preview is the `if p_preview then return`
-- below; everything after it writes.
create or replace function public.queue_email_campaign(p_slug text, p_preview boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c         email_campaigns%rowtype;
  v_recent  int;
  v_budget  int;
  v_left    int;
  v_n       int := 0;
  v_unsub   uuid;
  v_outbox  uuid;
  v_token   text;
  rec       record;
begin
  select * into c from email_campaigns where slug = p_slug;
  if not found then
    return jsonb_build_object('state', 'not_found', 'slug', p_slug);
  end if;

  -- Live runs, one at a time across ALL campaigns, so two runs can never both
  -- spend the same 10-minute budget. Preview takes no lock.
  if not p_preview then
    perform pg_advisory_xact_lock(hashtext('email_campaigns_queue'));
  end if;

  select count(*) into v_recent from email_outbox where created_at > now() - interval '10 minutes';
  v_budget := greatest(0, least(c.per_run, 120 - v_recent));

  if p_preview then
    select count(*) into v_left from public._email_campaign_candidates(c.id);
    return jsonb_build_object(
      'state', 'preview',
      'slug', c.slug,
      'subject', c.subject,
      'started', c.started_at is not null,
      'paused', c.paused_at is not null,
      'finished', c.finished_at is not null,
      'email_paused', public.email_sending_is_paused(),
      'already_queued', (select count(*) from email_campaign_recipients r where r.campaign_id = c.id and not r.is_test),
      'eligible_remaining', v_left,
      'outbox_last_10_min', v_recent,
      'would_queue_now', least(v_budget, v_left),
      'runs_left_at_full_pace', ceil(v_left::numeric / c.per_run),
      'links', c.links,
      'unfilled_tokens_in_html', position('{{CLICK_TOKEN}}' in c.body_html) > 0,
      'sample', (select coalesce(jsonb_agg(s.email), '[]'::jsonb)
                   from (select x.email from public._email_campaign_candidates(c.id) x limit 5) s)
    );
  end if;

  -- ── Everything below WRITES and SENDS. ──
  if c.started_at is null  then return jsonb_build_object('state', 'not_started', 'slug', c.slug); end if;
  if c.paused_at is not null then return jsonb_build_object('state', 'paused', 'slug', c.slug); end if;
  if c.finished_at is not null then return jsonb_build_object('state', 'finished', 'slug', c.slug); end if;
  if public.email_sending_is_paused() then return jsonb_build_object('state', 'email_paused'); end if;
  if v_budget <= 0 then return jsonb_build_object('state', 'throttled', 'recent', v_recent); end if;

  for rec in select * from public._email_campaign_candidates(c.id) limit v_budget loop
    v_token := replace(gen_random_uuid()::text, '-', '');
    v_unsub := public.unsubscribe_token_for(rec.email);
    insert into email_outbox (recipient_email, subject, body, body_html, status, from_name, reply_to)
    values (rec.email, c.subject,
            public._email_campaign_fill(c.body_text, v_token, v_unsub),
            public._email_campaign_fill(c.body_html, v_token, v_unsub),
            'pending', c.from_name, c.reply_to)
    returning id into v_outbox;
    insert into email_campaign_recipients (campaign_id, user_id, email, click_token, outbox_id)
    values (c.id, rec.user_id, rec.email, v_token, v_outbox);
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    update email_campaigns set finished_at = now() where id = c.id and finished_at is null;
    return jsonb_build_object('state', 'finished', 'slug', c.slug);
  end if;

  return jsonb_build_object('state', 'queued', 'slug', c.slug, 'queued', v_n, 'recent_before', v_recent);
end
$$;
revoke all on function public.queue_email_campaign(text, boolean) from public, anon, authenticated;

-- What the cron calls: every started, unpaused, unfinished campaign, oldest
-- first, sharing the one budget (each call re-counts the outbox, so a second
-- campaign sees the rows the first just inserted). CALLING IT SENDS.
create or replace function public.queue_email_campaigns_tick()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c      record;
  v_out  jsonb := '[]'::jsonb;
begin
  for c in select slug from email_campaigns
            where started_at is not null and paused_at is null and finished_at is null
            order by started_at loop
    v_out := v_out || jsonb_build_array(public.queue_email_campaign(c.slug, false));
  end loop;
  return v_out;
end
$$;
revoke all on function public.queue_email_campaigns_tick() from public, anon, authenticated;

-- One copy to one address (the owner's own test). CALLING IT SENDS to that
-- address. The row is a test recipient (is_test): it never blocks the real
-- send to the same person and is left out of every report.
create or replace function public.queue_email_campaign_test(p_slug text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c        email_campaigns%rowtype;
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_token  text := replace(gen_random_uuid()::text, '-', '');
  v_unsub  uuid;
  v_outbox uuid;
begin
  select * into c from email_campaigns where slug = p_slug;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'reason', 'bad_email'); end if;
  v_unsub := public.unsubscribe_token_for(v_email);
  insert into email_outbox (recipient_email, subject, body, body_html, status, from_name, reply_to)
  values (v_email, '[Test] ' || c.subject,
          public._email_campaign_fill(c.body_text, v_token, v_unsub),
          public._email_campaign_fill(c.body_html, v_token, v_unsub),
          'pending', c.from_name, c.reply_to)
  returning id into v_outbox;
  insert into email_campaign_recipients (campaign_id, user_id, email, click_token, outbox_id, is_test)
  values (c.id, null, v_email, v_token, v_outbox, true);
  return jsonb_build_object('ok', true, 'outbox_id', v_outbox, 'click_token', v_token);
end
$$;
revoke all on function public.queue_email_campaign_test(text, text) from public, anon, authenticated;

-- ── record_campaign_click ───────────────────────────────────────────────────
-- Called by /r/[token]/[key] with the anon key. Returns the destination URL
-- for the key, or the campaign's 'home' link when the key is unknown, or null
-- when the token is unknown. Never raises, never returns the email or any id.
-- p_record false = look up only (the route passes it for bot user agents, e.g.
-- link scanners). A recipient's recorded clicks stop at 200 rows so a leaked
-- link cannot be used to fill the table; the redirect still works.
create or replace function public.record_campaign_click(p_token text, p_key text, p_record boolean default true)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r     record;
  v_key text := lower(coalesce(p_key, ''));
  v_url text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,64}$' then return null; end if;

  select rc.id, rc.campaign_id, rc.clicks, c.links
    into r
    from email_campaign_recipients rc
    join email_campaigns c on c.id = rc.campaign_id
   where rc.click_token = p_token;
  if not found then return null; end if;

  if v_key ~ '^[a-z0-9-]{1,40}$' and r.links ? v_key then
    v_url := r.links ->> v_key;
    if p_record and r.clicks < 200 then
      insert into email_campaign_clicks (campaign_id, recipient_id, link_key) values (r.campaign_id, r.id, v_key);
      update email_campaign_recipients
         set clicks = clicks + 1, first_click_at = coalesce(first_click_at, now())
       where id = r.id;
    end if;
    return v_url;
  end if;

  return r.links ->> 'home';
exception when others then
  return null;
end
$$;
revoke all on function public.record_campaign_click(text, text, boolean) from public;
grant execute on function public.record_campaign_click(text, text, boolean) to anon, authenticated;

-- ── admin_email_campaigns ───────────────────────────────────────────────────
create or replace function public.admin_email_campaigns()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then raise exception 'not authorised'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'slug', c.slug, 'subject', c.subject, 'created_at', c.created_at,
             'started_at', c.started_at, 'paused_at', c.paused_at, 'finished_at', c.finished_at,
             'queued', (select count(*) from email_campaign_recipients r where r.campaign_id = c.id and not r.is_test))
           order by c.created_at desc)
      from email_campaigns c), '[]'::jsonb);
end
$$;
revoke all on function public.admin_email_campaigns() from public, anon;
grant execute on function public.admin_email_campaigns() to authenticated;

-- ── admin_email_campaign_report ─────────────────────────────────────────────
-- CONVERSION, exactly: a recipient (not a test, and only if their email was
-- SENT) converts on an action when they did it in the 7 days after their email
-- was queued AND had not done that same action in the 30 days before it. "Any
-- action" = converted on at least one. Split into clickers (clicked any link)
-- and non-clickers. Recipients queued less than 7 days ago are still counted
-- with what they have done so far, and reported as `window_open`.
--
-- The actions (each one an account-attributed row, by its own timestamp):
--   applied_conference  applications, self-submitted (invited_email is null), submitted_at
--   applied_job         job_applications.submitted_at (chair / staff job board)
--   created_conference  conferences.organizer_id, not demo, created_at
--   joined_secretariat  conference_organizers, role <> 'owner', created_at
--   chaired_session     chair_device_claims.claimed_at (a SIGNED-IN chair opened a chair page)
--   joined_as_delegate  delegate_seat_claims with holder_key 'u:<user>' (a SIGNED-IN delegate), claimed_at
--   added_cv_entry      mun_cv_entries, source 'manual', created_at
--   bought_credits      credit_lots, source 'purchase', holder_type 'user', created_at
--   bought_unlimited    subscriptions, plan unlimited_monthly / unlimited_yearly,
--                       a real Stripe id (not 'ambassador%'), created_at; trials excluded
--   unlocked_guide      guide_unlocks.created_at
--
-- What can NOT be attributed, honestly:
--   * Sessions run anonymously (no account) cannot be tied to anyone: creating
--     a standalone committee writes no user id at all, and an anonymous
--     delegate is a device hash. Only signed-in chairs and delegates count.
--   * Seat and chair-device claims are deleted when a room is deleted (a
--     standalone room 24 hours after it ends) and seat claims also on idle
--     leave, so those two actions UNDER-count the older the campaign gets.
--     Read them within a day or two of the send.
--   * claimed_at is the latest claim, so a returning chair can look "new".
--   * Clicks include some link scanners whose user agent looks human
--     (corporate mail filters); the route drops the obvious bots only.
--   * There is no holdout group, so clickers vs non-clickers shows association,
--     not cause: people who click were already more likely to act.
--   * signed_in_since is soft: auth.users keeps only the LATEST sign-in, so it
--     says "signed in at some point after the email", not "because of it".
create or replace function public.admin_email_campaign_report(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c        email_campaigns%rowtype;
  v_out    jsonb;
begin
  if not public.is_platform_admin() then raise exception 'not authorised'; end if;
  select * into c from email_campaigns where slug = p_slug;
  if not found then return jsonb_build_object('found', false, 'slug', p_slug); end if;

  with rec as (
    select r.id, r.user_id, r.queued_at, r.first_click_at, r.clicks,
           coalesce(o.status, 'unknown') as ostatus
      from email_campaign_recipients r
      left join email_outbox o on o.id = r.outbox_id
     where r.campaign_id = c.id and not r.is_test
  ),
  reached as (
    select * from rec where ostatus = 'sent' and user_id is not null
  ),
  bounds as (
    select min(queued_at) - interval '30 days' as lo, max(queued_at) + interval '7 days' as hi from reached
  ),
  ev as (
    select a.user_id, 'applied_conference'::text as action, a.submitted_at as at
      from applications a, bounds b
     where a.invited_email is null and a.submitted_at between b.lo and b.hi
       and a.user_id in (select user_id from reached)
    union all
    select j.user_id, 'applied_job', j.submitted_at
      from job_applications j, bounds b
     where j.submitted_at between b.lo and b.hi and j.user_id in (select user_id from reached)
    union all
    select cf.organizer_id, 'created_conference', cf.created_at
      from conferences cf, bounds b
     where not coalesce(cf.is_demo, false) and cf.created_at between b.lo and b.hi
       and cf.organizer_id in (select user_id from reached)
    union all
    select co.user_id, 'joined_secretariat', co.created_at
      from conference_organizers co, bounds b
     where co.role <> 'owner' and co.created_at between b.lo and b.hi
       and co.user_id in (select user_id from reached)
    union all
    select cd.user_id, 'chaired_session', cd.claimed_at
      from chair_device_claims cd, bounds b
     where cd.claimed_at between b.lo and b.hi and cd.user_id in (select user_id from reached)
    union all
    -- holder_key is 'u:<uuid>' for an account, 'd:<sha256>' for an anonymous
    -- device; the CASE keeps the uuid cast away from device keys.
    select d.uid, 'joined_as_delegate', d.claimed_at
      from (select case when ds.holder_key ~ '^u:[0-9a-f-]{36}$' then substr(ds.holder_key, 3)::uuid end as uid,
                   ds.claimed_at
              from delegate_seat_claims ds) d, bounds b
     where d.uid is not null and d.claimed_at between b.lo and b.hi
       and d.uid in (select user_id from reached)
    union all
    select m.user_id, 'added_cv_entry', m.created_at
      from mun_cv_entries m, bounds b
     where m.source = 'manual' and m.created_at between b.lo and b.hi
       and m.user_id in (select user_id from reached)
    union all
    select l.user_id, 'bought_credits', l.created_at
      from credit_lots l, bounds b
     where l.source = 'purchase' and l.holder_type = 'user' and l.created_at between b.lo and b.hi
       and l.user_id in (select user_id from reached)
    union all
    select s.owner_user_id, 'bought_unlimited', s.created_at
      from subscriptions s, bounds b
     where s.plan in ('unlimited_monthly', 'unlimited_yearly')
       and coalesce(s.stripe_subscription_id, '') not like 'ambassador%'
       and s.created_at between b.lo and b.hi
       and s.owner_user_id in (select user_id from reached)
    union all
    select g.user_id, 'unlocked_guide', g.created_at
      from guide_unlocks g, bounds b
     where g.created_at between b.lo and b.hi and g.user_id in (select user_id from reached)
  ),
  conv as (   -- one row per (recipient, action) that converted
    select distinct r.id, e.action
      from reached r
      join ev e on e.user_id = r.user_id
     where e.at > r.queued_at and e.at <= r.queued_at + interval '7 days'
       and not exists (select 1 from ev e2
                        where e2.user_id = r.user_id and e2.action = e.action
                          and e2.at > r.queued_at - interval '30 days' and e2.at <= r.queued_at)
  ),
  per_rec as (
    select r.id, (r.first_click_at is not null) as clicker,
           exists (select 1 from conv v where v.id = r.id) as converted,
           r.queued_at > now() - interval '7 days' as window_open,
           exists (select 1 from auth.users u where u.id = r.user_id and u.last_sign_in_at > r.queued_at) as signed_in_since
      from reached r
  ),
  actions(action, label, ord) as (
    values ('applied_conference', 'Applied to a conference', 1),
           ('created_conference', 'Created a conference', 2),
           ('joined_secretariat', 'Joined a secretariat', 3),
           ('chaired_session', 'Chaired a session (signed in)', 4),
           ('joined_as_delegate', 'Joined a session as a delegate (signed in)', 5),
           ('added_cv_entry', 'Added a MUN CV entry', 6),
           ('applied_job', 'Applied for a chair or staff role', 7),
           ('bought_credits', 'Bought credits', 8),
           ('bought_unlimited', 'Bought Unlimited', 9),
           ('unlocked_guide', 'Unlocked a guide', 10)
  )
  select jsonb_build_object(
    'found', true,
    'campaign', jsonb_build_object('slug', c.slug, 'subject', c.subject, 'per_run', c.per_run,
                                   'created_at', c.created_at, 'started_at', c.started_at,
                                   'paused_at', c.paused_at, 'finished_at', c.finished_at),
    'queued', (select count(*) from rec),
    'delivery', jsonb_build_object(
      'sent',       (select count(*) from rec where ostatus = 'sent'),
      'failed',     (select count(*) from rec where ostatus = 'failed'),
      'suppressed', (select count(*) from rec where ostatus = 'suppressed'),
      'in_flight',  (select count(*) from rec where ostatus in ('pending', 'held', 'sending')),
      'other',      (select count(*) from rec where ostatus not in ('sent', 'failed', 'suppressed', 'pending', 'held', 'sending'))),
    'clicks', jsonb_build_object(
      'unique_clickers', (select count(*) from rec where first_click_at is not null),
      'total',           (select coalesce(sum(clicks), 0) from rec),
      'by_link', coalesce((
        select jsonb_agg(jsonb_build_object('key', k.key, 'url', k.value,
                 'clicks', (select count(*) from email_campaign_clicks cl join rec on rec.id = cl.recipient_id
                             where cl.campaign_id = c.id and cl.link_key = k.key),
                 'clickers', (select count(distinct cl.recipient_id) from email_campaign_clicks cl join rec on rec.id = cl.recipient_id
                               where cl.campaign_id = c.id and cl.link_key = k.key))
               order by k.key)
          from jsonb_each_text(c.links) k), '[]'::jsonb)),
    'conversions', jsonb_build_object(
      'window_days', 7, 'baseline_days', 30,
      'reached', (select count(*) from per_rec),
      'window_open', (select count(*) from per_rec where window_open),
      'clickers',     jsonb_build_object('n', (select count(*) from per_rec where clicker),
                                         'converted', (select count(*) from per_rec where clicker and converted)),
      'non_clickers', jsonb_build_object('n', (select count(*) from per_rec where not clicker),
                                         'converted', (select count(*) from per_rec where not clicker and converted)),
      'by_action', (select jsonb_agg(jsonb_build_object(
                       'action', a.action, 'label', a.label,
                       'clickers', (select count(*) from conv v join per_rec p on p.id = v.id where v.action = a.action and p.clicker),
                       'non_clickers', (select count(*) from conv v join per_rec p on p.id = v.id where v.action = a.action and not p.clicker))
                     order by a.ord) from actions a),
      'signed_in_since', jsonb_build_object(
        'clickers', (select count(*) from per_rec where clicker and signed_in_since),
        'non_clickers', (select count(*) from per_rec where not clicker and signed_in_since)))
  ) into v_out;

  return v_out;
end
$$;
revoke all on function public.admin_email_campaign_report(text) from public, anon;
grant execute on function public.admin_email_campaign_report(text) to authenticated;

-- ── Cron: COMMENTED OUT ON PURPOSE. ENABLING IT STARTS SENDING. ────────────
-- The tick sends only for campaigns whose started_at is set and paused_at is
-- null, so scheduling it is harmless until a campaign is started, but leave it
-- to the owner. Every 10 minutes, at most 100 per run: ~4,400 accounts take
-- about 7.5 hours.
--
-- select cron.schedule('email-campaigns', '*/10 * * * *', $cron$select public.queue_email_campaigns_tick()$cron$);
--
-- Stop the job entirely:  select cron.unschedule('email-campaigns');

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- TEST BLOCK (run AFTER applying, as ONE paste; everything is rolled back).
-- It never calls a live sending path: only the preview and a click on a
-- recipient row inserted by hand (no email_outbox row is written).
-- ─────────────────────────────────────────────────────────────────────────────
-- begin;
--   insert into public.email_campaigns (slug, subject, body_html, body_text, links)
--   values ('zz-test', 'Test subject',
--           '<a href="https://gavelling.com/r/{{CLICK_TOKEN}}/explore">x</a> <a href="{{UNSUBSCRIBE_URL}}">u</a>',
--           'x https://gavelling.com/r/{{CLICK_TOKEN}}/explore  u {{UNSUBSCRIBE_URL}}',
--           '{"home":"https://gavelling.com/","explore":"https://gavelling.com/conferences/explore"}');
--
--   -- 1. Preview: counts and five sample addresses, nothing inserted.
--   select public.queue_email_campaign('zz-test');                 -- p_preview defaults to TRUE
--   select count(*) as outbox_rows_written_by_preview              -- expect 0 recipients
--     from public.email_campaign_recipients r join public.email_campaigns c on c.id = r.campaign_id
--    where c.slug = 'zz-test';
--
--   -- 2. Live mode refuses while not started (no insert happens on this path).
--   select public.queue_email_campaign('zz-test', false);          -- expect {"state":"not_started"}
--
--   -- 3. A click on a hand-made recipient row (no email is queued).
--   insert into public.email_campaign_recipients (campaign_id, user_id, email, click_token)
--   select id, null, 'nobody@gavelling.invalid', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' from public.email_campaigns where slug = 'zz-test';
--   set local role anon;
--   select public.record_campaign_click('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'explore');  -- the explore URL
--   select public.record_campaign_click('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'nope');     -- the home URL, not recorded
--   select public.record_campaign_click('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'explore');  -- null
--   select public.record_campaign_click('x', 'explore');                                 -- null (bad shape)
--   select has_table_privilege('anon', 'public.email_campaign_clicks', 'select');  -- expect false
--   reset role;
--   select clicks, first_click_at is not null as clicked from public.email_campaign_recipients
--    where click_token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';       -- expect 1, true
--   select link_key from public.email_campaign_clicks;             -- expect one 'explore'
-- rollback;
