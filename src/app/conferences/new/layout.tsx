import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

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
});

export default function ConferenceNewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
