'use client';

// ── Explore chrome: the search pill, the date tabs, the filter chips (a
// popover on desktop, a bottom sheet on phones), the place rail, the sort menu
// and the list / grid toggle (CLAUDE.md §8, "The Explore page").
// Presentation only: every control here drives a filter the page already has
// (and so the URL query the page already writes); nothing new is filtered.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Search, ChevronLeft, ChevronRight, ChevronDown, Check, X, Globe, MapPin,
  LayoutGrid, Rows3,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { CircleFlag } from '@/components/CircleFlag';
import { DATE_OPTIONS, ROLE_OPTIONS, parseDateOnly, type DateFilter, type RoleKey } from './exploreFilters';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';

/** The main button (taste board two): a forest gradient rounded rectangle, sentence case. */
export const PRIMARY_BUTTON: React.CSSProperties = {
  background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%)',
  color: '#FFFFFF', border: 'none', borderRadius: '11px', cursor: 'pointer',
  fontFamily: FONT, fontWeight: 700,
};
/** The second button: an ink outline rectangle. */
export const SECONDARY_BUTTON: React.CSSProperties = {
  background: '#FFFFFF', color: INK, border: `1.5px solid ${INK}`, borderRadius: '11px', cursor: 'pointer',
  fontFamily: FONT, fontWeight: 700,
};

/** The soft round button with a rim the owner loves: a pale disc, a lighter
 *  top highlight and a slightly darker outer rim. */
export const RIM_DISC: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9999, flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(180deg, #FFFFFF 0%, #F2EDE2 100%)',
  border: '1px solid rgba(27,56,40,0.16)',
  boxShadow: 'inset 0 1px 0 #FFFFFF, 0 2px 6px rgba(27,56,40,0.14)',
  color: FOREST, cursor: 'pointer',
};

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number; fill?: string; style?: React.CSSProperties; 'aria-hidden'?: boolean }>;

/** A duotone glyph: a forest line over a gold or pale green fill. */
export function DuoIcon({ icon: Icon, size = 24, tone = 'gold' }: { icon: IconType; size?: number; tone?: 'gold' | 'green' }) {
  return (
    <Icon
      size={size}
      strokeWidth={1.7}
      fill={tone === 'gold' ? 'rgba(238,217,138,0.75)' : 'rgba(191,219,199,0.85)'}
      style={{ color: FOREST, flexShrink: 0 }}
      aria-hidden
    />
  );
}

// ── A floating layer anchored to a trigger (Portal, fixed, never clipped) ────

function useAnchoredLayer(open: boolean, anchor: React.RefObject<HTMLElement | null>, width: number, align: 'start' | 'end' = 'start') {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const w = Math.min(width, vw - 24);
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.max(12, Math.min(left, vw - w - 12));
      const top = r.bottom + 10;
      setPos(prev => (prev && prev.top === top && prev.left === left && prev.width === w ? prev : { top, left, width: w }));
    }
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchor, width, align]);
  return open ? pos : null;
}

const LAYER: React.CSSProperties = {
  position: 'fixed', zIndex: 1200,
  backgroundColor: '#FFFFFF', borderRadius: 24,
  boxShadow: '0 2px 6px rgba(27,56,40,0.08), 0 22px 48px rgba(27,56,40,0.18)',
  fontFamily: FONT,
};

// ── The search pill ──────────────────────────────────────────────────────────

type Segment = 'where' | 'when' | 'role' | null;

const REGION_ORDER = ['africa', 'asia', 'europe', 'north-america', 'south-america', 'oceania'] as const;

function formatShort(iso: string): string {
  const d = parseDateOnly(iso);
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
}

