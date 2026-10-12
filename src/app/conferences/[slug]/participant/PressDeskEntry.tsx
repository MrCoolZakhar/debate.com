'use client';

// "Press Desk" on the conference page's You tab (owner's first draft, 12 Oct 2026).
//
// Shown only to the people the database says are press here (a press seat holder, a press
// committee chair) or an accepted observer: one card, one line, one button to
// /conferences/[slug]/press. Everyone else, and everyone while scratch-press.sql is not
// applied (`my_press_access` missing), sees nothing: no heading, no empty card.

import { useEffect, useState } from 'react';
import { Newspaper } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { fetchMyPressAccess, type PressAccess } from '@/lib/press';
import { DashCard, ForestLink, INK, INK_SOFT, Pane } from './dashboardKit';

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
      <DashCard>
        <div className="flex items-start gap-4 flex-wrap">
          <span aria-hidden className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 52, height: 52, borderRadius: 999, backgroundColor: 'rgba(47,96,118,0.12)' }}>
            <Emoji3D name="Newspaper" size={32} />
          </span>
          <div className="min-w-0 flex-1" style={{ minWidth: 200 }}>
            <h3 style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.25 }}>Press Desk</h3>
            <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: '4px 0 0 0', lineHeight: 1.5 }}>
              {press
                ? 'Follow every committee live, read their papers and send press releases to every room'
                : 'Follow every committee live and read their papers'}
            </p>
          </div>
          <ForestLink href={`/conferences/${conferenceSlug}/press`}>Open the press desk</ForestLink>
        </div>
      </DashCard>
    </Pane>
  );
}
