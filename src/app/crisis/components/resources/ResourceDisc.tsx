'use client';
// Gavelling Crisis: a cabinet resource as a round tile. The icon sits in a tinted disc, the amount big under it,
// and beside the amount, small, how much it last changed (green with an up arrow, red with a down arrow).
// Clicking it opens the resource's history graph (the parent decides how: a pop-up, or a step inside one).

import { ArrowDown, ArrowUp } from 'lucide-react';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { cabinetTint, CK, resourceIcon } from '../../crisisKit';

export default function ResourceDisc({ name, unit, value, change, color, onOpen, size = 'md' }: {
  name: string;
  unit?: string | null;
  value: number;
  /** The newest change; 0 or undefined = nothing to show. */
  change?: number;
  /** The cabinet's colour (tints the disc and the icon). */
  color: string;
  onOpen: () => void;
  size?: 'md' | 'sm';
}) {
  const disc = size === 'sm' ? 38 : 46;
  const up = (change ?? 0) > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${name}: see how it changed`}
      aria-label={`${name}, ${fmtAmount(value)}${unit ? ` ${unit}` : ''}${change ? `, last change ${up ? 'up' : 'down'} ${fmtAmount(Math.abs(change))}` : ''}. See how it changed`}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform hover:-translate-y-px active:scale-[0.97]"
      style={{
        border: 0, cursor: 'pointer', background: CK.well, borderRadius: 16, padding: '10px 6px 9px', minWidth: 0, fontFamily: CK.font, color: CK.ink,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center',
      }}
    >
      <span
        aria-hidden
        style={{
          width: disc, height: disc, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', color,
          background: cabinetTint(color, 0.15), boxShadow: `inset 0 0 0 1px ${cabinetTint(color, 0.22)}`,
        }}
      >
        {resourceIcon(name, size === 'sm' ? 18 : 22)}
      </span>
      <span className="inline-flex items-baseline justify-center flex-wrap" style={{ gap: '0 5px', lineHeight: 1.1 }}>
        <b style={{ fontSize: size === 'sm' ? 17 : 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(value)}</b>
        {change ? (
          <span className="inline-flex items-center" style={{ gap: 1, fontSize: 11.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: up ? CK.ok : CK.danger }}>
            {up ? <ArrowUp size={11} strokeWidth={2} aria-hidden /> : <ArrowDown size={11} strokeWidth={2} aria-hidden />}
            {fmtAmount(Math.abs(change as number))}
          </span>
        ) : null}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
        {name}{unit ? <span style={{ color: CK.muted }}> ({unit})</span> : null}
      </span>
    </button>
  );
}
