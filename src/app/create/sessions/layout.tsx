import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { CREATE_SESSION_SCHEMAS, jsonLd } from '@/app/join/sessionsSchema';

// page.tsx in this segment is 'use client' (the whole committee-setup form is
// interactive), so metadata cannot live there — Next reads it only from a
// Server Component. A layout is the standard way to attach it without
// converting the page.
//
// Until now this route had NO metadata of its own. It inherited the root
// layout's, which means it claimed the homepage's title and description, and —
// because the root deliberately sets no `openGraph.url` — it had no canonical
// either. So the page a chair actually lands on to start a committee was
// invisible as itself: no own title in a search result, no own link preview,
// and nothing telling Google it is a distinct page rather than a duplicate.
//
// Indexable on purpose. It is public, needs no account, and "create a Model UN
// committee" is exactly the intent it serves, and it is in the sitemap.
// Since 25 Sep 2026 this segment is /create/sessions: /create itself is the
// chooser page (a committee or a conference), which links here.
export const metadata: Metadata = pageMetadata({
  title: 'Create a MUN Committee',
  description:
    'Set up a Model UN committee in under a minute: delegates, topic, speaking times and voting rules. Then run it live: roll call, speakers list, motions, caucuses and voting. Free, no account needed.',
  path: '/create/sessions',
  keywords: [
    'create MUN committee',
    'run a MUN session',
    'MUN chair tool',
    'Model UN committee setup',
    'free MUN software',
    'GSL timer',
    'MUN roll call',
  ],
});

// JSON-LD (WebApplication, free; BreadcrumbList) in the raw HTML (item 17, Oct
// 2026). No visible section is added here: this set-up screen is a one-screen
// console (CLAUDE.md §8), so its h1 stays the page's own screen-reader heading
// and the form's English labels are the raw text. No FAQPage either, because
// FAQ structured data must match text visible on the page.
export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {CREATE_SESSION_SCHEMAS.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      ))}
      {children}
    </>
  );
}
