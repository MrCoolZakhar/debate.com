-- MUNillion: the daily MUN trivia game at /games (owner, 26 Nov 2026).
-- Applied from Claude Code with Peter's one-off approval (migration munillion_core).
-- Answers and their scores are PRESET by Gavelling and reviewed by Peter before a game is published;
-- only the MUN conference question is dynamic (every public, non-test, non-blocked conference counts).
-- Players never read a table: every read and write is a SECURITY DEFINER function below.
-- Tiers: 100 Gavel (one per question), 85 Best Delegate, 60 Outstanding Delegate,
-- 30 Honourable Mention, 10 Participation Certificate, 0 Absent (wrong, skipped or out of time).

create extension if not exists unaccent with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;

-- ---------------------------------------------------------------- tables

create table if not exists public.munillion_games (
  id           uuid primary key default gen_random_uuid(),
  number       int  not null unique,
  game_date    date not null unique,
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.munillion_questions (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.munillion_games(id) on delete cascade,
  position     smallint not null check (position between 1 and 7),
  prompt       text not null,
  hint         text,
  kind         text not null default 'list' check (kind in ('list', 'number', 'conference')),
  default_tier smallint check (default_tier in (10, 30, 60, 85)),
  number_max   int,
  seconds      smallint not null default 30 check (seconds between 10 and 120),
  unique (game_id, position)
);

create table if not exists public.munillion_answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.munillion_questions(id) on delete cascade,
  answer      text not null,
  tier        smallint not null check (tier in (10, 30, 60, 85, 100)),
  aliases     text[] not null default '{}',
  note        text,
  link_slug   text,                       -- conference question: the conference page this answer links to
  keys        text[] not null default '{}', -- normalised answer + aliases, kept by trigger
  created_at  timestamptz not null default now(),
  unique (question_id, answer)
);
create unique index if not exists munillion_one_gavel on public.munillion_answers(question_id) where tier = 100;
create index if not exists munillion_answers_q on public.munillion_answers(question_id);

create table if not exists public.munillion_plays (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.munillion_games(id) on delete cascade,
  player_key  text not null,               -- 'u:<user id>' or 'd:<sha256 of the browser token>'
  user_id     uuid references auth.users(id) on delete set null,
  device_hash text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  total       int not null default 0,
  unique (game_id, player_key)
);
create index if not exists munillion_plays_key on public.munillion_plays(player_key);

create table if not exists public.munillion_play_answers (
  play_id         uuid not null references public.munillion_plays(id) on delete cascade,
  question_id     uuid not null references public.munillion_questions(id) on delete cascade,
  opened_at       timestamptz not null default now(),
  answered_at     timestamptz,
  typed           text,
  answer_id       uuid references public.munillion_answers(id) on delete set null,
  answer_label    text,
  answer_sub      text,
  conference_slug text,
  tier            smallint check (tier in (0, 10, 30, 60, 85, 100)),
  attempts        smallint not null default 0,
  primary key (play_id, question_id)
);

create table if not exists public.munillion_misses (
  id          bigint generated always as identity primary key,
  question_id uuid not null references public.munillion_questions(id) on delete cascade,
  player_key  text not null,
  typed       text not null,
  norm_key    text not null,
  created_at  timestamptz not null default now()
);
create index if not exists munillion_misses_key on public.munillion_misses(norm_key);
create index if not exists munillion_misses_q on public.munillion_misses(question_id);

create table if not exists public.munillion_miss_alerts (
  norm_key   text primary key,
  typed      text,
  players    int,
  alerted_at timestamptz not null default now()
);

alter table public.munillion_games        enable row level security;
alter table public.munillion_questions    enable row level security;
alter table public.munillion_answers      enable row level security;
alter table public.munillion_plays        enable row level security;
alter table public.munillion_play_answers enable row level security;
alter table public.munillion_misses       enable row level security;
alter table public.munillion_miss_alerts  enable row level security;
revoke all on public.munillion_games, public.munillion_questions, public.munillion_answers,
  public.munillion_plays, public.munillion_play_answers, public.munillion_misses,
  public.munillion_miss_alerts from anon, authenticated;

-- ---------------------------------------------------------------- matching helpers

create or replace function public.munillion_norm(p text) returns text
language sql stable set search_path = public, extensions, pg_temp as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(lower(extensions.unaccent(coalesce(p, ''))), '[.''’`]', '', 'g'),
               '&', ' and ', 'g'),
             '[^a-z0-9]+', ' ', 'g'),
           '^\s*the\s+|^\s+|\s+$', '', 'g')
$$;

-- conferences: "Model United Nations" = "MUN", no years, no "conference", no trailing edition number
create or replace function public.munillion_conf_norm(p text) returns text
language sql stable set search_path = public, extensions, pg_temp as $$
  select trim(regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 regexp_replace(
                   regexp_replace(public.munillion_norm(p), 'model united nations', 'mun', 'g'),
                   '\mmodel un\M', 'mun', 'g'),
                 '\m(conference|of the|of)\M', ' ', 'g'),
               '\m(19|20)[0-9]{2}\M', ' ', 'g'),
             '\s+([0-9]+(st|nd|rd|th)?|x{1,3}(ix|iv|v?i{0,3})|ix|iv|v?i{1,3}|v)\s*$', ''),
           '\s+', ' ', 'g'))
