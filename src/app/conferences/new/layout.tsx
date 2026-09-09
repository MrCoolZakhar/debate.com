import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { listConferenceOgImageUrl } from '@/lib/ogVersion';

// page.tsx here is a Client Component (the creation wizard holds all its state
// in React), and a Client Component cannot export `metadata` — so without this
// server layout the route silently falls back to the root layout's generic
// site-wide title, description and card. This sibling-layout pattern is the
// standard App Router way to give a client page real metadata without
// converting it. It renders nothing but its children.
export const metadata: Metadata = pageMetadata({
  title: 'List Your MUN Conference',
  description:
    'Set up your Model UN conference on Gavelling in a few minutes: name, dates, location, committees and fees. Then collect delegate applications, allocate countries and take payments in one place.',
  path: '/conferences/new',
  ogTitle: 'List your Model UN conference on Gavelling',
  ogDescription:
    'Set up your conference in minutes, then collect applications, allocate countries and take payments in one place. Free to list.',
  // Its own card, not the site-wide one. /og-image.jpg says "MUN Conferences &
  // Committee Software", which is aimed at delegates looking for a conference;
  // this page is the organiser's, and its whole argument is "list yours, free".
  // Someone forwarding this link was showing a stranger the wrong product.
  //
  // The card is also composed down the middle rather than left-anchored,
  // because WhatsApp centre-crops toward a square for its in-chat preview and
  // its chat-list thumbnail. See the route for the full reasoning.
  image: listConferenceOgImageUrl(),
  imageAlt: 'List your Model UN conference on Gavelling. Free for organisers.',
  imageSize: { width: 1200, height: 630 },
});

export default function ConferenceNewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
