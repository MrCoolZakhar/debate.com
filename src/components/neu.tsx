'use client';

/**
 * neu.tsx — Gavelling neumorphic primitives.
 *
 * Pilot design system for the organiser dashboard: one continuous ivory
 * surface (#EDE7D8 page, #F0EBDD cards), elements read as extruded or
 * pressed-in purely via a forest-tinted dual-shadow pair — never neutral
 * black, never white cards. Vibrancy lives ONLY in small gradient icon
 * discs and the single accent gradient; everything else stays calm.
 *
 * Dependency-free (inline styles + lucide icons already in the app).
 */

import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';

// ── Tokens ─────────────────────────────────────────────────────────────────

export const OUTFIT = "'Outfit', sans-serif";
export const EASE = 'cubic-bezier(0.22,1,0.36,1)';

export const NEU = {
  base: '#EDE7D8',      // page background
  surface: '#F0EBDD',   // card surface — a hair lighter, same family
  ink: '#1C1410',
  forest: '#1B3828',
  gold: '#EED98A',
  deepGold: '#B6871F',
  amber: '#B8844A',
  green: '#3D7A52',
  muted: '#9A8A78',
  // Extruded pair — light top-left, forest-tinted dark bottom-right.
  out: '-6px -6px 14px rgba(255,255,255,0.85), 8px 8px 20px rgba(27,56,40,0.16)',
  outHover: '-8px -8px 18px rgba(255,255,255,0.92), 10px 10px 26px rgba(27,56,40,0.21)',
  // Tighter, crisper pair for small chips/discs/buttons.
  outSm: '-3px -3px 7px rgba(255,255,255,0.9), 4px 4px 9px rgba(27,56,40,0.15)',
  outSmHover: '-4px -4px 9px rgba(255,255,255,0.95), 5px 5px 12px rgba(27,56,40,0.2)',
  // Pressed-in pair — wells, tracks, done rows.
  in: 'inset 4px 4px 10px rgba(27,56,40,0.14), inset -4px -4px 10px rgba(255,255,255,0.8)',
  inSm: 'inset 2px 2px 6px rgba(27,56,40,0.13), inset -2px -2px 6px rgba(255,255,255,0.8)',
} as const;

/** Saturated two-stop gradients — the only place "vibrant" is allowed. */
export const NEU_GRADIENTS = {
  forest: ['#1B3828', '#3D7A52'] as [string, string],
  gold: ['#EED98A', '#B6871F'] as [string, string],
  amber: ['#B8844A', '#8A5A2E'] as [string, string],
  sage: ['#3D7A52', '#7FA98C'] as [string, string],
  green: ['#2F6644', '#3D7A52'] as [string, string],
};

export type NeuGradient = [string, string];

type LucideIcon = React.ComponentType<{
  size?: number;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

const grad = (g: NeuGradient) => `linear-gradient(135deg, ${g[0]}, ${g[1]})`;

// ── NeuCard — extruded container ───────────────────────────────────────────

export function NeuCard({
  children,
  hover = false,
  onClick,
  className,
  style,
}: {
  children: React.ReactNode;
  hover?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const lifted = hover && hovered;
  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={hover ? () => setHovered(true) : undefined}
      onMouseLeave={hover ? () => setHovered(false) : undefined}
      style={{
        backgroundColor: NEU.surface,
        borderRadius: 22,
        boxShadow: lifted ? NEU.outHover : NEU.out,
        transform: lifted ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}`,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── NeuInset — pressed-in well ─────────────────────────────────────────────

export function NeuInset({
  children,
  className,
  style,
  small = false,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  small?: boolean;
}) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: NEU.base,
        borderRadius: 16,
        boxShadow: small ? NEU.inSm : NEU.in,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── NeuIconDisc — small vibrant gradient squircle holding a white icon ─────

export function NeuIconDisc({
  gradient,
  icon: Icon,
  size = 38,
  iconColor = '#FFFFFF',
  style,
}: {
  gradient: NeuGradient;
  icon: LucideIcon;
  size?: number;
  iconColor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(12, Math.round(size * 0.34)),
        background: grad(gradient),
        boxShadow: `0 4px 10px ${gradient[0]}44, ${NEU.outSm}`,
        ...style,
      }}
    >
      <Icon size={Math.round(size * 0.48)} strokeWidth={2.2} style={{ color: iconColor }} />
    </span>
  );
}

// ── Sparkline — smooth curve with an emphasised end dot ────────────────────

/** Catmull-Rom → cubic bezier path through points. Exported for chart reuse. */
export function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  const r = (n: number) => Math.round(n * 100) / 100;
  let d = `M ${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${r(p1.x + (p2.x - p0.x) / 6)} ${r(p1.y + (p2.y - p0.y) / 6)}, ${r(p2.x - (p3.x - p1.x) / 6)} ${r(p2.y - (p3.y - p1.y) / 6)}, ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 64;
  const h = 26;
  const pad = 3;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: pad + (i * (w - 2 * pad)) / (data.length - 1),
    y: h - pad - ((v - min) / range) * (h - 2 * pad),
  }));
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', flexShrink: 0 }} aria-hidden>
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      <circle cx={last.x} cy={last.y} r={3} fill={color} stroke="#FFFFFF" strokeWidth={1.5} />
    </svg>
  );
}

