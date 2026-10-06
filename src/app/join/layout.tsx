import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import JoinGuide from './JoinGuide';
import { JOIN_SCHEMAS, jsonLd } from './sessionsSchema';

// page.tsx in this segment is 'use client' (code entry, chair password, role
// picker), so metadata cannot live there — Next reads it only from a Server
// Component. Same reasoning as ../create/layout.tsx: this route had none of
// its own and was inheriting the homepage's title, description and absent
// canonical, so the page people are sent to by every "join my committee"
// message could not describe itself in a search result or a link preview.
//
// The bare path is indexable. IMPORTANT: the parameterised form is not, and
// must not become so — `/join?code=ABC123` is a real URL this page reads, so an
// indexed query string would publish a live session code. next.config.ts
// sends `X-Robots-Tag: noindex` for `/join` with a code, mode or idle param
// (crawlable, so Google sees it; a robots.txt Disallow would hide the noindex),
// and the canonical below points every variant back at the bare path.
export const metadata: Metadata = pageMetadata({
  title: 'Join a MUN Session',
  description:
    'Enter your session code to join your Model UN committee as a delegate, chair or faculty advisor. Follow the speakers list, ask to speak, chat and vote from your own phone. Free.',
  path: '/join',
  keywords: [
    'join MUN committee',
    'MUN session code',
    'Model UN delegate app',
    'join Model UN session',
    'MUN speakers list',
  ],
});

// The page itself (a client component) renders the h1: in the raw HTML it is the
// Suspense fallback's h1 and sentence (useSearchParams keeps the form
// client-side). Below it, JoinGuide adds a short visible "How Joining Works"
// section, and the JSON-LD (WebApplication, FAQPage built from that section's
// English text, BreadcrumbList) is in the raw HTML too (item 17, Oct 2026).
export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {JOIN_SCHEMAS.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      ))}
      {children}
      <JoinGuide />
    </>
  );
}
