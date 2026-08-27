'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ONE CARD. FIVE BANDS. EVERY BAND PRESENT IN EVERY STATE.
//
// The page once shipped four card shapes (not-started, default, unmod/mod,
// voting), each with a different set of regions. That is what produced the
// height chaos and the dead bands: a `grid` with `align-items: stretch` sizes
// every card in a row to the tallest, and if no child claims the surplus with
// `flex: 1`, all of it collects at the bottom as one blank strip.
//
// So the stage no longer decides which REGIONS exist — it only decides what the
// NOW-PLAYING PANEL in band 3 says. The bands:
//
//   1  status rail       4px, the status colour, full height
//   2  identity          logo · acronym over full name · status word · quiet time
//   3  NOW PLAYING       the Spotify-shaped panel: art, context, headline,
//                        scrubber. This IS the card, it is the only band whose
//                        content changes, and it carries `flex: 1` so surplus
//                        height goes somewhere meaningful instead of pooling at
//                        the bottom
//   4  warning slot      reserved height, empty most of the time
//   5  what has happened static facts — roll, documents, dais. Identical on
//                        every card, deliberately tight so band 3 dominates
//   6  footer            exactly one action
//
// The `items-stretch` + `flex-1` pattern is lifted from the committees grid in
// the same codebase (`manage/[slug]/committees/page.tsx:1568, 1587`).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  Users, FileText, ScrollText, Trophy, AlertTriangle, Info,
  Mic, Timer, Pause, Flag, Moon,
} from 'lucide-react';
import { LogoDisc } from '@/components/LogoDisc';
import { FlagImg } from '@/components/FlagImg';
import AvatarStack from '@/components/AvatarStack';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE } from '@/components/neu';
import { type LiveCommittee, type ChairPerson, flagCodeFor } from './LiveModals';
import {
  roomStatus, STATUS_META, idleLabel, nowPlaying, cardWarnings, cardFacts,
  type NowPlaying, type NowGlyph, type CommitteeIdentity,
} from './cardModel';
import {
  SOFT, AMBER_INK, GREEN_INK, RED, CARD_BORDER_COLOR, CARD_SHADOW, CARD_SHADOW_HOVER,
} from './tokens';

// The card surface, its edge and its shadow all come from ./tokens, where the
// contrast measurements that justify them are written down.

/** Reserved height for the warning slot. A FLOOR, not a cap: warning text is
 *  allowed to wrap now, and the grid's `items-stretch` absorbs the difference
 *  so a card with a two-line warning and a card with none still match. */
const WARNING_SLOT_HEIGHT = 30;

/** Card radius, and the gutter the now-playing panel leaves at the card edge.
 *
 *  CONCENTRIC, exactly: outer = inner + padding. An 8px gutter gives the panel
 *  the full width of the card and lets the radii line up at 24 − 8 = 16 instead
 *  of being fudged. */
const CARD_RADIUS = 24;
const PANEL_GUTTER = 8;
const PANEL_RADIUS = CARD_RADIUS - PANEL_GUTTER;

/** Card padding. Asymmetric because band 1's 4px rail eats into the start edge. */
const PAD_START = 22;
const PAD_END = 20;

/** The panel's floor. Art disc (60) + its padding (2×15) + the scrubber block
 *  (~30) — a footprint that does not move between a room mid-speech and a room
 *  that was never opened. Spotify does not collapse its now-playing bar; nor
 *  does this. */
const PANEL_MIN_HEIGHT = 150;

/** The card's floor. Raised with the rest of the type: the old 300 was sized
 *  around text that truncated, and nothing on this card truncates any more. */
const CARD_MIN_HEIGHT = 352;

/** The conference emblem STRADDLES the top edge — `LOGO_OVERHANG` px of it sit
 *  outside the card, on the page behind it.
 *
 *  Three things this has to clear, all verified by measurement:
 *    • the 4px status rail — the logo starts at PAD_START (22), so it never
 *      touches it;
 *    • the grid's top row — the grid carries `paddingBlockStart` ≥ this, or the
 *      first row of emblems would be cut by the scroll container;
 *    • the card above it in the same column — the grid's ROW gap is widened
 *      past this for the same reason.
 *  `LogoDisc` already paints a near-white disc with a soft forest shadow, which
 *  is what lets one mark read against the card AND the ivory page at once. */
