import type { Metadata, Viewport } from 'next';
import { OG_IMAGE, OG_IMAGE_URL } from '@/lib/seo';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';
import DemoGate from '@/components/DemoGate';
import CreditsWelcomeGate from '@/components/CreditsWelcomeGate';
import SetupReminderGate from '@/components/SetupReminderGate';
import CompleteBasicsGate from '@/components/CompleteBasicsGate';
import LiveRoomsGate from '@/components/liveRooms/LiveRoomsGate';
import AuthModalHost from '@/components/auth/AuthModal';
import PurchasePopupHost from '@/components/purchase/PurchasePopupHost';
import SiteViewBeacon from '@/components/SiteViewBeacon';
import Script from 'next/script';
import { DOM_TRANSLATION_GUARD } from '@/lib/domTranslationGuard';
import { Inter } from 'next/font/google';
import SessionsRouteFlag from '@/components/SessionsRouteFlag';

// THE typeface: Inter everywhere (owner, 26 Sep 2026: Albert Sans felt "too
// weird"; Inter is the closest open face to the SF Pro Macs showed before).
// It replaced Albert Sans (24 Sep 2026), exposed as the
// CSS variable --font-brand. (Schibsted Grotesk was tried first the same day
// and dropped because its capital I carries serifs.) Loaded
// through next/font, so it is self-hosted from our own origin (no request to
// Google at runtime) and every device renders the same face. Before this the
// site named 'Outfit' in ~870 places but never loaded it, so each device fell
// back to its own system font (SF Pro, Segoe UI, Roboto) and the site looked
// different everywhere. Every former "'Outfit', sans-serif" literal now reads
// var(--font-brand); `latin-ext` covers names like Aytuğ or Łukasz.
const brandFont = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-brand',
  display: 'swap',
});

// Inter one weight lighter everywhere except Gavelling Sessions (26 Sep 2026).
// Every inline weight and its Tailwind class reads one step lighter.
const LIGHTER_WEIGHTS_CSS = ([['900', '800', 'font-black'], ['800', '700', 'font-extrabold'], ['700', '600', 'font-bold'], ['600', '500', 'font-semibold']] as const)
  .map(([w, n, cls]) => `[style*="font-weight:${w}"],[style*="font-weight: ${w}"],.${cls}{font-weight:${n}!important}`)
  .join('');
const SESSION_PATHS = ['/create/sessions', '/join', '/chair', '/delegate', '/advisor', '/voting', '/sessions'];
const LIGHTER_WEIGHTS_SCRIPT = `(function(){var p=location.pathname;var s=${JSON.stringify(SESSION_PATHS)}.some(function(x){return p===x||p.indexOf(x+'/')===0});var e=document.createElement('style');e.id='gv-lighter-weights';e.media=s?'not all':'all';e.textContent=${JSON.stringify(LIGHTER_WEIGHTS_CSS)};document.head.appendChild(e)})();`;

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
  /* No `verification` key on purpose. gavelling.com is already a verified
     Search Console property via the file method — public/google0ba54760c43d1bc3.html,
     live and serving 200. A second meta-tag verification would be redundant,
     and the placeholder token that briefly sat here verified nothing at all. */
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
    <html lang="en" className={`h-full ${brandFont.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Playfair Display (italic, the gold accent word) and Noto Sans
            Arabic come from Google Fonts; the main face, Inter,
            is self-hosted through next/font (see `brandFont` above). */}
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#1B3828" />
        {/* Preload the nav logo, not the OG image. og-image.png is only ever
            fetched by crawlers building a link preview — preloading it on every
            page load spent early bandwidth on something no visitor sees, while
            the one image that IS painted immediately (the header logo) had to
            wait, flashing its alt text in the meantime. */}
        <link rel="preload" as="image" href="/gavelling-logo.png" type="image/png" fetchPriority="high" />
      </head>
      <body className="min-h-full bg-[#EDE7D8] text-[#1C1410] antialiased">
        {/* The translation guard (src/lib/domTranslationGuard.ts) must run
            before React hydrates. next/script's beforeInteractive puts it in
            the server HTML ahead of Next's own scripts, without the "script
            tag while rendering a React component" warning a raw <script> in
            <head> gave (25 Sep 2026). */}
        <Script id="gv-dom-guard" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: DOM_TRANSLATION_GUARD }} />
        {/* Inter one weight lighter everywhere except Gavelling Sessions (owner,
            26 Sep 2026: "do it for the rest", "do not change anything about
            sessions"): 900 reads 800, 800 700, 700 600, 600 500. The rules live in
            <style id="gv-lighter-weights">, added before first paint and switched
            off on a Sessions path (media "not all") here and by SessionsRouteFlag
            on client navigation. A <style> in head, not an attribute on <html>, so
            hydration never sees a mismatch. The paths mirror src/lib/sessionRoutes.ts. */}
        <Script id="gv-sessions-flag" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: LIGHTER_WEIGHTS_SCRIPT }} />
        <SessionsRouteFlag />
        <AuthProvider>
          <LanguageProvider>
            {children}
            {/* Anonymous site-wide page counter: { page, source } once per page
                per session, nothing else (src/lib/siteView.ts). */}
            <SiteViewBeacon />
            <DemoGate />
            {/* Buying credits or Unlimited is a pop-up on every page
                (src/lib/purchasePopup.ts). Mounted BEFORE the auth host so a
                sign-in prompt raised from inside it renders on top. */}
            <PurchasePopupHost />
            {/* "Log in or sign up" is a pop-up on every page (src/lib/authModal.ts).
                While it is open the three gates below stand down. */}
            <AuthModalHost />
            {/* CompleteBasicsGate takes precedence: the two gates after it stay
                closed while it is checking or open (src/lib/basicsGateState.ts). */}
            <CompleteBasicsGate />
            <CreditsWelcomeGate />
            <SetupReminderGate />
            {/* Your conference room is live: organiser, chair, delegate, faculty advisor
                (src/components/liveRooms). Waits for every gate above. */}
            <LiveRoomsGate />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
