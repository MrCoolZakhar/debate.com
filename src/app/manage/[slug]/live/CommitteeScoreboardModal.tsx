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

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Trophy, ExternalLink } from 'lucide-react';
import { NEU, NeuInset, NeuPill, OUTFIT } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';
import {
  formatSpeakingTime,
  type ConferenceScoreboard, type ScoreboardDelegateRow,
} from '@/lib/conferenceScoreboard';
import { type LiveCommittee, ModalShell } from './LiveModals';
import { ScoreboardTable, SORTS, sortScoreboardRows, type SortKey } from './ScoreboardTable';
import { committeeIdentity } from './cardModel';
import { SOFT, RED, CARD_BORDER_COLOR } from './tokens';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <NeuInset className="text-center" style={{ padding: '10px 14px', borderRadius: 12, flex: '1 1 96px', minWidth: 0 }}>
      <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 20, color: NEU.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.11em', color: SOFT, marginBlockStart: 5 }}>
        {label}
      </p>
    </NeuInset>
  );
}

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
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { title, subtitle, mono } = committeeIdentity(data.conf);

  // `ScoreboardDelegateRow.committeeId` is the `conference_committees.id`, which
  // is exactly what a live card is keyed on.
  const rows: ScoreboardDelegateRow[] = useMemo(() => {
    const mine = (scoreboard?.rows ?? []).filter((r) => r.committeeId === data.conf.id);
    return sortScoreboardRows(mine, sortKey);
  }, [scoreboard, data.conf.id, sortKey]);

  const totals = useMemo(() => ({
    delegations: rows.length,
    speeches: rows.reduce((s, r) => s + r.gslSpeeches + r.caucusSpeeches, 0),
    seconds: rows.reduce((s, r) => s + r.speakingSeconds, 0),
    comments: rows.reduce((s, r) => s + r.comments.filter((c) => c.content.trim()).length, 0),
  }), [rows]);

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

      <p className="text-[12.5px] mb-4" style={{ color: SOFT, fontFamily: OUTFIT, maxWidth: 620 }}>
        Exactly what the chairs of this committee see from the dais — objective points, speeches,
        factor ratings and written notes. Read-only: only chairs award points.
        {/* DOUBLE DELEGATION, STATED RATHER THAN SILENTLY MISCOUNTED.
            Every row below is one DELEGATION, because that is the only unit the
            live session has: `delegates` is UNIQUE on (committee_id, country),
            so two delegates sharing a seat produce one roll entry, one place in
            the speakers' list and one score. That is correct — they speak on one
            nameplate — but "12 delegations" in a double committee means 24
            people, and a reader who is not told that will read it as 12.
            Splitting the score between them would be inventing a number the
            chairs never recorded. */}
        {(data.conf.delegationSize ?? 1) >= 2 && (
          <>
            {' '}This is a <strong>double-delegation</strong> committee: each row is one delegation
            shared by two delegates, who are scored together because the chairs score the seat.
            Open a delegation from its flag on the live card to see both names.
          </>
        )}
      </p>

      {error && (
        <p
          className="text-xs mb-4"
          style={{
            fontFamily: OUTFIT, color: RED, backgroundColor: 'rgba(139,32,32,0.06)',
            border: '1px solid rgba(139,32,32,0.2)', borderRadius: 10, padding: '8px 12px',
          }}
        >
          {error}
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-14">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="flex gap-2.5 flex-wrap mb-4">
            <Stat label="DELEGATIONS" value={String(totals.delegations)} />
            <Stat label="SPEECHES" value={String(totals.speeches)} />
            <Stat label="SPEAKING TIME" value={formatSpeakingTime(totals.seconds)} />
            <Stat label="CHAIR NOTES" value={String(totals.comments)} />
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: SOFT }}>
              SORT BY
            </span>
            {SORTS.map((s) => (
              <NeuPill key={s.key} active={sortKey === s.key} onClick={() => setSortKey(s.key)}>
                {s.label}
              </NeuPill>
            ))}
          </div>

          <ScoreboardTable
            rows={rows}
            sortKey={sortKey}
            showCommitteeColumn={false}
            expanded={expanded}
            onExpand={setExpanded}
            emptyText={
              data.session
                ? 'No delegations have been scored in this committee yet.'
                : 'This committee has no live session yet, so there is nothing to score.'
            }
          />

          {/* The one link out. The conference-wide scoreboard is no longer a
              dashboard tab, but it is still where cross-committee comparison
              and the CSV export live, so it stays reachable — pre-filtered to
              this committee. */}
          <Link
            href={`/manage/${conferenceSlug}/scoreboard?committee=${encodeURIComponent(data.conf.id)}`}
            className="inline-flex items-center gap-2 mt-4 text-xs font-bold"
            style={{
              color: NEU.forest, fontFamily: OUTFIT, textDecoration: 'none',
              border: `1px solid ${CARD_BORDER_COLOR}`, borderRadius: 999, padding: '8px 14px',
            }}
          >
            <Trophy size={13} />
            Compare across committees &amp; export CSV
            <ExternalLink size={12} />
          </Link>
        </>
      )}
    </ModalShell>
  );
}
