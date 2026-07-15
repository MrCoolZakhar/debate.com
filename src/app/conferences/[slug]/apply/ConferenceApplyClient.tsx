'use client';

import { Fragment, Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { ageAt } from '@/lib/age';
import { formatFee } from '@/lib/utils';
import { Pill } from '@/app/account/accountUi';
import { computeCheckout, localizedApproxSavings, activePhaseFee, type VoucherInput, type FeePhase } from '@/lib/finance';
import { queueEventEmail } from '@/lib/emailEvents';
import { NEU, NeuInset, NeuCard, OUTFIT, EASE } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';
import { FlagImg } from '@/components/FlagImg';
import { DatePicker } from '@/components/DatePicker';
import {
  Gavel, Mic, Users, Eye, Building2, User, ListOrdered, Sprout,
  GraduationCap, Trophy, Crown, ClipboardList, BadgeCheck, Sparkles,
  MapPin, Landmark, Check, X, Plus, ArrowLeft, ArrowRight, CalendarClock,
  Ticket, Infinity as InfinityIcon, Globe, Lock, ChevronUp, ChevronDown,
  HeartHandshake,
} from 'lucide-react';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// ── Types ──────────────────────────────────────────────────────────────────

/** Organiser-controlled: what a delegate may express as preferences. */
type PreferenceMode =
  | 'committees_and_countries'
  | 'committees_only'
  | 'countries_only'
  | 'none';

interface Conference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  fee_amount: number;
  fee_currency: string;
  start_date: string;
  min_age: number | null;
  logo_url: string | null;
  delegate_preference_mode: PreferenceMode;
}

interface RoleConfig {
  role: string;
  is_enabled: boolean;
  applications_open_at: string | null;
  applications_close_at: string | null;
  fee_amount: number;
  fee_currency: string;
  auto_accept: boolean;
  pay_at_application: boolean;
  payment_timing: 'after_application' | 'after_acceptance' | 'anytime' | string;
  custom_questions: Array<{ id: string; label: string; required: boolean; type: string }>;
  fee_phases: FeePhase[] | null;
  financial_aid_enabled: boolean;
}

interface CommitteeOption {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[];
  difficulty: string;
  total_slots: number;
  logo_url: string | null;
  committee_type: string | null;
}

interface CountrySlot {
  id: string;
  country_code: string;
  country_name: string;
}

interface Society {
  id: string;
  name: string;
  name_normalized: string;
}

interface Preference {
  committeeId: string;
  committeeName: string;
  countryCode: string;
  countryName: string;
}

/** The applicant's own existing application for this role — the "already
 *  applied" gate, and (when editable) the prefill source for edit mode. */
interface ExistingApp {
  id: string;
  status: string;
  is_independent: boolean;
  society_id: string | null;
  experience_level: string | null;
  custom_answers: Record<string, string> | null;
  pledge_type: 'delegation' | null;
  spots_pledged: number | null;
  aid_requested: boolean;
  aid_statement: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

type IconType = typeof Gavel;

/** lucide icon per applying-as role, for the Step 1 role tile. */
function roleIcon(role: string): IconType {
  if (role === 'observer') return Eye;
  if (role === 'head-delegate') return Users;
  if (role === 'chair') return Gavel;
  return Mic; // delegate
}

/** Escalating insignia per experience level (recruit → prestige). */
const EXPERIENCE_ICON: Record<string, IconType> = {
  beginner: Sprout,
  intermediate: GraduationCap,
  advanced: Trophy,
  expert: Crown,
};

const EXPERIENCE_ACCENT: Record<string, string> = {
  beginner: '#4A7896',
  intermediate: '#2A5A3C',
  advanced: '#B8844A',
  expert: '#B6871F',
};

/** Committee difficulty tier → label, accent colour and insignia. The four
 *  difficulty values map 1:1 to the experience tiers, so they reuse the same
 *  escalating insignia language. */
const DIFFICULTY_META: Record<string, { label: string; accent: string; icon: IconType }> = {
  beginner: { label: 'Beginner', accent: '#4A7896', icon: Sprout },
  intermediate: { label: 'Intermediate', accent: '#2A5A3C', icon: GraduationCap },
  advanced: { label: 'Advanced', accent: '#B8844A', icon: Trophy },
  expert: { label: 'Expert', accent: '#B6871F', icon: Crown },
};

/**
 * A gold-tinted rounded-square icon chip that anchors a step heading —
 * echoes the detail page's stat-strip icon chips.
 */
function StepHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: IconType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3.5 mb-6">
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '13px',
          background: 'linear-gradient(150deg, rgba(238,217,138,0.28), rgba(182,135,31,0.14))',
          border: '1.5px solid rgba(182,135,31,0.4)',
        }}
      >
        <Icon size={20} strokeWidth={2.1} style={{ color: '#B6871F' }} />
      </span>
      <div className="min-w-0 pt-0.5">
        <h2 style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '18px', lineHeight: 1.2 }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/** Icon per wizard step, keyed by label. */
const STEP_ICON: Record<string, IconType> = {
  Role: BadgeCheck,
  Society: Building2,
  Background: ClipboardList,
  Preferences: ListOrdered,
  Experience: GraduationCap,
};

/** SSR-safe prefers-reduced-motion hook. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

// ── Preference-picker building blocks ─────────────────────────────────────

/** Difficulty tier chip: escalating insignia + accent, tabular label. */
function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const meta = DIFFICULTY_META[difficulty];
  if (!meta) return null;
  const { label, accent, icon: Icon } = meta;
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        padding: '3px 9px 3px 7px',
        borderRadius: 999,
        background: `${accent}14`,
        border: `1px solid ${accent}44`,
        fontFamily: OUTFIT,
        fontWeight: 800,
        fontSize: 10,
        letterSpacing: '0.05em',
        color: accent,
      }}
    >
      <Icon size={12} strokeWidth={2.4} style={{ color: accent }} />
      {label}
    </span>
  );
}

/**
 * Rich, image-forward committee card. The committee emblem (logo_url via
 * LogoDisc, monogram fallback) leads; abbreviation, difficulty, topics and a
 * live availability meter follow. Tactile neumorphic press; a gold rank
 * medallion or check marks selection.
 */
function CommitteeCard({
  committee, openCount, totalCount, rank, active, disabled, showAvailability, onClick, reducedMotion,
}: {
  committee: CommitteeOption;
  openCount: number;
  totalCount: number;
  rank: number | null;
  active: boolean;
  disabled: boolean;
  showAvailability: boolean;
  onClick: () => void;
  reducedMotion: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const selected = rank != null || active;
  const monogram = (committee.abbreviation || committee.name).slice(0, 3).toUpperCase();
  const pct = totalCount > 0 ? Math.max(0, Math.min(1, openCount / totalCount)) : 0;
  const meterColor = openCount <= 0 ? '#8B2020' : openCount <= 2 ? '#B8844A' : NEU.green;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={selected}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-full text-left focus:outline-none"
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        padding: '16px 16px 15px',
        borderRadius: 20,
        backgroundColor: NEU.surface,
        border: selected ? '1.5px solid rgba(182,135,31,0.55)' : '1.5px solid transparent',
        boxShadow: selected
          ? `0 0 0 1px rgba(182,135,31,0.25), ${NEU.out}`
          : disabled ? NEU.inSm : hovered ? NEU.outHover : NEU.out,
        transform: !disabled && !reducedMotion && (hovered || selected) ? 'translateY(-2px)' : 'translateY(0)',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: reducedMotion ? 'none' : `box-shadow 240ms ${EASE}, transform 240ms ${EASE}, border-color 200ms ${EASE}`,
      }}
    >
      <LogoDisc src={committee.logo_url} alt={committee.name} size={54} fallbackText={monogram} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 3 }}>
          {committee.abbreviation && (
            <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 15, color: NEU.ink, letterSpacing: '0.01em' }}>
              {committee.abbreviation}
            </span>
          )}
          <DifficultyBadge difficulty={committee.difficulty} />
        </div>
        <p className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 12.5, color: NEU.muted, marginBottom: committee.topics?.length ? 8 : 0 }}>
          {committee.name}
        </p>

        {committee.topics?.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginBottom: showAvailability ? 10 : 0 }}>
            {committee.topics.slice(0, 2).map((t, i) => (
              <span
                key={i}
                className="truncate"
                style={{
                  maxWidth: 190, padding: '2.5px 8px', borderRadius: 999,
                  backgroundColor: 'rgba(27,56,40,0.06)', color: 'rgba(28,20,16,0.7)',
                  fontFamily: OUTFIT, fontWeight: 600, fontSize: 10.5,
                }}
              >
                {t}
              </span>
            ))}
            {committee.topics.length > 2 && (
              <span style={{ padding: '2.5px 6px', fontFamily: OUTFIT, fontWeight: 700, fontSize: 10.5, color: NEU.muted }}>
                +{committee.topics.length - 2}
              </span>
            )}
          </div>
        )}

        {showAvailability && (
          <div className="flex items-center gap-2.5">
            <div style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, overflow: 'hidden', maxWidth: 150 }}>
              <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 999, background: meterColor, transition: reducedMotion ? 'none' : `width 500ms ${EASE}` }} />
            </div>
            <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10.5, color: meterColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {openCount <= 0 ? 'FULL' : `${openCount} of ${totalCount} open`}
            </span>
          </div>
        )}
      </div>

      {/* Selection insignia: gold rank medallion (committees_only) or a check. */}
      {rank != null ? (
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 28, height: 28, borderRadius: 999,
            background: 'linear-gradient(150deg, #EED98A, #B6871F)',
            boxShadow: '0 3px 8px rgba(182,135,31,0.4)',
            fontFamily: OUTFIT, fontWeight: 900, fontSize: 13, color: '#3A2A08',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rank}
        </span>
      ) : active ? (
        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: NEU.forest }}>
          <Check size={16} strokeWidth={3} style={{ color: NEU.gold }} />
        </span>
      ) : disabled ? (
        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: 'rgba(139,32,32,0.1)' }}>
          <Lock size={13} strokeWidth={2.4} style={{ color: '#8B2020' }} />
        </span>
      ) : (
        <ChevronDown
          size={20}
          strokeWidth={2.4}
          style={{ color: NEU.muted, flexShrink: 0, transform: active ? 'rotate(180deg)' : 'none', transition: reducedMotion ? 'none' : `transform 200ms ${EASE}` }}
        />
      )}
    </button>
  );
}

