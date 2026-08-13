import type { Metadata, Viewport } from 'next';
import { OG_IMAGE, OG_IMAGE_URL } from '@/lib/seo';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';
import DemoGate from '@/components/DemoGate';
import CreditsWelcomeGate from '@/components/CreditsWelcomeGate';

export const metadata: Metadata = {
  metadataBase: new URL('https://gavelling.com'),
  title: {
    default: 'Gavelling: MUN Conferences & Committee Software',
    template: '%s | Gavelling',
  },
  description:
    'Find and apply to Model UN conferences worldwide, organise your own with applications, allocations and payments, and run committee sessions live: roll call, speakers, motions, voting.',
  keywords: [
    'Model UN conferences',
    'MUN conference finder',
    'find MUN conferences',
    'MUN conference management',
    'MUN conference registration',
    'MUN delegate applications',
    'Model UN software',
    'MUN committee platform',
    'Model United Nations',
    'MUN chair tool',
    'MUN session management',
    'GSL timer',
    'speakers list MUN',
    'MUN voting',
    'MUN roll call',
    'moderated caucus',
    'unmoderated caucus',
    'MUN motions',
    'Gavelling',
    'free MUN tool',
    'MUN delegate app',
    'MUN CV',
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
    title: 'Gavelling: MUN Conferences & Committee Software',
    description:
      'Find and apply to Model UN conferences worldwide, organise your own, and run committee sessions live: roll call, speakers, motions, voting.',
    // NOTE: deliberately NO `url` here — see below.
    siteName: 'Gavelling',
    images: [OG_IMAGE],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gavelling: MUN Conferences & Committee Software',
    description:
      'Find and apply to Model UN conferences worldwide, organise your own, and run committee sessions live.',
    creator: '@wearegavelling',
    images: [OG_IMAGE_URL],
  },
  // NOTE: no root-level `openGraph.url`. Facebook and WhatsApp treat og:url as
  // the object's IDENTITY and key their preview cache on it. A hardcoded
  // homepage URL here was inherited by every page that doesn't set its own —
  // /conferences/new, /create, /join, /privacy, /terms — so each of them told
  // crawlers "I am the homepage", collapsing them all into ONE shared cache
  // entry. That is why previews broke seemingly at random and why fixes
  // appeared not to apply. Scrapers fall back to the requested URL when og:url
  // is absent, so a missing og:url is strictly better than a wrong one; pages
  // that matter set their own via `pageMetadata()` in src/lib/seo.ts.
  //
  // NOTE: no root-level `alternates` here either. A root canonical is inherited
  // by every child page that doesn't define its own `alternates`, silently
  // marking those pages as duplicates of the homepage and keeping them out of
  // the index. Each indexable page declares its own canonical instead.
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
        {/* DELIBERATE: only Playfair Display (italic) and Noto Sans Arabic are
            loaded. This matches production exactly and is Peter's explicit
            choice — do NOT "fix" it by adding Outfit or DM Mono back.

            `OUTFIT` in neu.tsx and the ~460 "'Outfit', sans-serif" style
            literals therefore fall through to the system sans (SF Pro on macOS,
            Segoe UI on Windows). That is the intended look. A previous session
            read the unloaded family as a regression from 91b40e8 and restored
            it; that change was reverted here because it altered the typography
            of the whole app away from what ships. */}
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#1B3828" />
        {/* Preload the nav logo, not the OG image. og-image.png is only ever
            fetched by crawlers building a link preview — preloading it on every
            page load spent early bandwidth on something no visitor sees, while
            the one image that IS painted immediately (the header logo) had to
            wait, flashing its alt text in the meantime. */}
        <link rel="preload" as="image" href="/Conferences.webp" type="image/webp" fetchPriority="high" />
      </head>
      <body className="min-h-full bg-[#EDE7D8] text-[#1C1410] antialiased">
        <AuthProvider>
          <LanguageProvider>
            {children}
            <DemoGate />
            <CreditsWelcomeGate />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
