'use client';

/**
 * CurrencyPicker — the one currency control for the whole app.
 *
 * Replaces the native <select> that every fee field used to render (a list of
 * ~54 bare codes, unsearchable, and on iOS a full-screen OS wheel). Instead:
 * a flagged trigger, a portaled panel with a search box, the visitor's likely
 * currency suggested at the top, then the pinned USD/EUR/GBP block, then the
 * alphabetical remainder.
 *
 * It is presentation only. `value`/`onChange` speak the ISO 4217 code exactly
 * as it is stored (upper case, never re-cased), so `fee_currency`, add-on
 * `currency`, voucher matching and every formatting helper are untouched.
 *
 * Rules it obeys (AGENTS.md, UI RULES):
 *  - The panel is portaled at FIXED viewport coordinates measured from the
 *    trigger, re-placed on scroll (capture) and resize, closed on outside
 *    click that accounts for the portaled node, clamped horizontally, and
 *    FLIPPED UPWARD when there is not enough room below. Several call sites
 *    sit inside scrollable panels and overflow-hidden cards, which is why an
 *    in-flow absolute dropdown was never an option here.
 *  - Rectangular flags only, through getFlagUrl/FlagImg. A flag that fails to
 *    load leaves its well empty; the row itself never moves.
 *  - Lucide icons only, focus:outline-none on every button, no em dashes.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, MapPin, Search } from 'lucide-react';
import Portal from '@/components/Portal';
import { FlagImg } from '@/components/FlagImg';
import {
  CURRENCIES,
  PINNED_CURRENCY_CODES,
  currencyMatches,
  currencyForCountry,
  findCurrency,
  type CurrencyOption,
} from '@/lib/currencies';

const OUTFIT = "'Outfit', sans-serif";
const EASE = 'cubic-bezier(0.22,1,0.36,1)';
const INK = '#1C1410';
/** NEU.inkSoft's resolved value. `muted` (#9A8A78) is a 3.15:1 wash and must
 *  never carry the row's secondary line. */
const INK_SOFT = '#5B4F42';
const FOREST = '#1B3828';
const SURFACE = '#FAF8F3';
const WELL = '#EDE7D8';
const HAIRLINE = '#DDD4C0';

/** Minimum tap target, WCAG 2.5.5. Applies to the trigger and every row. */
const TAP = 44;
const VIEWPORT_MARGIN = 10;
const PANEL_GAP = 6;
const MIN_PANEL_WIDTH = 268;
const MAX_PANEL_WIDTH = 340;
/** Below this the panel is too squeezed to be worth opening on that side, so
 *  it flips instead. */
const MIN_PANEL_HEIGHT = 240;

// ── Visitor geo, resolved once per page load ────────────────────────────────
//
// Same two-step fallback the explore grid and the apply flow already use:
// /api/geo reads Vercel's edge headers, which are absent in local dev, so a
// keyless IP lookup backs it up. Both are best effort. The promise is cached
// at module scope so ten pickers on one page make at most one pair of
// requests, and a resolved null is remembered rather than retried per picker.

let geoPromise: Promise<string | null> | null = null;

function isAlpha2(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z]{2}$/.test(v);
}

function loadGeoCountry(): Promise<string | null> {
  if (geoPromise) return geoPromise;
  geoPromise = (async () => {
    try {
      const res = await fetch('/api/geo');
      if (res.ok) {
        const data = await res.json();
        const cc = data?.countryCode ?? data?.country;
        if (isAlpha2(cc)) return cc.toUpperCase();
      }
    } catch { /* fall through to the keyless lookup */ }
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (isAlpha2(data?.country_code)) return String(data.country_code).toUpperCase();
      }
    } catch { /* geolocation is best effort, leave null */ }
    return null;
  })();
  return geoPromise;
}

/** The currency the visitor's country most likely uses, or null when geo is
 *  unavailable or unmapped. Null is a real answer: the caller shows no
 *  suggestion at all rather than a spinner or an empty section, and nothing
 *  is ever preselected from it. */
