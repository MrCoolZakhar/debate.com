'use client';

/**
 * Shared pieces of the Settings control panel (controlPanel.tsx) and the
 * per-role application set-up (roleSetup.tsx), Oct 2026 redesign.
 *
 * Presentation helpers only. Nothing here reads or writes the database: the
 * settings page owns every write and hands its handlers down.
 */

import { useId, type CSSProperties, type ReactNode } from 'react';
import {
  Loader2, Crown, UserRound, GraduationCap, Eye, Gavel, ClipboardList, HardHat, Check, Minus, X, type LucideIcon,
} from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import type { FeePhase } from '@/lib/finance';
import { currentStageAmount, priceDate } from '@/lib/publicFees';
import { formatFee } from '@/lib/utils';

// ── Tokens ──────────────────────────────────────────────────────────────────

export const F = 'var(--font-brand), sans-serif';
export const INK = '#1C1410';
export const INK_SOFT = '#5C4F42';
export const FOREST = '#1B3828';
export const GOLD = '#EED98A';
export const AMBER = '#8A6614';
export const DANGER = '#8B2020';
export const HAIRLINE = 'rgba(27,56,40,0.08)';

// ── One type hierarchy for all of Settings (owner, 12 Oct 2026) ─────────────
//
// Written once and used everywhere on /manage/[slug]/settings: the page title
// (the h1, the only gold italic word), a section title (h2), a card title
// (h3), a field label, a value or body line, and a hint. Never write a
// one-off font size on a Settings screen: pick one of these six.

export const TYPE_PX = {
  page: 'clamp(34px, 3.2vw, 40px)',
  section: 'clamp(24px, 2vw, 26px)',
  card: '19px',
  label: '15px',
  body: '15px',
  hint: '13px',
} as const;

export const TYPE: Record<keyof typeof TYPE_PX, CSSProperties> = {
  page: { fontFamily: F, fontSize: TYPE_PX.page, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.05, color: INK },
  section: { fontFamily: F, fontSize: TYPE_PX.section, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: INK },
  card: { fontFamily: F, fontSize: TYPE_PX.card, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.25, color: INK },
  label: { fontFamily: F, fontSize: TYPE_PX.label, fontWeight: 600, lineHeight: 1.3, color: INK },
  body: { fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 400, lineHeight: 1.5, color: INK },
  hint: { fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 400, lineHeight: 1.45, color: INK_SOFT },
};

export const CARD: CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  border: '1px solid rgba(27,56,40,0.07)',
  boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 10px 28px rgba(27,56,40,0.09)',
};

/** The Airbnb button in forest (taste board two): rounded rectangle, sentence case. */
export const PRIMARY_BTN: CSSProperties = {
  background: 'linear-gradient(90deg, #1B3828 0%, #2A5A3C 100%)',
  color: '#FFFFFF',
  borderRadius: 10,
  padding: '10px 16px',
  fontFamily: F,
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
  boxShadow: '0 4px 12px rgba(27,56,40,0.22)',
  cursor: 'pointer',
  textDecoration: 'none',
};

/** Second action: an ink outline rectangle. */
export const SECOND_BTN: CSSProperties = {
  backgroundColor: '#FFFFFF',
  color: INK,
  borderRadius: 10,
  padding: '9px 15px',
  fontFamily: F,
  fontSize: 14,
  fontWeight: 600,
  border: '1.5px solid rgba(28,20,16,0.22)',
  cursor: 'pointer',
  textDecoration: 'none',
};

/** Every inline link is bold and underlined (CLAUDE.md §8). */
export const TEXT_LINK: CSSProperties = {
  color: FOREST,
  fontFamily: F,
  fontWeight: 700,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
};

export const INPUT: CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1.5px solid #DDD4C0',
  borderRadius: 10,
  padding: '10px 13px',
  fontSize: 16,
  color: INK,
  fontFamily: F,
  outline: 'none',
  width: '100%',
  minWidth: 0,
};

// ── The role config as these screens read it ────────────────────────────────

/** The settings page's RoleConfig fits this shape. */
export interface RoleSetupConfig {
  role: string;
  is_enabled: boolean;
  applications_open_at: string | null;
  applications_close_at: string | null;
  max_accepted: number | null;
  fee_amount: number;
  fee_currency: string;
  auto_accept: boolean;
  payment_timing: 'after_acceptance' | 'anytime';
  custom_questions: unknown[];
  submission_message: string | null;
  submission_link_label: string | null;
  submission_link_url: string | null;
  fee_phases: FeePhase[] | null;
  allow_resubmission: boolean;
  hide_dashboard_until_paid?: boolean;
  preference_mode: string;
  collect_mun_experience: boolean;
}

/** A role is free when neither its base fee nor any fee phase charges anything.
 *  Payment settings are hidden for a free role (they cannot apply). */
