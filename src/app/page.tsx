import type { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: 'Gavelling — Modern MUN Committee Software',
  description:
    'Gavelling gives chairs and directors everything they need to run professional, efficient Model UN sessions. Roll call, speakers, motions, voting — all in one place.',
  alternates: { canonical: 'https://gavelling.com' },
  openGraph: { url: 'https://gavelling.com' },
};

export default function HomePage() {
  return <HomeClient />;
}
