-- ============================================================================
-- scratch-advisor-push.sql
--
-- NOT APPLIED. For the chat's Supabase work (CLAUDE.md: every database object is
-- changed only there, never from a Claude Code run). Written 23 Oct 2026 for web push
-- alerts on the faculty advisor board (owner-approved the same day). Steps, secrets and
-- the safe test: docs/sessions/advisor-push.md.
--
-- WHAT IT DOES
--   A faculty advisor taps "Get alerts on this phone" on /advisor. The browser gives a
--   standard Web Push subscription (endpoint + two keys), saved here with the advisor's
--   user id. While one of their students' rooms is debating during the conference's
--   days, the database notices the same moments the board reminds today
--   (src/lib/advisorBoard/reminders.ts + derive.ts):
--     * "soon"     the student's speakers_list row is at most 2 speakers away
--                  (REMIND_AHEAD), once per row;
--     * "speaking" the student holds the floor, once per turn.
--   Each (subscription, turn key) is pushed ONCE (advisor_push_outbox is both the queue
--   and the dedupe). The edge function advisor-push encrypts and sends it (VAPID +
--   aes128gcm, RFC 8291 / 8292, no third-party SDK) and reports back; a 404 / 410 from the
--   push service deletes the subscription.
--
-- WHO IS FOLLOWED (advisor_push_follows, rebuilt, never typed by hand)
--   * conference seats: my_advisor_delegation() read AS THE ADVISOR (faculty advisor or
--     head delegate; observers have no students), so there is ONE definition of "my
--     delegation". Rebuilt on every save and every 5 minutes by the tick, so moved
--     students and late allocations arrive. Empty delegation block seats (no student, no
--     role) are skipped, like the board.
--   * rooms added by code on the device: the client sends (code, country) pairs, NEVER the
--     first names typed on the phone (they stay on the phone; the service worker reads
--     them from the phone's own IndexedDB to word the notification).
--   Student names for conference seats are read LIVE at push time from the allocations
--   (profiles.display_name, else invited_name, as my_advisor_delegation does) and put in
--   the encrypted payload only; once a push is sent its payload is wiped to '{}'.
--
-- WHEN (the conference window, owner 23 Oct 2026: "FAs shouldn't be looking at committees
-- if the conference hasn't started yet")
--   A room linked to a conference pushes only from 00:00 of the start date to the end of
--   the last day in the conference's time zone (UTC when unset or unknown), never while
--   the dates are to be decided. A standalone room added by code has no window. Never
--   while the room is suspended or ended, never in roll call, voting or pre-session.
--
-- THE TRIGGER DESIGN (and why)
--   Options weighed:
--     a) DB triggers on current_speaker / speakers_list / committees writing a dirty-room
--        queue that something drains. Lowest latency, but it adds triggers to the hottest
--        session tables (AGENTS.md: no session schema change without explicit instruction),
--        and a bug there could slow or block a chair's write. Rejected.
--     b) Realtime from a server. Needs a long-running process; edge functions are not
--        one. Rejected.
--     c) A pg_cron edge-function poll every 20-30 s. Simple, but invokes the edge
--        function all conference day whether or not anything changed. Rejected as is.
--     d) CHOSEN: trigger-free. pg_cron runs advisor_push_tick() every 10 seconds INSIDE
--        Postgres. It returns at once when no advisor has alerts on; otherwise it
--        evaluates only the followed rooms that are debating today (a few index reads per
--        followed delegation), queues new turns into advisor_push_outbox, and calls the
--        edge function through pg_net ONLY when something is waiting to be sent.
--   Latency: at most 10 s from the chair's press to the push leaving (plus the push
--   service's own delivery, usually 1-2 s). "Speaks next" fires one full speech ahead,
--   so 10 s is well inside the time an advisor needs to walk into the room.
--   Cost: 8,640 tick runs a day, each a single EXISTS when nobody has alerts on. Edge
--   function invocations = batches of real pushes (a busy room: one every minute or two
--   per followed delegation), far inside the plan's quota. Upgrade path if 10 s ever feels
--   slow: schedule '5 seconds' (pg_cron 1.6.4 is installed and takes second schedules).
--   pg_cron writes one cron.job_run_details row per run (8,640 a day for this job); the
--   commented trim job at the bottom keeps 3 days of THIS job's history only.
--
-- SAFE TO DRY RUN (nothing written, nothing sent):
--   begin; <this file>; select public.advisor_push_tick(p_dry_run := true); rollback;
--   advisor_push_tick(true) only SELECTs: it returns what WOULD be queued and inserts
--   nothing (the early `return` before the insert, marked "DRY RUN STOPS HERE").
--   advisor_push_test(user) queues ONE test push to that ONE user's own subscriptions;
--   advisor_push_kick() sends whatever is queued and evaluates nothing new.
-- ============================================================================

