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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Users, FileText, ScrollText, Trophy, AlertTriangle, Info,
  Mic, Timer, Pause, Flag, Moon, Copy, Check, Send, UserRound,
} from 'lucide-react';
import { LogoDisc } from '@/components/LogoDisc';
import { FlagImg } from '@/components/FlagImg';
import Avatar from '@/components/Avatar';
import Portal from '@/components/Portal';
import ProfileLink from '@/components/ProfileLink';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE } from '@/components/neu';
import { type LiveCommittee, type ChairPerson, flagCodeFor } from './LiveModals';
import {
  roomStatus, STATUS_META, nowPlaying, cardWarnings, cardFacts,
  type NowPlaying, type NowGlyph, type CommitteeIdentity,
} from './cardModel';
import {
  SOFT, AMBER_INK, GREEN_INK, RED, CARD_BORDER_COLOR, CARD_SHADOW, CARD_SHADOW_HOVER,
} from './tokens';

// The card surface, its edge and its shadow all come from ./tokens, where the
// contrast measurements that justify them are written down.

/** Reserved height for the warning slot WHEN IT HAS SOMETHING IN IT. A floor,
 *  not a cap: warning text wraps, and the grid's `items-stretch` absorbs the
 *  difference between a two-line warning and a one-line one.
 *
 *  IT IS NO LONGER RESERVED WHEN THE SLOT IS EMPTY, and that is the single
 *  biggest piece of the dead space the owner asked to be closed: most rooms have
 *  no warning at all, so this was 30px of guaranteed blank on the majority of
 *  cards. Reserving it bought cross-card alignment of the band BELOW it — and
 *  that band does not need buying: the facts strip and the footer are both
 *  bottom-anchored, and the now-playing panel above absorbs the surplus (see
 *  `PANEL_MIN_HEIGHT`), so they line up across a row either way. */
const WARNING_SLOT_HEIGHT = 26;

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

/** The panel's floor: art disc (60) + its padding (2×13) + the scrubber block +
 *  the up-next slot — a footprint that does not move between a room mid-speech
 *  and a room that was never opened. Spotify does not collapse its now-playing
 *  bar; nor does this.
 *
 *  196 → 168, MEASURED rather than guessed. The panel's natural content at 344px
 *  (the narrowest card the grid produces) is 163–175px, so 196 was forcing
 *  20–33px of blank into every single card before the grid stretched anything.
 *  168 is the same field shape with the padding taken out of it.
 *
 *  WHERE THE SURPLUS GOES IS THE OTHER HALF OF THE OWNER'S COMPLAINT — "the gap
 *  between speaker and the timer is big". The panel used to be
 *  `justify-between`, so every pixel the grid stretched this card by opened up
 *  BETWEEN the delegation's name and the clock: measured at 106px on a
 *  three-card row. It is now a plain column with fixed gaps and one flexible
 *  spacer at the BOTTOM, so stretch reads as panel padding under the queue
 *  instead of as a rift through the middle of the thing the panel is for. */
const PANEL_MIN_HEIGHT = 168;

/** The card's floor, tracking `PANEL_MIN_HEIGHT` down by the same 28px. Nothing
 *  on this card truncates, so this is a floor the grid stretches from, never a
 *  cap anything is squeezed into. */
const CARD_MIN_HEIGHT = 322;

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
// 60 → 66, the owner's "increase committee logo size by 10%". The overhang is
// deliberately NOT scaled with it: 22px is what the grid's `rowGap` and
// `paddingBlockStart` are sized against (`live/page.tsx:833`), and growing it
// would push the first row's emblems into the scroll container's edge.
const LOGO_SIZE = 66;
const LOGO_OVERHANG = 22;
/** How far the header text is pushed in to sit beside the emblem. */
const HEADER_INDENT = LOGO_SIZE + 12;

/** The up-next strip, now a full-width row BELOW the timer rather than a narrow
 *  column beside the headline.
 *
 *  Sizing, measured against the narrowest card the grid ever produces — three
 *  columns at a 1280px viewport. Content width there is 1152 − 80 (px-10) = 1072;
 *  minus two 20px column gaps that is a 344px card, and the panel is inset to
 *  8px gutters with 15px of its own padding, leaving ~296px of usable row. Ten
 *  20px flags with 5px gaps come to 10×20 + 9×5 = 245px, so `UP_NEXT_MAX` still
 *  fits on ONE row at the tightest breakpoint and the strip's height is stable.
 *
 *  `UP_NEXT_SLOT_HEIGHT` is RESERVED whether or not a queue exists — the same
 *  contract the warning slot has. A card whose list is empty must not be shorter
 *  than the card beside it whose list is not, or the "fixed field shape" the
 *  panel exists to provide goes away the moment a chair clears a queue. */
