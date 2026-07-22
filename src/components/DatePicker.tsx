'use client';

// Friendly calendar date picker, a drop-in replacement for <input type="date">.
// Shows a readable trigger ("12 Mar 2026") and a click-to-open month grid so
// picking a date never means fighting a native OS date control. Forest/ivory
// neumorphic styling. Value in/out is an ISO date string (YYYY-MM-DD).

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import Portal from '@/components/Portal';

const OUTFIT = "'Outfit', sans-serif";
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function parseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function toISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function fmt(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DatePicker({
  value, onChange, min, max, placeholder = 'Select a date', disabled, initialView,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  // Seeds the visible month when there is no value yet (ISO 'YYYY-MM-DD').
  // Handy for far-past pickers like date of birth so the calendar doesn't
  // open on today and force a long trek backwards.
  initialView?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseISO(value), [value]);
  const minDate = useMemo(() => parseISO(min), [min]);
  const maxDate = useMemo(() => parseISO(max), [max]);
  const [view, setView] = useState<Date>(() => selected ?? parseISO(initialView) ?? new Date());
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useEffect(() => { if (selected) setView(selected); }, [selected]);

  // The calendar is rendered through a Portal at fixed viewport coordinates so
  // it can never be clipped by an ancestor's overflow (e.g. a scrollable filter
  // popover or an overflow-hidden card) or run off the viewport. Opens below the
  // trigger, flips to whichever side has more room, and clamps horizontally so
  // it always stays on screen. On a viewport short enough that NEITHER side has
  // full room for it (a real case on small screens with the field low on the
  // page), it's also height-capped and made internally scrollable instead of
  // hanging off the edge with rows no scroll can reach.
  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const margin = 8;
    const width = 300;
    const height = menuRef.current?.offsetHeight ?? 372;
    let left = r.left;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
    left = Math.max(margin, left);

    const spaceBelow = window.innerHeight - margin - (r.bottom + 8);
    const spaceAbove = r.top - 8 - margin;
    const flip = height > spaceBelow && spaceAbove > spaceBelow;
    const top = flip ? Math.max(margin, r.top - 8 - height) : r.bottom + 8;
    const available = flip ? r.top - 8 - top : window.innerHeight - margin - top;
    setPos({ top, left, maxHeight: Math.max(160, Math.min(height, available)) });
  }, []);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    place();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const grid = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startDow = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  function disabledDay(d: Date): boolean {
    const day = startOfDay(d);
    if (minDate && day < startOfDay(minDate)) return true;
    if (maxDate && day > startOfDay(maxDate)) return true;
    return false;
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 rounded-xl px-4 py-3 text-left focus:outline-none"
        style={{
          fontFamily: OUTFIT, fontSize: 15,
          backgroundColor: '#FAF8F3', border: `1px solid ${open ? '#1B3828' : '#DDD4C0'}`,
          color: selected ? '#1C1410' : '#9A8A78', cursor: disabled ? 'default' : 'pointer',
          transition: 'border-color 180ms cubic-bezier(0.22,1,0.36,1)', fontVariantNumeric: 'tabular-nums',
        }}
      >
        <CalendarDays size={17} style={{ color: '#B6871F', flexShrink: 0 }} />
        <span>{selected ? fmt(selected) : placeholder}</span>
      </button>

      {open && pos && (
        <Portal>
        <div
          ref={menuRef}
          className="rounded-2xl p-3"
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
            width: 300, maxHeight: pos.maxHeight, overflowY: 'auto',
            backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0',
            boxShadow: '0 20px 48px rgba(27,56,40,0.18), 0 2px 8px rgba(27,56,40,0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              className="rounded-lg p-1.5 focus:outline-none" style={{ color: '#1B3828' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, color: '#1C1410' }}>
              <select value={view.getMonth()} onChange={(e) => setView(new Date(view.getFullYear(), Number(e.target.value), 1))}
                className="focus:outline-none" style={{ fontFamily: OUTFIT, fontWeight: 800, color: '#1C1410', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <input type="number" value={view.getFullYear()} onChange={(e) => { const y = Number(e.target.value); if (y >= 1900 && y <= 2100) setView(new Date(y, view.getMonth(), 1)); }}
                className="focus:outline-none" style={{ width: 58, fontFamily: OUTFIT, fontWeight: 800, color: '#1C1410', background: 'transparent', border: 'none', fontVariantNumeric: 'tabular-nums' }} />
            </div>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className="rounded-lg p-1.5 focus:outline-none" style={{ color: '#1B3828' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DOW.map((d) => (
              <div key={d} className="text-center" style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 700, color: '#9A8A78', letterSpacing: '0.04em' }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d, i) => {
              if (!d) return <div key={i} />;
              const isSel = selected && toISO(d) === toISO(selected);
              const off = disabledDay(d);
              return (
                <button key={i} type="button" disabled={off}
                  onClick={() => { onChange(toISO(d)); setOpen(false); }}
                  className="aspect-square rounded-lg flex items-center justify-center focus:outline-none"
                  style={{
                    fontFamily: OUTFIT, fontSize: 13, fontWeight: isSel ? 800 : 500, fontVariantNumeric: 'tabular-nums',
                    backgroundColor: isSel ? '#1B3828' : 'transparent',
                    color: off ? '#CFC6B4' : isSel ? '#EED98A' : '#1C1410',
                    cursor: off ? 'default' : 'pointer', transition: 'background-color 140ms',
                  }}
                  onMouseEnter={(e) => { if (!isSel && !off) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
                  onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
