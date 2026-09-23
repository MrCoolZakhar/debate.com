'use client';

// Shared look for the applicant pop-up. Flat, bordered, coloured, in the
// language of the admin conference pop-up (admin/ConferenceDetailDialog.tsx):
// typographic fact rows with an icon, a label and a value, never one raised
// neumorphic tile per fact (rulebook §7, Disliked).

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { FlagImg } from '@/components/FlagImg';
import { UN_COUNTRIES, getCountryByName } from '@/lib/countries';

export const OUTFIT = "'Outfit', sans-serif";

export const C = {
  forest: '#1B3828', forestMid: '#2A5A3C', forestLight: '#3D7A52',
  gold: '#EED98A', goldDeep: '#B6871F', goldInk: '#8A6614', amber: '#B8844A',
  ivory: '#EDE7D8', cream: '#FAF8F3', parchment: '#DDD4C0', track: '#E6DECB',
  ink: '#1C1410', inkSoft: '#5E5145', sky: '#4A7896', plum: '#8A6BA0', red: '#8B2020',
} as const;

export const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

const REAL = new Set(UN_COUNTRIES.map(c => c.code));

/** A genuine ISO code for a seat, or null for a crisis character / custom seat
 *  (so CircleFlag draws the monogram, never a broken flag). */
export function realCode(name: string | null | undefined, code?: string | null): string | null {
  if (code && REAL.has(code.toUpperCase())) return code.toUpperCase();
  const c = name ? getCountryByName(name) : null;
  return c?.code ?? null;
}

/** A seat or nationality as its REAL rectangular flag (Applications keeps
 *  real flags, never circles side by side, owner 23 Sep 2026). A crisis
 *  character or custom seat has no flag, so it gets its monogram disc. */
export function SeatFlag({ name, code, size }: { name: string | null | undefined; code?: string | null; size: number; ring?: string | boolean }) {
  const real = realCode(name, code);
  if (real) {
    return (
      <span title={name ?? real} className="inline-flex items-center flex-shrink-0" style={{ lineHeight: 0 }}>
        <FlagImg code={real} size={size} />
      </span>
    );
  }
  return (
    <CircleFlag
      code={null}
      country={name}
      size={Math.round(size * 0.8)}
      label={name ?? undefined}
      ring={false}
      style={{ borderRadius: 999, flexShrink: 0, boxShadow: '0 2px 6px rgba(27,56,40,0.22)' }}
    />
  );
}

export function SectionTitle({ icon: Icon, children, aside, tint = C.forest }: { icon: LucideIcon; children: ReactNode; aside?: ReactNode; tint?: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 10 }}>
      <Icon size={16} strokeWidth={2.3} style={{ color: tint }} aria-hidden />
      <h3 style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: C.forest }}>{children}</h3>
      {aside && <span className="ml-auto" style={{ fontFamily: OUTFIT, fontSize: 12, color: C.inkSoft }}>{aside}</span>}
    </div>
  );
}

export function FactRow({ icon: Icon, tint, label, children }: { icon: LucideIcon; tint: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3" style={{ padding: '9px 0', borderTop: `1px solid ${C.parchment}` }}>
      <Icon size={16} strokeWidth={2.2} style={{ color: tint, flexShrink: 0, marginTop: 1 }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: C.inkSoft }}>{label}</p>
        <div style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: C.ink, overflowWrap: 'anywhere', ...NUM }}>{children}</div>
      </div>
    </div>
  );
}

/** A designed empty state: an icon, one line, optionally a way forward. */
export function Empty({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ padding: '36px 16px' }}>
      <span className="inline-flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 999, background: C.ivory, border: `1.5px solid ${C.parchment}` }}>
        <Icon size={22} strokeWidth={2.1} style={{ color: C.forestLight }} aria-hidden />
      </span>
      <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: C.ink }}>{title}</p>
      {body && <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft, maxWidth: 360, lineHeight: 1.5 }}>{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2" style={{ padding: '40px 0', fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft }}>
      <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: C.forestLight, borderTopColor: 'transparent' }} aria-hidden />
      {label}
    </div>
  );
}

export function ErrorLine({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 flex-wrap" style={{ padding: '14px 16px', borderRadius: 14, border: '1.5px solid rgba(139,32,32,0.3)', background: 'rgba(139,32,32,0.05)' }}>
      <span style={{ fontFamily: OUTFIT, fontSize: 13, color: C.red, fontWeight: 600 }}>{text}</span>
      {onRetry && <LinkButton onClick={onRetry}>Try again</LinkButton>}
    </div>
  );
}

export function LinkButton({ onClick, children, icon: Icon }: { onClick: () => void; children: ReactNode; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 focus:outline-none"
      style={{
        padding: '7px 13px', borderRadius: 999, border: `1.5px solid ${C.parchment}`, background: C.cream,
        color: C.forest, fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, cursor: 'pointer',
      }}
    >
      {Icon && <Icon size={14} strokeWidth={2.4} aria-hidden />}
      {children}
    </button>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' dates read by their own parts (never through Date); timestamps
 *  through the browser's clock. */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${fmtDay(iso)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function roleName(role: string): string {
  const map: Record<string, string> = {
    delegate: 'Delegate', chair: 'Chair', 'head-delegate': 'Head delegate',
    'faculty-advisor': 'Faculty advisor', observer: 'Observer', secretariat: 'Secretariat',
  };
  return map[role] ?? role.replace(/[-_]/g, ' ').replace(/^\w/, ch => ch.toUpperCase());
}
