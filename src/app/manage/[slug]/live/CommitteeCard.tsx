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
  Gavel, Mic, Timer, Pause, Flag, Moon,
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

/** Reserved height for the warning slot. Fixed, so a card with a warning and a
 *  card without one are the same height and the grid stays a grid. */
const WARNING_SLOT_HEIGHT = 26;

/** Card radius, and the gutter the now-playing panel leaves at the card edge.
 *
 *  CONCENTRIC, exactly: outer = inner + padding. The panel is deliberately
 *  wider than the header text above it (which sits at 18/20) — an 8px gutter
 *  gives it the full width of the card and lets the radii line up at
 *  22 − 8 = 14 instead of being fudged. */
const CARD_RADIUS = 22;
const PANEL_GUTTER = 8;
const PANEL_RADIUS = CARD_RADIUS - PANEL_GUTTER;

/** The panel's floor. Art disc (54) + its padding (2×14) + the scrubber block
 *  (~28) — a footprint that does not move between a room mid-speech and a room
 *  that was never opened. Spotify does not collapse its now-playing bar; nor
 *  does this. */
const PANEL_MIN_HEIGHT = 126;

// ── Now-playing panel ────────────────────────────────────────────────────────

const GLYPH_ICON: Record<NowGlyph, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  gavel: Gavel,
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

/** Headline type scales with its own length rather than truncating. A
 *  delegation name is short and gets the full 21px; a motion read out in full
 *  ("10-minute moderated caucus — Climate finance") steps down instead of
 *  becoming "10-minute moderated…". */
