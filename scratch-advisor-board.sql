-- APPLIED 23 Oct 2026 from Claude Code at Peter's request (backfill: 312 rooms, 3,849 seats, group crests resolved).
-- ============================================================================
-- scratch-advisor-board.sql
--
-- NOT APPLIED. For the chat's Supabase work (CLAUDE.md: every database object is
-- changed only there, never from a Claude Code run). Written 23 Oct 2026 with the
-- faculty advisor board fixes (owner-approved the same day).
--
-- What it does: one CREATE OR REPLACE of my_advisor_delegation(), the read behind
-- /advisor and the advisor's Committees card. Two changes, nothing else:
--
--   1. It returns the conference's `timezone` and `datesTbd`, so the client gates the
--      live board on the conference's own first day without a second read. (Until this
--      is applied the client reads conferences.timezone / dates_tbd itself, anon, and
--      falls back to local midnight; see fetchMyAdvisorDelegation.)
--
--   2. The database enforces the owner's rule ("FAs shouldn't be looking at committees
--      if the conference hasn't started yet"): outside the conference's days (before
--      00:00 of start_date, or from 00:00 of the day after the last day, in the
--      conference's time zone, UTC when it has none or an unknown one), and while the
--      dates are to be decided, every seat's `sessionCode` is null and `rooms` is empty.
--      The seats themselves (committee, country, the student's name) still come back:
--      the Committees card lists the delegation's people before the conference.
--
-- The client works before and after: it already hides those rooms by the same rule
-- (src/lib/advisorBoard/conferenceWindow.ts) and reads `timezone` / `datesTbd` when
-- present. Known difference: without a conference time zone the client uses the
-- viewer's local midnight and this uses UTC midnight, so around midnight a room may
-- read "not open yet" for a few hours on one side.
--
-- Dry run: begin; <this file>; select public.my_advisor_delegation(); rollback;
-- (as an advisor, e.g. with set local request.jwt.claims).
-- ============================================================================

create or replace function public.my_advisor_delegation()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with me as (
    select auth.uid() as uid
  ),
  mine as (
    select a.conference_id, a.society_id, a.submitted_at, a.id as app_id,
      case
        when a.role = 'faculty-advisor' then 'faculty-advisor'
        when a.role = 'head-delegate' or a.is_head_delegate then 'head-delegate'
        else 'observer'
      end as my_role,
      case
        when a.role = 'faculty-advisor' then 1
        when a.role = 'head-delegate' or a.is_head_delegate then 2
        else 3
      end as prio
    from me
    join applications a on a.user_id = me.uid
    where a.status in ('accepted', 'assigned', 'checked-in')
      and (a.role in ('faculty-advisor', 'head-delegate', 'observer') or a.is_head_delegate)
  ),
  best as (
    -- One role per conference: advisor over head delegate over observer.
    select distinct on (m.conference_id)
      m.conference_id, m.my_role,
      case
        when m.my_role = 'observer' then null
        when m.society_id is not null then m.society_id
        when m.my_role = 'faculty-advisor' then (
          select s.id from societies s, me
          where s.conference_id = m.conference_id and s.advisor_user_id = me.uid
          order by s.created_at limit 1
        )
        else null
      end as society_id
    from mine m
    order by m.conference_id, m.prio, (m.society_id is null), m.submitted_at nulls last, m.app_id
  ),
  -- NEW: is the conference on today (its first day to its last day, in its own zone)?
  win as (
    select b.conference_id,
      coalesce(
        not coalesce(c.dates_tbd, false)
        and c.start_date is not null
        and now() >= (c.start_date::timestamp at time zone z.tz)
        and now() <  ((coalesce(c.end_date, c.start_date) + 1)::timestamp at time zone z.tz),
        false
      ) as is_open
    from best b
    join conferences c on c.id = b.conference_id
    cross join lateral (
      select case
        when c.timezone is not null and exists (select 1 from pg_timezone_names n where n.name = c.timezone)
          then c.timezone
        else 'UTC'
      end as tz
    ) z
  ),
  seats as (
    -- Allocations link to a society through their application (ca.society_id is set
    -- only on delegation block seats, which have no application).
    select b.conference_id,
      jsonb_agg(jsonb_build_object(
        -- NEW: no live room code outside the conference's days.
        'sessionCode', case when w.is_open then cm.code else null end,
        'committeeName', cc.name,
        'committeeAbbreviation', cc.abbreviation,
        'countryName', ca.country_name,
        'countryCode', ca.country_code,
        'seat', coalesce(ca.seat, 1),
        'studentName', coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(ap.invited_name), '')),
        'role', case when ap.is_head_delegate then 'head-delegate' else ap.role end
      ) order by cc.name, ca.country_name, ca.seat) as seats
    from best b
    join win w on w.conference_id = b.conference_id
    join conference_committees cc on cc.conference_id = b.conference_id
    join conference_allocations ca on ca.conference_committee_id = cc.id
    left join applications ap on ap.id = ca.application_id
    left join profiles p on p.id = coalesce(ap.user_id, ca.user_id)
    left join committees cm on cm.id = cc.session_id
    where b.society_id is not null
      and (ca.society_id = b.society_id or ap.society_id = b.society_id)
      and (ap.id is null or ap.status not in ('withdrawn', 'rejected'))
    group by b.conference_id
  ),
  rooms as (
    select b.conference_id,
      jsonb_agg(jsonb_build_object(
        'sessionCode', cm.code,
        'committeeName', cc.name,
        'committeeAbbreviation', cc.abbreviation
      ) order by cc.name) as rooms
    from best b
    -- NEW: rooms only while the conference is on.
    join win w on w.conference_id = b.conference_id and w.is_open
    join conference_committees cc on cc.conference_id = b.conference_id
    join committees cm on cm.id = cc.session_id
    where cm.code is not null
    group by b.conference_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'conferenceId', c.id,
      'conferenceName', c.full_name,
      'conferenceAcronym', c.acronym,
      'conferenceLogoUrl', c.logo_url,
      'conferenceSlug', c.slug,
      'startDate', c.start_date,
      'endDate', coalesce(c.end_date, c.start_date),
      -- NEW
      'timezone', c.timezone,
      'datesTbd', coalesce(c.dates_tbd, false),
      'myRole', b.my_role,
      'societyName', s.name,
      'seats', coalesce(st.seats, '[]'::jsonb),
      'rooms', coalesce(r.rooms, '[]'::jsonb),
      'verified', true
    ) order by c.start_date desc nulls last, c.full_name), '[]'::jsonb)
  from best b
  join conferences c on c.id = b.conference_id
  left join societies s on s.id = b.society_id
  left join seats st on st.conference_id = b.conference_id
  left join rooms r on r.conference_id = b.conference_id
  where (select uid from me) is not null;
$function$;
