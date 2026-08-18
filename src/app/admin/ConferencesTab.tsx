'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin → Conferences tab.
//
// The staff scanning surface: ~118 conferences, two readers, one job — spot the
// ones that need a human. Everything here is built for scanning density:
//
//   • The LOGO is the anchor of every row, wearing two corner badges (country
//     flag, live/draft state). Both badges are filter controls.
//   • Set-up progress is a donut RING with the fraction inside it; hovering it
//     reveals exactly which steps are outstanding.
//   • Clicking ANYWHERE on a row opens that conference's dashboard. The small
//     number of in-row filter controls are real <button>s that stop the click
//     from reaching the row, so the two interactions never fight.
//   • Chips are tiered: only exceptions (short on seats, stalled, empty dais)
//     get a saturated fill. Plain facts stay quiet and extruded.
//
// Presentation only — the caller owns the RPC, the gate and the data.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownWideNarrow, ArrowUpRight, Building2, CalendarClock, Check, ChevronDown,
  CircleAlert, Clock, Gavel, Globe, LayoutTemplate, Mail, MapPin, PencilLine, Search,
  UserPlus, Users, Wallet, X,
} from 'lucide-react';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuInset, NeuStatTile, NeuIconDisc, NeuRing } from '@/components/neu';
import Portal from '@/components/Portal';
import { LogoDisc } from '@/components/LogoDisc';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByName } from '@/lib/countries';
import {
  FilterPopoverShell, FilterGroup, FilterHeading, CheckChip, toggleIn,
} from '@/components/FilterPopover';

const MONO = 'ui-monospace, monospace';
const DANGER: [string, string] = ['#9A3030', '#7A1F1F'];
const ATTENTION: [string, string] = ['#C79A52', '#B8844A'];

export interface AdminConferenceRow {
  id: string; slug: string; acronym: string | null; full_name: string;
  is_public: boolean; status: string; dates_tbd: boolean;
  start_date: string | null; end_date: string | null; city: string | null; country: string | null;
  expected_delegates: number; seat_capacity: number;
  setup_done: number; setup_total: number; setup_complete: boolean;
  pending_keys: string[];
  committees: number; chairs_missing: number; applications: number; paid_applications: number;
  organizer_name: string | null; organizer_email: string | null;
  created_at: string; updated_at: string; last_nudge_at: string | null;
  /** Not returned by admin_conference_overview(). Avatars are resolved from
   *  `profiles` by the caller and passed in via the `avatars` map instead; this
   *  optional field is only a fallback should the RPC ever start returning one. */
  organizer_avatar?: string | null;
}

// ── Set-up steps ────────────────────────────────────────────────────────────
// conference_setup_status() counts setup_done/setup_total over SEVEN steps and
// deliberately excludes `publish` — but admin_conference_overview()'s
// pending_keys array does NOT exclude it, so a 7/7 conference that simply is
// not live still carries 'publish' in pending_keys. The ring and the hover list
// both drop it: "is it live" is the logo's own corner badge, not a set-up step.
// Icons are deliberately NOT ticks — every item in this list is outstanding, so
// a checkmark would read as "done". Nor a Globe, which is the live badge's glyph.
const SETUP_STEPS: { key: string; label: string; icon: typeof LayoutTemplate }[] = [
  { key: 'page',        label: 'Conference page',    icon: LayoutTemplate },
  { key: 'committees',  label: 'Committees & seats', icon: Building2 },
  { key: 'chairs',      label: 'Chairs on the dais', icon: Gavel },
  { key: 'email',       label: 'Applicant email',    icon: Mail },
  { key: 'secretariat', label: 'Secretariat',        icon: Users },
  { key: 'financials',  label: 'Financials',         icon: Wallet },
  { key: 'delegate',    label: 'First delegate',     icon: UserPlus },
];
const STEP_BY_KEY = new Map(SETUP_STEPS.map(s => [s.key, s]));

function outstandingSteps(pendingKeys: string[]) {
  return pendingKeys.filter(k => k !== 'publish').map(k => STEP_BY_KEY.get(k) ?? { key: k, label: k, icon: CircleAlert });
}

// ── Small helpers ───────────────────────────────────────────────────────────

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** start_date/end_date are `date` columns — plain calendar days with no zone.
 *  Parse the string's own parts; never round-trip through Date, which reads
 *  "2026-03-12T00:00:00" as LOCAL midnight and then reports a UTC day one
 *  earlier for every reader east of Greenwich. */
function ymd(iso: string): { d: number; m: number; y: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
}