export function useRecommendedCurrency(): CurrencyOption | null {
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadGeoCountry().then(cc => { if (!cancelled) setCountry(cc); });
    return () => { cancelled = true; };
  }, []);
  return useMemo(() => currencyForCountry(country), [country]);
}

// ── Placement ───────────────────────────────────────────────────────────────

interface PanelPos {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  flipped: boolean;
}

/** Fixed-coordinate placement for the portaled panel. Mirrors
 *  FilterPopoverShell's `place()` (the corrected one): it can grow upward from
 *  the trigger's top edge, fills the viewport when neither side has room, and
 *  clamps on every edge so a trigger scrolled to the very bottom of a phone
 *  viewport still shows a reachable, scrollable list. */
function usePanelPosition(open: boolean, anchorRef: React.RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<PanelPos | null>(null);

  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(
      Math.min(MIN_PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
      Math.min(Math.max(r.width, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
    );
    let left = r.left;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));

    const below = window.innerHeight - r.bottom - PANEL_GAP - VIEWPORT_MARGIN;
    const above = r.top - PANEL_GAP - VIEWPORT_MARGIN;

    if (below < MIN_PANEL_HEIGHT && above < MIN_PANEL_HEIGHT) {
      // Short viewport (phone in landscape, on-screen keyboard open): ignore
      // the trigger and fill the viewport rather than hang off an edge.
      setPos({
        top: VIEWPORT_MARGIN, left, width,
        maxHeight: Math.max(160, window.innerHeight - VIEWPORT_MARGIN * 2),
        flipped: false,
      });
      return;
    }
    if (below < MIN_PANEL_HEIGHT && above > below) {
      const bottom = Math.max(VIEWPORT_MARGIN, window.innerHeight - r.top + PANEL_GAP);
      setPos({
        bottom, left, width,
        maxHeight: Math.min(above, window.innerHeight - bottom - VIEWPORT_MARGIN),
        flipped: true,
      });
      return;
    }
    const top = Math.max(VIEWPORT_MARGIN, r.bottom + PANEL_GAP);
    setPos({ top, left, width, maxHeight: window.innerHeight - top - VIEWPORT_MARGIN, flipped: false });
  }, [anchorRef]);

  useEffect(() => {
    // No reset on close: the panel only renders while `open`, and every open
    // path calls place() first, so a stale position can never be painted.
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  return { pos, place };
}

// ── Flag well ───────────────────────────────────────────────────────────────

/** Fixed-size well behind every flag. FlagImg hides a broken <img>, so without
 *  a sized wrapper a currency with a missing flag would shift its whole row. */
function CurrencyFlag({ code, size = 'md' }: { code: string; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 22 : 26;
  const h = size === 'sm' ? 15 : 18;
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: w, height: h, borderRadius: 3, backgroundColor: 'rgba(27,56,40,0.06)', overflow: 'hidden' }}
    >
      {code ? <FlagImg code={code} style={{ width: w, height: h, objectFit: 'cover', borderRadius: 3 }} /> : null}
    </span>
  );
}

// ── The picker ──────────────────────────────────────────────────────────────

export type CurrencyPickerVariant = 'bordered' | 'neu' | 'pill';

export interface CurrencyPickerProps {
  /** ISO 4217 code, stored verbatim. */
  value: string;
  onChange: (code: string) => void;
  /** id on the trigger button, so a <label htmlFor> keeps its association. */
  id?: string;
  /** Accessible name when there is no visible <label> pointing at `id`. */
  ariaLabel?: string;
  /** Restrict the list, e.g. the financials display switcher's FX-backed set.
   *  Order is preserved for the pinned block; unknown codes are dropped. */
  options?: string[];
  /** 'bordered' matches the classic #FAF8F3 + #DDD4C0 fields (settings page),
   *  'neu' the pressed-in neumorphic wells (financials), 'pill' the compact
   *  extruded chip used in a header row. */
  variant?: CurrencyPickerVariant;
  /** Show the currency name beside the code on the trigger. Off by default:
   *  most call sites sit in a narrow column next to an amount field. */
  showName?: boolean;
  disabled?: boolean;
  /** Merged onto the trigger AFTER the variant defaults (width, flex basis). */
  style?: React.CSSProperties;
  className?: string;
}

