'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight, BadgeCheck, Ban, Building2, CalendarDays, Check, ChevronDown, ChevronLeft, CircleCheck, Clock,
  Download, Eye, Filter, Gavel, Globe, GraduationCap, HandCoins, HeartHandshake, Inbox, Landmark, LogOut, MapPin,
  MessageSquareText, Plus, RotateCcw, Search, Send, SlidersHorizontal, Trash2, Trophy, Undo2, User, UserRoundCheck,
  UserX, Users, Wallet, X,
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
import { formatFee } from '@/lib/utils';
import {
  NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuStatTile, NeuIconDisc,
} from '@/components/neu';
import {
  poolForRole, fillFreeSpots, releasePoolSpot, POOL_SPOTS_COLUMN, MemberAvatar, markNotAttending, undoNotAttending,
} from '@/app/manage/[slug]/assignment/delegationShared';
import { LevelInsignia, LEVEL_ACCENT, AwardArtwork, monogramFor } from '@/app/account/accountUi';
import { type CustomQuestion, type CustomAnswers, normalizeBlocks, questionsOf, displayAnswer } from '@/lib/customQuestions';

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
  custom_questions: unknown[];
  fee_amount: number | null;
  fee_currency: string | null;
  fee_phases: { amount?: number }[] | null;
  allow_resubmission: boolean;
}

/** A role config actually charges something, the flat fee or any phase's
 *  amount. Chairs default to feeless, but a conference can configure a
 *  chair fee (e.g. Bilkent charges TRY 1550) — when it does, chair
 *  applications get the exact same payment treatment as any other role. */
function roleHasFee(rc: RoleConfigLite | undefined): boolean {
  if (!rc) return false;
  if ((rc.fee_amount ?? 0) > 0) return true;
  return (rc.fee_phases ?? []).some(p => (Number(p?.amount) || 0) > 0);
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
  // Denormalized aid snapshot on the application row itself — checked as a
  // fallback alongside the linked financial_aid_requests row (see previewAid)
  // so a request is never missed regardless of which one is populated.
  aid_requested: boolean;
  aid_statement: string | null;
  aid_status: string | null;
  aid_requested_amount: number | null;
  // Set server-side to 'chair_invite' when this chair was brought in by the
  // organizing team (payment_status arrives 'waived' alongside it) — drives
  // the INVITED badge and, when this role has no configured fee at all, the
  // standalone WAIVED chip that stands in for the payment menu.
  fee_waiver_source: string | null;
}

// The applicant's financial_aid_requests row, fetched on demand when the
// review modal opens (mirrors previewCv) — the source of truth for the
// statement/amount/status in the vast majority of cases, since aid is filed
// via a separate request rather than always mirrored onto applications.
interface PreviewAidRequest {
  id: string;
  statement: string | null;
  requested_amount: number | null;
  status: 'pending' | 'approved' | 'denied';
  granted_amount: number | null;
  created_at: string;
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

// Same tri-color scheme as AidRequestsSection's StatusChip, so a request's
// status reads consistently whether seen from Applications or Financial Aid.
const AID_STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending: { bg: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: 'rgba(184,132,74,0.42)', label: 'PENDING' },
  approved: { bg: 'rgba(61,122,82,0.17)', color: '#2A5A3C', border: 'rgba(61,122,82,0.45)', label: 'APPROVED' },
  denied: { bg: 'rgba(154,138,120,0.16)', color: '#6B5F52', border: 'rgba(154,138,120,0.35)', label: 'DENIED' },
};

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

/** A chair brought in by the organizing team rather than applying — shown
 *  next to the role chip regardless of whether this conference charges a
 *  chair fee. */
function InvitedChip() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full font-bold flex-shrink-0"
      style={{ fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', backgroundColor: 'rgba(182,135,31,0.14)', color: '#8A6614', border: '1px solid rgba(182,135,31,0.35)' }}
    >
      INVITED
    </span>
  );
}

/** Static stand-in for the payment menu, an invited chair whose role has no
 *  configured fee at all gets no PaymentMenu (there's nothing to mark paid),
 *  so this is the only visible confirmation they owe nothing. Once a
 *  conference configures a chair fee, the real PaymentMenu takes over and
 *  already renders its own "WAIVED" label for a waived chair, same as any
 *  other role — this chip only appears where that menu doesn't. */
