// The public honour roll: every published award of a conference, grouped
// by committee, in the conference's own award order. Server-rendered so the
// page a delegate shares after the closing ceremony carries its content in
// the HTML. Reads through the anon client only: conferences and committee
// names are public rows, and the RLS on conference_awards exposes exactly
// the published rows, which is exactly what this page shows.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pageMetadata } from '@/lib/seo';
import { conferenceOgImageUrl } from '@/lib/ogVersion';
import { supabase } from '@/lib/supabase';
import { loadPublishedAwards } from '@/lib/awardsService';
import { getConference } from '../page';
import HonourRoll, { type HonourRollCommittee, type HonourRollConference } from './HonourRoll';

// Publishing is a single moment the secretariat picks; a minute of staleness
// after it is fine, an hour (the detail page's window) is not.
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const conf = await getConference(slug);
  const name = conf?.acronym || conf?.full_name || 'Conference';
  const full = conf?.full_name || name;
  return pageMetadata({
    title: `${name} Awards`,
    description: `The honour roll of ${full}: Best Delegate, Outstanding Delegate, Honourable Mentions and every other award announced at the closing ceremony.`,
    path: `/conferences/${slug}/awards`,
    ogTitle: `${name} Awards`,
    ogDescription: `Every award announced at ${full}, verified on Gavelling.`,
    image: conf ? conferenceOgImageUrl(slug, conf) : undefined,
    imageAlt: conf ? full : undefined,
    imageSize: conf ? { width: 1200, height: 630 } : undefined,
    robots: conf?.is_public === false || !conf ? { index: false, follow: false } : undefined,
  });
}

interface ConfRow {
  id: string;
  slug: string;
  full_name: string;
  acronym: string | null;
  logo_url: string | null;
  awards_published_at: string | null;
  awards_config: unknown;
  start_date: string | null;
  end_date: string | null;
}

export default async function ConferenceAwardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let conf: ConfRow | null = null;
  try {
    const { data } = await supabase
      .from('conferences')
      .select('id, slug, full_name, acronym, logo_url, awards_published_at, awards_config, start_date, end_date')
      .eq('slug', slug)
      .maybeSingle();
    conf = (data as ConfRow | null) ?? null;
  } catch {
    conf = null;
  }
  if (!conf) notFound();

  const conference: HonourRollConference = {
    slug: conf.slug,
    full_name: conf.full_name,
    acronym: conf.acronym,
    logo_url: conf.logo_url,
    awards_published_at: conf.awards_published_at,
    awards_config: conf.awards_config,
    start_date: conf.start_date,
    end_date: conf.end_date,
  };

  if (!conf.awards_published_at) {
    return <HonourRoll conference={conference} committees={[]} awards={[]} />;
  }

  const [awards, committeesRes] = await Promise.all([
    loadPublishedAwards(supabase, conf.id),
    supabase
      .from('conference_committees')
      .select('id, name, abbreviation')
      .eq('conference_id', conf.id)
      .order('name', { ascending: true }),
  ]);
  const committees = ((committeesRes.data ?? []) as HonourRollCommittee[]);

  return <HonourRoll conference={conference} committees={committees} awards={awards} />;
}