const UP_NEXT_FLAG = 20;
const UP_NEXT_SLOT_HEIGHT = 38;

/** How much a queue flag grows under the pointer. Applied as a `transform`, so
 *  it costs no layout and cannot reflow the row it sits in — which is what lets
 *  the reserved slot height above stay honest. */
const FLAG_HOVER_SCALE = 1.28;

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

/** THE MARK FOR ONE DELEGATION — a flag, or a person.
 *
 *  A crisis cabinet post, a Room Order seat and a specialised committee's
 *  character are not countries: `flagCodeFor` finds no ISO code for them and
 *  `FlagImg` falls back to a GLOBE, so a whole cabinet rendered as a row of
 *  identical globes — the one thing a globe cannot mean is "this is a person,
 *  not a country".
 *
 *  The replacement is not a new icon. It is exactly what the assignment page
 *  already draws for a character/custom seat (`manage/[slug]/assignment/page.tsx:741`,
 *  and the same `UserRound` glyph in its `PersonAvatar` at `:668`): a lucide
 *  `UserRound` head-and-shoulders in a disc. `NEU.forest` on `NEU.surface` is
 *  10.73:1, far past the 3:1 a glyph needs. */
function DelegationMark({ country, size }: { country: string; size: number }) {
  const code = flagCodeFor(country);
  if (code) return <FlagImg code={code} size={size} />;
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%',
        backgroundColor: NEU.surface, color: NEU.forest,
        boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.14)',
      }}
    >
      <UserRound size={Math.round(size * 0.62)} strokeWidth={2} />
    </span>
  );
}

/** One delegation in the up-next strip: a flag that grows under the pointer and
 *  opens that delegation's performance card.
 *
 *  A real `<button>`, not a span with a handler. The whole card is already
 *  `role="button"`, so anything clickable nested inside it MUST be focusable and
 *  Enter/Space-activatable in its own right or it is mouse-only — and it must
 *  stop propagation, or the click falls through and opens the room recap
 *  instead of the person. Growth is applied on FOCUS as well as hover, so the
 *  affordance exists for a keyboard.
 *
 *  `title` still carries the delegation name, so the strip is readable without
 *  clicking anything and without a name ever being truncated. */
function QueueFlag({
  country, position, onOpen,
}: {
  country: string;
  position: number;
  onOpen: ((country: string) => void) | null;
}) {
  const grow = (el: HTMLElement) => {
    el.style.transform = `scale(${FLAG_HOVER_SCALE})`;
    el.style.zIndex = '1';
  };
  const shrink = (el: HTMLElement) => {
    el.style.transform = 'scale(1)';
    el.style.zIndex = '0';
  };
  const label = `${country} — ${position === 1 ? 'next to speak' : `number ${position} in the queue`}`;

  const art = <DelegationMark country={country} size={UP_NEXT_FLAG} />;
  if (!onOpen) {
    return (
      <span className="flex-shrink-0" style={{ lineHeight: 0 }} title={label}>{art}</span>
    );
  }
  return (
    <button
      type="button"
      title={`${label} · open their performance card`}
      aria-label={`${label}. Open their performance card.`}
      onClick={(e) => { e.stopPropagation(); onOpen(country); }}
      onMouseEnter={(e) => grow(e.currentTarget)}
      onMouseLeave={(e) => shrink(e.currentTarget)}
      onFocus={(e) => grow(e.currentTarget)}
      onBlur={(e) => shrink(e.currentTarget)}
      className="flex-shrink-0 focus:outline-none"
      style={{
        lineHeight: 0, border: 'none', padding: 0, background: 'none',
        cursor: 'pointer', position: 'relative',
        transformOrigin: 'center bottom',
        transitionProperty: 'transform',
        transitionDuration: '180ms',
        transitionTimingFunction: EASE,
      }}
    >
      {art}
    </button>
  );
}