-- ── 1. Tables ───────────────────────────────────────────────────────────────

create table if not exists public.advisor_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The push service URL the browser gave. Only the browser vendors' push services are
  -- accepted (_advisor_push_endpoint_ok), so the edge function never posts anywhere else.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- The board's own Alerts on / off (BoardPrefs.reminders) on that device: off = no push.
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_ok_at timestamptz,
  failures integer not null default 0,
  follows_refreshed_at timestamptz
);
create index if not exists advisor_push_subscriptions_user_idx on public.advisor_push_subscriptions (user_id);

create table if not exists public.advisor_push_follows (
  subscription_id uuid not null references public.advisor_push_subscriptions(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  country text not null,
  country_key text not null,            -- lower(btrim(country))
  country_code text,                    -- conference seats: the allocation's code (findDelegate fallback)
  source text not null check (source in ('conference', 'device')),
  conference_committee_id uuid references public.conference_committees(id) on delete cascade,
  primary key (subscription_id, committee_id, country_key)
);
create index if not exists advisor_push_follows_committee_idx on public.advisor_push_follows (committee_id);

create table if not exists public.advisor_push_outbox (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.advisor_push_subscriptions(id) on delete cascade,
  turn_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0,
  last_status integer,
  unique (subscription_id, turn_key)    -- one push per speaking turn per phone
);
create index if not exists advisor_push_outbox_pending_idx on public.advisor_push_outbox (id) where sent_at is null;

alter table public.advisor_push_subscriptions enable row level security;
alter table public.advisor_push_follows enable row level security;   -- no policies: server only
alter table public.advisor_push_outbox enable row level security;    -- no policies: server only

drop policy if exists advisor_push_subs_own_select on public.advisor_push_subscriptions;
create policy advisor_push_subs_own_select on public.advisor_push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists advisor_push_subs_own_delete on public.advisor_push_subscriptions;
create policy advisor_push_subs_own_delete on public.advisor_push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.advisor_push_subscriptions from anon, authenticated;
revoke all on public.advisor_push_follows from anon, authenticated;
revoke all on public.advisor_push_outbox from anon, authenticated;
-- A user reads only whether their own phone is saved; never the keys.
grant select (id, endpoint, enabled, created_at, updated_at, last_ok_at) on public.advisor_push_subscriptions to authenticated;
grant delete on public.advisor_push_subscriptions to authenticated;

-- ── 2. Small helpers ────────────────────────────────────────────────────────

-- The browser vendors' push services only (Chrome / Edge-Chromium / Opera / Samsung:
-- FCM; Firefox: Mozilla; Safari: Apple; legacy Edge: WNS). Mirrored by
-- PUSH_ENDPOINT_RE in src/lib/advisorBoard/push.ts: change both.
create or replace function public._advisor_push_endpoint_ok(p text)
returns boolean language sql immutable as $$
  select p is not null and length(p) <= 1024
    and p ~ '^https://(fcm\.googleapis\.com|jmt17\.google\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
$$;

