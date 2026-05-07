import type { Metadata } from 'next';
import ConferencesClient from './ConferencesClient';

export const metadata: Metadata = {
  title: 'MUN Conferences',
  description:
    'Browse and manage Model UN conferences on Gavelling. Connect your sessions to a full conference platform — coming 2026.',
  alternates: { canonical: 'https://gavelling.com/conferences' },
  openGraph: { url: 'https://gavelling.com/conferences' },
};

export default function ConferencesPage() {
  return <ConferencesClient />;
}
