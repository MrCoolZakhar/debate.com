import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { absoluteUrl, pageMetadata } from '@/lib/seo';
import { conferenceOgImageUrl, ogVersion } from '@/lib/ogVersion';
import { conferenceCardPath, storedCardExists, storedCardUrl } from '@/lib/ogStore';
import { warmOgImage } from '@/lib/ogWarm';
import { supabase } from '@/lib/supabase';
import ConferenceDetailClient from './ConferenceDetailClient';
import ConferenceViewBeacon from '@/components/conferences/ConferenceViewBeacon';
import { displayRolePrice, TBD_PRICE, type DelegatePrice, type DelegatePriceConfig } from '@/lib/publicFees';
import { windowState } from '@/lib/listedConferences';
import { allHubs, hubPath, hubsForConference, type Hub } from '@/lib/countryHubs';
import { isListedConference } from '@/lib/publicConferences';
import { hasNoDates } from '@/lib/conferenceDates';
import {
  conferenceSeoDescription,
  conferenceSeoTitle,
  conferenceShortName,
  NO_WINDOW,
  type DelegateWindow,
} from '@/lib/conferenceSeo';
import ConferenceAbout from './ConferenceAbout';
import { buildConferenceAbout, type AboutRole } from '@/lib/conferenceAbout';
import { isGavellingListing, listingMeta } from '@/lib/listings';
import { listingOutboundLink } from './ListingParts';

// ISR (19 Oct 2026). Server-rendered shell only; the client always does its
// own live fetch on mount (ConferenceDetailClient's fetchAll, unconditional)
// with the right auth context, so a stale server seed never reaches the
// screen; it only affects how fresh the pre-hydration HTML/metadata a crawler
// or a link preview sees is. Safe for the private-conference path too:
// nothing here reads cookies or headers, and a private conference's
// `full`/`schema` stay null (gated on `conf.is_public`), so the cached HTML
// is the same for every visitor. Everything personal is client-side.
//
// This route used to answer `private, no-cache, no-store` and re-run every
// query on every request (6 to 12 s under load) despite `revalidate`, for two
// reasons: (1) a dynamic segment WITHOUT generateStaticParams is rendered per
// request; returning [] makes each slug render on first visit and then be
// cached; (2) the stored-card probe (storedCardExists) and the card warmer
// fetched with `cache: 'no-store'`, which opts the whole route into dynamic
// rendering. Both fixed; keep it that way (no cookies(), headers(),
// searchParams or no-store fetches anywhere in this page or its metadata).
// 10 minutes, so an organiser's edit reaches crawlers and new link previews
// soon after the page is next visited.
export const revalidate = 600;
export function generateStaticParams() {
  return [];
}

interface ConfMeta {
  id: string;
  fee_currency: string | null;
  full_name: string;
  acronym: string | null;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  is_public: boolean | null;
  format: string | null;
  dates_tbd: boolean | null;
  timezone: string | null;
  website_url: string | null;
  published_at: string | null;
  show_committees: boolean | null;
  instagram_url: string | null;
  /** 'gavelling' on a listing (src/lib/listings.ts): no roles, no fees, applications on their site. */
  listed_by: string | null;
  listing_meta: unknown;
}


// One DB round-trip shared between generateMetadata and the page render
// (React request-level cache), so adding the Event schema costs nothing extra.
// Exported so sibling routes (e.g. ../reviews/page.tsx) can reuse the same
// cached fetch for their own title instead of adding a duplicate query.
// This page reads through `readConference`, where a failed READ throws and
// never returns null: under ISR a null here is a notFound() that would be
// cached as a 404 for the whole revalidate window, while a thrown render keeps
// the last good copy (or answers 500, never cached). `getConference` keeps
// the old forgiving shape (null on any failure) for ../reviews and ../awards.
const readConference = cache(async (slug: string): Promise<ConfMeta | null> => {
  const { data, error } = await supabase
    .from('conferences')
    .select('id, fee_currency, full_name, acronym, description, banner_url, logo_url, city, country, start_date, end_date, is_public, format, dates_tbd, timezone, website_url, published_at, show_committees, instagram_url, listed_by, listing_meta')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`Conference read failed: ${error.code ?? 'unknown'}`);
  return (data as ConfMeta) ?? null;
});