function headlineSize(text: string): number {
  if (text.length > 46) return 15.5;
  if (text.length > 30) return 17.5;
  return 21;
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
        padding: '13px 14px 12px',
        minHeight: PANEL_MIN_HEIGHT,
      }}
    >
      {/* Art + context + headline. The art is RAISED inside a pressed well —
          a token sitting in a slot, which is what neumorphism is for. */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="flex items-center justify-center rounded-full flex-shrink-0 overflow-hidden"
          style={{ width: 54, height: 54, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
          aria-hidden
        >
          {np.flag
            ? <FlagImg code={flagCodeFor(np.flag)} size={34} />
            : <Glyph size={23} style={{ color: np.tone === 'off' ? SOFT : ink }} />}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-extrabold uppercase"
            style={{
              color: ink, fontFamily: OUTFIT,
              // Long contexts (a moderated caucus carries its topic) trade
              // tracking for characters rather than truncating a word earlier.
              fontSize: np.context.length > 26 ? 9.5 : 10,
              letterSpacing: np.context.length > 26 ? '0.05em' : '0.11em',
              marginBlockEnd: 3,
              display: '-webkit-box', WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 1, overflow: 'hidden', overflowWrap: 'anywhere',
            }}
            title={np.context}
          >
            {np.context}
          </p>
          <p
            className="font-extrabold"
            style={{
              color: np.dim ? SOFT : NEU.ink,
              fontFamily: OUTFIT,
              fontSize: headlineSize(np.headline),
              lineHeight: 1.14,
              letterSpacing: '-0.012em',
              textWrap: 'balance',
              fontVariantNumeric: 'tabular-nums',
              display: '-webkit-box', WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere',
            }}
            title={np.headline}
          >
            {np.headline}
          </p>
        </div>

        {/* Who is waiting. Always labelled with WHICH list it is counting —
            the GSL and the caucus queue are strictly separate lists (RULE 1)
            and a card that reported one number for both would be lying. It
            also gives the panel its right-hand mass; without it the whole
            block reads as one sentence floating in space. */}
        {np.next && (() => {
          const q = np.next;
          return (
            <div className="flex-shrink-0 text-right" style={{ maxWidth: 112 }}>
              <p
                className="text-[9px] font-extrabold uppercase truncate"
                style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.1em', marginBlockEnd: 3 }}
              >
                {q.label}
              </p>
              {q.names.map((n, i) => (
                <span key={n} className="flex items-center justify-end gap-1.5" style={{ marginBlockStart: i === 0 ? 0 : 2 }}>
                  <span
                    className="text-[11.5px] font-bold truncate"
                    style={{ color: i === 0 ? NEU.ink : SOFT, fontFamily: OUTFIT }}
                    title={n}
                  >
                    {n}
                  </span>
                  <FlagImg code={flagCodeFor(n)} size={13} />
                  {i === q.names.length - 1 && q.more > 0 && (
                    <span
                      className="text-[10px] font-extrabold flex-shrink-0"
                      style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}
                    >
                      +{q.more}
                    </span>
                  )}
                </span>
              ))}
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
        <div className="flex items-baseline justify-between gap-3" style={{ marginBlockStart: 6 }}>
          <span
            className="text-[10.5px] font-semibold truncate"
            style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}
          >
            {np.left}
          </span>
          <span
            className="text-[11.5px] font-extrabold flex-shrink-0"
            style={{
              color: np.tone === 'off' ? SOFT : NEU.ink,
              fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums',
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
  const cls = 'inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap';
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
        overflow: 'hidden',
        // The card must never be shorter than the shortest useful reading of a
        // room; the grid stretches it up from here, and the panel absorbs the rest.
        minHeight: 300,
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

      <div className="flex flex-col flex-1" style={{ padding: '14px 18px 0 20px' }}>
        {/* ── BAND 2 · identity ───────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <LogoDisc src={data.conf.logoUrl} size={38} fallbackText={mono} alt={title} />
            <div className="min-w-0">
              {/* A title that is a full name (no trustworthy acronym exists)
                  WRAPS to two lines rather than being cut mid-word. The old
                  single-line `truncate` is what produced "Disarmament a…". */}
              <h3
                className="font-extrabold"
                style={{
                  color: NEU.ink, fontFamily: OUTFIT,
                  fontSize: subtitle ? 20 : 16, lineHeight: 1.12,
                  letterSpacing: '-0.015em',
                  display: '-webkit-box', WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: subtitle ? 1 : 2, overflow: 'hidden',
                  overflowWrap: 'anywhere',
                }}
                title={data.conf.name}
              >
                {title}
              </h3>
              {subtitle && (
                <p className="text-[11px] truncate" style={{ color: SOFT, fontFamily: OUTFIT }} title={subtitle}>
                  {subtitle}
                </p>
              )}
            </div>
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

        {/* ── BAND 3 · NOW PLAYING ─────────────────────────────────────────────
            `flex: 1` — this band, not the bottom of the card, is where surplus
            height from a taller sibling in the row goes. It is pulled out to an
            8px gutter so its radius is exactly concentric with the card's. */}
        <div
          className="flex flex-col flex-1"
          style={{
            marginBlockStart: 12,
            marginInlineStart: -(20 - PANEL_GUTTER),
            marginInlineEnd: -(18 - PANEL_GUTTER),
          }}
        >
          <NowPlayingPanel np={np} />
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

        {/* ── BAND 5 · what has happened ──────────────────────────────────────
            STATIC. The same three facts on every card in every state, so the
            only thing a reader's eye has to track between cards is the panel
            above. No motion counts (a motion only matters while it is being
            decided, and then it IS the panel) and no total speaking time (a
            recap number, not a preview number). */}
        <div
          className="flex items-center gap-1.5 flex-nowrap min-w-0"
          style={{ marginBlockEnd: 11 }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onOpenRoster(data); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full focus:outline-none active:scale-[0.96] flex-shrink-0 whitespace-nowrap"
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

          {/* The dais, by first name. Names, not just faces: an organiser
              walking the floor needs to know who to ask for. */}
          <span className="inline-flex items-center gap-1.5 min-w-0 flex-1 justify-end" style={{ marginInlineStart: 'auto' }}>
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
              style={{ color: facts.chairs.length > 0 ? SOFT : AMBER_INK, fontFamily: OUTFIT, maxWidth: 96, minWidth: 0 }}
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
          cursor: 'pointer',
          transitionProperty: 'background-color', transitionDuration: '200ms',
          transitionTimingFunction: EASE,
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

/** The honest footnote under the grid. Two things on these cards mean something
 *  narrower than they look, and saying so costs one line. */
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
        message. A <strong>motion</strong> appears only while it is unruled and freshly raised —
        nothing in the database records a chair actually putting one to the vote, so a count of
        pending motions is not shown at all.
      </span>
    </p>
  );
}