export function SearchPill({
  search, onSearch,
  continent, continentLabels, onContinent,
  nearCountry, nearCode, nearActive, onToggleNear,
  chosenCountryNames,
  dateFilter, dateFrom, dateTo, onDate, whenLabel,
  roles, onToggleRole, onClearRoles,
  onSubmit,
}: {
  /** A name for the chosen dates when the page knows one ("This week"). */
  whenLabel?: string | null;
  search: string; onSearch: (v: string) => void;
  continent: string | null; continentLabels: Record<string, string>; onContinent: (k: string | null) => void;
  nearCountry: string | null; nearCode?: string; nearActive: boolean; onToggleNear: () => void;
  /** Countries chosen in the panel, for the Where summary. */
  chosenCountryNames: string[];
  dateFilter: DateFilter; dateFrom: string; dateTo: string;
  /** Pick a date bucket (the page clears a custom range with it). */
  onDate: (v: DateFilter) => void;
  roles: ReadonlySet<RoleKey>; onToggleRole: (r: RoleKey) => void; onClearRoles: () => void;
  onSubmit: () => void;
}) {
  const [open, setOpen] = useState<Segment>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const whereRef = useRef<HTMLDivElement>(null);
  const whenRef = useRef<HTMLButtonElement>(null);
  const roleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const anchor = open === 'when' ? whenRef : open === 'role' ? roleRef : whereRef;
  const pos = useAnchoredLayer(open !== null, anchor as React.RefObject<HTMLElement | null>, open === 'where' ? 420 : 320, open === 'role' ? 'end' : 'start');

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (pillRef.current?.contains(t) || layerRef.current?.contains(t)) return;
      setOpen(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(null); }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const whereSummary = continent
    ? continentLabels[continent]
    : chosenCountryNames.length > 0
      ? chosenCountryNames.join(', ')
      : 'Search conferences or places';
  const whenSummary = whenLabel
    ? whenLabel
    : dateFrom || dateTo
    ? [dateFrom ? formatShort(dateFrom) : 'Any', dateTo ? formatShort(dateTo) : 'Any'].join(' to ')
    : DATE_OPTIONS.find(d => d.key === dateFilter && d.key !== '')?.label ?? 'Any time';
  const roleSummary = roles.size === 0
    ? 'Any role'
    : roles.size === ROLE_OPTIONS.length
      ? 'Every role'
      : ROLE_OPTIONS.filter(r => roles.has(r.key)).map(r => r.label).join(', ');

  const segBase = (active: boolean): React.CSSProperties => ({
    borderRadius: 9999, padding: '10px 22px', textAlign: 'left', minWidth: 0,
    backgroundColor: active ? '#F3EFE6' : 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: FONT, transition: 'background-color 140ms ease',
  });
  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 800, color: INK, lineHeight: 1.3 };
  const value: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 500, color: INK_SOFT, lineHeight: 1.35, overflowWrap: 'anywhere' };
  const divider = <span aria-hidden className="hidden sm:block" style={{ width: 1, alignSelf: 'stretch', margin: '14px 0', backgroundColor: 'rgba(28,20,16,0.12)' }} />;

  return (
    <div
      ref={pillRef}
      role="search"
      aria-label="Search conferences"
      className="flex items-center w-full"
      style={{
        maxWidth: 880, margin: '0 auto', backgroundColor: '#FFFFFF', borderRadius: 9999,
        boxShadow: '0 1px 2px rgba(27,56,40,0.08), 0 10px 28px rgba(27,56,40,0.12)',
        border: '1px solid rgba(27,56,40,0.08)', padding: 6,
      }}
    >
      {/* Where: the name / city / country search, and the regions */}
      <div
        ref={whereRef}
        className="flex-1"
        style={{ ...segBase(open === 'where'), flex: '1.5 1 0', cursor: 'text' }}
        onClick={() => inputRef.current?.focus()}
      >
        <label htmlFor="gv-explore-where" style={label}>Where</label>
        <input
          ref={inputRef}
          id="gv-explore-where"
          type="text"
          value={search}
          onChange={(e) => { onSearch(e.target.value); if (e.target.value) setOpen(null); }}
          onFocus={() => { if (!search) setOpen('where'); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { setOpen(null); onSubmit(); } }}
          placeholder={whereSummary}
          aria-label="Where: search a conference, city, country or region"
          className="w-full focus:outline-none"
          style={{ ...value, border: 'none', background: 'transparent', padding: 0, color: INK, fontSize: 16 }}
        />
      </div>
      {divider}
      <button
        ref={whenRef}
        type="button"
        className="hidden sm:block focus:outline-none"
        style={{ ...segBase(open === 'when'), flex: '1 1 0' }}
        aria-expanded={open === 'when'}
        aria-haspopup="dialog"
        onClick={() => setOpen(o => (o === 'when' ? null : 'when'))}
      >
        <span style={label}>When</span>
        <span style={value}>{whenSummary}</span>
      </button>
      {divider}
      <button
        ref={roleRef}
        type="button"
        className="hidden sm:block focus:outline-none"
        style={{ ...segBase(open === 'role'), flex: '1 1 0' }}
        aria-expanded={open === 'role'}
        aria-haspopup="dialog"
        onClick={() => setOpen(o => (o === 'role' ? null : 'role'))}
      >
        <span style={label}>Role</span>
        <span style={value}>{roleSummary}</span>
      </button>
      <button
        type="button"
        onClick={() => { setOpen(null); onSubmit(); }}
        aria-label="Show conferences"
        title="Show conferences"
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3828]"
        style={{
          width: 48, height: 48, borderRadius: 9999, flexShrink: 0, marginLeft: 6,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#1B3828 0%,#2A5A3C 60%,#1E4A31 100%)', color: '#FFFFFF',
          boxShadow: '0 4px 12px rgba(27,56,40,0.28)',
        }}
      >
        <Search size={19} strokeWidth={2.6} aria-hidden />
      </button>

      {open && pos && (
        <Portal>
          <div ref={layerRef} role="dialog" aria-label={open === 'where' ? 'Where' : open === 'when' ? 'When' : 'Role'} style={{ ...LAYER, top: pos.top, left: pos.left, width: pos.width, padding: 18 }}>
            {open === 'where' && (
              <>
                {nearCountry && (
                  <>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: INK }}>Near you</p>
                    <button
                      type="button"
                      onClick={() => { onToggleNear(); setOpen(null); }}
                      aria-pressed={nearActive}
                      className="w-full flex items-center focus:outline-none"
                      style={{ gap: 12, padding: '8px 10px', borderRadius: 14, border: 'none', cursor: 'pointer', textAlign: 'left', backgroundColor: nearActive ? '#EEF3EC' : 'transparent', fontFamily: FONT }}
                    >
                      {nearCode ? <CircleFlag code={nearCode} size={36} decorative /> : <span style={{ ...RIM_DISC, width: 36, height: 36 }}><MapPin size={16} aria-hidden /></span>}
                      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{nearCountry}</span>
                      {nearActive && <Check size={16} strokeWidth={2.6} style={{ color: FOREST }} aria-hidden />}
                    </button>
                  </>
                )}
                <p style={{ margin: nearCountry ? '14px 0 8px' : '0 0 8px', fontSize: 13, fontWeight: 800, color: INK }}>Search by region</p>
                <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 8 }}>
                  {REGION_ORDER.map(k => {
                    const active = continent === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={active}
                        onClick={() => { onContinent(active ? null : k); setOpen(null); }}
                        className="flex flex-col items-center focus:outline-none"
                        style={{
                          gap: 6, padding: '12px 6px', borderRadius: 16, cursor: 'pointer', fontFamily: FONT,
                          border: active ? `1.5px solid ${FOREST}` : '1px solid rgba(27,56,40,0.12)',
                          backgroundColor: active ? '#EEF3EC' : '#FFFFFF',
                        }}
                      >
                        <DuoIcon icon={Globe} size={26} tone={k === 'europe' || k === 'asia' || k === 'oceania' ? 'green' : 'gold'} />
                        <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, color: INK }}>{continentLabels[k]}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {open === 'when' && (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: INK }}>When</p>
                {(dateFrom || dateTo) && (
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: INK_SOFT }}>Chosen: {whenSummary}</p>
                )}
                <div role="radiogroup" aria-label="When">
                  {DATE_OPTIONS.map(d => {
                    const active = dateFilter === d.key && !dateFrom && !dateTo;
                    return (
                      <button
                        key={d.key || 'any'}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => { onDate(d.key); setOpen(null); }}
                        className="w-full flex items-center justify-between focus:outline-none"
                        style={{ padding: '10px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', backgroundColor: active ? '#EEF3EC' : 'transparent', fontFamily: FONT, fontSize: 14.5, fontWeight: active ? 800 : 500, color: INK }}
                      >
                        {d.label}
                        {active && <Check size={16} strokeWidth={2.6} style={{ color: FOREST }} aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {open === 'role' && (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: INK }}>Applications open for</p>
                {ROLE_OPTIONS.map(r => {
                  const active = roles.has(r.key);
                  return (
                    <button
                      key={r.key}
                      type="button"
                      role="checkbox"
                      aria-checked={active}
                      onClick={() => onToggleRole(r.key)}
                      className="w-full flex items-center focus:outline-none"
                      style={{ gap: 10, padding: '10px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', backgroundColor: active ? '#EEF3EC' : 'transparent', fontFamily: FONT, fontSize: 14.5, fontWeight: active ? 800 : 500, color: INK, textAlign: 'left' }}
                    >
                      <CheckBox on={active} />
                      {r.label}
                    </button>
                  );
                })}
                {roles.size > 0 && (
                  <button
                    type="button"
                    onClick={() => { onClearRoles(); setOpen(null); }}
                    className="focus:outline-none"
                    style={{ marginTop: 8, marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    Any role
                  </button>
                )}
              </>
            )}
          </div>
        </Portal>
      )}
    </div>
  );
}

