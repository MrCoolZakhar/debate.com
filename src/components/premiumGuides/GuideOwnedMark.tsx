'use client';

// A small mark (icon + word, no pill) on a premium guide the signed-in reader can read: "Yours" when
// they unlocked it for 1 credit, "Included" when Unlimited covers it. Renders
// nothing until guide_access says so, so the server-rendered card never
// shifts for a visitor who is signed out. Pass `access` when the caller
// already holds it (the cards do), else it reads its own.

import { BadgeCheck } from 'lucide-react';
import type { GuideAccess } from '@/lib/guideAccess';
import { useGuideAccess } from '@/lib/useGuideAccess';

export default function GuideOwnedMark({ slug, access }: { slug: string; access?: GuideAccess | null }) {
  const own = useGuideAccess(slug);
  const a = access === undefined ? own : access;
  if (!a?.can_read) return null;
  const word = a.unlocked ? 'Yours' : 'Included';
  // An icon and a word inline, never a pill (CLAUDE.md §8 rule 9).
  return (
    <span
      title={a.unlocked ? 'You unlocked this guide. It is yours to keep' : 'Included with your Unlimited plan'}
      className="inline-flex items-center gap-1"
      style={{
        fontFamily: 'var(--font-brand), sans-serif', fontSize: 12.5, fontWeight: 800,
        color: '#1B3828', marginLeft: 10,
      }}
    >
      <BadgeCheck size={14} strokeWidth={2.4} aria-hidden />
      {word}
    </span>
  );
}
