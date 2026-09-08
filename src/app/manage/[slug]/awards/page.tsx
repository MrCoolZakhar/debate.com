// ============================================================
// /manage/[slug]/awards is RETIRED for now.
//
// Awards no longer have their own destination in the manage rail. They live as
// a tab inside Settings (Settings → Awards), which currently renders a
// "coming soon" state instead of the working configuration UI.
//
// This route stays alive purely so an existing bookmark, an old email link or
// a link from another surface lands somewhere sensible instead of a 404. It
// redirects to the Settings tab.
//
// NOTHING WAS DELETED. The full secretariat awards desk (review, return with a
// note, edit a slate, delegation standings, publish, certificates CSV) is
// preserved unrendered beside this file in ./AwardsConsole.tsx, and every read
// and write it uses still lives in src/lib/awardsService.ts. To bring the desk
// back, replace this file's contents with:
//
//     export { default } from './AwardsConsole';
//
// and restore the rail entry in ../layout.tsx.
// ============================================================

import { redirect } from 'next/navigation';

export default async function AwardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/manage/${slug}/settings?tab=awards`);
}