const LOGO_SIZE = 60;
const LOGO_OVERHANG = 22;
/** How far the header text is pushed in to sit beside the emblem. */
const HEADER_INDENT = LOGO_SIZE + 12;

/** The up-next column. Sized to fit FIVE 17px flags on a row (5×17 + 4×4 = 101),
 *  so ten wrap to exactly two rows and the `+N` lands beside the last one.
 *  Measured against the narrowest card the grid ever produces — 3 columns at a
 *  1280px viewport. */
const UP_NEXT_WIDTH = 106;

// ── Now-playing panel ────────────────────────────────────────────────────────

const GLYPH_ICON: Record<NowGlyph, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  mic: Mic,
  timer: Timer,
  users: Users,
  ballot: ScrollText,
  pause: Pause,
  closed: Flag,
  dormant: Moon,
};

/** Eyebrow ink and meter fill per tone. Every value here is a measured token:
 *  GREEN_INK 5.68:1, AMBER_INK 5.70:1, SOFT 5.55:1. `NEU.green` and `NEU.amber`
 *  survive ONLY as the gradient fill, where the 3:1 non-text bar applies.
 *  Gold is absent on purpose — `deepGold` is 2.72:1 and gold is the text colour
 *  of every forest button in the app, so it can never be a status hue here. */
function toneInk(tone: NowPlaying['tone']): string {
  return tone === 'live' ? GREEN_INK : tone === 'warn' ? AMBER_INK : SOFT;
}
function toneFill(tone: NowPlaying['tone']): [string, string] {
  return tone === 'warn' ? NEU_GRADIENTS.amber : NEU_GRADIENTS.sage;
}

/** Headline type scales with its own length. It no longer scales to avoid a
 *  clamp — the headline WRAPS to as many lines as it needs — it scales so a
 *  delegation name reads as the biggest thing in the panel while a long
 *  chair-typed caucus purpose stays inside a sane number of lines. Every step
 *  was raised: the smallest is now 17px, up from 15.5. */
function headlineSize(text: string): number {
  if (text.length > 46) return 17;
  if (text.length > 30) return 19;
  return 22;
}

