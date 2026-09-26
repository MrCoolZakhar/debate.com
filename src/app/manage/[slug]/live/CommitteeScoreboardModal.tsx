'use client';

// ─────────────────────────────────────────────────────────────────────────────
// The per-committee scoreboard, opened from a live-status card.
//
// The owner's ask, verbatim: the scoreboard should not be its own dashboard tab;
// it should open when you click a committee in live status, and clicking Points
// should open the same scoreboard the chairs see, with full delegate performance
// detail. And (23 Sep 2026): "Amend this to be the absolute same."
//
// It computes NOTHING and renders the chair's own board: `SessionScoreboardBoard`
// (./SessionBoard) is the chair's `ScoreboardPanel` body — the three icon chips,
// Ranking (header sorting, round flags, the chair's score cell, `DelegateProfile`
// on expand), Matrix and History — minus the Moderator's manual points and note
// editing, because an organiser observes and never scores. The session is read by
// `useSessionCommittee` through the chair page's own loaders.
// ─────────────────────────────────────────────────────────────────────────────

import { NEU, OUTFIT } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';
import { type LiveCommittee, ModalShell } from './LiveModals';
import { committeeIdentity } from './cardModel';
import { SessionScoreboardBoard, SessionLoadState } from './SessionBoard';
import { useSessionCommittee } from './useSessionCommittee';
import { SOFT } from './tokens';

export function CommitteeScoreboardModal({
  data,
  onClose,
}: {
  data: LiveCommittee;
  onClose: () => void;
}) {
  const { title, subtitle, mono } = committeeIdentity(data.conf);
  const live = useSessionCommittee(data.session?.code ?? null);
  const double = (data.conf.delegationSize ?? 1) >= 2;

  return (
    <ModalShell onClose={onClose} maxWidth={880}>
      <div className="flex items-center gap-3 mb-4" style={{ paddingInlineEnd: 36 }}>
        <LogoDisc src={data.conf.logoUrl} size={40} fallbackText={mono} alt={title} />
        <div className="min-w-0">
          <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: SOFT }}>
            Scoreboard
          </p>
          <h2 className="font-black [overflow-wrap:anywhere]" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 23, lineHeight: 1.1 }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs [overflow-wrap:anywhere]" style={{ color: SOFT, fontFamily: OUTFIT }}>{subtitle}</p>
          )}
        </div>
      </div>
      {double && (
        <p className="text-[12.5px] mb-4" style={{ color: SOFT, fontFamily: OUTFIT, maxWidth: 620 }}>
          A double-delegation committee: each row is one delegation shared by two delegates,
          scored together because the chairs score the seat.
        </p>
      )}

      <SessionLoadState loading={live.loading && !live.data} error={live.error} hasSession={!!data.session}>
        {live.data && <SessionScoreboardBoard committee={live.data.committee} feedback={live.data.feedback} />}
      </SessionLoadState>
    </ModalShell>
  );
}