export const getConference = cache(async (slug: string): Promise<ConfMeta | null> => {
  try {
    return await readConference(slug);
  } catch {
    return null;
  }
});

/* The full row the detail view renders, fetched on the SERVER so the page's
   real content is in the HTML a crawler receives.
 
   Until now `/conferences/[slug]` shipped 39 bytes of visible text and no
   <h1>: everything came from a client-side Supabase fetch behind a
   full-screen spinner, so Google saw an empty shell. That is why conference
   pages do not rank for their own acronym. Same columns the client's own
   fetchAll selects, so the seeded object is shape-identical and the client's
   later refetch is a no-op rather than a reconciliation.
 
   Public rows only — a private conference must not become server-rendered
   HTML. The client keeps its authed retry for an owner holding the link. */
const CONFERENCE_COLUMNS = `
  id, slug, full_name, acronym, country, city, format, student_level,
  start_date, end_date, dates_tbd, fee_amount, fee_currency, expected_delegates,
  description, logo_url, banner_url, is_public, status,
  instagram_url, facebook_url, tiktok_url, whatsapp_url, website_url,
  contact_email, organizer_id, min_age, max_age, allocation_swap_mode, display_secretariat,
  connect_onboarding_status, payment_method, external_payment_url, external_payment_note,
  financial_aid_enabled, aid_questions, aid_intro, theme, theme_draft, is_verified,
  listed_by, listing_meta
`;

export const getConferenceFull = cache(async (slug: string) => {
  // Throws on a failed read for the same reason as readConference: a cached
  // copy without the seed would hide the page's content from crawlers.
  const { data, error } = await supabase
    .from('conferences')
    .select(CONFERENCE_COLUMNS)
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle();
  if (error) throw new Error(`Conference read failed: ${error.code ?? 'unknown'}`);
  return data ?? null;
});

/** Committee names and topics. These are the words a search for a topic or a
 *  committee actually matches, and they were reaching no crawler at all. */