function NowPlayingPanel({ np }: { np: NowPlaying }) {
  const Glyph = GLYPH_ICON[np.glyph];
  const ink = toneInk(np.tone);
  const [from, to] = toneFill(np.tone);
  const hasMeter = np.pct !== null;
  const pct = Math.max(0, Math.min(100, np.pct ?? 0));

  return (
    <div
      className="flex flex-col justify-between flex-1"
      style={{
        backgroundColor: NEU.base,
        boxShadow: NEU.inSm,
        borderRadius: PANEL_RADIUS,
        padding: '14px 15px 13px',
        minHeight: PANEL_MIN_HEIGHT,
      }}
    >
      {/* Art + context + headline. The art is RAISED inside a pressed well —
          a token sitting in a slot, which is what neumorphism is for. */}
      <div className="flex items-start gap-3 min-w-0">
        <span
          className="flex items-center justify-center rounded-full flex-shrink-0 overflow-hidden"
          style={{ width: 60, height: 60, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
          aria-hidden
        >
          {np.flag
            ? <FlagImg code={flagCodeFor(np.flag)} size={38} />
            : <Glyph size={26} style={{ color: np.tone === 'off' ? SOFT : ink }} />}
        </span>

        <div className="min-w-0 flex-1">
          {/* The eyebrow WRAPS. It used to clamp to one line and shrink its own
              type to 9.5px to buy characters, which meant a moderated caucus
              lost its topic — the one thing that says what the room is doing.

              Long contexts drop the UPPERCASE instead of dropping characters.
              Caps plus 0.08em tracking cost roughly a third more width per
              character, and a chair-typed caucus purpose ("Financing loss and
              damage adaptation in small island developing states") set in caps
              ran to five lines in this column — a secondary line outweighing
              the headline it is supposed to introduce. Sentence case at 11px is
              BIGGER type than the caps it replaces, and it inverts back to the
              right hierarchy. Nothing is cut either way. */}
          <p
            className="font-extrabold"
            style={{
              color: ink, fontFamily: OUTFIT,
              textTransform: np.context.length > 34 ? 'none' : 'uppercase',
              fontSize: np.context.length > 34 ? 11 : 10.5,
              letterSpacing: np.context.length > 34 ? '0.005em' : '0.08em',
              lineHeight: 1.3,
              marginBlockEnd: 3,
              overflowWrap: 'anywhere',
            }}
          >
            {np.context}
          </p>
          <p
            className="font-extrabold"
            style={{
              color: np.dim ? SOFT : NEU.ink,
              fontFamily: OUTFIT,
              fontSize: headlineSize(np.headline),
              lineHeight: 1.16,
              letterSpacing: '-0.012em',
              textWrap: 'balance',
              fontVariantNumeric: 'tabular-nums',
              overflowWrap: 'anywhere',
            }}
          >
            {np.headline}
          </p>
        </div>

        {/* Who is waiting — up to ten, AS FLAGS.
            The names are gone on purpose: two names and a "+7" told a reader
            less than ten flags do, and the names are what made two the ceiling.
            Every flag keeps its delegation in `title`, so the information is
            unstacked, not dropped.
            The LABEL stays, and is not optional. RULE 1: the GSL and the caucus
            queue are strictly separate lists, and a bare row of flags with no
            label would read as one merged queue. */}
        {np.next && (() => {
          const q = np.next;
          return (
            <div className="flex-shrink-0" style={{ maxWidth: UP_NEXT_WIDTH }}>
              <p
                className="font-extrabold uppercase text-right"
                style={{
                  color: SOFT, fontFamily: OUTFIT, fontSize: 9.5,
                  letterSpacing: '0.08em', lineHeight: 1.3, marginBlockEnd: 4,
                  overflowWrap: 'anywhere',
                }}
              >
                {q.label}
              </p>
              <div className="flex flex-wrap justify-end items-center" style={{ gap: 4 }}>
                {q.names.map((n) => (
                  <span key={n} className="flex-shrink-0" style={{ lineHeight: 0 }} title={n}>
                    <FlagImg code={flagCodeFor(n)} size={17} />
                  </span>
                ))}
                {q.more > 0 && (
                  <span
                    className="font-extrabold flex-shrink-0"
                    style={{
                      color: SOFT, fontFamily: OUTFIT, fontSize: 10.5,
                      fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                    }}
                    title={`${q.more} more waiting on this list`}
                  >
                    +{q.more}
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* The scrubber. Always present — an empty track when there is genuinely
          nothing to measure, never a missing one. Every fill is derived from a
          stored anchor on each render; nothing here counts down or writes. */}
      <div style={{ marginBlockStart: 10 }}>
        <div
          className="w-full overflow-hidden"
          style={{
            height: 6, borderRadius: 6,
            backgroundColor: NEU.surface,
            boxShadow: 'inset 1px 1px 3px rgba(27,56,40,0.16), inset -1px -1px 3px rgba(255,255,255,0.75)',
            opacity: hasMeter ? 1 : 0.55,
          }}
        >
          <div
            style={{
              // inlineSize + a fill that grows from the reading-start edge keeps
              // the meter correct under RTL.
              inlineSize: `${hasMeter ? pct : 0}%`,
              height: '100%',
              borderRadius: 6,
              background: `linear-gradient(90deg, ${from}, ${to})`,
              transition: `inline-size 900ms linear`,
            }}
          />
        </div>
        {/* Both captions WRAP rather than truncate. `align-items: baseline` is
            wrong once a caption can be two lines — it would hang the second
            line below the box — so the row aligns to the start and each side
            keeps its own block. */}
        <div className="flex items-start justify-between gap-3" style={{ marginBlockStart: 7 }}>
          <span
            className="font-semibold"
            style={{
              color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums',
              fontSize: 11.5, lineHeight: 1.3, overflowWrap: 'anywhere',
            }}
          >
            {np.left}
          </span>
          <span
            className="font-extrabold text-right"
            style={{
              color: np.tone === 'off' ? SOFT : NEU.ink,
              fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums',
              fontSize: 12.5, lineHeight: 1.3, overflowWrap: 'anywhere',
            }}
          >
            {np.right}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Static facts ─────────────────────────────────────────────────────────────

/** A fact in band 5.
 *
 *  With `onClick` it renders as a real `<button>`, not a span with a handler —
 *  the whole card is already `role="button"`, so a nested clickable MUST be
 *  focusable and Enter/Space-activatable in its own right or it is mouse-only.
 *  Every such handler also stops propagation, or the click would fall through
 *  to the card and open the recap at the top instead of at the section asked
 *  for. */
function Chip({
  children, title, onClick, muted,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  muted?: boolean;
}) {
  // A zero-count chip is a PRESSED, empty well rather than a faded one.
  // Fading it was measured at 2.59:1 — below AA and unreadable — whereas the
  // inset keeps SOFT at its full 5.4:1 and still says "nothing in here".
  const base: React.CSSProperties = {
    backgroundColor: muted ? NEU.base : NEU.surface,
    boxShadow: muted ? NEU.inSm : NEU.outSm,
    color: SOFT,
    fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums',
  };
  // `whitespace-nowrap` SURVIVES here and is not a truncation: there is no
  // `text-overflow`, so a pill never renders an ellipsis. It only stops "3 WP"
  // breaking across two lines inside a 12px-tall capsule. The strip that holds
  // these pills wraps instead, so a pill that will not fit moves to the next
  // row whole rather than being cut.
  const cls = 'inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap';
  if (!onClick) {
    return <span className={cls} title={title} style={base}>{children}</span>;
  }
  return (
    <button
      type="button"
      className={`${cls} focus:outline-none active:scale-[0.96]`}
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      style={{
        ...base, border: 'none', cursor: 'pointer',
        transitionProperty: 'box-shadow, scale',
        transitionDuration: '200ms',
        transitionTimingFunction: EASE,
      }}
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
   *  frame. One clock, one answer. The page ticks it every second
   *  (`page.tsx:539`), which is what makes the scrubber live. */
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
  const np = nowPlaying(data, now);
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
        borderRadius: CARD_RADIUS,
        border: `1px solid ${CARD_BORDER_COLOR}`,
        boxShadow: hovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transitionProperty: 'box-shadow, transform',
        transitionDuration: '260ms',
        transitionTimingFunction: EASE,
        cursor: 'pointer',
        // VISIBLE, so the emblem can straddle the top edge. The clipping the
        // card still needs — squaring off the rail's ends and the footer's
        // hover fill at the rounded corners — moved to the inner shell below,
        // which the emblem is NOT a child of.
        overflow: 'visible',
        // The card must never be shorter than the shortest useful reading of a
        // room; the grid stretches it up from here, and the panel absorbs the rest.
        minHeight: CARD_MIN_HEIGHT,
      }}
    >
      {/* ── The emblem, straddling the top edge ──────────────────────────────
          Outside the clipping shell on purpose. It starts at PAD_START, so the
          4px status rail passes behind it untouched, and `LogoDisc`'s own
          near-white disc and forest shadow are what let it read against the
          card below the edge and the ivory page above it. */}
      <LogoDisc
        src={data.conf.logoUrl}
        size={LOGO_SIZE}
        fallbackText={mono}
        alt={title}
        style={{
          position: 'absolute',
          insetBlockStart: -LOGO_OVERHANG,
          insetInlineStart: PAD_START,
          zIndex: 2,
        }}
      />

      {/* The clipping shell. Everything that must respect the rounded corner
          lives in here; the emblem above does not. */}
      <div
        className="flex flex-col flex-1 relative"
        style={{ overflow: 'hidden', borderRadius: CARD_RADIUS - 1 }}
      >
        {/* ── BAND 1 · status rail ───────────────────────────────────────────
            Full height, in the status colour. Never the only signal — the
            status WORD sits in band 2 right next to it. */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0"
          style={{ width: 4, backgroundColor: meta.color }}
        />

        <div className="flex flex-col flex-1" style={{ padding: `14px ${PAD_END}px 0 ${PAD_START}px` }}>
        {/* ── BAND 2 · identity ─────────────────────────────────────────────
            Indented past the emblem, which is absolutely positioned and so
            takes no part in this flow. */}
        <div className="flex items-start justify-between gap-3" style={{ marginInlineStart: HEADER_INDENT }}>
          <div className="min-w-0">
            {/* NOTHING here truncates. A committee whose name has no
                trustworthy acronym WRAPS to as many lines as it needs — the
                old two-line clamp is what produced "Disarmament and Inter…". */}
            <h3
              className="font-extrabold"
              style={{
                color: NEU.ink, fontFamily: OUTFIT,
                fontSize: subtitle ? 22 : 18, lineHeight: 1.14,
                letterSpacing: '-0.015em',
                overflowWrap: 'anywhere',
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                style={{
                  color: SOFT, fontFamily: OUTFIT, fontSize: 12.5,
                  lineHeight: 1.25, marginBlockStart: 1, overflowWrap: 'anywhere',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Status word + quiet time. Two facts, stacked, right-aligned. */}
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
                className="font-extrabold uppercase"
                style={{ color: meta.ink, fontFamily: OUTFIT, fontSize: 12, letterSpacing: '0.09em' }}
              >
                {meta.label}
              </span>
            </span>
            <span
              style={{
                color: SOFT, fontFamily: OUTFIT, fontSize: 12,
                fontVariantNumeric: 'tabular-nums', marginBlockStart: 2,
                textAlign: 'end', overflowWrap: 'anywhere',
              }}
              title="Time since this room last showed any sign of life — a chair action, a logged speech or a chat message"
            >
              {idleLabel(data, now)}
            </span>
          </div>
        </div>

        {/* ── BAND 2b · the dais ────────────────────────────────────────────
            Chairs belong at the TOP, with the room's identity: an organiser
            walking the floor is looking for a PERSON, and hunting for that in a
            chip strip below the fold made them the least prominent fact on a
            card about a room they run. Full width — this row sits below the
            emblem's inner half, so it does not need the header's indent — and
            it WRAPS, so a four-chair dais is never cut to "Alice, Bob, Ch…". */}
        <div
          className="flex items-center gap-2 flex-wrap"
          style={{ marginBlockStart: 9 }}
        >
          <AvatarStack
            people={chairPeople}
            size={24}
            max={4}
            label="Chairs"
            ringColor={NEU.surface}
            shadow={NEU.outSm}
            empty={null}
          />
          <span
            className="font-semibold min-w-0"
            style={{
              color: facts.chairs.length > 0 ? SOFT : AMBER_INK,
              fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.3,
              overflowWrap: 'anywhere',
            }}
            title={data.conf.chairs.map((c) => c.name).join(', ') || 'No chair assigned'}
          >
            {facts.chairs.length > 0 ? facts.chairs.join(', ') : 'No chair assigned'}
          </span>
        </div>

        {/* ── BAND 3 · NOW PLAYING ─────────────────────────────────────────────
            `flex: 1` — this band, not the bottom of the card, is where surplus
            height from a taller sibling in the row goes. It is pulled out to an
            8px gutter so its radius is exactly concentric with the card's. */}
        <div
          className="flex flex-col flex-1"
          style={{
            marginBlockStart: 12,
            marginInlineStart: -(PAD_START - PANEL_GUTTER),
            marginInlineEnd: -(PAD_END - PANEL_GUTTER),
          }}
        >
          <NowPlayingPanel np={np} />
        </div>

        {/* ── BAND 4 · warning slot ───────────────────────────────────────────
            Reserved height whether or not there is a warning, so two cards side
            by side stay aligned. NOTHING but the five approved conditions ever
            enters this slot (see `cardWarnings`) — and "nothing has happened
            here for Nm" is deliberately NOT one of them any more: the status
            word, the rail and the "quiet" line said it three times over. */}
        <div className="flex items-center" style={{ minHeight: WARNING_SLOT_HEIGHT }}>
          {top && (
            <span
              className="inline-flex items-start gap-1.5 rounded-2xl px-2.5 py-1 min-w-0"
              style={{
                backgroundColor: top.tone === 'red' ? 'rgba(139,32,32,0.09)' : 'rgba(184,132,74,0.15)',
                fontFamily: OUTFIT,
              }}
            >
              <AlertTriangle
                size={12}
                style={{ color: top.tone === 'red' ? RED : AMBER_INK, flexShrink: 0, marginBlockStart: 2 }}
              />
              {/* WRAPS. The stuck-resume warning is a full sentence naming a
                  chair, and truncating it removed the half that said what to
                  do about it. A pill that grows to two lines is fine — the
                  slot's height is a floor, and the grid equalises the row. */}
              <span
                className="font-bold"
                style={{
                  color: top.tone === 'red' ? RED : AMBER_INK,
                  fontSize: 12, lineHeight: 1.3, overflowWrap: 'anywhere',
                }}
              >
                {top.text}
              </span>
              {extraWarnings > 0 && (
                <span
                  className="font-bold flex-shrink-0"
                  style={{
                    color: top.tone === 'red' ? RED : AMBER_INK, opacity: 0.8,
                    fontSize: 12, lineHeight: 1.3,
                  }}
                  title={warnings.slice(1).map((w) => w.text).join(' · ')}
                >
                  +{extraWarnings}
                </span>
              )}
            </span>
          )}
        </div>

        {/* ── BAND 5 · what has happened ──────────────────────────────────────
            STATIC. The same three facts on every card in every state, so the
            only thing a reader's eye has to track between cards is the panel
            above. No motion counts (motions are not tracked on this card at
            all — the panel states the stage, and a caucus stage already says
            what a passed motion produced) and no total speaking time (a recap
            number, not a preview number). The dais used to end this row; it is
            the room's most human fact and now opens the card instead.

            `flex-wrap`, not `flex-nowrap`: a pill that will not fit drops to a
            second row WHOLE. The old `nowrap` is what forced every pill to
            shrink and clip at 1280. */}
        <div
          className="flex items-center gap-1.5 flex-wrap min-w-0"
          style={{ marginBlockEnd: 11, rowGap: 6 }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onOpenRoster(data); }}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-full focus:outline-none active:scale-[0.96] flex-shrink-0 whitespace-nowrap"
            style={{
              backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: SOFT,
              fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums',
              border: 'none', cursor: 'pointer',
              transitionProperty: 'box-shadow, scale', transitionDuration: '200ms',
              transitionTimingFunction: EASE,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
            title={`${facts.present} of ${facts.total} delegations present — open the roll. Observers are excluded from this count, as they are on the dais.`}
          >
            {/* The word "present" lived here and cost ~46px, which is what
                pushed the whole strip onto a second line at 1280 and made the
                card 40px taller than the same card at 1440. The glyph and the
                tooltip carry it. */}
            <Users size={12} style={{ color: NEU.forest }} />
            {facts.present}/{facts.total}
          </button>

          <Chip
            muted={facts.wps === 0}
            title={facts.wps > 0
              ? `Open the ${facts.wps} working paper${facts.wps === 1 ? '' : 's'} submitted in this committee`
              : 'No working papers submitted yet'}
            onClick={facts.wps > 0 ? () => onOpenDocuments(data, 'working-paper') : undefined}
          >
            <FileText size={12} style={{ color: NEU.forest }} />
            {facts.wps} WP
          </Chip>

          <Chip
            muted={facts.drs === 0}
            title={facts.drs > 0
              ? `Open the ${facts.drs} draft resolution${facts.drs === 1 ? '' : 's'} in this committee${facts.drsPassed ? ` — ${facts.drsPassed} passed` : ''}${facts.drsFailed ? ` — ${facts.drsFailed} failed` : ''}`
              : 'No draft resolutions in this committee yet'}
            onClick={facts.drs > 0 ? () => onOpenDocuments(data, 'draft-resolution') : undefined}
          >
            <ScrollText size={12} style={{ color: facts.drsPassed > 0 ? GREEN_INK : NEU.forest }} />
            {facts.drs} DR
            {(facts.drsPassed > 0 || facts.drsFailed > 0) && (
              <span style={{ color: facts.drsPassed > 0 ? GREEN_INK : SOFT }}>
                {' '}· {facts.drsPassed > 0 ? `${facts.drsPassed} passed` : `${facts.drsFailed} failed`}
              </span>
            )}
          </Chip>

        </div>
        </div>

        {/* ── BAND 6 · footer, one action ─────────────────────────────────────
            INSIDE the clipping shell, so its hover fill still squares off
            against the card's bottom corners now that the card itself is
            `overflow: visible`. */}
        <button
        onClick={(e) => { e.stopPropagation(); onOpenScoreboard(data); }}
        className="flex items-center gap-2 w-full text-left focus:outline-none"
        style={{
          // `border: none` first, then the one edge we want back — the reverse
          // order silently wipes the divider.
          border: 'none',
          borderBlockStart: `1px solid ${CARD_BORDER_COLOR}`,
          padding: `12px ${PAD_END}px 13px ${PAD_START}px`,
          color: NEU.forest, fontFamily: OUTFIT,
          backgroundColor: 'transparent',
          cursor: 'pointer',
          transitionProperty: 'background-color', transitionDuration: '200ms',
          transitionTimingFunction: EASE,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.045)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        title="Open the per-committee scoreboard — the same delegate performance detail the chairs see"
      >
        <Trophy size={14} style={{ flexShrink: 0 }} />
        <span className="font-bold" style={{ fontSize: 13 }}>Points &amp; performance</span>
        <span
          className="ml-auto text-right"
          style={{ color: SOFT, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}
        >
          {facts.total > 0 ? `${facts.total} delegation${facts.total === 1 ? '' : 's'}` : 'no roll yet'}
        </span>
        </button>
      </div>
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
        const dead = c.value === 0 && c.key !== 'all';
        return (
          <button
            key={c.key}
            onClick={() => onPick(c.key)}
            disabled={dead}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 focus:outline-none${dead ? '' : ' active:scale-[0.96]'}`}
            style={{
              fontFamily: OUTFIT, border: 'none',
              backgroundColor: on ? NEU.base : NEU.surface,
              boxShadow: on ? NEU.inSm : NEU.outSm,
              opacity: dim ? 0.5 : 1,
              cursor: dead ? 'default' : 'pointer',
              transitionProperty: 'box-shadow, opacity, scale',
              transitionDuration: '200ms',
              transitionTimingFunction: EASE,
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

/** The honest footnote under the grid. One thing on these cards means something
 *  narrower than it looks, and saying so costs one line. */
export function GridFootnote({ style }: { style?: React.CSSProperties }) {
  return (
    <p
      className="text-[11px] mt-4 flex items-start gap-1.5"
      style={{ color: SOFT, fontFamily: OUTFIT, maxWidth: 760, textWrap: 'pretty', ...style }}
    >
      <Info size={12} style={{ flexShrink: 0, marginBlockStart: 2 }} />
      <span>
        Cards are ordered by what needs attention, not by name. <strong>Quiet</strong> is the time
        since the room last did anything visible: a chair action, a logged speech, or a chat
        message.
      </span>
    </p>
  );
}
