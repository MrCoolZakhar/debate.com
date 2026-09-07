'use client';

// Shared neumorphic filter popover, the Applications page's FILTERS pattern
// (src/app/manage/[slug]/applications/page.tsx) extracted so every
// list-filtering surface gets the same popover, chip styling, and section
// layout. Each caller keeps its own filter state shape and section
// composition (options, values, active-count math) — only the generic
// shell/chip/heading/group primitives live here. The shell portals its
// panel at fixed viewport coordinates (mirrors PaymentMenu/QuickAllocate in
// applications/page.tsx) so it's never clipped by an ancestor's overflow.

import { useState, useRef, useCallback, useEffect, type ComponentType } from 'react';
import { SlidersHorizontal, Filter, Check } from 'lucide-react';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuIconDisc } from '@/components/neu';
import Portal from '@/components/Portal';

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

const PANEL_WIDTH = 340;
const VIEWPORT_MARGIN = 12;
/** Gap between the trigger and the panel, on whichever side it opens. */
const PANEL_GAP = 10;
/** Below this the panel is too short to be worth opening on that side, so we
 *  flip rather than squeeze. */
const MIN_PANEL_HEIGHT = 220;

/** The FILTERS button + floating popover shell, portaled at fixed viewport
 *  coordinates so a clipping ancestor (a rounded overflow:hidden card, a
 *  scrollable sidebar) can never cut it off. Click opens/closes, click
 *  outside closes; position re-measures on resize AND scroll (stays open
 *  and follows, rather than closing, since the trigger can live in a
 *  scrollable toolbar). Right edge of the panel aligns with the right edge
 *  of the button, clamped within the viewport. Sections are passed as
 *  children so each caller composes its own FilterGroup/date-range/etc
 *  content without this shell knowing its shape. */
export function FilterPopoverShell({
  title, activeCount, onClearAll, children,
}: {
  title: string;
  activeCount: number;
  onClearAll: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<
    { top?: number; bottom?: number; left: number; width: number; maxHeight: number; flipped: boolean } | null
  >(null);

  // Places the panel so it can never run off the viewport (AGENTS.md UI rule:
  // a floating layer must never be clipped, and must flip upward when there
  // is not enough room below). This previously pinned `top` at the trigger's
  // bottom edge and floored maxHeight at 160px, so a trigger low in a phone
  // viewport put the whole panel below the fold with no way to scroll to it.
  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    let left = r.right - width; // panel's right edge matches the button's right edge
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));

    // Usable height on each side of the trigger, once the gap and the viewport
    // margin are paid for.
    const below = window.innerHeight - r.bottom - PANEL_GAP - VIEWPORT_MARGIN;
    const above = r.top - PANEL_GAP - VIEWPORT_MARGIN;

    if (below < MIN_PANEL_HEIGHT && above < MIN_PANEL_HEIGHT) {
      // A short viewport (a phone in landscape, a keyboard open): neither side
      // fits, so ignore the trigger and fill the viewport instead of hanging
      // off an edge.
      setPos({
        top: VIEWPORT_MARGIN, left, width,
        maxHeight: Math.max(120, window.innerHeight - VIEWPORT_MARGIN * 2),
        flipped: false,
      });
      return;
    }
    if (below < MIN_PANEL_HEIGHT && above > below) {
      // Anchor to the trigger's TOP edge and grow upward — `bottom` rather
      // than `top`, because the panel's height depends on its content.
      // Clamped so a trigger scrolled past the bottom edge cannot push the
      // panel off with it (place() re-runs on scroll, so this is live).
      const bottom = Math.max(VIEWPORT_MARGIN, window.innerHeight - r.top + PANEL_GAP);
      setPos({
        bottom, left, width,
        maxHeight: Math.min(above, window.innerHeight - bottom - VIEWPORT_MARGIN),
        flipped: true,
      });
      return;
    }
    // Same clamp on the other side, for a trigger scrolled above the viewport.
    const top = Math.max(VIEWPORT_MARGIN, r.bottom + PANEL_GAP);
    setPos({ top, left, width, maxHeight: window.innerHeight - top - VIEWPORT_MARGIN, flipped: false });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    place();
    setOpen(true);
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={toggle}
        className="inline-flex items-center gap-2 focus:outline-none"
        style={{
          padding: '9px 16px',
          borderRadius: 999,
          fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em',
          color: open ? '#FFFFFF' : NEU.ink,
          background: open ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
          boxShadow: open ? `0 4px 10px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : NEU.outSm,
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
              color: open ? NEU.forest : '#FFFFFF',
              background: open ? NEU.gold : NEU.forest,
            }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && pos && (
        <Portal>
          <div
            ref={panelRef}
            className="z-40"
            style={{
              position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width,
              maxHeight: pos.maxHeight, overflowY: 'auto',
              backgroundColor: NEU.surface, borderRadius: 20, boxShadow: NEU.out,
              padding: 18,
              animation: `${pos.flipped ? 'neuFadeInUp' : 'neuFadeIn'} 200ms ${EASE}`,
            }}
          >
            <style>{`@keyframes neuFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes neuFadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
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
        </Portal>
      )}
    </div>
  );
}
