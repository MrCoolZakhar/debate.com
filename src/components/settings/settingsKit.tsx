'use client';

/**
 * The Settings dialog's own controls. Every one of them is built for this dialog: tactile,
 * ivory and forest with gold as the only accent, forest-tinted shadows, Outfit, and fully
 * operable from the keyboard with ARIA roles and values. None of them writes anything; the
 * tabs hand them values and callbacks that go through SettingsPanel's key-level patch.
 *
 *   GavelSwitch   role=switch pill with a glyph in the knob (check, lock, bell, eye...)
 *   SealChoice    role=radiogroup of cards with an icon and a wax-seal selected mark
 *   ClockStepper  role=spinbutton seconds well with - / + and notch presets
 *   NotchDial     role=slider track of notches, a pebble thumb, drag and arrow keys
 *   TimeChooser   a typed m:ss clock with - / + steps (the gavel knock), like the Add time panel
 *   TallyStepper  compact +/- counter for points
 *   Section, SettingRow, RowGrid, SectionPair, HoverHint, InfoHint, InlineRename, ConfirmSheet
 *
 * TEXT. Every size is a step of the T scale below (ratio 1.6) and every weight a W. A
 * setting shows a 1-4 word label; what it does lives in an InfoHint (hover or focus), never
 * as a visible sentence under the label.
 *
 * ICONS. A glyph in this dialog is a CRISP LUCIDE LINE at one of three sizes (14 inline or in
 * a hint, 16 in a row, 18-20 beside a group title) in forest, deep gold or ink.
 * It NEVER sits in a decorative rounded-square tile: those tiles are what made the panel
 * look generated. The only round or plated things left are the ones that really are an
 * object: a person's avatar, a wax seal on a chosen card, a join-code ticket, a switch knob.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, Info, Lock, Minus, Plus, Pencil, RotateCcw, Timer } from 'lucide-react';
import Portal from '@/components/Portal';
import { portalFrame } from '@/components/chat/chatTokens';

// ── Tokens ────────────────────────────────────────────────────────────────────
export const K = {
  ivory: '#EDE7D8',
  page: '#F6F1E6',
  surface: '#FBF8F1',
  forest: '#1B3828',
  forestMid: '#2A5A3C',
  forestLight: '#3D7A52',
  gold: '#EED98A',
  deepGold: '#B6871F',
  ink: '#1C1410',
  inkSoft: '#5E5044',
  muted: '#8C7C6A',
  hair: 'rgba(28,20,16,0.08)',
  /** The quiet group surface: a breath of forest over the page. */
  tint: 'rgba(27,56,40,0.035)',
  danger: '#9B2C22',
  dangerTint: 'rgba(155,44,34,0.08)',
  font: "'Outfit', sans-serif",
  ease: 'cubic-bezier(0.22,1,0.36,1)',
  out: '-4px -4px 10px rgba(255,255,255,0.9), 6px 6px 16px rgba(27,56,40,0.13)',
  outSm: '-2px -2px 6px rgba(255,255,255,0.9), 3px 3px 8px rgba(27,56,40,0.14)',
  inSm: 'inset 2px 2px 5px rgba(27,56,40,0.14), inset -2px -2px 5px rgba(255,255,255,0.85)',
  card: '0 0 0 1px rgba(27,56,40,0.06), 0 1px 2px rgba(27,56,40,0.06), 0 8px 24px -12px rgba(27,56,40,0.18)',
  ring: '0 0 0 2px #FBF8F1, 0 0 0 4px #B6871F',
} as const;

// ── Type scale ────────────────────────────────────────────────────────────────
/**
 * ONE type scale for the whole dialog, ratio 1.6 from a 13px base:
 *
 *   T.title    33px  (13 x 1.6 x 1.6)  the tab title, big display numbers     weight 700
 *   T.section  21px  (13 x 1.6)        a group title, codes, a dialog title   weight 600
 *   T.body     13px                    labels, controls, buttons, lead text   weight 400-500
 *   T.caption  11px                    units, "seen 2 min ago", legends only  weight 500
 *
 * 13 / 1.6 = 8px is too small to read, so the caption is the ONE off-ratio step and is kept
 * for meta that would otherwise crowd a row. No other font size appears in Settings: use
 * these constants, never a literal. Colour carries the rest of the hierarchy: titles in
 * ink, group titles in forest, the lead and hints in inkSoft.
 */
export const T = { title: 33, section: 21, body: 13, caption: 11 } as const;
export const W = { title: 700, section: 600, label: 500, body: 400 } as const;
/** Line heights that keep the scale's rhythm (tight for display, open for reading). */
export const LH = { title: 1.1, section: 1.2, body: 1.45 } as const;

