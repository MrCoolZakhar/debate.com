-- Gavelling Crisis, part 40: backroomers (and other crisis staff) join by an emailed invite on their
-- Gavelling account, the way chairs do (Peter, 14 Nov 2026). Applied as crisis_part40_staff_invites.
--
-- The Director types a name and an email. crisis_invite_staff writes a pending invite and queues the invite
-- email itself (_crisis_staff_invite_email, so code-signed-in Directors can invite too). The invitee opens
-- /invites/crisis/<token>, signs in or signs up, and respond_crisis_staff_invite adds them to the crisis
-- as a member on their account. No personal code is made. An invite to an email that already has an
-- account can only be accepted by that account (like respond_chair_invite).
-- Existing members with codes (Hult's backroomers) are untouched and keep signing in as before.

create table if not exists public.crisis_staff_invites (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  role text not null check (role in ('assistant_director', 'backroomer', 'press')),
  email text not null check (char_length(email) between 3 and 320),
  invited_user_id uuid references auth.users(id) on delete set null,
  invited_name text check (invited_name is null or char_length(btrim(invited_name)) between 1 and 120),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  invited_by uuid default auth.uid(),
  member_id uuid references public.crisis_members(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index if not exists crisis_staff_invites_one_pending
  on public.crisis_staff_invites (crisis_id, lower(email)) where status = 'pending';
create index if not exists crisis_staff_invites_crisis on public.crisis_staff_invites (crisis_id);

alter table public.crisis_staff_invites enable row level security;
drop policy if exists staff_invites_director_read on public.crisis_staff_invites;
create policy staff_invites_director_read on public.crisis_staff_invites for select
  using (public.crisis_is_director(crisis_id));
revoke all on public.crisis_staff_invites from anon, authenticated;
grant select on public.crisis_staff_invites to anon, authenticated;  -- code-signed-in Directors are anon; the policy decides

drop trigger if exists crisis_staff_invites_ping on public.crisis_staff_invites;
create trigger crisis_staff_invites_ping after insert or update or delete on public.crisis_staff_invites
  for each row execute function public.crisis_ping();

-- The invite email, written and rendered here so a Director signed in by code (anon) can send it too.
-- One email_outbox row; the outbox triggers apply the pause, the two-an-hour cap and unsubscribes.
create or replace function public._crisis_staff_invite_email(p_invite uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v record; v_role text; v_url text; v_subject text; v_heading text; v_paras text[]; v_html text; v_id uuid; v_hi text;
begin
  select i.*, c.name as crisis_name, c.conference_id, co.full_name as conference_name,
         nullif(btrim(p.display_name), '') as account_name
    into v
    from public.crisis_staff_invites i
    join public.crises c on c.id = i.crisis_id
    join public.conferences co on co.id = c.conference_id
    left join public.profiles p on p.id = i.invited_user_id
   where i.id = p_invite and i.status = 'pending';
  if not found then return null; end if;

  v_role := case v.role when 'backroomer' then 'a backroomer' when 'assistant_director' then 'an Assistant Crisis Director' else 'the press' end;
  v_url := 'https://gavelling.com/invites/crisis/' || v.token::text;
  v_hi := coalesce(v.account_name, v.invited_name);
  v_subject := 'You''re invited to ' || v.crisis_name;
  v_heading := case v.role when 'backroomer' then 'You''re invited to the backroom' else 'You''re invited to the crisis' end;
  v_paras := array[
    case when v_hi is not null then 'Hi ' || v_hi || ',' else 'Hi,' end,
    v.conference_name || ' has invited you to join ' || v.crisis_name || ' as ' || v_role || '.',
    case when v.invited_user_id is not null
      then 'Accept on your Gavelling account and the crisis opens straight away.'
      else 'Accept with a Gavelling account. If you don''t have one yet, you can make one in a minute, ideally with this email address.' end,
    'If you weren''t expecting this, you can ignore it. Nothing happens until you accept.'];
  v_html := public.gavelling_email_html(v.conference_id, v_heading, v_paras, null, 'Accept the invitation', v_url, null, null, null);

  insert into public.email_outbox (conference_id, recipient_email, subject, body, body_html, status)
  values (v.conference_id, v.email, v_subject, array_to_string(v_paras, E'\n\n') || E'\n\nAccept the invitation: ' || v_url, v_html, 'pending')
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public._crisis_staff_invite_email(uuid) from public, anon, authenticated;

-- Invite (or re-invite) one person and send the invite email. Re-inviting a pending email keeps the same
-- token, so a resend sends the same link.
create or replace function public.crisis_invite_staff(p_crisis uuid, p_role text, p_email text, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(public.clean_email_text(p_email));
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_user uuid; v_profile_name text; v_member record; v_inv record; v_crisis record;
begin
  if not public.crisis_is_director(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  if p_role not in ('assistant_director', 'backroomer', 'press') then
    return jsonb_build_object('ok', false, 'reason', 'bad_role');
  end if;
  if v_email is null or v_email = '' or not public.is_sendable_email(v_email) then
    return jsonb_build_object('ok', false, 'reason', 'bad_email');
  end if;
  if v_name is not null and char_length(v_name) > 120 then v_name := left(v_name, 120); end if;

  select c.id, c.name, c.slug, c.conference_id, co.full_name, co.slug as conference_slug
    into v_crisis from public.crises c join public.conferences co on co.id = c.conference_id where c.id = p_crisis;

  select u.id, nullif(btrim(p.display_name), '') into v_user, v_profile_name
    from auth.users u left join public.profiles p on p.id = u.id where lower(u.email) = v_email limit 1;

  if v_user is not null then
    select id, role into v_member from public.crisis_members where crisis_id = p_crisis and user_id = v_user limit 1;
    if v_member.id is not null then
      return jsonb_build_object('ok', false, 'reason', 'already_member', 'role', v_member.role);
    end if;
  end if;

  select * into v_inv from public.crisis_staff_invites
   where crisis_id = p_crisis and status = 'pending' and lower(email) = v_email limit 1;
  if v_inv.id is not null then
    update public.crisis_staff_invites
       set role = p_role, invited_name = coalesce(v_name, invited_name), invited_user_id = coalesce(v_user, invited_user_id)
     where id = v_inv.id returning * into v_inv;
  else
    insert into public.crisis_staff_invites (crisis_id, role, email, invited_user_id, invited_name)
    values (p_crisis, p_role, v_email, v_user, coalesce(v_name, v_profile_name))
    returning * into v_inv;
  end if;

  perform public._crisis_staff_invite_email(v_inv.id);

  return jsonb_build_object('ok', true, 'invite_id', v_inv.id, 'token', v_inv.token, 'role', v_inv.role,
    'invited_email', v_inv.email,
    'invited_name', coalesce(v_profile_name, v_inv.invited_name, split_part(v_inv.email, '@', 1)),
    'account_exists', v_user is not null,
    'conference_id', v_crisis.conference_id, 'conference_name', v_crisis.full_name, 'crisis_name', v_crisis.name);
end $$;

-- What the invite page shows before sign-in. No name, nothing about who else is in the crisis.
create or replace function public.get_crisis_staff_invite(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v record;
begin
  select i.status, i.role, i.email, c.name as crisis_name, c.slug as crisis_slug,
         co.full_name, co.acronym, co.slug as conference_slug, co.logo_url
    into v
    from public.crisis_staff_invites i
    join public.crises c on c.id = i.crisis_id
    join public.conferences co on co.id = c.conference_id
   where i.token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'status', v.status, 'role', v.role, 'email', v.email,
    'crisis_name', v.crisis_name, 'crisis_slug', v.crisis_slug, 'conference_name', v.full_name,
    'acronym', v.acronym, 'conference_slug', v.conference_slug, 'logo_url', v.logo_url);
end $$;

create or replace function public.respond_crisis_staff_invite(p_token uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v record; v_member record; v_mid uuid; v_name text; v_email text;
  v_conf_slug text; v_crisis_slug text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  select * into v from public.crisis_staff_invites where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select co.slug, c.slug into v_conf_slug, v_crisis_slug
    from public.crises c join public.conferences co on co.id = c.conference_id where c.id = v.crisis_id;

  if v.status = 'accepted' and v.invited_user_id = v_uid then
    return jsonb_build_object('ok', true, 'accepted', true, 'conference_slug', v_conf_slug, 'crisis_slug', v_crisis_slug);
  end if;
  if v.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', v.status); end if;
  if v.invited_user_id is not null and v.invited_user_id <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'wrong_account', 'invited_email', v.email);
  end if;

  if not p_accept then
    update public.crisis_staff_invites set status = 'declined', responded_at = now(), invited_user_id = v_uid where id = v.id;
    return jsonb_build_object('ok', true, 'accepted', false);
  end if;

  select id, role into v_member from public.crisis_members where crisis_id = v.crisis_id and user_id = v_uid limit 1;
  if v_member.id is not null then
    if v_member.role <> v.role then
      return jsonb_build_object('ok', false, 'reason', 'already_member', 'role', v_member.role);
    end if;
    v_mid := v_member.id;
  else
    select nullif(btrim(p.display_name), ''), lower(u.email) into v_name, v_email
      from auth.users u left join public.profiles p on p.id = u.id where u.id = v_uid;
    insert into public.crisis_members (crisis_id, user_id, role, display_name, email)
    values (v.crisis_id, v_uid, v.role, left(coalesce(v_name, v.invited_name, split_part(v.email, '@', 1)), 120), coalesce(v_email, v.email))
    returning id into v_mid;
  end if;

  update public.crisis_staff_invites
     set status = 'accepted', responded_at = now(), invited_user_id = v_uid, member_id = v_mid
   where id = v.id;
  return jsonb_build_object('ok', true, 'accepted', true, 'conference_slug', v_conf_slug, 'crisis_slug', v_crisis_slug);
end $$;

create or replace function public.crisis_cancel_staff_invite(p_invite uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_crisis uuid;
begin
  select crisis_id into v_crisis from public.crisis_staff_invites where id = p_invite;
  if v_crisis is null or not public.crisis_is_director(v_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  update public.crisis_staff_invites set status = 'revoked', responded_at = now() where id = p_invite and status = 'pending';
  return found;
end $$;

revoke all on function public.crisis_invite_staff(uuid, text, text, text) from public;
revoke all on function public.get_crisis_staff_invite(uuid) from public;
revoke all on function public.respond_crisis_staff_invite(uuid, boolean) from public, anon;
revoke all on function public.crisis_cancel_staff_invite(uuid) from public;
grant execute on function public.crisis_invite_staff(uuid, text, text, text) to anon, authenticated;
grant execute on function public.get_crisis_staff_invite(uuid) to anon, authenticated;
grant execute on function public.respond_crisis_staff_invite(uuid, boolean) to authenticated;
grant execute on function public.crisis_cancel_staff_invite(uuid) to anon, authenticated;
