'use client';

// ─────────────────────────────────────────────────────────────────────────────
// The per-committee scoreboard, opened from a live-status card.
//
// The owner's ask, verbatim: the scoreboard should not be its own dashboard tab;
// it should open when you click a committee in live status, and clicking Points
// should open the same scoreboard the chairs see, with full delegate performance
// detail.
//
// It computes NOTHING. `src/lib/conferenceScoreboard.ts` already loads and
// scores every delegation in the conference with the SAME functions the chair's
// ScoreboardPanel uses; this filters that result to one committee and renders it
// through the shared `ScoreboardTable`. Nothing is duplicated and nothing is
// re-derived, so the secretariat's number and the chair's number cannot drift.
// ─────────────────────────────────────────────────────────────────────────────

import { NEU, OUTFIT } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';
import { type ConferenceScoreboard } from '@/lib/conferenceScoreboard';
import { type LiveCommittee, ModalShell } from './LiveModals';
import { CommitteeScoreboardBody } from '@/components/ScoreboardTable';
import { committeeIdentity } from './cardModel';
import { SOFT } from './tokens';

export function CommitteeScoreboardModal({
  data,
  scoreboard,
  loading,
  error,
  conferenceSlug,
  onClose,
}: {
  data: LiveCommittee;
  /** The whole-conference scoreboard, loaded once by the page and filtered here.
   *  Loading it per committee would re-read the conference for every card the
   *  organiser opens. */
  scoreboard: ConferenceScoreboard | null;
  loading: boolean;
  error: string;
  conferenceSlug: string;
  onClose: () => void;
}) {
  const { title, subtitle, mono } = committeeIdentity(data.conf);

  return (
    <ModalShell onClose={onClose} maxWidth={880}>
      <div className="flex items-center gap-3 mb-1" style={{ paddingInlineEnd: 36 }}>
        <LogoDisc src={data.conf.logoUrl} size={40} fallbackText={mono} alt={title} />
        <div className="min-w-0">
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: SOFT }}>
            POINTS &amp; PERFORMANCE
          </p>
          <h2 className="font-black truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 23, lineHeight: 1.1 }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs truncate" style={{ color: SOFT, fontFamily: OUTFIT }}>{subtitle}</p>
          )}
        </div>
      </div>

      <CommitteeScoreboardBody
        committeeId={data.conf.id}
        scoreboard={scoreboard}
        loading={loading}
        error={error}
        hasSession={!!data.session}
        delegationSize={data.conf.delegationSize ?? 1}
        conferenceSlug={conferenceSlug}
      />
    </ModalShell>
  );
}
