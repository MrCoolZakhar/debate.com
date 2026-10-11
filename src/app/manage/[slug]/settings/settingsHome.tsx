'use client';

/**
 * The live preview of the public conference card (ConferencePreview), drawn
 * beside Settings → General on wide screens, and dateRange for the header.
 * The section shell is settingsShell.tsx (Oct 2026 bookmarks redesign).
 *
 * Presentation only. Nothing here reads or writes the database.
 */

import type { ReactNode } from 'react';
import {
  Globe, Lock, Copy, Check, Eye, CalendarDays, MapPin, Ticket, ClipboardList, type LucideIcon,
} from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { LogoDisc } from '@/components/LogoDisc';
import { displayRolePrice, type DelegatePriceConfig } from '@/lib/publicFees';
import { formatFee } from '@/lib/utils';
import type { Conference } from '@/app/manage/[slug]/layout';

// ── Tokens ──────────────────────────────────────────────────────────────────
const F = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const INK_SOFT = '#5C4F42';
const FOREST = '#1B3828';
const AMBER = '#8A6614';
const CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  border: '1px solid rgba(27,56,40,0.07)',
  boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 10px 28px rgba(27,56,40,0.09)',
};

/** The part of a role config the preview needs (the page's RoleConfig fits). */
export interface RoleSummary extends DelegatePriceConfig {
  role: string;
  is_enabled: boolean;
  applications_open_at: string | null;
  applications_close_at: string | null;
}

export interface SettingsSnapshot {
  conference: Conference;
  roles: RoleSummary[];
  organizerCount: number;
  pendingInviteCount: number;
  now: number;
}

function shortDate(iso: string | null | undefined, withYear = false): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

/** "14 to 18 Mar 2027", "30 Mar to 2 Apr 2027", or the single day. */
export function dateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '';
  const s = new Date(`${start}T12:00:00`);
  const e = end ? new Date(`${end}T12:00:00`) : s;
  if (Number.isNaN(s.getTime())) return '';
  const year = e.getFullYear();
  if (!end || start === end) return shortDate(start, true);
  if (s.getFullYear() !== year) return `${shortDate(start, true)} to ${shortDate(end, true)}`;
  if (s.getMonth() === e.getMonth()) return `${s.getDate()} to ${shortDate(end, true)}`;
  return `${shortDate(start)} to ${shortDate(end, true)}`;
}

type RoleState = 'open' | 'scheduled' | 'closed' | 'off';
function roleState(r: RoleSummary, now: number): RoleState {
  if (!r.is_enabled) return 'off';
  const opens = r.applications_open_at ? new Date(r.applications_open_at).getTime() : null;
  const closes = r.applications_close_at ? new Date(r.applications_close_at).getTime() : null;
  if (opens !== null && opens > now) return 'scheduled';
  if (closes !== null && closes < now) return 'closed';
  return 'open';
}

function placeOf(c: Conference): string {
  if (c.format === 'online') return 'online';
  return [c.city, c.country].map(s => (s ?? '').trim()).filter(Boolean).join(', ');
}

// ── The live preview of the public card ──────────────────────────────────────

