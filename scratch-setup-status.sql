-- Server-side mirror of the organiser dashboard's set-up checklist
-- (src/app/manage/[slug]/page.tsx). Consumed by the `send-setup-nudges` edge
-- function (pg_cron `organiser-setup-nudges`, daily 09:00), by
-- queue_checkmark_emails() (pg_cron `checkmark-emails`, daily 10:30), by
-- refresh_conference_verification() (dashboard + pg_cron hourly sweep) and by
-- the admin console.
--
-- APPLIED 2026-09-06 as migration `conference_verification_checkmark_and_emails`
-- (project luruhkwrgisytejswlas). This file is a reference copy of the deployed
-- definition; the database is the truth. If you change one, change both.
--
-- What it reports beyond the eight items:
--   items[].minutes            how long each stage usually takes (printed by the
--                              dashboard, the entry pop-up and the checkmark emails)
--   verification_keys          the stages that earn the blue checkmark:
--                              page, committees, chairs, email, secretariat,
--                              financials, publish  ('delegate' is NOT one)
--   verification_pending       the keys among those still not done
--   verification_minutes_left  sum of their minutes
--   verification_ready         true when verification_pending is empty
--   is_verified / verified_at  the stored mark (refresh_conference_verification)

-- REFRESHED 21 Oct 2026 (Christian's chat): this block is now the LIVE definition of
-- conference_setup_status() as of 21 Oct (financials before applications; the 'chairs' stage is
-- 'List Chair, Secretariat or Staff Positions', done by a chair, a published job listing or
-- conferences.jobs_later_at). The older copy that stood here would have undone that if re-run.
-- The database is the truth: before re-running, compare with pg_get_functiondef.
CREATE OR REPLACE FUNCTION public.conference_setup_status(p_conference_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c                 conferences%rowtype;
  v_committees      int;
  v_missing_chairs  int;
  v_capacity        int;
  v_expected        int;
  v_required        int;
  v_roles_enabled   int;
  v_roles_live      int;
  v_self_apps       boolean;
  v_apps_done       boolean;
  v_comms_done      boolean;
  v_payments_ready  boolean;
  v_items           jsonb;
  v_year            text;
  v_base            text;
  v_display         text;
  v_ver_keys        text[] := array['page','committees','applications','financials','communications','chairs','store'];
  v_ver_pending     jsonb;
  v_ver_minutes     int;
begin
  if auth.uid() is not null
     and not public.is_conference_organizer(p_conference_id) then
    return null;
  end if;

  select * into c from conferences where id = p_conference_id;
  if not found then return null; end if;

  v_base := coalesce(nullif(btrim(c.acronym), ''), c.full_name);
  v_year := to_char(coalesce(c.start_date, c.end_date), 'YYYY');
  v_display := case
    when v_year is null then v_base
    when v_base like '%' || v_year || '%' then v_base
    when v_base like '%''' || right(v_year, 2) || '%' then v_base
    when v_base ~ ('(^|[^0-9])' || right(v_year, 2) || '$') then v_base
    else v_base || ' ' || v_year
  end;

  select count(*) into v_committees from conference_committees where conference_id = c.id;

  select count(*) into v_missing_chairs from conference_committees cc
   where cc.conference_id = c.id
     and (cc.chair_user_ids is null or cardinality(cc.chair_user_ids) = 0)
     and not exists (
       select 1 from conference_chair_invites ci
        where ci.committee_id = cc.id
          and ci.conference_id = c.id
          and ci.status = 'pending');

  select coalesce(sum(s.delegation_size), 0) into v_capacity
    from conference_committees cc
    join committee_country_slots s on s.conference_committee_id = cc.id
   where cc.conference_id = c.id;

  v_expected := coalesce(c.expected_delegates, 0);
  v_required := ceil(v_expected * 0.7);

  v_payments_ready := public.conference_payments_ready(c.id);

  select count(*) filter (where r.is_enabled),
         count(*) filter (where r.is_enabled
                            and (r.applications_close_at is null or r.applications_close_at > now()))
    into v_roles_enabled, v_roles_live
    from application_role_configs r
   where r.conference_id = c.id;
  v_self_apps := exists (select 1 from applications a
                          where a.conference_id = c.id and a.invited_email is null);
  v_apps_done := v_roles_live > 0 or v_self_apps;

  v_comms_done := c.comms_visited_at is not null or c.emails_explored_at is not null;

  v_items := jsonb_build_array(
    jsonb_build_object('key','page','title','Set up your conference page','minutes',5,
      'done', (c.banner_url is not null and coalesce(btrim(c.description),'') <> ''
                and not c.dates_tbd and c.start_date is not null),
      'todo', case
        when (c.dates_tbd or c.start_date is null)
         and (c.banner_url is null or coalesce(btrim(c.description),'') = '')
          then 'Add your conference dates, a banner image and a description.'
        when (c.dates_tbd or c.start_date is null)
          then 'Add your conference dates so delegates can plan their trip.'
        else 'Add a banner image and a description delegates will actually read.' end,
      'href', case when (c.dates_tbd or c.start_date is null)
        then '/settings?tab=general&focus=dates' else '/settings?tab=general' end),
    jsonb_build_object('key','committees','title','Add committees with enough seats','minutes',10,
      'done', (v_committees > 0 and (v_expected = 0 or v_capacity >= v_required)),
      'todo', case when v_committees = 0 then 'Create your committees and set their country lists, so they appear in applications.'
        when v_expected > 0 and v_capacity < v_required then
          format('You are expecting %s delegates but your committees only seat %s. About %s more seats would cover most of them.',
                 v_expected, v_capacity, v_required - v_capacity)
        else 'Committees are ready.' end, 'href','/committees'),
    jsonb_build_object('key','financials','title','Add financial information','minutes',5,'done', v_payments_ready,
      'todo','Choose how you get paid, or tell us it is free, so delegates know how to pay.',
      'href','/financials?open=payment'),
    jsonb_build_object('key','applications','title','Launch applications','minutes',5,
      'done', v_apps_done,
      'todo', case
        when v_apps_done then 'Applications are open.'
        when v_roles_enabled > 0 then 'Your application windows have closed. Reopen a role or move its closing date.'
        when false then ''
        else 'Open applications for at least one role so delegates can apply.' end,
      'href','/settings?tab=applications'),
    jsonb_build_object('key','communications','title','Go to the Communications page','minutes',2,
      'done', v_comms_done,
      'todo','Take a look at the emails applicants get automatically and the questions they send you.',
      'href','/communications'),
    jsonb_build_object('key','chairs','title','List Chair, Secretariat or Staff Positions','minutes',3,
      -- 21 Oct 2026 (owner): a listing on the Job Board, a chair already invited or assigned, or "Do it Later" ticks it.
      'done', ((v_committees > 0 and v_missing_chairs < v_committees)
               or exists (select 1 from job_listings l where l.conference_id = c.id and l.published_at is not null)
               or c.jobs_later_at is not null),
      'todo', 'Post your chair, secretariat and staff roles on the Job Board so people can apply.',
      'href','/jobs'),
    jsonb_build_object('key','store','title','Visit the Store','minutes',1,
      'done', (c.store_visited_at is not null),
      'todo','See how Spotlights and email packs can bring your conference more delegates.',
      'href','/store')
  );

  select coalesce(jsonb_agg(i->>'key'), '[]'::jsonb), coalesce(sum((i->>'minutes')::int), 0)
    into v_ver_pending, v_ver_minutes
    from jsonb_array_elements(v_items) i
   where not (i->>'done')::boolean and (i->>'key') = any (v_ver_keys)
     and not ((i->>'key') = 'store'
              and exists (select 1 from checkmark_store_exempt e where e.conference_id = c.id));

  return jsonb_build_object(
    'conference_id', c.id, 'slug', c.slug, 'acronym', c.acronym, 'full_name', c.full_name,
    'display_name', v_display, 'year', v_year,
    'is_public', c.is_public, 'status', c.status,
    'expected_delegates', v_expected, 'seat_capacity', v_capacity, 'required_seats', v_required,
    'items', v_items,
    'setup_total', jsonb_array_length(v_items),
    'setup_done', (select count(*) from jsonb_array_elements(v_items) i
                    where (i->>'done')::boolean),
    'setup_complete', not exists (select 1 from jsonb_array_elements(v_items) i
                                   where not (i->>'done')::boolean),
    'verification_keys', to_jsonb(v_ver_keys),
    'verification_pending', v_ver_pending,
    'verification_minutes_left', v_ver_minutes,
    'verification_ready', (jsonb_array_length(v_ver_pending) = 0),
    'is_verified', c.is_verified,
    'verified_at', c.verified_at);
end;
$function$;
