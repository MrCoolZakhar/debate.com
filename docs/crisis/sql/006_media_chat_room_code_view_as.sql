-- Gavelling Crisis, part 6 (Peter's phase 1 feedback, 25 Oct 2026):
-- news banner and file with no practical length limit; the crisis-media bucket; chat between
-- characters (free by default, backroom can read, approval as a setting); several devices per
-- personal code; "View as" for directors; sign in with the ROOM code + your own password; and a
-- public lookup so /join can send a crisis room's people to /crisis.

-- ───────── News: banner, file, long text ─────────
alter table public.crisis_news drop constraint if exists crisis_news_body_check;
alter table public.crisis_news add constraint crisis_news_body_check check (char_length(btrim(body)) between 1 and 200000);
alter table public.crisis_news add column if not exists banner_url text;
alter table public.crisis_news add column if not exists attachment_url text;
alter table public.crisis_news add column if not exists attachment_name text;

-- ───────── Bucket for crisis media (banners, attachments, pictures) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crisis-media', 'crisis-media', true, 20971520, array[
  'image/jpeg','image/png','image/webp','image/gif','application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'])
on conflict (id) do nothing;

-- Uploads go under <crisis id>/...; the folder must be a real crisis. Personal-code staff have no
-- JWT the storage server can check, so (like session-documents) the unguessable crisis id is the gate.
-- No update or delete: a file once used stays.
create policy crisis_media_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'crisis-media'
              and exists (select 1 from public.crises c where c.id::text = (storage.foldername(name))[1]));
create policy crisis_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'crisis-media');

-- ───────── Several devices per personal code ─────────
alter table public.crisis_members add column if not exists token_hashes text[] not null default '{}';
update public.crisis_members set token_hashes = array[token_hash] where token_hash is not null and token_hashes = '{}';

create or replace function public.crisis_token_hash() returns text
language sql stable set search_path = public, extensions as $$
  select case when coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-crisis-token', '') = '' then null
         else encode(extensions.digest(nullif(current_setting('request.headers', true), '')::json ->> 'x-crisis-token', 'sha256'), 'hex') end
$$;

create or replace function public.crisis_me(p_crisis uuid)
returns public.crisis_members
language plpgsql stable security definer set search_path = public, extensions as $$
declare h text; m public.crisis_members;
begin
  h := public.crisis_token_hash();
  -- A personal-code or "View as" token on this device wins over the account.
  if h is not null then
    select * into m from public.crisis_members where crisis_id = p_crisis and h = any(token_hashes) limit 1;
    if found then return m; end if;
  end if;
  if auth.uid() is not null then
    select * into m from public.crisis_members where crisis_id = p_crisis and user_id = auth.uid() limit 1;
  end if;
  return m;
end $$;

