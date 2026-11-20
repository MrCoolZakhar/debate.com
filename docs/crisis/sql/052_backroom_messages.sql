-- Part 52 (20 Nov 2026): delegates message the backroom, or one backroomer, outside a directive (Peter, during
-- La Carrera Espacial). One thread per delegate's character; the crisis team (directors, assistant directors, organisers,
-- backroomers) reads every thread and answers in it. A message to one backroomer is marked for them and notifies them.
-- Staff see a Messages tab with an unread count; read marks are per member and thread.
-- Every write goes through the two functions below (RLS: read only). Pinged on the crisis channel like every table.

create table if not exists public.crisis_backroom_messages (
  id uuid primary key default gen_random_uuid(),
  crisis_id uuid not null references public.crises(id) on delete cascade,
  character_id uuid not null references public.crisis_characters(id) on delete cascade,
  author_member_id uuid references public.crisis_members(id) on delete set null,
  from_staff boolean not null default false,
  to_member_id uuid references public.crisis_members(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists crisis_backroom_messages_thread on public.crisis_backroom_messages (crisis_id, character_id, created_at);

create table if not exists public.crisis_backroom_message_reads (
  member_id uuid not null references public.crisis_members(id) on delete cascade,
  character_id uuid not null references public.crisis_characters(id) on delete cascade,
  crisis_id uuid not null references public.crises(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (member_id, character_id)
);

alter table public.crisis_backroom_messages enable row level security;
alter table public.crisis_backroom_message_reads enable row level security;
drop policy if exists backroom_messages_read on public.crisis_backroom_messages;
create policy backroom_messages_read on public.crisis_backroom_messages for select
  using (public.crisis_is_staff(crisis_id) or character_id = (public.crisis_me(crisis_id)).character_id);
drop policy if exists backroom_message_reads_own on public.crisis_backroom_message_reads;
create policy backroom_message_reads_own on public.crisis_backroom_message_reads for select
  using (member_id = (public.crisis_me(crisis_id)).id);
grant select on public.crisis_backroom_messages, public.crisis_backroom_message_reads to anon, authenticated;

drop trigger if exists crisis_backroom_messages_ping on public.crisis_backroom_messages;
create trigger crisis_backroom_messages_ping after insert or update or delete on public.crisis_backroom_messages
  for each row execute function public.crisis_ping();
drop trigger if exists crisis_backroom_messages_no_hate on public.crisis_backroom_messages;
create trigger crisis_backroom_messages_no_hate before insert or update on public.crisis_backroom_messages
  for each row execute function public._crisis_block_hate('body');

alter table public.crisis_notifications drop constraint if exists crisis_notifications_kind_check;
alter table public.crisis_notifications add constraint crisis_notifications_kind_check
  check (kind = any (array['directive_answer','directive_new','directive_note','news','unit','reveal','territory','meeting','status','message']));

-- Who a delegate can write to: the crisis team, names and roles only.
create or replace function public.crisis_backroom_contacts(p_crisis uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare me public.crisis_members;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.display_name, 'role', m.role)
                     order by case m.role when 'director' then 0 when 'assistant_director' then 1 else 2 end, m.display_name)
                     from public.crisis_members m
                    where m.crisis_id = p_crisis and m.role in ('director','assistant_director','backroomer')), '[]'::jsonb);
end $function$;

create or replace function public.crisis_send_backroom_message(p_crisis uuid, p_body text, p_to_member uuid default null, p_character uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare me public.crisis_members; staff boolean; ch uuid; mid uuid; b text; owner uuid; chname text; recent int; m record;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  b := btrim(coalesce(p_body, ''));
  if b = '' then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  if char_length(b) > 2000 then return jsonb_build_object('ok', false, 'reason', 'too_long', 'limit', 2000); end if;
  staff := me.role in ('director','assistant_director','organiser','backroomer');
  if staff then
    ch := p_character;
    if ch is null or not exists (select 1 from public.crisis_characters where id = ch and crisis_id = p_crisis) then
      raise exception 'crisis_not_found' using errcode = 'P0002';
    end if;
    insert into public.crisis_backroom_messages(crisis_id, character_id, author_member_id, from_staff, body)
    values (p_crisis, ch, me.id, true, b) returning id into mid;
    -- The writer has read their own thread.
    insert into public.crisis_backroom_message_reads(member_id, character_id, crisis_id, read_at) values (me.id, ch, p_crisis, now())
      on conflict (member_id, character_id) do update set read_at = now();
    select name into chname from public.crisis_characters where id = ch;
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    select p_crisis, x.id, 'message', 'Message from the backroom', left(b, 600), 'messages', mid
      from public.crisis_members x where x.crisis_id = p_crisis and x.role = 'delegate' and x.character_id = ch;
  else
    if me.role <> 'delegate' or me.character_id is null then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
    ch := me.character_id;
    if p_to_member is not null and not exists (select 1 from public.crisis_members where id = p_to_member and crisis_id = p_crisis
         and role in ('director','assistant_director','backroomer')) then
      raise exception 'crisis_not_found' using errcode = 'P0002';
    end if;
    select count(*) into recent from public.crisis_backroom_messages
     where character_id = ch and not from_staff and created_at > now() - interval '5 minutes';
    if recent >= 10 then return jsonb_build_object('ok', false, 'reason', 'slow_down'); end if;
    insert into public.crisis_backroom_messages(crisis_id, character_id, author_member_id, from_staff, to_member_id, body)
    values (p_crisis, ch, me.id, false, p_to_member, b) returning id into mid;
    insert into public.crisis_backroom_message_reads(member_id, character_id, crisis_id, read_at) values (me.id, ch, p_crisis, now())
      on conflict (member_id, character_id) do update set read_at = now();
    select name, owner_member_id into chname, owner from public.crisis_characters where id = ch;
    -- To one person: them. To the backroom: the character's own backroomer, else the Crisis Directors.
    for m in select x.id from public.crisis_members x
              where x.crisis_id = p_crisis
                and ((p_to_member is not null and x.id = p_to_member)
                  or (p_to_member is null and owner is not null and x.id = owner)
                  or (p_to_member is null and owner is null and x.role in ('director','assistant_director'))) loop
      insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
      values (p_crisis, m.id, 'message', left('Message from ' || coalesce(chname, 'a delegate'), 200), left(b, 600), 'messages?c=' || ch, mid);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'id', mid);
end $function$;

create or replace function public.crisis_mark_backroom_read(p_crisis uuid, p_character uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare me public.crisis_members;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  if not (me.role in ('director','assistant_director','organiser','backroomer') or me.character_id = p_character) then
    raise exception 'crisis_forbidden' using errcode = '42501';
  end if;
  insert into public.crisis_backroom_message_reads(member_id, character_id, crisis_id, read_at) values (me.id, p_character, p_crisis, now())
    on conflict (member_id, character_id) do update set read_at = now();
end $function$;

revoke all on function public.crisis_backroom_contacts(uuid), public.crisis_send_backroom_message(uuid, text, uuid, uuid), public.crisis_mark_backroom_read(uuid, uuid) from public;
grant execute on function public.crisis_backroom_contacts(uuid), public.crisis_send_backroom_message(uuid, text, uuid, uuid), public.crisis_mark_backroom_read(uuid, uuid) to anon, authenticated;
