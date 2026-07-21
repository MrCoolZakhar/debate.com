import type { Metadata } from 'next';
import { Suspense } from 'react';
import ConferencesExploreClient from './ConferencesExploreClient';

export const metadata: Metadata = {
  title: 'Explore Model UN Conferences',
  description:
    'Browse Model UN conferences around the world by country, date, fee, and level. See committees, deadlines, and fees, then apply as a delegate, chair, or advisor in minutes.',
  alternates: { canonical: 'https://gavelling.com/conferences/explore' },
  openGraph: {
    title: 'Explore Model UN Conferences',
    description:
      'Browse Model UN conferences around the world by country, date, fee, and level. Apply as a delegate, chair, or advisor in minutes.',
    url: 'https://gavelling.com/conferences/explore',
    siteName: 'Gavelling',
    type: 'website',
  },
};

export default function ConferencesExplorePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#EDE7D8' }} />}>
      <ConferencesExploreClient />
    </Suspense>
  );
}
