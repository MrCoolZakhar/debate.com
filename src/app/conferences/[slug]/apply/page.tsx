import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import ConferenceApplyClient from './ConferenceApplyClient';

// Metadata only — the page logic is untouched. Without this the apply link
// (which organisers paste into group chats) inherits the root layout's generic
// card, and previously also inherited its homepage og:url, so every apply page
// on the site shared ONE Facebook/WhatsApp preview-cache entry.
// The conference's real name is not resolved here on purpose: doing so would
// mean duplicating the conference fetch that lives in ../page.tsx, and that
// file belongs to the conferences workstream.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata({
    title: 'Apply to a Model UN Conference',
    description:
      'Submit your application to this Model UN conference on Gavelling: pick your role, rank your committee and country preferences, and track your status in one place.',
    path: `/conferences/${slug}/apply`,
    ogDescription:
      'Pick your role, rank your committee and country preferences, and track your application in one place.',
  });
}

export default function ConferenceApplyPage() {
  return <ConferenceApplyClient />;
}