export function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 18, height: 18, borderRadius: 6, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: on ? `1.5px solid ${FOREST}` : '1.5px solid rgba(28,20,16,0.35)',
        backgroundColor: on ? FOREST : '#FFFFFF',
      }}
    >
      {on && <Check size={12} strokeWidth={3.2} style={{ color: '#FFFFFF' }} />}
    </span>
  );
}

// ── Sort: a plain text menu ─────────────────────────────────────────────────

export function SortMenu({ sort, onChange }: { sort: 'asc' | 'desc'; onChange: (v: 'asc' | 'desc') => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const pos = useAnchoredLayer(open, btn as React.RefObject<HTMLElement | null>, 200, 'end');
  const options: { key: 'asc' | 'desc'; label: string }[] = [
    { key: 'asc', label: 'Soonest first' },
    { key: 'desc', label: 'Latest first' },
  ];
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (btn.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const current = options.find(o => o.key === sort)!.label;
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded-md"
        style={{ gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 14, color: INK_SOFT, padding: '6px 2px', whiteSpace: 'nowrap' }}
      >
        Sort: <span style={{ fontWeight: 800, color: INK }}>{current}</span>
        <ChevronDown size={15} strokeWidth={2.4} aria-hidden style={{ color: INK, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease' }} />
      </button>
      {open && pos && (
        <Portal>
          <div ref={menu} role="menu" aria-label="Sort" style={{ ...LAYER, borderRadius: 16, top: pos.top - 4, left: pos.left, width: pos.width, padding: 6 }}>
            {options.map(o => (
              <button
                key={o.key}
                type="button"
                role="menuitemradio"
                aria-checked={o.key === sort}
                onClick={() => { onChange(o.key); setOpen(false); btn.current?.focus(); }}
                className="w-full flex items-center justify-between focus:outline-none"
                style={{ padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: o.key === sort ? 800 : 500, color: INK, backgroundColor: o.key === sort ? '#EEF3EC' : 'transparent' }}
              >
                {o.label}
                {o.key === sort && <Check size={15} strokeWidth={2.6} style={{ color: FOREST }} aria-hidden />}
              </button>
            ))}
          </div>
        </Portal>
      )}
    </>
  );
}

// ── Grid / list ──────────────────────────────────────────────────────────────

export type ExploreView = 'grid' | 'list';

export function ViewToggle({ view, onChange }: { view: ExploreView; onChange: (v: ExploreView) => void }) {
  const options: { key: ExploreView; icon: typeof LayoutGrid; label: string }[] = [
    { key: 'list', icon: Rows3, label: 'List view' },
    { key: 'grid', icon: LayoutGrid, label: 'Grid view' },
  ];
  return (
    <div
      className="flex items-center flex-shrink-0"
      role="group"
      aria-label="View"
      style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 3, gap: 2, boxShadow: '0 1px 2px rgba(27,56,40,0.08), 0 4px 12px rgba(27,56,40,0.06)' }}
    >
      {options.map(({ key, icon: Icon, label }) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => onChange(key)}
            className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{
              width: 36, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
              backgroundColor: active ? '#EEF3EC' : 'transparent',
              color: active ? FOREST : '#6B5F52',
            }}
          >
            <Icon size={16} strokeWidth={2.25} />
          </button>
        );
      })}
    </div>
  );
}


