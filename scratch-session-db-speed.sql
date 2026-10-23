-- Sessions launch audit, items 6 and 17 (owner approved 23 Oct 2026). NOT APPLIED:
-- for the chat's Supabase work. Read-only checks behind each change are noted.

-- ── 6. The delegate seat heartbeat (claim_delegate_seat) ───────────────────────
-- claim_delegate_seat calls seat_claim_conference_committee on every heartbeat (about every
-- 30 s per delegate phone). Its WHERE is `session_id = c.id OR (session_id is null AND
-- upper(session_code) = upper(c.code))`; the planner answers the OR with a BitmapOr that reads
-- every unlinked committee (about 1,150 rows today) on every call. pg_stat_statements: about
-- 183k calls, mean 8 to 9 ms, max 3.4 s, three 3 s timeouts on 22 Oct.
--
-- Same answer, same preference (a linked committee wins over a code match), two index probes:

create or replace function public.seat_claim_conference_committee(p_committee uuid)
returns uuid
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (select cc.id from conference_committees cc
      where cc.session_id = p_committee
      limit 1),
    (select cc.id from conference_committees cc
       join committees c on c.id = p_committee
      where cc.session_id is null
        and upper(cc.session_code) = upper(c.code)
      limit 1)
  );
$function$;

-- The second probe needs this (the existing session_code indexes are on the raw column):
create index if not exists conference_committees_upper_code_unlinked
  on public.conference_committees (upper(session_code))
  where session_id is null;

-- Check: the plan should show two Index Scans and no BitmapOr.
-- explain select public.seat_claim_conference_committee('<a live committee id>');

-- ── 17. messages: index the way messages are read ─────────────────────────────
-- Every client read is `where committee_id = $1 order by created_at` (the room load and the
-- catch-up). The only index is (committee_id), so each read fetches all the room's rows and
-- sorts them. About 377k calls, mean 2.3 ms, max 2.2 s. The table is small today (session
-- tables together are under 40 MB), so a plain build takes seconds; use CONCURRENTLY (outside
-- a transaction) if it is run during a live conference.

create index if not exists messages_committee_created_idx
  on public.messages (committee_id, created_at, id);

-- The new index covers every lookup by committee_id, so the old one only costs writes:
drop index if exists public.idx_messages_committee_id;
