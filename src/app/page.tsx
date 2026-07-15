import type { Metadata } from 'next';
import StagefrontClient from './conferences/StagefrontClient';

export const metadata: Metadata = {
  title: 'MUN Conferences',
  description:
    'Find your next Model UN conference on Gavelling: real conferences, real committee rooms, from London to San Salvador. Organisers list free.',
  alternates: { canonical: 'https://gavelling.com' },
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
    'Gavelling builds modern software for the global Model UN community: session management tools for chairs and a full conference management platform.',
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <StagefrontClient />
    </>
  );
}
