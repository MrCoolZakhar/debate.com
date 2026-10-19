-- ===========================================================================
-- scratch-admin-hide-listings.sql   (APPLIED 20 Oct 2026 as migrations admin_hide_listings_part1..part5; verification block passed)
--
-- Owner (Peter, 20 Oct 2026): "in the admin dashboard do not have these
-- conferences listed at all anywhere". A Gavelling listing is a `conferences`
-- row with listed_by = 'gavelling' (59 today, all owned by the Gavelling staff
-- account, which also holds a conference_organizers owner row for each).
-- conferences.listed_by is NOT NULL DEFAULT 'organiser', so
-- `listed_by = 'organiser'` is the exact complement.
--
-- Each function below is pg_get_functiondef() of the live definition with ONLY
-- the listed predicates added (byte-checked: md5 of every body here equals the
-- live body with exactly these replacements). Signatures, return types,
-- volatility, SECURITY DEFINER, search_path and grants are unchanged
-- (CREATE OR REPLACE keeps the ACL).
--
--   admin_conference_overview    where c.listed_by = 'organiser'
--   admin_conference_detail      ... and c.listed_by = 'organiser' (a listing id returns null;
--                                the dialog then says "This conference no longer exists.")
--   admin_live_committees        and (cf.id is null or cf.listed_by = 'organiser')
--                                (standalone rooms unaffected)
--   admin_pending_people         AND coalesce(c.listed_by, 'organiser') = 'organiser' in the
--                                applicant, chair-invite and organiser-invite branches
--                                (c is a LEFT JOIN there)
--   admin_user_directory         conferences_organised counts only organiser conferences
--                                (the staff account goes 59 -> 0)
--   admin_user_record            organised, applications, chair_roles, delegations, awards,
--                                recent payments, the session conference labels and the CV
--                                conference logo all skip listings
--   admin_activity_feed          AND c.listed_by = 'organiser' in the ten conference-joined
--                                branches (created, published, committee added, the four
--                                application kinds, payment, request, review); today 195 of
--                                the newest 200 events are listing rows
--   admin_platform_metrics       v_active, conferences_created (24 h), the created and
--                                published series, total, public, private, verified,
--                                created_24h, countries, cities
--   admin_email_campaign_report  the created_conference conversion skips listings
--   platform_intent_mix          WHERE conf.listed_by = 'organiser' (feeds the Data tab's
--                                intent mix). NOTE: compose_daily_platform_report also reads
--                                this helper, so the 13:00 email's intent mix drops listings
--                                too. Leave this block out if the email should keep them.
--
-- Not changed, and why:
--   admin_site_traffic      spotlights join conferences, but a listing can never be booked
--                           (trigger trg_guard_listing_spotlight_booking); page views are
--                           stored by path bucket ('conference'), never by slug
--   admin_user_origin       shows no conference, only a user's estimated country from their
--                           applications; listings take no applications (0 today)
--   admin_data_lists        no conference source (conference_request enquiries show the
--                           person and subject only; 0 on listings)
--   admin_paid_announcements a review queue; hiding a row would strand a request; listings
--                           have none (0)
--   admin_user_detail       not called by the client (UserDetailDialog uses admin_user_record)
--   admin_update_conference / admin_delete_conference / admin_email_conference_organisers
--                           act on an id the dashboard no longer offers for a listing
--
-- Rolled-back run on 20 Oct 2026 (the edited bodies executed inside a DO block that
-- ended in RAISE EXCEPTION, impersonating a platform admin):
--   overview 396 -> 337 (= 396 - 59); metrics total 396 -> 337, public 115 -> 115,
--   private 278 -> 222, verified 21 -> 21, active 234 -> 178, intent_total 396 -> 337;
--   staff account organised: record 59 -> 0, directory 59 -> 0; activity feed listing
--   events in the newest 200: 195 -> 0; admin_conference_detail(listing) -> null.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- admin_conference_overview
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_conference_overview()
 RETURNS TABLE(id uuid, slug text, acronym text, full_name text, is_public boolean, status text, dates_tbd boolean, start_date date, end_date date, city text, country text, expected_delegates integer, seat_capacity integer, setup_done integer, setup_total integer, setup_complete boolean, pending_keys text[], committees integer, chairs_missing integer, applications integer, paid_applications integer, organizer_name text, organizer_email text, created_at timestamp with time zone, updated_at timestamp with time zone, last_nudge_at timestamp with time zone, intent jsonb, is_verified boolean, verified_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorised';
  end if;

  return query
  select
    c.id, c.slug, c.acronym, c.full_name,
    c.is_public, c.status, c.dates_tbd,
    c.start_date, c.end_date, c.city, c.country,
    coalesce(c.expected_delegates, 0)::int,
    coalesce((s->>'seat_capacity')::int, 0),
    coalesce((s->>'setup_done')::int, 0),
    coalesce((s->>'setup_total')::int, 7),
    coalesce((s->>'setup_complete')::boolean, false),
    coalesce((select array_agg(i->>'key' order by ord)
                from jsonb_array_elements(s->'items') with ordinality as t(i, ord)
               where not (i->>'done')::boolean), '{}'::text[]),
    (select count(*)::int from conference_committees cc where cc.conference_id = c.id),
    (select count(*)::int from conference_committees cc
      where cc.conference_id = c.id
        and (cc.chair_user_ids is null or cardinality(cc.chair_user_ids) = 0)),
    (select count(*)::int from applications a where a.conference_id = c.id),
    (select count(distinct i.application_id)::int from invoices i join payments pay on pay.invoice_id = i.id
      where i.conference_id = c.id and pay.status = 'succeeded'),
    p.display_name, p.email,
    c.created_at, c.updated_at,
    (select max(n.sent_at) from conference_setup_nudges n where n.conference_id = c.id),
    coalesce(c.intent, '{}'::jsonb),
    coalesce(c.is_verified, false),
    c.verified_at
  from conferences c
  left join profiles p on p.id = c.organizer_id
  cross join lateral public.conference_setup_status(c.id) as s
  where c.listed_by = 'organiser'
  order by c.is_public, c.updated_at desc;
end;
$function$
;

-- ---------------------------------------------------------------------------
-- admin_conference_detail
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_conference_detail(p_conference_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v jsonb; s jsonb;
begin
  if not public.is_platform_admin() then raise exception 'not authorised'; end if;

  -- The organiser's own checklist: seven stages, which are exactly the seven
  -- verification keys (v_ver_keys) of conference_setup_status().
  s := public.conference_setup_status(p_conference_id);

  select jsonb_build_object(
    'conference', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'full_name', c.full_name, 'acronym', c.acronym,
      'start_date', c.start_date, 'end_date', c.end_date, 'dates_tbd', c.dates_tbd,
      'city', c.city, 'country', c.country, 'format', c.format,
      'contact_email', c.contact_email, 'website_url', c.website_url,
      'expected_delegates', c.expected_delegates,
      'is_public', c.is_public, 'status', c.status, 'published_at', c.published_at,
      'is_verified', c.is_verified, 'verified_at', c.verified_at,
      'is_demo', c.is_demo, 'logo_url', c.logo_url,
      'payment_method', c.payment_method, 'connect_onboarding_status', c.connect_onboarding_status,
      'created_at', c.created_at, 'updated_at', c.updated_at
    ),
    'setup', jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('key', i->>'key', 'title', i->>'title',
                                            'done', (i->>'done')::boolean, 'todo', i->>'todo')
                         order by ord)
          from jsonb_array_elements(s->'items') with ordinality t(i, ord)
         where (i->>'key') in (select jsonb_array_elements_text(s->'verification_keys'))), '[]'::jsonb),
      'seat_capacity', coalesce((s->>'seat_capacity')::int, 0),
      'required_seats', coalesce((s->>'required_seats')::int, 0),
      'minutes_left', coalesce((s->>'verification_minutes_left')::int, 0)
    ),
    'organisers', coalesce((
      select jsonb_agg(o order by (o->>'is_owner')::boolean desc, o->>'display_name')
      from (
        select jsonb_build_object(
          'user_id', p.id, 'display_name', p.display_name, 'email', p.email,
          'avatar_url', p.avatar_url,
          'role', case when p.id = c.organizer_id then 'owner' else coalesce(co.role, 'organizer') end,
          'is_owner', p.id = c.organizer_id
        ) o
        from profiles p
        left join conference_organizers co on co.conference_id = c.id and co.user_id = p.id
        where p.id = c.organizer_id
           or p.id in (select user_id from conference_organizers where conference_id = c.id)
      ) x), '[]'::jsonb),
    'counts', jsonb_build_object(
      'applications', (select count(*) from applications a where a.conference_id = c.id),
      'submitted', (select count(*) from applications a where a.conference_id = c.id and a.status = 'submitted'),
      'accepted', (select count(*) from applications a where a.conference_id = c.id
                    and a.status in ('accepted','assigned','checked-in')),
      'rejected', (select count(*) from applications a where a.conference_id = c.id and a.status = 'rejected'),
      'withdrawn', (select count(*) from applications a where a.conference_id = c.id and a.status = 'withdrawn'),
      'paid', (select count(distinct i.application_id) from invoices i join payments p on p.invoice_id = i.id
                where i.conference_id = c.id and p.status = 'succeeded'),
      'allocations', (select count(*) from conference_allocations al where al.conference_id = c.id),
      'committees', (select count(*) from conference_committees cc where cc.conference_id = c.id),
      'live_sessions', (select count(*) from conference_committees cc
                          where cc.conference_id = c.id and cc.session_id is not null),
      'invoices', (select count(*) from invoices i where i.conference_id = c.id)
    ),
    'money', public.conference_money_summary(c.id),
    'fees', coalesce((
      select jsonb_agg(jsonb_build_object('role', f.role, 'amount', f.fee_amount, 'currency', f.fee_currency)
                       order by f.role)
      from conference_public_fees f where f.conference_id = c.id), '[]'::jsonb)
  ) into v
  from conferences c where c.id = p_conference_id and c.listed_by = 'organiser';

  return v;
