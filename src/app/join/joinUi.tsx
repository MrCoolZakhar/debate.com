'use client';

// ─────────────────────────────────────────────────────────────────────────────
// joinUi — the visual kit for /join, and nothing else.
//
// WHY IT EXISTS. The join page is the first Gavelling surface most delegates
// ever see, and it used to be a single ivory column of inputs that grew and
// shrank at every step (it was wrapped in FitToScreen, so the WHOLE page
// re-scaled as content appeared: type a code and the type got smaller).
// The rebuild keeps every behaviour and changes the shell:
//
//   • a two-column stage on desktop (brand panel + join card), one column on a
//     phone, which is the primary layout;
//   • FIXED SLOTS in the card, so the code step, the role step and the seat
//     step all occupy the same box. Nothing below moves when a message or a
//     committee card appears;
//   • the house palette used with confidence: ivory page, forest panel, gold
//     accents, and the conference's own artwork when the code belongs to one.
//
// Everything here is presentational. No data fetching, no routing, no state
// that outlives a hover.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties, ReactNode } from 'react';

export const OUTFIT = "'Outfit', sans-serif";
export const PLAYFAIR = "'Playfair Display', serif";

/** The palette from CLAUDE.md §8. `muted` is decorative only: never body text. */
export const C = {
  page: '#EDE7D8',
  surface: '#FAF8F3',
  surfaceAlt: '#F0EBDD',
  forest: '#1B3828',
  forestLift: '#2A5A3C',
  moss: '#3D7A52',
  gold: '#EED98A',
  goldDeep: '#B6871F',
  amber: '#B8844A',
  ink: '#1C1410',
  inkSoft: '#544B3E',
  muted: '#8A7C6B',
  danger: '#8B2020',
  line: 'rgba(27,56,40,0.12)',
} as const;

/** Forest-tinted, never neutral (CLAUDE.md §8). */
export const SHADOW = {
  card: '0 1px 2px rgba(27,56,40,0.06), 0 14px 36px rgba(27,56,40,0.10)',
  inset: 'inset 0 1px 2px rgba(27,56,40,0.07)',
  panel: '0 2px 6px rgba(27,56,40,0.10), 0 24px 60px rgba(27,56,40,0.20)',
} as const;

// ── Page backdrop ────────────────────────────────────────────────────────────
// Grain (the same fractal-noise tile the rest of the sessions side uses) plus
// two very soft colour fields, so the ivory is not a flat sheet of beige.
const GRAIN =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

export function PageBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(900px 520px at 12% -6%, rgba(61,122,82,0.16) 0%, rgba(61,122,82,0) 62%),' +
            'radial-gradient(760px 480px at 96% 4%, rgba(238,217,138,0.30) 0%, rgba(238,217,138,0) 60%),' +
            'radial-gradient(1000px 620px at 50% 108%, rgba(27,56,40,0.10) 0%, rgba(27,56,40,0) 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.16,
        }}
      />
    </>
  );
}

// ── Small type ───────────────────────────────────────────────────────────────
export function Eyebrow({ children, tone = 'ink', style }: {
  children: ReactNode;
  tone?: 'ink' | 'gold' | 'forest';
  style?: CSSProperties;
}) {
  const color = tone === 'gold' ? 'rgba(238,217,138,0.82)' : tone === 'forest' ? C.forest : C.muted;
  return (
    <p
      className="uppercase"
      style={{
        fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.20em',
        color, margin: 0, ...style,
      }}
    >
      {children}
    </p>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block uppercase"
      style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: C.inkSoft, marginBottom: 8 }}
    >
      {children}
    </label>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────────────
export type ChipTone = 'neutral' | 'gold' | 'green' | 'muted' | 'danger' | 'forest';

const CHIP_TONES: Record<ChipTone, { bg: string; fg: string; ring: string }> = {
  neutral: { bg: 'rgba(27,56,40,0.06)', fg: C.inkSoft, ring: 'rgba(27,56,40,0.10)' },
  gold: { bg: 'rgba(238,217,138,0.40)', fg: '#6B4E08', ring: 'rgba(182,135,31,0.35)' },
  green: { bg: 'rgba(61,122,82,0.14)', fg: '#1F5333', ring: 'rgba(61,122,82,0.32)' },
  muted: { bg: 'rgba(27,56,40,0.05)', fg: C.muted, ring: 'rgba(27,56,40,0.08)' },
  danger: { bg: 'rgba(139,32,32,0.08)', fg: C.danger, ring: 'rgba(139,32,32,0.22)' },
  forest: { bg: C.forest, fg: C.gold, ring: 'rgba(238,217,138,0.28)' },
};