// ── Narrow screens: popovers become bottom sheets ──────────────────────────

export function useIsNarrow(maxWidth = 639): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [maxWidth]);
  return narrow;
}

// ── Date tabs (Eventbrite / Luma): each tab is one existing date filter ────

export interface DateTab { key: string; label: string; active: boolean; onClick: () => void }

export function DateTabs({ tabs }: { tabs: DateTab[] }) {
  return (
    <div
      role="radiogroup"
      aria-label="When"
      className="gv-explore-scroll flex items-end"
      style={{ gap: 'clamp(18px, 2.4vw, 30px)', overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 2px 0' }}
    >
      {tabs.map(t => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={t.active}
          onClick={t.onClick}
          className="flex flex-col items-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded-md"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px 0', fontFamily: FONT }}
        >
          <span style={{ fontSize: 15, fontWeight: t.active ? 800 : 600, color: t.active ? INK : INK_SOFT, whiteSpace: 'nowrap' }}>{t.label}</span>
          <span aria-hidden style={{ width: '100%', minWidth: 24, height: 2.5, borderRadius: 2, marginTop: 8, backgroundColor: t.active ? FOREST : 'transparent' }} />
        </button>
      ))}
    </div>
  );
}

// ── Filter chips: a slim bar, each chip opens a small popover ──────────────

const CHIP: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
  height: 40, padding: '0 15px', borderRadius: 9999, cursor: 'pointer',
  fontFamily: FONT, fontSize: 14, color: INK, whiteSpace: 'nowrap',
  transition: 'background-color 140ms ease, box-shadow 140ms ease',
};

