import type { Metadata } from 'next';
import ConferencesClient from './ConferencesClient';

export const metadata: Metadata = {
  title: 'MUN Conference Management Software — Gavelling Conferences',
  description:
    'Run your entire Model UN conference from one platform. Delegate applications, country allocations, study guides, position paper review, and financials — launching July 2026.',
  alternates: { canonical: 'https://gavelling.com/conferences' },
  openGraph: {
    title: 'MUN Conference Management Software — Gavelling Conferences',
    description: 'Run your entire Model UN conference from one platform. Launching July 2026.',
    url: 'https://gavelling.com/conferences',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
};

export default function ConferencesPage() {
  return <ConferencesClient />;
}
