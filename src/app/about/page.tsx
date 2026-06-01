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

export default function AboutPage() {
  return <AboutClient />;
}