export function roleIsFree(config: Pick<RoleSetupConfig, 'fee_amount' | 'fee_phases'>): boolean {
  if ((Number(config.fee_amount) || 0) > 0) return false;
  return !(config.fee_phases ?? []).some(p => (Number(p.amount) || 0) > 0);
}

/** Nobody charges their own volunteers or their own secretariat. */
export function roleHasPrice(role: string): boolean {
  return role !== 'secretariat' && role !== 'staff';
}

/** Roles whose preference_mode can be anything other than 'none'. Mirrors the
 *  database's second CHECK constraint on application_role_configs. */
export function roleCanHavePreference(role: string): boolean {
  return role === 'delegate' || role === 'head-delegate' || role === 'chair';
}

// What a role may express as preferences on the apply form. Persisted per role
// on application_role_configs.preference_mode; read by the apply flow.
export const PREF_MODE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'committees_and_countries', label: 'Committees and countries', desc: 'They rank committee and country pairs, the fullest picture for allocation.' },
  { value: 'committees_only', label: 'Committees', desc: 'They rank committees only, and you assign the countries.' },
  { value: 'countries_only', label: 'Countries', desc: 'They rank countries only, and committees follow from the country.' },
  { value: 'none', label: 'Nothing', desc: 'No ranking step. You place everyone yourself.' },
];

const ROLE_WORDS: Record<string, [string, string]> = {
  'head-delegate': ['Head delegate', 'Head delegates'],
  delegate: ['Delegate', 'Delegates'],
  'faculty-advisor': ['Faculty advisor', 'Faculty advisors'],
  observer: ['Observer', 'Observers'],
  chair: ['Chair', 'Chairs'],
  secretariat: ['Secretariat member', 'Secretariat'],
  staff: ['Staff member', 'Staff'],
};

/** "Head delegates" (sentence case, for rows and sentences). */
export function rolePlural(role: string): string {
  return ROLE_WORDS[role]?.[1] ?? role.replace(/-/g, ' ');
}

/** "Head delegate". */
export function roleSingular(role: string): string {
  return ROLE_WORDS[role]?.[0] ?? role.replace(/-/g, ' ');
}

/** "Head Delegate" (Title Case, for titles). */
export function roleTitle(role: string): string {
  return roleSingular(role).replace(/\b\w/g, c => c.toUpperCase());
}

// ── Window state ─────────────────────────────────────────────────────────────

export type WindowState = 'open' | 'scheduled' | 'closed' | 'off';

/** Four states, not two: a role can be switched on while its window has
 *  already closed, and "enabled" alone would report that as open. */
export function windowState(cfg: Pick<RoleSetupConfig, 'is_enabled' | 'applications_open_at' | 'applications_close_at'> | undefined, now: number): WindowState {
  if (!cfg?.is_enabled) return 'off';
  const opens = cfg.applications_open_at ? new Date(cfg.applications_open_at).getTime() : null;
  const closes = cfg.applications_close_at ? new Date(cfg.applications_close_at).getTime() : null;
  if (opens !== null && opens > now) return 'scheduled';
  if (closes !== null && closes < now) return 'closed';
  return 'open';
}

// ── Dates and prices ─────────────────────────────────────────────────────────

/** "20 Feb", or "20 Feb 2027" when it is not this year (or when asked). */
export function shortDate(iso: string | null | undefined, now: number = Date.now(), forceYear = false): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  const year = forceYear || d.getFullYear() !== new Date(now).getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
}

/** "20 Feb, 09:00" (the time only when it is not the start or end of a day). */
export function dateAndTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = shortDate(iso, now);
  return hm === '00:00' || hm === '23:59' ? day : `${day}, ${hm}`;
}

/** "1 Feb" to "14 Feb" for a YYYY-MM-DD pair. */
export function dayRange(start: string, end: string, now: number = Date.now()): string {
  if (!start || !end) return '';
  return start === end ? shortDate(start, now) : `${shortDate(start, now)} to ${shortDate(end, now)}`;
}

/** The price an applicant would be quoted for this role: today's fee stage,
 *  or the opening day's when it opens later (src/lib/publicFees.ts). For a
 *  role that is switched on this is exactly displayRolePrice; for one that is
 *  off it is the price it WILL show, not "TBD". */
export function rolePriceText(cfg: RoleSetupConfig, fallbackCurrency: string, now: number): string {
  if (!roleHasPrice(cfg.role)) return 'Free';
  const { amount } = currentStageAmount(cfg, priceDate(cfg, new Date(now)));
  return amount > 0 ? formatFee(amount, cfg.fee_currency || fallbackCurrency || 'USD') : 'Free';
}

export function moneyText(amount: number | string | null | undefined, currency: string): string {
  const n = Number(amount) || 0;
  return n > 0 ? formatFee(n, currency || 'USD') : 'Free';
}

