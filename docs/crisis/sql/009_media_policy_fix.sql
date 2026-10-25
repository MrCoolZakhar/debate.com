-- Gavelling Crisis, part 9 (applied as crisis_part9_media_policy_fix). The crisis-media insert policy
-- checked crises under RLS, which anon (personal-code staff; storage requests carry no crisis token)
-- cannot read, so every upload was refused. Found by the test-data run, 25 Oct 2026.
create or replace function public.crisis_exists(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crises where id::text = p_id)
$$;
grant execute on function public.crisis_exists(text) to anon, authenticated;

drop policy if exists crisis_media_insert on storage.objects;
create policy crisis_media_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'crisis-media' and public.crisis_exists((storage.foldername(name))[1]));