function WaivedChip() {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full font-bold flex-shrink-0"
      style={{ fontSize: 10, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', backgroundColor: 'rgba(61,122,82,0.14)', color: '#2A5A3C', border: '1px solid rgba(61,122,82,0.35)' }}
    >
      WAIVED
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

function StatusPill({ status, size = 'md', awaitingResubmission = false }: { status: string; size?: 'sm' | 'md'; awaitingResubmission?: boolean }) {
  // A rejected application whose role allows resubmission reads as "Awaiting
  // Resubmission" (amber/pending) instead of the final-sounding "Rejected" —
  // same underlying status, display only.
  const t = (status === 'rejected' && awaitingResubmission)
    ? { grad: ['#C79A52', '#B8844A'] as [string, string], label: 'Awaiting Resubmission', icon: RotateCcw }
    : STATUS_PILL[status] ?? { grad: ['#9A8A78', '#6B5F52'] as [string, string], label: status.replace('-', ' '), icon: Clock };
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

/** Danger-muted pill for `attending === false`, layered independently of
 *  status (an accepted/assigned/checked-in applicant can still be marked not
 *  attending). Reuses the Withdrawn treatment's gradient for the same visual
 *  family, distinct icon so the two states never look identical. */
function NotAttendingBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const grad = STATUS_PILL.withdrawn.grad;
  const iconSize = size === 'sm' ? 12 : 14;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        padding: size === 'sm' ? '4px 10px' : '5px 12px',
        borderRadius: 999,
        background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`,
        color: '#FFFFFF',
        fontFamily: OUTFIT, fontSize: size === 'sm' ? 11 : 11.5, fontWeight: 800, letterSpacing: '0.03em',
        boxShadow: `0 3px 8px ${grad[0]}55, ${NEU.outSm}`,
        whiteSpace: 'nowrap',
      }}
    >
      <UserX size={iconSize} strokeWidth={2.7} style={{ color: '#FFFFFF' }} />
      NOT ATTENDING
    </span>
  );
}

/** Reserved width of the row's role/level slot (#4). Wide enough for the
 *  longest label the RolePill can render at size="sm" — "FACULTY ADVISOR",
 *  ~143px with its glyph, gap and pill padding — so every value occupies the
 *  same position and the same width, and none of them is ever truncated. */
const LEVEL_SLOT_W = 152;

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
  committees, loading, onOpen, onAllocate, big = false,
}: {
  committees: QuickCommittee[] | null;
  loading: boolean;
  onOpen: () => void;
  onAllocate: (committee: QuickCommittee, slot: { country_code: string; country_name: string }) => void;
  /** Renders the trigger as a full-width prominent CTA (the stacked allocation
   *  area, #4) rather than the compact 28px "+" disc used inline. */
  big?: boolean;
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
  const toggle = (e?: React.MouseEvent) => {
    // The whole row card opens the preview on click (#3); the allocate trigger
    // must never bubble up to it.
    e?.stopPropagation();
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
    <div style={{ display: big ? 'block' : 'inline-block', width: big ? '100%' : undefined }}>
      {big ? (
        <button
          ref={btnRef}
          onClick={toggle}
          title="Allocate to a committee"
          aria-label="Allocate to a committee"
          className="inline-flex items-center justify-center gap-2 w-full focus:outline-none"
          style={{
            padding: '11px 18px', borderRadius: 999,
            fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900, letterSpacing: '0.05em',
            color: '#FFFFFF', background: `linear-gradient(135deg, ${NEU_GRADIENTS.gold[0]}, ${NEU_GRADIENTS.gold[1]})`,
            boxShadow: open ? NEU.inSm : `0 3px 8px ${NEU_GRADIENTS.gold[0]}44, ${NEU.outSm}`,
            border: 'none', cursor: 'pointer', transition: `box-shadow 160ms ${EASE_LOCAL}`,
          }}
        >
          <BadgeCheck size={16} strokeWidth={2.6} />
          ALLOCATE COMMITTEE
        </button>
      ) : (
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
      )}
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

// Status GROUPS, module scope so the stat tiles and the ?status= deep link can
// never drift apart. "Accepted" means accepted-or-beyond and "Allocated" means
// allocated-or-beyond, exactly as the stat tiles count them.
const ACCEPTED_GROUP = ['accepted', 'assigned', 'checked-in'];
const ALLOCATED_GROUP = ['assigned', 'checked-in'];

// The allocated view (the "Allocated" stat tile, and the ?status=assigned deep
// link that resolves to the same group) is a DELEGATE view: it answers "who has
// a committee and a country". Chairs and faculty advisors sit on a dais or
// travel with a school, they are never allocated a seat, so they are dropped
// from that list only. Every other tab/filter combination still shows them, and
// explicitly ticking Chairs / Faculty Advisors in the Participants filter brings
// them back even inside the allocated view.
const NON_DELEGATE_ROLES = new Set(['chair', 'faculty-advisor']);

/**
 * Query params this page understands, so other surfaces (the dashboard's
 * applicants dial) can deep-link straight into a pre-filtered view:
 *   ?status=accepted | assigned | checked-in | submitted | rejected | withdrawn
 *   ?payment=paid | unpaid | waived
 * `accepted` and `assigned` expand to their groups above, so a link lands on
 * exactly the rows the linking surface counted. Unrecognised values are
 * ignored and the page opens on its normal unfiltered default.
 */
const URL_STATUS_GROUPS: Record<string, string[]> = {
  accepted: ACCEPTED_GROUP,
  assigned: ALLOCATED_GROUP,
  'checked-in': ['checked-in'],
  submitted: ['submitted'],
  rejected: ['rejected'],
  withdrawn: ['withdrawn'],
};

function filtersFromUrl(status: string | null, payment: string | null): FilterState {
  const seeded: FilterState = {
    status: new Set(), role: new Set(DEFAULT_ROLES), payment: new Set(),
    dateFrom: '', dateTo: '', notAttending: false, committee: '',
  };
  const group = status ? URL_STATUS_GROUPS[status] : undefined;
  if (group) seeded.status = new Set(group);
  if (payment && PAYMENT_OPTIONS.some(o => o.value === payment)) seeded.payment = new Set([payment]);
  return seeded;
}

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
  // Independent of `status` (an accepted/assigned/checked-in applicant can
  // still be not-attending) — same baked-in default exclusion as withdrawn,
  // only reachable by explicitly turning this chip on.
  notAttending: boolean;
  // Allocated committee id, '' = "All committees" (no constraint). Sits on the
  // header bar next to FILTERS as its own dropdown rather than inside the
  // filter popover, because it is a single-choice control, not a chip set.
  committee: string;
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
                onClick={() => setFilters({ status: new Set(), role: new Set(DEFAULT_ROLES), payment: new Set(), dateFrom: '', dateTo: '', notAttending: false, committee: '' })}
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
            {/* Not attending: a separate boolean dimension from status (an
                accepted/assigned/checked-in applicant can still be not
                attending), so it sits alongside the Status group as its own
                chip rather than inside filters.status. */}
            <div className="flex flex-wrap gap-1.5">
              <CheckChip
                label="Not Attending"
                checked={filters.notAttending}
                onClick={() => setFilters(f => ({ ...f, notAttending: !f.notAttending }))}
              />
            </div>
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

// ── Per-committee filter ──────────────────────────────────────────────────────
// Narrows the list to one ALLOCATED committee. Sits on the header bar beside
// FILTERS and wears the same neumorphic pill as FILTERS / EXPORT CSV; the
// dropdown itself is portaled at fixed viewport coordinates taken from the
// trigger, repositioned on scroll/resize and flipped near the viewport edge, so
// it can never be clipped by an ancestor's overflow (same pattern as
// PaymentMenu / QuickAllocate). '' = "All committees".

interface CommitteeOption { id: string; primary: string; secondary: string | null }

function CommitteeFilter({
  options, value, onChange,
}: {
  options: CommitteeOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const MENU_W = 272;
  const MENU_H = 340;

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = spaceBelow < MENU_H + 16 && r.top > spaceBelow;
    // Right-align to the trigger, then clamp so it always stays on screen.
    let left = r.right - MENU_W;
    if (left + MENU_W > window.innerWidth - 8) left = window.innerWidth - MENU_W - 8;
    left = Math.max(8, left);
    setPos({ top: flip ? Math.max(8, r.top - MENU_H - 6) : r.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  // Nothing has been allocated yet → no dimension to filter on, no control.
  if (options.length === 0) return null;

  const active = !!value;
  const current = options.find(o => o.id === value) ?? null;
  const label = current ? current.primary : 'All committees';

  const row = (id: string, primary: string, secondary: string | null) => {
    const isCurrent = id === value;
    return (
      <button
        key={id || '__all'}
        onClick={() => { setOpen(false); onChange(id); }}
        className="inline-flex items-center gap-2 w-full focus:outline-none"
        style={{
          padding: '8px 10px', borderRadius: 11, background: isCurrent ? 'rgba(27,56,40,0.07)' : 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'start',
        }}
        onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
        onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <span className="flex-1 min-w-0">
          <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>{primary}</span>
          {secondary && (
            <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted }}>{secondary}</span>
          )}
        </span>
        {isCurrent && <Check size={13} strokeWidth={3} style={{ color: NEU.deepGold, flexShrink: 0 }} />}
      </button>
    );
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={() => { if (open) { setOpen(false); return; } place(); setOpen(true); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Filter by allocated committee"
        className="inline-flex items-center gap-2 focus:outline-none"
        style={{
          padding: '9px 16px', borderRadius: 999,
          fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em',
          color: active || open ? '#FFFFFF' : NEU.ink,
          background: active || open ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
          boxShadow: active || open ? `0 4px 10px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : NEU.outSm,
          border: 'none', cursor: 'pointer',
          transition: `box-shadow 200ms ${EASE_LOCAL}`,
        }}
      >
        <Landmark size={14} strokeWidth={2.5} />
        <span className="truncate" style={{ maxWidth: 150 }}>{label.toUpperCase()}</span>
        <ChevronDown size={12} strokeWidth={2.6} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
              width: MENU_W, maxHeight: MENU_H, overflowY: 'auto',
              backgroundColor: NEU.surface, borderRadius: 16, boxShadow: NEU.out, padding: 6,
              animation: `neuFadeIn 160ms ${EASE_LOCAL}`,
            }}
          >
            <style>{`@keyframes neuFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div className="flex flex-col gap-0.5">
              {row('', 'All committees', null)}
              {options.map(o => row(o.id, o.primary, o.secondary))}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

// ── ApplicationsPage ──────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('status');
  const urlPayment = searchParams.get('payment');
  const paymentsLive = isPaymentsLive(conference?.id, conference?.connect_onboarding_status, conference?.payment_method);
  const [applications, setApplications] = useState<Application[]>([]);
  // Unpaid gating invoices (gates_acceptance=true, status not settled/waived/
  // void). Only app_fee rows ever carry the flag, since it comes from
  // application_surcharges.gates_acceptance. Fetched with the applications list.
  const [gatingInvoices, setGatingInvoices] = useState<{ application_id: string | null; society_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  // Empty role set = no constraint, so a fresh page shows every role
  // (including chairs) in both the row list and the stat scope.
  // Seeded from the URL on first render (?status=…, ?payment=…) so a deep link
  // from the dashboard opens on the matching rows with no unfiltered flash.
  // Lazy initialiser, not an effect: after mount this is ordinary local state
  // and the filter panel owns it.
  const [filters, setFilters] = useState<FilterState>(
    () => filtersFromUrl(urlStatus, urlPayment),
  );
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
  // The applicant's financial_aid_requests row (if any), fetched on demand
  // when the review modal opens — same lazy pattern as previewCv.
  const [previewAid, setPreviewAid] = useState<PreviewAidRequest | null>(null);
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
  // Quick-filter search (#2). `searchInput` is the raw field value; `search`
  // is the debounced, lower-cased term the list actually filters on.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [searchInput]);
  // Delegation/society popup (#6): the society whose members are being shown,
  // or null when closed. Populated from the already-loaded applications, so no
  // extra fetch is needed.
  const [delegationView, setDelegationView] = useState<{ id: string; name: string } | null>(null);

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
    // Materialize this conference's invoices first, so the gating query right
    // below is guaranteed to see any app-fee invoice a submitted application
    // now owes (same sync-before-read pattern as financials/invoices and
    // useInvoiceTotals).
    await supabase.rpc('sync_conference_invoices', { p_conference_id: conference.id });
    const [appRes, cfgRes, gatingRes] = await Promise.all([
      supabase
        .from('applications')
        .select(`
          id, user_id, invited_email, invited_name, role, status, is_head_delegate, experience_level,
          payment_status, submitted_at, checked_in_at, organizer_note, resubmitted_at, custom_answers,
          assigned_committee_id, assigned_country_code, assigned_country_name,
          self_paid, attending, pledge_type, spots_pledged, pledge_confirmed_at, society_id,
          aid_requested, aid_statement, aid_status, aid_requested_amount, fee_waiver_source,
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
        .select('role, payment_timing, custom_questions, fee_amount, fee_currency, fee_phases, allow_resubmission')
        .eq('conference_id', conference.id),
      // Unpaid gating invoices block Accept until paid. The only source of
      // gates_acceptance=true is application_surcharges.gates_acceptance, the
      // Conference Registration Fee in Financials, copied onto the app_fee
      // invoice by sync_participant_invoices. The old role-level gate
      // (application_role_configs.fee_gates_acceptance) was removed from
      // Settings > Applications and dropped from the database.
      supabase
        .from('invoices')
        .select('application_id, society_id')
        .eq('conference_id', conference.id)
        .eq('gates_acceptance', true)
        .not('status', 'in', '(settled,waived,void)'),
    ]);

    if (seq !== loadSeq.current) return; // stale response, a newer load superseded this one

    const apps = (appRes.data ?? []) as unknown as Application[];
    setApplications(apps);
    setRoleConfigs((cfgRes.data ?? []) as unknown as RoleConfigLite[]);
    setGatingInvoices((gatingRes.data ?? []) as { application_id: string | null; society_id: string | null }[]);
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

  // Fetch the applicant's financial_aid_requests row on demand — surfaces aid
  // in the review modal so an organiser doesn't have to switch to the
  // Financial Aid tab. Read-only here; approve/deny still lives there.
  useEffect(() => {
    if (!reviewId || !session) { setPreviewAid(null); return; }
    let cancelled = false;
    setPreviewAid(null);
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('financial_aid_requests')
        .select('id, statement, requested_amount, status, granted_amount, created_at')
        .eq('application_id', reviewId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setPreviewAid((data as PreviewAidRequest | null) ?? null);
    })();
    return () => { cancelled = true; };
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
        assigned_by: session.user.id,
      });
      if (insErr) throw insErr;
      const { error } = await supabase.from('applications').update({
        status: 'assigned',
        assigned_committee_id: committee.id,
        assigned_country_code: slot.country_code,
        assigned_country_name: slot.country_name,
        decided_by: session.user.id, decided_at: new Date().toISOString(),
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
      const { error } = await supabase.from('applications').update({ status: 'accepted', decided_by: session.user.id, decided_at: new Date().toISOString() }).eq('id', appId);
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
      // decided_by is DB-only (never part of the optimistic row patch): the
      // Application type carries no actor field, the feed reads it from the DB.
      const { error } = await supabase.from('applications').update({ ...updates, decided_by: session.user.id, decided_at: new Date().toISOString() }).eq('id', appId);
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

  // Single reject control, used everywhere a REJECT action appears (the
  // compact card's quick actions AND the review modal's action bar) so
  // there is exactly one reject UI and one behavior: idle REJECT button →
  // expands in place into a feedback textarea + CONFIRM/CANCEL. CONFIRM
  // calls handleReject directly — no second native confirm dialog on top.
  // `locked` (the review modal's not-attending guard) takes priority over
  // busy — a not-attending row's REJECT is hard-disabled regardless of any
  // in-flight write. The row-card caller never passes it (that caller wraps
  // ACCEPT+REJECT together in its own outer lock instead), so this stays a
  // no-op there.
  // `variant` only changes presentation: 'compact' is the original small chip,
  // 'big' is the full-width pre-decision button (#5) and its narrow-column
  // expanded form. Both run the exact same setRejectingId → handleReject flow.
  function renderRejectControls(app: Application, locked = false, variant: 'compact' | 'big' = 'compact') {
    const isRejecting = rejectingId === app.id;
    const roleConfig = roleConfigs.find(rc => rc.role === app.role);
    const rowBusy = busyIds.has(app.id);
    const disabledNow = rowBusy || locked;
    const busyStyle: React.CSSProperties = locked
      ? { opacity: 0.45, pointerEvents: 'none' }
      : rowBusy ? { opacity: 0.5, pointerEvents: 'none' } : {};
    const pool = poolForRole(app.role);
    const releasesSpot = app.payment_status === 'paid' && !app.self_paid && !!app.society_id && !!pool;
    const big = variant === 'big';

    if (!isRejecting) {
      return big ? (
        <button
          onClick={() => setRejectingId(app.id)}
          disabled={disabledNow}
          className="inline-flex items-center justify-center gap-2 w-full focus:outline-none"
          style={{
            padding: '13px 18px', borderRadius: 14,
            fontFamily: OUTFIT, fontSize: 13, fontWeight: 900, letterSpacing: '0.05em',
            color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.09)', border: '1.5px solid rgba(139,32,32,0.3)',
            cursor: 'pointer', transition: `background-color 160ms ${EASE_LOCAL}`, ...busyStyle,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.16)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.09)'; }}
        >
          <X size={16} strokeWidth={2.8} />
          REJECT
        </button>
      ) : (
        <button
          onClick={() => setRejectingId(app.id)}
          disabled={disabledNow}
          className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
          style={{ backgroundColor: 'rgba(139,32,32,0.08)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
        >
          <X size={13} />
          REJECT
        </button>
      );
    }

    const noteField = (
      <textarea
        value={rejectNote}
        onChange={e => setRejectNote(e.target.value)}
        disabled={disabledNow}
        rows={2}
        placeholder={roleConfig?.allow_resubmission ? 'What should they fix before resubmitting?' : 'Optional note to delegate...'}
        className={`${big ? 'w-full' : 'flex-1'} rounded-lg px-3 py-2 text-xs outline-none resize-none`}
        style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
      />
    );
    const confirmBtn = (
      <button
        onClick={() => handleReject(app.id)}
        disabled={disabledNow}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none${big ? ' flex-1' : ''}`}
        style={{ backgroundColor: 'rgba(139,32,32,0.1)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
      >
        <Check size={13} />
        CONFIRM
      </button>
    );
    const cancelBtn = (
      <button
        onClick={() => { setRejectingId(null); setRejectNote(''); }}
        className={`rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none${big ? ' flex-1' : ''}`}
        style={{ border: '1px solid #DDD4C0', color: '#9A8A78', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
      >
        CANCEL
      </button>
    );

    return (
      // The big variant lives inside a narrow fixed-width rail, so it stacks
      // (and carries no minWidth that would overflow and get clipped).
      <div className={`flex flex-col gap-2${big ? ' w-full' : ' flex-1'}`} style={{ minWidth: big ? 0 : 260 }}>
        {releasesSpot && (
          <p className="text-[11px]" style={{ color: '#B8844A', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
            Their payment used a delegation-purchased spot. Rejecting will release that spot back to the delegation as open.
          </p>
        )}
        {big ? (
          <>
            {noteField}
            <div className="flex items-center gap-2">
              {confirmBtn}
              {cancelBtn}
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2">
            {noteField}
            {confirmBtn}
            {cancelBtn}
          </div>
        )}
      </div>
    );
  }

  /** Large ACCEPT + REJECT pair shown while an application is still undecided
   *  (#5). Full-width inside whichever pane renders it; wired to the EXISTING
   *  handleAccept / reject flow (which set decided_by / decided_at) — no new DB
   *  logic. Once decided, callers fall back to their compact controls. */
  function renderBigDecisionControls(app: Application, locked: boolean) {
    const rowBusy = busyIds.has(app.id);
    const blocked = isAcceptBlockedByFee(app);
    const isRejecting = rejectingId === app.id;
    const busyStyle: React.CSSProperties = rowBusy ? { opacity: 0.5, pointerEvents: 'none' } : {};
    const lockStyle: React.CSSProperties = locked ? { opacity: 0.45, pointerEvents: 'none' } : {};

    return (
      <div className="flex flex-col gap-2.5 w-full" style={{ minWidth: 0, ...lockStyle }}>
        {!isRejecting && (
          <button
            onClick={() => handleAccept(app.id)}
            disabled={rowBusy || blocked || locked}
            title={blocked ? ACCEPT_BLOCKED_MESSAGE : undefined}
            className="inline-flex items-center justify-center gap-2 w-full focus:outline-none"
            style={{
              padding: '13px 18px', borderRadius: 14,
              fontFamily: OUTFIT, fontSize: 13, fontWeight: 900, letterSpacing: '0.05em',
              color: '#FFFFFF', background: `linear-gradient(135deg, ${NEU_GRADIENTS.green[0]}, ${NEU_GRADIENTS.green[1]})`,
              boxShadow: `0 4px 12px ${NEU_GRADIENTS.green[0]}55, ${NEU.outSm}`, border: 'none',
              cursor: blocked ? 'not-allowed' : 'pointer',
              opacity: blocked ? 0.5 : 1,
              ...busyStyle,
            }}
          >
            <Check size={16} strokeWidth={3} />
            ACCEPT
          </button>
        )}
        {renderRejectControls(app, locked, 'big')}
      </div>
    );
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
      const { error } = await supabase.from('applications').update({ status: 'submitted', organizer_note: null, decided_by: session.user.id, decided_at: new Date().toISOString() }).eq('id', appId);
      if (error) throw error;
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not reinstate the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  async function openReinstateConfirm(app: Application) {
    const { confirmed } = await confirm({
      title: 'Reinstate this application?',
      body: 'This returns the application to Submitted so you can review it again. Any rejection note will be cleared.',
      confirmLabel: 'Reinstate',
    });
    if (!confirmed) return;
    handleReinstate(app.id);
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
        decided_by: session.user.id, decided_at: new Date().toISOString(),
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
      const { error } = await supabase.from('applications').update({ status: 'accepted', decided_by: session.user.id, decided_at: new Date().toISOString() }).eq('id', appId);
      if (error) throw error;
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not reinstate the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  // ── Attendance ───────────────────────────────────────────────────────────
  // Reuses the exact canonical write from delegationShared.tsx (coverage
  // release, the not_attending/attendance_restored emails, spot handling) so
  // a flip from here is byte-identical to one from the Delegations view —
  // not reimplemented here.
  async function openNotAttendingConfirm(app: Application) {
    const name = app.profiles?.display_name ?? app.invited_name ?? 'this applicant';
    const hasAllocation = !!app.assigned_committee_id;
    const { confirmed } = await confirm({
      title: `Mark ${name} as not attending?`,
      body: hasAllocation
        ? 'Their committee assignment will be removed. Their delegation spot, if any, stays with the delegation.'
        : 'Their delegation spot, if any, stays with the delegation.',
      confirmLabel: 'Mark Not Attending',
      danger: true,
    });
    if (!confirmed) return;
    handleNotAttending(app);
  }

  function handleNotAttending(app: Application) {
    if (!session || !conference || busyIds.has(app.id)) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;
    const name = prevRow.profiles?.display_name ?? prevRow.invited_name ?? 'this applicant';

    setActionError('');
    markBusy(app.id, true);
    // Optimistic: exactly what markNotAttending writes for this row.
    applyRow(app.id, {
      attending: false,
      assigned_committee_id: null,
      assigned_country_code: null,
      assigned_country_name: null,
      assigned_committee: null,
      status: prevRow.status === 'assigned' ? 'accepted' : prevRow.status,
    });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const result = await markNotAttending(supabase, conference.id, prevRow, session.user.id);
      if (result.error) throw new Error(result.error);
      notifyIfNeeded(result.result, pushDraftNotice);
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError(`Could not mark ${name} as not attending. Please try again.`);
      })
      .finally(() => markBusy(app.id, false));
  }

  function handleMarkAttending(app: Application) {
    if (!session || !conference || busyIds.has(app.id)) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;

    setActionError('');
    markBusy(app.id, true);
    // Optimistic: exactly what undoNotAttending writes for this row.
    applyRow(app.id, { attending: true, payment_status: 'unpaid' });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const result = await undoNotAttending(supabase, conference.id, prevRow);
      if (result.error) throw new Error(result.error);
      notifyIfNeeded(result.result, pushDraftNotice);
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not restore attendance. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
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

      // Settle their invoices too. This is NOT optional bookkeeping: the accept
      // gate reads INVOICES (gates_acceptance, unsettled), never
      // applications.payment_status, so marking someone paid without settling
      // left them permanently un-acceptable — the organiser saw a green PAID
      // badge next to "A required fee is unpaid", with ACCEPT greyed out and no
      // way forward. It also left the ledger claiming nothing was collected.
      //
      // mark_invoice_paid is the same RPC the financials page uses: it writes
      // the payment + batch rows, settles the invoice and runs
      // settle_invoice_effects, so manual payments land identically wherever
      // they are recorded.
      try {
        const { data: openInvoices } = await supabase
          .from('invoices')
          .select('id')
          .eq('application_id', app.id)
          .not('status', 'in', '(settled,waived,void)');
        for (const inv of (openInvoices ?? []) as { id: string }[]) {
          await supabase.rpc('mark_invoice_paid', { p_invoice_id: inv.id });
        }
      } catch {
        setActionError('Marked paid, but their invoice could not be settled — they may still be blocked from acceptance. Settle it in Financials → Invoices.');
      }

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

      // Mirror of handleMarkPaid: reopen anything we settled on their behalf,
      // so the ledger tracks the payment mark in BOTH directions. Without this
      // the reverse inconsistency appears — an application reading unpaid while
      // its invoice still claims the money arrived.
      try {
        const { data: settled } = await supabase
          .from('invoices')
          .select('id')
          .eq('application_id', app.id)
          .eq('status', 'settled');
        for (const inv of (settled ?? []) as { id: string }[]) {
          await supabase.rpc('mark_invoice_unpaid', { p_invoice_id: inv.id });
        }
      } catch {
        setActionError('Marked unpaid, but their invoice still shows as settled. Reopen it in Financials → Invoices.');
      }

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
      const { error } = await checkInApplication(supabase, app.id, session.user.id);
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
      const { error } = await undoCheckIn(supabase, app.id, revertTo, session.user.id);
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

  // The default-view size (withdrawn/removed and not-attending applicants
  // excluded), used both to gate the "filters active" reminder and as its
  // denominator — so the baked-in exclusions are never mistaken for a
  // user-applied filter.
  const defaultScopeCount = applications.filter(a => a.status !== 'withdrawn' && a.attending).length;

  // Committee options for the per-committee filter, derived from the
  // applications ALREADY fetched (each row carries assigned_committee_id plus
  // the joined conference_committees name/abbreviation) — no extra round trip.
  // A committee with no allocations yet simply has nothing to filter to.
  const committeeOptions: CommitteeOption[] = (() => {
    const seen = new Map<string, { name: string; abbreviation: string | null }>();
    for (const a of applications) {
      if (a.assigned_committee_id && a.assigned_committee && !seen.has(a.assigned_committee_id)) {
        seen.set(a.assigned_committee_id, { name: a.assigned_committee.name, abbreviation: a.assigned_committee.abbreviation });
      }
    }
    return Array.from(seen.entries())
      .map(([id, c]) => {
        // Same naming rule as the row cards: long name → ACRONYM with the full
        // name small beneath it.
        const disp = committeeDisplay(c);
        return { id, primary: disp.primary, secondary: disp.secondary, sort: c.name };
      })
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .map(({ id, primary, secondary }) => ({ id, primary, secondary }));
  })();

  // Empty selection = no constraint on that dimension (fresh page shows all)
  // — EXCEPT withdrawn/removed applicants, who stay out of the default view
  // even with no status filter active; they're only reachable by explicitly
  // adding the Withdrawn status filter. Not-attending applicants follow the
  // exact same rule via its own independent chip, since `attending` is a
  // separate dimension from `status` (an accepted/assigned/checked-in
  // applicant can still be not attending).
  // The allocated view = the list narrowed to the ALLOCATED_GROUP statuses,
  // whether that came from the "Allocated" stat tile or the ?status=assigned
  // deep link (both resolve to the same array). Only this combination hides
  // chairs / faculty advisors — see NON_DELEGATE_ROLES.
  const isAllocatedView = sameSet(filters.status, ALLOCATED_GROUP);

  const filtered = applications.filter(a => {
    if (filters.status.size > 0) {
      if (!filters.status.has(a.status)) return false;
    } else if (a.status === 'withdrawn') {
      return false;
    }
    // Allocated view lists DELEGATES only. An explicit Participants selection
    // still wins, so an organiser who ticks "Chairs" gets them back here.
    if (isAllocatedView && NON_DELEGATE_ROLES.has(a.role) && !filters.role.has(a.role)) return false;
    if (filters.committee && a.assigned_committee_id !== filters.committee) return false;
    if (filters.notAttending) {
      if (a.attending) return false;
    } else if (!a.attending) {
      return false;
    }
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
    // Quick-filter search (#2): matches ANY of the applicant's details —
    // name, email, nationality/country, delegation/society, and every
    // committee/country they preferenced or were allocated to.
    if (search) {
      const hay = [
        a.profiles?.display_name, a.invited_name,
        a.profiles?.email, a.invited_email,
        a.profiles?.nationality,
        a.societies?.name,
        a.assigned_committee?.name, a.assigned_committee?.abbreviation, a.assigned_country_name,
        ...(a.application_preferences ?? []).flatMap(p => [
          p.conference_committees?.name, p.conference_committees?.abbreviation, p.country_name,
        ]),
      ].filter(Boolean).join('  ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
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
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.notAttending ? 1 : 0) +
    (filters.committee ? 1 : 0);

  // ── Selection-derived values for the bulk-action bar ──────────────────────
  // Act only on rows that are both selected AND currently visible, so a filter
  // change can never cause a hidden row to be swept up in a bulk action.
  const selectedApps = filtered.filter(a => selectedIds.has(a.id));
  const allVisibleSelected = filtered.length > 0 && filtered.every(a => selectedIds.has(a.id));
  // Not-attending rows never enter a bulk status/payment operation — every
  // bulkXxxable derivation and the suggestion below is computed off this
  // eligible-only set, not selectedApps directly. The skipped count drives
  // the inline note in the bulk bar rather than silently dropping them.
  const notAttendingSelectedCount = selectedApps.filter(a => !a.attending).length;
  const bulkEligibleApps = selectedApps.filter(a => a.attending);
  // Chairs are feeless by default, so bulk mark-paid / waive skip them —
  // unless this conference has actually configured a chair fee, in which
  // case a chair application owes money exactly like any other role.
  // When Stripe checkout is live for this conference, manual mark-paid is not
  // offered at all (bulk or single) — checkout + webhook own that state.
  const chairHasFee = roleHasFee(roleConfigs.find(rc => rc.role === 'chair'));
  const payEligible = (a: Application) =>
    !paymentsLive
    && (a.role !== 'chair' || chairHasFee)
    && (a.status === 'accepted' || a.status === 'assigned' || a.status === 'submitted' || a.status === 'checked-in')
    && a.payment_status !== 'paid' && a.payment_status !== 'waived';
  // Accept is blocked while a gating app_fee invoice is unpaid, matched by
  // this application's own id, or its society's (per-delegation surcharges
  // are tied to whichever application first triggered them, not necessarily
  // this one; see sync_participant_invoices).
  const gatingAppIds = new Set(gatingInvoices.map(i => i.application_id).filter((id): id is string => !!id));
  const gatingSocietyIds = new Set(gatingInvoices.map(i => i.society_id).filter((id): id is string => !!id));
  const isAcceptBlockedByFee = (a: Application) =>
    gatingAppIds.has(a.id) || (!!a.society_id && gatingSocietyIds.has(a.society_id));
  const ACCEPT_BLOCKED_MESSAGE = "A required fee is unpaid. They can be accepted once it's paid.";
  const bulkAcceptable = bulkEligibleApps.filter(a => a.status === 'submitted' && !isAcceptBlockedByFee(a));
  const bulkRejectable = bulkEligibleApps.filter(a => a.status === 'submitted' || a.status === 'accepted');
  const bulkCheckInable = bulkEligibleApps.filter(a => a.status === 'accepted' || a.status === 'assigned');
  const bulkPayable = bulkEligibleApps.filter(payEligible);
  // Suggested action from the selection composition. Starts pulsing the moment a
  // selection is made, nudging the organiser toward the obvious next step.
  const suggestion: 'accept' | 'pay' | 'checkin' | null =
    bulkEligibleApps.length === 0 ? null
    : bulkEligibleApps.every(a => a.status === 'submitted') ? 'accept'
    : bulkEligibleApps.every(a => (a.status === 'accepted' || a.status === 'assigned') && payEligible(a)) ? 'pay'
    : bulkEligibleApps.every(a => a.status === 'accepted' || a.status === 'assigned') ? 'checkin'
    : null;

  // Stat tiles count over the SAME population the list shows by role/date/aid
  // (all roles by default, #10) but ignore the status / payment dimensions —
  // those are exactly what the tiles let you click into.
  const statScope = applications.filter(a => {
    // Withdrawn/removed and not-attending applicants never count toward the stat tiles.
    if (a.status === 'withdrawn') return false;
    if (!a.attending) return false;
    if (filters.role.size > 0 && !filters.role.has(a.role)) return false;
    // Committee is a scoping dimension like role/date (not something the tiles
    // let you click into), so the tiles count within it.
    if (filters.committee && a.assigned_committee_id !== filters.committee) return false;
    if (filters.dateFrom && a.submitted_at && a.submitted_at.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && a.submitted_at && a.submitted_at.slice(0, 10) > filters.dateTo) return false;
    return true;
  });
  const stats = {
    total: statScope.length,
    // "Accepted" means accepted-or-BEYOND: once a delegate is allocated their
    // status flips to 'assigned' (and to 'checked-in' on arrival), but they are
    // still, by definition, accepted. Counting only status==='accepted' would
    // undercount and make "allocated" look larger than "accepted" (impossible).
    // So Accepted = accepted + assigned + checked-in, and Allocated (below) is
    // always a strict subset of it.
    accepted: statScope.filter(a => a.status === 'accepted' || a.status === 'assigned' || a.status === 'checked-in').length,
    // Delegates only, matching the rows the Allocated view actually renders.
    // Chairs get status 'assigned' when they are put on a dais
    // (assignment/page.tsx), so counting every 'assigned' row made the tile
    // read higher than the list beneath it — the tile said 12, the view showed
    // 9, and nothing on screen explained the missing three.
    assigned: statScope.filter(a =>
      (a.status === 'assigned' || a.status === 'checked-in')
      // Mirrors the row predicate at :2506 exactly, so the tile can never
      // disagree with the list beneath it in either direction. Chairs get
      // status 'assigned' when put on a dais (assignment/page.tsx), which made
      // the tile read 12 over a 9-row list; ticking Chairs in Participants
      // brings them back to both at once.
      && !(NON_DELEGATE_ROLES.has(a.role) && !filters.role.has(a.role))
    ).length,
    checkedIn: statScope.filter(a => a.status === 'checked-in').length,
    paid: statScope.filter(a => a.payment_status === 'paid').length,
    // Unpaid excludes chairs unless this conference configured a chair fee.
    unpaid: statScope.filter(a => (a.role !== 'chair' || chairHasFee) && (a.payment_status == null || a.payment_status === 'unpaid')).length,
  };

  // Clickable stat-tile filters (#10). Status tiles clear payment and vice
  // versa; clicking the active tile again clears it. Total resets to default.
  // The Accepted / Allocated tiles now count status GROUPS (accepted-or-beyond
  // and allocated-or-beyond), so their filters select the whole matching group
  // rather than a single status — keeping the visible list in step with the
  // number on the tile.
  // ACCEPTED_GROUP / ALLOCATED_GROUP live at module scope — the ?status= deep
  // link resolves to the same arrays, so tile and link can never disagree.
  const statusTileActive = (v: string) => filters.status.size === 1 && filters.status.has(v) && filters.payment.size === 0;
  const statusGroupTileActive = (group: string[]) => sameSet(filters.status, group) && filters.payment.size === 0;
  const paymentTileActive = (v: string) => filters.payment.size === 1 && filters.payment.has(v) && filters.status.size === 0;
  const totalTileActive =
    filters.status.size === 0 && filters.payment.size === 0 && !filters.notAttending &&
    !filters.dateFrom && !filters.dateTo && !filters.committee && sameSet(filters.role, DEFAULT_ROLES);
  const clearToDefault = () => setFilters({ status: new Set(), role: new Set(DEFAULT_ROLES), payment: new Set(), dateFrom: '', dateTo: '', notAttending: false, committee: '' });
  const toggleStatusTile = (v: string) => setFilters(f => ({ ...f, payment: new Set(), status: (f.status.size === 1 && f.status.has(v)) ? new Set() : new Set([v]) }));
  const toggleStatusGroupTile = (group: string[]) => setFilters(f => ({ ...f, payment: new Set(), status: sameSet(f.status, group) ? new Set() : new Set(group) }));
  const togglePaymentTile = (v: string) => setFilters(f => ({ ...f, status: new Set(), payment: (f.payment.size === 1 && f.payment.has(v)) ? new Set() : new Set([v]) }));

  // Order (#10): Total, Accepted, Allocated, Paid, Unpaid, Checked in — Checked
  // in rightmost. Every tile applies its matching filter on click. Allocated is
  // shown as a fraction of Accepted ("29 / 32") so it can never read as larger
  // than the pool it is drawn from.
  const statItems: { label: string; value: number | string; emoji: string; icon: typeof Inbox; gradient: [string, string]; active: boolean; onClick: () => void }[] = [
    { label: 'Total',      value: stats.total,     emoji: 'Card index',          icon: Users,          gradient: NEU_GRADIENTS.forest, active: totalTileActive,           onClick: clearToDefault },
    { label: 'Accepted',   value: stats.accepted,  emoji: 'Check mark button',   icon: Check,          gradient: NEU_GRADIENTS.green,  active: statusGroupTileActive(ACCEPTED_GROUP),  onClick: () => toggleStatusGroupTile(ACCEPTED_GROUP) },
    { label: 'Allocated',  value: `${stats.assigned} / ${stats.accepted}`, emoji: 'Round pushpin', icon: BadgeCheck, gradient: NEU_GRADIENTS.gold, active: statusGroupTileActive(ALLOCATED_GROUP), onClick: () => toggleStatusGroupTile(ALLOCATED_GROUP) },
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
          {/* Quick-filter search (#2): debounced, case-insensitive, matches any
              applicant detail. Neumorphic pressed-in well to match the system. */}
          <div
            className="inline-flex items-center gap-2"
            style={{ padding: '8px 14px', borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, minWidth: 200 }}
          >
            <Search size={15} strokeWidth={2.4} style={{ color: NEU.muted, flexShrink: 0 }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search applicants…"
              aria-label="Search applications"
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
          {/* Per-committee filter, alongside the existing filters. */}
          <CommitteeFilter
            options={committeeOptions}
            value={filters.committee}
            onChange={id => setFilters(f => ({ ...f, committee: id }))}
          />
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
          payment/date filter can never silently hide rows again. Withdrawn/
          removed applicants are excluded from the default view on purpose
          (not a user-applied filter), so they're left out of this count too. */}
      {!loading && filtered.length < defaultScopeCount && (
        <p className="mb-3" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.muted }}>
          Showing {filtered.length} of {defaultScopeCount} — filters active
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
          {/* The whole card is the preview affordance (#1) — the separate
              PREVIEW button is gone, so it can never be clipped by the card's
              own overflow again. A tint on hover and an inset ring on
              keyboard focus make it read as clickable in both modalities. */}
          <style>{`
            .appRowOpen { cursor: pointer; outline: none; transition: background-color 180ms ${EASE_LOCAL}; }
            .appRowOpen:hover { background-color: rgba(27,56,40,0.022); }
            .appRowOpen:focus-visible { box-shadow: inset 0 0 0 2.5px ${NEU.forest}; background-color: rgba(27,56,40,0.03); }
          `}</style>
          {filtered.map(app => {
            const name = app.profiles?.display_name ?? app.invited_name ?? 'Unknown';
            const email = app.profiles?.email ?? app.invited_email ?? '';
            const isDelegate = app.role === 'delegate' || app.role === 'head-delegate';
            const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);

            // No recorded level → treat as the lowest tier "beginner" (#11).
            const expLabel = app.profiles?.mun_experience_level ?? app.experience_level ?? 'beginner';
            const confCount = app.user_id ? cvCounts[app.user_id] : undefined;
            const rowQuestions = questionsOf(normalizeBlocks(roleConfigs.find(rc => rc.role === app.role)?.custom_questions ?? []), { includeArchived: true });
            const age = ageForApp(app, rowQuestions);
            const nationality = app.profiles?.nationality ?? null;
            const natCode = resolveRealCountryCode(nationality);
            const selected = selectedIds.has(app.id);

            const pledgeLine = app.pledge_type === 'delegation'
              ? `Pledged ${app.spots_pledged ?? 0} delegation spots`
              : null;
            const rowBusy = busyIds.has(app.id);
            const busyStyle: React.CSSProperties = rowBusy ? { opacity: 0.5, pointerEvents: 'none' } : {};
            // Not attending reads as inactive: everything but the NOT
            // ATTENDING badge fades to ~45% AND is hard-locked (no pointer
            // events, no handlers firing) — not just dimmed, genuinely
            // disabled, restored the moment they're marked attending again.
            // The card click itself is never locked: opening the preview is
            // how an organiser flips attendance back on.
            const notAttendingFade: React.CSSProperties = !app.attending ? { opacity: 0.45 } : {};
            const notAttendingLock: React.CSSProperties = !app.attending ? { opacity: 0.45, pointerEvents: 'none' } : {};
            const hasAllocation = !!app.assigned_committee && (app.status === 'assigned' || app.status === 'checked-in');
            const canCheckIn = app.status === 'accepted' || app.status === 'assigned';
            const isSubmitted = app.status === 'submitted';
            // Chairs are feeless by default — no payment affordance — unless
            // this conference configured a chair fee, in which case they get
            // the exact same treatment as any other role (#5).
            const isChair = app.role === 'chair';
            const isInvitedChair = isChair && app.fee_waiver_source === 'chair_invite';
            const showPayControl = (!isChair || chairHasFee) && (app.status === 'accepted' || app.status === 'assigned' || app.status === 'submitted' || app.status === 'checked-in');

            const factStyle: React.CSSProperties = {
              fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: NEU.muted,
              fontVariantNumeric: 'tabular-nums',
            };
            const chip = (bg: string, color: string, border: string): React.CSSProperties => ({
              fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em',
              padding: '3px 9px', borderRadius: 999, backgroundColor: bg, color, border: `1px solid ${border}`,
              whiteSpace: 'nowrap',
            });

            // Anything that is itself interactive keeps its own behaviour and
            // must NOT also open the preview. Checked by ancestry rather than
            // by hoping every control remembers to stopPropagation.
            const openPreviewFromRow = (e: React.MouseEvent<HTMLElement>) => {
              const hit = (e.target as HTMLElement | null)?.closest(
                'button, a, input, textarea, select, label, [role="menu"], [role="listbox"], [data-no-row-open]',
              );
              if (hit && hit !== e.currentTarget) return;
              setReviewId(app.id);
            };

            return (
              <NeuCard
                key={app.id}
                hover
                style={{ padding: 0, overflow: 'hidden', position: 'relative', outline: selected ? `2px solid ${NEU.forest}` : 'none', outlineOffset: -2 }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${name}'s application`}
                  onClick={openPreviewFromRow}
                  onKeyDown={e => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                      e.preventDefault();
                      setReviewId(app.id);
                    }
                  }}
                  className="appRowOpen flex flex-col lg:flex-row lg:items-stretch"
                >

                  {/* LEFT · select + identity + facts */}
                  <div className="flex items-start gap-3 p-4 lg:p-5" style={{ flex: '1 1 0', minWidth: 0, ...notAttendingFade }}>
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
                        {/* Age reads as part of the name: "Ada Lovelace, 23".
                            Derived from profiles.date_of_birth, falling back to
                            any date-of-birth custom answer (ageForApp). No age
                            on file → the name alone, never a trailing comma. */}
                        <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 19.5, fontWeight: 800, color: NEU.ink, maxWidth: '100%', letterSpacing: '-0.01em' }}>
                          {name}{age !== null ? `, ${age}` : ''}
                        </p>
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
                        // Clicking the delegation/society name opens its members
                        // in a popup (#6). stopPropagation so it doesn't also
                        // fire the row's open-preview click.
                        app.society_id ? (
                          <button
                            onClick={e => { e.stopPropagation(); setDelegationView({ id: app.society_id!, name: app.societies!.name }); }}
                            title={`View ${app.societies.name} delegation`}
                            className="flex items-center gap-1.5 truncate max-w-full focus:outline-none group"
                            style={{ marginTop: 5, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: NEU.ink, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                          >
                            <Building2 size={15} strokeWidth={2.4} style={{ color: NEU.deepGold, flexShrink: 0 }} />
                            <span className="truncate" style={{ textDecoration: 'underline', textDecorationColor: 'rgba(154,138,120,0.4)', textUnderlineOffset: 3 }}>{app.societies.name}</span>
                          </button>
                        ) : (
                          <p className="flex items-center gap-1.5 truncate" style={{ marginTop: 5, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: NEU.ink }} title={app.societies.name}>
                            <Building2 size={15} strokeWidth={2.4} style={{ color: NEU.deepGold, flexShrink: 0 }} />
                            <span className="truncate">{app.societies.name}</span>
                          </p>
                        )
                      )}

                      {/* Age moved up beside the name (#3), so no separate age
                          fact sits here any more. */}
                      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-2.5">
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
                        (#1), so no separate emblem sits here.

                        FIXED SLOT (#4): the level pill is laid out inside a
                        reserved, constant-width column, so "Delegate",
                        "Head Delegate", "Faculty Advisor" and "Chair" all sit
                        at the same x on every row and none of them reflows the
                        rest of the card. The width is sized to the longest
                        label so nothing is ever truncated; longer combinations
                        (chair + INVITED) wrap inside the slot rather than
                        widening it. */}
                    <div
                      className="flex flex-col items-center gap-2 flex-shrink-0"
                      style={{ width: LEVEL_SLOT_W, minWidth: LEVEL_SLOT_W, maxWidth: LEVEL_SLOT_W }}
                    >
                      <div className="flex items-center justify-center gap-1.5 flex-wrap" style={{ width: '100%' }}>
                        <RolePill role={app.role} size="sm" />
                        {isInvitedChair && <InvitedChip />}
                      </div>
                      <LevelBadge level={expLabel} count={confCount} />
                    </div>
                  </div>

                  {/* MIDDLE · allocation / preferences — the focal point of the
                      row now the role has moved to the identity column (#6). */}
                  <div
                    className="p-4 lg:p-5 flex flex-col justify-center gap-3 border-t lg:border-t-0 lg:border-l"
                    style={{ flex: '1 1 0', minWidth: 0, borderColor: 'rgba(221,212,192,0.6)' }}
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
                      // Redesign (#4): preferences and the allocate control now
                      // STACK vertically. Top — a large committee emblem (the
                      // top-choice committee) with the three preferences laid
                      // out beside it. Bottom — one clear, full-width allocate
                      // CTA. All existing allocation logic/handlers unchanged.
                      <div className="flex flex-col gap-3.5">
                        <div className="flex items-center gap-4 min-w-0">
                          <LogoDisc
                            src={prefs[0].conference_committees?.logo_url ?? null}
                            size={72}
                            fallbackText={committeeAbbr(prefs[0].conference_committees)}
                            alt={prefs[0].conference_committees?.name ?? 'Top preference'}
                          />
                          <div className="min-w-0 flex-1">
                            <p style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                              Preferences
                            </p>
                            <div className="flex flex-col gap-1">
                              {prefs.slice(0, 3).map(p => (
                                <span
                                  key={p.preference_order}
                                  className="inline-flex items-center gap-1.5 w-fit max-w-full"
                                  title={`${p.conference_committees?.name ?? 'Unknown'} · ${p.country_name}`}
                                  style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, backgroundColor: NEU.base, boxShadow: NEU.inSm, borderRadius: 999, padding: '4px 10px', fontVariantNumeric: 'tabular-nums' }}
                                >
                                  <span style={{ color: NEU.deepGold, fontWeight: 900 }}>{p.preference_order}.</span>
                                  <span className="truncate">{committeeAbbr(p.conference_committees)}</span>
                                  <CountryFlag name={p.country_name} code={p.country_code} size={15} />
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <span style={{ display: 'block', ...notAttendingLock }}>
                          <QuickAllocate big committees={allocCommittees} loading={allocLoading} onOpen={loadAllocCommittees} onAllocate={(c, s) => handleQuickAllocate(app, c, s)} />
                        </span>
                      </div>
                    ) : isDelegate ? (
                      <span className="inline-flex items-center gap-2">
                        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontStyle: 'italic', color: NEU.muted }}>Not yet assigned</span>
                        <span style={notAttendingLock}>
                          <QuickAllocate committees={allocCommittees} loading={allocLoading} onOpen={loadAllocCommittees} onAllocate={(c, s) => handleQuickAllocate(app, c, s)} />
                        </span>
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

                  {/* RIGHT · status/payment + actions. Fixed-width rail so the
                      divider between the middle and this column lands at the
                      same point on every card, and the left/middle columns
                      split the remaining space evenly (their shared divider is
                      always centered). Every control in here is a real button,
                      so the card-level closest() guard (#1) already keeps them
                      from opening the preview — the column no longer swallows
                      clicks wholesale, which would have made its empty space
                      the one dead zone on an otherwise clickable card. */}
                  <div
                    className="p-4 lg:p-5 flex flex-col lg:items-end gap-2.5 justify-center border-t lg:border-t-0 lg:border-l"
                    style={{ flex: '0 0 248px', minWidth: 248, borderColor: 'rgba(221,212,192,0.6)' }}
                  >
                    {/* NOT ATTENDING stays full-strength while everything else
                        in this column fades, so it never gets lost in the dim. */}
                    {!app.attending && (
                      <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
                        <NotAttendingBadge />
                      </div>
                    )}
                    <div className="flex flex-col lg:items-end gap-2.5" style={{ width: '100%' }}>
                    <div className="flex items-center gap-1.5 flex-wrap lg:justify-end" style={notAttendingFade}>
                      <StatusPill
                        status={app.status}
                        awaitingResubmission={app.status === 'rejected' && (roleConfigs.find(rc => rc.role === app.role)?.allow_resubmission ?? false)}
                      />
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
                      <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: '#1F6E52', fontVariantNumeric: 'tabular-nums', ...notAttendingFade }}>
                        <UserRoundCheck size={12} strokeWidth={2.5} />
                        Checked in {formatDateTime(app.checked_in_at)}
                      </span>
                    )}

                    {/* Undecided (#5): ACCEPT and REJECT are the two things this
                        pane is FOR, so they take it over as full-width buttons
                        rather than small chips. Once a decision is made the
                        pane falls back to its existing compact controls (check
                        in / payment / reinstate). Same handlers as before —
                        handleAccept and the shared reject flow, both of which
                        write decided_by / decided_at. Locked (not just dimmed)
                        while not attending. */}
                    {isSubmitted && (
                      <div style={{ width: '100%' }}>
                        {renderBigDecisionControls(app, !app.attending)}
                      </div>
                    )}

                    {/* Reinstate for rejected / awaiting-resubmission applicants —
                        undo a rejection in one click, right where REJECT sits
                        for submitted applicants. Also a status control, locked
                        while not attending. */}
                    {app.status === 'rejected' && (
                      <div className="flex items-center gap-1.5 flex-wrap lg:justify-end" style={notAttendingLock}>
                        <button
                          onClick={() => openReinstateConfirm(app)}
                          disabled={rowBusy || !app.attending}
                          className="inline-flex items-center gap-1.5 focus:outline-none transition-colors"
                          style={{
                            padding: '7px 14px', borderRadius: 999,
                            fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            color: '#1C1410', backgroundColor: 'transparent', border: '1px solid #DDD4C0', cursor: 'pointer', ...busyStyle,
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <RotateCcw size={13} strokeWidth={2.6} />
                          REINSTATE
                        </button>
                      </div>
                    )}

                    {/* Check-in stacked above the payment control. CHECK IN /
                        UNDO CHECK-IN / PAYMENT / DELETE all lock while not
                        attending; the preview is reached by clicking the card
                        itself (#1), which never locks — it's how an organizer
                        flips them back. */}
                    <div className="flex flex-col items-stretch gap-1.5" style={{ minWidth: 176, width: '100%' }}>
                      {canCheckIn && (
                        /* Cream / neutral until checked in — it turns green only
                           once they have actually checked in (#9). */
                        <button
                          onClick={() => handleCheckIn(app)}
                          disabled={rowBusy || !app.attending}
                          className="inline-flex items-center justify-center gap-1.5 focus:outline-none"
                          style={{
                            padding: '8px 14px', borderRadius: 999,
                            fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            color: NEU.ink,
                            backgroundColor: NEU.surface,
                            boxShadow: NEU.outSm,
                            border: 'none', cursor: 'pointer', ...busyStyle, ...notAttendingLock,
                          }}
                        >
                          <UserRoundCheck size={13} strokeWidth={2.6} style={{ color: NEU.green }} />
                          CHECK IN
                        </button>
                      )}
                      {app.status === 'checked-in' && (
                        <button
                          onClick={() => handleUndoCheckIn(app)}
                          disabled={rowBusy || !app.attending}
                          className="inline-flex items-center justify-center gap-1.5 focus:outline-none"
                          style={{
                            padding: '8px 14px', borderRadius: 999,
                            fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: 'pointer', ...busyStyle, ...notAttendingLock,
                          }}
                        >
                          <Undo2 size={12} strokeWidth={2.5} />
                          UNDO CHECK-IN
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 lg:justify-end">
                        {showPayControl ? (
                          <span style={notAttendingLock}>
                            <PaymentMenu
                              app={app}
                              disabled={rowBusy || !app.attending}
                              paymentsLive={paymentsLive}
                              align="right"
                              onMarkPaid={() => handleMarkPaid(app)}
                              onRemind={() => handleRemindPay(app)}
                              onMarkUnpaid={() => handleMarkUnpaid(app)}
                              onUndoWaive={() => handleUndoWaive(app)}
                            />
                          </span>
                        ) : isInvitedChair ? (
                          <WaivedChip />
                        ) : null}
                        {!app.user_id && (
                          <span style={notAttendingLock}>
                            <button
                              onClick={() => openDeleteRowConfirm(app)}
                              disabled={rowBusy || !app.attending}
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
                          </span>
                        )}
                      </div>
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
            {notAttendingSelectedCount > 0 && (
              <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: '#9A6B2F', fontStyle: 'italic' }}>
                {notAttendingSelectedCount} not-attending selection{notAttendingSelectedCount === 1 ? '' : 's'} were skipped.
              </span>
            )}
            <span style={{ width: 1, height: 22, background: 'rgba(154,138,120,0.3)' }} />

            {(() => {
              // Attendance-filtered too (bulkEligibleApps), so blockedCount
              // below reflects fee-blocked exclusions only — a not-attending
              // submitted row is accounted for by the skipped-selection note,
              // not miscounted here as "unpaid".
              const submittedSelected = bulkEligibleApps.filter(a => a.status === 'submitted');
              const blockedCount = submittedSelected.length - bulkAcceptable.length;
              if (submittedSelected.length === 0) return null;
              return bulkAcceptable.length > 0 ? (
                <button
                  onClick={() => runBulk(bulkAcceptable, { title: `Accept ${bulkAcceptable.length} application${bulkAcceptable.length === 1 ? '' : 's'}?`, body: 'Each will be accepted and any acceptance emails / auto-cover will run per applicant.', confirmLabel: 'Accept all' }, a => handleAccept(a.id))}
                  title={blockedCount > 0 ? `${blockedCount} selected application${blockedCount === 1 ? '' : 's'} excluded. ${ACCEPT_BLOCKED_MESSAGE}` : undefined}
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
                  {blockedCount > 0 && ` (${blockedCount} unpaid)`}
                </button>
              ) : (
                <span
                  title={ACCEPT_BLOCKED_MESSAGE}
                  className="inline-flex items-center gap-1.5"
                  style={{
                    padding: '8px 15px', borderRadius: 999, border: '1px solid rgba(184,132,74,0.4)', cursor: 'not-allowed',
                    fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em', color: '#9A6B2F',
                    backgroundColor: 'rgba(184,132,74,0.1)',
                  }}
                >
                  <Check size={14} strokeWidth={2.8} />
                  Accept fee unpaid
                </span>
              );
            })()}
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
        // No recorded level → treat as "beginner" (#11).
        const expLabel = app.profiles?.mun_experience_level ?? app.experience_level ?? 'beginner';
        const confCount = app.user_id ? cvCounts[app.user_id] : undefined;
        const roleConfig = roleConfigs.find(rc => rc.role === app.role);
        // Includes archived questions so a deleted question's answer stays
        // labeled and readable, never falling through to the orphaned-answer
        // fallback below.
        const questions = questionsOf(normalizeBlocks(roleConfig?.custom_questions ?? []), { includeArchived: true });
        const answers = app.custom_answers ?? {};
        // Keys in custom_answers with no matching question at all (archived
        // or current) — the question was removed before archiving existed, or
        // the id was never a real question. Their answer is still shown
        // (never silently dropped), just without a matching label.
        const questionIds = new Set(questions.map(q => q.id));
        const orphanedAnswers = Object.entries(answers).filter(([key]) => !questionIds.has(key));
        // Financial aid: the linked financial_aid_requests row (fetched on demand,
        // previewAid) is the source of truth when present; the denormalized
        // columns on the application row are checked too so a request is never
        // missed if that row hasn't loaded yet (or doesn't exist for any reason).
        const aidStatus = previewAid?.status ?? (app.aid_status && app.aid_status !== 'none' ? app.aid_status : null);
        const hasAidRequest = !!previewAid || app.aid_requested || !!aidStatus;
        const aidStatement = previewAid?.statement ?? app.aid_statement;
        const aidRequestedAmount = previewAid?.requested_amount ?? app.aid_requested_amount;
        const aidCurrency = roleConfig?.fee_currency ?? 'GBP';
        const closeReview = () => { setReviewId(null); setRejectingId(null); setRejectNote(''); };
        // Double-click guard, the row's controls grey out while its write is in flight.
        const rowBusy = busyIds.has(app.id);
        const busyStyle: React.CSSProperties = rowBusy ? { opacity: 0.5, pointerEvents: 'none' } : {};
        // Not attending: every status-changing action in this modal fades AND
        // hard-locks (disabled attribute + no pointer events) — only MARK
        // ATTENDING (attendanceControls flips to that label automatically)
        // and REMOVE FROM CONFERENCE (its own payment guard, untouched) stay
        // fully active. Restores the moment they're marked attending again.
        const notAttendingLock: React.CSSProperties = !app.attending ? { opacity: 0.45, pointerEvents: 'none' } : {};

        // Chairs are feeless by default — no payment control — unless this
        // conference configured a chair fee, matching any other role (#5).
        const showPaymentControls = (app.role !== 'chair' || chairHasFee)
          && (app.status === 'accepted' || app.status === 'assigned' || app.status === 'submitted' || app.status === 'checked-in');
        // Unified payment control (F: merge mark-paid vs waive). One menu, both
        // underlying states still reachable. An invited chair whose role has
        // no configured fee gets the static WaivedChip instead — there's no
        // PaymentMenu to show it there.
        const paymentControls = showPaymentControls ? (
          <span style={notAttendingLock}>
            <PaymentMenu
              app={app}
              disabled={rowBusy || !app.attending}
              paymentsLive={paymentsLive}
              onMarkPaid={() => handleMarkPaid(app)}
              onRemind={() => handleRemindPay(app)}
              onMarkUnpaid={() => handleMarkUnpaid(app)}
              onUndoWaive={() => handleUndoWaive(app)}
            />
          </span>
        ) : (app.role === 'chair' && app.fee_waiver_source === 'chair_invite') ? (
          <WaivedChip />
        ) : null;

        const rejectControls = renderRejectControls(app, !app.attending);

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

        // Not attending toggle: accepted/assigned/checked-in only, same pool
        // this action applies to in the Delegations/Independents views.
        const attendanceControls = app.attending ? (
          <button
            onClick={() => openNotAttendingConfirm(app)}
            disabled={rowBusy}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ backgroundColor: 'rgba(154,138,120,0.1)', color: '#6B5F52', border: '1px solid rgba(154,138,120,0.3)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(154,138,120,0.18)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(154,138,120,0.1)'; }}
          >
            <UserX size={13} />
            MARK NOT ATTENDING
          </button>
        ) : (
          <button
            onClick={() => handleMarkAttending(app)}
            disabled={rowBusy}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#2F6644', border: '1px solid rgba(61,122,82,0.3)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
          >
            <Undo2 size={13} />
            MARK ATTENDING
          </button>
        );

        // Check-in controls: mark on-site attendance (accepted/assigned) or
        // reverse it (checked-in). Same optimistic handlers as the row buttons.
        const checkInControls = (app.status === 'accepted' || app.status === 'assigned') ? (
          <button
            onClick={() => handleCheckIn(app)}
            disabled={rowBusy || !app.attending}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#2F6644', border: '1px solid rgba(61,122,82,0.3)', fontFamily: "'Outfit', sans-serif", ...busyStyle, ...notAttendingLock }}
          >
            <UserRoundCheck size={13} />
            CHECK IN
          </button>
        ) : app.status === 'checked-in' ? (
          <button
            onClick={() => handleUndoCheckIn(app)}
            disabled={rowBusy || !app.attending}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle, ...notAttendingLock }}
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
                    {app.role === 'chair' && app.fee_waiver_source === 'chair_invite' && <InvitedChip />}
                    <StatusPill
                      status={app.status}
                      size="sm"
                      awaitingResubmission={app.status === 'rejected' && (roleConfig?.allow_resubmission ?? false)}
                    />
                    {!app.attending && <NotAttendingBadge size="sm" />}
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

              {/* Financial aid (read-only — approve/deny still lives on the Financial Aid tab) */}
              {hasAidRequest && (
                <div className="rounded-xl px-4 py-3.5 mb-4" style={{ backgroundColor: 'rgba(184,132,74,0.07)', border: '1px solid rgba(184,132,74,0.25)' }}>
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <p className="flex items-center gap-2 text-xs" style={{ color: '#8A6614', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.1em' }}>
                      <HeartHandshake size={13} />
                      FINANCIAL AID REQUESTED
                    </p>
                    {aidStatus && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                        style={{
                          fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em',
                          backgroundColor: (AID_STATUS_STYLES[aidStatus] ?? AID_STATUS_STYLES.pending).bg,
                          color: (AID_STATUS_STYLES[aidStatus] ?? AID_STATUS_STYLES.pending).color,
                          border: `1px solid ${(AID_STATUS_STYLES[aidStatus] ?? AID_STATUS_STYLES.pending).border}`,
                        }}
                      >
                        {(AID_STATUS_STYLES[aidStatus] ?? AID_STATUS_STYLES.pending).label}
                      </span>
                    )}
                  </div>
                  {aidRequestedAmount != null && (
                    <p className="text-xs mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      Requested <span className="font-bold">{formatFee(aidRequestedAmount, aidCurrency)}</span>
                      {previewAid?.status === 'approved' && previewAid.granted_amount != null && (
                        <> · Granted <span className="font-bold">{formatFee(previewAid.granted_amount, aidCurrency)}</span></>
                      )}
                    </p>
                  )}
                  <p
                    className="text-sm whitespace-pre-wrap"
                    style={{ color: aidStatement ? '#1C1410' : '#9A8A78', fontFamily: "'Outfit', sans-serif", fontStyle: aidStatement ? 'normal' : 'italic' }}
                  >
                    {aidStatement || 'No statement provided.'}
                  </p>
                </div>
              )}

              {/* Custom answers */}
              <div className="pt-4" style={{ borderTop: '1px solid #F0EDE6' }}>
                <p className="flex items-center gap-2 text-xs mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
                  <MessageSquareText size={12} />
                  APPLICATION ANSWERS
                </p>
                {questions.length === 0 && orphanedAnswers.length === 0 ? (
                  <p className="text-xs italic" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                    No custom questions configured for this role.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {questions.map(q => {
                      const ans = displayAnswer(q, answers[q.id]);
                      return (
                        <div key={q.id}>
                          <p className="flex items-center gap-1.5 text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                            {q.label}
                            {q.archived && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ color: '#9A8A78', backgroundColor: 'rgba(154,138,120,0.14)', letterSpacing: '0.04em' }}
                              >
                                ARCHIVED
                              </span>
                            )}
                          </p>
                          <p className="text-sm whitespace-pre-wrap" style={{ color: ans ? '#1C1410' : '#9A8A78', fontFamily: "'Outfit', sans-serif", fontStyle: ans ? 'normal' : 'italic' }}>
                            {ans || 'No answer provided.'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {orphanedAnswers.length > 0 && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px dashed #DDD4C0' }}>
                    <p className="flex items-center gap-2 text-xs mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.1em' }}>
                      <MessageSquareText size={12} />
                      ADDITIONAL ANSWERS (QUESTION SINCE CHANGED)
                    </p>
                    <div className="flex flex-col gap-3">
                      {orphanedAnswers.map(([key, value]) => {
                        const ans = Array.isArray(value) ? value.join(', ') : value;
                        return (
                          <div key={key}>
                            <p className="text-xs italic mb-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                              This question no longer exists in the current form.
                            </p>
                            <p className="text-sm whitespace-pre-wrap" style={{ color: ans ? '#1C1410' : '#9A8A78', fontFamily: "'Outfit', sans-serif", fontStyle: ans ? 'normal' : 'italic' }}>
                              {ans || 'No answer provided.'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
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
              {app.status === 'submitted' && isAcceptBlockedByFee(app) && (
                <p
                  className="text-xs font-semibold mt-4 rounded-lg px-3 py-2"
                  style={{ color: '#9A6B2F', backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.3)', fontFamily: "'Outfit', sans-serif" }}
                >
                  {ACCEPT_BLOCKED_MESSAGE}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: '1px solid #F0EDE6' }}>
                {/* Undecided (#5): ACCEPT and REJECT dominate the pane as two
                    large full-width buttons instead of small chips. The moment
                    the application is accepted or rejected this branch stops
                    rendering and the existing compact controls below take over.
                    Wired to handleAccept and the shared reject flow — the same
                    handlers as before, decided_by / decided_at included. */}
                {app.status === 'submitted' && (
                  <>
                    <div style={{ width: '100%' }}>
                      {renderBigDecisionControls(app, !app.attending)}
                    </div>
                    {paymentControls}
                  </>
                )}

                {app.status === 'accepted' && (
                  <>
                    {isDelegate && (
                      <span style={notAttendingLock}>
                        <Link
                          href={`/manage/${conference.slug}/assignment`}
                          className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none"
                          style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", textDecoration: 'none' }}
                        >
                          ASSIGN
                          <ArrowRight size={13} />
                        </Link>
                      </span>
                    )}
                    {checkInControls}
                    {paymentControls}
                    {rejectControls}
                    {withdrawControls}
                    {attendanceControls}
                  </>
                )}

                {app.status === 'assigned' && (
                  <>
                    {checkInControls}
                    {paymentControls}
                    {withdrawControls}
                    {attendanceControls}
                  </>
                )}

                {app.status === 'checked-in' && (
                  <>
                    {checkInControls}
                    {paymentControls}
                    {withdrawControls}
                    {attendanceControls}
                  </>
                )}

                {app.status === 'rejected' && (
                  <button
                    onClick={() => openReinstateConfirm(app)}
                    disabled={rowBusy || !app.attending}
                    className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle, ...notAttendingLock }}
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
                    disabled={rowBusy || !app.attending}
                    className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle, ...notAttendingLock }}
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

      {/* Delegation / society popup (#6). Lists every applicant sharing this
          society, drawn from the already-loaded applications — no extra fetch.
          Rows mirror the review modal styling and open that member's own
          preview on click. */}
      {delegationView && (() => {
        const members = applications
          .filter(a => a.society_id === delegationView.id)
          .sort((a, b) => {
            // Head delegate first, then by name.
            if (a.is_head_delegate !== b.is_head_delegate) return a.is_head_delegate ? -1 : 1;
            const an = a.profiles?.display_name ?? a.invited_name ?? '';
            const bn = b.profiles?.display_name ?? b.invited_name ?? '';
            return an.localeCompare(bn);
          });
        const close = () => setDelegationView(null);
        const allocatedCount = members.filter(m => m.status === 'assigned' || m.status === 'checked-in').length;
        return (
          <Portal><div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={close}
          >
            <div
              className="w-full max-w-xl rounded-2xl p-7 overflow-y-auto"
              style={{ maxHeight: '85vh', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-5">
                <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Building2} size={46} />
                <div className="flex-1 min-w-0">
                  <p className="mb-0.5" style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: NEU.deepGold, textTransform: 'uppercase' }}>
                    Delegation
                  </p>
                  <h2 className="font-black text-lg truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }} title={delegationView.name}>{delegationView.name}</h2>
                  <p className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT, fontWeight: 600 }}>
                    {members.length} member{members.length === 1 ? '' : 's'} · {allocatedCount} allocated
                  </p>
                </div>
                <button
                  onClick={close}
                  aria-label="Close delegation"
                  className="flex-shrink-0 flex items-center justify-center rounded-lg focus:outline-none transition-colors"
                  style={{ width: 30, height: 30, border: '1px solid #DDD4C0', color: NEU.muted, backgroundColor: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <X size={15} />
                </button>
              </div>

              {members.length === 0 ? (
                <p className="text-center py-8" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.muted }}>
                  No members found for this delegation.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {members.map(m => {
                    const mName = m.profiles?.display_name ?? m.invited_name ?? 'Unknown';
                    const mAlloc = (m.status === 'assigned' || m.status === 'checked-in') && m.assigned_committee
                      ? committeeAbbr(m.assigned_committee)
                      : null;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setDelegationView(null); setReviewId(m.id); }}
                        className="flex items-center gap-3 w-full text-left focus:outline-none"
                        style={{ padding: '10px 12px', borderRadius: 14, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: 'pointer' }}
                      >
                        <MemberAvatar name={mName} url={m.profiles?.avatar_url ?? null} size={40} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: NEU.ink }}>{mName}</span>
                            {m.is_head_delegate && (
                              <span className="inline-flex items-center gap-1" style={{ fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.1)', color: NEU.forest, border: '1px solid rgba(27,56,40,0.2)' }}>
                                <Users size={8} strokeWidth={2.5} /> HEAD
                              </span>
                            )}
                          </div>
                          {mAlloc && (
                            <span className="inline-flex items-center gap-1.5 truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.muted, marginTop: 1 }}>
                              <BadgeCheck size={12} strokeWidth={2.4} style={{ color: NEU.deepGold }} />
                              {mAlloc}{m.assigned_country_name ? ` · ${m.assigned_country_name}` : ''}
                            </span>
                          )}
                        </div>
                        <RolePill role={m.role} size="sm" />
                        <StatusPill status={m.status} size="sm" awaitingResubmission={false} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div></Portal>
        );
      })()}

      {confirmModal}
    </div>
  );
}