// ── Datetime-local conversions (moved from the settings page, unchanged) ─────

/** UTC instant from the database to the local wall-clock value a
 *  datetime-local input expects. */
export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The inverse. A datetime-local value carries no zone, so `new Date` reads
 *  it as local wall-clock time, which is what the organiser meant, and we
 *  store the resulting instant as UTC. */
export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** IANA zone name for the note under the window fields, e.g. Europe/London. */
export function localZoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time';
  } catch {
    return 'your local time';
  }
}

// ── Switch ───────────────────────────────────────────────────────────────────

/**
 * A real switch (role="switch"). `disabled` never hides the reason: callers
 * put the sentence that explains it beside the switch and pass its id as
 * `describedBy`.
 *
 * The look (owner, 11 Oct 2026: "make the sliders more fun"): a chunky track,
 * a raised 3D thumb with a soft highlight that springs across (a slight
 * overshoot), a squash while pressed, a check / cross / dash inside the thumb,
 * and a tiny gold glint on the forest track when on. Styled by SWITCH_CSS
 * (part of ROW_CSS, mounted once by settingsShell.tsx); all motion is off
 * under prefers-reduced-motion.
 */
export function Switch({ id, checked, onChange, label, disabled = false, busy = false, size = 'md', describedBy, mixed = false }: {
  id?: string;
  checked: boolean;
  /** Different per role: the thumb sits in the middle on a gold track, and a
   *  press turns it ON for every role. */
  mixed?: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  size?: 'md' | 'lg';
  describedBy?: string;
}) {
  const w = size === 'lg' ? 58 : 52;
  const h = size === 'lg' ? 34 : 30;
  const pad = 3;
  const t = h - pad * 2;
  const x = mixed ? (w - t) / 2 - pad : checked ? w - t - pad * 2 : 0;
  const off = disabled || busy;
  const state = mixed ? 'mixed' : checked ? 'on' : 'off';
  const g = Math.round(t * 0.5);
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={mixed ? 'mixed' : checked}
      aria-label={label}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      disabled={off}
      onClick={() => { if (!off) onChange(mixed ? true : !checked); }}
      className="gvk-sw"
      data-state={state}
      style={{
        width: w, height: h,
        opacity: disabled ? 0.5 : 1,
        cursor: off ? 'not-allowed' : 'pointer',
        ['--sw-x' as string]: `${x}px`,
        ['--sw-t' as string]: `${t}px`,
      } as CSSProperties}
    >
      <span className="gvk-sw-glint" aria-hidden />
      <span className="gvk-sw-thumb" aria-hidden>
        {busy
          ? <Loader2 size={g} strokeWidth={2.6} className="animate-spin" style={{ color: FOREST }} />
          : state === 'on'
            ? <Check size={g} strokeWidth={3.2} className="gvk-sw-glyph" style={{ color: FOREST }} />
            : state === 'mixed'
              ? <Minus size={g} strokeWidth={3.2} className="gvk-sw-glyph" style={{ color: AMBER }} />
              : <X size={g - 1} strokeWidth={3} className="gvk-sw-glyph" style={{ color: '#A89B85' }} />}
      </span>
    </button>
  );
}

