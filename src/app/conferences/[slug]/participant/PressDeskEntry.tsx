'use client';

// "Press Desk" on the conference page's You tab (owner's first draft, 12 Oct 2026).
//
// Shown only to the people the database says are press here (a press seat holder, a press
// committee chair) or an accepted observer: one card, one line, one button to
// /conferences/[slug]/press. Everyone else, and everyone while scratch-press.sql is not
// applied (`my_press_access` missing), sees nothing: no heading, no empty card.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { OUTFIT } from '@/components/neu';
import { fetchMyPressAccess, type PressAccess } from '@/lib/press';
import { INK, INK_SOFT, Pane } from './dashboardKit';
import { BTN_CLASS, cardStyle, secondaryBtn, STROKE } from './delegation/leaderKit';

export default function PressDeskEntry({ conferenceId, conferenceSlug, show }: {
  conferenceId: string;
  conferenceSlug: string;
  /** The section this pane belongs to is the one shown (desktop sub-nav). */
  show: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [access, setAccess] = useState<PressAccess | null>(null);

  // Keyed on the user id, never the token.
  useEffect(() => {
    if (!userId || !conferenceId) return;
    let alive = true;
    void fetchMyPressAccess(conferenceId).then((r) => {
      if (alive) setAccess(r.kind === 'ok' ? r.value : null);
    });
    return () => { alive = false; };
  }, [userId, conferenceId]);

  if (!access?.eligible) return null;
  const press = access.canRelease;

  return (
    <Pane show={show} title="Press Desk" icon={Newspaper} anchor="press-desk">
      {/* One white lifted card like the Overview's (fine-line icon, no 3D
          emoji): the desk, the outlet a release is signed with, one light
          button (the view's one primary stays the next step). */}
      <section aria-label="Press Desk" className="flex items-center gap-4 flex-wrap p-[18px] sm:px-6 sm:py-[20px]" style={cardStyle}>
        <Newspaper size={30} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0 }} />
        <div className="min-w-0 flex-1" style={{ minWidth: 200 }}>
          <h3 style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.25 }}>Press Desk</h3>
          {press && access.label && (
            <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 600, color: INK, margin: '2px 0 0 0' }}>
              Press · {access.label}
            </p>
          )}
          <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: '4px 0 0 0', lineHeight: 1.5 }}>
            {press
              ? 'Follow every committee live, read their papers and send press releases to every room'
              : 'Follow every committee live and read their papers'}
          </p>
        </div>
        <Link href={`/conferences/${conferenceSlug}/press`} className={BTN_CLASS} style={secondaryBtn}>
          Open the press desk <ArrowRight size={16} strokeWidth={STROKE} aria-hidden />
        </Link>
      </section>
    </Pane>
  );
}
