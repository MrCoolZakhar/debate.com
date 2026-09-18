'use client';

// ── GlassToast ─────────────────────────────────────────────────────────────
//
// A single, non-actionable banner in the same glass as `NotificationStack`, for the
// one session toast that does not go through the store: the chair page's gavel
// handover notice. It stays outside the store on purpose (it must not be held back
// while a speaker's clock runs, and it must not push itself down the way the stack
// pushes the GavelChip), so it only borrows the look.
//
// Positioning is the caller's: pass `top` / `right` (or logical insets) in `style`.
// The component is fixed, animates in on mount with the stack's spring, and honours
// prefers-reduced-motion.

import type { CSSProperties } from 'react';
import { Gavel } from 'lucide-react';
import { GLASS, glassFallbackCss, SPRING_BEZIER, SPRING_LINEAR } from './glass';

const OUTFIT = "'Outfit', sans-serif";

const SEAT = {
  gained: { bg: 'linear-gradient(160deg, #3D7A52 0%, #1B3828 100%)', ink: '#EED98A' },
  lost: { bg: 'linear-gradient(160deg, #C99A62 0%, #8A5A2E 100%)', ink: '#FAF8F3' },
} as const;

export default function GlassToast({
  tone,
  text,
  style,
}: {
  tone: 'gained' | 'lost';
  text: string;
  style?: CSSProperties;
}) {
  const seat = SEAT[tone];
  return (
    <div
      role="status"
      aria-live="polite"
      className="dgt-toast"
      style={{
        position: 'fixed', zIndex: 50, maxWidth: '19rem',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px 8px 8px',
        borderRadius: GLASS.radius,
        background: GLASS.fill,
        backdropFilter: GLASS.blur,
        WebkitBackdropFilter: GLASS.blur,
        border: GLASS.border,
        boxShadow: GLASS.shadow,
        color: GLASS.ink,
        fontFamily: OUTFIT,
        ...style,
      }}
    >
      <style>{`
        @keyframes dgt-in {
          from { opacity: 0; transform: translate3d(0, -14px, 0) scale(0.95) }
          to   { opacity: 1; transform: none }
        }
        .dgt-toast {
          animation: dgt-in 520ms ${SPRING_BEZIER} both;
          animation-timing-function: ${SPRING_LINEAR};
          transition: top 240ms cubic-bezier(0.22,1,0.36,1);
          -webkit-font-smoothing: antialiased;
        }
        ${glassFallbackCss('.dgt-toast')}
        @media (prefers-reduced-motion: reduce) {
          .dgt-toast { animation: none; transition: none }
        }
      `}</style>
      <span
        aria-hidden="true"
        style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          display: 'grid', placeItems: 'center', background: seat.bg, color: seat.ink,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.26), 0 1px 3px rgba(27,56,40,0.22)',
        }}
      >
        <Gavel size={15} strokeWidth={2.3} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{text}</span>
    </div>
  );
}
