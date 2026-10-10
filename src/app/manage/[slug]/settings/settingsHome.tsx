'use client';

/**
 * Settings sections (Oct 2026 redesign): the way back, the jump row and each
 * section's question with its current answer (SectionTop), and the live
 * preview of the public conference card (ConferencePreview).
 *
 * The front page that used to live here (five questions) was replaced by the
 * control panel in controlPanel.tsx; the per-role application set-up lives in
 * roleSetup.tsx.
 *
 * Presentation only. Nothing here reads or writes the database: every sentence
 * is derived from props the page already holds, and every button only moves to
 * a section (the old tabs, unchanged) or to Financials.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowLeft, Globe, Lock, Copy, Check, Eye,
  CalendarDays, MapPin, Ticket, Building2, CreditCard, ClipboardList, Users2,
  ShieldCheck, UsersRound, Trophy, type LucideIcon,
} from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { CircleFlag } from '@/components/CircleFlag';
import { LogoDisc } from '@/components/LogoDisc';
import { displayRolePrice, type DelegatePriceConfig } from '@/lib/publicFees';
import { formatFee } from '@/lib/utils';
import { conferencePaymentsReady, paymentGateBlocks } from '@/lib/payments';
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

// ── Sections ────────────────────────────────────────────────────────────────

/** The settings sections. Same keys as the ?tab= deep link and the page's
 *  SettingsTab, plus 'payments', which lives in Financials. */
export type SectionKey = 'conference' | 'payments' | 'applications' | 'organizers' | 'privacy' | 'delegations' | 'awards';
export type InPageSection = Exclude<SectionKey, 'payments'>;

interface SectionMeta {
  key: SectionKey;
  /** Title Case question; its last word is drawn gold. */
  question: string;
  /** Short name for the jump row. */
  short: string;
  emoji: string;
  icon: LucideIcon;
  later?: boolean;
}

export const SECTION_META: SectionMeta[] = [
  { key: 'conference',   question: 'What Is Your Conference?', short: 'Your page',    emoji: 'Classical building',        icon: Building2 },
  { key: 'payments',     question: 'How Do People Pay?',       short: 'Payments',     emoji: 'Money bag',                 icon: CreditCard },
  { key: 'applications', question: 'Who Can Apply, and When?', short: 'Applications', emoji: 'Spiral calendar',           icon: ClipboardList },
  { key: 'organizers',   question: 'Who Runs It With You?',    short: 'Your team',    emoji: 'Busts in silhouette',       icon: Users2 },
  { key: 'privacy',      question: 'Who Can See It?',          short: 'Visibility',   emoji: 'Globe showing europe-africa', icon: ShieldCheck },
  { key: 'delegations',  question: 'How Do Delegations Work?', short: 'Delegations',  emoji: 'School',                    icon: UsersRound, later: true },
  { key: 'awards',       question: 'Awards',                   short: 'Awards',       emoji: 'Trophy',                    icon: Trophy, later: true },
];

export function sectionMeta(key: SectionKey): SectionMeta {
  return SECTION_META.find(s => s.key === key) ?? SECTION_META[0];
}

/** A Title Case heading with its last word in the gold italic (CLAUDE.md §8). */
export function GoldTitle({ text }: { text: string }) {
  const i = text.lastIndexOf(' ');
  if (i < 0) return <GoldWord>{text}</GoldWord>;
  return <>{text.slice(0, i + 1)}<GoldWord>{text.slice(i + 1)}</GoldWord></>;
}

/** A Fluent 3D emoji in a soft tinted disc, falling back to the Lucide icon. */
export function EmojiDisc({ meta, size = 52 }: { meta: SectionMeta; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #F3EEDD 70%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(27,56,40,0.07), 0 3px 8px rgba(27,56,40,0.10)',
      }}
    >
      <Emoji3D name={meta.emoji} size={Math.round(size * 0.58)} fallback={meta.icon} fallbackColor={FOREST} />
    </span>
  );
}

// ── The answers, in one plain sentence each ─────────────────────────────────

/** The part of a role config the sentences need (the page's RoleConfig fits). */
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

export type Readiness = 'ready' | 'todo' | 'optional';

export interface Answer {
  sentence: string;
  state: Readiness;
  /** Label of the card's one button. */
  action: string;
}

const ROLE_WORDS: Record<string, [string, string]> = {
  delegate: ['delegate', 'delegates'],
  'head-delegate': ['head delegate', 'head delegates'],
  'faculty-advisor': ['faculty advisor', 'faculty advisors'],
  observer: ['observer', 'observers'],
  chair: ['chair', 'chairs'],
};