-- A caucus stamp: an ISO string or epoch milliseconds. Null when unreadable.
create or replace function public._advisor_push_ts(p jsonb)
returns timestamptz language plpgsql stable as $$
begin
  if p is null or jsonb_typeof(p) = 'null' then return null; end if;
  if jsonb_typeof(p) = 'number' then return to_timestamp((p #>> '{}')::double precision / 1000.0); end if;
  return (p #>> '{}')::timestamptz;
exception when others then return null;
end $$;

-- Epoch milliseconds as text ('' for null): the turn-key nonce, like derive.ts epoch().
create or replace function public._advisor_push_ms(p timestamptz)
returns text language sql immutable as $$
  select coalesce(floor(extract(epoch from p) * 1000)::bigint::text, '')
$$;

-- Today is one of the conference's days, in its own time zone (UTC when none / unknown).
create or replace function public._advisor_push_conference_open(p_start date, p_end date, p_tz text, p_tbd boolean)
returns boolean language plpgsql stable as $$
declare v_today date;
begin
  if coalesce(p_tbd, false) or p_start is null then return false; end if;
  begin
    v_today := (now() at time zone coalesce(nullif(btrim(p_tz), ''), 'UTC'))::date;
  exception when others then
    v_today := (now() at time zone 'UTC')::date;
  end;
  return v_today >= p_start and v_today <= greatest(coalesce(p_end, p_start), p_start);
end $$;

-- Turns a Room Order Tour de Table still has to call (src/lib/roomOrderQueue.ts): its
-- numbered placeholders are never speakers_list rows, but they are speakers ahead.
create or replace function public._advisor_push_room_order_left(p_caucus jsonb)
returns integer language plpgsql immutable as $$
declare v_size integer; v_called integer;
begin
  if p_caucus is null or p_caucus->>'type' is distinct from 'moderated'
     or coalesce(p_caucus->>'purpose', '') not like '%Room Order%' then
    return 0;
  end if;
  if jsonb_typeof(p_caucus->'roomOrderSize') = 'number' then
    v_size := greatest(0, round((p_caucus->>'roomOrderSize')::numeric))::integer;
  elsif jsonb_typeof(p_caucus->'roomOrderCountries') = 'array' then
    v_size := jsonb_array_length(p_caucus->'roomOrderCountries');
  else
    return 0;
  end if;
  select count(distinct n) into v_called from (
    select substring(s from '^Speaker (\d+)$') as n
      from jsonb_array_elements_text(case when jsonb_typeof(p_caucus->'spokenCountries') = 'array' then p_caucus->'spokenCountries' else '[]'::jsonb end) s
    union all
    select substring(coalesce(p_caucus->>'currentSpeaker', '') from '^Speaker (\d+)$')
  ) x where n is not null;
  return greatest(0, v_size - coalesce(v_called, 0));
exception when others then return 0;
end $$;

-- ── 3. Follows: rebuilt from the advisor's delegation ──────────────────────

create or replace function public._advisor_push_refresh_follows(p_sub uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid;
  v_json jsonb;
  v_n integer := 0;
begin
  select user_id into v_uid from advisor_push_subscriptions where id = p_sub;
  if v_uid is null then return 0; end if;
  if auth.uid() is distinct from v_uid then
    -- The cron tick (no signed-in caller): read the delegation AS this advisor, for this
    -- transaction only (is_local = true), so there is one definition of "my delegation".
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  end if;
  v_json := coalesce(public.my_advisor_delegation(), '[]'::jsonb);

  delete from advisor_push_follows where subscription_id = p_sub and source = 'conference';
  insert into advisor_push_follows (subscription_id, committee_id, country, country_key, country_code, source, conference_committee_id)
  select distinct on (cm.id, lower(btrim(seat->>'countryName')))
    p_sub, cm.id, btrim(seat->>'countryName'), lower(btrim(seat->>'countryName')),
    nullif(btrim(coalesce(seat->>'countryCode', '')), ''), 'conference', cc.id
  from jsonb_array_elements(case when jsonb_typeof(v_json) = 'array' then v_json else '[]'::jsonb end) conf
  cross join lateral jsonb_array_elements(case when jsonb_typeof(conf->'seats') = 'array' then conf->'seats' else '[]'::jsonb end) seat
  join committees cm on cm.code = upper(seat->>'sessionCode')
  join conference_committees cc on cc.session_id = cm.id
  where conf->>'myRole' in ('faculty-advisor', 'head-delegate')
    and coalesce(seat->>'sessionCode', '') <> ''
    and coalesce(btrim(seat->>'countryName'), '') <> ''
    and (coalesce(btrim(seat->>'studentName'), '') <> '' or coalesce(seat->>'role', '') <> '')
  order by cm.id, lower(btrim(seat->>'countryName'))
  on conflict (subscription_id, committee_id, country_key) do update
    set source = 'conference', country = excluded.country, country_code = excluded.country_code,
        conference_committee_id = excluded.conference_committee_id;
  get diagnostics v_n = row_count;

  update advisor_push_subscriptions set follows_refreshed_at = now() where id = p_sub;
  return v_n;
end $$;

-- ── 4. The client's two RPCs ───────────────────────────────────────────────

-- Save (or re-save) this phone. Called on the tap that turns alerts on, when the board's
-- Alerts toggle changes, when the rooms added by code change, and every few hours while
-- the board is open. p_device_follows: [{ "code": "ABC123", "country": "Brazil" }, ...],
-- at most 60, never a name. An endpoint saved by another account moves to the caller
-- (one browser, a different person signed in) and loses the old account's follows.
create or replace function public.save_advisor_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_enabled boolean default true,
  p_device_follows jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_prev uuid;
  v_id uuid;
  v_follows jsonb := coalesce(p_device_follows, '[]'::jsonb);
  v_n integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if not public._advisor_push_endpoint_ok(p_endpoint) then
    return jsonb_build_object('ok', false, 'reason', 'unsupported_endpoint');
  end if;
  if p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{86,88}={0,2}$'
     or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{21,24}={0,2}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_keys');
  end if;
  if jsonb_typeof(v_follows) <> 'array' or jsonb_array_length(v_follows) > 60 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_follows');
  end if;

  select user_id into v_prev from advisor_push_subscriptions where endpoint = p_endpoint;

  insert into advisor_push_subscriptions as s (user_id, endpoint, p256dh, auth, enabled)
  values (v_uid, p_endpoint, p_p256dh, p_auth, coalesce(p_enabled, true))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        enabled = excluded.enabled, updated_at = now(),
        failures = case when s.user_id = excluded.user_id then s.failures else 0 end,
        follows_refreshed_at = case when s.user_id = excluded.user_id then s.follows_refreshed_at else null end
  returning id into v_id;

  if v_prev is not null and v_prev <> v_uid then
    -- Nothing of the previous account's survives on this phone.
    delete from advisor_push_follows where subscription_id = v_id;
    delete from advisor_push_outbox where subscription_id = v_id;
  end if;

  -- At most 10 phones per account: the oldest saves go.
  delete from advisor_push_subscriptions
   where user_id = v_uid
     and id not in (select id from advisor_push_subscriptions where user_id = v_uid order by updated_at desc limit 10);

  -- Rooms added by code on this phone: (code, country) only.
  delete from advisor_push_follows where subscription_id = v_id and source = 'device';
  insert into advisor_push_follows (subscription_id, committee_id, country, country_key, source)
  select distinct on (c.id, lower(btrim(e->>'country')))
    v_id, c.id, left(btrim(e->>'country'), 120), lower(btrim(e->>'country')), 'device'
  from jsonb_array_elements(v_follows) e
  join committees c on c.code = upper(regexp_replace(coalesce(e->>'code', ''), '[^A-Za-z0-9]', '', 'g'))
  where jsonb_typeof(e) = 'object' and coalesce(btrim(e->>'country'), '') <> ''
  order by c.id, lower(btrim(e->>'country'))
  on conflict (subscription_id, committee_id, country_key) do nothing;

  -- Conference seats (the caller is the advisor, so no claim is borrowed).
  v_n := public._advisor_push_refresh_follows(v_id);

  return jsonb_build_object('ok', true, 'id', v_id,
    'follows', (select count(*) from advisor_push_follows where subscription_id = v_id));
end $$;

-- Turn this phone off. Only the caller's own row.
create or replace function public.delete_advisor_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return false; end if;
  delete from advisor_push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
  return found;
end $$;

-- ── 5. What is due right now (a pure read) ─────────────────────────────────

create or replace function public._advisor_push_due()
returns table (subscription_id uuid, turn_key text, payload jsonb)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  r record;
  v_name text; v_status text; v_found boolean; v_lc text;
  v_cs_country text; v_cs_started timestamptz; v_cs_seated timestamptz;
  v_mode text; v_floor text; v_anchor timestamptz; v_key text;
  v_row_id uuid; v_idx integer; v_left integer; v_ahead integer;
  v_names text[];
begin
  for r in
    select f.subscription_id as sub_id, f.committee_id, f.country, f.country_key, f.country_code,
           f.source, f.conference_committee_id,
           c.code, c.phase, c.caucus,
           coalesce(nullif(btrim(cc.abbreviation), ''), nullif(btrim(cc.name), ''), c.name) as committee_label,
           nullif(btrim(co.acronym), '') as conference_label
    from advisor_push_follows f
    join advisor_push_subscriptions s on s.id = f.subscription_id and s.enabled
    join committees c on c.id = f.committee_id
    left join conference_committees cc on cc.session_id = c.id
    left join conferences co on co.id = cc.conference_id
    where c.ended_at is null and c.suspended_at is null
      and c.phase in ('speakers-list', 'moderated-caucus', 'unmoderated-caucus')
      and (co.id is null or public._advisor_push_conference_open(co.start_date, co.end_date, co.timezone, co.dates_tbd))
  loop
    -- The room's own spelling of the delegation (findDelegate: name, then code).
    v_name := null; v_status := null;
    select d.country, d.status into v_name, v_status
      from delegates d where d.committee_id = r.committee_id and lower(btrim(d.country)) = r.country_key
      limit 1;
    v_found := v_name is not null;
    if not v_found and r.country_code is not null then
      select d.country, d.status into v_name, v_status
        from delegates d where d.committee_id = r.committee_id and lower(btrim(d.country)) = lower(r.country_code)
        limit 1;
      v_found := v_name is not null;
    end if;
    if not v_found then v_name := r.country; end if;
    v_lc := lower(btrim(v_name));

    v_cs_country := null; v_cs_started := null; v_cs_seated := null;
    select cs.country, cs.started_at, cs.seated_at into v_cs_country, v_cs_started, v_cs_seated
      from current_speaker cs where cs.committee_id = r.committee_id limit 1;

    v_mode := case r.phase
      when 'speakers-list' then 'gsl'
      when 'moderated-caucus' then 'moderated'
      else case when r.caucus->>'isConsultation' = 'true' then 'consultation' else 'unmoderated' end
    end;
    if v_mode = 'unmoderated' then continue; end if;   -- no floor, no queue

    v_floor := case v_mode
      when 'gsl' then v_cs_country
      when 'moderated' then coalesce(nullif(r.caucus->>'currentSpeaker', ''), v_cs_country)
      else nullif(r.caucus->>'currentSpeaker', '')
    end;

    v_names := null;
    if r.source = 'conference' and r.conference_committee_id is not null then
      select array_agg(n order by seat) into v_names from (
        select coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(ap.invited_name), '')) as n, coalesce(ca.seat, 1) as seat
        from conference_allocations ca
        left join applications ap on ap.id = ca.application_id
        left join profiles p on p.id = coalesce(ap.user_id, ca.user_id)
        where ca.conference_committee_id = r.conference_committee_id
          and (lower(btrim(ca.country_name)) = r.country_key or (r.country_code is not null and ca.country_code = r.country_code))
          and (ap.id is null or ap.status not in ('withdrawn', 'rejected'))
      ) x where n is not null;
    end if;

    -- Speaking: the student holds the floor (derive.ts speakingKey).
    if v_floor is not null and lower(btrim(v_floor)) = v_lc then
      if v_mode = 'consultation' then
        v_anchor := public._advisor_push_ts(r.caucus->'floorSince');
        v_key := 'speak|' || r.committee_id || '|' || v_lc || '|cow:' || public._advisor_push_ms(v_anchor);
      elsif v_cs_country is not null and lower(btrim(v_cs_country)) = v_lc then
        v_anchor := coalesce(v_cs_seated, v_cs_started);
        v_key := 'speak|' || r.committee_id || '|' || v_lc || '|' || public._advisor_push_ms(v_anchor);
      else
        v_anchor := null;
        v_key := 'speak|' || r.committee_id || '|' || v_lc || '|c:'
          || public._advisor_push_ms(public._advisor_push_ts(r.caucus->'totalStartedAt')) || ':'
          || case when jsonb_typeof(r.caucus->'spokenCountries') = 'array' then jsonb_array_length(r.caucus->'spokenCountries') else 0 end;
      end if;
      -- No stable nonce for the turn (a legacy row): skip rather than push every turn once.
      if v_anchor is null and v_mode <> 'moderated' then continue; end if;
      -- A turn already under way for 5 minutes (a phone saved mid-speech) is not news.
      if v_anchor is not null and v_anchor < now() - interval '5 minutes' then continue; end if;
      subscription_id := r.sub_id;
      turn_key := v_key;
      payload := jsonb_build_object('v', 1, 'kind', 'speaking', 'ahead', 0, 'country', v_name, 'code', r.code,
        'committee', r.committee_label, 'conference', r.conference_label,
        'names', to_jsonb(coalesce(v_names, '{}'::text[])), 'seat', r.code || '|' || v_lc);
      return next;
      continue;
    end if;

    -- Soon: in the queue, at most 2 speakers away. Never for an absent delegation or one
    -- not on the roster (derive.ts returns 'absent' before the queue).
    if not v_found or v_status = 'absent' then continue; end if;
    v_row_id := null; v_idx := null; v_left := 0;
    if v_mode = 'moderated' then
      v_left := public._advisor_push_room_order_left(r.caucus);
      select q.id, q.rn - 1 into v_row_id, v_idx from (
        select sl.id, sl.country, row_number() over (order by sl.position, sl.created_at, sl.id) as rn
        from speakers_list sl where sl.committee_id = r.committee_id and sl.list_type = 'caucus'
      ) q where lower(btrim(q.country)) = v_lc order by q.rn limit 1;
    elsif v_mode = 'gsl' then
      -- The floor holder is dropped from the GSL outside a moderated caucus
      -- (gslDedupeApplies): between Next and the list's echo they are briefly in both.
      select q.id, q.rn - 1 into v_row_id, v_idx from (
        select sl.id, sl.country, row_number() over (order by sl.position, sl.created_at, sl.id) as rn
        from speakers_list sl
        where sl.committee_id = r.committee_id and sl.list_type = 'gsl'
          and not (v_cs_country is not null and r.caucus->>'type' is distinct from 'moderated'
                   and lower(btrim(sl.country)) = lower(btrim(v_cs_country)))
      ) q where lower(btrim(q.country)) = v_lc order by q.rn limit 1;
    else
      continue;   -- a consultation has no queue
    end if;
    if v_row_id is null then continue; end if;
    v_ahead := (case when v_floor is not null then 1 else 0 end) + v_left + v_idx;
    if v_ahead > 2 then continue; end if;   -- REMIND_AHEAD in derive.ts
    subscription_id := r.sub_id;
    turn_key := 'soon|' || r.committee_id || '|q|' || v_row_id;
    payload := jsonb_build_object('v', 1, 'kind', 'soon', 'ahead', v_ahead, 'country', v_name, 'code', r.code,
      'committee', r.committee_label, 'conference', r.conference_label,
      'names', to_jsonb(coalesce(v_names, '{}'::text[])), 'seat', r.code || '|' || v_lc);
    return next;
  end loop;
end $$;

-- ── 6. The tick (pg_cron, every 10 seconds) ────────────────────────────────

create or replace function public.advisor_push_kick()
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_secret text;
begin
  select value into v_secret from internal_secrets where name = 'cron_edge_secret';
  if v_secret is null then return false; end if;
  perform net.http_post(
    url := 'https://luruhkwrgisytejswlas.supabase.co/functions/v1/advisor-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000);
  return true;
end $$;

create or replace function public.advisor_push_tick(p_dry_run boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_sub uuid;
  v_refreshed integer := 0;
  v_queued integer := 0;
  v_pending integer := 0;
  v_due jsonb;
begin
  if not exists (select 1 from advisor_push_subscriptions where enabled) then
    return jsonb_build_object('ok', true, 'idle', true);
  end if;

  if coalesce(p_dry_run, false) then
    select coalesce(jsonb_agg(jsonb_build_object(
             'subscription_id', d.subscription_id, 'turn_key', d.turn_key, 'payload', d.payload,
             'already_queued', exists (select 1 from advisor_push_outbox o where o.subscription_id = d.subscription_id and o.turn_key = d.turn_key))), '[]'::jsonb)
      into v_due from public._advisor_push_due() d;
    return jsonb_build_object('ok', true, 'dry_run', true, 'due', v_due);   -- DRY RUN STOPS HERE
  end if;

  -- Rebuild stale follow lists (at most 10 a tick): moved students, late allocations.
  for v_sub in
    select id from advisor_push_subscriptions
     where enabled and (follows_refreshed_at is null or follows_refreshed_at < now() - interval '5 minutes')
     order by follows_refreshed_at nulls first
     limit 10
  loop
    begin
      perform public._advisor_push_refresh_follows(v_sub);
      v_refreshed := v_refreshed + 1;
    exception when others then
      update advisor_push_subscriptions set follows_refreshed_at = now() where id = v_sub;   -- again in 5 minutes
    end;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into advisor_push_outbox (subscription_id, turn_key, payload)
  select d.subscription_id, d.turn_key, d.payload from public._advisor_push_due() d
  on conflict (subscription_id, turn_key) do nothing;
  get diagnostics v_queued = row_count;

  select count(*) into v_pending from advisor_push_outbox
   where sent_at is null and attempts < 3 and created_at > now() - interval '3 minutes'
     and (claimed_at is null or claimed_at < now() - interval '1 minute');
  if v_pending > 0 then perform public.advisor_push_kick(); end if;

  -- Once a minute: forget old turns (their keys never come back after 12 hours).
  if extract(second from clock_timestamp())::integer < 10 then
    delete from advisor_push_outbox where created_at < now() - interval '12 hours';
  end if;

  return jsonb_build_object('ok', true, 'refreshed', v_refreshed, 'queued', v_queued, 'pending', v_pending);
end $$;

-- ── 7. The edge function's two RPCs (service role only) ────────────────────

-- Claim up to p_limit pushes to send. A push older than 3 minutes is never sent (the
-- moment has passed); each is tried at most 3 times.
create or replace function public.advisor_push_claim(p_limit integer default 100)
returns table (id bigint, endpoint text, p256dh text, auth text, payload jsonb)
language sql security definer set search_path = public, pg_temp as $$
  with picked as (
    select o.id from advisor_push_outbox o
     where o.sent_at is null and o.attempts < 3 and o.created_at > now() - interval '3 minutes'
       and (o.claimed_at is null or o.claimed_at < now() - interval '1 minute')
     order by o.id
     limit least(greatest(coalesce(p_limit, 100), 1), 500)
     for update skip locked
  ), upd as (
    update advisor_push_outbox o set claimed_at = now(), attempts = o.attempts + 1
      from picked where o.id = picked.id
    returning o.id, o.subscription_id, o.payload
  )
  select upd.id, s.endpoint, s.p256dh, s.auth, upd.payload
    from upd join advisor_push_subscriptions s on s.id = upd.subscription_id;
$$;

-- p_results: [{ "id": 123, "status": 201 }, ...] (status 0 = no answer).
create or replace function public.advisor_push_report(p_results jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e jsonb;
  v_id bigint;
  v_status integer;
  v_sub uuid;
  v_fail integer;
  n_ok integer := 0; n_gone integer := 0; n_failed integer := 0;
begin
  for e in select * from jsonb_array_elements(case when jsonb_typeof(p_results) = 'array' then p_results else '[]'::jsonb end) loop
    begin
      v_id := (e->>'id')::bigint;
      v_status := coalesce((e->>'status')::integer, 0);
    exception when others then continue;
    end;
    v_sub := null;
    select o.subscription_id into v_sub from advisor_push_outbox o where o.id = v_id;
    if v_sub is null then continue; end if;
    if v_status between 200 and 299 then
      -- Sent: keep the key (the dedupe), drop the names.
      update advisor_push_outbox set sent_at = now(), last_status = v_status, payload = '{}'::jsonb where id = v_id;
      update advisor_push_subscriptions set last_ok_at = now(), failures = 0 where id = v_sub;
      n_ok := n_ok + 1;
    elsif v_status in (404, 410) then
      -- The browser dropped this subscription: forget the phone.
      delete from advisor_push_subscriptions where id = v_sub;
      n_gone := n_gone + 1;
    elsif v_status in (400, 413) then
      update advisor_push_outbox set attempts = 99, last_status = v_status, payload = '{}'::jsonb where id = v_id;
      n_failed := n_failed + 1;
    else
      -- 401 / 403 (a key mismatch), 429, 5xx, no answer: try again, then give up on the phone.
      update advisor_push_outbox set claimed_at = null, last_status = v_status where id = v_id;
      update advisor_push_subscriptions set failures = failures + 1 where id = v_sub returning failures into v_fail;
      if coalesce(v_fail, 0) >= 10 then delete from advisor_push_subscriptions where id = v_sub; end if;
      n_failed := n_failed + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', n_ok, 'gone', n_gone, 'failed', n_failed);
end $$;

-- ── 8. The owner's safe test ───────────────────────────────────────────────

-- Queue ONE test push to every enabled phone of ONE user, nobody else. Then
-- `select public.advisor_push_kick();` sends it (or wait for the tick once scheduled).
create or replace function public.advisor_push_test(p_user uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n integer;
begin
  insert into advisor_push_outbox (subscription_id, turn_key, payload)
  select s.id, 'test|' || public._advisor_push_ms(clock_timestamp()), jsonb_build_object('v', 1, 'kind', 'test')
    from advisor_push_subscriptions s where s.user_id = p_user and s.enabled
  on conflict (subscription_id, turn_key) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── 9. Grants ──────────────────────────────────────────────────────────────

revoke all on function public._advisor_push_endpoint_ok(text) from public, anon, authenticated;
revoke all on function public._advisor_push_ts(jsonb) from public, anon, authenticated;
revoke all on function public._advisor_push_ms(timestamptz) from public, anon, authenticated;
revoke all on function public._advisor_push_conference_open(date, date, text, boolean) from public, anon, authenticated;
revoke all on function public._advisor_push_room_order_left(jsonb) from public, anon, authenticated;
revoke all on function public._advisor_push_refresh_follows(uuid) from public, anon, authenticated;
revoke all on function public._advisor_push_due() from public, anon, authenticated;
revoke all on function public.advisor_push_kick() from public, anon, authenticated;
revoke all on function public.advisor_push_tick(boolean) from public, anon, authenticated;
revoke all on function public.advisor_push_claim(integer) from public, anon, authenticated;
revoke all on function public.advisor_push_report(jsonb) from public, anon, authenticated;
revoke all on function public.advisor_push_test(uuid) from public, anon, authenticated;
revoke all on function public.save_advisor_push_subscription(text, text, text, boolean, jsonb) from public, anon;
revoke all on function public.delete_advisor_push_subscription(text) from public, anon;

grant execute on function public.save_advisor_push_subscription(text, text, text, boolean, jsonb) to authenticated;
grant execute on function public.delete_advisor_push_subscription(text) to authenticated;
grant execute on function public.advisor_push_claim(integer) to service_role;
grant execute on function public.advisor_push_report(jsonb) to service_role;

-- ── 10. Schedules (COMMENTED: run them only after the edge function is deployed
--        with its VAPID secrets and one advisor test passed, docs/sessions/advisor-push.md)

-- select cron.schedule('advisor-push', '10 seconds', $$select public.advisor_push_tick()$$);
--
-- Keep 3 days of THIS job's run history only (8,640 rows a day otherwise):
-- select cron.schedule('advisor-push-run-log-trim', '40 3 * * *', $$
--   delete from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'advisor-push')
--      and end_time < now() - interval '3 days'
-- $$);
--
-- Stop everything at once (nothing else depends on it):
-- select cron.unschedule('advisor-push');
-- update public.advisor_push_subscriptions set enabled = false;