$$;

create or replace function public._munillion_answer_keys() returns trigger
language plpgsql set search_path = public, extensions, pg_temp as $$
declare v_kind text;
begin
  select kind into v_kind from public.munillion_questions where id = new.question_id;
  new.keys := coalesce((
    select array_agg(distinct k) from (
      select case when v_kind = 'conference' then public.munillion_conf_norm(x)
                  when v_kind = 'number' then coalesce(ltrim(substring(x from '[0-9]+'), '0'), '')
                  else public.munillion_norm(x) end k
        from unnest(array[new.answer] || coalesce(new.aliases, '{}')) x) s
    where k <> ''), '{}');
  return new;
end $$;

drop trigger if exists munillion_answer_keys on public.munillion_answers;
create trigger munillion_answer_keys before insert or update of answer, aliases
  on public.munillion_answers for each row execute function public._munillion_answer_keys();

-- a list answer: exact (spaces ignored), then one typo (two for long answers) when exactly one answer is closest
create or replace function public._munillion_match_list(p_question uuid, p_key text) returns uuid
language plpgsql stable set search_path = public, extensions, pg_temp as $$
declare
  v_id uuid; v_c text := replace(coalesce(p_key, ''), ' ', ''); v_allow int;
  r record; v_best uuid; v_best_d int := 99; v_second_d int := 99;
begin
  if v_c = '' then return null; end if;
  select a.id into v_id from public.munillion_answers a
   where a.question_id = p_question
     and exists (select 1 from unnest(a.keys) k where replace(k, ' ', '') = v_c)
   order by a.tier limit 1;
  if v_id is not null then return v_id; end if;
  if length(v_c) < 5 then return null; end if;
  v_allow := case when length(v_c) >= 10 then 2 else 1 end;
  for r in
    select a.id, min(extensions.levenshtein(replace(k, ' ', ''), v_c)) d
      from public.munillion_answers a, unnest(a.keys) k
     where a.question_id = p_question
       and length(replace(k, ' ', '')) >= 5
       and abs(length(replace(k, ' ', '')) - length(v_c)) <= v_allow
     group by a.id order by 2 limit 2
  loop
    if v_best is null then v_best := r.id; v_best_d := r.d; else v_second_d := r.d; end if;
  end loop;
  if v_best is not null and v_best_d <= v_allow and v_second_d > v_best_d then return v_best; end if;
  return null;
end $$;

-- blocked conferences (gavelling_listing_blocklist) never count, never show and are never reported
create or replace function public._munillion_conf_blocked(p_slug text, p_acronym text, p_name text) returns boolean
language sql stable set search_path = public, extensions, pg_temp as $$
  select exists (
    select 1 from public.gavelling_listing_blocklist b
     where (coalesce(b.acronym, '') <> '' and public.munillion_conf_norm(p_acronym) <> ''
            and (public.munillion_conf_norm(p_acronym) = public.munillion_conf_norm(b.acronym)
                 or (b.match_prefix and public.munillion_conf_norm(p_acronym) like public.munillion_conf_norm(b.acronym) || '%')))
        or (coalesce(b.full_name, '') <> '' and public.munillion_conf_norm(p_name) <> ''
            and public.munillion_conf_norm(p_name) = public.munillion_conf_norm(b.full_name))
        or (public.munillion_conf_norm(p_name) <> ''
            and (public.munillion_conf_norm(p_name) = public.munillion_conf_norm(replace(b.name_key, '-', ' '))
                 or (b.match_prefix and public.munillion_conf_norm(p_name) like public.munillion_conf_norm(replace(b.name_key, '-', ' ')) || '%')))
        or (coalesce(p_slug, '') <> ''
            and (regexp_replace(lower(p_slug), '[-_]?[0-9]+$', '') = b.name_key
                 or replace(regexp_replace(lower(p_slug), '[-_]?[0-9]+$', ''), '-', '') = replace(b.name_key, '-', '')
                 or (b.match_prefix and lower(p_slug) like b.name_key || '%'))))
$$;

-- the public conference a typed name means (upcoming edition first, else the latest)
create or replace function public._munillion_find_conf(p_key text)
returns table (slug text, label text, full_name text)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select c.slug, coalesce(nullif(trim(c.acronym), ''), trim(c.full_name)), trim(c.full_name)
    from public.conferences c
   where coalesce(p_key, '') <> ''
     and c.is_public and c.status = 'public' and c.slug is not null
     and not public.conference_is_test(c.slug, c.full_name, c.is_demo)
     and (public.munillion_conf_norm(c.acronym) = p_key
          or public.munillion_conf_norm(c.full_name) = p_key
          or replace(public.munillion_conf_norm(c.acronym), ' ', '') = replace(p_key, ' ', '')
          or replace(regexp_replace(lower(c.slug), '[-_]?[0-9]+$', ''), '-', '') = replace(p_key, ' ', '')
          or exists (select 1 from public.conference_slug_aliases a
                      where a.conference_id = c.id
                        and replace(regexp_replace(lower(a.slug), '[-_]?[0-9]+$', ''), '-', '') = replace(p_key, ' ', '')))
     and not public._munillion_conf_blocked(c.slug, c.acronym, c.full_name)
   order by (c.end_date >= current_date) desc nulls last,
            case when c.end_date >= current_date then c.start_date end asc nulls last,
            c.start_date desc nulls last
   limit 1
