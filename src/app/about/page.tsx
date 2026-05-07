import type { Metadata } from 'next';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Meet the team behind Gavelling — built by MUNers, for MUNers. Our mission is to modernise Model UN committee management worldwide.',
  alternates: { canonical: 'https://gavelling.com/about' },
  openGraph: { url: 'https://gavelling.com/about' },
};

export default function AboutPage() {
  return <AboutClient />;
}
