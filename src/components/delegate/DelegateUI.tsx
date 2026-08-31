'use client';

/**
 * DelegateUI — the visual layer for the redesigned delegate view.
 *
 * Design contract, and the reasoning behind the parts that look like they
 * could be simplified:
 *
 * 1. GOLD IS NEVER TEXT ON IVORY. #EED98A on #EDE7D8 measures 1.14:1. Gold is
 *    a FILL behind forest text, or a ring. Forest on gold is 9.09:1 and is the
 *    pairing to reach for. #9A8A78 muted is 2.71:1 — decorative only, never a
 *    label you need read. Secondary text is #4A4238 (8.00:1).
 * 2. GOLD MEANS EXACTLY ONE THING: "live right now / your turn". If gold also
 *    meant "speeches given" it would stop meaning anything on the row that
 *    matters. That is why the three stat tiles are deliberately uniform.
 * 3. THE ORDINAL IS NOT DRAWN ON THE FLAG. A numeral that reads on Japan's
 *    white field vanishes on Brazil's. Scrimming it dark enough to fix that
 *    destroys the country identity, which is the whole point of the flag.
 *    Rank sits beside the crest — the Duolingo/ESPN convention.
 * 4. THE ACTION BUTTONS ARE FILLED, NOT NEUMORPHIC. Soft ivory-on-ivory
 *    extrusion is the documented wrong choice for a multi-CTA screen: buttons
 *    become indistinguishable from inert surfaces. Tiles get the neu treatment;
 *    buttons get a hard `0 6px 0` edge that collapses on press.
 * 5. "SPEAKING" AND "YOU" ARE TWO INDEPENDENT CHANNELS — fill+motion vs
 *    outline+chip. They must stack cleanly, because when you are speaking both
 *    are true at once.
 *
 * Keyframes are namespaced `dgv-` — 28 files in this repo define keyframes in
 * inline <style> tags, which are global, and `neuFadeIn`/`gvRise` already
 * collide across files. Do not drop the prefix.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getFlagUrl } from '@/lib/countries';
import { OUTFIT, EASE } from '@/components/neu';
import { useScrollLock } from '@/hooks/useScrollLock';

/* ── Tokens ─────────────────────────────────────────────────────────────── */

export const DG = {
  ivory: '#EDE7D8',
  surface: '#F0EBDD',
  cream: '#FAF8F3',
  ink: '#1C1410',
  body: '#4A4238',      // 8.00:1 on ivory — the readable secondary
  faint: '#6B5F52',     // 4.87:1 — smallest readable tier
  hairline: '#DDD4C0',
  forest: '#1B3828',
  forestMid: '#2A5A3C',
  forestLift: '#245036',
  forestEdge: '#0E2117',
  green: '#3D7A52',
  gold: '#EED98A',
  goldLift: '#F3E3A2',
  goldEdge: '#C9AE58',
  deepGold: '#B6871F',
  danger: '#8B2020',
} as const;

/** Raised/pressed pair, forest-tinted like the rest of the app. */
export const LIFT = {
  sm: '-3px -3px 7px rgba(255,255,255,0.9), 4px 4px 9px rgba(27,56,40,0.15)',
  md: '-6px -6px 14px rgba(255,255,255,0.85), 8px 8px 20px rgba(27,56,40,0.16)',
  inSm: 'inset 2px 2px 6px rgba(27,56,40,0.13), inset -2px -2px 6px rgba(255,255,255,0.8)',
  in: 'inset 4px 4px 10px rgba(27,56,40,0.14), inset -4px -4px 10px rgba(255,255,255,0.8)',
} as const;

/* Escalation ladder. Position 17 and position 1 are different screens. */
export type Heat = 'floor' | 'next' | 'alert' | 'warm' | 'calm' | 'off';

export function heatFor(queueIndex: number, isSpeaking: boolean): Heat {
  if (isSpeaking) return 'floor';
  if (queueIndex < 0) return 'off';
  if (queueIndex === 0) return 'next';
  if (queueIndex === 1) return 'alert';
  if (queueIndex <= 4) return 'warm';
  return 'calm';
}

/* ── Global styles (namespaced) ─────────────────────────────────────────── */