/** The switch's look; joined into ROW_CSS so the shell mounts it once. */
export const SWITCH_CSS = `
.gvk-sw { position: relative; flex-shrink: 0; padding: 0; border: none; border-radius: 999px; outline: none;
  background: linear-gradient(180deg, #C6BBA4 0%, #D9D0BD 100%);
  box-shadow: inset 0 2px 4px rgba(28,20,16,0.20), inset 0 -1px 0 rgba(255,255,255,0.55), 0 1px 0 rgba(255,255,255,0.7);
  transition: background 240ms ease, box-shadow 240ms ease, opacity 180ms ease; -webkit-tap-highlight-color: transparent; }
.gvk-sw[data-state="on"] { background: linear-gradient(180deg, #16301F 0%, #2A5A3C 100%);
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.32), inset 0 -1px 0 rgba(238,217,138,0.25), 0 3px 10px -4px rgba(27,56,40,0.55); }
.gvk-sw[data-state="mixed"] { background: linear-gradient(180deg, #B98A2A 0%, #E2C46F 100%);
  box-shadow: inset 0 2px 4px rgba(90,60,10,0.30), 0 1px 0 rgba(255,255,255,0.7); }
.gvk-sw:focus-visible { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #1B3828; }
.gvk-sw-glint { position: absolute; top: 50%; left: 12px; width: 5px; height: 5px; margin-top: -2.5px; border-radius: 999px;
  background: radial-gradient(circle at 40% 35%, #FFF8DC 0%, #EED98A 60%, #D9B65A 100%);
  box-shadow: 0 0 5px 1px rgba(238,217,138,0.7); opacity: 0; transform: scale(0.2);
  transition: opacity 200ms ease, transform 340ms cubic-bezier(0.34,1.56,0.64,1); }
.gvk-sw[data-state="on"] .gvk-sw-glint { opacity: 1; transform: scale(1); transition-delay: 90ms; }
.gvk-sw-thumb { position: absolute; top: 3px; left: 3px; width: var(--sw-t); height: var(--sw-t); border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 34% 26%, #FFFFFF 0%, #FFFFFF 36%, #F3EEE2 78%, #E7E0CF 100%);
  box-shadow: 0 1px 2px rgba(27,56,40,0.30), 0 5px 10px -3px rgba(27,56,40,0.35), inset 0 1px 0 #FFFFFF, inset 0 -2px 3px rgba(27,56,40,0.10);
  transform: translateX(var(--sw-x)) scale(1, 1);
  transition: transform 260ms cubic-bezier(0.34,1.56,0.64,1); will-change: transform; }
.gvk-sw-glyph { transition: opacity 160ms ease, transform 260ms cubic-bezier(0.34,1.56,0.64,1); animation: gvk-sw-pop 260ms cubic-bezier(0.34,1.56,0.64,1); }
@keyframes gvk-sw-pop { from { opacity: 0; transform: scale(0.4) rotate(-30deg); } to { opacity: 1; transform: scale(1) rotate(0deg); } }
.gvk-sw:not(:disabled):hover .gvk-sw-thumb { box-shadow: 0 1px 2px rgba(27,56,40,0.30), 0 7px 14px -4px rgba(27,56,40,0.40), inset 0 1px 0 #FFFFFF, inset 0 -2px 3px rgba(27,56,40,0.10); }
.gvk-sw:not(:disabled):active .gvk-sw-thumb { transform: translateX(var(--sw-x)) scale(1.16, 0.84); transition-duration: 110ms; }
@media (prefers-reduced-motion: reduce) {
  .gvk-sw, .gvk-sw-thumb, .gvk-sw-glint, .gvk-sw-glyph { transition: none; animation: none; }
  .gvk-sw:not(:disabled):active .gvk-sw-thumb { transform: translateX(var(--sw-x)); }
  .gvk-sw[data-state="on"] .gvk-sw-glint { transform: scale(1); }
}
`;

