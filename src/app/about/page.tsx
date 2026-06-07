import type { Metadata } from 'next';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
  title: 'About Gavelling — Built for the MUN Community',
  description:
    'Meet the team behind Gavelling — MUN practitioners building the modern infrastructure for Model UN sessions and conferences worldwide.',
  alternates: { canonical: 'https://gavelling.com/about' },
  openGraph: {
    title: 'About Gavelling — Built for the MUN Community',
    description: 'Meet the team behind Gavelling — MUN practitioners building the modern infrastructure for Model UN sessions and conferences worldwide.',
    url: 'https://gavelling.com/about',
    siteName: 'Gavelling',
    images: [{ url: 'https://gavelling.com/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
};

const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About Gavelling',
  description: 'Meet the team behind Gavelling — MUN practitioners building the modern infrastructure for Model UN sessions and conferences worldwide.',
  url: 'https://gavelling.com/about',
  publisher: {
    '@type': 'Organization',
    name: 'Gavelling',
    url: 'https://gavelling.com',
    logo: { '@type': 'ImageObject', url: 'https://gavelling.com/GavellingLogo.png' },
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'About', item: 'https://gavelling.com/about' },
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
