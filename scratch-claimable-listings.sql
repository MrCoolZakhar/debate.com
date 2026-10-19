-- scratch-claimable-listings.sql (19 Oct 2026, v2). APPLIED 19 Oct 2026: migrations gavelling_listings and featured_conferences_skip_listings; test passed.
-- Plan: docs/conferences/claimable-listings.md. Owner, 19 Oct 2026: "why are you making more database
-- changes? it's just another line, simply if it was uploaded by user or by gavelling".
--
-- DESIGN (replaces the v1 conference_listings tables):
--   A listing is an ordinary `conferences` row with listed_by = 'gavelling', owned by the Gavelling
--   staff profile (wearegavelling@gmail.com, profile 6e63d5d5-507c-4980-9869-9f407966f69c on 19 Oct
--   2026, looked up by email at call time, never hard-coded). Its committees and topics are ordinary
--   conference_committees rows. It shares the slug namespace because it IS a conference, so
--   conference_slug_ladder / conference_free_slug / conferenceSlugLadder are unchanged.
--
--   Claim   = transfer_listing_to_organiser(conference, user): organizer_id, the owner row and
--             listed_by move; nothing else (slug and URL stay).
--   Removal = set_gavelling_listing_hidden(conference, true): is_public false AND status 'archived',
--             because the daily job must never re-publish a removed listing (it skips archived rows).
--   Daily   = upsert_gavelling_listing(p jsonb), staff only (see _listing_staff for the MCP role).
--
-- NEW OBJECTS
--   conferences.listed_by      text not null default 'organiser' ('organiser' | 'gavelling')
--   conferences.listing_meta   jsonb, null for organiser rows. Public facts only:
--                              {checked_at, sources[{url}], banner_credit{author, source_url, license,
--                               license_url} | null, delegates_known, added_by 'claude'|'admin'}
--                              One column instead of banner_credit alone: the page must say "checked
--                              12 Oct 2026" and updated_at moves on every unrelated write
--                              (sync_display_secretariat updates the row), so it cannot carry that date.
--   trigger trg_guard_listing_columns    organisers cannot set listed_by / listing_meta
--   store_flags 'listings_live' (off)    while off, upsert keeps every listing private
--   functions _listing_staff, gavelling_listing_owner, gavelling_listing_key, listing_image_ok,
--             gavelling_listing_meets_bar, listings_live, upsert_gavelling_listing,
--             transfer_listing_to_organiser, set_gavelling_listing_hidden
--
-- NOTHING here edits an existing function. Listing rows stay out of every organiser email by DATA,
-- not by code: the Gavelling owner row of each listing gets setup_nudges_opted_out = true (honoured
-- by send-setup-nudges v13+, queue_checkmark_emails and queue_chair_setup_reminders) and
-- show_on_public = false (keeps "Gavelling Test" off display_secretariat). See the report for the
-- full side-effect list, including featured_conferences, which is NOT changed here.

-- ── 0. Columns ───────────────────────────────────────────────────────────────
-- A constant default: no table rewrite, every existing row reads 'organiser'.
alter table public.conferences
  add column if not exists listed_by text not null default 'organiser'
    constraint conferences_listed_by_check check (listed_by in ('organiser', 'gavelling')),
  add column if not exists listing_meta jsonb
    constraint conferences_listing_meta_shape check (listing_meta is null or jsonb_typeof(listing_meta) = 'object');

comment on column public.conferences.listed_by is
  'organiser = made by its organisers; gavelling = a listing Gavelling made from the conference''s public website (owned by the wearegavelling@gmail.com profile until transfer_listing_to_organiser). Written only by staff (trg_guard_listing_columns).';
comment on column public.conferences.listing_meta is
  'Listings only, public facts: {checked_at, sources[{url}], banner_credit, delegates_known, added_by}. Null for organiser rows.';

-- ── 1. Only staff write listed_by / listing_meta ─────────────────────────────
-- Same shape as guard_organiser_visit_stamps. Without it an organiser could set listed_by =
-- 'gavelling' on their own row and the daily upsert would then match and overwrite it.
-- Not SECURITY DEFINER on purpose: current_user is the caller (postgres inside our RPCs).
create or replace function public.guard_listing_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') or public.is_platform_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.listed_by    := 'organiser';
    new.listing_meta := null;
  else
    new.listed_by    := old.listed_by;
    new.listing_meta := old.listing_meta;
  end if;
  return new;
end $$;
revoke all on function public.guard_listing_columns() from public, anon, authenticated;

drop trigger if exists trg_guard_listing_columns on public.conferences;
create trigger trg_guard_listing_columns
  before insert or update on public.conferences
  for each row execute function public.guard_listing_columns();

