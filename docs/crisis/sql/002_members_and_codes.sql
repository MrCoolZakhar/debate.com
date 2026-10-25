-- Gavelling Crisis, part 2: adding people, personal codes and passwords, presence.
-- A person gets in with their Gavelling account, or with a personal code + password the CD issues.
-- The code login returns a token; the client sends it as the x-crisis-token header and crisis_me() matches its hash.

alter table public.crisis_members add column if not exists failed_logins smallint not null default 0;
alter table public.crisis_members add column if not exists locked_until timestamptz;

-- Add a person (director). Links an existing Gavelling account when the email matches one.
create or replace function public.crisis_add_member(p_crisis uuid, p_role text, p_name text, p_email text default null,
                                                    p_cabinet uuid default null, p_character uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid; mid uuid; em text;
begin
  if not public.crisis_is_director(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  if p_role not in ('director','assistant_director','backroomer','chair','press','delegate') then
    raise exception 'crisis_bad_role' using errcode = '22023';
  end if;
  em := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if em is not null then select id into uid from auth.users where lower(email) = em limit 1; end if;
  if uid is not null then
    select id into mid from public.crisis_members where crisis_id = p_crisis and user_id = uid;
    if mid is not null then
      update public.crisis_members set role = p_role, cabinet_id = coalesce(p_cabinet, cabinet_id),
             character_id = coalesce(p_character, character_id) where id = mid;
      return mid;
    end if;
  end if;
  insert into public.crisis_members(crisis_id, user_id, role, cabinet_id, character_id, display_name, email)
  values (p_crisis, uid, p_role, p_cabinet, p_character, btrim(p_name), em)
  returning id into mid;
  return mid;
end $$;

-- Issue (or re-issue) a personal code and password. Returned once, never stored in plain text.
create or replace function public.crisis_issue_code(p_member uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare m record; code text; pw text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
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
  pw := lpad((floor(random() * 1000000))::int::text, 6, '0');
  update public.crisis_members
     set access_code = code, password_hash = extensions.crypt(pw, extensions.gen_salt('bf')),
         token_hash = null, failed_logins = 0, locked_until = null
   where id = p_member;
  return jsonb_build_object('code', code, 'password', pw);
end $$;

-- Sign in with a personal code. 8 wrong passwords lock the code for 10 minutes.
create or replace function public.crisis_code_login(p_code text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare m record; tok text;
begin
  select cm.*, cr.slug as crisis_slug, f.slug as conference_slug
    into m from public.crisis_members cm
    join public.crises cr on cr.id = cm.crisis_id
    join public.conferences f on f.id = cr.conference_id
   where cm.access_code = upper(btrim(coalesce(p_code, '')));
  if not found or m.password_hash is null then return jsonb_build_object('ok', false, 'reason', 'wrong'); end if;
  if m.locked_until is not null and m.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked',
      'wait_seconds', ceil(extract(epoch from (m.locked_until - now())))::int);
  end if;
  if extensions.crypt(btrim(coalesce(p_password, '')), m.password_hash) <> m.password_hash then
    update public.crisis_members
       set failed_logins = failed_logins + 1,
           locked_until = case when failed_logins + 1 >= 8 then now() + interval '10 minutes' else locked_until end
     where id = m.id;
    return jsonb_build_object('ok', false, 'reason', 'wrong');
  end if;
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  update public.crisis_members
     set token_hash = encode(extensions.digest(tok, 'sha256'), 'hex'), failed_logins = 0, locked_until = null, last_seen_at = now()
   where id = m.id;
  return jsonb_build_object('ok', true, 'token', tok, 'crisis_id', m.crisis_id,
    'conference_slug', m.conference_slug, 'crisis_slug', m.crisis_slug, 'display_name', m.display_name, 'role', m.role);
end $$;

-- Sign out of a personal code on every device.
create or replace function public.crisis_code_logout(p_crisis uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare me public.crisis_members;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null then return false; end if;
  update public.crisis_members set token_hash = null where id = me.id and me.user_id is null;
  return true;
end $$;

-- Presence: called about once a minute by an open page.
create or replace function public.crisis_heartbeat(p_crisis uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare me public.crisis_members;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null then return false; end if;
  update public.crisis_members set last_seen_at = now() where id = me.id;
  return true;
end $$;

grant execute on function public.crisis_code_login(text, text), public.crisis_code_logout(uuid), public.crisis_heartbeat(uuid) to anon, authenticated;
grant execute on function public.crisis_add_member(uuid, text, text, text, uuid, uuid), public.crisis_issue_code(uuid) to authenticated;
revoke execute on function public.crisis_add_member(uuid, text, text, text, uuid, uuid), public.crisis_issue_code(uuid) from anon, public;
