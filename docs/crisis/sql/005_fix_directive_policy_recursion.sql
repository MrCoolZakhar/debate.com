-- Gavelling Crisis, part 5 (applied as crisis_part5_fix_directive_policy_recursion).
-- Found in the real-room test (25 Oct 2026): the directives policy read co-authors through RLS and the
-- co-authors policy read directives through RLS, so every directive read failed with 42P17.
create or replace function public.crisis_is_coauthor(p_directive uuid, p_crisis uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crisis_directive_coauthors ca
    where ca.directive_id = p_directive
      and ca.character_id = (public.crisis_me(p_crisis)).character_id)
$$;
grant execute on function public.crisis_is_coauthor(uuid, uuid) to anon, authenticated;

drop policy directives_read on public.crisis_directives;
create policy directives_read on public.crisis_directives for select using (
  (public.crisis_is_staff(crisis_id) and (public.crisis_can(crisis_id, 'seeAll') or assigned_member_id = (public.crisis_me(crisis_id)).id or assigned_member_id is null))
  or author_member_id = (public.crisis_me(crisis_id)).id
  or public.crisis_is_coauthor(id, crisis_id)
  or (public.crisis_role(crisis_id) = 'chair' and (kind in ('committee','communique','press_release')
      or coalesce((select (settings ->> 'chairReadsPersonal')::boolean from public.crises c where c.id = crisis_id), false)))
);