export function Chip({ tone = 'neutral', icon, children, title, style }: {
  tone?: ChipTone;
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
  style?: CSSProperties;
}) {
  const t = CHIP_TONES[tone];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{
        fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
        color: t.fg, backgroundColor: t.bg, boxShadow: `inset 0 0 0 1px ${t.ring}`,
        borderRadius: 999, padding: '3px 9px', lineHeight: 1.45, ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

// ── The message rail ─────────────────────────────────────────────────────────
// One fixed-height line under the code field. It ALWAYS occupies its box, so an
// error, a spinner or the resting hint never push the card around.
export function MessageRail({ tone = 'hint', icon, children, action, minHeight = 42 }: {
  tone?: 'hint' | 'error' | 'busy' | 'good';
  icon?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  minHeight?: number;
}) {
  const color = tone === 'error' ? C.danger : tone === 'good' ? '#1F5333' : tone === 'busy' ? C.forest : C.muted;
  const bg = tone === 'error' ? 'rgba(139,32,32,0.06)' : tone === 'good' ? 'rgba(61,122,82,0.09)' : 'transparent';
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="flex items-center gap-2 rounded-xl px-3"
      style={{
        minHeight, backgroundColor: bg,
        fontFamily: OUTFIT, fontSize: 12.5, fontWeight: tone === 'hint' ? 500 : 600, color,
        textWrap: 'pretty', lineHeight: 1.4,
      }}
    >
      {children ? (
        <>
          <span className="flex-shrink-0 flex items-center" style={{ color }}>{icon}</span>
          <span className="min-w-0 flex-1">{children}</span>
          {action}
        </>
      ) : null}
    </div>
  );
}

// ── Role tile ────────────────────────────────────────────────────────────────
// Forest tiles with a Lucide icon, the role name and one line of copy. Active
// gets the gold rim and a lifted shadow; the press scale is 0.96 (skill rule 12).
export function RoleTile({ icon, label, desc, active, onClick }: {
  icon: ReactNode;
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="group relative flex h-full w-full flex-col items-center gap-1 overflow-hidden text-center focus:outline-none active:scale-[0.96] sm:items-start sm:text-start"
      style={{
        padding: '11px 10px 12px',
        borderRadius: 18,
        backgroundColor: active ? C.forest : 'rgba(27,56,40,0.055)',
        boxShadow: active
          ? `inset 0 0 0 2px ${C.gold}, 0 2px 6px rgba(27,56,40,0.14), 0 14px 30px rgba(27,56,40,0.22)`
          : 'inset 0 0 0 1px rgba(27,56,40,0.10)',
        transitionProperty: 'background-color, box-shadow, transform, color',
        transitionDuration: '180ms',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 30, height: 30, borderRadius: 10, marginBottom: 2,
          backgroundColor: active ? 'rgba(238,217,138,0.16)' : 'rgba(27,56,40,0.07)',
          color: active ? C.gold : C.forest,
          transitionProperty: 'background-color, color', transitionDuration: '180ms',
        }}
      >
        {icon}
      </span>
      <span
        style={{
          fontFamily: OUTFIT, fontSize: 'clamp(11.5px, 3.2vw, 13.5px)', fontWeight: 800, letterSpacing: '0.01em',
          color: active ? C.gold : C.forest, lineHeight: 1.2, textWrap: 'balance',
        }}
      >
        {label}
      </span>
      <span
        className="hidden sm:block"
        style={{
          fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 500, lineHeight: 1.35,
          color: active ? 'rgba(237,231,216,0.78)' : C.inkSoft, textWrap: 'pretty',
        }}
      >
        {desc}
      </span>
    </button>
  );
}

// ── Brand panel ──────────────────────────────────────────────────────────────
// The colour on the page. On a phone it is a short band above the card; from
// `lg` it is a tall sticky panel beside it. When the code belongs to a
// conference the panel wears that conference's artwork and name instead of the
// house lockup — the one place the conference theme is allowed to take over.
export function BrandPanel({
  title, accent, sub, bullets, conference, footer,
}: {
  title: string;
  accent: string;
  sub: string;
  bullets: { icon: ReactNode; text: string }[];
  conference: { name: string; committee: string | null; logoUrl: string | null; eyebrow: string } | null;
  footer?: ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        borderRadius: 28,
        backgroundColor: C.forest,
        backgroundImage:
          'radial-gradient(520px 320px at 88% 0%, rgba(238,217,138,0.20) 0%, rgba(238,217,138,0) 62%),' +
          'radial-gradient(420px 320px at 0% 100%, rgba(61,122,82,0.45) 0%, rgba(61,122,82,0) 65%)',
        boxShadow: SHADOW.panel,
        color: C.page,
      }}
    >
      {/* The brand mark: gavel + laurel, the existing art, floated large and
          soft-edged so it reads as a watermark rather than a sticker. */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ insetInlineEnd: -34, top: -26, width: 176, height: 176, opacity: 0.38 }}
      >
        <span
          className="absolute"
          style={{
            inset: -30,
            background: 'radial-gradient(circle at 50% 45%, rgba(238,217,138,0.28) 0%, rgba(238,217,138,0) 68%)',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/gavel-mark.png"
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          style={{ filter: 'drop-shadow(0 10px 22px rgba(0,0,0,0.35))' }}
        />
      </div>

      <div className="relative px-6 py-7 sm:px-8 sm:py-9">
        {conference ? (
          <div className="flex items-center gap-3.5">
            <span
              className="flex flex-shrink-0 items-center justify-center overflow-hidden"
              style={{
                width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(237,231,216,0.94)',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10), 0 6px 14px rgba(0,0,0,0.28)',
              }}
            >
              {conference.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={conference.logoUrl} alt="" className="h-full w-full object-contain" style={{ padding: 6 }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/gavel-mark.png" alt="" className="h-full w-full object-contain" style={{ padding: 8 }} />
              )}
            </span>
            <div className="min-w-0">
              <Eyebrow tone="gold">{conference.eyebrow}</Eyebrow>
              <p
                className="mt-1"
                style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.2, textWrap: 'balance' }}
              >
                {conference.name}
              </p>
              {conference.committee && (
                <p style={{ fontFamily: OUTFIT, fontSize: 13, color: 'rgba(237,231,216,0.72)', marginTop: 2 }}>
                  {conference.committee}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-[300px]">
            <h1
              style={{
                fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.02,
                fontSize: 'clamp(30px, 6vw, 42px)', margin: 0, textWrap: 'balance',
              }}
            >
              {title}
              <span
                className="block"
                style={{ fontFamily: PLAYFAIR, fontStyle: 'italic', fontWeight: 400, color: C.gold, letterSpacing: '0', marginTop: 2 }}
              >
                {accent}
              </span>
            </h1>
            <p
              className="mt-3"
              style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.55, color: 'rgba(237,231,216,0.80)', textWrap: 'pretty' }}
            >
              {sub}
            </p>
          </div>
        )}

        {bullets.length > 0 && (
          <ul className="mt-6 hidden space-y-3 lg:block">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-[1px] flex flex-shrink-0 items-center justify-center"
                  style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: 'rgba(238,217,138,0.14)', color: C.gold }}
                >
                  {b.icon}
                </span>
                <span style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.5, color: 'rgba(237,231,216,0.86)', textWrap: 'pretty' }}>
                  {b.text}
                </span>
              </li>
            ))}
          </ul>
        )}

        {footer && <div className="mt-6 hidden lg:block">{footer}</div>}
      </div>
    </section>
  );
}

