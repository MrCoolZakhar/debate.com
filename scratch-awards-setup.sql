-- ============================================================
-- scratch-awards-setup.sql  (DRAFT, NOT APPLIED; 11 Oct 2026)
--
-- OPTIONAL hardening for the awards set-up gate. Nothing in the app NEEDS it:
-- checked read-only on 11 Oct 2026, no database function or constraint reads
-- a fixed list of award_type keys or the awards_config shape except
-- publish_conference_awards(), which reads only `requireApproval` (unchanged).
-- New keys (`most-improved`, `custom-*`) and the new fields (`setUp`,
-- `sameForAll`, `perCommittee`) therefore need no migration.
--
-- What this draft adds: the chair-side RLS also refuses a nomination when the
-- conference has not set awards up (`awards_config->>'setUp' = 'true'`), so the
-- owner's rule ("If a conference does not set up awards, never offer it to
-- chairs") holds even for a chair calling the API by hand. Today the gate is
-- in the UI only (src/lib/awards.ts awardsOfferedFor).
--
-- It changes exactly:
--   1. a new helper public.conference_awards_set_up(p_committee uuid)
--      (SECURITY DEFINER, search_path public, pg_temp; EXECUTE for authenticated)
--   2. the policy "Chairs nominate before lock" (INSERT): + the helper
--   3. submit_committee_awards: a chair (not an organiser) is refused with
--      'awards are not set up' when the helper is false
-- It does NOT touch organisers (they may still write anything), published rows,
-- the per-committee override (a committee whose own set gives nothing is still
-- insertable by API; the UI never offers it), or the 28 existing nominated rows.
-- Note: the eight conferences that saved the old settings screen have no
-- `setUp`, so their chairs could no longer insert until the organiser answers
-- the first question in Settings → Awards. That matches the UI.
-- ============================================================

begin;

create or replace function public.conference_awards_set_up(p_committee uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((c.awards_config->>'setUp')::boolean, false)
    from conference_committees cc
    join conferences c on c.id = cc.conference_id
   where cc.id = p_committee;
$$;
revoke all on function public.conference_awards_set_up(uuid) from public, anon;
grant execute on function public.conference_awards_set_up(uuid) to authenticated;

drop policy if exists "Chairs nominate before lock" on public.conference_awards;
create policy "Chairs nominate before lock" on public.conference_awards
  for insert
  with check (
    conference_committee_id is not null
    and is_committee_chair(conference_committee_id)
    and not committee_awards_locked(conference_committee_id)
    and coalesce(public.conference_awards_set_up(conference_committee_id), false)
    and status = 'nominated'
    and assigned_by = (select auth.uid())
  );

create or replace function public.submit_committee_awards(p_committee uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_conf uuid;
begin
  select conference_id into v_conf from conference_committees where id = p_committee;
  if v_conf is null then raise exception 'committee not found'; end if;
  if not (public.is_committee_chair(p_committee) or public.is_conference_organizer(v_conf)) then
    raise exception 'not authorised';
  end if;
  if not public.is_conference_organizer(v_conf)
     and not coalesce(public.conference_awards_set_up(p_committee), false) then
    raise exception 'awards are not set up';
  end if;
  if public.committee_awards_locked(p_committee) then
    raise exception 'slate is locked';
  end if;
  update conference_committees
     set awards_submitted_at = now(),
         awards_submitted_by = auth.uid(),
         awards_return_note = null
   where id = p_committee;
end $function$;

-- ── Rolled-back test ─────────────────────────────────────────────────────────
-- Picks any committee with a chair, impersonates that chair, and checks that an
-- insert is refused while awards are not set up and accepted once they are.
do $$
declare
  v_cc uuid; v_conf uuid; v_chair uuid; v_ok boolean;
begin
  select cc.id, cc.conference_id, cc.chair_user_ids[1]
    into v_cc, v_conf, v_chair
    from conference_committees cc
    join conferences c on c.id = cc.conference_id
   where cardinality(coalesce(cc.chair_user_ids, '{}')) > 0
     and c.awards_published_at is null and cc.awards_approved_at is null
   limit 1;
  if v_cc is null then raise notice 'no chaired committee to test'; return; end if;

  update conferences set awards_config = '{}'::jsonb where id = v_conf;
  perform set_config('request.jwt.claims', json_build_object('sub', v_chair, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    insert into conference_awards (conference_id, conference_committee_id, assigned_by, award_type, award_label, country_code, country_name, status)
    values (v_conf, v_cc, v_chair, 'best-delegate', 'Best Delegate', 'ZZ', 'Testland', 'nominated');
    raise exception 'FAIL: insert allowed while not set up';
  exception when insufficient_privilege then
    raise notice 'ok: refused while not set up';
  end;

  reset role;
  update conferences set awards_config = '{"setUp": true, "enabled": true, "sameForAll": true}'::jsonb where id = v_conf;
  set local role authenticated;
  insert into conference_awards (conference_id, conference_committee_id, assigned_by, award_type, award_label, country_code, country_name, status)
  values (v_conf, v_cc, v_chair, 'best-delegate', 'Best Delegate', 'ZZ', 'Testland', 'nominated');
  raise notice 'ok: accepted once set up';
  reset role;
end $$;

rollback;
-- To apply: replace the final `rollback;` with `commit;` and drop the DO block.
