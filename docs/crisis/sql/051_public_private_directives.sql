-- Part 51 (20 Nov 2026): public and private directives.
-- A crisis setting, settings.publicPrivateDirectives (default off). When it is on, a delegate marks every new directive
-- Public or Private, and the backroom, the Crisis Directors and the chairs see the mark on it. Off: nothing is asked and
-- visibility stays null. A send without a choice (an older page still open) is stored with no mark rather than refused.
-- Switched on for La Carrera Espacial, 1961 the same day (Peter).

alter table public.crisis_directives add column if not exists visibility text
  check (visibility is null or visibility in ('public', 'private'));

create or replace function public.crisis_submit_directive(p_crisis uuid, p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me public.crisis_members; c record; cab record; cooldown int; wlimit int; last_at timestamptz; nno int; cno int;
        did uuid; words int; owner uuid; k text; co uuid; needs_chair boolean; rid text; ex record; chst text; vis text;
begin
  me := public.crisis_me(p_crisis);
  if me.id is null or me.role <> 'delegate' then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  rid := nullif(btrim(coalesce(p ->> 'request_id', '')), '');
  if rid is not null then
    select id, no, cabinet_no, status into ex from public.crisis_directives where author_member_id = me.id and client_request_id = rid;
    if found then
      return jsonb_build_object('ok', true, 'id', ex.id, 'no', ex.no, 'cabinet_no', ex.cabinet_no, 'awaiting_chair', ex.status = 'awaiting_chair', 'repeat', true);
    end if;
  end if;
  select * into c from public.crises where id = p_crisis for update;
  if not c.directives_open then return jsonb_build_object('ok', false, 'reason', 'paused', 'note', c.directives_paused_note); end if;
  select * into cab from public.crisis_cabinets where id = me.cabinet_id;
  if found and not cab.directives_open then return jsonb_build_object('ok', false, 'reason', 'paused', 'note', cab.directives_paused_note); end if;
  select status into chst from public.crisis_characters where id = me.character_id;
  if chst in ('dead','arrested','missing') then return jsonb_build_object('ok', false, 'reason', 'inactive', 'status', chst); end if;
  cooldown := coalesce((c.settings ->> 'cooldownSeconds')::int, 180);
  wlimit := coalesce((c.settings ->> 'wordLimit')::int, 300);
  select max(created_at) into last_at from public.crisis_directives where author_member_id = me.id;
  if last_at is not null and cooldown > 0 and now() < last_at + make_interval(secs => cooldown) then
    return jsonb_build_object('ok', false, 'reason', 'cooldown',
      'wait_seconds', ceil(extract(epoch from (last_at + make_interval(secs => cooldown) - now())))::int);
  end if;
  words := public.crisis_word_count(p ->> 'body');
  if wlimit > 0 and words > wlimit then return jsonb_build_object('ok', false, 'reason', 'too_long', 'limit', wlimit); end if;
  k := coalesce(nullif(p ->> 'kind', ''), 'personal');
  -- Part 51: the Public / Private mark, only while the setting is on.
  vis := case when coalesce((c.settings ->> 'publicPrivateDirectives')::boolean, false) and p ->> 'visibility' in ('public', 'private')
              then p ->> 'visibility' end;
  needs_chair := k = 'committee'
    and coalesce((c.settings ->> 'chairApprovesCabinetDirectives')::boolean, true)
    and exists (select 1 from public.crisis_members x where x.crisis_id = p_crisis and x.role = 'chair' and x.cabinet_id = me.cabinet_id and (x.user_id is not null or x.last_seen_at is not null));
  nno := c.next_directive_no;
  update public.crises set next_directive_no = next_directive_no + 1 where id = p_crisis;
  if k = 'committee' then
    owner := public.crisis_cabinet_directive_assignee(p_crisis, me.character_id);
  else
    select owner_member_id into owner from public.crisis_characters where id = me.character_id;
  end if;
  insert into public.crisis_directives(crisis_id, no, kind, cabinet_id, author_member_id, author_character_id, title, receiver,
         themes, body, resources_used, goal, affects, covert, assigned_member_id, status, client_request_id, visibility)
  values (p_crisis, nno, k, me.cabinet_id, me.id, me.character_id, btrim(p ->> 'title'), nullif(btrim(coalesce(p ->> 'receiver', '')), ''),
          coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'themes', '[]'::jsonb))), '{}'),
          btrim(p ->> 'body'), nullif(btrim(p ->> 'resources_used'), ''), nullif(btrim(p ->> 'goal'), ''),
          nullif(btrim(p ->> 'affects'), ''), coalesce((p ->> 'covert')::boolean, true),
          case when needs_chair then null else owner end,
          case when needs_chair then 'awaiting_chair' else 'queued' end, rid, vis)
  returning id, cabinet_no into did, cno;
  if k = 'joint' then
    for co in select (jsonb_array_elements_text(coalesce(p -> 'coauthors', '[]'::jsonb)))::uuid loop
      insert into public.crisis_directive_coauthors(directive_id, character_id)
      select did, co where exists (select 1 from public.crisis_characters where id = co and crisis_id = p_crisis)
      on conflict do nothing;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'id', did, 'no', nno, 'cabinet_no', cno, 'awaiting_chair', needs_chair);
end $function$;
