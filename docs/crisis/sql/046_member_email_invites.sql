-- Gavelling Crisis part 46 (15 Nov 2026): the Crisis Director adds or changes a person's email after they were added, and
-- that email gets an invite. Until now the email could only be typed when the person was added, it only linked an account
-- that already existed, and nothing told the person. Now Manage on a delegate or chair (anyone not yet on a Gavelling
-- account) has an Email field: saving it sends an invite to that address, and accepting it on a Gavelling account links the
-- account to THAT seat (character, cabinet and role unchanged). Changing the email cancels the old invite; clearing it
-- cancels the invite too. A person already on a Gavelling account keeps the account's email (no change offered).

set local lock_timeout = '3s';

-- 1. An invite can now be for an existing seat (member_id set at sending): any role but Director.
alter table public.crisis_staff_invites drop constraint if exists crisis_staff_invites_role_check;
alter table public.crisis_staff_invites add constraint crisis_staff_invites_role_check
  check (role = any (array['assistant_director', 'backroomer', 'press', 'chair', 'delegate']));

-- 2. Set, change or clear a person's email; a set email gets an invite (sent again when the same email is saved again).
create or replace function public.crisis_set_member_email(p_member uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.crisis_members; v_email text := lower(public.clean_email_text(p_email));
  v_user uuid; v_other record; v_inv record;
begin
  select * into m from public.crisis_members where id = p_member;
  if m.id is null or not public.crisis_is_director(m.crisis_id) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  if m.role = 'director' then return jsonb_build_object('ok', false, 'reason', 'bad_role'); end if;
  if m.user_id is not null then return jsonb_build_object('ok', false, 'reason', 'has_account'); end if;

  if v_email is null then
    update public.crisis_members set email = null where id = m.id;
    update public.crisis_staff_invites set status = 'revoked', responded_at = now() where member_id = m.id and status = 'pending';
    return jsonb_build_object('ok', true, 'invited', false);
  end if;
  if not public.is_sendable_email(v_email) then return jsonb_build_object('ok', false, 'reason', 'bad_email'); end if;

  select u.id into v_user from auth.users u where lower(u.email) = v_email limit 1;
  -- The address already belongs to someone else in this crisis (on their account, or typed for another seat).
  select id, display_name into v_other from public.crisis_members
   where crisis_id = m.crisis_id and id <> m.id
     and ((v_user is not null and user_id = v_user) or lower(email) = v_email) limit 1;
  if v_other.id is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_member', 'name', v_other.display_name);
  end if;

  update public.crisis_members set email = v_email where id = m.id;
  update public.crisis_staff_invites set status = 'revoked', responded_at = now()
   where member_id = m.id and status = 'pending' and lower(email) <> v_email;
  -- A pending staff invite to the same address would add them a second time: it gives way to this seat's invite.
  update public.crisis_staff_invites set status = 'revoked', responded_at = now()
   where crisis_id = m.crisis_id and member_id is null and status = 'pending' and lower(email) = v_email;

  select * into v_inv from public.crisis_staff_invites where member_id = m.id and status = 'pending' limit 1;
  if v_inv.id is not null then
    update public.crisis_staff_invites set role = m.role, invited_name = left(btrim(m.display_name), 120), invited_user_id = v_user
     where id = v_inv.id returning * into v_inv;
  else
    insert into public.crisis_staff_invites (crisis_id, role, email, invited_user_id, invited_name, member_id)
    values (m.crisis_id, m.role, v_email, v_user, left(btrim(m.display_name), 120), m.id)
    returning * into v_inv;
  end if;
  perform public._crisis_staff_invite_email(v_inv.id);
  return jsonb_build_object('ok', true, 'invited', true, 'invite_id', v_inv.id, 'account_exists', v_user is not null);
end $$;
revoke all on function public.crisis_set_member_email(uuid, text) from public;
grant execute on function public.crisis_set_member_email(uuid, text) to authenticated;

-- 3. The email names the seat: the character a delegate plays, or the chair's cabinet.
create or replace function public._crisis_staff_invite_email(p_invite uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v record; v_role text; v_url text; v_subject text; v_heading text; v_paras text[]; v_html text; v_id uuid; v_hi text;
begin
  select i.*, c.name as crisis_name, c.conference_id, co.full_name as conference_name,
         nullif(btrim(p.display_name), '') as account_name, ch.name as character_name, cb.name as cabinet_name
    into v
    from public.crisis_staff_invites i
    join public.crises c on c.id = i.crisis_id
    join public.conferences co on co.id = c.conference_id
    left join public.profiles p on p.id = i.invited_user_id
    left join public.crisis_members cm on cm.id = i.member_id
    left join public.crisis_characters ch on ch.id = cm.character_id
    left join public.crisis_cabinets cb on cb.id = cm.cabinet_id
   where i.id = p_invite and i.status = 'pending';
  if not found then return null; end if;

  v_role := case v.role
    when 'backroomer' then 'a backroomer'
    when 'assistant_director' then 'an Assistant Crisis Director'
    when 'press' then 'the press'
    when 'chair' then coalesce('the chair of ' || v.cabinet_name, 'a chair')
    else coalesce(nullif(btrim(v.character_name), ''), 'a delegate') end;
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

-- 4. The invite page names the seat too.
create or replace function public.get_crisis_staff_invite(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v record;
begin
  select i.status, i.role, i.email, c.name as crisis_name, c.slug as crisis_slug,
         co.full_name, co.acronym, co.slug as conference_slug, co.logo_url,
         ch.name as character_name, cb.name as cabinet_name
    into v
    from public.crisis_staff_invites i
    join public.crises c on c.id = i.crisis_id
    join public.conferences co on co.id = c.conference_id
    left join public.crisis_members cm on cm.id = i.member_id
    left join public.crisis_characters ch on ch.id = cm.character_id
    left join public.crisis_cabinets cb on cb.id = cm.cabinet_id
   where i.token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'status', v.status, 'role', v.role, 'email', v.email,
    'crisis_name', v.crisis_name, 'crisis_slug', v.crisis_slug, 'conference_name', v.full_name,
    'acronym', v.acronym, 'conference_slug', v.conference_slug, 'logo_url', v.logo_url,
    'character_name', v.character_name, 'cabinet_name', v.cabinet_name);
end $$;

-- 5. Accepting a seat's invite links the account to that seat; a staff invite works as before.
create or replace function public.respond_crisis_staff_invite(p_token uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v record; v_member record; v_seat public.crisis_members; v_mid uuid; v_name text; v_email text;
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

  if v.role in ('chair', 'delegate') then
    -- A seat's invite: the seat must still be there and still waiting for an account.
    select * into v_seat from public.crisis_members where id = v.member_id and crisis_id = v.crisis_id for update;
    if v_seat.id is null or (v_seat.user_id is not null and v_seat.user_id <> v_uid) then
      update public.crisis_staff_invites set status = 'revoked', responded_at = now() where id = v.id;
      return jsonb_build_object('ok', false, 'reason', 'revoked');
    end if;
    if v_member.id is not null and v_member.id <> v_seat.id then
      return jsonb_build_object('ok', false, 'reason', 'already_member', 'role', v_member.role);
    end if;
    select lower(u.email) into v_email from auth.users u where u.id = v_uid;
    update public.crisis_members set user_id = v_uid, email = coalesce(v_email, email) where id = v_seat.id;
    v_mid := v_seat.id;
  else
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
  end if;

  update public.crisis_staff_invites
     set status = 'accepted', responded_at = now(), invited_user_id = v_uid, member_id = v_mid
   where id = v.id;
  return jsonb_build_object('ok', true, 'accepted', true, 'conference_slug', v_conf_slug, 'crisis_slug', v_crisis_slug);
end $$;
