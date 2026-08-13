import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

// page.tsx is a Client Component and cannot export `metadata`; this server
// layout supplies it. See src/app/conferences/new/layout.tsx for the rationale.
// This is the single most-shared link in the product — a chair pastes it into a
// group chat with the session code — so it must never fall back to the generic
// site card.
export const metadata: Metadata = pageMetadata({
  title: 'Join a Committee Session',
  description:
    'Enter your six-character session code to join a live Model UN committee on Gavelling as a delegate, chair or faculty advisor. No download, no account needed.',
  path: '/join',
  ogTitle: 'Join a live MUN committee session',
  ogDescription:
    'Enter your session code to join as a delegate, chair or faculty advisor. Works on any device, no download needed.',
});

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