/** Country slot as a flag chip. Taken → greyed + lock; selectable → tactile. */
function CountryChip({
  code, name, committeeLabel, taken, selected, onClick, reducedMotion,
}: {
  code: string;
  name: string;
  committeeLabel?: string;
  taken: boolean;
  selected: boolean;
  onClick: () => void;
  reducedMotion: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const resolved = code || getCountryByName(name)?.code || '';
  return (
    <button
      type="button"
      onClick={taken ? undefined : onClick}
      disabled={taken}
      aria-pressed={selected}
      title={taken ? `${name} — already taken` : name}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative inline-flex items-center gap-2 focus:outline-none"
      style={{
        padding: '7px 12px 7px 9px',
        borderRadius: 999,
        backgroundColor: selected ? NEU.forest : NEU.surface,
        border: selected ? '1.5px solid transparent' : taken ? '1.5px solid transparent' : '1.5px solid transparent',
        boxShadow: taken ? NEU.inSm : selected ? `0 3px 8px rgba(27,56,40,0.28), ${NEU.outSm}` : hovered ? NEU.outSmHover : NEU.outSm,
        opacity: taken ? 0.5 : 1,
        cursor: taken ? 'not-allowed' : 'pointer',
        transform: !taken && !reducedMotion && hovered && !selected ? 'translateY(-1px)' : 'none',
        transition: reducedMotion ? 'none' : `box-shadow 200ms ${EASE}, transform 200ms ${EASE}`,
        filter: taken ? 'grayscale(1)' : 'none',
      }}
    >
      <FlagImg code={resolved} size={22} />
      <span className="min-w-0">
        <span className="block truncate" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: selected ? NEU.gold : NEU.ink, maxWidth: 150 }}>
          {name}
        </span>
        {committeeLabel && (
          <span className="block truncate" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 9.5, color: selected ? 'rgba(238,217,138,0.7)' : NEU.muted, maxWidth: 150 }}>
            {committeeLabel}
          </span>
        )}
      </span>
      {taken ? (
        <Lock size={12} strokeWidth={2.4} style={{ color: '#8B2020', flexShrink: 0 }} />
      ) : selected ? (
        <Check size={14} strokeWidth={3} style={{ color: NEU.gold, flexShrink: 0 }} />
      ) : (
        <Plus size={14} strokeWidth={2.6} style={{ color: NEU.muted, flexShrink: 0 }} />
      )}
    </button>
  );
}

