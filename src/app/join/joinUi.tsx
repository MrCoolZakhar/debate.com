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

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Gavel } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';

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
// `lg` it is a tall sticky panel beside it.
//
// Redesigned 24 Sep 2026 (owner: "looks way too AI generated"). No eyebrow, no
// icon-tile bullets, no sticker art. Before a code resolves it is one big line
// and one short sentence. Once a code resolves it leads with the ROOM: the
// committee's round emblem, its acronym huge with the spelled name small under
// it, the topic, then plain facts read from the lookup that already happened
// (state, delegations present as numerals and round flags, who is on the dais).
// A conference room adds one small line on top: the conference's round logo and
// its name. The only ornament is a faint emboss of the Gavelling mark.

export interface BrandRoom {
  acronym: string;
  /** The spelled-out name, only when it differs from the acronym. */
  spelled: string | null;
  topic: string | null;
  emblemUrl: string | null;
  /** Conference rooms only: "LIMUN 2027 · London International Model United Nations". */
  conference: { label: string; logoUrl: string | null } | null;
  state: { label: string; tone: 'live' | 'waiting' | 'paused' | 'ended' };
  present: { count: number; ofLabel: string; seats: { country: string; logoUrl: string | null }[] };
  dais: { label: string; names: string } | null;
}

// The delegate view on a phone, tilted, transparent PNG-style webp (1080 x 1350; the
// phone itself spans x 182..842, y 97..1238). From lg it overlaps the panel's bottom
// inline-end corner and hangs out over the empty page below it; the panel keeps that
// corner free (lg bottom padding). Below lg it is not drawn, and a <picture> with a
// media source means a phone never downloads it either.
const PHONE_SRC = '/join/phone-delegate.webp';
const PHONE_W = 240;
const PHONE_H = 300;
// Only where the sticky panel plus the phone's overhang fit a laptop screen.
const PHONE_MEDIA = '(min-width: 1024px) and (min-height: 760px)';
const PHONE_CSS = `.gv-join-phone{display:none}@media ${PHONE_MEDIA}{.gv-join-phone{display:block}.gv-phone-room{padding-bottom:124px}}`;
const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Decorative: the card beside it is the real interface. */
function PhoneMockup() {
  return (
    <picture
      className="gv-join-phone pointer-events-none absolute z-10"
      style={{ insetInlineEnd: -66, bottom: -92, width: PHONE_W, height: PHONE_H }}
    >
      <source media={PHONE_MEDIA} srcSet={PHONE_SRC} />
      <img
        src={BLANK_GIF}
        alt=""
        width={PHONE_W}
        height={PHONE_H}
        loading="eager"
        decoding="async"
        className="h-full w-full object-contain"
        style={{ filter: 'drop-shadow(0 18px 22px rgba(27,56,40,0.30)) drop-shadow(0 4px 6px rgba(27,56,40,0.22))' }}
      />
    </picture>
  );
}

const STATE_DOT: Record<BrandRoom['state']['tone'], string> = {
  live: '#7FD39A',
  waiting: C.gold,
  paused: '#E8B27A',
  ended: 'rgba(237,231,216,0.45)',
};

function RoomEmblem({ url, acronym, size }: { url: string | null; acronym: string; size: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = url && failed !== url ? url : null;
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size, height: size,
        backgroundColor: src ? '#FFFDF8' : C.forestLift,
        // Neumorphic lift on forest, with a solid gold edge rather than a glow.
        boxShadow: `inset 0 0 0 2px ${C.gold}, inset 0 -3px 6px rgba(27,56,40,0.18), 0 10px 22px rgba(0,0,0,0.30)`,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(src)} style={{ width: '68%', height: '68%', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontFamily: OUTFIT, fontSize: size * (acronym.length > 4 ? 0.2 : 0.26), fontWeight: 900, color: C.gold, letterSpacing: '0.02em' }}>
          {acronym.slice(0, 6).toUpperCase()}
        </span>
      )}
    </span>
  );
}

const SOFT = 'rgba(237,231,216,0.74)';
const FLAGS_SHOWN = 7;

export function BrandPanel({ title, accent, sub, room, footer }: {
  title: string;
  accent: string;
  sub: string;
  room: BrandRoom | null;
  footer?: ReactNode;
}) {
  return (
    <div className="relative">
    <style>{PHONE_CSS}</style>
    <section
      className="relative overflow-hidden"
      style={{
        borderRadius: 28,
        backgroundColor: C.forest,
        backgroundImage: 'radial-gradient(420px 320px at 0% 100%, rgba(61,122,82,0.40) 0%, rgba(61,122,82,0) 65%)',
        boxShadow: `${SHADOW.panel}, inset 0 0 0 1px rgba(238,217,138,0.16)`,
        color: C.page,
      }}
    >
      {/* lg:pb keeps the bottom inline-end corner free for the phone. */}
      <div className="relative px-6 py-7 sm:px-8 sm:py-9 gv-phone-room">
        {room ? <RoomBrand room={room} /> : (
          <h1
            style={{
              fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1,
              fontSize: 'clamp(34px, 7vw, 52px)', margin: 0, textWrap: 'balance',
            }}
          >
            {title}
            <span
              className="block"
              style={{ fontFamily: PLAYFAIR, fontStyle: 'italic', fontWeight: 400, color: C.gold, letterSpacing: '0', marginTop: 4 }}
            >
              {accent}
            </span>
          </h1>
        )}
        {!room && (
          <p className="mt-4 max-w-[300px]" style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.55, color: SOFT, textWrap: 'pretty' }}>
            {sub}
          </p>
        )}

        {footer && <div className="mt-7 hidden lg:block">{footer}</div>}
      </div>
    </section>
    <PhoneMockup />
    </div>
  );
}