/** THE "+N" AT THE END OF THE QUEUE STRIP, AND WHAT IT OPENS.
 *
 *  ">10 speakers add a +X and clicking could see the total" — the ten flags stay
 *  exactly as they are; the counter beside them stops being a dead number and
 *  becomes the door to the rest of the list, named and in queue order.
 *
 *  PORTALED AT FIXED VIEWPORT COORDINATES, because the card is
 *  `overflow: hidden` inside its shell and the grid it sits in scrolls: an
 *  in-card absolute layer would be clipped by the first and scrolled away by the
 *  second. Mechanics lifted from the applications `PaymentMenu`
 *  (`manage/[slug]/applications/page.tsx:594-642`), as AGENTS.md requires — place
 *  from `getBoundingClientRect()`, reposition on resize, close on scroll and on
 *  an outside click that accounts for the portaled node, and FLIP rather than
 *  run off an edge: clamped on the inline axis, opened upward when there is not
 *  enough room below.
 *
 *  A real `<button>` with `stopPropagation`, for the same reason `QueueFlag` is:
 *  the whole card is `role="button"`, so a nested clickable must be focusable and
 *  Enter/Space-activatable in its own right, and must not let the click fall
 *  through and open the recap instead. */
function QueueOverflow({
  label, rest, shown, onOpen,
}: {
  label: string;
  /** The delegations the strip did NOT draw, in queue order. */
  rest: string[];
  /** How many are already on the strip — so the popover can number correctly. */
  shown: number;
  onOpen: ((country: string) => void) | null;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const W = 236;
    const wanted = Math.min(300, 34 + rest.length * 26);
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    // Flip upward when the space below cannot hold the list and the space above
    // is better. Either way the height is clamped to what actually fits.
    const up = below < wanted && above > below;
    const maxHeight = Math.max(96, Math.min(wanted, up ? above : below));
    setPos({
      top: up ? Math.max(8, r.top - 6 - maxHeight) : r.bottom + 6,
      left: Math.max(8, Math.min(r.left - W + r.width, window.innerWidth - W - 8)),
      maxHeight,
    });
  }, [rest.length]);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`${rest.length} more waiting — open the rest of the list`}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="font-extrabold flex-shrink-0 focus:outline-none active:scale-[0.94]"
        style={{
          color: SOFT, fontFamily: OUTFIT, fontSize: 11,
          fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          marginInlineStart: 2, border: 'none', cursor: 'pointer',
          backgroundColor: open ? NEU.base : 'transparent',
          boxShadow: open ? NEU.inSm : 'none',
          borderRadius: 999, padding: '3px 6px',
          transitionProperty: 'box-shadow, background-color, scale',
          transitionDuration: '180ms', transitionTimingFunction: EASE,
        }}
      >
        +{rest.length}
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={popRef}
            role="dialog"
            aria-label={`${label} — the rest of the queue`}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: 236,
              zIndex: 60, maxHeight: pos.maxHeight, overflowY: 'auto',
              backgroundColor: NEU.surface, borderRadius: 14,
              border: `1px solid ${CARD_BORDER_COLOR}`, boxShadow: CARD_SHADOW,
              padding: '9px 10px', fontFamily: OUTFIT,
            }}
          >
            <p
              className="font-extrabold uppercase"
              style={{ color: SOFT, fontSize: 9.5, letterSpacing: '0.08em', marginBlockEnd: 6 }}
            >
              {label} · {rest.length} more
            </p>
            <div className="flex flex-col" style={{ gap: 2 }}>
              {rest.map((country, i) => {
                const position = shown + i + 1;
                const row = (
                  <>
                    <span
                      className="font-bold flex-shrink-0 text-right"
                      style={{ color: SOFT, fontSize: 10.5, width: 20, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {position}
                    </span>
                    <DelegationMark country={country} size={16} />
                    {/* Names WRAP here. This popover exists so the tail of the
                        queue can be read, so a name cut to "United Arab Emir…"
                        would defeat the whole affordance. */}
                    <span
                      className="font-bold min-w-0"
                      style={{ color: NEU.ink, fontSize: 12, lineHeight: 1.25, overflowWrap: 'anywhere' }}
                    >
                      {country}
                    </span>
                  </>
                );
                if (!onOpen) {
                  return (
                    <span key={`${country}-${i}`} className="flex items-center gap-2" style={{ padding: '3px 4px' }}>
                      {row}
                    </span>
                  );
                }
                return (
                  <button
                    key={`${country}-${i}`}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpen(false); onOpen(country); }}
                    className="flex items-center gap-2 w-full text-left focus:outline-none"
                    title={`${country} — open their performance card`}
                    style={{
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      padding: '3px 4px', borderRadius: 8,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {row}
                  </button>
                );
              })}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

function NowPlayingPanel({
  np, onOpenDelegate,
}: {
  np: NowPlaying;
  /** null when this room has no scoreboard to open (no linked session). */
  onOpenDelegate: ((country: string) => void) | null;
}) {
  const Glyph = GLYPH_ICON[np.glyph];
  const ink = toneInk(np.tone);
  const [from, to] = toneFill(np.tone);
  const hasMeter = np.pct !== null;
  const pct = Math.max(0, Math.min(100, np.pct ?? 0));

  return (
    <div
      // NOT `justify-between` — see PANEL_MIN_HEIGHT. Every pixel the grid
      // stretched this card by used to open between the delegation's name and
      // the clock; the column now stacks tightly from the top and one flexible
      // spacer at the bottom takes the surplus.
      className="flex flex-col flex-1"
      style={{
        backgroundColor: NEU.base,
        boxShadow: NEU.inSm,
        borderRadius: PANEL_RADIUS,
        padding: '12px 13px 11px',
        minHeight: PANEL_MIN_HEIGHT,
      }}
    >
      {/* Art + context + headline. The art is RAISED inside a pressed well —
          a token sitting in a slot, which is what neumorphism is for. */}
      <div className="flex items-start gap-3 min-w-0">
        <span
          className="flex items-center justify-center rounded-full flex-shrink-0 overflow-hidden"
          style={{ width: 56, height: 56, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
          aria-hidden
        >
          {/* `DelegationMark`, not `FlagImg`: a cabinet post or a character seat
              has no ISO code and must not fall back to a globe. */}
          {np.flag
            ? <DelegationMark country={np.flag} size={36} />
            : <Glyph size={25} style={{ color: np.tone === 'off' ? SOFT : ink }} />}
        </span>

        <div className="min-w-0 flex-1">
          {/* THE MOTION NAME. Always short now — the topic that used to be glued
              on after an em dash has its own line below — so it can hold its
              uppercase and its tracking at every length instead of dropping
              them to buy width. 12px/800 in the tone ink: GREEN_INK 5.68:1,
              AMBER_INK 5.70:1, SOFT 5.55:1, all past AA. It still WRAPS; nothing
              on this card is ever cut. */}
          <p
            className="font-extrabold uppercase"
            style={{
              color: ink, fontFamily: OUTFIT,
              fontSize: 12,
              letterSpacing: '0.075em',
              lineHeight: 1.25,
              overflowWrap: 'anywhere',
            }}
          >
            {np.context}
          </p>
          {/* THE MOTION'S TOPIC — directly below the motion name, one step
              SMALLER (11px against 12px) and in a different ink.

              SOFT #6A5A4A, 5.55:1 on the panel's #E8E1D0 well and 5.55:1 on the
              card, so it passes AA as body text at this size. `NEU.muted` is the
              colour this line LOOKS like it should be and it is 2.81:1 —
              decoration only, never text, and deliberately not used here.

              It cannot collide with the motion name above it: a topic only ever
              exists on the three caucus stages, and those resolve `tone` to
              'live' or 'warn', i.e. GREEN_INK or AMBER_INK. SOFT is a genuinely
              different hue in every state that can render this line.

              Sentence case, because it is the chair's own typed sentence. */}
          {np.contextTopic && (
            <p
              className="font-semibold"
              style={{
                color: SOFT, fontFamily: OUTFIT,
                fontSize: 11,
                lineHeight: 1.32,
                marginBlockStart: 2,
                overflowWrap: 'anywhere',
                textWrap: 'pretty',
              }}
            >
              {np.contextTopic}
            </p>
          )}
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
              // The gap the motion name used to carry as its own marginBlockEnd.
              // It moved here because the topic line now sits between the two
              // and needs the space below it, not above it.
              marginBlockStart: 4,
            }}
          >
            {np.headline}
          </p>
        </div>
      </div>

      {/* The scrubber. Always present — an empty track when there is genuinely
          nothing to measure, never a missing one. Every fill is derived from a
          stored anchor on each render; nothing here counts down or writes.
          10 → 8: this is the gap the owner called out as "the gap between
          speaker and the timer". Most of that gap was the `justify-between`
          surplus above, but the fixed part shrank with it. */}
      <div style={{ marginBlockStart: 8 }}>
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
        {/* THE ROOM'S CLOCK IS THE RIGHT-HAND HALF OF THIS ROW, and this row
            sits directly above the queue strip — which is exactly where the
            owner asked for it ("right on top of the queue on the right side,
            don't move anything"). A caucus already reported its total clock
            here and is untouched; the GSL branch now reports the speaker's own
            countdown in the slot that used to read "14 still on the list".
            Nothing was rearranged to make room. */}
        <div className="flex items-start justify-between gap-3" style={{ marginBlockStart: 6 }}>
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

        {/* ── WHO IS WAITING — below the timer, and each flag is a door ───────
            It used to sit in a narrow column BESIDE the headline, which cost the
            headline a third of its width and capped the strip at five flags to a
            row. Below the clock it gets the panel's full width, so all ten of
            `UP_NEXT_MAX` fit on one line even in the narrowest card the grid
            produces, and it reads in the order a person actually asks the card
            about a room: what is happening → how long is left → who is next.

            The names are flags on purpose: two names and a "+7" told a reader
            less than ten flags do, and it was the names that made two the
            ceiling. Every flag keeps its delegation and its queue position in
            `title` and in `aria-label`, so nothing is dropped, only unstacked.

            The LABEL is not optional. RULE 1: the GSL and the caucus queue are
            strictly separate lists, and a bare row of flags with no label reads
            as one merged queue.

            The slot's height is RESERVED even when empty — see
            UP_NEXT_SLOT_HEIGHT. Two cards side by side, one with a queue and one
            without, must still be the same shape. */}
        <div
          className="flex flex-col justify-end"
          style={{ minHeight: UP_NEXT_SLOT_HEIGHT, marginBlockStart: 7 }}
        >
          {np.next && (
            <>
              <p
                className="font-extrabold uppercase"
                style={{
                  color: SOFT, fontFamily: OUTFIT, fontSize: 9.5,
                  letterSpacing: '0.08em', lineHeight: 1.3, marginBlockEnd: 5,
                  overflowWrap: 'anywhere',
                }}
              >
                {np.next.label}
              </p>
              <div className="flex flex-wrap items-center" style={{ gap: 5 }}>
                {np.next.names.map((n, i) => (
                  <QueueFlag key={`${n}-${i}`} country={n} position={i + 1} onOpen={onOpenDelegate} />
                ))}
                {np.next.more > 0 && (
                  <QueueOverflow
                    label={np.next.label}
                    rest={np.next.all.slice(np.next.names.length)}
                    shown={np.next.names.length}
                    onOpen={onOpenDelegate}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* WHERE THE GRID'S SURPLUS HEIGHT LANDS. `items-stretch` sizes every card
          in a row to the tallest, and something has to claim the difference —
          when nothing did, it pooled at the bottom of the CARD as a dead band,
          and when `justify-between` did, it opened a rift between the speaker
          and the clock. It lands here instead: below the queue, inside the
          panel, where it reads as the panel's own bottom padding. */}
      <div style={{ flex: '1 1 0', minHeight: 0 }} aria-hidden />
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

// ── The not-started nudge ────────────────────────────────────────────────────

/** What a NEVER-OPENED room gets in the warning slot: the two things that
 *  actually stand between it and a chair gavelling in.
 *
 *  NOTHING WAS INVENTED HERE. The wording, the affordance and the states are
 *  lifted from the committees page's own session-control well
 *  (`manage/[slug]/committees/page.tsx:1736-1797`), because an organiser who
 *  reads "SESSION CODE" and "SENT" there must not meet different words for the
 *  same two facts one tab over:
 *
 *    • the SESSION CODE, click-to-copy, flipping to "COPIED" for two seconds —
 *      `handleCopyCode` (`:937-941`) and the pill at `:1739-1767`;
 *    • whether the invite has gone to the chairs — `released_to_chairs_at`
 *      rendered through `CompactSendButton` (`:308-350`), whose three states are
 *      SCHEDULED (a future timestamp), SENT (a past one) and unsent.
 *
 *  It is READ-ONLY, and that is a hard constraint rather than an omission:
 *  nothing on this page writes to the database. Copying a code to the clipboard
 *  is the one thing here that touches no row. Minting a code and sending the
 *  invite are writes, so this says who still needs one and sends the organiser
 *  to the page that owns that write instead of growing a second one. */
function NotStartedNudge({ data, now }: { data: LiveCommittee; now: number }) {
  const [copied, setCopied] = useState(false);
  const code = data.conf.sessionCode;
  const releasedAt = data.conf.releasedToChairsAt;
  // Mirrors `releaseStatus` on the committees page: a timestamp in the future is
  // a scheduled release, one in the past has already gone out.
  //
  // `now` is the PAGE's clock, handed down like every other time on this card.
  // Reading `Date.now()` in a render body is impure, lints as such, and would
  // let this pill disagree with the status word beside it in the same frame.
  const releasedMs = releasedAt ? Date.parse(releasedAt) : NaN;
  const sent = Number.isFinite(releasedMs) && releasedMs <= now;
  const scheduled = Number.isFinite(releasedMs) && releasedMs > now;

  const pill: React.CSSProperties = {
    fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    borderRadius: 999, padding: '3px 8px', flexShrink: 0, lineHeight: 1.4,
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap min-w-0" style={{ rowGap: 5 }}>
      {code ? (
        <button
          type="button"
          title="Copy session code"
          onClick={(e) => {
            e.stopPropagation();
            void navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="inline-flex items-center gap-1.5 rounded-full focus:outline-none active:scale-[0.96] flex-shrink-0"
          style={{
            padding: '4px 10px', border: 'none', cursor: 'pointer',
            backgroundColor: copied ? 'rgba(47,102,68,0.13)' : NEU.surface,
            boxShadow: copied ? 'none' : NEU.outSm,
            fontFamily: OUTFIT,
            transitionProperty: 'background-color, box-shadow, scale',
            transitionDuration: '250ms', transitionTimingFunction: EASE,
          }}
        >
          {copied ? (
            <>
              {/* GREEN_INK, not `NEU.green`: the committees page sets this word
                  in NEU.green (4.30:1), which fails AA as 11px text. Same
                  family, 5.68:1. */}
              <Check size={11} style={{ color: GREEN_INK, flexShrink: 0 }} />
              <span style={{ ...pill, padding: 0, color: GREEN_INK }}>COPIED</span>
            </>
          ) : (
            <>
              <span
                style={{
                  fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700,
                  letterSpacing: '0.11em', color: NEU.forest,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {code}
              </span>
              <Copy size={10} style={{ color: SOFT, flexShrink: 0 }} />
            </>
          )}
        </button>
      ) : (
        <span style={{ ...pill, color: AMBER_INK, backgroundColor: 'rgba(184,132,74,0.15)' }}>
          NO SESSION CODE
        </span>
      )}

      {scheduled ? (
        <span style={{ ...pill, color: AMBER_INK, backgroundColor: 'rgba(184,132,74,0.15)' }}>
          SCHEDULED
        </span>
      ) : sent ? (
        <span style={{ ...pill, color: GREEN_INK, backgroundColor: 'rgba(47,102,68,0.12)' }}>
          SENT TO CHAIRS
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1"
          style={{ ...pill, color: AMBER_INK, backgroundColor: 'rgba(184,132,74,0.15)' }}
        >
          <Send size={9} style={{ flexShrink: 0 }} />
          CHAIRS NOT INVITED
        </span>
      )}
    </div>
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
  onOpenDelegate,
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
  /** Open ONE delegation's performance card, from a flag in the queue strip.
   *  Null for a room with no linked session — there is nothing to open. */
  onOpenDelegate: (d: LiveCommittee, country: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const status = roomStatus(data, now);
  const meta = STATUS_META[status];
  const np = nowPlaying(data, now);
  const warnings = cardWarnings(data, now);
  const facts = cardFacts(data);

  // `subtitle` is no longer RENDERED — the full name under the acronym is gone,
  // on the owner's instruction: UNSC, WHO and ECOFIN all read fine alone, and
  // the line it cost is now the committee's topic instead.
  //
  // It is still READ, because it is the only signal that says whether `title` is
  // an acronym or a full name. `committeeIdentities` sets `subtitle` to the full
  // name exactly when it managed to find a trustworthy acronym, and to null when
  // it did not. That is the fallback for a committee with no meaningful
  // acronym: it keeps its FULL NAME as the title, wrapping to as many lines as
  // it needs, set two steps smaller so a long one still behaves. Nothing is
  // invented and nothing is truncated.
  const { title, subtitle: hasAcronym, mono } = identity;

  const chairPeople: ChairPerson[] = data.conf.chairs.length > 0
    ? data.conf.chairs
    : (data.session?.chairNames ?? []).map((name) => ({ id: null, name, avatarUrl: null }));

  const top = warnings[0] ?? null;
  const extraWarnings = Math.max(0, warnings.length - 1);
  // The warning slot reserves height only when it has a tenant — see
  // WARNING_SLOT_HEIGHT. Its two tenants are mutually exclusive by construction:
  // `cardWarnings` returns early for `status === 'not-started'`.
  const hasSlotContent = status === 'not-started' || !!top;

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

        {/* The block padding opens at 8, not 14. "Move the committee name
            slightly higher" — the emblem is absolutely positioned and takes no
            part in this flow, so the header text was free to rise without
            colliding with it. */}
        <div className="flex flex-col flex-1" style={{ padding: `8px ${PAD_END}px 0 ${PAD_START}px` }}>
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
                fontSize: hasAcronym ? 22 : 18, lineHeight: 1.14,
                letterSpacing: '-0.015em',
                overflowWrap: 'anywhere',
              }}
            >
              {title}
            </h3>
            {/* ── THE COMMITTEE'S TOPIC LINE WAS HERE AND IS GONE ─────────────
                "Remove topics completely now." It printed
                `conference_committees.topics[0]` with a "+N" for the rest of the
                array, and it was the single most expensive line on the card:
                measured at 344px (the narrowest column the grid produces) with
                the status word beside it, one topic wrapped to FIVE lines and
                made the identity band 164px tall on its own.

                WHEN THE SESSIONS SIDE INTRODUCES TOPIC SELECTION, SHOW ONLY THE
                SINGLE SELECTED TOPIC HERE — NOT THE ARRAY. `topics` is the whole
                agenda a committee was created with; what belongs on a live card
                is the one topic the room is actually debating. Until the session
                records that, there is nothing honest to print, so nothing is
                printed. The "+N" is specifically what must not come back.

                (The CAUCUS topic is a different fact and is still shown — see
                `contextTopic` in the now-playing panel. That is the chair's own
                typed motion purpose, not the committee's agenda.) */}
          </div>

          {/* ── The status WORD, and THE DAIS DIRECTLY BENEATH IT ────────────
              "The chairs should be vertical below the status, so below stalled
              or suspended right now." So the dais moved out of its own
              full-width row and became a vertical list in this column, hanging
              off the status word it now sits under.

              Two things this buys beyond the owner's ask: the card loses a whole
              band (a 24px row plus its 9px lead), and the chairs stop competing
              with the committee's name for the same line of the card.

              The "quiet 44d" line that used to sit under the status word is
              still gone, on an earlier instruction: "Stalled" over "quiet 44d"
              was one fact told twice. The staleness that produced the word still
              drives the word, the rail colour beside it and the card's position
              in the grid. */}
          <div className="flex flex-col items-end flex-shrink-0" style={{ paddingBlockStart: 3, maxWidth: '52%' }}>
            <span
              className="inline-flex items-center gap-1.5"
              title="Whether this room has shown a sign of life recently — a chair action, a logged speech or a chat message"
            >
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

            {/* ONE ROW PER CHAIR, in reading order, right-aligned under the
                word. Names are the first names `chairFirstNames` already
                resolves — not a truncation: it is the card's established chair
                rule (`display_chairs[].name` title-cased, deduplicated), and the
                full name rides along in `title` and in the link. A name that is
                too wide WRAPS; nothing here is ever cut.

                No cap and no "+N": a four-chair dais is uncommon and a hidden
                chair is exactly the person an organiser walking the floor is
                trying to find. */}
            <div className="flex flex-col items-end" style={{ marginBlockStart: 5, gap: 3, width: '100%' }}>
              {chairPeople.length === 0 ? (
                <span
                  className="font-semibold text-right"
                  style={{ color: AMBER_INK, fontFamily: OUTFIT, fontSize: 12, lineHeight: 1.25 }}
                >
                  No chair assigned
                </span>
              ) : (
                chairPeople.map((c, i) => {
                  const label = facts.chairs[i] ?? c.name;
                  const row = (
                    <>
                      <span
                        className="font-semibold text-right min-w-0"
                        style={{
                          color: SOFT, fontFamily: OUTFIT, fontSize: 12,
                          lineHeight: 1.25, overflowWrap: 'anywhere',
                        }}
                      >
                        {label}
                      </span>
                      <span
                        className="inline-flex rounded-full flex-shrink-0"
                        style={{ boxShadow: `0 0 0 1.5px ${NEU.surface}, ${NEU.outSm}`, borderRadius: '50%' }}
                      >
                        <Avatar url={c.avatarUrl} name={c.name} size={18} rounded />
                      </span>
                    </>
                  );
                  // `nested` because the whole card is role="button" — the link
                  // must stop propagation or opening a chair's CV would also
                  // fire the card's own recap. A chair with no account carries
                  // `id: null`, and ProfileLink renders those children BARE —
                  // which is why the flex row is an outer span here rather than
                  // ProfileLink's own className. Without it, an unlinked chair's
                  // name and face would fall out of the row and stack.
                  return (
                    <span
                      key={`${c.id ?? c.name}-${i}`}
                      className="flex items-center gap-1.5 justify-end"
                      style={{ maxWidth: '100%' }}
                      title={c.name}
                    >
                      <ProfileLink
                        userId={c.id}
                        name={c.name}
                        nested
                        className="inline-flex items-center gap-1.5 justify-end"
                        style={{ minWidth: 0 }}
                      >
                        {row}
                      </ProfileLink>
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── BAND 3 · NOW PLAYING ─────────────────────────────────────────────
            `flex: 1` — this band, not the bottom of the card, is where surplus
            height from a taller sibling in the row goes. It is pulled out to an
            8px gutter so its radius is exactly concentric with the card's. */}
        <div
          className="flex flex-col flex-1"
          style={{
            marginBlockStart: 10,
            marginInlineStart: -(PAD_START - PANEL_GUTTER),
            marginInlineEnd: -(PAD_END - PANEL_GUTTER),
          }}
        >
          <NowPlayingPanel
            np={np}
            // A room with no linked session has no scoreboard rows and no
            // roll, so its flags are inert rather than dead-ended. In practice
            // it also has no queue, so this is belt and braces.
            onOpenDelegate={data.conf.sessionId ? (country) => onOpenDelegate(data, country) : null}
          />
        </div>

        {/* ── BAND 4 · warning slot ───────────────────────────────────────────
            Reserved height whether or not there is a warning, so two cards side
            by side stay aligned. NOTHING but the four approved conditions ever
            enters this slot (see `cardWarnings`) — "nothing has happened here
            for Nm" is deliberately not one of them (the status word and the rail
            say it already), and neither is "a draft resolution is unresolved",
            which was removed on the owner's instruction.

            The ONE other tenant is the not-started nudge below. It shares this
            slot rather than growing a sixth band because a never-opened room can
            never have a warning to be crowded out by: `cardWarnings` returns
            early for `status === 'not-started'`. */}
        <div
          className="flex items-center"
          style={hasSlotContent
            ? { minHeight: WARNING_SLOT_HEIGHT, marginBlockStart: 8 }
            : undefined}
        >
          {status === 'not-started' && <NotStartedNudge data={data} now={now} />}
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
          style={{ marginBlockStart: 9, marginBlockEnd: 9, rowGap: 6 }}
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
          padding: `10px ${PAD_END}px 10px ${PAD_START}px`,
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

// ── Grid footnote ────────────────────────────────────────────────────────────
//
// `StatusFilterBar` USED TO LIVE HERE AND IS GONE, on the owner's instruction:
// "remove the floor-wide totals strip at the top (all rooms / stalled /
// suspended counts) — the floor overview alone is enough". Those were its first
// three pills, in that order.
//
// Deleting it is also what makes "show ALL committees, including never-started
// ones" true rather than merely true-by-default. The bar was the page's only
// filter, and picking any status off it hid every room that did not match —
// including all the never-opened ones. With no filter there is no state in
// which a committee can be missing from this grid.

/** The honest footnote under the grid. One thing about these cards means
 *  something narrower than it looks, and saying so costs one line. */
export function GridFootnote({ style }: { style?: React.CSSProperties }) {
  return (
    <p
      className="text-[11px] mt-4 flex items-start gap-1.5"
      style={{ color: SOFT, fontFamily: OUTFIT, maxWidth: 760, textWrap: 'pretty', ...style }}
    >
      <Info size={12} style={{ flexShrink: 0, marginBlockStart: 2 }} />
      <span>
        Every committee in this conference is shown, and cards are ordered by what needs
        attention rather than by name. The status word is set by when the room last did
        anything visible: a chair action, a logged speech, or a chat message.
      </span>
    </p>
  );
}