export function DelegateStyles() {
  return (
    <style>{`
      @keyframes dgv-bar { 0%,100% { transform: scaleY(0.35) } 50% { transform: scaleY(1) } }
      @keyframes dgv-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
      @keyframes dgv-sheet { from { transform: translateY(100%) } to { transform: translateY(0) } }
      @keyframes dgv-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes dgv-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }
      /* Transient reminder: rises, holds, then fades itself out. The element is
         unmounted just after the animation ends, so the fade is never cut off. */
      @keyframes dgv-hint { 0% { opacity: 0 } 8% { opacity: 1 } 78% { opacity: 1 } 100% { opacity: 0 } }
      .dgv-hint { animation: dgv-hint 4200ms ${EASE} both }

      .dgv-rise { animation: dgv-rise 460ms ${EASE} both }
      .dgv-press { transition: transform 90ms cubic-bezier(.2,.8,.3,1), box-shadow 90ms cubic-bezier(.2,.8,.3,1) }
      .dgv-tap { transition: transform 140ms ${EASE}, box-shadow 200ms ${EASE} }
      .dgv-tap:active { transform: scale(0.96) }

      /* Roll-call thumb. ONLY transform animates — width/inset-inline-start stay
         put, so the pill never reflows mid-slide. \`--dgv-dir\` flips the travel
         direction under RTL, where inset-inline-start anchors to the right edge
         but translateX is still physical. */
      .dgv-rc-thumb { --dgv-dir: 1; transition: transform 200ms cubic-bezier(0.22,1,0.36,1) }
      [dir="rtl"] .dgv-rc-thumb { --dgv-dir: -1 }

      /* The arc wrap, applied as a TRANSFORM rather than a margin. A margin
         indents the row inside its rail and so takes the offset straight out of
         the text's available width — that is what clipped "SPEECHES" to
         "SPEECH", and no amount of tuning the rail width fixed it because the
         indent scaled with the disc. A transform shifts the row visually and
         costs the layout nothing. Ends tuck toward the crest, middle sits
         still, so nothing is ever pushed outward off the screen edge. */
      .dgv-arc { --dgv-dir: 1; transform: translateX(calc(var(--dgv-arc, 0px) * var(--dgv-dir))) }
      [dir="rtl"] .dgv-arc { --dgv-dir: -1 }

      .dgv-scroll { scrollbar-width: thin; scrollbar-color: ${DG.hairline} transparent }
      .dgv-scroll::-webkit-scrollbar { width: 6px }
      .dgv-scroll::-webkit-scrollbar-thumb { background: ${DG.hairline}; border-radius: 3px }

      /* Focus is never signalled by shadow alone — shadows are invisible to AT
         and to anyone who cannot perceive the depth cue. */
      .dgv-focus:focus-visible { outline: 3px solid ${DG.forest}; outline-offset: 3px; border-radius: 4px }

      /* ── The board: one screen, no page scroll (Kahoot-style) ──────────
         Everything is flex with min-height:0 so the bottom band absorbs
         whatever height is left after the hero, and the queue renders only
         the rows that genuinely fit rather than overflowing. */
      .dgv-board { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: clamp(6px, 1.8vw, 16px) }
      /* The hero is CAPPED and centred, and that cap is what makes the arc wrap
         work above phone width. The middle track is 1fr, so on a laptop it would
         otherwise swallow every spare pixel and strand the two side rails 150px+
         from a disc that cannot grow to meet them — at which point the arc tuck
         is a rounding error and the columns read as three unrelated stacks.
         Capping the hero keeps the rails against the disc at EVERY breakpoint;
         the bottom band still spans the full board width. */
      /* Tight gap on purpose: the rails are meant to hug the crest, not sit in
         their own columns across the card. The disc is the hero and everything
         else orbits it. */
      /* The side columns are CAPPED, not auto. Left to themselves the labels
         ("VIEW DOCUMENTS", "SPEECHES GIVEN") sized the rails to their text and
         squeezed the crest into whatever was left — about 88px on a 375px
         phone, which is the whole complaint. Capping them hands the middle the
         space instead, so the disc leads and the rails tuck against it. */
      /* 106 on the right is set by the longest label the rail must hold —
         "SPEECHES" beside a 26px glyph. Tightening to 92 bought ~15px of crest
         and clipped it to "SPEECH", which is a worse trade than a slightly
         smaller disc. If these labels are ever shortened, this can come down. */
      /* FIXED rail widths, not minmax(). With a greedy minmax(0,1fr) middle the
         side columns collapse to their MINIMUM, never their max — the right
         rail resolved to 63px and gave its label 30px for a 39px word, so
         "SPEECHES" clipped no matter how the caps were tuned. Fixed widths mean
         the rails get exactly what their content needs and the crest takes the
         entire remainder. Sized from measurement: 20px glyph + 7px gap + the
         39px word + slack. */
      /* position:relative anchors the roll-call footnote, which hangs off the
         hero as an absolute overlay so it costs the layout nothing when idle. */
      .dgv-hero { position: relative; flex-shrink: 0; display: grid; grid-template-columns: 82px minmax(0, 1fr) 82px; align-items: center; gap: clamp(2px, 0.8vw, 10px); max-inline-size: 620px; margin-inline: auto; inline-size: 100% }
      @media (min-width: 700px) {
        .dgv-hero { grid-template-columns: 132px minmax(0, 1fr) 150px }
      }
      /* The disc is measured off this box (useMeasuredSize), so this cap IS the
         disc's ceiling. 34vh keeps a short laptop window from handing the whole
         screen to the crest and squeezing the non-scrolling bottom band. */
      /* inline-size:100% is load-bearing, not cosmetic. useMeasuredSize sizes
         the disc from THIS box, and a shrink-to-fit flex column sizes itself
         from its content — so the two fed each other and the measurement pinned
         at the 84px floor forever, leaving a 275px column empty beside a tiny
         crest. Filling the column breaks the loop and lets the disc actually
         claim the space. (No backticks in here: this block lives inside a
         template literal and one would terminate the string.) */
      .dgv-hero-mid { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; inline-size: 100%; max-inline-size: min(206px, 24vh); margin-inline: auto }
      .dgv-hero-side { display: flex; flex-direction: column; gap: clamp(8px, 2.2vw, 14px); min-width: 0 }
      /* The queue gets the wider share — country names are the content that
         actually has to be readable, and an even split truncated them to
         "Ba…" / "Lib…" at 375px. */
      .dgv-bottom { flex: 1; min-height: 0; display: grid; grid-template-columns: 1.32fr 1fr; gap: clamp(7px, 2.6vw, 18px) }
      .dgv-queue { min-height: 0; display: flex; flex-direction: column; overflow: hidden }
      .dgv-actions { min-height: 0; display: flex; flex-direction: column; gap: clamp(7px, 2.2vw, 14px) }

      /* Tablet and up keep the same board — the brief was "similar on laptop
         and iPad", so this scales rather than re-flowing into a new shape. */
      /* On a narrow phone the row's forest outline already says "you" on its
         own, so the chip yields rather than clipping the country name — the
         one piece of information the row exists to carry. */
      @media (max-width: 419px) {
        .dgv-speaking-tag, .dgv-you-chip, .dgv-spoken-mark { display: none }
      }

      @media (min-width: 700px) {
        .dgv-bottom { grid-template-columns: 1.2fr 1fr }
      }

      /* Touch targets in the header. The logo's anchor lives inside a shared
         component, so its hit area is grown from here rather than by editing
         a file the chair and voting pages also render. The code button keeps
         its visual position via matching negative margin — it only ever
         overlaps the committee name, which is not interactive, so no two
         tappable areas end up on top of each other. */
      .dgv-hdr a { min-height: 44px; display: inline-flex; align-items: center }
      .dgv-hdr .dgv-code { padding: 7px 0; margin: -7px 0 }

      @media (min-width: 768px) {
        .dgv-sheet-wrap { align-items: center !important; padding: 24px !important }
        .dgv-sheet-panel { border-radius: 24px !important; animation-name: dgv-rise !important }
      }

      @media (prefers-reduced-motion: reduce) {
        .dgv-rise { animation: none }
        .dgv-press, .dgv-tap { transition-duration: 1ms }
        .dgv-bar { animation: none !important }
        /* The thumb still MOVES (it is the fill that carries the selection) —
           it just stops travelling. Selection was never signalled by motion. */
        .dgv-rc-thumb { transition-duration: 1ms }
        /* The hint still appears and still goes away; it just does not fade. */
        .dgv-hint { animation-duration: 4200ms; animation-timing-function: steps(1, end) }
      }
    `}</style>
  );
}

