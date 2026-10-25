'use client';
// Gavelling Crisis: the visual kit. Gavelling's ivory and forest with crisis red
// (owner, 25 Oct 2026: "a lot more hints for red", dark red gradient sidebar, red gradient on
// bigger surfaces and some buttons, keep the green accents). Design reference:
// docs/crisis/design/crisis-dashboard.src.html. Use these pieces on every /crisis page.

import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react';
import {
  Swords, Eye, Handshake, Coins, Newspaper, User, Landmark, VenetianMask, CircleDot,
  Ship, Plane, Rocket, Shield, Fuel, ThumbsUp, Users, Package, Banknote, Radio, Wheat, Factory, Flame,
} from 'lucide-react';

export const CK = {
  page: '#EFE3DA',
  surface: '#F5EAE2',
  card: '#FFFFFF',
  forest: '#1B3828',
  forest2: '#2C5440',
  gold: '#EED98A',
  goldDeep: '#9A6E14',
  goldMid: '#B6871F',
  ink: '#1C1410',
  inkSoft: '#4E463C',
  muted: '#7A6E5E',
  red: '#8E2424',
  red2: '#6E1A1A',
  redDeep: '#3A0E0F',
  ok: '#3D7A52',
  warn: '#B6871F',
  danger: '#A3412F',
  hair: 'rgba(110,30,30,0.12)',
  well: 'rgba(142,36,36,0.055)',
  redGrad: 'linear-gradient(165deg, #9A2A2A 0%, #6A1919 52%, #3A0E0F 100%)',
  redBtn: 'linear-gradient(180deg, #A83030, #741C1C)',
  greenBtn: 'linear-gradient(180deg, #2C5440, #1B3828)',
  redWash: 'linear-gradient(180deg, #FBEDE7 0%, #FFFFFF 150px)',
  shadow: 'inset 0 1px 0 rgba(255,255,255,0.75), 0 0 0 1px rgba(27,56,40,0.07), 6px 7px 18px rgba(27,56,40,0.13), 0 1px 2px rgba(27,56,40,0.05)',
  shadowSm: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(27,56,40,0.10), 0 3px 7px -2px rgba(27,56,40,0.15)',
  redShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 10px 24px rgba(58,14,15,0.25)',
  font: 'var(--font-brand), Inter, system-ui, sans-serif',
  pageBg: 'radial-gradient(1100px 620px at 100% -10%, rgba(142,36,36,0.13), transparent 62%), radial-gradient(900px 520px at -10% 110%, rgba(142,36,36,0.08), transparent 60%), #EFE3DA',
} as const;

/** Colour of a cabinet, with a readable tint for fills. */
export function cabinetTint(hex: string, alpha = 0.22): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function Card({ children, warm, style, className }: { children: ReactNode; warm?: boolean; style?: CSSProperties; className?: string }) {
  return (
    <section
      className={className}
      style={{ background: warm ? CK.redWash : CK.card, borderRadius: 22, boxShadow: CK.shadow, padding: '14px 16px', minWidth: 0, ...style }}
    >
      {children}
    </section>
  );
}

export function CardTitle({ icon, children, sub, right }: { icon?: ReactNode; children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 10 }}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: CK.ink }}>
          {icon && <span style={{ color: CK.red, lineHeight: 0 }}>{icon}</span>}
          {children}
        </h2>
        {sub && <p style={{ margin: '2px 0 0', fontSize: 12, color: CK.inkSoft }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: CK.red, ...style }}>{children}</p>;
}