function roleWord(role: string): string {
  return ROLE_WORDS[role]?.[1] ?? role.replace(/-/g, ' ') + 's';
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

export function answerFor(key: SectionKey, snap: SettingsSnapshot): Answer {
  const c = snap.conference;
  switch (key) {
    case 'conference': {
      const missing: string[] = [];
      if (c.dates_tbd || !c.start_date) missing.push('dates');
      if (c.format !== 'online' && !placeOf(c)) missing.push('city');
      if (!c.logo_url) missing.push('logo');
      if (!(c.description ?? '').trim()) missing.push('description');
      if (missing.length > 0) {
        return { sentence: `Add your ${joinWords(missing)} so people know what they are applying to.`, state: 'todo', action: 'Finish your page' };
      }
      const place = placeOf(c);
      return {
        sentence: `${c.acronym || c.full_name} runs ${dateRange(c.start_date, c.end_date)}${place === 'online' ? ', online' : place ? ` in ${place}` : ''}.`,
        state: 'ready',
        action: 'Edit your page',
      };
    }
    case 'payments': {
      if (!conferencePaymentsReady(c)) {
        return { sentence: 'Pick how people pay you. Applications stay closed until you do, even if it is free.', state: 'todo', action: 'Set up payments' };
      }
      if (c.platform_collects || c.payment_method === 'stripe') {
        return { sentence: 'People pay by card, straight to you.', state: 'ready', action: 'Change' };
      }
      const note = (c.external_payment_note ?? '').trim().toLowerCase();
      if (!c.external_payment_url && note.startsWith('this conference is free')) {
        return { sentence: 'It is free. Nobody pays anything.', state: 'ready', action: 'Change' };
      }
      const how = c.manual_kind === 'qr' ? 'scanning your QR code' : c.manual_kind === 'bank' ? 'bank transfer' : 'your payment link or instructions';
      return { sentence: `People pay you by ${how}.`, state: 'ready', action: 'Change' };
    }
    case 'applications': {
      if (paymentGateBlocks(c)) {
        return { sentence: 'Set up payments first. Then you can open applications here.', state: 'todo', action: 'Look at roles' };
      }
      const byState = (s: RoleState) => snap.roles.filter(r => roleState(r, snap.now) === s);
      const open = byState('open');
      const scheduled = byState('scheduled');
      if (open.length > 0) {
        const closes = open.map(r => r.applications_close_at).filter((x): x is string => !!x).sort()[0];
        return {
          sentence: `${capitalise(joinWords(open.map(r => roleWord(r.role))))} can apply now${closes ? `, until ${shortDate(closes)}` : ''}.`,
          state: 'ready',
          action: 'Change',
        };
      }
      if (scheduled.length > 0) {
        const first = scheduled.map(r => r.applications_open_at).filter((x): x is string => !!x).sort()[0];
        return {
          sentence: `${capitalise(joinWords(scheduled.map(r => roleWord(r.role))))} can apply from ${shortDate(first)}.`,
          state: 'ready',
          action: 'Change',
        };
      }
      if (byState('closed').length > 0) {
        return { sentence: 'Applications have closed. Open them again any time.', state: 'ready', action: 'Change' };
      }
      return { sentence: 'Nobody can apply yet. Turn on the roles you need.', state: 'todo', action: 'Open applications' };
    }
    case 'organizers': {
      const others = Math.max(0, snap.organizerCount - 1);
      const waiting = snap.pendingInviteCount;
      const waitLine = waiting > 0 ? ` ${waiting} ${waiting === 1 ? 'invite is' : 'invites are'} waiting.` : '';
      if (others > 0) {
        return { sentence: `You and ${others} ${others === 1 ? 'other person run' : 'others run'} it.${waitLine}`, state: 'ready', action: 'Manage your team' };
      }
      if (waiting > 0) return { sentence: `Just you for now.${waitLine}`, state: 'ready', action: 'Manage your team' };
      if (c.solo_secretariat_ack_at) return { sentence: 'Just you, and that is how you run it.', state: 'ready', action: 'Invite someone' };
      return { sentence: 'Just you so far. Invite your team, or say you run it alone.', state: 'todo', action: 'Invite your team' };
    }
    case 'privacy': {
      if (c.is_public) return { sentence: 'Anyone can find it on Gavelling.', state: 'ready', action: 'Change' };
      if (c.dates_tbd || !c.start_date) return { sentence: 'Private for now. Add your dates first, then you can make it public.', state: 'todo', action: 'Change' };
      return { sentence: 'Private. Only people with the link can open it.', state: 'todo', action: 'Make it public' };
    }
    case 'delegations': {
      const swap = c.allocation_swap_mode === 'off' ? 'Only your team moves seats.'
        : c.allocation_swap_mode === 'self_serve' ? 'Leaders can swap seats themselves.'
        : 'Leaders can ask to swap seats.';
      return {
        sentence: `${c.allow_delegation_import ? 'Leaders can bring in their own delegates.' : 'Each delegate applies on their own.'} ${swap}`,
        state: 'optional',
        action: 'Change',
      };
    }
    case 'awards':
      return { sentence: 'Coming soon.', state: 'optional', action: 'Have a look' };
  }
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

// ── Inside a section: the way back, the jump row and the question ────────────

const NAV_CSS = `
/* Text overflow audit (Oct 2026): fee phase rows used five columns at every
   width, so on a phone or tablet the dates were cut and the label ran out of
   its box. Two rows until there is room for all five. */
.gvs-phase-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.gvs-phase-row > :first-child { grid-column: 1 / -1; }
.gvs-phase-row > :last-child { justify-self: end; }
@media (min-width: 1180px) {
  .gvs-phase-row { grid-template-columns: minmax(0,1.1fr) minmax(0,1.25fr) minmax(0,1.25fr) minmax(0,0.7fr) 24px; }
  .gvs-phase-row > :first-child { grid-column: auto; }
  .gvs-phase-row > :last-child { justify-self: center; }
}
.gvs-jump { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px 2px 6px; margin: 0 -2px; -webkit-mask-image: linear-gradient(90deg, #000 82%, transparent); mask-image: linear-gradient(90deg, #000 82%, transparent); }
.gvs-jump::-webkit-scrollbar { display: none; }
@media (min-width: 640px) { .gvs-jump { flex-wrap: wrap; overflow: visible; -webkit-mask-image: none; mask-image: none; } }
`;

export function SectionTop({ active, snap, onOpen, onHome }: {
  active: InPageSection;
  snap: SettingsSnapshot;
  onOpen: (key: InPageSection) => void;
  onHome: () => void;
}) {
  const meta = sectionMeta(active);
  const answer = answerFor(active, snap);
  const slug = snap.conference.slug;
  return (
    <div className="mb-6">
      <style>{NAV_CSS}</style>
      <button
        type="button"
        onClick={onHome}
        className="inline-flex items-center gap-1.5 mb-4 focus:outline-none"
        style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: FOREST, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        <ArrowLeft size={15} strokeWidth={2.5} aria-hidden />
        All settings
      </button>

      <nav aria-label="Settings sections" className="gvs-jump mb-5">
        {SECTION_META.map(s => {
          const on = s.key === active;
          const common: React.CSSProperties = {
            display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap',
            padding: '7px 13px 7px 8px', borderRadius: 999, fontFamily: F, fontSize: 13.5, fontWeight: 600,
            backgroundColor: on ? FOREST : '#FFFFFF',
            color: on ? '#FFFFFF' : INK,
            border: on ? '1px solid transparent' : '1px solid rgba(27,56,40,0.10)',
            boxShadow: on ? '0 4px 12px rgba(27,56,40,0.22)' : '0 1px 2px rgba(27,56,40,0.05)',
            textDecoration: 'none', cursor: 'pointer',
          };
          const inner = (
            <>
              <Emoji3D name={s.emoji} size={20} fallback={s.icon} fallbackColor={on ? '#EED98A' : FOREST} />
              {s.short}
            </>
          );
          return s.key === 'payments' ? (
            <Link key={s.key} href={`/manage/${slug}/financials?open=payment`} className="focus:outline-none" style={common}>{inner}</Link>
          ) : (
            <button key={s.key} type="button" aria-current={on ? 'page' : undefined} onClick={() => onOpen(s.key as InPageSection)} className="focus:outline-none" style={common}>{inner}</button>
          );
        })}
      </nav>

      <div className="flex items-center gap-4">
        <EmojiDisc meta={meta} size={56} />
        <div className="min-w-0">
          <h1 style={{ fontFamily: F, fontSize: 'clamp(24px, 2.6vw, 32px)', fontWeight: 800, color: INK, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            <GoldTitle text={meta.question} />
          </h1>
          <p className="mt-1" style={{ fontFamily: F, fontSize: 15, color: INK_SOFT, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
            {answer.sentence}
          </p>
        </div>
      </div>
    </div>
  );
}
