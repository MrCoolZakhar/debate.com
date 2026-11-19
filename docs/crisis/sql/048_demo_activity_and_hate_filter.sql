-- Gavelling Crisis part 48 (19 Nov 2026): a shared demo for anyone signed in, a record of who does what, and a slur filter.
-- Owner: "I'm starting to share crisis with a lot of people. Put it behind a gated sign in ... already have the try it as
-- different people, so they don't need the code ... Keep track of who does what, and also add a gate of banning very bad words.
-- So it's okay if they say like swear words in directives, but ... the N word, racial slurs and hate speech ... you should be
-- banning." Answers: ONE shared demo (the Cuban Missile Crisis on Gavelling Test MUN), every role including Director, the
-- activity is stored and read on request (no screen).
--
-- 1. crises.is_demo marks the shared demo. Only a migration changes it (a guard refuses the app).
-- 2. Any signed-in account sees the demo on /crisis (role 'visitor') and may "Try it as" any person in it who is not on a
--    Gavelling account (the Guest and test people), through crisis_demo_try_as (no emails, codes or account people) and
--    crisis_view_as (now also allowed for the demo). The demo sends no email: invites are refused there. A person on an
--    account (Peter's own seat) cannot be changed or removed by someone trying it as someone else.
-- 3. crisis_activity: every write in the demo, with the REAL account behind it (the account that made the "Try it as"
--    token, else the signed-in account), the person they were acting as, what changed and a short summary. Opening the
--    demo and each "Try it as" are recorded too. RLS on, no policies: read with the Supabase tools.
-- 4. crisis_text_hateful(text) + a BEFORE trigger on every table people write words into, in EVERY crisis: slurs and
--    calls to kill a group are refused (crisis_hate_speech); swearing is allowed. Only the columns that changed are read.

set local lock_timeout = '3s';

-- ─────────── 1. The demo flag ───────────
alter table public.crises add column if not exists is_demo boolean not null default false;
update public.crises set is_demo = true
 where slug = 'jcc' and conference_id = (select id from public.conferences where slug = 'gavelling-test-mun-2027');

create or replace function public._crisis_guard_demo_flag()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_demo is distinct from old.is_demo and coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'crisis_forbidden' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists crises_guard_demo_flag on public.crises;
create trigger crises_guard_demo_flag before update of is_demo on public.crises
  for each row execute function public._crisis_guard_demo_flag();

create or replace function public.crisis_is_demo(p_crisis uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_demo from public.crises where id = p_crisis), false)
$$;

-- The real account behind a request: the one that made the "Try it as" token, else the signed-in account.
create or replace function public.crisis_actor()
returns uuid language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select vt.created_by from public.crisis_view_tokens vt
      where vt.token_hash = public.crisis_token_hash() and vt.expires_at > now() limit 1),
    auth.uid())
$$;

-- ─────────── 3. The activity record ───────────
create table if not exists public.crisis_activity (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  user_id uuid,          -- the real account (null: a personal code)
  member_id uuid,        -- the person they acted as
  action text not null,  -- table.insert / table.update / table.delete, demo.opened, demo.view_as
  row_id uuid,
  changed text[],
  summary text
);
create index if not exists crisis_activity_crisis_at on public.crisis_activity (crisis_id, at desc);
create index if not exists crisis_activity_user on public.crisis_activity (user_id, at desc);
alter table public.crisis_activity enable row level security;
revoke all on public.crisis_activity from anon, authenticated;