/** A confirmed preference in the ranked list: rank medallion + emblem/flag. */
function RankedRow({
  index, total, committee, countryCode, countryName, onUp, onDown, onRemove, reducedMotion,
}: {
  index: number;
  total: number;
  committee: CommitteeOption | undefined;
  countryCode: string;
  countryName: string;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  reducedMotion: boolean;
}) {
  const monogram = committee ? (committee.abbreviation || committee.name).slice(0, 3).toUpperCase() : '?';
  const resolved = countryCode || (countryName ? getCountryByName(countryName)?.code || '' : '');
  return (
    <div
      className="flex items-center gap-3"
      style={{ padding: '10px 12px', borderRadius: 16, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 26, height: 26, borderRadius: 999,
          background: 'linear-gradient(150deg, #EED98A, #B6871F)',
          fontFamily: OUTFIT, fontWeight: 900, fontSize: 12.5, color: '#3A2A08',
          fontVariantNumeric: 'tabular-nums', boxShadow: '0 2px 6px rgba(182,135,31,0.35)',
        }}
      >
        {index + 1}
      </span>

      {committee && <LogoDisc src={committee.logo_url} alt={committee.name} size={34} fallbackText={monogram} />}
      {countryCode ? <FlagImg code={resolved} size={22} /> : null}

      <div className="min-w-0 flex-1">
        <p className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13, color: NEU.ink }}>
          {countryName || committee?.abbreviation || committee?.name || 'Preference'}
        </p>
        <p className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 10.5, color: NEU.muted }}>
          {countryName && committee ? (committee.abbreviation || committee.name) : committee ? committee.name : ''}
        </p>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          type="button" onClick={onUp} disabled={index === 0} aria-label="Move up"
          className="flex items-center justify-center rounded-lg focus:outline-none"
          style={{ width: 26, height: 26, color: index === 0 ? 'rgba(154,138,120,0.35)' : NEU.muted, cursor: index === 0 ? 'default' : 'pointer' }}
        >
          <ChevronUp size={16} strokeWidth={2.4} />
        </button>
        <button
          type="button" onClick={onDown} disabled={index === total - 1} aria-label="Move down"
          className="flex items-center justify-center rounded-lg focus:outline-none"
          style={{ width: 26, height: 26, color: index === total - 1 ? 'rgba(154,138,120,0.35)' : NEU.muted, cursor: index === total - 1 ? 'default' : 'pointer' }}
        >
          <ChevronDown size={16} strokeWidth={2.4} />
        </button>
        <button
          type="button" onClick={onRemove} aria-label="Remove preference"
          className="flex items-center justify-center rounded-lg focus:outline-none"
          style={{ width: 26, height: 26, color: NEU.muted }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
        >
          <X size={15} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

// ── Inner component (requires Suspense for useSearchParams) ────────────────

function ConferenceApplyInner() {
  const { slug } = useParams() as { slug: string };
  const searchParams = useSearchParams();
  const role = searchParams.get('role') ?? 'delegate';
  // Edit-and-resubmit: opens the same stepper prefilled from the applicant's
  // own existing application for this role, instead of the fresh-apply flow.
  // Only takes effect once fetchAll confirms the application is actually in
  // an editable status (rejected or submitted), see `canEdit` below — never
  // trust the query param alone.
  const isEditMode = searchParams.get('edit') === '1';
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { user, session, loading: authLoading } = useAuth();

  // ── Data
  const [conference, setConference] = useState<Conference | null>(null);
  const [roleConfig, setRoleConfig] = useState<RoleConfig | null | undefined>(undefined);
  const [committees, setCommittees] = useState<CommitteeOption[]>([]);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [existingApp, setExistingApp] = useState<ExistingApp | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Age gate (conference.min_age), DOB comes from the user's profile
  const [myDob, setMyDob] = useState<string | null>(null);
  const [dobInput, setDobInput] = useState('');
  const [dobSaving, setDobSaving] = useState(false);
  const [dobError, setDobError] = useState('');

  // ── Step
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Step 2, Society
  const [isIndependent, setIsIndependent] = useState(false);
  const [societyInput, setSocietyInput] = useState('');
  const [societySuggestions, setSocietySuggestions] = useState<Society[]>([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState<string | null>(null);
  const [societyDropdownOpen, setSocietyDropdownOpen] = useState(false);
  const [societyError, setSocietyError] = useState('');

  // ── Step, Invoicing (head-delegate / faculty-advisor only). A pledge is
  // ONLY about paying for delegation spots, everyone's own fee flows through
  // the normal payment system, so this is a plain yes/no.
  const [willPledgeSpots, setWillPledgeSpots] = useState<boolean | null>(null);
  const [spotsPledged, setSpotsPledged] = useState<number | ''>('');
  const [invoicingError, setInvoicingError] = useState('');

  // ── Step 3, Preferences
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [countrySlots, setCountrySlots] = useState<Record<string, CountrySlot[]>>({});
  // Taken country_codes per committee (from get_taken_allocations RPC —
  // conference_allocations RLS hides other people's allocations, so a
  // privacy-safe SECURITY DEFINER function returns only the taken pairs).
  const [takenByCommittee, setTakenByCommittee] = useState<Record<string, Set<string>>>({});
  const [prefDataLoading, setPrefDataLoading] = useState(false);
  const [prefDataLoaded, setPrefDataLoaded] = useState(false);
  // full mode: which committee's country tray is expanded for picking.
  const [expandedCommitteeId, setExpandedCommitteeId] = useState<string | null>(null);
  const [prefError, setPrefError] = useState('');

  // ── Step 4, Experience & Questions
  const [experienceLevel, setExperienceLevel] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  // ── Step, Financial aid (optional, only shown when the role enables it)
  const [aidRequested, setAidRequested] = useState(false);
  const [aidStatement, setAidStatement] = useState('');

  // ── Checkout: vouchers + fee waivers (finance.ts is the single math source)
  const [financeProfile, setFinanceProfile] = useState({ is_ambassador: false, unlimited_conferences_remaining: 0 });
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherInput | null>(null);
  // Gavin upsell, geo country for the localized "~$10/mo" figure, plus a
  // localStorage dismiss so the banner never nags. Never blocks checkout.
  const [geoCountry, setGeoCountry] = useState<string | null>(null);
  const [upsellDismissed, setUpsellDismissed] = useState(true); // true until localStorage read

  useEffect(() => {
    try {
      setUpsellDismissed(localStorage.getItem('gavin-unlimited-upsell-dismissed') === '1');
    } catch { setUpsellDismissed(false); }
    fetch('/api/geo')
      .then(r => r.json())
      .then(g => setGeoCountry((g?.countryCode as string | null) ?? null))
      .catch(() => {});
  }, []);

  function dismissUpsell() {
    setUpsellDismissed(true);
    try { localStorage.setItem('gavin-unlimited-upsell-dismissed', '1'); } catch { /* ignore */ }
  }

  /** Human copy for validate_voucher's machine reasons. */
  function voucherReasonText(reason: string): string {
    switch (reason) {
      case 'not_found': return 'That code doesn’t match any voucher for this conference.';
      case 'inactive': return 'This voucher is no longer active.';
      case 'expired': return 'This voucher has expired.';
      case 'limit_reached': return 'This voucher has reached its redemption limit.';
      case 'already_redeemed': return 'You’ve already used this voucher.';
      default: return 'That code could not be applied. Please check it and try again.';
    }
  }

  async function handleApplyVoucher() {
    const code = voucherCode.trim().toUpperCase();
    if (!code || !session || !conference) return;
    setVoucherChecking(true);
    setVoucherError('');
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('validate_voucher', {
      p_code: code,
      p_conference_id: conference.id,
      p_context: 'conference_signup',
    });
    setVoucherChecking(false);
    const res = data as { valid: boolean; reason: string | null; voucher_id: string; kind: 'percent' | 'flat'; amount: number; currency: string | null } | null;
    if (error || !res) {
      setVoucherError('Could not check that code right now. Please try again.');
      return;
    }
    if (!res.valid) {
      setVoucherError(voucherReasonText(res.reason ?? ''));
      return;
    }
    setAppliedVoucher({ voucherId: res.voucher_id, code, kind: res.kind, amount: Number(res.amount), currency: res.currency });
  }

  // ── Age gate derivations, age is computed at the conference START DATE
  const minAgeLimit = conference?.min_age ?? null;
  const ageAtStart = minAgeLimit != null && myDob && conference ? ageAt(myDob, conference.start_date) : null;
  const underAge = minAgeLimit != null && ageAtStart !== null && ageAtStart < minAgeLimit;
  const needsDob = minAgeLimit != null && !myDob;

  const isPreferenceRole = role === 'delegate' || role === 'head-delegate';
  const isObserver = role === 'observer';
  const isInvoicingRole = role === 'head-delegate' || role === 'faculty-advisor';

  // ── Preference mode (organiser-controlled). Governs whether the Preferences
  // step appears at all, and which pickers it shows.
  const prefMode: PreferenceMode = conference?.delegate_preference_mode ?? 'committees_and_countries';
  const showPreferenceStep = isPreferenceRole && prefMode !== 'none';
  const showCommitteePick = prefMode === 'committees_and_countries' || prefMode === 'committees_only';
  const showCountryPick = prefMode === 'committees_and_countries' || prefMode === 'countries_only';
  const committeesOnly = prefMode === 'committees_only';
  const countriesOnly = prefMode === 'countries_only';

  // Availability, derived from the loaded slot + taken-allocation data.
  const committeeSlotInfo = (id: string) => {
    const slots = countrySlots[id] ?? [];
    const taken = takenByCommittee[id] ?? new Set<string>();
    const openCount = slots.filter(s => !taken.has(s.country_code)).length;
    return { slots, taken, total: slots.length, openCount, full: slots.length > 0 && openCount === 0 };
  };
  // committees_only ranks whole committees; the other modes rank countries.
  const availableUnitCount = committeesOnly
    ? committees.filter(c => !committeeSlotInfo(c.id).full).length
    : committees.reduce((n, c) => n + committeeSlotInfo(c.id).openCount, 0);
  const minPrefs = Math.min(3, availableUnitCount);

  // F15: faculty advisors skip Experience entirely, MUN experience level
  // doesn't apply to them, so experience_level submits null for this role.
  const skipExperience = role === 'faculty-advisor';

  // Organiser-controlled, per role (application_role_configs.financial_aid_enabled).
  const showAidStep = roleConfig?.financial_aid_enabled ?? false;

  const stepSequence = [
    'role',
    'society',
    ...(isInvoicingRole ? ['invoicing'] : []),
    ...(showPreferenceStep ? ['preferences'] : []),
    ...(showAidStep ? ['aid'] : []),
    ...(skipExperience ? [] : ['experience']),
  ] as const;
  type StepKind = (typeof stepSequence)[number];
  const totalSteps = stepSequence.length;
  const stepLabels = stepSequence.map((kind) => {
    switch (kind) {
      case 'role': return 'Role';
      case 'society': return isObserver ? 'Background' : 'Society';
      case 'invoicing': return 'Invoicing';
      case 'preferences': return 'Preferences';
      case 'aid': return 'Aid';
      case 'experience': return 'Experience';
    }
  });
  const currentStepKind: StepKind = stepSequence[step - 1] ?? 'role';

  // ── Auth gate + fetch
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth/signin?next=/conferences/${slug}/apply?role=${role}`);
      return;
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, slug, role]);

  async function fetchAll() {
    setLoading(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);

    const { data: confData } = await supabase
      .from('conferences')
      .select('id, slug, full_name, acronym, fee_amount, fee_currency, start_date, min_age, logo_url, delegate_preference_mode')
      .eq('slug', slug)
      .single();

    if (!confData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setConference(confData as Conference);

    const [roleRes, committeesRes, societiesRes, appRes, profileRes] = await Promise.all([
      supabase
        .from('application_role_configs')
        .select('*')
        .eq('conference_id', confData.id)
        .eq('role', role)
        .maybeSingle(),
      supabase
        .from('conference_committees')
        .select('id, name, abbreviation, topics, difficulty, total_slots, logo_url, committee_type')
        .eq('conference_id', confData.id)
        .order('name', { ascending: true }),
      supabase
        .from('societies')
        .select('id, name, name_normalized')
        .eq('conference_id', confData.id)
        .order('name', { ascending: true }),
      supabase
        .from('applications')
        .select('id, status, is_independent, society_id, experience_level, custom_answers, pledge_type, spots_pledged, aid_requested, aid_statement')
        .eq('conference_id', confData.id)
        .eq('user_id', user!.id)
        .eq('role', role)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('date_of_birth, is_ambassador, unlimited_conferences_remaining')
        .eq('id', user!.id)
        .maybeSingle(),
    ]);

    const committeesData = (committeesRes.data as CommitteeOption[]) ?? [];
    const societiesData = (societiesRes.data as Society[]) ?? [];
    const appData = (appRes.data as ExistingApp) ?? null;

    setRoleConfig((roleRes.data as RoleConfig) ?? null);
    setCommittees(committeesData);
    setSocieties(societiesData);
    setExistingApp(appData);
    const prof = profileRes.data as { date_of_birth: string | null; is_ambassador: boolean; unlimited_conferences_remaining: number } | null;
    setMyDob(prof?.date_of_birth ?? null);
    setFinanceProfile({
      is_ambassador: prof?.is_ambassador ?? false,
      unlimited_conferences_remaining: prof?.unlimited_conferences_remaining ?? 0,
    });

    // Edit mode: prefill every step from the existing application, only once
    // it's confirmed editable (rejected or submitted) — never for accepted/
    // assigned/withdrawn, those still hit the "already applied" wall below.
    if (isEditMode && appData && (appData.status === 'rejected' || appData.status === 'submitted')) {
      setIsIndependent(appData.is_independent);
      setSelectedSocietyId(appData.society_id);
      setSocietyInput(appData.society_id ? (societiesData.find(s => s.id === appData.society_id)?.name ?? '') : '');
      // pledge_type/spots_pledged only ever get set for invoicing roles
      // (head-delegate/faculty-advisor); a submitted/rejected application
      // for one of those roles always has a definitive answer already, so
      // this is a plain boolean, never the "unanswered" null state.
      if (isInvoicingRole) {
        setWillPledgeSpots(appData.pledge_type === 'delegation');
        setSpotsPledged(appData.spots_pledged ? appData.spots_pledged : '');
      }
      setExperienceLevel(appData.experience_level ?? '');
      setCustomAnswers(appData.custom_answers ?? {});
      setAidRequested(appData.aid_requested);
      setAidStatement(appData.aid_statement ?? '');

      const { data: prefRows } = await supabase
        .from('application_preferences')
        .select('preference_order, conference_committee_id, country_code, country_name')
        .eq('application_id', appData.id)
        .order('preference_order', { ascending: true });
      const existingPrefs = ((prefRows ?? []) as { preference_order: number; conference_committee_id: string; country_code: string | null; country_name: string | null }[])
        .map((p): Preference | null => {
          const committee = committeesData.find(c => c.id === p.conference_committee_id);
          if (!committee) return null;
          return {
            committeeId: p.conference_committee_id,
            committeeName: committee.abbreviation ?? committee.name,
            countryCode: p.country_code ?? '',
            countryName: p.country_name ?? '',
          };
        })
        .filter((p): p is Preference => p !== null);
      setPreferences(existingPrefs);
    }

    setLoading(false);
  }

  // head-delegate / faculty-advisor always belong to a society, no independent option
  useEffect(() => {
    if (isInvoicingRole) setIsIndependent(false);
  }, [isInvoicingRole]);

  // Society autocomplete
  useEffect(() => {
    if (!societyInput.trim()) {
      setSocietySuggestions([]);
      setSocietyDropdownOpen(false);
      return;
    }
    const q = societyInput.toLowerCase();
    const filtered = societies.filter(s => s.name.toLowerCase().includes(q));
    setSocietySuggestions(filtered);
    setSocietyDropdownOpen(true);
  }, [societyInput, societies]);

  // Load committee slots + availability once, as soon as we know a preference
  // step will be shown (mode-gated). Skipped entirely for mode 'none'.
  useEffect(() => {
    if (!showPreferenceStep || prefDataLoaded || prefDataLoading) return;
    if (!conference || !session) return;
    loadPreferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreferenceStep, prefDataLoaded, prefDataLoading, conference?.id, committees.length]);

  /**
   * Bulk-loads everything the preference picker needs: every committee's
   * country slots, plus which of those are already TAKEN. Availability comes
   * from get_taken_allocations (a privacy-safe RPC — the delegate can't read
   * conference_allocations directly under RLS).
   */
  async function loadPreferenceData() {
    if (!session || !conference) return;
    if (committees.length === 0) { setPrefDataLoaded(true); return; }
    setPrefDataLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const ids = committees.map(c => c.id);
    const [slotsRes, takenRes] = await Promise.all([
      supabase
        .from('committee_country_slots')
        .select('id, conference_committee_id, country_code, country_name')
        .in('conference_committee_id', ids)
        .order('country_name', { ascending: true }),
      supabase.rpc('get_taken_allocations', { p_conference_id: conference.id }),
    ]);

    const byCommittee: Record<string, CountrySlot[]> = {};
    for (const id of ids) byCommittee[id] = [];
    for (const s of (slotsRes.data as Array<CountrySlot & { conference_committee_id: string }> | null) ?? []) {
      (byCommittee[s.conference_committee_id] ??= []).push({ id: s.id, country_code: s.country_code, country_name: s.country_name });
    }

    const taken: Record<string, Set<string>> = {};
    for (const t of (takenRes.data as Array<{ conference_committee_id: string; country_code: string }> | null) ?? []) {
      (taken[t.conference_committee_id] ??= new Set()).add(t.country_code);
    }

    setCountrySlots(byCommittee);
    setTakenByCommittee(taken);
    setPrefDataLoading(false);
    setPrefDataLoaded(true);
  }

  async function handleSaveDob() {
    if (!session || !user) return;
    setDobError('');
    const age = ageAt(dobInput);
    if (age === null || age < 0 || age > 120) {
      setDobError('That date of birth doesn’t look right. Please double-check it.');
      return;
    }
    setDobSaving(true);
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('profiles').update({ date_of_birth: dobInput }).eq('id', user.id);
    setDobSaving(false);
    if (error) {
      setDobError('Your date of birth could not be saved. Please try again.');
      return;
    }
    setMyDob(dobInput);
  }

  // Advisors skip Experience (F15), so 'invoicing' can now be the final step
  // in their sequence, advance to it normally, but submit instead of
  // stepping past the end when there's nothing left.
  function advanceStep() {
    if (step >= totalSteps) {
      handleSubmit();
      return;
    }
    setStep(s => s + 1);
  }

  function handleContinue() {
    if (currentStepKind === 'society') {
      if (!isObserver && !isIndependent && !societyInput.trim()) {
        setSocietyError('Please enter your society name.');
        return;
      }
      if (!isObserver && !isIndependent && !isInvoicingRole && societyInput.trim() && !selectedSocietyId) {
        setSocietyError('Please select an existing delegation from the list.');
        return;
      }
      setSocietyError('');
      advanceStep();
      return;
    }
    if (currentStepKind === 'invoicing') {
      if (willPledgeSpots === null) {
        setInvoicingError('Please select an option.');
        return;
      }
      if (willPledgeSpots && (spotsPledged === '' || spotsPledged < 1)) {
        setInvoicingError('Please enter how many delegate spots you will pay for.');
        return;
      }
      setInvoicingError('');
      advanceStep();
      return;
    }
    if (currentStepKind === 'preferences') {
      if (minPrefs > 0 && preferences.length < minPrefs) {
        setPrefError(
          minPrefs === 1
            ? 'Please add at least one preference.'
            : `Please add at least ${minPrefs} preferences, ranked in order of priority.`
        );
        return;
      }
      setPrefError('');
      advanceStep();
      return;
    }
    advanceStep();
  }

  async function handleSubmit() {
    if (needsDob || underAge) {
      setSubmitError(
        minAgeLimit != null
          ? `This conference requires delegates to be at least ${minAgeLimit} years old.`
          : 'This conference has an age requirement you do not meet.'
      );
      return;
    }
    if (isEditMode) {
      await handleResubmit();
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    if (!session) { setSubmitError('Session expired. Please sign in again.'); setSubmitting(false); return; }
    const supabase = getAuthedClient(session.access_token);

    try {
      let societyId: string | null = null;
      if (!isIndependent && !isObserver && societyInput.trim()) {
        if (selectedSocietyId) {
          societyId = selectedSocietyId;
        } else if (isInvoicingRole) {
          const normalized = societyInput.trim().toLowerCase();
          const { data: existingSoc } = await supabase
            .from('societies')
            .select('id')
            .eq('conference_id', conference!.id)
            .eq('name_normalized', normalized)
            .maybeSingle();

          if (existingSoc) {
            societyId = (existingSoc as { id: string }).id;
          } else {
            const { data: newSoc } = await supabase
              .from('societies')
              .insert({ conference_id: conference!.id, name: societyInput.trim(), name_normalized: normalized })
              .select('id')
              .single();
            societyId = (newSoc as { id: string } | null)?.id ?? null;
          }
        }
      }

      // Auto-cover: if the society already has a purchased spot free, mark this
      // application paid immediately instead of leaving it unpaid. Only runs
      // when the role auto-accepts (the app lands accepted immediately) —
      // manual-review roles are always inserted unpaid; coverage happens at
      // acceptance time instead (see applications page handleAccept).
      let paymentStatus: 'unpaid' | 'paid' = 'unpaid';
      if (societyId && roleConfig?.auto_accept) {
        if (role === 'delegate' || role === 'head-delegate') {
          const [{ count: occupancy }, { data: socData }] = await Promise.all([
            supabase
              .from('applications')
              .select('id', { count: 'exact', head: true })
              .eq('society_id', societyId)
              .in('role', ['delegate', 'head-delegate'])
              .in('status', ['accepted', 'assigned'])
              .eq('attending', true)
              .eq('payment_status', 'paid'),
            supabase.from('societies').select('spots_purchased').eq('id', societyId).single(),
          ]);
          const spotsPurchased = (socData as { spots_purchased: number } | null)?.spots_purchased ?? 0;
          if ((occupancy ?? 0) < spotsPurchased) paymentStatus = 'paid';
        } else if (role === 'faculty-advisor') {
          const [{ count: occupancy }, { data: socData }] = await Promise.all([
            supabase
              .from('applications')
              .select('id', { count: 'exact', head: true })
              .eq('society_id', societyId)
              .eq('role', 'faculty-advisor')
              .in('status', ['accepted', 'assigned'])
              .eq('attending', true)
              .eq('payment_status', 'paid'),
            supabase.from('societies').select('advisor_spots_purchased').eq('id', societyId).single(),
          ]);
          const spotsPurchased = (socData as { advisor_spots_purchased: number } | null)?.advisor_spots_purchased ?? 0;
          if ((occupancy ?? 0) < spotsPurchased) paymentStatus = 'paid';
        }
      }

      // Checkout breakdown, the SAME pure math the order summary rendered.
      // fee_waiver_source is recorded at submit; the unlimited counter itself
      // is only decremented by the DB trigger when payment_status flips to
      // 'paid' (server-side, so it can't be gamed from the client).
      const breakdown = computeCheckout({
        // Phased pricing: charge the fee phase active TODAY (falls back to the
        // flat role fee when no phase window covers today), same resolution
        // the order summary rendered in step 1.
        feeAmount: roleConfig ? activePhaseFee(roleConfig).amount : 0,
        feeCurrency: roleConfig?.fee_currency ?? conference!.fee_currency,
        voucher: appliedVoucher,
        profile: financeProfile,
      });

      const insertPayload: Record<string, unknown> = {
        conference_id: conference!.id,
        user_id: user!.id,
        role,
        status: roleConfig?.auto_accept ? 'accepted' : 'submitted',
        // Derived convenience, kept in sync, society_id IS NULL is the
        // actual source of truth, never read is_independent for logic.
        is_independent: isIndependent,
        society_id: societyId,
        is_head_delegate: role === 'head-delegate',
        experience_level: experienceLevel || null,
        custom_answers: customAnswers,
        payment_status: paymentStatus,
      };
      if (breakdown.baseFee > 0 && breakdown.waiverSource) {
        insertPayload.fee_waiver_source = breakdown.waiverSource;
      }
      if (appliedVoucher && breakdown.voucherDiscount > 0) {
        insertPayload.voucher_id = appliedVoucher.voucherId;
        insertPayload.voucher_discount = breakdown.voucherDiscount;
      }
      if (isInvoicingRole) {
        insertPayload.pledge_type = willPledgeSpots ? 'delegation' : null;
        insertPayload.spots_pledged = willPledgeSpots ? (spotsPledged || 0) : 0;
      }
      if (showAidStep) {
        insertPayload.aid_requested = aidRequested;
        insertPayload.aid_statement = aidRequested ? aidStatement : null;
        // Explicit 'pending' on request — the column otherwise defaults to
        // 'none', never leave a requested application unmarked for review.
        if (aidRequested) insertPayload.aid_status = 'pending';
      }

      const { data: app, error: appError } = await supabase
        .from('applications')
        .insert(insertPayload)
        .select('id')
        .single();

      if (appError) throw appError;

      // Record the voucher redemption atomically (BEFORE INSERT trigger locks
      // the voucher row, enforces active/expiry/limit, bumps redeemed_count).
      // Non-fatal: the application is already in, a failed redemption just
      // means the organizer sees the voucher columns without a redemption row.
      if (appliedVoucher && breakdown.voucherDiscount > 0) {
        await supabase.rpc('redeem_voucher', {
          p_voucher_id: appliedVoucher.voucherId,
          p_context: 'conference_signup',
          p_application_id: (app as { id: string }).id,
        });
      }

      if (showPreferenceStep && preferences.length > 0) {
        // country_code/country_name are null for committees_only rows (the
        // delegate ranked committees without a country). conference_committee_id
        // is always present in every mode.
        const prefRows = preferences.map((p, i) => ({
          application_id: (app as { id: string }).id,
          preference_order: i + 1,
          conference_committee_id: p.committeeId,
          country_code: p.countryCode || null,
          country_name: p.countryName || null,
        }));
        await supabase.from('application_preferences').insert(prefRows);
      }

      const timingParam = roleConfig?.payment_timing ? `&timing=${roleConfig.payment_timing}` : '';
      router.push(`/conferences/${slug}/apply/confirmation?role=${role}${timingParam}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(msg);
      setSubmitting(false);
    }
  }

  // Edit mode's submit path: resubmit_application is the ONLY write path for
  // applicant edits — a whitelisted SECURITY DEFINER RPC, never a direct
  // `applications` update. It forces status back to 'submitted' and stamps
  // resubmitted_at itself when coming from 'rejected'; financial fields
  // (payment_status, vouchers, fee waivers) aren't in its whitelist and
  // aren't touched here either, resubmitting only edits the whitelisted
  // fields, it never re-runs checkout.
  async function handleResubmit() {
    setSubmitting(true);
    setSubmitError('');
    if (!session || !existingApp) { setSubmitError('Session expired. Please sign in again.'); setSubmitting(false); return; }
    const supabase = getAuthedClient(session.access_token);

    try {
      let societyId: string | null = null;
      if (!isIndependent && !isObserver && societyInput.trim()) {
        if (selectedSocietyId) {
          societyId = selectedSocietyId;
        } else if (isInvoicingRole) {
          const normalized = societyInput.trim().toLowerCase();
          const { data: existingSoc } = await supabase
            .from('societies')
            .select('id')
            .eq('conference_id', conference!.id)
            .eq('name_normalized', normalized)
            .maybeSingle();

          if (existingSoc) {
            societyId = (existingSoc as { id: string }).id;
          } else {
            const { data: newSoc } = await supabase
              .from('societies')
              .insert({ conference_id: conference!.id, name: societyInput.trim(), name_normalized: normalized })
              .select('id')
              .single();
            societyId = (newSoc as { id: string } | null)?.id ?? null;
          }
        }
      }

      const updates: Record<string, unknown> = {
        is_independent: isIndependent,
        society_id: societyId,
        is_head_delegate: role === 'head-delegate',
        experience_level: experienceLevel || null,
        custom_answers: customAnswers,
      };
      if (isInvoicingRole) {
        updates.pledge_type = willPledgeSpots ? 'delegation' : null;
        updates.spots_pledged = willPledgeSpots ? (spotsPledged || 0) : 0;
      }
      if (showPreferenceStep) {
        // Same row shape as the fresh-submit insert, minus application_id
        // (the RPC already has p_application_id) — the RPC owns replacing
        // application_preferences server-side.
        updates.preferences = preferences.map((p, i) => ({
          preference_order: i + 1,
          conference_committee_id: p.committeeId,
          country_code: p.countryCode || null,
          country_name: p.countryName || null,
        }));
      }
      if (showAidStep) {
        // aid_status itself isn't in the whitelist we set client-side, the
        // RPC already handles the resubmit case (re-opening review etc).
        updates.aid_requested = aidRequested;
        updates.aid_statement = aidRequested ? aidStatement : null;
      }

      const { data, error } = await supabase.rpc('resubmit_application', {
        p_application_id: existingApp.id,
        p_updates: updates,
      });
      if (error) throw error;
      const result = data as { ok: boolean; resubmitted?: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Could not resubmit your application. Please try again.');

      // Same event key a fresh submission would use ('application_received'),
      // gated by the organizer's normal three-state template rules (drafted/
      // default/off/unconfigured) — no new event key, and this queues
      // nothing if the organizer hasn't configured anything for it.
      try {
        await queueEventEmail(supabase, conference!.id, 'application_received', [existingApp.id]);
      } catch { /* non-fatal, the resubmission itself already succeeded */ }

      router.push(`/conferences/${slug}/apply/confirmation?role=${role}&resubmitted=1`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(msg);
      setSubmitting(false);
    }
  }

  // ── Step render helpers ───────────────────────────────────────────────────

  function renderStep1() {
    const rc = roleConfig!;
    const RoleIcon = roleIcon(role);
    // Today's price: the fee phase whose date window covers today (e.g. Early
    // Bird), falling back to the flat role fee. The phase label surfaces on
    // the order summary's fee line so applicants see WHY this price applies.
    const { amount: resolvedFee, phase: currentPhase } = activePhaseFee(rc);
    const isFree = !(resolvedFee > 0);
    const breakdown = computeCheckout({
      feeAmount: resolvedFee,
      feeCurrency: rc.fee_currency,
      voucher: appliedVoucher,
      profile: financeProfile,
    });
    const showUpsell = !isFree && !breakdown.platformFeeWaived && !upsellDismissed;
    const summaryRow: React.CSSProperties = {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink,
    };
    const amountStyle: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', fontWeight: 700 };
    return (
      <>
        <StepHeading icon={BadgeCheck} title="Applying as" subtitle="Confirm your role and the registration fee." />

        {/* Role + fee, role identity on the left, gold-ringed fee medallion on the right */}
        <div
          className="rounded-2xl p-5 mb-4 flex items-center gap-5"
          style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1.5px solid rgba(27,56,40,0.14)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-1">
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: '34px', height: '34px', borderRadius: '11px',
                  background: 'linear-gradient(150deg, #16301F, #2A5A3C)',
                }}
              >
                <RoleIcon size={17} strokeWidth={2.2} style={{ color: '#EED98A' }} />
              </span>
              <p className="font-black text-xl capitalize" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                {role.replace(/-/g, ' ')}
              </p>
            </div>
            <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              {conference?.full_name}
            </p>
            {rc.auto_accept && (
              <div className="mt-3">
                <Pill tone="forest" icon={<BadgeCheck size={12} strokeWidth={2.4} />}>
                  Auto-accepted
                </Pill>
              </div>
            )}
          </div>

          {/* Fee medallion, echoes the detail page's gold-ringed pricing medallion */}
          <div
            className="relative flex flex-col items-center justify-center flex-shrink-0"
            style={{
              width: '104px', height: '104px', borderRadius: '9999px',
              background: 'radial-gradient(circle at 50% 36%, rgba(238,217,138,0.32) 0%, rgba(250,248,243,0) 72%)',
              border: '1.5px solid rgba(182,135,31,0.42)',
              boxShadow: '0 8px 22px rgba(27,56,40,0.1), 0 0 0 6px rgba(238,217,138,0.12)',
            }}
          >
            {isFree ? (
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: '22px', color: '#1B3828', lineHeight: 1 }}>FREE</span>
            ) : (
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: '27px', color: '#1C1410', lineHeight: 1 }}>
                {formatFee(resolvedFee, rc.fee_currency)}
              </span>
            )}
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '7.5px', letterSpacing: '0.15em', color: '#9A8A78', marginTop: '6px' }}>
              PER DELEGATE
            </span>
          </div>
        </div>

        {/* ── ORDER SUMMARY, neumorphic well; all math from finance.computeCheckout ── */}
        {!isFree && (
          <NeuInset className="p-5 mb-4">
            <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.22em', color: NEU.muted, marginBottom: 14 }}>
              ORDER SUMMARY
            </p>

            {/* Fee line, names the active fee phase when one applies */}
            <div style={{ ...summaryRow, marginBottom: 10 }}>
              <span style={{ color: 'rgba(28,20,16,0.75)' }}>
                Registration fee
                {currentPhase && (
                  <span style={{ color: NEU.muted, fontWeight: 600 }}>: {currentPhase.label || 'Current phase'}</span>
                )}
              </span>
              <span style={amountStyle}>{formatFee(breakdown.baseFee, breakdown.currency)}</span>
            </div>

            {/* Voucher, single field + APPLY chip, or the applied green line */}
            {appliedVoucher ? (
              <div style={{ ...summaryRow, marginBottom: 10 }}>
                <span className="inline-flex items-center gap-1.5" style={{ color: NEU.green, fontWeight: 600 }}>
                  <Ticket size={14} strokeWidth={2.2} />
                  Voucher {appliedVoucher.code}
                  <button
                    onClick={() => { setAppliedVoucher(null); setVoucherCode(''); }}
                    aria-label="Remove voucher"
                    className="focus:outline-none"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: NEU.muted, display: 'inline-flex', padding: 2 }}
                  >
                    <X size={13} strokeWidth={2.4} />
                  </button>
                </span>
                <span style={{ ...amountStyle, color: NEU.green }}>
                  −{formatFee(breakdown.voucherDiscount, breakdown.currency)}
                </span>
              </div>
            ) : (
              <div className="flex items-stretch gap-2" style={{ marginBottom: voucherError ? 4 : 10 }}>
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleApplyVoucher(); }}
                  placeholder="Voucher code"
                  aria-label="Voucher code"
                  className="flex-1 min-w-0 rounded-xl px-3.5 py-2 text-sm focus:outline-none"
                  style={{
                    border: voucherError ? '1.5px solid #8B2020' : '1.5px solid #DDD4C0',
                    backgroundColor: '#FAF8F3', color: NEU.ink, fontFamily: OUTFIT,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}
                />
                <button
                  onClick={handleApplyVoucher}
                  disabled={voucherChecking || !voucherCode.trim()}
                  className="rounded-full px-4 text-xs font-extrabold focus:outline-none"
                  style={{
                    border: 'none', fontFamily: OUTFIT, letterSpacing: '0.1em',
                    background: voucherChecking || !voucherCode.trim() ? 'rgba(27,56,40,0.14)' : NEU.forest,
                    color: voucherChecking || !voucherCode.trim() ? NEU.muted : NEU.gold,
                    cursor: voucherChecking || !voucherCode.trim() ? 'default' : 'pointer',
                    boxShadow: NEU.outSm,
                  }}
                >
                  {voucherChecking ? 'CHECKING…' : 'APPLY'}
                </button>
              </div>
            )}
            {voucherError && !appliedVoucher && (
              <p className="text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT, marginBottom: 10 }}>
                {voucherError}
              </p>
            )}

            {/* Service fee, includes card processing; platform part waivable */}
            <div style={{ ...summaryRow, marginBottom: 12, alignItems: 'flex-start' }}>
              <span style={{ color: 'rgba(28,20,16,0.75)' }}>
                Service fee
                <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: NEU.muted, marginTop: 2 }}>
                  {breakdown.platformFeeWaived ? 'Card processing only, platform fee waived' : 'Includes card processing'}
                </span>
              </span>
              <span style={amountStyle}>{formatFee(breakdown.serviceFee, breakdown.currency)}</span>
            </div>

            {breakdown.waiverSource === 'ambassador' ? (
              <div
                className="rounded-xl px-3.5 py-2.5"
                style={{
                  marginBottom: 12,
                  background: 'linear-gradient(150deg, rgba(238,217,138,0.32), rgba(182,135,31,0.14))',
                  border: '1.5px solid rgba(182,135,31,0.5)',
                }}
              >
                <span className="inline-flex items-center gap-2" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 11.5, letterSpacing: '0.06em', color: '#7A5A20' }}>
                  <Crown size={14} strokeWidth={2.3} style={{ color: NEU.deepGold }} />
                  AMBASSADOR: platform fee waived, always
                </span>
              </div>
            ) : breakdown.waiverSource === 'unlimited' ? (
              <div
                className="rounded-xl px-3.5 py-2.5"
                style={{ marginBottom: 12, backgroundColor: 'rgba(27,56,40,0.07)', border: '1.5px solid rgba(27,56,40,0.28)' }}
              >
                <span className="inline-flex items-center gap-2" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, color: NEU.forest }}>
                  <InfinityIcon size={14} strokeWidth={2.4} />
                  Gavelling Unlimited: platform fee waived ({financeProfile.unlimited_conferences_remaining} left)
                </span>
              </div>
            ) : null}

            {/* Total, big tabular-nums */}
            <div style={{ borderTop: '1.5px solid rgba(27,56,40,0.14)', paddingTop: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 11, letterSpacing: '0.18em', color: NEU.muted }}>TOTAL</span>
              <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 28, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {formatFee(breakdown.total, breakdown.currency)}
              </span>
            </div>
          </NeuInset>
        )}

        {/* ── Gavin upsell, only when no waiver is active; dismissable; never blocks ── */}
        {showUpsell && (
          <div
            className="relative rounded-2xl mb-4 flex items-center gap-4 overflow-hidden"
            style={{
              padding: '16px 18px',
              backgroundColor: NEU.surface,
              boxShadow: NEU.out,
            }}
          >
            <button
              onClick={dismissUpsell}
              aria-label="Dismiss"
              className="absolute top-2.5 right-2.5 flex items-center justify-center rounded-full focus:outline-none"
              style={{ width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', color: NEU.muted }}
            >
              <X size={14} strokeWidth={2.4} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Otter.Tutorial.Intro.webp"
              alt="Gavin the otter"
              className="flex-shrink-0"
              style={{ width: 76, height: 76, objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(27,56,40,0.25))' }}
            />
            <div className="min-w-0 flex-1">
              <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, color: NEU.ink, lineHeight: 1.35 }}>
                You could be saving {localizedApproxSavings(10, geoCountry)}/month with Gavelling Unlimited
              </p>
              <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, lineHeight: 1.6 }}>
                5% off every conference · Gavelling Points for merchandise · Full Premium features
              </p>
              <Link
                href="/account/points"
                className="inline-flex items-center gap-1 mt-2 text-xs font-extrabold"
                style={{ color: NEU.forest, fontFamily: OUTFIT, letterSpacing: '0.06em', textDecoration: 'none' }}
              >
                MEET GAVELLING UNLIMITED <ArrowRight size={13} strokeWidth={2.6} />
              </Link>
            </div>
          </div>
        )}

        <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'rgba(238,217,138,0.08)', border: '1.5px solid rgba(238,217,138,0.28)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(28,20,16,0.7)', fontFamily: "'Outfit', sans-serif" }}>
            By applying you confirm you meet the requirements for this role. Your application will be reviewed by the conference organizing team.
          </p>
        </div>

        <button
          onClick={() => setStep(2)}
          className="w-full rounded-xl py-3 font-bold text-sm focus:outline-none transition-colors flex items-center justify-center gap-2"
          style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em', boxShadow: '0 6px 18px rgba(27,56,40,0.22)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          CONTINUE <ArrowRight size={16} strokeWidth={2.4} />
        </button>
      </>
    );
  }

  function renderStep2() {
    const showSociety = !isObserver;
    return (
      <>
        <StepHeading
          icon={isObserver ? ClipboardList : Users}
          title={isObserver ? 'Background' : 'Your Delegation'}
          subtitle={
            !showSociety
              ? 'As an observer, no delegation information is required.'
              : isInvoicingRole
              ? 'Which society or high school are you representing?'
              : 'Are you applying independently or as part of a high school/society?'
          }
        />

        {showSociety && (
          <>
            {/* Toggle */}
            {!isInvoicingRole && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {(['independent', 'society'] as const).map(type => {
                  const selected = type === 'independent' ? isIndependent : !isIndependent;
                  const TileIcon = type === 'independent' ? User : Building2;
                  return (
                    <button
                      key={type}
                      onClick={() => setIsIndependent(type === 'independent')}
                      className="relative rounded-xl p-4 flex flex-col items-center gap-2.5 focus:outline-none"
                      style={{
                        border: selected ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                        backgroundColor: selected ? '#1B3828' : 'transparent',
                        boxShadow: selected ? '0 6px 18px rgba(27,56,40,0.18)' : 'none',
                        transition: reducedMotion ? 'none' : 'all 200ms cubic-bezier(0.22,1,0.36,1)',
                      }}
                      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                      onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      {selected && (
                        <span
                          className="absolute top-2.5 right-2.5 flex items-center justify-center rounded-full"
                          style={{ width: 18, height: 18, backgroundColor: '#EED98A' }}
                        >
                          <Check size={12} strokeWidth={3} style={{ color: '#1B3828' }} />
                        </span>
                      )}
                      <span
                        className="flex items-center justify-center rounded-xl"
                        style={{
                          width: 40, height: 40,
                          backgroundColor: selected ? 'rgba(238,217,138,0.15)' : 'rgba(27,56,40,0.06)',
                          border: selected ? '1px solid rgba(238,217,138,0.35)' : '1px solid rgba(27,56,40,0.12)',
                        }}
                      >
                        <TileIcon size={19} strokeWidth={2.1} style={{ color: selected ? '#EED98A' : '#1B3828' }} />
                      </span>
                      <p className="font-bold text-sm" style={{ color: selected ? '#EED98A' : '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                        {type === 'independent' ? 'Independent' : 'With a society'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Society input */}
            {!isIndependent && (
              <>
                <div className="relative">
                  <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                    Society / High School Name
                  </label>
                  <input
                    type="text"
                    value={societyInput}
                    onChange={(e) => {
                      setSocietyInput(e.target.value);
                      setSelectedSocietyId(null);
                      setSocietyError('');
                    }}
                    onFocus={() => { if (societySuggestions.length > 0) setSocietyDropdownOpen(true); }}
                    onBlur={() => setTimeout(() => setSocietyDropdownOpen(false), 150)}
                    placeholder="e.g. HultMUN, LSE MUN Society..."
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{
                      border: societyError ? '1.5px solid #8B2020' : '1.5px solid #DDD4C0',
                      backgroundColor: '#FAF8F3',
                      color: '#1C1410',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  />
                  {societyDropdownOpen && societyInput.trim() && (
                    <div
                      className="absolute left-0 right-0 rounded-xl shadow-lg overflow-y-auto"
                      style={{ top: 'calc(100% + 4px)', maxHeight: '200px', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', zIndex: 20 }}
                    >
                      {societySuggestions.map(s => (
                        <button
                          key={s.id}
                          className="w-full text-left px-4 py-2.5 text-sm focus:outline-none"
                          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          onMouseDown={() => {
                            setSocietyInput(s.name);
                            setSelectedSocietyId(s.id);
                            setSocietyDropdownOpen(false);
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                      {isInvoicingRole ? (
                        !societySuggestions.some(s => s.name.toLowerCase() === societyInput.toLowerCase()) && (
                          <button
                            className="w-full text-left px-4 py-2.5 text-sm focus:outline-none"
                            style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", borderTop: '1px solid #F0EDE6' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            onMouseDown={() => {
                              setSelectedSocietyId(null);
                              setSocietyDropdownOpen(false);
                            }}
                          >
                            Create &quot;{societyInput}&quot;
                          </button>
                        )
                      ) : (
                        societySuggestions.length === 0 && (
                          <p
                            className="px-4 py-2.5 text-xs leading-relaxed"
                            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", borderTop: '1px solid #F0EDE6' }}
                          >
                            This delegation has not been created. Please ask your Head Delegate or Faculty Advisor to create it.
                          </p>
                        )
                      )}
                    </div>
                  )}
                </div>
                {societyError && (
                  <p className="mt-1.5 text-xs" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                    {societyError}
                  </p>
                )}
              </>
            )}
          </>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(1)}
            className="rounded-xl py-2.5 px-5 text-sm font-bold focus:outline-none transition-colors flex items-center gap-1.5"
            style={{ border: '1.5px solid #C8BEA8', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <ArrowLeft size={15} strokeWidth={2.4} /> BACK
          </button>
          <button
            onClick={handleContinue}
            className="rounded-xl py-2.5 px-6 text-sm font-bold focus:outline-none transition-colors flex items-center gap-2"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', boxShadow: '0 6px 18px rgba(27,56,40,0.22)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            CONTINUE <ArrowRight size={16} strokeWidth={2.4} />
          </button>
        </div>
      </>
    );
  }

  function renderStepInvoicing() {
    const options: Array<{ value: boolean; label: string }> = [
      { value: true, label: 'YES' },
      { value: false, label: 'NO' },
    ];
    const showSpots = willPledgeSpots === true;

    return (
      <>
        <h2 className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Will you be paying for delegation spots?
        </h2>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          This is separate from your own registration fee. It only covers spots for your delegates.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {options.map(opt => {
            const selected = willPledgeSpots === opt.value;
            return (
              <button
                key={String(opt.value)}
                onClick={() => { setWillPledgeSpots(opt.value); setInvoicingError(''); }}
                className="relative rounded-xl p-4 text-center focus:outline-none transition-all"
                style={{
                  border: selected ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                  backgroundColor: selected ? 'rgba(27,56,40,0.06)' : 'transparent',
                }}
              >
                <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
                  {opt.label}
                </p>
              </button>
            );
          })}
        </div>

        {showSpots && (
          <div className="mb-6">
            <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              How many delegate spots will you pay for?
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={spotsPledged}
              onChange={(e) => {
                const raw = e.target.value;
                setSpotsPledged(raw === '' ? '' : Math.max(1, Math.floor(Number(raw))));
                setInvoicingError('');
              }}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
            />
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              These spots stay with your delegation once purchased. If a delegate drops out, the spot remains and can be given to their replacement.
            </p>
          </div>
        )}

        {invoicingError && (
          <p className="mb-3 text-xs" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
            {invoicingError}
          </p>
        )}

        <div className="flex justify-between mt-2">
          <button
            onClick={() => setStep(s => s - 1)}
            className="rounded-xl py-2.5 px-5 text-sm font-bold focus:outline-none transition-colors"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            ← BACK
          </button>
          <button
            onClick={handleContinue}
            disabled={submitting}
            className="rounded-xl py-2.5 px-6 text-sm font-bold focus:outline-none transition-colors"
            style={{
              backgroundColor: submitting ? 'rgba(27,56,40,0.5)' : '#1B3828', color: '#EED98A',
              fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', cursor: submitting ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {step >= totalSteps ? (submitting ? 'SUBMITTING...' : (isEditMode ? 'RESUBMIT APPLICATION' : 'SUBMIT APPLICATION')) : 'CONTINUE →'}
          </button>
        </div>
      </>
    );
  }

  function renderStep3Preferences() {
    const subtitle = committeesOnly
      ? 'Rank the committees you would most like to sit in.'
      : countriesOnly
      ? 'Rank the countries you would most like to represent.'
      : 'Rank the committee-and-country pairings you would most like to represent.';
    const atMax = preferences.length >= 8;

    const addPref = (entry: Preference) =>
      setPreferences(prev => (prev.length >= 8 ? prev : [...prev, entry]));
    const removeAt = (i: number) =>
      setPreferences(prev => prev.filter((_, x) => x !== i));
    const move = (i: number, dir: -1 | 1) =>
      setPreferences(prev => {
        const j = i + dir;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    const committeeRank = (id: string) => {
      const i = preferences.findIndex(p => p.committeeId === id);
      return i < 0 ? null : i + 1;
    };
    const isCountrySelected = (id: string, code: string) =>
      preferences.some(p => p.committeeId === id && p.countryCode === code);
    const toggleCommitteeOnly = (c: CommitteeOption) => {
      setPrefError('');
      const i = preferences.findIndex(p => p.committeeId === c.id);
      if (i >= 0) removeAt(i);
      else addPref({ committeeId: c.id, committeeName: c.name, countryCode: '', countryName: '' });
    };
    const toggleCountry = (c: CommitteeOption, slot: CountrySlot) => {
      setPrefError('');
      const i = preferences.findIndex(p => p.committeeId === c.id && p.countryCode === slot.country_code);
      if (i >= 0) removeAt(i);
      else addPref({ committeeId: c.id, committeeName: c.name, countryCode: slot.country_code, countryName: slot.country_name });
    };

    const rankedPanel = preferences.length > 0 && (
      <NeuInset className="mb-5" style={{ padding: 12 }}>
        <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.2em', color: NEU.muted, marginBottom: 10, marginLeft: 2 }}>
          YOUR RANKING · {preferences.length}
        </p>
        <div className="flex flex-col gap-2">
          {preferences.map((p, i) => (
            <RankedRow
              key={`${p.committeeId}-${p.countryCode}-${i}`}
              index={i}
              total={preferences.length}
              committee={committees.find(c => c.id === p.committeeId)}
              countryCode={p.countryCode}
              countryName={p.countryName}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              onRemove={() => removeAt(i)}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </NeuInset>
    );

    // ── Loading skeleton while slots + availability load.
    if (prefDataLoading && !prefDataLoaded) {
      return (
        <>
          <StepHeading icon={ListOrdered} title="Your Preferences" subtitle={subtitle} />
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
          </div>
        </>
      );
    }

    return (
      <>
        <StepHeading icon={ListOrdered} title="Your Preferences" subtitle={subtitle} />

        {minPrefs > 0 && (
          <p className="mb-4" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
            Pick and order at least <span style={{ fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{minPrefs}</span>
            {atMax ? ' · maximum of 8 reached' : ' · rank up to 8'}. Taken options are greyed out.
          </p>
        )}

        {rankedPanel}

        {/* ── Picker ──────────────────────────────────────────────────────── */}
        {committees.length === 0 ? (
          <NeuInset style={{ padding: 20 }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.muted, textAlign: 'center' }}>
              This conference hasn&apos;t published its committees yet. You can still submit — the organisers will assign you.
            </p>
          </NeuInset>
        ) : committeesOnly ? (
          <div className="flex flex-col gap-3">
            {committees.map(c => {
              const info = committeeSlotInfo(c.id);
              return (
                <CommitteeCard
                  key={c.id}
                  committee={c}
                  openCount={info.openCount}
                  totalCount={info.total}
                  rank={committeeRank(c.id)}
                  active={false}
                  disabled={info.full || (atMax && committeeRank(c.id) == null)}
                  showAvailability
                  onClick={() => toggleCommitteeOnly(c)}
                  reducedMotion={reducedMotion}
                />
              );
            })}
          </div>
        ) : countriesOnly ? (
          <div className="flex flex-col gap-5">
            {committees.map(c => {
              const info = committeeSlotInfo(c.id);
              if (info.total === 0) return null;
              const monogram = (c.abbreviation || c.name).slice(0, 3).toUpperCase();
              return (
                <div key={c.id}>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <LogoDisc src={c.logo_url} alt={c.name} size={30} fallbackText={monogram} />
                    <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13, color: NEU.ink }}>
                      {c.abbreviation || c.name}
                    </span>
                    <DifficultyBadge difficulty={c.difficulty} />
                    {info.full && (
                      <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, color: '#8B2020', letterSpacing: '0.06em' }}>FULL</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {info.slots.map(slot => {
                      const taken = info.taken.has(slot.country_code);
                      return (
                        <CountryChip
                          key={slot.id}
                          code={slot.country_code}
                          name={slot.country_name}
                          taken={taken || (atMax && !isCountrySelected(c.id, slot.country_code))}
                          selected={isCountrySelected(c.id, slot.country_code)}
                          onClick={() => toggleCountry(c, slot)}
                          reducedMotion={reducedMotion}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // full mode: committee card → expand → country tray
          <div className="flex flex-col gap-3">
            {committees.map(c => {
              const info = committeeSlotInfo(c.id);
              const expanded = expandedCommitteeId === c.id;
              const chosenHere = preferences.filter(p => p.committeeId === c.id).length;
              return (
                <div key={c.id}>
                  <CommitteeCard
                    committee={c}
                    openCount={info.openCount}
                    totalCount={info.total}
                    rank={null}
                    active={expanded || chosenHere > 0}
                    disabled={info.full && chosenHere === 0}
                    showAvailability
                    onClick={() => setExpandedCommitteeId(prev => (prev === c.id ? null : c.id))}
                    reducedMotion={reducedMotion}
                  />
                  {expanded && (
                    <NeuInset className="mt-2" style={{ padding: 12 }}>
                      {info.total === 0 ? (
                        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, textAlign: 'center', padding: '6px 0' }}>
                          No countries listed for this committee yet.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {info.slots.map(slot => {
                            const taken = info.taken.has(slot.country_code);
                            const selected = isCountrySelected(c.id, slot.country_code);
                            return (
                              <CountryChip
                                key={slot.id}
                                code={slot.country_code}
                                name={slot.country_name}
                                taken={taken || (atMax && !selected)}
                                selected={selected}
                                onClick={() => toggleCountry(c, slot)}
                                reducedMotion={reducedMotion}
                              />
                            );
                          })}
                        </div>
                      )}
                    </NeuInset>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {prefError && (
          <p className="mt-4 text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
            {prefError}
          </p>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(s => s - 1)}
            className="rounded-xl py-2.5 px-5 text-sm font-bold focus:outline-none transition-colors flex items-center gap-1.5"
            style={{ border: '1.5px solid #C8BEA8', color: '#1C1410', fontFamily: OUTFIT }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <ArrowLeft size={15} strokeWidth={2.4} /> BACK
          </button>
          <button
            onClick={handleContinue}
            className="rounded-xl py-2.5 px-6 text-sm font-bold focus:outline-none transition-colors flex items-center gap-2"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.08em', boxShadow: '0 6px 18px rgba(27,56,40,0.22)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            CONTINUE <ArrowRight size={16} strokeWidth={2.4} />
          </button>
        </div>
      </>
    );
  }

  function renderStepAid() {
    return (
      <>
        <StepHeading
          icon={HeartHandshake}
          title="Financial aid"
          subtitle="Optional — let the organizing team know if you need support with the registration fee."
        />

        <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1.5px solid rgba(27,56,40,0.14)' }}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={aidRequested}
              onChange={(e) => setAidRequested(e.target.checked)}
              className="mt-0.5 flex-shrink-0"
              style={{ width: 18, height: 18, accentColor: '#1B3828', cursor: 'pointer' }}
            />
            <span className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              I would like to apply for financial aid
            </span>
          </label>

          {aidRequested && (
            <div className="mt-4">
              <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                Tell us about your circumstances
              </label>
              <textarea
                rows={5}
                value={aidStatement}
                onChange={(e) => setAidStatement(e.target.value)}
                placeholder="Tell the organizers about your circumstances and what support you need"
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                style={{ border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              />
              <p className="text-xs mt-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                Aid decisions are made by the conference team after review — you&apos;ll be notified once there&apos;s an update.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-2 gap-4">
          <button
            onClick={() => setStep(s => s - 1)}
            className="rounded-xl py-2.5 px-5 text-sm font-bold focus:outline-none transition-colors flex-shrink-0"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            ← BACK
          </button>
          <button
            onClick={handleContinue}
            disabled={submitting}
            className="flex-1 rounded-xl py-3 px-8 text-sm font-bold focus:outline-none transition-colors"
            style={{
              backgroundColor: submitting ? 'rgba(27,56,40,0.5)' : '#1B3828',
              color: '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.08em',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: submitting ? 'none' : '0 6px 18px rgba(27,56,40,0.22)',
            }}
            onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {step >= totalSteps ? (submitting ? 'SUBMITTING...' : (isEditMode ? 'RESUBMIT APPLICATION' : 'SUBMIT APPLICATION')) : 'CONTINUE →'}
          </button>
        </div>
      </>
    );
  }

  function renderStepExperience() {
    const levels = [
      { value: 'beginner', label: 'BEGINNER', sub: 'First or second conference' },
      { value: 'intermediate', label: 'INTERMEDIATE', sub: '3–10 conferences' },
      { value: 'advanced', label: 'ADVANCED', sub: '10–20 conferences' },
      { value: 'expert', label: 'EXPERT', sub: '20+ conferences or chairing experience' },
    ];
    const questions = roleConfig?.custom_questions ?? [];

    return (
      <>
        <h2 className="font-semibold text-base mb-6" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          About You
        </h2>

        <div className="mb-6">
          <label className="block font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            MUN Experience Level
          </label>
          <div className="grid grid-cols-2 gap-3">
            {levels.map(lvl => (
              <button
                key={lvl.value}
                onClick={() => setExperienceLevel(lvl.value)}
                className="rounded-xl p-3 text-center focus:outline-none transition-all"
                style={{
                  border: experienceLevel === lvl.value ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                  backgroundColor: experienceLevel === lvl.value ? 'rgba(27,56,40,0.06)' : 'transparent',
                }}
              >
                <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{lvl.label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{lvl.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {questions.length > 0 && (
          <div className="flex flex-col gap-4 mb-6">
            {questions.map(q => (
              <div key={q.id}>
                <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  {q.label}
                  {q.required && <span className="ml-1 text-xs font-normal" style={{ color: '#9A8A78' }}>(required)</span>}
                </label>
                {q.type === 'text' ? (
                  <input
                    type="text"
                    value={customAnswers[q.id] ?? ''}
                    onChange={(e) => setCustomAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{ border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                  />
                ) : (
                  <textarea
                    rows={4}
                    value={customAnswers[q.id] ?? ''}
                    onChange={(e) => setCustomAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                    style={{ border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between mt-2 gap-4">
          <button
            onClick={() => setStep(s => s - 1)}
            className="rounded-xl py-2.5 px-5 text-sm font-bold focus:outline-none transition-colors flex-shrink-0"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            ← BACK
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-xl py-3 px-8 text-sm font-bold focus:outline-none transition-colors"
            style={{
              backgroundColor: submitting ? 'rgba(27,56,40,0.5)' : '#1B3828',
              color: '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.08em',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: submitting ? 'none' : '0 6px 18px rgba(27,56,40,0.22)',
            }}
            onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#EED98A', borderTopColor: 'transparent' }} />
                SUBMITTING...
              </span>
            ) : (isEditMode ? 'RESUBMIT APPLICATION' : 'SUBMIT APPLICATION')}
          </button>
        </div>
      </>
    );
  }

  // ── Early returns ─────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (notFound || !conference) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20 text-center">
          <div>
            <p className="text-xs tracking-widest mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>404</p>
            <h1 className="font-black text-2xl mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Conference Not Found</h1>
            <Link href="/conferences/explore" className="text-sm font-semibold" style={{ color: '#1B3828', textDecoration: 'none' }}>
              Explore conferences →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // A valid edit session (edit=1, resolved against an actually-editable
  // application) bypasses both the "already applied" wall and the
  // applications-closed wall below — they're editing an application that
  // already exists, not creating a new one. Requires roleConfig to still
  // exist (renderStep1 reads it non-null) — is_enabled doesn't matter here,
  // an existing applicant can still edit while applications are paused.
  const canEdit = isEditMode && !!existingApp && !!roleConfig
    && (existingApp.status === 'rejected' || existingApp.status === 'submitted');

  if (existingApp && !canEdit) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 text-center max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              You&apos;ve already applied
            </h2>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              Your application as {role.replace(/-/g, ' ')} is {existingApp.status}.
            </p>
            <Link
              href={`/conferences/${slug}`}
              className="inline-block rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              VIEW CONFERENCE →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if ((!roleConfig || !roleConfig.is_enabled) && !canEdit) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 text-center max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Applications are not open
            </h2>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              Applications for {role.replace(/-/g, ' ')} are not currently open for this conference.
            </p>
            <Link
              href={`/conferences/${slug}`}
              className="text-sm font-semibold"
              style={{ color: '#1B3828', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Age gate screens ──────────────────────────────────────────────────────

  if (underAge) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 text-center max-w-md w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 mb-4 text-[11px] font-bold"
              style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.25)', color: '#8B2020', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              AGE REQUIREMENT
            </span>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              This conference requires delegates to be at least {minAgeLimit} years old
            </h2>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}>
              Based on your date of birth, you will be {ageAtStart} when {conference.acronym} starts, so you can&apos;t apply this time. If your date of birth is wrong, you can update it in your profile.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/account/profile"
                className="text-sm font-semibold"
                style={{ color: '#1B3828', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
              >
                Edit profile
              </Link>
              <Link
                href={`/conferences/${slug}`}
                className="text-sm font-semibold"
                style={{ color: '#9A8A78', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
              >
                ← Back to {conference.acronym}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (needsDob) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 max-w-md w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 mb-4 text-[11px] font-bold"
              style={{ backgroundColor: 'rgba(182,135,31,0.12)', border: '1px solid rgba(182,135,31,0.35)', color: '#B6871F', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              {minAgeLimit}+ CONFERENCE
            </span>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Add your date of birth to continue
            </h2>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}>
              This conference requires delegates to be at least {minAgeLimit} years old, and your profile doesn&apos;t have a date of birth yet. It will be saved to your profile.
            </p>
            <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Date of birth
            </label>
            <DatePicker
              value={dobInput}
              max={new Date().toISOString().slice(0, 10)}
              initialView="2005-06-15"
              placeholder="Select your date of birth"
              onChange={(iso) => { setDobInput(iso); setDobError(''); }}
            />
            {dobError && (
              <p className="mt-1.5 text-xs" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                {dobError}
              </p>
            )}
            <button
              onClick={handleSaveDob}
              disabled={dobSaving || !dobInput}
              className="w-full mt-4 rounded-xl py-3 font-bold text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: (dobSaving || !dobInput) ? '#DDD4C0' : '#1B3828',
                color: (dobSaving || !dobInput) ? '#9A8A78' : '#EED98A',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '0.08em',
                cursor: (dobSaving || !dobInput) ? 'default' : 'pointer',
              }}
              onMouseEnter={(e) => { if (!dobSaving && dobInput) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { if (!dobSaving && dobInput) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {dobSaving ? 'SAVING...' : 'SAVE & CONTINUE'}
            </button>
            <div className="text-center mt-4">
              <Link
                href={`/conferences/${slug}`}
                className="text-sm font-semibold"
                style={{ color: '#9A8A78', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
              >
                ← Back to {conference.acronym}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      <SiteNav />

      <div className="relative z-10 flex-1 px-6 py-10" style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href={`/conferences/${slug}`}
            className="text-xs"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 600, letterSpacing: '0.06em', textDecoration: 'none' }}
          >
            ← {conference.acronym}
          </Link>
        </div>

        {isEditMode && (
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-5"
            style={{ backgroundColor: 'rgba(182,135,31,0.14)', border: '1px solid rgba(182,135,31,0.35)' }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#8A6614', fontFamily: "'Outfit', sans-serif" }}>
              EDITING YOUR APPLICATION
            </span>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-start mb-8">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === step;
            const isCompleted = stepNum < step;
            return (
              <Fragment key={stepNum}>
                {i > 0 && (
                  <div style={{ flex: 1, height: 1, backgroundColor: '#DDD4C0', marginTop: 16 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums',
                      backgroundColor: isActive ? '#1B3828' : isCompleted ? 'rgba(27,56,40,0.12)' : '#EDE7D8',
                      color: isActive ? '#EED98A' : isCompleted ? '#1B3828' : '#9A8A78',
                      border: (!isActive && !isCompleted) ? '1px solid #DDD4C0' : 'none',
                    }}
                  >
                    {isCompleted ? '✓' : stepNum}
                  </div>
                  <span style={{ fontSize: 10, marginTop: 4, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </div>
                {i < totalSteps - 1 && (
                  <div style={{ flex: 1, height: 1, backgroundColor: '#DDD4C0', marginTop: 16 }} />
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Form card */}
        <div className="rounded-2xl p-6 md:p-8" style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #C8BEA8', boxShadow: '0 2px 6px rgba(27,56,40,0.05), 0 16px 40px rgba(27,56,40,0.08)' }}>
          {currentStepKind === 'role' && renderStep1()}
          {currentStepKind === 'society' && renderStep2()}
          {currentStepKind === 'invoicing' && renderStepInvoicing()}
          {currentStepKind === 'preferences' && renderStep3Preferences()}
          {currentStepKind === 'aid' && renderStepAid()}
          {currentStepKind === 'experience' && renderStepExperience()}
        </div>

        {submitError && (
          <p className="mt-4 text-sm text-center" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
            {submitError}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Default export with Suspense ───────────────────────────────────────────

export default function ConferenceApplyClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      }
    >
      <ConferenceApplyInner />
    </Suspense>
  );
}
