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
//   • Clicking ANYWHERE on a row opens that conference's dashboard IN A NEW TAB.
//     The row is a real <a href> so hover shows the target, middle-click and
//     "copy link address" work, and the browser owns every modifier. The small
//     number of in-row filter controls are real <button>s that preventDefault,
//     so the two interactions never fight.
//   • Chips are tiered: only exceptions (short on seats, stalled, empty dais)
//     get a saturated fill. Plain facts stay quiet and extruded, and a fact
//     nobody has told us yet gets no chip at all (see INTENT_ICON).
//
// Presentation only — the caller owns the RPC, the gate and the data.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownWideNarrow, ArrowUpRight, Building2, CalendarClock, Check, ChevronDown,
  CircleAlert, Clock, FileText, Gavel, Globe, LayoutTemplate, Mail, MapPin, Megaphone,
  PencilLine, Rocket, Search, Target, UserPlus, Users, Wallet, X,
} from 'lucide-react';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuInset, NeuStatTile, NeuIconDisc, NeuRing } from '@/components/neu';
import Portal from '@/components/Portal';
import { LogoDisc } from '@/components/LogoDisc';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByName } from '@/lib/countries';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import VerifiedCheck from '@/components/VerifiedCheck';
import {
  INTENT_OPTIONS, getConferenceIntent, intentAnswered, intentLabels,
  type ConferenceIntent,
} from '@/lib/conferenceIntent';
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
  /** conferences.intent, the raw jsonb. Deliberately `unknown`: the only legal
   *  reader is getConferenceIntent(), which is defensive by contract and drops
   *  keys it does not recognise. Never destructure this blob by hand. */
  intent: unknown;
  /** The stored blue checkmark. Comes from the RPC rather than a follow-up
   *  read, so a dropped secondary request can never make the Verified tile
   *  quietly report zero. `refresh_conference_verification()` is its only
   *  writer; a guard trigger rejects direct writes to the column. */
  is_verified: boolean;
  verified_at: string | null;
  /** Not returned by admin_conference_overview(). Avatars are resolved from
   *  `profiles` by the caller and passed in via the `avatars` map instead; this
   *  optional field is only a fallback should the RPC ever start returning one. */
  organizer_avatar?: string | null;
}

// ── Set-up steps ────────────────────────────────────────────────────────────
// THE SAME EIGHT PRIORITIES THE ORGANISER IS SHOWN, in the same journey order
// (src/app/manage/[slug]/page.tsx `checklist`). conference_setup_status() now
// builds all eight, reports setup_total as the length of its own item list, and
// counts setup_done and pending_keys over the same eight with no exception for
// `publish` — so the ring, the hover list and the organiser's own ring can no
// longer disagree, and there is nothing left for this file to patch.
//
// It was nine until awards went behind a coming-soon screen in Settings; the
// item was removed from the SQL and from the organiser checklist in the same
// change, and `admin_conference_overview()`'s setup_total fallback moved from
// 9 to 8 with it.
//
// Before, the SQL built eight items, hardcoded 'setup_total', 7 and subtracted
// `publish` from setup_done only, while pending_keys kept it. Three different
// answers to one question, and a ring that divided by a number matching none
// of them.
//
// Icons are deliberately NOT ticks — every item rendered from this list is
// outstanding, so a checkmark would read as "done". Nor a Globe, which is the
// live badge's glyph.
const SETUP_STEPS: { key: string; label: string; icon: typeof LayoutTemplate }[] = [
  { key: 'page',        label: 'Conference page',    icon: LayoutTemplate },
  { key: 'committees',  label: 'Committees & seats', icon: Building2 },
  { key: 'chairs',      label: 'Chairs on the dais', icon: Gavel },
  { key: 'email',       label: 'Applicant email',    icon: Mail },
  { key: 'secretariat', label: 'Secretariat',        icon: Users },
  { key: 'financials',  label: 'Financials',         icon: Wallet },
  // 'delegate' was here. "Get your first delegate" was dropped from the
  // organiser checklist and from conference_setup_status() in the same change:
  // it measured demand, not readiness, it was never a verification criterion,
  // and it was the row that made this list and the organiser's disagree.
  // 'awards' was here. The awards checklist item was removed from
  // conference_setup_status() when awards went behind a coming-soon screen, so
  // the key can never come back in pending_keys. Restore this row if it does.
  { key: 'publish',     label: 'Published',          icon: Rocket },
];
const STEP_BY_KEY = new Map(SETUP_STEPS.map(s => [s.key, s]));

