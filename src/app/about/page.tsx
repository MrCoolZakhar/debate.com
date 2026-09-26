import type { Metadata } from 'next';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import AboutClient from './AboutClient';

export const metadata: Metadata = pageMetadata({
  title: 'About and Contact: Built for the MUN Community',
  description:
    'Contact the Gavelling team as an organiser, a delegate or chair, or press, and meet the founders and ambassadors building Model UN software worldwide.',
  path: '/about',
  ogTitle: 'About Gavelling: Built for the MUN Community',
});

const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About Gavelling',
  description: 'Contact the Gavelling team as an organiser, a delegate or chair, or press, and meet the founders and ambassadors building Model UN software worldwide.',
  url: 'https://gavelling.com/about',
  publisher: JSONLD_PUBLISHER,
  mainEntity: {
    '@type': 'Organization',
    name: 'Gavelling',
    url: 'https://gavelling.com',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'wearegavelling@gmail.com',
      availableLanguage: ['English'],
    },
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'About and contact', item: 'https://gavelling.com/about' },
  ],
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <AboutClient />
    </>
  );
}
