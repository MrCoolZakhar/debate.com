import type { Metadata } from 'next';
import StagefrontClient from './StagefrontClient';

export const metadata: Metadata = {
  title: 'MUN Conferences',
  description:
    'Find your next Model UN conference on Gavelling — real conferences, real committee rooms, from London to San Salvador. Organisers list free.',
  alternates: { canonical: 'https://gavelling.com/conferences' },
  openGraph: { url: 'https://gavelling.com/conferences' },
};

export default function ConferencesPage() {
  return <StagefrontClient />;
}