end $function$
;

-- ---------------------------------------------------------------------------
-- admin_live_committees
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_live_committees(p_window_hours integer DEFAULT 24, p_min_lifespan_minutes integer DEFAULT 30)
 RETURNS TABLE(id uuid, code text, name text, topic text, phase text, chair_names text[], caucus jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, suspended_at timestamp with time zone, expires_at timestamp with time zone, session_origin text, active_minutes integer, idle_minutes integer, suspended boolean, speaker_country text, speaker_started_at timestamp with time zone, speaker_time_remaining integer, delegates_total integer, delegates_present integer, gsl_queue integer, caucus_queue integer, pending_motions integer, documents_total integer, creator_country text, conference_id uuid, conference_slug text, conference_acronym text, conference_name text, conference_city text, conference_country text, committee_abbreviation text, committee_logo_url text, conference_start_date date, conference_logo_url text, speaker_time_granted integer, gsl_next text[], caucus_next text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorised';
  end if;

  return query
  select
    c.id, c.code, c.name, coalesce(c.topic, ''), c.phase,
    coalesce(c.chair_names, '{}'::text[]), c.caucus,
    c.created_at, c.updated_at, c.suspended_at, c.expires_at,
    coalesce(c.session_origin, 'standalone'),
    round(extract(epoch from (c.updated_at - c.created_at)) / 60)::int,
    round(extract(epoch from (now() - c.updated_at)) / 60)::int,
    (c.suspended_at is not null),
    cs.country, cs.started_at, coalesce(cs.time_remaining, 0),
    (select count(*)::int from delegates d where d.committee_id = c.id),
    (select count(*)::int from delegates d where d.committee_id = c.id and d.status <> 'absent'),
    (select count(*)::int from speakers_list s where s.committee_id = c.id and s.list_type = 'gsl'),
    (select count(*)::int from speakers_list s where s.committee_id = c.id and s.list_type = 'caucus'),
    (select count(*)::int from motions mo where mo.committee_id = c.id and mo.status = 'pending'
        and mo.type not in ('join-request', 'gsl-request')),
    (select count(*)::int from documents dd where dd.committee_id = c.id),
    c.creator_country,
    cf.id, cf.slug, cf.acronym, cf.full_name, cf.city, cf.country,
    cc.abbreviation, cc.logo_url,
    cf.start_date,
    cf.logo_url,
    cs.time_granted,
    -- RULE 1: the two lists stay separate, ordered like every queue read.
    coalesce((select array_agg(q.country order by q.position, q.created_at, q.id)
                from (select s.country, s.position, s.created_at, s.id from speakers_list s
                       where s.committee_id = c.id and s.list_type = 'gsl'
                       order by s.position, s.created_at, s.id limit 10) q), '{}'::text[]),
    coalesce((select array_agg(q.country order by q.position, q.created_at, q.id)
                from (select s.country, s.position, s.created_at, s.id from speakers_list s
                       where s.committee_id = c.id and s.list_type = 'caucus'
                       order by s.position, s.created_at, s.id limit 10) q), '{}'::text[])
  from public.committees c
  left join public.current_speaker cs on cs.committee_id = c.id
  left join lateral (
    select x.abbreviation, x.logo_url, x.conference_id
      from public.conference_committees x
     where x.session_id = c.id or x.session_code = c.code
     order by (x.session_id = c.id) desc
     limit 1
  ) cc on true
  left join public.conferences cf on cf.id = cc.conference_id
  where c.ended_at is null
    and (cf.id is null or cf.listed_by = 'organiser')
    and c.updated_at >= now() - make_interval(hours => p_window_hours)
    and (c.updated_at - c.created_at) > make_interval(mins => p_min_lifespan_minutes)
  order by c.updated_at desc;
end;
$function$
;

-- ---------------------------------------------------------------------------
-- admin_pending_people
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_pending_people(p_search text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id text, kind text, email text, name text, conference_name text, conference_slug text, detail text, created_at timestamp with time zone, has_account boolean, total_count bigint, kind_counts jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_q    text := nullif(btrim(coalesce(p_search, '')), '');
  v_kind text := nullif(btrim(coalesce(p_kind, '')), '');
  v_lim  int  := greatest(1, least(coalesce(p_limit, 50), 200));
  v_off  int  := greatest(0, coalesce(p_offset, 0));
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  RETURN QUERY
  WITH raw AS (
    -- Imported or invited applicants who never claimed their application.
    SELECT
      'application:' || a.id::text            AS r_id,
      'applicant'::text                       AS r_kind,
      a.invited_email                         AS r_email,
      nullif(btrim(coalesce(a.invited_name, '')), '') AS r_name,
      coalesce(c.full_name, c.acronym)        AS r_conf,
      c.slug                                  AS r_slug,
      nullif(btrim(coalesce(a.role, '') || CASE WHEN a.status IS NOT NULL THEN ' · ' || a.status ELSE '' END), '') AS r_detail,
      a.submitted_at                          AS r_at
    FROM applications a
    LEFT JOIN conferences c ON c.id = a.conference_id
    WHERE a.user_id IS NULL
      AND a.invited_email IS NOT NULL
      AND coalesce(c.is_demo, false) = false
      AND coalesce(c.listed_by, 'organiser') = 'organiser'

    UNION ALL

    SELECT
      'chair:' || ci.id::text,
      'chair',
      ci.email,
      nullif(btrim(coalesce(ci.invited_name, '')), ''),
      coalesce(c.full_name, c.acronym),
      c.slug,
      nullif(btrim(coalesce(cc.abbreviation, cc.name, '')), ''),
      ci.created_at
    FROM conference_chair_invites ci
    LEFT JOIN conferences c ON c.id = ci.conference_id
    LEFT JOIN conference_committees cc ON cc.id = ci.committee_id
    WHERE ci.status = 'pending'
      AND coalesce(c.is_demo, false) = false
      AND coalesce(c.listed_by, 'organiser') = 'organiser'

    UNION ALL

    SELECT
      'organiser:' || oi.id::text,
      'organiser',
      oi.email,
      NULL,
      coalesce(c.full_name, c.acronym),
      c.slug,
      nullif(btrim(coalesce(oi.public_title, oi.bundle, '')), ''),
      oi.created_at
    FROM conference_organizer_invites oi
    LEFT JOIN conferences c ON c.id = oi.conference_id
    WHERE oi.status = 'pending'
      AND coalesce(c.is_demo, false) = false
      AND coalesce(c.listed_by, 'organiser') = 'organiser'

    UNION ALL

    SELECT
      'prereg:' || pr.id::text,
      'prereg',
      pr.email,
      NULL,
      NULL,
      NULL,
      CASE WHEN pr.invited_at IS NOT NULL THEN 'Invited' ELSE 'Not invited yet' END,
      pr.created_at
    FROM pre_registrations pr
  ), unregistered AS (
    -- The list means "exists but has not registered". Someone with an account
    -- is not pending, whatever their invite row still says.
    SELECT r.*
    FROM raw r
    WHERE r.r_email IS NOT NULL
      AND r.r_email NOT ILIKE '%@example.com'
      AND NOT EXISTS (
        SELECT 1 FROM profiles p WHERE lower(p.email) = lower(r.r_email)
      )
  ), searched AS (
    SELECT u.*, false AS r_has_account
    FROM unregistered u
    WHERE v_q IS NULL
       OR u.r_email ILIKE '%' || v_q || '%'
       OR u.r_name  ILIKE '%' || v_q || '%'
       OR u.r_conf  ILIKE '%' || v_q || '%'
  ), counts AS (
    SELECT coalesce(jsonb_object_agg(k.r_kind, k.n), '{}'::jsonb)
             || jsonb_build_object('all', (SELECT count(*) FROM searched)) AS j
    FROM (SELECT s.r_kind, count(*) AS n FROM searched s GROUP BY s.r_kind) k
  ), counted AS (
    SELECT s.*, count(*) OVER () AS r_total
    FROM searched s
    WHERE v_kind IS NULL OR s.r_kind = v_kind
  )
  SELECT
    c2.r_id, c2.r_kind, c2.r_email, c2.r_name, c2.r_conf, c2.r_slug,
    c2.r_detail, c2.r_at, c2.r_has_account, c2.r_total,
    (SELECT j FROM counts)
  FROM counted c2
  ORDER BY c2.r_at DESC NULLS LAST, c2.r_id
  LIMIT v_lim OFFSET v_off;
END;
$function$
;

-- ---------------------------------------------------------------------------
-- admin_user_directory
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_directory(p_search text DEFAULT NULL::text, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, display_name text, email text, avatar_url text, nationality text, education_level text, mun_experience_level text, is_demo boolean, is_ambassador boolean, is_admin boolean, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, applications integer, conferences_organised integer, cv_entries integer, paid_total numeric, total_count bigint, date_of_birth date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_q   text := nullif(btrim(coalesce(p_search, '')), '');
  v_lim int  := greatest(1, least(coalesce(p_limit, 50), 200));
  v_off int  := greatest(0, coalesce(p_offset, 0));
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT pr.*, au.last_sign_in_at AS lsi
      FROM profiles pr
      LEFT JOIN auth.users au ON au.id = pr.id
     WHERE v_q IS NULL
        OR pr.display_name ILIKE '%' || v_q || '%'
        OR pr.email        ILIKE '%' || v_q || '%'
        OR pr.id::text     ILIKE v_q || '%'
  ), counted AS (
    SELECT b.*,
      (SELECT count(*) FROM applications a WHERE a.user_id = b.id)::int AS apps,
      (SELECT count(DISTINCT co.conference_id) FROM conference_organizers co JOIN conferences cf ON cf.id = co.conference_id WHERE co.user_id = b.id AND cf.listed_by = 'organiser')::int AS orgs,
      (SELECT count(*) FROM mun_cv_entries e WHERE e.user_id = b.id)::int AS cvs,
      (SELECT coalesce(sum(a.amount_paid), 0) FROM applications a WHERE a.user_id = b.id) AS paid,
      count(*) OVER () AS total
    FROM base b
  )
  SELECT
    c.id, c.display_name, c.email, c.avatar_url,
    c.nationality, c.education_level, c.mun_experience_level,
    c.is_demo, c.is_ambassador,
    EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = c.id),
    c.created_at, c.lsi,
    c.apps, c.orgs, c.cvs, c.paid, c.total,
    c.date_of_birth
  FROM counted c
  ORDER BY
    CASE WHEN p_sort = 'name'         THEN lower(c.display_name) END ASC,
    CASE WHEN p_sort = 'applications' THEN c.apps                END DESC,
    CASE WHEN p_sort = 'oldest'       THEN c.created_at          END ASC,
    CASE WHEN p_sort = 'active'       THEN c.lsi                 END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest'       THEN c.created_at          END DESC,
    c.created_at DESC
  LIMIT v_lim OFFSET v_off;
END;
$function$
;

-- ---------------------------------------------------------------------------
-- admin_user_record
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_record(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorised';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'display_name', p.display_name, 'email', p.email,
      'avatar_url', p.avatar_url, 'bio', p.bio, 'nationality', p.nationality,
      'date_of_birth', p.date_of_birth,
      'education_level', p.education_level, 'mun_experience_level', p.mun_experience_level,
      'created_at', p.created_at,
      'last_sign_in_at', (select au.last_sign_in_at from auth.users au where au.id = p.id),
      'is_demo', p.is_demo, 'is_ambassador', p.is_ambassador,
      'pre_registered', p.pre_registered,
      'is_admin', exists (select 1 from platform_admins pa where pa.user_id = p.id),
      'points_balance', p.points_balance,
      'credits_remaining', coalesce((
        select sum(cl.remaining) from credit_lots cl
         where cl.user_id = p.id
           and (cl.expires_at is null or cl.expires_at > now())), 0),
      'credits_bought', coalesce((
        select sum(cl.amount) from credit_lots cl
         where cl.user_id = p.id and cl.source = 'purchase'), 0),
      'credits_used', (select count(*) from credit_consumptions cc
                        where cc.user_id = p.id and cc.refunded_at is null),
      'unlimited', (
        select jsonb_build_object('plan', s.plan, 'status', s.status,
                                  'current_period_end', s.current_period_end)
          from subscriptions s
         where s.owner_user_id = p.id
           and s.conference_id is null
           and s.plan like 'unlimited%'
           and s.status in ('active', 'trialing')
           and (s.current_period_end is null or s.current_period_end > now())
         order by s.current_period_end desc nulls first
         limit 1)
    ),

    'organised', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'full_name', c.full_name, 'acronym', c.acronym,
        'logo_url', c.logo_url, 'country', c.country, 'city', c.city,
        'start_date', c.start_date, 'end_date', c.end_date, 'dates_tbd', c.dates_tbd,
        'is_public', c.is_public, 'is_verified', c.is_verified, 'is_demo', c.is_demo,
        'role', case when c.organizer_id = p.id then 'owner' else coalesce(co.role, 'organizer') end,
        'intent', c.intent,
        'created_at', c.created_at,
        'applications', (select count(*) from applications a2 where a2.conference_id = c.id),
        'committees', (select count(*) from conference_committees k where k.conference_id = c.id)
      ) order by c.created_at desc)
      from conferences c
      left join conference_organizers co on co.conference_id = c.id and co.user_id = p.id
      where c.listed_by = 'organiser'
        and (c.organizer_id = p.id or co.user_id = p.id)), '[]'::jsonb),

    'applications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'conference_id', c.id, 'slug', c.slug,
        'conference', coalesce(nullif(btrim(c.acronym), ''), c.full_name),
        'conference_full', c.full_name, 'logo_url', c.logo_url,
        'role', a.role, 'status', a.status, 'payment_status', a.payment_status,
        'is_head_delegate', a.is_head_delegate,
        'submitted_at', a.submitted_at,
        'committee', coalesce(nullif(btrim(k.abbreviation), ''), k.name),
        'committee_full', k.name, 'committee_logo', k.logo_url,
        'country_name', coalesce(al.country_name, a.assigned_country_name),
        'country_code', coalesce(al.country_code, a.assigned_country_code),
        'society', s.name
      ) order by a.submitted_at desc nulls last)
      from applications a
      join conferences c on c.id = a.conference_id
      left join lateral (
        select x.* from conference_allocations x
         where x.application_id = a.id
            or (x.user_id = p.id and x.conference_id = a.conference_id)
         order by (x.application_id = a.id) desc, x.seat nulls last
         limit 1) al on true
      left join conference_committees k on k.id = coalesce(al.conference_committee_id, a.assigned_committee_id)
      left join societies s on s.id = a.society_id
      where a.user_id = p.id and c.listed_by = 'organiser'), '[]'::jsonb),

    'chair_roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'committee', coalesce(nullif(btrim(k.abbreviation), ''), k.name),
        'committee_full', k.name, 'committee_logo', k.logo_url,
        'conference', coalesce(nullif(btrim(c.acronym), ''), c.full_name),
        'conference_logo', c.logo_url, 'slug', c.slug,
        'session_code', k.session_code,
        'room_phase', r.phase, 'room_ended_at', r.ended_at,
        'awards_submitted_at', k.awards_submitted_at
      ) order by c.start_date desc nulls last, k.name)
      from conference_committees k
      join conferences c on c.id = k.conference_id
      left join committees r on r.id = k.session_id
      where p.id = any(k.chair_user_ids) and c.listed_by = 'organiser'), '[]'::jsonb),

    'sessions', coalesce((
      select jsonb_agg(t.j order by t.sort_at desc) from (
        select jsonb_build_object(
          'committee_id', r.id, 'code', r.code, 'name', r.name, 'topic', r.topic,
          'origin', coalesce(r.session_origin, 'standalone'), 'phase', r.phase,
          'created_at', r.created_at, 'ended_at', r.ended_at,
          'as', 'chair', 'country', null::text,
          'first_seen', cdc.claimed_at, 'last_seen', cdc.last_seen_at,
          'delegates', (select count(*) from delegates d where d.committee_id = r.id),
          'conference', (select coalesce(nullif(btrim(c.acronym), ''), c.full_name)
                           from conference_committees k join conferences c on c.id = k.conference_id
                          where k.session_id = r.id and c.listed_by = 'organiser' limit 1),
          'conference_logo', (select c.logo_url
                           from conference_committees k join conferences c on c.id = k.conference_id
                          where k.session_id = r.id and c.listed_by = 'organiser' limit 1)
        ) as j, cdc.claimed_at as sort_at
        from chair_device_claims cdc
        join committees r on r.id = cdc.committee_id
        where cdc.user_id = p.id
        union all
        select jsonb_build_object(
          'committee_id', r.id, 'code', r.code, 'name', r.name, 'topic', r.topic,
          'origin', coalesce(r.session_origin, 'standalone'), 'phase', r.phase,
          'created_at', r.created_at, 'ended_at', r.ended_at,
          'as', 'delegate', 'country', sc.country,
          'first_seen', sc.claimed_at, 'last_seen', sc.last_seen_at,
          'delegates', (select count(*) from delegates d where d.committee_id = r.id),
          'conference', (select coalesce(nullif(btrim(c.acronym), ''), c.full_name)
                           from conference_committees k join conferences c on c.id = k.conference_id
                          where k.session_id = r.id and c.listed_by = 'organiser' limit 1),
          'conference_logo', (select c.logo_url
                           from conference_committees k join conferences c on c.id = k.conference_id
                          where k.session_id = r.id and c.listed_by = 'organiser' limit 1)
        ) as j, sc.claimed_at as sort_at
        from delegate_seat_claims sc
        join committees r on r.id = sc.committee_id
        where sc.holder_key = 'u:' || p.id::text
      ) t), '[]'::jsonb),

    'delegations', coalesce((
      select jsonb_agg(t.j order by t.sort_at desc) from (
        select jsonb_build_object(
          'id', s.id, 'name', s.name,
          'conference', coalesce(nullif(btrim(c.acronym), ''), c.full_name),
          'conference_logo', c.logo_url, 'slug', c.slug,
          'is_advisor', s.advisor_user_id = p.id,
          'is_head', exists (select 1 from applications a where a.society_id = s.id
                               and a.user_id = p.id and a.is_head_delegate),
          'members', (select count(*) from applications a where a.society_id = s.id),
          'spots_purchased', s.spots_purchased
        ) as j, s.created_at as sort_at
        from societies s
        join conferences c on c.id = s.conference_id
        where c.listed_by = 'organiser'
          and (s.advisor_user_id = p.id
           or exists (select 1 from applications a where a.society_id = s.id and a.user_id = p.id))
      ) t), '[]'::jsonb),

    'cv_entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'entry_type', t.entry_type, 'conference_name', t.conference_name,
        'committee', t.committee, 'allocation', t.allocation, 'awards', t.awards,
        'award', t.award, 'source', t.source, 'logo_url', t.logo_url,
        'conference_logo', (select c.logo_url from conferences c where c.id = t.conference_id and c.listed_by = 'organiser'),
        'event_date', t.event_date, 'created_at', t.created_at
      ) order by coalesce(t.event_date::timestamptz, t.created_at) desc)
      from (select e.* from mun_cv_entries e
             where e.user_id = p.id
             order by coalesce(e.event_date::timestamptz, e.created_at) desc
             limit 100) t), '[]'::jsonb),

    'awards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'label', coalesce(w.award_label, w.award_type), 'status', w.status,
        'country_name', w.country_name, 'country_code', w.country_code,
        'committee', coalesce(nullif(btrim(k.abbreviation), ''), k.name),
        'conference', coalesce(nullif(btrim(c.acronym), ''), c.full_name),
        'conference_logo', c.logo_url, 'slug', c.slug,
        'points', w.points_awarded, 'published_at', w.published_at
      ) order by w.created_at desc)
      from conference_awards w
      join conferences c on c.id = w.conference_id
      left join conference_committees k on k.id = w.conference_committee_id
      where w.user_id = p.id and c.listed_by = 'organiser'), '[]'::jsonb),

    -- Payments ledger, never payment_status (CLAUDE.md §3). Invoices billed to
    -- one of this account's applications.
    'payments', jsonb_build_object(
      'by_currency', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', t.currency, 'stripe_cents', t.stripe_cents,
          'offline_cents', t.offline_cents, 'pending', t.pending) order by t.currency)
        from (
          select upper(coalesce(py.currency, 'usd')) currency,
                 sum(py.amount_cents) filter (where py.status = 'succeeded' and py.method = 'stripe') stripe_cents,
                 sum(py.amount_cents) filter (where py.status = 'succeeded' and py.method <> 'stripe') offline_cents,
                 count(*) filter (where py.status = 'pending') pending
            from payments py
            join invoices i on i.id = py.invoice_id
            join applications a on a.id = i.application_id
           where a.user_id = p.id
           group by 1) t), '[]'::jsonb),
      'recent', coalesce((
        select jsonb_agg(t.j order by t.sort_at desc) from (
          select jsonb_build_object(
            'id', py.id, 'amount_cents', py.amount_cents, 'currency', upper(coalesce(py.currency, 'usd')),
            'status', py.status, 'method', py.method, 'created_at', py.created_at,
            'conference', coalesce(nullif(btrim(c.acronym), ''), c.full_name),
            'conference_logo', c.logo_url
          ) as j, py.created_at as sort_at
            from payments py
            join invoices i on i.id = py.invoice_id
            join applications a on a.id = i.application_id
            join conferences c on c.id = i.conference_id
           where a.user_id = p.id and c.listed_by = 'organiser'
           order by py.created_at desc
           limit 12) t), '[]'::jsonb)
    ),

    'emails', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'subject', t.subject, 'status', t.status,
        'created_at', t.created_at, 'sent_at', t.sent_at
      ) order by t.created_at desc)
      from (select o.id, o.subject, o.status, o.created_at, o.sent_at
              from email_outbox o
             where o.recipient_email = p.email
             order by o.created_at desc
             limit 20) t), '[]'::jsonb)
  )
  into v
  from profiles p
  where p.id = p_user_id;

  return v;