/** A setting with a label, an optional one-line explanation and a switch. */
export function ToggleRow({ title, desc, checked, onChange, hint }: {
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** An InfoHint (or any small node) beside the title. */
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5" style={TYPE.label}>
          <span style={{ overflowWrap: 'anywhere' }}>{title}</span>
          {hint}
        </p>
        {desc && (
          <p style={{ ...TYPE.hint, marginTop: 2, overflowWrap: 'anywhere' }}>{desc}</p>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

/** A field label in the house style. */
export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 mb-1.5" style={TYPE.label}>
      {children}
    </label>
  );
}

/** A short notice in the page (facts that stay true, not outcomes). */
export function Notice({ tone = 'gold', children, role }: { tone?: 'gold' | 'danger' | 'forest'; children: ReactNode; role?: 'alert' | 'status' }) {
  const s = tone === 'danger'
    ? { color: DANGER, bg: 'rgba(139,32,32,0.06)', border: 'rgba(139,32,32,0.22)' }
    : tone === 'forest'
      ? { color: FOREST, bg: 'rgba(27,56,40,0.05)', border: 'rgba(27,56,40,0.16)' }
      : { color: '#6B4F12', bg: 'rgba(238,217,138,0.24)', border: 'rgba(182,135,31,0.32)' };
  return (
    <div
      role={role}
      className="rounded-xl px-4 py-3"
      style={{ ...TYPE.body, color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}`, overflowWrap: 'anywhere' }}
    >
      {children}
    </div>
  );
}

// ── Which roles the front page lists ─────────────────────────────────────────

/** Always listed under Who Can Apply, set up or not (owner, Oct 2026: "by
 *  default only have delegates and head delegates"). */
export const ALWAYS_LISTED_ROLES: readonly string[] = ['head-delegate', 'delegate'];

/**
 * Has the organiser set this role up?
 *
 * Every conference has a row for all seven roles from the moment it exists
 * (the database trigger `handle_new_conference` inserts them, all switched off,
 * fee 0, everything else at its column default; the creation wizard and
 * Settings' ensureRoleConfigs only ever fill in a missing set). So "a row
 * exists" means nothing, and set up is read from the row itself:
 *
 *   - it is switched on, or
 *   - anyone has applied for it (submitted or further), or
 *   - any field differs from the default a fresh row carries: a window, a
 *     limit, a price or prices by date, auto-accept, payment timing,
 *     preferences, MUN experience, questions, or an after-applying message.
 *     (Resubmission and the dashboard lock are no longer settings, so they
 *     no longer count.)
 *
 * The currency is deliberately ignored: a fresh row already carries the
 * conference's currency. This decides only what the UI LISTS. A role that is
 * on or has applicants is never hidden, and nothing here writes.
 */
export function roleIsSetUp(cfg: RoleSetupConfig, appliedCount: number | undefined): boolean {
  if (cfg.is_enabled) return true;
  if ((appliedCount ?? 0) > 0) return true;
  if (cfg.applications_open_at || cfg.applications_close_at) return true;
  if (cfg.max_accepted != null) return true;
  if ((Number(cfg.fee_amount) || 0) > 0) return true;
  if ((cfg.fee_phases ?? []).length > 0) return true;
  if (cfg.auto_accept) return true;
  if (cfg.payment_timing && cfg.payment_timing !== 'anytime') return true;
  if (cfg.preference_mode && cfg.preference_mode !== 'none') return true;
  if (cfg.collect_mun_experience) return true;
  // Archived questions (kept only so old answers keep their question) are not
  // a set-up form: "Remove this role" archives a role's questions.
  if (Array.isArray(cfg.custom_questions) && cfg.custom_questions.some(b => !(b && typeof b === 'object' && (b as { archived?: boolean }).archived))) return true;
  if ((cfg.submission_message ?? '').trim()) return true;
  return false;
}

// ── Rows and groups (Oct 2026, bookmarks redesign; 12 Oct 2026 pass) ─────────
//
// Every settings section is built from the organiser kit the owner approved
// (the Conference Store's and Financials' cards: STORE_CSS / DASH_CSS, mounted
// once by settingsShell.tsx). A Group is a white gv-st-card with a big 3D
// emoji disc HANGING off its left edge (owner, 12 Oct 2026: "the 3d icons
// should be bigger and hanging out on the side without moving anything"): the
// disc is absolutely placed, about 40% of it outside the card, centred on the
// title, so it never pushes text or layout; the title only keeps a small
// start padding so the inside half never covers a letter. On phones, where
// there is little room outside the card, the disc is smaller and overhangs
// only a few pixels. Nothing above it clips (.gv-st-card has no overflow and
// the manage content area does not hide sideways overflow).
//
// Inside a Group, compact rows that read as cards (ivory, separated by gaps,
// never hairlines), label on the left and the control on the right. A row
// that is ON carries a forest tint and edge; off has no tint. Below 600px of
// card width a row stacks, label over control. A switch row is different:
// the switch sits right beside its label (switch, then label), never at the
// far edge, and consecutive switch rows go in a SwitchGrid, two columns from
// 700px of card width (owner, 12 Oct 2026: "the toggle is far away from the
// actual text, meaning you could have two columns"). Changes save in place.

export const ROW_CSS = `
.gvk-group { container-type: inline-size; --gvk-pad: clamp(14px, 2.4vw, 20px); padding: var(--gvk-pad) !important; }
.gvk-head { --gvk-pad: 22px; }
.gvk-head[data-compact="true"] { --gvk-pad: 20px; padding: 14px 20px !important; }
.gvk-hcard { --gvk-hang: 46px; --gvk-hang-out: 8px; --gvk-gap: 10px; }
@media (min-width: 640px) { .gvk-hcard { --gvk-hang: 54px; --gvk-hang-out: 18px; } }
@media (min-width: 768px) {
  .gvk-hcard { --gvk-hang: 60px; --gvk-hang-out: 24px; --gvk-gap: 12px; }
  .gvk-hcard.gvk-head { --gvk-hang: 64px; --gvk-hang-out: 26px; }
}
.gvk-hang-host { position: relative; min-width: 0; padding-inline-start: max(0px, calc(var(--gvk-hang) - var(--gvk-hang-out) - var(--gvk-pad) + var(--gvk-gap))); }
.gvk-hang { position: absolute; top: 50%; inset-inline-start: calc(-1 * (var(--gvk-pad) + var(--gvk-hang-out))); transform: translateY(-50%);
  width: var(--gvk-hang); height: var(--gvk-hang); border-radius: calc(var(--gvk-hang) * 0.32); z-index: 2; pointer-events: none;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 3px #FFFFFF, inset 0 1px 0 rgba(255,255,255,0.8), 0 12px 22px -12px rgba(27,56,40,0.55), 0 3px 8px -4px rgba(27,56,40,0.18); }
.gvk-hang > img, .gvk-hang > svg { width: 62% !important; height: 62% !important; }
.gvk-rows { display: flex; flex-direction: column; gap: 8px; }
.gvk-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 12px 14px; border-radius: 14px; background: #FAF8F3; align-items: center; transition: background-color 160ms ease, box-shadow 160ms ease; }
.gvk-row[data-on="true"] { background: linear-gradient(150deg, rgba(61,122,82,0.13), rgba(61,122,82,0.05)); box-shadow: inset 3px 0 0 #2A5A3C; }
.gvk-row[data-need="true"] { background: rgba(238,217,138,0.22); box-shadow: inset 3px 0 0 #B6871F; }
.gvk-row-ctl { min-width: 0; }
.gvk-row[data-align="end"] { grid-template-columns: minmax(0, 1fr) auto; }
@container (min-width: 600px) {
  .gvk-row { grid-template-columns: minmax(170px, 0.85fr) minmax(0, 1.5fr); column-gap: 20px; }
  .gvk-row[data-align="end"] { grid-template-columns: minmax(0, 1fr) auto; }
}
.gvk-row.gvk-swrow { grid-template-columns: auto minmax(0, 1fr); column-gap: 14px; align-items: start; }
.gvk-swrow > .gvk-sw { margin-top: 1px; }
.gvk-swrow-label { cursor: pointer; }
.gvk-swgrid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
@container (min-width: 700px) { .gvk-swgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
${SWITCH_CSS}`;

/** A Fluent 3D emoji in a soft tinted disc (the Store and Financials look,
 *  `IconDisc` in financials/dashboardKit.tsx). `icon` is the Lucide glyph drawn
 *  in forest if the emoji image cannot load. `tint` is TINT_GOLD_BG or
 *  TINT_GREEN_BG; `active` seats it on white (the selected rail item). Duotone
 *  Lucide icons were tried here and rejected as ugly (owner, 11 Oct 2026). */
export function EmojiDisc({ emoji, icon, size = 40, tint = TINT_GOLD_BG, active = false, toned = false }: {
  emoji: string; icon: LucideIcon; size?: number; tint?: string; active?: boolean; toned?: boolean;
}) {
  return (
    <span
      aria-hidden
      className="gv-fd-disc"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), background: active ? 'linear-gradient(150deg, rgba(255,255,255,0.97), rgba(255,255,255,0.82))' : tint }}
    >
      <Emoji3D name={emoji} toned={toned} size={Math.round(size * 0.62)} fallback={icon} fallbackColor={FOREST} />
    </span>
  );
}

/** The big disc that hangs off a card's left edge (see .gvk-hang in ROW_CSS).
 *  Put it inside a `.gvk-hang-host` in a `.gvk-hcard` card; it is centred on
 *  the host and sized by the card's CSS variables. */
export function HangDisc({ emoji, icon, tint = TINT_GOLD_BG }: { emoji: string; icon: LucideIcon; tint?: string }) {
  return (
    <span className="gvk-hang" aria-hidden style={{ background: `${tint}, #FFFFFF` }}>
      <Emoji3D name={emoji} size={40} fallback={icon} fallbackColor={FOREST} />
    </span>
  );
}

/** The Fluent 3D emoji for each role, and the Lucide glyph it falls back to. */
export const ROLE_EMOJI: Record<string, string> = {
  'head-delegate': 'Crown',
  delegate: 'Bust in silhouette',
  'faculty-advisor': 'Graduation cap',
  observer: 'Eyes',
  chair: 'Hammer',
  secretariat: 'Clipboard',
  staff: 'Name badge',
};
export const ROLE_ICON: Record<string, LucideIcon> = {
  'head-delegate': Crown,
  delegate: UserRound,
  'faculty-advisor': GraduationCap,
  observer: Eye,
  chair: Gavel,
  secretariat: ClipboardList,
  staff: HardHat,
};

/** A role's emoji disc, by role key. */
export function RoleDisc({ role, size = 38, tint = TINT_GREEN_BG, active = false }: {
  role: string; size?: number; tint?: string; active?: boolean;
}) {
  return <EmojiDisc emoji={ROLE_EMOJI[role] ?? 'Busts in silhouette'} icon={ROLE_ICON[role] ?? UserRound} size={size} tint={tint} active={active} />;
}

/** The top of a settings section: a big 3D emoji disc hanging off the card's
 *  left edge, the title (TYPE.section) and one plain line. Plain sans: the
 *  gold italic word is for the page's main heading only (owner, 11 Oct 2026).
 *  `focal` is the section's one big thing (a number with its word, or a
 *  picture), drawn on the right. */
export function SectionHead({ emoji, icon, tint, title, line, focal, compact = false }: {
  emoji: string; icon: LucideIcon; tint: string; title: string; line?: ReactNode; focal?: ReactNode;
  /** A slimmer header with no bottom margin, for a section that sits in a
   *  gapped column and wants its first card in the first screen (General). */
  compact?: boolean;
}) {
  return (
    <header
      className={`gv-st-card gv-fd-card gvk-head gvk-hcard${compact ? '' : ' mb-5'}`}
      data-compact={compact ? 'true' : undefined}
      style={{ background: tint === TINT_GOLD_BG ? WASH_GOLD : WASH_GREEN }}
    >
      <div className="flex items-center justify-between gap-x-5 gap-y-3 flex-wrap">
        <div className="gvk-hang-host">
          <HangDisc emoji={emoji} icon={icon} tint={tint} />
          <h2 style={{ ...TYPE.section, margin: 0, overflowWrap: 'anywhere' }}>{title}</h2>
          {line && (
            <p className="mt-1" style={{ ...TYPE.body, color: '#3A2E24', overflowWrap: 'anywhere' }}>{line}</p>
          )}
        </div>
        {focal && <div className="min-w-0">{focal}</div>}
      </div>
    </header>
  );
}

/** A big tabular number with its word beside it (the screen's focal point). */
export function BigCount({ n, word, tone = 'forest' }: { n: number | string; word: string; tone?: 'forest' | 'gold' }) {
  return (
    <span className="inline-flex items-baseline gap-2" style={{ fontFamily: F }}>
      <span style={{ fontSize: 'clamp(38px, 4.4vw, 54px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.95, fontVariantNumeric: 'tabular-nums', color: tone === 'gold' ? '#8A6614' : FOREST }}>{n}</span>
      <span style={{ ...TYPE.label, fontWeight: 800 }}>{word}</span>
    </span>
  );
}

export const TINT_GREEN_BG = 'linear-gradient(150deg, rgba(61,122,82,0.20), rgba(61,122,82,0.08))';
export const TINT_GOLD_BG = 'linear-gradient(150deg, rgba(238,217,138,0.70), rgba(238,217,138,0.30))';
const WASH_GREEN = 'radial-gradient(120% 90% at 100% 0%, rgba(61,122,82,0.09) 0%, rgba(61,122,82,0) 55%), #FFFFFF';
const WASH_GOLD = 'radial-gradient(120% 90% at 100% 0%, rgba(238,217,138,0.28) 0%, rgba(238,217,138,0) 55%), #FFFFFF';

/** A white card with a big 3D emoji disc hanging off its left edge, a plain
 *  Title Case heading (TYPE.card) and its rows. */
export function Group({ id, title, emoji, icon, tint = TINT_GREEN_BG, hint, aside, children, pulse = false }: {
  id?: string;
  title: string;
  /** Fluent 3D emoji name; `icon` is its Lucide fallback. */
  emoji: string;
  icon: LucideIcon;
  tint?: string;
  /** An InfoHint (or any small node) beside the heading. */
  hint?: ReactNode;
  /** A link or small button at the end of the heading line. */
  aside?: ReactNode;
  children: ReactNode;
  /** A brief gold ring, for deep links that land on this group. */
  pulse?: boolean;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className="gv-st-card gv-fd-card gvk-group gvk-hcard min-w-0"
      style={{
        scrollMarginTop: 140,
        background: tint === TINT_GOLD_BG ? WASH_GOLD : WASH_GREEN,
        boxShadow: pulse
          ? '0 0 0 2px #EED98A, 0 0 0 3px rgba(182,135,31,0.35), 0 18px 40px -26px rgba(182,135,31,0.65)'
          : undefined,
        transition: 'box-shadow 400ms ease',
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="gvk-hang-host" style={{ minHeight: 34, display: 'flex', alignItems: 'center' }}>
          <HangDisc emoji={emoji} icon={icon} tint={tint} />
          <h3 className="flex items-center gap-1.5 min-w-0" style={{ ...TYPE.card, margin: 0 }}>
            <span style={{ overflowWrap: 'anywhere' }}>{title}</span>
            {hint}
          </h3>
        </div>
        {aside}
      </div>
      <div className="gvk-rows">{children}</div>
    </section>
  );
}

/** One setting: label (and a short line) on the left, the control on the
 *  right. `align="end"` keeps a small control (a button) on the same line as
 *  its label at every width. `on` tints the row forest, `need` gives it a
 *  gold edge (something to do). Switches use SwitchRow instead. */
export function Row({ label, desc, hint, htmlFor, align = 'stretch', id, on, need, children }: {
  label: ReactNode;
  desc?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  align?: 'stretch' | 'end';
  id?: string;
  on?: boolean;
  need?: boolean;
  children?: ReactNode;
}) {
  const Label = htmlFor ? 'label' : 'p';
  return (
    <div id={id} className="gvk-row" data-align={align === 'end' ? 'end' : undefined} data-on={on ? 'true' : undefined} data-need={need ? 'true' : undefined} style={{ scrollMarginTop: 140, ...(children === undefined ? { gridTemplateColumns: 'minmax(0, 1fr)' } : null) }}>
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="flex items-center gap-1.5" style={TYPE.label}>
          <span style={{ overflowWrap: 'anywhere' }}>{label}</span>
          {hint}
        </Label>
        {desc && (
          <p style={{ ...TYPE.hint, marginTop: 2, overflowWrap: 'anywhere' }}>{desc}</p>
        )}
      </div>
      {children !== undefined && <div className="gvk-row-ctl" style={align === 'end' ? { justifySelf: 'end' } : undefined}>{children}</div>}
    </div>
  );
}

/** A switch row: the switch right beside its label (switch first), tinted
 *  forest while on, a gold edge for `need` or "different per role". Pressing
 *  the label presses the switch. Put several in a SwitchGrid. */
export function SwitchRow({ label, desc, hint, checked, onChange, disabled, mixed, busy, need, id }: {
  label: string; desc?: ReactNode; hint?: ReactNode; checked: boolean; onChange: (next: boolean) => void;
  disabled?: boolean; mixed?: boolean; busy?: boolean;
  /** Something to do (a gold edge), e.g. a switch that cannot be turned on yet. */
  need?: boolean;
  id?: string;
}) {
  const auto = useId();
  const switchId = `${auto}-sw`;
  return (
    <div id={id} className="gvk-row gvk-swrow" data-on={checked && !mixed && !need ? 'true' : undefined} data-need={mixed || need ? 'true' : undefined} style={{ scrollMarginTop: 140 }}>
      <Switch id={switchId} label={label} checked={checked} mixed={mixed} onChange={onChange} disabled={disabled} busy={busy} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5" style={TYPE.label}>
          <label htmlFor={switchId} className="gvk-swrow-label" style={{ overflowWrap: 'anywhere' }}>{label}</label>
          {hint}
        </p>
        {desc && (
          <div style={{ ...TYPE.hint, marginTop: 2, overflowWrap: 'anywhere' }}>{desc}</div>
        )}
      </div>
    </div>
  );
}

/** Consecutive switch rows, in two columns from 700px of card width. */
export function SwitchGrid({ children }: { children: ReactNode }) {
  return <div className="gvk-swgrid">{children}</div>;
}

// ── Rules for every role ─────────────────────────────────────────────────────
//
// Paying, who gets in and what applicants rank are decided once, for every
// role on the Applications page. In the database they stay per role (one
// column per application_role_configs row), so "for every role" means the
// same value written to every listed role the setting applies to:
//
//   payment_timing      every listed role that has a price (never
//                       secretariat, staff)
//   auto_accept         every listed role but the secretariat (accepting one
//                       makes them an organiser, so that stays a per-role
//                       decision)
//   preference_mode     delegates and head delegates (chairs keep their own
//                       switch, the database allows them less)
//
// allow_resubmission and hide_dashboard_until_paid are no longer settings in
// the UI (owner, 12 Oct 2026); their columns keep the database's defaults.

export type GeneralField = 'payment_timing' | 'auto_accept' | 'preference_mode';
export const GENERAL_FIELDS: readonly GeneralField[] = ['auto_accept', 'payment_timing', 'preference_mode'];

/** Does the rule for every role cover this field on this role? */
export function inGeneralScope(field: GeneralField, role: string): boolean {
  if (field === 'payment_timing') return roleHasPrice(role);
  if (field === 'auto_accept') return role !== 'secretariat';
  return role === 'delegate' || role === 'head-delegate';
}

/** A field's value as the screens compare it (missing reads as the default). */
export function generalValue(cfg: RoleSetupConfig, field: GeneralField): string | boolean {
  switch (field) {
    case 'payment_timing': return cfg.payment_timing === 'after_acceptance' ? 'after_acceptance' : 'anytime';
    case 'auto_accept': return cfg.auto_accept === true;
    case 'preference_mode': return cfg.preference_mode || 'none';
  }
}

/** The one answer every covered role shares, or 'mixed', or null when no
 *  listed role is covered. */
export function generalAnswer(roles: RoleSetupConfig[], field: GeneralField): { value: string | boolean | null; mixed: boolean; roles: RoleSetupConfig[] } {
  const covered = roles.filter(r => inGeneralScope(field, r.role));
  if (covered.length === 0) return { value: null, mixed: false, roles: covered };
  const first = generalValue(covered[0], field);
  const mixed = covered.some(r => generalValue(r, field) !== first);
  return { value: mixed ? null : first, mixed, roles: covered };
}

/** The roles Settings lists: Head delegates and Delegates always, any other
 *  role once it is set up or added on this browser. A role removed with
 *  "Remove this role" (`removedRoles`, kept per browser) is not listed while
 *  it stays switched off, even when people applied for it or it is one of the
 *  two default roles; adding it again (or opening it) lists it again. */
export function listedRoles(
  ordered: RoleSetupConfig[],
  counts: Record<string, number> | null,
  extraRoles: readonly string[],
  removedRoles: readonly string[] = [],
): RoleSetupConfig[] {
  return ordered.filter(r => {
    if (extraRoles.includes(r.role)) return true;
    if (removedRoles.includes(r.role) && !r.is_enabled) return false;
    return ALWAYS_LISTED_ROLES.includes(r.role) || roleIsSetUp(r, counts?.[r.role]);
  });
}
