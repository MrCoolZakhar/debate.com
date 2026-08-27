'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ONE CARD. SIX BANDS. EVERY BAND PRESENT IN EVERY STATE.
//
// The page used to ship four card shapes (not-started, default, unmod/mod,
// voting), each with a different set of regions. That is what produced the
// height chaos and the dead bands: a `grid` with `align-items: stretch` sizes
// every card in a row to the tallest, and if no child claims the surplus with
// `flex: 1`, all of it collects at the bottom as one blank strip.
//
// So the stage no longer decides which REGIONS exist — it only decides what the
// SENTENCE in band 3 says. The bands:
//
//   1  status rail       4px, the status colour, full height
//   2  identity          logo · acronym over full name · status word · idle time
//   3  the answer line   phase chip + one sentence — this IS the card, and it is
//                        the band that carries `flex: 1`, so surplus height goes
//                        somewhere meaningful instead of pooling at the bottom
//   4  warning slot      reserved height, empty most of the time
//   5  facts strip       present/total · motions · documents · chairs
//   6  footer            exactly one action
//
// The `items-stretch` + `flex-1` pattern is lifted from the committees grid in
// the same codebase (`manage/[slug]/committees/page.tsx:1568, 1587`).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  Gavel, Users, FileText, ScrollText, Trophy, Mic, AlertTriangle, Info,
} from 'lucide-react';
import { LogoDisc } from '@/components/LogoDisc';
import { FlagImg } from '@/components/FlagImg';
import AvatarStack from '@/components/AvatarStack';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { type LiveCommittee, type ChairPerson, flagCodeFor } from './LiveModals';
import {
  roomStatus, STATUS_META, idleLabel, answerLine, phaseChip, cardWarnings,
  cardFacts, fmtSpeaking, type CommitteeIdentity,
} from './cardModel';
import {
  SOFT, AMBER_INK, GREEN_INK, RED, CARD_BORDER_COLOR, CARD_SHADOW, CARD_SHADOW_HOVER,
} from './tokens';

// The card surface, its edge and its shadow all come from ./tokens, where the
// contrast measurements that justify them are written down.

/** Reserved height for the warning slot. Fixed, so a card with a warning and a
 *  card without one are the same height and the grid stays a grid. */
const WARNING_SLOT_HEIGHT = 30;

/** A fact in band 5.
 *
 *  With `onClick` it renders as a real `<button>`, not a span with a handler —
 *  the whole card is already `role="button"`, so a nested clickable MUST be
 *  focusable and Enter/Space-activatable in its own right or it is mouse-only.
 *  Every such handler also stops propagation, or the click would fall through
 *  to the card and open the recap at the top instead of at the section asked
 *  for. */
