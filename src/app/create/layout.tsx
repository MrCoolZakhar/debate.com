import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

// page.tsx is a Client Component and cannot export `metadata`; this server
// layout supplies it. See src/app/conferences/new/layout.tsx for the rationale.
export const metadata: Metadata = pageMetadata({
  title: 'Create a Committee Session',
  description:
    'Start a free Model UN committee session on Gavelling. Name your committee, add delegations and settings, and share a six-character code so delegates can join from any device.',
  path: '/create',
  ogTitle: 'Start a free MUN committee session',
  ogDescription:
    'Set up a committee in under a minute and share a six-character code. Roll call, speakers list, motions and voting, all live.',
});

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
