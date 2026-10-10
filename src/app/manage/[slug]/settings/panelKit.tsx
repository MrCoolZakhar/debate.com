'use client';

/**
 * Shared pieces of the Settings control panel (controlPanel.tsx) and the
 * per-role application set-up (roleSetup.tsx), Oct 2026 redesign.
 *
 * Presentation helpers only. Nothing here reads or writes the database: the
 * settings page owns every write and hands its handlers down.
 */

import type { CSSProperties, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
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
  fontSize: 15,
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
 */
export function Switch({ checked, onChange, label, disabled = false, busy = false, size = 'md', describedBy }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  size?: 'md' | 'lg';
  describedBy?: string;
}) {
  const w = size === 'lg' ? 52 : 46;
  const h = size === 'lg' ? 30 : 26;
  const t = h - 6;
  const off = disabled || busy;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      disabled={off}
      onClick={() => { if (!off) onChange(!checked); }}
      className="relative flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        width: w, height: h, borderRadius: 999, border: 'none',
        backgroundColor: checked ? FOREST : '#CFC6B2',
        opacity: disabled ? 0.5 : 1,
        cursor: off ? 'not-allowed' : 'pointer',
        transition: 'background-color 180ms ease, opacity 180ms ease',
      }}
    >
      <span
        className="absolute flex items-center justify-center"
        style={{
          top: 3, left: checked ? w - t - 3 : 3, width: t, height: t, borderRadius: '50%',
          backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.22)',
          transition: 'left 180ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {busy && <Loader2 size={t - 8} strokeWidth={2.6} className="animate-spin" style={{ color: FOREST }} aria-hidden />}
      </span>
    </button>
  );
}

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
        <p className="flex items-center gap-1.5" style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
          <span style={{ overflowWrap: 'anywhere' }}>{title}</span>
          {hint}
        </p>
        {desc && (
          <p style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.45, marginTop: 2, overflowWrap: 'anywhere' }}>{desc}</p>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

/** A field label in the house style. */
export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 mb-1.5" style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: INK }}>
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
      style={{ fontFamily: F, fontSize: 14, lineHeight: 1.5, color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}`, overflowWrap: 'anywhere' }}
    >
      {children}
    </div>
  );
}