// ── NeuStatTile — icon disc + big number + muted label + sparkline ─────────

export function NeuStatTile({
  icon,
  gradient,
  value,
  label,
  spark,
  delta,
  style,
}: {
  icon: LucideIcon;
  gradient: NeuGradient;
  value: number | string;
  label: string;
  spark?: number[];
  delta?: string;
  style?: React.CSSProperties;
}) {
  return (
    <NeuCard style={{ padding: '16px 18px', ...style }}>
      <div className="flex items-start justify-between gap-2">
        <NeuIconDisc gradient={gradient} icon={icon} />
        {spark && spark.length > 1 && <Sparkline data={spark} color={gradient[1]} />}
      </div>
      <p
        style={{
          fontFamily: OUTFIT, fontWeight: 900, fontSize: 28, lineHeight: 1,
          color: NEU.ink, fontVariantNumeric: 'tabular-nums', marginTop: 14,
        }}
      >
        {value}
      </p>
      <p className="flex items-baseline gap-1.5" style={{ marginTop: 5 }}>
        <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: NEU.muted }}>{label}</span>
        {delta && (
          <span style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, color: NEU.green, fontVariantNumeric: 'tabular-nums' }}>
            {delta}
          </span>
        )}
      </p>
    </NeuCard>
  );
}

// ── NeuProgress — inset track + gradient fill, optional thumb ──────────────

export function NeuProgress({
  value,
  max,
  gradient = NEU_GRADIENTS.forest,
  height = 12,
  thumb = false,
  style,
}: {
  value: number;
  max: number;
  gradient?: NeuGradient;
  height?: number;
  thumb?: boolean;
  style?: React.CSSProperties;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const thumbSize = height + 4;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      style={{
        position: 'relative',
        height,
        borderRadius: 999,
        backgroundColor: NEU.base,
        boxShadow: NEU.inSm,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: pct === 0 ? 0 : `max(${(pct * 100).toFixed(1)}%, ${height}px)`,
          borderRadius: 999,
          background: grad(gradient),
          boxShadow: `0 2px 6px ${gradient[0]}55`,
          transition: `width 600ms ${EASE}`,
        }}
      />
      {thumb && pct > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: `max(${(pct * 100).toFixed(1)}%, ${height}px)`,
            transform: 'translate(-60%, -50%)',
            width: thumbSize, height: thumbSize,
            borderRadius: 999,
            background: gradient[1],
            border: '2.5px solid #FFFFFF',
            boxShadow: '0 2px 6px rgba(27,56,40,0.3)',
            transition: `left 600ms ${EASE}`,
          }}
        />
      )}
    </div>
  );
}

// ── NeuRing — donut progress, gradient stroke + rounded caps ───────────────