function outstandingSteps(pendingKeys: string[]) {
  return pendingKeys.map(k => STEP_BY_KEY.get(k) ?? { key: k, label: k, icon: CircleAlert });
}

// ── Stated intent ───────────────────────────────────────────────────────────
// What the organiser said, at the end of the creation wizard, they came here to
// do. The option list itself lives in src/lib/conferenceIntent.ts and is not
// restated here; this map only picks the Lucide glyph for each key, because
// INTENT_OPTIONS carries a Fluent 3D emoji name for the wizard and the /admin
// side is Lucide-only. Where a key overlaps a set-up step (committees, chairs,
// emails, payments) the SAME glyph is used, so the hover panels agree.
//
// THREE STATES, and only one of them earns a chip:
//   answered      → a QUIET chip plus a hover panel. It is a plain fact about a
//                   sales conversation, never an exception, so it must never
//                   take a saturated fill (see the chip tiering note at the top).
//   asked+skipped → a fainter chip reading NOT SAID. Real information: we put
//                   the question and they declined.
//   never asked   → NOTHING. Every conference created before the question
//                   shipped is in this state, which today is 195 of 198. A
//                   marker on all of them would be noise on every row and would
//                   read as a defect in the conference, which it is not. The
//                   absence of a chip IS the state, and it costs no scanning.
const INTENT_ICON: Record<string, typeof LayoutTemplate> = {
  applications: FileText,
  payments: Wallet,
  committees: Building2,
  emails: Mail,
  chairs: Gavel,
  marketing: Megaphone,
};

/** Two short labels fit the meta row beside location, dates and organiser.
 *  Beyond that the row starts wrapping for a sales field, so the rest collapses
 *  into a +N and the hover panel carries them in full. */
const INTENT_CHIP_MAX = 2;

/** Filter values that are NOT option keys. Kept distinct from INTENT_OPTIONS
 *  keys so the two can never collide. */
const INTENT_SKIPPED = 'skipped';
const INTENT_UNASKED = 'unasked';

/** "APPLICATIONS" → "Applications". Derived from the shared option list rather
 *  than a second hand-written list of labels. */
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

const INTENT_FILTER_LABEL: Record<string, string> = {
  ...Object.fromEntries(INTENT_OPTIONS.map(o => [o.key, titleCase(o.short)])),
  [INTENT_SKIPPED]: 'Did not say',
  [INTENT_UNASKED]: 'Never asked',
};

function matchesIntent(selected: Set<string>, intent: ConferenceIntent): boolean {
  if (selected.has(INTENT_UNASKED) && !intentAnswered(intent)) return true;
  if (selected.has(INTENT_SKIPPED) && intent.skipped && intent.keys.length === 0) return true;
  return intent.keys.some(k => selected.has(k));
}

/** answered_at is a full ISO timestamp, not a calendar-day `date` column, so
 *  unlike start_date/end_date it is safe to read through Date. */
function answeredOn(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
  children, panel, width = 252, label, estimatedHeight = 200,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
  width?: number;
  /** Screen-reader / native-tooltip summary of the same information. */
  label?: string;
  /** Roughly how tall the panel will be, used only to decide whether to flip
   *  above the trigger. The default suits the set-up list; a panel that can grow
   *  taller than that must say so, or it opens downward and runs off the bottom
   *  of the viewport (fixed position means no ancestor clips it, but the
   *  viewport still can). */
  estimatedHeight?: number;
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
    const up = r.bottom + 10 + estimatedHeight > window.innerHeight && r.top > estimatedHeight;
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(M, Math.min(left, window.innerWidth - width - M));
    setPos({ top: up ? r.top - 10 : r.bottom + 10, left, up });
  }, [width, estimatedHeight]);

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