function chipLook(active: boolean): React.CSSProperties {
  return active
    ? { ...CHIP, fontWeight: 800, backgroundColor: '#EEF3EC', border: `1.5px solid ${FOREST}`, boxShadow: '0 1px 2px rgba(27,56,40,0.08)' }
    : { ...CHIP, fontWeight: 600, backgroundColor: '#FFFFFF', border: '1px solid rgba(28,20,16,0.14)', boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 3px 8px rgba(27,56,40,0.05)' };
}

/** A chip that opens a popover (a bottom sheet on phones). `summary` names
 *  what is chosen; nothing chosen shows the plain label. */
export function FilterChip({
  label, summary, active, icon, title, children, onClear,
}: {
  label: string;
  summary?: string | null;
  active: boolean;
  icon?: IconType;
  /** The popover's own heading. */
  title: string;
  children: React.ReactNode;
  /** Clears this one filter; shown in the popover when it is on. */
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); btn.current?.focus(); }, []);
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2"
        style={chipLook(active)}
      >
        {icon && <DuoIcon icon={icon} size={17} tone={active ? 'green' : 'gold'} />}
        {active && summary ? summary : label}
        <ChevronDown size={15} strokeWidth={2.4} aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease' }} />
      </button>
      <ChipLayer open={open} anchor={btn} onClose={close} title={title} onClear={active ? onClear : undefined}>
        {children}
      </ChipLayer>
    </>
  );
}

/** A chip that is simply on or off (Credit sponsored). */
export function ToggleChip({ label, active, icon, onClick }: { label: string; active: boolean; icon?: IconType; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2"
      style={chipLook(active)}
    >
      {icon && <DuoIcon icon={icon} size={17} tone={active ? 'green' : 'gold'} />}
      {label}
      {active && <Check size={15} strokeWidth={2.6} aria-hidden style={{ color: FOREST }} />}
    </button>
  );
}

