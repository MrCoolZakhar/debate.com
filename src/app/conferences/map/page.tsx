import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import MapClient from './MapClient';

export const metadata: Metadata = pageMetadata({
  title: 'MUN Conference World Map',
  description:
    'See where Model UN conferences are happening on a world map. Browse by continent and country, then open any conference to view committees, dates, and fees.',
  path: '/conferences/map',
  ogDescription:
    'See where Model UN conferences are happening on a world map, from London to San Salvador.',
});

export default function ConferencesMapPage() {
  return <MapClient />;
}
