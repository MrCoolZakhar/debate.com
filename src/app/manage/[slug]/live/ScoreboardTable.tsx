'use client';

// ─────────────────────────────────────────────────────────────────────────────
// The delegate performance table — ONE implementation, two callers.
//
//   • the per-committee scoreboard that opens from a live-status card
//     (`CommitteeScoreboardModal`), which is what the owner asked for: clicking
//     Points opens the same scoreboard the chairs see;
//   • the conference-wide `/manage/[slug]/scoreboard` route, which keeps the
//     cross-committee comparison and the CSV export.
//
// It was extracted rather than duplicated. It also drops the hardcoded palette
// the standalone page was carrying — `#FAF8F3`, `#D8CDB6` and above all
// `#9A8A78`, which measures 2.71:1 on this background and was labelling every
// column header and every secondary fact in the table.
//
// Colocated under `live/` because that is where the new primary caller lives and
// because this change is scoped to this surface; `src/components/` is the
// natural long-term home once someone can move it there.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageSquareQuote, ChevronRight, Trophy, ExternalLink } from 'lucide-react';
import { NEU, NeuInset, NeuPill, OUTFIT, EASE } from '@/components/neu';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { committeeDisplayName } from '@/lib/presetNames';
import {
  formatSpeakingTime, COMMENT_LEVEL_LABEL,
  type ConferenceScoreboard, type ScoreboardDelegateRow,
} from '@/lib/conferenceScoreboard';
import { SOFT, RED, CARD_BORDER_COLOR } from './tokens';

// Manage surfaces are English-only, so country names resolve against 'en'.
const LOCALE = 'en';
export const displayCountry = (c: string) => getCountryDisplayName(c, LOCALE);

export type SortKey = 'score' | 'speeches' | 'time' | 'comments' | 'name';

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'score', label: 'SCORE' },
  { key: 'speeches', label: 'SPEECHES' },
  { key: 'time', label: 'SPEAKING TIME' },
  { key: 'comments', label: 'COMMENTS' },
  { key: 'name', label: 'DELEGATION' },
];

export function sortScoreboardRows(rows: ScoreboardDelegateRow[], sortKey: SortKey): ScoreboardDelegateRow[] {
  const byName = (a: ScoreboardDelegateRow, b: ScoreboardDelegateRow) =>
    displayCountry(a.country).localeCompare(displayCountry(b.country), LOCALE);
  const withComments = (r: ScoreboardDelegateRow) => r.comments.filter((c) => c.content.trim()).length;
  return [...rows].sort((a, b) => {
    switch (sortKey) {
      case 'speeches': return (b.gslSpeeches + b.caucusSpeeches) - (a.gslSpeeches + a.caucusSpeeches) || byName(a, b);
      case 'time': return b.speakingSeconds - a.speakingSeconds || byName(a, b);
      case 'comments': return withComments(b) - withComments(a) || byName(a, b);
      case 'name': return byName(a, b);
      default: return b.headline - a.headline || byName(a, b);
    }
  });
}

// ── Factor bar ───────────────────────────────────────────────────────────────

function FactorBar({ name, average, scaleMax, ratings }: { name: string; average: number; scaleMax: number; ratings: number }) {
  const pct = Math.max(0, Math.min(100, (average / Math.max(1, scaleMax)) * 100));
  return (
    <div style={{ marginBlockEnd: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBlockEnd: 3 }}>
        <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: NEU.ink }}>{name}</span>
        <span
          style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT, marginInlineStart: 'auto', fontVariantNumeric: 'tabular-nums' }}
          title={`Average of ${ratings} rating${ratings === 1 ? '' : 's'}`}
        >
          {average} / {scaleMax}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.09)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, backgroundColor: NEU.forest }} />
      </div>
    </div>
  );
}

// ── Drill-in ─────────────────────────────────────────────────────────────────

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em',
  // `NEU.deepGold` is 2.72:1 here and was carrying every section heading in the
  // drill-in. Forest is 10.73:1 and is the same family.
  color: NEU.forest, marginBlockEnd: 8,
};

