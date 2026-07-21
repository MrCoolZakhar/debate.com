'use client';

// Shared neumorphic filter popover, the Applications page's FILTERS pattern
// (src/app/manage/[slug]/applications/page.tsx) extracted so every
// list-filtering surface gets the same hover-to-open/click-to-pin popover,
// chip styling, and section layout. Each caller keeps its own filter state
// shape and section composition (options, values, active-count math) —
// only the generic shell/chip/heading/group primitives live here.

import { useState, useRef, type ComponentType } from 'react';
import { SlidersHorizontal, Filter, Check } from 'lucide-react';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuIconDisc } from '@/components/neu';

export type LucideGlyph = ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

export function toggleIn(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

/** A small pressed-in checkbox chip inside a filter popover. */
export function CheckChip({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 focus:outline-none"
      style={{
        padding: '5px 11px',
        borderRadius: 999,
        fontFamily: OUTFIT,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: checked ? '#FFFFFF' : NEU.ink,
        background: checked ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
        boxShadow: checked ? `0 3px 8px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : NEU.outSm,
        border: 'none',
        cursor: 'pointer',
        transition: `box-shadow 180ms ${EASE}`,
      }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 13, height: 13, borderRadius: 4,
          background: checked ? 'rgba(255,255,255,0.9)' : NEU.base,
          boxShadow: checked ? 'none' : NEU.inSm,
        }}
      >
        {checked && <Check size={10} strokeWidth={3.5} style={{ color: NEU.forest }} />}
      </span>
      {label}
    </button>
  );
}

/** Emphasised group heading for the filter popover: a small leading lucide icon
 *  plus a slightly larger, bolder, inked label so each section reads as a proper
 *  heading rather than a faint caption. */
export function FilterHeading({ icon, children }: { icon: LucideGlyph; children: React.ReactNode }) {
  const Icon = icon;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} strokeWidth={2.6} style={{ color: NEU.deepGold }} />
      <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 900, letterSpacing: '0.09em', color: NEU.ink, textTransform: 'uppercase' }}>
        {children}
      </span>
    </span>
  );
}

/** Multi-select chip section: options OR together, ALL/NONE quick-select. */
export function FilterGroup({
  title, icon, options, selected, onToggle, onAll, onNone,
}: {
  title: string;
  icon: LucideGlyph;
  options: { label: string; value: string }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onAll: () => void;
  onNone: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <FilterHeading icon={icon}>{title}</FilterHeading>
        <div className="flex items-center gap-2">
          <button onClick={onAll} className="focus:outline-none" style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: NEU.forest, background: 'none', border: 'none', cursor: 'pointer' }}>ALL</button>
          <span style={{ color: NEU.muted, opacity: 0.5 }}>·</span>
          <button onClick={onNone} className="focus:outline-none" style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer' }}>NONE</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <CheckChip key={o.value} label={o.label} checked={selected.has(o.value)} onClick={() => onToggle(o.value)} />
        ))}
      </div>
    </div>
  );
}

/** The FILTERS button + floating popover shell. Hover opens, click pins
 *  open; sections are passed as children so each caller composes its own
 *  FilterGroup/date-range/etc content without this shell knowing its shape. */
export function FilterPopoverShell({
  title, activeCount, onClearAll, children,
}: {
  title: string;
  activeCount: number;
  onClearAll: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = open || pinned;
  const clearTimer = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const scheduleClose = () => { clearTimer(); closeTimer.current = setTimeout(() => setOpen(false), 160); };

  return (
    <div
      className="relative"
      onMouseEnter={() => { clearTimer(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setPinned(p => !p)}
        className="inline-flex items-center gap-2 focus:outline-none"
        style={{
          padding: '9px 16px',
          borderRadius: 999,
          fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em',
          color: show ? '#FFFFFF' : NEU.ink,
          background: show ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
          boxShadow: show ? `0 4px 10px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : NEU.outSm,
          border: 'none', cursor: 'pointer',
          transition: `box-shadow 200ms ${EASE}`,
        }}
      >
        <SlidersHorizontal size={14} strokeWidth={2.5} />
        FILTERS
        {activeCount > 0 && (
          <span
            className="inline-flex items-center justify-center"
            style={{
              minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
              fontFamily: OUTFIT, fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
              color: show ? NEU.forest : '#FFFFFF',
              background: show ? NEU.gold : NEU.forest,
            }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {show && (
        <div
          className="absolute z-40"
          style={{
            top: 'calc(100% + 10px)', right: 0, left: 'auto',
            width: 'min(340px, calc(100vw - 40px))',
            maxHeight: 'calc(100vh - 150px)', overflowY: 'auto',
            backgroundColor: NEU.surface, borderRadius: 20, boxShadow: NEU.out,
            padding: 18,
            animation: `neuFadeIn 200ms ${EASE}`,
          }}
        >
          <style>{`@keyframes neuFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Filter} size={26} />
              <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 900, color: NEU.ink }}>{title}</p>
            </div>
            {activeCount > 0 && (
              <button
                onClick={onClearAll}
                className="focus:outline-none"
                style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: '#8B2020', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                CLEAR ALL
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
