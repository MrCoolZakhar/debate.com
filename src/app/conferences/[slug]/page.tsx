import type { Metadata } from 'next';
import { cache } from 'react';
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

const FALLBACK_IMAGE = 'https://gavelling.com/og-image.png';

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
    return {
      title: 'Conference',
      description: 'A Model UN conference on Gavelling.',
    };
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
  const url = `https://gavelling.com/conferences/${slug}`;

  return {
    title: name,
    description,
    alternates: { canonical: url },
    // Private conferences stay reachable by link but out of search indexes.
    robots: conf.is_public === false ? { index: false, follow: false } : undefined,
    openGraph: {
      title: name,
      description,
      url,
      siteName: 'Gavelling',
      type: 'website',
      images: [{ url: image, alt: name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description,
      images: [image],
    },
  };
}

// schema.org Event JSON-LD → Google event rich results for public conferences.
// Only emitted when the conference is public and has a start date (Google's
// minimum for the Event type).
function eventSchema(slug: string, conf: ConfMeta): object | null {
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
    description: rawDesc || `${name} — a Model UN conference on Gavelling.`,
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
  const schema = conf ? eventSchema(slug, conf) : null;
  return (
    <>
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}
      <ConferenceDetailClient initialView="overview" />
    </>
  );
}