/** Shared CSS for focus rings, press scale and reduced motion inside the dialog. */
export function SettingsKitStyles() {
  return (
    <style>{`
      .stg-root { -webkit-font-smoothing: antialiased; font-family: ${K.font}; }
      .stg-root :focus { outline: none; }
      .stg-focus:focus-visible { box-shadow: ${K.ring}; }
      .stg-press { transition-property: transform, box-shadow, background-color, color, opacity; transition-duration: 160ms; transition-timing-function: ${K.ease}; }
      .stg-press:active:not(:disabled) { transform: scale(0.96); }
      .stg-title { text-wrap: balance; }
      .stg-body { text-wrap: pretty; }
      .stg-num { font-variant-numeric: tabular-nums; }
      @keyframes stgRise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      .stg-rise { animation: stgRise 320ms ${K.ease} both; }
      /* Tab columns follow the PAGE width (a container query), never the viewport: the
         dialog is portalled into the scaled #fit-root and its spine takes a share. */
      .stg-page { container-type: inline-size; }
      .stg-cols-2, .stg-cols-3 { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: 20px; align-items: start; }
      @container (min-width: 720px) { .stg-cols-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
      @container (min-width: 900px) { .stg-cols-3 { grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr) minmax(0, 0.92fr); } }
      @media (prefers-reduced-motion: reduce) {
        .stg-root *, .stg-root *::before, .stg-root *::after { transition-duration: 0ms !important; animation-duration: 0ms !important; animation-delay: 0ms !important; }
        .stg-press:active:not(:disabled) { transform: none; }
      }
    `}</style>
  );
}

// ── Section and rows ──────────────────────────────────────────────────────────
type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties; 'aria-hidden'?: boolean | 'true' }>;

/** A labelled group. ONE heading shape on every tab: a Lucide glyph and the group title at
 *  T.section in forest, with its explanation behind an InfoHint and an optional aside at the
 *  inline-end. The lead groups of a tab sit on a raised ivory plate, the rest on a faint
 *  forest tint, so the surface says which settings matter. */
export function Section({ icon: Icon, title, hint, lead = false, children, delay = 0, aside }: {
  icon?: LucideIcon; title: string; hint?: string; lead?: boolean; children: React.ReactNode; delay?: number; aside?: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="stg-rise" style={{ animationDelay: `${delay}ms`, marginBottom: 26 }}>
      <div className="flex items-center gap-2.5" style={{ marginBottom: 10, paddingInline: 2, minHeight: 34 }}>
        {Icon && <Icon aria-hidden size={18} strokeWidth={2.2} style={{ color: lead ? K.deepGold : K.forestLight, flexShrink: 0 }} />}
        <h3 id={id} className="stg-title min-w-0" style={{ margin: 0, fontSize: T.section, fontWeight: W.section, lineHeight: LH.section, letterSpacing: '-0.01em', color: K.forest }}>
          {title}
        </h3>
        {hint && <InfoHint text={hint} />}
        <span aria-hidden className="flex-1" />
        {aside}
      </div>
      <div style={{
        borderRadius: 16, background: lead ? K.surface : K.tint,
        boxShadow: lead ? K.card : 'none', padding: '2px 16px',
      }}>
        {children}
      </div>
    </section>
  );
}

/** Two groups side by side on a wide dialog, stacked below ~330px each. */
export function SectionPair({ children }: { children: React.ReactNode }) {
  return <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: 20 }}>{children}</div>;
}

/** Settings in two columns inside one group, so a tab of switches is half as tall. Rows
 *  inside keep their own hairline (never pass `first`), which reads as a small table. */
export function RowGrid({ children, min = 300 }: { children: React.ReactNode; min?: number }) {
  return <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, columnGap: 24 }}>{children}</div>;
}

/** One setting: a short label (and its InfoHint) on the inline-start side, the control on
 *  the inline-end. `hint` is the explanation; it is never printed under the label. */