function RoomBrand({ room }: { room: BrandRoom }) {
  const extra = room.present.seats.length - FLAGS_SHOWN;
  return (
    <div>
      {room.conference && (
        <div className="mb-4 flex min-w-0 items-center gap-2.5">
          {room.conference.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={room.conference.logoUrl}
              alt=""
              className="flex-shrink-0 rounded-full object-contain"
              style={{ width: 26, height: 26, backgroundColor: '#FFFDF8', padding: 2, boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.08)` }}
            />
          )}
          <p className="min-w-0 line-clamp-2" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, color: SOFT, textWrap: 'balance' }} title={room.conference.label}>
            {room.conference.label}
          </p>
        </div>
      )}

      {/* Phone: emblem beside the name. lg: emblem above, the acronym at full size. */}
      <div className="flex items-center gap-4 lg:gap-5">
        <span className="lg:hidden"><RoomEmblem url={room.emblemUrl} acronym={room.acronym} size={56} /></span>
        <span className="hidden lg:block"><RoomEmblem url={room.emblemUrl} acronym={room.acronym} size={76} /></span>
        <div className="min-w-0">
          <h1
            className="truncate"
            style={{
              fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 0.98, margin: 0,
              fontSize: room.acronym.length > 8 ? 'clamp(28px, 7vw, 40px)' : 'clamp(38px, 10vw, 64px)',
            }}
          >
            {room.acronym}
          </h1>
          {room.spelled && (
            <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 13.5, lineHeight: 1.35, color: SOFT, textWrap: 'balance' }}>
              {room.spelled}
            </p>
          )}
        </div>
      </div>

      {room.topic && (
        <p
          className="mt-4 truncate"
          title={room.topic}
          style={{ fontFamily: PLAYFAIR, fontStyle: 'italic', fontSize: 16, lineHeight: 1.35, color: C.gold }}
        >
          {room.topic}
        </p>
      )}

      {/* The facts. Plain type, no pills, no tiles. */}
      <div className="mt-5 flex items-center gap-2 lg:mt-6" style={{ fontFamily: OUTFIT }}>
        <span aria-hidden className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: STATE_DOT[room.state.tone] }} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.01em', color: C.page }}>{room.state.label}</span>
        {/* Phone: the count shares the state's line. */}
        <span className="lg:hidden" style={{ fontSize: 13, color: SOFT }}>
          <span aria-hidden> · </span>
          <span style={{ fontWeight: 700, color: C.page, fontVariantNumeric: 'tabular-nums' }}>{room.present.count}</span> {room.present.ofLabel}
        </span>
      </div>

      <div className="mt-4 hidden lg:block">
        <p style={{ fontFamily: OUTFIT, color: SOFT, fontSize: 14 }}>
          <span style={{ fontSize: 44, fontWeight: 800, color: C.page, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {room.present.count}
          </span>
          <span className="ms-2">{room.present.ofLabel}</span>
        </p>
        {room.present.seats.length > 0 && (
          <div className="mt-3 flex items-center">
            {room.present.seats.slice(0, FLAGS_SHOWN).map((s, i) => (
              <CircleFlag
                key={s.country}
                country={s.country}
                logoUrl={s.logoUrl}
                size={30}
                title={s.country}
                decorative
                style={{ marginInlineStart: i === 0 ? 0 : -8, boxShadow: `0 0 0 2px ${C.forest}` }}
              />
            ))}
            {extra > 0 && (
              <span className="ms-2" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
                +{extra}
              </span>
            )}
          </div>
        )}
      </div>

      {room.dais && (
        <p className="mt-5 hidden items-center gap-2 lg:flex" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: SOFT }}>
          <Gavel aria-hidden size={15} strokeWidth={2.2} style={{ color: C.gold, flexShrink: 0 }} />
          <span className="sr-only">{room.dais.label}: </span>
          <span className="min-w-0 truncate" title={room.dais.names} style={{ color: C.page, fontWeight: 600 }}>{room.dais.names}</span>
        </p>
      )}
    </div>
  );
}

// ── Card + slots ─────────────────────────────────────────────────────────────
export function JoinCard({ children }: { children: ReactNode }) {
  return (
    <section
      // overflow: clip, not hidden: `hidden` makes the card a scroll container, which
      // would pin the phone's sticky Join bar to the card instead of the screen.
      className="relative overflow-clip"
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