/* ── Equalizer ──────────────────────────────────────────────────────────── */

/**
 * Motion is the one channel a static row cannot imitate — it is what makes
 * "speaking now" unmistakable. Under reduced-motion the bars freeze at uneven
 * heights, which still reads as audio; a single static dot does not.
 */
export function Equalizer({ color = DG.forest, size = 16 }: { color?: string; size?: number }) {
  const frozen = [0.5, 1, 0.7];
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 3, height: size }}
    >
      {[0, 120, 240].map((delay, i) => (
        <span
          key={delay}
          className="dgv-bar"
          style={{
            width: 3,
            height: size,
            borderRadius: 2,
            background: color,
            transformOrigin: 'bottom',
            transform: `scaleY(${frozen[i]})`,
            animation: `dgv-bar 520ms ${delay}ms ease-in-out infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}

/* ── Flag disc ──────────────────────────────────────────────────────────── */

export function FlagDisc({
  code,
  name,
  size = 96,
  ring = DG.gold,
}: { code: string; name?: string; size?: number; ring?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        position: 'relative',
        flexShrink: 0,
        background: DG.surface,
        /* Surface-coloured stroke first, then the identity ring: the badge
           technique that keeps an element detached over any background. */
        boxShadow: `0 0 0 3px ${DG.ivory}, 0 0 0 6px ${ring}, ${LIFT.sm}`,
      }}
    >
      {!failed && code ? (
        <img
          src={getFlagUrl(code)}
          alt={name ? `Flag of ${name}` : ''}
          onError={() => setFailed(true)}
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            objectFit: 'cover', display: 'block',
            /* Pure-black hairline: a tinted one picks up the surface
               underneath and reads as dirt on the image edge. */
            outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: -1,
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            fontSize: size * 0.42, color: DG.faint,
          }}
        >
          ◍
        </span>
      )}
    </span>
  );
}

/* ── Flag disc with the ordinal over it ─────────────────────────────────── */

/**
 * The hero of the phone layout: the delegate's own flag, dimmed under a scrim,
 * with their queue position sitting on top of it.
 *
 * The scrim is what makes this work. A bare numeral over a flag is legible on
 * Japan and invisible on Brazil; at 0.46 black plus the inner vignette, white
 * 900 type clears 4.5:1 over every flag in the set while the flag stays
 * recognisable by shape and hue. Do not lighten it below ~0.40.
 */
export function FlagOrdinalDisc({
  code,
  name,
  size,
  primary,
  caption,
  live,
}: {
  code: string;
  name?: string;
  size: number;
  primary: string;   // "17th" | "NEXT" | "FLOOR"
  caption: string;   // "IN THE QUEUE"
  live?: boolean;    // gold ring + no scrim dimming when they hold the floor
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      style={{
        position: 'relative', display: 'inline-block', flexShrink: 0,
        /* maxWidth + aspectRatio, not a bare width/height pair. `size` comes
           from a measured box, and a measurement can go stale — after a viewport
           change it was still reporting 216px into a 181px column, so the crest
           overflowed by 35px and the stat rail rendered ON TOP of the flag. The
           clamp makes that class of bug impossible: whatever the measurement
           says, the disc can never be wider than the column it sits in, and
           aspect-ratio keeps it a circle when the clamp bites. */
        width: size, maxWidth: '100%', aspectRatio: '1 / 1', height: 'auto',
        borderRadius: '50%', background: DG.forest,
        boxShadow: live
          ? `0 0 0 3px ${DG.ivory}, 0 0 0 7px ${DG.gold}, 0 8px 22px rgba(27,56,40,0.30)`
          : `0 0 0 3px ${DG.ivory}, 0 0 0 6px ${DG.hairline}, ${LIFT.sm}`,
        overflow: 'hidden',
      }}
    >
      {!failed && code && (
        <>
          {/* Blurred cover copy fills the letterbox. `contain` keeps the whole
              flag readable — a 3:2 flag cropped to a circle loses its left and
              right thirds, which is where most designs carry their charge — but
              at hero size the bare bands above and below read as dead space and,
              worse, as part of the flag itself. A scaled, blurred copy behind
              them is the video-player trick: the disc reads as full-bleed while
              the flag stays uncropped. Purely decorative, so aria-hidden. */}
          <img
            src={getFlagUrl(code)}
            alt=""
            aria-hidden="true"
            onError={() => setFailed(true)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', filter: 'blur(14px) saturate(1.15)',
              transform: 'scale(1.25)', opacity: 0.85,
            }}
          />
          <img
            src={getFlagUrl(code)}
            alt={name ? `Flag of ${name}` : ''}
            onError={() => setFailed(true)}
            style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </>
      )}
      {/* Scrim, weighted UP. It only has to carry the numeral, which sits in
          the upper half; running it dark all the way to the bottom rim just
          buried the flag for no legibility gain. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: live
            ? 'linear-gradient(180deg, rgba(0,0,0,0.46) 0%, rgba(0,0,0,0.40) 52%, rgba(0,0,0,0.16) 100%)'
            : 'linear-gradient(180deg, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.44) 52%, rgba(0,0,0,0.18) 100%)',
        }}
      />
      <span
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 1, padding: 6,
        }}
      >
        {/* An em-dash standing in for "no position" is noise at hero size — it
            reads as a redaction bar over the crest. When there is no ordinal the
            caption carries the whole message on its own. */}
        {primary !== '—' && (
          <span
            style={{
              fontFamily: OUTFIT, fontWeight: 900, color: '#FFFFFF',
              fontSize: primary.length > 4 ? size * 0.21 : size * 0.34,
              lineHeight: 0.95, letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              textShadow: '0 2px 8px rgba(0,0,0,0.55)',
              textAlign: 'center',
            }}
          >
            {primary}
          </span>
        )}
        <span
          style={{
            fontFamily: OUTFIT, fontWeight: 800, color: 'rgba(255,255,255,0.94)',
            /* Bigger when it is carrying the message alone, but still clearly
               subordinate to an ordinal when one is present. */
            fontSize: Math.max(8, size * (primary === '—' ? 0.095 : 0.075)),
            letterSpacing: '0.08em',
            textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.15,
            textShadow: '0 1px 4px rgba(0,0,0,0.6)', maxInlineSize: '86%',
          }}
        >
          {caption}
        </span>
      </span>
    </span>
  );
}

/**
 * How far to pull an item toward the disc so a stack of them follows its
 * curve instead of forming a straight column.
 *
 * An item sitting `d` above or below the centre line should be `sqrt(R²-d²)`
 * from it, not `R` — so the ones at the top and bottom of the stack tuck in
 * and the middle one jutts out, and the group reads as wrapped around the
 * circle. Returns the inset in px, normalised so the outermost item gets
 * exactly `depth`. Costs no vertical space, which a true radial orbit would.
 */
export function arcInset(index: number, count: number, depth = 22): number {
  if (count < 2) return 0;
  const span = 0.8; // keep off the pole, where the curve turns vertical
  const p = ((index - (count - 1) / 2) / ((count - 1) / 2)) * span;
  const norm = 1 - Math.sqrt(1 - span * span);
  return Math.round((depth * (1 - Math.sqrt(Math.max(0, 1 - p * p)))) / norm);
}

/* ── Stat row (3D icon + number + label), the hero's right rail ─────────── */

export function StatRow({
  emoji,
  value,
  label,
  onClick,
  iconSize = 30,
}: {
  emoji: React.ReactNode;
  value: string;
  label: string;
  onClick?: () => void;
  iconSize?: number;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      aria-label={onClick ? `${label}: ${value}` : undefined}
      className={onClick ? 'dgv-tap dgv-focus' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, width: '100%',
        border: 'none', background: 'transparent', padding: 0, textAlign: 'start',
        cursor: onClick ? 'pointer' : 'default', minHeight: 40,
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex', width: iconSize }}>{emoji}</span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block', fontFamily: OUTFIT, fontWeight: 900, color: DG.ink,
            fontSize: 'clamp(17px, 5.2vw, 22px)', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <span
          style={{
            display: 'block', fontFamily: OUTFIT, fontWeight: 800, color: DG.body,
            /* The rail width — and therefore how big the crest can be — is set
               by the longest word here. Every 1px shaved off this gives ~3px
               back to the disc across both rails. */
            fontSize: 'clamp(6.5px, 1.85vw, 9px)', letterSpacing: '0.03em',
            textTransform: 'uppercase', lineHeight: 1.18, marginTop: 2,
          }}
        >
          {label}
        </span>
      </span>
    </Tag>
  );
}

/* ── Square action button ───────────────────────────────────────────────── */

/**
 * Key caps. FLAT fills — no gradients anywhere.
 *
 * A soft vertical gradient reads as extrusion only above ~15% luminance
 * spread; below that the eye's cheapest explanation is "flat panel, unevenly
 * printed", so you pay the gradient's cost (a desaturated top half drifting
 * toward the ivory background, and a label sitting across two backgrounds)
 * and buy no depth at all. Worse, a soft gradient beside a razor-sharp edge is
 * two incompatible rendering models on one object, and the edge starts reading
 * as a border someone forgot to delete. Depth here comes from silhouette: a
 * hard unblurred bottom wall plus a small contact shadow.
 *
 * `edge` is derived from the fill by one rule — mix(fill, forest, 30%) — never
 * hand-picked. That single derivation is most of why three different colours
 * read as three instances of one object rather than three separate designs.
 * The shared 2px forest border does the rest, and it is load-bearing for gold:
 * #EED98A on ivory is 1.14:1, so without a border that key has no boundary at
 * all and cannot read as an object.
 */
export const ACTION_SKINS = {
  green: { bg: '#2F8A4E', edge: '#26603B', fg: '#FFFFFF' },
  blue:  { bg: '#3E7CB1', edge: '#345D7E', fg: '#FFFFFF' },
  gold:  { bg: '#EED98A', edge: '#B3AC6F', fg: '#1B3828' },
  slate: { bg: '#B9AE9A', edge: '#8C8874', fg: '#1B3828' },
} as const;

export type ActionSkin = keyof typeof ACTION_SKINS;

/**
 * Chunky near-square key. Same hard `0 Npx 0` edge as the pill buttons — the
 * cap travels down onto the edge on press, which is what sells it as physical.
 */
const EDGE = 6;

export function SquareButton({
  skin = 'green',
  icon,
  children,
  onClick,
  disabled,
  badge,
  sub,
}: {
  skin?: ActionSkin;
  /** Flat monochrome glyph, inheriting the label colour. Never 3D — a shaded
   *  icon brings its own light source and depth story, and two depth models on
   *  one object destroys both. The cap is the object; the glyph is printed on
   *  it, and printed markings are flat. */
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  badge?: number;
  sub?: string;
}) {
  const [down, setDown] = useState(false);
  const s = ACTION_SKINS[skin];
  const pressed = down && !disabled;

  return (
    /* Two layers: the base IS the side wall, and the face compresses down onto
       it. The footprint never changes, so three stacked keys cannot reflow. */
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => !disabled && setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      /* Safari only fires :active on touch when a touch listener exists, and
         this is a phone-first screen — without it iPhone gets no press at all. */
      onTouchStart={() => {}}
      className="dgv-focus"
      style={{
        position: 'relative', flex: 1, width: '100%', minHeight: 0,
        display: 'block', padding: `0 0 ${EDGE}px`, border: 'none',
        background: s.edge, borderRadius: 18, overflow: 'hidden',
        cursor: disabled ? 'default' : 'pointer',
        touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
        boxShadow: disabled ? 'none' : '0 2px 3px rgba(27,56,40,0.16)',
        opacity: disabled ? 0.72 : 1,
      }}
    >
      <span
        className="dgv-key-face"
        style={{
          /* Grouped, not pushed to opposite ends. On a tall key, space-between
             strands the glyph and the label at the extremes with a void
             between them and they stop reading as one control. */
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          justifyContent: 'center', gap: 'clamp(6px, 1.6vw, 10px)', height: '100%',
          padding: 'clamp(10px, 2.8vw, 16px)', borderRadius: 18,
          background: s.bg, color: s.fg,
          border: `2px solid ${DG.forest}`,
          filter: disabled ? 'saturate(0.4)' : undefined,
          /* Instant on the way down, eased on the way back up. That asymmetry
             is what makes it feel like a mechanism rather than an animation. */
          transform: pressed ? `translateY(${EDGE}px)` : 'translateY(0)',
          transitionProperty: 'transform, filter',
          transitionDuration: pressed ? '0s' : '120ms',
          transitionTimingFunction: 'cubic-bezier(.2,.8,.3,1)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
          {icon && (
            <span style={{ flexShrink: 0, display: 'flex', marginTop: -1 }} aria-hidden="true">
              {icon}
            </span>
          )}
          {typeof badge === 'number' && badge > 0 && (
            <span
              style={{
                marginInlineStart: 'auto', minWidth: 22, height: 22, padding: '0 6px',
                borderRadius: 999, display: 'grid', placeItems: 'center',
                background: DG.forest, color: DG.gold,
                fontFamily: OUTFIT, fontSize: 11, fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>

        <span style={{ display: 'block', textAlign: 'start', width: '100%' }}>
          <span
            style={{
              display: 'block', fontFamily: OUTFIT, fontWeight: 800, lineHeight: 1.12,
              fontSize: 'clamp(13px, 4vw, 18px)', letterSpacing: '-0.01em',
            }}
          >
            {children}
          </span>
          {sub && (
            <span
              style={{
                display: 'block', marginTop: 2, fontFamily: OUTFIT, fontWeight: 600,
                fontSize: 'clamp(9px, 2.7vw, 12px)', opacity: 0.78, lineHeight: 1.15,
              }}
            >
              {sub}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/* ── How many fixed-height rows fit the space we actually have ──────────── */

/**
 * The page does not scroll, so the queue renders exactly the number of rows
 * that fit and hands the rest to "view all". Measuring beats guessing: the
 * available height varies with viewport, browser chrome and font scaling.
 */
export function useFitCount(rowHeight: number, reserve = 0) {
  const [count, setCount] = useState(6);
  const roRef = useRef<ResizeObserver | null>(null);
  /* Callback ref, not useRef + useEffect. The delegate page returns a loader
     on its first renders, so an effect keyed on [] observes a null node and,
     with no dep able to change, never runs again — the count would sit on its
     initial guess forever. A callback ref re-fires the moment the node lands. */
  const ref = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => setCount(Math.max(1, Math.floor((el.clientHeight - reserve) / rowHeight)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    roRef.current = ro;
  }, [rowHeight, reserve]);
  return { ref, count };
}

/** Largest square that fits the measured box, so the hero disc scales with the
 *  space the layout actually gave it rather than a viewport guess. */
export function useMeasuredSize(min: number, max: number) {
  const [size, setSize] = useState(min);
  const roRef = useRef<ResizeObserver | null>(null);
  /* Callback ref for the same reason as useFitCount — see the note there. */
  const ref = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => setSize(Math.max(min, Math.min(max, Math.floor(el.clientWidth || max))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    roRef.current = ro;
  }, [min, max]);
  return { ref, size };
}

/* ── Queue ordinal ──────────────────────────────────────────────────────── */

export function ordinalSuffixFor(n: number): string {
  return ordinalSuffix(n);
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

/**
 * The hero number. A count alone leaves users tracking progress in their head;
 * a tracker alone with no dominant number reads as decoration. Both, always.
 */
export function QueueOrdinal({
  position,
  heat,
  label,
  aheadLabel,
  etaLabel,
  freshLabel,
}: {
  position: number;          // 1-based; 0 = has the floor
  heat: Heat;
  label: string;
  aheadLabel?: string;
  etaLabel?: string;
  freshLabel?: string;
}) {
  const onFloor = heat === 'floor';
  const isNext = heat === 'next';
  const big = onFloor || isNext;

  return (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div
        style={{
          display: 'flex', alignItems: 'baseline', gap: 4,
          color: DG.forest, fontFamily: OUTFIT, lineHeight: 0.92,
          letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums',
        }}
      >
        {big ? (
          <span style={{ fontSize: 'clamp(38px, 11vw, 60px)', fontWeight: 900 }}>
            {onFloor ? 'FLOOR' : 'NEXT'}
          </span>
        ) : (
          <>
            <span style={{ fontSize: 'clamp(52px, 16vw, 88px)', fontWeight: 900 }}>{position}</span>
            <span style={{ fontSize: 'clamp(20px, 6vw, 34px)', fontWeight: 900, color: DG.body }}>
              {ordinalSuffix(position)}
            </span>
          </>
        )}
      </div>

      <div
        style={{
          marginTop: 6, fontFamily: OUTFIT, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: DG.body,
        }}
      >
        {label}
      </div>

      {aheadLabel && (
        <div style={{ marginTop: 8, fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: DG.body }}>
          {aheadLabel}
        </div>
      )}
      {etaLabel && (
        <div
          style={{
            marginTop: 3, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
            color: DG.forest, fontVariantNumeric: 'tabular-nums',
          }}
        >
          {etaLabel}
        </div>
      )}
      {freshLabel && (
        <div
          aria-live="polite"
          style={{ marginTop: 6, fontFamily: OUTFIT, fontSize: 11, fontWeight: 500, color: DG.faint }}
        >
          {freshLabel}
        </div>
      )}
    </div>
  );
}

/* ── Stat tiles ─────────────────────────────────────────────────────────── */

/**
 * Each tile is a doorway, not a destination: no sparklines, no charts, tap
 * opens the detail sheet. Tiles are uniform on purpose — see the gold rule.
 */
export function StatTile({
  icon,
  value,
  label,
  onClick,
  ariaLabel,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  onClick?: () => void;
  /** Spell the tile out for screen readers — "SPOKEN / 4:12" reads as two
   *  disconnected fragments otherwise, and the tap opens a detail sheet the
   *  terse visible label gives no hint of. */
  ariaLabel?: string;
}) {
  const [down, setDown] = useState(false);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      aria-label={ariaLabel ?? `${label}: ${value}`}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      className="dgv-press dgv-focus"
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '12px 10px', borderRadius: 16, border: 'none',
        background: DG.ivory, textAlign: 'start', width: '100%',
        minHeight: 76, cursor: onClick ? 'pointer' : 'default',
        boxShadow: down ? LIFT.inSm : LIFT.sm,
      }}
    >
      <span style={{ color: DG.body, display: 'flex' }} aria-hidden="true">{icon}</span>
      <span
        style={{
          fontFamily: OUTFIT, fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 900,
          color: DG.forest, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: OUTFIT, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: DG.body, whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </Tag>
  );
}

/* ── Roll-call switch ───────────────────────────────────────────────────── */

/**
 * Two-state segmented control. The selected state is carried by FILL, never by
 * shadow — a shadow-only "on" state is silent to assistive tech.
 *
 * The fill is a single sliding thumb rather than a background swapped between
 * two buttons. That matters for more than polish: swapping the fill gives no
 * indication of WHICH way the control moved, so a mis-tap and a deliberate tap
 * look identical after the fact. A thumb that travels shows the transition
 * itself. Motion is strictly additive — the thumb is a persistent gradient fill
 * and `aria-pressed` is on the buttons, so with animation off (or with a screen
 * reader) the control still states its state.
 *
 * Only `transform` animates. Animating width/inset would reflow the pill on
 * every frame and, in this layout, the pill sits inside a hero rail that other
 * elements are measured against.
 */
export function RollCallSwitch({
  value,
  onChange,
  presentLabel,
  votingLabel,
  disabled,
  compact,
}: {
  value: 'present' | 'present-voting';
  onChange: (v: 'present' | 'present-voting') => void;
  presentLabel: string;
  votingLabel: string;
  disabled?: boolean;
  /** Two-letter P / PV form for the hero rail, where width is scarce. */
  compact?: boolean;
}) {
  const opts: Array<{ k: 'present' | 'present-voting'; label: string }> = [
    { k: 'present', label: presentLabel },
    { k: 'present-voting', label: votingLabel },
  ];
  const pad = compact ? 3 : 4;
  const idx = value === 'present-voting' ? 1 : 0;
  return (
    <div
      role="group"
      style={{
        position: 'relative',
        /* Two equal 1fr tracks, no gap: the thumb is exactly half the track's
           content box, so `translateX(100%)` lands on the second cell with no
           per-variant arithmetic. */
        display: 'inline-grid', gridTemplateColumns: '1fr 1fr', gap: 0,
        padding: pad,
        borderRadius: 999, background: DG.ivory, boxShadow: LIFT.inSm,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        aria-hidden="true"
        className="dgv-rc-thumb"
        style={{
          position: 'absolute',
          insetBlock: pad,
          insetInlineStart: pad,
          /* % on an absolutely positioned box resolves against the containing
             block's padding box, so this is exactly one grid cell wide. */
          inlineSize: `calc((100% - ${pad * 2}px) / 2)`,
          borderRadius: 999,
          background: `linear-gradient(135deg, ${DG.forestMid}, ${DG.forest})`,
          boxShadow: '0 3px 8px rgba(27,56,40,0.30)',
          transform: `translateX(calc(var(--dgv-dir, 1) * ${idx * 100}%))`,
        }}
      />
      {opts.map((o) => {
        const on = value === o.k;
        return (
          <button
            key={o.k}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => !disabled && onChange(o.k)}
            className="dgv-focus"
            style={{
              /* Above the thumb, transparent, so the thumb is the only fill. */
              position: 'relative', zIndex: 1, background: 'transparent',
              borderRadius: 999, border: 'none',
              /* Compact still clears 44px total once the 3px track padding and
                 the label above it are counted — it is the visual pill that
                 shrinks, not the tappable column. */
              minHeight: compact ? 38 : 48,
              minWidth: compact ? 40 : undefined,
              padding: compact ? '0 12px' : '0 20px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: OUTFIT, fontSize: compact ? 14 : 13, fontWeight: 900,
              letterSpacing: compact ? '0.02em' : '0.06em',
              color: on ? DG.gold : DG.body,
              transition: `color 200ms cubic-bezier(0.22,1,0.36,1)`,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Chunky action button ───────────────────────────────────────────────── */

export type ButtonTone = 'primary' | 'outline' | 'gold';

/**
 * The hard `0 6px 0` bottom edge (zero blur) is what makes these read as
 * physical keys rather than floating cards; pressing collapses the edge and
 * moves the cap down onto it. The ambient forest shadow sits underneath.
 */
export function ChunkyButton({
  tone = 'primary',
  icon,
  children,
  onClick,
  disabled,
  badge,
  full = true,
}: {
  tone?: ButtonTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  badge?: number;
  full?: boolean;
}) {
  const [down, setDown] = useState(false);

  const skin: Record<ButtonTone, { bg: string; edge: string; fg: string; border?: string }> = {
    primary: {
      bg: `linear-gradient(180deg, ${DG.forestLift}, ${DG.forest})`,
      edge: DG.forestEdge, fg: DG.ivory,
    },
    outline: {
      bg: DG.cream, edge: DG.forest, fg: DG.forest,
      border: `2px solid ${DG.forest}`,
    },
    gold: {
      bg: `linear-gradient(180deg, ${DG.goldLift}, ${DG.gold})`,
      edge: DG.goldEdge, fg: DG.forest,
    },
  };
  const s = skin[tone];
  const pressed = down && !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      className="dgv-press dgv-focus"
      style={{
        position: 'relative',
        width: full ? '100%' : undefined,
        minHeight: 60,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 18px', borderRadius: 18,
        border: s.border ?? 'none',
        background: disabled ? DG.hairline : s.bg,
        color: disabled ? DG.faint : s.fg,
        fontFamily: OUTFIT, fontSize: 'clamp(14px, 4.2vw, 17px)', fontWeight: 900,
        letterSpacing: '0.01em', textAlign: 'start',
        /* Normalised here, not at the call site: the labels come from four
           locales whose casing conventions differ, and `tab_chat` in
           particular is title case. A no-op for Arabic, which has no case. */
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: pressed ? 'translateY(5px)' : 'translateY(0)',
        boxShadow: disabled
          ? 'none'
          : pressed
            ? `0 1px 0 ${s.edge}, 0 3px 6px rgba(27,56,40,0.18)`
            : `0 6px 0 ${s.edge}, 0 12px 20px rgba(27,56,40,0.22)`,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span
          style={{
            minWidth: 24, height: 24, padding: '0 7px', borderRadius: 999,
            display: 'grid', placeItems: 'center',
            background: tone === 'gold' ? DG.forest : DG.gold,
            color: tone === 'gold' ? DG.gold : DG.forest,
            fontFamily: OUTFIT, fontSize: 12, fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            boxShadow: `0 0 0 2px ${tone === 'gold' ? DG.gold : DG.forest}`,
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {icon && <span aria-hidden="true" style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>}
    </button>
  );
}

/* ── Queue row ──────────────────────────────────────────────────────────── */

/**
 * "Speaking" and "you" travel on different properties — fill+motion vs
 * outline+chip — precisely so they can both be true at once without either
 * cancelling the other out.
 */
/**
 * One delegation in the queue.
 *
 * The row used to be transparent with a bare numeral, which made the queue read
 * as a list of words rather than a list of delegations. Three things give each
 * one presence without changing the row's height — and the height matters,
 * because the board is a fixed 100dvh and `useFitCount(44, 12)` on the delegate
 * page measures capacity against exactly 44px:
 *
 *   • a real surface, so the row is an object you could point at;
 *   • a position badge graded by how close the delegation is to the floor,
 *     reusing the same escalation the delegate's own status card runs on —
 *     next-up is forest and unmissable, the tail is quiet;
 *   • `spoken`, the count of speeches this delegation has already given, which
 *     is the one fact a delegate scanning the queue actually wants and which
 *     the page already has in memory from `parseSpeakingLogs`.
 */
export function QueueRow({
  position,
  code,
  name,
  speaking,
  isSelf,
  speakingLabel,
  youLabel,
  compact,
  spoken = 0,
}: {
  position: number;
  code: string;
  name: string;
  speaking?: boolean;
  isSelf?: boolean;
  speakingLabel: string;
  youLabel: string;
  compact?: boolean;
  /** Speeches this delegation has already given this session. 0 hides the mark. */
  spoken?: number;
}) {
  // Position 1 is next on the floor and gets the loudest badge; 2–3 are warm;
  // everything past that is deliberately quiet, so the top of the queue reads
  // first. Mirrors `heatFor` without pulling its Heat type into a dumb row.
  const imminence = position <= 1 ? 'next' : position <= 3 ? 'warm' : 'calm';
  const badgeBg =
    imminence === 'next' ? DG.forest
      : imminence === 'warm' ? 'rgba(27,56,40,0.16)'
        : 'rgba(27,56,40,0.07)';
  const badgeFg = imminence === 'next' ? DG.gold : DG.forest;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        minHeight: speaking ? 56 : compact ? 40 : 44,
        padding: speaking ? '7px 9px' : '5px 7px',
        borderRadius: 14,
        background: speaking
          ? `linear-gradient(180deg, ${DG.goldLift}, ${DG.gold})`
          // A whisper of a surface. Enough to bound the row as an object,
          // faint enough that eight of them stacked do not read as stripes.
          : isSelf ? 'rgba(27,56,40,0.06)' : 'rgba(27,56,40,0.028)',
        border: isSelf ? `2px solid ${DG.forest}` : '2px solid transparent',
        boxShadow: speaking ? `0 4px 0 ${DG.goldEdge}, 0 8px 16px rgba(27,56,40,0.18)` : 'none',
      }}
    >
      {speaking ? (
        <span style={{ width: 28, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Equalizer color={DG.forest} size={16} />
        </span>
      ) : (
        <span
          style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: badgeBg,
            fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, color: badgeFg,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {position}
        </span>
      )}

      <FlagDisc code={code} name={name} size={compact ? 22 : 26} ring={DG.ivory} />

      <span
        style={{
          flex: 1, minWidth: 0, fontFamily: OUTFIT,
          fontSize: compact ? 12.5 : 13.5, fontWeight: 700, color: DG.forest,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>

      {/* Already spoken. Drops out on a narrow row before the country name
          does, and never appears for a delegation still waiting on its first
          speech — an empty marker on every row is noise, not information. */}
      {!speaking && spoken > 0 && (
        <span
          className="dgv-spoken-mark"
          title={`${spoken} ${spoken === 1 ? 'speech' : 'speeches'} so far`}
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3,
            fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800,
            color: DG.faint, fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span
            aria-hidden
            style={{ width: 5, height: 5, borderRadius: '50%', background: DG.green, display: 'inline-block' }}
          />
          {spoken}
        </span>
      )}

      {isSelf && (
        <span
          className="dgv-you-chip"
          style={{
            padding: '2px 5px', borderRadius: 5, flexShrink: 0,
            background: DG.forest, color: DG.ivory,
            fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 900, letterSpacing: '0.04em',
          }}
        >
          {youLabel}
        </span>
      )}
      {speaking && (
        <span
          /* Drops out below ~150px of row width rather than truncating the
             country name it sits beside — the equalizer and the gold fill
             already say "speaking" on their own. */
          className="dgv-speaking-tag"
          style={{
            flexShrink: 0, fontFamily: OUTFIT, fontSize: 9, fontWeight: 800,
            letterSpacing: '0.08em', color: DG.forest, textTransform: 'uppercase',
          }}
        >
          {speakingLabel}
        </span>
      )}
    </div>
  );
}

/* ── Section card ───────────────────────────────────────────────────────── */

export function Panel({
  children,
  style,
  className = '',
}: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <section
      className={className}
      style={{
        background: DG.surface,
        borderRadius: 22,
        padding: 16,
        boxShadow: LIFT.md,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0, fontFamily: OUTFIT, fontSize: 11, fontWeight: 800,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: DG.deepGold,
      }}
    >
      {children}
    </h2>
  );
}

/* ── Bottom sheet ───────────────────────────────────────────────────────── */

/**
 * Portaled so no ancestor's overflow can clip it, per the project's popover
 * rule. Focus is trapped, Escape closes, and the scrim is opaque enough to
 * isolate the foreground.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // `body { overflow: hidden }` used to be inlined here; it does not hold on
  // iOS Safari, which is exactly where this bottom sheet lives. Shared hook.
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  /* `open` only ever becomes true from a click, so this never runs during SSR.
     The document check is the guard, not a mounted flag — a mounted flag would
     mean setting state inside an effect for no benefit. */
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(12,20,15,0.52)',
        /* Bottom sheet on phones where the thumb is; a centred dialog once
           there is room, so it does not read as a giant docked panel. */
        display: 'flex', justifyContent: 'center',
        alignItems: 'flex-end',
        padding: 0,
        animation: `dgv-fade 200ms ${EASE} both`,
      }}
      className="dgv-sheet-wrap"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={stop}
        className="dgv-scroll dgv-sheet-panel"
        style={{
          width: '100%', maxWidth: 720, maxHeight: '86vh', overflowY: 'auto',
          background: DG.surface,
          borderRadius: '24px 24px 0 0',
          padding: '10px 16px 24px',
          boxShadow: '0 -20px 60px rgba(27,56,40,0.32)',
          animation: `dgv-sheet 300ms ${EASE} both`,
          outline: 'none',
        }}
      >
        <div
          style={{
            width: 44, height: 5, borderRadius: 999, background: DG.hairline,
            margin: '0 auto 14px',
          }}
          aria-hidden="true"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <h2
            style={{
              flex: 1, margin: 0, fontFamily: OUTFIT, fontSize: 20, fontWeight: 900,
              letterSpacing: '-0.02em', color: DG.ink,
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="dgv-tap dgv-focus"
            style={{
              width: 44, height: 44, borderRadius: 999, border: 'none', flexShrink: 0,
              background: DG.ivory, color: DG.forest, cursor: 'pointer',
              boxShadow: LIFT.sm, display: 'grid', placeItems: 'center',
              fontSize: 20, fontWeight: 700, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
