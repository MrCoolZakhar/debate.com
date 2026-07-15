'use client';

/**
 * DecorativeBleed — a scatter of large, low-opacity, thin-stroke lucide icons
 * that bleed off the edges of a container to sit BEHIND the real content (the
 * faded "stars and semicircle" depth touch first used on the account profile
 * page). Purely decorative: every icon is aria-hidden, pointer-events-none, and
 * sits on a low/negative z-index so it never intercepts clicks.
 *
 * Usage:
 *   <div className="relative" style={{ overflowX: 'clip' }}>
 *     <DecorativeBleed items={[
 *       { Icon: Globe2, size: 160, top: '-40px', right: '-20px' },
 *       { Icon: Sparkles, size: 120, bottom: '-30px', left: '-16px', opacity: 0.045 },
 *     ]} />
 *     <div className="relative" style={{ zIndex: 1 }}>…real content…</div>
 *   </div>
 *
 * The parent MUST be positioned (relative/absolute) and should either clip the
 * horizontal axis (overflow-x: clip/hidden) or keep offsets small so the bleed
 * never forces a horizontal scrollbar. When the surrounding content is not
 * itself z-indexed, mount with zIndex={-1} on a container that establishes a
 * stacking context (e.g. isolation: 'isolate') so the icons tuck cleanly behind.
 */

import type { LucideIcon } from 'lucide-react';

export interface DecorativeBleedItem {
  /** A lucide icon component, e.g. Globe2, Gavel, Trophy. */
  Icon: LucideIcon;
  /** Rendered pixel size. Big by design — typically 110–170. */
  size?: number;
  top?: string | number;
  bottom?: string | number;
  left?: string | number;
  right?: string | number;
  /** Forest-ink alpha when no explicit `color` is given. Default 0.05. */
  opacity?: number;
  /** Thin by design. Default 1. */
  strokeWidth?: number;
  /** Optional rotation in degrees. */
  rotate?: number;
  /**
   * Full colour override (use on dark surfaces, e.g.
   * 'rgba(238,217,138,0.1)' for a gold ghost). When set, `opacity` is ignored.
   */
  color?: string;
}

/** The house forest ink the profile-page bleeds are tinted with. */
const FOREST_INK = '27,56,40';

export default function DecorativeBleed({
  items,
  zIndex = 0,
}: {
  items: DecorativeBleedItem[];
  /** Stacking level for every icon. Default 0 (content sits above at z ≥ 1). */
  zIndex?: number;
}) {
  return (
    <>
      {items.map((item, i) => {
        const {
          Icon,
          size = 150,
          opacity = 0.05,
          strokeWidth = 1,
          top,
          bottom,
          left,
          right,
          rotate,
          color,
        } = item;

        const style: React.CSSProperties = {
          color: color ?? `rgba(${FOREST_INK},${opacity})`,
          zIndex,
        };
        if (top !== undefined) style.top = top;
        if (bottom !== undefined) style.bottom = bottom;
        if (left !== undefined) style.left = left;
        if (right !== undefined) style.right = right;
        if (rotate !== undefined) style.transform = `rotate(${rotate}deg)`;

        return (
          <Icon
            key={i}
            aria-hidden
            size={size}
            strokeWidth={strokeWidth}
            className="pointer-events-none absolute"
            style={style}
          />
        );
      })}
    </>
  );
}