/** "12–14 Mar 2026", "28 Feb – 2 Mar 2026", or a single day. */
function formatRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = ymd(start);
  if (!s) return null;
  const e = end ? ymd(end) : null;
  if (!e || start === end) return `${s.d} ${MONTHS[s.m]} ${s.y}`;
  if (s.m === e.m && s.y === e.y) return `${s.d}–${e.d} ${MONTHS[s.m]} ${s.y}`;
  if (s.y === e.y) return `${s.d} ${MONTHS[s.m]} – ${e.d} ${MONTHS[e.m]} ${s.y}`;
  return `${s.d} ${MONTHS[s.m]} ${s.y} – ${e.d} ${MONTHS[e.m]} ${e.y}`;
}

function initialsOf(name: string | null, email: string | null): string {
  const src = (name ?? '').trim() || (email ?? '').trim();
  if (!src) return '?';
  const parts = src.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

const STALE_DAYS = 14;
function isStalled(r: AdminConferenceRow) { return !r.is_public && (daysSince(r.updated_at) ?? 0) > STALE_DAYS; }
// 70% seat coverage is "fine" — the same bar the organiser dashboard checklist
// and conference_setup_status() (nudge emails) use. Kept in sync deliberately:
// a danger chip here that contradicts a green row there is worse than no chip.
function isShortOnSeats(r: AdminConferenceRow) { return r.expected_delegates > 0 && r.seat_capacity < Math.ceil(r.expected_delegates * 0.70); }
function hasEmptyDais(r: AdminConferenceRow) { return r.committees > 0 && r.chairs_missing > 0; }

// ── HoverPop, portaled hover explainer ──────────────────────────────────────
// UI RULE: informational reveals open on HOVER (and focus), never on click, and
// are portaled at fixed viewport coordinates so no ancestor's overflow — or the
// viewport edge — can clip them. Flips above the trigger when there is no room
// below, and clamps horizontally at both edges.

function HoverPop({
  children, panel, width = 252, label,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
  width?: number;
  /** Screen-reader / native-tooltip summary of the same information. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const M = 12;
    const estimated = 200;
    const up = r.bottom + 10 + estimated > window.innerHeight && r.top > estimated;
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(M, Math.min(left, window.innerWidth - width - M));
    setPos({ top: up ? r.top - 10 : r.bottom + 10, left, up });
  }, [width]);

  const show = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    place();
    setOpen(true);
  }, [place]);
  const hide = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 110);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <span
      ref={ref}
      tabIndex={0}
      aria-label={label}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="inline-flex focus:outline-none"
      style={{ borderRadius: 999 }}
    >
      {children}
      {open && pos && (
        <Portal>
          <div
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width, zIndex: 9999,
              transform: pos.up ? 'translateY(-100%)' : undefined,
              backgroundColor: NEU.surface, borderRadius: 16, boxShadow: NEU.out,
              padding: 14, animation: `neuPopIn 160ms ${EASE}`,
            }}
          >
            <style>{`@keyframes neuPopIn { from { opacity: 0; transform: translateY(${pos.up ? '-100%' : '0'}) scale(0.97); } to { opacity: 1; } }`}</style>
            {panel}
          </div>
        </Portal>
      )}
    </span>
  );
}

// ── Chips ───────────────────────────────────────────────────────────────────
// One shape, one size, two volumes. LOUD (gradient fill + coloured seat) is
// reserved for the three states a staff member must act on. QUIET (extruded
// cream) carries plain facts and never competes.

function LoudChip({ icon: Icon, children, gradient, title }: {
  icon: typeof Clock; children: React.ReactNode; gradient: [string, string]; title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 flex-shrink-0"
      style={{
        padding: '4px 10px', borderRadius: 999,
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800,
        letterSpacing: '0.05em', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
        boxShadow: `0 3px 8px ${gradient[0]}55, ${NEU.outSm}`,
      }}
    >
      <Icon size={12} strokeWidth={2.7} style={{ color: '#FFFFFF' }} />
      {children}
    </span>
  );
}

function QuietChip({ icon: Icon, children, title }: { icon: typeof Clock; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 flex-shrink-0"
      style={{
        padding: '4px 10px', borderRadius: 999, backgroundColor: NEU.surface, boxShadow: NEU.outSm,
        color: NEU.ink, fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700,
        letterSpacing: '0.03em', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Icon size={11.5} strokeWidth={2.4} style={{ color: NEU.deepGold }} />
      {children}
    </span>
  );
}

/** A quiet chip that is also a filter control. Stops its click from reaching
 *  the row (which would open the dashboard instead of filtering). */
function FilterChip({ icon: Icon, children, onFilter, active, title }: {
  icon: typeof Clock; children: React.ReactNode; onFilter: () => void; active?: boolean; title?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={e => { e.stopPropagation(); e.preventDefault(); onFilter(); }}
      onKeyDown={e => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center gap-1.5 flex-shrink-0 focus:outline-none"
      style={{
        padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
        backgroundColor: active ? undefined : NEU.surface,
        background: active ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : undefined,
        color: active ? '#FFFFFF' : NEU.ink,
        boxShadow: active ? `0 3px 8px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : hovered ? NEU.outSmHover : NEU.outSm,
        fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em',
        whiteSpace: 'nowrap', maxWidth: 220,
        transition: `box-shadow 180ms ${EASE}`,
      }}
    >
      <Icon size={11.5} strokeWidth={2.4} style={{ color: active ? 'rgba(255,255,255,0.85)' : NEU.deepGold, flexShrink: 0 }} />
      <span className="truncate">{children}</span>
    </button>
  );
}

// ── Logo anchor: the row's identity, wearing two corner badges ──────────────

function CornerBadge({
  onFilter, active, title, ariaLabel, children, corner, tone,
}: {
  onFilter: () => void; active: boolean; title: string; ariaLabel: string;
  children: React.ReactNode; corner: 'tr' | 'bl'; tone: 'live' | 'draft' | 'plain';
}) {
  const [hovered, setHovered] = useState(false);
  const pos = corner === 'tr' ? { top: -3, right: -4 } : { bottom: -3, left: -4 };
  const bg = tone === 'live'
    ? `linear-gradient(135deg, ${NEU_GRADIENTS.green[0]}, ${NEU_GRADIENTS.green[1]})`
    : undefined;
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={e => { e.stopPropagation(); e.preventDefault(); onFilter(); }}
      onKeyDown={e => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute inline-flex items-center justify-center focus:outline-none"
      style={{
        ...pos,
        width: 25, height: 25, borderRadius: 999, padding: 0, cursor: 'pointer',
        background: bg,
        backgroundColor: bg ? undefined : '#FDFCF9',
        border: active ? `2px solid ${NEU.deepGold}` : '1px solid rgba(221,212,192,0.85)',
        boxShadow: hovered ? NEU.outSmHover : NEU.outSm,
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        transition: `transform 180ms ${EASE}, box-shadow 180ms ${EASE}`,
        overflow: 'hidden',
      }}
    >
      {children}
    </button>
  );
}

// ── Organiser ───────────────────────────────────────────────────────────────

function OrganizerAvatar({ name, email, avatar, size = 20 }: {
  name: string | null; email: string | null; avatar?: string | null; size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (avatar && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt=""
        aria-hidden
        onError={() => setFailed(true)}
        draggable={false}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size, border: '1px solid rgba(221,212,192,0.8)' }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 999,
        background: 'linear-gradient(135deg, #16301F 0%, #2A5A3C 100%)',
        color: NEU.gold, fontFamily: OUTFIT, fontWeight: 800,
        fontSize: Math.max(8, Math.round(size * 0.42)), letterSpacing: '0.02em', lineHeight: 1,
      }}
    >
      {initialsOf(name, email)}
    </span>
  );
}

// ── Sort menu, portaled + edge-flipped ──────────────────────────────────────

type SortKey = 'newest' | 'oldest' | 'updated' | 'setup' | 'apps' | 'name';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest',  label: 'Newest listed' },
  { key: 'oldest',  label: 'Oldest listed' },
  { key: 'updated', label: 'Recently touched' },
  { key: 'setup',   label: 'Least set up' },
  { key: 'apps',    label: 'Most applications' },
  { key: 'name',    label: 'Name A→Z' },
];

function SortMenu({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const W = 200;

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const M = 12;
    const h = SORTS.length * 34 + 14;
    const up = r.bottom + 8 + h > window.innerHeight && r.top > h;
    let left = r.right - W;
    left = Math.max(M, Math.min(left, window.innerWidth - W - M));
    setPos({ top: up ? r.top - 8 : r.bottom + 8, left, up });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const current = SORTS.find(s => s.key === value) ?? SORTS[0];

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={() => { if (!open) place(); setOpen(o => !o); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 focus:outline-none"
        style={{
          padding: '9px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
          fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em',
          color: open ? '#FFFFFF' : NEU.ink,
          background: open ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
          boxShadow: open ? `0 4px 10px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : NEU.outSm,
          transition: `box-shadow 200ms ${EASE}`,
        }}
      >
        <ArrowDownWideNarrow size={14} strokeWidth={2.5} />
        {current.label.toUpperCase()}
        <ChevronDown size={12} strokeWidth={2.6} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: `transform 160ms ${EASE}` }} />
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: W, zIndex: 9999,
              transform: pos.up ? 'translateY(-100%)' : undefined,
              backgroundColor: NEU.surface, borderRadius: 14, boxShadow: NEU.out, padding: 6,
            }}
          >
            {SORTS.map(s => {
              const on = s.key === value;
              return (
                <button
                  key={s.key}
                  role="option"
                  aria-selected={on}
                  onClick={() => { onChange(s.key); setOpen(false); }}
                  className="inline-flex items-center gap-2 w-full focus:outline-none"
                  style={{
                    padding: '8px 11px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: on ? 'rgba(27,56,40,0.07)' : 'transparent',
                    fontFamily: OUTFIT, fontSize: 12, fontWeight: on ? 800 : 700, color: NEU.ink,
                  }}
                  onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Check size={13} strokeWidth={3} style={{ color: on ? NEU.forest : 'transparent', flexShrink: 0 }} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </div>
  );
}

// ── Filters ─────────────────────────────────────────────────────────────────

type Filters = {
  state: Set<string>;     // 'live' | 'draft'
  country: Set<string>;
  organizer: Set<string>;
  setup: Set<string>;     // 'complete' | 'incomplete'
  flags: Set<string>;     // 'stalled' | 'seats' | 'dais' | 'tbd'
};

const EMPTY_FILTERS = (): Filters => ({
  state: new Set(), country: new Set(), organizer: new Set(), setup: new Set(), flags: new Set(),
});

const FLAG_LABEL: Record<string, string> = {
  stalled: `Stalled ${STALE_DAYS}d+`, seats: 'Short on seats', dais: 'Empty dais', tbd: 'Dates TBD',
};
const STATE_LABEL: Record<string, string> = { live: 'Live', draft: 'Draft' };
const SETUP_LABEL: Record<string, string> = { complete: 'Set-up done', incomplete: 'Set-up pending' };

function countFilters(f: Filters) {
  return f.state.size + f.country.size + f.organizer.size + f.setup.size + f.flags.size;
}

// ── The tab ─────────────────────────────────────────────────────────────────

export default function ConferencesTab({
  rows, logos, avatars = {},
}: {
  rows: AdminConferenceRow[];
  /** conference id → logo_url, loaded separately (the overview RPC has no logo). */
  logos: Record<string, string | null>;
  /** conference id → its organiser's profiles.avatar_url, likewise. */
  avatars?: Record<string, string | null>;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // Peter #2: newest listed first, by created_at desc.
  const [sort, setSort] = useState<SortKey>('newest');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 170);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Toggling a filter value: clicking the same single value again clears it, so
  // every clickable piece of a row behaves as an on/off switch.
  const toggle = useCallback(<K extends keyof Filters>(key: K, value: string) => {
    setFilters(f => ({ ...f, [key]: toggleIn(f[key], value) }));
  }, []);
  const only = useCallback(<K extends keyof Filters>(key: K, value: string) => {
    setFilters(f => {
      const cur = f[key];
      const isOnlyThis = cur.size === 1 && cur.has(value);
      return { ...f, [key]: isOnlyThis ? new Set<string>() : new Set([value]) };
    });
  }, []);
  const clearAll = useCallback(() => setFilters(EMPTY_FILTERS()), []);

  const countryOptions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) if (r.country) seen.set(r.country, (seen.get(r.country) ?? 0) + 1);
    return Array.from(seen.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([c, n]) => ({ label: `${c} (${n})`, value: c }));
  }, [rows]);

  const organizerOptions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) {
      const key = r.organizer_name ?? r.organizer_email;
      if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return Array.from(seen.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24)
      .map(([c, n]) => ({ label: `${c} (${n})`, value: c }));
  }, [rows]);

  const stats = useMemo(() => ({
    total: rows.length,
    live: rows.filter(r => r.is_public).length,
    drafts: rows.filter(r => !r.is_public).length,
    setupDone: rows.filter(r => r.setup_complete).length,
    stalled: rows.filter(isStalled).length,
    shortSeats: rows.filter(isShortOnSeats).length,
  }), [rows]);

  const shown = useMemo(() => {
    let r = rows;
    if (filters.state.size) r = r.filter(x => filters.state.has(x.is_public ? 'live' : 'draft'));
    if (filters.country.size) r = r.filter(x => !!x.country && filters.country.has(x.country));
    if (filters.organizer.size) r = r.filter(x => {
      const key = x.organizer_name ?? x.organizer_email;
      return !!key && filters.organizer.has(key);
    });
    if (filters.setup.size) r = r.filter(x => filters.setup.has(x.setup_complete ? 'complete' : 'incomplete'));
    if (filters.flags.size) {
      r = r.filter(x =>
        (filters.flags.has('stalled') && isStalled(x)) ||
        (filters.flags.has('seats') && isShortOnSeats(x)) ||
        (filters.flags.has('dais') && hasEmptyDais(x)) ||
        (filters.flags.has('tbd') && x.dates_tbd));
    }
    if (search) {
      r = r.filter(x =>
        (x.acronym ?? '').toLowerCase().includes(search) ||
        x.full_name.toLowerCase().includes(search) ||
        x.slug.toLowerCase().includes(search) ||
        (x.organizer_name ?? '').toLowerCase().includes(search) ||
        (x.organizer_email ?? '').toLowerCase().includes(search) ||
        (x.city ?? '').toLowerCase().includes(search) ||
        (x.country ?? '').toLowerCase().includes(search));
    }
    const ts = (s: string | null) => (s ? new Date(s).getTime() : 0);
    const sorted = [...r];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'oldest':  return ts(a.created_at) - ts(b.created_at);
        case 'updated': return ts(b.updated_at) - ts(a.updated_at);
        case 'setup':   return (a.setup_done / Math.max(a.setup_total, 1)) - (b.setup_done / Math.max(b.setup_total, 1))
                            || ts(b.created_at) - ts(a.created_at);
        case 'apps':    return b.applications - a.applications || ts(b.created_at) - ts(a.created_at);
        case 'name':    return (a.acronym || a.full_name).localeCompare(b.acronym || b.full_name);
        default:        return ts(b.created_at) - ts(a.created_at);
      }
    });
    return sorted;
  }, [rows, filters, search, sort]);

  const activeCount = countFilters(filters);

  // Active-filter chips: one removable chip per applied value, in the order a
  // reader would name them.
  const activeChips: { key: string; label: string; remove: () => void }[] = [
    ...Array.from(filters.state).map(v => ({ key: `state:${v}`, label: STATE_LABEL[v] ?? v, remove: () => toggle('state', v) })),
    ...Array.from(filters.setup).map(v => ({ key: `setup:${v}`, label: SETUP_LABEL[v] ?? v, remove: () => toggle('setup', v) })),
    ...Array.from(filters.country).map(v => ({ key: `country:${v}`, label: v, remove: () => toggle('country', v) })),
    ...Array.from(filters.organizer).map(v => ({ key: `org:${v}`, label: v, remove: () => toggle('organizer', v) })),
    ...Array.from(filters.flags).map(v => ({ key: `flag:${v}`, label: FLAG_LABEL[v] ?? v, remove: () => toggle('flags', v) })),
  ];

  const statTiles = [
    { label: 'All conferences', value: stats.total,      emoji: 'Card index',        icon: Building2,   gradient: NEU_GRADIENTS.forest, active: activeCount === 0, onClick: clearAll },
    { label: 'Live',            value: stats.live,       emoji: 'Globe showing europe-africa', icon: Globe, gradient: NEU_GRADIENTS.green,  active: filters.state.size === 1 && filters.state.has('live'),  onClick: () => only('state', 'live') },
    { label: 'Drafts',          value: stats.drafts,     emoji: 'Memo',              icon: PencilLine,  gradient: NEU_GRADIENTS.amber,  active: filters.state.size === 1 && filters.state.has('draft'), onClick: () => only('state', 'draft') },
    { label: 'Set-up done',     value: stats.setupDone,  emoji: 'Check mark button', icon: Check,       gradient: NEU_GRADIENTS.sage,   active: filters.setup.size === 1 && filters.setup.has('complete'), onClick: () => only('setup', 'complete') },
    { label: `Stalled ${STALE_DAYS}d+`, value: stats.stalled, emoji: 'Hourglass not done', icon: Clock, gradient: NEU_GRADIENTS.gold,   active: filters.flags.size === 1 && filters.flags.has('stalled'), onClick: () => only('flags', 'stalled') },
    { label: 'Short on seats',  value: stats.shortSeats, emoji: 'Chair',             icon: CircleAlert, gradient: NEU_GRADIENTS.amber,  active: filters.flags.size === 1 && filters.flags.has('seats'),   onClick: () => only('flags', 'seats') },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2.5 flex-wrap mb-5">
        <div
          className="inline-flex items-center gap-2"
          style={{ padding: '8px 14px', borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, minWidth: 236 }}
        >
          <Search size={15} strokeWidth={2.4} style={{ color: NEU.muted, flexShrink: 0 }} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Conference, organiser, city…"
            aria-label="Search conferences"
            className="flex-1 outline-none"
            style={{ backgroundColor: 'transparent', color: NEU.ink, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, minWidth: 0 }}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none"
              style={{ width: 18, height: 18, borderRadius: 999, background: 'transparent', border: 'none', cursor: 'pointer', color: NEU.muted }}
            >
              <X size={13} strokeWidth={2.6} />
            </button>
          )}
        </div>

        <FilterPopoverShell title="Filter conferences" activeCount={activeCount} onClearAll={clearAll}>
          <FilterGroup
            title="State" icon={Globe}
            options={[{ label: 'Live', value: 'live' }, { label: 'Draft', value: 'draft' }]}
            selected={filters.state}
            onToggle={v => toggle('state', v)}
            onAll={() => setFilters(f => ({ ...f, state: new Set(['live', 'draft']) }))}
            onNone={() => setFilters(f => ({ ...f, state: new Set() }))}
          />
          <FilterGroup
            title="Set-up" icon={Check}
            options={[{ label: 'Done', value: 'complete' }, { label: 'Pending', value: 'incomplete' }]}
            selected={filters.setup}
            onToggle={v => toggle('setup', v)}
            onAll={() => setFilters(f => ({ ...f, setup: new Set(['complete', 'incomplete']) }))}
            onNone={() => setFilters(f => ({ ...f, setup: new Set() }))}
          />
          <FilterGroup
            title="Needs attention" icon={CircleAlert}
            options={Object.entries(FLAG_LABEL).map(([value, label]) => ({ label, value }))}
            selected={filters.flags}
            onToggle={v => toggle('flags', v)}
            onAll={() => setFilters(f => ({ ...f, flags: new Set(Object.keys(FLAG_LABEL)) }))}
            onNone={() => setFilters(f => ({ ...f, flags: new Set() }))}
          />
          {countryOptions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <FilterHeading icon={MapPin}>Country</FilterHeading>
                <button
                  onClick={() => setFilters(f => ({ ...f, country: new Set() }))}
                  className="focus:outline-none"
                  style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer' }}
                >NONE</button>
              </div>
              <div className="flex flex-wrap gap-1.5" style={{ maxHeight: 148, overflowY: 'auto' }}>
                {countryOptions.map(o => (
                  <CheckChip key={o.value} label={o.label} checked={filters.country.has(o.value)} onClick={() => toggle('country', o.value)} />
                ))}
              </div>
            </div>
          )}
          {organizerOptions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <FilterHeading icon={Users}>Organiser</FilterHeading>
                <button
                  onClick={() => setFilters(f => ({ ...f, organizer: new Set() }))}
                  className="focus:outline-none"
                  style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer' }}
                >NONE</button>
              </div>
              <div className="flex flex-wrap gap-1.5" style={{ maxHeight: 148, overflowY: 'auto' }}>
                {organizerOptions.map(o => (
                  <CheckChip key={o.value} label={o.label} checked={filters.organizer.has(o.value)} onClick={() => toggle('organizer', o.value)} />
                ))}
              </div>
            </div>
          )}
        </FilterPopoverShell>

        <SortMenu value={sort} onChange={setSort} />

        <span className="ml-auto" style={{ fontFamily: MONO, fontSize: 11, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
          {shown.length === rows.length ? `${rows.length} conferences` : `${shown.length} of ${rows.length}`}
        </span>
      </div>

      {/* Stat tiles — each one is also a filter. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {statTiles.map(s => (
          <NeuStatTile
            key={s.label} emoji={s.emoji} icon={s.icon} gradient={s.gradient}
            value={s.value} label={s.label} compact active={s.active} onClick={s.onClick}
          />
        ))}
      </div>

      {/* Active filters — always visible, individually and collectively clearable. */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', color: NEU.muted, textTransform: 'uppercase' }}>
            Filtered by
          </span>
          {activeChips.map(c => (
            <button
              key={c.key}
              onClick={c.remove}
              className="inline-flex items-center gap-1.5 focus:outline-none"
              aria-label={`Remove filter ${c.label}`}
              style={{
                padding: '4px 8px 4px 11px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
                color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.02em',
                boxShadow: `0 3px 8px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}`,
              }}
            >
              {c.label}
              <X size={12} strokeWidth={3} style={{ color: 'rgba(255,255,255,0.8)' }} />
            </button>
          ))}
          <button
            onClick={clearAll}
            className="focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', color: '#8B2020', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            CLEAR ALL
          </button>
        </div>
      )}

      {/* Rows */}
      {shown.length === 0 ? (
        <NeuCard style={{ padding: '48px 24px' }}>
          <div className="flex flex-col items-center text-center">
            <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Building2} emoji="Card index" size={46} />
            <p className="mt-4" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>
              {rows.length === 0 ? 'No conferences yet' : 'Nothing matches'}
            </p>
            <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
              {rows.length === 0 ? 'Every conference on the platform will show up here.' : 'Loosen a filter, or clear them all.'}
            </p>
          </div>
        </NeuCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map(r => (
            <ConferenceRow
              key={r.id}
              r={r}
              logo={logos[r.id] ?? null}
              avatar={avatars[r.id] ?? r.organizer_avatar ?? null}
              filters={filters}
              onFilterState={v => only('state', v)}
              onFilterCountry={v => only('country', v)}
              onFilterOrganizer={v => only('organizer', v)}
              onOpen={(newTab) => {
                const href = `/manage/${r.slug}`;
                if (newTab) window.open(href, '_blank', 'noopener');
                else router.push(href);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── One conference ──────────────────────────────────────────────────────────

function ConferenceRow({
  r, logo, avatar, filters, onFilterState, onFilterCountry, onFilterOrganizer, onOpen,
}: {
  r: AdminConferenceRow;
  logo: string | null;
  avatar: string | null;
  filters: Filters;
  onFilterState: (v: string) => void;
  onFilterCountry: (v: string) => void;
  onFilterOrganizer: (v: string) => void;
  onOpen: (newTab: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const idle = daysSince(r.updated_at);
  const stalled = isStalled(r);
  const short = isShortOnSeats(r);
  const emptyDais = hasEmptyDais(r);
  const pending = outstandingSteps(r.pending_keys);
  const done = Math.min(r.setup_done, r.setup_total);
  const countryCode = r.country ? getCountryByName(r.country)?.code : undefined;
  const organizerKey = r.organizer_name ?? r.organizer_email;
  const dates = r.dates_tbd ? null : formatRange(r.start_date, r.end_date);
  const acronym = (r.acronym ?? '').trim();
  const showFullNameBeneath = !!acronym && acronym.toLowerCase() !== r.full_name.trim().toLowerCase();

  return (
    // Peter #7: the row itself is the link. `role="link"` + tabIndex makes it
    // reachable and Enter-activatable; the keydown handler only fires when the
    // event target IS the row, so Enter on a nested filter button never also
    // opens the dashboard. Cmd/Ctrl/middle-click still opens a new tab.
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open ${acronym || r.full_name} dashboard`}
      onClick={e => onOpen(e.metaKey || e.ctrlKey)}
      onAuxClick={e => { if (e.button === 1) { e.preventDefault(); onOpen(true); } }}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(e.metaKey || e.ctrlKey); }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="focus:outline-none"
      style={{
        backgroundColor: NEU.surface,
        borderRadius: 20,
        padding: '13px 16px',
        cursor: 'pointer',
        boxShadow: hovered ? NEU.outHover : NEU.out,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 240ms ${EASE}, transform 240ms ${EASE}`,
      }}
    >
      <div className="flex items-center gap-4 flex-wrap">
        {/* ── Logo anchor + corner badges (#5) ── */}
        <div className="relative flex-shrink-0" style={{ width: 58, height: 58 }}>
          <LogoDisc
            src={logo}
            alt={acronym || r.full_name}
            size={58}
            fallbackText={(acronym || r.full_name).slice(0, 3)}
          />
          <CornerBadge
            corner="tr"
            tone={r.is_public ? 'live' : 'draft'}
            active={filters.state.size === 1 && filters.state.has(r.is_public ? 'live' : 'draft')}
            title={r.is_public ? 'Live — filter to live conferences' : 'Draft, not published — filter to drafts'}
            ariaLabel={r.is_public ? 'Filter to live conferences' : 'Filter to draft conferences'}
            onFilter={() => onFilterState(r.is_public ? 'live' : 'draft')}
          >
            {r.is_public
              ? <Globe size={13} strokeWidth={2.8} style={{ color: '#FFFFFF' }} />
              : <PencilLine size={13} strokeWidth={2.8} style={{ color: NEU.muted }} />}
          </CornerBadge>
          {r.country && (
            <CornerBadge
              corner="bl"
              tone="plain"
              active={filters.country.size === 1 && filters.country.has(r.country)}
              title={`${r.country} — filter to this country`}
              ariaLabel={`Filter to ${r.country}`}
              onFilter={() => onFilterCountry(r.country as string)}
            >
              {countryCode
                ? <FlagImg code={countryCode} size={17} />
                : <Globe size={12} strokeWidth={2.5} style={{ color: NEU.muted }} />}
            </CornerBadge>
          )}
        </div>

        {/* ── Identity + meta ── */}
        <div className="flex-1 min-w-0" style={{ minWidth: 240 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 16.5, color: NEU.ink, letterSpacing: '-0.01em' }}>
              {acronym || r.full_name}
            </span>
            {/* Tier-2, loud, only for things a staff member must act on. */}
            {short && (
              <LoudChip icon={CircleAlert} gradient={DANGER} title={`Committees seat ${r.seat_capacity}, ${r.expected_delegates} delegates expected`}>
                {r.seat_capacity}/{r.expected_delegates} SEATS
              </LoudChip>
            )}
            {emptyDais && (
              <LoudChip icon={Gavel} gradient={ATTENTION} title={`${r.chairs_missing} of ${r.committees} committees have no chair`}>
                {r.chairs_missing} NO CHAIR
              </LoudChip>
            )}
            {stalled && idle !== null && (
              <LoudChip icon={Clock} gradient={ATTENTION} title={`Draft untouched for ${idle} days`}>
                STALLED {idle}D
              </LoudChip>
            )}
          </div>

          {showFullNameBeneath && (
            <p className="truncate mt-0.5" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, fontWeight: 600 }}>
              {r.full_name}
            </p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {(r.city || r.country) && (
              <FilterChip
                icon={MapPin}
                active={!!r.country && filters.country.size === 1 && filters.country.has(r.country)}
                title={r.country ? `Filter to ${r.country}` : undefined}
                onFilter={() => r.country && onFilterCountry(r.country)}
              >
                {[r.city, r.country].filter(Boolean).join(', ')}
              </FilterChip>
            )}
            {dates
              ? <QuietChip icon={CalendarClock}>{dates}</QuietChip>
              : <QuietChip icon={CalendarClock} title="No dates set yet">DATES TBD</QuietChip>}
            {organizerKey && (
              // Peter #8: organiser picture beside the name, graceful initials.
              <FilterChip
                icon={Users}
                active={filters.organizer.size === 1 && filters.organizer.has(organizerKey)}
                title={r.organizer_email ?? undefined}
                onFilter={() => onFilterOrganizer(organizerKey)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <OrganizerAvatar name={r.organizer_name} email={r.organizer_email} avatar={avatar} size={17} />
                  {r.organizer_name ?? r.organizer_email}
                </span>
              </FilterChip>
            )}
            {idle !== null && !stalled && (
              <span style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                touched {idle}d ago
              </span>
            )}
          </div>
        </div>

        {/* ── Counts ── */}
        <NeuInset small style={{ padding: '8px 14px', borderRadius: 14, flexShrink: 0 }}>
          <div className="flex items-center" style={{ gap: 16 }}>
            <Count value={r.committees} label="cttee" />
            <Count value={r.applications} label="apps" strong />
            <Count value={r.paid_applications} label="paid" tone={NEU.green} />
          </div>
        </NeuInset>

        {/* ── Set-up ring (#6) ── */}
        <HoverPop
          width={252}
          label={`Set-up ${done} of ${r.setup_total}${pending.length ? `; outstanding: ${pending.map(p => p.label).join(', ')}` : ''}`}
          panel={
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <NeuIconDisc gradient={r.setup_complete ? NEU_GRADIENTS.green : NEU_GRADIENTS.gold} icon={r.setup_complete ? Check : Clock} size={24} />
                <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, color: NEU.ink }}>
                  Set-up {done}/{r.setup_total}
                </p>
              </div>
              {pending.length === 0 ? (
                <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.green, fontWeight: 700 }}>
                  Every set-up step is done.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted, textTransform: 'uppercase' }}>
                    Still outstanding
                  </p>
                  {pending.map(s => {
                    const Icon = s.icon;
                    return (
                      <span key={s.key} className="inline-flex items-center gap-2">
                        <Icon size={13} strokeWidth={2.4} style={{ color: NEU.deepGold, flexShrink: 0 }} />
                        <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink }}>{s.label}</span>
                      </span>
                    );
                  })}
                </div>
              )}
              {!r.is_public && (
                <p className="mt-2.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted }}>
                  Not published yet.
                </p>
              )}
            </div>
          }
        >
          <NeuRing
            value={done}
            max={r.setup_total}
            size={58}
            strokeWidth={9}
            gradient={r.setup_complete ? NEU_GRADIENTS.green : NEU_GRADIENTS.gold}
          >
            <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 15, color: NEU.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {done}/{r.setup_total}
            </span>
          </NeuRing>
        </HoverPop>

        {/* Affordance that the whole row is the link (#7). */}
        <ArrowUpRight
          size={17}
          strokeWidth={2.6}
          aria-hidden
          className="flex-shrink-0"
          style={{
            color: hovered ? NEU.forest : NEU.muted,
            opacity: hovered ? 1 : 0.45,
            transform: hovered ? 'translate(2px,-2px)' : 'none',
            transition: `transform 240ms ${EASE}, color 240ms ${EASE}, opacity 240ms ${EASE}`,
          }}
        />
      </div>
    </div>
  );
}

function Count({ value, label, strong, tone }: { value: number; label: string; strong?: boolean; tone?: string }) {
  return (
    <span className="flex flex-col items-center" style={{ minWidth: 34 }}>
      <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: strong ? 16 : 14.5, lineHeight: 1, color: tone ?? NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', color: NEU.muted, textTransform: 'uppercase', marginTop: 3 }}>
        {label}
      </span>
    </span>
  );
}
