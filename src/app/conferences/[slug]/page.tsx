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
import { displayDelegatePrice, TBD_PRICE, type DelegatePrice, type DelegatePriceConfig } from '@/lib/publicFees';
import { windowState } from '@/lib/listedConferences';
import { countryHubs } from '@/lib/countryHubs';
import { getCountryByName } from '@/lib/countries';
import { isListedConference } from '@/lib/publicConferences';
import { hasNoDates } from '@/lib/conferenceDates';
import {
  conferenceSeoDescription,
  conferenceSeoTitle,
  conferenceShortName,
  conferenceSummary,
  NO_WINDOW,
  type DelegateWindow,
} from '@/lib/conferenceSeo';
import ConferenceFacts from './ConferenceFacts';

// Server-rendered shell only; the client always does its own live fetch on
// mount (ConferenceDetailClient's fetchAll, unconditional) with the right
// auth context, so a stale hour-old server seed never reaches the screen —
// it only affects how fresh the pre-hydration HTML/metadata a crawler sees
// is. Safe for the private-conference path too: nothing here reads cookies
// or headers, and a private conference's `full`/`schema` stay null
// regardless of cache freshness (gated on `conf.is_public`, not on when the
// row was fetched), so there is nothing user-specific to go stale.
export const revalidate = 3600;

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
}


// One DB round-trip shared between generateMetadata and the page render
// (React request-level cache), so adding the Event schema costs nothing extra.
// Exported so sibling routes (e.g. ../reviews/page.tsx) can reuse the same
// cached fetch for their own title instead of adding a duplicate query.
export const getConference = cache(async (slug: string): Promise<ConfMeta | null> => {
  try {
    const { data } = await supabase
      .from('conferences')
      .select('id, fee_currency, full_name, acronym, description, banner_url, logo_url, city, country, start_date, end_date, is_public, format, dates_tbd, timezone, website_url, published_at')
      .eq('slug', slug)
      .maybeSingle();
    return (data as ConfMeta) ?? null;
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
  financial_aid_enabled, aid_questions, aid_intro, theme, theme_draft, is_verified
`;

export const getConferenceFull = cache(async (slug: string) => {
  try {
    const { data } = await supabase
      .from('conferences')
      .select(CONFERENCE_COLUMNS)
      .eq('slug', slug)
      .eq('is_public', true)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
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

/** The delegate role as public pages see it: the price (publicFees.ts, the
 *  one rule) and the application window (listedConferences.windowState, the
 *  mirror of the trigger), from ONE read of the conference_public_fees view.
 *  Public conferences only; TBD and no window on any failure. */
const getDelegateRole = cache(async (id: string, currency: string | null): Promise<{ price: DelegatePrice; window: DelegateWindow }> => {
  try {
    const { data } = await supabase
      .from('conference_public_fees')
      .select('fee_amount, fee_currency, fee_phases, is_enabled, applications_open_at, applications_close_at')
      .eq('conference_id', id)
      .eq('role', 'delegate')
      .maybeSingle();
    if (!data) return { price: TBD_PRICE, window: NO_WINDOW };
    const row = data as DelegatePriceConfig & { applications_close_at: string | null };
    return {
      price: displayDelegatePrice(row, currency ?? ''),
      window: {
        state: windowState(
          { is_enabled: row.is_enabled ?? null, applications_open_at: row.applications_open_at ?? null, applications_close_at: row.applications_close_at },
          Date.now(),
        ),
        openAt: row.applications_open_at ?? null,
        closeAt: row.applications_close_at ?? null,
      },
    };
  } catch {
    return { price: TBD_PRICE, window: NO_WINDOW };
  }
});

/** The country hub (/conferences/in/<country>) this conference's country has,
 *  by the hubs' own rule (countryHubs.ts), or null when there is none. */
const getCountryHub = cache(async (country: string | null): Promise<{ slug: string; name: string } | null> => {
  const hit = country ? getCountryByName(country.trim()) : undefined;
  if (!hit) return null;
  try {
    const { data } = await supabase
      .from('conferences')
      .select('slug, full_name, is_demo, country, start_date, end_date')
      .eq('is_public', true);
    const rows = ((data as { slug: string; full_name: string; is_demo: boolean | null; country: string | null; start_date: string | null; end_date: string | null }[]) ?? [])
      .filter(isListedConference);
    const hub = countryHubs(rows).find((h) => h.code === hit.code.toUpperCase());
    return hub ? { slug: hub.slug, name: hub.name } : null;
  } catch {
    return null;
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
  const conf = await getConference(slug);

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
  const [committees, role] = conf.is_public
    ? await Promise.all([getCommittees(conf.id), getDelegateRole(conf.id, conf.fee_currency)])
    : [[], { price: TBD_PRICE as DelegatePrice, window: NO_WINDOW }];
  const description = conferenceSeoDescription(conf, committees, role.price, role.window);
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
  const images = [...new Set([conf.banner_url, conf.logo_url].filter((u): u is string => !!u).map((u) => absoluteUrl(u)))];
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
    ...(price.kind !== 'tbd'
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
function breadcrumbSchema(slug: string, conf: ConfMeta, hub: { slug: string; name: string } | null): object {
  const items = [
    { name: 'Home', item: 'https://gavelling.com' },
    { name: 'Conferences', item: 'https://gavelling.com/conferences/explore' },
    ...(hub ? [{ name: hub.name, item: `https://gavelling.com/conferences/in/${hub.slug}` }] : []),
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
  const conf = await getConference(slug);
  // getConference has no is_public filter, so this is null ONLY when the row
  // genuinely doesn't exist — a private conference still comes back here
  // (with is_public: false) and must keep rendering for an owner holding the
  // link. Only a missing row is a real 404.
  if (!conf) notFound();
  // Server-fetched seed for the client view. Public rows only; null for a
  // private conference, which leaves the client's existing authed path intact.
  const full = conf?.is_public ? await getConferenceFull(slug) : null;
  const [committees, role, hub] = full
    ? await Promise.all([
        getCommittees((full as { id: string }).id),
        getDelegateRole(conf.id, conf.fee_currency),
        getCountryHub(conf.country),
      ])
    : [[], { price: TBD_PRICE as DelegatePrice, window: NO_WINDOW }, null];
  const typedCommittees = committees as { name: string; abbreviation: string | null; topics: unknown }[];
  const description = conferenceSeoDescription(conf, typedCommittees, role.price, role.window);
  const schema = full ? eventSchema(slug, conf, typedCommittees, role.price, role.window, description) : null;
  const breadcrumbs = full ? breadcrumbSchema(slug, conf, hub) : null;
  const fullRow = full as { student_level?: string | null; expected_delegates?: number | null } | null;
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
        overviewFooter={full ? (
          <ConferenceFacts
            summary={conferenceSummary({ ...conf, student_level: fullRow?.student_level, expected_delegates: fullRow?.expected_delegates }, typedCommittees, role.price, role.window)}
            hub={hub}
          />
        ) : null}
      />
    </>
  );
}
