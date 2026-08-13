'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CommitteeIdentityBadge — the masthead at the top of the chair session
// sidebar, and the ONE place the committee's identity is stated in that column.
//
// WHY IT LOOKS LIKE THIS
//
// • Continuous, not stacked. It has no card of its own: no background fill, no
//   border box, no radius. It is the same forest as the sidebar, lit from the
//   top by a wash that dissolves to nothing before the bottom edge, so the
//   badge reads as the panel catching light rather than a separate slab sitting
//   on it. Its only seam is a gold hairline that fades out at BOTH ends — a
//   badge underline, never a border between two cards. The panel below
//   (RollCallPanel with `hideIdentity`) starts straight after it with no
//   divider of its own, so the two read as one masthead.
//
// • The mark floats. `LogoDisc bare` with the circular clip explicitly turned
//   off (borderRadius 0 / overflow visible), so nothing is a disc and nothing
//   is cropped — including a wide wordmark, which just letterboxes inside the
//   slot instead of losing its ends to a circle.
//
// • Contrast. Committee artwork is arbitrary: the UN emblem is bright cyan
//   (#009EDC) and reads instantly on forest, but the ICJ seal is dark navy
//   (#2A4B7C) and a conference upload can be anything. Floating them raw would
//   let the dark ones sink into #1B3828. Two tight white `drop-shadow`s give
//   the artwork a faint light rim, and because drop-shadow follows the ALPHA
//   channel it hugs the real silhouette of a transparent PNG/SVG rather than
//   boxing it. A third, darker, offset shadow grounds the mark so it reads as
//   floating above the panel. Light marks are unaffected; dark marks gain an
//   edge. That is the whole treatment — no disc, no plate, no chip.
//
// • Missing artwork. `fallbackTone="plain"`: gold initials on their own. The
//   default LogoDisc monogram is a FOREST gradient disc, which on a forest
//   sidebar is invisible.
//
// • Naming follows the AGENTS.md UI RULE: a long name shows its acronym big
//   with the full name small beneath; a short name is shown ONCE with no
//   redundant second line. The caller resolves both via
//   `deriveCommitteeAcronym` + `committeeDisplayName`.
// ─────────────────────────────────────────────────────────────────────────────

import { LogoDisc } from '@/components/LogoDisc';
import { NEU, OUTFIT } from '@/components/neu';

/** Slot the mark is contained inside. Slightly wider than tall so a wordmark
 *  logo gets a little more room without a square emblem drifting off-axis. */
const MARK_H = 38;
const MARK_W = 46;

/** Light rim (follows the artwork's alpha) + a grounding shadow. */
const FLOAT_FILTER =
  'drop-shadow(0 0 1px rgba(255,255,255,0.75)) drop-shadow(0 0 2.5px rgba(255,255,255,0.4)) drop-shadow(0 3px 5px rgba(0,0,0,0.38))';

export default function CommitteeIdentityBadge({
  logoSrc,
  primary,
  secondary,
  topic,
  topicLabel,
}: {
  /** Resolved emblem URL, or null for the monogram fallback. */
  logoSrc: string | null;
  /** Big label — the acronym for a long name, otherwise the name itself. */
  primary: string;
  /** Full name, shown small beneath. Null when `primary` already IS the name. */
  secondary?: string | null;
  topic?: string | null;
  /** Translated "Topic:" label. */
  topicLabel?: string;
}) {
  const monogram = primary.replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || '?';
  return (
    <div className="shrink-0 relative" style={{ padding: '11px 13px 10px' }}>
      {/* Top-lit wash. Fades to fully transparent at the bottom, so the badge has
          NO edge of its own — it bleeds into the stats row beneath it and the
          two share the one seam that already closes RollCallPanel's header. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(61,122,82,0.34) 0%, rgba(61,122,82,0.15) 48%, rgba(61,122,82,0) 100%)',
        }}
      />
      {/* Extruded top edge: the same "lit from above" cue the neumorphic system
          uses on ivory, translated to forest. 1px, and it is not a divider —
          it sits on the sidebar's outer edge, under the toolbar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: 0, right: 0, top: 0, height: 1, background: 'rgba(255,255,255,0.07)' }}
      />

      <div className="relative flex items-center gap-2.5">
        <LogoDisc
          src={logoSrc}
          alt={primary}
          size={MARK_H}
          fallbackText={monogram}
          bare
          fallbackTone="plain"
          style={{
            // Override the circular clip: floating means never cropped.
            width: MARK_W,
            height: MARK_H,
            borderRadius: 0,
            overflow: 'visible',
            filter: logoSrc ? FLOAT_FILTER : undefined,
          }}
        />
        <div className="min-w-0 flex-1">
          <p
            className="truncate"
            // Only when the acronym stands alone: a `title` becomes the element's
            // accessible name, so setting it while the full name is ALSO rendered
            // beneath made a screen reader announce that name twice.
            title={secondary ? undefined : primary}
            style={{
              fontFamily: OUTFIT,
              fontWeight: 900,
              fontSize: 17,
              lineHeight: 1.12,
              letterSpacing: '-0.005em',
              color: NEU.gold,
              margin: 0,
            }}
          >
            {primary}
          </p>
          {secondary && (
            <p
              className="truncate"
              title={secondary}
              style={{
                fontFamily: OUTFIT,
                fontSize: 10.5,
                fontWeight: 500,
                lineHeight: 1.25,
                color: 'rgba(237,231,216,0.52)',
                margin: '1px 0 0',
              }}
            >
              {secondary}
            </p>
          )}
          {topic && (
            <p
              className="line-clamp-2"
              title={topic}
              style={{
                fontFamily: OUTFIT,
                fontSize: 10.5,
                lineHeight: 1.3,
                color: 'rgba(238,217,138,0.55)',
                margin: '2px 0 0',
              }}
            >
              {topicLabel && (
                <span style={{ fontWeight: 700, color: 'rgba(238,217,138,0.72)' }}>{topicLabel} </span>
              )}
              {topic}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
