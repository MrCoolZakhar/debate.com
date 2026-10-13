'use client';

/**
 * The conference's country, picked from a searchable list of round flags
 * (12 Oct 2026; owner: "a nicer country picker, with flags"). It replaced a
 * plain <select> in Settings → General.
 *
 * Closed, it reads like the other fields: the chosen country's round flag and
 * its name (or "Select a country"). Pressed, a panel opens through Portal at
 * fixed coordinates (so no card's overflow can clip it, and it flips above the
 * field near the bottom of the screen) with a search box and every UN member,
 * ranked by `countryMatchRank` (accents folded, aliases such as "uk" and
 * "turkey" understood). Arrow keys move, Enter picks, Escape closes and hands
 * focus back to the field.
 *
 * It stores exactly what the old <select> stored: the country's English name,
 * or '' for none, through the caller's `onChange`. A saved value that is not a
 * UN member name (an old row) still shows, with its flag when the name
 * resolves, or initials.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { CircleFlag } from '@/components/CircleFlag';
import { UN_COUNTRIES, countryMatchRank } from '@/lib/countries';
import { F, INK, INK_SOFT, FOREST, TYPE_PX } from './panelKit';

const PANEL_MAX_H = 360;
const PANEL_MIN_W = 300;

type Pos = { top: number; left: number; width: number; up: boolean; maxH: number };

export function CountryPicker({ id, value, onChange, placeholder = 'Select a country' }: {
  id?: string;
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}) {
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Portal mounts its children a tick after the panel opens, so the effects
  // that focus the search box and scroll the list wait for the panel node.
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null);
  const setPanel = useCallback((el: HTMLDivElement | null) => { panelRef.current = el; setPanelEl(el); }, []);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, PANEL_MIN_W), vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const up = below < Math.min(PANEL_MAX_H, 260) && above > below;
    const maxH = Math.max(180, Math.min(PANEL_MAX_H, up ? above : below));
    // Clamped on screen even while the field itself is half scrolled away.
    setPos({ top: up ? Math.min(r.top - 6, vh - 8) : Math.max(8, r.bottom + 6), left, width, up, maxH });
  }, []);

  const shown = useMemo(() => {
    const q = query.trim();
    if (!q) return UN_COUNTRIES;
    return UN_COUNTRIES
      .map(c => ({ c, rank: countryMatchRank(c.name, q, 'en') }))
      .filter((x): x is { c: typeof UN_COUNTRIES[number]; rank: number } => x.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.c.name.localeCompare(b.c.name))
      .map(x => x.c);
  }, [query]);

  const openPanel = () => {
    const i = UN_COUNTRIES.findIndex(c => c.name === value);
    setQuery('');
    setActive(i >= 0 ? i : 0);
    place();
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };
  const choose = (name: string) => {
    if (name !== value) onChange(name);
    close(true);
  };

  // Focus the search box once the panel is on screen, and bring the chosen
  // country into view.
  useEffect(() => {
    if (!panelEl) return;
    searchRef.current?.focus({ preventScroll: true });
  }, [panelEl]);
  useEffect(() => {
    const list = listRef.current;
    if (!panelEl || !list) return;
    const row = list.querySelector<HTMLElement>(`[data-i="${active}"]`);
    if (!row) return;
    // Scroll the list only (scrollIntoView could move the page too).
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop - 6;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight + 6;
  }, [active, panelEl]);

  // Follow the field on scroll and resize; close on a press outside.
  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close(false);
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, place]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key === 'Tab') { close(false); return; }
    if (!shown.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'PageDown') { e.preventDefault(); setActive(a => Math.min(shown.length - 1, a + 8)); }
    else if (e.key === 'PageUp') { e.preventDefault(); setActive(a => Math.max(0, a - 8)); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = shown[active]; if (c) choose(c.name); }
  };

  const activeId = shown[active] ? `${listId}-${shown[active].code}` : undefined;

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        className="gvg-input gvg-country"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openPanel(); } }}
        data-open={open ? 'true' : undefined}
      >
        {value
          ? <CircleFlag country={value} size={24} decorative />
          : <span aria-hidden className="gvg-country-empty" />}
        <span className="gvg-country-name" data-empty={value ? undefined : 'true'}>{value || placeholder}</span>
        <ChevronDown size={17} strokeWidth={2.4} aria-hidden style={{ color: INK_SOFT, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }} />
      </button>

      {open && pos && (
        <Portal>
          <div
            ref={setPanel}
            onKeyDown={onKey}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999,
              transform: pos.up ? 'translateY(-100%)' : 'none',
              maxHeight: pos.maxH, display: 'flex', flexDirection: 'column',
              background: '#FFFFFF', borderRadius: 16, overflow: 'hidden', fontFamily: F,
              boxShadow: '0 0 0 1px rgba(27,56,40,0.08), 0 24px 48px -18px rgba(27,56,40,0.45), 0 6px 14px -8px rgba(27,56,40,0.2)',
            }}
          >
            <div style={{ position: 'relative', padding: 8, borderBottom: '1px solid rgba(27,56,40,0.07)' }}>
              <Search size={17} strokeWidth={2.4} aria-hidden style={{ position: 'absolute', left: 21, top: '50%', transform: 'translateY(-50%)', color: INK_SOFT }} />
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={activeId}
                aria-autocomplete="list"
                aria-label="Search countries"
                placeholder="Search countries"
                value={query}
                autoComplete="off"
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                style={{
                  width: '100%', height: 42, padding: '0 36px 0 38px', borderRadius: 11, border: '1.5px solid #D9CFBA',
                  background: '#FAF8F3', fontFamily: F, fontSize: 16, color: INK, outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = FOREST; e.currentTarget.style.background = '#FFFFFF'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#D9CFBA'; e.currentTarget.style.background = '#FAF8F3'; }}
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear the search"
                  onClick={() => { setQuery(''); setActive(0); searchRef.current?.focus(); }}
                  style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, borderRadius: 999, border: 'none', background: 'rgba(27,56,40,0.07)', color: INK_SOFT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={14} strokeWidth={2.6} aria-hidden />
                </button>
              )}
            </div>
            <div ref={listRef} id={listId} role="listbox" aria-label="Countries" style={{ position: 'relative', overflowY: 'auto', padding: 6, flex: '1 1 auto', minHeight: 0 }}>
              {shown.length === 0 && (
                <p style={{ margin: 0, padding: '14px 12px', fontSize: TYPE_PX.body, color: INK_SOFT }}>No country matches that.</p>
              )}
              {shown.map((c, i) => {
                const chosen = c.name === value;
                const hot = i === active;
                return (
                  <div
                    key={c.code}
                    id={`${listId}-${c.code}`}
                    data-i={i}
                    role="option"
                    aria-selected={chosen}
                    onPointerDown={(e) => e.preventDefault()}
                    onPointerMove={() => { if (!hot) setActive(i); }}
                    onClick={() => choose(c.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11, minHeight: 44, padding: '6px 10px', borderRadius: 11, cursor: 'pointer',
                      background: hot ? 'rgba(27,56,40,0.07)' : chosen ? 'rgba(238,217,138,0.25)' : 'transparent',
                    }}
                  >
                    <CircleFlag code={c.code} size={28} decorative />
                    <span style={{ flex: 1, minWidth: 0, fontSize: TYPE_PX.body, fontWeight: chosen ? 700 : 500, color: INK, overflowWrap: 'anywhere', lineHeight: 1.3 }}>{c.name}</span>
                    {chosen && <Check size={17} strokeWidth={2.8} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
            {value && (
              <div style={{ padding: '6px 8px 8px', borderTop: '1px solid rgba(27,56,40,0.07)' }}>
                <button
                  type="button"
                  onClick={() => choose('')}
                  style={{ width: '100%', minHeight: 38, borderRadius: 10, border: 'none', background: 'transparent', fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 600, color: INK_SOFT, cursor: 'pointer', textAlign: 'left', padding: '0 10px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(27,56,40,0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Clear the country
                </button>
              </div>
            )}
          </div>
        </Portal>
      )}
    </>
  );
}