const getCommittees = cache(async (conferenceId: string) => {
  try {
    const { data } = await supabase
      .from('conference_committees')
      // Same columns and order as the client's own committee fetch, so the
      // seed is shape-identical and its refetch reconciles to the same rows.
      .select('id, name, abbreviation, topics, difficulty, committee_type, total_slots, delegation_size, display_chairs, chair_user_ids, logo_url')
      .eq('conference_id', conferenceId)
      .order('name', { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
});

type PublicRoleRow = DelegatePriceConfig & { role: string; applications_close_at: string | null };

/** Every role of a public conference from ONE read of the
 *  conference_public_fees view (prices and windows only). null on a failure. */
const getPublicRoles = cache(async (id: string): Promise<PublicRoleRow[] | null> => {
  try {
    const { data, error } = await supabase
      .from('conference_public_fees')
      .select('role, fee_amount, fee_currency, fee_phases, is_enabled, applications_open_at, applications_close_at')
      .eq('conference_id', id);
    if (error) return null;
    return (data as PublicRoleRow[]) ?? [];
  } catch {
    return null;
  }
});

/** One role's public price (publicFees.ts, the one rule) and window
 *  (listedConferences.windowState, the mirror of the trigger). */
function roleView(row: PublicRoleRow, currency: string | null): { price: DelegatePrice; window: DelegateWindow } {
  return {
    price: displayRolePrice(row, currency ?? ''),
    window: {
      state: windowState(
        { is_enabled: row.is_enabled ?? null, applications_open_at: row.applications_open_at ?? null, applications_close_at: row.applications_close_at },
        Date.now(),
      ),
      openAt: row.applications_open_at ?? null,
      closeAt: row.applications_close_at ?? null,
    },
  };
}

/** The delegate role as public pages see it: the price and the application
 *  window, from the same read as every other role. Public conferences only;
 *  TBD and no window on any failure. */
const getDelegateRole = cache(async (id: string, currency: string | null): Promise<{ price: DelegatePrice; window: DelegateWindow }> => {
  const row = (await getPublicRoles(id))?.find((r) => r.role === 'delegate');
  return row ? roleView(row, currency) : { price: TBD_PRICE, window: NO_WINDOW };
});

/** Every role for the About section and the FAQ; [] on a failure. */
const getAboutRoles = cache(async (id: string, currency: string | null): Promise<AboutRole[]> => {
  return ((await getPublicRoles(id)) ?? []).map((r) => ({ role: r.role, ...roleView(r, currency) }));
});

/** The hubs (/conferences/in/<slug>) this conference belongs to that exist,
 *  by the hubs' own rule (countryHubs.ts): its country, online, its month and
 *  its year, in that order. Empty on any failure. */
const getPlaceHubs = cache(async (conf: ConfMeta): Promise<Hub[]> => {
  try {
    const { data } = await supabase
      .from('conferences')
      .select('slug, full_name, is_demo, country, format, dates_tbd, start_date, end_date')
      .eq('is_public', true);
    const rows = ((data as { slug: string; full_name: string; is_demo: boolean | null; country: string | null; format: string | null; dates_tbd: boolean | null; start_date: string | null; end_date: string | null }[]) ?? [])
      .filter(isListedConference);
    return hubsForConference(conf, allHubs(rows));
  } catch {
    return [];
  }
});

/** The organiser's own website for `organizer.url`, without tracking
 *  parameters (fbclid, utm_*), or null when it is not a plain http(s) URL. */
function organiserWebsite(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.origin}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return null;
  }
}

// Per-conference link preview (Open Graph / Twitter) so sharing a conference URL
// on WhatsApp, iMessage, Slack, etc. shows the conference's banner, name, and a
// brief description instead of the generic Gavelling card. Private/unknown
// slugs fall through to a safe generic card (they 404 for outsiders anyway).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const conf = await readConference(slug);

  if (!conf) {
    // NOTE on status codes: this route has a loading.tsx, which makes Next
    // stream the page behind a Suspense boundary — the 200 status for that
    // shell is already committed by the time the page body's notFound()
    // (below) resolves, and Next can't take it back. Verified two ways: (1)
    // an isolated prod build with loading.tsx removed DOES return a real
    // 404 for this same request; put it back and it's 200 again, regardless
    // of user-agent. (2) calling notFound() here in generateMetadata too
    // does NOT fix the status either — metadata streams independently in
    // this Next version — and it actively makes things worse: with no
    // explicit metadata to fall back on, the response leaks the ROOT
    // layout's `index, follow` alongside Next's own noindex tag instead of
    // one clean noindex. So: explicit metadata here (real noindex, real
    // title) + the page body's notFound() (real not-found content) is the
    // best available fix without touching loading.tsx, which is out of
    // scope for this pass and has its own UX tradeoff (removing it trades
    // the branded loading skeleton for a blank shell while a slow-loading
    // *valid* conference's DB round-trips resolve).
    return pageMetadata({
      title: 'Conference',
      description: 'A Model UN conference on Gavelling.',
      path: `/conferences/${slug}`,
      robots: { index: false, follow: false },
    });
  }

  const name = conf.full_name || conf.acronym || 'Conference';
  // Committees and the public delegate role are read for PUBLIC conferences
  // only (a private one is noindex and must not leak its set-up into HTML).
  // A listing has no roles or fees of ours to describe (its roles are closed): no role read.
  const listing = isGavellingListing(conf);
  const [committees, role] = conf.is_public
    ? await Promise.all([
        getCommittees(conf.id),
        listing ? Promise.resolve({ price: TBD_PRICE as DelegatePrice, window: NO_WINDOW }) : getDelegateRole(conf.id, conf.fee_currency),
      ])
    : [[], { price: TBD_PRICE as DelegatePrice, window: NO_WINDOW }];
  const description = conferenceSeoDescription(conf, committees, role.price, role.window, { listing });
  /* The share card is RENDERED, not the raw banner.
   
     Pointing og:image at the organiser's upload had two failure modes that
     between them account for the "our WhatsApp preview is wrong / missing"
     reports. First, that URL is stable for the life of the row, and WhatsApp,
     iMessage and Facebook cache the image against the URL essentially forever
     — so replacing a banner or fixing an acronym never reaches a link already
     sitting in a group chat, no matter what we send back in Cache-Control.
     Second, the raw file is whatever was uploaded: a 4.7MB photo that scrapers
     give up on, a WebP many of them cannot decode, or an off-ratio image that
     gets cropped into nonsense.
   
     /api/og/conference/... solves both. It draws a real card (name, acronym,
     dates, place, the organiser's artwork composited at the right ratio),
     re-encodes to a ~50KB JPEG, and carries a version token that changes when
     any visible field changes (never on a timer: see ogVersion.ts) — so a re-share picks up the
     new card, and a degraded render expires in 5 minutes. The token is pure cache
     identity; the route ignores it.
   
     Kept for conferences that are private: the page is noindex, but a private
     link shared in a chat still deserves its preview, and the card exposes
     nothing the link itself doesn't. There is no fallback branch any more:
     the route always renders something, even for a row it cannot find.
   
     The JSON-LD `image` below deliberately still points at the raw artwork —
     Google's Event rich result wants the event's own picture, not a card with
     our branding across it. */
  const routeImage = conferenceOgImageUrl(slug, conf);
  // The finished card stored on Supabase's CDN, when the route has saved it
  // (src/lib/ogStore.ts): served from anywhere without a render, so a sender
  // far from our server no longer waits ~2 s for the picture. Until then, the
  // route URL, rendered now after this response so it renders and saves.
  // Under ISR this runs when the page is (re)rendered, i.e. on the first
  // visit after the cached copy is 10 minutes old: a changed card (new
  // ogVersion) is warmed and stored then, and the next render points at it.
  const cardPath = conferenceCardPath(slug, ogVersion(conf));
  const stored = await storedCardExists(cardPath, 400);
  const image = stored ? storedCardUrl(cardPath) : routeImage;
  if (!stored) warmOgImage(routeImage);

  return pageMetadata({
    // Absolute: the brand is part of the template, so the root `%s | Gavelling`
    // must not add it twice.
    title: { absolute: conferenceSeoTitle(conf) },
    ogTitle: name,
    description,
    path: `/conferences/${slug}`,
    image,
    imageAlt: name,
    // We render this one ourselves, so the dimensions are known rather than guessed.
    imageSize: { width: 1200, height: 630 },
    // Private conferences stay reachable by link but out of search indexes.
    // Public ones get EXPLICIT index/follow + rich-preview directives (rather
    // than inheriting silently) so results can show large image + full snippet.
    robots: conf.is_public === false
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  });
}