-- ── 2. The switch ────────────────────────────────────────────────────────────
insert into public.store_flags (key, on_, note)
values ('listings_live', false,
        'Claimable listings (19 Oct 2026). Off: upsert_gavelling_listing keeps every listing private. Turn on only once the listing UI (Not on Gavelling yet mark, no Apply, no contact email, no Delegates stat) is in production, then run the publish statement at the end of scratch-claimable-listings.sql.')
on conflict (key) do nothing;

create or replace function public.listings_live()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public._store_flag('listings_live');
$$;
revoke all on function public.listings_live() from public;
grant execute on function public.listings_live() to anon, authenticated, service_role;

-- ── 3. Helpers ───────────────────────────────────────────────────────────────
-- Who may run the listing RPCs: a platform admin (signed in on /admin), the service role
-- (edge functions / server routes with the service key), or a direct database session as
-- postgres. The Supabase MCP execute_sql runs as current_user = session_user = 'postgres'
-- (not superuser, BYPASSRLS), with NO JWT: auth.uid() and auth.role() are null (checked
-- 19 Oct 2026). Every PostgREST call connects as 'authenticator', so session_user = 'postgres'
-- can only be a direct DB connection (MCP, SQL editor, pg_cron). Inside a SECURITY DEFINER
-- function current_user is the owner, so session_user is the one to test.
create or replace function public._listing_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin()
      or coalesce(auth.role(), '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin');
$$;
revoke all on function public._listing_staff() from public, anon, authenticated;

-- The Gavelling staff profile that owns every listing.
create or replace function public.gavelling_listing_owner()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id from public.profiles p
   where lower(btrim(p.email)) = 'wearegavelling@gmail.com'
   limit 1;
$$;
revoke all on function public.gavelling_listing_owner() from public, anon, authenticated;

-- Dedupe key: normalised acronym (its trailing edition digits dropped, so "GAMUN", "GAMUN 2026"
-- and "GAMUN'26" agree) or, with no acronym, the slugified full name; plus the start year
-- ('tbd' without one). Same normalisers as the slug ladder.
create or replace function public.gavelling_listing_key(p_acronym text, p_full_name text, p_year int)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
           nullif(case
                    when p_year is null then s.a
                    else coalesce(nullif(regexp_replace(
                           s.a, '(' || p_year::text || '|' || lpad((p_year % 100)::text, 2, '0') || ')$', ''), ''), s.a)
                  end, ''),
           public.conference_slugify_name(p_full_name, 60))
         || ':' || coalesce(p_year::text, 'tbd')
    from (select public.conference_normalize_acronym(p_acronym) as a) s;
$$;
grant execute on function public.gavelling_listing_key(text, text, int) to anon, authenticated, service_role;

-- Logos and banners must be served from OUR public bucket (or a /banners/ preset), never
-- hot-linked from the conference's site or Wikimedia: a hot-link sends every visitor's IP to a
-- third party (CLAUDE.md §3, no third parties). LEAD DECISION: the MCP cannot upload files, so
-- the daily job needs another way to copy images into conference-assets/listings/ (a server
-- route with the service key). Relaxing this is a one-line change here.
create or replace function public.listing_image_ok(p_url text, p_allow_preset boolean)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  -- Owner decision (19 Oct 2026): the conference's own logo/banner (or a free city photo) may be
  -- stored as its original https address; the site serves it through its own image service
  -- (next/image), so a visitor's browser never contacts the third party.
  select p_url is null
      or (length(p_url) <= 500 and p_url ~ '^https://[^\s]+$')
      or (p_allow_preset and p_url ~ '^/banners/[a-z0-9-]+\.(jpg|jpeg|png|webp)$');
$$;
revoke all on function public.listing_image_ok(text, boolean) from public, anon, authenticated;

-- The quality bar: a listing is published only when this holds (and listings_live() is on).
-- Real dates, a place (or online), a website or Instagram, and 2+ committees or a 60+ word summary.
-- Past listings are kept (owner): nothing here looks at today's date.
create or replace function public.gavelling_listing_meets_bar(p_conference uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select c.listed_by = 'gavelling'
       and not coalesce(c.dates_tbd, false)
       and c.start_date is not null
       and (c.format = 'online' or (btrim(c.city) <> '' and btrim(c.country) <> ''))
       and (c.website_url is not null or c.instagram_url is not null)
       and ((select count(*) from public.conference_committees cc where cc.conference_id = c.id) >= 2
            or coalesce(array_length(regexp_split_to_array(btrim(coalesce(c.description, '')), '\s+'), 1), 0) >= 60)
      from public.conferences c
     where c.id = p_conference), false);
$$;
revoke all on function public.gavelling_listing_meets_bar(uuid) from public;
grant execute on function public.gavelling_listing_meets_bar(uuid) to anon, authenticated, service_role;

