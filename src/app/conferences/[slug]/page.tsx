import type { Metadata } from 'next';
import { cache } from 'react';
import { OG_IMAGE_URL, pageMetadata } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import ConferenceDetailClient from './ConferenceDetailClient';

interface ConfMeta {
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

const FALLBACK_IMAGE = OG_IMAGE_URL;

// One DB round-trip shared between generateMetadata and the page render
// (React request-level cache), so adding the Event schema costs nothing extra.
const getConference = cache(async (slug: string): Promise<ConfMeta | null> => {
  try {
    const { data } = await supabase
      .from('conferences')
      .select('full_name, acronym, description, banner_url, logo_url, city, country, start_date, end_date, is_public, format')
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
  financial_aid_enabled, aid_questions, aid_intro
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

// Per-conference link preview (Open Graph / Twitter) so sharing a conference URL
// on WhatsApp, iMessage, Slack, etc. shows the conference's banner, name, and a
// brief description instead of the generic Gavelling card. Private/unknown
// slugs fall through to a safe generic card (they 404 for outsiders anyway).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const conf = await getConference(slug);

  if (!conf) {
    // Still needs its own og:url — a card that claims to be the homepage shares
    // the homepage's preview-cache entry on Facebook/WhatsApp.
    return pageMetadata({
      title: 'Conference',
      description: 'A Model UN conference on Gavelling.',
      path: `/conferences/${slug}`,
    });
  }

  const name = conf.full_name || conf.acronym || 'Conference';
  const place = [conf.city, conf.country].filter(Boolean).join(', ');
  const dates = formatRange(conf.start_date, conf.end_date);
  const bits = [place, dates].filter(Boolean).join(' · ');
  const rawDesc = (conf.description ?? '').replace(/\s+/g, ' ').trim();
  const description = rawDesc
    ? (rawDesc.length > 200 ? `${rawDesc.slice(0, 197).trimEnd()}…` : rawDesc)
    : bits
      ? `Model UN conference — ${bits}. Apply on Gavelling.`
      : 'A Model UN conference on Gavelling. Apply now.';
  // Banner is the hero for the large card; fall back to the logo, then the
  // site image. Storage URLs are already absolute.
  const image = conf.banner_url || conf.logo_url || FALLBACK_IMAGE;

  return pageMetadata({
    title: name,
    description,
    path: `/conferences/${slug}`,
    image,
    imageAlt: name,
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
    description: rawDesc || `${name} — a Model UN conference on Gavelling.`,
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
    ...(conf.banner_url || conf.logo_url ? { image: [conf.banner_url || conf.logo_url] } : {}),
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
  };
}

export default async function ConferenceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const conf = await getConference(slug);
  // Server-fetched seed for the client view. Public rows only; null for a
  // private conference, which leaves the client's existing authed path intact.
  const full = conf?.is_public ? await getConferenceFull(slug) : null;
  const committees = full ? await getCommittees((full as { id: string }).id) : [];
  const schema = conf
    ? eventSchema(slug, conf, committees as { name: string; abbreviation: string | null; topics: unknown }[])
    : null;
  return (
    <>
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}
      <ConferenceDetailClient
        initialView="overview"
        initialConference={full as never}
        initialCommittees={committees as never}
      />
    </>
  );
}
