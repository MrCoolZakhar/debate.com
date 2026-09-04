import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

// page.tsx in this segment is 'use client' (code entry, chair password, role
// picker), so metadata cannot live there — Next reads it only from a Server
// Component. Same reasoning as ../create/layout.tsx: this route had none of
// its own and was inheriting the homepage's title, description and absent
// canonical, so the page people are sent to by every "join my committee"
// message could not describe itself in a search result or a link preview.
//
// The bare path is indexable. IMPORTANT: the parameterised form is not, and
// must not become so — `/join?code=ABC123` is a real URL this page reads, so an
// indexed query string would publish a live session code. robots.ts blocks
// `/join?` for that reason, and the canonical below points every variant back
// at the bare path so Google consolidates rather than indexing codes.
export const metadata: Metadata = pageMetadata({
  title: 'Join a MUN Session',
  description:
    'Enter your session code to join your Model UN committee as a delegate, chair or faculty advisor. See the speakers list, raise motions and vote from your own device.',
  path: '/join',
  keywords: [
    'join MUN committee',
    'MUN session code',
    'Model UN delegate app',
    'join Model UN session',
    'MUN speakers list',
  ],
});

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
