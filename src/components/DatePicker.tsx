'use client';

// Friendly calendar date picker, a drop-in replacement for <input type="date">.
// Shows a readable trigger ("12 Mar 2026") and a click-to-open month grid so
// picking a date never means fighting a native OS date control. Forest/ivory
// neumorphic styling. Value in/out is an ISO date string (YYYY-MM-DD).

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, X as XIcon } from 'lucide-react';
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

// ── Time mode ──────────────────────────────────────────────────────────────
// With `withTime`, value/onChange speak 'YYYY-MM-DDTHH:mm' (the same local,
// zone-free shape <input type="datetime-local"> used) instead of 'YYYY-MM-DD'.
// The calendar is unchanged; a clock row is added under the grid, and the
// trigger prints "16 Jul 2026 · 09:00".

/** 'HH:mm' out of a datetime-local string, defaulting to 09:00. */
function timeOf(value: string | null | undefined): { h: number; m: number } {
  const t = /T(\d{2}):(\d{2})/.exec(value ?? '');
  return t ? { h: Number(t[1]), m: Number(t[2]) } : { h: 9, m: 0 };
}
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function fmtTime(h: number, m: number): string {
  return `${pad2(h)}:${pad2(m)}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DatePicker({
  value, onChange, min, max, placeholder = 'Select a date', disabled, initialView,
  id, describedBy, invalid = false, variant = 'default',
  withTime = false, clearable = false, zoneNote,
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
  // ── Additive, all optional. Every pre-existing call site omits them and
  // renders byte-identically to before. ─────────────────────────────────────
  /** DOM id for the trigger, so an external <label htmlFor> actually binds. */
  id?: string;
  /** id list for help/error copy, announced with the trigger. */
  describedBy?: string;
  /** Paints the danger boundary and sets aria-invalid. */
  invalid?: boolean;
  /**
   * 'well' seats the trigger in the pressed-in input well used by the apply
   * wizard's question cards: 16px type (the iOS no-zoom floor), radius 14,
   * inset shadow and a focus ring. 'default' is the original inline trigger.
   */
  variant?: 'default' | 'well';
  /**
   * Datetime mode. `value` / `onChange` become 'YYYY-MM-DDTHH:mm' (local,
   * zone-free — exactly what <input type="datetime-local"> carried), the
   * popover grows a time row, and the trigger reads "16 Jul 2026 · 09:00".
   */
  withTime?: boolean;
  /** Adds a clear (×) affordance for optional dates. Emits ''. */
  clearable?: boolean;
  /** Small line printed under the time row, e.g. the organiser's timezone. */
  zoneNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseISO(value), [value]);
  const { h: hour, m: minute } = useMemo(() => timeOf(value), [value]);

  /** Emit in whichever shape this instance speaks. */
  const emit = useCallback((iso: string, h = hour, m = minute) => {
    onChange(withTime ? `${iso}T${fmtTime(h, m)}` : iso);
  }, [onChange, withTime, hour, minute]);
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
        id={id}
        type="button"
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2.5 text-left focus:outline-none ${variant === 'well' ? '' : 'rounded-xl px-4 py-3'}`}
        style={{
          fontFamily: OUTFIT,
          // 16px in the well: it sits among real text inputs in the apply
          // wizard and a 15px neighbour would read as a different control.
          fontSize: variant === 'well' ? 16 : 15,
          // #8C7E68 clears WCAG 1.4.11 (3:1 non-text contrast) against the ivory
          // page, the card surface and this trigger's own fill; #DDD4C0 was
          // 1.19:1 and the control boundary read as no boundary at all.
          backgroundColor: variant === 'well' ? '#EDE7D8' : '#FAF8F3',
          border: `${variant === 'well' ? 1.5 : 1}px solid ${invalid ? '#8B2020' : open ? '#1B3828' : '#8C7E68'}`,
          // #5B4F42 === NEU.inkSoft (6.44:1 on the ivory page). #9A8A78 was 3.15:1.
          color: selected ? '#1C1410' : '#5B4F42', cursor: disabled ? 'default' : 'pointer',
          transition: 'border-color 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 220ms cubic-bezier(0.22,1,0.36,1)',
          fontVariantNumeric: 'tabular-nums',
          ...(variant === 'well' ? {
            height: 52, padding: '0 16px', borderRadius: 14,
            // NEU.in, plus the same 3px focus ring the other wells use.
            boxShadow: open
              ? 'inset 4px 4px 10px rgba(27,56,40,0.14), inset -4px -4px 10px rgba(255,255,255,0.8), 0 0 0 3px rgba(27,56,40,0.13)'
              : 'inset 4px 4px 10px rgba(27,56,40,0.14), inset -4px -4px 10px rgba(255,255,255,0.8)',
          } : null),
        }}
      >
        <CalendarDays size={17} style={{ color: '#B6871F', flexShrink: 0 }} />
        <span className="flex-1 truncate">
          {selected ? (withTime ? `${fmt(selected)} · ${fmtTime(hour, minute)}` : fmt(selected)) : placeholder}
        </span>
        {clearable && selected && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onChange(''); } }}
            className="flex items-center justify-center flex-shrink-0 rounded-full"
            style={{ width: 20, height: 20, color: '#9A8A78', cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.08)'; (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          >
            <XIcon size={13} strokeWidth={2.6} />
          </span>
        )}
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
                  onClick={() => { emit(toISO(d)); if (!withTime) setOpen(false); }}
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

          {/* Time row. Only in datetime mode: the calendar alone cannot answer
              "9am or midnight?", and an application window that silently opens
              at 00:00 is the bug this replaces. */}
          {withTime && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #DDD4C0' }}>
              <div className="flex items-center gap-2">
                <Clock size={15} strokeWidth={2.2} style={{ color: '#B6871F', flexShrink: 0 }} />
                <select
                  aria-label="Hour"
                  value={hour}
                  onChange={(e) => emit(selected ? toISO(selected) : toISO(view), Number(e.target.value), minute)}
                  className="focus:outline-none rounded-lg px-2 py-1.5"
                  style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, color: '#1C1410', backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}
                >
                  {HOURS.map(h => <option key={h} value={h}>{pad2(h)}</option>)}
                </select>
                <span style={{ fontFamily: OUTFIT, fontWeight: 800, color: '#9A8A78' }}>:</span>
                <select
                  aria-label="Minute"
                  value={MINUTES.includes(minute) ? minute : 0}
                  onChange={(e) => emit(selected ? toISO(selected) : toISO(view), hour, Number(e.target.value))}
                  className="focus:outline-none rounded-lg px-2 py-1.5"
                  style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, color: '#1C1410', backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}
                >
                  {MINUTES.map(m => <option key={m} value={m}>{pad2(m)}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ml-auto rounded-lg px-3 py-1.5 focus:outline-none"
                  style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', backgroundColor: '#1B3828', color: '#EED98A', border: 'none', cursor: 'pointer' }}
                >
                  DONE
                </button>
              </div>
              {zoneNote && (
                <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#9A8A78', margin: '8px 0 0' }}>{zoneNote}</p>
              )}
            </div>
          )}
        </div>
        </Portal>
      )}
    </div>
  );
}
