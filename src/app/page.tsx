import type { Metadata } from 'next';
import StagefrontClient from './conferences/StagefrontClient';

export const metadata: Metadata = {
  // The root page shares the root layout's segment, so the `%s | Gavelling`
  // title template does NOT apply here — the brand must be inline.
  title: 'Find Model UN Conferences | Gavelling',
  description:
    'Find your next Model UN conference on Gavelling: real conferences, real committee rooms, from London to San Salvador. Apply as a delegate, chair, or advisor. Organisers list free.',
  alternates: {
    canonical: 'https://gavelling.com',
    languages: {
      'en-US': 'https://gavelling.com',
      'es': 'https://gavelling.com?lang=es',
      'fr': 'https://gavelling.com?lang=fr',
      'ar': 'https://gavelling.com?lang=ar',
    },
  },
  openGraph: { url: 'https://gavelling.com' },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Gavelling',
  url: 'https://gavelling.com',
  logo: {
    '@type': 'ImageObject',
    url: 'https://gavelling.com/GavellingLogo.png',
    width: 400,
    height: 100,
  },
  sameAs: [
    'https://www.instagram.com/wearegavelling/',
    'https://twitter.com/wearegavelling',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'wearegavelling@gmail.com',
    contactType: 'customer support',
  },
  description:
    'Gavelling builds modern software for the global Model UN community: a conference discovery and management platform plus live session tools for chairs.',
};

// WebSite schema lives on the site root (one per site). The SearchAction
// mirrors the landing search bar, which hands the query to /conferences/explore
// via its ?search= param.
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Gavelling',
  url: 'https://gavelling.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://gavelling.com/conferences/explore?search={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <StagefrontClient />
    </>
  );
}