type BtnTone = 'green' | 'red' | 'ghost' | 'gold' | 'danger';
export function Btn({ tone = 'green', size = 'md', icon, children, style, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: BtnTone; size?: 'sm' | 'md'; icon?: ReactNode }) {
  const bg: Record<BtnTone, string> = {
    green: CK.greenBtn, red: CK.redBtn, ghost: CK.card, gold: `linear-gradient(180deg, ${CK.gold}, #E2C766)`, danger: CK.card,
  };
  const color: Record<BtnTone, string> = { green: '#FFFFFF', red: '#FFF4E6', ghost: CK.forest, gold: CK.forest, danger: CK.danger };
  const ring: Record<BtnTone, string> = {
    green: CK.shadowSm, red: CK.shadowSm, gold: CK.shadowSm, ghost: `inset 0 0 0 1px ${CK.hair}`, danger: 'inset 0 0 0 1px rgba(163,65,47,0.3)',
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform disabled:opacity-50 disabled:cursor-not-allowed ${rest.className ?? ''}`}
      style={{
        border: 0, borderRadius: size === 'sm' ? 9 : 11, padding: size === 'sm' ? '5px 10px' : '8px 14px',
        fontSize: size === 'sm' ? 12 : 13.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
        background: bg[tone], color: color[tone], boxShadow: ring[tone], fontFamily: CK.font, ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/** A big number with the word beside it (CLAUDE.md: no count pills). */
export function BigCount({ n, word, color }: { n: number | string; word: string; color?: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <b style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: color ?? CK.ink }}>{n}</b>
      <span style={{ fontSize: 13, fontWeight: 600, color: CK.inkSoft }}>{word}</span>
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex" style={{ background: CK.well, borderRadius: 11, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{
              border: 0, padding: '5px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: on ? CK.card : 'transparent', color: on ? CK.forest : CK.inkSoft, boxShadow: on ? CK.shadowSm : 'none', fontFamily: CK.font,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Text input / textarea styled for crisis pages. */
export const fieldStyle: CSSProperties = {
  width: '100%', border: 0, borderRadius: 12, padding: '10px 12px', fontSize: 14, lineHeight: 1.5,
  background: CK.card, color: CK.ink, boxShadow: `inset 0 0 0 1px ${CK.hair}`, fontFamily: CK.font, outline: 'none',
};

export function FieldLabel({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 12, fontWeight: 700, color: CK.inkSoft, margin: '0 0 5px' }}>
      {children}
      {hint && <span style={{ fontWeight: 500, color: CK.muted, marginLeft: 6 }}>{hint}</span>}
    </label>
  );
}

/** "14 min", "2 h 5 min", "just now". */
export function waitLabel(fromIso: string | null | undefined, nowMs: number): string {
  if (!fromIso) return '';
  const mins = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export function waitSeverity(fromIso: string | null | undefined, nowMs: number): 'ok' | 'late' | 'very' {
  if (!fromIso) return 'ok';
  const mins = (nowMs - new Date(fromIso).getTime()) / 60000;
  return mins >= 12 ? 'very' : mins >= 8 ? 'late' : 'ok';
}

/** In-world date/time label: "Tue 23 Oct 1962, 19:40". */
export function scenarioLabel(iso: string | null | undefined): string {
  if (!iso) return 'Not set';
  const [d, t] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, day || 1));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()];
  const hm = (t ?? '').slice(0, 5);
  return `${dow} ${day} ${mon} ${y}${hm ? `, ${hm}` : ''}`;
}

export function Skeleton({ h = 18, w = '100%', r = 10 }: { h?: number; w?: number | string; r?: number }) {
  return <span className="animate-pulse" style={{ display: 'block', height: h, width: w, borderRadius: r, background: 'rgba(110,30,30,0.08)' }} />;
}

// ─────────── Signature detail: the overlapping avatar ───────────
// Owner (CLAUDE.md §8 rule 19, repeated 25 Oct 2026): a character's picture, a logo or a crest may sit
// half outside its card's border or corner, never clipped. Use it for the focus element of a card.

export function initialsOf(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A round picture (or initials) with a white ring and a cabinet-coloured outer ring. */
export function Avatar({ name, src, size = 44, color = CK.red, style }: { name: string; src?: string | null; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', overflow: 'hidden',
        background: src ? '#fff' : CK.redGrad, color: '#FFF4E6', fontWeight: 800, fontSize: Math.round(size * 0.36), letterSpacing: '0.02em',
        boxShadow: `0 0 0 ${Math.max(2, Math.round(size / 22))}px #fff, 0 0 0 ${Math.max(3, Math.round(size / 13))}px ${color}, 0 6px 16px rgba(58,14,15,0.25)`,
        fontFamily: CK.font, ...style,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : initialsOf(name)}
    </span>
  );
}

/**
 * A card whose avatar overhangs its top-left corner (or top centre). The card leaves room for it;
 * nothing is clipped (the card never sets overflow hidden).
 */
