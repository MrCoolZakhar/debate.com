'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowRight, BadgeCheck, Ban, Building2, Cake, CalendarDays, Check, ChevronDown, ChevronLeft, CircleCheck, Clock,
  Download, Eye, Filter, Gavel, Globe, GraduationCap, HandCoins, Inbox, LogOut, MapPin,
  MessageSquareText, Plus, RotateCcw, Search, Send, SlidersHorizontal, Trash2, Trophy, Undo2, User, UserRoundCheck,
  Users, Wallet, X,
} from 'lucide-react';
import Link from 'next/link';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { queueEventEmail, notifyIfNeeded, turnOnDefaultEmail } from '@/lib/emailEvents';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { useConfirmModal } from '@/components/ConfirmModal';
import { FlagImg } from '@/components/FlagImg';
import { DatePicker } from '@/components/DatePicker';
import { LogoDisc } from '@/components/LogoDisc';
import Portal from '@/components/Portal';
import { getCountryByName, getFlagUrl, UN_COUNTRIES } from '@/lib/countries';
import { ageAt } from '@/lib/age';
import { checkInApplication, undoCheckIn } from '@/lib/checkIn';
import { isPaymentsLive } from '@/lib/payments';
import {
  NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuStatTile, NeuIconDisc,
} from '@/components/neu';
import {
  poolForRole, fillFreeSpots, releasePoolSpot, POOL_SPOTS_COLUMN, MemberAvatar,
} from '@/app/manage/[slug]/assignment/delegationShared';
import { LevelInsignia, LEVEL_ACCENT, AwardArtwork, monogramFor } from '@/app/account/accountUi';
import { type CustomQuestion, type CustomAnswers, normalizeQuestions, displayAnswer } from '@/lib/customQuestions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppPreference {
  preference_order: number;
  conference_committee_id: string;
  country_code: string;
  country_name: string;
  conference_committees: { name: string; abbreviation: string | null; logo_url: string | null } | null;
}

interface RoleConfigLite {
  role: string;
  payment_timing: 'after_application' | 'after_acceptance' | 'anytime' | string;
  custom_questions: CustomQuestion[];
  fee_amount: number | null;
  fee_currency: string | null;
  allow_resubmission: boolean;
}

interface Application {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  invited_name: string | null;
  role: string;
  status: string;
  is_head_delegate: boolean;
  experience_level: string | null;
  payment_status: string | null;
  submitted_at: string;
  checked_in_at: string | null;
  organizer_note: string | null;
  resubmitted_at: string | null;
  custom_answers: CustomAnswers | null;
  assigned_committee_id: string | null;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  assigned_committee: { name: string; abbreviation: string | null; topics: string[] | null; logo_url: string | null } | null;
  profiles: { display_name: string; email: string; avatar_url: string | null; nationality: string | null; date_of_birth: string | null; mun_experience_level: string | null } | null;
  societies: { name: string } | null;
  application_preferences: AppPreference[];
  self_paid: boolean;
  attending: boolean;
  pledge_type: 'delegation' | null;
  spots_pledged: number | null;
  pledge_confirmed_at: string | null;
  society_id: string | null;
}

// Lightweight committee shape for the inline quick-allocate picker (#7). Loaded
// lazily the first time an organiser opens the Plus popover on an unassigned
// delegate. `slots` are the committee's country seats; `takenCodes` are the
// country_codes already allocated, so open seats = slots minus takenCodes.
interface QuickCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  topics: string[] | null;
  slots: { country_code: string; country_name: string }[];
  takenCodes: string[];
}

// Pool accounting (poolForRole, fillFreeSpots, releasePoolSpot, POOL_SPOTS_COLUMN)
// is imported from delegationShared.tsx, the canonical location (F: fillFreeSpots
// consolidation). This page no longer keeps its own copy.

// One row of the previewed applicant's MUN CV (mun_cv_entries), fetched on demand
// when the review modal opens. Mirrors the fields the /account/cv page reads.
interface PreviewCvEntry {
  id: string;
  entry_type: string;
  conference_name: string;
  committee: string | null;
  allocation: string | null;
  awards: string[] | null;
  award: string | null;
  logo_url: string | null;
  event_date: string | null;
  description: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Real ISO 3166-1 alpha-2 codes, so a committee "country" that is actually a
// crisis/JCC character name (country_code stores the character, e.g. "Indira
// Gandhi") is never mistaken for a flag and never renders a broken flag image.
const REAL_COUNTRY_CODES = new Set(UN_COUNTRIES.map(c => c.code));

/** The genuine ISO code for a name/code pair, or null when it does not resolve
 *  to a real country (crisis characters, custom seats, blanks). */
function resolveRealCountryCode(name: string | null | undefined, code?: string | null): string | null {
  if (code && REAL_COUNTRY_CODES.has(code.toUpperCase())) return code.toUpperCase();
  if (name) {
    const c = getCountryByName(name);
    if (c) return c.code;
  }
  return null;
}

/** Whole-years age for a row: profiles.date_of_birth first, then any DOB the
 *  applicant typed into a date-style / "date of birth" custom answer (#12). */
function ageForApp(app: Application, questions: CustomQuestion[]): number | null {
  const fromProfile = ageAt(app.profiles?.date_of_birth);
  if (fromProfile !== null) return fromProfile;
  const answers = app.custom_answers ?? {};
  const dobQ = questions.find(q =>
    q.type === 'date' && /\b(birth|dob|born)\b/i.test(q.label)
  ) ?? questions.find(q => /date of birth|birth date|\bdob\b/i.test(q.label));
  const dobVal = dobQ ? answers[dobQ.id] : undefined;
  const raw = typeof dobVal === 'string' ? dobVal.trim() : '';
  return raw ? ageAt(raw) : null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    delegate: 'Delegate', chair: 'Chair', 'head-delegate': 'Head Delegate',
    'faculty-advisor': 'Faculty Advisor', observer: 'Observer',
  };
  return map[role] ?? role;
}

function RoleIcon({ role, size = 10 }: { role: string; size?: number }) {
  const Icon = role === 'chair' ? Gavel
    : role === 'head-delegate' ? Users
    : role === 'faculty-advisor' ? GraduationCap
    : role === 'observer' ? Eye
    : User;
  return <Icon size={size} strokeWidth={2.5} />;
}

/** Small muted chip for applications with no linked profile (user_id null), imported, unclaimed. */
function NotRegisteredChip() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full font-bold flex-shrink-0"
      style={{ fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', backgroundColor: 'rgba(154,138,120,0.12)', color: '#9A8A78', border: '1px solid rgba(154,138,120,0.3)' }}
    >
      NOT REGISTERED
    </span>
  );
}

type LucideGlyph = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

/** Large, solid-fill status pill, forest/ivory palette. White glyph + label on
 *  a saturated two-stop gradient with a soft neumorphic seat. The four
 *  checkmark-family states get deliberately distinct glyphs so they read apart
 *  at this larger size (accept = plain tick, assigned = badge tick, checked-in =
 *  person tick). */
const STATUS_PILL: Record<string, { grad: [string, string]; label: string; icon: LucideGlyph }> = {
  submitted:    { grad: ['#C79A52', '#B8844A'], label: 'Submitted',  icon: Inbox },
  accepted:     { grad: ['#3D7A52', '#2A5A3C'], label: 'Accepted',   icon: Check },
  assigned:     { grad: ['#C79A2E', '#9A7418'], label: 'Assigned',   icon: BadgeCheck },
  'checked-in': { grad: ['#2F7A5C', '#1F6E52'], label: 'Checked In', icon: UserRoundCheck },
  rejected:     { grad: ['#9A3030', '#7A1F1F'], label: 'Rejected',   icon: Ban },
  withdrawn:    { grad: ['#8A7E6E', '#6B5F52'], label: 'Withdrawn',  icon: LogOut },
};

function StatusPill({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const t = STATUS_PILL[status] ?? { grad: ['#9A8A78', '#6B5F52'] as [string, string], label: status.replace('-', ' '), icon: Clock };
  const Icon = t.icon;
  const iconSize = size === 'sm' ? 12 : 14;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        padding: size === 'sm' ? '4px 10px' : '5px 12px',
        borderRadius: 999,
        background: `linear-gradient(135deg, ${t.grad[0]}, ${t.grad[1]})`,
        color: '#FFFFFF',
        fontFamily: OUTFIT, fontSize: size === 'sm' ? 11 : 11.5, fontWeight: 800, letterSpacing: '0.03em',
        boxShadow: `0 3px 8px ${t.grad[0]}55, ${NEU.outSm}`,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={iconSize} strokeWidth={2.7} style={{ color: '#FFFFFF' }} />
      {t.label.toUpperCase()}
    </span>
  );
}

/** Role pill, same upgraded fill treatment. Chairs get the gold accent (forest
 *  glyph on a gold gradient for contrast); delegates read forest, staff slate. */
function RolePill({ role, size = 'md' }: { role: string; size?: 'sm' | 'md' }) {
  const spec = role === 'chair'
    ? { grad: ['#EED98A', '#C79A2E'] as [string, string], ink: '#3A2A08' }
    : role === 'delegate' || role === 'head-delegate'
    ? { grad: ['#3D7A52', '#2A5A3C'] as [string, string], ink: '#FFFFFF' }
    : { grad: ['#5A6E9E', '#45568A'] as [string, string], ink: '#FFFFFF' };
  const iconSize = size === 'sm' ? 12 : 13;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        padding: size === 'sm' ? '4px 10px' : '5px 12px',
        borderRadius: 999,
        background: `linear-gradient(135deg, ${spec.grad[0]}, ${spec.grad[1]})`,
        color: spec.ink,
        fontFamily: OUTFIT, fontSize: size === 'sm' ? 11 : 11.5, fontWeight: 800, letterSpacing: '0.03em',
        boxShadow: `0 3px 8px ${spec.grad[0]}55, ${NEU.outSm}`,
        whiteSpace: 'nowrap',
      }}
    >
      <RoleIcon role={role} size={iconSize} />
      {roleLabel(role).toUpperCase()}
    </span>
  );
}

/** Experience level rendered exactly like the delegate profile (LevelInsignia
 *  on a tinted disc + capitalised tier), followed by the count of conferences
 *  on their MUN CV in parentheses, e.g. "Expert (9)". */