/** The layer behind a chip: anchored under it on desktop, a bottom sheet on
 *  phones. A backdrop takes the outside click, so a DatePicker calendar
 *  (its own Portal, above this layer) can be used inside it. */
export function ChipLayer({
  open, anchor, onClose, title, onClear, children, width = 340,
}: {
  open: boolean;
  anchor: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  title: string;
  onClear?: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const narrow = useIsNarrow();
  const pos = useAnchoredLayer(open && !narrow, anchor, width, 'start');
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => panel.current?.focus(), 0);
    let prev = '';
    if (narrow) { prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      if (narrow) document.body.style.overflow = prev;
    };
  }, [open, narrow, onClose]);
  if (!open) return null;

  const head = (
    <div className="flex items-center justify-between" style={{ gap: 12, marginBottom: 10 }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: INK }}>{title}</span>
      {narrow ? (
        <button type="button" onClick={onClose} aria-label="Close" className="focus:outline-none" style={{ ...RIM_DISC, width: 38, height: 38 }}>
          <X size={16} strokeWidth={2.4} aria-hidden />
        </button>
      ) : onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="focus:outline-none"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Clear
        </button>
      ) : null}
    </div>
  );

  if (narrow) {
    return (
      <Portal>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, fontFamily: FONT }}>
          <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(20,16,12,0.42)' }} />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="focus:outline-none"
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82dvh', display: 'flex', flexDirection: 'column',
              backgroundColor: '#FFFFFF', borderRadius: '24px 24px 0 0', boxShadow: '0 -12px 40px rgba(27,56,40,0.22)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
              <span aria-hidden style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: 'rgba(28,20,16,0.18)' }} />
            </div>
            <div style={{ padding: '8px 18px 0' }}>{head}</div>
            <div style={{ flex: '1 1 auto', overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 18px 12px' }}>{children}</div>
            <div
              className="flex items-center justify-between"
              style={{ gap: 12, padding: '12px 18px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid rgba(28,20,16,0.08)' }}
            >
              <button
                type="button"
                onClick={onClear}
                disabled={!onClear}
                className="focus:outline-none"
                style={{ background: 'none', border: 'none', cursor: onClear ? 'pointer' : 'default', fontFamily: FONT, fontSize: 15, fontWeight: 700, color: onClear ? INK : '#A89C8C', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                Clear
              </button>
              <button type="button" onClick={onClose} className="focus:outline-none" style={{ ...PRIMARY_BUTTON, padding: '12px 26px', fontSize: 15 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  if (!pos) return null;
  return (
    <Portal>
      <div aria-hidden onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1199 }} />
      <div
        ref={panel}
        role="dialog"
        aria-label={title}
        tabIndex={-1}
        className="focus:outline-none"
        style={{ ...LAYER, top: pos.top, left: pos.left, width: pos.width, padding: 18, maxHeight: `calc(100dvh - ${pos.top + 16}px)`, overflowY: 'auto' }}
      >
        {head}
        {children}
      </div>
    </Portal>
  );
}

/** One option row inside a chip's popover: a radio or a checkbox look. */
export function ChoiceRow({
  label, active, onClick, kind = 'radio', icon, note,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  kind?: 'radio' | 'check';
  icon?: IconType;
  note?: string;
}) {
  return (
    <button
      type="button"
      role={kind === 'radio' ? 'radio' : 'checkbox'}
      aria-checked={active}
      onClick={onClick}
      className="w-full flex items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{
        gap: 10, padding: '11px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
        backgroundColor: active ? '#EEF3EC' : 'transparent', fontFamily: FONT, fontSize: 15, fontWeight: active ? 800 : 500, color: INK,
      }}
    >
      {kind === 'check' ? <CheckBox on={active} /> : <RadioDot on={active} />}
      {icon && <DuoIcon icon={icon} size={18} tone="green" />}
      <span className="flex-1 min-w-0" style={{ overflowWrap: 'anywhere' }}>{label}</span>
      {note && <span style={{ fontSize: 12.5, fontWeight: 600, color: INK_SOFT }}>{note}</span>}
    </button>
  );
}

function RadioDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 18, height: 18, borderRadius: 9999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: on ? `1.5px solid ${FOREST}` : '1.5px solid rgba(28,20,16,0.35)', backgroundColor: '#FFFFFF',
      }}
    >
      {on && <span style={{ width: 9, height: 9, borderRadius: 9999, backgroundColor: FOREST }} />}
    </span>
  );
}

