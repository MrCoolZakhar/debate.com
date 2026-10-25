-- Gavelling Crisis, part 3: content-free change pings (applied as crisis_part3_change_pings).
-- Every change to a crisis table sends {t, op, id} on the PUBLIC broadcast topic crisis:<crisis id>.
-- Pages re-read through RLS, so the ping never carries anything a viewer may not see, and it works
-- the same for account users and personal-code users (whose token header Realtime cannot see).
create or replace function public.crisis_ping() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid; rid text;
begin
  if tg_table_name = 'crises' then cid := coalesce(new.id, old.id);
  else cid := coalesce(new.crisis_id, old.crisis_id); end if;
  begin
    rid := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');
    perform realtime.send(jsonb_build_object('t', tg_table_name, 'op', lower(tg_op), 'id', rid), 'change', 'crisis:' || cid::text, false);
  exception when others then null;
  end;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['crises','crisis_cabinets','crisis_members','crisis_characters','crisis_character_secrets',
    'crisis_directives','crisis_directive_notes','crisis_news','crisis_resource_types','crisis_resources',
    'crisis_map_regions','crisis_units','crisis_shapes'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.crisis_ping()',
                   t || '_ping', t);
  end loop;
end $$;
