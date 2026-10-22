'use client';

/**
 * Loader.tsx — the one branded indeterminate loader for Gavelling.
 *
 * A gavel spinning a full turn inside a faint ring, with a gold arc chasing
 * round the ring (owner, 22 Oct 2026: "a gavel spinning 360 degrees", option 3
 * of the loader board: spin with a gold ring trail). Both turns share one
 * eased curve, so the gavel and the arc start and settle together each loop.
 *
 * Use this for GENERIC, indeterminate waits — route transitions, auth gates,
 * "we don't know what's coming back yet". Where the incoming content has a
 * known shape, a skeleton that mimics it is still better UX; reach for
 * src/components/Skeleton.tsx there instead.
 *
 * Motion + scoping live in Loader.module.css (hashed class and keyframe
 * names, so nothing collides with the global stylesheet). Everything below
 * is sizing, theming and accessibility. The public props are unchanged.
 */

import { memo } from 'react';
import styles from './Loader.module.css';

export interface LoaderProps {
  /** Box size in px. Scales cleanly ~20 (inline) → ~120 (full page). Default 44. */
  size?: number;
  /**
   * Surface the loader sits on. 'light' (default) is the ivory page/card
   * family; 'dark' is a forest-green surface.
   */
  tone?: 'light' | 'dark';
  /** Screen-reader label. Keep it stable — it is a live region. Default 'Loading'. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/* Colours per surface. On ivory the gavel is forest (#1B3828, 10:1) with gold
 * caps; on a forest card it lifts to sage (#7FA98C, 4.8:1) so it stays visible.
 * The gold arc (#C9A646) reads on both. */
const TONE = {
  light: { head: '#1B3828', handle: '#2C4A39', track: 'rgba(27,56,40,0.14)', gold: '#C9A646' },
  dark: { head: '#7FA98C', handle: '#9CC0A6', track: 'rgba(255,255,255,0.16)', gold: '#E4C76B' },
} as const;

function LoaderBase({
  size = 44,
  tone = 'light',
  label = 'Loading',
  className,
  style,
}: LoaderProps) {
  const c = TONE[tone];
  // A thin ring vanishes at inline sizes and shouts at 120px: tie its stroke
  // to the box (in viewBox units of 80).
  const stroke = size < 28 ? 6 : size < 48 ? 4 : 3;

  return (
    <span
      role="status"
      aria-live="polite"
      // The SVG is aria-hidden and nothing inside this element ever changes,
      // so the live region announces exactly once when it is inserted.
      aria-label={label}
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, ...style }}
    >
      <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden className={styles.svg}>
        <circle cx="40" cy="40" r="35" fill="none" stroke={c.track} strokeWidth={stroke} />
        <g className={styles.trail}>
          <path d="M40 5 A35 35 0 0 1 75 40" fill="none" stroke={c.gold} strokeWidth={stroke} strokeLinecap="round" />
        </g>
        <g className={styles.gavel}>
          <rect x="22" y="20" width="36" height="15" rx="4.5" fill={c.head} />
          <rect x="26" y="18" width="5" height="19" rx="2" fill={c.gold} />
          <rect x="49" y="18" width="5" height="19" rx="2" fill={c.gold} />
          <rect x="37.5" y="34" width="5" height="28" rx="2.5" fill={c.handle} />
        </g>
      </svg>
    </span>
  );
}

/** Identical props never re-render the DOM, so the live region stays quiet. */
const Loader = memo(LoaderBase);
Loader.displayName = 'Loader';

export default Loader;
