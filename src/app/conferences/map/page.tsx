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
  // The map draws its title on a canvas-like client surface, so the page's
  // heading is given here for crawlers and screen readers.
  return (
    <>
      <h1 className="sr-only">Model UN conference world map</h1>
      <MapClient />
    </>
  );
}
