import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { absoluteUrl, pageMetadata } from '@/lib/seo';
import { conferenceOgImageUrl } from '@/lib/ogVersion';
import { supabase } from '@/lib/supabase';
import ConferenceDetailClient from './ConferenceDetailClient';
import ConferenceViewBeacon from '@/components/conferences/ConferenceViewBeacon';
import { fetchDelegatePrices, delegatePriceLabel, TBD_PRICE, type DelegatePrice } from '@/lib/publicFees';

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
}


// One DB round-trip shared between generateMetadata and the page render
// (React request-level cache), so adding the Event schema costs nothing extra.
// Exported so sibling routes (e.g. ../reviews/page.tsx) can reuse the same
// cached fetch for their own title instead of adding a duplicate query.
export const getConference = cache(async (slug: string): Promise<ConfMeta | null> => {
  try {
    const { data } = await supabase
      .from('conferences')
      .select('id, fee_currency, full_name, acronym, description, banner_url, logo_url, city, country, start_date, end_date, is_public, format')
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

function formatRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = new Date(`${start}T00:00:00`);
  if (!end || end === start) {
    return s.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const e = new Date(`${end}T00:00:00`);
  return `${s.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** The public delegate price (publicFees.ts), for the description and the
 *  Event offer. Public conferences only; TBD on any failure. */
const getDelegatePrice = cache(async (id: string, currency: string | null): Promise<DelegatePrice> => {
  try {
    const prices = await fetchDelegatePrices(supabase, [{ id, fee_currency: currency }]);
    return prices.get(id) ?? TBD_PRICE;
  } catch {
    return TBD_PRICE;
  }
});

const tidy = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * The title template (owner, 23 Sep 2026):
 *   "<Acronym> <year> · <Full name>, <City> · Model UN conference | Gavelling"
 * The year is added only when the acronym does not already carry it, the full
 * name only when it says more than the acronym, the city only when known.
 */
function conferenceTitle(conf: ConfMeta): string {
  const acronym = tidy(conf.acronym);
  const full = tidy(conf.full_name);
  const year = conf.start_date ? conf.start_date.slice(0, 4) : '';
  const lead = acronym || full || 'Conference';
  const head = year && !lead.includes(year) ? `${lead} ${year}` : lead;
  const second = acronym && full && full.toLowerCase() !== acronym.toLowerCase() ? full : '';
  const city = tidy(conf.city);
  const named = second ? `${head} · ${second}` : head;
  return `${named}${city ? `, ${city}` : ''} · Model UN conference | Gavelling`;
}

/** A factual description: what, where, when, how many committees, the fee. */
function conferenceDescription(conf: ConfMeta, committeeCount: number, price: DelegatePrice): string {
  const full = tidy(conf.full_name) || tidy(conf.acronym) || 'This conference';
  const acronym = tidy(conf.acronym);
  const name = acronym && acronym.toLowerCase() !== full.toLowerCase() ? `${full} (${acronym})` : full;
  const place = [tidy(conf.city), tidy(conf.country)].filter(Boolean).join(', ');
  const online = conf.format === 'online';
  const dates = formatRange(conf.start_date, conf.end_date);
  const where = online ? ' held online' : place ? ` in ${place}` : '';
  const when = dates ? `, ${dates}` : '';
  const committees = committeeCount > 0 ? ` ${committeeCount} ${committeeCount === 1 ? 'committee' : 'committees'}.` : '';
  const fee = price.kind === 'tbd'
    ? ' Delegate fee to be announced.'
    : price.kind === 'free'
      ? ' Free for delegates.'
      : ` Delegate fee ${delegatePriceLabel(price)}.`;
  return `${name} is a Model UN conference${where}${when}.${committees}${fee} Apply as a delegate, chair or advisor on Gavelling.`;
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
  // Committees and the public delegate price are read for PUBLIC conferences
  // only (a private one is noindex and must not leak its set-up into HTML).
  const [committees, price] = conf.is_public
    ? await Promise.all([getCommittees(conf.id), getDelegatePrice(conf.id, conf.fee_currency)])
    : [[], TBD_PRICE as DelegatePrice];
  const description = conferenceDescription(conf, committees.length, price);
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
     any visible field changes AND rotates daily — so a re-share picks up the
     new card, and a stale one self-heals within 24h. The token is pure cache
     identity; the route ignores it.
   
     Kept for conferences that are private: the page is noindex, but a private
     link shared in a chat still deserves its preview, and the card exposes
     nothing the link itself doesn't. There is no fallback branch any more:
     the route always renders something, even for a row it cannot find.
   
     The JSON-LD `image` below deliberately still points at the raw artwork —
     Google's Event rich result wants the event's own picture, not a card with
     our branding across it. */
  const image = conferenceOgImageUrl(slug, conf);

  return pageMetadata({
    // Absolute: the brand is part of the template, so the root `%s | Gavelling`
    // must not add it twice.
    title: { absolute: conferenceTitle(conf) },
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
// Only emitted when the conference is public and has a start date (Google's
// minimum for the Event type).
function eventSchema(
  slug: string,
  conf: ConfMeta,
  committees: { name: string; abbreviation: string | null; topics: unknown }[] = [],
  price: DelegatePrice = TBD_PRICE,
): object | null {
  if (conf.is_public === false || !conf.start_date) return null;
  const name = conf.full_name || conf.acronym || 'Model UN Conference';
  const rawDesc = (conf.description ?? '').replace(/\s+/g, ' ').trim();
  const attendanceMode =
    conf.format === 'online'
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : conf.format === 'hybrid'
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode';
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    ...(conf.acronym ? { alternateName: [conf.acronym, conf.full_name].filter(Boolean) } : {}),
    description: rawDesc || `${name}, a Model UN conference on Gavelling.`,
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
            ...(conf.start_date ? { startDate: conf.start_date } : {}),
          })),
        }
      : {}),
    startDate: conf.start_date,
    ...(conf.end_date ? { endDate: conf.end_date } : {}),
    eventAttendanceMode: attendanceMode,
    eventStatus: 'https://schema.org/EventScheduled',
    url: `https://gavelling.com/conferences/${slug}`,
    ...(conf.banner_url || conf.logo_url ? { image: [absoluteUrl(conf.banner_url || conf.logo_url || '')] } : {}),
    location:
      conf.format === 'online'
        ? { '@type': 'VirtualLocation', url: `https://gavelling.com/conferences/${slug}` }
        : {
            '@type': 'Place',
            name: [conf.city, conf.country].filter(Boolean).join(', ') || name,
            address: {
              '@type': 'PostalAddress',
              ...(conf.city ? { addressLocality: conf.city } : {}),
              ...(conf.country ? { addressCountry: conf.country } : {}),
            },
          },
    organizer: {
      '@type': 'Organization',
      name,
      url: `https://gavelling.com/conferences/${slug}`,
    },
    // The delegate price, only once it is set (publicFees.ts): never a
    // guessed or stale number.
    ...(price.kind !== 'tbd'
      ? {
          offers: {
            '@type': 'Offer',
            name: 'Delegate',
            url: `https://gavelling.com/conferences/${slug}/apply`,
            price: price.kind === 'free' ? 0 : price.amount,
            priceCurrency: price.kind === 'paid' ? price.currency : (conf.fee_currency || 'USD'),
          },
        }
      : {}),
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
  const committees = full ? await getCommittees((full as { id: string }).id) : [];
  const price = full ? await getDelegatePrice(conf.id, conf.fee_currency) : TBD_PRICE;
  const schema = conf
    ? eventSchema(slug, conf, committees as { name: string; abbreviation: string | null; topics: unknown }[], price)
    : null;
  return (
    <>
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}
      {/* Anonymous, aggregate view count by source (no cookies): see src/lib/trafficSource.ts. */}
      <ConferenceViewBeacon slug={slug} />
      <ConferenceDetailClient
        initialView="overview"
        initialConference={full as never}
        initialCommittees={committees as never}
      />
    </>
  );
}
