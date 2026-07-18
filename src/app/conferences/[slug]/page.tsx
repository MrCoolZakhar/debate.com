import type { Metadata } from 'next';
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
}

const FALLBACK_IMAGE = 'https://gavelling.com/og-image.png';

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
  let conf: ConfMeta | null = null;
  try {
    const { data } = await supabase
      .from('conferences')
      .select('full_name, acronym, description, banner_url, logo_url, city, country, start_date, end_date')
      .eq('slug', slug)
      .maybeSingle();
    conf = (data as ConfMeta) ?? null;
  } catch {
    /* fall through to generic card */
  }

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

export default function ConferenceDetailPage() {
  return <ConferenceDetailClient />;
}