export function OverhangCard({ name, src, color, size = 46, place = 'corner', children, style, onClick, warm }: {
  name: string; src?: string | null; color?: string; size?: number; place?: 'corner' | 'top';
  children: ReactNode; style?: CSSProperties; onClick?: () => void; warm?: boolean;
}) {
  const half = Math.round(size / 2);
  const body = (
    <>
      <span style={{ position: 'absolute', ...(place === 'top' ? { top: -half, left: '50%', transform: 'translateX(-50%)' } : { top: -Math.round(size * 0.32), left: -Math.round(size * 0.22) }) }}>
        <Avatar name={name} src={src} size={size} color={color} />
      </span>
      {children}
    </>
  );
  const common: CSSProperties = {
    position: 'relative', background: warm ? CK.redWash : CK.card, borderRadius: 18, boxShadow: CK.shadow, minWidth: 0,
    padding: place === 'top' ? `${half + 10}px 14px 14px` : `12px 14px 12px ${Math.round(size * 0.78) + 12}px`,
    marginTop: place === 'top' ? half : Math.round(size * 0.32), marginLeft: place === 'corner' ? Math.round(size * 0.22) : 0, ...style,
  };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] text-left w-full transition-transform active:scale-[0.99]" style={{ ...common, border: 0, cursor: 'pointer', fontFamily: CK.font, color: CK.ink }}>
        {body}
      </button>
    );
  }
  return <div style={common}>{body}</div>;
}

// ─────────── Theme and resource icons (with colours) ───────────

export const THEME_STYLE: Record<string, { Icon: typeof CircleDot; color: string }> = {
  Military: { Icon: Swords, color: '#A3412F' },
  Intelligence: { Icon: Eye, color: '#5B4A8A' },
  Diplomatic: { Icon: Handshake, color: '#2F6B5A' },
  Economic: { Icon: Coins, color: '#9A6E14' },
  Press: { Icon: Newspaper, color: '#3E6A9A' },
  Personal: { Icon: User, color: '#7A5C3E' },
  Political: { Icon: Landmark, color: '#1B3828' },
  Covert: { Icon: VenetianMask, color: '#3A0E0F' },
};

/** A theme as a small coloured chip: icon + word (not a status pill; it labels content). */
export function ThemeTag({ theme, size = 'sm' }: { theme: string; size?: 'sm' | 'md' }) {
  const t = THEME_STYLE[theme] ?? { Icon: CircleDot, color: CK.muted };
  const I = t.Icon;
  return (
    <span className="inline-flex items-center" style={{ gap: 4, fontSize: size === 'sm' ? 11.5 : 12.5, fontWeight: 700, color: t.color, background: cabinetTint(t.color, 0.1), borderRadius: 8, padding: size === 'sm' ? '2px 7px' : '3px 9px' }}>
      <I size={size === 'sm' ? 12 : 14} strokeWidth={1.6} aria-hidden />{theme}
    </span>
  );
}

/** A Lucide icon chosen from a resource's name (ships, aircraft, missiles, money, standing, oil...). */
export function resourceIcon(name: string, size = 18): ReactNode {
  const n = name.toLowerCase();
  const I = /ship|fleet|navy|vessel|boat/.test(n) ? Ship
    : /air|plane|jet|bomber/.test(n) ? Plane
    : /missile|rocket|nuclear|warhead/.test(n) ? Rocket
    : /troop|army|soldier|division|force/.test(n) ? Shield
    : /oil|fuel|gas|petrol/.test(n) ? Fuel
    : /standing|approval|support|morale|popular/.test(n) ? ThumbsUp
    : /people|population|citizens/.test(n) ? Users
    : /money|budget|fund|dollar|rouble|ruble|treasury/.test(n) ? Banknote
    : /gold|coin|cash/.test(n) ? Coins
    : /intel|spy|agent/.test(n) ? Eye
    : /radio|media|press|broadcast/.test(n) ? Radio
    : /food|grain|wheat/.test(n) ? Wheat
    : /industry|factory|steel/.test(n) ? Factory
    : /unrest|riot|tension/.test(n) ? Flame
    : Package;
  return <I size={size} strokeWidth={1.5} aria-hidden />;
}