// schema.org Event JSON-LD → Google event rich results for public conferences.
// Only emitted when the conference is public and has real dates (Google's
// minimum for the Event type; a conference with dates to be decided is never
// an Event, conferenceDates.ts).
function eventSchema(
  slug: string,
  conf: ConfMeta,
  committees: { name: string; abbreviation: string | null; topics: unknown }[],
  price: DelegatePrice,
  window: DelegateWindow,
  description: string,
): object | null {
  if (conf.is_public === false || hasNoDates(conf) || !conf.start_date) return null;
  const pageUrl = `https://gavelling.com/conferences/${slug}`;
  const name = conf.full_name || conf.acronym || 'Model UN Conference';
  const rawDesc = (conf.description ?? '').replace(/\s+/g, ' ').trim();
  const website = organiserWebsite(conf.website_url);
  const attendanceMode =
    conf.format === 'online'
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : conf.format === 'hybrid'
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode';
  // "gamun", "gamun 2026" and the full name all name this page.
  const alternateName = [...new Set(
    [conf.acronym, conferenceShortName(conf), conf.full_name]
      .map((s) => (s ?? '').replace(/\s+/g, ' ').trim())
      .filter((s) => s && s !== name),
  )];
  const place = {
    '@type': 'Place',
    name: [conf.city, conf.country].filter(Boolean).join(', ') || name,
    address: {
      '@type': 'PostalAddress',
      ...(conf.city ? { addressLocality: conf.city } : {}),
      ...(conf.country ? { addressCountry: conf.country } : {}),
    },
  };
  const virtual = { '@type': 'VirtualLocation', url: website || pageUrl };
  const listing = isGavellingListing(conf);
  // A listing's banner may be a free city photo (it carries a credit): that is not the event's
  // own picture, so only its own logo and banner are offered.
  const listingBannerIsCityPhoto = listing && !!listingMeta(conf)?.banner_credit;
  const images = [...new Set([listingBannerIsCityPhoto ? null : conf.banner_url, conf.logo_url].filter((u): u is string => !!u).map((u) => absoluteUrl(u)))];
  const availability = window.state === 'open'
    ? 'https://schema.org/InStock'
    : window.state === 'not_open'
      ? 'https://schema.org/PreOrder'
      : window.state === 'closed'
        ? 'https://schema.org/SoldOut'
        : null;
  const validFrom = window.openAt || conf.published_at;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    ...(alternateName.length ? { alternateName } : {}),
    description: rawDesc || description,
    /* Each committee as a subEvent. Names and topics are the long-tail queries
       ("SISMUN SOCHUM", "crisis committee Bangalore") and they render on a tab
       the crawler never reaches, so structured data is the only place they can
       be found. */
    ...(committees.length
      ? {
          subEvent: committees.slice(0, 25).map((c) => ({
            '@type': 'Event',
            name: c.abbreviation && c.abbreviation !== c.name ? `${c.name} (${c.abbreviation})` : c.name,
            ...(Array.isArray(c.topics) && c.topics.length
              ? { about: c.topics.filter((t): t is string => typeof t === 'string').slice(0, 4) }
              : {}),
            startDate: conf.start_date,
            ...(conf.end_date ? { endDate: conf.end_date } : {}),
            eventAttendanceMode: attendanceMode,
            location: conf.format === 'online' ? virtual : place,
          })),
        }
      : {}),
    startDate: conf.start_date,
    endDate: conf.end_date || conf.start_date,
    eventAttendanceMode: attendanceMode,
    eventStatus: 'https://schema.org/EventScheduled',
    url: pageUrl,
    ...(images.length ? { image: images } : {}),
    location: conf.format === 'online' ? virtual : conf.format === 'hybrid' ? [place, virtual] : place,
    organizer: {
      '@type': 'Organization',
      name,
      url: website || pageUrl,
    },
    // The delegate price, only once it is set (publicFees.ts): never a
    // guessed or stale number. validThrough is the delegate closing instant.
    // Never an offer on a listing: it sells nothing on Gavelling.
    ...(price.kind !== 'tbd' && !listing
      ? {
          offers: {
            '@type': 'Offer',
            name: 'Delegate',
            url: `${pageUrl}/apply`,
            price: price.kind === 'free' ? 0 : price.amount,
            priceCurrency: price.kind === 'paid' ? price.currency : (conf.fee_currency || 'USD'),
            ...(availability ? { availability } : {}),
            ...(validFrom ? { validFrom } : {}),
            ...(window.closeAt ? { validThrough: window.closeAt } : {}),
          },
        }
      : {}),
  };
}