export function SettingRow({ label, hint, control, children, first = false, dense = false, htmlFor, labelId }: {
  label: React.ReactNode; hint?: string; control?: React.ReactNode; children?: React.ReactNode;
  first?: boolean; dense?: boolean; htmlFor?: string; labelId?: string;
}) {
  const labelStyle: React.CSSProperties = { fontSize: T.body, fontWeight: W.label, color: K.ink, lineHeight: LH.body };
  return (
    <div style={{ padding: dense ? '10px 0' : '13px 0', borderTop: first ? 'none' : `1px solid ${K.hair}` }}>
      <div className="flex items-center gap-3" style={{ minHeight: 30 }}>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {htmlFor
            ? <label htmlFor={htmlFor} id={labelId} style={labelStyle}>{label}</label>
            : <div id={labelId} style={labelStyle}>{label}</div>}
          {hint && <InfoHint text={hint} />}
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      {children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

// ── GavelSwitch ───────────────────────────────────────────────────────────────
const GLYPHS: Record<'check' | 'lock', LucideIcon> = { check: Check, lock: Lock };

export function GavelSwitch({ checked, onChange, label, labelledBy, glyph = 'check', icon, disabled = false, size = 'md' }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; labelledBy?: string;
  glyph?: 'check' | 'lock'; icon?: LucideIcon; disabled?: boolean; size?: 'sm' | 'md';
}) {
  const W = size === 'sm' ? 46 : 56;
  const H = size === 'sm' ? 26 : 32;
  const knob = H - 6;
  const Glyph = icon ?? GLYPHS[glyph];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="stg-focus stg-press relative shrink-0"
      style={{
        width: W, height: H, borderRadius: 999, padding: 0, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: checked ? `linear-gradient(135deg, ${K.forest}, ${K.forestMid})` : '#E6DFCF',
        boxShadow: checked ? 'inset 0 1px 2px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.6)' : K.inSm,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {/* Seat marks: three small dots on the empty side, like notches on a gavel block. */}
      <span aria-hidden className="absolute flex items-center gap-[3px]" style={{
        top: '50%', transform: 'translateY(-50%)', insetInlineStart: checked ? 9 : undefined, insetInlineEnd: checked ? undefined : 9,
        opacity: 0.55, transitionProperty: 'opacity', transitionDuration: '160ms',
      }}>
        {[0, 1].map((i) => <span key={i} style={{ width: 3, height: 3, borderRadius: 3, background: checked ? K.gold : '#B9AC97' }} />)}
      </span>
      <span aria-hidden className="absolute inline-flex items-center justify-center" style={{
        top: 3, insetInlineStart: checked ? W - knob - 3 : 3, width: knob, height: knob, borderRadius: 999,
        background: checked ? `radial-gradient(circle at 35% 30%, #F7EBB5, ${K.gold} 55%, ${K.deepGold})` : `radial-gradient(circle at 35% 30%, #FFFFFF, #F4EFE3)`,
        boxShadow: '0 2px 5px rgba(27,56,40,0.28), inset 0 -1px 1px rgba(0,0,0,0.08)',
        color: checked ? K.forest : '#B9AC97',
        transitionProperty: 'inset-inline-start, background', transitionDuration: '220ms', transitionTimingFunction: K.ease,
      }}>
        <Glyph size={size === 'sm' ? 11 : 13} strokeWidth={3} />
      </span>
    </button>
  );
}

// ── SealChoice: card radios ───────────────────────────────────────────────────
/** `note` is the explanation: a native tooltip and the card's accessible description, never
 *  printed on the card. */
export interface SealOption<V extends string> { value: V; title: string; note?: string; icon?: LucideIcon; art?: React.ReactNode }

export function SealChoice<V extends string>({ value, options, onChange, label, colsClass = 'sm:grid-cols-2', compact = false }: {
  value: V; options: SealOption<V>[]; onChange: (v: V) => void; label: string;
  /** Tailwind column classes from the sm breakpoint up; one column below it. */
  colsClass?: string; compact?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const move = (to: number) => {
    const n = (to + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const rtl = getComputedStyle(e.currentTarget as Element).direction === 'rtl';
    const next = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prev = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === next || e.key === 'ArrowDown') { e.preventDefault(); move(i + 1); }
    else if (e.key === prev || e.key === 'ArrowUp') { e.preventDefault(); move(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); move(0); }
    else if (e.key === 'End') { e.preventDefault(); move(options.length - 1); }
  };
  return (
    <div role="radiogroup" aria-label={label} className={`grid grid-cols-1 gap-2.5 ${colsClass}`}>
      {options.map((o, i) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === idx ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            title={o.note}
            aria-describedby={o.note ? `${baseId}-${i}` : undefined}
            className="stg-focus stg-press relative text-start"
            style={{
              borderRadius: 14, border: 'none', cursor: 'pointer', padding: compact ? '10px 11px' : '12px 12px',
              background: on ? `linear-gradient(160deg, ${K.forest}, #22472F)` : K.surface,
              color: on ? '#F3EAD0' : K.ink,
              boxShadow: on ? '0 10px 22px -12px rgba(27,56,40,0.7), inset 0 1px 0 rgba(255,255,255,0.08)' : K.outSm,
            }}
          >
            {/* Glyph or diagram, on the card itself: no tile behind it (see ICONS above). */}
            <div className="flex items-start gap-2.5">
              {(o.art || Icon) && (
                <span aria-hidden className="inline-flex items-center justify-center shrink-0" style={{
                  width: 22, height: compact ? 18 : 20, color: on ? K.gold : K.forest,
                }}>
                  {o.art ?? (Icon && <Icon size={compact ? 16 : 18} strokeWidth={2.2} />)}
                </span>
              )}
              <span className="flex-1 min-w-0" style={{ paddingInlineEnd: 20 }}>
                <span style={{ display: 'block', fontSize: T.body, fontWeight: on ? W.section : W.label, lineHeight: LH.body }}>{o.title}</span>
                {o.note && <span id={`${baseId}-${i}`} className="sr-only">{o.note}</span>}
              </span>
            </div>
            {/* The wax seal: gold with a check when chosen, an empty ring otherwise. */}
            <span aria-hidden className="absolute inline-flex items-center justify-center" style={{
              top: 10, insetInlineEnd: 10, width: 20, height: 20, borderRadius: 999,
              background: on ? `radial-gradient(circle at 35% 30%, #F7EBB5, ${K.gold} 60%, ${K.deepGold})` : 'transparent',
              boxShadow: on ? '0 2px 6px rgba(0,0,0,0.3)' : 'inset 0 0 0 1.5px rgba(28,20,16,0.18)',
              color: K.forest,
            }}>
              {on && <Check size={12} strokeWidth={3.2} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── ClockStepper ──────────────────────────────────────────────────────────────
export function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/** Seconds, with a clock arc that fills against `arcMax`. Commits on blur / Enter / a
 *  button, never per keystroke, so a half-typed value never becomes the setting. */
export function ClockStepper({ value, onCommit, min, max, step = 5, presets = [], label, unit, arcMax }: {
  value: number; onCommit: (v: number) => void; min: number; max: number; step?: number;
  presets?: number[]; label: string; unit: string; arcMax?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  // Follow outside changes (another chair, a preset) while the field is not being typed in.
  const [synced, setSynced] = useState(value);
  if (!editing && synced !== value) { setSynced(value); setDraft(String(value)); }
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  // What the control is really on right now. Clicking - / + blurs a focused field, so the
  // blur commits the typed number and THEN the click runs: without this ref the click would
  // step from the value of the previous render and throw the typed number away.
  const liveRef = useRef(value);
  useEffect(() => { liveRef.current = value; }, [value]);
  const commit = () => {
    setEditing(false);
    const n = parseInt(draft.trim(), 10);
    if (!Number.isFinite(n)) { setDraft(String(value)); return; }
    const c = clamp(n);
    setDraft(String(c));
    liveRef.current = c;
    if (c !== value) onCommit(c);
  };
  const bump = (d: number) => {
    // Step onto the grid (5, 10, 15...) rather than drifting off it from a typed 17.
    const base = liveRef.current;
    const next = clamp(d > 0 ? (Math.floor(base / step) + 1) * step : (Math.ceil(base / step) - 1) * step);
    liveRef.current = next;
    if (next !== base) onCommit(next);
  };
  const frac = Math.min(1, value / (arcMax ?? max));
  const R = 17;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-end gap-2.5">
      <div className="inline-flex items-center gap-1.5" style={{ padding: 4, borderRadius: 999, background: K.ivory, boxShadow: K.inSm }}>
        <button type="button" aria-label={`- ${step} ${unit}`} onClick={() => bump(-step)} disabled={value <= min}
          className="stg-focus stg-press inline-flex items-center justify-center"
          style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: K.surface, color: K.forest, boxShadow: K.outSm, opacity: value <= min ? 0.4 : 1, cursor: 'pointer' }}>
          <Minus size={15} strokeWidth={2.6} />
        </button>
        <span className="relative inline-flex items-center justify-center" style={{ width: 64, height: 40 }}>
          <svg aria-hidden width="40" height="40" viewBox="0 0 40 40" className="absolute" style={{ insetInlineStart: -2, top: 0, opacity: 0.9 }}>
            <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(27,56,40,0.10)" strokeWidth="3" />
            <circle cx="20" cy="20" r={R} fill="none" stroke={K.deepGold} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 20 20)" style={{ transitionProperty: 'stroke-dasharray', transitionDuration: '240ms' }} />
          </svg>
          <input
            type="text"
            inputMode="numeric"
            role="spinbutton"
            aria-label={label}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={formatSeconds(value)}
            value={draft}
            onFocus={() => setEditing(true)}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
              else if (e.key === 'Escape') { e.preventDefault(); setDraft(String(value)); setEditing(false); (e.currentTarget as HTMLInputElement).blur(); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); bump(step); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-step); }
            }}
            className="stg-focus stg-num relative text-center"
            style={{ width: 64, height: 36, border: 'none', background: 'transparent', fontSize: T.section, fontWeight: W.section, color: K.forest, borderRadius: 10, paddingInlineStart: 14 }}
          />
        </span>
        <span aria-hidden style={{ fontSize: T.caption, fontWeight: W.label, color: K.inkSoft, marginInlineEnd: 2 }}>{unit}</span>
        <button type="button" aria-label={`+ ${step} ${unit}`} onClick={() => bump(step)} disabled={value >= max}
          className="stg-focus stg-press inline-flex items-center justify-center"
          style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: K.forest, color: K.gold, boxShadow: K.outSm, opacity: value >= max ? 0.4 : 1, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2.6} />
        </button>
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1.5" role="group" aria-label={label}>
          {presets.map((p) => {
            const on = p === value;
            return (
              <button key={p} type="button" aria-pressed={on} onClick={() => onCommit(p)}
                className="stg-focus stg-press stg-num"
                style={{
                  minWidth: 40, height: 28, padding: '0 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: T.body, fontWeight: on ? W.section : W.label,
                  background: on ? K.gold : 'transparent', color: on ? K.forest : K.inkSoft,
                  boxShadow: on ? '0 2px 6px -2px rgba(182,135,31,0.6)' : 'inset 0 0 0 1px rgba(28,20,16,0.12)',
                }}>
                {formatSeconds(p)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── NotchDial: a custom slider ────────────────────────────────────────────────
export function NotchDial({ value, min, max, step = 1, onChange, label, valueText, notches = 24, startLabel, endLabel, tone = 'gold' }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string;
  valueText?: (v: number) => string; notches?: number; startLabel?: string; endLabel?: string; tone?: 'gold' | 'split';
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step)), [min, max, step]);
  const frac = (value - min) / (max - min || 1);

  const fromPointer = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === 'rtl';
    let f = (clientX - r.left) / (r.width || 1);
    if (rtl) f = 1 - f;
    onChange(clamp(min + Math.min(1, Math.max(0, f)) * (max - min)));
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const big = Math.max(step, Math.round((max - min) / 10));
    let next: number | null = null;
    if (e.key === 'ArrowUp' || e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next = value + step;
    else if (e.key === 'ArrowDown' || e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) next = value - step;
    else if (e.key === 'PageUp') next = value + big;
    else if (e.key === 'PageDown') next = value - big;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    if (next !== null) { e.preventDefault(); onChange(clamp(next)); }
  };

  return (
    <div style={{ paddingTop: 30 }}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText ? valueText(value) : String(value)}
        onKeyDown={onKey}
        onPointerDown={(e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; setIsDragging(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); fromPointer(e.clientX); }}
        onPointerMove={(e) => { if (isDragging) fromPointer(e.clientX); }}
        onPointerUp={() => setIsDragging(false)}
        onPointerCancel={() => setIsDragging(false)}
        className="stg-focus relative select-none"
        style={{ height: 34, borderRadius: 12, cursor: 'pointer', touchAction: 'none' }}
      >
        {/* Notches: the filled ones rise and turn gold (or forest / gold on a split dial). */}
        <div aria-hidden className="absolute inset-0 flex items-center justify-between" style={{ paddingInline: 4 }}>
          {Array.from({ length: notches }, (_, i) => {
            const at = i / (notches - 1);
            const filled = at <= frac + 1e-6;
            const major = i % 4 === 0 || i === notches - 1;
            // A split dial is an axis from one pole to the other, so its notches shade from
            // forest to gold regardless of the value; the thumb says where it sits.
            const color = tone === 'split'
              ? `color-mix(in srgb, ${K.forest} ${Math.round((1 - at) * 100)}%, ${K.deepGold})`
              : (filled ? K.deepGold : 'rgba(28,20,16,0.16)');
            return <span key={i} style={{
              width: 3, height: major ? 22 : 13, borderRadius: 3, background: color,
              opacity: tone === 'split' ? 0.8 : 1,
              transitionProperty: 'background-color, height', transitionDuration: '160ms',
            }} />;
          })}
        </div>
        {/* The pebble thumb with its value flag. */}
        <span aria-hidden className="absolute" style={{
          top: 0, bottom: 0, insetInlineStart: `calc((100% - 30px) * ${frac})`, width: 30,
          transitionProperty: 'inset-inline-start', transitionDuration: isDragging ? '0ms' : '140ms',
        }}>
          {/* The flag centres on the thumb, but hugs the track's end near either pole so it
              never hangs past the group's edge. */}
          <span className="absolute inline-flex items-center justify-center stg-num" style={{
            top: -30,
            ...(frac < 0.12 ? { insetInlineStart: 0 } : frac > 0.88 ? { insetInlineEnd: 0 } : { left: '50%', transform: 'translateX(-50%)' }), minWidth: 38, height: 22, padding: '0 7px', borderRadius: 7,
            background: K.forest, color: K.gold, fontSize: T.body, fontWeight: W.section, whiteSpace: 'nowrap',
            boxShadow: '0 4px 10px -4px rgba(27,56,40,0.6)',
          }}>
            {valueText ? valueText(value) : value}
          </span>
          <span className="absolute" style={{
            top: 2, left: 3, width: 24, height: 30, borderRadius: 10,
            background: `linear-gradient(180deg, #FFFFFF, #EFE8D8)`, boxShadow: '0 3px 8px rgba(27,56,40,0.3), inset 0 -2px 0 rgba(27,56,40,0.08)',
          }}>
            <span className="absolute" style={{ top: 9, left: 7, right: 7, height: 2, borderRadius: 2, background: 'rgba(27,56,40,0.25)', boxShadow: '0 5px 0 rgba(27,56,40,0.25)' }} />
          </span>
        </span>
      </div>
      {(startLabel || endLabel) && (
        <div className="flex justify-between" style={{ marginTop: 8, fontSize: T.caption, fontWeight: W.label, color: K.inkSoft }}>
          <span>{startLabel}</span><span>{endLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── TimeChooser: a clock you set, like the Add time panel ─────────────────────
/** m:ss, always with a minutes part (0:15, 1:30, 10:00). */
export function formatClock(secs: number): string {
  const v = Math.max(0, Math.round(secs));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

/** "1:30", "90", "1:5" -> seconds; null when it is not a time. */
export function parseClock(text: string): number | null {
  const s = text.trim();
  const mm = /^(\d{1,2}):(\d{1,2})$/.exec(s);
  if (mm) return parseInt(mm[1], 10) * 60 + parseInt(mm[2], 10);
  if (/^\d{1,4}$/.test(s)) return parseInt(s, 10);
  return null;
}

/**
 * A seconds setting read as a clock. The face is a typed m:ss field (seconds alone work too)
 * that commits on blur or Enter, never per keystroke; - and + step by `step` seconds on either
 * side, the way the Add time panel adds a fixed amount. Arrow Up / Down on the face step one
 * second, Shift ten. There are NO presets and no slider: a slider over a 1..600 range could
 * not land on the value a chair meant, and presets beside it doubled the ways to say one thing.
 *
 * Every path goes through `clamp` then `onChange`, and the step buttons read the live value
 * from a ref, so pressing + right after typing never steps from a stale number.
 */
export function TimeChooser({ value, min, max, step = 5, onChange, label, lessLabel, moreLabel, clamp: clampIn, aside }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string;
  /** Accessible names for the step buttons, e.g. "5 seconds less". */
  lessLabel: string; moreLabel: string;
  clamp?: (v: number) => number;
  /** Rendered at the inline-end of the row (e.g. a Test button). */
  aside?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(formatClock(value));
  const [editing, setEditing] = useState(false);
  const [synced, setSynced] = useState(value);
  if (!editing && synced !== value) { setSynced(value); setDraft(formatClock(value)); }
  const liveRef = useRef(value);
  useEffect(() => { liveRef.current = value; }, [value]);
  const clamp = (v: number) => {
    const n = clampIn ? clampIn(v) : Math.round(v);
    return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
  };
  const set = (v: number) => {
    const c = clamp(v);
    liveRef.current = c;
    setDraft(formatClock(c));
    if (c !== value) onChange(c);
  };
  const commit = () => {
    setEditing(false);
    const n = parseClock(draft);
    if (n === null) { setDraft(formatClock(liveRef.current)); return; }
    set(n);
  };
  // Step onto the grid (15 -> 20 -> 25), not off it from a typed 17.
  const bump = (d: number) => {
    const base = liveRef.current;
    set(d > 0 ? (Math.floor(base / step) + 1) * step : (Math.ceil(base / step) - 1) * step);
  };
  const stepBtn = (dir: -1 | 1) => {
    const off = dir < 0 ? value <= min : value >= max;
    return (
      <button type="button" aria-label={dir < 0 ? lessLabel : moreLabel} title={dir < 0 ? lessLabel : moreLabel}
        onClick={() => bump(dir * step)} disabled={off}
        className="stg-focus stg-press stg-num inline-flex items-center justify-center gap-0.5 shrink-0"
        style={{
          height: 34, minWidth: 52, padding: '0 10px', borderRadius: 10, border: 'none', cursor: off ? 'default' : 'pointer',
          fontSize: T.body, fontWeight: W.section, opacity: off ? 0.4 : 1,
          background: dir > 0 ? K.forest : K.surface, color: dir > 0 ? K.gold : K.forest, boxShadow: K.outSm,
        }}>
        {dir < 0 ? <Minus size={13} strokeWidth={2.8} aria-hidden /> : <Plus size={13} strokeWidth={2.8} aria-hidden />}
        {step}s
      </button>
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {stepBtn(-1)}
      <span className="inline-flex items-center gap-1.5 shrink-0" style={{ height: 40, padding: '0 12px 0 10px', borderRadius: 12, background: K.ivory, boxShadow: K.inSm }}>
        <Timer aria-hidden size={16} strokeWidth={2.3} style={{ color: K.deepGold }} />
        <input
          type="text"
          inputMode="numeric"
          role="spinbutton"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={formatClock(value)}
          dir="ltr"
          value={draft}
          onFocus={(e) => { setEditing(true); e.currentTarget.select(); }}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d:]/g, '').slice(0, 5))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
            else if (e.key === 'Escape') { e.preventDefault(); setDraft(formatClock(liveRef.current)); setEditing(false); (e.currentTarget as HTMLInputElement).blur(); }
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
              set(liveRef.current + d);
            }
          }}
          className="stg-focus stg-num text-center"
          style={{ width: 64, height: 32, border: 'none', background: 'transparent', fontSize: T.section, fontWeight: W.section, color: K.forest, borderRadius: 8, fontFamily: K.font }}
        />
      </span>
      {stepBtn(1)}
      {aside && <span className="flex-1" aria-hidden />}
      {aside}
    </div>
  );
}

// ── TallyStepper: compact integer counter ─────────────────────────────────────
export function TallyStepper({ value, onChange, min = -99, max = 999, label, suffix }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; suffix?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  // Follow outside changes (another chair, a preset) while the field is not being typed in.
  const [synced, setSynced] = useState(value);
  if (!editing && synced !== value) { setSynced(value); setDraft(String(value)); }
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && clamp(n) !== value) onChange(clamp(n)); else setDraft(String(value));
  };
  const btn: React.CSSProperties = { width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', color: K.forest, cursor: 'pointer' };
  return (
    <span className="inline-flex items-center" style={{ height: 32, padding: '0 3px', borderRadius: 11, background: K.ivory, boxShadow: K.inSm }}>
      <button type="button" aria-label={`${label} -1`} className="stg-focus stg-press inline-flex items-center justify-center" style={btn} onClick={() => onChange(clamp(value - 1))}><Minus size={13} strokeWidth={2.6} /></button>
      <input
        type="text" inputMode="numeric" role="spinbutton" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d-]/g, '').slice(0, 4))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + 1)); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - 1)); }
        }}
        className="stg-focus stg-num text-center"
        style={{ width: 34, height: 26, border: 'none', background: 'transparent', fontSize: T.body, fontWeight: W.section, color: K.ink, borderRadius: 6 }}
      />
      {suffix && <span aria-hidden style={{ fontSize: T.caption, fontWeight: W.label, color: K.inkSoft, marginInlineEnd: 2 }}>{suffix}</span>}
      <button type="button" aria-label={`${label} +1`} className="stg-focus stg-press inline-flex items-center justify-center" style={btn} onClick={() => onChange(clamp(value + 1))}><Plus size={13} strokeWidth={2.6} /></button>
    </span>
  );
}