end;
$function$
;

-- ---------------------------------------------------------------------------
-- admin_activity_feed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_activity_feed(p_kinds text[] DEFAULT NULL::text[], p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id text DEFAULT NULL::text, p_limit integer DEFAULT 60)
 RETURNS TABLE(event_id text, occurred_at timestamp with time zone, kind text, actor_id uuid, actor_name text, actor_avatar text, subject text, detail text, link_href text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lim int    := greatest(1, least(coalesce(p_limit, 60), 200));
  v_k   text[] := CASE WHEN p_kinds IS NULL OR cardinality(p_kinds) = 0
                       THEN NULL ELSE p_kinds END;
  v_cid text   := coalesce(p_before_id, '');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  RETURN QUERY
  WITH ev (event_id, occurred_at, kind, actor_id,
           actor_name, actor_avatar, subject, detail, link_href) AS (

    SELECT * FROM (
      SELECT ('signup:' || pr.id)::text, pr.created_at, 'signup'::text, pr.id,
             coalesce(nullif(btrim(pr.display_name), ''), 'Unnamed')::text,
             pr.avatar_url::text,
             coalesce(nullif(btrim(pr.display_name), ''), 'Unnamed')::text,
             (pr.email || coalesce(' · ' || pr.nationality, ''))::text,
             ('/cv/' || pr.id)::text
        FROM profiles pr
       WHERE (v_k IS NULL OR 'signup' = ANY (v_k))
         AND (p_before IS NULL
              OR (pr.created_at, ('signup:' || pr.id)::text) < (p_before, v_cid))
       ORDER BY pr.created_at DESC, ('signup:' || pr.id)::text DESC
       LIMIT v_lim) s1

    UNION ALL SELECT * FROM (
      SELECT ('cv_entry:' || e.id)::text, e.created_at, 'cv_entry'::text, e.user_id,
             coalesce(pr.display_name, 'Unknown')::text, pr.avatar_url::text,
             e.conference_name::text,
             concat_ws(' · ', nullif(btrim(e.committee), ''),
                              nullif(btrim(e.allocation), ''),
                              nullif(array_to_string(e.awards, ', '), ''))::text,
             ('/cv/' || e.user_id)::text
        FROM mun_cv_entries e
        LEFT JOIN profiles pr ON pr.id = e.user_id
       WHERE (v_k IS NULL OR 'cv_entry' = ANY (v_k))
         AND (p_before IS NULL
              OR (e.created_at, ('cv_entry:' || e.id)::text) < (p_before, v_cid))
       ORDER BY e.created_at DESC, ('cv_entry:' || e.id)::text DESC
       LIMIT v_lim) s2

    UNION ALL SELECT * FROM (
      SELECT ('conference_created:' || c.id)::text, c.created_at,
             'conference_created'::text, c.organizer_id,
             coalesce(o.display_name, 'Unknown')::text, o.avatar_url::text,
             coalesce(nullif(btrim(c.acronym), ''), c.full_name)::text,
             (coalesce(nullif(btrim(c.city), '') || ', ', '') || btrim(c.country)
              || ' · ' || c.expected_delegates || ' expected')::text,
             ('/manage/' || c.slug)::text
        FROM conferences c
        LEFT JOIN profiles o ON o.id = c.organizer_id
       WHERE (v_k IS NULL OR 'conference_created' = ANY (v_k))
         AND c.listed_by = 'organiser'
         AND (p_before IS NULL
              OR (c.created_at, ('conference_created:' || c.id)::text) < (p_before, v_cid))
       ORDER BY c.created_at DESC, ('conference_created:' || c.id)::text DESC
       LIMIT v_lim) s3

    UNION ALL SELECT * FROM (
      SELECT ('conference_published:' || c.id)::text, c.published_at,
             'conference_published'::text, c.organizer_id,
             coalesce(o.display_name, 'Unknown')::text, o.avatar_url::text,
             coalesce(nullif(btrim(c.acronym), ''), c.full_name)::text,
             ('live on gavelling.com')::text,
             ('/conferences/' || c.slug)::text
        FROM conferences c
        LEFT JOIN profiles o ON o.id = c.organizer_id
       WHERE c.published_at IS NOT NULL
         AND (v_k IS NULL OR 'conference_published' = ANY (v_k))
         AND c.listed_by = 'organiser'
         AND (p_before IS NULL
              OR (c.published_at, ('conference_published:' || c.id)::text) < (p_before, v_cid))
       ORDER BY c.published_at DESC, ('conference_published:' || c.id)::text DESC
       LIMIT v_lim) s4

    UNION ALL SELECT * FROM (
      SELECT ('committee_added:' || cc.id)::text, cc.created_at,
             'committee_added'::text, c.organizer_id,
             coalesce(o.display_name, 'Unknown')::text, o.avatar_url::text,
             coalesce(nullif(btrim(c.acronym), ''), c.full_name)::text,
             cc.name::text,
             ('/manage/' || c.slug || '/committees')::text
        FROM conference_committees cc
        JOIN conferences c ON c.id = cc.conference_id
        LEFT JOIN profiles o ON o.id = c.organizer_id
       WHERE (v_k IS NULL OR 'committee_added' = ANY (v_k))
         AND c.listed_by = 'organiser'
         AND (p_before IS NULL
              OR (cc.created_at, ('committee_added:' || cc.id)::text) < (p_before, v_cid))
       ORDER BY cc.created_at DESC, ('committee_added:' || cc.id)::text DESC
       LIMIT v_lim) s5

    UNION ALL SELECT * FROM (
      SELECT ('application_submitted:' || a.id)::text, a.submitted_at,
             'application_submitted'::text, a.user_id,
             coalesce(pr.display_name, a.invited_name, a.invited_email, 'Unknown')::text,
             pr.avatar_url::text,
             coalesce(nullif(btrim(c.acronym), ''), c.full_name)::text,
             (a.role || CASE WHEN a.is_independent THEN ' · independent' ELSE '' END)::text,
             ('/manage/' || c.slug || '/applications')::text
        FROM applications a
        JOIN conferences c ON c.id = a.conference_id
        LEFT JOIN profiles pr ON pr.id = a.user_id
       WHERE (v_k IS NULL OR 'application_submitted' = ANY (v_k))
         AND c.listed_by = 'organiser'
         AND (p_before IS NULL
              OR (a.submitted_at, ('application_submitted:' || a.id)::text) < (p_before, v_cid))
       ORDER BY a.submitted_at DESC, ('application_submitted:' || a.id)::text DESC
       LIMIT v_lim) s6

    UNION ALL SELECT * FROM (
      SELECT ('application_resubmitted:' || a.id)::text, a.resubmitted_at,
             'application_resubmitted'::text, a.user_id,
             coalesce(pr.display_name, a.invited_name, a.invited_email, 'Unknown')::text,
             pr.avatar_url::text,
             coalesce(nullif(btrim(c.acronym), ''), c.full_name)::text,
             (a.role || ' · edited and resubmitted')::text,
             ('/manage/' || c.slug || '/applications')::text
        FROM applications a
        JOIN conferences c ON c.id = a.conference_id
        LEFT JOIN profiles pr ON pr.id = a.user_id
       WHERE a.resubmitted_at IS NOT NULL
         AND (v_k IS NULL OR 'application_resubmitted' = ANY (v_k))
         AND c.listed_by = 'organiser'
         AND (p_before IS NULL
              OR (a.resubmitted_at, ('application_resubmitted:' || a.id)::text) < (p_before, v_cid))
       ORDER BY a.resubmitted_at DESC, ('application_resubmitted:' || a.id)::text DESC
       LIMIT v_lim) s7

    UNION ALL SELECT * FROM (
      SELECT ('application_decision:' || a.id)::text, a.updated_at,
             'application_decision'::text, a.user_id,
             coalesce(pr.display_name, a.invited_name, a.invited_email, 'Unknown')::text,
             pr.avatar_url::text,
             coalesce(nullif(btrim(c.acronym), ''), c.full_name)::text,
             (a.status || ' · ' || a.role)::text,
             ('/manage/' || c.slug || '/applications')::text
        FROM applications a
        JOIN conferences c ON c.id = a.conference_id
        LEFT JOIN profiles pr ON pr.id = a.user_id
       WHERE a.status IN ('accepted', 'assigned', 'rejected', 'withdrawn')
         AND (v_k IS NULL OR 'application_decision' = ANY (v_k))
         AND c.listed_by = 'organiser'
         AND (p_before IS NULL
              OR (a.updated_at, ('application_decision:' || a.id)::text) < (p_before, v_cid))
       ORDER BY a.updated_at DESC, ('application_decision:' || a.id)::text DESC
       LIMIT v_lim) s8

    UNION ALL SELECT * FROM (
      SELECT ('application_checkin:' || a.id)::text, a.checked_in_at,
             'application_checkin'::text, a.user_id,
             coalesce(pr.display_name, a.invited_name, a.invited_email, 'Unknown')::text,
             pr.avatar_url::text,
             coalesce(nullif(btrim(c.acronym), ''), c.full_name)::text,
             coalesce(a.assigned_country_name, a.role)::text,
             ('/manage/' || c.slug || '/applications')::text
        FROM applications a
        JOIN conferences c ON c.id = a.conference_id
        LEFT JOIN profiles pr ON pr.id = a.user_id
       WHERE a.checked_in_at IS NOT NULL
         AND (v_k IS NULL OR 'application_checkin' = ANY (v_k))
         AND c.listed_by = 'organiser'
         AND (p_before IS NULL
              OR (a.checked_in_at, ('application_checkin:' || a.id)::text) < (p_before, v_cid))
       ORDER BY a.checked_in_at DESC, ('application_checkin:' || a.id)::text DESC
       LIMIT v_lim) s9

    UNION ALL SELECT * FROM (
      SELECT ('payment:' || pm.id)::text, pm.created_at, 'payment'::text, pm.actor_user_id,
             coalesce(pr.display_name, 'Unknown')::text, pr.avatar_url::text,
             coalesce(nullif(btrim(c.acronym), ''), c.full_name)::text,
             (upper(pm.currency) || ' ' || to_char(pm.amount_cents / 100.0, 'FM999999990.00')
              || ' · ' || pm.status || ' · ' || pm.type)::text,
             ('/manage/' || c.slug || '/financials')::text
        FROM payments pm
        JOIN invoices i    ON i.id = pm.invoice_id
        JOIN conferences c ON c.id = i.conference_id
        LEFT JOIN profiles pr ON pr.id = pm.actor_user_id
       WHERE (v_k IS NULL OR 'payment' = ANY (v_k))
         AND c.listed_by = 'organiser'
         AND (p_before IS NULL
              OR (pm.created_at, ('payment:' || pm.id)::text) < (p_before, v_cid))
       ORDER BY pm.created_at DESC, ('payment:' || pm.id)::text DESC
       LIMIT v_lim) s10

    UNION ALL SELECT * FROM (
      SELECT ('conference_request:' || r.id)::text, r.created_at,
             'conference_request'::text, r.user_id,
             coalesce(pr.display_name, 'Unknown')::text, pr.avatar_url::text,
             coalesce(nullif(btrim(c.acronym), ''), c.full_name)::text,
             (r.kind || ' · ' || r.subject)::text,
             ('/manage/' || c.slug)::text
        FROM conference_requests r
        JOIN conferences c ON c.id = r.conference_id
        LEFT JOIN profiles pr ON pr.id = r.user_id
       WHERE (v_k IS NULL OR 'conference_request' = ANY (v_k))
         AND c.listed_by = 'organiser'
         AND (p_before IS NULL
              OR (r.created_at, ('conference_request:' || r.id)::text) < (p_before, v_cid))
       ORDER BY r.created_at DESC, ('conference_request:' || r.id)::text DESC
       LIMIT v_lim) s11

    UNION ALL SELECT * FROM (
      SELECT ('review:' || rv.id)::text, rv.created_at, 'review'::text, rv.user_id,
             coalesce(rv.display_name, pr.display_name, 'Anonymous')::text, pr.avatar_url::text,
             coalesce(nullif(btrim(c.acronym), ''), c.full_name)::text,
             (rv.rating || '/5' || coalesce(' · ' || left(rv.review_text, 120), ''))::text,
             ('/conferences/' || c.slug || '/reviews')::text
        FROM conference_reviews rv
        JOIN conferences c ON c.id = rv.conference_id
        LEFT JOIN profiles pr ON pr.id = rv.user_id
       WHERE (v_k IS NULL OR 'review' = ANY (v_k))
         AND c.listed_by = 'organiser'
         AND (p_before IS NULL
              OR (rv.created_at, ('review:' || rv.id)::text) < (p_before, v_cid))
       ORDER BY rv.created_at DESC, ('review:' || rv.id)::text DESC
       LIMIT v_lim) s12

    UNION ALL SELECT * FROM (
      SELECT ('enquiry:' || cs.id)::text, cs.created_at, 'enquiry'::text, NULL::uuid,
             cs.name::text, NULL::text,
             coalesce(nullif(btrim(cs.subject), ''), 'Enquiry')::text,
             (cs.email || ' · ' || left(cs.message, 120))::text,
             NULL::text
        FROM contact_submissions cs
       WHERE (v_k IS NULL OR 'enquiry' = ANY (v_k))
         AND (p_before IS NULL
              OR (cs.created_at, ('enquiry:' || cs.id)::text) < (p_before, v_cid))
       ORDER BY cs.created_at DESC, ('enquiry:' || cs.id)::text DESC
       LIMIT v_lim) s13

    UNION ALL SELECT * FROM (
      SELECT ('ambassador:' || aa.id)::text, aa.submitted_at, 'ambassador'::text, NULL::uuid,
             aa.name::text, NULL::text,
             aa.country::text,
             (aa.email || coalesce(' · ' || left(aa.experience, 120), ''))::text,
             NULL::text
        FROM ambassador_applications aa
       WHERE (v_k IS NULL OR 'ambassador' = ANY (v_k))
         AND (p_before IS NULL
              OR (aa.submitted_at, ('ambassador:' || aa.id)::text) < (p_before, v_cid))
       ORDER BY aa.submitted_at DESC, ('ambassador:' || aa.id)::text DESC
       LIMIT v_lim) s14
  )
  SELECT e.event_id, e.occurred_at, e.kind, e.actor_id,
         e.actor_name, e.actor_avatar, e.subject, e.detail, e.link_href
    FROM ev e
   ORDER BY e.occurred_at DESC, e.event_id DESC
   LIMIT v_lim;
END;
$function$
;

-- ---------------------------------------------------------------------------
-- admin_platform_metrics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_platform_metrics(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_days    int;
  v_from    date;
  v_since   timestamptz;
  v_active  uuid[];

  v_today jsonb; v_series jsonb; v_users jsonb; v_geo jsonb;
  v_conf jsonb; v_money jsonb; v_health jsonb;
  v_intent jsonb;

  v_live int;
  v_auth_total int; v_auth_dead int; v_auth_session int;
  v_setup_ok int; v_setup_stalled int;
  v_unconf_raw int; v_unconf_dupe int; v_unconf_stuck int;
  v_unconf_new int; v_unconf_oldest int;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorised';
  end if;

  v_days  := greatest(7, least(coalesce(p_days, 30), 180));
  v_from  := (now() at time zone 'UTC')::date - (v_days - 1);
  v_since := (v_from::timestamp) at time zone 'UTC';

  -- Same "active" as the 13:00 email.
  select coalesce(array_agg(c.id), '{}'::uuid[]) into v_active
    from conferences c
   where c.listed_by = 'organiser'
     and public.is_active_conference(c.id);

  -- Live right now: the Live tab's own definition, not a second one.
  select count(*)::int into v_live
    from public.admin_live_committees(24, 30) l
   where not l.suspended and l.idle_minutes <= 15;

  -- Auth dead ends: the existing grouped RPC, summed.
  select coalesce(sum(f.occurrences), 0)::int,
         coalesce(sum(f.occurrences) filter (where coalesce(f.shown_reason, '') <> 'recovered'), 0)::int,
         coalesce(sum(f.occurrences) filter (where f.had_session), 0)::int
    into v_auth_total, v_auth_dead, v_auth_session
    from public.admin_auth_flow_failures(24) f;

  -- Today, rolling 24 hours
  select jsonb_build_object(
    'signups',             (select count(*) from profiles
                             where not coalesce(is_demo, false)
                               and created_at > now() - interval '24 hours'),
    'applications',        (select count(*) from applications a
                             where a.conference_id = any(v_active)
                               and a.submitted_at > now() - interval '24 hours'),
    'conferences_created', (select count(*) from conferences
                             where listed_by = 'organiser'
                               and created_at > now() - interval '24 hours'),
    'sessions_started',    (select count(*) from committees
                             where created_at > now() - interval '24 hours'
                               and (updated_at - created_at) > interval '30 minutes'),
    'sessions_started_raw',(select count(*) from committees
                             where created_at > now() - interval '24 hours'),
    'live_now',            v_live,
    'emails_sent',         (select count(*) from email_outbox
                             where status = 'sent' and updated_at > now() - interval '24 hours'),
    'emails_failed',       (select count(*) from email_outbox
                             where status = 'failed' and updated_at > now() - interval '24 hours'),
    'cv_entries',          (select count(*) from mun_cv_entries
                             where created_at > now() - interval '24 hours')
  ) into v_today;

  -- Per-day series
  with days as (
    select generate_series(v_from, (now() at time zone 'UTC')::date, '1 day'::interval)::date d
  ),
  su as (select (created_at at time zone 'UTC')::date d, count(*) n
           from profiles
          where not coalesce(is_demo, false) and created_at >= v_since group by 1),
  ap as (select (submitted_at at time zone 'UTC')::date d, count(*) n
           from applications
          where conference_id = any(v_active) and submitted_at >= v_since group by 1),
  cc as (select (created_at at time zone 'UTC')::date d, count(*) n
           from conferences where listed_by = 'organiser' and created_at >= v_since group by 1),
  cp as (select (published_at at time zone 'UTC')::date d, count(*) n
           from conferences where listed_by = 'organiser' and published_at >= v_since group by 1),
  se as (select (created_at at time zone 'UTC')::date d,
                count(*) filter (where coalesce(session_origin, 'standalone') = 'conference') nc,
                count(*) filter (where coalesce(session_origin, 'standalone') <> 'conference') ns
           from committees
          where created_at >= v_since
            and (updated_at - created_at) > interval '30 minutes'
          group by 1),
  cv as (select (created_at at time zone 'UTC')::date d, count(*) n
           from mun_cv_entries where created_at >= v_since group by 1),
  seed as (select count(*) n from profiles
            where not coalesce(is_demo, false) and created_at < v_since),
  ser as (
    select dd.d,
           coalesce(su.n, 0)::int  signups,
           coalesce(ap.n, 0)::int  applications,
           coalesce(cc.n, 0)::int  conferences_created,
           coalesce(cp.n, 0)::int  conferences_published,
           coalesce(se.nc, 0)::int sessions_conference,
           coalesce(se.ns, 0)::int sessions_standalone,
           coalesce(cv.n, 0)::int  cv_entries,
           ((select n from seed) + sum(coalesce(su.n, 0)) over (order by dd.d))::int profiles_cumulative
      from days dd
      left join su on su.d = dd.d
      left join ap on ap.d = dd.d
      left join cc on cc.d = dd.d
      left join cp on cp.d = dd.d
      left join se on se.d = dd.d
      left join cv on cv.d = dd.d
  )
  select coalesce(jsonb_agg(to_jsonb(r) - 'd' || jsonb_build_object('d', to_char(r.d, 'YYYY-MM-DD')) order by r.d), '[]'::jsonb)
    into v_series
    from ser r;

  -- Users
  select jsonb_build_object(
    'total', count(*),
    'd1',    count(*) filter (where created_at > now() - interval '24 hours'),
    'd7',    count(*) filter (where created_at > now() - interval '7 days'),
    'd30',   count(*) filter (where created_at > now() - interval '30 days'),
    'education', (
      select coalesce(jsonb_agg(jsonb_build_object('level', e.lvl, 'n', e.n) order by e.n desc), '[]'::jsonb)
        from (select coalesce(nullif(btrim(education_level), ''), 'unknown') lvl, count(*) n
                from profiles where not coalesce(is_demo, false) group by 1) e)
  ) into v_users
    from profiles where not coalesce(is_demo, false);

  -- Geography of accounts. Sparse on purpose: nationality is optional.
  select jsonb_build_object(
    'known', count(*) filter (where coalesce(btrim(nationality), '') <> ''),
    'total', count(*),
    'countries', (
      select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'n', t.n) order by t.n desc, t.name), '[]'::jsonb)
        from (select btrim(nationality) name, count(*) n
                from profiles
               where not coalesce(is_demo, false) and coalesce(btrim(nationality), '') <> ''
               group by 1 order by 2 desc, 1 limit 100) t)
  ) into v_geo
    from profiles where not coalesce(is_demo, false);

  -- Conferences: set-up complete uses conference_setup_status(), the same
  -- definition the organiser dashboard and the verification mark read.
  select count(*) filter (where s.ok)::int, count(*) filter (where not s.ok)::int
    into v_setup_ok, v_setup_stalled
    from (select coalesce((public.conference_setup_status(c.id) ->> 'setup_complete')::boolean, false) ok
            from conferences c where c.id = any(v_active)) s;

  -- What organisers said they came here to do. Shared with the 13:00 email.
  v_intent := public.platform_intent_mix();

  select jsonb_build_object(
    'total',      (select count(*) from conferences where listed_by = 'organiser'),
    'active',     coalesce(array_length(v_active, 1), 0),
    'public',     (select count(*) from conferences where listed_by = 'organiser' and status = 'public'),
    'private',    (select count(*) from conferences where listed_by = 'organiser' and status = 'private'),
    'verified',   (select count(*) from conferences where listed_by = 'organiser' and is_verified),
    'created_24h',(select count(*) from conferences where listed_by = 'organiser' and created_at > now() - interval '24 hours'),
    'setup_complete', v_setup_ok,
    'setup_stalled',  v_setup_stalled,
    'intents',          v_intent -> 'options',
    'intent_total',     v_intent -> 'total',
    'intent_answered',  v_intent -> 'answered',
    'intent_skipped',   v_intent -> 'skipped',
    'intent_unasked',   v_intent -> 'unasked',
    'intent_other',     v_intent -> 'other',
    'countries', (
      select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'n', t.n) order by t.n desc, t.name), '[]'::jsonb)
        from (select btrim(country) name, count(*) n from conferences
               where listed_by = 'organiser' and coalesce(btrim(country), '') <> '' group by 1 order by 2 desc, 1 limit 40) t),
    'cities', (
      select coalesce(jsonb_agg(jsonb_build_object('city', t.city, 'country', t.country, 'n', t.n) order by t.n desc, t.city), '[]'::jsonb)
        from (select btrim(city) city, btrim(country) country, count(*) n from conferences
               where listed_by = 'organiser' and coalesce(btrim(city), '') <> '' group by 1, 2 order by 3 desc, 1 limit 20) t),
    'funnel', (
      select jsonb_build_object(
        'submitted',  count(*),
        'accepted',   count(*) filter (where status in ('accepted', 'assigned', 'checked-in')),
        'assigned',   count(*) filter (where status in ('assigned', 'checked-in')),
        'checked_in', count(*) filter (where status = 'checked-in'),
        'rejected',   count(*) filter (where status = 'rejected'),
        'withdrawn',  count(*) filter (where status = 'withdrawn'))
        from applications where conference_id = any(v_active)),
    'awaiting',    (select count(*) from applications
                     where conference_id = any(v_active) and status = 'submitted'),
    'awaiting_30d',(select count(*) from applications
                     where conference_id = any(v_active) and status = 'submitted'
                       and submitted_at < now() - interval '30 days')
  ) into v_conf;

  -- Money. Never summed across currencies. Active conferences only.
  select jsonb_build_object(
    'open', (
      select coalesce(jsonb_agg(jsonb_build_object('currency', t.currency, 'invoices', t.n, 'cents', t.total) order by t.total desc), '[]'::jsonb)
        from (select i.currency,
                     sum(i.amount_cents - coalesce(i.amount_paid_cents, 0))::bigint total,
                     count(*) n
                from invoices i
               where i.conference_id = any(v_active) and i.status in ('open', 'partial')
                 and exists (select 1 from applications oa where oa.id = i.application_id
                              and oa.status in ('accepted', 'assigned', 'checked-in'))
               group by 1) t),
    'settled_24h', (
      select coalesce(jsonb_agg(jsonb_build_object('currency', t.currency, 'payments', t.n, 'cents', t.total) order by t.total desc), '[]'::jsonb)
        from (select p.currency, sum(p.amount_cents)::bigint total, count(*) n
                from payments p
                join invoices i on i.id = p.invoice_id
               where i.conference_id = any(v_active)
                 and p.status = 'succeeded' and p.method = 'stripe'
                 and p.created_at > now() - interval '24 hours'
               group by 1) t),
    'offline_24h', (
      select coalesce(jsonb_agg(jsonb_build_object('currency', t.currency, 'payments', t.n, 'cents', t.total) order by t.total desc), '[]'::jsonb)
        from (select p.currency, sum(p.amount_cents)::bigint total, count(*) n
                from payments p
                join invoices i on i.id = p.invoice_id
               where i.conference_id = any(v_active)
                 and p.status = 'succeeded' and p.method <> 'stripe'
                 and p.created_at > now() - interval '24 hours'
               group by 1) t),
    'proofs', (
      select jsonb_build_object(
        'pending', count(*),
        'over_7d', count(*) filter (where coalesce(pb.proof_uploaded_at, pb.created_at) < now() - interval '7 days'),
        'oldest_days', coalesce(max(extract(day from now() - coalesce(pb.proof_uploaded_at, pb.created_at)))::int, 0))
        from payment_batches pb
       where pb.conference_id = any(v_active) and pb.status = 'pending'),
    'credits_purchased', (
      select jsonb_build_object('lots', count(*), 'credits', coalesce(sum(amount), 0),
                                'lots_24h', count(*) filter (where created_at > now() - interval '24 hours'))
        from credit_lots where source = 'purchase'),
    'credits_granted', (select count(*) from credit_lots where source = 'grant'),
    'credits_consumed', (
      select jsonb_build_object('total', count(*) filter (where status = 'active'),
                                'refunded', count(*) filter (where status = 'refunded'),
                                'd24', count(*) filter (where status = 'active' and created_at > now() - interval '24 hours'))
        from credit_consumptions),
    'subscriptions_active', (select count(*) from subscriptions where status in ('active', 'trialing'))
  ) into v_money;

  -- Unconfirmed accounts, classified exactly as the 13:00 email does.
  with unconfirmed as (
    select u.id, u.created_at, lower(btrim(coalesce(p.display_name, ''))) dn
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.email_confirmed_at is null
       and u.deleted_at is null
       and u.email not ilike '%@example.com'
       and u.email not ilike '%@gavellingtest.com'
       and u.email not ilike '%@gavelling.com'
  ),
  confirmed_names as (
    select distinct lower(btrim(p.display_name)) dn
      from auth.users u
      join public.profiles p on p.id = u.id
     where u.email_confirmed_at is not null
       and u.deleted_at is null
       and coalesce(btrim(p.display_name), '') <> ''
  ),
  classified as (
    select u.*, (u.dn <> '' and exists (select 1 from confirmed_names c where c.dn = u.dn)) got_in_anyway
      from unconfirmed u
  )
  select count(*)::int,
         count(*) filter (where got_in_anyway)::int,
         count(*) filter (where not got_in_anyway)::int,
         count(*) filter (where not got_in_anyway and created_at > now() - interval '24 hours')::int,
         coalesce(max(extract(day from now() - created_at)) filter (where not got_in_anyway), 0)::int
    into v_unconf_raw, v_unconf_dupe, v_unconf_stuck, v_unconf_new, v_unconf_oldest
    from classified;

  -- Health
  select jsonb_build_object(
    'crashes_24h',       (select count(*) from crash_alerts
                           where last_seen > now() - interval '24 hours' and severity <> 'noise'),
    'crashes_7d',        (select count(*) from crash_alerts
                           where last_seen > now() - interval '7 days' and severity <> 'noise'),
    'crashes_noise_24h', (select count(*) from crash_alerts
                           where last_seen > now() - interval '24 hours' and severity = 'noise'),
    'by_severity_24h', (
      select coalesce(jsonb_agg(jsonb_build_object('severity', t.sev, 'alerts', t.n, 'occurrences', t.occ) order by t.n desc), '[]'::jsonb)
        from (select coalesce(severity, 'unknown') sev, count(*) n, coalesce(sum(occurrences), 0)::bigint occ
                from crash_alerts where last_seen > now() - interval '24 hours' group by 1) t),
    'by_severity_7d', (
      select coalesce(jsonb_agg(jsonb_build_object('severity', t.sev, 'alerts', t.n, 'occurrences', t.occ) order by t.n desc), '[]'::jsonb)
        from (select coalesce(severity, 'unknown') sev, count(*) n, coalesce(sum(occurrences), 0)::bigint occ
                from crash_alerts where last_seen > now() - interval '7 days' group by 1) t),
    'auth', jsonb_build_object('total_24h', v_auth_total, 'dead_ends_24h', v_auth_dead, 'had_session_24h', v_auth_session),
    'email', jsonb_build_object(
      'outbox_pending', (select count(*) from email_outbox where status = 'pending'),
      'sent_24h',       (select count(*) from email_outbox where status = 'sent' and updated_at > now() - interval '24 hours'),
      'failed_24h',     (select count(*) from email_outbox where status = 'failed' and updated_at > now() - interval '24 hours'),
      'failed_total',   (select count(*) from email_outbox where status = 'failed'),
      'failures', (
        select coalesce(jsonb_agg(jsonb_build_object('reason', t.reason, 'n', t.n) order by t.n desc), '[]'::jsonb)
          from (select coalesce(nullif(left(error, 60), ''), 'no error text') reason, count(*) n
                  from email_outbox where status = 'failed' group by 1 order by 2 desc limit 8) t)),
    'unconfirmed', jsonb_build_object(
      'raw', v_unconf_raw, 'signed_up_again', v_unconf_dupe, 'stuck', v_unconf_stuck,
      'new_24h', v_unconf_new, 'oldest_days', v_unconf_oldest),
    'inbound', jsonb_build_object(
      'contact',   (select count(*) from contact_submissions),
      'contact_7d',(select count(*) from contact_submissions where created_at > now() - interval '7 days'),
      'ambassador',(select count(*) from ambassador_applications),
      'ambassador_7d', (select count(*) from ambassador_applications where submitted_at > now() - interval '7 days'),
      'requests_open', (select count(*) from conference_requests where status = 'open'),
      'requests_unseen', (select count(*) from conference_requests
                           where status = 'open' and not coalesce(seen_by_organizer, false)))
  ) into v_health;

  return jsonb_build_object(
    'generated_at', now(),
    'window_days', v_days,
    'window_from', to_char(v_from, 'YYYY-MM-DD'),
    'today', v_today,
    'series', v_series,
    'users', v_users,
    'geography', v_geo,
    'conferences', v_conf,
    'money', v_money,
    'health', v_health);
