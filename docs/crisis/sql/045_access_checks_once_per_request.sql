-- Gavelling Crisis part 45 (15 Nov 2026): "Could not load notifications" for many people at HULTMUN, again.
-- Cause: every crisis read checks access row by row, and each check ran crisis_me(), which parses the request headers, hashes
-- the personal code and scans the crisis's members (about 0.1 ms). The bell read checked every notification of the crisis
-- (3,900 at HULTMUN) for every reader: 1.3 s a read, 32,556 reads on 15 Nov (11.7 hours of database time), and every new
-- notification makes every open bell re-read. Directives, co-authors and notes paid the same per-row price. At peaks the
-- database ran out of time and connections, so the bell and other reads failed with timeouts.
--
-- 1. crisis_me() remembers, for the rest of the request (a transaction-local setting, like crisis_ping), which member it found.
--    The memory is keyed on the exact request headers, the sign-in claims and the crisis, so a different code or account never
--    reuses it, and the member row is re-read by id each time, so role, cabinet and character are always current. A lookup that
--    found nobody is not remembered (joining with a code in the same request still works).
-- 2. crisis_my_member_ids(): the caller's member in every crisis, with crisis_me's precedence (personal code, then a "Try it as"
--    view code, then the account). The notifications read rule uses it once per read instead of once per row.

-- Applied during a live conference: never queue behind a long read while holding the policy locks.
set local lock_timeout = '3s';

create or replace function public.crisis_me(p_crisis uuid)
returns public.crisis_members language plpgsql stable security definer set search_path = public, extensions as $$
declare h text; m public.crisis_members; k text; v text;
begin
  k := 'crisis.me_' || md5(coalesce(current_setting('request.headers', true), '') || '|'
                           || coalesce(current_setting('request.jwt.claims', true), '') || '|' || p_crisis::text);
  v := current_setting(k, true);
  if v is not null and v <> '' then
    select * into m from public.crisis_members where id = v::uuid and crisis_id = p_crisis;
    if found then return m; end if;
  end if;
  h := public.crisis_token_hash();
  if h is not null then
    select * into m from public.crisis_members where crisis_id = p_crisis and h = any(token_hashes) limit 1;
    if not found then
      select cm.* into m from public.crisis_view_tokens vt join public.crisis_members cm on cm.id = vt.member_id
       where vt.token_hash = h and vt.expires_at > now() and cm.crisis_id = p_crisis limit 1;
    end if;
  end if;
  if m.id is null and auth.uid() is not null then
    select * into m from public.crisis_members where crisis_id = p_crisis and user_id = auth.uid() limit 1;
  end if;
  if m.id is not null then perform set_config(k, m.id::text, true); end if;
  return m;
end $$;

create or replace function public.crisis_my_member_ids()
returns setof uuid language sql stable security definer set search_path = public, extensions as $$
  with h as (select public.crisis_token_hash() as h),
  cand as (
    select m.crisis_id, m.id, 1 as pr from public.crisis_members m, h where h.h is not null and h.h = any(m.token_hashes)
    union all
    select cm.crisis_id, cm.id, 2 from public.crisis_view_tokens vt join public.crisis_members cm on cm.id = vt.member_id, h
     where h.h is not null and vt.token_hash = h.h and vt.expires_at > now()
    union all
    select m.crisis_id, m.id, 3 from public.crisis_members m where auth.uid() is not null and m.user_id = auth.uid()
  )
  select distinct on (crisis_id) id from cand order by crisis_id, pr
$$;
revoke all on function public.crisis_my_member_ids() from public;
grant execute on function public.crisis_my_member_ids() to anon, authenticated;

drop policy if exists notifications_read on public.crisis_notifications;
create policy notifications_read on public.crisis_notifications for select
  using (member_id in (select public.crisis_my_member_ids()));

-- 3. Co-authors and directive notes were visible when "a directive exists that you can see", which the planner answered by
--    checking EVERY directive of every crisis on each read. crisis_directive_visible(id) asks the same question about the one
--    directive (an index lookup, the directives read rule applied unchanged, as the caller), so each row costs one lookup.
create or replace function public.crisis_directive_visible(p_directive uuid)
returns boolean language plpgsql stable security invoker set search_path = public as $$
begin
  return exists (select 1 from public.crisis_directives d where d.id = p_directive);
end $$;
revoke all on function public.crisis_directive_visible(uuid) from public;
grant execute on function public.crisis_directive_visible(uuid) to anon, authenticated;

drop policy if exists coauthors_read on public.crisis_directive_coauthors;
create policy coauthors_read on public.crisis_directive_coauthors for select
  using (public.crisis_directive_visible(directive_id));

drop policy if exists notes_read on public.crisis_directive_notes;
create policy notes_read on public.crisis_directive_notes for select
  using (public.crisis_directive_visible(directive_id) and ((not internal) or public.crisis_is_staff(crisis_id)));
