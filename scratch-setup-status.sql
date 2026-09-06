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

CREATE OR REPLACE FUNCTION public.conference_setup_status(p_conference_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c                 conferences%ROWTYPE;
  v_committees      int;
  v_missing_chairs  int;
  v_capacity        int;
  v_expected        int;
  v_required        int;
  v_emails          int;
  v_organizers      int;
  v_org_invites     int;
  v_delegate_apps   int;
  v_payments_ready  boolean;
  v_items           jsonb;
  v_year            text;
  v_base            text;
  v_display         text;
  v_ver_keys        text[] := array['page','committees','chairs','email','secretariat','financials','publish'];
  v_ver_pending     jsonb;
  v_ver_minutes     int;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_conference_organizer(p_conference_id) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO c FROM conferences WHERE id = p_conference_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_base := coalesce(nullif(btrim(c.acronym), ''), c.full_name);
  v_year := to_char(coalesce(c.start_date, c.end_date), 'YYYY');
  v_display := CASE
    WHEN v_year IS NULL THEN v_base
    WHEN v_base LIKE '%' || v_year || '%' THEN v_base
    WHEN v_base LIKE '%''' || right(v_year, 2) || '%' THEN v_base
    WHEN v_base ~ ('(^|[^0-9])' || right(v_year, 2) || '$') THEN v_base
    ELSE v_base || ' ' || v_year
  END;

  SELECT count(*) INTO v_committees FROM conference_committees WHERE conference_id = c.id;

  SELECT count(*) INTO v_missing_chairs FROM conference_committees cc
   WHERE cc.conference_id = c.id
     AND (cc.chair_user_ids IS NULL OR cardinality(cc.chair_user_ids) = 0)
     AND NOT EXISTS (
       SELECT 1 FROM conference_chair_invites ci
        WHERE ci.committee_id = cc.id
          AND ci.conference_id = c.id
          AND ci.status = 'pending');

  SELECT coalesce(sum(s.delegation_size), 0) INTO v_capacity
    FROM conference_committees cc
    JOIN committee_country_slots s ON s.conference_committee_id = cc.id
   WHERE cc.conference_id = c.id;

  v_expected := coalesce(c.expected_delegates, 0);
  v_required := ceil(v_expected * 0.7);

  SELECT count(*) INTO v_emails FROM email_templates WHERE conference_id = c.id AND enabled = true;
  SELECT count(*) INTO v_organizers FROM conference_organizers WHERE conference_id = c.id;
  SELECT count(*) INTO v_org_invites FROM conference_organizer_invites
   WHERE conference_id = c.id AND status = 'pending';
  SELECT count(*) INTO v_delegate_apps FROM applications
   WHERE conference_id = c.id AND role IN ('delegate','head-delegate');

  v_payments_ready := CASE
    WHEN c.payment_method = 'manual' THEN
      coalesce(btrim(c.external_payment_url), '') <> '' OR coalesce(btrim(c.external_payment_note), '') <> ''
    WHEN c.payment_method = 'stripe' THEN c.connect_onboarding_status = 'complete'
    ELSE false END;

  v_items := jsonb_build_array(
    jsonb_build_object('key','page','title','Set up your conference page','minutes',5,
      'done', (c.banner_url IS NOT NULL AND coalesce(btrim(c.description),'') <> ''),
      'todo','Add a banner image and a description delegates will actually read.','href','/settings?tab=conference'),
    jsonb_build_object('key','committees','title','Add committees with enough seats','minutes',10,
      'done', (v_committees > 0 AND (v_expected = 0 OR v_capacity >= v_required)),
      'todo', CASE WHEN v_committees = 0 THEN 'Create your committees and set their country lists.'
        WHEN v_expected > 0 AND v_capacity < v_required THEN
          format('You are expecting %s delegates but your committees only seat %s. About %s more seats would cover most of them.',
                 v_expected, v_capacity, v_required - v_capacity)
        ELSE 'Committees are ready.' END, 'href','/committees'),
    jsonb_build_object('key','chairs','title','Invite chairs','minutes',3,
      'done', (v_committees > 0 AND v_missing_chairs < v_committees),
      'todo', CASE WHEN v_committees = 0 THEN 'Add committees first, then invite a chair to each dais.'
        WHEN v_missing_chairs = v_committees THEN 'Invite a chair to any one committee to get started.'
        WHEN v_missing_chairs > 0 THEN format('%s of %s still need someone on the dais.', v_missing_chairs, v_committees)
        ELSE 'Every committee has a chair assigned or invited.' END,
      'href','/committees'),
    jsonb_build_object('key','email','title','Explore emails','minutes',2,
      'done', (v_emails > 0 OR c.emails_explored_at IS NOT NULL),
      'todo','Take a look at the emails you can send applicants automatically.','href','/communications'),
    jsonb_build_object('key','secretariat','title','Add your secretariat','minutes',2,
      'done', (v_organizers > 1 OR v_org_invites > 0),
      'todo','Invite your co-organizers so you are not running this alone.','href','/settings?tab=organizers'),
    jsonb_build_object('key','financials','title','Add financial information','minutes',5,'done', v_payments_ready,
      'todo','Choose how you get paid, so delegates have somewhere to pay. Even a free conference needs a method on file.','href','/financials/settings'),
    jsonb_build_object('key','delegate','title','Get your first delegate','minutes',0,'done', (v_delegate_apps > 0),
      'todo','Share your conference link and get that first application in.','href','/applications'),
    jsonb_build_object('key','publish','title','Publish your conference','minutes',1,'done', c.is_public,
      'todo','Publish it so delegates can find it on gavelling.com and apply.','href','/settings?tab=privacy')
  );

  SELECT coalesce(jsonb_agg(i->>'key'), '[]'::jsonb), coalesce(sum((i->>'minutes')::int), 0)
    INTO v_ver_pending, v_ver_minutes
    FROM jsonb_array_elements(v_items) i
   WHERE NOT (i->>'done')::boolean AND (i->>'key') = ANY (v_ver_keys);

  RETURN jsonb_build_object(
    'conference_id', c.id, 'slug', c.slug, 'acronym', c.acronym, 'full_name', c.full_name,
    'display_name', v_display, 'year', v_year,
    'is_public', c.is_public, 'status', c.status,
    'expected_delegates', v_expected, 'seat_capacity', v_capacity, 'required_seats', v_required,
    'items', v_items,
    'setup_total', 7,
    'setup_done', (SELECT count(*) FROM jsonb_array_elements(v_items) i
                    WHERE (i->>'done')::boolean AND i->>'key' <> 'publish'),
    'setup_complete', NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) i
                                   WHERE NOT (i->>'done')::boolean AND i->>'key' <> 'publish'),
    'verification_keys', to_jsonb(v_ver_keys),
    'verification_pending', v_ver_pending,
    'verification_minutes_left', v_ver_minutes,
    'verification_ready', (jsonb_array_length(v_ver_pending) = 0),
    'is_verified', c.is_verified,
    'verified_at', c.verified_at);
END;
$function$;
