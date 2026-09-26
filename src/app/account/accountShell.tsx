'use client';

// The /account look (26 Sep 2026, owner: "the entire profile section is quite
// boring and not easily lookable. I like the cards over and perhaps there can
// be a side nav bar").
//
// Every account page is built from the same four pieces:
//
//   <AccountHero>   a soft white band at the top of the page: a small capitals
//                   label, a heavy sans title whose LAST word is the gold
//                   Playfair italic (GoldWord), at most one short line, and a
//                   large 3D emoji resting on the right. It ends in extra
//                   bottom padding on purpose, because
//   <HeroOverlap>   pulls the page's first cards UP over that lower edge, so
//                   the cards float over the band (the "cards over" look).
//   <RaisedCard>    the soft 3D card the owner loves: white, a light top-left
//                   highlight, a forest-tinted drop to the bottom-right and a
//                   hairline, like the organiser dashboard's bento tiles.
//   <StatBlock>     a count as a BIG number with its word beside it (never a
//                   pill), with a 3D emoji in a soft tinted disc.
//
// Plus the buttons (`gv-acct-btn` forest gradient, sentence case, the Airbnb
// rounded rectangle; `gv-acct-btn2` the ink outline for a second action), the
// soft round rimmed disc (`gv-acct-rim`) and `DuoIcon`, a Lucide glyph drawn as
// a forest line over a gold fill (duotone, taste board two).
//
// Palette: ivory and white grounds only; forest is the accent (text, the main
// button, a small mark), gold the highlight. No forest bands or forest cards.

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { OUTFIT, T, W } from './accountUi';

export const FOREST = '#1B3828';
export const FOREST_MID = '#2A5A3C';
export const GOLD = '#EED98A';
export const DEEP_GOLD = '#B6871F';
export const INK = '#1C1410';
export const INK_SOFT = '#5A5046';
export const RULE = '#DDD4C0';
export const IVORY = '#FAF8F3';

/** The raised card's shadow: highlight up-left, forest-tinted drop down-right. */
export const RAISED =
  '0 0 0 1px rgba(27,56,40,0.07), -6px -6px 16px rgba(255,255,255,0.75), 8px 12px 28px -6px rgba(27,56,40,0.18), 0 2px 4px rgba(27,56,40,0.05)';
export const RAISED_HOVER =
  '0 0 0 1px rgba(27,56,40,0.09), -6px -6px 16px rgba(255,255,255,0.8), 12px 18px 36px -8px rgba(27,56,40,0.24), 0 3px 6px rgba(27,56,40,0.06)';
/** A pressed-in well (inputs, tracks). */
export const INSET = 'inset 2px 2px 5px rgba(27,56,40,0.10), inset -2px -2px 5px rgba(255,255,255,0.8)';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23g)'/%3E%3C/svg%3E")`;

// ── Shared CSS, mounted once by the account layout ──────────────────────────

export function AccountStyles() {
  return (
    <style>{`
      .gv-acct-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border-radius:10px;border:none;cursor:pointer;
        background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);color:#FFFFFF;font-family:${OUTFIT};font-size:${T.body + 1}px;font-weight:700;letter-spacing:0.005em;text-decoration:none;white-space:nowrap;
        box-shadow:0 8px 18px -8px rgba(27,56,40,0.55),inset 0 1px 0 rgba(255,255,255,0.14);transition:filter 150ms ease-out,transform 150ms ease-out,box-shadow 150ms ease-out}
      .gv-acct-btn:hover:not(:disabled){filter:brightness(1.08);box-shadow:0 12px 22px -8px rgba(27,56,40,0.6),inset 0 1px 0 rgba(255,255,255,0.16)}
      .gv-acct-btn:active:not(:disabled){transform:scale(0.98)}
      .gv-acct-btn:disabled{opacity:0.5;cursor:not-allowed}
      .gv-acct-btn2{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;border-radius:10px;cursor:pointer;
        background:#FFFFFF;color:${INK};border:1.5px solid ${INK};font-family:${OUTFIT};font-size:${T.body + 1}px;font-weight:700;text-decoration:none;white-space:nowrap;transition:background-color 150ms ease-out,transform 150ms ease-out}
      .gv-acct-btn2:hover:not(:disabled){background:${IVORY}}
      .gv-acct-btn2:active:not(:disabled){transform:scale(0.98)}
      .gv-acct-btn2:disabled{opacity:0.45;cursor:not-allowed}
      .gv-acct-btn:focus,.gv-acct-btn2:focus,.gv-acct-rim:focus{outline:none}
      .gv-acct-btn:focus-visible,.gv-acct-btn2:focus-visible,.gv-acct-rim:focus-visible{outline:2px solid ${FOREST};outline-offset:3px}
      .gv-acct-rim{display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;cursor:pointer;color:${FOREST};border:none;
        background:linear-gradient(180deg,#FFFFFF 0%,#F2EDE1 100%);
        box-shadow:inset 0 1px 0 #FFFFFF,0 0 0 1px rgba(27,56,40,0.13),0 0 0 4px rgba(237,231,216,0.9),0 0 0 5px rgba(27,56,40,0.08),0 6px 14px -4px rgba(27,56,40,0.28);
        transition:transform 150ms ease-out,box-shadow 150ms ease-out}
      .gv-acct-rim:hover:not(:disabled){transform:translateY(-1px)}
      .gv-acct-rim:active:not(:disabled){transform:scale(0.96)}
      .gv-acct-link{color:${FOREST};font-weight:700;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px}
      .gv-acct-link:hover{color:${FOREST_MID}}
      .gv-acct-card-link{transition:box-shadow 220ms cubic-bezier(0.22,1,0.36,1),transform 220ms cubic-bezier(0.22,1,0.36,1)}
      .gv-acct-card-link:hover{box-shadow:${RAISED_HOVER} !important;transform:translateY(-2px)}
      @media (prefers-reduced-motion:reduce){
        .gv-acct-btn,.gv-acct-btn2,.gv-acct-rim,.gv-acct-card-link{transition:none}
        .gv-acct-card-link:hover,.gv-acct-rim:hover{transform:none}
      }
    `}</style>
  );
}