export function NeuRing({
  value,
  max,
  size = 88,
  strokeWidth = 9,
  gradient = NEU_GRADIENTS.gold,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  gradient?: NeuGradient;
  children?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const gid = `neu-ring-${gradient[0].replace('#', '')}-${gradient[1].replace('#', '')}`;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
        {/* inset-looking track: dark inner edge + light outer relief */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(27,56,40,0.12)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r - strokeWidth / 2 - 0.5} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gid})`} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: `stroke-dashoffset 700ms ${EASE}` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

// ── NeuPill — small chip; extruded by default, gradient-filled when active ─

export function NeuPill({
  children,
  active = false,
  gradient = NEU_GRADIENTS.forest,
  style,
}: {
  children: React.ReactNode;
  active?: boolean;
  gradient?: NeuGradient;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        padding: '4px 12px',
        borderRadius: 999,
        fontFamily: OUTFIT,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.04em',
        fontVariantNumeric: 'tabular-nums',
        backgroundColor: active ? undefined : NEU.surface,
        background: active ? grad(gradient) : undefined,
        color: active ? '#FFFFFF' : NEU.ink,
        boxShadow: active ? `0 3px 8px ${gradient[0]}55, ${NEU.outSm}` : NEU.outSm,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ── NeuButton — fully-rounded gradient pill CTA ────────────────────────────

export function NeuButton({
  children,
  onClick,
  gradient = NEU_GRADIENTS.forest,
  textColor,
  icon: Icon,
  disabled = false,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  gradient?: NeuGradient;
  textColor?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const color = textColor ?? (gradient === NEU_GRADIENTS.gold ? NEU.forest : NEU.gold);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center justify-center gap-2 focus:outline-none"
      style={{
        padding: '11px 22px',
        borderRadius: 999,
        border: 'none',
        background: disabled ? 'rgba(27,56,40,0.14)' : grad(gradient),
        color: disabled ? NEU.muted : color,
        fontFamily: OUTFIT,
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '0.05em',
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: disabled ? 'none' : hovered ? `0 6px 16px ${gradient[0]}66, ${NEU.outSmHover}` : `0 4px 10px ${gradient[0]}4D, ${NEU.outSm}`,
        transform: hovered && !disabled ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}`,
        ...style,
      }}
    >
      {Icon && <Icon size={15} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

// ── NeuChecklistRow — journey row: pending = extruded, done = pressed in ───

export function NeuChecklistRow({
  done,
  icon: Icon,
  title,
  sub,
  action,
  gradient = NEU_GRADIENTS.forest,
  onClick,
}: {
  done: boolean;
  icon: LucideIcon;
  title: string;
  sub?: string;
  /** Extra node on the right of a pending row (e.g. a secondary inline link). */
  action?: React.ReactNode;
  /** Gradient for the pending row's icon disc — where "vibrant" lives. */
  gradient?: NeuGradient;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const clickable = !done && !!onClick;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3.5 focus:outline-none"
      style={{
        padding: '11px 14px',
        borderRadius: 16,
        backgroundColor: done ? NEU.base : NEU.surface,
        boxShadow: done ? NEU.inSm : clickable && hovered ? NEU.outSmHover : NEU.outSm,
        transform: clickable && hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}`,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      {done ? (
        <NeuIconDisc gradient={NEU_GRADIENTS.green} icon={Check} size={34} />
      ) : (
        <NeuIconDisc gradient={gradient} icon={Icon} size={34} />
      )}

      <div className="flex-1 min-w-0">
        <p
          className="truncate"
          style={{
            fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
            color: done ? NEU.muted : NEU.ink,
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: 'rgba(154,138,120,0.55)',
          }}
        >
          {title}
        </p>
        {sub && (
          <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, marginTop: 1 }}>
            {sub}
          </p>
        )}
      </div>

      {done ? (
        <span
          style={{
            fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
            color: NEU.green, flexShrink: 0,
          }}
        >
          DONE
        </span>
      ) : (
        <span className="flex items-center gap-1 flex-shrink-0">
          {action}
          <ChevronRight
            size={16}
            style={{
              color: hovered ? NEU.forest : NEU.muted,
              transform: hovered ? 'translateX(2px)' : 'translateX(0)',
              transition: `transform 260ms ${EASE}, color 260ms ${EASE}`,
            }}
          />
        </span>
      )}
    </div>
  );
}
