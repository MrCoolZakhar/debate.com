import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://gavelling.com'),
  title: {
    default: 'Gavelling — Modern MUN Committee Software',
    template: '%s | Gavelling',
  },
  description:
    'Gavelling is the modern platform for running Model UN sessions. Manage roll call, speakers lists, motions, and voting — all in one place, from any device.',
  keywords: [
    'Model UN software', 'MUN committee platform', 'Model United Nations',
    'MUN chair tool', 'MUN session management', 'GSL timer',
    'speakers list', 'MUN voting', 'conference management', 'Gavelling',
  ],
  authors: [{ name: 'Gavelling', url: 'https://gavelling.com' }],
  creator: 'Gavelling',
  openGraph: {
    type: 'website',
    url: 'https://gavelling.com',
    siteName: 'Gavelling',
    title: 'Gavelling — Modern MUN Committee Software',
    description:
      'The modern platform for running Model UN sessions. Roll call, speakers lists, motions, and voting — all in one place.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Gavelling — Modern MUN Committee Software' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gavelling — Modern MUN Committee Software',
    description: 'The modern platform for running Model UN sessions. Roll call, speakers lists, motions, and voting — all in one place.',
    images: ['/og-image.png'],
    creator: '@wearegavelling',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" href="/favicon.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/favicon.jpg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full bg-[#EDE7D8] text-[#1C1410] antialiased">
        {children}
      </body>
    </html>
  );
}
