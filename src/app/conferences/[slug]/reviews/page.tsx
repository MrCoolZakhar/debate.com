// Delegate reviews tab, its own route so it's a real, shareable, deep-linkable URL.
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import ConferenceDetailClient from '../ConferenceDetailClient';

// Metadata only — the page logic is untouched. See ../apply/page.tsx for why
// the conference's real name is not resolved here.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata({
    title: 'Conference Reviews',
    description:
      'Read delegate reviews of this Model UN conference on Gavelling: what past participants thought of the committees, chairing, organisation and value.',
    path: `/conferences/${slug}/reviews`,
    ogDescription:
      'What past delegates thought of the committees, chairing, organisation and value.',
  });
}

export default function ConferenceReviewsPage() {
  return <ConferenceDetailClient initialView="reviews" />;
}
