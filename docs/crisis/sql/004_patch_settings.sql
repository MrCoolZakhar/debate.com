-- Gavelling Crisis, part 4 (applied as crisis_part4_patch_settings): key-level settings patch.
create or replace function public.crisis_patch_settings(p_crisis uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s jsonb;
begin
  if not public.crisis_is_director(p_crisis) then raise exception 'crisis_forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'crisis_bad_patch' using errcode = '22023'; end if;
  update public.crises set settings = coalesce(settings, '{}'::jsonb) || p_patch where id = p_crisis returning settings into s;
  return s;
end $$;
grant execute on function public.crisis_patch_settings(uuid, jsonb) to anon, authenticated;