/** Quieter still: same shape, no gold seat, ink dropped to the readable
 *  secondary. Reserved for a fact whose content is an absence, where a
 *  full-volume QuietChip would over-claim. `inkSoft`, never `muted` — this is a
 *  real word a person has to read. */
function FaintChip({ icon: Icon, children, title }: { icon: typeof Clock; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 flex-shrink-0"
      style={{
        padding: '4px 10px', borderRadius: 999, backgroundColor: NEU.surface, boxShadow: NEU.outSm,
        color: NEU.inkSoft, fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700,
        letterSpacing: '0.03em', whiteSpace: 'nowrap', cursor: 'help',
      }}
    >
      <Icon size={11.5} strokeWidth={2.4} style={{ color: NEU.inkSoft, opacity: 0.75 }} />
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

type SortKey = 'newest' | 'oldest' | 'updated' | 'setup' | 'verified' | 'apps' | 'name';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest',  label: 'Newest listed' },
  { key: 'oldest',  label: 'Oldest listed' },
  { key: 'updated', label: 'Recently touched' },
  { key: 'setup',   label: 'Least set up' },
  // Verification, not set-up, is what the row now leads with, so it gets its
  // own axis. Unverified first (that is the queue worth working), and within
  // each group the one closest to its checkmark rises.
  { key: 'verified', label: 'Not verified first' },
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
  verified: Set<string>;  // 'yes' | 'no' — the blue checkmark, not set-up progress
  flags: Set<string>;     // 'stalled' | 'seats' | 'dais' | 'tbd'
  intent: Set<string>;    // an INTENT_OPTIONS key, or 'skipped' | 'unasked'
};

const EMPTY_FILTERS = (): Filters => ({
  state: new Set(), country: new Set(), organizer: new Set(), setup: new Set(), flags: new Set(),
  verified: new Set(), intent: new Set(),
});

const FLAG_LABEL: Record<string, string> = {
  stalled: `Stalled ${STALE_DAYS}d+`, seats: 'Short on seats', dais: 'Empty dais', tbd: 'Dates TBD',
};
const STATE_LABEL: Record<string, string> = { live: 'Live', draft: 'Draft' };
const SETUP_LABEL: Record<string, string> = { complete: 'Set-up done', incomplete: 'Set-up pending' };
const VERIFIED_LABEL: Record<string, string> = { yes: 'Verified', no: 'Not verified' };

function countFilters(f: Filters) {
  return f.state.size + f.country.size + f.organizer.size + f.setup.size + f.flags.size + f.intent.size;
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
    verified: rows.filter(r => r.is_verified).length,
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
    if (filters.verified.size) r = r.filter(x => filters.verified.has(x.is_verified ? 'yes' : 'no'));
    if (filters.flags.size) {
      r = r.filter(x =>
        (filters.flags.has('stalled') && isStalled(x)) ||
        (filters.flags.has('seats') && isShortOnSeats(x)) ||
        (filters.flags.has('dais') && hasEmptyDais(x)) ||
        (filters.flags.has('tbd') && x.dates_tbd));
    }
    if (filters.intent.size) r = r.filter(x => matchesIntent(filters.intent, getConferenceIntent(x.intent)));
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
        // Unverified above verified; then the FURTHEST ALONG unverified first,
        // because those are the ones a nudge actually converts. Verified rows
        // fall back to most recently verified.
        case 'verified': return Number(a.is_verified) - Number(b.is_verified)
                            || (a.is_verified
                                  ? ts(b.verified_at) - ts(a.verified_at)
                                  : (b.setup_done / Math.max(b.setup_total, 1)) - (a.setup_done / Math.max(a.setup_total, 1)))
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
    ...Array.from(filters.verified).map(v => ({ key: `verified:${v}`, label: VERIFIED_LABEL[v] ?? v, remove: () => toggle('verified', v) })),
    ...Array.from(filters.country).map(v => ({ key: `country:${v}`, label: v, remove: () => toggle('country', v) })),
    ...Array.from(filters.organizer).map(v => ({ key: `org:${v}`, label: v, remove: () => toggle('organizer', v) })),
    ...Array.from(filters.flags).map(v => ({ key: `flag:${v}`, label: FLAG_LABEL[v] ?? v, remove: () => toggle('flags', v) })),
    ...Array.from(filters.intent).map(v => ({
      key: `intent:${v}`,
      // "Wants payments" reads as a sentence; "Wants did not say" does not.
      label: v === INTENT_SKIPPED || v === INTENT_UNASKED
        ? INTENT_FILTER_LABEL[v]
        : `Wants ${(INTENT_FILTER_LABEL[v] ?? v).toLowerCase()}`,
      remove: () => toggle('intent', v),
    })),
  ];

  const statTiles = [
    { label: 'All conferences', value: stats.total,      emoji: 'Card index',        icon: Building2,   gradient: NEU_GRADIENTS.forest, active: activeCount === 0, onClick: clearAll },
    { label: 'Live',            value: stats.live,       emoji: 'Globe showing europe-africa', icon: Globe, gradient: NEU_GRADIENTS.green,  active: filters.state.size === 1 && filters.state.has('live'),  onClick: () => only('state', 'live') },
    { label: 'Drafts',          value: stats.drafts,     emoji: 'Memo',              icon: PencilLine,  gradient: NEU_GRADIENTS.amber,  active: filters.state.size === 1 && filters.state.has('draft'), onClick: () => only('state', 'draft') },
    { label: 'Verified',        value: stats.verified,   emoji: 'Check mark button', icon: Check,       gradient: NEU_GRADIENTS.sage,   active: filters.verified.size === 1 && filters.verified.has('yes'), onClick: () => only('verified', 'yes') },
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
            title="Checkmark" icon={Check}
            options={[{ label: 'Verified', value: 'yes' }, { label: 'Not verified', value: 'no' }]}
            selected={filters.verified}
            onToggle={v => toggle('verified', v)}
            onAll={() => setFilters(f => ({ ...f, verified: new Set(['yes', 'no']) }))}
            onNone={() => setFilters(f => ({ ...f, verified: new Set() }))}
          />
          <FilterGroup
            title="Needs attention" icon={CircleAlert}
            options={Object.entries(FLAG_LABEL).map(([value, label]) => ({ label, value }))}
            selected={filters.flags}
            onToggle={v => toggle('flags', v)}
            onAll={() => setFilters(f => ({ ...f, flags: new Set(Object.keys(FLAG_LABEL)) }))}
            onNone={() => setFilters(f => ({ ...f, flags: new Set() }))}
          />
          {/* Stated intent is a plain fact, so it does not appear as a stat tile
              and does not colour a row. It IS worth filtering on: "show me
              everyone who said payments" is the whole reason the field is
              collected. This is where that lives, rather than in the row, since
              one chip cannot cleanly carry up to six separate filter values. */}
          <FilterGroup
            title="What they want" icon={Target}
            options={[
              ...INTENT_OPTIONS.map(o => ({ label: INTENT_FILTER_LABEL[o.key], value: o.key })),
              { label: INTENT_FILTER_LABEL[INTENT_SKIPPED], value: INTENT_SKIPPED },
              { label: INTENT_FILTER_LABEL[INTENT_UNASKED], value: INTENT_UNASKED },
            ]}
            selected={filters.intent}
            onToggle={v => toggle('intent', v)}
            onAll={() => setFilters(f => ({ ...f, intent: new Set([...INTENT_OPTIONS.map(o => o.key), INTENT_SKIPPED, INTENT_UNASKED]) }))}
            onNone={() => setFilters(f => ({ ...f, intent: new Set() }))}
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
              onFilterIntent={v => only('intent', v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── One conference ──────────────────────────────────────────────────────────

function ConferenceRow({
  r, logo, avatar, filters, onFilterState, onFilterCountry, onFilterOrganizer, onFilterIntent,
}: {
  r: AdminConferenceRow;
  logo: string | null;
  avatar: string | null;
  filters: Filters;
  onFilterState: (v: string) => void;
  onFilterCountry: (v: string) => void;
  onFilterOrganizer: (v: string) => void;
  onFilterIntent: (v: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const intent = useMemo(() => getConferenceIntent(r.intent), [r.intent]);
  const intentShorts = intentLabels(intent);
  const intentExtra = Math.max(0, intentShorts.length - INTENT_CHIP_MAX);
  const intentSaidOn = answeredOn(intent.answeredAt);
  const idle = daysSince(r.updated_at);
  const stalled = isStalled(r);
  const short = isShortOnSeats(r);
  const emptyDais = hasEmptyDais(r);
  const pending = outstandingSteps(r.pending_keys);
  const done = Math.min(r.setup_done, r.setup_total);
  const countryCode = r.country ? getCountryByName(r.country)?.code : undefined;
  const organizerKey = r.organizer_name ?? r.organizer_email;
  const dates = r.dates_tbd ? null : formatRange(r.start_date, r.end_date);
  // The list spans every conference on the platform, several editions of the
  // same series among them, so the acronym carries its year.
  const acronym = conferenceAcronymLabel(r);
  const showFullNameBeneath = !!acronym && acronym.toLowerCase() !== r.full_name.trim().toLowerCase();
  // The checkmark, and what it would take to earn it. SETUP_STEPS is exactly
  // the seven verification criteria (see the note there: 'delegate' and
  // 'awards' were both removed from conference_setup_status), so `pending` IS
  // the outstanding-criteria list and the ring IS distance from the seal.
  const verifiedOn = answeredOn(r.verified_at);
  const sealTitle = r.is_verified
    ? `Verified${verifiedOn ? ` on ${verifiedOn}` : ''}`
    : pending.length === 0
      ? 'Every criterion is met. The mark lands on the next refresh.'
      : `Not verified yet. Outstanding: ${pending.map(s => s.label).join(', ')}`;

  return (
    // Peter #7, revised: the row is a REAL LINK, and a plain click opens the
    // dashboard IN A NEW TAB. Staff scan this list and dip into one conference
    // at a time; losing the filtered list on every click was the whole
    // complaint. Because it is an <a href target="_blank">, the browser owns
    // all of it: hover shows the target, middle-click and cmd/ctrl-click open a
    // tab, "copy link address" works, and Enter activates it. Nothing here
    // routes by hand any more.
    //
    // The nested filter controls (CornerBadge, FilterChip) each call
    // preventDefault() as well as stopPropagation(), which is what stops a
    // filter click from also navigating. The HoverPop panel is portaled to
    // <body>, so its rows are not inside this anchor at all and can never
    // navigate. Keep both properties if you touch those components.
    <a
      href={`/manage/${r.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${acronym || r.full_name} dashboard in a new tab`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="block focus:outline-none"
      style={{
        backgroundColor: NEU.surface,
        borderRadius: 20,
        padding: '13px 16px',
        cursor: 'pointer',
        textDecoration: 'none',
        color: NEU.ink,
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
            {/* The primary signal, read where the eye already is. Grey rather
                than absent: on staff screens the missing mark IS the news, and
                the title says what is standing in the way. */}
            <VerifiedCheck verified={r.is_verified} showUnverified size={15} title={sealTitle} />
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
            {/* What they said they came here to do. See the INTENT_ICON block
                for why only two of the three states render anything at all. */}
            {intentShorts.length > 0 && (
              <HoverPop
                width={286}
                // Header, one two-line row per stated option, then the optional
                // quote and date. Six options makes this ~330, well past the
                // default estimate, and a row near the bottom of a long list is
                // exactly where this panel gets read.
                estimatedHeight={64 + intent.keys.length * 40 + (intent.other ? 46 : 0) + (intentSaidOn ? 22 : 0)}
                label={`Said they want: ${intentShorts.join(', ')}${intent.other ? `. Also wrote: ${intent.other}` : ''}`}
                panel={
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Target} size={24} />
                      <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, color: NEU.ink }}>
                        What they want Gavelling for
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {/* Iterated over INTENT_OPTIONS, not over intent.keys, so the
                          panel is always in the canonical wizard order. Each row
                          is a filter: hover the chip, click a line, see every
                          conference that said the same thing. The portal means
                          this click never reaches the row underneath. Keyboard
                          users reach the identical values in the FILTERS
                          popover, which is fully focusable. */}
                      {INTENT_OPTIONS.filter(o => intent.keys.includes(o.key)).map(o => {
                        const Icon = INTENT_ICON[o.key] ?? Target;
                        const on = filters.intent.has(o.key);
                        return (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => onFilterIntent(o.key)}
                            title={`Filter to conferences that said ${INTENT_FILTER_LABEL[o.key].toLowerCase()}`}
                            className="inline-flex items-start gap-2 w-full text-left focus:outline-none"
                            style={{
                              padding: '5px 7px', margin: '0 -7px', borderRadius: 9,
                              border: 'none', cursor: 'pointer',
                              background: on ? 'rgba(27,56,40,0.07)' : 'transparent',
                              transition: `background 160ms ${EASE}`,
                            }}
                            onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'rgba(27,56,40,0.04)'; }}
                            onMouseLeave={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <Icon size={13} strokeWidth={2.4} style={{ color: NEU.deepGold, flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, lineHeight: 1.35 }}>
                              {o.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {intent.other && (
                      // Their own words, so quoted and set apart. inkSoft rather
                      // than muted: this is a real sentence someone has to read.
                      <p className="mt-2.5" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontStyle: 'italic', color: NEU.inkSoft, lineHeight: 1.45 }}>
                        &ldquo;{intent.other}&rdquo;
                      </p>
                    )}
                    {intentSaidOn && (
                      <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted }}>
                        Said at set-up on {intentSaidOn}
                      </p>
                    )}
                  </div>
                }
              >
                <QuietChip icon={Target}>
                  {intentShorts.slice(0, INTENT_CHIP_MAX).join(' · ')}
                  {intentExtra > 0 && <span style={{ color: NEU.inkSoft }}>{' '}+{intentExtra}</span>}
                </QuietChip>
              </HoverPop>
            )}
            {intentShorts.length === 0 && intent.skipped && (
              <FaintChip icon={Target} title="Asked at set-up, chose not to answer">
                NOT SAID
              </FaintChip>
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

        {/* ── Verification (#6) ──
            The row leads with the checkmark now, so this slot answers whichever
            question is still open.

            SETUP_STEPS is EXACTLY the seven verification criteria (see the note
            on that array: 'delegate' and 'awards' were both removed from
            conference_setup_status). So on a verified row the ring reads 7/7,
            always, on every verified row: a column of the same number with an
            empty outstanding list behind it. It earns nothing there, and it is
            dropped. On an unverified row the same ring is the most useful thing
            on the screen, because it is literally distance from the seal, and
            the hover names what is missing. Both are kept, one each. */}
        {r.is_verified ? (
          <HoverPop
            width={230}
            estimatedHeight={112}
            label={sealTitle}
            panel={
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <VerifiedCheck verified size={18} title={sealTitle} />
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, color: NEU.ink }}>Verified</p>
                </div>
                <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, lineHeight: 1.45 }}>
                  {verifiedOn
                    ? `The checkmark landed on ${verifiedOn}. Every stage was done by then.`
                    : 'The checkmark has landed. Every stage is done.'}
                </p>
              </div>
            }
          >
            {/* Same 58px footprint as the ring, so the column stays aligned
                however the list is filtered. */}
            <span className="flex flex-col items-center justify-center" style={{ width: 58, height: 58, gap: 3 }}>
              <VerifiedCheck verified size={28} title={sealTitle} />
              <span style={{ fontFamily: OUTFIT, fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', color: NEU.muted }}>
                VERIFIED
              </span>
            </span>
          </HoverPop>
        ) : (
          <HoverPop
            width={252}
            // A fully-empty conference lists every outstanding step, which is
            // taller than the 200 default, and a row near the bottom of the
            // list would otherwise open downward and run off the viewport.
            estimatedHeight={64 + pending.length * 21}
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
                {/* No separate "Not published yet" footnote: `Published` is now
                    one of the nine steps and appears in the list above whenever
                    it is outstanding, so a footnote would say it twice. */}
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
        )}

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
    </a>
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