// ── InlineRename ──────────────────────────────────────────────────────────────
/** `defaultName` is the localized label shown when nothing is renamed; `resetValue` is the
 *  canonical (English) value written back, so localized text never reaches the store. */
export function InlineRename({ defaultName, value, onChange, resetValue, resetLabel, editLabel }: {
  defaultName: string; value: string; onChange: (v: string) => void; resetValue?: string; resetLabel: string; editLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const baseValue = resetValue ?? defaultName;
  const isCustom = value !== baseValue && value !== defaultName;
  const shown = isCustom ? value : defaultName;
  const commit = () => { onChange(draft.trim() || baseValue); setEditing(false); };
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          placeholder={defaultName}
          aria-label={editLabel}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
          }}
          className="min-w-0 flex-1"
          style={{ fontSize: T.body, fontWeight: W.label, color: K.ink, background: K.surface, border: 'none', borderRadius: 8, padding: '4px 8px', boxShadow: `inset 0 0 0 1.5px ${K.forest}` }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(isCustom ? value : ''); setEditing(true); }}
          aria-label={`${editLabel}: ${shown}`}
          className="stg-focus group inline-flex items-center gap-1.5 min-w-0 text-start"
          style={{ fontSize: T.body, fontWeight: W.label, color: K.ink, background: 'transparent', border: 'none', padding: '4px 2px', borderRadius: 8, cursor: 'text' }}
        >
          <span className="truncate">{shown}</span>
          <Pencil aria-hidden size={12} strokeWidth={2.4} className="shrink-0 opacity-30 group-hover:opacity-80" style={{ color: K.forestLight, transitionProperty: 'opacity', transitionDuration: '150ms' }} />
        </button>
      )}
      {isCustom && !editing && (
        <button type="button" onClick={() => onChange(baseValue)} title={resetLabel} aria-label={`${resetLabel}: ${defaultName}`}
          className="stg-focus stg-press inline-flex items-center justify-center shrink-0"
          style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', color: K.inkSoft, cursor: 'pointer' }}>
          <RotateCcw size={12} strokeWidth={2.4} />
        </button>
      )}
    </span>
  );
}