// ── Card + slots ─────────────────────────────────────────────────────────────
export function JoinCard({ children }: { children: ReactNode }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        borderRadius: 28,
        backgroundColor: C.surface,
        boxShadow: `${SHADOW.card}, inset 0 0 0 1px rgba(27,56,40,0.07)`,
      }}
    >
      {/* Gold hairline along the top edge: the card's only ornament. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0"
        style={{ height: 3, background: `linear-gradient(90deg, ${C.gold} 0%, rgba(182,135,31,0.55) 40%, rgba(27,56,40,0.18) 100%)` }}
      />
      <div className="px-5 pb-6 pt-7 sm:px-7 sm:pb-7">{children}</div>
    </section>
  );
}

/** A slot that always takes its space, so steps swap without the page moving. */
export function Slot({ minHeight, children, className = '' }: { minHeight: number; children: ReactNode; className?: string }) {
  return <div className={className} style={{ minHeight }}>{children}</div>;
}

// ── Primary action ───────────────────────────────────────────────────────────
export function PrimaryAction({ children, onClick, disabled, icon }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="gv-lift flex w-full items-center justify-center gap-2 focus:outline-none active:scale-[0.96]"
      style={{
        height: 54, borderRadius: 18, border: 'none',
        backgroundColor: disabled ? 'rgba(27,56,40,0.10)' : C.forest,
        color: disabled ? C.muted : C.gold,
        fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, letterSpacing: '0.04em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transitionProperty: 'background-color, color, box-shadow, transform',
        transitionDuration: '180ms',
      }}
    >
      {children}
      {icon}
    </button>
  );
}

/** The quiet button: sign in, retry, switch account. */
export function GhostAction({ children, onClick, icon, tone = 'forest' }: {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
  tone?: 'forest' | 'gold';
}) {
  const gold = tone === 'gold';
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 focus:outline-none active:scale-[0.96]"
      style={{
        minHeight: 40, padding: '8px 14px', borderRadius: 12,
        backgroundColor: gold ? 'rgba(238,217,138,0.16)' : 'rgba(27,56,40,0.06)',
        boxShadow: `inset 0 0 0 1px ${gold ? 'rgba(238,217,138,0.34)' : 'rgba(27,56,40,0.12)'}`,
        color: gold ? C.gold : C.forest,
        fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.02em',
        transitionProperty: 'background-color, box-shadow, transform', transitionDuration: '160ms',
      }}
    >
      {icon}
      {children}
    </button>
  );
}