create or replace function public._crisis_demo_log()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb; o jsonb; cid uuid; keys text[]; rid uuid;
begin
  begin
    r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    cid := case when tg_table_name = 'crises' then (r->>'id')::uuid else (r->>'crisis_id')::uuid end;
    if cid is null or not public.crisis_is_demo(cid) then return null; end if;
    if tg_op = 'UPDATE' then
      o := to_jsonb(old);
      select array_agg(k order by k) into keys from jsonb_object_keys(r) k
       where r->k is distinct from o->k and k not in ('updated_at', 'last_seen_at');
      if keys is null then return null; end if;
    end if;
    begin rid := (r->>'id')::uuid; exception when others then rid := null; end;
    insert into public.crisis_activity (crisis_id, user_id, member_id, action, row_id, changed, summary)
    values (cid, public.crisis_actor(), (public.crisis_me(cid)).id, tg_table_name || '.' || lower(tg_op), rid, keys,
            left(coalesce(r->>'title', r->>'name', r->>'body', r->>'label', r->>'display_name', r->>'intention', r->>'response'), 200));
  exception when others then
    raise warning 'crisis demo log failed on %: %', tg_table_name, sqlerrm;
  end;
  return null;
end $$;
revoke all on function public._crisis_demo_log() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['crises', 'crisis_cabinets', 'crisis_characters', 'crisis_character_secrets', 'crisis_members',
    'crisis_directives', 'crisis_directive_notes', 'crisis_news', 'crisis_messages', 'crisis_meetings', 'crisis_meeting_responses',
    'crisis_shapes', 'crisis_units', 'crisis_map_regions', 'crisis_resources', 'crisis_resource_types', 'crisis_staff_invites'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_demo_log', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public._crisis_demo_log()', t || '_demo_log', t);
  end loop;
end $$;

-- ─────────── 2. Visitors ───────────
-- The demo sends no email.
create or replace function public._crisis_demo_no_invites()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'pending' and public.crisis_is_demo(new.crisis_id) then
    raise exception 'crisis_demo_no_email' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists crisis_staff_invites_demo on public.crisis_staff_invites;
create trigger crisis_staff_invites_demo before insert or update on public.crisis_staff_invites
  for each row execute function public._crisis_demo_no_invites();

-- Someone trying the demo as another person never changes or removes a person who is on a Gavelling account.
create or replace function public._crisis_demo_keep_accounts()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if old.user_id is not null and public.crisis_is_demo(old.crisis_id) and public.crisis_token_hash() is not null then
    if tg_op = 'DELETE' then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
    if (new.role, new.cabinet_id, new.character_id, new.display_name, new.user_id, new.email)
       is distinct from (old.role, old.cabinet_id, old.character_id, old.display_name, old.user_id, old.email) then
      raise exception 'crisis_forbidden' using errcode = '42501';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists crisis_members_demo_keep on public.crisis_members;
create trigger crisis_members_demo_keep before update or delete on public.crisis_members
  for each row execute function public._crisis_demo_keep_accounts();

-- What "Try it as" needs for the demo, for any signed-in account: no emails, no codes, nobody on an account.
create or replace function public.crisis_demo_try_as(p_crisis uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null or not public.crisis_is_demo(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'crisis_id', m.crisis_id, 'user_id', null, 'role', m.role,
        'cabinet_id', m.cabinet_id, 'character_id', m.character_id, 'display_name', m.display_name, 'email', null, 'access_code', null,
        'last_seen_at', m.last_seen_at, 'created_at', m.created_at, 'picture_url', m.picture_url) order by m.display_name)
      from public.crisis_members m where m.crisis_id = p_crisis and m.user_id is null), '[]'::jsonb),
    'characters', coalesce((select jsonb_agg(jsonb_build_object('id', ch.id, 'crisis_id', ch.crisis_id, 'cabinet_id', ch.cabinet_id,
        'name', ch.name, 'picture_url', ch.picture_url, 'status', ch.status))
      from public.crisis_characters ch where ch.crisis_id = p_crisis), '[]'::jsonb),
    'cabinets', coalesce((select jsonb_agg(jsonb_build_object('id', cb.id, 'crisis_id', cb.crisis_id, 'conference_committee_id', cb.conference_committee_id,
        'name', cb.name, 'short_name', cb.short_name, 'color', cb.color, 'sort', cb.sort) order by cb.sort)
      from public.crisis_cabinets cb where cb.crisis_id = p_crisis), '[]'::jsonb),
    'rooms', coalesce((select jsonb_agg(jsonb_build_object('cabinet_id', cb.id, 'code', coalesce(r.code, cc.session_code),
        'chair_password', nullif(r.settings->>'chairJoinSuffix', '')))
      from public.crisis_cabinets cb join public.conference_committees cc on cc.id = cb.conference_committee_id
      left join public.committees r on r.id = cc.session_id
     where cb.crisis_id = p_crisis and coalesce(r.code, cc.session_code) is not null), '[]'::jsonb))
  into v;
  insert into public.crisis_activity (crisis_id, user_id, action) values (p_crisis, auth.uid(), 'demo.opened');
  return v;