// ── HoverHint (portal, never clipped) ─────────────────────────────────────────
/** With children: the children plus a small info glyph, one focusable trigger named by the
 *  hint. Prefer InfoHint (the glyph alone) beside a label, so the label keeps its own name. */
export function HoverHint({ text, children }: { text: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean } | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipId = useId();
  const WIDTH = 250;
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = portalFrame();
    const top0 = f.toLocalY(r.top);
    const bottom0 = f.toLocalY(r.bottom);
    const left0 = f.toLocalX(r.left);
    const right0 = f.toLocalX(r.right);
    const left = Math.min(Math.max(f.minX + 8, (left0 + right0) / 2 - WIDTH / 2), Math.max(f.minX + 8, f.maxX - WIDTH - 8));
    const flipUp = f.maxY - bottom0 < 130 && top0 - f.minY > f.maxY - bottom0;
    setPos({ top: flipUp ? top0 - 8 : bottom0 + 8, left, flipUp });
  };
  const show = () => { if (closeTimer.current) clearTimeout(closeTimer.current); place(); setOpen(true); };
  const hide = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 140); };
  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); window.removeEventListener('keydown', onKey, true); };
  }, [open]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  const glyph = <Info aria-hidden size={14} strokeWidth={2.2} className="shrink-0" style={{ color: K.inkSoft, opacity: 0.8 }} />;
  const handlers = { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide };
  return (
    <>
      {children ? (
        <span ref={triggerRef as React.RefObject<HTMLSpanElement>} tabIndex={0} aria-label={text} className="stg-focus inline-flex items-center gap-1.5" style={{ borderRadius: 6 }} {...handlers}>
          {children}
          {glyph}
        </span>
      ) : (
        <button ref={triggerRef as React.RefObject<HTMLButtonElement>} type="button" aria-label={text} aria-describedby={open ? tipId : undefined}
          onClick={show} className="stg-focus inline-flex items-center justify-center shrink-0"
          style={{ width: 22, height: 22, padding: 0, border: 'none', background: 'transparent', borderRadius: 999, cursor: 'help' }} {...handlers}>
          {glyph}
        </button>
      )}
      {open && pos && (
        <Portal>
          <div id={tipId} role="tooltip" onMouseEnter={show} onMouseLeave={hide} className="fixed stg-body"
            style={{ zIndex: 90, top: pos.top, left: pos.left, width: WIDTH, transform: pos.flipUp ? 'translateY(-100%)' : undefined, background: K.forest, color: '#F3EAD0', borderRadius: 12, padding: '9px 12px', fontSize: T.body, fontWeight: W.body, lineHeight: LH.body, fontFamily: K.font, boxShadow: '0 14px 30px -12px rgba(5,8,20,0.55)' }}>
            {text}
          </div>
        </Portal>
      )}
    </>
  );
}