export function DelegateDetail({ row }: { row: ScoreboardDelegateRow }) {
  // Group the ledger by source, exactly as the chair's drill-in does. Only one
  // row is ever expanded at a time and a ledger is a few dozen entries, so this
  // runs on render without memoisation.
  const grouped: { sourceId: string; label: string; rows: typeof row.ledger; subtotal: number }[] = [];
  for (const r of row.ledger) {
    let g = grouped.find((x) => x.sourceId === r.sourceId);
    if (!g) { g = { sourceId: r.sourceId, label: r.label, rows: [], subtotal: 0 }; grouped.push(g); }
    g.rows.push(r);
    g.subtotal += r.pts;
  }
  const comments = row.comments.filter((c) => c.content.trim());

  return (
    <div style={{ backgroundColor: 'rgba(27,56,40,0.035)', borderBlockStart: `1px solid ${CARD_BORDER_COLOR}`, padding: '16px 18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        {/* Points breakdown */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <p style={SECTION_LABEL}>POINTS BREAKDOWN</p>
          {grouped.length === 0 && (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT }}>No scored activity yet.</p>
          )}
          {grouped.map((g) => (
            <div key={g.sourceId} style={{ marginBlockEnd: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.forest, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {g.label}
                </span>
                <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, marginInlineStart: 'auto', fontVariantNumeric: 'tabular-nums', color: g.subtotal < 0 ? RED : NEU.forest }}>
                  {g.subtotal < 0 ? '' : '+'}{g.subtotal}
                </span>
              </div>
              {g.rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                  <span style={{ fontFamily: OUTFIT, fontSize: 11.5, color: SOFT, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.detail || r.label}
                    {r.timestamp ? ` · ${new Date(r.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                  <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: r.pts < 0 ? RED : NEU.ink, flexShrink: 0 }}>
                    {r.pts < 0 ? '' : '+'}{r.pts}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Chair ratings + comments */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <p style={SECTION_LABEL}>CHAIR RATINGS</p>
          {row.factors.length === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT, marginBlockEnd: 14 }}>
              No factor ratings recorded by the chairs.
            </p>
          ) : (
            <div style={{ marginBlockEnd: 14 }}>
              {row.factors.map((f) => (
                <FactorBar key={f.id} name={f.name} average={f.average} scaleMax={f.scaleMax} ratings={f.ratings} />
              ))}
            </div>
          )}

          <p style={SECTION_LABEL}>CHAIR COMMENTS</p>
          {comments.length === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT }}>No written comments yet.</p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                style={{
                  backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`, borderRadius: 10,
                  padding: '9px 11px', marginBlockEnd: 7,
                }}
              >
                <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, lineHeight: 1.5 }}>{c.content}</p>
                <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT, marginBlockStart: 5 }}>
                  {COMMENT_LEVEL_LABEL[c.level]}
                  {c.chairName ? ` · ${c.chairName}` : ''}
                  {c.speechSeconds ? ` · ${c.speechSeconds}s speech` : ''}
                  {c.createdAt ? ` · ${new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

const HEADER_CELL: React.CSSProperties = {
  fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', color: SOFT,
};

export function ScoreboardTable({
  rows,
  sortKey,
  showCommitteeColumn,
  expanded,
  onExpand,
  emptyText = 'No delegations match this filter.',
}: {
  rows: ScoreboardDelegateRow[];
  sortKey: SortKey;
  showCommitteeColumn: boolean;
  expanded: string | null;
  onExpand: (key: string | null) => void;
  emptyText?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: NEU.surface,
        border: `1px solid ${CARD_BORDER_COLOR}`,
        borderRadius: 16,
        boxShadow: NEU.outSm,
        overflow: 'hidden',
      }}
    >
      {/* Header row — hidden on narrow screens where the cards stack */}
      <div
        className="hidden md:flex"
        style={{
          alignItems: 'center', gap: 12, paddingInline: 18, paddingBlock: 10,
          borderBlockEnd: `1px solid ${CARD_BORDER_COLOR}`, backgroundColor: 'rgba(27,56,40,0.04)',
        }}
      >
        <span style={{ ...HEADER_CELL, width: 28, textAlign: 'end' }}>#</span>
        <span style={{ width: 22 }} />
        <span style={{ ...HEADER_CELL, flex: 1, minWidth: 0 }}>DELEGATION</span>
        {showCommitteeColumn && <span style={{ ...HEADER_CELL, width: 120 }}>COMMITTEE</span>}
        <span style={{ ...HEADER_CELL, width: 70, textAlign: 'end' }}>SPEECHES</span>
        <span style={{ ...HEADER_CELL, width: 78, textAlign: 'end' }}>TIME</span>
        <span style={{ ...HEADER_CELL, width: 62, textAlign: 'end' }}>NOTES</span>
        <span style={{ ...HEADER_CELL, width: 62, textAlign: 'end' }}>SCORE</span>
        <span style={{ width: 16 }} />
      </div>

      {rows.length === 0 && (
        <p style={{ fontFamily: OUTFIT, fontSize: 13, color: SOFT, textAlign: 'center', padding: '40px 0' }}>
          {emptyText}
        </p>
      )}

      {rows.map((r, i) => {
        const open = expanded === r.key;
        const noteCount = r.comments.filter((c) => c.content.trim()).length;
        return (
          <div key={r.key} style={{ borderBlockEnd: i < rows.length - 1 || open ? `1px solid ${CARD_BORDER_COLOR}` : 'none' }}>
            <button
              onClick={() => onExpand(open ? null : r.key)}
              aria-expanded={open}
              className="w-full focus:outline-none px-3 py-2.5 md:px-[18px] md:py-[11px]"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: open ? 'rgba(27,56,40,0.05)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'start',
                // NEVER `flex-wrap: wrap` again — see the block comment below.
                flexWrap: 'nowrap', minHeight: 52,
                transition: `background 160ms ${EASE}`,
              }}
              onMouseEnter={(e) => { if (!open) (e.currentTarget as HTMLElement).style.background = 'rgba(27,56,40,0.03)'; }}
              onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span className="hidden md:inline-block" style={{ width: 28, fontFamily: OUTFIT, fontSize: 11.5, color: SOFT, fontVariantNumeric: 'tabular-nums', textAlign: 'end', flexShrink: 0 }}>
                {sortKey === 'name' ? '' : i + 1}
              </span>
              <span style={{ width: 22, flexShrink: 0, display: 'inline-flex' }}>
                <FlagImg code={getCountryByName(r.country)?.code ?? ''} size={20} />
              </span>
              <span style={{ flex: '1 1 0', minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: OUTFIT, fontWeight: 600, fontSize: 13.5, color: NEU.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span className="md:hidden" style={{ color: SOFT, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {sortKey === 'name' ? '' : `${i + 1}. `}
                  </span>
                  {displayCountry(r.country)}
                </span>
                {(r.status === 'absent' || r.isObserver) && (
                  <span style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT }}>
                    {r.isObserver ? 'Observer' : 'Absent'}
                  </span>
                )}
                {/* The COMMITTEE column below is `hidden md:inline-block`, so on
                    the conference-wide scoreboard — the only caller that asks
                    for it — the room a delegation belongs to would simply
                    vanish on a phone. It reappears here instead. */}
                {showCommitteeColumn && (
                  <span
                    className="block md:hidden"
                    style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={r.committeeName}
                  >
                    {committeeDisplayName(r.committeeName, r.committeeAbbrev)}
                  </span>
                )}
                {/* THE PHONE ROW, AND WHY IT EXISTS.
                    The column header above is `hidden md:flex`, so below 768px
                    nothing labelled these figures — and the row was
                    `flex-wrap: wrap`, so at 375px it broke into three lines and
                    rendered as `1 · flag · United States` / `4  10m 40s  1` /
                    `128 ›`: 110px tall, four bare numbers, and the score badge
                    orphaned on its own line under the rank. That is what "scores
                    seem broken" is.
                    Below `md` the three secondary figures move here as ONE
                    labelled line under the delegation, the score badge stays on
                    the right where a score belongs, and the row never wraps. */}
                <span
                  // `flex md:hidden`, NOT an inline `display: flex` — an inline
                  // style beats the utility class, so `md:hidden` could not turn
                  // it off and both the phone line and the desktop columns
                  // rendered at once above 768px.
                  className="flex md:hidden"
                  style={{
                    alignItems: 'center', gap: 5, marginBlockStart: 3,
                    fontFamily: OUTFIT, fontSize: 11, color: SOFT,
                    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {r.gslSpeeches + r.caucusSpeeches} {r.gslSpeeches + r.caucusSpeeches === 1 ? 'speech' : 'speeches'}
                  <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                  {formatSpeakingTime(r.speakingSeconds)}
                  <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                  <MessageSquareQuote size={11} strokeWidth={2.2} style={{ flexShrink: 0, color: noteCount ? NEU.forest : SOFT, opacity: noteCount ? 1 : 0.55 }} />
                  {noteCount}
                </span>
              </span>
              {showCommitteeColumn && (
                <span
                  className="hidden md:inline-block"
                  style={{ width: 120, flexShrink: 0, fontFamily: OUTFIT, fontSize: 11.5, color: SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={r.committeeName}
                >
                  {committeeDisplayName(r.committeeName, r.committeeAbbrev)}
                </span>
              )}
              <span
                className="hidden md:inline-block"
                style={{ width: 70, flexShrink: 0, fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, fontVariantNumeric: 'tabular-nums', textAlign: 'end' }}
                title={`${r.gslSpeeches} GSL · ${r.caucusSpeeches} caucus`}
              >
                {r.gslSpeeches + r.caucusSpeeches}
              </span>
              <span className="hidden md:inline-block" style={{ width: 78, flexShrink: 0, fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, fontVariantNumeric: 'tabular-nums', textAlign: 'end' }}>
                {formatSpeakingTime(r.speakingSeconds)}
              </span>
              <span className="hidden md:inline-flex" style={{ width: 62, flexShrink: 0, fontFamily: OUTFIT, fontSize: 12.5, color: noteCount ? NEU.forest : SOFT, opacity: noteCount ? 1 : 0.55, fontVariantNumeric: 'tabular-nums', textAlign: 'end', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                <MessageSquareQuote size={12} strokeWidth={2.2} />
                {noteCount}
              </span>
              <span className="w-auto md:w-[62px]" style={{ flexShrink: 0, textAlign: 'end' }}>
                <span
                  style={{
                    fontFamily: OUTFIT, fontWeight: 800, fontSize: 12.5, fontVariantNumeric: 'tabular-nums',
                    backgroundColor: NEU.forest, color: NEU.gold, borderRadius: 999,
                    paddingInline: 9, paddingBlock: 2, display: 'inline-block',
                  }}
                  title={r.quality != null ? `${r.objective} objective points · quality ${r.quality}/100` : `${r.objective} objective points`}
                >
                  {r.headline}
                </span>
              </span>
              <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', color: SOFT }}>
                <ChevronRight
                  size={14}
                  style={{ transform: open ? 'rotate(90deg)' : 'none', transition: `transform 160ms ${EASE}` }}
                />
              </span>
            </button>
            {open && <DelegateDetail row={r} />}
          </div>
        );
      })}
    </div>
  );
}

// ── One committee's scoreboard, as a BODY ───────────────────────────────────
//
// TWO CALLERS, ONE IMPLEMENTATION — the same rule the table above follows.
//
//   • `CommitteeScoreboardModal`, the standalone Points view opened from a
//     card's footer;
//   • the recap modal's Scoreboard side-tab, which shows the identical view
//     without making the organiser close one dialog and open another.
//
// It lives HERE rather than in `CommitteeScoreboardModal` because `LiveModals`
// (which owns the recap) is already imported BY that file — reaching back the
// other way would make the pair circular. This module imports nothing from
// either, so both can use it.
//
// It computes nothing: `loadConferenceScoreboard` scores the whole conference
// with the same functions the chair's ScoreboardPanel uses, and this filters
// that result to one committee.

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

export function CommitteeScoreboardBody({
  committeeId, scoreboard, loading, error, hasSession, delegationSize, conferenceSlug,
}: {
  /** `conference_committees.id` — exactly what a live card is keyed on, and what
   *  `ScoreboardDelegateRow.committeeId` carries. */
  committeeId: string;
  /** The whole-conference payload, loaded once by the page and filtered here.
   *  Loading it per committee would re-read the conference for every card the
   *  organiser opens. */
  scoreboard: ConferenceScoreboard | null;
  loading: boolean;
  error: string;
  /** False → the committee was never linked to a session, so there is nothing
   *  to score and the empty state says so instead of blaming the reader. */
  hasSession: boolean;
  delegationSize: number;
  conferenceSlug: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows: ScoreboardDelegateRow[] = useMemo(() => {
    const mine = (scoreboard?.rows ?? []).filter((r) => r.committeeId === committeeId);
    return sortScoreboardRows(mine, sortKey);
  }, [scoreboard, committeeId, sortKey]);

  const totals = useMemo(() => ({
    delegations: rows.length,
    speeches: rows.reduce((s, r) => s + r.gslSpeeches + r.caucusSpeeches, 0),
    seconds: rows.reduce((s, r) => s + r.speakingSeconds, 0),
    comments: rows.reduce((s, r) => s + r.comments.filter((c) => c.content.trim()).length, 0),
  }), [rows]);

  return (
    <>
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
        {delegationSize >= 2 && (
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
              hasSession
                ? 'No delegations have been scored in this committee yet.'
                : 'This committee has no live session yet, so there is nothing to score.'
            }
          />

          {/* The one link out. The conference-wide scoreboard is no longer a
              dashboard tab, but it is still where cross-committee comparison
              and the CSV export live, so it stays reachable — pre-filtered to
              this committee. */}
          <Link
            href={`/manage/${conferenceSlug}/scoreboard?committee=${encodeURIComponent(committeeId)}`}
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
    </>
  );
}
