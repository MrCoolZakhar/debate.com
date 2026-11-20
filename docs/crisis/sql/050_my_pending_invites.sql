-- Part 50 (20 Nov 2026): a signed-in person sees the crisis invites waiting for them on /crisis.
-- Why: Jose Sánchez (La Carrera Espacial backroom) made his account on /crisis instead of through his invite link, so the
-- invite stayed pending and /crisis said "No Crises Yet". Now /crisis lists the pending invites for the account
-- (invited_user_id) or for its CONFIRMED email, with Accept, which runs respond_crisis_staff_invite as the email link does.
-- Also: accepting a staff invite that was sent for an existing code seat (member_id, no account on it, same role) now
-- puts the account on THAT seat instead of adding a second row beside it (Jose's and Carmen's seats were made that way).

create or replace function public.crisis_my_pending_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_email text;
begin
  if v_uid is null then return '[]'::jsonb; end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid and u.email_confirmed_at is not null;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'token', i.token, 'role', i.role, 'crisis_name', c.name, 'crisis_slug', c.slug,
             'conference_slug', co.slug, 'acronym', co.acronym, 'logo_url', co.logo_url,
             'character_name', ch.name, 'cabinet_name', cb.name) order by i.created_at desc)
      from public.crisis_staff_invites i
      join public.crises c on c.id = i.crisis_id
      join public.conferences co on co.id = c.conference_id
      left join public.crisis_members cm on cm.id = i.member_id
      left join public.crisis_characters ch on ch.id = cm.character_id
      left join public.crisis_cabinets cb on cb.id = cm.cabinet_id
     where i.status = 'pending'
       and (i.invited_user_id = v_uid or (i.invited_user_id is null and v_email is not null and lower(i.email) = v_email))
       and not exists (select 1 from public.crisis_members x where x.crisis_id = i.crisis_id and x.user_id = v_uid)
  ), '[]'::jsonb);
end $function$;

revoke all on function public.crisis_my_pending_invites() from public, anon;
grant execute on function public.crisis_my_pending_invites() to authenticated;

-- respond_crisis_staff_invite: the staff branch first takes the seat the invite was sent for.
create or replace function public.respond_crisis_staff_invite(p_token uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      -- Part 50: an invite sent for a code seat of the same role puts the account on that seat.
      if v.member_id is not null then
        select * into v_seat from public.crisis_members
         where id = v.member_id and crisis_id = v.crisis_id and role = v.role and user_id is null for update;
        if v_seat.id is not null then
          select lower(u.email) into v_email from auth.users u where u.id = v_uid;
          update public.crisis_members set user_id = v_uid, email = coalesce(v_email, email) where id = v_seat.id;
          v_mid := v_seat.id;
        end if;
      end if;
      if v_mid is null then
        select nullif(btrim(p.display_name), ''), lower(u.email) into v_name, v_email
          from auth.users u left join public.profiles p on p.id = u.id where u.id = v_uid;
        insert into public.crisis_members (crisis_id, user_id, role, display_name, email)
        values (v.crisis_id, v_uid, v.role, left(coalesce(v_name, v.invited_name, split_part(v.email, '@', 1)), 120), coalesce(v_email, v.email))
        returning id into v_mid;
      end if;
    end if;
  end if;
  update public.crisis_staff_invites
     set status = 'accepted', responded_at = now(), invited_user_id = v_uid, member_id = v_mid
   where id = v.id;
  return jsonb_build_object('ok', true, 'accepted', true, 'conference_slug', v_conf_slug, 'crisis_slug', v_crisis_slug);
end $function$;