// ── Place rail: Near you, the six regions and the countries, as round discs ─

export interface PlaceItem {
  key: string;
  label: string;
  /** How many conferences sit behind it under the other filters. */
  count?: number;
  /** ISO code: a round flag. Without one, `icon` in a rimmed disc. */
  code?: string;
  icon?: IconType;
  /** A small word above the label ("Near you"). */
  kicker?: string;
  active: boolean;
  onClick: () => void;
}

export function PlaceRail({ items, trailing }: { items: PlaceItem[]; trailing?: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges(prev => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', measure); };
  }, [measure, items.length]);
  const nudge = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.7), behavior: 'smooth' });
  };
  const mask = `linear-gradient(90deg, ${edges.left ? 'transparent 0, #000 48px' : '#000 0'}, ${edges.right ? '#000 calc(100% - 48px), transparent 100%' : '#000 100%'})`;

  return (
    <div className="relative flex items-center" style={{ gap: 10 }}>
      {edges.left && (
        <span className="hidden sm:inline-flex">
          <button type="button" onClick={() => nudge(-1)} aria-label="Scroll places back" className="focus:outline-none" style={RIM_DISC}>
            <ChevronLeft size={17} strokeWidth={2.4} aria-hidden />
          </button>
        </span>
      )}
      <div
        ref={scroller}
        role="group"
        aria-label="Browse by place"
        className="gv-explore-scroll flex-1 flex items-start"
        style={{ overflowX: 'auto', scrollbarWidth: 'none', gap: 'clamp(10px, 1.4vw, 18px)', WebkitMaskImage: mask, maskImage: mask, padding: '6px 4px 4px' }}
      >
        {items.map(it => (
          <button
            key={it.key}
            type="button"
            aria-pressed={it.active}
            onClick={it.onClick}
            className="flex flex-col items-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded-xl"
            style={{ width: 84, gap: 6, padding: '2px 0 4px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}
          >
            <span
              style={{
                width: 64, height: 64, borderRadius: 9999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: 3, background: 'linear-gradient(180deg, #FFFFFF 0%, #F2EDE2 100%)',
                boxShadow: it.active
                  ? `0 0 0 2.5px ${FOREST}, 0 6px 14px rgba(27,56,40,0.20)`
                  : 'inset 0 1px 0 #FFFFFF, 0 0 0 1px rgba(27,56,40,0.14), 0 3px 8px rgba(27,56,40,0.12)',
                transition: 'box-shadow 160ms ease',
              }}
            >
              {it.code ? (
                <CircleFlag code={it.code} size={58} decorative />
              ) : it.icon ? (
                <DuoIcon icon={it.icon} size={28} tone={it.active ? 'green' : 'gold'} />
              ) : null}
            </span>
            {it.kicker && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#8A6414', lineHeight: 1 }}>{it.kicker}</span>}
            <span style={{ fontSize: 13, fontWeight: it.active ? 800 : 600, color: INK, lineHeight: 1.2, textAlign: 'center', overflowWrap: 'anywhere' }}>{it.label}</span>
            {typeof it.count === 'number' && (
              <span style={{ fontSize: 12, fontWeight: 600, color: INK_SOFT, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{it.count.toLocaleString()}</span>
            )}
          </button>
        ))}
        {trailing}
      </div>
      {edges.right && (
        <span className="hidden sm:inline-flex">
          <button type="button" onClick={() => nudge(1)} aria-label="Scroll places forward" className="focus:outline-none" style={RIM_DISC}>
            <ChevronRight size={17} strokeWidth={2.4} aria-hidden />
          </button>
        </span>
      )}
    </div>
  );
}

export const SCROLL_CSS = '.gv-explore-scroll::-webkit-scrollbar{display:none}';