function LevelChip({ level, count }: { level: string; count?: number }) {
  const key = (level ?? '').toLowerCase();
  const accent = LEVEL_ACCENT[key] ?? '#9A8A78';
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unranked';
  return (
    <span
      className="inline-flex items-center"
      title={count !== undefined ? `${count} conference${count === 1 ? '' : 's'} on their MUN CV` : undefined}
      style={{ gap: 6, padding: '4px 12px 4px 5px', borderRadius: 999, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{ width: 22, height: 22, borderRadius: 9999, background: `linear-gradient(150deg, ${accent}26, ${accent}14)`, border: `1px solid ${accent}55` }}
      >
        <LevelInsignia level={key} size={15} />
      </span>
      <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: NEU.ink, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums' }}>
        {label}{count !== undefined ? ` (${count})` : ''}
      </span>
    </span>
  );
}

/** Experience as a stacked circular badge for the row's top-right corner: a big
 *  level insignia in a tinted disc, the tier name beneath it, and the conference
 *  count as a caption. Mirrors the delegate-profile insignia at a larger size. */
function LevelBadge({ level, count }: { level: string; count?: number }) {
  const key = (level ?? '').toLowerCase();
  const accent = LEVEL_ACCENT[key] ?? '#9A8A78';
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unranked';
  return (
    <div
      className="flex flex-col items-center flex-shrink-0"
      style={{ width: 66, gap: 4 }}
      title={count !== undefined ? `${count} conference${count === 1 ? '' : 's'} on their MUN CV` : label}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{ width: 48, height: 48, borderRadius: 9999, background: `linear-gradient(150deg, ${accent}2E, ${accent}17)`, border: `1.5px solid ${accent}66`, boxShadow: NEU.outSm }}
      >
        <LevelInsignia level={key} size={30} />
      </span>
      <span className="text-center leading-tight" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: NEU.ink }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 10, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
          {count} conf{count === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}

/** Payment control. One button opens a small menu: "Mark paid manually", a
 *  "Remind to pay" that re-sends the pay-now email (#8), and the matching undo.
 *  The button itself turns GREEN once paid (#9) so no separate PAID badge is
 *  needed. "Remove waiver" stays reachable for any legacy waived rows. Portaled +
 *  edge-flipped so the clipping row card never cuts the menu off. */
function PaymentMenu({
  app, disabled, paymentsLive, onMarkPaid, onRemind, onMarkUnpaid, onUndoWaive, align = 'left',
}: {
  app: Application;
  disabled?: boolean;
  /** When true, Stripe is live for this conference — manual mark-paid/unpaid
   *  is disabled (checkout + webhook own that state). Undo-waive stays free. */
  paymentsLive?: boolean;
  onMarkPaid: () => void;
  onRemind: () => void;
  onMarkUnpaid: () => void;
  onUndoWaive: () => void;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // The row card sets overflow:hidden to clip its rounded corners, which would
  // clip an in-card absolute menu. Render the menu in a Portal at fixed
  // viewport coordinates computed from the trigger so it can never be clipped.
  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const menuW = 184;
    const left = align === 'right' ? r.right - menuW : r.left;
    setPos({ top: r.bottom + 6, left: Math.max(8, left) });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  const paid = app.payment_status === 'paid';
  const waived = app.payment_status === 'waived';
  const label = paid ? 'Paid' : waived ? 'Waived' : 'Payment';

  const item = (
    icon: LucideGlyph, text: string, onClick: () => void, tone: 'ink' | 'danger' = 'ink',
    opts?: { disabled?: boolean; title?: string },
  ) => {
    const Icon = icon;
    const itemDisabled = !!opts?.disabled;
    return (
      <button
        onClick={() => { if (itemDisabled) return; setOpen(false); onClick(); }}
        disabled={itemDisabled}
        title={opts?.title}
        className="inline-flex items-center gap-2 w-full focus:outline-none"
        style={{
          padding: '9px 12px', borderRadius: 10, background: 'transparent', border: 'none',
          cursor: itemDisabled ? 'not-allowed' : 'pointer', textAlign: 'left', fontFamily: OUTFIT, fontSize: 12, fontWeight: 700,
          color: itemDisabled ? NEU.muted : (tone === 'danger' ? '#8B2020' : NEU.ink), opacity: itemDisabled ? 0.55 : 1,
        }}
        onMouseEnter={e => { if (!itemDisabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <Icon size={14} strokeWidth={2.4} style={{ color: itemDisabled ? NEU.muted : (tone === 'danger' ? '#8B2020' : NEU.deepGold) }} />
        {text}
      </button>
    );
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 focus:outline-none"
        style={{
          padding: '7px 13px', borderRadius: 999,
          fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
          // Paid → green filled (no separate PAID badge, #9). Else calm cream.
          color: paid ? '#FFFFFF' : NEU.ink,
          background: paid ? 'linear-gradient(135deg, #3D7A52, #2A5A3C)' : NEU.surface,
          boxShadow: paid ? '0 3px 8px #3D7A5255, ' + NEU.outSm : NEU.outSm,
          border: 'none',
          cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        }}
      >
        {paid
          ? <CircleCheck size={13} strokeWidth={2.7} style={{ color: '#FFFFFF' }} />
          : <Wallet size={13} strokeWidth={2.5} style={{ color: NEU.deepGold }} />}
        {label.toUpperCase()}
        <ChevronDown size={12} strokeWidth={2.6} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, minWidth: 196, backgroundColor: NEU.surface, borderRadius: 14, boxShadow: NEU.out, padding: 6, animation: `neuFadeIn 160ms ${EASE_LOCAL}` }}
          >
            <style>{`@keyframes neuFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            {!paid && !waived && item(CircleCheck, 'Mark paid manually', onMarkPaid, 'ink',
              paymentsLive ? { disabled: true, title: 'Payments are handled automatically via checkout' } : undefined)}
            {!paid && !waived && item(Send, 'Remind to pay', onRemind)}
            {paid && item(RotateCcw, 'Mark as unpaid', onMarkUnpaid, 'danger',
              paymentsLive ? { disabled: true, title: 'Payments are handled automatically via checkout' } : undefined)}
            {waived && item(RotateCcw, 'Remove waiver', onUndoWaive, 'danger')}
          </div>
        </Portal>
      )}
    </div>
  );
}

/** Inline quick-allocate (#7). A small neumorphic Plus beside "Not yet
 *  assigned" opens a portaled, edge-flipped two-step picker (committee, then an
 *  open country) that allocates this specific delegate without leaving the page,
 *  reusing the same conference_allocations write the assignment board uses. The
 *  popover is portaled + clamped/flipped so the clipping row card never cuts it
 *  off (mirrors PaymentMenu's portal pattern). */
function QuickAllocate({
  committees, loading, onOpen, onAllocate,
}: {
  committees: QuickCommittee[] | null;
  loading: boolean;
  onOpen: () => void;
  onAllocate: (committee: QuickCommittee, slot: { country_code: string; country_name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<QuickCommittee | null>(null);
  const [query, setQuery] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const MENU_W = 300;
  const MENU_H = 380;

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = spaceBelow < MENU_H + 16 && r.top > spaceBelow;
    let left = r.left;
    if (left + MENU_W > window.innerWidth - 8) left = window.innerWidth - MENU_W - 8;
    left = Math.max(8, left);
    const top = flip ? Math.max(8, r.top - MENU_H - 6) : r.bottom + 6;
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  // Measure + position on click (the button rect is available immediately),
  // so the effect never calls setState synchronously on open.
  const toggle = () => {
    if (open) { setOpen(false); return; }
    onOpen();
    setPicked(null);
    setQuery('');
    place();
    setOpen(true);
  };

  const q = query.trim().toLowerCase();
  const listed = (committees ?? []).filter(c =>
    !q || c.name.toLowerCase().includes(q) || (c.abbreviation ?? '').toLowerCase().includes(q)
  );
  const openSeats = (c: QuickCommittee) => c.slots.filter(s => !c.takenCodes.includes(s.country_code));

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={toggle}
        title="Allocate to a committee"
        aria-label="Allocate to a committee"
        className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none"
        style={{
          width: 28, height: 28, borderRadius: 999,
          color: NEU.forest, backgroundColor: NEU.surface,
          boxShadow: open ? NEU.inSm : NEU.outSm, border: 'none', cursor: 'pointer',
          transition: `box-shadow 160ms ${EASE_LOCAL}`,
        }}
      >
        <Plus size={15} strokeWidth={2.8} style={{ color: NEU.deepGold, transform: open ? 'rotate(45deg)' : 'none', transition: `transform 200ms ${EASE_LOCAL}` }} />
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: MENU_W, maxHeight: MENU_H, display: 'flex', flexDirection: 'column', backgroundColor: NEU.surface, borderRadius: 16, boxShadow: NEU.out, padding: 10, animation: `neuFadeIn 160ms ${EASE_LOCAL}` }}
          >
            <style>{`@keyframes neuFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* Header */}
            <div className="flex items-center gap-2 mb-2.5 px-0.5">
              {picked ? (
                <button
                  onClick={() => setPicked(null)}
                  className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none"
                  style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, border: 'none', cursor: 'pointer', color: NEU.ink }}
                  aria-label="Back to committees"
                >
                  <ChevronLeft size={14} strokeWidth={2.6} />
                </button>
              ) : (
                <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={BadgeCheck} size={24} />
              )}
              <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, color: NEU.ink }}>
                {picked ? committeeFull(picked) : 'Allocate to committee'}
              </p>
            </div>

            {/* Committee search (only when there are enough to warrant it) */}
            {!picked && (committees?.length ?? 0) > 6 && (
              <div className="flex items-center gap-2 mb-2" style={{ padding: '6px 10px', borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
                <Search size={13} strokeWidth={2.4} style={{ color: NEU.muted, flexShrink: 0 }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search committees..."
                  className="flex-1 outline-none"
                  style={{ backgroundColor: 'transparent', color: NEU.ink, fontFamily: OUTFIT, fontSize: 12 }}
                />
              </div>
            )}

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {loading && !committees ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
                </div>
              ) : !picked ? (
                listed.length === 0 ? (
                  <p className="text-center py-5" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted }}>
                    {(committees?.length ?? 0) === 0 ? 'No committees set up yet.' : 'No committees match.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {listed.map(c => {
                      const seats = openSeats(c).length;
                      const full = seats === 0;
                      return (
                        <button
                          key={c.id}
                          onClick={() => { if (!full) setPicked(c); }}
                          disabled={full}
                          className="inline-flex items-center gap-2.5 w-full focus:outline-none text-left"
                          style={{ padding: '7px 8px', borderRadius: 11, background: 'transparent', border: 'none', cursor: full ? 'default' : 'pointer', opacity: full ? 0.5 : 1 }}
                          onMouseEnter={e => { if (!full) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <LogoDisc src={c.logo_url} size={30} fallbackText={committeeAbbr(c)} alt={c.name} />
                          <span className="flex-1 min-w-0">
                            <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>{c.name}</span>
                            <span className="block" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: full ? NEU.muted : NEU.green, fontVariantNumeric: 'tabular-nums' }}>
                              {full ? 'Full' : `${seats} open seat${seats === 1 ? '' : 's'}`}
                            </span>
                          </span>
                          {!full && <ChevronDown size={13} strokeWidth={2.6} style={{ color: NEU.muted, transform: 'rotate(-90deg)', flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                (() => {
                  const seats = openSeats(picked);
                  if (seats.length === 0) {
                    return <p className="text-center py-5" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted }}>No open countries in this committee.</p>;
                  }
                  return (
                    <div className="flex flex-col gap-1">
                      {[...seats].sort((a, b) => a.country_name.localeCompare(b.country_name)).map(s => (
                        <button
                          key={s.country_code}
                          onClick={() => { onAllocate(picked, s); setOpen(false); }}
                          className="inline-flex items-center gap-2.5 w-full focus:outline-none text-left"
                          style={{ padding: '7px 9px', borderRadius: 11, background: 'transparent', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <CountryFlag name={s.country_name} code={s.country_code} size={20} />
                          <span className="flex-1 min-w-0 truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>{s.country_name}</span>
                          <Plus size={13} strokeWidth={2.6} style={{ color: NEU.deepGold, flexShrink: 0 }} />
                        </button>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

/** Neumorphic select checkbox, used per-row and for select-all. Pressed-in
 *  when unchecked, forest-filled with a white tick when checked. */
function SelectBox({ checked, indeterminate, onClick, title }: { checked: boolean; indeterminate?: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      aria-pressed={checked}
      className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none"
      style={{
        width: 20, height: 20, borderRadius: 7,
        background: checked || indeterminate ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.base,
        boxShadow: checked || indeterminate ? `0 2px 5px ${NEU_GRADIENTS.forest[0]}55` : NEU.inSm,
        border: 'none', cursor: 'pointer', transition: `box-shadow 160ms ${EASE_LOCAL}`,
      }}
    >
      {checked && <Check size={13} strokeWidth={3.5} style={{ color: '#FFFFFF' }} />}
      {!checked && indeterminate && <span style={{ width: 9, height: 2.5, borderRadius: 2, background: '#FFFFFF' }} />}
    </button>
  );
}

/** Full committee label, "Full Name - ACRONYM" when an abbreviation is set and
 *  differs from the name, else just the name. Used in the row's allocation cell
 *  alongside the LogoDisc emblem. */
function committeeFull(c: { name: string; abbreviation: string | null } | null | undefined): string {
  if (!c) return '';
  if (c.abbreviation && c.abbreviation.toUpperCase() !== c.name.toUpperCase()) {
    return `${c.name} - ${c.abbreviation}`;
  }
  return c.name;
}

/** Committee naming rule (#6): a long committee name collapses to its ACRONYM
 *  as the big primary label with the full name in small letters beneath, e.g.
 *  "Disarmament and International Security Committee" → "DISEC" + full name.
 *  Short names (or ones with no distinct abbreviation) stay as-is, name only. */
function committeeDisplay(c: { name: string; abbreviation: string | null } | null | undefined): { primary: string; secondary: string | null } {
  if (!c) return { primary: '—', secondary: null };
  const hasAbbr = !!c.abbreviation && c.abbreviation.toUpperCase() !== c.name.toUpperCase();
  const isLong = c.name.length > 16 || c.name.trim().split(/\s+/).length >= 3;
  if (hasAbbr && isLong) return { primary: c.abbreviation!, secondary: c.name };
  return { primary: c.name, secondary: null };
}

/** Short relative-ish timestamp for the "Checked in …" line. */
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Committee shorthand, abbreviation when set, else a monogram of the name. */
function committeeAbbr(c: { name: string; abbreviation: string | null } | null | undefined): string {
  if (!c) return '—';
  if (c.abbreviation) return c.abbreviation;
  const mono = c.name
    .split(/\s+/)
    .filter(w => /^[A-Za-z0-9]/.test(w))
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return mono || c.name.slice(0, 4).toUpperCase();
}

/** Country rendered as a flag with the name kept as a tooltip. When the seat is
 *  not a real country (crisis/JCC character, custom seat) it renders a person
 *  glyph in a soft disc instead of a broken flag image, so allocations NEVER
 *  show a broken picture (#7). */
function CountryFlag({ name, code, size = 14 }: { name: string | null | undefined; code?: string | null; size?: number }) {
  const resolved = resolveRealCountryCode(name, code);
  if (resolved) {
    return (
      <span title={name ?? resolved} className="inline-flex items-center" style={{ lineHeight: 0 }}>
        <FlagImg code={resolved} size={size} />
      </span>
    );
  }
  if (!name) return null;
  // Character / custom seat: a user glyph on a tinted disc, never a broken flag.
  return (
    <span
      title={name}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: 9999, background: 'linear-gradient(150deg, rgba(27,56,40,0.14), rgba(27,56,40,0.07))', border: '1px solid rgba(27,56,40,0.18)' }}
    >
      <User size={Math.round(size * 0.62)} strokeWidth={2.4} style={{ color: NEU.forest }} />
    </span>
  );
}

const STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'Checked In', value: 'checked-in' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Withdrawn', value: 'withdrawn' },
];

const ROLE_OPTIONS = [
  { label: 'Delegates', value: 'delegate' },
  { label: 'Chairs', value: 'chair' },
  { label: 'Head Delegates', value: 'head-delegate' },
  { label: 'Faculty Advisors', value: 'faculty-advisor' },
  { label: 'Observers', value: 'observer' },
];

// Default participants filter is EMPTY = no constraint, every role (including
// chair) is visible on a fresh page load. Used to seed the participants filter
// and to detect the "default scope" for the Total stat tile — an empty role
// set here doubles as "no active filter" for activeFilterCount below.
const DEFAULT_ROLES: string[] = [];

/** Set equality for the small filter sets. */
function sameSet(a: Set<string>, b: string[]): boolean {
  return a.size === b.length && b.every(v => a.has(v));
}

const PAYMENT_OPTIONS = [
  { label: 'Paid', value: 'paid' },
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Waived', value: 'waived' },
];

// ── Filter panel ──────────────────────────────────────────────────────────────
// Peter: "the filters could be more of a hover and they appear". A single
// neumorphic FILTERS control reveals the whole rich set on hover (and can be
// pinned open with a click); empty selections mean "no constraint" so a fresh
// page shows everything.

interface FilterState {
  status: Set<string>;
  role: Set<string>;
  payment: Set<string>;
  dateFrom: string;
  dateTo: string;
}

function toggleIn(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

/** A small pressed-in checkbox chip inside the filter panel. */
function CheckChip({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 focus:outline-none"
      style={{
        padding: '5px 11px',
        borderRadius: 999,
        fontFamily: OUTFIT,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: checked ? '#FFFFFF' : NEU.ink,
        background: checked ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
        boxShadow: checked ? `0 3px 8px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : NEU.outSm,
        border: 'none',
        cursor: 'pointer',
        transition: `box-shadow 180ms ${EASE_LOCAL}`,
      }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 13, height: 13, borderRadius: 4,
          background: checked ? 'rgba(255,255,255,0.9)' : NEU.base,
          boxShadow: checked ? 'none' : NEU.inSm,
        }}
      >
        {checked && <Check size={10} strokeWidth={3.5} style={{ color: NEU.forest }} />}
      </span>
      {label}
    </button>
  );
}

const EASE_LOCAL = 'cubic-bezier(0.22,1,0.36,1)';

/** Emphasised group heading for the filter popover: a small leading lucide icon
 *  plus a slightly larger, bolder, inked label so each section reads as a proper
 *  heading rather than a faint caption. */
function FilterHeading({ icon, children }: { icon: LucideGlyph; children: React.ReactNode }) {
  const Icon = icon;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} strokeWidth={2.6} style={{ color: NEU.deepGold }} />
      <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 900, letterSpacing: '0.09em', color: NEU.ink, textTransform: 'uppercase' }}>
        {children}
      </span>
    </span>
  );
}

function FilterGroup({
  title, icon, options, selected, onToggle, onAll, onNone,
}: {
  title: string;
  icon: LucideGlyph;
  options: { label: string; value: string }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onAll: () => void;
  onNone: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <FilterHeading icon={icon}>{title}</FilterHeading>
        <div className="flex items-center gap-2">
          <button onClick={onAll} className="focus:outline-none" style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: NEU.forest, background: 'none', border: 'none', cursor: 'pointer' }}>ALL</button>
          <span style={{ color: NEU.muted, opacity: 0.5 }}>·</span>
          <button onClick={onNone} className="focus:outline-none" style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer' }}>NONE</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <CheckChip key={o.value} label={o.label} checked={selected.has(o.value)} onClick={() => onToggle(o.value)} />
        ))}
      </div>
    </div>
  );
}

function FilterPanel({
  filters, setFilters, activeCount,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = open || pinned;
  const clearTimer = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const scheduleClose = () => { clearTimer(); closeTimer.current = setTimeout(() => setOpen(false), 160); };

  return (
    <div
      className="relative"
      onMouseEnter={() => { clearTimer(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setPinned(p => !p)}
        className="inline-flex items-center gap-2 focus:outline-none"
        style={{
          padding: '9px 16px',
          borderRadius: 999,
          fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em',
          color: show ? '#FFFFFF' : NEU.ink,
          background: show ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
          boxShadow: show ? `0 4px 10px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : NEU.outSm,
          border: 'none', cursor: 'pointer',
          transition: `box-shadow 200ms ${EASE_LOCAL}`,
        }}
      >
        <SlidersHorizontal size={14} strokeWidth={2.5} />
        FILTERS
        {activeCount > 0 && (
          <span
            className="inline-flex items-center justify-center"
            style={{
              minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
              fontFamily: OUTFIT, fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
              color: show ? NEU.forest : '#FFFFFF',
              background: show ? NEU.gold : NEU.forest,
            }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {show && (
        <div
          className="absolute z-40"
          style={{
            top: 'calc(100% + 10px)', right: 0, left: 'auto',
            width: 'min(340px, calc(100vw - 40px))',
            maxHeight: 'calc(100vh - 150px)', overflowY: 'auto',
            backgroundColor: NEU.surface, borderRadius: 20, boxShadow: NEU.out,
            padding: 18,
            animation: `neuFadeIn 200ms ${EASE_LOCAL}`,
          }}
        >
          <style>{`@keyframes neuFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Filter} size={26} />
              <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 900, color: NEU.ink }}>Filter applications</p>
            </div>
            {activeCount > 0 && (
              <button
                onClick={() => setFilters({ status: new Set(), role: new Set(DEFAULT_ROLES), payment: new Set(), dateFrom: '', dateTo: '' })}
                className="focus:outline-none"
                style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: '#8B2020', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                CLEAR ALL
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <FilterGroup
              title="Status" icon={BadgeCheck} options={STATUS_OPTIONS} selected={filters.status}
              onToggle={v => setFilters(f => ({ ...f, status: toggleIn(f.status, v) }))}
              onAll={() => setFilters(f => ({ ...f, status: new Set(STATUS_OPTIONS.map(o => o.value)) }))}
              onNone={() => setFilters(f => ({ ...f, status: new Set() }))}
            />
            <FilterGroup
              title="Participants" icon={Users} options={ROLE_OPTIONS} selected={filters.role}
              onToggle={v => setFilters(f => ({ ...f, role: toggleIn(f.role, v) }))}
              onAll={() => setFilters(f => ({ ...f, role: new Set(ROLE_OPTIONS.map(o => o.value)) }))}
              onNone={() => setFilters(f => ({ ...f, role: new Set() }))}
            />
            <FilterGroup
              title="Payment" icon={Wallet} options={PAYMENT_OPTIONS} selected={filters.payment}
              onToggle={v => setFilters(f => ({ ...f, payment: toggleIn(f.payment, v) }))}
              onAll={() => setFilters(f => ({ ...f, payment: new Set(PAYMENT_OPTIONS.map(o => o.value)) }))}
              onNone={() => setFilters(f => ({ ...f, payment: new Set() }))}
            />
            <div>
              <div className="mb-2">
                <FilterHeading icon={CalendarDays}>Submitted between</FilterHeading>
              </div>
              <div className="flex items-center gap-2">
                <div style={{ flex: 1 }}>
                  <DatePicker
                    value={filters.dateFrom}
                    max={filters.dateTo || undefined}
                    onChange={iso => setFilters(f => ({ ...f, dateFrom: iso }))}
                    placeholder="From"
                  />
                </div>
                <ArrowRight size={13} style={{ color: NEU.muted, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <DatePicker
                    value={filters.dateTo}
                    min={filters.dateFrom || undefined}
                    onChange={iso => setFilters(f => ({ ...f, dateTo: iso }))}
                    placeholder="To"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ApplicationsPage ──────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  const paymentsLive = isPaymentsLive(conference?.id, conference?.connect_onboarding_status);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  // Empty role set = no constraint, so a fresh page shows every role
  // (including chairs) in both the row list and the stat scope.
  const [filters, setFilters] = useState<FilterState>({
    status: new Set(), role: new Set(DEFAULT_ROLES), payment: new Set(), dateFrom: '', dateTo: '',
  });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [roleConfigs, setRoleConfigs] = useState<RoleConfigLite[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  // Conferences done in any capacity, per user, count of their mun_cv_entries
  // rows (the same source profiles.mun_experience_level is derived from).
  const [cvCounts, setCvCounts] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState('');
  // Transient green confirmation (e.g. "Payment reminder sent"), auto-clears.
  const [flashMsg, setFlashMsg] = useState('');
  // Previewed applicant's MUN CV, fetched on demand when the review modal opens.
  const [previewCv, setPreviewCv] = useState<PreviewCvEntry[] | null>(null);
  const [previewCvLoading, setPreviewCvLoading] = useState(false);
  // App ids with a write in flight, double-click guard for row actions.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  // Multi-select for bulk actions. Ids are pruned to what's visible whenever
  // the filtered list changes, so a hidden row is never silently acted on.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();
  const { confirm, modal: confirmModal } = useConfirmModal();
  // Stale-response guard for background refetches.
  const loadSeq = useRef(0);
  // Committees for the inline quick-allocate picker (#7), loaded lazily the
  // first time a Plus popover opens. null = not yet fetched.
  const [allocCommittees, setAllocCommittees] = useState<QuickCommittee[] | null>(null);
  const [allocLoading, setAllocLoading] = useState(false);
  const allocLoadedRef = useRef(false);

  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  // `silent` refetches never touch the page-level loading flag, they
  // reconcile local optimistic state with what the server actually computed
  // (fillFreeSpots promotions, etc) without wiping the list.
  const loadApplications = useCallback(async (opts?: { silent?: boolean }) => {
    if (!conference) return;
    if (!session) return;
    const seq = ++loadSeq.current;
    if (!opts?.silent) setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [appRes, cfgRes] = await Promise.all([
      supabase
        .from('applications')
        .select(`
          id, user_id, invited_email, invited_name, role, status, is_head_delegate, experience_level,
          payment_status, submitted_at, checked_in_at, organizer_note, resubmitted_at, custom_answers,
          assigned_committee_id, assigned_country_code, assigned_country_name,
          self_paid, attending, pledge_type, spots_pledged, pledge_confirmed_at, society_id,
          assigned_committee:conference_committees!assigned_committee_id (name, abbreviation, topics, logo_url),
          profiles (display_name, email, avatar_url, nationality, date_of_birth, mun_experience_level),
          societies (name),
          application_preferences (
            preference_order, conference_committee_id, country_code, country_name,
            conference_committees (name, abbreviation, logo_url)
          )
        `)
        .eq('conference_id', conference.id)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('application_role_configs')
        .select('role, payment_timing, custom_questions, fee_amount, fee_currency, allow_resubmission')
        .eq('conference_id', conference.id),
    ]);

    if (seq !== loadSeq.current) return; // stale response, a newer load superseded this one

    const apps = (appRes.data ?? []) as unknown as Application[];
    setApplications(apps);
    setRoleConfigs((cfgRes.data ?? []) as unknown as RoleConfigLite[]);
    setLoading(false);

    // Batched MUN-history counts, ONE query for every visible applicant.
    const userIds = Array.from(new Set(apps.map(a => a.user_id).filter((id): id is string => !!id)));
    if (userIds.length > 0) {
      const { data: cvRows } = await supabase
        .from('mun_cv_entries')
        .select('user_id')
        .in('user_id', userIds);
      if (seq !== loadSeq.current) return;
      const counts: Record<string, number> = {};
      for (const row of (cvRows ?? []) as { user_id: string }[]) {
        counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
      }
      setCvCounts(counts);
    } else {
      setCvCounts({});
    }
  }, [conference, session?.access_token]);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  // Auto-clear the green confirmation flash.
  useEffect(() => {
    if (!flashMsg) return;
    const t = setTimeout(() => setFlashMsg(''), 4000);
    return () => clearTimeout(t);
  }, [flashMsg]);

  // Fetch the previewed applicant's MUN CV on demand (#13). Cleared + refetched
  // whenever the review target changes; skipped for unregistered rows.
  useEffect(() => {
    const app = applications.find(a => a.id === reviewId);
    const uid = app?.user_id;
    if (!reviewId || !uid || !session) { setPreviewCv(null); return; }
    let cancelled = false;
    setPreviewCv(null);
    setPreviewCvLoading(true);
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('mun_cv_entries')
        .select('id, entry_type, conference_name, committee, allocation, awards, award, logo_url, event_date, description')
        .eq('user_id', uid);
      if (cancelled) return;
      const rows = ((data ?? []) as PreviewCvEntry[]).slice().sort((a, b) => {
        const da = a.event_date ?? '';
        const db = b.event_date ?? '';
        return db.localeCompare(da);
      });
      setPreviewCv(rows);
      setPreviewCvLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId, session?.access_token]);

  // ── Quick-allocate committee load (#7) ──────────────────────────────────────
  // Lazy, once: fetched the first time an organiser opens a Plus popover. Pulls
  // each committee's country seats plus the country_codes already allocated, so
  // the picker only ever offers genuinely open seats.
  const loadAllocCommittees = useCallback(async () => {
    if (!conference || !session || allocLoadedRef.current) return;
    allocLoadedRef.current = true;
    setAllocLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select(`
        id, name, abbreviation, logo_url, topics,
        committee_country_slots (country_code, country_name),
        conference_allocations (country_code)
      `)
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });
    const mapped: QuickCommittee[] = ((data ?? []) as unknown as {
      id: string; name: string; abbreviation: string | null; logo_url: string | null; topics: string[] | null;
      committee_country_slots: { country_code: string; country_name: string }[] | null;
      conference_allocations: { country_code: string }[] | null;
    }[]).map(c => ({
      id: c.id,
      name: c.name,
      abbreviation: c.abbreviation,
      logo_url: c.logo_url,
      topics: c.topics,
      slots: c.committee_country_slots ?? [],
      takenCodes: (c.conference_allocations ?? []).map(a => a.country_code),
    }));
    setAllocCommittees(mapped);
    setAllocLoading(false);
  }, [conference, session?.access_token]);

  // Optimistic inline allocation: flip the row to 'assigned' with the chosen
  // committee/country immediately, mark that seat taken locally so a second
  // allocation this session can't reuse it, then write to
  // conference_allocations + applications. Exact rollback on any failure.
  function handleQuickAllocate(app: Application, committee: QuickCommittee, slot: { country_code: string; country_name: string }) {
    if (!session || !conference || busyIds.has(app.id)) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;
    if (!app.user_id) {
      setActionError('This applicant has not registered yet. Allocate them from the assignment board once they sign up.');
      return;
    }

    setActionError('');
    markBusy(app.id, true);
    applyRow(app.id, {
      status: 'assigned',
      assigned_committee_id: committee.id,
      assigned_country_code: slot.country_code,
      assigned_country_name: slot.country_name,
      assigned_committee: { name: committee.name, abbreviation: committee.abbreviation, topics: committee.topics, logo_url: committee.logo_url },
    });
    // Reserve the seat locally so it drops out of any picker opened next.
    setAllocCommittees(prev => prev
      ? prev.map(c => (c.id === committee.id ? { ...c, takenCodes: [...c.takenCodes, slot.country_code] } : c))
      : prev);

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      // Single write path mirrors the assignment board's insertAllocation.
      const { error: insErr } = await supabase.from('conference_allocations').insert({
        conference_id: conference.id,
        conference_committee_id: committee.id,
        user_id: app.user_id,
        country_code: slot.country_code,
        country_name: slot.country_name,
        application_id: app.id,
        allocation_sent: false,
      });
      if (insErr) throw insErr;
      const { error } = await supabase.from('applications').update({
        status: 'assigned',
        assigned_committee_id: committee.id,
        assigned_country_code: slot.country_code,
        assigned_country_name: slot.country_name,
      }).eq('id', app.id);
      if (error) throw error;
    })()
      .catch(() => {
        restoreRow(prevRow);
        setAllocCommittees(prev => prev
          ? prev.map(c => (c.id === committee.id ? { ...c, takenCodes: c.takenCodes.filter(code => code !== slot.country_code) } : c))
          : prev);
        setActionError('Could not allocate this delegate. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  // ── Optimistic row helpers ──────────────────────────────────────────────────
  // Patch one application in place (the UI updates instantly), and restore the
  // exact prior row on rollback, never the whole list, so concurrent actions
  // on other rows are untouched.
  function applyRow(appId: string, patch: Partial<Application>) {
    setApplications(cur => cur.map(a => (a.id === appId ? { ...a, ...patch } : a)));
  }
  function restoreRow(row: Application) {
    setApplications(cur => cur.map(a => (a.id === row.id ? row : a)));
  }

  function handleAccept(appId: string) {
    if (!session || !conference || busyIds.has(appId)) return;
    const prevRow = applications.find(a => a.id === appId);
    if (!prevRow) return;

    setActionError('');
    markBusy(appId, true);
    // Optimistic: the card flips to ACCEPTED immediately.
    applyRow(appId, { status: 'accepted' });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ status: 'accepted' }).eq('id', appId);
      if (error) throw error;

      // Secondary effects, a failure here must NOT roll back the accept.
      try {
        const result = await queueEventEmail(supabase, conference.id, 'application_accepted', [appId]);
        notifyIfNeeded(result, pushDraftNotice);
        // Consolidation: application_accepted wins over payment_available.
        // payment_available only sends alone for this person when acceptance
        // actually resolved to nothing (off/unconfigured) for them.
        const acceptedIds = new Set(result.queuedApplicationIds ?? []);

        const roleConfig = roleConfigs.find(rc => rc.role === prevRow.role);
        if (roleConfig?.payment_timing === 'after_acceptance') {
          const payResult = await queueEventEmail(supabase, conference.id, 'payment_available', [appId], undefined, { suppressIds: acceptedIds });
          notifyIfNeeded(payResult, pushDraftNotice);
        }

        // F13: acceptance is when auto-cover runs, newly accepted pool members
        // absorb any free delegation-purchased spots, oldest-first. The fill
        // helper emails spot_received for whoever it covers, suppressing the
        // just-accepted person's own id so they don't get that on top of
        // application_accepted (rule one wins) if the same action covers them.
        const pool = poolForRole(prevRow.role);
        if (prevRow.society_id && pool) {
          await fillFreeSpots(supabase, conference.id, prevRow.society_id, pool, { suppressIds: acceptedIds });
        }
      } catch {
        setActionError('Accepted, but a follow-up step (email / auto-cover) failed. Refresh to verify.');
      }

      // Auto-cover may have promoted OTHER members to paid, reconcile silently.
      await loadApplications({ silent: true });
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not accept the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  function handleReject(appId: string) {
    if (!session || !conference || busyIds.has(appId)) return;
    const prevRow = applications.find(a => a.id === appId);
    if (!prevRow) return;
    const pool = poolForRole(prevRow.role);
    // F13: rejecting a pool-covered (not self-paid) paid member releases
    // their spot back to the delegation, it stays purchased, just open again.
    const releasesSpot = prevRow.payment_status === 'paid' && !prevRow.self_paid && !!prevRow.society_id && !!pool;

    const updates: { status: string; organizer_note: string | null; payment_status?: string } = {
      status: 'rejected',
      organizer_note: rejectNote.trim() || null,
    };
    if (releasesSpot) updates.payment_status = 'unpaid';

    setActionError('');
    markBusy(appId, true);
    // Optimistic: badge flips to REJECTED, reject UI closes instantly.
    applyRow(appId, updates as Partial<Application>);
    setRejectingId(null);
    setRejectNote('');

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update(updates).eq('id', appId);
      if (error) throw error;

      try {
        const result = await queueEventEmail(supabase, conference.id, 'application_rejected', [appId]);
        notifyIfNeeded(result, pushDraftNotice);
      } catch {
        setActionError('Rejected, but the rejection email could not be queued.');
      }

      // Refund whatever credit the applicant spent, if any — a benign
      // {refunded:false} just means there was nothing to refund (e.g. they
      // still have another live application holding the credit).
      try {
        const freshSupabase = await getFreshAuthedClient();
        if (freshSupabase) {
          await freshSupabase.rpc('refund_credit_for_application', { p_application_id: appId });
        }
      } catch {
        setActionError('Rejected, but the credit refund could not be confirmed. Refresh to verify.');
      }
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not reject the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  async function openRejectConfirm(app: Application) {
    const pool = poolForRole(app.role);
    const releasesSpot = app.payment_status === 'paid' && !app.self_paid && !!app.society_id && !!pool;
    const { confirmed } = await confirm({
      title: 'Reject this application?',
      body: releasesSpot
        ? "Their payment used a delegation-purchased spot. Rejecting will release that spot back to the delegation as open."
        : "This rejects the application. You can reinstate it later if needed.",
      confirmLabel: 'Reject',
      danger: true,
    });
    if (!confirmed) return;
    handleReject(app.id);
  }

  function handleReinstate(appId: string) {
    if (!session || busyIds.has(appId)) return;
    const prevRow = applications.find(a => a.id === appId);
    if (!prevRow) return;

    setActionError('');
    markBusy(appId, true);
    applyRow(appId, { status: 'submitted', organizer_note: null });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ status: 'submitted', organizer_note: null }).eq('id', appId);
      if (error) throw error;
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not reinstate the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  // ── Withdraw from conference (accepted/assigned, unpaid or waived only) ────
  // Paid applications render this action disabled: refunds come with
  // finances, so payment must be handled first (Danger ConfirmModal spells
  // this out; the button itself is also disabled, see the review modal JSX).

  async function openWithdrawConfirm(app: Application) {
    const pool = poolForRole(app.role);
    const hasAllocation = !!app.assigned_committee_id;
    const inDelegation = !!app.society_id;
    const selfFundedPaidSpot = app.payment_status === 'paid' && !!app.self_paid;
    const parts: string[] = [];
    if (hasAllocation) parts.push('Their committee allocation will be removed.');
    if (inDelegation && pool) {
      parts.push(
        selfFundedPaidSpot
          ? "Their paid spot was self-funded, so it leaves with them: the delegation's purchased-spots count goes down by one."
          : app.payment_status === 'paid'
          ? "Their spot was covered by the delegation's purchased spots, so it stays behind: it will show as open."
          : 'They will leave their delegation.'
      );
    }
    if (app.role === 'chair') parts.push('If they chair a committee, they will be removed from its dais.');
    parts.push('This cannot be undone from here. Reinstating only restores their application to Accepted, nothing else.');

    const { confirmed } = await confirm({
      title: 'Remove from conference?',
      body: parts.join(' '),
      confirmLabel: 'Withdraw',
      danger: true,
    });
    if (!confirmed) return;
    handleWithdraw(app.id);
  }

  function handleWithdraw(appId: string) {
    if (!session || !conference || busyIds.has(appId)) return;
    const prevRow = applications.find(a => a.id === appId);
    if (!prevRow) return;

    setActionError('');
    markBusy(appId, true);
    // Optimistic: the card flips to WITHDRAWN immediately.
    applyRow(appId, {
      status: 'withdrawn',
      assigned_committee_id: null,
      assigned_country_code: null,
      assigned_country_name: null,
      society_id: null,
    });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { dropToUnpaid, error: releaseError } = await releasePoolSpot(supabase, prevRow);
      if (releaseError) throw new Error(releaseError);

      const updates: Record<string, unknown> = {
        status: 'withdrawn',
        assigned_committee_id: null,
        assigned_country_code: null,
        assigned_country_name: null,
        society_id: null,
      };
      if (dropToUnpaid) updates.payment_status = 'unpaid';

      const { error } = await supabase.from('applications').update(updates).eq('id', appId);
      if (error) throw error;

      if (prevRow.assigned_committee_id) {
        await supabase.from('conference_allocations').delete().eq('application_id', appId);
      }

      // If they chair any committee, drop them from its dais: mirrors
      // committees/page.tsx & assignment/page.tsx's handleRemoveChair.
      if (prevRow.role === 'chair' && prevRow.user_id) {
        const { data: chaired } = await supabase
          .from('conference_committees')
          .select('id, chair_user_ids')
          .eq('conference_id', conference.id)
          .contains('chair_user_ids', [prevRow.user_id]);
        for (const c of (chaired ?? []) as { id: string; chair_user_ids: string[] | null }[]) {
          const nextIds = (c.chair_user_ids ?? []).filter(id => id !== prevRow.user_id);
          await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', c.id);
        }
      }

      // Refund whatever credit the applicant spent, if any — same benign
      // {refunded:false} handling as reject.
      try {
        const freshSupabase = await getFreshAuthedClient();
        if (freshSupabase) {
          await freshSupabase.rpc('refund_credit_for_application', { p_application_id: appId });
        }
      } catch {
        setActionError('Withdrawn, but the credit refund could not be confirmed. Refresh to verify.');
      }
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not withdraw the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  function handleReinstateFromWithdrawn(appId: string) {
    if (!session || busyIds.has(appId)) return;
    const prevRow = applications.find(a => a.id === appId);
    if (!prevRow) return;

    setActionError('');
    markBusy(appId, true);
    // Only the status is restored: nothing else (allocation, delegation,
    // dais seat) comes back automatically.
    applyRow(appId, { status: 'accepted' });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ status: 'accepted' }).eq('id', appId);
      if (error) throw error;
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not reinstate the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  // ── Delete row (imported/unregistered applicants only) ─────────────────────
  // No account exists for these rows (user_id null, invited_* carries the
  // data), so a hard delete is safe: nothing else references them. Distinct
  // from withdraw, which is for real users and preserves their history.
  async function openDeleteRowConfirm(app: Application) {
    const { confirmed } = await confirm({
      title: 'Delete this application?',
      body: "This applicant never created a Gavelling account, so nothing else is affected. Their application and any committee allocation are permanently deleted. This can't be undone.",
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    handleDeleteRow(app.id);
  }

  function handleDeleteRow(appId: string) {
    if (!session || busyIds.has(appId)) return;
    const prevIndex = applications.findIndex(a => a.id === appId);
    const prevRow = applications[prevIndex];
    if (!prevRow) return;

    setActionError('');
    markBusy(appId, true);
    // Optimistic: the row disappears immediately.
    setApplications(cur => cur.filter(a => a.id !== appId));
    setReviewId(cur => (cur === appId ? null : cur));

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      await supabase.from('conference_allocations').delete().eq('application_id', appId);
      const { error } = await supabase.from('applications').delete().eq('id', appId);
      if (error) throw error;
    })()
      .catch(() => {
        setApplications(cur => {
          if (cur.some(a => a.id === appId)) return cur;
          const next = [...cur];
          next.splice(Math.min(prevIndex, next.length), 0, prevRow);
          return next;
        });
        setActionError('Could not delete the application. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  function handleMarkPaid(app: Application) {
    if (!session || !conference || busyIds.has(app.id) || paymentsLive) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;

    setActionError('');
    markBusy(app.id, true);
    // Optimistic: the PAID badge appears immediately.
    applyRow(app.id, { payment_status: 'paid', self_paid: true });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ payment_status: 'paid', self_paid: true }).eq('id', app.id);
      if (error) throw error;

      // Secondary effects, a failure here must NOT roll back the payment mark.
      try {
        const pool = poolForRole(app.role);
        if (app.society_id && pool) {
          const spotsColumn = POOL_SPOTS_COLUMN[pool];
          const { data: soc } = await supabase.from('societies').select(spotsColumn).eq('id', app.society_id).single();
          const current = (soc as Record<string, number> | null)?.[spotsColumn] ?? 0;
          await supabase.from('societies').update({ [spotsColumn]: current + 1 }).eq('id', app.society_id);
          await fillFreeSpots(supabase, conference.id, app.society_id, pool);
        }

        const result = await queueEventEmail(supabase, conference.id, 'payment_received', [app.id]);
        notifyIfNeeded(result, pushDraftNotice);
      } catch {
        setActionError('Marked paid, but a follow-up step (spot update / email) failed. Refresh to verify.');
      }

      // fillFreeSpots may have promoted OTHER members to paid, reconcile silently.
      await loadApplications({ silent: true });
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not mark the application paid. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  async function handleMarkUnpaid(app: Application) {
    if (!session || busyIds.has(app.id) || paymentsLive) return;
    const { confirmed } = await confirm({
      title: 'Mark this application unpaid?',
      body: 'If their payment opened a delegation spot, one spot will be removed.',
      confirmLabel: 'Mark Unpaid',
      danger: true,
    });
    if (!confirmed) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;

    setActionError('');
    markBusy(app.id, true);
    applyRow(app.id, { payment_status: 'unpaid', self_paid: false });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ payment_status: 'unpaid', self_paid: false }).eq('id', app.id);
      if (error) throw error;

      try {
        const pool = poolForRole(app.role);
        if (app.society_id && pool) {
          const spotsColumn = POOL_SPOTS_COLUMN[pool];
          const { data: soc } = await supabase.from('societies').select(spotsColumn).eq('id', app.society_id).single();
          const current = (soc as Record<string, number> | null)?.[spotsColumn] ?? 0;
          await supabase.from('societies').update({ [spotsColumn]: Math.max(0, current - 1) }).eq('id', app.society_id);
        }
      } catch {
        setActionError('Marked unpaid, but the delegation spot count could not be updated. Refresh to verify.');
      }
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not mark the application unpaid. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  // Re-send the pay-now email as a reminder (#8). payment_available IS the
  // "you can pay now" email, so re-queuing it reads to the applicant as a
  // reminder. Optimistic feedback via the green flash; no row state changes.
  function handleRemindPay(app: Application) {
    if (!session || !conference || busyIds.has(app.id)) return;
    const name = app.profiles?.display_name ?? app.invited_name ?? 'the applicant';
    setActionError('');
    markBusy(app.id, true);
    setFlashMsg(`Payment reminder sent to ${name}.`);

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const result = await queueEventEmail(supabase, conference.id, 'payment_available', [app.id]);
      notifyIfNeeded(result, pushDraftNotice);
    })()
      .catch(() => {
        setFlashMsg('');
        setActionError('Could not send the payment reminder. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  async function handleUndoWaive(app: Application) {
    if (!session || busyIds.has(app.id)) return;
    const { confirmed } = await confirm({
      title: 'Remove this fee waiver?',
      body: 'They will owe payment again.',
      confirmLabel: 'Remove Waiver',
      danger: true,
    });
    if (!confirmed) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;

    setActionError('');
    markBusy(app.id, true);
    applyRow(app.id, { payment_status: 'unpaid' });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ payment_status: 'unpaid' }).eq('id', app.id);
      if (error) throw error;
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not remove the waiver. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  // ── Check-in (on-site attendance) ──────────────────────────────────────────
  // Optimistic like every other row action: flip to 'checked-in' immediately,
  // write via the shared checkIn helper, exact rollback on error. checked_in_at
  // is set to a client timestamp for the instant "Checked in …" line; the
  // helper computes its own server-side value, close enough for display.
  function handleCheckIn(app: Application) {
    if (!session || busyIds.has(app.id)) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;

    setActionError('');
    markBusy(app.id, true);
    applyRow(app.id, { status: 'checked-in', checked_in_at: new Date().toISOString() });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await checkInApplication(supabase, app.id);
      if (error) throw new Error(error);
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not check in that attendee. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  function handleUndoCheckIn(app: Application) {
    if (!session || busyIds.has(app.id)) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;
    // Restore whichever state they were in before arriving: assigned when they
    // hold a committee allocation, otherwise accepted.
    const revertTo: 'assigned' | 'accepted' = app.assigned_committee_id ? 'assigned' : 'accepted';

    setActionError('');
    markBusy(app.id, true);
    applyRow(app.id, { status: revertTo, checked_in_at: null });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await undoCheckIn(supabase, app.id, revertTo);
      if (error) throw new Error(error);
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not undo that check-in. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  // ── Multi-select + bulk actions ───────────────────────────────────────────
  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  // Bulk actions loop the single-row optimistic handlers, so every row keeps
  // its own optimistic patch + rollback + busy guard. We confirm once up front
  // (count spelled out) then fan out over the eligible rows only.
  async function runBulk(
    apps: Application[],
    opts: { title: string; body: string; confirmLabel: string; danger?: boolean },
    run: (app: Application) => void,
  ) {
    if (apps.length === 0) return;
    const { confirmed } = await confirm(opts);
    if (!confirmed) return;
    apps.forEach(run);
    clearSelection();
  }

  function handleExportCSV() {
    const headers = ['Name', 'Email', 'Age', 'Nationality', 'Role', 'Status', 'Payment', 'Experience', 'Society', 'Head Delegate', 'Submitted', 'Checked In', 'Assigned Committee', 'Assigned Country'];
    const rows = applications.map(a => [
      a.profiles?.display_name ?? a.invited_name ?? '',
      a.profiles?.email ?? a.invited_email ?? '',
      ageAt(a.profiles?.date_of_birth) ?? '',
      a.profiles?.nationality ?? '',
      roleLabel(a.role),
      a.status,
      a.payment_status ?? '',
      a.experience_level ?? '',
      a.societies?.name ?? '',
      a.is_head_delegate ? 'Yes' : 'No',
      a.submitted_at ? formatDate(a.submitted_at) : '',
      a.checked_in_at ? formatDate(a.checked_in_at) : '',
      a.assigned_committee?.name ?? '',
      a.assigned_country_name ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conference?.acronym ?? 'applications'}-applications.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!conference) return null;

  // Empty selection = no constraint on that dimension (fresh page shows all).
  const filtered = applications.filter(a => {
    if (filters.status.size > 0 && !filters.status.has(a.status)) return false;
    if (filters.role.size > 0 && !filters.role.has(a.role)) return false;
    if (filters.payment.size > 0) {
      const ps = a.payment_status;
      const match =
        (filters.payment.has('paid') && ps === 'paid') ||
        (filters.payment.has('waived') && ps === 'waived') ||
        (filters.payment.has('unpaid') && (ps === 'unpaid' || ps == null));
      if (!match) return false;
    }
    if (filters.dateFrom && a.submitted_at && a.submitted_at.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && a.submitted_at && a.submitted_at.slice(0, 10) > filters.dateTo) return false;
    return true;
  })
    // Default order = latest applications first. The DB fetch already orders by
    // submitted_at desc; this keeps that guarantee after any optimistic in-place
    // patching so the visible default always matches "newest first".
    .sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? ''));

  const activeFilterCount =
    (filters.status.size > 0 ? 1 : 0) +
    // DEFAULT_ROLES is empty, so any non-empty role selection counts as active.
    (!sameSet(filters.role, DEFAULT_ROLES) ? 1 : 0) +
    (filters.payment.size > 0 ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0);

  // ── Selection-derived values for the bulk-action bar ──────────────────────
  // Act only on rows that are both selected AND currently visible, so a filter
  // change can never cause a hidden row to be swept up in a bulk action.
  const selectedApps = filtered.filter(a => selectedIds.has(a.id));
  const allVisibleSelected = filtered.length > 0 && filtered.every(a => selectedIds.has(a.id));
  // Chairs are always free, so bulk mark-paid / waive skip them entirely (#5).
  // When Stripe checkout is live for this conference, manual mark-paid is not
  // offered at all (bulk or single) — checkout + webhook own that state.
  const payEligible = (a: Application) =>
    !paymentsLive
    && a.role !== 'chair'
    && (a.status === 'accepted' || a.status === 'assigned' || a.status === 'submitted' || a.status === 'checked-in')
    && a.payment_status !== 'paid' && a.payment_status !== 'waived';
  const bulkAcceptable = selectedApps.filter(a => a.status === 'submitted');
  const bulkRejectable = selectedApps.filter(a => a.status === 'submitted' || a.status === 'accepted');
  const bulkCheckInable = selectedApps.filter(a => a.status === 'accepted' || a.status === 'assigned');
  const bulkPayable = selectedApps.filter(payEligible);
  // Suggested action from the selection composition. Starts pulsing the moment a
  // selection is made, nudging the organiser toward the obvious next step.
  const suggestion: 'accept' | 'pay' | 'checkin' | null =
    selectedApps.length === 0 ? null
    : selectedApps.every(a => a.status === 'submitted') ? 'accept'
    : selectedApps.every(a => (a.status === 'accepted' || a.status === 'assigned') && payEligible(a)) ? 'pay'
    : selectedApps.every(a => a.status === 'accepted' || a.status === 'assigned') ? 'checkin'
    : null;

  // Stat tiles count over the SAME population the list shows by role/date/aid
  // (all roles by default, #10) but ignore the status / payment dimensions —
  // those are exactly what the tiles let you click into.
  const statScope = applications.filter(a => {
    if (filters.role.size > 0 && !filters.role.has(a.role)) return false;
    if (filters.dateFrom && a.submitted_at && a.submitted_at.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && a.submitted_at && a.submitted_at.slice(0, 10) > filters.dateTo) return false;
    return true;
  });
  const stats = {
    total: statScope.length,
    accepted: statScope.filter(a => a.status === 'accepted').length,
    assigned: statScope.filter(a => a.status === 'assigned').length,
    checkedIn: statScope.filter(a => a.status === 'checked-in').length,
    paid: statScope.filter(a => a.payment_status === 'paid').length,
    // Unpaid excludes chairs (always free, never owe a fee).
    unpaid: statScope.filter(a => a.role !== 'chair' && (a.payment_status == null || a.payment_status === 'unpaid')).length,
  };

  // Clickable stat-tile filters (#10). Status tiles clear payment and vice
  // versa; clicking the active tile again clears it. Total resets to default.
  const statusTileActive = (v: string) => filters.status.size === 1 && filters.status.has(v) && filters.payment.size === 0;
  const paymentTileActive = (v: string) => filters.payment.size === 1 && filters.payment.has(v) && filters.status.size === 0;
  const totalTileActive =
    filters.status.size === 0 && filters.payment.size === 0 &&
    !filters.dateFrom && !filters.dateTo && sameSet(filters.role, DEFAULT_ROLES);
  const clearToDefault = () => setFilters({ status: new Set(), role: new Set(DEFAULT_ROLES), payment: new Set(), dateFrom: '', dateTo: '' });
  const toggleStatusTile = (v: string) => setFilters(f => ({ ...f, payment: new Set(), status: (f.status.size === 1 && f.status.has(v)) ? new Set() : new Set([v]) }));
  const togglePaymentTile = (v: string) => setFilters(f => ({ ...f, status: new Set(), payment: (f.payment.size === 1 && f.payment.has(v)) ? new Set() : new Set([v]) }));

  // Order (#10): Total, Accepted, Assigned, Paid, Unpaid, Checked in — Checked
  // in rightmost. Every tile applies its matching filter on click.
  const statItems: { label: string; value: number; emoji: string; icon: typeof Inbox; gradient: [string, string]; active: boolean; onClick: () => void }[] = [
    { label: 'Total',      value: stats.total,     emoji: 'Card index',          icon: Users,          gradient: NEU_GRADIENTS.forest, active: totalTileActive,           onClick: clearToDefault },
    { label: 'Accepted',   value: stats.accepted,  emoji: 'Check mark button',   icon: Check,          gradient: NEU_GRADIENTS.green,  active: statusTileActive('accepted'),   onClick: () => toggleStatusTile('accepted') },
    { label: 'Assigned',   value: stats.assigned,  emoji: 'Round pushpin',       icon: BadgeCheck,     gradient: NEU_GRADIENTS.gold,   active: statusTileActive('assigned'),   onClick: () => toggleStatusTile('assigned') },
    { label: 'Paid',       value: stats.paid,      emoji: 'Money bag',           icon: CircleCheck,    gradient: NEU_GRADIENTS.green,  active: paymentTileActive('paid'),      onClick: () => togglePaymentTile('paid') },
    { label: 'Unpaid',     value: stats.unpaid,    emoji: 'Hourglass not done',  icon: Clock,          gradient: NEU_GRADIENTS.amber,  active: paymentTileActive('unpaid'),    onClick: () => togglePaymentTile('unpaid') },
    { label: 'Checked in', value: stats.checkedIn, emoji: 'Person raising hand', icon: UserRoundCheck, gradient: NEU_GRADIENTS.sage,   active: statusTileActive('checked-in'), onClick: () => toggleStatusTile('checked-in') },
  ];

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-3.5">
          {/* Gavel emblem moved off the header (#4) — it now marks chair rows.
              A neutral applications icon disc anchors the title instead. */}
          <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Inbox} emoji="Card index" size={46} />
          <div>
            <p className="mb-1" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: NEU.deepGold, textTransform: 'uppercase' }}>
              {conference.acronym} · Applications
            </p>
            <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 26, color: NEU.ink, letterSpacing: '-0.01em' }}>Applications</h1>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <FilterPanel filters={filters} setFilters={setFilters} activeCount={activeFilterCount} />
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 focus:outline-none"
            style={{
              padding: '9px 16px', borderRadius: 999,
              fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em',
              color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: 'pointer',
            }}
          >
            <Download size={14} strokeWidth={2.5} />
            EXPORT CSV
          </button>
        </div>
      </div>

      <DraftNoticeList
        notices={draftNotices}
        conferenceSlug={conference.slug}
        onDismiss={dismissDraftNotice}
        onTurnOn={async (eventKey) => {
          if (!session) return;
          const supabase = getAuthedClient(session.access_token);
          await turnOnDefaultEmail(supabase, conference.id, eventKey);
        }}
      />

      {actionError && (
        <p className="text-xs font-semibold mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
          {actionError}
        </p>
      )}
      {flashMsg && (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold mb-3" style={{ color: '#2A5A3C', fontFamily: OUTFIT }}>
          <CircleCheck size={13} strokeWidth={2.6} />
          {flashMsg}
        </p>
      )}

      {/* Stat tiles — compact, six clickable filters (#10). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {statItems.map(s => (
          <NeuStatTile key={s.label} emoji={s.emoji} icon={s.icon} gradient={s.gradient} value={s.value} label={s.label} compact onClick={s.onClick} active={s.active} />
        ))}
      </div>

      {/* Visible reminder that a filter is narrowing the list — a role/status/
          payment/date filter can never silently hide rows again. */}
      {!loading && filtered.length < applications.length && (
        <p className="mb-3" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.muted }}>
          Showing {filtered.length} of {applications.length} — filters active
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <NeuCard style={{ padding: '48px 24px' }}>
          <div className="flex flex-col items-center text-center">
            <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Inbox} emoji="Inbox tray" size={48} />
            <p className="mt-4" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>
              {applications.length === 0 ? 'No applications yet' : 'No applications match these filters'}
            </p>
            <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
              {applications.length === 0 ? 'Applications will appear here once delegates apply.' : 'Try adjusting your filters.'}
            </p>
          </div>
        </NeuCard>
      )}

      {/* Select-all bar */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <SelectBox
            checked={allVisibleSelected}
            indeterminate={!allVisibleSelected && selectedApps.length > 0}
            title={allVisibleSelected ? 'Deselect all' : 'Select all'}
            onClick={() => setSelectedIds(prev => {
              const next = new Set(prev);
              if (allVisibleSelected) filtered.forEach(a => next.delete(a.id));
              else filtered.forEach(a => next.add(a.id));
              return next;
            })}
          />
          <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
            {selectedApps.length > 0 ? `${selectedApps.length} selected` : `Select all (${filtered.length})`}
          </span>
        </div>
      )}

      {/* Application list */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3" style={{ paddingBottom: selectedApps.length > 0 ? 96 : 0 }}>
          {filtered.map(app => {
            const name = app.profiles?.display_name ?? app.invited_name ?? 'Unknown';
            const email = app.profiles?.email ?? app.invited_email ?? '';
            const isDelegate = app.role === 'delegate' || app.role === 'head-delegate';
            const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);

            // No recorded level → treat as the lowest tier "beginner" (#11).
            const expLabel = app.profiles?.mun_experience_level ?? app.experience_level ?? 'beginner';
            const confCount = app.user_id ? cvCounts[app.user_id] : undefined;
            const rowQuestions = normalizeQuestions(roleConfigs.find(rc => rc.role === app.role)?.custom_questions ?? []);
            const age = ageForApp(app, rowQuestions);
            const nationality = app.profiles?.nationality ?? null;
            const natCode = resolveRealCountryCode(nationality);
            const selected = selectedIds.has(app.id);

            const pledgeLine = app.pledge_type === 'delegation'
              ? `Pledged ${app.spots_pledged ?? 0} delegation spots`
              : null;
            const rowBusy = busyIds.has(app.id);
            const busyStyle: React.CSSProperties = rowBusy ? { opacity: 0.5, pointerEvents: 'none' } : {};
            const hasAllocation = !!app.assigned_committee && (app.status === 'assigned' || app.status === 'checked-in');
            const canCheckIn = app.status === 'accepted' || app.status === 'assigned';
            const isSubmitted = app.status === 'submitted';
            // Chairs are always free — never any payment affordance (#5).
            const isChair = app.role === 'chair';
            const showPayControl = !isChair && (app.status === 'accepted' || app.status === 'assigned' || app.status === 'submitted' || app.status === 'checked-in');

            const factStyle: React.CSSProperties = {
              fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: NEU.muted,
              fontVariantNumeric: 'tabular-nums',
            };
            const chip = (bg: string, color: string, border: string): React.CSSProperties => ({
              fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em',
              padding: '3px 9px', borderRadius: 999, backgroundColor: bg, color, border: `1px solid ${border}`,
              whiteSpace: 'nowrap',
            });

            return (
              <NeuCard
                key={app.id}
                hover
                style={{ padding: 0, overflow: 'hidden', position: 'relative', outline: selected ? `2px solid ${NEU.forest}` : 'none', outlineOffset: -2 }}
              >
                <div className="flex flex-col lg:flex-row lg:items-stretch">

                  {/* LEFT · select + identity + facts */}
                  <div className="flex items-start gap-3 p-4 lg:p-5" style={{ flex: '1.1 1 320px', minWidth: 0 }}>
                    <div className="pt-1"><SelectBox checked={selected} onClick={() => toggleSelected(app.id)} title={selected ? 'Deselect' : 'Select'} /></div>
                    {/* Bigger avatar (#3) with the applicant's nationality flag
                        tucked into its bottom-right, slightly overlapping (#4). */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <MemberAvatar name={name} url={app.profiles?.avatar_url ?? null} size={62} />
                      {natCode && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={getFlagUrl(natCode)}
                          alt={nationality ?? ''}
                          title={nationality ?? ''}
                          draggable={false}
                          style={{ position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: 9999, objectFit: 'cover', boxShadow: '0 1px 3px rgba(27,56,40,0.25)', border: `2px solid ${NEU.surface}` }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 19.5, fontWeight: 800, color: NEU.ink, maxWidth: '100%', letterSpacing: '-0.01em' }}>{name}</p>
                        {!app.user_id && <NotRegisteredChip />}
                        {app.is_head_delegate && (
                          <span className="inline-flex items-center gap-1" style={chip('rgba(27,56,40,0.1)', NEU.forest, 'rgba(27,56,40,0.2)')}>
                            <Users size={9} strokeWidth={2.5} />
                            HEAD DEL.
                          </span>
                        )}
                      </div>
                      {email && <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.muted, marginTop: 2, fontWeight: 500 }}>{email}</p>}

                      {app.societies?.name && (
                        <p className="flex items-center gap-1.5 truncate" style={{ marginTop: 5, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: NEU.ink }} title={app.societies.name}>
                          <Building2 size={15} strokeWidth={2.4} style={{ color: NEU.deepGold, flexShrink: 0 }} />
                          <span className="truncate">{app.societies.name}</span>
                        </p>
                      )}

                      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-2.5">
                        {age !== null && (
                          <span className="inline-flex items-center gap-1.5" style={factStyle}>
                            <Cake size={13} strokeWidth={2.2} style={{ color: NEU.deepGold }} />
                            {age} yrs old
                          </span>
                        )}
                        {nationality && (
                          <span className="inline-flex items-center gap-1.5" style={factStyle} title={nationality}>
                            <CountryFlag name={nationality} size={15} />
                            <span className="truncate" style={{ maxWidth: 140 }}>{nationality}</span>
                          </span>
                        )}
                      </div>

                      {pledgeLine && (
                        <div className="flex flex-wrap gap-2 mt-2.5 items-center">
                          <span className="inline-flex items-center gap-1.5" style={{ ...chip('rgba(27,56,40,0.06)', NEU.forest, 'rgba(27,56,40,0.14)'), fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>
                            <HandCoins size={11} strokeWidth={2.5} />
                            {pledgeLine}{app.pledge_confirmed_at ? ' · received' : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Identity stack: ROLE on top, MUN level beneath it (#5).
                        The chair gavel now lives inside the CHAIR pill itself
                        (#1), so no separate emblem sits here. */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <RolePill role={app.role} size="sm" />
                      <LevelBadge level={expLabel} count={confCount} />
                    </div>
                  </div>

                  {/* MIDDLE · allocation / preferences — the focal point of the
                      row now the role has moved to the identity column (#6). */}
                  <div
                    className="p-4 lg:p-5 flex flex-col justify-center gap-3 border-t lg:border-t-0 lg:border-l"
                    style={{ flex: '1 1 260px', minWidth: 0, borderColor: 'rgba(221,212,192,0.6)' }}
                  >
                    {hasAllocation ? (() => {
                      // Naming rule (#6): long committee name → big ACRONYM with
                      // the full name small beneath it.
                      const disp = committeeDisplay(app.assigned_committee);
                      return (
                      <div className="flex items-center gap-4 min-w-0">
                        <LogoDisc src={app.assigned_committee!.logo_url} size={92} fallbackText={committeeAbbr(app.assigned_committee)} alt={app.assigned_committee!.name} />
                        <div className="min-w-0">
                          <p className="truncate" title={committeeFull(app.assigned_committee)} style={{ fontFamily: OUTFIT, fontSize: 27, fontWeight: 900, color: NEU.ink, letterSpacing: '-0.01em', lineHeight: 1.05 }}>
                            {disp.primary}
                          </p>
                          {disp.secondary && (
                            <p className="truncate" title={disp.secondary} style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.muted, marginTop: 2 }}>
                              {disp.secondary}
                            </p>
                          )}
                          {app.assigned_country_name && (
                            <span className="inline-flex items-center gap-3 mt-2" style={{ fontFamily: OUTFIT, fontSize: 22, fontWeight: 800, color: NEU.ink }}>
                              <CountryFlag name={app.assigned_country_name} code={app.assigned_country_code} size={40} />
                              {app.assigned_country_name}
                            </span>
                          )}
                        </div>
                      </div>
                      );
                    })() : isDelegate && prefs.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <p style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted, textTransform: 'uppercase' }}>Preferences</p>
                          <QuickAllocate committees={allocCommittees} loading={allocLoading} onOpen={loadAllocCommittees} onAllocate={(c, s) => handleQuickAllocate(app, c, s)} />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {prefs.slice(0, 3).map(p => (
                            <span
                              key={p.preference_order}
                              className="inline-flex items-center gap-1.5"
                              title={`${p.conference_committees?.name ?? 'Unknown'} · ${p.country_name}`}
                              style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, backgroundColor: NEU.base, boxShadow: NEU.inSm, borderRadius: 999, padding: '4px 10px', fontVariantNumeric: 'tabular-nums' }}
                            >
                              <span style={{ color: NEU.muted }}>{p.preference_order}.</span>
                              {committeeAbbr(p.conference_committees)}
                              <CountryFlag name={p.country_name} code={p.country_code} size={15} />
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : isDelegate ? (
                      <span className="inline-flex items-center gap-2">
                        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontStyle: 'italic', color: NEU.muted }}>Not yet assigned</span>
                        <QuickAllocate committees={allocCommittees} loading={allocLoading} onOpen={loadAllocCommittees} onAllocate={(c, s) => handleQuickAllocate(app, c, s)} />
                      </span>
                    ) : (
                      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontStyle: 'italic', color: NEU.muted }}>—</span>
                    )}

                    {app.status === 'rejected' && app.organizer_note && (
                      <span className="truncate" title={app.organizer_note} style={{ fontFamily: OUTFIT, fontSize: 12, fontStyle: 'italic', color: NEU.muted }}>
                        &ldquo;{app.organizer_note}&rdquo;
                      </span>
                    )}
                  </div>

                  {/* RIGHT · status/payment + actions */}
                  <div
                    className="p-4 lg:p-5 flex flex-col lg:items-end gap-2.5 justify-center border-t lg:border-t-0 lg:border-l"
                    style={{ flex: '0 0 auto', minWidth: 200, borderColor: 'rgba(221,212,192,0.6)' }}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
                      <StatusPill status={app.status} />
                      {app.resubmitted_at && (
                        <span
                          className="inline-flex items-center gap-1"
                          title="The applicant edited and resubmitted this application"
                          style={chip('rgba(182,135,31,0.18)', '#8A6614', 'rgba(182,135,31,0.4)')}
                        >
                          <RotateCcw size={10} strokeWidth={2.5} />
                          RESUBMITTED {formatDate(app.resubmitted_at)}
                        </span>
                      )}
                    </div>

                    {app.status === 'checked-in' && app.checked_in_at && (
                      <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: '#1F6E52', fontVariantNumeric: 'tabular-nums' }}>
                        <UserRoundCheck size={12} strokeWidth={2.5} />
                        Checked in {formatDateTime(app.checked_in_at)}
                      </span>
                    )}

                    {/* Inline accept / reject for submitted applicants */}
                    {isSubmitted && (
                      <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
                        <button
                          onClick={() => handleAccept(app.id)}
                          disabled={rowBusy}
                          className="inline-flex items-center gap-1.5 focus:outline-none"
                          style={{
                            padding: '7px 14px', borderRadius: 999,
                            fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            color: '#FFFFFF', background: `linear-gradient(135deg, ${NEU_GRADIENTS.green[0]}, ${NEU_GRADIENTS.green[1]})`,
                            boxShadow: `0 3px 8px ${NEU_GRADIENTS.green[0]}44, ${NEU.outSm}`, border: 'none', cursor: 'pointer', ...busyStyle,
                          }}
                        >
                          <Check size={13} strokeWidth={2.8} />
                          ACCEPT
                        </button>
                        <button
                          onClick={() => openRejectConfirm(app)}
                          disabled={rowBusy}
                          className="inline-flex items-center gap-1.5 focus:outline-none"
                          style={{
                            padding: '7px 13px', borderRadius: 999,
                            fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.09)', border: '1px solid rgba(139,32,32,0.22)', cursor: 'pointer', ...busyStyle,
                          }}
                        >
                          <Ban size={12} strokeWidth={2.6} />
                          REJECT
                        </button>
                      </div>
                    )}

                    {/* Check-in stacked ABOVE a wider Preview button */}
                    <div className="flex flex-col items-stretch gap-1.5" style={{ minWidth: 176, width: '100%' }}>
                      {canCheckIn && (
                        /* Cream / neutral until checked in — it turns green only
                           once they have actually checked in (#9). */
                        <button
                          onClick={() => handleCheckIn(app)}
                          disabled={rowBusy}
                          className="inline-flex items-center justify-center gap-1.5 focus:outline-none"
                          style={{
                            padding: '8px 14px', borderRadius: 999,
                            fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            color: NEU.ink,
                            backgroundColor: NEU.surface,
                            boxShadow: NEU.outSm,
                            border: 'none', cursor: 'pointer', ...busyStyle,
                          }}
                        >
                          <UserRoundCheck size={13} strokeWidth={2.6} style={{ color: NEU.green }} />
                          CHECK IN
                        </button>
                      )}
                      {app.status === 'checked-in' && (
                        <button
                          onClick={() => handleUndoCheckIn(app)}
                          disabled={rowBusy}
                          className="inline-flex items-center justify-center gap-1.5 focus:outline-none"
                          style={{
                            padding: '8px 14px', borderRadius: 999,
                            fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: 'pointer', ...busyStyle,
                          }}
                        >
                          <Undo2 size={12} strokeWidth={2.5} />
                          UNDO CHECK-IN
                        </button>
                      )}
                      <div className="flex items-center gap-1.5">
                        {showPayControl && (
                          <PaymentMenu
                            app={app}
                            disabled={rowBusy}
                            paymentsLive={paymentsLive}
                            align="right"
                            onMarkPaid={() => handleMarkPaid(app)}
                            onRemind={() => handleRemindPay(app)}
                            onMarkUnpaid={() => handleMarkUnpaid(app)}
                            onUndoWaive={() => handleUndoWaive(app)}
                          />
                        )}
                        <button
                          onClick={() => setReviewId(app.id)}
                          className="inline-flex items-center justify-center gap-1.5 focus:outline-none flex-1"
                          style={{
                            padding: '8px 22px', borderRadius: 999,
                            fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.04em',
                            color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: 'pointer',
                          }}
                        >
                          <Eye size={14} strokeWidth={2.5} />
                          PREVIEW
                        </button>
                        {!app.user_id && (
                          <button
                            onClick={() => openDeleteRowConfirm(app)}
                            disabled={rowBusy}
                            title="Delete this unregistered applicant's row"
                            className="inline-flex items-center justify-center focus:outline-none flex-shrink-0"
                            style={{
                              width: 34, height: 34, borderRadius: 999,
                              color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.2)',
                              cursor: rowBusy ? 'default' : 'pointer', ...busyStyle,
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submitted date, bottom-left corner (subtle) — kept clear of the
                    action buttons that occupy the row's bottom-right. */}
                {app.submitted_at && (
                  <span
                    className="hidden lg:inline-flex items-center gap-1"
                    style={{ position: 'absolute', bottom: 8, left: 20, fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums', opacity: 0.8, pointerEvents: 'none' }}
                  >
                    <CalendarDays size={11} strokeWidth={2.2} />
                    {formatDate(app.submitted_at)}
                  </span>
                )}
              </NeuCard>
            );
          })}
        </div>
      )}

      {/* Sticky bulk-action bar */}
      {!loading && selectedApps.length > 0 && (
        <div className="fixed inset-x-0 z-40 flex justify-center px-4" style={{ bottom: 20, pointerEvents: 'none' }}>
          <style>{`@keyframes bulkPulse { 0%,100% { transform: scale(1); box-shadow: 0 4px 10px rgba(27,56,40,0.35); } 50% { transform: scale(1.06); box-shadow: 0 8px 20px rgba(27,56,40,0.5); } }`}</style>
          <div
            className="flex items-center gap-2 flex-wrap justify-center"
            style={{ pointerEvents: 'auto', maxWidth: '100%', padding: '10px 14px', borderRadius: 999, backgroundColor: NEU.surface, boxShadow: NEU.out }}
          >
            <span className="inline-flex items-center gap-2 pl-1 pr-1" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
              <span className="inline-flex items-center justify-center" style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`, color: '#FFFFFF', fontSize: 11, fontWeight: 900 }}>
                {selectedApps.length}
              </span>
              selected
            </span>
            <span style={{ width: 1, height: 22, background: 'rgba(154,138,120,0.3)' }} />

            {bulkAcceptable.length > 0 && (
              <button
                onClick={() => runBulk(bulkAcceptable, { title: `Accept ${bulkAcceptable.length} application${bulkAcceptable.length === 1 ? '' : 's'}?`, body: 'Each will be accepted and any acceptance emails / auto-cover will run per applicant.', confirmLabel: 'Accept all' }, a => handleAccept(a.id))}
                className="inline-flex items-center gap-1.5 focus:outline-none"
                style={{
                  padding: '8px 15px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em', color: '#FFFFFF',
                  background: `linear-gradient(135deg, ${NEU_GRADIENTS.green[0]}, ${NEU_GRADIENTS.green[1]})`,
                  boxShadow: `0 3px 8px ${NEU_GRADIENTS.green[0]}55, ${NEU.outSm}`,
                  animation: suggestion === 'accept' ? 'bulkPulse 1.5s ease-in-out infinite' : undefined,
                }}
              >
                <Check size={14} strokeWidth={2.8} />
                Accept {bulkAcceptable.length}
              </button>
            )}
            {bulkCheckInable.length > 0 && (
              <button
                onClick={() => runBulk(bulkCheckInable, { title: `Check in ${bulkCheckInable.length} attendee${bulkCheckInable.length === 1 ? '' : 's'}?`, body: 'They will be marked as physically present on-site.', confirmLabel: 'Check in all' }, a => handleCheckIn(a))}
                className="inline-flex items-center gap-1.5 focus:outline-none"
                style={{
                  padding: '8px 15px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em', color: '#FFFFFF',
                  background: `linear-gradient(135deg, ${NEU_GRADIENTS.sage[0]}, ${NEU_GRADIENTS.sage[1]})`,
                  boxShadow: `0 3px 8px ${NEU_GRADIENTS.sage[0]}55, ${NEU.outSm}`,
                  animation: suggestion === 'checkin' ? 'bulkPulse 1.5s ease-in-out infinite' : undefined,
                }}
              >
                <UserRoundCheck size={14} strokeWidth={2.7} />
                Check in {bulkCheckInable.length}
              </button>
            )}
            {bulkPayable.length > 0 && (
              <button
                onClick={() => runBulk(bulkPayable, { title: `Mark ${bulkPayable.length} as paid?`, body: 'Each will be marked paid (self-funded); delegation spot accounting runs per applicant.', confirmLabel: 'Mark all paid' }, a => handleMarkPaid(a))}
                className="inline-flex items-center gap-1.5 focus:outline-none"
                style={{
                  padding: '8px 15px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em', color: NEU.ink,
                  backgroundColor: NEU.surface, boxShadow: NEU.outSm,
                  animation: suggestion === 'pay' ? 'bulkPulse 1.5s ease-in-out infinite' : undefined,
                }}
              >
                <CircleCheck size={14} strokeWidth={2.6} style={{ color: NEU.green }} />
                Mark paid
              </button>
            )}
            {bulkRejectable.length > 0 && (
              <button
                onClick={() => runBulk(bulkRejectable, { title: `Reject ${bulkRejectable.length} application${bulkRejectable.length === 1 ? '' : 's'}?`, body: 'This rejects the selected applications. You can reinstate them later if needed.', confirmLabel: 'Reject all', danger: true }, a => handleReject(a.id))}
                className="inline-flex items-center gap-1.5 focus:outline-none"
                style={{
                  padding: '8px 15px', borderRadius: 999, cursor: 'pointer',
                  fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em',
                  color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.09)', border: '1px solid rgba(139,32,32,0.22)',
                }}
              >
                <Ban size={13} strokeWidth={2.6} />
                Reject {bulkRejectable.length}
              </button>
            )}
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1.5 focus:outline-none"
              style={{
                padding: '8px 13px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em', color: NEU.muted,
                backgroundColor: 'transparent',
              }}
            >
              <X size={13} strokeWidth={2.6} />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Review modal, application details, custom answers and all actions.
          Rendered before confirmModal so confirm dialogs (same z-50) stack on top. */}
      {(() => {
        const app = applications.find(a => a.id === reviewId);
        if (!app) return null;
        const name = app.profiles?.display_name ?? app.invited_name ?? 'Unknown';
        const email = app.profiles?.email ?? app.invited_email ?? '';
        const isDelegate = app.role === 'delegate' || app.role === 'head-delegate';
        const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
        const isRejecting = rejectingId === app.id;
        // No recorded level → treat as "beginner" (#11).
        const expLabel = app.profiles?.mun_experience_level ?? app.experience_level ?? 'beginner';
        const confCount = app.user_id ? cvCounts[app.user_id] : undefined;
        const roleConfig = roleConfigs.find(rc => rc.role === app.role);
        const questions = normalizeQuestions(roleConfig?.custom_questions ?? []);
        const answers = app.custom_answers ?? {};
        const closeReview = () => { setReviewId(null); setRejectingId(null); setRejectNote(''); };
        // Double-click guard, the row's controls grey out while its write is in flight.
        const rowBusy = busyIds.has(app.id);
        const busyStyle: React.CSSProperties = rowBusy ? { opacity: 0.5, pointerEvents: 'none' } : {};

        // Chairs are always free — no payment control in the review modal (#5).
        const showPaymentControls = app.role !== 'chair'
          && (app.status === 'accepted' || app.status === 'assigned' || app.status === 'submitted' || app.status === 'checked-in');
        // Unified payment control (F: merge mark-paid vs waive). One menu, both
        // underlying states still reachable.
        const paymentControls = showPaymentControls ? (
          <PaymentMenu
            app={app}
            disabled={rowBusy}
            paymentsLive={paymentsLive}
            onMarkPaid={() => handleMarkPaid(app)}
            onRemind={() => handleRemindPay(app)}
            onMarkUnpaid={() => handleMarkUnpaid(app)}
            onUndoWaive={() => handleUndoWaive(app)}
          />
        ) : null;

        const rejectControls = isRejecting ? (
          <div className="flex items-start gap-2 flex-1" style={{ minWidth: 260 }}>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={2}
              placeholder={roleConfig?.allow_resubmission ? 'What should they fix before resubmitting?' : 'Optional note to delegate...'}
              className="flex-1 rounded-lg px-3 py-2 text-xs outline-none resize-none"
              style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: "'Outfit', sans-serif" }}
            />
            <button
              onClick={() => openRejectConfirm(app)}
              disabled={rowBusy}
              className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none"
              style={{ backgroundColor: 'rgba(139,32,32,0.1)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
            >
              <Check size={13} />
              CONFIRM
            </button>
            <button
              onClick={() => { setRejectingId(null); setRejectNote(''); }}
              className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none"
              style={{ border: '1px solid #DDD4C0', color: '#9A8A78', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
            >
              CANCEL
            </button>
          </div>
        ) : (
          <button
            onClick={() => setRejectingId(app.id)}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ backgroundColor: 'rgba(139,32,32,0.08)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif" }}
          >
            <X size={13} />
            REJECT
          </button>
        );

        // Withdraw (F: PART 2 item 1): accepted/assigned only, and only when
        // payment_status is 'unpaid' or 'waived'. Paid applicants must have
        // their payment handled first (refunds come with finances).
        const canWithdraw = app.payment_status !== 'paid';
        const withdrawControls = (
          <button
            onClick={() => { if (canWithdraw) openWithdrawConfirm(app); }}
            disabled={rowBusy || !canWithdraw}
            title={!canWithdraw ? 'Handle their payment before removing' : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{
              backgroundColor: 'rgba(139,32,32,0.08)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)',
              fontFamily: "'Outfit', sans-serif",
              opacity: !canWithdraw ? 0.4 : rowBusy ? 0.5 : 1,
              cursor: !canWithdraw ? 'not-allowed' : rowBusy ? 'default' : 'pointer',
              pointerEvents: rowBusy ? 'none' : undefined,
            }}
          >
            <LogOut size={13} />
            REMOVE FROM CONFERENCE
          </button>
        );

        // Check-in controls: mark on-site attendance (accepted/assigned) or
        // reverse it (checked-in). Same optimistic handlers as the row buttons.
        const checkInControls = (app.status === 'accepted' || app.status === 'assigned') ? (
          <button
            onClick={() => handleCheckIn(app)}
            disabled={rowBusy}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#2F6644', border: '1px solid rgba(61,122,82,0.3)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
          >
            <UserRoundCheck size={13} />
            CHECK IN
          </button>
        ) : app.status === 'checked-in' ? (
          <button
            onClick={() => handleUndoCheckIn(app)}
            disabled={rowBusy}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Undo2 size={13} />
            UNDO CHECK-IN
          </button>
        ) : null;

        return (
          <Portal><div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={closeReview}
          >
            <div
              className="w-full max-w-2xl rounded-2xl p-8 overflow-y-auto"
              style={{ maxHeight: '85vh', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-5">
                {app.profiles?.avatar_url ? (
                  <img src={app.profiles.avatar_url} alt={name} className="rounded-xl object-cover flex-shrink-0" style={{ width: 56, height: 56 }} />
                ) : (
                  <div className="flex-shrink-0 flex items-center justify-center rounded-xl" style={{ width: 56, height: 56, backgroundColor: '#1B3828' }}>
                    <span className="font-black" style={{ color: '#EED98A', fontSize: 22, fontFamily: "'Outfit', sans-serif" }}>
                      {name.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-lg truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{name}</h2>
                  <p className="text-xs truncate mb-1.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{email}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {!app.user_id && <NotRegisteredChip />}
                    <RolePill role={app.role} size="sm" />
                    <StatusPill status={app.status} size="sm" />
                    {app.resubmitted_at && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
                        title="The applicant edited and resubmitted this application"
                        style={{ fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', backgroundColor: 'rgba(182,135,31,0.18)', color: '#8A6614', border: '1px solid rgba(182,135,31,0.4)' }}
                      >
                        <RotateCcw size={10} strokeWidth={2.5} />
                        RESUBMITTED {formatDate(app.resubmitted_at)}
                      </span>
                    )}
                    <LevelChip level={expLabel} count={confCount} />
                  </div>
                </div>
                <button
                  onClick={closeReview}
                  aria-label="Close review"
                  className="flex-shrink-0 flex items-center justify-center rounded-lg focus:outline-none transition-colors"
                  style={{ width: 30, height: 30, border: '1px solid #DDD4C0', color: '#9A8A78', backgroundColor: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Nationality */}
              {app.profiles?.nationality && (
                <p className="flex items-center gap-2 text-xs mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  <Globe size={12} />
                  <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>NATIONALITY</span>
                  <CountryFlag name={app.profiles.nationality} size={16} />
                </p>
              )}

              {/* Preferences (delegates), full list */}
              {isDelegate && prefs.length > 0 && (
                <div className="mb-4">
                  <p className="flex items-center gap-2 text-xs mb-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
                    <MapPin size={12} />
                    PREFERENCES
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {prefs.map(p => (
                      <span
                        key={p.preference_order}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                        title={`${p.conference_committees?.name ?? 'Unknown'}, ${p.country_name}`}
                        style={{ backgroundColor: 'rgba(27,56,40,0.06)', border: '1px solid rgba(27,56,40,0.1)', color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}
                      >
                        {p.preference_order}. <span className="font-semibold">{committeeAbbr(p.conference_committees)}</span>
                        <CountryFlag name={p.country_name} code={p.country_code} size={14} />
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignment (assigned or checked-in) */}
              {(app.status === 'assigned' || app.status === 'checked-in') && app.assigned_country_name && (
                <p className="flex items-center gap-2 text-xs mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  <BadgeCheck size={12} />
                  <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>ASSIGNED</span>
                  <span style={{ color: '#1C1410' }}>
                    {[app.assigned_committee?.name, (app.assigned_committee?.topics ?? []).join(', ')].filter(Boolean).join('  ·  ')}
                  </span>
                  <CountryFlag name={app.assigned_country_name} code={app.assigned_country_code} size={14} />
                </p>
              )}

              {/* Checked in */}
              {app.status === 'checked-in' && app.checked_in_at && (
                <p className="flex items-center gap-2 text-xs mb-4" style={{ color: '#1F6E52', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                  <UserRoundCheck size={12} strokeWidth={2.5} />
                  <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>CHECKED IN</span>
                  <span>{formatDateTime(app.checked_in_at)}</span>
                </p>
              )}

              {/* Rejection note (rejected) */}
              {app.status === 'rejected' && app.organizer_note && (
                <p className="text-xs italic mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  &ldquo;{app.organizer_note}&rdquo;
                </p>
              )}

              {/* Custom answers */}
              <div className="pt-4" style={{ borderTop: '1px solid #F0EDE6' }}>
                <p className="flex items-center gap-2 text-xs mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
                  <MessageSquareText size={12} />
                  APPLICATION ANSWERS
                </p>
                {questions.length === 0 ? (
                  <p className="text-xs italic" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                    No custom questions configured for this role.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {questions.map(q => {
                      const ans = displayAnswer(q, answers[q.id]);
                      return (
                        <div key={q.id}>
                          <p className="text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{q.label}</p>
                          <p className="text-sm whitespace-pre-wrap" style={{ color: ans ? '#1C1410' : '#9A8A78', fontFamily: "'Outfit', sans-serif", fontStyle: ans ? 'normal' : 'italic' }}>
                            {ans || 'No answer provided.'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Previous MUN experience (#13) — their MUN CV as a compact list:
                  conference logo, name, committee/allocation, role, and any award
                  artwork. Fetched on demand from mun_cv_entries. */}
              {app.user_id && (
                <div className="pt-4 mt-4" style={{ borderTop: '1px solid #F0EDE6' }}>
                  <p className="flex items-center gap-2 text-xs mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
                    <Trophy size={12} />
                    PREVIOUS MUN EXPERIENCE
                  </p>
                  {previewCvLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
                    </div>
                  ) : previewCv && previewCv.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {previewCv.map(e => {
                        const roleTxt = e.entry_type === 'chair' ? 'Chair'
                          : e.entry_type === 'secretariat' ? 'Secretariat'
                          : e.entry_type === 'other' ? 'Other' : 'Delegate';
                        const where = [e.committee, e.allocation].map(s => (s ?? '').trim()).filter(Boolean).join('  ·  ');
                        const awardsList = (e.awards && e.awards.length > 0)
                          ? e.awards
                          : (e.award && e.award !== 'None' ? [e.award] : []);
                        return (
                          <div key={e.id} className="flex items-center gap-3" style={{ padding: '8px 10px', borderRadius: 12, backgroundColor: 'rgba(27,56,40,0.03)', border: '1px solid rgba(221,212,192,0.7)' }}>
                            <LogoDisc src={e.logo_url} size={38} fallbackText={monogramFor(e.conference_name)} alt={e.conference_name} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 13, color: '#1C1410' }}>{e.conference_name}</p>
                              {where && <p className="truncate" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: '#9A8A78' }}>{where}</p>}
                            </div>
                            <span className="flex-shrink-0" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6E5F4E', backgroundColor: 'rgba(154,138,120,0.14)', border: '1px solid rgba(154,138,120,0.32)', borderRadius: 999, padding: '3px 9px' }}>{roleTxt}</span>
                            {awardsList.length > 0 && (
                              <span className="inline-flex items-center gap-1 flex-shrink-0">
                                {awardsList.map(a => <AwardArtwork key={a} name={a} size={22} />)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs italic" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      No MUN experience recorded yet.
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              {actionError && (
                <p className="text-xs font-semibold mt-4" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                  {actionError}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: '1px solid #F0EDE6' }}>
                {app.status === 'submitted' && (
                  <>
                    <button
                      onClick={() => handleAccept(app.id)}
                      disabled={rowBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                      style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#3D7A52', border: '1px solid rgba(61,122,82,0.3)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
                    >
                      <Check size={13} />
                      ACCEPT
                    </button>
                    {paymentControls}
                    {rejectControls}
                  </>
                )}

                {app.status === 'accepted' && (
                  <>
                    {isDelegate && (
                      <Link
                        href={`/manage/${conference.slug}/assignment`}
                        className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none"
                        style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", textDecoration: 'none' }}
                      >
                        ASSIGN
                        <ArrowRight size={13} />
                      </Link>
                    )}
                    {checkInControls}
                    {paymentControls}
                    {rejectControls}
                    {withdrawControls}
                  </>
                )}

                {app.status === 'assigned' && (
                  <>
                    {checkInControls}
                    {paymentControls}
                    {withdrawControls}
                  </>
                )}

                {app.status === 'checked-in' && (
                  <>
                    {checkInControls}
                    {paymentControls}
                    {withdrawControls}
                  </>
                )}

                {app.status === 'rejected' && (
                  <button
                    onClick={() => handleReinstate(app.id)}
                    disabled={rowBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <RotateCcw size={13} />
                    REINSTATE
                  </button>
                )}

                {app.status === 'withdrawn' && (
                  <button
                    onClick={() => handleReinstateFromWithdrawn(app.id)}
                    disabled={rowBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <RotateCcw size={13} />
                    REINSTATE
                  </button>
                )}
              </div>
            </div>
          </div></Portal>
        );
      })()}

      {confirmModal}
    </div>
  );
}