end $$;
revoke all on function public.crisis_demo_try_as(uuid) from public;
grant execute on function public.crisis_demo_try_as(uuid) to authenticated;

create or replace function public.crisis_view_as(p_member uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare m record; tok text; demo boolean;
begin
  select cm.*, cr.slug as crisis_slug, f.slug as conference_slug, cr.is_demo into m
    from public.crisis_members cm join public.crises cr on cr.id = cm.crisis_id join public.conferences f on f.id = cr.conference_id
   where cm.id = p_member;
  if not found then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
  -- The shared demo: any signed-in account, as anyone who is not on a Gavelling account (part 48).
  demo := m.is_demo and auth.uid() is not null and m.user_id is null;
  if not (demo
          or exists (select 1 from public.crisis_members where crisis_id = m.crisis_id and user_id = auth.uid() and role in ('director','assistant_director'))
          or public.is_conference_organizer((select conference_id from public.crises where id = m.crisis_id))) then
    raise exception 'crisis_forbidden' using errcode = '42501';
  end if;
  delete from public.crisis_view_tokens where expires_at < now();
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.crisis_view_tokens(token_hash, member_id, created_by, expires_at)
  values (encode(extensions.digest(tok, 'sha256'), 'hex'), m.id, auth.uid(), now() + interval '2 hours');
  if m.is_demo then
    insert into public.crisis_activity (crisis_id, user_id, member_id, action, summary)
    values (m.crisis_id, auth.uid(), m.id, 'demo.view_as', m.role || ': ' || m.display_name);
  end if;
  return jsonb_build_object('ok', true, 'token', tok, 'role', m.role, 'display_name', m.display_name,
    'conference_slug', m.conference_slug, 'crisis_slug', m.crisis_slug, 'view_as', true);
end $$;

create or replace function public.crisis_my_list()
returns table(crisis_id uuid, crisis_slug text, crisis_name text, conference_slug text, conference_name text, conference_acronym text, logo_url text, start_date date, role text)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, f.slug, f.full_name, f.acronym, f.logo_url, f.start_date,
         coalesce(m.role, case when c.created_by = auth.uid()
                                 or exists (select 1 from public.conference_organizers o where o.conference_id = c.conference_id and o.user_id = auth.uid())
                               then 'organiser' else 'visitor' end)
  from public.crises c
  join public.conferences f on f.id = c.conference_id
  left join public.crisis_members m on m.crisis_id = c.id and m.user_id = auth.uid()
  where auth.uid() is not null
    and (m.id is not null
      or c.created_by = auth.uid()
      or c.is_demo
      or exists (select 1 from public.conference_organizers o where o.conference_id = c.conference_id and o.user_id = auth.uid()))
  order by c.is_demo, f.start_date desc nulls last, c.name
$$;

-- ─────────── 4. Slurs and hate speech ───────────
-- Swearing is fine. Refused: racial, ethnic, religious, homophobic and transphobic slurs, and calls to kill a group.
-- Words that are also ordinary or historical words (Niger, niggardly, snigger, "chink in the armour", Negro in a 1960s
-- document, dyke, Jap, kraut) are deliberately NOT on the list.
create or replace function public.crisis_text_hateful(p text)
returns boolean language plpgsql immutable set search_path = public as $$
declare t text; squashed text;
begin
  if p is null or p = '' then return false; end if;
  t := translate(lower(p), '013457@$!|', 'oieastasii');
  t := regexp_replace(t, '([a-z])\1{2,}', '\1', 'g');           -- niiiigger -> nigger
  if t ~ ('\m(' ||
      'n[i]gg(er|ers|a|as|az|ah|uh|ur)|niglets?|nignogs?|sandnigg(er|ers|a)|' ||
      'kikes?|spics?|spicks?|wetbacks?|beaners?|gooks?|coons?|jigaboos?|porch ?monkeys?|towel ?heads?|rag ?heads?|' ||
      'camel ?jockeys?|zipper ?heads?|ching ?chong|golliwogs?|darkies|darkeys?|sambos?|wogs?|yids?|hymies?|heebs?|' ||
      'pakis?|gypos?|pikeys?|faggots?|faggy|fagot|trann(y|ies|ys)|shemales?' ||
      ')\M') then return true; end if;
  if t ~ '\m(gas|kill|exterminate|lynch|hang|burn|genocide) (all |the |every )?(jews?|blacks?|muslims?|gays?|arabs?|asians?|mexicans?|gypsies|roma|immigrants?|n[i]gg(er|ers|as))\M'
     or t ~ '\mwhite power\M' then return true; end if;
  -- Spelled with gaps or dots ("n i g g e r", "f.a.g.g.o.t"): only long, unmistakable words are checked this way.
  squashed := regexp_replace(regexp_replace(t, '\m(sniggers?|sniggering|sniggered|niggardly|niggard)\M', ' ', 'g'), '[^a-z]', '', 'g');
  if squashed ~ '(nigger|faggot|wetback|towelhead|raghead|chingchong|zipperhead|porchmonkey|jigaboo)' then return true; end if;
  return false;
end $$;

create or replace function public._crisis_block_hate()
returns trigger language plpgsql set search_path = public as $$
declare r jsonb := to_jsonb(new); o jsonb; col text;
begin
  if tg_op = 'UPDATE' then o := to_jsonb(old); end if;
  foreach col in array tg_argv loop
    if r ? col and (o is null or r->col is distinct from o->col)
       and public.crisis_text_hateful(case when jsonb_typeof(r->col) = 'string' then r->>col else (r->col)::text end) then
      raise exception 'crisis_hate_speech' using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;

do $$ declare t record; begin
  for t in select * from (values
    ('crises', 'name'),
    ('crisis_cabinets', 'name,short_name,directives_paused_note'),
    ('crisis_characters', 'name,title,bio,powers,location,status_note,guide_name'),
    ('crisis_character_secrets', 'goals,staff_notes'),
    ('crisis_members', 'display_name'),
    ('crisis_directives', 'title,receiver,themes,body,resources_used,goal,affects,outcome,reply'),
    ('crisis_directive_notes', 'body'),
    ('crisis_news', 'title,body,source_label,attachment_name'),
    ('crisis_messages', 'body'),
    ('crisis_meetings', 'intention,staff_note,outcome_note'),
    ('crisis_meeting_responses', 'response'),
    ('crisis_shapes', 'label,description'),
    ('crisis_units', 'name,note,custom_type,details'),
    ('crisis_resource_types', 'name,unit'),
    ('crisis_resource_log', 'reason'),
    ('crisis_staff_invites', 'invited_name')
  ) as v(tbl, cols) loop
    execute format('drop trigger if exists %I on public.%I', t.tbl || '_no_hate', t.tbl);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public._crisis_block_hate(%s)',
                   t.tbl || '_no_hate', t.tbl, (select string_agg(quote_literal(c), ', ') from unnest(string_to_array(t.cols, ',')) c));
  end loop;
end $$;
