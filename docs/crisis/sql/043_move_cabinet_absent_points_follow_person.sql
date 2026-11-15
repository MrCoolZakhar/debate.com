-- Gavelling Crisis part 43 (15 Nov 2026): moving a character to another cabinet takes them out of the old room, and
-- committee-room points follow the PERSON who played the character, for the time they played it (owner).
--
-- 1. crisis_character_players: who played which character, from when to when. Written only by the trigger on
--    crisis_members (a character given, changed or taken away). Backfilled: each current player from the start of the
--    crisis; a character someone wrote directives as but no longer plays, from their first to their last such directive.
--    Read by staff, chairs and the player themself.
-- 2. When a character changes cabinet (crisis_characters.cabinet_id), in the OLD cabinet's room, if it has not ended:
--    the seat named like the character goes absent, leaves the GSL and the caucus queue, and whoever holds the seat is
--    signed out of it (the same 10-minute tombstone as a kick, so the old phone stops). A seat that holds the floor is left
--    to the Moderator's device, which removes an absent floor holder and logs their speech. The character's own seat
--    (slot) and its allocations move to the new cabinet's committee, so the new room's seat is reserved the same way.
-- 3. _room_remove_seat never removes a seat that was ever present or has points in the ledger, so a room's points
--    and history stay where they were earned even when the seat moves away in pre-session.
-- Every step is wrapped so a failure never blocks the cabinet change itself.

create table if not exists public.crisis_character_players (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  character_id uuid not null references public.crisis_characters(id) on delete cascade,
  member_id uuid not null references public.crisis_members(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists crisis_character_players_crisis on public.crisis_character_players (crisis_id);
create index if not exists crisis_character_players_member on public.crisis_character_players (member_id);
alter table public.crisis_character_players enable row level security;
drop policy if exists character_players_read on public.crisis_character_players;
create policy character_players_read on public.crisis_character_players for select using (
  public.crisis_is_staff(crisis_id) or public.crisis_role(crisis_id) = 'chair' or member_id = (public.crisis_me(crisis_id)).id);
revoke all on public.crisis_character_players from anon, authenticated;
grant select on public.crisis_character_players to anon, authenticated;

create or replace function public._crisis_track_player()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'UPDATE' and old.character_id is not null and new.character_id is distinct from old.character_id then
      update public.crisis_character_players set ended_at = now()
       where member_id = old.id and character_id = old.character_id and ended_at is null;
    end if;
    if new.character_id is not null and (tg_op = 'INSERT' or new.character_id is distinct from old.character_id) then
      insert into public.crisis_character_players (crisis_id, character_id, member_id) values (new.crisis_id, new.character_id, new.id);
    end if;
  exception when others then
    raise warning 'crisis player history failed for member %: %', new.id, sqlerrm;
  end;
  return null;
end $$;
revoke all on function public._crisis_track_player() from public, anon, authenticated;
drop trigger if exists crisis_members_track_player on public.crisis_members;
create trigger crisis_members_track_player after insert or update of character_id on public.crisis_members
  for each row execute function public._crisis_track_player();

-- Backfill (once): current players from the start of their crisis, earlier characters from their directives.
insert into public.crisis_character_players (crisis_id, character_id, member_id, started_at)
select m.crisis_id, m.character_id, m.id, c.created_at
  from public.crisis_members m join public.crises c on c.id = m.crisis_id
 where m.character_id is not null
   and not exists (select 1 from public.crisis_character_players p where p.member_id = m.id and p.character_id = m.character_id);
insert into public.crisis_character_players (crisis_id, character_id, member_id, started_at, ended_at)
select d.crisis_id, d.author_character_id, d.author_member_id, min(d.created_at), max(d.created_at)
  from public.crisis_directives d join public.crisis_members m on m.id = d.author_member_id
 where d.author_character_id is not null and m.character_id is distinct from d.author_character_id
   and not exists (select 1 from public.crisis_character_players p where p.member_id = d.author_member_id and p.character_id = d.author_character_id)
 group by d.crisis_id, d.author_character_id, d.author_member_id;

-- 2. A character moved to another cabinet leaves the old room; its seat and allocation move with it.
create or replace function public._crisis_character_room_move()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_cc uuid; new_cc uuid; old_room uuid; seat record; sl record;
begin
  if new.cabinet_id is not distinct from old.cabinet_id then return null; end if;
  begin
    select conference_committee_id into old_cc from public.crisis_cabinets where id = old.cabinet_id;
    select conference_committee_id into new_cc from public.crisis_cabinets where id = new.cabinet_id;
    if old_cc is not null then select session_id into old_room from public.conference_committees where id = old_cc; end if;
    if old_room is not null and old_cc is distinct from new_cc
       and exists (select 1 from public.committees where id = old_room and ended_at is null) then
      for seat in select id, country from public.delegates
                   where committee_id = old_room and lower(btrim(country)) in (lower(btrim(old.name)), lower(btrim(new.name))) loop
        update public.delegates set status = 'absent' where id = seat.id and status <> 'absent';
        delete from public.speakers_list where committee_id = old_room and delegate_id = seat.id;
        with gone as (
          delete from public.delegate_seat_claims where committee_id = old_room and lower(country) = lower(seat.country)
          returning country, holder_key, device_hash)
        insert into public.delegate_seat_kicks (committee_id, country, holder_key, device_hash)
        select old_room, g.country, g.holder_key, g.device_hash from gone g;
      end loop;
    end if;
    if new.slot_id is not null and old_cc is not null and new_cc is not null and old_cc <> new_cc then
      select * into sl from public.committee_country_slots where id = new.slot_id and conference_committee_id = old_cc;
      if found and not exists (select 1 from public.committee_country_slots where conference_committee_id = new_cc and country_code = sl.country_code) then
        update public.committee_country_slots set conference_committee_id = new_cc where id = sl.id;
        update public.conference_allocations set conference_committee_id = new_cc
         where conference_committee_id = old_cc and country_code = sl.country_code;
      end if;
    end if;
  exception when others then
    raise warning 'crisis room move failed for character %: %', new.id, sqlerrm;
  end;
  return null;
end $$;
revoke all on function public._crisis_character_room_move() from public, anon, authenticated;
drop trigger if exists crisis_characters_room_move on public.crisis_characters;
create trigger crisis_characters_room_move after update of cabinet_id on public.crisis_characters
  for each row execute function public._crisis_character_room_move();

-- 3. A seat that was ever present or has points is never removed automatically.
create or replace function public._room_remove_seat(p_committee uuid, p_country text)
returns void language plpgsql security definer set search_path = public as $$
declare v_room uuid;
begin
  select session_id into v_room from conference_committees where id = p_committee;
  if v_room is null then return; end if;
  if exists (select 1 from committee_country_slots where conference_committee_id = p_committee and country_name = p_country) then return; end if;
  if not exists (select 1 from committees where id = v_room and phase = 'pre-session' and ended_at is null) then return; end if;
  if exists (select 1 from delegate_seat_claims where committee_id = v_room and country = p_country) then return; end if;
  -- Its history stays where it was earned: a seat that was ever present, or that the points ledger names, is kept.
  if exists (select 1 from delegate_status_log where committee_id = v_room and country = p_country and status <> 'absent') then return; end if;
  if exists (select 1 from messages where committee_id = v_room and sender = '__system__' and recipient = '__log__'
              and position(('"country":' || to_jsonb(p_country)::text) in content) > 0) then return; end if;
  begin
    delete from delegates where committee_id = v_room and country = p_country and status = 'absent';
  exception when others then null;  -- anything still pointing at the seat: keep it
  end;
end $$;
