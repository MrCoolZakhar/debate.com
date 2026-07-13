import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';
import PreRegisterGate from '@/components/PreRegisterGate';
import DemoGate from '@/components/DemoGate';

export const metadata: Metadata = {
  metadataBase: new URL('https://gavelling.com'),
  title: {
    default: 'Gavelling: Modern MUN Committee Software',
    template: '%s | Gavelling',
  },
  description:
    'Gavelling gives chairs and directors everything they need to run professional, efficient Model UN sessions. Roll call, speakers, motions, voting, all in one place.',
  keywords: [
    'Model UN software',
    'MUN committee platform',
    'Model United Nations',
    'MUN chair tool',
    'MUN session management',
    'GSL timer',
    'speakers list MUN',
    'MUN voting',
    'conference management',
    'MUN roll call',
    'moderated caucus',
    'unmoderated caucus',
    'MUN motions',
    'Gavelling',
    'free MUN tool',
    'MUN delegate app',
  ],
  authors: [{ name: 'Gavelling', url: 'https://gavelling.com' }],
  creator: 'Gavelling',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Gavelling: Modern MUN Committee Software',
    description:
      'Gavelling gives chairs and directors everything they need to run professional, efficient Model UN sessions. Roll call, speakers, motions, voting, all in one place.',
    url: 'https://gavelling.com',
    siteName: 'Gavelling',
    images: [
      {
        url: 'https://gavelling.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Gavelling: Modern MUN Committee Software',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gavelling: Modern MUN Committee Software',
    description:
      'The modern platform for running Model UN sessions. Roll call, speakers lists, motions, and voting, all in one place.',
    creator: '@wearegavelling',
    images: ['https://gavelling.com/og-image.png'],
  },
  alternates: {
    canonical: 'https://gavelling.com',
    languages: {
      'en-US': 'https://gavelling.com',
      'es': 'https://gavelling.com?lang=es',
      'fr': 'https://gavelling.com?lang=fr',
      'ar': 'https://gavelling.com?lang=ar',
    },
  },
  // Favicon + apple-touch icon are served by the App Router file convention
  // (src/app/icon.png, src/app/apple-icon.png) — the gavel mark on a
  // transparent background, so no broken white square in the tab. We must NOT
  // set metadata.icons here: defining it suppresses the file-convention link.
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#1B3828',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#1B3828" />
        <link rel="preload" as="image" href="/og-image.png" />
      </head>
      <body className="min-h-full bg-[#EDE7D8] text-[#1C1410] antialiased">
        <AuthProvider>
          <LanguageProvider>
            {children}
            <PreRegisterGate />
            <DemoGate />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