/** Home > Conferences > <country hub, when there is one> > this conference. */
function breadcrumbSchema(slug: string, conf: ConfMeta, hub: Hub | null): object {
  const items = [
    { name: 'Home', item: 'https://gavelling.com' },
    { name: 'Conferences', item: 'https://gavelling.com/conferences/explore' },
    ...(hub ? [{ name: hub.name, item: `https://gavelling.com${hubPath(hub.slug)}` }] : []),
    { name: conferenceShortName(conf), item: `https://gavelling.com/conferences/${slug}` },
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })),
  };
}

export default async function ConferenceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const conf = await readConference(slug);
  // readConference has no is_public filter, so this is null ONLY when the row
  // genuinely doesn't exist — a private conference still comes back here
  // (with is_public: false) and must keep rendering for an owner holding the
  // link. Only a missing row is a real 404.
  if (!conf) notFound();
  // Server-fetched seed for the client view. Public rows only; null for a
  // private conference, which leaves the client's existing authed path intact.
  const full = conf?.is_public ? await getConferenceFull(slug) : null;
  // A listing (src/lib/listings.ts): no role, fee or window is read or described, it applies on
  // its own website, and its delegate count is a placeholder unless it publishes one.
  const listing = isGavellingListing(conf);
  const listingInfo = listing ? listingMeta(conf) : null;
  const noRole = { price: TBD_PRICE as DelegatePrice, window: NO_WINDOW };
  const [committees, role, placeHubs, aboutRoles] = full
    ? await Promise.all([
        getCommittees((full as { id: string }).id),
        listing ? Promise.resolve(noRole) : getDelegateRole(conf.id, conf.fee_currency),
        getPlaceHubs(conf),
        listing ? Promise.resolve([] as AboutRole[]) : getAboutRoles(conf.id, conf.fee_currency),
      ])
    : [[], { price: TBD_PRICE as DelegatePrice, window: NO_WINDOW }, [] as Hub[], [] as AboutRole[]];
  const countryHub = placeHubs.find((h) => h.kind === 'country') ?? null;
  const onlineHub = placeHubs.find((h) => h.kind === 'online') ?? null;
  const typedCommittees = committees as { name: string; abbreviation: string | null; topics: unknown }[];
  const description = conferenceSeoDescription(conf, typedCommittees, role.price, role.window, { listing });
  const schema = full ? eventSchema(slug, conf, typedCommittees, role.price, role.window, description) : null;
  const breadcrumbs = full ? breadcrumbSchema(slug, conf, countryHub) : null;
  const fullRowRaw = full as { student_level?: string | null; expected_delegates?: number | null; min_age?: number | null; max_age?: number | null } | null;
  const fullRow = fullRowRaw && listing && !listingInfo?.delegates_known
    ? { ...fullRowRaw, expected_delegates: null }
    : fullRowRaw;
  // The About section (thin description) and the FAQ, built from the same
  // facts; the FAQ strings are also the FAQPage JSON-LD, word for word.
  // Committees the organiser hid from the page stay out of both.
  const about = full
    ? buildConferenceAbout(
        {
          ...conf, slug, student_level: fullRow?.student_level, expected_delegates: fullRow?.expected_delegates, min_age: fullRow?.min_age, max_age: fullRow?.max_age,
          listing: listing ? { outboundUrl: listingOutboundLink(conf)?.href ?? null } : null,
        },
        conf.show_committees === false ? [] : (committees as { name: string; abbreviation: string | null; topics: unknown; committee_type?: string | null }[]),
        aboutRoles,
      )
    : null;
  return (
    <>
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
      )}
      {breadcrumbs && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, '\\u003c') }}
        />
      )}
      {/* Anonymous, aggregate view count by source (no cookies): see src/lib/trafficSource.ts. */}
      <ConferenceViewBeacon slug={slug} />
      <ConferenceDetailClient
        initialView="overview"
        initialConference={full as never}
        initialCommittees={committees as never}
        placeLinks={full ? {
          country: countryHub ? { href: hubPath(countryHub.slug), label: `Model UN conferences in ${countryHub.name}` } : null,
          online: onlineHub ? { href: hubPath(onlineHub.slug), label: 'Online Model UN conferences' } : null,
        } : null}
        // Owner (19 Oct 2026): only the About section, and only when the
        // organiser's description is thin. No FAQ card, no facts paragraph,
        // no row of hub links at the foot of the page.
        aboutFallback={about?.thin ? <ConferenceAbout about={about} hubLinks={[]} /> : null}
      />
    </>
  );
}