$$;

-- ---------------------------------------------------------------- players, games, settling

create or replace function public._munillion_player(p_token text, out player_key text, out device_hash text, out user_id uuid)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  user_id := auth.uid();
  if p_token is not null and length(p_token) between 16 and 200 then
    device_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  end if;
  if user_id is not null then player_key := 'u:' || user_id::text;
  elsif device_hash is not null then player_key := 'd:' || device_hash;
  end if;
end $$;

-- a signed-in player takes over the games this browser played signed out
create or replace function public._munillion_claim(p_uid uuid, p_hash text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.munillion_plays p
     set player_key = 'u:' || p_uid::text, user_id = p_uid
   where p_uid is not null and p_hash is not null
     and p.player_key = 'd:' || p_hash
     and not exists (select 1 from public.munillion_plays q
                      where q.game_id = p.game_id and q.player_key = 'u:' || p_uid::text)
$$;

-- today's game: the newest published game dated today or earlier (UTC); an admin preview takes the newest game of all
create or replace function public._munillion_current_game(p_preview boolean) returns public.munillion_games
language sql stable security definer set search_path = public, pg_temp as $$
  select g.* from public.munillion_games g
   where case when coalesce(p_preview, false) then true  -- open to anyone (owner, 26 Nov 2026; migration munillion_open_preview)
              else g.published and g.game_date <= (now() at time zone 'utc')::date end
   order by g.number desc limit 1
$$;

create or replace function public._munillion_settle(p_play uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_total int; v_done int; v_n int; v_game uuid;
begin
  select game_id into v_game from public.munillion_plays where id = p_play;
  select coalesce(sum(tier), 0), count(*) filter (where tier is not null)
    into v_total, v_done from public.munillion_play_answers where play_id = p_play;
  select count(*) into v_n from public.munillion_questions where game_id = v_game;
  update public.munillion_plays
     set total = v_total,
         finished_at = case when v_done >= v_n and v_n > 0 then coalesce(finished_at, now()) else finished_at end
   where id = p_play;
end $$;

-- a question left open past its time is Absent
create or replace function public._munillion_expire(p_play uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.munillion_play_answers pa
     set tier = 0, answered_at = now()
    from public.munillion_questions q
   where pa.play_id = p_play and q.id = pa.question_id and pa.tier is null
     and now() - pa.opened_at > make_interval(secs => q.seconds + 3);
  if found then perform public._munillion_settle(p_play); end if;
end $$;

create or replace function public._munillion_streak(p_key text) returns int
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r record; n int := 0; v_first boolean := true;
begin
  for r in
    select exists (select 1 from public.munillion_plays p
                    where p.game_id = g.id and p.player_key = p_key and p.finished_at is not null) done
      from public.munillion_games g
     where g.published and g.game_date <= (now() at time zone 'utc')::date
     order by g.number desc
  loop
    if r.done then n := n + 1;
    elsif not v_first then exit;
    end if;
    v_first := false;
  end loop;
  return n;
end $$;

create or replace function public._munillion_html(p text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')
$$;

-- three different players typed the same conference that isn't on Gavelling: one email to the team inbox
-- (once per name, at most 10 a day)
create or replace function public._munillion_conf_alert(p_key text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int; v_examples text[]; v_list_txt text; v_list_html text;
begin
  select count(distinct m.player_key) into v_n
    from public.munillion_misses m join public.munillion_questions q on q.id = m.question_id
   where q.kind = 'conference' and m.norm_key = p_key;
  if v_n < 3 then return; end if;
  if exists (select 1 from public.munillion_miss_alerts where norm_key = p_key) then return; end if;
  if (select count(*) from public.munillion_miss_alerts where alerted_at > now() - interval '1 day') >= 10 then return; end if;

  select array_agg(t) into v_examples from (
    select distinct left(regexp_replace(m.typed, '[\r\n]+', ' ', 'g'), 80) t
      from public.munillion_misses m join public.munillion_questions q on q.id = m.question_id
     where q.kind = 'conference' and m.norm_key = p_key limit 5) s;

  insert into public.munillion_miss_alerts(norm_key, typed, players) values (p_key, v_examples[1], v_n)
  on conflict (norm_key) do nothing;
  if not found then return; end if;

  select string_agg('- ' || e, E'\n'), string_agg('<li style="margin:0 0 6px">' || public._munillion_html(e) || '</li>', '')
    into v_list_txt, v_list_html from unnest(v_examples) e;

  insert into public.email_outbox (conference_id, recipient_application_id, recipient_email, subject, body, body_html, status)
  values (null, null, 'info@gavelling.com',
    'MUNillion: ' || v_n || ' players named "' || v_examples[1] || '", which isn''t on Gavelling',
    v_n || ' different players typed a MUN conference into MUNillion that isn''t on Gavelling:' || E'\n\n' || v_list_txt || E'\n\n'
      || 'Every name is saved in munillion_misses. If it''s a real conference, list it at https://gavelling.com/conferences/new or ask Claude to draft an outreach email to its organisers.',
    '<div style="font-family:Inter,Arial,sans-serif;color:#1C1410;max-width:560px;margin:0 auto;padding:24px">'
      || '<img src="https://gavelling.com/gavelling-lockup.png" alt="Gavelling" width="160" style="display:block;margin:0 0 24px">'
      || '<p style="font-size:16px;line-height:1.5;margin:0 0 12px"><b>' || v_n || ' different players</b> typed a MUN conference into MUNillion that isn''t on Gavelling:</p>'
      || '<ul style="font-size:16px;line-height:1.5;margin:0 0 16px;padding-left:20px">' || v_list_html || '</ul>'
      || '<p style="font-size:15px;line-height:1.5;margin:0 0 12px">Every name is saved in munillion_misses. If it''s a real conference, list it or ask Claude to draft an outreach email to its organisers.</p>'
      || '<p style="font-size:15px;margin:0"><a href="https://gavelling.com/conferences/new" style="color:#1B3828;font-weight:700;text-decoration:underline">List it on Gavelling</a></p>'
      || '</div>',
    'pending');
end $$;

-- ---------------------------------------------------------------- player functions

create or replace function public.munillion_today(p_token text, p_preview boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v record; g public.munillion_games; pl public.munillion_plays; v_answers jsonb := '[]'; v_questions jsonb;
begin
  select * into v from public._munillion_player(p_token);
  if v.user_id is not null and v.device_hash is not null then perform public._munillion_claim(v.user_id, v.device_hash); end if;
  g := public._munillion_current_game(p_preview);
  if g.id is null then
    return jsonb_build_object('ok', true, 'game', null, 'server_now', now(),
      'streak', case when v.player_key is null then 0 else public._munillion_streak(v.player_key) end);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('position', q.position, 'prompt', q.prompt, 'hint', q.hint,
           'kind', q.kind, 'seconds', q.seconds) order by q.position), '[]')
    into v_questions from public.munillion_questions q where q.game_id = g.id;

  if v.player_key is not null then
    select * into pl from public.munillion_plays where game_id = g.id and player_key = v.player_key;
    if pl.id is not null then
      perform public._munillion_expire(pl.id);
      select * into pl from public.munillion_plays where id = pl.id;
      select coalesce(jsonb_agg(jsonb_build_object('position', q.position, 'tier', pa.tier, 'typed', pa.typed,
               'label', pa.answer_label, 'sub', pa.answer_sub, 'slug', pa.conference_slug,
               'seconds_left', case when pa.tier is null
                                    then greatest(0, q.seconds - extract(epoch from now() - pa.opened_at)) end)
               order by q.position), '[]')
        into v_answers
        from public.munillion_play_answers pa join public.munillion_questions q on q.id = pa.question_id
       where pa.play_id = pl.id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'server_now', now(),
    'game', jsonb_build_object('number', g.number, 'date', g.game_date, 'preview', not g.published),
    'questions', v_questions,
    'play', case when pl.id is null then null else jsonb_build_object(
              'total', pl.total, 'finished', pl.finished_at is not null, 'answers', v_answers) end,
    'streak', case when v.player_key is null then 0 else public._munillion_streak(v.player_key) end,
    'signed_in', v.user_id is not null);
end $$;

create or replace function public.munillion_open(p_token text, p_position int, p_preview boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v record; g public.munillion_games; q public.munillion_questions; pl public.munillion_plays; pa public.munillion_play_answers;
begin
  select * into v from public._munillion_player(p_token);
  if v.player_key is null then return jsonb_build_object('ok', false, 'reason', 'no_player'); end if;
  g := public._munillion_current_game(p_preview);
  if g.id is null then return jsonb_build_object('ok', false, 'reason', 'no_game'); end if;
  select * into q from public.munillion_questions where game_id = g.id and position = p_position;
  if q.id is null then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;

  insert into public.munillion_plays (game_id, player_key, user_id, device_hash)
  values (g.id, v.player_key, v.user_id, v.device_hash)
  on conflict (game_id, player_key) do nothing;
  select * into pl from public.munillion_plays where game_id = g.id and player_key = v.player_key;
  perform public._munillion_expire(pl.id);

  if exists (select 1 from public.munillion_questions q2
              where q2.game_id = g.id and q2.position < p_position
                and not exists (select 1 from public.munillion_play_answers x
                                 where x.play_id = pl.id and x.question_id = q2.id and x.tier is not null)) then
    return jsonb_build_object('ok', false, 'reason', 'out_of_order');
  end if;

  insert into public.munillion_play_answers (play_id, question_id) values (pl.id, q.id)
  on conflict (play_id, question_id) do nothing;
  select * into pa from public.munillion_play_answers where play_id = pl.id and question_id = q.id;
  return jsonb_build_object('ok', true, 'answered', pa.tier is not null, 'tier', pa.tier,
    'seconds_left', greatest(0, q.seconds - extract(epoch from now() - pa.opened_at)));
end $$;

create or replace function public.munillion_answer(p_token text, p_position int, p_typed text, p_preview boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v record; g public.munillion_games; q public.munillion_questions; pl public.munillion_plays; pa public.munillion_play_answers;
  v_typed text := left(trim(coalesce(p_typed, '')), 120);
  k text := ''; v_ans public.munillion_answers; v_tier smallint; v_label text; v_sub text; v_slug text; v_num int;
  v_conf record; v_blocked boolean := false; v_matched boolean := false;
begin
  select * into v from public._munillion_player(p_token);
  if v.player_key is null then return jsonb_build_object('ok', false, 'reason', 'no_player'); end if;
  g := public._munillion_current_game(p_preview);
  if g.id is null then return jsonb_build_object('ok', false, 'reason', 'no_game'); end if;
  select * into q from public.munillion_questions where game_id = g.id and position = p_position;
  if q.id is null then return jsonb_build_object('ok', false, 'reason', 'no_question'); end if;
  select * into pl from public.munillion_plays where game_id = g.id and player_key = v.player_key;
  if pl.id is null then return jsonb_build_object('ok', false, 'reason', 'not_open'); end if;
  select * into pa from public.munillion_play_answers where play_id = pl.id and question_id = q.id for update;
  if pa.play_id is null then return jsonb_build_object('ok', false, 'reason', 'not_open'); end if;
  if pa.tier is not null then
    return jsonb_build_object('ok', true, 'status', 'done', 'tier', pa.tier, 'label', pa.answer_label,
      'sub', pa.answer_sub, 'slug', pa.conference_slug, 'total', pl.total, 'finished', pl.finished_at is not null);
  end if;

  if now() - pa.opened_at > make_interval(secs => q.seconds + 3) then
    update public.munillion_play_answers set tier = 0, answered_at = now(), typed = nullif(v_typed, '')
     where play_id = pl.id and question_id = q.id;
    perform public._munillion_settle(pl.id);
    select * into pl from public.munillion_plays where id = pl.id;
    return jsonb_build_object('ok', true, 'status', 'late', 'tier', 0, 'total', pl.total, 'finished', pl.finished_at is not null);
  end if;
  if v_typed = '' or pa.attempts >= 25 then
    return jsonb_build_object('ok', true, 'status', 'unknown', 'attempts_left', greatest(0, 25 - pa.attempts));
  end if;

  if q.kind = 'list' then
    k := public.munillion_norm(v_typed);
    select * into v_ans from public.munillion_answers where id = public._munillion_match_list(q.id, k);
    if v_ans.id is not null then
      v_matched := true; v_tier := v_ans.tier; v_label := v_ans.answer; v_sub := v_ans.note;
    end if;

  elsif q.kind = 'number' then
    k := coalesce(substring(v_typed from '[0-9]{1,6}'), '');
    if k <> '' then
      v_num := k::int; k := v_num::text;
      if v_num between 1 and coalesce(q.number_max, 0) then
        v_matched := true;
        select * into v_ans from public.munillion_answers a where a.question_id = q.id and k = any(a.keys) limit 1;
        v_tier := coalesce(v_ans.tier, q.default_tier, 85);
        v_label := 'Resolution ' || k; v_sub := v_ans.note;
      end if;
    end if;

  else
    k := public.munillion_conf_norm(v_typed);
    v_blocked := public._munillion_conf_blocked(replace(k, ' ', ''), v_typed, v_typed);
    if not v_blocked and k <> '' then
      select * into v_ans from public.munillion_answers a
       where a.question_id = q.id
         and exists (select 1 from unnest(a.keys) x where replace(x, ' ', '') = replace(k, ' ', ''))
       limit 1;
      if v_ans.id is not null and v_ans.link_slug is not null
         and exists (select 1 from public.conferences c where c.slug = v_ans.link_slug and c.is_public) then
        v_matched := true; v_tier := v_ans.tier; v_label := v_ans.answer; v_slug := v_ans.link_slug;
        select trim(full_name) into v_sub from public.conferences where slug = v_ans.link_slug;
      else
        select * into v_conf from public._munillion_find_conf(k);
        if v_conf.slug is not null then
          v_matched := true; v_slug := v_conf.slug; v_label := v_conf.label; v_sub := v_conf.full_name;
          select * into v_ans from public.munillion_answers a
           where a.question_id = q.id
             and (a.link_slug = v_conf.slug
                  or public.munillion_conf_norm(v_conf.label) = any(a.keys)
                  or public.munillion_conf_norm(v_conf.full_name) = any(a.keys))
           limit 1;
          v_tier := coalesce(v_ans.tier, q.default_tier, 85);
          if v_ans.id is not null then v_label := v_ans.answer; end if;
        end if;
      end if;
    end if;
  end if;

  if not v_matched then
    update public.munillion_play_answers set attempts = attempts + 1 where play_id = pl.id and question_id = q.id;
    if not v_blocked and k <> '' then
      insert into public.munillion_misses (question_id, player_key, typed, norm_key)
      select q.id, v.player_key, v_typed, k
       where not exists (select 1 from public.munillion_misses m
                          where m.question_id = q.id and m.player_key = v.player_key and m.norm_key = k);
      if q.kind = 'conference' and length(replace(k, ' ', '')) >= 3 then
        perform public._munillion_conf_alert(k);
      end if;
    end if;
    return jsonb_build_object('ok', true, 'status', 'unknown', 'attempts_left', greatest(0, 24 - pa.attempts));
  end if;

  update public.munillion_play_answers
     set answered_at = now(), typed = v_typed, answer_id = v_ans.id, answer_label = v_label, answer_sub = v_sub,
         conference_slug = v_slug, tier = v_tier, attempts = attempts + 1
   where play_id = pl.id and question_id = q.id;
  perform public._munillion_settle(pl.id);
  select * into pl from public.munillion_plays where id = pl.id;
  return jsonb_build_object('ok', true, 'status', 'correct', 'tier', v_tier, 'label', v_label, 'sub', v_sub,
    'slug', v_slug, 'total', pl.total, 'finished', pl.finished_at is not null);
end $$;

-- skipping, or the clock ran out: Absent
create or replace function public.munillion_skip(p_token text, p_position int, p_preview boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v record; g public.munillion_games; q public.munillion_questions; pl public.munillion_plays;
begin
  select * into v from public._munillion_player(p_token);
  if v.player_key is null then return jsonb_build_object('ok', false, 'reason', 'no_player'); end if;
  g := public._munillion_current_game(p_preview);
  if g.id is null then return jsonb_build_object('ok', false, 'reason', 'no_game'); end if;
  select * into q from public.munillion_questions where game_id = g.id and position = p_position;
  select * into pl from public.munillion_plays where game_id = g.id and player_key = v.player_key;
  if q.id is null or pl.id is null then return jsonb_build_object('ok', false, 'reason', 'not_open'); end if;
  update public.munillion_play_answers set tier = 0, answered_at = now()
   where play_id = pl.id and question_id = q.id and tier is null;
  perform public._munillion_settle(pl.id);
  select * into pl from public.munillion_plays where id = pl.id;
  return jsonb_build_object('ok', true, 'status', 'skipped', 'tier', 0, 'total', pl.total, 'finished', pl.finished_at is not null);
end $$;

-- the answer key, by tier, once the player has finished
create or replace function public.munillion_reveal(p_token text, p_preview boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v record; g public.munillion_games; pl public.munillion_plays; v_out jsonb;
begin
  select * into v from public._munillion_player(p_token);
  g := public._munillion_current_game(p_preview);
  if g.id is null then return jsonb_build_object('ok', false, 'reason', 'no_game'); end if;
  if v.player_key is not null then
    select * into pl from public.munillion_plays where game_id = g.id and player_key = v.player_key;
  end if;
  if (pl.id is null or pl.finished_at is null) and not (coalesce(p_preview, false) and public.is_platform_admin()) then
    return jsonb_build_object('ok', false, 'reason', 'not_finished');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'position', q.position, 'prompt', q.prompt, 'kind', q.kind,
           'default_tier', q.default_tier, 'number_max', q.number_max,
           'mine', (select jsonb_build_object('typed', pa.typed, 'label', pa.answer_label, 'sub', pa.answer_sub,
                                              'slug', pa.conference_slug, 'tier', pa.tier)
                      from public.munillion_play_answers pa where pa.play_id = pl.id and pa.question_id = q.id),
           'gavel', (select jsonb_build_object('answer', a.answer, 'note', a.note, 'slug', a.link_slug)
                       from public.munillion_answers a where a.question_id = q.id and a.tier = 100),
           'tiers', (select coalesce(jsonb_agg(jsonb_build_object('tier', t.tier, 'total', t.total, 'answers', t.answers)
                                     order by t.tier desc), '[]')
                       from (select s.tier, max(s.total) total,
                                    jsonb_agg(jsonb_build_object('answer', s.answer, 'note', s.note, 'slug', s.link_slug)
                                              order by s.rn) filter (where s.rn <= 40) answers
                               from (select a.tier, a.answer, a.note, a.link_slug,
                                            count(*) over (partition by a.tier) total,
                                            row_number() over (partition by a.tier
                                              order by case when q.kind = 'number' then lpad(a.answer, 8, '0') else lower(a.answer) end) rn
                                       from public.munillion_answers a
                                      where a.question_id = q.id and a.tier < 100) s
                              group by s.tier) t)
         ) order by q.position), '[]')
    into v_out from public.munillion_questions q where q.game_id = g.id;

  return jsonb_build_object('ok', true, 'game', jsonb_build_object('number', g.number, 'date', g.game_date),
    'total', pl.total, 'questions', v_out);
end $$;

-- every game this player has played (the profile's Games tab)
create or replace function public.munillion_history(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v record; v_plays jsonb;
begin
  select * into v from public._munillion_player(p_token);
  if v.player_key is null then return jsonb_build_object('ok', true, 'streak', 0, 'plays', '[]'::jsonb); end if;
  if v.user_id is not null and v.device_hash is not null then perform public._munillion_claim(v.user_id, v.device_hash); end if;

  select coalesce(jsonb_agg(x.j order by x.number desc), '[]') into v_plays from (
    select g.number, jsonb_build_object(
             'number', g.number, 'date', g.game_date, 'total', p.total, 'finished', p.finished_at is not null,
             'answers', (select coalesce(jsonb_agg(jsonb_build_object('position', q.position, 'prompt', q.prompt,
                                   'typed', pa.typed, 'label', pa.answer_label, 'sub', pa.answer_sub,
                                   'slug', pa.conference_slug, 'tier', pa.tier) order by q.position), '[]')
                           from public.munillion_play_answers pa join public.munillion_questions q on q.id = pa.question_id
                          where pa.play_id = p.id)) j
      from public.munillion_plays p join public.munillion_games g on g.id = p.game_id
     where p.player_key = v.player_key
     order by g.number desc limit 100) x;

  return jsonb_build_object('ok', true, 'streak', public._munillion_streak(v.player_key),
    'best', (select coalesce(max(total), 0) from public.munillion_plays where player_key = v.player_key and finished_at is not null),
    'played', (select count(*) from public.munillion_plays where player_key = v.player_key and finished_at is not null),
    'plays', v_plays);
end $$;

-- ---------------------------------------------------------------- admin (review before publishing)

create or replace function public.munillion_admin_game(p_number int default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare g public.munillion_games; v_q jsonb;
begin
  if not public.is_platform_admin() then return jsonb_build_object('ok', false, 'reason', 'not_admin'); end if;
  select * into g from public.munillion_games where p_number is null or number = p_number order by number desc limit 1;
  if g.id is null then return jsonb_build_object('ok', true, 'game', null, 'games', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'position', q.position, 'prompt', q.prompt, 'hint', q.hint, 'kind', q.kind,
           'default_tier', q.default_tier, 'number_max', q.number_max, 'seconds', q.seconds,
           'answers', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'answer', a.answer, 'tier', a.tier,
                                 'aliases', a.aliases, 'note', a.note, 'link_slug', a.link_slug)
                                 order by a.tier desc, case when q.kind = 'number' then lpad(a.answer, 8, '0') else lower(a.answer) end), '[]')
                         from public.munillion_answers a where a.question_id = q.id),
           'misses', (select coalesce(jsonb_agg(jsonb_build_object('key', m.norm_key, 'players', m.players, 'example', m.example)
                                order by m.players desc, m.norm_key), '[]')
                        from (select norm_key, count(distinct player_key) players, min(typed) example
                                from public.munillion_misses where question_id = q.id
                               group by norm_key order by 2 desc, 1 limit 60) m)
         ) order by q.position), '[]')
    into v_q from public.munillion_questions q where q.game_id = g.id;

  return jsonb_build_object('ok', true,
    'game', jsonb_build_object('id', g.id, 'number', g.number, 'date', g.game_date, 'published', g.published,
              'plays', (select count(*) from public.munillion_plays where game_id = g.id),
              'finished', (select count(*) from public.munillion_plays where game_id = g.id and finished_at is not null)),
    'games', (select jsonb_agg(jsonb_build_object('number', number, 'date', game_date, 'published', published) order by number desc)
                from public.munillion_games),
    'questions', v_q);
end $$;

create or replace function public.munillion_admin_set_tier(p_answer uuid, p_tier int) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_q uuid;
begin
  if not public.is_platform_admin() then return jsonb_build_object('ok', false, 'reason', 'not_admin'); end if;
  if p_tier not in (10, 30, 60, 85, 100) then return jsonb_build_object('ok', false, 'reason', 'bad_tier'); end if;
  select question_id into v_q from public.munillion_answers where id = p_answer;
  if v_q is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if p_tier = 100 then
    update public.munillion_answers set tier = 85 where question_id = v_q and tier = 100 and id <> p_answer;
  end if;
  update public.munillion_answers set tier = p_tier where id = p_answer;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.munillion_admin_add_answer(p_question uuid, p_answer text, p_tier int,
  p_aliases text[] default '{}', p_note text default null, p_link_slug text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then return jsonb_build_object('ok', false, 'reason', 'not_admin'); end if;
  if p_tier not in (10, 30, 60, 85, 100) then return jsonb_build_object('ok', false, 'reason', 'bad_tier'); end if;
  if coalesce(trim(p_answer), '') = '' then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  if exists (select 1 from public.munillion_answers where question_id = p_question and lower(answer) = lower(trim(p_answer))) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate');
  end if;
  if p_tier = 100 then update public.munillion_answers set tier = 85 where question_id = p_question and tier = 100; end if;
  insert into public.munillion_answers (question_id, answer, tier, aliases, note, link_slug)
  values (p_question, trim(p_answer), p_tier, coalesce(p_aliases, '{}'), nullif(trim(p_note), ''), nullif(trim(p_link_slug), ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.munillion_admin_remove_answer(p_answer uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not public.is_platform_admin() then return jsonb_build_object('ok', false, 'reason', 'not_admin'); end if;
  delete from public.munillion_answers where id = p_answer;
  return jsonb_build_object('ok', found);
end $$;

create or replace function public.munillion_admin_update_question(p_question uuid, p_prompt text, p_hint text,
  p_default_tier int default null, p_number_max int default null, p_seconds int default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not public.is_platform_admin() then return jsonb_build_object('ok', false, 'reason', 'not_admin'); end if;
  if coalesce(trim(p_prompt), '') = '' then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  update public.munillion_questions
     set prompt = trim(p_prompt), hint = nullif(trim(p_hint), ''),
         default_tier = case when kind in ('number', 'conference') then coalesce(p_default_tier, default_tier) else default_tier end,
         number_max = case when kind = 'number' then coalesce(p_number_max, number_max) else number_max end,
         seconds = coalesce(p_seconds, seconds)
   where id = p_question;
  return jsonb_build_object('ok', found);
exception when check_violation then
  return jsonb_build_object('ok', false, 'reason', 'bad_value');
end $$;

create or replace function public.munillion_admin_publish(p_number int, p_published boolean, p_date date default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare g public.munillion_games; v_pos int;
begin
  if not public.is_platform_admin() then return jsonb_build_object('ok', false, 'reason', 'not_admin'); end if;
  select * into g from public.munillion_games where number = p_number;
  if g.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if p_published then
    if (select count(*) from public.munillion_questions where game_id = g.id) <> 7 then
      return jsonb_build_object('ok', false, 'reason', 'needs_seven');
    end if;
    select q.position into v_pos from public.munillion_questions q
     where q.game_id = g.id
       and not exists (select 1 from public.munillion_answers a where a.question_id = q.id and a.tier = 100)
     order by q.position limit 1;
    if v_pos is not null then return jsonb_build_object('ok', false, 'reason', 'needs_gavel', 'position', v_pos); end if;
  end if;
  update public.munillion_games
     set published = p_published,
         published_at = case when p_published then coalesce(published_at, now()) else published_at end,
         game_date = coalesce(p_date, game_date)
   where id = g.id;
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'date_taken');
end $$;

-- an admin testing the game deletes their own play of it
create or replace function public.munillion_admin_reset_my_play(p_number int) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not public.is_platform_admin() then return jsonb_build_object('ok', false, 'reason', 'not_admin'); end if;
  delete from public.munillion_plays p using public.munillion_games g
   where g.id = p.game_id and g.number = p_number and p.player_key = 'u:' || auth.uid()::text;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- grants

revoke all on function public.munillion_norm(text), public.munillion_conf_norm(text), public._munillion_answer_keys(),
  public._munillion_match_list(uuid, text), public._munillion_conf_blocked(text, text, text), public._munillion_find_conf(text),
  public._munillion_player(text), public._munillion_claim(uuid, text), public._munillion_current_game(boolean),
  public._munillion_settle(uuid), public._munillion_expire(uuid), public._munillion_streak(text), public._munillion_html(text),
  public._munillion_conf_alert(text),
  public.munillion_today(text, boolean), public.munillion_open(text, int, boolean), public.munillion_answer(text, int, text, boolean),
  public.munillion_skip(text, int, boolean), public.munillion_reveal(text, boolean), public.munillion_history(text),
  public.munillion_admin_game(int), public.munillion_admin_set_tier(uuid, int),
  public.munillion_admin_add_answer(uuid, text, int, text[], text, text), public.munillion_admin_remove_answer(uuid),
  public.munillion_admin_update_question(uuid, text, text, int, int, int), public.munillion_admin_publish(int, boolean, date),
  public.munillion_admin_reset_my_play(int)
  from public, anon, authenticated;

grant execute on function public.munillion_today(text, boolean), public.munillion_open(text, int, boolean),
  public.munillion_answer(text, int, text, boolean), public.munillion_skip(text, int, boolean),
  public.munillion_reveal(text, boolean), public.munillion_history(text)
  to anon, authenticated;

grant execute on function public.munillion_admin_game(int), public.munillion_admin_set_tier(uuid, int),
  public.munillion_admin_add_answer(uuid, text, int, text[], text, text), public.munillion_admin_remove_answer(uuid),
  public.munillion_admin_update_question(uuid, text, text, int, int, int), public.munillion_admin_publish(int, boolean, date),
  public.munillion_admin_reset_my_play(int)
  to authenticated;

-- migration munillion_open_preview (owner, 26 Nov 2026): the preview is not behind a staff account.
create or replace function public.munillion_reset_preview_play(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v record; g public.munillion_games;
begin
  select * into v from public._munillion_player(p_token);
  if v.player_key is null then return jsonb_build_object('ok', false, 'reason', 'no_player'); end if;
  g := public._munillion_current_game(true);
  if g.id is null then return jsonb_build_object('ok', false, 'reason', 'no_game'); end if;
  if g.published then return jsonb_build_object('ok', false, 'reason', 'published'); end if;
  delete from public.munillion_plays where game_id = g.id and player_key = v.player_key;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.munillion_reset_preview_play(text) from public, anon, authenticated;
grant execute on function public.munillion_reset_preview_play(text) to anon, authenticated;
