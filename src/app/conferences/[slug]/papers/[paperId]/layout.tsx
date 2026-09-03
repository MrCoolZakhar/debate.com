import type { Metadata } from 'next';

// page.tsx in this segment is 'use client' (PDF viewer + review chat thread),
// so generateMetadata can't live there — Next only reads it from a Server
// Component. A layout is the standard way to attach metadata to a client
// page without converting it. This route is a single position paper visible
// only to its owner(s), their seatmates, chairs and organizers (access comes
// entirely from RLS, see the comment atop page.tsx) — there is nothing here
// for a crawler to index, and robots.ts now disallows /conferences/*/papers
// too, but that only stops future crawling, not URLs already indexed.
export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

export default function PaperDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
