-- Gavelling Crisis part 44 (15 Nov 2026): the backroom can send more than one message on a directive.
-- HULTMUN backroomers (Prina, Felix): after approving a directive they could not write again under it; "Answer again" only
-- edited the first answer. The backroom pop-up now has "Message <delegate>" on an answered directive, which adds a visible
-- note (crisis_add_directive_note with p_internal false, unchanged). Until now a staff note told nobody: the notification
-- trigger only reported delegate and chair notes to staff. Now a visible staff note reaches the directive's side the same way
-- an answer does: its author, the co-authors of a joint directive and, on a cabinet directive, the cabinet's chair.

create or replace function public.crisis_notify_directive_note()
returns trigger language plpgsql security definer set search_path = public as $$
declare d record; target uuid; writer public.crisis_members; who text;
begin
  if new.internal then return new; end if;
  select * into d from public.crisis_directives where id = new.directive_id;
  select * into writer from public.crisis_members where id = new.member_id;
  if writer.id is null then return new; end if;
  if writer.role in ('director', 'assistant_director', 'backroomer') then
    -- A message from the backroom: the directive's side hears about it.
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    select d.crisis_id, m.id, 'directive_note', 'Backroom message on No. ' || coalesce(d.cabinet_no, d.no) || ': ' || left(d.title, 110), left(new.body, 600), '?d=' || d.id, d.id
      from public.crisis_members m
     where m.crisis_id = d.crisis_id and m.id <> writer.id
       and (m.id = d.author_member_id
        or m.character_id in (select character_id from public.crisis_directive_coauthors where directive_id = d.id)
        or (d.kind = 'committee' and m.role = 'chair' and m.cabinet_id = d.cabinet_id));
    return new;
  end if;
  target := coalesce(d.assigned_member_id, public.crisis_fallback_staff(d.crisis_id, d.author_character_id));
  if target is not null then
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    values (d.crisis_id, target, 'directive_note', 'Clarification on No. ' || coalesce(d.cabinet_no, d.no) || ': ' || left(d.title, 120), left(new.body, 600), 'directives?d=' || d.id, d.id);
  end if;
  if d.kind = 'committee' then
    who := case when writer.role = 'chair' then 'Your chair' else coalesce(writer.display_name, 'Your cabinet') end;
    insert into public.crisis_notifications(crisis_id, member_id, kind, title, body, link, ref_id)
    select d.crisis_id, m.id, 'directive_note', who || ' answered the backroom on No. ' || coalesce(d.cabinet_no, d.no) || ': ' || left(d.title, 100), left(new.body, 600), '?d=' || d.id, d.id
      from public.crisis_members m
     where m.crisis_id = d.crisis_id and m.id <> writer.id
       and (m.id = d.author_member_id
        or m.character_id in (select character_id from public.crisis_directive_coauthors where directive_id = d.id)
        or (m.role = 'chair' and m.cabinet_id = d.cabinet_id));
  end if;
  return new;
end $$;