// ── Hero band ────────────────────────────────────────────────────────────────

export function AccountHero({
  label,
  title,
  line,
  aside,
  emoji,
  fallback,
  children,
}: {
  /** The small capitals label above the title. */
  label: string;
  /** The h1, already marked up with its gold last word. */
  title: React.ReactNode;
  /** At most one short plain line, no full stop. */
  line?: React.ReactNode;
  /** Actions at the end of the band (buttons). */
  aside?: React.ReactNode;
  /** Fluent 3D emoji resting on the right of the band (decorative). */
  emoji?: string;
  fallback?: LucideIcon;
  /** Anything that belongs in the band under the line (rare). */
  children?: React.ReactNode;
}) {
  return (
    <header
      className="relative overflow-hidden rounded-[28px] px-6 pt-8 pb-[104px] md:px-10 md:pt-10 md:pb-[112px]"
      style={{
        backgroundColor: '#FFFFFF',
        boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.06), 0 1px 2px rgba(27,56,40,0.04)',
      }}
    >
      {/* paper grain, very faint */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: GRAIN, backgroundSize: '220px 220px', mixBlendMode: 'multiply', opacity: 0.07 }}
      />
      {/* a soft gold light resting behind the emoji */}
      <span
        aria-hidden
        className="pointer-events-none absolute hidden sm:block"
        style={{
          right: -60, top: -80, width: 360, height: 360, borderRadius: 9999,
          background: 'radial-gradient(circle, rgba(238,217,138,0.34) 0%, rgba(238,217,138,0.10) 45%, transparent 70%)',
        }}
      />
      {emoji && (
        <span
          aria-hidden
          className="pointer-events-none absolute hidden sm:block"
          style={{ right: 36, top: 26, transform: 'rotate(-8deg)' }}
        >
          <Emoji3D name={emoji} size={112} fallback={fallback} fallbackColor="rgba(27,56,40,0.18)" />
        </span>
      )}

      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 sm:pr-[150px] md:pr-0" style={{ maxWidth: '62ch' }}>
          <p
            style={{
              margin: 0, fontFamily: OUTFIT, fontSize: T.caption, fontWeight: W.title,
              letterSpacing: '0.14em', textTransform: 'uppercase', color: DEEP_GOLD,
            }}
          >
            {label}
          </p>
          <h1
            className="[overflow-wrap:anywhere]"
            style={{
              margin: '8px 0 0', fontFamily: OUTFIT, fontWeight: 800,
              fontSize: 'clamp(30px, 6vw, 44px)', lineHeight: 1.08, letterSpacing: '-0.02em', color: INK,
            }}
          >
            {title}
          </h1>
          {line && (
            <p style={{ margin: '10px 0 0', fontFamily: OUTFIT, fontSize: T.body + 1, lineHeight: 1.5, color: INK_SOFT }}>
              {line}
            </p>
          )}
          {children}
        </div>
        {aside && <div className="relative flex flex-wrap items-center gap-3 md:flex-shrink-0 md:mr-[150px]">{aside}</div>}
      </div>
    </header>
  );
}