/** The explanation of a setting or a group: an info glyph that shows `text` on hover and
 *  focus. The one place a sentence of explanation lives in Settings. */
export function InfoHint({ text }: { text: string }) {
  return <HoverHint text={text} />;
}

// ── ConfirmSheet: an alertdialog inside the settings dialog ───────────────────
/** Rendered inside the dialog panel (so the panel's focus trap holds it). Escape and the
 *  cancel button close it; the Escape is consumed so the whole dialog does not close. */
export function ConfirmSheet({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel, tone = 'forest', icon: Icon, busy = false, error }: {
  title: string; body: React.ReactNode; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void;
  tone?: 'forest' | 'danger'; icon?: LucideIcon; busy?: boolean; error?: string | null;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const opener = openerRef.current;
    return () => { if (opener && opener.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  const accent = tone === 'danger' ? K.danger : K.forest;
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20, background: 'rgba(28,20,16,0.38)', padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!busy) onCancel(); } }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} className="stg-rise"
        style={{ width: '100%', maxWidth: 440, borderRadius: 24, background: K.surface, boxShadow: '0 30px 60px -20px rgba(5,8,20,0.5), 0 0 0 1px rgba(27,56,40,0.08)', padding: 24 }}>
        <h3 id={titleId} className="stg-title flex items-start gap-2.5" style={{ margin: 0, fontSize: T.section, fontWeight: W.section, lineHeight: LH.section, color: K.ink, letterSpacing: '-0.01em' }}>
          {Icon && <Icon aria-hidden size={20} strokeWidth={2.3} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />}
          <span>{title}</span>
        </h3>
        <div id={bodyId} className="stg-body" style={{ marginTop: 8, fontSize: T.body, fontWeight: W.body, lineHeight: LH.body, color: K.inkSoft }}>{body}</div>
        {error && <p role="alert" style={{ margin: '12px 0 0', fontSize: T.body, fontWeight: W.label, color: K.danger }}>{error}</p>}
        <div className="flex flex-wrap justify-end gap-2" style={{ marginTop: 20 }}>
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="stg-focus stg-press"
            style={{ height: 42, padding: '0 18px', borderRadius: 12, border: 'none', background: 'transparent', color: K.inkSoft, fontSize: T.body, fontWeight: W.label, cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.14)' }}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="stg-focus stg-press"
            style={{ height: 42, padding: '0 20px', borderRadius: 12, border: 'none', background: accent, color: tone === 'danger' ? '#FFF6EE' : K.gold, fontSize: T.body, fontWeight: W.section, cursor: busy ? 'progress' : 'pointer', boxShadow: '0 8px 18px -10px rgba(27,56,40,0.8)', opacity: busy ? 0.7 : 1 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