-- ── 4. The daily job's one write ─────────────────────────────────────────────
-- upsert_gavelling_listing(p jsonb) → {ok, id, slug, created, is_public, meets_bar}
--                                  or {ok:false, reason: on_gavelling | organiser_owned | removed, ...}
-- p: { id?            update this listing (admin edit); otherwise matched by the dedupe key
--      full_name*      3..160            acronym*   1..20
--      start_date, end_date ('YYYY-MM-DD'), dates_tbd
--      format*         in-person | online | hybrid  (in_person accepted)
--      city, country   ≤ 80 each (country as our country name, for hubs and flags)
--      student_level   school | university | both  (high_school accepted; default both)
--      expected_delegates  1..100000, only when the site publishes it (else 1, delegates_known false)
--      summary         our own words, ≤ 1200 characters → conferences.description
--      website_url / instagram_url   https, at least one; Instagram must be instagram.com
--      logo_url, banner_url, banner_credit {author, source_url, license, license_url?} (city photo)
--      sources         [{url}] ≤ 20, https       checked_at   default now()
--      committees      [{name, abbreviation?, type?, topics?[]}] ≤ 60; written only when the key is
--                      present (replaces the listing's committees); topics: first 3 kept (the
--                      conference_committees CHECK allows 0..3) }
-- Never touches a row whose listed_by is 'organiser', or an archived (removed or held) listing.
-- Publishes (is_public true, status 'public') only when the bar holds and listings_live() is on;
-- otherwise the row stays private for review in /admin. Sends no email.
create or replace function public.upsert_gavelling_listing(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner   uuid;
  v_row     public.conferences%rowtype;
  v_found   boolean := false;
  v_id      uuid;
  v_slug    text;
  v_created boolean := false;
  v_full    text := btrim(coalesce(p->>'full_name', ''));
  v_acr     text := btrim(coalesce(p->>'acronym', ''));
  v_tbd     boolean := coalesce((p->>'dates_tbd')::boolean, false);
  v_start   date;
  v_end     date;
  v_year    int;
  v_key     text;
  v_format  text := replace(lower(btrim(coalesce(p->>'format', ''))), '_', '-');
  v_level   text := lower(btrim(coalesce(p->>'student_level', '')));
  v_city    text := btrim(coalesce(p->>'city', ''));
  v_country text := btrim(coalesce(p->>'country', ''));
  v_expect  int;
  v_summary text := nullif(btrim(coalesce(p->>'summary', '')), '');
  v_web     text := nullif(btrim(coalesce(p->>'website_url', '')), '');
  v_insta   text := nullif(btrim(coalesce(p->>'instagram_url', '')), '');
  v_logo    text := nullif(btrim(coalesce(p->>'logo_url', '')), '');
  v_banner  text := nullif(btrim(coalesce(p->>'banner_url', '')), '');
  v_credit  jsonb := nullif(p->'banner_credit', 'null'::jsonb);
  v_sources jsonb := coalesce(nullif(p->'sources', 'null'::jsonb), '[]'::jsonb);
  v_checked timestamptz := coalesce(nullif(p->>'checked_at', '')::timestamptz, now());
  v_comms   jsonb := nullif(p->'committees', 'null'::jsonb);
  v_meta    jsonb;
  v_el      jsonb;
  v_topics  text[];
  v_type    text;
  v_seen    text[] := '{}';
  v_bar     boolean;
  v_pub     boolean;
  v_other   text;
  v_try     int;
  https_re  constant text := '^https://[^\s/?#]+\.[^\s/?#]+([/?#]\S*)?$';
begin
  if not public._listing_staff() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'p must be a JSON object';
  end if;
  v_owner := public.gavelling_listing_owner();
  if v_owner is null then
    raise exception 'the Gavelling profile (wearegavelling@gmail.com) was not found';
  end if;

  -- ── validate ──
  if length(v_full) not between 3 and 160 then raise exception 'full_name must be 3 to 160 characters'; end if;
  if length(v_acr) not between 1 and 20 then raise exception 'acronym must be 1 to 20 characters'; end if;
  if v_format not in ('in-person', 'online', 'hybrid') then raise exception 'format must be in-person, online or hybrid'; end if;
  v_level := case v_level when '' then 'both' when 'high_school' then 'school' when 'high-school' then 'school' else v_level end;
  if v_level not in ('school', 'university', 'both') then raise exception 'student_level must be school, university or both'; end if;
  if length(v_city) > 80 or length(v_country) > 80 then raise exception 'city and country are at most 80 characters'; end if;

  if not v_tbd then
    v_start := nullif(p->>'start_date', '')::date;
    v_end   := coalesce(nullif(p->>'end_date', '')::date, v_start);
    if v_start is null then v_tbd := true; v_end := null; end if;
  end if;
  if v_start is not null and (v_end < v_start or v_end > v_start + 31) then
    raise exception 'end_date must be on or after start_date and within 31 days of it';
  end if;
  if v_start is not null and extract(year from v_start) not between 2000 and 2100 then
    raise exception 'start_date year looks wrong';
  end if;

  if p ? 'expected_delegates' and nullif(p->>'expected_delegates', '') is not null then
    v_expect := (p->>'expected_delegates')::int;
    if v_expect not between 1 and 100000 then raise exception 'expected_delegates must be 1 to 100000'; end if;
  end if;

  if v_summary is not null and length(v_summary) > 1200 then raise exception 'summary is at most 1200 characters'; end if;
  if v_web is null and v_insta is null then raise exception 'website_url or instagram_url is required'; end if;
  if v_web is not null and (length(v_web) > 500 or v_web !~ https_re) then raise exception 'website_url must be an https URL'; end if;
  if v_insta is not null and (length(v_insta) > 300 or v_insta !~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]+/?$') then
    raise exception 'instagram_url must be https://instagram.com/<profile>';
  end if;
  if not public.listing_image_ok(v_logo, false) then raise exception 'logo_url must be an https address'; end if;
  if not public.listing_image_ok(v_banner, true) then raise exception 'banner_url must be an https address or a /banners/ preset'; end if;

  if v_credit is not null then
    if v_banner is null then raise exception 'banner_credit needs a banner_url'; end if;
    if jsonb_typeof(v_credit) <> 'object'
       or length(btrim(coalesce(v_credit->>'author', ''))) not between 1 and 120
       or coalesce(v_credit->>'source_url', '') !~ https_re
       or length(btrim(coalesce(v_credit->>'license', ''))) not between 1 and 60
       or (nullif(v_credit->>'license_url', '') is not null and v_credit->>'license_url' !~ https_re) then
      raise exception 'banner_credit must be {author, source_url (https), license, license_url? (https)}';
    end if;
    v_credit := jsonb_build_object('author', btrim(v_credit->>'author'), 'source_url', v_credit->>'source_url',
                                   'license', btrim(v_credit->>'license'), 'license_url', nullif(v_credit->>'license_url', ''));
  end if;

  if jsonb_typeof(v_sources) <> 'array' or jsonb_array_length(v_sources) > 20 then
    raise exception 'sources must be an array of at most 20 {url}';
  end if;
  for v_el in select value from jsonb_array_elements(v_sources) loop
    if jsonb_typeof(v_el) <> 'object' or coalesce(v_el->>'url', '') !~ https_re or length(v_el->>'url') > 500 then
      raise exception 'every source must be {url} with an https URL';
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('url', value->>'url')), '[]'::jsonb) into v_sources
    from jsonb_array_elements(v_sources);
  if v_checked > now() + interval '1 day' then raise exception 'checked_at is in the future'; end if;

  if v_comms is not null then
    if jsonb_typeof(v_comms) <> 'array' or jsonb_array_length(v_comms) > 60 then
      raise exception 'committees must be an array of at most 60';
    end if;
    for v_el in select value from jsonb_array_elements(v_comms) loop
      if jsonb_typeof(v_el) <> 'object'
         or length(btrim(coalesce(v_el->>'name', ''))) not between 1 and 120
         or length(btrim(coalesce(v_el->>'abbreviation', ''))) > 20
         or (v_el ? 'topics' and jsonb_typeof(v_el->'topics') not in ('array', 'null')) then
        raise exception 'every committee must be {name 1..120, abbreviation ≤ 20, topics[]}';
      end if;
      if jsonb_typeof(v_el->'topics') = 'array' then
        if jsonb_array_length(v_el->'topics') > 6
           or exists (select 1 from jsonb_array_elements(v_el->'topics') t
                       where jsonb_typeof(t.value) <> 'string' or length(btrim(t.value #>> '{}')) not between 1 and 300) then
          raise exception 'committee topics must be at most 6 strings of 1 to 300 characters';
        end if;
      end if;
    end loop;
  end if;

  v_year := public.conference_slug_year(v_start, v_end, v_tbd);
  v_key  := public.gavelling_listing_key(v_acr, v_full, v_year);

  -- One listing write at a time (the daily job, an admin edit): no two inserts race for a key.
  perform pg_advisory_xact_lock(hashtext('upsert_gavelling_listing'));

  -- ── find the row ──
  if nullif(p->>'id', '') is not null then
    select * into v_row from public.conferences where id = (p->>'id')::uuid for update;
    if not found then raise exception 'no conference with that id'; end if;
    v_found := true;
  else
    select * into v_row from public.conferences c
     where c.listed_by = 'gavelling'
       and public.gavelling_listing_key(c.acronym, c.full_name,
             public.conference_slug_year(c.start_date, c.end_date, c.dates_tbd)) = v_key
     order by c.created_at
     limit 1
     for update;
    v_found := found;
    if not v_found then
      -- Already on Gavelling, made by its organisers (or claimed earlier): never list it twice.
      select c.slug into v_other from public.conferences c
       where c.listed_by = 'organiser'
         and not public.conference_is_test(c.slug, c.full_name, c.is_demo)
         and public.gavelling_listing_key(c.acronym, c.full_name,
               public.conference_slug_year(c.start_date, c.end_date, c.dates_tbd)) = v_key
       limit 1;
      if v_other is not null then
        return jsonb_build_object('ok', false, 'reason', 'on_gavelling', 'slug', v_other);
      end if;
    end if;
  end if;

  if v_found then
    if v_row.listed_by <> 'gavelling' or v_row.organizer_id is distinct from v_owner then
      return jsonb_build_object('ok', false, 'reason', 'organiser_owned', 'id', v_row.id, 'slug', v_row.slug);
    end if;
    if v_row.status = 'archived' then
      return jsonb_build_object('ok', false, 'reason', 'removed', 'id', v_row.id, 'slug', v_row.slug);
    end if;
  end if;

  v_meta := jsonb_build_object(
    'checked_at', v_checked,
    'sources', v_sources,
    'banner_credit', v_credit,
    'delegates_known', v_expect is not null
                       or (v_found and coalesce((v_row.listing_meta->>'delegates_known')::boolean, false)),
    'added_by', case when v_found then coalesce(v_row.listing_meta->>'added_by', 'claude')
                     when public.is_platform_admin() then 'admin' else 'claude' end);

  -- ── write the row ──
  if not v_found then
    v_id := gen_random_uuid();
    for v_try in 1..3 loop
      v_slug := public.conference_free_slug(v_id, v_acr, v_full, v_year);
      if v_slug is null then raise exception 'could not find a free slug'; end if;
      begin
        insert into public.conferences (
          id, slug, organizer_id, full_name, acronym, contact_email, student_level,
          start_date, end_date, dates_tbd, country, city, format, expected_delegates,
          description, website_url, instagram_url, logo_url, banner_url,
          is_public, status, predecessor_conference_id, listed_by, listing_meta)
        values (
          v_id, v_slug, v_owner, v_full, v_acr, 'wearegavelling@gmail.com', v_level,
          v_start, v_end, v_tbd, v_country, v_city, v_format, coalesce(v_expect, 1),
          v_summary, v_web, v_insta, v_logo, v_banner,
          false, 'private', null, 'gavelling', v_meta);
        v_created := true;
        exit;
      exception when unique_violation then
        -- A wizard insert took the rung between conference_free_slug and here. Next rung.
        if v_try = 3 then raise; end if;
      end;
    end loop;
    -- handle_new_conference made the owner row and seven CLOSED role configs (no Apply).
  else
    v_id := v_row.id;
    v_slug := v_row.slug;
    update public.conferences set
      full_name = v_full, acronym = v_acr, student_level = v_level,
      start_date = v_start, end_date = v_end, dates_tbd = v_tbd,
      country = v_country, city = v_city, format = v_format,
      expected_delegates = coalesce(v_expect, expected_delegates),
      description = v_summary, website_url = v_web, instagram_url = v_insta,
      logo_url = v_logo, banner_url = v_banner, listing_meta = v_meta
     where id = v_id
     returning slug into v_slug;   -- an acronym change re-mints the slug (trg_conference_reslug_on_rename)
  end if;

  -- The Gavelling owner row: no organiser emails (setup nudges, checkmark, chair set-up) and not
  -- shown as the secretariat on the public page. Idempotent.
  update public.conference_organizers
     set setup_nudges_opted_out = true, show_on_public = false
   where conference_id = v_id and user_id = v_owner
     and (not setup_nudges_opted_out or show_on_public);

  -- ── committees (only when sent) ──
  if v_comms is not null then
    delete from public.conference_committees where conference_id = v_id and session_id is null;
    for v_el in select value from jsonb_array_elements(v_comms) loop
      continue when lower(btrim(v_el->>'name')) = any (v_seen);
      v_seen := v_seen || lower(btrim(v_el->>'name'));
      select coalesce(array_agg(btrim(t.value #>> '{}') order by t.ord), '{}')
        into v_topics
        from jsonb_array_elements(coalesce(nullif(v_el->'topics', 'null'::jsonb), '[]'::jsonb)) with ordinality t(value, ord)
       where t.ord <= 3;
      v_type := lower(btrim(coalesce(v_el->>'type', '')));
      if v_type not in ('general-assembly', 'specialised', 'crisis', 'custom', 'press') then
        v_type := 'general-assembly';
      end if;
      -- Mirrors pressAwareCommitteeType (src/lib/press.ts).
      if v_type not in ('press', 'custom')
         and (v_el->>'name' ~* '\mpress\M|\mjournalis|\mmedia\s+(corps|room|desk)\M|\mnewsroom\M'
              or btrim(coalesce(v_el->>'abbreviation', '')) ~* '^IPC$') then
        v_type := 'press';
      end if;
      insert into public.conference_committees (conference_id, name, abbreviation, committee_type, topics, total_slots)
      values (v_id, btrim(v_el->>'name'), nullif(btrim(coalesce(v_el->>'abbreviation', '')), ''), v_type, v_topics, 1);
    end loop;
  end if;

  -- ── publish or hold ──
  v_bar := public.gavelling_listing_meets_bar(v_id);
  v_pub := v_bar and public.listings_live();
  update public.conferences
     set is_public = v_pub, status = case when v_pub then 'public' else 'private' end
   where id = v_id and (is_public is distinct from v_pub or status <> case when v_pub then 'public' else 'private' end);

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug, 'created', v_created,
                            'is_public', v_pub, 'meets_bar', v_bar);
end $$;
revoke all on function public.upsert_gavelling_listing(jsonb) from public, anon;
grant execute on function public.upsert_gavelling_listing(jsonb) to authenticated, service_role;  -- refuses non-staff inside

-- ── 5. Claim: hand a listing to its organiser ────────────────────────────────
-- Manual only (owner): the organiser emails us, Peter checks, then calls this from /admin.
-- One transaction: organizer_id, the owner row (setup emails and the public secretariat back on,
-- as for any new owner) and listed_by move. The slug, URL, committees, description and images
-- stay. contact_email moves to the claimer only while it is still our address.
-- Queues ONE email to the claimer ("You now manage {name} on Gavelling"), skipped when the
-- transaction sets gavelling.listing_emails_off = 'on' (the line marked SKIP below).
create or replace function public.transfer_listing_to_organiser(p_conference uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c        public.conferences%rowtype;
  v_owner  uuid;
  v_email  text;
  v_first  text;
  v_name   text;
  v_n      int;
  v_html   text;
  v_body   text;
  v_queued boolean := false;
  v_site   constant text := 'https://gavelling.com';
begin
  if not public._listing_staff() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  v_owner := public.gavelling_listing_owner();

  select * into c from public.conferences where id = p_conference for update;
  if not found then raise exception 'conference not found'; end if;
  if c.listed_by <> 'gavelling' then raise exception 'this conference is not a Gavelling listing'; end if;
  if p_user is null or p_user = v_owner then raise exception 'choose the organiser''s own account'; end if;

  select nullif(btrim(p.email), ''), split_part(btrim(coalesce(p.display_name, '')), ' ', 1)
    into v_email, v_first
    from public.profiles p where p.id = p_user;
  if not found then raise exception 'no account with that id'; end if;
  if v_email is null then raise exception 'that account has no email address'; end if;

  -- The claimer may already be on the team: their row goes so the owner row can become theirs.
  delete from public.conference_organizers where conference_id = p_conference and user_id = p_user;
  update public.conference_organizers
     set user_id = p_user, setup_nudges_opted_out = false, show_on_public = true
   where conference_id = p_conference and user_id = c.organizer_id and role = 'owner';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    insert into public.conference_organizers (conference_id, user_id, role) values (p_conference, p_user, 'owner');
  end if;
  delete from public.conference_organizers where conference_id = p_conference and user_id = v_owner;

  update public.conferences
     set organizer_id  = p_user,
         listed_by     = 'organiser',
         contact_email = case when lower(btrim(contact_email)) = 'wearegavelling@gmail.com' then v_email else contact_email end,
         listing_meta  = coalesce(listing_meta, '{}'::jsonb) || jsonb_build_object('transferred_at', now())
   where id = p_conference;

  if coalesce(current_setting('gavelling.listing_emails_off', true), '') <> 'on' then   -- SKIP for tests
    v_name := coalesce(nullif(btrim(c.acronym), ''), c.full_name);
    v_body := 'Hi ' || coalesce(nullif(v_first, ''), 'there') || ',' || chr(10) || chr(10)
           || 'You now manage ' || c.full_name || ' on Gavelling. Your page keeps its address: '
           || v_site || '/conferences/' || c.slug || chr(10) || chr(10)
           || 'Finish setting it up (roles, fees and how people pay), then open applications: '
           || v_site || '/manage/' || c.slug || chr(10) || chr(10)
           || 'Questions? Reply to this email. It reaches the Gavelling team directly.';
    v_html := public.gavelling_email_html(
      p_conference,
      'You now manage ' || v_name || ' on Gavelling',
      array[
        'Hi ' || coalesce(nullif(v_first, ''), 'there') || ',',
        '**' || c.full_name || '** is now yours on Gavelling. Your page keeps the same address, so every link to it still works.',
        'Next, set up your roles, fees and how people pay, then open applications. Organisers never pay anything.'
      ],
      null,
      'Finish setting up', v_site || '/manage/' || c.slug,
      '<strong>Questions?</strong> Reply to this email. It reaches the Gavelling team directly.');
    insert into public.email_outbox (conference_id, recipient_application_id, recipient_email, reply_to,
                                     subject, body, body_html, status)
    values (null, null, v_email, 'wearegavelling@gmail.com',
            'You now manage ' || v_name || ' on Gavelling', v_body, v_html, 'pending');
    v_queued := true;
  end if;

  return jsonb_build_object('ok', true, 'conference_id', p_conference, 'slug', c.slug, 'email_queued', v_queued);
end $$;
revoke all on function public.transfer_listing_to_organiser(uuid, uuid) from public, anon;
grant execute on function public.transfer_listing_to_organiser(uuid, uuid) to authenticated, service_role;

-- ── 6. Removal (and hold) ────────────────────────────────────────────────────
-- Removal requests come by email like claims. Hidden = is_public false AND status 'archived', so
-- the daily upsert (which skips archived rows) can never bring it back. Unhide = status back to
-- private, then published again only if the bar holds and listings_live() is on.
create or replace function public.set_gavelling_listing_hidden(p_conference uuid, p_hidden boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c     public.conferences%rowtype;
  v_pub boolean;
begin
  if not public._listing_staff() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  select * into c from public.conferences where id = p_conference for update;
  if not found then raise exception 'conference not found'; end if;
  if c.listed_by <> 'gavelling' then raise exception 'this conference is not a Gavelling listing'; end if;

  if p_hidden then
    update public.conferences set is_public = false, status = 'archived' where id = p_conference;
    v_pub := false;
  else
    v_pub := public.gavelling_listing_meets_bar(p_conference) and public.listings_live();
    update public.conferences
       set is_public = v_pub, status = case when v_pub then 'public' else 'private' end
     where id = p_conference;
  end if;
  return jsonb_build_object('ok', true, 'id', p_conference, 'slug', c.slug, 'hidden', p_hidden, 'is_public', v_pub);
end $$;
revoke all on function public.set_gavelling_listing_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_gavelling_listing_hidden(uuid, boolean) to authenticated, service_role;

-- ── 7. When the owner turns listings on ──────────────────────────────────────
-- Run ONCE, by hand, after: update store_flags set on_ = true where key = 'listings_live';
--
--   update public.conferences c set is_public = true, status = 'public'
--    where c.listed_by = 'gavelling' and c.status = 'private'
--      and public.gavelling_listing_meets_bar(c.id);
--
-- (Turning the flag off again does not unpublish anything by itself; the next upsert of each
-- listing does. To pull everything at once: update ... set is_public = false, status = 'private'
-- where listed_by = 'gavelling' and status = 'public'.)

-- ── 8. NOT applied here, recommended (lead decides) ─────────────────────────
-- featured_conferences() fills the homepage rail and the region placements with every public,
-- dated, upcoming, non-test conference, so published listings would fill the homepage. The plan
-- says listings never reach the homepage rail or spotlights. One line in its `fill` CTE:
--       and c.listed_by = 'organiser'
-- (Also decide whether compose_daily_platform_report should count listings; it emails only the team.)


-- ════════════════════════════════════════════════════════════════════════════
-- TEST (run AFTER applying, as ONE statement; it always ends in an error, and that error is the
-- result: "LISTINGS TEST PASSED ..." means every check held. A DO block is one statement, so
-- the raise rolls EVERYTHING back, including the flag flip and every row it made. No BEGIN /
-- ROLLBACK around it on purpose: through the MCP a failure in the middle of a BEGIN ... ROLLBACK
-- script would skip the ROLLBACK and leave an open transaction holding locks on conferences.)
--
-- Email: the only function here that writes email_outbox is transfer_listing_to_organiser, and
-- the test sets gavelling.listing_emails_off = 'on' first (its SKIP line), then asserts that no
-- email_outbox row was created in the transaction. Even without that, a raise rolls the rows back
-- before send-emails could read them. Nothing here calls a live sending function.
-- ════════════════════════════════════════════════════════════════════════════
/*
do $test$
declare
  r jsonb; r2 jsonb; v_id uuid; v_id2 uuid; v_slug text; v_user uuid; v_owner uuid := public.gavelling_listing_owner();
  v_n int;
  base jsonb := jsonb_build_object(
    'full_name', 'Zeta Quillon Xanadu Model United Nations', 'acronym', 'ZQXMUN',
    'start_date', '2031-03-14', 'end_date', '2031-03-16', 'format', 'in-person',
    'city', 'Lisbon', 'country', 'Portugal', 'student_level', 'high_school',
    'summary', 'A short factual summary written in our own words.',
    'website_url', 'https://zqxmun.example.org', 'sources', jsonb_build_array(jsonb_build_object('url', 'https://zqxmun.example.org/committees')),
    'committees', jsonb_build_array(
      jsonb_build_object('name', 'General Assembly First Committee', 'abbreviation', 'DISEC', 'topics', jsonb_build_array('Topic A', 'Topic B', 'Topic C', 'Topic D')),
      jsonb_build_object('name', 'International Press Corps', 'abbreviation', 'IPC'),
      jsonb_build_object('name', 'general assembly first committee')));   -- duplicate name, dropped
begin
  perform set_config('gavelling.listing_emails_off', 'on', true);
  update public.store_flags set on_ = true where key = 'listings_live';

  -- 1. insert: slug from the ladder, committees written, published (bar met, flag on)
  r := public.upsert_gavelling_listing(base);
  if not (r->>'ok')::boolean or not (r->>'created')::boolean then raise exception 'T1 insert: %', r; end if;
  v_id := (r->>'id')::uuid; v_slug := r->>'slug';
  if v_slug <> 'zqxmun2031' then raise exception 'T1 slug: %', v_slug; end if;
  if not (r->>'is_public')::boolean then raise exception 'T1 not published: %', r; end if;
  select count(*) into v_n from public.conference_committees where conference_id = v_id;
  if v_n <> 2 then raise exception 'T1 committees: %', v_n; end if;
  if (select committee_type from public.conference_committees where conference_id = v_id and abbreviation = 'IPC') <> 'press' then
    raise exception 'T1 press type'; end if;
  if (select cardinality(topics) from public.conference_committees where conference_id = v_id and abbreviation = 'DISEC') <> 3 then
    raise exception 'T1 topics not capped at 3'; end if;
  if not exists (select 1 from public.conference_organizers where conference_id = v_id and user_id = v_owner
                  and role = 'owner' and setup_nudges_opted_out and not show_on_public) then
    raise exception 'T1 owner row'; end if;
  if exists (select 1 from public.application_role_configs where conference_id = v_id and is_enabled) then
    raise exception 'T1 a role is open'; end if;
  if (select student_level from public.conferences where id = v_id) <> 'school' then raise exception 'T1 level alias'; end if;

  -- 2. same conference, acronym written with its edition: same row, no second listing
  r2 := public.upsert_gavelling_listing(base || jsonb_build_object('acronym', 'ZQXMUN 2031', 'city', 'Porto'));
  if (r2->>'id')::uuid <> v_id or (r2->>'created')::boolean then raise exception 'T2 dedupe: %', r2; end if;
  -- (the acronym change re-mints the slug through trg_conference_reslug_on_rename; the old one becomes an alias)

  -- 3. below the bar: no committees key, short summary, a different year → a new private row
  r := public.upsert_gavelling_listing((base - 'committees') || jsonb_build_object('start_date', '2032-03-14', 'end_date', '2032-03-15'));
  if (r->>'is_public')::boolean or (r->>'meets_bar')::boolean then raise exception 'T3 bar: %', r; end if;
  v_id2 := (r->>'id')::uuid;

  -- 4. validation refuses
  begin
    perform public.upsert_gavelling_listing(base || jsonb_build_object('website_url', 'http://insecure.example.org'));
    raise exception 'T4 http accepted';
  exception when raise_exception then
    if sqlerrm like 'T4%' then raise; end if;
  end;
  begin
    perform public.upsert_gavelling_listing(base || jsonb_build_object('logo_url', 'http://zqxmun.example.org/logo.png'));
    raise exception 'T4 http logo accepted';
  exception when raise_exception then
    if sqlerrm like 'T4%' then raise; end if;
  end;

  -- 5. hide (removal): the upsert never brings it back
  perform public.set_gavelling_listing_hidden(v_id2, true);
  r := public.upsert_gavelling_listing((base - 'committees') || jsonb_build_object('start_date', '2032-03-14', 'end_date', '2032-03-15'));
  if r->>'reason' <> 'removed' then raise exception 'T5 removed: %', r; end if;

  -- 6. claim: transfer to an existing account (a platform admin; rolled back, email skipped)
  select user_id into v_user from public.platform_admins where user_id <> v_owner limit 1;
  r := public.transfer_listing_to_organiser(v_id, v_user);
  if (r->>'email_queued')::boolean then raise exception 'T6 email was queued'; end if;
  if not exists (select 1 from public.conferences where id = v_id and organizer_id = v_user and listed_by = 'organiser') then
    raise exception 'T6 conference row'; end if;
  if not exists (select 1 from public.conference_organizers where conference_id = v_id and user_id = v_user and role = 'owner')
     or exists (select 1 from public.conference_organizers where conference_id = v_id and user_id = v_owner) then
    raise exception 'T6 organiser rows'; end if;

  -- 7. the daily job can no longer touch it
  r := public.upsert_gavelling_listing(base);
  if r->>'reason' not in ('on_gavelling', 'organiser_owned') then raise exception 'T7 claimed row touched: %', r; end if;

  -- 8. no email row was created in this transaction
  select count(*) into v_n from public.email_outbox where created_at = now();
  if v_n <> 0 then raise exception 'T8 % email_outbox rows created', v_n; end if;

  raise exception 'LISTINGS TEST PASSED (slug %, everything rolled back)', v_slug;
end $test$;
*/
