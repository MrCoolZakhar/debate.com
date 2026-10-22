'use client';

// ─────────────────────────────────────────────────────────────────────────────
// PartnerOrbit: a conference's partners as small circles on the rim of its
// round logo (owner, 21 Oct 2026, approved from a mockup).
//
// Wrap the logo with it: the wrapper is a `relative` box exactly the logo's
// size, the logo renders inside as `children` untouched, and every circle is
// absolutely positioned, so nothing in the layout moves.
//
//   • Each circle is CENTRED on the logo's circumference. The first sits at the
//     top right (-60 degrees, 0 = three o'clock, y down) and the rest follow
//     clockwise 30 degrees apart, curving round and down the right side.
//   • Featured partners first, then the organiser's order (`orderPartners`).
//   • At most `maxSlots` circles; with more partners the last slot is a "+N"
//     circle that opens the full list.
//   • Each circle is the partner's logo through `LogoDisc` (initials when there
//     is none) inside a white ring, so it reads over the logo and the banner;
//     the name is its accessible label and its hover title. A click opens the
//     shared `PartnerPopup` (ConferencePartners.tsx): Portal, fixed, flipped
//     near edges, never clipped.
//   • Entrance: scale from 0.85 with a small stagger; hover lifts 2px; both
//     off under prefers-reduced-motion.
//
// Space is the caller's job: circles reach `dot / 2` past the logo's edge, so
// the caller leaves that much room round the logo (the conference header keeps
// a 28px gap to the title from sm up and uses 9 slots; phones use a smaller
// logo on its own row and 6 slots).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type CSSProperties, type ReactNode } from 'react';
import { LogoDisc } from '@/components/LogoDisc';
import { orderPartners, PartnerPopup, type PartnerEntry } from '@/components/ConferencePartners';

const START_DEG = -60;
const STEP_DEG = 30;
const RING = 2;

const ORBIT_CSS = `
.gv-orbit-dot {
  position: absolute;
  z-index: 31;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 9999px;
  background: #FFFFFF;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.28);
  transition: transform 220ms cubic-bezier(0.22,1,0.36,1), box-shadow 220ms cubic-bezier(0.22,1,0.36,1);
  animation: gvOrbitIn 420ms cubic-bezier(0.22,1,0.36,1) backwards;
}
.gv-orbit-dot:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0,0,0,0.32); }
.gv-orbit-dot:focus-visible { box-shadow: 0 0 0 3px var(--gv-accent), 0 4px 12px rgba(0,0,0,0.28); }
@keyframes gvOrbitIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .gv-orbit-dot { animation: none; transition: none; }
  .gv-orbit-dot:hover { transform: none; }
}
`;

export default function PartnerOrbit({
  partners, size, dot, maxSlots, children, className, style,
}: {
  partners: PartnerEntry[];
  /** The logo's diameter in px; the wrapper is this square. */
  size: number;
  /** Each partner circle's diameter in px, white ring included. */
  dot: number;
  /** Most circles drawn; beyond it the last one becomes "+N". */
  maxSlots: number;
  /** The logo itself (and anything that sits on it, like an edit pencil). */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState<{ key: string; startWith: PartnerEntry | null; anchor: HTMLElement } | null>(null);

  const ordered = orderPartners(partners);
  const shown = ordered.length > maxSlots ? ordered.slice(0, Math.max(0, maxSlots - 1)) : ordered;
  const extra = ordered.length - shown.length;

  // A partner can disappear under an open popup (the page refetches). Derive
  // the live state instead of syncing it in an effect.
  const active = open && (open.startWith === null ? extra > 0 : ordered.some(p => p.id === open.startWith!.id)) ? open : null;

  const r = size / 2;
  // The circles' centres sit a little OUTSIDE the logo's rim (owner, 22 Oct
  // 2026: "it covers the logo too much"): about a third of a circle out, so
  // each still crosses the border but hides far less of the logo.
  const orbit = r + dot * 0.34;
  const at = (i: number): CSSProperties => {
    const a = ((START_DEG + STEP_DEG * i) * Math.PI) / 180;
    return {
      left: r + orbit * Math.cos(a) - dot / 2,
      top: r + orbit * Math.sin(a) - dot / 2,
      width: dot,
      height: dot,
      animationDelay: `${120 + i * 45}ms`,
    };
  };

  const toggle = (key: string, startWith: PartnerEntry | null, el: HTMLElement) =>
    setOpen(prev => (prev?.key === key ? null : { key, startWith, anchor: el }));

  return (
    <div className={`relative ${className ?? ''}`} style={{ width: size, height: size, ...style }}>
      {children}

      {ordered.length > 0 && (
        <>
          <style>{ORBIT_CSS}</style>
          {shown.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="gv-orbit-dot focus:outline-none"
              style={at(i)}
              aria-label={p.name}
              title={p.name}
              aria-haspopup="dialog"
              aria-expanded={active?.key === p.id}
              onClick={(e) => toggle(p.id, p, e.currentTarget)}
            >
              <LogoDisc src={p.logoUrl} alt="" size={dot - RING * 2} fallbackText={p.name.slice(0, 3)} />
            </button>
          ))}
          {extra > 0 && (
            <button
              type="button"
              className="gv-orbit-dot focus:outline-none"
              style={at(shown.length)}
              aria-label={`See all ${ordered.length} partners`}
              title="See all partners"
              aria-haspopup="dialog"
              aria-expanded={active?.key === '+'}
              onClick={(e) => toggle('+', null, e.currentTarget)}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: dot - RING * 2,
                  height: dot - RING * 2,
                  borderRadius: 9999,
                  backgroundColor: 'var(--gv-main)',
                  color: 'var(--gv-on-main)',
                  fontFamily: 'var(--font-brand), sans-serif',
                  fontWeight: 800,
                  fontSize: Math.max(9, Math.round(dot * 0.32)),
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                +{extra}
              </span>
            </button>
          )}
        </>
      )}

      {active && (
        <PartnerPopup
          key={active.key}
          entries={ordered}
          startWith={active.startWith}
          anchor={active.anchor}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
