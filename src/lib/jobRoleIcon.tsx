// The icon for each Job Board role (owner, 31 Oct 2026: "add icons for the roles"). The same
// choice the organiser's posting pop-up makes (manage/[slug]/jobs/PostingPopup.tsx): a gavel for
// chairs, the institution for the secretariat, people for staff. Drawn style A: fine line, bare
// ink, no tile (CLAUDE.md §8).

import { Gavel, Landmark, Users } from 'lucide-react';
import type { JobRole } from '@/lib/jobBoard';

/** The role's fine-line icon. A fixed component (not one picked during render). */
export function JobRoleGlyph({ role, size = 17 }: { role: JobRole | string | null | undefined; size?: number }) {
  if (role === 'chair') return <Gavel size={size} strokeWidth={1.6} aria-hidden />;
  if (role === 'secretariat') return <Landmark size={size} strokeWidth={1.6} aria-hidden />;
  return <Users size={size} strokeWidth={1.6} aria-hidden />;
}
