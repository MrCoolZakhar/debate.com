-- Gavelling Crisis part 42 (15 Nov 2026): a chair invited to a crisis cabinet's committee joins the crisis on accept.
-- Chairs are invited the ordinary conference way (conference_chair_invites, /invites/chair/<token>). Accepting puts them in
-- conference_committees.chair_user_ids; this trigger also gives them their crisis seat on the same press:
--   * the cabinet's chair seat that carries the invite's email (or their account's email) and no account yet is linked to
--     their account (its name, cabinet and any code stay as they are);
--   * otherwise, when they are not in the crisis yet, a chair seat on their account is added to that cabinet.
-- It never blocks the conference accept: a failure here is reported as a warning and the accept goes through.

create or replace function public._crisis_link_accepted_chair()
returns trigger language plpgsql security definer set search_path = public as $$
declare cab record; v_mid uuid; v_name text; v_email text;
begin
  if new.status <> 'accepted' or old.status = 'accepted' or new.invited_user_id is null then return new; end if;
  begin
    select nullif(btrim(p.display_name), ''), lower(u.email) into v_name, v_email
      from auth.users u left join public.profiles p on p.id = u.id where u.id = new.invited_user_id;
    for cab in select cb.id, cb.crisis_id from public.crisis_cabinets cb where cb.conference_committee_id = new.committee_id loop
      if exists (select 1 from public.crisis_members where crisis_id = cab.crisis_id and user_id = new.invited_user_id) then continue; end if;
      v_mid := null;
      select id into v_mid from public.crisis_members
       where crisis_id = cab.crisis_id and role = 'chair' and cabinet_id = cab.id and user_id is null
         and lower(email) in (lower(new.email), coalesce(v_email, lower(new.email)))
       order by created_at limit 1;
      if v_mid is not null then
        update public.crisis_members set user_id = new.invited_user_id where id = v_mid;
      else
        insert into public.crisis_members (crisis_id, user_id, role, cabinet_id, display_name, email)
        values (cab.crisis_id, new.invited_user_id, 'chair', cab.id,
                left(coalesce(v_name, new.invited_name, split_part(new.email, '@', 1)), 120), coalesce(v_email, lower(new.email)));
      end if;
    end loop;
  exception when others then
    raise warning 'crisis chair link failed for invite %: %', new.id, sqlerrm;
  end;
  return new;
end $$;
revoke all on function public._crisis_link_accepted_chair() from public, anon, authenticated;

drop trigger if exists zz_crisis_chair_invite_accepted on public.conference_chair_invites;
create trigger zz_crisis_chair_invite_accepted after update of status on public.conference_chair_invites
  for each row execute function public._crisis_link_accepted_chair();