end
$function$
;

-- ---------------------------------------------------------------------------
-- admin_email_campaign_report
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_email_campaign_report(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  c        email_campaigns%rowtype;
  v_out    jsonb;
begin
  if not public.is_platform_admin() then raise exception 'not authorised'; end if;
  select * into c from email_campaigns where slug = p_slug;
  if not found then return jsonb_build_object('found', false, 'slug', p_slug); end if;

  with rec as (
    select r.id, r.user_id, r.queued_at, r.first_click_at, r.clicks,
           coalesce(o.status, 'unknown') as ostatus
      from email_campaign_recipients r
      left join email_outbox o on o.id = r.outbox_id
     where r.campaign_id = c.id and not r.is_test
  ),
  reached as (
    select * from rec where ostatus = 'sent' and user_id is not null
  ),
  bounds as (
    select min(queued_at) - interval '30 days' as lo, max(queued_at) + interval '7 days' as hi from reached
  ),
  ev as (
    select a.user_id, 'applied_conference'::text as action, a.submitted_at as at
      from applications a, bounds b
     where a.invited_email is null and a.submitted_at between b.lo and b.hi
       and a.user_id in (select user_id from reached)
    union all
    select j.user_id, 'applied_job', j.submitted_at
      from job_applications j, bounds b
     where j.submitted_at between b.lo and b.hi and j.user_id in (select user_id from reached)
    union all
    select cf.organizer_id, 'created_conference', cf.created_at
      from conferences cf, bounds b
     where not coalesce(cf.is_demo, false) and cf.listed_by = 'organiser' and cf.created_at between b.lo and b.hi
       and cf.organizer_id in (select user_id from reached)
    union all
    select co.user_id, 'joined_secretariat', co.created_at
      from conference_organizers co, bounds b
     where co.role <> 'owner' and co.created_at between b.lo and b.hi
       and co.user_id in (select user_id from reached)
    union all
    select cd.user_id, 'chaired_session', cd.claimed_at
      from chair_device_claims cd, bounds b
     where cd.claimed_at between b.lo and b.hi and cd.user_id in (select user_id from reached)
    union all
    select d.uid, 'joined_as_delegate', d.claimed_at
      from (select case when ds.holder_key ~ '^u:[0-9a-f-]{36}$' then substr(ds.holder_key, 3)::uuid end as uid,
                   ds.claimed_at
              from delegate_seat_claims ds) d, bounds b
     where d.uid is not null and d.claimed_at between b.lo and b.hi
       and d.uid in (select user_id from reached)
    union all
    select m.user_id, 'added_cv_entry', m.created_at
      from mun_cv_entries m, bounds b
     where m.source = 'manual' and m.created_at between b.lo and b.hi
       and m.user_id in (select user_id from reached)
    union all
    select l.user_id, 'bought_credits', l.created_at
      from credit_lots l, bounds b
     where l.source = 'purchase' and l.holder_type = 'user' and l.created_at between b.lo and b.hi
       and l.user_id in (select user_id from reached)
    union all
    select s.owner_user_id, 'bought_unlimited', s.created_at
      from subscriptions s, bounds b
     where s.plan in ('unlimited_monthly', 'unlimited_yearly')
       and coalesce(s.stripe_subscription_id, '') not like 'ambassador%'
       and s.created_at between b.lo and b.hi
       and s.owner_user_id in (select user_id from reached)
    union all
    select g.user_id, 'unlocked_guide', g.created_at
      from guide_unlocks g, bounds b
     where g.created_at between b.lo and b.hi and g.user_id in (select user_id from reached)
  ),
  conv as (
    select distinct r.id, e.action
      from reached r
      join ev e on e.user_id = r.user_id
     where e.at > r.queued_at and e.at <= r.queued_at + interval '7 days'
       and not exists (select 1 from ev e2
                        where e2.user_id = r.user_id and e2.action = e.action
                          and e2.at > r.queued_at - interval '30 days' and e2.at <= r.queued_at)
  ),
  per_rec as (
    select r.id, (r.first_click_at is not null) as clicker,
           exists (select 1 from conv v where v.id = r.id) as converted,
           r.queued_at > now() - interval '7 days' as window_open,
           exists (select 1 from auth.users u where u.id = r.user_id and u.last_sign_in_at > r.queued_at) as signed_in_since
      from reached r
  ),
  actions(action, label, ord) as (
    values ('applied_conference', 'Applied to a conference', 1),
           ('created_conference', 'Created a conference', 2),
           ('joined_secretariat', 'Joined a secretariat', 3),
           ('chaired_session', 'Chaired a session (signed in)', 4),
           ('joined_as_delegate', 'Joined a session as a delegate (signed in)', 5),
           ('added_cv_entry', 'Added a MUN CV entry', 6),
           ('applied_job', 'Applied for a chair or staff role', 7),
           ('bought_credits', 'Bought credits', 8),
           ('bought_unlimited', 'Bought Unlimited', 9),
           ('unlocked_guide', 'Unlocked a guide', 10)
  )
  select jsonb_build_object(
    'found', true,
    'campaign', jsonb_build_object('slug', c.slug, 'subject', c.subject, 'per_run', c.per_run,
                                   'created_at', c.created_at, 'started_at', c.started_at,
                                   'paused_at', c.paused_at, 'finished_at', c.finished_at),
    'queued', (select count(*) from rec),
    'delivery', jsonb_build_object(
      'sent',       (select count(*) from rec where ostatus = 'sent'),
      'failed',     (select count(*) from rec where ostatus = 'failed'),
      'suppressed', (select count(*) from rec where ostatus = 'suppressed'),
      'in_flight',  (select count(*) from rec where ostatus in ('pending', 'held', 'sending')),
      'other',      (select count(*) from rec where ostatus not in ('sent', 'failed', 'suppressed', 'pending', 'held', 'sending'))),
    'clicks', jsonb_build_object(
      'unique_clickers', (select count(*) from rec where first_click_at is not null),
      'total',           (select coalesce(sum(clicks), 0) from rec),
      'by_link', coalesce((
        select jsonb_agg(jsonb_build_object('key', k.key, 'url', k.value,
                 'clicks', (select count(*) from email_campaign_clicks cl join rec on rec.id = cl.recipient_id
                             where cl.campaign_id = c.id and cl.link_key = k.key),
                 'clickers', (select count(distinct cl.recipient_id) from email_campaign_clicks cl join rec on rec.id = cl.recipient_id
                               where cl.campaign_id = c.id and cl.link_key = k.key))
               order by k.key)
          from jsonb_each_text(c.links) k), '[]'::jsonb)),
    'conversions', jsonb_build_object(
      'window_days', 7, 'baseline_days', 30,
      'reached', (select count(*) from per_rec),
      'window_open', (select count(*) from per_rec where window_open),
      'clickers',     jsonb_build_object('n', (select count(*) from per_rec where clicker),
                                         'converted', (select count(*) from per_rec where clicker and converted)),
      'non_clickers', jsonb_build_object('n', (select count(*) from per_rec where not clicker),
                                         'converted', (select count(*) from per_rec where not clicker and converted)),
      'by_action', (select jsonb_agg(jsonb_build_object(
                       'action', a.action, 'label', a.label,
                       'clickers', (select count(*) from conv v join per_rec p on p.id = v.id where v.action = a.action and p.clicker),
                       'non_clickers', (select count(*) from conv v join per_rec p on p.id = v.id where v.action = a.action and not p.clicker))
                     order by a.ord) from actions a),
      'signed_in_since', jsonb_build_object(
        'clickers', (select count(*) from per_rec where clicker and signed_in_since),
        'non_clickers', (select count(*) from per_rec where not clicker and signed_in_since)))
  ) into v_out;

  return v_out;
end
$function$
;

-- ---------------------------------------------------------------------------
-- platform_intent_mix
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_intent_mix()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH c AS (
    SELECT
      CASE WHEN jsonb_typeof(conf.intent -> 'keys') = 'array'
           THEN conf.intent -> 'keys' ELSE '[]'::jsonb END           AS keys,
      coalesce(conf.intent -> 'skipped' = 'true'::jsonb, false)      AS skipped,
      coalesce(btrim(conf.intent ->> 'other'), '')                   AS other
    FROM conferences conf
    WHERE conf.listed_by = 'organiser'
  ),
  t AS (
    SELECT
      count(*)::int                                                          AS total,
      count(*) FILTER (WHERE jsonb_array_length(keys) > 0)::int              AS answered,
      count(*) FILTER (WHERE jsonb_array_length(keys) = 0 AND skipped)::int  AS skipped,
      count(*) FILTER (WHERE jsonb_array_length(keys) = 0
                         AND NOT skipped)::int                               AS unasked,
      count(*) FILTER (WHERE other <> '')::int                               AS other_n
    FROM c
  ),
  k AS (
    SELECT e.key::text AS name, count(*)::int AS n
      FROM c, LATERAL jsonb_array_elements_text(c.keys) AS e(key)
     GROUP BY 1
  )
  SELECT jsonb_build_object(
    'total',    t.total,
    'answered', t.answered,
    'skipped',  t.skipped,
    'unasked',  t.unasked,
    'other',    t.other_n,
    'options',  coalesce(
                  (SELECT jsonb_agg(jsonb_build_object('name', k.name, 'n', k.n)
                                    ORDER BY k.n DESC, k.name)
                     FROM k), '[]'::jsonb))
  FROM t;
$function$
;

-- ===========================================================================
-- VERIFICATION (rolled back: it always ends in RAISE EXCEPTION, so nothing it
-- does is kept). Run AFTER the CREATE OR REPLACE statements above, in the same
-- session or later. It impersonates one platform admin for this transaction
-- only (set_config(..., true)) so is_platform_admin() passes, calls the
-- dashboard functions, and checks every number against the raw table with
-- listings removed. It calls no function that writes or sends email.
-- Success = an error reading "ADMIN HIDE TEST PASSED ...". Any other error
-- names the check that failed.
-- ===========================================================================
do $verify$
declare
  v_admin    uuid;
  v_staff    uuid;
  v_staff_email text;
  v_listings int;
  v_org      int;
  v_n        int;
  v_m        jsonb;
  v_r        jsonb;
  v_any_listing uuid;
  v_any_org  uuid;
  v_msg      text;
begin
  select user_id into v_admin from public.platform_admins limit 1;
  if v_admin is null then raise exception 'no platform admin to impersonate'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  if not public.is_platform_admin() then raise exception 'impersonation failed'; end if;

  select count(*) into v_listings from public.conferences where listed_by = 'gavelling';
  select count(*) into v_org      from public.conferences where listed_by = 'organiser';
  select organizer_id into v_staff from public.conferences where listed_by = 'gavelling' limit 1;
  select email into v_staff_email from public.profiles where id = v_staff;
  select id into v_any_listing from public.conferences where listed_by = 'gavelling' limit 1;
  select id into v_any_org     from public.conferences where listed_by = 'organiser' limit 1;

  -- 1. Conferences tab
  select count(*) into v_n from public.admin_conference_overview();
  if v_n <> v_org then raise exception 'overview: % rows, expected %', v_n, v_org; end if;
  if exists (select 1 from public.admin_conference_overview() o
              join public.conferences c on c.id = o.id where c.listed_by = 'gavelling')
    then raise exception 'overview still lists a listing'; end if;
  v_msg := format('overview=%s (all conferences %s minus %s listings)', v_n, v_org + v_listings, v_listings);

  -- 2. Data tab numbers
  v_m := public.admin_platform_metrics(30);
  if (v_m->'conferences'->>'total')::int <> v_org then raise exception 'metrics total %', v_m->'conferences'->>'total'; end if;
  if (v_m->'conferences'->>'public')::int <> (select count(*) from conferences where listed_by = 'organiser' and status = 'public')
    then raise exception 'metrics public'; end if;
  if (v_m->'conferences'->>'private')::int <> (select count(*) from conferences where listed_by = 'organiser' and status = 'private')
    then raise exception 'metrics private'; end if;
  if (v_m->'conferences'->>'verified')::int <> (select count(*) from conferences where listed_by = 'organiser' and is_verified)
    then raise exception 'metrics verified'; end if;
  if (v_m->'conferences'->>'active')::int <> (select count(*) from conferences c where c.listed_by = 'organiser' and public.is_active_conference(c.id))
    then raise exception 'metrics active'; end if;
  if (v_m->'conferences'->>'intent_total')::int <> v_org then raise exception 'metrics intent_total'; end if;
  v_msg := v_msg || format('; metrics total=%s public=%s private=%s verified=%s active=%s intent_total=%s',
    v_m->'conferences'->>'total', v_m->'conferences'->>'public', v_m->'conferences'->>'private',
    v_m->'conferences'->>'verified', v_m->'conferences'->>'active', v_m->'conferences'->>'intent_total');

  -- 3. The staff account's user record and directory row
  v_r := public.admin_user_record(v_staff);
  if exists (select 1 from jsonb_array_elements(v_r->'organised') o
              join public.conferences c on c.id = (o->>'id')::uuid where c.listed_by = 'gavelling')
    then raise exception 'user record still shows a listing as organised'; end if;
  select conferences_organised into v_n from public.admin_user_directory(v_staff_email, 'newest', 200, 0) d where d.id = v_staff;
  if v_n <> (select count(distinct co.conference_id) from conference_organizers co join conferences c on c.id = co.conference_id
              where co.user_id = v_staff and c.listed_by = 'organiser')
    then raise exception 'directory organised count %', v_n; end if;
  v_msg := v_msg || format('; staff organised: record=%s directory=%s', jsonb_array_length(v_r->'organised'), v_n);

  -- 4. Activity feed: no event links to a listing
  if exists (select 1 from public.admin_activity_feed(null, null, null, 200) f
              join public.conferences c on c.slug = split_part(f.link_href, '/', 3)
             where (f.link_href like '/manage/%' or f.link_href like '/conferences/%')
               and c.listed_by = 'gavelling')
    then raise exception 'activity feed still shows a listing'; end if;
  if exists (select 1 from public.admin_activity_feed(array['conference_created','conference_published','committee_added'], null, null, 200) f
              join public.conferences c on c.slug = split_part(f.link_href, '/', 3)
             where c.listed_by = 'gavelling')
    then raise exception 'activity feed (conference kinds) still shows a listing'; end if;

  -- 5. Detail pop-up, Live tab, Pending tab
  if public.admin_conference_detail(v_any_listing) is not null then raise exception 'detail opens a listing'; end if;
  if public.admin_conference_detail(v_any_org) is null then raise exception 'detail broke for an organiser conference'; end if;
  if exists (select 1 from public.admin_live_committees(24, 30) l join conferences c on c.id = l.conference_id where c.listed_by = 'gavelling')
    then raise exception 'live tab shows a listing room'; end if;
  if exists (select 1 from public.admin_pending_people(null, null, 200, 0) p join conferences c on c.slug = p.conference_slug where c.listed_by = 'gavelling')
    then raise exception 'pending tab shows a listing'; end if;

  raise exception 'ADMIN HIDE TEST PASSED: %', v_msg;
end
$verify$;
