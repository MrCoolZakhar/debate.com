'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ONE DELEGATION'S CARD — opened by clicking its flag in a live card's queue.
//
// The owner's ask: each flag in the speakers' list is clickable and opens "that
// delegate's scoreboard: a small CV of their performance in committee and who
// they are", resolving in a conference context to the ACTUAL PERSON representing
// the delegation rather than just the country name.
//
// IT COMPUTES NOTHING. Both halves are lookups into data the page already has:
//
//   • PERFORMANCE — one `ScoreboardDelegateRow` out of the conference scoreboard
//     that `CommitteeScoreboardModal` already renders. Same loader
//     (`loadConferenceScoreboard`), same row, same `DelegateDetail` drill-in, so
//     the number here and the number in the committee scoreboard and the number
//     on the chair's own ScoreboardPanel cannot drift. Nothing is re-derived.
//   • THE PEOPLE — the seats of `conference_allocations` for this committee and
//     this delegation, from the index in ./allocations.
//
// DOUBLE DELEGATION IS THE NORMAL CASE HERE, not an edge case. A delegation is
// ONE seat on the floor and up to TWO people behind it, so this modal shows one
// performance record and a list of holders. That asymmetry is the whole reason
// this is a separate surface from the scoreboard table, which is per-seat.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { UserRound, Users2 } from 'lucide-react';
import { NEU, NeuInset, OUTFIT } from '@/components/neu';
import { FlagImg } from '@/components/FlagImg';
import Avatar from '@/components/Avatar';
import {
  formatSpeakingTime,
  type ConferenceScoreboard, type ScoreboardDelegateRow,
} from '@/lib/conferenceScoreboard';
import { type LiveCommittee, ModalShell, flagCodeFor } from './LiveModals';
import { DelegateDetail, displayCountry } from './ScoreboardTable';
import { committeeIdentity } from './cardModel';
import { allocationKey, type AllocationIndex, type AllocatedPerson } from './allocations';
import { SOFT, RED, GREEN_INK, AMBER_INK, CARD_BORDER_COLOR } from './tokens';

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  // `NeuInset` takes no `title`, so the tooltip goes on a wrapper rather than
  // being dropped — the breakdown behind SCORE and SPEECHES is the whole reason
  // those two tiles are readable at a glance.
  return (
    <div style={{ flex: '1 1 88px', minWidth: 0 }} title={title}>
      <NeuInset className="text-center" style={{ padding: '10px 14px', borderRadius: 12 }}>
        <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 19, color: NEU.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </p>
        <p style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.11em', color: SOFT, marginBlockStart: 5 }}>
          {label}
        </p>
      </NeuInset>
    </div>
  );
}

