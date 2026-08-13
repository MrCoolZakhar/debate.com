'use client';

/**
 * Loader.tsx — the one branded indeterminate loader for Gavelling.
 *
 * Three laurel leaves cascade down the frame on a staggered loop. The
 * laurel is the half of the Gavelling gavel mark that survives being
 * shrunk: a gavel head + handle turns into an unreadable brown smudge
 * below ~32px, whereas a single leaf blade stays a clean, obviously
 * green silhouette all the way down to 20px. It is also the only brand
 * shape whose motion doesn't fight the existing gavel-strike loader on
 * the live-session routes.
 *
 * Use this for GENERIC, indeterminate waits — route transitions, auth
 * gates, "we don't know what's coming back yet". Where the incoming
 * content has a known shape, a skeleton that mimics it is still better
 * UX; reach for src/components/Skeleton.tsx there instead.
 *
 * Motion + scoping live in Loader.module.css. Everything below is sizing,
 * theming and accessibility.
 */

import { memo } from 'react';
import styles from './Loader.module.css';

export interface LoaderProps {
  /** Box size in px. Scales cleanly ~20 (inline) → ~120 (full page). Default 44. */
  size?: number;
  /**
   * Surface the loader sits on. 'light' (default) is the ivory page/card
   * family; 'dark' is a forest-green surface. See the colour note below.
   */
  tone?: 'light' | 'dark';
  /** Screen-reader label. Keep it stable — it is a live region. Default 'Loading'. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/* ── Colour, measured not guessed ─────────────────────────────────────
 * Contrast against the surfaces this actually lands on (WCAG 1.4.11
 * non-text contrast wants >= 3:1 for a meaningful graphic):
 *
 *   NEU.green  #3D7A52  on NEU.base    #EDE7D8 -> 4.15:1  PASS
 *   NEU.green  #3D7A52  on NEU.surface #F0EBDD -> 4.30:1  PASS
 *   NEU.forest #1B3828  on NEU.base    #EDE7D8 -> 10.36:1 PASS
 *   NEU.green  #3D7A52  on NEU.forest  #1B3828 -> 2.50:1  FAIL
 *   sage       #7FA98C  on NEU.forest  #1B3828 -> 4.84:1  PASS
 *
 * forest wins on raw ratio, but at 10.36:1 on ivory it reads as near
 * black — a black spinner, which is exactly what Peter asked us to stop
 * shipping ("in green so that colours match with Gavelling"). NEU.green
 * clears the 3:1 bar with room to spare AND actually reads green, so it
 * is the light-tone fill. On a forest card NEU.green collapses to
 * 2.50:1, so the dark tone lifts to the light stop of NEU_GRADIENTS.sage
 * (#7FA98C, 4.84:1) — still unmistakably green, just inverted in value.
 */
const FILL = { light: '#3D7A52', dark: '#7FA98C' } as const;
/* Reference used a flat `#5c3d9933` (20% alpha) halo; same alpha here. */
const SHINE = { light: '#3D7A5233', dark: '#7FA98C3D' } as const;

function LoaderBase({
  size = 44,
  tone = 'light',
  label = 'Loading',
  className,
  style,
}: LoaderProps) {
  // A leaf that is a fixed fraction of the box disappears at inline sizes,
  // so small loaders get a proportionally chunkier leaf. Above ~32px the
  // cascade has room to read and the leaf can settle back to half the box.
  const leafPct = size < 30 ? 66 : size < 44 ? 58 : 50;
  // The reference's flat 10px halo swamps a 20px mark and vanishes on a
  // 120px one — tie it to the size, with sane bounds.
  const glow = Math.min(10, Math.max(3, Math.round(size * 0.14)));

  return (
    <span
      role="status"
      aria-live="polite"
      // The SVGs are aria-hidden and nothing inside this element ever
      // changes, so the live region announces exactly once when it is
      // inserted and never re-announces on a parent re-render.
      aria-label={label}
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      style={
        {
          width: size,
          height: size,
          '--gv-fill': FILL[tone],
          '--gv-shine': SHINE[tone],
          '--gv-leaf': `${leafPct}%`,
          '--gv-glow': `${glow}px`,
          ...style,
        } as React.CSSProperties
      }
    >
      <span className={`${styles.leaf} ${styles.one}`} aria-hidden>
        <Leaf />
      </span>
      <span className={`${styles.leaf} ${styles.two}`} aria-hidden>
        <Leaf />
      </span>
      <span className={`${styles.leaf} ${styles.three}`} aria-hidden>
        <Leaf />
      </span>
    </span>
  );
}

/**
 * A single laurel leaf. Blade first (the stylesheet fills `path:first-child`
 * with the theme colour, mirroring the reference's `svg g path:first-child`
 * hook), midrib second so it darkens the blade rather than being covered.
 * Slightly canted rather than mirror-symmetric — a perfectly symmetric
 * almond reads as a generic "eye" shape, the cant reads as foliage.
 */
function Leaf() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <g>
        <path d="M12.3 1.2C18.9 7.1 20.2 14.8 11.3 22.8 3.4 14.9 6 6.9 12.3 1.2Z" />
        <path
          d="M12.3 3.4C13.8 9.2 13.4 15.6 11.7 21"
          fill="none"
          stroke="#000"
          strokeOpacity="0.22"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** Identical props never re-render the DOM, so the live region stays quiet. */
const Loader = memo(LoaderBase);
Loader.displayName = 'Loader';

export default Loader;