create or replace function public.crisis_new_token(p_member uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  update public.crisis_members
     set token_hashes = (array[encode(extensions.digest(tok, 'sha256'), 'hex')] || token_hashes)[1:8], last_seen_at = now()
   where id = p_member;
  return tok;
end $$;
revoke execute on function public.crisis_new_token(uuid) from public, anon, authenticated;

-- Issue a personal code and a password that no one else in this crisis has (room code + password works too).
create or replace function public.crisis_issue_code(p_member uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare m record; code text; pw text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; tries int := 0;
begin
  select * into m from public.crisis_members where id = p_member;
  if not found or not public.crisis_is_director(m.crisis_id) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  code := m.access_code;
  if code is null then
    loop
      code := '';
      for i in 1..8 loop code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
      exit when not exists (select 1 from public.crisis_members where access_code = code);
    end loop;
  end if;
  loop
    tries := tries + 1;
    pw := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when tries > 60 or not exists (
      select 1 from public.crisis_members o where o.crisis_id = m.crisis_id and o.id <> m.id
        and o.password_hash is not null and extensions.crypt(pw, o.password_hash) = o.password_hash);
  end loop;
  update public.crisis_members
     set access_code = code, password_hash = extensions.crypt(pw, extensions.gen_salt('bf')),
         token_hash = null, token_hashes = '{}', failed_logins = 0, locked_until = null
   where id = p_member;
  return jsonb_build_object('code', code, 'password', pw);
end $$;

-- Sign in with a personal code, OR the committee's room code (as for /chair and /delegate) plus your own password.
create or replace function public.crisis_code_login(p_code text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare m record; tok text; c text; pw text; cid uuid;
begin
  c := upper(btrim(coalesce(p_code, '')));
  pw := btrim(coalesce(p_password, ''));
  select cm.*, cr.slug as crisis_slug, f.slug as conference_slug into m
    from public.crisis_members cm join public.crises cr on cr.id = cm.crisis_id join public.conferences f on f.id = cr.conference_id
   where cm.access_code = c;
  if not found then
    -- The room code of a linked committee: find the person by their password within that crisis.
    select cb.crisis_id into cid from public.crisis_cabinets cb
      join public.conference_committees cc on cc.id = cb.conference_committee_id
     where upper(cc.session_code) = c limit 1;
    if cid is null then return jsonb_build_object('ok', false, 'reason', 'wrong'); end if;
    if exists (select 1 from public.crisis_members where crisis_id = cid and locked_until > now() and failed_logins >= 8) then
      return jsonb_build_object('ok', false, 'reason', 'locked', 'wait_seconds', 600);
    end if;
    select cm.*, cr.slug as crisis_slug, f.slug as conference_slug into m
      from public.crisis_members cm join public.crises cr on cr.id = cm.crisis_id join public.conferences f on f.id = cr.conference_id
     where cm.crisis_id = cid and cm.password_hash is not null and extensions.crypt(pw, cm.password_hash) = cm.password_hash
     limit 1;
    if not found then
      -- Count room-code misses on the crisis's director row so guessing is slowed for everyone.
      update public.crisis_members set failed_logins = failed_logins + 1,
             locked_until = case when failed_logins + 1 >= 8 then now() + interval '10 minutes' else locked_until end
       where id = (select id from public.crisis_members where crisis_id = cid order by (role = 'director') desc, created_at limit 1);
      return jsonb_build_object('ok', false, 'reason', 'wrong');
    end if;
  else
    if m.password_hash is null then return jsonb_build_object('ok', false, 'reason', 'wrong'); end if;
    if m.locked_until is not null and m.locked_until > now() then
      return jsonb_build_object('ok', false, 'reason', 'locked', 'wait_seconds', ceil(extract(epoch from (m.locked_until - now())))::int);
    end if;
    if extensions.crypt(pw, m.password_hash) <> m.password_hash then
      update public.crisis_members set failed_logins = failed_logins + 1,
             locked_until = case when failed_logins + 1 >= 8 then now() + interval '10 minutes' else locked_until end
       where id = m.id;
      return jsonb_build_object('ok', false, 'reason', 'wrong');
    end if;
  end if;
  update public.crisis_members set failed_logins = 0, locked_until = null where id = m.id;
  tok := public.crisis_new_token(m.id);
  return jsonb_build_object('ok', true, 'token', tok, 'crisis_id', m.crisis_id,
    'conference_slug', m.conference_slug, 'crisis_slug', m.crisis_slug, 'display_name', m.display_name, 'role', m.role);
end $$;

create or replace function public.crisis_code_logout(p_crisis uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare h text;
begin
  h := public.crisis_token_hash();
  if h is null then return false; end if;
  update public.crisis_members set token_hashes = array_remove(token_hashes, h) where crisis_id = p_crisis and h = any(token_hashes);
  return true;
end $$;

-- "View as": a director (through their own account) or an organiser opens the crisis as any person in it.
-- It adds a token for this device only; the person stays signed in on their own devices.
create or replace function public.crisis_view_as(p_member uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select cm.*, cr.slug as crisis_slug, f.slug as conference_slug into m
    from public.crisis_members cm join public.crises cr on cr.id = cm.crisis_id join public.conferences f on f.id = cr.conference_id
   where cm.id = p_member;
  if not found then raise exception 'crisis_not_found' using errcode = 'P0002'; end if;
  if not (exists (select 1 from public.crisis_members where crisis_id = m.crisis_id and user_id = auth.uid() and role in ('director','assistant_director'))
          or public.is_conference_organizer((select conference_id from public.crises where id = m.crisis_id))) then
    raise exception 'crisis_forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object('ok', true, 'token', public.crisis_new_token(m.id), 'role', m.role, 'display_name', m.display_name,
    'conference_slug', m.conference_slug, 'crisis_slug', m.crisis_slug);
end $$;

-- Public: is this room code a Gavelling Crisis room? (No names or ids beyond the slugs.)
create or replace function public.crisis_for_room(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('conference_slug', f.slug, 'crisis_slug', cr.slug, 'name', cr.name)
    from public.crisis_cabinets cb
    join public.conference_committees cc on cc.id = cb.conference_committee_id
    join public.crises cr on cr.id = cb.crisis_id
    join public.conferences f on f.id = cr.conference_id
   where upper(cc.session_code) = upper(btrim(coalesce(p_code, ''))) limit 1), 'null'::jsonb)
$$;

grant execute on function public.crisis_for_room(text), public.crisis_code_logout(uuid) to anon, authenticated;
grant execute on function public.crisis_view_as(uuid) to authenticated;
revoke execute on function public.crisis_view_as(uuid) from anon, public;

-- ───────── Chat between characters ─────────
create table public.crisis_messages (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  from_member_id uuid references public.crisis_members(id) on delete set null,
  from_character_id uuid references public.crisis_characters(id) on delete set null,
  to_character_id uuid not null references public.crisis_characters(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  status text not null default 'sent' check (status in ('sent','pending','rejected')),
  decided_by uuid references public.crisis_members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index crisis_messages_pair on public.crisis_messages(crisis_id, from_character_id, to_character_id, created_at);
alter table public.crisis_messages enable row level security;

-- Staff read every message (backroom can read); a character reads what they sent and what reached them.
create policy messages_read on public.crisis_messages for select using (
  public.crisis_is_staff(crisis_id)
  or from_character_id = (public.crisis_me(crisis_id)).character_id
  or (status = 'sent' and to_character_id = (public.crisis_me(crisis_id)).character_id));

create or replace function public.crisis_send_message(p_crisis uuid, p_to_character uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.crisis_members; mode text; st text; mid uuid;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null or me.character_id is null then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  if p_to_character = me.character_id or not exists (
       select 1 from public.crisis_characters where id = p_to_character and crisis_id = p_crisis and status <> 'spare') then
    raise exception 'crisis_not_found' using errcode = 'P0002';
  end if;
  select coalesce(settings ->> 'messages', 'free') into mode from public.crises where id = p_crisis;
  if mode = 'off' then return jsonb_build_object('ok', false, 'reason', 'off'); end if;
  st := case when mode = 'approval' then 'pending' else 'sent' end;
  insert into public.crisis_messages(crisis_id, from_member_id, from_character_id, to_character_id, body, status)
  values (p_crisis, me.id, me.character_id, p_to_character, btrim(p_body), st) returning id into mid;
  return jsonb_build_object('ok', true, 'id', mid, 'status', st);
end $$;

create or replace function public.crisis_decide_message(p_message uuid, p_approve boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare msg record;
begin
  select * into msg from public.crisis_messages where id = p_message;
  if not found or not public.crisis_is_staff(msg.crisis_id) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  update public.crisis_messages set status = case when p_approve then 'sent' else 'rejected' end,
         decided_by = (public.crisis_me(msg.crisis_id)).id
   where id = p_message and status = 'pending';
  return true;
end $$;
grant execute on function public.crisis_send_message(uuid, uuid, text), public.crisis_decide_message(uuid, boolean) to anon, authenticated;

create trigger crisis_messages_ping after insert or update or delete on public.crisis_messages
  for each row execute function public.crisis_ping();