/** One seat of the delegation, and whoever holds it. */
function SeatRow({ person, showSeat }: { person: AllocatedPerson; showSeat: boolean }) {
  return (
    <div
      className="flex items-center gap-2.5 min-w-0"
      style={{
        backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`,
        borderRadius: 12, padding: '9px 12px',
      }}
    >
      {person.name ? (
        <Avatar url={person.avatarUrl} name={person.name} size={30} rounded />
      ) : (
        <span
          className="inline-flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 30, height: 30, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
          aria-hidden
        >
          <UserRound size={15} style={{ color: SOFT }} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {/* NEU.ink 15.24:1 for a real name; AMBER_INK 5.70:1 for the honest
            absence. `NEU.muted` would have been the instinct here and is
            2.81:1 — decoration only, never a sentence someone has to read. */}
        <p
          className="font-bold"
          style={{
            fontFamily: OUTFIT, fontSize: 13.5, lineHeight: 1.3,
            color: person.name ? NEU.ink : AMBER_INK,
            overflowWrap: 'anywhere',
          }}
        >
          {person.name ?? 'Seat not assigned to anyone yet'}
        </p>
        {showSeat && (
          <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: SOFT, marginBlockStart: 2 }}>
            DELEGATE {person.seat}
          </p>
        )}
      </div>
    </div>
  );
}

export function DelegateCardModal({
  data,
  country,
  scoreboard,
  allocations,
  loading,
  error,
  onClose,
}: {
  data: LiveCommittee;
  country: string;
  /** The whole-conference scoreboard, loaded once by the page. */
  scoreboard: ConferenceScoreboard | null;
  /** The whole-conference allocation index, loaded once by the page. Null while
   *  it is still in flight or after it failed — the modal degrades to the
   *  delegation without its people rather than refusing to open. */
  allocations: AllocationIndex | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const { title } = committeeIdentity(data.conf);

  // `ScoreboardDelegateRow.country` is `delegates.country`, the same string the
  // speakers' list stores, so the flag we were clicked from matches it exactly.
  const row: ScoreboardDelegateRow | null = useMemo(
    () => (scoreboard?.rows ?? []).find(
      (r) => r.committeeId === data.conf.id && r.country === country,
    ) ?? null,
    [scoreboard, data.conf.id, country],
  );

  const people = allocations?.get(allocationKey(data.conf.id, country)) ?? [];
  // The committee-wide flag, mirrored from `committee_country_slots` by the
  // conferences layer. `>= 2` rather than `=== 2` so a future three-delegate
  // format does not silently read as single.
  const isDouble = (data.conf.delegationSize ?? 1) >= 2;

  const onFloor = data.currentSpeaker?.country === country;
  const gslPos = data.gslQueue.indexOf(country);
  const caucusPos = data.caucusQueue.indexOf(country);
  const rollStatus = data.delegates.find((d) => d.country === country)?.status ?? null;

  return (
    <ModalShell onClose={onClose} maxWidth={720}>
      {/* ── Who ── */}
      <div className="flex items-center gap-3 mb-4" style={{ paddingInlineEnd: 36 }}>
        <span
          className="inline-flex items-center justify-center rounded-full flex-shrink-0 overflow-hidden"
          style={{ width: 52, height: 52, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
          aria-hidden
        >
          <FlagImg code={flagCodeFor(country)} size={34} />
        </span>
        <div className="min-w-0">
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: SOFT }}>
            {title.toUpperCase()}
          </p>
          <h2 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1, overflowWrap: 'anywhere' }}>
            {displayCountry(country)}
          </h2>
          <p className="text-xs" style={{ color: SOFT, fontFamily: OUTFIT, marginBlockStart: 2 }}>
            {onFloor
              ? 'Has the floor right now'
              : gslPos >= 0
                ? `Number ${gslPos + 1} on the speakers' list`
                : caucusPos >= 0
                  ? `Number ${caucusPos + 1} in the caucus queue`
                  : rollStatus
                    ? `On the roll · ${rollStatus.replace('-', ' & ')}`
                    : 'Not on the live roll'}
          </p>
        </div>
      </div>

      {/* ── The people behind the nameplate ──
          A delegation is one seat on the floor and, under double delegation, two
          people. The live session tables cannot express that — `delegates` is
          UNIQUE on (committee_id, country) — so this is the only surface on the
          page where the second person can appear at all. */}
      <div className="mb-5">
        <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: NEU.forest, marginBlockEnd: 8 }}>
          {isDouble ? 'DOUBLE DELEGATION' : 'REPRESENTED BY'}
        </p>
        {people.length > 0 ? (
          <div className="flex flex-col gap-2">
            {people.map((p) => (
              <SeatRow key={p.allocationId} person={p} showSeat={isDouble || people.length > 1} />
            ))}
            {isDouble && people.length === 1 && (
              <p className="text-[11.5px]" style={{ color: AMBER_INK, fontFamily: OUTFIT }}>
                This is a double-delegation seat and only one of its two places is allocated.
              </p>
            )}
          </div>
        ) : (
          // DEGRADE HONESTLY. This is common, not exceptional: 37.5% of
          // production allocations have no `user_id`, and a delegation can also
          // be on a chair's live roll while having no allocation row at all —
          // measured, chairs do edit the live roster away from the allocation
          // table (YOMUN's IPL committee is the clearest case). Saying which of
          // those it is would be a guess, so this says what is true: the link
          // could not be resolved, and the delegation still stands.
          <NeuInset style={{ padding: '11px 13px', borderRadius: 12 }}>
            <p className="text-[12.5px]" style={{ color: SOFT, fontFamily: OUTFIT }}>
              {allocations === null
                ? 'Still loading who holds this delegation.'
                : "No allocation is on file for this delegation, so it can't be matched to a person. "
                  + 'The chair may have added it to the live roll directly, or the seat may not have been assigned yet.'}
            </p>
          </NeuInset>
        )}
      </div>

      {/* ── Performance ── */}
      <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: NEU.forest, marginBlockEnd: 8 }}>
        PERFORMANCE IN COMMITTEE
      </p>

      {error && (
        <p
          className="text-xs mb-3"
          style={{
            fontFamily: OUTFIT, color: RED, backgroundColor: 'rgba(139,32,32,0.06)',
            border: '1px solid rgba(139,32,32,0.2)', borderRadius: 10, padding: '8px 12px',
          }}
        >
          {error}
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && !error && !row && (
        <NeuInset style={{ padding: '14px 16px', borderRadius: 12 }}>
          <p className="text-[12.5px]" style={{ color: SOFT, fontFamily: OUTFIT }}>
            This delegation has not been scored in this committee yet.
          </p>
        </NeuInset>
      )}

      {!loading && !error && row && (
        <>
          <div className="flex gap-2.5 flex-wrap mb-3">
            <Stat
              label="SCORE"
              value={String(row.headline)}
              title={row.quality != null
                ? `${row.objective} objective points · quality ${row.quality}/100`
                : `${row.objective} objective points`}
            />
            <Stat
              label="SPEECHES"
              value={String(row.gslSpeeches + row.caucusSpeeches)}
              title={`${row.gslSpeeches} on the speakers' list · ${row.caucusSpeeches} in caucus`}
            />
            <Stat label="SPEAKING TIME" value={formatSpeakingTime(row.speakingSeconds)} />
            <Stat label="MOTIONS" value={String(row.motions)} />
            <Stat
              label="NOTES"
              value={String(row.comments.filter((c) => c.content.trim()).length)}
            />
          </div>

          {(row.workingPapers > 0 || row.draftResolutions > 0 || row.rightsOfReply > 0) && (
            <p className="text-[11.5px] mb-3 flex items-center gap-1.5" style={{ color: GREEN_INK, fontFamily: OUTFIT }}>
              <Users2 size={12} style={{ flexShrink: 0 }} />
              <span>
                Sponsored {row.workingPapers} working paper{row.workingPapers === 1 ? '' : 's'}
                {' · '}{row.draftResolutions} draft resolution{row.draftResolutions === 1 ? '' : 's'}
                {row.rightsOfReply > 0 && ` · ${row.rightsOfReply} right${row.rightsOfReply === 1 ? '' : 's'} of reply`}
              </span>
            </p>
          )}

          {/* The SAME drill-in the committee scoreboard opens — points ledger,
              chair factor ratings and chair comments. Imported, not rebuilt. */}
          <div style={{ border: `1px solid ${CARD_BORDER_COLOR}`, borderRadius: 14, overflow: 'hidden' }}>
            <DelegateDetail row={row} />
          </div>
        </>
      )}
    </ModalShell>
  );
}
