'use client';

// "Hiring" with a briefcase: on an Explore card or list row whose conference has
// at least one live promoted Job Board listing (fetchHiringConferences in
// src/lib/jobBoard.ts). The card around it is a link, so the mark is its own
// control (role="link", never a nested <a>): it stops the card's navigation and
// opens /jobs?conference=<id>. Gavelling colours (Explore is a Gavelling page).

import { useRouter } from 'next/navigation';
import { Briefcase } from 'lucide-react';

export function HiringMark({ conferenceId, style }: { conferenceId: string; style?: React.CSSProperties }) {
  const router = useRouter();
  const go = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/jobs?conference=${encodeURIComponent(conferenceId)}`);
  };
  return (
    <span
      role="link"
      tabIndex={0}
      title="Open team roles on the Job Board"
      onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter') go(e); }}
      className="inline-flex items-center gap-1 cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{
        fontFamily: 'var(--font-brand), sans-serif', fontWeight: 600, fontSize: 10.5,
        color: '#1B3828', whiteSpace: 'nowrap', lineHeight: 1.2,
        ...style,
      }}
    >
      <Briefcase size={10} strokeWidth={2.4} fill="rgba(238,217,138,0.55)" aria-hidden />
      Hiring
    </span>
  );
}