function Chip({
  children, title, onClick,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const base: React.CSSProperties = {
    backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: SOFT,
    fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums',
  };
  const cls = 'inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full';
  if (!onClick) {
    return <span className={cls} title={title} style={base}>{children}</span>;
  }
  return (
    <button
      type="button"
      className={`${cls} focus:outline-none`}
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      style={{ ...base, border: 'none', cursor: 'pointer', transition: `box-shadow 200ms ${EASE}` }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
    >
      {children}
    </button>
  );
}

// ── The card ─────────────────────────────────────────────────────────────────

export function CommitteeCard({
  data,
  identity,
  now,
  onOpen,
  onOpenRoster,
  onOpenScoreboard,
  onOpenDocuments,
}: {
  data: LiveCommittee;
  /** Acronym-over-full-name identity, resolved for the WHOLE conference at once
   *  (uniqueness within the conference is part of the rule — see
   *  `committeeIdentities`), so it is handed in rather than derived per card. */
  identity: CommitteeIdentity;
  /** The page's wall clock, passed in rather than read here.
   *
   *  Two reasons, and both matter. `Date.now()` in a render body is impure and
   *  lints as such. More importantly, the page ALSO uses `now` to derive the
   *  status counts, the filter and the sort order — if a card read its own
   *  clock, a room could be sorted as stalled and captioned as idle in the same
   *  frame. One clock, one answer. */
  now: number;
  onOpen: (d: LiveCommittee) => void;
  onOpenRoster: (d: LiveCommittee) => void;
  onOpenScoreboard: (d: LiveCommittee) => void;
  /** The WP / DR chips are doors, not decoration: they open the recap already
   *  scrolled to Documents and already narrowed to that type. */
  onOpenDocuments: (d: LiveCommittee, type: 'working-paper' | 'draft-resolution') => void;
}) {
  const [hovered, setHovered] = useState(false);

  const status = roomStatus(data, now);
  const meta = STATUS_META[status];
  const answer = answerLine(data, now);
  const phase = phaseChip(data);
  const warnings = cardWarnings(data, now);
  const facts = cardFacts(data);

  const { title, subtitle, mono } = identity;

  const chairPeople: ChairPerson[] = data.conf.chairs.length > 0
    ? data.conf.chairs
    : (data.session?.chairNames ?? []).map((name) => ({ id: null, name, avatarUrl: null }));

  const top = warnings[0] ?? null;
  const extraWarnings = Math.max(0, warnings.length - 1);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(data)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(data); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col relative focus:outline-none"
      style={{
        backgroundColor: NEU.surface,
        borderRadius: 22,
        border: `1px solid ${CARD_BORDER_COLOR}`,
        boxShadow: hovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}`,
        cursor: 'pointer',
        overflow: 'hidden',
        // The card must never be shorter than the shortest useful reading of a
        // room; the grid stretches it up from here, and band 3 absorbs the rest.
        minHeight: 236,
      }}
    >
      {/* ── BAND 1 · status rail ─────────────────────────────────────────────
          Full height, in the status colour. Never the only signal — the status
          WORD sits in band 2 right next to it. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0"
        style={{ width: 4, backgroundColor: meta.color }}
      />

      <div className="flex flex-col flex-1" style={{ padding: '16px 18px 0 20px' }}>
        {/* ── BAND 2 · identity ───────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <LogoDisc src={data.conf.logoUrl} size={42} fallbackText={mono} alt={title} />
            <div className="min-w-0">
              {/* A title that is a full name (no trustworthy acronym exists)
                  WRAPS to two lines rather than being cut mid-word. The old
                  single-line `truncate` is what produced "Disarmament a…". */}
              <h3
                className="font-extrabold"
                style={{
                  color: NEU.ink, fontFamily: OUTFIT,
                  fontSize: subtitle ? 21 : 17, lineHeight: 1.12,
                  display: '-webkit-box', WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: subtitle ? 1 : 2, overflow: 'hidden',
                  overflowWrap: 'anywhere',
                }}
                title={data.conf.name}
              >
                {title}
              </h3>
              {subtitle && (
                <p className="text-[11.5px] truncate" style={{ color: SOFT, fontFamily: OUTFIT }} title={subtitle}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Status word + idle time. Two facts, stacked, right-aligned. */}
          <div className="flex flex-col items-end flex-shrink-0" style={{ paddingBlockStart: 2 }}>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`rounded-full flex-shrink-0${meta.pulse ? ' animate-pulse' : ''}`}
                style={{
                  width: 8, height: 8, backgroundColor: meta.color,
                  boxShadow: status === 'not-started' ? `inset 0 0 0 1px ${meta.color}` : undefined,
                }}
              />
              <span
                className="text-[11px] font-extrabold uppercase"
                style={{ color: meta.ink, fontFamily: OUTFIT, letterSpacing: '0.09em' }}
              >
                {meta.label}
              </span>
            </span>
            <span
              className="text-[11px]"
              style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums', marginBlockStart: 2 }}
              title="Time since this room last showed any sign of life — a chair action, a logged speech or a chat message"
            >
              {idleLabel(data, now)}
            </span>
          </div>
        </div>

        {/* ── BAND 3 · THE ANSWER LINE ────────────────────────────────────────
            `flex: 1` — this band, not the bottom of the card, is where surplus
            height from a taller sibling in the row goes. */}
        <div className="flex flex-col justify-center flex-1" style={{ paddingBlock: 14 }}>
          <p
            className="text-[10px] font-bold uppercase"
            style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.11em', marginBlockEnd: 5 }}
          >
            {phase}
          </p>
          <div className="flex items-center gap-2.5 min-w-0">
            {answer.flag && (
              <span
                className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
                style={{ width: 30, height: 30, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
              >
                <FlagImg code={flagCodeFor(answer.flag)} size={20} />
              </span>
            )}
            <p
              className="font-bold"
              style={{
                color: NEU.ink, fontFamily: OUTFIT, fontSize: 15, lineHeight: 1.32,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {answer.text}
            </p>
          </div>
        </div>

        {/* ── BAND 4 · warning slot ───────────────────────────────────────────
            Reserved height whether or not there is a warning, so two cards side
            by side stay aligned. NOTHING but the six approved conditions ever
            enters this slot (see `cardWarnings`). */}
        <div className="flex items-center" style={{ minHeight: WARNING_SLOT_HEIGHT }}>
          {top && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 min-w-0"
              style={{
                backgroundColor: top.tone === 'red' ? 'rgba(139,32,32,0.09)' : 'rgba(184,132,74,0.15)',
                fontFamily: OUTFIT,
              }}
            >
              <AlertTriangle
                size={12}
                style={{ color: top.tone === 'red' ? RED : AMBER_INK, flexShrink: 0 }}
              />
              <span
                className="text-[11.5px] font-bold truncate"
                style={{ color: top.tone === 'red' ? RED : AMBER_INK }}
              >
                {top.text}
              </span>
              {extraWarnings > 0 && (
                <span
                  className="text-[11px] font-bold flex-shrink-0"
                  style={{ color: top.tone === 'red' ? RED : AMBER_INK, opacity: 0.8 }}
                  title={warnings.slice(1).map((w) => w.text).join(' · ')}
                >
                  +{extraWarnings}
                </span>
              )}
            </span>
          )}
        </div>

        {/* ── BAND 5 · facts strip ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5" style={{ marginBlockEnd: 12 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenRoster(data); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full focus:outline-none"
            style={{
              backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: SOFT,
              fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums',
              border: 'none', cursor: 'pointer', transition: `box-shadow 200ms ${EASE}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
            title="Open the roll — observers are excluded from this count, as they are on the dais"
          >
            <Users size={12} style={{ color: NEU.forest }} />
            {facts.present}/{facts.total} present
          </button>

          {facts.motionsRaised > 0 && (
            <Chip title="Motions the ledger can prove were raised. Only ACCEPTED motions leave a trace — the motions table is hard-deleted on both accept and reject — so this is a floor, not a total.">
              <Gavel size={12} style={{ color: NEU.forest }} />
              {facts.motionsRaised} motion{facts.motionsRaised === 1 ? '' : 's'}
            </Chip>
          )}
          {facts.motions > 0 && (
            <Chip title="Motions sitting on the chair's desk right now, awaiting a ruling">
              <Gavel size={12} style={{ color: AMBER_INK }} />
              {facts.motions} pending
            </Chip>
          )}
          {facts.wps > 0 && (
            <Chip
              title={`Open the ${facts.wps} working paper${facts.wps === 1 ? '' : 's'} submitted in this committee`}
              onClick={() => onOpenDocuments(data, 'working-paper')}
            >
              <FileText size={12} style={{ color: NEU.forest }} />
              {facts.wps} WP
            </Chip>
          )}
          {facts.drs > 0 && (
            <Chip
              title={`Open the ${facts.drs} draft resolution${facts.drs === 1 ? '' : 's'} in this committee${facts.drsPassed ? ` — ${facts.drsPassed} passed` : ''}${facts.drsFailed ? ` — ${facts.drsFailed} failed` : ''}`}
              onClick={() => onOpenDocuments(data, 'draft-resolution')}
            >
              <ScrollText size={12} style={{ color: facts.drsPassed > 0 ? GREEN_INK : NEU.forest }} />
              {facts.drs} DR
              {(facts.drsPassed > 0 || facts.drsFailed > 0) && (
                <span style={{ color: facts.drsPassed > 0 ? GREEN_INK : SOFT }}>
                  {' '}· {facts.drsPassed > 0 ? `${facts.drsPassed} passed` : `${facts.drsFailed} failed`}
                </span>
              )}
            </Chip>
          )}
          {facts.speakingSeconds > 0 && (
            <Chip title={`${facts.speeches} logged speech${facts.speeches === 1 ? '' : 'es'} totalling ${fmtSpeaking(facts.speakingSeconds)}`}>
              <Mic size={12} style={{ color: NEU.forest }} />
              {fmtSpeaking(facts.speakingSeconds)}
            </Chip>
          )}

          {/* The dais, by first name. Names, not just faces: an organiser
              walking the floor needs to know who to ask for. */}
          <span className="inline-flex items-center gap-1.5 min-w-0" style={{ marginInlineStart: 'auto' }}>
            <AvatarStack
              people={chairPeople}
              size={22}
              max={3}
              label="Chairs"
              ringColor={NEU.surface}
              shadow={NEU.outSm}
              empty={null}
            />
            <span
              className="text-[11px] font-semibold truncate"
              style={{ color: facts.chairs.length > 0 ? SOFT : AMBER_INK, fontFamily: OUTFIT, maxWidth: 150 }}
              title={data.conf.chairs.map((c) => c.name).join(', ') || 'No chair assigned'}
            >
              {facts.chairs.length > 0 ? facts.chairs.join(', ') : 'No chair assigned'}
            </span>
          </span>
        </div>
      </div>

      {/* ── BAND 6 · footer, one action ─────────────────────────────────────── */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenScoreboard(data); }}
        className="flex items-center gap-2 w-full text-left focus:outline-none"
        style={{
          // `border: none` first, then the one edge we want back — the reverse
          // order silently wipes the divider.
          border: 'none',
          borderBlockStart: `1px solid ${CARD_BORDER_COLOR}`,
          padding: '11px 18px 12px 20px',
          color: NEU.forest, fontFamily: OUTFIT,
          backgroundColor: 'transparent',
          cursor: 'pointer', transition: `background-color 200ms ${EASE}`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.045)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        title="Open the per-committee scoreboard — the same delegate performance detail the chairs see"
      >
        <Trophy size={13} style={{ flexShrink: 0 }} />
        <span className="text-xs font-bold">Points &amp; performance</span>
        <span
          className="text-[11px] ml-auto"
          style={{ color: SOFT, fontVariantNumeric: 'tabular-nums' }}
        >
          {facts.total > 0 ? `${facts.total} delegation${facts.total === 1 ? '' : 's'}` : 'no roll yet'}
        </span>
      </button>
    </div>
  );
}

// ── Status filter legend ─────────────────────────────────────────────────────

/** Replaces the five-pill glyph row. Those pills reported floor-wide totals
 *  ("Motions: 3") that named no committee, so they answered nothing an
 *  organiser could act on. These count the STATUS axis and, unlike the pills,
 *  each one is a filter — decoration turned into navigation. */
export function StatusFilterBar({
  counts, active, onPick,
}: {
  counts: { key: 'all' | ReturnType<typeof roomStatus>; label: string; value: number; color: string; ink: string }[];
  active: string;
  onPick: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {counts.map((c) => {
        const on = active === c.key;
        const dim = c.value === 0 && !on;
        return (
          <button
            key={c.key}
            onClick={() => onPick(c.key)}
            disabled={c.value === 0 && c.key !== 'all'}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 focus:outline-none"
            style={{
              fontFamily: OUTFIT, border: 'none',
              backgroundColor: on ? NEU.base : NEU.surface,
              boxShadow: on ? NEU.inSm : NEU.outSm,
              opacity: dim ? 0.5 : 1,
              cursor: c.value === 0 && c.key !== 'all' ? 'default' : 'pointer',
              transition: `box-shadow 200ms ${EASE}, opacity 200ms ${EASE}`,
            }}
            aria-pressed={on}
          >
            <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, backgroundColor: c.color }} />
            <span style={{ fontWeight: 900, fontSize: 14, color: c.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {c.value}
            </span>
            <span style={{ fontWeight: 800, fontSize: 9.5, letterSpacing: '0.11em', textTransform: 'uppercase', color: SOFT }}>
              {c.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The honest footnote under the grid. Two of the numbers on these cards mean
 *  something narrower than their label, and saying so costs one line. */
export function GridFootnote({ style }: { style?: React.CSSProperties }) {
  return (
    <p
      className="text-[11px] mt-4 flex items-start gap-1.5"
      style={{ color: SOFT, fontFamily: OUTFIT, maxWidth: 720, ...style }}
    >
      <Info size={12} style={{ flexShrink: 0, marginBlockStart: 2 }} />
      <span>
        Cards are ordered by what needs attention, not by name. <strong>Motions</strong> counts
        motions a chair accepted — rejected motions are deleted from the database and leave no
        trace, so the real total can only be higher. <strong>Quiet</strong> is the time since the
        room last did anything visible: a chair action, a logged speech, or a chat message.
      </span>
    </p>
  );
}
