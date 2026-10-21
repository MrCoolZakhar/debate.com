-- scratch-admin-live-rooms.sql
-- DRAFT for the owners' chat (Supabase work). NOT APPLIED. Written 21 Oct 2026
-- for the admin Live committees tab (src/app/admin/LiveCommitteesTab.tsx,
-- LiveRoomView.tsx, liveRoomLoader.ts).
--
-- Three independent parts; each can be applied on its own.
--   1. Platform admins may broadcast to ANY live room, standalone included.
--      After it lands, set ADMIN_STANDALONE_BROADCAST_DB = true in
--      src/app/admin/LiveRoomView.tsx (conference rooms already work: platform
--      admins pass is_conference_organizer).
--   2. Platform admins may read the attendance timeline of a standalone room
--      (delegate_status_history admits only the session's chairs and the
--      conference's organisers today, so the opened standalone room's
--      Attendance tab shows the roll but no timeline).
--   3. Keep a room's origin when it is deleted: committee_analytics (the archive
--      written by archive_committee_before_delete) has no creator_country
--      column, so every origin is lost when the hourly job deletes a room.
--
-- Context: committees.creator_country is written since 21 Oct 2026 by
-- createCommittee (standalone rooms only; country code from our own /api/geo,
-- Vercel's header; no IP stored). anon/authenticated already hold INSERT on it.

begin;

-- ── 1. Broadcasts from platform admins ───────────────────────────────────────
-- Same shape as "Organizers send broadcasts" (source 'organiser', author_label
-- null) without the conference requirement. conference_id may be null (a
-- standalone room) or the room's conference. The organisers' policy is left
-- exactly as it is.
create policy "Platform admins send broadcasts"
  on public.session_broadcasts
  for insert
  to authenticated
  with check (
    public.is_platform_admin()
    and source = 'organiser'
    and author_label is null
    and exists (select 1 from public.committees c where c.id = committee_id)
  );

-- Let a platform admin withdraw a standalone send too (the organisers' DELETE
-- policy requires a conference). Optional; the admin view does not offer
-- withdraw today.
create policy "Platform admins manage broadcasts"
  on public.session_broadcasts
  for delete
  to authenticated
  using (public.is_platform_admin());

-- ── 2. Attendance timeline for platform admins ──────────────────────────────
create or replace function public.delegate_status_history(p_committee uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ok boolean;
begin
  v_ok := public.is_session_chair(p_committee)
    or public.is_platform_admin()
    or exists (
      select 1 from conference_committees cc
      where cc.session_id = p_committee
        and public.is_conference_organizer(cc.conference_id)
    );
  if not coalesce(v_ok, false) then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'delegate_id', l.delegate_id, 'country', l.country, 'status', l.status,
        'is_observer', l.is_observer, 'kind', l.kind, 'at', l.changed_at
      ) order by l.changed_at, l.id)
      from delegate_status_log l where l.committee_id = p_committee
    ), '[]'::jsonb),
    'since', (select min(changed_at) from delegate_status_log where committee_id = p_committee)
  );
end $function$;

-- ── 3. Origins survive deletion ─────────────────────────────────────────────
-- Proposal: add the column and copy OLD.creator_country in
-- archive_committee_before_delete. Shown as the two lines to change rather than
-- the whole function, so it is merged into whatever the live body is on the
-- day (read it first with pg_get_functiondef):
--
--   alter table public.committee_analytics add column if not exists creator_country text;
--
--   in the INSERT column list, after `end_reason`:   , creator_country
--   in the VALUES list,       after `v_end_reason`:  , OLD.creator_country
--
-- The function swallows its own errors, so a mistake here never blocks a
-- delete, but it would silently stop archiving: test with a rolled-back delete
-- of a throwaway room before committing.
alter table public.committee_analytics add column if not exists creator_country text;

-- Dry run first: rollback. Replace with commit once reviewed.
rollback;
