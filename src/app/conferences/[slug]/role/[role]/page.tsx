// Participant view with a specific role active. Signed out, renders the
// sign-in state with next pointing back to this exact URL. Signed in but not
// holding this role, ConferenceDetailClient falls back to the viewer's
// default role via router.replace.
import type { Metadata } from 'next';
import ConferenceDetailClient from '../../ConferenceDetailClient';

// This route is a per-viewer application dashboard (documents, status,
// whichever role the visitor happens to hold), not a distinct piece of
// public content — it has nothing of its own worth ranking, and every
// visitor's own is different from every other's. robots.ts also disallows
// crawling /conferences/*/role going forward; this noindex additionally
// de-lists the URLs Google already crawled before that existed.
export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

export default async function ConferenceRolePage({ params }: { params: Promise<{ slug: string; role: string }> }) {
  const { role } = await params;
  return <ConferenceDetailClient initialView="participant" initialRole={role} />;
}