/** The page's first cards, pulled up over the hero's lower edge. */
export function HeroOverlap({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative z-[1] -mt-[76px] px-2 sm:px-4 md:px-6 ${className}`}>
      {children}
    </div>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────

export function RaisedCard({
  children, className = '', style, as: As = 'section', ...rest
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: 'section' | 'div' | 'article';
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As
      className={`rounded-[22px] p-5 md:p-7 ${className}`}
      style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFBF7 100%)', boxShadow: RAISED, ...style }}
      {...rest}
    >
      {children}
    </As>
  );
}

/** A card heading: an optional 3D emoji in a tinted disc, the title, an aside. */
export function CardHead({ emoji, fallback, title, aside, sub }: {
  emoji?: string;
  fallback?: LucideIcon;
  title: React.ReactNode;
  sub?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        {emoji && <EmojiDisc emoji={emoji} fallback={fallback} size={42} />}
        <div className="min-w-0">
          <h2
            className="[overflow-wrap:anywhere]"
            style={{ margin: 0, fontFamily: OUTFIT, fontWeight: W.section + 100, fontSize: `clamp(19px, 4.6vw, ${T.section}px)`, lineHeight: 1.2, letterSpacing: '-0.01em', color: INK }}
          >
            {title}
          </h2>
          {sub && (
            <p style={{ margin: '3px 0 0', fontFamily: OUTFIT, fontSize: T.body, color: INK_SOFT, lineHeight: 1.45 }}>{sub}</p>
          )}
        </div>
      </div>
      {aside && <div className="flex-shrink-0">{aside}</div>}
    </div>
  );
}

/** A 3D emoji seated on a soft gold-tinted disc. */
export function EmojiDisc({ emoji, fallback, size = 44, tone = 'gold' }: {
  emoji: string;
  fallback?: LucideIcon;
  size?: number;
  tone?: 'gold' | 'forest' | 'ivory';
}) {
  const bg = tone === 'forest'
    ? 'linear-gradient(135deg, rgba(42,90,60,0.16), rgba(61,122,82,0.10))'
    : tone === 'ivory'
      ? 'linear-gradient(135deg, #FFFFFF, #F4EFE3)'
      : 'linear-gradient(135deg, rgba(238,217,138,0.45), rgba(238,217,138,0.22))';
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.34), background: bg,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 1px rgba(27,56,40,0.05), 0 3px 8px -3px rgba(27,56,40,0.22)',
      }}
    >
      <Emoji3D name={emoji} size={Math.round(size * 0.66)} fallback={fallback} fallbackColor={FOREST} />
    </span>
  );
}

// ── Stat block ───────────────────────────────────────────────────────────────

/**
 * A count the owner likes: the BIG number with the word beside it, and a 3D
 * emoji in a soft disc above. Pass `href` to make the whole block a link.
 */
export function StatBlock({ emoji, fallback, value, word, note, href, ariaLabel, className = '' }: {
  emoji?: string;
  fallback?: LucideIcon;
  value: React.ReactNode;
  word: string;
  /** A small plain line under the figure (no full stop). */
  note?: React.ReactNode;
  href?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const inner = (
    <>
      {emoji && <EmojiDisc emoji={emoji} fallback={fallback} size={40} />}
      <p className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5" style={{ margin: emoji ? '14px 0 0' : 0 }}>
        <span
          style={{
            fontFamily: OUTFIT, fontWeight: 800, fontSize: 'clamp(34px, 5vw, 46px)', lineHeight: 1,
            letterSpacing: '-0.03em', color: FOREST, fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <span style={{ fontFamily: OUTFIT, fontWeight: W.label, fontSize: T.body + 1, color: INK }}>{word}</span>
      </p>
      {note && (
        <p style={{ margin: '6px 0 0', fontFamily: OUTFIT, fontSize: T.caption + 1, color: INK_SOFT, lineHeight: 1.4 }}>{note}</p>
      )}
    </>
  );
  const cls = `block rounded-[20px] p-5 ${className}`;
  const style: React.CSSProperties = { background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFBF7 100%)', boxShadow: RAISED, textDecoration: 'none', color: 'inherit' };
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={`${cls} gv-acct-card-link focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2`} style={style}>
        {inner}
      </Link>
    );
  }
  return <div className={cls} style={style} aria-label={ariaLabel}>{inner}</div>;
}

// ── Duotone icon ─────────────────────────────────────────────────────────────

/** A Lucide glyph as a forest line over a soft gold fill. */
export function DuoIcon({ Icon, size = 18, active = false }: { Icon: LucideIcon; size?: number; active?: boolean }) {
  return (
    <Icon
      aria-hidden
      size={size}
      strokeWidth={2}
      fill={active ? 'rgba(238,217,138,0.85)' : 'rgba(238,217,138,0.5)'}
      style={{ color: active ? FOREST : '#3D5A48', flexShrink: 0 }}
    />
  );
}

// ── Section heading inside a page ───────────────────────────────────────────

/** A plain section heading with an optional count as a big number beside it. */
export function SectionHeading({ title, count, muted = false, id }: { title: string; count?: number; muted?: boolean; id?: string }) {
  return (
    <div className="flex items-baseline gap-2.5 mb-4" id={id}>
      <h2 style={{ margin: 0, fontFamily: OUTFIT, fontWeight: 800, fontSize: T.section, letterSpacing: '-0.01em', color: muted ? INK_SOFT : INK }}>
        {title}
      </h2>
      {count !== undefined && (
        <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: T.section, color: muted ? INK_SOFT : DEEP_GOLD, fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </span>
      )}
    </div>
  );
}
