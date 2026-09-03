// Delegate reviews tab, its own route so it's a real, shareable, deep-linkable URL.
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { getConference } from '../page';
import ConferenceDetailClient from '../ConferenceDetailClient';

// Metadata only — the page logic is untouched. Unlike ../apply/page.tsx, the
// conference's real name IS resolved here: ../page.tsx already exports its
// request-cached getConference (one Supabase round-trip, shared with that
// route's own generateMetadata within the same request), so reusing it here
// costs nothing extra and gives every conference its own title instead of
// the same "Conference Reviews" on all 50.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const conf = await getConference(slug);
  const name = conf?.full_name || conf?.acronym || 'Conference';
  return pageMetadata({
    title: `${name} Reviews`,
    description: `Read delegate reviews of ${name} on Gavelling: what past participants thought of the committees, chairing, organisation and value.`,
    path: `/conferences/${slug}/reviews`,
    ogDescription:
      'What past delegates thought of the committees, chairing, organisation and value.',
    // Private conferences shouldn't surface a reviews page in search either.
    robots: conf?.is_public === false || !conf ? { index: false, follow: false } : undefined,
  });
}

export default function ConferenceReviewsPage() {
  return <ConferenceDetailClient initialView="reviews" />;
}
