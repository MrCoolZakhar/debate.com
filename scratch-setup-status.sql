-- Server-side mirror of the organiser dashboard's set-up priorities checklist
-- (src/app/manage/[slug]/page.tsx). Consumed by the `send-setup-nudges` edge
-- function, which pg_cron job `organiser-setup-nudges` runs daily at 09:00 and
-- which emails organisers the items that are still not done.
--
-- NOT APPLIED. Review, then apply as a migration.
--
-- Diff vs the currently deployed definition:
--   1. committees  — seat coverage bar drops from 90% to 70% of expected_delegates
--                    (the UI used to demand 100%; both now use 0.70).
--   2. chairs      — retitled "Invite chairs", href /committees, and a committee
--                    with a PENDING conference_chair_invites row now counts as
--                    handled alongside one with chair_user_ids set.
--   3. email       — retitled "Explore emails" for wording parity, but the
--                    CONDITION deliberately stays enabled_email_count > 0; see
--                    the comment at that item.
--   4. secretariat — one pending conference_organizer_invites row is enough.
--
-- Untouched: page, financials, delegate, publish, the setup_total/setup_done/
-- setup_complete tail, and the organizer-only access guard.

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
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_conference_organizer(p_conference_id) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO c FROM conferences WHERE id = p_conference_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Display name with its edition year.
  v_base := coalesce(nullif(btrim(c.acronym), ''), c.full_name);
  v_year := to_char(coalesce(c.start_date, c.end_date), 'YYYY');
  v_display := CASE
    WHEN v_year IS NULL THEN v_base
    WHEN v_base LIKE '%' || v_year || '%' THEN v_base          -- already says 2027
    WHEN v_base LIKE '%''' || right(v_year, 2) || '%' THEN v_base -- already says '27
    ELSE v_base || ' ' || v_year
  END;

  SELECT count(*) INTO v_committees FROM conference_committees WHERE conference_id = c.id;

  -- A dais is "missing a chair" only when nobody is assigned AND no invite is
  -- still out. Matches the dashboard's committeesNeedingChairs.
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
  -- 70% of expected, rounded up. Above that we do not flag, remind or list it:
  -- expected_delegates is an early guess and committees fill in over months.
  -- Mirrors SEAT_COVERAGE in src/app/manage/[slug]/page.tsx.
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
    jsonb_build_object('key','page','title','Set up your conference page',
      'done', (c.banner_url IS NOT NULL AND coalesce(btrim(c.description),'') <> ''),
      'todo','Add a banner image and a description delegates will actually read.','href','/settings?tab=conference'),
    jsonb_build_object('key','committees','title','Add committees with enough seats',
      'done', (v_committees > 0 AND (v_expected = 0 OR v_capacity >= v_required)),
      'todo', CASE WHEN v_committees = 0 THEN 'Create your committees and set their country lists.'
        WHEN v_expected > 0 AND v_capacity < v_required THEN
          format('You are expecting %s delegates but your committees only seat %s. About %s more seats would cover most of them.',
                 v_expected, v_capacity, v_required - v_capacity)
        ELSE 'Committees are ready.' END, 'href','/committees'),
    jsonb_build_object('key','chairs','title','Invite chairs',
      'done', (v_committees > 0 AND v_missing_chairs = 0),
      'todo', CASE WHEN v_committees = 0 THEN 'Add committees first, then invite a chair to each dais.'
        ELSE format('%s committee%s with nobody on the dais yet.', v_missing_chairs, CASE WHEN v_missing_chairs = 1 THEN '' ELSE 's' END) END,
      'href','/committees'),
    -- DIVERGENCE FROM THE UI, ON PURPOSE.
    -- The dashboard ticks this item once the organiser has VISITED the
    -- communications page, a flag held in that browser's localStorage
    -- (src/lib/emailsExplored.ts). A nudge email cannot read localStorage, so
    -- the server keeps the old, observable condition: at least one enabled
    -- template. Consequence: an organiser who explored emails but enabled none
    -- sees this ticked on the dashboard and still listed in the nudge. Do not
    -- "fix" it by inventing a DB flag here without deciding to persist the
    -- visit server-side in the app as well.
    jsonb_build_object('key','email','title','Explore emails','done', (v_emails > 0),
      'todo','Take a look at the emails you can send applicants automatically.','href','/communications'),
    -- One invite out is enough: accepting is not the organiser's to do.
    jsonb_build_object('key','secretariat','title','Add your secretariat',
      'done', (v_organizers > 1 OR v_org_invites > 0),
      'todo','Invite your co-organizers so you are not running this alone.','href','/settings?tab=organizers'),
    jsonb_build_object('key','financials','title','Add financial information','done', v_payments_ready,
      'todo','Choose how you get paid, so delegates have somewhere to pay. Even a free conference needs a method on file.','href','/financials/settings'),
    jsonb_build_object('key','delegate','title','Get your first delegate','done', (v_delegate_apps > 0),
      'todo','Share your conference link and get that first application in.','href','/applications'),
    jsonb_build_object('key','publish','title','Publish your conference','done', c.is_public,
      'todo','Publish it so delegates can find it on gavelling.com and apply.','href','/settings?tab=privacy')
  );

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
                                   WHERE NOT (i->>'done')::boolean AND i->>'key' <> 'publish'));
END;
$function$;
