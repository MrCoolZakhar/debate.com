'use client';
// Gavelling Crisis: the visual kit. Gavelling's ivory and forest with crisis red
// (owner, 25 Oct 2026: "a lot more hints for red", dark red gradient sidebar, red gradient on
// bigger surfaces and some buttons, keep the green accents). Design reference:
// docs/crisis/design/crisis-dashboard.src.html. Use these pieces on every /crisis page.

import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react';

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
