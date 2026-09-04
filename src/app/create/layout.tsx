import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

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
// committee" is exactly the intent it serves. robots.ts disallows `/create/`
// (with the trailing slash), which blocks sub-paths without blocking this page.
export const metadata: Metadata = pageMetadata({
  title: 'Create a MUN Committee',
  description:
    'Set up a Model UN committee in under a minute — delegates, topic, speaking times and voting rules. Then run it live: roll call, speakers list, motions, caucuses and voting. Free, no account needed.',
  path: '/create',
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

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