interface Row {
  option: CurrencyOption;
  /** Suggested rows repeat a currency that also appears below, so the key and
   *  the option id must be unique per section. */
  section: 'suggested' | 'pinned' | 'rest';
}

export function CurrencyPicker({
  value,
  onChange,
  id,
  ariaLabel = 'Currency',
  options,
  variant = 'neu',
  showName = false,
  disabled = false,
  style,
  className = '',
}: CurrencyPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const listboxId = `currency-listbox-${reactId}`;

  const { pos, place } = usePanelPosition(open, btnRef);
  const recommended = useRecommendedCurrency();

  const allowed = useMemo(() => {
    if (!options) return CURRENCIES;
    const set = new Set(options.map(c => c.toUpperCase()));
    return CURRENCIES.filter(c => set.has(c.code));
  }, [options]);

  const selected = findCurrency(value);

  // Suggested → pinned → alphabetical rest, deduplicated: a recommendation
  // that is already pinned is not repeated in the pinned block, and the
  // suggestion is dropped entirely when it is the only option or is filtered
  // out of `allowed`.
  const rows = useMemo<Row[]>(() => {
    const pinnedSet = new Set<string>(PINNED_CURRENCY_CODES);
    const suggested = recommended && allowed.some(c => c.code === recommended.code) ? recommended : null;
    const matches = (c: CurrencyOption) => currencyMatches(c, query);
    const out: Row[] = [];
    if (suggested && matches(suggested)) out.push({ option: suggested, section: 'suggested' });
    for (const c of allowed) {
      if (!pinnedSet.has(c.code) || c.code === suggested?.code) continue;
      if (matches(c)) out.push({ option: c, section: 'pinned' });
    }
    for (const c of allowed) {
      if (pinnedSet.has(c.code) || c.code === suggested?.code) continue;
      if (matches(c)) out.push({ option: c, section: 'rest' });
    }
    return out;
  }, [allowed, recommended, query]);

  const hasSuggested = rows.some(r => r.section === 'suggested');
  const firstPinned = rows.findIndex(r => r.section === 'pinned');
  const firstRest = rows.findIndex(r => r.section === 'rest');

  // Open on the selected row so the current value is the keyboard starting
  // point, not row zero.
  const openPanel = useCallback(() => {
    if (disabled) return;
    setQuery('');
    place();
    setOpen(true);
  }, [disabled, place]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setQuery('');
    if (refocus) btnRef.current?.focus();
  }, []);

  const commit = useCallback((code: string) => {
    onChange(code);
    close();
  }, [onChange, close]);

  useEffect(() => {
    if (!open) return;
    const idx = rows.findIndex(r => r.option.code === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    // Only when the panel opens: re-running on every `rows` change would fight
    // the arrow keys while the visitor types in the search box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus moves in the panel's ref CALLBACK, not in an effect keyed on `open`:
  // Portal renders nothing until its own effect has found the mount node, so
  // at the time an [open] effect runs the panel and the search box do not
  // exist yet and .focus() silently does nothing. React attaches refs
  // child-first, so searchRef is already set when this runs.
  const attachPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    if (!node) return;
    // A coarse pointer gets no autofocus: raising the on-screen keyboard the
    // moment the panel opens would cover most of the list on a phone, and the
    // panel is perfectly usable by tapping. Focus goes to the panel itself so
    // Escape and the arrow keys still work after a trackpad tap.
    const fine = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: fine)').matches;
    if (fine && searchRef.current) searchRef.current.focus();
    else node.focus();
  }, []);

  // Typing narrows the list, so the active row must come back into range.
  useEffect(() => {
    setActiveIndex(i => (i >= rows.length ? 0 : i));
  }, [rows.length]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the active row visible while arrowing through a scrolled list.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(rows.length - 1, i + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(0, i - 1)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); return; }
    if (e.key === 'End') { e.preventDefault(); setActiveIndex(Math.max(0, rows.length - 1)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[activeIndex];
      if (row) commit(row.option.code);
      return;
    }
    if (e.key === 'Tab') { close(false); }
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      openPanel();
    }
  }

  const triggerBase: React.CSSProperties = {
    fontFamily: OUTFIT,
    minHeight: TAP,
    display: 'flex',
    alignItems: 'center',
    // 7px, and the trigger's flag is the small one: several call sites sit in
    // a narrow column beside an amount field, and at ~110px the code itself
    // was the thing that got truncated.
    gap: 7,
    width: '100%',
    textAlign: 'left',
    cursor: disabled ? 'default' : 'pointer',
    color: INK,
    opacity: disabled ? 0.55 : 1,
    transition: `border-color 180ms ${EASE}, box-shadow 200ms ${EASE}`,
  };

  const variantStyle: React.CSSProperties =
    variant === 'bordered'
      ? {
          backgroundColor: SURFACE,
          // #8C7E68 clears 3:1 non-text contrast; #DDD4C0 read as no boundary.
          border: `1.5px solid ${open ? FOREST : '#8C7E68'}`,
          borderRadius: 10,
          padding: '8px 10px',
          fontSize: 13,
          fontWeight: 600,
        }
      : variant === 'pill'
        ? {
            width: 'auto',
            backgroundColor: SURFACE,
            border: 'none',
            borderRadius: 999,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.02em',
            boxShadow: open
              ? '-3px -3px 7px rgba(255,255,255,0.9), 4px 4px 9px rgba(27,56,40,0.15), 0 0 0 2px rgba(27,56,40,0.18)'
              : '-3px -3px 7px rgba(255,255,255,0.9), 4px 4px 9px rgba(27,56,40,0.15)',
          }
        : {
            backgroundColor: WELL,
            border: 'none',
            borderRadius: 12,
            padding: '8px 10px',
            fontSize: 13,
            fontWeight: 700,
            boxShadow: open
              ? 'inset 2px 2px 6px rgba(27,56,40,0.13), inset -2px -2px 6px rgba(255,255,255,0.8), 0 0 0 2px rgba(27,56,40,0.18)'
              : 'inset 2px 2px 6px rgba(27,56,40,0.13), inset -2px -2px 6px rgba(255,255,255,0.8)',
          };

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={onTriggerKeyDown}
        className={`focus:outline-none ${className}`}
        style={{ ...triggerBase, ...variantStyle, ...style }}
      >
        <CurrencyFlag code={selected?.country ?? ''} size="sm" />
        <span className="flex-1 truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {selected ? (
            <>
              {selected.code}
              {showName && <span style={{ color: INK_SOFT, fontWeight: 600 }}> · {selected.name}</span>}
            </>
          ) : (
            <span style={{ color: INK_SOFT }}>{value || 'Currency'}</span>
          )}
        </span>
        {!disabled && <ChevronDown
          size={15}
          strokeWidth={2.4}
          style={{
            flexShrink: 0,
            color: '#6E5F4E',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: `transform 200ms ${EASE}`,
          }}
        />}
      </button>

      {open && pos && (
        <Portal>
          <div
            ref={attachPanel}
            tabIndex={-1}
            onKeyDown={onPanelKeyDown}
            className="focus:outline-none"
            style={{
              position: 'fixed',
              top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width,
              maxHeight: pos.maxHeight,
              zIndex: 9999,
              display: 'flex', flexDirection: 'column',
              backgroundColor: SURFACE,
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 20px 48px rgba(27,56,40,0.18), 0 2px 8px rgba(27,56,40,0.08)',
              animation: `${pos.flipped ? 'gvCurrencyUp' : 'gvCurrencyDown'} 170ms ${EASE}`,
            }}
          >
            <style>{`@keyframes gvCurrencyDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
@keyframes gvCurrencyUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }`}</style>

            <div style={{ padding: 8, borderBottom: `1px solid ${HAIRLINE}`, flexShrink: 0 }}>
              <div
                className="flex items-center gap-2"
                style={{ backgroundColor: WELL, borderRadius: 10, padding: '0 10px', height: 38 }}
              >
                <Search size={14} strokeWidth={2.4} style={{ color: '#6E5F4E', flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search code, name or country"
                  aria-label="Search currencies"
                  aria-controls={listboxId}
                  aria-activedescendant={rows[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
                  className="flex-1 focus:outline-none"
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: INK, minWidth: 0,
                  }}
                />
              </div>
            </div>

            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}
            >
              {rows.length === 0 && (
                <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: INK_SOFT, padding: '18px 14px', textAlign: 'center' }}>
                  No currency matches that.
                </p>
              )}

              {rows.map((row, i) => {
                const c = row.option;
                const isSelected = c.code === value;
                const isActive = i === activeIndex;
                const heading =
                  row.section === 'suggested'
                    ? 'suggested'
                    : i === firstPinned && row.section === 'pinned'
                      ? 'common'
                      : i === firstRest && row.section === 'rest'
                        ? 'all'
                        : null;
                return (
                  <div key={`${row.section}-${c.code}`}>
                    {heading === 'suggested' && (
                      <SectionHeading icon>Suggested for your region</SectionHeading>
                    )}
                    {heading === 'common' && (
                      <SectionHeading divider={hasSuggested}>Common</SectionHeading>
                    )}
                    {heading === 'all' && (
                      <SectionHeading divider>All currencies</SectionHeading>
                    )}
                    <button
                      type="button"
                      role="option"
                      id={`${listboxId}-${i}`}
                      data-row-index={i}
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => commit(c.code)}
                      className="w-full flex items-center gap-2.5 text-left focus:outline-none"
                      style={{
                        minHeight: TAP,
                        padding: '7px 12px',
                        border: 'none',
                        cursor: 'pointer',
                        background: isActive ? 'rgba(27,56,40,0.07)' : 'transparent',
                        transition: `background 120ms ${EASE}`,
                      }}
                    >
                      <CurrencyFlag code={c.country} />
                      <span className="flex-1 min-w-0">
                        <span
                          className="block truncate"
                          style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {c.code}
                          <span style={{ fontWeight: 600, color: INK_SOFT }}> {c.name}</span>
                        </span>
                        <span
                          className="block truncate"
                          style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: INK_SOFT }}
                        >
                          {c.countryLabel}
                        </span>
                      </span>
                      <span
                        className="flex-shrink-0"
                        style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: '#6E5F4E', minWidth: 26, textAlign: 'right' }}
                      >
                        {c.symbol}
                      </span>
                      <span className="flex items-center justify-center flex-shrink-0" style={{ width: 16 }}>
                        {isSelected && <Check size={15} strokeWidth={3} style={{ color: FOREST }} />}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

function SectionHeading({ children, divider = false, icon = false }: { children: React.ReactNode; divider?: boolean; icon?: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5"
      style={{
        padding: divider ? '10px 12px 5px' : '6px 12px 5px',
        marginTop: divider ? 4 : 0,
        borderTop: divider ? `1px solid ${HAIRLINE}` : 'none',
      }}
    >
      {icon && <MapPin size={11} strokeWidth={2.6} style={{ color: '#B6871F' }} />}
      <span
        style={{
          fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 900, letterSpacing: '0.1em',
          color: INK_SOFT, textTransform: 'uppercase',
        }}
      >
        {children}
      </span>
    </div>
  );
}

export default CurrencyPicker;