export function ConferencePreview({ snap, onCopyLink, copied }: {
  snap: SettingsSnapshot;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const c = snap.conference;
  const delegate = snap.roles.find(r => r.role === 'delegate') ?? null;
  const price = displayRolePrice(delegate, c.fee_currency || 'USD', new Date(snap.now));
  const priceText = price.kind === 'paid' ? formatFee(price.amount, price.currency) : price.kind === 'free' ? 'Free' : 'Price to be set';
  const state = delegate ? roleState(delegate, snap.now) : 'off';
  const applyLine = state === 'open' ? 'Applications open'
    : state === 'scheduled' ? `Applications open ${shortDate(delegate?.applications_open_at)}`
    : state === 'closed' ? 'Applications closed'
    : 'Applications not open yet';
  const place = placeOf(c);
  const dates = c.dates_tbd || !c.start_date ? 'Dates to be decided' : dateRange(c.start_date, c.end_date);

  return (
    <div>
      <p className="flex items-center gap-2 mb-3" style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: INK_SOFT }}>
        <Eye size={15} strokeWidth={2.3} aria-hidden />
        What applicants see
      </p>
      <div style={{ ...CARD, overflow: 'hidden' }}>
        {/* Banner strip, then the logo overlapping its lower edge (the Explore card). */}
        <div className="relative" style={{ height: 112, background: 'linear-gradient(135deg, #E9E2CF, #F6F1E4)' }}>
          {c.banner_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={c.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center select-none"
              style={{ fontFamily: F, fontWeight: 800, fontSize: 44, color: 'rgba(27,56,40,0.08)', letterSpacing: '0.04em', overflow: 'hidden' }}
            >
              {(c.acronym || '').slice(0, 10)}
            </span>
          )}
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          <div className="relative z-[1]" style={{ marginTop: -38, marginBottom: 10, width: 76 }}>
            <LogoDisc src={c.logo_url} alt={c.acronym} size={76} fallbackText={(c.acronym || '?').slice(0, 3)} style={{ boxShadow: '0 0 0 4px #FFFFFF, 0 6px 16px rgba(27,56,40,0.18)' }} />
          </div>
          {/* Two rows: the short name big, the full name smaller beneath. Never "…". */}
          <p style={{ fontFamily: F, fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1.1, overflowWrap: 'anywhere' }}>
            {c.acronym || c.full_name}
          </p>
          {c.acronym && c.full_name && c.full_name !== c.acronym && (
            <p style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.35, marginTop: 4, overflowWrap: 'anywhere' }}>
              {c.full_name}
            </p>
          )}
          <ul className="mt-4 flex flex-col gap-2.5" style={{ fontFamily: F, fontSize: 14, color: INK }}>
            <PreviewRow icon={CalendarDays}>{dates}</PreviewRow>
            <PreviewRow
              icon={MapPin}
              lead={place && place !== 'online' && c.country ? <CircleFlag country={c.country} size={18} decorative /> : undefined}
            >
              {place === 'online' ? 'Online' : place || <span style={{ color: AMBER }}>Place not added yet</span>}
            </PreviewRow>
            <PreviewRow icon={Ticket}><b style={{ fontWeight: 700 }}>{priceText}</b><span style={{ color: INK_SOFT }}> for delegates</span></PreviewRow>
          </ul>
          <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(27,56,40,0.08)', fontFamily: F, fontSize: 13.5 }}>
            <span className="flex items-center gap-2" style={{ color: state === 'open' ? FOREST : INK_SOFT, fontWeight: 600 }}>
              <ClipboardList size={15} strokeWidth={2.3} aria-hidden className="flex-shrink-0" />
              <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{applyLine}</span>
            </span>
            <span className="flex items-center gap-2" style={{ color: c.is_public ? FOREST : AMBER, fontWeight: 600 }}>
              {c.is_public ? <Globe size={15} strokeWidth={2.3} aria-hidden className="flex-shrink-0" /> : <Lock size={15} strokeWidth={2.3} aria-hidden className="flex-shrink-0" />}
              <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{c.is_public ? 'Public on Gavelling' : 'Private, link only'}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ fontFamily: F, fontSize: 14 }}>
        <a
          href={`/conferences/${c.slug}?preview=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="focus:outline-none"
          style={{ color: FOREST, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Open your page
        </a>
        <button
          type="button"
          onClick={onCopyLink}
          className="inline-flex items-center gap-1.5 focus:outline-none"
          style={{ color: FOREST, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          {copied ? <Check size={14} strokeWidth={3} aria-hidden /> : <Copy size={14} strokeWidth={2.4} aria-hidden />}
          {copied ? 'Link copied' : 'Copy the link'}
        </button>
      </div>
    </div>
  );
}

function PreviewRow({ icon: Icon, lead, children }: { icon: LucideIcon; lead?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex items-center justify-center flex-shrink-0" style={{ width: 18, height: 20 }}>
        {lead ?? <Icon size={16} strokeWidth={2.2} style={{ color: FOREST }} aria-hidden />}
      </span>
      <span className="min-w-0" style={{ lineHeight: 1.4, overflowWrap: 'anywhere' }}>{children}</span>
    </li>
  );
}
