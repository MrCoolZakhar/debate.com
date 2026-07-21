import type { Metadata } from 'next';
import MapClient from './MapClient';

export const metadata: Metadata = {
  title: 'MUN Conference World Map',
  description:
    'See where Model UN conferences are happening on a world map. Browse by continent and country, then open any conference to view committees, dates, and fees.',
  alternates: { canonical: 'https://gavelling.com/conferences/map' },
  openGraph: {
    title: 'MUN Conference World Map',
    description:
      'See where Model UN conferences are happening on a world map, from London to San Salvador.',
    url: 'https://gavelling.com/conferences/map',
    siteName: 'Gavelling',
    type: 'website',
  },
};

export default function ConferencesMapPage() {
  return <MapClient />;
}
