-- scratch-claimable-listings.sql (19 Oct 2026). DRAFT, NOT APPLIED.
-- Plan: docs/conferences/claimable-listings.md. Waiting on Peter's decisions.
-- Shapes only: RPC bodies are sketched, to be written and tested (rolled-back
-- transactions) when the plan is approved. Nothing here sends email directly;
-- the claim code and the approval email go through email_outbox as usual.

-- ── Listings ────────────────────────────────────────────────────────────────
create table public.conference_listings (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique,                       -- shares the conference slug namespace
  full_name        text not null check (length(full_name) between 3 and 160),
  acronym          text check (acronym is null or length(acronym) <= 20),
  start_date       date,
  end_date         date,
  dates_tbd        boolean not null default false,
  format           text check (format in ('in_person','online','hybrid')),
  city             text,
  country          text,
  student_level    text check (student_level in ('high_school','university','both')),
  committees       jsonb not null default '[]'::jsonb, -- [{name, abbreviation, topics[]}]
  summary          text check (summary is null or length(summary) <= 1200),
  website_url      text not null check (website_url ~ '^https://'),
  instagram_url    text,
  sources          jsonb not null default '[]'::jsonb, -- [{url, checked_at}]
  checked_at       timestamptz,
  discovery        text check (discovery in ('search','instagram','calendar','society_page','submission','mymun_crosscheck','other')),
  status           text not null default 'draft' check (status in ('draft','live','claimed','removed')),
  claimed_conference_id uuid references public.conferences(id) on delete set null,
  claimed_at       timestamptz,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.conference_listings enable row level security;

create policy listings_public_read on public.conference_listings
  for select using (status in ('live','claimed'));
create policy listings_admin_all on public.conference_listings
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- One rule for "may Google index this listing", used by the page, the sitemap
-- and the hubs (like allHubs in src/lib/countryHubs.ts).
create or replace function public.listing_is_indexable(l public.conference_listings)
returns boolean language sql stable as $$
  select l.status = 'live'
     and l.checked_at > now() - interval '90 days'
     and not l.dates_tbd and l.start_date is not null
     and coalesce(l.end_date, l.start_date) >= current_date
     and (l.format = 'online' or (l.city is not null and l.country is not null))
     and (jsonb_array_length(l.committees) >= 2
          or array_length(regexp_split_to_array(trim(coalesce(l.summary,'')), '\s+'), 1) >= 60);
$$;

-- ── Claims ──────────────────────────────────────────────────────────────────
create table public.conference_listing_claims (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.conference_listings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  method      text not null check (method in ('domain_email','site_code','instagram_code','manual')),
  code        text,                -- 6 digits (email) or gavelling-claim-XXXX (site / Instagram)
  email       text,                -- only for domain_email: the address on the conference's own domain
  note        text,                -- manual: who they are
  status      text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  decided_by  uuid references auth.users(id),
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (listing_id, user_id, status)    -- one pending claim per listing per account
);
alter table public.conference_listing_claims enable row level security;
create policy claims_own_read on public.conference_listing_claims
  for select using (user_id = auth.uid() or public.is_platform_admin());
-- No insert/update policies: only the RPCs below write.

-- request_listing_claim(p_listing uuid, p_method text, p_email text default null, p_note text default null)
--   SECURITY DEFINER, authenticated only. Refuses: listing not live; 3+ open claims for the caller;
--   domain_email whose domain is not the website's registrable domain. Creates the claim with a code;
--   for domain_email queues the code email through email_outbox. Returns {ok, claim_id, code?}.
-- verify_listing_claim(p_claim uuid, p_code text)            -- domain_email: right code → approve
-- check_listing_site_code(p_claim uuid)                       -- site_code: called by a server route that
--                                                                fetched the website and found the code
-- approve_listing_claim(p_claim uuid) / reject_listing_claim(p_claim uuid, p_reason text)
--   approve (admin, or internally from the two automatic paths), ONE transaction:
--   insert conferences (organizer_id = claimer, is_public false, facts copied, slug = listing slug
--   after clearing the listing's slug), insert conference_committees (name, abbreviation, topics),
--   insert conference_organizers for the claimer as owner (match how the wizard does it),
--   update listing status 'claimed', claimed_conference_id, claimed_at; queue the "you now manage"
--   email and the team alert. Staff may reverse within 14 days (reverse_listing_claim).

-- ── Removals ────────────────────────────────────────────────────────────────
create table public.conference_listing_removals (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.conference_listings(id) on delete cascade,
  name        text,
  contact     text,                -- optional, only to reply
  reason      text check (reason is null or length(reason) <= 1000),
  status      text not null default 'open' check (status in ('open','done','restored')),
  created_at  timestamptz not null default now()
);
alter table public.conference_listing_removals enable row level security;
create policy removals_admin on public.conference_listing_removals
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
-- request_listing_removal(p_listing uuid, p_name text, p_contact text, p_reason text)
--   anon-callable, rate limited per listing and per hour; sets the listing status 'removed' at once
--   and alerts the team inbox.

-- ── Switch ──────────────────────────────────────────────────────────────────
-- insert into public.store_flags (key, enabled) values ('listings_live', false);   -- match store_flags' real columns

-- ── Slug ladder ─────────────────────────────────────────────────────────────
-- conference_slug_ladder() / conferenceSlugLadder (src/lib/conferenceSlug.ts) must treat
-- conference_listings.slug as taken (change both twins together, CLAUDE.md §3).
