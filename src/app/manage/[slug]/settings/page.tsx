'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  SlidersHorizontal, Building2, Users2, ShieldCheck, X, Lock, Copy, AlertTriangle, Check,
  Plus, Crown, Mail as MailIcon, ChevronDown, Info, ArrowLeft,
  Settings2, Globe, EyeOff, ArrowUp, ArrowDown, Trash2,
} from 'lucide-react';
import { useManage, type Conference } from '@/app/manage/[slug]/layout';

import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@supabase/supabase-js';
import { UN_COUNTRIES } from '@/lib/countries';
import { Pill } from '@/app/account/accountUi';
import { useConfirmModal, ConfirmModal } from '@/components/ConfirmModal';
import Portal from '@/components/Portal';
import { NEU, OUTFIT, EASE, Emoji3D } from '@/components/neu';
import { useScrollLock } from '@/hooks/useScrollLock';
import { LogoDisc } from '@/components/LogoDisc';
import { LogoCropModal } from '@/components/LogoCropModal';
import { DatePicker } from '@/components/DatePicker';
import { sendOrganizerInvite, listPendingOrganizerInvites, revokeOrganizerInvite, type OrganizerInviteRow } from '@/lib/organizerInvites';
import {
  ORGANIZER_SECTIONS, BUNDLES, bundlePermissions, detectBundle, bundleLabel,
  grantedSectionCount, canManageTeam as bundleGrantsTeam, financialsAreReadOnly,
  FINANCIALS_READONLY_KEY, TEAM_KEY, type BundleId, type PermissionMap,
} from '@/lib/organizerPermissions';
import { activeFeePhase, type FeePhase } from '@/lib/finance';
import { currencyPickerGroups } from '@/lib/currencies';
import { normalizeSocialUrl } from '@/lib/socialLinks';
import { acronymProblem, conferenceAcronymLabel } from '@/lib/conferenceLabels';
import {
  ROLE_ORDER, ROLE_EMOJI, ROLE_BLURB, RoleBookmarks, StepDisc, InfoHint,
  CopyToRolesModal, SetupIntro, Segmented, STATUS_STYLE,
  type RoleStatus as RoleStatusKind,
} from './applicationsUi';
import { type FormBlock, normalizeBlocks } from '@/lib/customQuestions';
import QuestionBuilder from '@/components/QuestionBuilder';
import { conferencePaymentsReady, paymentGateBlocks, paymentGateMessage } from '@/lib/payments';
import ProfileLink from '@/components/ProfileLink';

// ── Types ──────────────────────────────────────────────────────────────────

interface RoleConfig {
  id: string;
  conference_id: string;
  role: string;
  is_enabled: boolean;
  applications_open_at: string | null;
  applications_close_at: string | null;
  max_accepted: number | null;
  fee_amount: number;
  fee_currency: string;
  auto_accept: boolean;
  payment_timing: 'after_application' | 'after_acceptance' | 'anytime';
  custom_questions: unknown[];
  fee_phases: FeePhase[] | null;
  allow_resubmission: boolean;
  preference_mode: string;
  collect_mun_experience: boolean;
}

interface Organizer {
  id: string;
  role: string;
  user_id: string;
  permissions?: Record<string, boolean>;
  public_title: string | null;
  show_on_public: boolean;
  sort_order: number;
  profiles: { display_name: string; email: string; avatar_url: string | null } | null;
}

interface IncomingClaim {
  id: string;
  full_name: string;
  acronym: string;
  slug: string;
  start_date: string;
  end_date: string;
  predecessor_approved: boolean;
}

interface PredecessorSummary {
  id: string;
  full_name: string;
  acronym: string;
}

interface PartnerConf {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
}

interface PartnerLink {
  id: string;
  sort_order: number;
  approved: boolean;
  partner_conference_id: string;
  conf: PartnerConf | null;
}

interface IncomingPartnerClaim {
  link_id: string;
  requester_conference_id: string;
  requester_slug: string;
  requester_acronym: string;
  requester_full_name: string;
  requester_logo_url: string | null;
  requester_city: string | null;
  requester_country: string | null;
  requester_start_date: string | null;
  my_conference_id: string;
  my_acronym: string;
  created_at: string;
}

const PAYMENT_TIMING_OPTIONS: { value: RoleConfig['payment_timing']; label: string; desc: string }[] = [
  { value: 'after_application', label: 'AFTER APPLICATION', desc: 'Payment opens as soon as the application is submitted.' },
  { value: 'after_acceptance', label: 'AFTER ACCEPTANCE', desc: 'Payment opens only once the applicant is accepted.' },
  { value: 'anytime', label: 'PAY AT ANY TIME', desc: 'Applicants can view everything and pay whenever.' },
];

// What a role may express as preferences on the apply form. Persisted per role
// on application_role_configs.preference_mode; read by the apply flow to
// decide which pickers (committees / countries / neither) to show. Delegate
// and head-delegate may use any of the four; chair may only use
// committees_only or none (see CHAIR_PREF_MODE_OPTIONS below); every other
// role is always 'none' and never shows the preference card at all.
const PREF_MODE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'committees_and_countries', label: 'COMMITTEES + COUNTRIES', desc: 'Delegates rank committee-and-country pairings, the fullest picture for allocation.' },
  { value: 'committees_only', label: 'COMMITTEES', desc: 'Delegates rank committees only; you assign the countries.' },
  { value: 'countries_only', label: 'COUNTRIES', desc: 'Delegates rank countries only; committees follow from the country.' },
  { value: 'none', label: 'NONE', desc: 'No preference step. You allocate everyone manually.' },
];

// Chair's cut-down version: a chair picks which committee they would like to
// chair, never a country, so the country pairing options do not apply.
const CHAIR_PREF_MODE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'committees_only', label: 'CHOOSE A COMMITTEE', desc: 'Chairs rank which committee they would like to chair; you assign from their ranking.' },
  { value: 'none', label: 'NONE', desc: 'No preference step. You assign every chair to a committee yourself.' },
];

/** Roles whose preference_mode can be anything other than 'none'. Mirrors the
 *  database's second CHECK constraint on application_role_configs. */
function roleCanHavePreference(role: string): boolean {
  return role === 'delegate' || role === 'head-delegate' || role === 'chair';
}

const SWAP_MODE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'off', label: 'OFF', desc: 'Only organizers manage allocations.' },
  { value: 'request', label: 'REQUEST', desc: 'Advisors and head delegates can request swaps; you approve them.' },
  { value: 'self_serve', label: 'SELF-SERVE', desc: "Advisors and head delegates can swap within their delegation; you're notified." },
];

// ── Constants & helpers ────────────────────────────────────────────────────

const ROLES = ROLE_ORDER;

// Pinned USD/EUR/GBP + alphabetical rest, split once for every currency
// picker in this page, mirrors the creation flow's symbol+code display.
const CURRENCY_GROUPS = currencyPickerGroups();

// License-safe banner presets shipped in /public/banners (see its README.md).
const BANNER_PRESETS = [
  '/banners/preset-1.jpg',
  '/banners/preset-2.jpg',
  '/banners/preset-3.jpg',
  '/banners/preset-4.jpg',
  '/banners/preset-5.jpg',
];

function roleLabel(role: string): string {
  return role.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}


type RoleStatus = RoleStatusKind;

/** Four states, not two. A role can be switched on while its window has
 *  already closed, and "enabled" alone would report that as live. */
function roleStatus(config: RoleConfig | undefined, now: number): RoleStatus {
  if (!config?.is_enabled) return 'OFF';
  const opensAt = config.applications_open_at ? new Date(config.applications_open_at).getTime() : null;
  const closesAt = config.applications_close_at ? new Date(config.applications_close_at).getTime() : null;
  if (opensAt !== null && opensAt > now) return 'SCHEDULED';
  if (closesAt !== null && closesAt < now) return 'CLOSED';
  return 'OPEN';
}


/** One step's clickable header: a numbered disc that becomes a gold check once
 *  the step has nothing unresolved, the label, its subtitle, and a chevron.
 *  Module scope on purpose: a component declared inside the page would be a new
 *  type every render, remounting QuestionBuilder and losing its editing state. */
function StepHeader({ n, label, sub, complete, open, onClick, status = 'idle', hint }: {
  n: number; label: string; sub: string; complete: boolean; open: boolean; onClick: () => void;
  status?: 'idle' | 'saving' | 'saved';
  /** One paragraph explaining what this step decides, on a hover "i". */
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="w-full flex items-center gap-3 text-left focus:outline-none"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <StepDisc n={n} complete={complete} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold text-base" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          {label}
          {hint && <InfoHint label={`About ${label}`} text={hint} />}
        </span>
        <span className="block text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          {sub}
        </span>
      </span>
      {status === 'saving' && (
        <span className="text-xs flex-shrink-0" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Saving...
        </span>
      )}
      {status === 'saved' && (
        <span className="text-xs flex items-center gap-1 flex-shrink-0" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
          <Check size={12} strokeWidth={3} /> Saved
        </span>
      )}
      <ChevronDown
        size={18}
        strokeWidth={2.2}
        style={{ color: '#9A8A78', flexShrink: 0, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 200ms ease' }}
      />
    </button>
  );
}

const STEPS = [
  {
    n: 1, label: 'General info', sub: 'Dates, capacity and how applications are handled',
    hint: 'The window this role can apply in, and what happens to an application once it arrives. Nothing is public before the opening time, and the link starts working on its own the moment it passes, so you do not have to be at a keyboard. Max accepted is the ceiling on how many you will take; acceptance decides whether they are let in automatically or wait for you to review them; payment decides how early they can pay.',
  },
  {
    n: 2, label: 'Fees', sub: 'What this role costs and when the price changes',
    hint: 'One flat price, plus optional phases if the price moves over time: an early-bird window, a standard window, a late window. Whichever phase covers today is the price an applicant is quoted and charged. When no phase covers today, the flat fee applies. Phases may not overlap, because two prices for one day has no answer.',
  },
  {
    n: 3, label: 'Form', sub: 'The questions this role answers when applying',
    hint: 'The questions this role fills in when they apply: short answers, long answers, choices, uploads. Each role has its own form, because an advisor and a delegate have almost nothing in common to say. Reordering and rewording is safe at any time; answers already submitted are kept exactly as they were given.',
  },
] as const;

/** Fees (step 2) doesn't apply to secretariat or staff: nobody charges their
 *  own volunteers or their own secretariat, and the database already seeds
 *  fee_amount 0 for both. Used both by the render (which card to show) and by
 *  auto-advance (which step to land on next), so the two never disagree. */
function stepsForRole(role: string): typeof STEPS[number][] {
  return role === 'secretariat' || role === 'staff' ? STEPS.filter(s => s.n !== 2) : [...STEPS];
}

/** True when any two dated fee phases have intersecting [start, end] windows. */
function feePhasesOverlap(phases: FeePhase[]): boolean {
  const dated = phases.filter(p => p.start_date && p.end_date);
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      if (dated[i].start_date <= dated[j].end_date && dated[j].start_date <= dated[i].end_date) return true;
    }
  }
  return false;
}

/** UTC instant from the database to the local wall-clock value a
 *  datetime-local input expects. The old version sliced the ISO string,
 *  showing a UTC instant as if its digits were local time. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The inverse. A datetime-local value carries no zone, so `new Date` reads
 *  it as local wall-clock time, which is what the organizer meant, and we
 *  store the resulting instant as UTC. */
function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** IANA zone name for the label under the window fields, e.g. Europe/London. */
function localZoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time';
  } catch {
    return 'your local time';
  }
}

// Standard failure copy for every verified-write save in this page: a write
// that returns an error OR affects zero rows (RLS silently filtered it, or
// the row vanished) is treated identically, never a silent false success.
/** Fixed-viewport placement for a portaled floating layer. Clamps horizontally
 *  so it never runs off the right edge, and flips above the trigger when there
 *  is not enough room below. Never relies on an ancestor's overflow. */
function placeLayer(el: HTMLElement, width: number, height: number): { left: number; top: number } {
  const pad = 8;
  const r = el.getBoundingClientRect();
  const left = Math.min(Math.max(pad, r.left), Math.max(pad, window.innerWidth - pad - width));
  let top = r.bottom + 6;
  if (top + height > window.innerHeight - pad) top = Math.max(pad, r.top - 6 - height);
  return { left, top };
}

function saveFailMessage(error?: { message: string } | null): string {
  return "Couldn't save, please refresh and try again." + (error?.message ? ' ' + error.message : '');
}

// Exactly one plausible address, no spaces or pipes — catches the "a@x.com |
// b@y.com" case that silently broke reply-to on every email this conference sent.
const CONTACT_EMAIL_PATTERN = /^[^\s@|]+@[^\s@|]+\.[^\s@|]+$/;

const inputStyle: React.CSSProperties = {
  backgroundColor: '#FAF8F3',
  border: '1.5px solid #DDD4C0',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  color: '#1C1410',
  fontFamily: "'Outfit', sans-serif",
  outline: 'none',
  transition: 'border-color 150ms ease',
  width: '100%',
};

function fgInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#1B3828';
}
function bgInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#DDD4C0';
}

// ── PillToggle ─────────────────────────────────────────────────────────────

function PillToggle({ value, onChange, size = 'md', disabled = false }: {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: 'md' | 'sm';
  disabled?: boolean;
}) {
  const w = size === 'md' ? 40 : 32;
  const h = size === 'md' ? 22 : 18;
  const thumb = size === 'md' ? 18 : 14;
  const onLeft = size === 'md' ? 20 : 16;

  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onChange(!value); }}
      disabled={disabled}
      className="relative flex-shrink-0 focus:outline-none"
      style={{
        width: `${w}px`, height: `${h}px`,
        borderRadius: '9999px',
        backgroundColor: value ? '#1B3828' : '#DDD4C0',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 200ms ease, opacity 200ms ease',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="absolute rounded-full transition-all duration-200"
        style={{
          width: `${thumb}px`, height: `${thumb}px`,
          backgroundColor: 'white',
          top: '2px',
          left: value ? `${onLeft}px` : '2px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

// ── PartnerDisc ────────────────────────────────────────────────────────────
// The universal LogoDisc treatment: logo inside a near-white circular
// backdrop when the partner has one; otherwise a forest disc with a gold
// initial (same monogram language as the public-page medallions).

function PartnerDisc({ logoUrl, acronym, size = 40 }: {
  logoUrl: string | null;
  acronym: string;
  size?: number;
}) {
  return <LogoDisc src={logoUrl} alt={acronym} size={size} fallbackText={acronym?.[0] ?? '?'} />;
}

/** "Copy form to another role…" trigger + portaled role picker. The row card
 *  above doesn't clip (no overflow:hidden here), but this still portals at
 *  fixed viewport coordinates to match the rest of the app's popover rule. */
function CopyFormMenu({ roles, onPick }: { roles: string[]; onPick: (role: string) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const MENU_W = 200;

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - MENU_W - 8);
    setPos({ top: r.bottom + 6, left });
  }, []);

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

  if (roles.length === 0) return null;

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold focus:outline-none hover:underline"
        style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}
      >
        <Copy size={13} /> COPY FORM TO ANOTHER ROLE…
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={menuRef}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: MENU_W,
              backgroundColor: '#FAF8F3', borderRadius: 14, border: '1px solid #DDD4C0',
              boxShadow: '0 12px 32px rgba(27,56,40,0.18)', padding: 6,
            }}
          >
            <p className="px-2.5 pt-1 pb-1.5 text-[10px] font-bold" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.1em' }}>
              COPY TO
            </p>
            {roles.map(role => (
              <button
                key={role}
                onClick={() => { setOpen(false); onPick(role); }}
                className="w-full text-left px-2.5 py-2 rounded-lg text-sm focus:outline-none transition-colors"
                style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", background: 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {roleLabel(role)}
              </button>
            ))}
          </div>
        </Portal>
      )}
    </div>
  );
}

/** Subtle status line for an autosaving section, replaces a manual save button. */
function AutoSaveStatus({ saving, saved }: { saving: boolean; saved: boolean }) {
  const text = saving ? 'Saving…' : saved ? 'Saved ✓' : 'Changes save automatically';
  return (
    <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: saved ? '#3D7A52' : '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
      {saving && <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#9A8A78', borderTopColor: 'transparent' }} />}
      {text}
    </p>
  );
}

// ── Settings page ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { conference, refreshConferenceQuiet } = useManage();
  const { user, session, profile } = useAuth();
  // Deep-links from the dashboard checklist pass ?tab= to land on the right
  // sub-tab (e.g. "Set up your conference page" → conference). Falls back to
  // applications for any missing/unknown value. 'team' is the alias the
  // secretariat accept redirect uses (?tab=team&highlight=<organizer id>) —
  // same tab as 'organizers', named the way a person reading the URL would
  // expect rather than the internal section key.
  const initialTab = ((): 'applications' | 'conference' | 'organizers' | 'privacy' => {
    const t = searchParams.get('tab') ?? searchParams.get('section');
    if (t === 'team') return 'organizers';
    return t === 'conference' || t === 'organizers' || t === 'privacy' ? t : 'applications';
  })();
  const [activeTab, setActiveTab] = useState<'applications' | 'conference' | 'organizers' | 'privacy'>(initialTab);
  // Which role's configuration the Applications section is showing. Derived
  // from ?role= rather than held in state, so a deep link lands on the right
  // role and the back button walks back through them.
  const roleParam = searchParams.get('role');
  const activeRole: string = (ROLES as readonly string[]).includes(roleParam ?? '') ? (roleParam as string) : ROLES[0];
  function setActiveRole(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('role', next);
    router.push(`?${params.toString()}`, { scroll: false });
  }
  // Applications splits in two: the per-role setup (bookmarks + three steps)
  // At most one step open. 0 means all collapsed, which is where auto-advance
  // leaves you after the last step.
  const [openStep, setOpenStep] = useState<number>(1);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Visual tab state
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const [description, setDescription] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [visualSaved, setVisualSaved] = useState(false);
  const [visualError, setVisualError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  // Logo picked but not yet uploaded, the drag-to-fit crop modal is open.
  const [logoCropFile, setLogoCropFile] = useState<File | null>(null);

  // Conference details (identity + logistics, mirrors the creation form)
  const [fullName, setFullName] = useState('');
  const [acronym, setAcronym] = useState('');
  const [acronymError, setAcronymError] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactEmailError, setContactEmailError] = useState('');
  const [studentLevel, setStudentLevel] = useState<'school' | 'university' | 'both' | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datesTbd, setDatesTbd] = useState(false);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [format, setFormat] = useState<'in-person' | 'online' | 'hybrid' | ''>('');
  const [expectedDelegates, setExpectedDelegates] = useState('');
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  // Age range (Applications → General). min_age has existed since launch;
  // max_age is its other half, and both are measured on the start date.
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [minAgeSaved, setMinAgeSaved] = useState(false);
  const [minAgeError, setMinAgeError] = useState('');
  // Writing one of the "same for everybody" settings across all five roles.
  // "Set the same phase up for another role?" — offered once per role per
  // visit, the moment a phase first becomes usable, and always available from
  // the button beside + ADD PHASE. Re-typing the same two dates five times is
  // the single most tedious part of setting a conference up.
  const [copyPhasesOpen, setCopyPhasesOpen] = useState(false);
  const [copyPhasesBusy, setCopyPhasesBusy] = useState(false);
  const [copyPhasesNotice, setCopyPhasesNotice] = useState('');
  const phaseOfferedFor = useRef<Set<string>>(new Set());
  // Roles whose first-run walkthrough has been dismissed, kept in localStorage
  // per conference. Hydrated after mount so the server render and the first
  // client render agree.
  const [introDone, setIntroDone] = useState<Set<string>>(new Set());
  const introHydrated = useRef(false);

  // Delegation allocation swaps (Applications tab)
  const [swapMode, setSwapMode] = useState('request');
  const [swapModeError, setSwapModeError] = useState('');

  // Preference mode is per-role, on application_role_configs.preference_mode
  // (roleConfigs, already loaded). prefMode itself is derived below from the
  // selected role's config row, not held as its own state.
  const [prefModeSaving, setPrefModeSaving] = useState(false);
  const [prefModeError, setPrefModeError] = useState('');

  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [configVersion, setConfigVersion] = useState(0);
  const [roleConfigError, setRoleConfigError] = useState('');
  type SaveState = 'idle' | 'saving' | 'saved';
  const [stepSaveState, setStepSaveState] = useState<Record<number, SaveState>>({ 1: 'idle', 2: 'idle', 3: 'idle' });
  const savedTimersRef = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({ 1: null, 2: null, 3: null });
  // Roles with at least one application already in the pipeline (submitted or
  // further along) — used only to show a quiet caution in the question
  // builder when rewording a question those applicants may have already
  // answered. Never blocks an edit; see QuestionBuilder's hasApplications prop.
  const [rolesWithApplications, setRolesWithApplications] = useState<Set<string>>(new Set());
  const { confirm, modal: confirmModal } = useConfirmModal();
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  // ── Team highlight, from the secretariat-accept redirect ─────────────────
  // ?highlight=<organizer id> scrolls that member's card into view and gives
  // its existing accent ring a brief, brighter pulse, so the person who was
  // just accepted is obviously the one who landed on this page.
  const highlightOrgId = searchParams.get('highlight');
  const [highlightPulse, setHighlightPulse] = useState(false);
  const highlightedRef = useRef(false);
  useEffect(() => {
    if (!highlightOrgId || activeTab !== 'organizers' || highlightedRef.current) return;
    const el = document.getElementById(`organizer-${highlightOrgId}`);
    if (!el) return;
    highlightedRef.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightPulse(true);
    const t = setTimeout(() => setHighlightPulse(false), 2600);
    return () => clearTimeout(t);
  }, [highlightOrgId, activeTab, organizers]);
  // The form builder edits whichever role the tab is on.
  const selectedRole = activeRole;
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteNotice, setInviteNotice] = useState('');
  // Consent-based invite flow, mirrors chair invites: a pending row + email,
  // accepted/declined by the invitee via /invites/organizer/[token].
  const [pendingInvites, setPendingInvites] = useState<OrganizerInviteRow[]>([]);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  // "+" invite flow: email → role → privileges → send.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteStep, setInviteStep] = useState<1 | 2 | 3>(1);
  const [inviteBundle, setInviteBundle] = useState<BundleId>('admin');
  const [inviteCustomPerms, setInviteCustomPerms] = useState<PermissionMap>({});
  // The public-facing role, asked for at the moment of adding rather than left
  // to be filled in later. Rides along on the invite row and lands on the team
  // row when they accept (respond_organizer_invite).
  const [invitePublicTitle, setInvitePublicTitle] = useState('');
  // Floating layers keep a handle on their TRIGGER, not a frozen rect, so they
  // can be re-placed on scroll/resize instead of drifting (AGENTS.md: popovers
  // are portaled at fixed coords and flip near an edge).
  const [bundleMenuFor, setBundleMenuFor] = useState<{ orgId: string; el: HTMLElement } | null>(null);
  const [bundleMenuPos, setBundleMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [tierHint, setTierHint] = useState<{ id: string; text: string; el: HTMLElement } | null>(null);
  const [tierHintPos, setTierHintPos] = useState<{ left: number; top: number } | null>(null);
  // Per-member sheet. Holds everything that would otherwise crowd a tree node:
  // public listing, the public-facing role, page access, and removal.
  const [memberSheetId, setMemberSheetId] = useState<string | null>(null);

  // `organizers` mirrored into a ref that is updated SYNCHRONOUSLY on every
  // write. Permission toggles used to read the previous permissions out of the
  // render closure, so two clicks in the same frame both built their `next`
  // from the same stale snapshot and the second write silently reverted the
  // first. Everything that mutates the list now goes through applyOrganizers.
  const organizersRef = useRef<Organizer[]>([]);
  const applyOrganizers = useCallback((updater: (prev: Organizer[]) => Organizer[]) => {
    const next = updater(organizersRef.current);
    organizersRef.current = next;
    setOrganizers(next);
  }, []);
  // One serial write chain per organizer row, so rapid clicks land in click
  // order instead of racing each other to be last-writer.
  const permWriteChain = useRef<Map<string, Promise<void>>>(new Map());
  // Same treatment for the public-page columns. "Show on public page" had the
  // identical stale-closure defect the permission chips used to have — see
  // toggleOrganizerPublic below.
  const publicWriteChain = useRef<Map<string, Promise<void>>>(new Map());

  // House rule: the page behind a modal must not scroll. The bundle menu and
  // the tier hint are non-modal floating layers and deliberately do NOT lock.
  useScrollLock(inviteOpen || memberSheetId !== null);

  // Gavelling staff have no conference_organizers row, so nothing in the team
  // list identifies them. Ask the database directly — is_conference_owner()
  // now honours platform admins, so the controls this unlocks really do write.
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void (async () => {
      const { data } = await getAuthedClient(session.access_token).rpc('is_platform_admin');
      if (!cancelled) setIsPlatformAdmin(data === true);
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Bundle menu: re-place on scroll/resize, close on an outside mousedown that
  // accounts for the portaled node (it is not a DOM descendant of the trigger).
  useEffect(() => {
    if (!bundleMenuFor) { setBundleMenuPos(null); return; }
    const el = bundleMenuFor.el;
    const place = () => setBundleMenuPos(placeLayer(el, 276, 244));
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest('[data-bundle-menu]') || el.contains(t)) return;
      setBundleMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBundleMenuFor(null); };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [bundleMenuFor]);

  // Tier "i" affordance — hover/focus only, never click (AGENTS.md UI rule).
  useEffect(() => {
    if (!tierHint) { setTierHintPos(null); return; }
    const el = tierHint.el;
    const place = () => setTierHintPos(placeLayer(el, 272, 164));
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [tierHint]);

  // Lineage (previous editions)
  const [incomingClaims, setIncomingClaims] = useState<IncomingClaim[]>([]);
  const [predecessorInfo, setPredecessorInfo] = useState<PredecessorSummary | null>(null);
  const [lineageBusy, setLineageBusy] = useState<string | null>(null);
  const [lineageError, setLineageError] = useState('');

  // Partner conferences
  const [partners, setPartners] = useState<PartnerLink[]>([]);
  const [incomingPartnerClaims, setIncomingPartnerClaims] = useState<IncomingPartnerClaim[]>([]);
  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerResults, setPartnerResults] = useState<PartnerConf[]>([]);
  const [partnerBusy, setPartnerBusy] = useState<string | null>(null);
  const [partnerError, setPartnerError] = useState('');

  // Organizers + privacy inline error surfaces
  const [organizersError, setOrganizersError] = useState('');
  const [privacyError, setPrivacyError] = useState('');
  const [archiving, setArchiving] = useState(false);

  // Per-save "saving" flags, every conference-row save below is: click →
  // disabled/spinner → awaited + verified write → refreshConferenceQuiet()
  // (so the UI reflects DB truth) → THEN flip to saved. No optimistic
  // pre-confirmation state; see AGENTS.md-adjacent postmortem on silent
  // zero-row writes reporting false success.
  const [visualSaving, setVisualSaving] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [minAgeSaving, setMinAgeSaving] = useState(false);
  const [swapModeSaving, setSwapModeSaving] = useState(false);
  const [publicToggleSaving, setPublicToggleSaving] = useState(false);
  const [withdrawingClaim, setWithdrawingClaim] = useState(false);

  // Autosave baselines for the three manual-input sections below (details,
  // visual, min age). Each baseline is the last-persisted raw input
  // snapshot, null until hydrated from `conference` — a debounced effect
  // compares the live snapshot against it and saves only on a real diff, so
  // a freshly-loaded form (or a save's own re-render) never re-triggers.
  const snap = (o: Record<string, unknown>) => JSON.stringify(o);
  const detailsBaseline = useRef<string | null>(null);
  const visualBaseline = useRef<string | null>(null);
  const minAgeBaseline = useRef<string | null>(null);
  const detailsSnap = () => snap({ fullName, acronym, contactEmail, studentLevel, startDate, endDate, datesTbd, country, city, format, expectedDelegates });
  const visualSnap = () => snap({ description, instagramUrl, facebookUrl, tiktokUrl, whatsappUrl, websiteUrl });
  const minAgeSnap = () => snap({ minAge, maxAge });

  // Stale-response guards: each loader bumps its counter at call start and
  // bails after every await if a newer call has started since.
  const roleSeq = useRef(0);
  // Inline question editing fires on every keystroke. These hold the pending
  // blocks per role, the debounce timer, and a promise chain that keeps two
  // writes for the same role from ever overlapping (same reasoning as the
  // per-organizer serial chains in the team tab).
  const blocksPendingRef = useRef<Map<string, FormBlock[]>>(new Map());
  const blocksTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksChainRef = useRef<Promise<void>>(Promise.resolve());
  const flushRef = useRef<(role?: string) => void>(() => {});
  const rolesWithApplicationsSeq = useRef(0);
  const orgSeq = useRef(0);
  const invitesSeq = useRef(0);
  const lineageSeq = useRef(0);
  const partnersSeq = useRef(0);
  const incomingSeq = useRef(0);

  // ── Data loaders ────────────────────────────────────────────────────────

  const loadRoleConfigs = useCallback(async () => {
    if (!conference) return;
    if (!session) return;
    const seq = ++roleSeq.current;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('application_role_configs')
      .select('*')
      .eq('conference_id', conference.id);
    if (seq !== roleSeq.current) return;
    if (data) {
      setRoleConfigs(data as RoleConfig[]);
      setConfigVersion(v => v + 1);
    }
  }, [conference]);

  // Count query on applications for (conference_id, role): any role with a
  // submitted-or-further application surfaces a quiet caution in the question
  // builder when its existing questions get reworded.
  const loadRolesWithApplications = useCallback(async () => {
    if (!conference) return;
    if (!session) return;
    const seq = ++rolesWithApplicationsSeq.current;
    const supabase = getAuthedClient(session.access_token);
    const results = await Promise.all(ROLES.map(async (role) => {
      const { count } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('conference_id', conference.id)
        .eq('role', role)
        .in('status', ['submitted', 'accepted', 'assigned', 'checked-in']);
      return { role, hasApplications: (count ?? 0) > 0 };
    }));
    if (seq !== rolesWithApplicationsSeq.current) return;
    setRolesWithApplications(new Set(results.filter(r => r.hasApplications).map(r => r.role)));
  }, [conference, session]);

  const loadOrganizers = useCallback(async () => {
    if (!conference) return;
    if (!session) return;
    const seq = ++orgSeq.current;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_organizers')
      .select('id, role, user_id, permissions, public_title, show_on_public, sort_order, profiles(display_name, email, avatar_url)')
      .eq('conference_id', conference.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (seq !== orgSeq.current) return;
    if (data) applyOrganizers(() => data as unknown as Organizer[]);
  }, [conference, applyOrganizers]);

  const loadPendingInvites = useCallback(async () => {
    if (!conference || !session) return;
    const seq = ++invitesSeq.current;
    const supabase = getAuthedClient(session.access_token);
    const rows = await listPendingOrganizerInvites(supabase, conference.id);
    if (seq !== invitesSeq.current) return;
    setPendingInvites(rows);
  }, [conference, session]);

  const loadLineage = useCallback(async () => {
    if (!conference || !session) return;
    const seq = ++lineageSeq.current;
    const supabase = getAuthedClient(session.access_token);

    // Incoming claims: other conferences claiming this one as their previous edition.
    // Goes through a SECURITY DEFINER RPC because the successor may be private.
    const { data: claims } = await supabase.rpc('list_incoming_predecessor_claims', {
      p_conference_id: conference.id,
    });
    if (seq !== lineageSeq.current) return;
    setIncomingClaims((claims as IncomingClaim[] | null) ?? []);

    // Outgoing claim: this conference's own predecessor, if any.
    if (conference.predecessor_conference_id) {
      const { data: pred } = await supabase
        .from('conferences')
        .select('id, full_name, acronym')
        .eq('id', conference.predecessor_conference_id)
        .maybeSingle();
      if (seq !== lineageSeq.current) return;
      setPredecessorInfo((pred as PredecessorSummary | null) ?? null);
    } else {
      setPredecessorInfo(null);
    }
  }, [conference, session]);

  const loadPartners = useCallback(async () => {
    if (!conference || !session) return;
    const seq = ++partnersSeq.current;
    const supabase = getAuthedClient(session.access_token);
    const { data: links } = await supabase
      .from('conference_partners')
      .select('id, sort_order, approved, partner_conference_id')
      .eq('conference_id', conference.id)
      .order('sort_order', { ascending: true });
    if (seq !== partnersSeq.current) return;
    const rows = (links as Omit<PartnerLink, 'conf'>[] | null) ?? [];

    const details: Record<string, PartnerConf> = {};
    if (rows.length > 0) {
      const { data: confs } = await supabase
        .from('conferences')
        .select('id, slug, full_name, acronym, logo_url, city, country, start_date')
        .in('id', rows.map(r => r.partner_conference_id));
      if (seq !== partnersSeq.current) return;
      for (const c of (confs as PartnerConf[] | null) ?? []) details[c.id] = c;
    }
    setPartners(rows.map(r => ({ ...r, conf: details[r.partner_conference_id] ?? null })));
  }, [conference, session]);

  const loadIncomingPartnerClaims = useCallback(async () => {
    if (!conference || !session) return;
    const seq = ++incomingSeq.current;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase.rpc('list_incoming_partner_claims');
    if (seq !== incomingSeq.current) return;
    setIncomingPartnerClaims(
      ((data as IncomingPartnerClaim[] | null) ?? []).filter(c => c.my_conference_id === conference.id)
    );
  }, [conference, session]);

  const ensureRoleConfigs = useCallback(async () => {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data: existing } = await supabase
      .from('application_role_configs')
      .select('id')
      .eq('conference_id', conference.id);
    if (existing && existing.length > 0) return;

    const defaults = ROLES.map(role => ({
      conference_id: conference.id,
      role,
      // Mirrors the INSERT trigger's own coercion: the database would force
      // these to false anyway when the conference isn't ready and isn't
      // exempt, so seed local state with the same value it will actually
      // land on rather than one the next refetch immediately contradicts.
      is_enabled: (role === 'delegate' || role === 'chair') && (conference.payment_gate_exempt || conferencePaymentsReady(conference)),
      fee_amount: 0,
      fee_currency: conference.fee_currency ?? 'GBP',
      auto_accept: false,
      payment_timing: 'anytime' as const,
      custom_questions: [],
    }));
    await supabase.from('application_role_configs').insert(defaults);
    await loadRoleConfigs();
  }, [conference, loadRoleConfigs]);

  useEffect(() => {
    if (!conference) return;
    loadRoleConfigs();
    loadRolesWithApplications();
    loadOrganizers();
    loadPendingInvites();
    loadLineage();
    loadPartners();
    loadIncomingPartnerClaims();
    setDescription(conference.description ?? '');
    setInstagramUrl(conference.instagram_url ?? '');
    setFacebookUrl(conference.facebook_url ?? '');
    setTiktokUrl(conference.tiktok_url ?? '');
    setWhatsappUrl(conference.whatsapp_url ?? '');
    setWebsiteUrl(conference.website_url ?? '');
    setMinAge(conference.min_age != null ? String(conference.min_age) : '');
    setMaxAge(conference.max_age != null ? String(conference.max_age) : '');
    setSwapMode(conference.allocation_swap_mode ?? 'request');
    setSwapModeError('');
    setFullName(conference.full_name ?? '');
    setAcronym(conference.acronym ?? '');
    setAcronymError('');
    setContactEmail(conference.contact_email ?? '');
    setContactEmailError('');
    setStudentLevel((conference.student_level as 'school' | 'university' | 'both' | '') ?? '');
    setStartDate(conference.start_date ?? '');
    setEndDate(conference.end_date ?? '');
    setDatesTbd(conference.dates_tbd ?? false);
    setCountry(conference.country ?? '');
    setCity(conference.city ?? '');
    setFormat((conference.format as 'in-person' | 'online' | 'hybrid' | '') ?? '');
    setExpectedDelegates(conference.expected_delegates != null ? String(conference.expected_delegates) : '');
    // Baselines mirror the values just hydrated above, so the autosave
    // effects see no diff (and thus don't fire) right after a fresh load.
    detailsBaseline.current = snap({
      fullName: conference.full_name ?? '', acronym: conference.acronym ?? '',
      contactEmail: conference.contact_email ?? '',
      studentLevel: (conference.student_level as 'school' | 'university' | 'both' | '') ?? '',
      startDate: conference.start_date ?? '', endDate: conference.end_date ?? '',
      datesTbd: conference.dates_tbd ?? false,
      country: conference.country ?? '', city: conference.city ?? '',
      format: (conference.format as 'in-person' | 'online' | 'hybrid' | '') ?? '',
      expectedDelegates: conference.expected_delegates != null ? String(conference.expected_delegates) : '',
    });
    visualBaseline.current = snap({
      description: conference.description ?? '', instagramUrl: conference.instagram_url ?? '',
      facebookUrl: conference.facebook_url ?? '', tiktokUrl: conference.tiktok_url ?? '',
      whatsappUrl: conference.whatsapp_url ?? '', websiteUrl: conference.website_url ?? '',
    });
    minAgeBaseline.current = snap({
      minAge: conference.min_age != null ? String(conference.min_age) : '',
      maxAge: conference.max_age != null ? String(conference.max_age) : '',
    });
  }, [conference?.id, loadRoleConfigs, loadRolesWithApplications, loadOrganizers, loadPendingInvites, loadLineage, loadPartners, loadIncomingPartnerClaims]);

  // Partner typeahead: debounced authed search over public conferences,
  // excluding this conference and anything already linked.
  useEffect(() => {
    if (!conference || !session) return;
    const q = partnerQuery.trim();
    if (q.length < 2) { setPartnerResults([]); return; }
    const timer = setTimeout(async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('conferences')
        .select('id, slug, full_name, acronym, logo_url, city, country, start_date')
        .eq('is_public', true)
        .neq('id', conference.id)
        .or(`acronym.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(8);
      const linkedIds = new Set(partners.map(p => p.partner_conference_id));
      setPartnerResults(((data as PartnerConf[] | null) ?? []).filter(c => !linkedIds.has(c.id)));
    }, 300);
    return () => clearTimeout(timer);
  }, [partnerQuery, conference?.id, session, partners]);

  useEffect(() => {
    if (!conference || roleConfigs.length > 0) return;
    ensureRoleConfigs();
  }, [conference, roleConfigs.length, ensureRoleConfigs]);

  // ── Role config save ────────────────────────────────────────────────────

  /** Which step a write belongs to, derived from the columns being written.
   *  Keeps saveRoleConfig's signature untouched at every call site. is_enabled
   *  is deliberately absent: the role toggle lives in the header bar, not in a
   *  step, so it lights nothing. */
  const STEP_OF_FIELD: Record<string, number> = {
    applications_open_at: 1, applications_close_at: 1, max_accepted: 1,
    auto_accept: 1, payment_timing: 1, allow_resubmission: 1,
    fee_amount: 2, fee_currency: 2, fee_phases: 2,
    custom_questions: 3,
  };

  function stepForUpdates(updates: Record<string, unknown>): number | null {
    for (const key of Object.keys(updates)) {
      const step = STEP_OF_FIELD[key];
      if (step) return step;
    }
    return null;
  }

  function markStep(step: number | null, state: SaveState) {
    if (!step) return;
    if (savedTimersRef.current[step]) {
      clearTimeout(savedTimersRef.current[step] as ReturnType<typeof setTimeout>);
      savedTimersRef.current[step] = null;
    }
    setStepSaveState(prev => ({ ...prev, [step]: state }));
    if (state === 'saved') {
      savedTimersRef.current[step] = setTimeout(() => {
        setStepSaveState(prev => ({ ...prev, [step]: 'idle' }));
        savedTimersRef.current[step] = null;
      }, 2000);
    }
  }

  async function saveRoleConfig(role: string, updates: Partial<RoleConfig>) {
    const step = stepForUpdates(updates as Record<string, unknown>);
    if (!conference) return;
    if (!session) return;

    // Optimistic: patch local state immediately so the control reflects the
    // click at once, independent of any other save's in-flight DB round trip.
    const previous = roleConfigs;
    setRoleConfigs(prev => prev.map(rc => (rc.role === role ? { ...rc, ...updates } : rc)));
    setRoleConfigError('');
    markStep(step, 'saving');

    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setRoleConfigs(previous);
      setRoleConfigError('Your session has expired, please refresh and sign in again.');
      markStep(step, 'idle');
      return;
    }

    const { data, error } = await supabase
      .from('application_role_configs')
      .update(updates)
      .eq('conference_id', conference.id)
      .eq('role', role)
      .select('id');

    if (error || !data || data.length === 0) {
      // Revert the optimistic patch and surface the failure, a silent
      // no-op update (0 rows matched, no error) is treated as a failure too.
      setRoleConfigs(previous);
      setRoleConfigError(error ? error.message : "Couldn't save, that role config wasn't found.");
      markStep(step, 'idle');
    } else {
      markStep(step, 'saved');
    }
  }

  // ── First-run walkthrough bookkeeping ────────────────────────────────────
  // A role that has never been configured gets three illustrated slides
  // explaining what its three steps decide, before the form itself. Dismissed
  // state is per conference and per role, in localStorage — it is a first-run
  // courtesy, not a preference worth a database column.

  const introStorageKey = conference ? `gv-role-setup-intro-${conference.id}` : null;

  useEffect(() => {
    if (!introStorageKey || introHydrated.current) return;
    introHydrated.current = true;
    try {
      const raw = window.localStorage.getItem(introStorageKey);
      if (raw) setIntroDone(new Set(JSON.parse(raw) as string[]));
    } catch { /* private mode, or corrupt value: show the intro, harmless */ }
  }, [introStorageKey]);

  function dismissIntro(role: string) {
    setIntroDone(prev => {
      const next = new Set(prev).add(role);
      if (introStorageKey) {
        try { window.localStorage.setItem(introStorageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      }
      return next;
    });
  }

  /** True when nothing about this role has been decided yet: no window, no
   *  cap, no fee, no questions. A role part-way through setup is NOT untouched
   *  — the walkthrough would be an interruption at that point. */
  function roleIsUntouched(rc: RoleConfig | undefined): boolean {
    if (!rc) return false;
    return (
      // Switching the role on is the loudest possible "I have touched this",
      // and it is the one field the header shows rather than the steps.
      !rc.is_enabled &&
      !rc.applications_open_at &&
      !rc.applications_close_at &&
      rc.max_accepted == null &&
      Number(rc.fee_amount) === 0 &&
      (rc.fee_phases ?? []).length === 0 &&
      (rc.custom_questions ?? []).length === 0
    );
  }

  // Patch one field of one fee phase and persist the whole jsonb array —
  // rides saveRoleConfig's optimistic-update-with-rollback.
  function updateFeePhase(role: string, phases: FeePhase[], idx: number, patch: Partial<FeePhase>) {
    const next = phases.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    void saveRoleConfig(role, { fee_phases: next });
    // The moment this role has at least one phase with both ends of its window
    // filled in, offer to give the other roles the same one. Once per role per
    // visit — a suggestion, never a nag.
    const usable = next.some(p => p.start_date && p.end_date);
    if (usable && !phaseOfferedFor.current.has(role) && ROLES.length > 1) {
      phaseOfferedFor.current.add(role);
      setCopyPhasesOpen(true);
    }
  }

  /** Copy this role's whole fee-phase ladder (and its flat fee, which the
   *  phases fall back to) onto the chosen roles. */
  async function copyPhasesToRoles(targets: string[]) {
    const source = roleConfigs.find(rc => rc.role === activeRole);
    if (!conference || !source || copyPhasesBusy) return;
    setCopyPhasesBusy(true);
    setRoleConfigError('');
    const patch = {
      fee_phases: source.fee_phases ?? [],
      fee_amount: source.fee_amount,
      fee_currency: source.fee_currency,
    };
    const previous = roleConfigs;
    setRoleConfigs(prev => prev.map(rc => (targets.includes(rc.role) ? { ...rc, ...patch } : rc)));
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setRoleConfigs(previous);
      setCopyPhasesBusy(false);
      setRoleConfigError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase
      .from('application_role_configs')
      .update(patch)
      .eq('conference_id', conference.id)
      .in('role', targets)
      .select('id');
    setCopyPhasesBusy(false);
    if (error || !data || data.length === 0) {
      setRoleConfigs(previous);
      setRoleConfigError(error ? error.message : "Couldn't copy those phases across.");
      return;
    }
    setCopyPhasesOpen(false);
    setConfigVersion(v => v + 1);
    setCopyPhasesNotice(`Copied to ${targets.length} ${targets.length === 1 ? 'role' : 'roles'}`);
    setTimeout(() => setCopyPhasesNotice(''), 3000);
  }

  // Toggle that writes immediately (no dedicated save button): shows an
  // inline spinner on the control while writing, verifies the write actually
  // matched a row, and only reflects the new mode once DB truth confirms it.
  async function saveSwapMode(mode: string) {
    if (!conference || swapModeSaving) return;
    setSwapModeSaving(true);
    setSwapModeError('');

    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setSwapModeSaving(false);
      setSwapModeError('Your session has expired, please refresh and sign in again.');
      return;
    }

    const { data, error } = await supabase
      .from('conferences')
      .update({ allocation_swap_mode: mode })
      .eq('id', conference.id)
      .select('id');

    if (error || !data || data.length !== 1) {
      setSwapModeSaving(false);
      setSwapModeError(saveFailMessage(error));
      return;
    }
    await refreshConferenceQuiet();
    setSwapMode(mode);
    setSwapModeSaving(false);
  }

  // Same verified-write pattern as saveSwapMode: control-busy, exact rollback
  // (roleConfigs only picks up the new value after the DB write is confirmed,
  // never before — prefMode is derived from roleConfigs, so this is what
  // makes it visibly flip). Writes application_role_configs, not conferences:
  // preference_mode is per role now, not a single conference-wide column.
  async function savePrefMode(mode: string) {
    if (!conference || prefModeSaving) return;
    setPrefModeSaving(true);
    setPrefModeError('');

    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setPrefModeSaving(false);
      setPrefModeError('Your session has expired, please refresh and sign in again.');
      return;
    }

    const { data, error } = await supabase
      .from('application_role_configs')
      .update({ preference_mode: mode })
      .eq('conference_id', conference.id)
      .eq('role', selectedRole)
      .select('id');

    if (error || !data || data.length !== 1) {
      setPrefModeSaving(false);
      setPrefModeError(saveFailMessage(error));
      return;
    }
    setRoleConfigs(prev => prev.map(rc => (rc.role === selectedRole ? { ...rc, preference_mode: mode } : rc)));
    setPrefModeSaving(false);
  }

  // ── Organizer actions ───────────────────────────────────────────────────

  // Consent-based, mirrors sendChairInvite: always goes through
  // create_organizer_invite, no direct conference_organizers insert. Works
  // whether or not the invitee already has a Gavelling account, and the RPC
  // itself rejects an email already on the team.
  function openInviteFlow() {
    setInviteEmail('');
    setInviteError('');
    setInviteNotice('');
    setInviteBundle('admin');
    setInviteCustomPerms({});
    setInvitePublicTitle('');
    setInviteStep(1);
    setInviteOpen(true);
  }

  // The chosen bundle rides along on the invite row, so respond_organizer_invite
  // creates the conference_organizers row with these privileges already set
  // rather than an empty blob somebody has to remember to fill in later.
  async function handleInvite() {
    if (!conference || !session || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    setInviteNotice('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setInviting(false);
      setInviteError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const res = await sendOrganizerInvite(supabase, {
      conferenceId: conference.id,
      email: inviteEmail.trim(),
      inviterName: profile?.display_name || 'A Gavelling organizer',
      bundle: inviteBundle,
      permissions: bundlePermissions(inviteBundle, inviteCustomPerms),
      publicTitle: invitePublicTitle,
    });
    setInviting(false);
    if (!res.ok) {
      setInviteError(res.error ?? "Couldn't send that invite. Please try again.");
      return;
    }
    const sentTo = res.invitedEmail;
    setInviteOpen(false);
    setInviteEmail('');
    setInvitePublicTitle('');
    setInviteNotice(res.existing
      ? `An invite for ${sentTo} was already pending, the original link still works. Its privileges now match what you just picked.`
      : `Invite sent to ${sentTo} as ${bundleLabel(inviteBundle).toLowerCase()}. They'll appear on the team once they accept.`);
    void loadPendingInvites();
  }

  async function handleRevokeInvite(invite: OrganizerInviteRow) {
    if (!session || revokingInviteId) return;
    const { confirmed } = await confirm({
      title: 'Revoke invite?',
      body: `Revoke the invite sent to ${invite.email}? The link they were sent will stop working.`,
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (!confirmed) return;

    setRevokingInviteId(invite.id);
    // Optimistic remove with rollback, matches the organizer row pattern.
    const previous = pendingInvites;
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
    setInviteError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setPendingInvites(previous);
      setInviteError('Your session has expired, please refresh and sign in again.');
      setRevokingInviteId(null);
      return;
    }
    const res = await revokeOrganizerInvite(supabase, invite.id);
    if (!res.ok) {
      setPendingInvites(previous);
      setInviteError(res.error ?? "Couldn't revoke that invite. Please try again.");
    }
    setRevokingInviteId(null);
  }

  // A failed permission write can't roll back to a snapshot — by the time it
  // fails the member may have been toggled again. Re-read the row instead, so
  // the screen ends up showing what the database actually holds.
  const resyncOrganizerPermissions = useCallback(async (orgId: string, message: string) => {
    setOrganizersError(message);
    const supabase = await getFreshAuthedClient();
    if (!supabase) return;
    const { data } = await supabase
      .from('conference_organizers')
      .select('permissions')
      .eq('id', orgId)
      .maybeSingle();
    const truth = (data?.permissions ?? {}) as PermissionMap;
    applyOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, permissions: truth } : o));
  }, [applyOrganizers]);

  // Writes for one member are chained, never run in parallel: click A then
  // click B and B's UPDATE is issued only after A's has returned, so the last
  // request to reach the database is always the last click on screen.
  const queuePermissionWrite = useCallback((orgId: string, next: PermissionMap) => {
    const previous = permWriteChain.current.get(orgId) ?? Promise.resolve();
    const run = previous.then(async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        await resyncOrganizerPermissions(orgId, 'Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase
        .from('conference_organizers')
        .update({ permissions: next })
        .eq('id', orgId)
        .select('id');
      // A silent zero-row update counts as a failure: that is exactly what an
      // RLS refusal looks like from the client.
      if (error || !data || data.length !== 1) {
        await resyncOrganizerPermissions(orgId, saveFailMessage(error));
      }
    });
    permWriteChain.current.set(orgId, run);
  }, [resyncOrganizerPermissions]);

  /** Flip one section permission. Reads the CURRENT value from the ref, never
   *  from the render closure — see the organizersRef comment above. */
  function toggleOrgPermission(orgId: string, key: string) {
    if (!session) return;
    const target = organizersRef.current.find(o => o.id === orgId);
    if (!target) return;
    const current = target.permissions ?? {};
    const next: PermissionMap = { ...current, [key]: !current[key] };
    // Turning the financials section off makes a read-only marker meaningless.
    if (key === 'financials' && !next.financials) delete next[FINANCIALS_READONLY_KEY];
    applyOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, permissions: next } : o));
    setOrganizersError('');
    queuePermissionWrite(orgId, next);
  }

  /** Apply a whole bundle to a member in one write. */
  function setOrgBundle(orgId: string, bundle: BundleId) {
    if (!session) return;
    const target = organizersRef.current.find(o => o.id === orgId);
    if (!target) return;
    // Only an owner (or platform admin) may mint another team manager — the
    // create_organizer_invite RPC applies the same rule server-side.
    const wanted = bundlePermissions(bundle, target.permissions ?? {});
    if (wanted[TEAM_KEY] && !canGrantSuperAdmin) delete wanted[TEAM_KEY];
    applyOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, permissions: wanted } : o));
    setOrganizersError('');
    setBundleMenuFor(null);
    queuePermissionWrite(orgId, wanted);
  }

  /** ADMIN's one honest promise: sees the money, cannot move it. */
  function toggleFinancialsReadOnly(orgId: string) {
    if (!session) return;
    const target = organizersRef.current.find(o => o.id === orgId);
    if (!target) return;
    const current = target.permissions ?? {};
    const next: PermissionMap = { ...current, [FINANCIALS_READONLY_KEY]: !current[FINANCIALS_READONLY_KEY] };
    if (next[FINANCIALS_READONLY_KEY]) next.financials = true;
    applyOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, permissions: next } : o));
    setOrganizersError('');
    queuePermissionWrite(orgId, next);
  }

  function handleRemoveOrganizer(organizerId: string) {
    if (!session) return;
    // Matches can_manage_team() in the database, which is what actually
    // decides whether the DELETE lands.
    if (!canManageTeam) return;
    const idx = organizersRef.current.findIndex(o => o.id === organizerId);
    if (idx === -1) return;
    const removed = organizersRef.current[idx];
    // Optimistic: drop the row instantly; re-insert it at its old position
    // (with an inline error) if the delete fails, including a silent
    // zero-row delete, which is treated as a failure too.
    applyOrganizers(prev => prev.filter(o => o.id !== organizerId));
    setOrganizersError('');
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        applyOrganizers(prev => {
          const arr = [...prev];
          arr.splice(Math.min(idx, arr.length), 0, removed);
          return arr;
        });
        setOrganizersError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase.from('conference_organizers').delete().eq('id', organizerId).select('id');
      if (error || !data || data.length !== 1) {
        applyOrganizers(prev => {
          const arr = [...prev];
          arr.splice(Math.min(idx, arr.length), 0, removed);
          return arr;
        });
        setOrganizersError(saveFailMessage(error));
      }
    })();
  }

  // ── Public-page curation ────────────────────────────────────────────────
  // Team managers only, enforced by RLS as well as by the UI gate — the policy
  // is can_manage_team(), not just role='owner'. A DB trigger recomputes
  // conferences.display_secretariat on every write, so a confirmed write is
  // followed by a quiet conference re-fetch (no full-screen reload).
  //
  // A failed write cannot roll back to a snapshot taken before it started: by
  // the time it fails the row may have been toggled again. Re-read it instead,
  // exactly like resyncOrganizerPermissions.
  const resyncOrganizerPublic = useCallback(async (orgId: string, message: string) => {
    setOrganizersError(message);
    const supabase = await getFreshAuthedClient();
    if (!supabase) return;
    const { data } = await supabase
      .from('conference_organizers')
      .select('public_title, show_on_public')
      .eq('id', orgId)
      .maybeSingle();
    if (!data) return;
    const truth = data as { public_title: string | null; show_on_public: boolean };
    applyOrganizers(prev => prev.map(o => o.id === orgId
      ? { ...o, public_title: truth.public_title, show_on_public: truth.show_on_public }
      : o));
  }, [applyOrganizers]);

  // One serial chain per row: click PUBLIC then HIDDEN and the second UPDATE is
  // issued only after the first has returned, so the last request to reach the
  // database is always the last click on screen.
  const queuePublicWrite = useCallback((orgId: string, updates: { public_title?: string | null; show_on_public?: boolean }) => {
    const previous = publicWriteChain.current.get(orgId) ?? Promise.resolve();
    const run = previous.then(async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        await resyncOrganizerPublic(orgId, 'Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase
        .from('conference_organizers')
        .update(updates)
        .eq('id', orgId)
        .select('id');
      // A silent zero-row update is an RLS refusal, not a success.
      if (error || !data || data.length !== 1) {
        await resyncOrganizerPublic(orgId, saveFailMessage(error));
        return;
      }
      void refreshConferenceQuiet();
    });
    publicWriteChain.current.set(orgId, run);
  }, [resyncOrganizerPublic, refreshConferenceQuiet]);

  /** Flip public listing for one member.
   *
   *  THE BUG THIS FIXES: the call site used to be
   *    onClick={() => updateOrganizerPublic(org.id, { show_on_public: !org.show_on_public })}
   *  where `org` came from the render closure. Two clicks inside one React
   *  batch both read the same `org.show_on_public`, both computed the same
   *  `next`, and both wrote it — so the second click undid nothing on screen
   *  and wrote a value identical to the first, leaving screen and database
   *  disagreeing as soon as a re-render landed between them. Same class as the
   *  permission-chip defect: the CURRENT value must come from organizersRef,
   *  never from the closure. */
  function toggleOrganizerPublic(orgId: string) {
    if (!session) return;
    const target = organizersRef.current.find(o => o.id === orgId);
    if (!target) return;
    const next = !target.show_on_public;
    applyOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, show_on_public: next } : o));
    setOrganizersError('');
    queuePublicWrite(orgId, { show_on_public: next });
  }

  /** Set the public-facing role. Same ref-first rule. */
  function setOrganizerTitle(orgId: string, raw: string) {
    if (!session) return;
    const target = organizersRef.current.find(o => o.id === orgId);
    if (!target) return;
    const next = raw.trim() || null;
    if (next === (target.public_title ?? null)) return;
    applyOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, public_title: next } : o));
    setOrganizersError('');
    queuePublicWrite(orgId, { public_title: next });
  }

  function handleMoveOrganizer(idx: number, dir: -1 | 1) {
    if (!session) return;
    const j = idx + dir;
    if (j < 0 || j >= organizersRef.current.length) return;
    const previous = organizersRef.current;
    const order = [...organizersRef.current];
    [order[idx], order[j]] = [order[j], order[idx]];
    // Optimistic: render the new order (with normalized sort_order values so
    // consecutive moves diff correctly) and persist in the background.
    applyOrganizers(() => order.map((o, i) => ({ ...o, sort_order: i })));
    setOrganizersError('');
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        applyOrganizers(() => previous);
        setOrganizersError('Your session has expired, please refresh and sign in again.');
        return;
      }
      // Persist the displayed index as sort_order for every row that drifted —
      // a plain neighbour swap is a no-op while rows still share the default 0.
      const toWrite = order.filter((o, i) => o.sort_order !== i);
      const results = await Promise.all(
        order
          .map((o, i) => (o.sort_order === i ? null : supabase.from('conference_organizers').update({ sort_order: i }).eq('id', o.id).select('id')))
          .filter((p): p is NonNullable<typeof p> => p !== null)
      );
      const failed = results.find(r => r.error || !r.data || r.data.length !== 1);
      if (failed) {
        applyOrganizers(() => previous);
        setOrganizersError(saveFailMessage(failed.error));
        return;
      }
      if (toWrite.length > 0) void refreshConferenceQuiet();
    })();
  }

  // ── Privacy actions ─────────────────────────────────────────────────────

  function handlePublicToggle(next: boolean) {
    if (!conference || publicToggleSaving) return;
    // A conference with dates set to TBD (or no start date yet) can never be
    // public — mirrors the DB CHECK `conferences_tbd_not_public`.
    if (next && (conference.dates_tbd || !conference.start_date)) {
      setPrivacyError('Add conference dates before publishing. A conference with dates set to TBD stays private.');
      return;
    }
    setPublicToggleSaving(true);
    setPrivacyError('');
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setPublicToggleSaving(false);
        setPrivacyError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase.from('conferences').update({
        is_public: next,
        status: next ? 'public' : 'private',
      }).eq('id', conference.id).select('id');
      if (error || !data || data.length !== 1) {
        setPublicToggleSaving(false);
        setPrivacyError(saveFailMessage(error));
        return;
      }
      if (next) {
        // Fire-and-forget: ping search engines (IndexNow) so the newly public
        // conference page gets crawled right away.
        void fetch('/api/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: conference.slug }),
        }).catch(() => {});
      }
      await refreshConferenceQuiet();
      setPublicToggleSaving(false);
    })();
  }

  async function handleArchive() {
    if (!conference || archiving) return;
    const { confirmed } = await confirm({
      title: 'Archive this conference?',
      body: 'It will be hidden from all listings.',
      confirmLabel: 'Archive',
      danger: true,
    });
    if (!confirmed) return;
    // The write stays awaited: navigating away must depend on it succeeding,
    // and on a verified row match, a silent zero-row update must not send
    // the user off to /my-conferences believing this archived.
    setArchiving(true);
    setPrivacyError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setArchiving(false);
      setPrivacyError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.from('conferences').update({
      status: 'archived',
      is_public: false,
    }).eq('id', conference.id).select('id');
    if (error || !data || data.length !== 1) {
      setPrivacyError(saveFailMessage(error));
      setArchiving(false);
      return;
    }
    router.push('/my-conferences');
  }

  // ── Lineage actions ─────────────────────────────────────────────────────

  const isOwner = organizers.some(o => o.user_id === user?.id && o.role === 'owner');
  // Who may edit this team. Mirrors can_manage_team() in the database: the
  // owner, anyone holding the SUPER ADMIN bundle, or a Gavelling platform
  // admin — who has no organizer row at all, which is exactly the case the
  // old owners-only UI got wrong. This is a UI gate; RLS is the real one.
  const myOrgRow = organizers.find(o => o.user_id === user?.id);
  const canManageTeam = isOwner || bundleGrantsTeam(myOrgRow?.permissions) || (isPlatformAdmin && !!conference);
  // Only an owner may mint another team manager. is_conference_owner() now
  // returns true for platform admins, so they count here too — otherwise the
  // UI would hide an option the database would happily accept.
  const canGrantSuperAdmin = isOwner || isPlatformAdmin;

  function handleClaimDecision(successorId: string, approve: boolean) {
    if (lineageBusy === successorId) return;
    const previousClaims = incomingClaims;
    setLineageBusy(successorId);
    setLineageError('');
    // Optimistic: approvals flip the badge instantly, rejections drop the
    // row instantly. A silent (stale-guarded) loadLineage afterwards picks
    // up whatever canonical shape the RPC left behind.
    setIncomingClaims(prev => approve
      ? prev.map(c => c.id === successorId ? { ...c, predecessor_approved: true } : c)
      : prev.filter(c => c.id !== successorId));
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setIncomingClaims(previousClaims);
        setLineageError('Your session has expired, please refresh and sign in again.');
        setLineageBusy(null);
        return;
      }
      const { error } = await supabase.rpc('approve_predecessor_link', {
        p_successor_id: successorId,
        p_approve: approve,
      });
      if (error) {
        setIncomingClaims(previousClaims);
        setLineageError(error.message);
        setLineageBusy(null);
        return;
      }
      await loadLineage();
      setLineageBusy(null);
    })();
  }

  async function handleWithdrawClaim() {
    if (!conference || withdrawingClaim) return;
    const { confirmed } = await confirm({
      title: 'Withdraw the previous-edition claim?',
      body: 'The link (and any approval) will be removed.',
      confirmLabel: 'Withdraw',
      danger: true,
    });
    if (!confirmed) return;
    setLineageError('');
    setWithdrawingClaim(true);
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setWithdrawingClaim(false);
      setLineageError('Your session has expired, please refresh and sign in again.');
      return;
    }
    // Only clear the id, predecessor_approved is reset by the DB trigger.
    const { data, error } = await supabase
      .from('conferences')
      .update({ predecessor_conference_id: null })
      .eq('id', conference.id)
      .select('id');
    if (error || !data || data.length !== 1) {
      setWithdrawingClaim(false);
      setLineageError(saveFailMessage(error));
      return;
    }
    await refreshConferenceQuiet();
    setPredecessorInfo(null);
    setWithdrawingClaim(false);
  }

  // ── Partner conference actions ──────────────────────────────────────────

  function handleAddPartner(conf: PartnerConf) {
    if (!conference || !session) return;
    // Optimistic with a temp id (house pattern, see motions in AGENTS.md):
    // the row appears instantly; move/remove are guarded until the real UUID
    // arrives, then the id is swapped in place.
    const tempId = `temp-${Date.now()}`;
    const sortOrder = partners.length;
    setPartners(prev => [...prev, {
      id: tempId,
      sort_order: sortOrder,
      approved: false,
      partner_conference_id: conf.id,
      conf,
    }]);
    setPartnerQuery('');
    setPartnerResults([]);
    setPartnerError('');
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setPartners(prev => prev.filter(p => p.id !== tempId));
        setPartnerError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase.from('conference_partners').insert({
        conference_id: conference.id,
        partner_conference_id: conf.id,
        sort_order: sortOrder,
      }).select('id').single();
      if (error || !data) {
        setPartners(prev => prev.filter(p => p.id !== tempId));
        setPartnerError(error?.message ?? "Couldn't add this partner. Please try again.");
      } else {
        setPartners(prev => prev.map(p => p.id === tempId ? { ...p, id: (data as { id: string }).id } : p));
      }
    })();
  }

  function handleMovePartner(idx: number, dir: -1 | 1) {
    if (!session) return;
    const j = idx + dir;
    if (j < 0 || j >= partners.length) return;
    // A just-added row is still waiting for its real UUID, skip reorders
    // until it lands (moments later) so we never write against a temp id.
    if (partners.some(p => p.id.startsWith('temp-'))) return;
    const previous = partners;
    const order = [...partners];
    [order[idx], order[j]] = [order[j], order[idx]];
    setPartners(order.map((p, i) => ({ ...p, sort_order: i })));
    setPartnerError('');
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setPartners(previous);
        setPartnerError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const results = await Promise.all(
        order
          .map((p, i) => (p.sort_order === i ? null : supabase.from('conference_partners').update({ sort_order: i }).eq('id', p.id).select('id')))
          .filter((p): p is NonNullable<typeof p> => p !== null)
      );
      const failed = results.find(r => r.error || !r.data || r.data.length !== 1);
      if (failed) {
        setPartners(previous);
        setPartnerError(saveFailMessage(failed.error));
      }
    })();
  }

  async function handleRemovePartner(link: PartnerLink) {
    if (!session) return;
    if (link.id.startsWith('temp-')) return; // still being created
    const label = link.conf?.acronym ?? 'this conference';
    const { confirmed } = await confirm({
      title: `Remove the partner link with ${label}?`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    const idx = partners.findIndex(p => p.id === link.id);
    if (idx === -1) return;
    // Optimistic: drop the row instantly; re-insert at its old position if
    // the delete fails, including a silent zero-row delete.
    setPartners(prev => prev.filter(p => p.id !== link.id));
    setPartnerError('');
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setPartners(prev => {
          const arr = [...prev];
          arr.splice(Math.min(idx, arr.length), 0, link);
          return arr;
        });
        setPartnerError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase.from('conference_partners').delete().eq('id', link.id).select('id');
      if (error || !data || data.length !== 1) {
        setPartners(prev => {
          const arr = [...prev];
          arr.splice(Math.min(idx, arr.length), 0, link);
          return arr;
        });
        setPartnerError(saveFailMessage(error));
      }
    })();
  }

  function handlePartnerClaimDecision(linkId: string, approve: boolean) {
    if (partnerBusy === linkId) return;
    const previousIncoming = incomingPartnerClaims;
    setPartnerBusy(linkId);
    setPartnerError('');
    // Optimistic: the request row disappears instantly; silent (stale-guarded)
    // refetches afterwards pick up any server-side effects of the RPC.
    setIncomingPartnerClaims(prev => prev.filter(c => c.link_id !== linkId));
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setIncomingPartnerClaims(previousIncoming);
        setPartnerError('Your session has expired, please refresh and sign in again.');
        setPartnerBusy(null);
        return;
      }
      const { error } = await supabase.rpc('approve_partner_link', {
        p_link_id: linkId,
        p_approve: approve,
      });
      if (error) {
        setIncomingPartnerClaims(previousIncoming);
        setPartnerError(error.message);
        setPartnerBusy(null);
        return;
      }
      await Promise.all([loadPartners(), loadIncomingPartnerClaims()]);
      setPartnerBusy(null);
    })();
  }

  // ── Custom questions ────────────────────────────────────────────────────

  const selectedConfig = roleConfigs.find(rc => rc.role === selectedRole);
  const currentBlocks: FormBlock[] = normalizeBlocks(selectedConfig?.custom_questions ?? []);
  const selectedRoleHasApplications = rolesWithApplications.has(selectedRole);
  // Derived, not held in state: whichever role's bookmark is selected, this
  // always reflects that role's own row, and needs no effect to keep in sync.
  const prefMode: string = selectedConfig?.preference_mode ?? 'none';
  const prefModeOptions = selectedRole === 'chair' ? CHAIR_PREF_MODE_OPTIONS : PREF_MODE_OPTIONS;
  const showPrefCard = roleCanHavePreference(selectedRole);
  const otherRoles = ROLES.filter(r => r !== selectedRole);
  const [copyNotice, setCopyNotice] = useState('');

  // ── Step completion ──────────────────────────────────────────────────────
  // "Nothing unresolved", not "every field filled". Max accepted, the phase
  // list and the custom questions are all legitimately empty, so requiring
  // them would leave a step permanently unticked for a correct setup.
  const activeRoleConfig = roleConfigs.find(rc => rc.role === activeRole);
  // Both ends set AND in the right order. DatePicker's `min` only disables
  // whole days, so "opens 16 Jul 09:00, closes 16 Jul 08:00" gets through the
  // control and has to be caught here — otherwise the step ticks green on a
  // window that closes an hour before it opens.
  const windowBackwards = !!(
    activeRoleConfig?.applications_open_at &&
    activeRoleConfig?.applications_close_at &&
    new Date(activeRoleConfig.applications_close_at).getTime() <= new Date(activeRoleConfig.applications_open_at).getTime()
  );
  const step1Complete = !!(activeRoleConfig?.applications_open_at && activeRoleConfig?.applications_close_at) && !windowBackwards;
  const step2Complete = !!activeRoleConfig?.fee_currency
    && !(activeRoleConfig?.fee_phases ?? []).some(p => !p.start_date || !p.end_date);
  const stepComplete = useMemo(
    // Form is always complete: custom questions are optional by design.
    () => ({ 1: step1Complete, 2: step2Complete, 3: true } as Record<number, boolean>),
    [step1Complete, step2Complete],
  );

  const stepPanelRef = useRef<HTMLDivElement | null>(null);
  const lastOpenedRef = useRef<string | null>(null);
  const wasCompleteRef = useRef<Record<string, boolean>>({});

  // Auto-advance, deliberately narrow: only on the incomplete → complete edge,
  // only for the step actually open, and never while the person is still in it.
  useEffect(() => {
    const key = `${activeRole}-${openStep}`;
    const complete = stepComplete[openStep] ?? true;
    if (lastOpenedRef.current !== key) {
      // Just opened, or the role changed. Record the baseline and stop, so
      // reopening an already-complete step cannot bounce straight back out.
      lastOpenedRef.current = key;
      wasCompleteRef.current[key] = complete;
      return;
    }
    const was = wasCompleteRef.current[key];
    wasCompleteRef.current[key] = complete;
    if (was || !complete) return;
    // A save can settle while focus is still inside the panel (blur one field,
    // land on the next). Moving the panel out from under that is hostile.
    if (stepPanelRef.current && stepPanelRef.current.contains(document.activeElement)) return;
    // The step after this one, not the next unfinished one: Form is always
    // complete, so hunting for an incomplete step left anyone finishing Fees
    // staring at a step that had just closed itself. Finishing the last step
    // advances to nothing, which is the end of the flow.
    // Past the last step there is nowhere to go, and 0 (all collapsed) is now
    // a legal resting place rather than a step stuck open behind you.
    const roleSteps = stepsForRole(activeRole);
    const next = roleSteps[roleSteps.findIndex(st => st.n === openStep) + 1];
    setOpenStep(next ? next.n : 0);
  }, [activeRole, openStep, stepComplete]);

  function handleCopyApplicationLink() {
    if (!conference) return;
    const url = `${window.location.origin}/conferences/${conference.slug}/apply?role=${activeRole}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 2000);
      },
      () => setRoleConfigError('Could not copy the link. Your browser blocked clipboard access.'),
    );
  }

  /** Patch local state at once so typing stays responsive, then debounce the
   *  write. Do NOT route this through saveRoleConfig: that would delay its
   *  optimistic patch too, and typing would appear to do nothing. */
  function handleBlocksChange(next: FormBlock[]) {
    const role = selectedRole;
    setRoleConfigs(prev => prev.map(rc => (rc.role === role ? { ...rc, custom_questions: next } : rc)));
    setRoleConfigError('');
    blocksPendingRef.current.set(role, next);
    markStep(3, 'saving');
    if (blocksTimerRef.current) clearTimeout(blocksTimerRef.current);
    blocksTimerRef.current = setTimeout(() => {
      blocksTimerRef.current = null;
      persistBlocks(role);
    }, 400);
  }

  /** Writes the pending blocks for one role, appended to the serial chain so
   *  two writes for that role can never be in flight at once. On failure we
   *  reload rather than roll back: local state has moved on by several
   *  keystrokes, so any snapshot we could restore is already stale. */
  function persistBlocks(role: string) {
    const pending = blocksPendingRef.current.get(role);
    if (!pending) return;
    blocksPendingRef.current.delete(role);
    blocksChainRef.current = blocksChainRef.current.then(async () => {
      if (!conference || !session) return;
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        markStep(3, 'idle');
        setRoleConfigError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase
        .from('application_role_configs')
        .update({ custom_questions: pending })
        .eq('conference_id', conference.id)
        .eq('role', role)
        .select('id');
      if (error || !data || data.length === 0) {
        markStep(3, 'idle');
        setRoleConfigError('Could not save your questions. Reloading the latest saved version.');
        void loadRoleConfigs();
        return;
      }
      markStep(3, 'saved');
    });
  }

  /** Cancel the debounce and write now. Called before anything can read stale
   *  data: switching role, switching tab, leaving the Form step, unmounting. */
  function flushBlocks(role: string = selectedRole) {
    if (blocksTimerRef.current) {
      clearTimeout(blocksTimerRef.current);
      blocksTimerRef.current = null;
    }
    persistBlocks(role);
  }

  flushRef.current = flushBlocks;

  // Role or tab changed, or the page is unmounting. The role is captured on
  // the way in so the cleanup flushes the role that was actually being edited.
  useEffect(() => {
    const role = selectedRole;
    return () => { flushRef.current(role); };
  }, [selectedRole, activeTab]);

  // Leaving the Form step. Its panel is about to collapse, so write now.
  useEffect(() => {
    if (openStep !== 3) flushRef.current();
  }, [openStep]);

  // Never leave a "Saved" timer running past unmount.
  useEffect(() => {
    const timers = savedTimersRef.current;
    return () => {
      for (const t of Object.values(timers)) if (t) clearTimeout(t);
    };
  }, []);

  // Deep-copies a block with a fresh id, so the copy is fully independent of
  // the source (including its options array, the only nested mutable field).
  function cloneBlockWithNewId(block: FormBlock): FormBlock {
    if (block.kind === 'question') {
      return { ...block, id: crypto.randomUUID(), options: block.options ? [...block.options] : block.options };
    }
    return { ...block, id: crypto.randomUUID() };
  }

  async function handleCopyFormTo(targetRole: string) {
    const targetBlocks = normalizeBlocks(roleConfigs.find(rc => rc.role === targetRole)?.custom_questions ?? []);
    if (targetBlocks.length > 0) {
      const { confirmed } = await confirm({
        title: `Overwrite ${roleLabel(targetRole)}'s questions?`,
        body: `${roleLabel(targetRole)} already has custom questions. Copying will replace them with a copy of ${roleLabel(selectedRole)}'s form.`,
        confirmLabel: 'Overwrite',
        danger: true,
      });
      if (!confirmed) return;
    }
    const copiedBlocks = currentBlocks.map(cloneBlockWithNewId);
    await saveRoleConfig(targetRole, { custom_questions: copiedBlocks });
    setCopyNotice(`Copied to ${roleLabel(targetRole)}`);
    setTimeout(() => setCopyNotice(''), 2500);
  }

  async function handleBannerUpload(file: File) {
    if (!session || !conference || bannerUploading) return;
    if (file.size > 5 * 1024 * 1024) { alert('Banner must be under 5MB.'); return; }
    setBannerUploading(true);
    setBannerError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setBannerUploading(false);
      setBannerError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const ext = file.name.split('.').pop();
    const path = 'banners/' + conference.id + '-' + Date.now() + '.' + ext;
    const { error } = await supabase.storage.from('conference-assets').upload(path, file, { contentType: file.type, upsert: true });
    if (error) {
      setBannerUploading(false);
      setBannerError("Couldn't upload the banner: " + error.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('conference-assets').getPublicUrl(path);
    // The banner preview only updates once the row write is verified, no
    // premature preview before the DB confirms the change stuck.
    const { data, error: writeError } = await supabase
      .from('conferences')
      .update({ banner_url: urlData.publicUrl })
      .eq('id', conference.id)
      .select('id');
    if (writeError || !data || data.length !== 1) {
      setBannerUploading(false);
      setBannerError(saveFailMessage(writeError));
      return;
    }
    await refreshConferenceQuiet();
    setBannerUploading(false);
  }

  // Preset banner selection, same authed-client update path as the upload,
  // just pointing banner_url at a bundled /banners/preset-N.jpg instead.
  function handleBannerPreset(path: string) {
    if (!session || !conference || bannerUploading) return;
    if (conference.banner_url === path) return;
    setBannerError('');
    setBannerUploading(true);
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setBannerUploading(false);
        setBannerError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase.from('conferences').update({ banner_url: path }).eq('id', conference.id).select('id');
      if (error || !data || data.length !== 1) {
        setBannerUploading(false);
        setBannerError(saveFailMessage(error));
        return;
      }
      await refreshConferenceQuiet();
      setBannerUploading(false);
    })();
  }

  async function handleLogoUpload(file: File) {
    if (!session || !conference || logoUploading) return;
    if (file.size > 5 * 1024 * 1024) { alert('Logo must be under 5MB.'); return; }
    setLogoUploading(true);
    setLogoError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setLogoUploading(false);
      setLogoError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const ext = file.name.split('.').pop();
    const path = 'logos/' + conference.id + '-' + Date.now() + '.' + ext;
    const { error } = await supabase.storage.from('conference-assets').upload(path, file, { contentType: file.type, upsert: true });
    if (error) {
      setLogoUploading(false);
      setLogoError("Couldn't upload the logo: " + error.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('conference-assets').getPublicUrl(path);
    // The logo preview only updates once the row write is verified.
    const { data, error: writeError } = await supabase
      .from('conferences')
      .update({ logo_url: urlData.publicUrl })
      .eq('id', conference.id)
      .select('id');
    if (writeError || !data || data.length !== 1) {
      setLogoUploading(false);
      setLogoError(saveFailMessage(writeError));
      return;
    }
    await refreshConferenceQuiet();
    setLogoUploading(false);
  }

  async function handleSaveMinAge() {
    if (!conference || minAgeSaving) return;
    setMinAgeError('');
    // Either bound may be left empty, meaning "no limit at that end", but a
    // value that is present has to be plausible AND has to leave a range that
    // somebody could actually fall inside.
    const parseBound = (raw: string, which: string): number | null | 'bad' => {
      const trimmed = raw.trim();
      if (trimmed === '') return null;
      const parsed = parseInt(trimmed, 10);
      if (isNaN(parsed) || parsed < 10 || parsed > 99) {
        setMinAgeError(`${which} age must be between 10 and 99, or left empty for no limit.`);
        return 'bad';
      }
      return parsed;
    };
    const value = parseBound(minAge, 'Minimum');
    if (value === 'bad') return;
    const maxValue = parseBound(maxAge, 'Maximum');
    if (maxValue === 'bad') return;
    if (value !== null && maxValue !== null && value > maxValue) {
      setMinAgeError('The minimum age cannot be above the maximum age, so nobody would be eligible.');
      return;
    }
    setMinAgeSaving(true);
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setMinAgeSaving(false);
      setMinAgeError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.from('conferences').update({ min_age: value, max_age: maxValue }).eq('id', conference.id).select('id');
    if (error || !data || data.length !== 1) {
      // Failure: the input keeps the user's typed value untouched, the
      // button returns to its normal label, and an inline error explains it.
      setMinAgeSaving(false);
      setMinAgeError(saveFailMessage(error));
      return;
    }
    // Success is only declared once the DB write is verified AND the UI has
    // re-synced to DB truth, never before.
    await refreshConferenceQuiet();
    minAgeBaseline.current = minAgeSnap();
    setMinAgeSaving(false);
    setMinAgeSaved(true);
    setTimeout(() => setMinAgeSaved(false), 2500);
  }

  async function handleSaveVisual() {
    if (!conference || visualSaving) return;
    setVisualError('');
    setVisualSaving(true);
    // Normalize bare handles/domains ("@mymun", "instagram.com/mymun", "mymun")
    // into valid absolute URLs so the public page's links always work.
    const updates = {
      description: description || null,
      instagram_url: normalizeSocialUrl(instagramUrl, 'instagram'),
      facebook_url: normalizeSocialUrl(facebookUrl, 'facebook'),
      tiktok_url: normalizeSocialUrl(tiktokUrl, 'tiktok'),
      whatsapp_url: normalizeSocialUrl(whatsappUrl, 'whatsapp'),
      website_url: normalizeSocialUrl(websiteUrl),
    };
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setVisualSaving(false);
      setVisualError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.from('conferences').update(updates).eq('id', conference.id).select('id');
    if (error || !data || data.length !== 1) {
      // Failure: inputs keep the user's edits untouched for a retry.
      setVisualSaving(false);
      setVisualError(saveFailMessage(error));
      return;
    }
    await refreshConferenceQuiet();
    visualBaseline.current = visualSnap();
    setVisualSaving(false);
    setVisualSaved(true);
    setTimeout(() => setVisualSaved(false), 2500);
  }

  async function handleSaveDetails() {
    if (!conference || detailsSaving) return;
    const trimmedAcr = acronym.trim();
    const acrProblem = acronymProblem(trimmedAcr);
    if (acrProblem) {
      setAcronymError(acrProblem);
      return;
    }
    setAcronymError('');
    const trimmedEmail = contactEmail.trim();
    if (trimmedEmail && !CONTACT_EMAIL_PATTERN.test(trimmedEmail)) {
      setContactEmailError('Enter a single email address, e.g. contact@yourmun.org.');
      return;
    }
    setContactEmailError('');
    setDetailsError('');
    setDetailsSaving(true);
    const parsedDelegates = parseInt(expectedDelegates, 10);
    const expected = Number.isFinite(parsedDelegates) ? parsedDelegates : conference.expected_delegates;
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setDetailsSaving(false);
      setDetailsError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.from('conferences').update({
      full_name: fullName,
      acronym: trimmedAcr,
      contact_email: contactEmail || null,
      student_level: studentLevel || null,
      start_date: datesTbd ? null : (startDate || null),
      end_date: datesTbd ? null : (endDate || null),
      dates_tbd: datesTbd,
      country: country || null,
      city: city || null,
      format: format || null,
      expected_delegates: expected,
    }).eq('id', conference.id).select('id');
    if (error || !data || data.length !== 1) {
      // Failure: inputs keep the user's edits untouched for a retry.
      setDetailsSaving(false);
      setDetailsError(saveFailMessage(error));
      return;
    }
    await refreshConferenceQuiet();
    detailsBaseline.current = detailsSnap();
    setDetailsSaving(false);
    setDetailsSaved(true);
    setTimeout(() => setDetailsSaved(false), 2500);
  }

  // Debounced autosave for the three manual-input sections above: bail while
  // unhydrated (baseline still null) or a save is already in flight, bail if
  // nothing actually changed since the baseline, else save after 800ms of
  // quiet. The cleanup clears any pending timer, which is what cancels the
  // transient empty-form save on first mount/every re-render before it fires.
  useEffect(() => {
    if (!conference || minAgeBaseline.current === null || minAgeSaving) return;
    if (minAgeSnap() === minAgeBaseline.current) return;
    const t = setTimeout(() => { void handleSaveMinAge(); }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minAge, maxAge, minAgeSaving, conference]);

  useEffect(() => {
    if (!conference || visualBaseline.current === null || visualSaving) return;
    if (visualSnap() === visualBaseline.current) return;
    const t = setTimeout(() => { void handleSaveVisual(); }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, instagramUrl, facebookUrl, tiktokUrl, whatsappUrl, websiteUrl, visualSaving, conference]);

  useEffect(() => {
    if (!conference || detailsBaseline.current === null || detailsSaving) return;
    if (detailsSnap() === detailsBaseline.current) return;
    const t = setTimeout(() => { void handleSaveDetails(); }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, acronym, contactEmail, studentLevel, startDate, endDate, datesTbd, country, city, format, expectedDelegates, detailsSaving, conference]);

  if (!conference) return null;

  // Alias kept for the render code below, which reads every conference field
  // through `view`. It's a direct pass-through now: no optimistic overlay —
  // `conference` only changes once refreshConferenceQuiet() confirms a write.
  const view: Conference = conference;

  // Applications can't be configured or opened until the conference's
  // payment method is actually usable by a delegate, not merely on file:
  // manual needs a link or note, Stripe needs onboarding complete. Even
  // free conferences need a method (they pick Manual and note it's free)
  // so the /pay page and PledgeInvoicingCard always have somewhere to
  // point delegates. Mirrors conference_payments_ready in the database.
  const applicationsGated = activeTab === 'applications' && paymentGateBlocks(conference);

  // Inner grouped sub-card. These sit *inside* the raised floating panel, so
  // they read as quiet content groups (thicker 1.5px edge, a whisper of warm
  // shadow) and let the panel itself stay the protagonist surface.
  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFDF9',
    border: '1.5px solid #D8CDB6',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 1px 2px rgba(27,56,40,0.04)',
  };

  // ── Applications → General ──────────────────────────────────────────────
  // The decisions that are the same for everybody, gathered in one place. Two
  // kinds live here:
  //
  //   • Conference-level columns (preferences, swaps, age range) — one row,
  //     one write, exactly as they behaved when they were stranded on the
  //     Conference tab.
  //   • Per-role columns that organisers almost always want identical across
  //     roles (acceptance, payment timing, resubmission). These stay per-role
  //     in the database — the roles page can still diverge them — but this page
  //     reads them as one answer and writes to every role at once. When the
  //     roles disagree, it says so instead of picking a winner.

  // ── Section rail definition ──────────────────────────────────────────────
  // Mirrors the manage layout rail's language: lucide icon + Outfit label +
  // forest active state. Drives the same `activeTab` state the content blocks
  // already switch on, no logic change, purely the switcher's new skin.
  const SECTIONS: {
    key: 'applications' | 'conference' | 'organizers' | 'privacy';
    label: string;
    hint: string;
    icon: typeof SlidersHorizontal;
  }[] = [
    { key: 'applications', label: 'Applications', hint: 'Roles, windows & questions', icon: SlidersHorizontal },
    { key: 'conference',   label: 'Conference',   hint: 'Identity, media & fee',      icon: Building2 },
    { key: 'organizers',   label: 'Organizers',   hint: 'Team & permissions',         icon: Users2 },
    { key: 'privacy',      label: 'Privacy',       hint: 'Publishing & lineage',       icon: ShieldCheck },
  ];
  const activeSection = SECTIONS.find(s => s.key === activeTab) ?? SECTIONS[0];

  return (
    // The team tree is the one tab that earns the extra width: it lays its
    // members out in a grid, so a wider panel means fewer wrapped rows and a
    // shallower, more legible hierarchy. Every other tab is a reading column
    // and stays at 1080.
    <div className="px-4 sm:px-6 md:px-10 py-8" style={{ maxWidth: activeTab === 'organizers' ? '1400px' : '1080px' }}>
      {/* Header */}
      <p className="text-xs mb-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
        {view.acronym} / Settings
      </p>
      <h1 className="font-black text-2xl mb-7" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
        Settings
      </h1>

      {/* Rail + floating panel shell */}
      <div className="flex flex-col md:flex-row md:items-start" style={{ gap: '24px' }}>

        {/* ── Section rail (desktop: vertical glass rail; mobile: horizontal scroller) ── */}
        <nav
          aria-label="Settings sections"
          className="md:flex-shrink-0 md:sticky"
          style={{ width: '100%', maxWidth: '220px', top: '24px' }}
        >
          <div
            className="flex md:flex-col overflow-x-auto md:overflow-visible"
            style={{
              gap: '6px',
              padding: '10px',
              borderRadius: '20px',
              backgroundColor: 'rgba(250,248,243,0.72)',
              backdropFilter: 'blur(16px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
              border: '1.5px solid rgba(216,205,182,0.9)',
              boxShadow: '0 10px 34px rgba(27,56,40,0.10), 0 1px 3px rgba(27,56,40,0.05)',
              scrollbarWidth: 'none',
            }}
          >
            {SECTIONS.map(section => {
              const active = activeTab === section.key;
              const Icon = section.icon;
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveTab(section.key)}
                  className="flex items-center flex-shrink-0 md:w-full text-left focus:outline-none transition-colors"
                  style={{
                    gap: '11px',
                    padding: '10px 13px',
                    borderRadius: '13px',
                    backgroundColor: active ? '#1B3828' : 'transparent',
                    color: active ? '#EED98A' : '#7A6E5E',
                    boxShadow: active ? '0 5px 16px rgba(27,56,40,0.26)' : 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; (e.currentTarget as HTMLElement).style.color = '#1C1410'; } }}
                  onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#7A6E5E'; } }}
                >
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: '30px', height: '30px', borderRadius: '9px',
                      backgroundColor: active ? 'rgba(238,217,138,0.16)' : 'rgba(27,56,40,0.06)',
                      border: active ? '1px solid rgba(238,217,138,0.28)' : '1px solid rgba(27,56,40,0.08)',
                    }}
                  >
                    <Icon size={16} strokeWidth={2.1} style={{ color: active ? '#EED98A' : '#6E5F4E' }} />
                  </span>
                  <span className="hidden md:flex flex-col min-w-0">
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13.5px', fontWeight: 700, letterSpacing: '0.01em' }}>
                      {section.label}
                    </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 500, color: active ? 'rgba(238,217,138,0.72)' : '#9A8A78', marginTop: '1px' }}>
                      {section.hint}
                    </span>
                  </span>
                  <span className="md:hidden" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 700 }}>
                    {section.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Floating elevated content panel ── */}
        <section
          className="flex-1 min-w-0"
          style={activeTab === 'organizers'
            // The team is a gallery of faces, and a gallery wants a wall, not a
            // sheet of paper. No panel, no border, no shadow — the portraits sit
            // straight on the ivory canvas with the full width to spread into.
            ? { borderRadius: 0, backgroundColor: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }
            : {
              borderRadius: '22px',
              backgroundColor: 'rgba(250,248,243,0.9)',
              backdropFilter: 'blur(14px) saturate(1.25)',
              WebkitBackdropFilter: 'blur(14px) saturate(1.25)',
              border: '1.5px solid #D8CDB6',
              boxShadow: '0 1px 3px rgba(27,56,40,0.06), 0 20px 60px rgba(27,56,40,0.12)',
              padding: '22px 22px 24px',
            }}
        >
          {/* Panel header, echoes the active rail item, gives the panel a protagonist */}
          <div className="flex items-center gap-3 mb-6 pb-5" style={{ borderBottom: '1.5px solid rgba(216,205,182,0.9)' }}>
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: '42px', height: '42px', borderRadius: '13px',
                background: 'linear-gradient(140deg, #16301F, #2A5A3C)',
                boxShadow: '0 6px 16px rgba(27,56,40,0.28)',
              }}
            >
              <activeSection.icon size={20} strokeWidth={2.1} style={{ color: '#EED98A' }} />
            </span>
            <div className="min-w-0">
              <h2 className="font-black text-lg leading-tight" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                {activeSection.label}
              </h2>
              <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                {activeSection.hint}
              </p>
            </div>
          </div>

      {/* ── Grandfathered warning — payment_gate_exempt conferences the gate
          let through on purpose, but that still can't actually get paid.
          Informs without blocking: applications tab renders normally below. ── */}
      {activeTab === 'applications' && conference.payment_gate_exempt && !conferencePaymentsReady(conference) && (
        <div
          className="flex items-start gap-3 rounded-2xl px-5 py-4 mb-6"
          style={{ backgroundColor: 'rgba(238,217,138,0.22)', border: '1px solid rgba(182,135,31,0.35)' }}
        >
          <AlertTriangle size={18} style={{ color: '#8A6614', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="font-bold text-sm mb-1" style={{ color: '#6B4F12', fontFamily: "'Outfit', sans-serif" }}>
              Delegates cannot pay you yet
            </p>
            <p className="text-sm" style={{ color: '#6B4F12', fontFamily: "'Outfit', sans-serif", lineHeight: 1.6 }}>
              Your applications are open, but nothing on your financial setup gives delegates a way to pay. Finish it in{' '}
              <Link href={`/manage/${conference.slug}/financials/settings`} className="font-bold underline">
                Financial Settings
              </Link>
              {' '}so applicants are not left stuck.
            </p>
          </div>
        </div>
      )}

      {/* ── APPLICATIONS TAB ──────────────────────────────────────────────
          One role at a time. The five-role stack made every role look equally
          urgent and buried the one question that matters, which is whether the
          role is actually taking applications right now. ── */}
      {activeTab === 'applications' && (() => {
        // `role` and `config` keep their old names so every control below reads
        // exactly as it did when this was a ROLES.map.
        const role = activeRole;
        const config = roleConfigs.find(rc => rc.role === role);
        const enabled = config?.is_enabled ?? false;
        const status = roleStatus(config, Date.now());
        const chip = STATUS_STYLE[status];
        // Nobody charges their own volunteers or their own secretariat: the
        // Fees step doesn't apply to either, so it isn't shown at all.
        const showFeesStep = role !== 'secretariat' && role !== 'staff';
        return (
          <>
            {/* The gate blurs the real screen rather than replacing it: this is
                a step not yet done, not an error, and seeing what is waiting
                behind it is the point. */}
            <div
              style={applicationsGated
                ? { filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' }
                : undefined}
            >
              {/* ── Role bookmarks. Icon above the name, active tab raised and
                  joined to the panel below it. Order follows how a conference
                  is actually staffed, not the alphabet. ── */}
              <RoleBookmarks
                roles={ROLES}
                active={role}
                statusOf={(r) => roleStatus(roleConfigs.find(c => c.role === r), Date.now())}
                onPick={setActiveRole}
              />

              {/* ── Role header bar. Never collapses: this is the one place that
                  answers "is this role live". ── */}
              <div style={{ ...cardStyle, borderRadius: undefined, borderTopLeftRadius: '4px', borderTopRightRadius: '16px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 40, height: 40, borderRadius: '999px', background: 'linear-gradient(145deg, #FFFDF9, #E4DCCB)', boxShadow: NEU.outSm }}
                  >
                    <Emoji3D name={ROLE_EMOJI[role] ?? 'Bust in silhouette'} size={24} />
                  </span>
                  <span className="inline-flex items-center gap-2 font-black" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontSize: '18px' }}>
                    {roleLabel(role)}
                    <InfoHint label={`What a ${roleLabel(role)} is`} text={ROLE_BLURB[role] ?? ''} size={17} />
                  </span>
                  <span
                    suppressHydrationWarning
                    className="font-bold"
                    style={{
                      fontFamily: "'Outfit', sans-serif", fontSize: '10px', fontWeight: 800,
                      letterSpacing: '0.1em', padding: '3px 9px', borderRadius: '999px',
                      backgroundColor: chip.bg, color: chip.fg,
                    }}
                  >
                    {status}
                  </span>

                  <div className="flex items-center gap-3 ml-auto">
                    <button
                      type="button"
                      onClick={handleCopyApplicationLink}
                      className="inline-flex items-center gap-1.5 rounded-[10px] focus:outline-none transition-colors"
                      style={{
                        padding: '7px 12px',
                        fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 800,
                        letterSpacing: '0.06em',
                        color: '#1B3828', backgroundColor: 'transparent',
                        border: '1.5px solid #DDD4C0', cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      {linkCopied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} strokeWidth={2.4} />}
                      {linkCopied ? 'COPIED' : 'COPY APPLICATION LINK'}
                    </button>
                    <PillToggle
                      value={enabled}
                      onChange={(v) => saveRoleConfig(role, { is_enabled: v })}
                      size="md"
                    />
                  </div>
                </div>

                {/* enforce_role_config_payment_gate raises for real, so a refused
                    toggle has to explain itself where the toggle is. */}
                {roleConfigError && (
                  <p className="text-xs mt-3 rounded-lg px-3 py-2" style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif" }}>
                    {roleConfigError}
                  </p>
                )}
              </div>

              {/* ── First-run walkthrough. Only for a role nothing has been
                  decided about yet, and only until it is dismissed. ── */}
              {config && roleIsUntouched(config) && !introDone.has(role) && (
                <SetupIntro role={role} onDone={() => dismissIntro(role)} />
              )}

              {/* ── The three steps. Editable whether or not the role is on: a
                  role gets set up before it is opened. ── */}
              {config && (
                <div key={`${role}-${configVersion}`} ref={stepPanelRef}>

                  <div style={cardStyle}>
                    <StepHeader
                      n={STEPS[0].n} label={STEPS[0].label} sub={STEPS[0].sub} hint={STEPS[0].hint}
                      complete={stepComplete[1]} open={openStep === 1} status={stepSaveState[1]}
                      onClick={() => setOpenStep(openStep === 1 ? 0 : 1)}
                    />
                    {openStep === 1 && (
                      <div className="mt-5">
                        {/* Opens / Closes. The shared friendly picker in
                            datetime mode, not a native control: the same
                            calendar the fee phases already use, plus the hour
                            the window actually turns over. */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                              Opens
                              <InfoHint
                                label="About the opening time"
                                text="The moment this role starts taking applications. Before it, the application link says the window has not opened yet and shows the date and time it will. Nothing needs doing at that moment. It opens itself. Leave it empty to have the role open the instant you switch it on."
                              />
                            </label>
                            <DatePicker
                              withTime
                              clearable
                              value={toDatetimeLocal(config.applications_open_at)}
                              onChange={(v) => saveRoleConfig(role, { applications_open_at: fromDatetimeLocal(v) })}
                              placeholder="Opens as soon as it is switched on"
                              zoneNote={`Times are in ${localZoneLabel()}.`}
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                              Closes
                              <InfoHint
                                label="About the closing time"
                                text="The moment this role stops taking new applications. Applications already in progress are not deleted. The form simply stops accepting new ones, and the role reads as CLOSED. Leave it empty to keep it open until you switch the role off yourself."
                              />
                            </label>
                            <DatePicker
                              withTime
                              clearable
                              value={toDatetimeLocal(config.applications_close_at)}
                              onChange={(v) => saveRoleConfig(role, { applications_close_at: fromDatetimeLocal(v) })}
                              min={toDatetimeLocal(config.applications_open_at).slice(0, 10) || undefined}
                              placeholder="Stays open until switched off"
                              zoneNote={`Times are in ${localZoneLabel()}.`}
                            />
                          </div>

                          <div className="md:col-span-2">
                            {windowBackwards ? (
                              <p className="text-xs rounded-lg px-3 py-2" suppressHydrationWarning style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif" }}>
                                This window closes at or before it opens, so nobody can apply. Move one of the two.
                              </p>
                            ) : (
                              <p className="text-xs" suppressHydrationWarning style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                                Times are in {localZoneLabel()}. Applicants see these in their own timezone.
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                              Max accepted
                              <InfoHint
                                label="About max accepted"
                                text="The most people you will accept into this role. It is a ceiling on acceptances, not on applications. People can keep applying past it, you simply cannot accept more than this many. Leave it empty for no limit."
                              />
                            </label>
                            <input
                              type="number"
                              min={1}
                              placeholder="Unlimited"
                              defaultValue={config.max_accepted ?? ''}
                              onFocus={fgInput}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = '#DDD4C0';
                                saveRoleConfig(role, { max_accepted: e.target.value ? parseInt(e.target.value) : null });
                              }}
                              style={inputStyle}
                            />
                          </div>
                        </div>
                        {/* Acceptance */}
                        <div className="mt-4">
                          <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                            Acceptance
                            <InfoHint
                              label="About acceptance"
                              text="Auto-accept lets everyone in the moment they submit, which is right for observers, advisors and any role where you are not really choosing. Manual review holds every application as pending until someone on your team decides, which is what you want wherever places are limited or the answers matter."
                            />
                          </label>
                          <div className="flex gap-2">
                            {([
                              { value: true, label: 'AUTO-ACCEPT' },
                              { value: false, label: 'MANUAL REVIEW' },
                            ] as const).map(opt => {
                              const active = config.auto_accept === opt.value;
                              return (
                                <button
                                  key={String(opt.value)}
                                  type="button"
                                  onClick={() => saveRoleConfig(role, { auto_accept: opt.value })}
                                  className="flex-1 py-2.5 rounded-[10px] font-bold text-sm focus:outline-none transition-all"
                                  style={{
                                    backgroundColor: active ? '#1B3828' : 'transparent',
                                    color: active ? '#EED98A' : '#1C1410',
                                    border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                                    fontFamily: "'Outfit', sans-serif",
                                    letterSpacing: '0.06em',
                                  }}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {/* Payment */}
                        <div className="mt-4">
                          <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                            Payment
                            <InfoHint
                              label="About payment timing"
                              text="When the pay button appears for this role. After application charges on submission, which fills your account early but means refunding anyone you turn down. After acceptance only charges the people you actually took, and is the safer default wherever you review. Pay at any time leaves it entirely up to them."
                            />
                          </label>
                          <div className="flex gap-2">
                            {PAYMENT_TIMING_OPTIONS.map(opt => {
                              const active = (config.payment_timing ?? 'anytime') === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => saveRoleConfig(role, { payment_timing: opt.value })}
                                  className="flex-1 py-2.5 rounded-[10px] font-bold text-sm focus:outline-none transition-all"
                                  style={{
                                    backgroundColor: active ? '#1B3828' : 'transparent',
                                    color: active ? '#EED98A' : '#1C1410',
                                    border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                                    fontFamily: "'Outfit', sans-serif",
                                    letterSpacing: '0.06em',
                                  }}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-xs mt-1.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                            {PAYMENT_TIMING_OPTIONS.find(o => o.value === (config.payment_timing ?? 'anytime'))?.desc}
                          </p>
                        </div>
                        {/* Resubmission */}
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div>
                            <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                              Allow resubmission
                              <InfoHint
                                label="About resubmission"
                                text="With this on, an applicant you have denied can reopen their form, change their answers and send it back for another look. Useful when denials are usually about a missing detail rather than a real no. With it off, a denial is final and they cannot apply again for this role."
                              />
                            </label>
                            <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                              Let denied applicants edit and resubmit.
                            </p>
                          </div>
                          <PillToggle
                            value={config.allow_resubmission ?? false}
                            onChange={(v) => saveRoleConfig(role, { allow_resubmission: v })}
                            size="md"
                          />
                        </div>
                        {/* MUN experience — chair and secretariat only. The
                            database CHECK refuses true for every other role,
                            so a control for them could never work and must
                            not exist, not even disabled. */}
                        {(role === 'chair' || role === 'secretariat') && (
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <div>
                              <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                Ask for MUN experience
                                <InfoHint
                                  label="About MUN experience"
                                  text="Delegates and head delegates are not affected by this setting, on or off: their experience level feeds committee allocation directly, so it is never collected this way for them."
                                />
                              </label>
                              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                                Applicants list the conferences they have chaired or staffed, and can import them from their Gavelling MUN CV.
                              </p>
                            </div>
                            <PillToggle
                              value={config.collect_mun_experience ?? false}
                              onChange={(v) => saveRoleConfig(role, { collect_mun_experience: v })}
                              size="md"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {showFeesStep && (
                  <div style={cardStyle}>
                    <StepHeader
                      n={STEPS[1].n} label={STEPS[1].label} sub={STEPS[1].sub} hint={STEPS[1].hint}
                      complete={stepComplete[2]} open={openStep === 2} status={stepSaveState[2]}
                      onClick={() => setOpenStep(openStep === 2 ? 0 : 2)}
                    />
                    {openStep === 2 && (
                      <div className="mt-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Fee</label>
                            <div className="flex gap-2">
                              <select
                                defaultValue={config.fee_currency}
                                onFocus={fgInput}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = '#DDD4C0';
                                  saveRoleConfig(role, { fee_currency: e.target.value });
                                }}
                                style={{ ...inputStyle, width: '30%', cursor: 'pointer' }}
                              >
                                {CURRENCY_GROUPS.pinned.map(c => (
                                  <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                                ))}
                                <option disabled>──────────</option>
                                {CURRENCY_GROUPS.rest.map(c => (
                                  <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                placeholder="0.00"
                                defaultValue={config.fee_amount}
                                onFocus={fgInput}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = '#DDD4C0';
                                  saveRoleConfig(role, { fee_amount: parseFloat(e.target.value) || 0 });
                                }}
                                style={{ ...inputStyle, width: '70%' }}
                              />
                            </div>
                          </div>
                        </div>
                        {/* Fee phases, date-windowed pricing (Early Bird, Phase 1, …).
                            When a phase's window contains today it overrides the flat
                            fee above; gaps between phases fall back to the flat fee. */}
                        {(() => {
                          const phases = config.fee_phases ?? [];
                          const active = activeFeePhase(phases);
                          // A phase missing either date is skipped by the app and by
                          // resolve_phase_fee, so the amount on it never applies. Say
                          // so on the row, and refuse to stack another on top of it.
                          const hasInvalidPhase = phases.some(p => !p.start_date || !p.end_date);
                          return (
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-1.5 flex-wrap" style={{ gap: 8 }}>
                                <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                  Fee phases
                                  <InfoHint
                                    label="About fee phases"
                                    text="Optional date windows that override the flat fee: an early-bird rate, a standard rate, a late rate. Whichever phase contains today is what an applicant is quoted and charged; on a day no phase covers, the flat fee applies. Both dates are inclusive, and a phase missing either one is skipped entirely."
                                  />
                                </label>
                                <div className="flex items-center" style={{ gap: 12 }}>
                                  {copyPhasesNotice && (
                                    <span className="text-[11px] font-bold" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
                                      {copyPhasesNotice} ✓
                                    </span>
                                  )}
                                  {phases.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setCopyPhasesOpen(true)}
                                      className="text-[11px] font-bold focus:outline-none hover:underline inline-flex items-center gap-1.5"
                                      style={{ color: '#7A6E5E', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                      <Copy size={12} strokeWidth={2.4} />
                                      COPY TO ANOTHER ROLE
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={hasInvalidPhase}
                                    onClick={() => saveRoleConfig(role, {
                                      fee_phases: [...phases, { label: `Phase ${phases.length + 1}`, start_date: '', end_date: '', amount: config.fee_amount }],
                                    })}
                                    className="text-[11px] font-bold focus:outline-none hover:underline"
                                    style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', background: 'none', border: 'none', opacity: hasInvalidPhase ? 0.45 : 1, cursor: hasInvalidPhase ? 'not-allowed' : 'pointer' }}
                                  >
                                    + ADD PHASE
                                  </button>
                                </div>
                              </div>
                              {phases.length === 0 ? (
                                <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.55 }}>
                                  Optional: charge different amounts by date, e.g. an Early Bird rate. When no phase covers today, the flat fee above applies.
                                </p>
                              ) : (
                                <>
                                  {phases.map((phase, pi) => {
                                    const isActive = active !== null && phase === active;
                                    const invalid = !phase.start_date || !phase.end_date;
                                    return (
                                      <Fragment key={`${pi}-${phases.length}-${configVersion}`}>
                                      <div
                                        className="grid gap-2 items-center mb-2 rounded-[10px] px-2.5 py-2"
                                        style={{
                                          gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.25fr) minmax(0,1.25fr) minmax(0,0.7fr) 24px',
                                          backgroundColor: isActive ? 'rgba(27,56,40,0.06)' : 'rgba(27,56,40,0.02)',
                                          border: invalid
                                            ? '1.5px solid rgba(139,32,32,0.45)'
                                            : isActive ? '1.5px solid rgba(27,56,40,0.35)' : '1px solid #F0EDE6',
                                        }}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <input
                                            type="text"
                                            placeholder="e.g. Early Bird"
                                            defaultValue={phase.label}
                                            onFocus={fgInput}
                                            onBlur={(e) => {
                                              e.currentTarget.style.borderColor = '#DDD4C0';
                                              if (e.target.value.trim() !== phase.label) updateFeePhase(role, phases, pi, { label: e.target.value.trim() });
                                            }}
                                            style={{ ...inputStyle, padding: '6px 10px', fontSize: '12.5px', minWidth: 0 }}
                                          />
                                          {isActive && (
                                            <span
                                              className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.1em' }}
                                            >
                                              CURRENT
                                            </span>
                                          )}
                                        </div>
                                        <DatePicker
                                          value={phase.start_date}
                                          max={phase.end_date || undefined}
                                          placeholder="Start date"
                                          onChange={(iso) => {
                                            if (iso !== phase.start_date) updateFeePhase(role, phases, pi, { start_date: iso });
                                          }}
                                        />
                                        <DatePicker
                                          value={phase.end_date}
                                          min={phase.start_date || undefined}
                                          placeholder="End date"
                                          onChange={(iso) => {
                                            if (iso !== phase.end_date) updateFeePhase(role, phases, pi, { end_date: iso });
                                          }}
                                        />
                                        <input
                                          type="number"
                                          min={0}
                                          step={0.01}
                                          aria-label="Phase fee amount"
                                          placeholder="0.00"
                                          defaultValue={phase.amount}
                                          onFocus={fgInput}
                                          onBlur={(e) => {
                                            e.currentTarget.style.borderColor = '#DDD4C0';
                                            const next = parseFloat(e.target.value) || 0;
                                            if (next !== phase.amount) updateFeePhase(role, phases, pi, { amount: next });
                                          }}
                                          style={{ ...inputStyle, padding: '6px 8px', fontSize: '12.5px', minWidth: 0, fontVariantNumeric: 'tabular-nums' }}
                                        />
                                        <button
                                          type="button"
                                          aria-label={`Remove ${phase.label || 'phase'}`}
                                          onClick={() => saveRoleConfig(role, { fee_phases: phases.filter((_, i) => i !== pi) })}
                                          className="text-sm font-bold focus:outline-none justify-self-center"
                                          style={{ color: '#8B2020', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                      {invalid && (
                                        <p className="text-xs mb-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                                          This fee phase is invalid. Please add dates.
                                        </p>
                                      )}
                                      </Fragment>
                                    );
                                  })}
                                  {feePhasesOverlap(phases) && (
                                    <p className="text-xs mt-1" style={{ color: '#B8844A', fontFamily: "'Outfit', sans-serif" }}>
                                      Two phases have overlapping date windows, the phase listed first wins on overlapping days.
                                    </p>
                                  )}
                                  <p className="text-xs mt-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                                    Dates are inclusive. When no phase covers today, the flat fee above applies ({config.fee_currency} {config.fee_amount}).
                                  </p>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  )}

                  <div style={cardStyle}>
                    <StepHeader
                      n={STEPS[2].n} label={STEPS[2].label} sub={STEPS[2].sub} hint={STEPS[2].hint}
                      complete={stepComplete[3]} open={openStep === 3}
                      onClick={() => setOpenStep(openStep === 3 ? 0 : 3)}
                      status={stepSaveState[3]}
                    />
                    {openStep === 3 && (
                      <div className="mt-5">
                        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                          <CopyFormMenu roles={otherRoles} onPick={handleCopyFormTo} />
                          {copyNotice && (
                            <p className="text-xs font-semibold" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
                              {copyNotice} ✓
                            </p>
                          )}
                        </div>
                        <QuestionBuilder key={selectedRole} value={currentBlocks} onChange={handleBlocksChange} hasApplications={selectedRoleHasApplications} />
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Offered when a phase first becomes usable, and from the button
                beside + ADD PHASE. Copies the whole ladder plus the flat fee it
                falls back to — a half-copied price is worse than none. */}
            <CopyToRolesModal
              open={copyPhasesOpen}
              onClose={() => setCopyPhasesOpen(false)}
              onConfirm={(targets) => void copyPhasesToRoles(targets)}
              busy={copyPhasesBusy}
              title="Set this up for another role too?"
              sub={`${roleLabel(role)} fee phases are saved. Most conferences run the same windows for every role, so tick the ones that should get an identical ladder and the same fee.`}
              roles={ROLES.filter(r => r !== role && r !== 'secretariat' && r !== 'staff')}
            />

            {/* Not dismissible by design: no close, no backdrop click, no Escape.
                It goes away when financial onboarding is done, and not before. */}
            {applicationsGated && (
              <Portal>
                <div
                  role="dialog"
                  aria-modal="true"
                  className="fixed inset-0 z-[80] flex items-center justify-center px-4"
                  style={{ backgroundColor: 'rgba(27,56,40,0.28)' }}
                >
                  <div
                    className="flex flex-col items-center text-center"
                    style={{ ...cardStyle, marginBottom: 0, padding: '48px 32px', maxWidth: '520px', boxShadow: '0 24px 70px rgba(27,56,40,0.28)' }}
                  >
                    <span
                      className="flex items-center justify-center flex-shrink-0 mb-5"
                      style={{
                        width: '56px', height: '56px', borderRadius: '16px',
                        background: 'linear-gradient(140deg, #16301F, #2A5A3C)',
                        boxShadow: '0 6px 16px rgba(27,56,40,0.28)',
                      }}
                    >
                      <Lock size={24} strokeWidth={2.1} style={{ color: '#EED98A' }} />
                    </span>
                    <p className="font-black text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", maxWidth: '420px' }}>
                      Application opening is not available until Financial Onboarding is completed.
                    </p>
                    <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", maxWidth: '440px', lineHeight: 1.6 }}>
                      {paymentGateMessage(conference)}
                    </p>
                    <button
                      onClick={() => router.push(`/manage/${conference.slug}/financials/settings`)}
                      className="rounded-xl px-6 py-3 text-sm font-bold focus:outline-none transition-colors"
                      style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em', cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                    >
                      Go to Financial Settings
                    </button>
                  </div>
                </div>
              </Portal>
            )}
          </>
        );
      })()}



      {/* ── VISUAL TAB ── */}
      {activeTab === 'conference' && (
        <div>
          {/* ── Marketing first. The banner and the logo are the two things a
              visitor actually sees, and they were buried under six fields of
              logistics nobody opens twice. ── */}
          {/* Banner card */}
          <div style={cardStyle}>
            <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Conference Banner</p>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Recommended: 1200x630px. JPG, PNG or WebP. Max 5MB.</p>
            <div
              style={{
                border: '1.5px dashed #DDD4C0', borderRadius: 14, overflow: 'hidden',
                backgroundColor: '#FAF8F3', minHeight: 140,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', cursor: 'pointer',
              }}
              onClick={() => { if (!bannerUploading) document.getElementById('settings-banner-upload')?.click(); }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
            >
              {view.banner_url ? (
                <>
                  <img src={view.banner_url} alt="Banner" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); document.getElementById('settings-banner-upload')?.click(); }}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      backgroundColor: 'rgba(27,56,40,0.85)', color: '#EDE7D8',
                      border: 'none', borderRadius: 8, padding: '4px 10px',
                      fontSize: 11, fontFamily: "'Outfit', sans-serif", fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {bannerUploading ? 'UPLOADING...' : 'CHANGE'}
                  </button>
                </>
              ) : bannerUploading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-2" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
                  <p style={{ fontSize: 12, color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Uploading...</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1410', fontFamily: "'Outfit', sans-serif", marginBottom: 4 }}>Click to upload banner</p>
                  <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Recommended: 1200x630px</p>
                </div>
              )}
              <input
                id="settings-banner-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); e.target.value = ''; }}
              />
            </div>

            {/* Preset picker, one click sets banner_url to a bundled photo */}
            <div style={{ marginTop: 14 }}>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '0.01em', color: '#7A6E5E', margin: '0 0 8px 0' }}>
                Or pick a preset
              </p>
              <div className="flex flex-wrap gap-2">
                {BANNER_PRESETS.map(p => {
                  const selected = view.banner_url === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleBannerPreset(p)}
                      disabled={bannerUploading}
                      aria-label={'Use preset banner ' + p}
                      style={{
                        width: 84, height: 48, padding: 0, borderRadius: 10, overflow: 'hidden',
                        cursor: bannerUploading ? 'wait' : 'pointer',
                        border: selected ? '2px solid #B6871F' : '1.5px solid #DDD4C0',
                        boxShadow: selected ? '0 0 0 3px rgba(238,217,138,0.55)' : 'none',
                        opacity: bannerUploading && !selected ? 0.6 : 1,
                        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
                        backgroundColor: '#EDE7D8',
                      }}
                      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                    >
                      <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                  );
                })}
              </div>
            </div>
            {bannerError && (
              <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{bannerError}</p>
            )}
          </div>

          {/* Logo card */}
          <div style={cardStyle}>
            <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Conference Logo</p>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Square, transparent PNG recommended. Shown on your public page, directory cards and search. Max 5MB.</p>
            <div className="flex items-center gap-5">
              <div
                style={{
                  width: 96, height: 96, borderRadius: 20, flexShrink: 0,
                  border: '1.5px dashed #DDD4C0', backgroundColor: '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', cursor: 'pointer', position: 'relative',
                }}
                onClick={() => { if (!logoUploading) document.getElementById('settings-logo-upload')?.click(); }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              >
                {logoUploading ? (
                  <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
                ) : view.logo_url ? (
                  <LogoDisc src={view.logo_url} alt="Logo" size={80} fallbackText={view.acronym?.slice(0, 3)} />
                ) : (
                  <span style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", textAlign: 'center', padding: '0 8px' }}>Click to upload</span>
                )}
              </div>
              <div>
                <button
                  onClick={() => { if (!logoUploading) document.getElementById('settings-logo-upload')?.click(); }}
                  className="rounded-xl py-2 px-4 font-bold text-xs tracking-widest transition-colors focus:outline-none"
                  style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                >
                  {logoUploading ? 'UPLOADING...' : view.logo_url ? 'REPLACE LOGO' : 'UPLOAD LOGO'}
                </button>
              </div>
              <input
                id="settings-logo-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) { alert('Logo must be under 5MB.'); return; }
                  setLogoCropFile(f);
                }}
              />
            </div>
            {logoError && (
              <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{logoError}</p>
            )}
          </div>

          {/* Conference Details card */}
          <div style={cardStyle}>
            <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Conference Details</p>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Core information shown on your public conference page and directory listing.</p>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="London International Model United Nations 2027"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
              />
            </div>

            <div className="flex gap-3 mb-4">
              <div style={{ width: '40%' }}>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Acronym</label>
                <input
                  type="text"
                  value={acronym}
                  onChange={(e) => { setAcronym(e.target.value); if (acronymError) setAcronymError(''); }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                  onBlur={(e) => {
                    setAcronymError(acronymProblem(e.target.value));
                    e.currentTarget.style.borderColor = '#DDD4C0';
                  }}
                  placeholder="e.g. LIMUN, or Model NATO Germany"
                  style={inputStyle}
                />
                {acronymError ? (
                  <p className="text-xs mt-1" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{acronymError}</p>
                ) : (
                  <p className="text-xs mt-1" suppressHydrationWarning style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                    Shown as <strong style={{ color: '#1C1410' }}>{conferenceAcronymLabel({ acronym, start_date: startDate || conference.start_date })}</strong>
                  </p>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Contact email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => { setContactEmail(e.target.value); if (contactEmailError) setContactEmailError(''); }}
                  placeholder="hello@yourmun.org"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                  onBlur={(e) => {
                    const trimmed = e.target.value.trim();
                    if (trimmed && !CONTACT_EMAIL_PATTERN.test(trimmed)) setContactEmailError('Enter a single email address, e.g. contact@yourmun.org.');
                    else setContactEmailError('');
                    e.currentTarget.style.borderColor = '#DDD4C0';
                  }}
                />
                {contactEmailError && (
                  <p className="text-xs mt-1" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{contactEmailError}</p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Student level</label>
              <div className="flex gap-2">
                {([
                  { value: 'school', label: 'HIGH SCHOOL' },
                  { value: 'university', label: 'UNIVERSITY' },
                  { value: 'both', label: 'BOTH' },
                ] as { value: 'school' | 'university' | 'both'; label: string }[]).map(opt => {
                  const active = studentLevel === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStudentLevel(opt.value)}
                      className="flex-1 rounded-xl py-2.5 font-bold text-xs transition-colors focus:outline-none"
                      style={{
                        backgroundColor: active ? '#1B3828' : 'transparent',
                        color: active ? '#EED98A' : '#9A8A78',
                        border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                        fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Format</label>
              <div className="flex gap-2">
                {([
                  { value: 'in-person', label: 'IN-PERSON' },
                  { value: 'online', label: 'ONLINE' },
                  { value: 'hybrid', label: 'HYBRID' },
                ] as { value: 'in-person' | 'online' | 'hybrid'; label: string }[]).map(opt => {
                  const active = format === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormat(opt.value)}
                      className="flex-1 rounded-xl py-2.5 font-bold text-xs transition-colors focus:outline-none"
                      style={{
                        backgroundColor: active ? '#1B3828' : 'transparent',
                        color: active ? '#EED98A' : '#9A8A78',
                        border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                        fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="flex gap-3 mb-3"
              style={datesTbd ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
            >
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Start date</label>
                <DatePicker
                  value={startDate}
                  onChange={(iso) => {
                    setStartDate(iso);
                    // Keep end ≥ start: clear a now-invalid end date.
                    if (endDate && iso && endDate < iso) setEndDate('');
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>End date</label>
                <DatePicker
                  value={endDate}
                  min={startDate || undefined}
                  initialView={startDate || undefined}
                  onChange={(iso) => setEndDate(iso)}
                />
              </div>
            </div>

            {/* Dates TBD: keeps the conference private (no public link) until real
                dates are set — mirrors the DB CHECK conferences_tbd_not_public.
                Applications can still open while dates are undecided. */}
            <button
              type="button"
              onClick={() => {
                setDatesTbd((prev) => {
                  const nextTbd = !prev;
                  // Turning TBD on clears any set dates so the row goes null.
                  if (nextTbd) { setStartDate(''); setEndDate(''); }
                  return nextTbd;
                });
              }}
              className="flex items-start gap-3 w-full text-left mb-4 focus:outline-none"
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: '20px', height: '20px', borderRadius: '6px',
                  marginTop: '1px',
                  backgroundColor: datesTbd ? '#1B3828' : 'transparent',
                  border: datesTbd ? '1.5px solid #1B3828' : '1.5px solid #C9BEA6',
                  transition: 'background-color 150ms ease, border-color 150ms ease',
                }}
              >
                {datesTbd && <Check size={13} strokeWidth={3} color="#EED98A" />}
              </span>
              <span>
                <span className="block text-sm font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  Dates are to be decided (TBD)
                </span>
                <span className="block text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  A TBD conference stays private (no public link) until you add dates. Applications can still open.
                </span>
              </span>
            </button>

            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="London"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Country</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                >
                  <option value="">Select a country</option>
                  {UN_COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Expected delegates</label>
              <input
                type="number"
                min={0}
                value={expectedDelegates}
                onChange={(e) => setExpectedDelegates(e.target.value)}
                placeholder="1250"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
              />
            </div>

            <AutoSaveStatus saving={detailsSaving} saved={detailsSaved} />
            {detailsError && (
              <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{detailsError}</p>
            )}
          </div>

          {/* ── What the selected role ranks. Only roles that can hold a
              preference get this card at all — faculty-advisor, observer,
              secretariat and staff render nothing here, not a disabled
              version of it. ── */}
          {showPrefCard && (
            <div style={cardStyle}>
              <p className="font-semibold text-base mb-1 flex items-center gap-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                <Emoji3D name="Globe showing europe-africa" size={20} fallback={Globe} fallbackColor="#1B3828" />
                {selectedRole === 'chair' ? 'Chair preferences' : 'Delegate preferences'}
                <InfoHint
                  label={selectedRole === 'chair' ? 'About chair preferences' : 'About delegate preferences'}
                  text={selectedRole === 'chair'
                    ? "Whether a chair applicant is asked to rank which committee they would like to chair. Choose a committee gives you their ranking to work from; None skips the step and leaves every committee assignment to you."
                    : "What a delegate is asked to rank on the application form, and therefore what your allocation has to work with. Ranking committee-and-country pairs gives the fullest picture and the best automatic allocation, but it is also the longest form to fill in. Committees only, or countries only, are shorter. None skips the step entirely and leaves every seat for you to assign by hand."}
                />
              </p>
              <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                {selectedRole === 'chair'
                  ? 'Choose whether chairs rank which committee they want, or whether you assign committees yourself.'
                  : 'Choose what delegates rank when they apply. The application form shows only the pickers you enable here.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8 }}>
                {prefModeOptions.map(opt => {
                  const active = prefMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => savePrefMode(opt.value)}
                      disabled={prefModeSaving}
                      className="flex items-center rounded-xl focus:outline-none"
                      style={{
                        gap: 10, padding: '11px 13px', textAlign: 'left',
                        backgroundColor: active ? '#1B3828' : 'transparent',
                        color: active ? '#EED98A' : '#1C1410',
                        border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                        boxShadow: active ? '0 4px 12px rgba(27,56,40,0.2)' : 'none',
                        fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: '0.04em',
                        opacity: prefModeSaving ? 0.6 : 1,
                        cursor: prefModeSaving ? 'wait' : 'pointer',
                      }}
                    >
                      {/* The thing(s) being ranked, drawn rather than described:
                          a committee emblem and, for roles that pair it with a
                          country, a flag. */}
                      <span className="inline-flex items-center flex-shrink-0" style={{ gap: 3 }}>
                        {opt.value !== 'countries_only' && opt.value !== 'none' && <Emoji3D name="Classical building" size={19} fallback={Building2} fallbackColor={active ? '#EED98A' : '#1B3828'} />}
                        {opt.value !== 'committees_only' && opt.value !== 'none' && <Emoji3D name="Crossed flags" size={19} fallback={Globe} fallbackColor={active ? '#EED98A' : '#1B3828'} />}
                        {opt.value === 'none' && <Emoji3D name="Cross mark" size={19} fallback={X} fallbackColor={active ? '#EED98A' : '#1B3828'} />}
                      </span>
                      <span className="min-w-0">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                {prefModeSaving && (
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
                )}
                <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  {prefModeOptions.find(o => o.value === prefMode)?.desc}
                </p>
              </div>
              {prefModeError && (
                <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{prefModeError}</p>
              )}
            </div>
          )}

          {/* ── Swaps ── */}
          <div style={cardStyle}>
            <p className="font-semibold text-base mb-1 flex items-center gap-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              <Emoji3D name="Counterclockwise arrows button" size={20} fallback={Users2} fallbackColor="#1B3828" />
              Delegation allocation swaps
              <InfoHint
                label="About allocation swaps"
                text="Once you have allocated a delegation its seats, its head delegate and faculty advisor may want to move their own people between them, putting a stronger delegate onto a harder country, say. Off keeps every move with your team. Request lets them ask and you approve. Self-serve lets them rearrange inside their own delegation freely and notifies you; they can never take a seat from another delegation."
              />
            </p>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              Control whether delegation leaders can trade committee allocations within their own delegation.
            </p>
            <div className="flex items-center" style={{ gap: 8 }}>
              <div className="flex-1">
                <Segmented
                  options={SWAP_MODE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  value={swapMode}
                  disabled={swapModeSaving}
                  onChange={(v) => saveSwapMode(v)}
                />
              </div>
              {swapModeSaving && (
                <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              {SWAP_MODE_OPTIONS.find(o => o.value === swapMode)?.desc}
            </p>
            {swapModeError && (
              <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{swapModeError}</p>
            )}
          </div>

          {/* ── Age range ── */}
          <div style={cardStyle}>
            <p className="font-semibold text-base mb-1 flex items-center gap-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              <Emoji3D name="Birthday cake" size={20} />
              Age of participants
              <InfoHint
                label="About the age range"
                text="Both bounds are inclusive and both are measured on your conference's start date, not on the day someone applies, so a delegate who turns sixteen the week before still counts as sixteen. Leave either end empty for no limit at that end. Applicants outside the range are told before they fill anything in, rather than after."
              />
            </p>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              Checked against each applicant&apos;s date of birth, on the day your conference starts. Leave either box empty for no limit.
            </p>
            <div className="flex items-end flex-wrap" style={{ gap: 14 }}>
              <div style={{ width: '150px' }}>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  Minimum age
                </label>
                <input
                  type="number"
                  min={10}
                  max={99}
                  step={1}
                  value={minAge}
                  onChange={(e) => { setMinAge(e.target.value); setMinAgeError(''); }}
                  placeholder="No limit"
                  style={inputStyle}
                  onFocus={fgInput}
                  onBlur={bgInput}
                />
              </div>
              <div style={{ width: '150px' }}>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  Maximum age
                </label>
                <input
                  type="number"
                  min={10}
                  max={99}
                  step={1}
                  value={maxAge}
                  onChange={(e) => { setMaxAge(e.target.value); setMinAgeError(''); }}
                  placeholder="No limit"
                  style={inputStyle}
                  onFocus={fgInput}
                  onBlur={bgInput}
                />
              </div>
              <div className="pb-2">
                <AutoSaveStatus saving={minAgeSaving} saved={minAgeSaved} />
              </div>
            </div>
            {minAgeError && (
              <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{minAgeError}</p>
            )}
            {!minAgeError && (view.min_age != null || view.max_age != null) && (
              <p className="text-xs mt-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
                {view.min_age != null && view.max_age != null
                  ? `Applicants must be between ${view.min_age} and ${view.max_age} years old at the start of your conference.`
                  : view.min_age != null
                    ? `Applicants must be at least ${view.min_age} years old at the start of your conference.`
                    : `Applicants must be no older than ${view.max_age} at the start of your conference.`}
              </p>
            )}
          </div>


          {/* Description + socials card */}
          <div style={cardStyle}>
            <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Description</p>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Shown on your public conference page.</p>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell delegates about your conference, theme, highlights, what to expect..."
              maxLength={1500}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            />
            <div style={{ textAlign: 'right', marginTop: 6, fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 600, color: '#9A8A78', fontVariantNumeric: 'tabular-nums' }}>
              {description.length} / 1500
            </div>
          </div>

          <div style={cardStyle}>
            <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Social Media & Links</p>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Optional. All fields saved together.</p>
            <div className="flex flex-col gap-3">
              {([
                { label: 'Instagram URL', value: instagramUrl, setter: setInstagramUrl },
                { label: 'Facebook URL', value: facebookUrl, setter: setFacebookUrl },
                { label: 'TikTok URL', value: tiktokUrl, setter: setTiktokUrl },
                { label: 'WhatsApp URL', value: whatsappUrl, setter: setWhatsappUrl },
                { label: 'Website URL', value: websiteUrl, setter: setWebsiteUrl },
              ] as { label: string; value: string; setter: (v: string) => void }[]).map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{label}</label>
                  <input
                    type="url"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder="https://"
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                  />
                </div>
              ))}
            </div>
            <AutoSaveStatus saving={visualSaving} saved={visualSaved} />
            {visualError && (
              <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{visualError}</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'organizers' && (() => {
        // ── The team, drawn as a hierarchy ──────────────────────────────────
        // Not a stack of rows: a tree. Rank 1 holds the owner AND the super
        // admins, because a super admin can do everything the owner can except
        // remove them — the crown is the only difference, so they share a
        // level. Admins hang below that, hand-picked access below that, and
        // people who have not accepted yet below that. Each rank is drawn
        // slightly smaller than the one above, and the trunk between them is
        // real drawn connective tissue, not implied by indentation.
        const ranked = [...organizers].sort((a, b) => a.sort_order - b.sort_order);
        const owners = ranked.filter(o => o.role === 'owner');
        const others = ranked.filter(o => o.role !== 'owner');

        // "Slightly smaller" as a real ramp: avatar, card width and type all
        // step down together, so rank is legible before a name is read. The
        // faces are roughly three times what they were — with the email, the
        // bundle chip and the nine permission dots gone, the photograph is what
        // the card is for.
        const TIERS = [
          { avatar: 148, card: 208, name: 16.5, meta: 12.5, pad: 14, radius: 22, gap: 22, icon: 15 },
          { avatar: 126, card: 186, name: 15.5, meta: 12,   pad: 13, radius: 20, gap: 20, icon: 14 },
          { avatar: 110, card: 172, name: 14.5, meta: 11.5, pad: 12, radius: 18, gap: 18, icon: 13 },
          { avatar: 94,  card: 158, name: 14,   meta: 11,   pad: 12, radius: 18, gap: 16, icon: 13 },
        ];

        interface Rank {
          id: string;
          label: string;
          note: string;
          hint: string;
          accent: string;
          rows: Organizer[];
        }

        const ranks: Rank[] = [
          {
            id: 'lead',
            label: 'Owner & super admins',
            note: 'Everything, money and team included',
            hint: 'The owner holds the conference outright and is the only person who can hand ownership on. A super admin opens every page, moves money and manages this team; the one thing they cannot do is remove the owner. Both are enforced in the database, by is_conference_owner() and can_manage_team().',
            accent: '#B6871F',
            rows: [...owners, ...others.filter(o => detectBundle(o.permissions) === 'super_admin')],
          },
          {
            id: 'admin',
            label: 'Admins',
            note: 'Every page, financials read-only',
            hint: 'Opens every section and sees financials in full, but cannot change fees, add-ons, vouchers, payout details, or mark an invoice paid. That restriction is enforced by can_write_financials() in the database, not just hidden in this interface.',
            accent: '#1B3828',
            rows: others.filter(o => detectBundle(o.permissions) === 'admin'),
          },
          {
            id: 'custom',
            label: 'Custom access',
            note: 'Only the pages picked for them',
            hint: 'Opens exactly the sections lit up on their card. Section access is a navigation gate in this app, not a database rule. Treat it as "what they are meant to use", not as a security boundary.',
            accent: '#B8844A',
            rows: others.filter(o => detectBundle(o.permissions) === 'custom'),
          },
        ];

        const visibleRanks = ranks.filter(r => r.rows.length > 0);
        const showInvited = pendingInvites.length > 0;
        // The invited rung is always drawn one step smaller than the last real
        // rank, so it reads as the foot of the tree however many ranks exist.
        const invitedTier = TIERS[Math.min(visibleRanks.length, TIERS.length - 1)];

        // ── Trunk: the vertical line between two ranks, with a node on it ───
        const trunk = (accent: string, key: string) => (
          <div key={key} aria-hidden className="flex flex-col items-center" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <span style={{ width: 2, height: 18, backgroundColor: `${accent}55`, borderRadius: 1 }} />
            <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: accent, margin: '5px 0' }} />
            <span style={{ width: 2, height: 18, backgroundColor: `${accent}55`, borderRadius: 1 }} />
          </div>
        );

        // ── Rank header + the beam its members hang from ───────────────────
        const rankHeader = (r: { id: string; label: string; note: string; hint: string; accent: string }, count: number) => (
          <>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 mb-2">
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: r.accent, display: 'inline-block' }} />
              <p className="font-bold text-[10.5px]" style={{ color: r.accent, fontFamily: OUTFIT, letterSpacing: '0.14em' }}>
                {r.label.toUpperCase()}
              </p>
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  minWidth: 20, height: 20, padding: '0 6px', fontSize: 10.5, fontWeight: 800,
                  fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums',
                  backgroundColor: r.accent, color: '#FFFDF9',
                }}
              >
                {count}
              </span>
              <span className="text-[11px]" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty' }}>· {r.note}</span>
              {/* Informational affordance: HOVER and FOCUS, never click. */}
              <span
                role="note"
                tabIndex={0}
                aria-label={`What ${r.label} means`}
                onMouseEnter={(e) => setTierHint({ id: r.id, text: r.hint, el: e.currentTarget })}
                onMouseLeave={() => window.setTimeout(() => setTierHint(prev => (prev && prev.id === r.id ? null : prev)), 140)}
                onFocus={(e) => setTierHint({ id: r.id, text: r.hint, el: e.currentTarget })}
                onBlur={() => setTierHint(null)}
                className="flex items-center justify-center rounded-full"
                style={{ width: 16, height: 16, border: `1.2px solid ${r.accent}66`, color: r.accent, cursor: 'help', flexShrink: 0 }}
              >
                <Info size={10} strokeWidth={2.6} />
              </span>
            </div>
            {/* The beam. The trunk lands on it and the rank's cards hang below,
                which is what makes this read as a tree rather than a list. */}
            <div
              aria-hidden
              style={{
                height: 2, borderRadius: 1, marginBottom: 18,
                background: `linear-gradient(90deg, transparent, ${r.accent}88 18%, ${r.accent}88 82%, transparent)`,
              }}
            />
          </>
        );

        // Centred wrap, not a grid: the trunk runs down the middle, so a rank's
        // members have to hang symmetrically off it. A grid would left-pack two
        // super admins into the corner of a 1400px row and leave the trunk
        // pointing at nothing. Cards keep their tier width and wrap into as
        // many centred rows as the team needs — one member or thirty.
        const rowStyle = (t: typeof TIERS[number]): React.CSSProperties => ({
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'stretch',
          gap: t.gap,
        });
        // maxWidth 100% is what keeps a 250px card inside a 375px phone: the
        // tree collapses to one card per row instead of scrolling sideways.
        const cardWidth = (t: typeof TIERS[number]): React.CSSProperties => ({
          flex: `0 0 ${t.card}px`,
          maxWidth: '100%',
        });

        // ── One person ─────────────────────────────────────────────────────
        // A face, a name, a crown if they own the place, the role the outside
        // world sees, and a gear. Nothing else. Privileges, the email address,
        // page access and the public-listing switch all live one click away in
        // the member sheet — they were making a portrait gallery read like a
        // permissions audit.
        const renderMember = (org: Organizer, t: typeof TIERS[number], accent: string) => {
          const name = org.profiles?.display_name ?? 'Unknown';
          const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          const orgIsOwner = org.role === 'owner';
          // Hidden from the public page: the portrait goes quiet — desaturated
          // and dimmed — and wears a struck-through eye. No pill needed; the
          // picture itself says it, and the switch is in the sheet.
          const hidden = !org.show_on_public;
          // The just-accepted secretariat member (?highlight=<organizer id>).
          // A brief, brighter widening of the SAME accent ring every card
          // already wears — not a new highlight style, the existing one
          // turned up for a moment.
          const isHighlighted = highlightPulse && org.id === highlightOrgId;

          return (
            <div
              key={org.id}
              id={`organizer-${org.id}`}
              className="relative flex flex-col items-center text-center"
              style={{ ...cardWidth(t), padding: t.pad, borderRadius: t.radius }}
            >
              {/* Portrait. The accent ring is the rank, worn rather than
                  labelled — gold for the people who hold the conference,
                  forest for admins, amber for hand-picked access. */}
              {/* The ring lives on the frame, not on the picture: CSS `filter`
                  desaturates an element's own box-shadow too, and a hidden
                  member's rank should still be legible. */}
              <div
                style={{
                  position: 'relative', width: t.avatar, height: t.avatar, borderRadius: 999,
                  boxShadow: isHighlighted
                    ? `0 0 0 5px ${NEU.base}, 0 0 0 11px ${NEU.gold}, 0 0 0 15px ${NEU.gold}55, 0 14px 34px rgba(182,135,31,0.5)`
                    : `0 0 0 5px ${NEU.base}, 0 0 0 8px ${accent}, 0 0 0 9px ${accent}33, 0 12px 30px rgba(27,56,40,0.18)`,
                  transition: 'box-shadow 900ms ease',
                }}
              >
                <ProfileLink userId={org.user_id} name={name} className="flex-shrink-0">
                  {org.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={org.profiles.avatar_url}
                      alt={name}
                      className="rounded-full object-cover"
                      style={{
                        width: t.avatar, height: t.avatar, display: 'block',
                        outline: '1px solid rgba(0, 0, 0, 0.1)', outlineOffset: -1,
                        filter: hidden ? 'grayscale(1)' : 'none',
                        opacity: hidden ? 0.5 : 1,
                        transitionProperty: 'filter, opacity',
                        transitionDuration: '200ms', transitionTimingFunction: EASE,
                      }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center rounded-full font-bold"
                      style={{
                        width: t.avatar, height: t.avatar, fontFamily: OUTFIT,
                        fontSize: Math.round(t.avatar * 0.32),
                        background: orgIsOwner
                          ? 'linear-gradient(150deg, rgba(238,217,138,0.5), rgba(182,135,31,0.28))'
                          : `linear-gradient(150deg, ${accent}26, ${accent}12)`,
                        color: orgIsOwner ? '#7A5A10' : '#1B3828',
                        filter: hidden ? 'grayscale(1)' : 'none',
                        opacity: hidden ? 0.5 : 1,
                      }}
                    >
                      {initials}
                    </div>
                  )}
                </ProfileLink>

                {/* Struck-through eye, bottom-left of the portrait. */}
                {hidden && (
                  <span
                    title={`${name} is hidden from your public conference page`}
                    aria-label="Hidden from the public page"
                    className="absolute flex items-center justify-center rounded-full"
                    style={{
                      left: '4%', bottom: '4%',
                      width: Math.round(t.avatar * 0.30), height: Math.round(t.avatar * 0.30),
                      backgroundColor: '#3C332B', color: '#F4EEDD',
                      boxShadow: `0 0 0 3px ${NEU.base}, 0 3px 10px rgba(27,56,40,0.28)`,
                    }}
                  >
                    <EyeOff size={Math.round(t.avatar * 0.16)} strokeWidth={2.3} />
                  </span>
                )}

                {/* Crown, worn on the portrait rather than beside the name. */}
                {orgIsOwner && (
                  <span
                    aria-label="Owner"
                    title="Owns this conference"
                    className="absolute flex items-center justify-center rounded-full"
                    style={{
                      right: '2%', top: '2%',
                      width: Math.round(t.avatar * 0.30), height: Math.round(t.avatar * 0.30),
                      background: 'linear-gradient(150deg, #F3E2A8, #B6871F)',
                      color: '#3A2A05',
                      boxShadow: `0 0 0 3px ${NEU.base}, 0 4px 12px rgba(182,135,31,0.4)`,
                    }}
                  >
                    <Crown size={Math.round(t.avatar * 0.16)} strokeWidth={2.4} />
                  </span>
                )}

                {/* Gear. Everything that used to crowd this card is behind it. */}
                {canManageTeam && (
                  <button
                    onClick={() => setMemberSheetId(org.id)}
                    aria-label={`Manage ${name}`}
                    title={`Manage ${name}`}
                    className="absolute flex items-center justify-center rounded-full focus:outline-none"
                    style={{
                      right: '2%', bottom: '2%',
                      width: Math.round(t.avatar * 0.30), height: Math.round(t.avatar * 0.30),
                      backgroundColor: '#FFFDF9', color: NEU.inkSoft, border: 'none',
                      boxShadow: `0 0 0 3px ${NEU.base}, 0 3px 10px rgba(27,56,40,0.2)`,
                      cursor: 'pointer',
                      transitionProperty: 'color, background-color, scale',
                      transitionDuration: '140ms', transitionTimingFunction: EASE,
                    }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = '#FFFFFF'; el.style.scale = '1.06'; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = NEU.inkSoft; el.style.backgroundColor = '#FFFDF9'; el.style.scale = '1'; }}
                    onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.scale = '0.96'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.scale = '1.06'; }}
                  >
                    <Settings2 size={Math.round(t.avatar * 0.15)} strokeWidth={2.2} />
                  </button>
                )}
              </div>

              <p
                className="font-bold mt-3.5 w-full"
                style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: t.name, lineHeight: 1.2, textWrap: 'balance' }}
              >
                <ProfileLink userId={org.user_id} name={name}>{name}</ProfileLink>
              </p>

              {/* The role, in the rank's own colour. This is the one thing the
                  outside world sees, so it is the one thing printed here. */}
              <p
                className="w-full mt-1"
                style={{
                  color: org.public_title ? accent : NEU.muted,
                  fontFamily: OUTFIT, fontSize: t.meta,
                  fontWeight: org.public_title ? 700 : 500,
                  letterSpacing: '0.02em', lineHeight: 1.35, textWrap: 'pretty',
                }}
                title={org.public_title ?? undefined}
              >
                {org.public_title ?? (canManageTeam ? 'No role set' : '')}
              </p>
            </div>
          );
        };

        return (
        <div>
          {/* Header: title, one-line purpose, and the "+" that starts the flow */}
          <div className="flex items-start gap-3 mb-1">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: OUTFIT, textWrap: 'balance' }}>
                Organizing Team
              </p>
              <p className="text-sm mt-1" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                {canManageTeam
                  ? 'Your team as a hierarchy: who holds the conference, who can do everything, and who has been given a hand-picked set of pages. Everyone is listed on your public conference page by default, and you can hide anyone from their card.'
                  : 'Your team as a hierarchy: who holds the conference, who can do everything, and who has been given a hand-picked set of pages.'}
              </p>
            </div>
            {canManageTeam && (
              <button
                onClick={openInviteFlow}
                aria-label="Invite someone to the organizing team"
                className="flex items-center justify-center rounded-2xl flex-shrink-0 focus:outline-none"
                style={{
                  width: 44, height: 44, backgroundColor: '#1B3828', color: '#EED98A', border: 'none',
                  boxShadow: '0 2px 6px rgba(27,56,40,0.22)', cursor: 'pointer',
                  transitionProperty: 'background-color, scale, box-shadow',
                  transitionDuration: '160ms', transitionTimingFunction: EASE,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { const t = e.currentTarget as HTMLElement; t.style.backgroundColor = '#1B3828'; t.style.scale = '1'; }}
                onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.scale = '0.96'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.scale = '1'; }}
              >
                <Plus size={20} strokeWidth={2.6} />
              </button>
            )}
          </div>

          {/* Team shape at a glance — tabular so it does not jitter as members
              move between ranks. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 mb-6">
            {visibleRanks.map(r => (
              <span key={r.id} className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: r.accent }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: r.accent, display: 'inline-block' }} />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.rows.length}</span>
                {r.label.toUpperCase()}
              </span>
            ))}
            {showInvited && (
              <span className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: NEU.inkSoft }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, border: '1.5px dashed #B6871F', display: 'inline-block' }} />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pendingInvites.length}</span>
                INVITED
              </span>
            )}
          </div>

          {organizers.length === 0 && !showInvited && (
            <p className="text-sm py-2" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>No team members yet.</p>
          )}

          {/* ── The tree ───────────────────────────────────────────────────── */}
          {visibleRanks.map((r, i) => (
            <div key={r.id}>
              {i > 0 && trunk(r.accent, `trunk-${r.id}`)}
              {rankHeader(r, r.rows.length)}
              <div style={rowStyle(TIERS[Math.min(i, TIERS.length - 1)])}>
                {r.rows.map(o => renderMember(o, TIERS[Math.min(i, TIERS.length - 1)], r.accent))}
              </div>
            </div>
          ))}

          {/* ── Invited: the bottom rung. Not on the team yet, so dashed. ──── */}
          {showInvited && (
            <div>
              {visibleRanks.length > 0 && trunk('#B6871F', 'trunk-invited')}
              {rankHeader(
                {
                  id: 'invited',
                  label: 'Invited',
                  note: 'Privileges and role already chosen, applied the moment they accept',
                  hint: 'These people have been sent an invitation. It reaches them by email and, if the address already has a Gavelling account, it also appears on their profile at My Conferences for them to accept or decline. Nothing is created on the team until they do.',
                  accent: '#B6871F',
                },
                pendingInvites.length,
              )}
              <div style={rowStyle(invitedTier)}>
                {pendingInvites.map(inv => {
                  const invBundle = (inv.bundle ?? 'custom') as BundleId;
                  const invSections = grantedSectionCount(inv.permissions);
                  return (
                    <div
                      key={inv.id}
                      className="relative flex flex-col items-center text-center"
                      style={{
                        ...cardWidth(invitedTier),
                        backgroundColor: 'rgba(255,253,249,0.6)',
                        borderRadius: invitedTier.radius,
                        border: '1.5px dashed rgba(182,135,31,0.45)',
                        padding: invitedTier.pad,
                      }}
                    >
                      {canManageTeam && (
                        <button
                          onClick={() => handleRevokeInvite(inv)}
                          disabled={revokingInviteId === inv.id}
                          aria-label={`Revoke invite to ${inv.email}`}
                          title={`Revoke invite to ${inv.email}`}
                          className="absolute flex items-center justify-center rounded-full focus:outline-none"
                          style={{
                            top: 4, right: 4, width: 40, height: 40,
                            color: NEU.inkSoft, background: 'transparent', border: 'none',
                            opacity: revokingInviteId === inv.id ? 0.5 : 1,
                            cursor: revokingInviteId === inv.id ? 'default' : 'pointer',
                            transitionProperty: 'color, background-color', transitionDuration: '140ms',
                          }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#8B2020'; el.style.backgroundColor = 'rgba(139,32,32,0.08)'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = NEU.inkSoft; el.style.backgroundColor = 'transparent'; }}
                        >
                          <X size={15} />
                        </button>
                      )}

                      <div
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: invitedTier.avatar, height: invitedTier.avatar,
                          backgroundColor: 'rgba(182,135,31,0.10)',
                          boxShadow: '0 0 0 3px #FFFDF9, 0 0 0 4.5px rgba(182,135,31,0.24)',
                        }}
                      >
                        <MailIcon size={Math.round(invitedTier.avatar * 0.36)} style={{ color: '#8A6614' }} />
                      </div>

                      <p
                        className="font-semibold mt-2.5 w-full truncate"
                        style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: invitedTier.name }}
                        title={inv.email}
                      >
                        {inv.email}
                      </p>
                      <p
                        className="w-full truncate mt-0.5"
                        style={{ color: inv.public_title ? '#8A6614' : NEU.inkSoft, fontFamily: OUTFIT, fontSize: invitedTier.meta, fontWeight: inv.public_title ? 700 : 400 }}
                      >
                        {inv.public_title ?? 'No role set'}
                      </p>
                      <p
                        className="w-full truncate"
                        style={{ color: NEU.inkSoft, fontFamily: OUTFIT, fontSize: invitedTier.meta - 0.5, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {bundleLabel(invBundle)}
                        {invBundle === 'custom' && ` · ${invSections} section${invSections === 1 ? '' : 's'}`}
                      </p>

                      <span
                        className="mt-2.5"
                        style={{
                          padding: '4px 10px', borderRadius: 999, fontSize: 9.5, fontWeight: 800,
                          letterSpacing: '0.07em', fontFamily: OUTFIT,
                          backgroundColor: 'rgba(182,135,31,0.18)', color: '#7A5A10',
                        }}
                      >
                        AWAITING REPLY
                      </span>
                      <p
                        className="mt-1.5"
                        style={{ color: NEU.inkSoft, fontFamily: OUTFIT, fontSize: invitedTier.meta - 1, fontVariantNumeric: 'tabular-nums' }}
                      >
                        invited {new Date(inv.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* A refused write must never be silent — this is the surface that
              told the owner nothing when the platform-admin UPDATE matched
              zero rows. The resync helpers fill it and re-read the row so the
              cards end up showing database truth. */}
          {organizersError && (
            <p
              role="alert"
              className="text-xs mt-4 rounded-lg px-3 py-2"
              style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)', fontFamily: OUTFIT }}
            >
              {organizersError}
            </p>
          )}
          {inviteNotice && (
            <p className="text-xs mt-4 rounded-lg px-3 py-2" style={{ color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.07)', fontFamily: OUTFIT }}>
              {inviteNotice}
            </p>
          )}

          {/* Honest footnote. Section access is a navigation gate; the two
              capabilities below it are real database rules. Saying so here is
              cheaper than someone assuming otherwise. */}
          <p className="text-xs mt-5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty', lineHeight: 1.55 }}>
            Section access decides which pages a member can open. The team and money
            capabilities go further: managing this team and changing financial details
            are both refused by the database, not merely hidden here.
          </p>
        </div>
        );
      })()}

      {activeTab === 'privacy' && <><div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Privacy & Publishing
        </p>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Control who can see your view.
        </p>

        {/* Public toggle */}
        <div
          className="flex items-center justify-between p-4 rounded-xl mb-4"
          style={{ backgroundColor: 'rgba(27,56,40,0.03)', border: '1px solid rgba(27,56,40,0.08)' }}
        >
          <div>
            <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Public listing</p>
            <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              Your conference appears on gavelling.com/conferences
            </p>
          </div>
          <span className="flex items-center gap-2 flex-shrink-0">
            {publicToggleSaving && (
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
            )}
            {/* Only the private->public direction is gated (mirrors the DB
                trigger), an organizer must always be able to unpublish. */}
            <PillToggle
              value={view.is_public}
              onChange={publicToggleSaving ? () => {} : handlePublicToggle}
              size="md"
              disabled={!view.is_public && (paymentGateBlocks(view) || view.dates_tbd || !view.start_date)}
            />
          </span>
        </div>

        {!view.is_public && (view.dates_tbd || !view.start_date) ? (
          <p className="text-sm mt-3" style={{ color: '#B8844A', fontFamily: "'Outfit', sans-serif" }}>
            Add conference dates to publish. TBD conferences stay private.
          </p>
        ) : (
          <p className="text-sm mt-3" style={{ color: view.is_public ? '#1B3828' : '#B8844A', fontFamily: "'Outfit', sans-serif" }}>
            {view.is_public
              ? 'Your conference is publicly listed on Gavelling.'
              : 'Your conference is private. Only people with the direct link can find it.'}
          </p>
        )}
        {!view.is_public && paymentGateBlocks(view) && (
          <p className="text-xs mt-2" style={{ color: '#B8844A', fontFamily: "'Outfit', sans-serif" }}>{paymentGateMessage(view)}</p>
        )}
        {privacyError && (
          <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{privacyError}</p>
        )}

        {/* Danger zone */}
        <div className="mt-6 pt-6" style={{ borderTop: '1px solid #F0EDE6' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
            Danger Zone
          </p>
          <button
            onClick={handleArchive}
            className="w-full rounded-xl py-2.5 font-semibold text-sm focus:outline-none transition-colors"
            style={{ border: '1px solid rgba(139,32,32,0.3)', color: '#8B2020', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.05)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            ARCHIVE CONFERENCE
          </button>

          <button
            onClick={() => { if (!isOwner) { setDeleteError('Only the conference owner can delete this view.'); return; } setDeleteError(''); setConfirmingDelete(true); }}
            className="w-full rounded-xl py-2.5 mt-3 font-semibold text-sm focus:outline-none transition-colors"
            style={{ border: '1px solid rgba(139,32,32,0.3)', color: '#8B2020', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.05)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            DELETE CONFERENCE
          </button>
          {deleteError && (
            <p className="text-sm mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{deleteError}</p>
          )}

          {confirmingDelete && (
            <ConfirmModal
              title="Delete this conference?"
              body="Are you sure you want to delete this conference? This action is irreversible, all data relating to this conference will be lost."
              confirmLabel="Yes, delete"
              danger
              loading={deleting}
              onConfirm={async () => {
                if (!session || deleting) return;
                setDeleting(true);
                const supabase = getAuthedClient(session.access_token);
                const { error } = await supabase.rpc('delete_conference', { p_conference_id: view.id });
                if (error) { setDeleteError(error.message || 'Could not delete view.'); setConfirmingDelete(false); setDeleting(false); return; }
                window.location.href = '/';
              }}
              onCancel={() => { if (!deleting) setConfirmingDelete(false); }}
            />
          )}
        </div>
      </div>

      {/* ── Lineage card ── */}
      <div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Lineage
        </p>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Link editions of the same conference across years. Links only count once the previous edition&apos;s owner approves them.
        </p>

        {/* Outgoing claim: this conference's predecessor */}
        <p
          className="text-xs font-bold mb-2"
          style={{ color: '#6E5F4E', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.02em' }}
        >
          Previous edition
        </p>
        {view.predecessor_conference_id ? (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6"
            style={{ backgroundColor: 'rgba(27,56,40,0.03)', border: '1px solid rgba(27,56,40,0.08)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                {predecessorInfo?.full_name ?? 'A private conference'}
              </p>
              <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                {view.predecessor_approved
                  ? 'Confirmed as the previous edition of this view.'
                  : 'Waiting for its Main Organiser to confirm the link.'}
              </p>
            </div>
            <span className="flex-shrink-0">
              <Pill tone={view.predecessor_approved ? 'forest' : 'gold'} size="sm" dot>
                {view.predecessor_approved ? 'Approved' : 'Pending approval'}
              </Pill>
            </span>
            <button
              onClick={handleWithdrawClaim}
              disabled={withdrawingClaim}
              className="text-xs font-semibold focus:outline-none hover:underline flex-shrink-0"
              style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}
            >
              {withdrawingClaim ? 'WITHDRAWING...' : 'WITHDRAW'}
            </button>
          </div>
        ) : (
          <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            No previous edition linked. You can link one when creating your next edition on Gavelling.
          </p>
        )}

        {/* Incoming claims: conferences claiming this one as their predecessor */}
        <p
          className="text-xs font-bold mb-2"
          style={{ color: '#6E5F4E', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.02em' }}
        >
          Incoming claims
        </p>
        {incomingClaims.length === 0 ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            No conferences currently claim {view.acronym} as their previous edition.
          </p>
        ) : (
          <div className="flex flex-col">
            {incomingClaims.map((claim, idx) => {
              const isLast = idx === incomingClaims.length - 1;
              const year = claim.start_date ? new Date(claim.start_date + 'T00:00:00').getFullYear() : null;
              return (
                <div
                  key={claim.id}
                  className="flex items-center gap-3 py-3"
                  style={{ borderBottom: isLast ? 'none' : '1px solid #F0EDE6' }}
                >
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 10, color: '#B6871F', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      {claim.acronym}{year ? ' · ' + year : ''}
                    </p>
                    <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      {claim.full_name}
                    </p>
                    <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      claims to be the next edition of {view.acronym}
                    </p>
                  </div>

                  {claim.predecessor_approved ? (
                    <span className="flex-shrink-0">
                      <Pill tone="forest" size="sm" dot>Approved</Pill>
                    </span>
                  ) : isOwner ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleClaimDecision(claim.id, true)}
                        disabled={lineageBusy === claim.id}
                        className="rounded-lg py-1.5 px-3 font-bold text-[11px] focus:outline-none transition-colors"
                        style={{
                          backgroundColor: lineageBusy === claim.id ? '#DDD4C0' : '#1B3828',
                          color: lineageBusy === claim.id ? '#9A8A78' : '#EED98A',
                          fontFamily: "'Outfit', sans-serif",
                          letterSpacing: '0.06em',
                        }}
                        onMouseEnter={(e) => { if (lineageBusy !== claim.id) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                        onMouseLeave={(e) => { if (lineageBusy !== claim.id) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => handleClaimDecision(claim.id, false)}
                        disabled={lineageBusy === claim.id}
                        className="rounded-lg py-1.5 px-3 font-bold text-[11px] focus:outline-none transition-colors"
                        style={{
                          backgroundColor: 'transparent',
                          color: '#8B2020',
                          border: '1px solid rgba(139,32,32,0.3)',
                          fontFamily: "'Outfit', sans-serif",
                          letterSpacing: '0.06em',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.05)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        REJECT
                      </button>
                    </div>
                  ) : (
                    <span className="flex-shrink-0" title="Only the conference owner can approve or reject lineage claims.">
                      <Pill tone="neutral" size="sm">Owner decides</Pill>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {lineageError && (
          <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
            {lineageError}
          </p>
        )}
      </div>

      {/* ── Partner conferences card ── */}
      <div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Partner conferences
        </p>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Showcase partner conferences on your public page. Links only appear once the partner conference&apos;s team approves them.
        </p>

        {/* Typeahead add */}
        <div className="relative mb-6">
          <input
            type="text"
            value={partnerQuery}
            onChange={(e) => setPartnerQuery(e.target.value)}
            placeholder="Search public conferences by acronym or name"
            style={inputStyle}
            onFocus={fgInput}
            onBlur={bgInput}
          />
          {partnerResults.length > 0 && (
            <div
              className="absolute left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden"
              style={{ backgroundColor: '#FFFDF9', border: '1.5px solid #DDD4C0', boxShadow: '0 12px 32px rgba(27,56,40,0.14)' }}
            >
              {partnerResults.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => handleAddPartner(c)}
                  disabled={partnerBusy === c.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left focus:outline-none transition-colors"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderTop: idx === 0 ? 'none' : '1px solid #F0EDE6',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <PartnerDisc logoUrl={c.logo_url} acronym={c.acronym} size={32} />
                  <span className="min-w-0">
                    <span className="block font-bold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      {c.acronym}
                    </span>
                    <span className="block text-xs truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      {[c.city, c.country].filter(Boolean).join(', ') || c.full_name}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Linked partners */}
        <p
          className="text-xs font-bold mb-2"
          style={{ color: '#6E5F4E', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.02em' }}
        >
          Linked partners
        </p>
        {partners.length === 0 ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            No partner conferences linked yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {partners.map((link, idx) => {
              const isLast = idx === partners.length - 1;
              const conf = link.conf;
              const year = conf?.start_date ? new Date(conf.start_date + 'T00:00:00').getFullYear() : null;
              const cityLine = conf ? [conf.city, conf.country].filter(Boolean).join(', ') : '';
              return (
                <div
                  key={link.id}
                  className="flex items-center gap-3 py-3"
                  style={{ borderBottom: isLast ? 'none' : '1px solid #F0EDE6' }}
                >
                  <PartnerDisc logoUrl={conf?.logo_url ?? null} acronym={conf?.acronym ?? '?'} />
                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {conf?.acronym ?? 'Unknown conference'}{year ? ` ${year}` : ''}
                    </p>
                    {cityLine && (
                      <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        {cityLine}
                      </p>
                    )}
                  </div>

                  <span
                    className="flex-shrink-0 rounded-full px-2.5 py-1 font-bold"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      fontFamily: "'Outfit', sans-serif",
                      backgroundColor: link.approved ? 'rgba(61,122,82,0.13)' : 'rgba(238,217,138,0.35)',
                      color: link.approved ? '#2A5A3C' : '#8A6614',
                    }}
                  >
                    {link.approved ? 'APPROVED' : 'PENDING APPROVAL'}
                  </span>

                  <div className="flex items-center flex-shrink-0">
                    <button
                      onClick={() => handleMovePartner(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Move partner up"
                      className="text-xs focus:outline-none px-1 transition-colors"
                      style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", background: 'transparent', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                      onMouseEnter={(e) => { if (idx !== 0) (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMovePartner(idx, 1)}
                      disabled={idx === partners.length - 1}
                      aria-label="Move partner down"
                      className="text-xs focus:outline-none px-1 transition-colors"
                      style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", background: 'transparent', border: 'none', cursor: idx === partners.length - 1 ? 'default' : 'pointer', opacity: idx === partners.length - 1 ? 0.3 : 1 }}
                      onMouseEnter={(e) => { if (idx !== partners.length - 1) (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                    >
                      ▼
                    </button>
                  </div>

                  <button
                    onClick={() => handleRemovePartner(link)}
                    disabled={partnerBusy === link.id}
                    aria-label={`Remove ${conf?.acronym ?? 'partner'}`}
                    className="text-sm font-semibold focus:outline-none flex-shrink-0 px-1 transition-colors"
                    style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", background: 'transparent', border: 'none', cursor: 'pointer', opacity: partnerBusy === link.id ? 0.4 : 1 }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Incoming partner requests */}
        {incomingPartnerClaims.length > 0 && (
          <div className="mt-6 pt-6" style={{ borderTop: '1px solid #F0EDE6' }}>
            <p
              className="text-xs font-bold mb-2"
              style={{ color: '#6E5F4E', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.02em' }}
            >
              Incoming partner requests
            </p>
            <div className="flex flex-col">
              {incomingPartnerClaims.map((claim, idx) => {
                const isLast = idx === incomingPartnerClaims.length - 1;
                const year = claim.requester_start_date ? new Date(claim.requester_start_date + 'T00:00:00').getFullYear() : null;
                const cityLine = [claim.requester_city, claim.requester_country].filter(Boolean).join(', ');
                const busy = partnerBusy === claim.link_id;
                return (
                  <div
                    key={claim.link_id}
                    className="flex items-center gap-3 py-3"
                    style={{ borderBottom: isLast ? 'none' : '1px solid #F0EDE6' }}
                  >
                    <PartnerDisc logoUrl={claim.requester_logo_url} acronym={claim.requester_acronym} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 10, color: '#B6871F', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}>
                        {claim.requester_acronym}{year ? ' · ' + year : ''}
                      </p>
                      <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                        {claim.requester_full_name}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        {cityLine ? cityLine + ', ' : ''}wants to list {view.acronym} as a partner conference
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handlePartnerClaimDecision(claim.link_id, true)}
                        disabled={busy}
                        className="rounded-lg py-1.5 px-3 font-bold text-[11px] focus:outline-none transition-colors"
                        style={{
                          backgroundColor: busy ? '#DDD4C0' : '#1B3828',
                          color: busy ? '#9A8A78' : '#EED98A',
                          fontFamily: "'Outfit', sans-serif",
                          letterSpacing: '0.06em',
                        }}
                        onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                        onMouseLeave={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => handlePartnerClaimDecision(claim.link_id, false)}
                        disabled={busy}
                        className="rounded-lg py-1.5 px-3 font-bold text-[11px] focus:outline-none transition-colors"
                        style={{
                          backgroundColor: 'transparent',
                          color: '#8B2020',
                          border: '1px solid rgba(139,32,32,0.3)',
                          fontFamily: "'Outfit', sans-serif",
                          letterSpacing: '0.06em',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.05)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        DECLINE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {partnerError && (
          <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
            {partnerError}
          </p>
        )}
      </div>

      {/* Data import moved to the sidebar nav (Manage → Import); the launch
          card that used to sit here has been removed. The import page itself
          (/manage/[slug]/import) is unchanged. */}
      </>}

        </section>
      </div>

      {/* Drag-to-fit crop step, flattens the chosen framing into a square
          transparent PNG, then hands off to the existing upload path. */}
      {logoCropFile && (
        <LogoCropModal
          file={logoCropFile}
          onCancel={() => setLogoCropFile(null)}
          onSave={(blob) => {
            setLogoCropFile(null);
            handleLogoUpload(new File([blob], 'logo.png', { type: 'image/png' }));
          }}
        />
      )}

      {/* ── Bundle menu ──────────────────────────────────────────────────────
          Portaled at fixed viewport coordinates and edge-flipping, so a member
          near the bottom of a long team list is never clipped by the settings
          card's rounded overflow (AGENTS.md: never un-clip by loosening a
          shared card's overflow). */}
      {bundleMenuFor && bundleMenuPos && (
        <Portal>
          <div
            data-bundle-menu
            role="menu"
            aria-label="Choose a privilege bundle"
            style={{
              position: 'fixed', left: bundleMenuPos.left, top: bundleMenuPos.top,
              // Above the member sheet (130), because the trigger now lives
              // INSIDE that sheet. At 120 the menu painted behind the sheet's
              // scrim and every click meant to pick a bundle landed on the
              // overlay instead — which closed the sheet.
              width: 276, zIndex: 140,
              backgroundColor: '#FFFDF9', border: '1.5px solid #D8CDB6', borderRadius: 18,
              boxShadow: '0 12px 34px rgba(27,56,40,0.18), 0 2px 6px rgba(27,56,40,0.08)',
              padding: 8,
            }}
          >
            {BUNDLES.map(b => {
              const target = organizers.find(o => o.id === bundleMenuFor.orgId);
              const active = detectBundle(target?.permissions) === b.id;
              const blocked = b.id === 'super_admin' && !canGrantSuperAdmin;
              return (
                <button
                  key={b.id}
                  role="menuitemradio"
                  aria-checked={active}
                  disabled={blocked}
                  onClick={() => { if (!blocked) setOrgBundle(bundleMenuFor.orgId, b.id); }}
                  title={blocked ? 'Only the conference owner can grant super admin.' : undefined}
                  className="w-full text-left rounded-xl focus:outline-none"
                  style={{
                    display: 'block', padding: '10px 12px', marginBottom: 2,
                    fontFamily: OUTFIT, border: 'none',
                    backgroundColor: active ? 'rgba(27,56,40,0.09)' : 'transparent',
                    cursor: blocked ? 'not-allowed' : 'pointer',
                    opacity: blocked ? 0.45 : 1,
                    transitionProperty: 'background-color', transitionDuration: '120ms',
                  }}
                  onMouseEnter={(e) => { if (!blocked && !active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <span className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', color: '#1C1410' }}>
                    {b.label.toUpperCase()}
                    {active && <Check size={13} strokeWidth={3} style={{ color: '#1B3828' }} />}
                  </span>
                  <span className="block mt-0.5" style={{ fontSize: 11, color: NEU.inkSoft, lineHeight: 1.45, textWrap: 'pretty' }}>
                    {b.summary}
                  </span>
                </button>
              );
            })}
          </div>
        </Portal>
      )}

      {/* ── Tier explainer, revealed on HOVER/FOCUS, never on click ───────── */}
      {tierHint && tierHintPos && (
        <Portal>
          <div
            role="tooltip"
            onMouseEnter={() => setTierHint(tierHint)}
            onMouseLeave={() => setTierHint(null)}
            style={{
              position: 'fixed', left: tierHintPos.left, top: tierHintPos.top,
              width: 272, zIndex: 120,
              backgroundColor: '#1B3828', color: '#F4EEDD', borderRadius: 14,
              boxShadow: '0 12px 30px rgba(27,56,40,0.28)',
              padding: '11px 13px', fontFamily: OUTFIT, fontSize: 11.5,
              lineHeight: 1.55, textWrap: 'pretty',
            }}
          >
            {tierHint.text}
          </div>
        </Portal>
      )}

      {/* ── Invite flow: email → role → privileges ────────────────────────── */}
      {inviteOpen && (
        <Portal>
          <div
            className="fixed inset-0 flex items-center justify-center px-4"
            style={{ zIndex: 130, backgroundColor: 'rgba(28,20,16,0.42)', backdropFilter: 'blur(3px)' }}
            onMouseDown={(e) => { if (e.target === e.currentTarget && !inviting) setInviteOpen(false); }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Invite a team member"
              className="w-full"
              style={{
                maxWidth: 520, maxHeight: '86vh', overflowY: 'auto',
                backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 24,
                boxShadow: '0 26px 70px rgba(27,56,40,0.30)', padding: 24,
              }}
            >
              {/* Step rail */}
              <div className="flex items-center gap-2 mb-5">
                {([1, 2, 3] as const).map(n => (
                  <span
                    key={n}
                    aria-hidden
                    style={{
                      height: 4, flex: 1, borderRadius: 2,
                      backgroundColor: n <= inviteStep ? '#1B3828' : '#DDD4C0',
                      transitionProperty: 'background-color', transitionDuration: '220ms',
                      transitionTimingFunction: EASE,
                    }}
                  />
                ))}
              </div>

              <p className="font-bold text-[10px] mb-1" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, letterSpacing: '0.14em' }}>
                STEP {inviteStep} OF 3
              </p>

              {inviteStep === 1 && (
                <>
                  <h3 className="font-black text-xl mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT, textWrap: 'balance' }}>
                    Who are you adding?
                  </h3>
                  <p className="text-sm mb-4" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                    They get an emailed link, and it also lands on their Gavelling profile if they
                    already have an account. Either way they join the team the moment they accept.
                  </p>
                  <label htmlFor="org-invite-email" className="block font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    Email address
                  </label>
                  <input
                    id="org-invite-email"
                    type="email"
                    autoFocus
                    value={inviteEmail}
                    onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && inviteEmail.trim()) setInviteStep(2); }}
                    placeholder="colleague@example.com"
                    style={{ ...inputStyle, width: '100%' }}
                    onFocus={fgInput}
                    onBlur={bgInput}
                  />

                  {/* Asked for here, at the moment of adding, rather than left
                      as a blank on the team page for somebody to remember. It
                      is the public-facing title, not a privilege — privileges
                      are the next two steps. */}
                  <label htmlFor="org-invite-title" className="block font-semibold text-sm mt-4 mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    Role they will be representing
                  </label>
                  <input
                    id="org-invite-title"
                    type="text"
                    value={invitePublicTitle}
                    onChange={(e) => setInvitePublicTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && inviteEmail.trim()) setInviteStep(2); }}
                    placeholder="e.g. Secretary-General"
                    maxLength={80}
                    style={{ ...inputStyle, width: '100%' }}
                    onFocus={fgInput}
                    onBlur={bgInput}
                  />
                  <p className="text-xs mt-2" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty', lineHeight: 1.5 }}>
                    This is the title shown beside their photo on your public conference page. They
                    are listed publicly by default, and you can hide anyone from their card on the team
                    page. It has nothing to do with what they can open in this dashboard.
                  </p>
                </>
              )}

              {inviteStep === 2 && (
                <>
                  <h3 className="font-black text-xl mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT, textWrap: 'balance' }}>
                    What is their role?
                  </h3>
                  <p className="text-sm mb-4" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                    Inviting {inviteEmail.trim() || 'them'}
                    {invitePublicTitle.trim() ? ` as ${invitePublicTitle.trim()}` : ''}. This is what
                    they can do in the dashboard, which is a separate question from their title.
                  </p>
                  <div className="flex flex-col gap-2">
                    {BUNDLES.map(b => {
                      const active = inviteBundle === b.id;
                      const blocked = b.id === 'super_admin' && !canGrantSuperAdmin;
                      return (
                        <button
                          key={b.id}
                          onClick={() => { if (!blocked) setInviteBundle(b.id); }}
                          disabled={blocked}
                          aria-pressed={active}
                          title={blocked ? 'Only the conference owner can grant super admin.' : undefined}
                          className="text-left rounded-2xl focus:outline-none"
                          style={{
                            padding: 14, fontFamily: OUTFIT,
                            backgroundColor: active ? 'rgba(27,56,40,0.08)' : '#FFFDF9',
                            border: active ? '1.5px solid rgba(27,56,40,0.42)' : '1.5px solid #E4DAC4',
                            cursor: blocked ? 'not-allowed' : 'pointer',
                            opacity: blocked ? 0.5 : 1,
                            transitionProperty: 'background-color, border-color, scale',
                            transitionDuration: '150ms', transitionTimingFunction: EASE,
                          }}
                          onMouseDown={(e) => { if (!blocked) (e.currentTarget as HTMLElement).style.scale = '0.99'; }}
                          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.scale = '1'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.scale = '1'; }}
                        >
                          <span className="flex items-center gap-2" style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.05em', color: '#1C1410' }}>
                            {b.label.toUpperCase()}
                            {active && <Check size={14} strokeWidth={3} style={{ color: '#1B3828' }} />}
                          </span>
                          <span className="block mt-1" style={{ fontSize: 12.5, color: NEU.inkSoft, lineHeight: 1.5, textWrap: 'pretty' }}>
                            {b.summary}
                          </span>
                          {b.caveat && (
                            <span className="block mt-1" style={{ fontSize: 11.5, color: '#8A6614', lineHeight: 1.45 }}>
                              {b.caveat}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {inviteStep === 3 && (
                <>
                  <h3 className="font-black text-xl mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT, textWrap: 'balance' }}>
                    {inviteBundle === 'custom' ? 'Which pages can they open?' : 'This is what they get'}
                  </h3>
                  <p className="text-sm mb-4" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                    {inviteBundle === 'custom'
                      ? 'Pick the sections. Each icon is the page it unlocks in the sidebar.'
                      : 'The privileges below are stored on the invite and applied the moment they accept.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ORGANIZER_SECTIONS.map(s => {
                      const previewPerms = bundlePermissions(inviteBundle, inviteCustomPerms);
                      const on = previewPerms[s.key] === true;
                      const interactive = inviteBundle === 'custom';
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          disabled={!interactive}
                          aria-pressed={on}
                          title={`${s.label}: ${s.blurb}`}
                          onClick={interactive ? () => setInviteCustomPerms(prev => {
                            const next = { ...prev, [s.key]: !prev[s.key] };
                            if (!next[s.key]) delete next[s.key];
                            return next;
                          }) : undefined}
                          className="flex items-center gap-1.5 rounded-xl focus:outline-none"
                          style={{
                            minHeight: 40, padding: '9px 12px', fontFamily: OUTFIT,
                            fontSize: 12, fontWeight: 700,
                            color: on ? '#1B3828' : NEU.inkSoft,
                            backgroundColor: on ? 'rgba(27,56,40,0.10)' : 'transparent',
                            border: on ? '1.5px solid rgba(27,56,40,0.30)' : '1.5px dashed #D8CDB6',
                            opacity: on ? 1 : 0.72,
                            cursor: interactive ? 'pointer' : 'default',
                            transitionProperty: 'background-color, border-color, color, opacity, scale',
                            transitionDuration: '140ms', transitionTimingFunction: EASE,
                          }}
                          onMouseDown={interactive ? (e) => { (e.currentTarget as HTMLElement).style.scale = '0.96'; } : undefined}
                          onMouseUp={interactive ? (e) => { (e.currentTarget as HTMLElement).style.scale = '1'; } : undefined}
                          onMouseLeave={interactive ? (e) => { (e.currentTarget as HTMLElement).style.scale = '1'; } : undefined}
                        >
                          <Icon size={14} strokeWidth={2.2} />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>

                  {inviteBundle === 'admin' && (
                    <p className="text-xs mt-3 rounded-xl px-3 py-2.5" style={{ color: '#7A5A10', backgroundColor: 'rgba(182,135,31,0.12)', border: '1px solid rgba(182,135,31,0.32)', fontFamily: OUTFIT, lineHeight: 1.5, textWrap: 'pretty' }}>
                      Financials open in full but are read-only: no fee, add-on, voucher, payout or
                      invoice change. The database refuses those writes, so it holds even outside
                      this interface.
                    </p>
                  )}
                  {inviteBundle === 'super_admin' && (
                    <p className="text-xs mt-3 rounded-xl px-3 py-2.5" style={{ color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.08)', border: '1px solid rgba(27,56,40,0.24)', fontFamily: OUTFIT, lineHeight: 1.5, textWrap: 'pretty' }}>
                      Full control, including money and this team page. They will not be able to
                      remove you as owner.
                    </p>
                  )}
                  {inviteBundle === 'custom' && Object.values(bundlePermissions('custom', inviteCustomPerms)).every(v => v !== true) && (
                    <p className="text-xs mt-3" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
                      Nothing picked yet. They would join able to see the dashboard and nothing else.
                    </p>
                  )}
                </>
              )}

              {inviteError && (
                <p className="text-xs mt-3 rounded-lg px-3 py-2" style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)', fontFamily: OUTFIT }}>
                  {inviteError}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center gap-2 mt-6">
                <button
                  onClick={() => { if (inviteStep === 1) setInviteOpen(false); else setInviteStep((inviteStep - 1) as 1 | 2); }}
                  disabled={inviting}
                  className="flex items-center gap-1.5 rounded-xl focus:outline-none"
                  style={{
                    minHeight: 44, padding: '0 14px', fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
                    color: NEU.inkSoft, background: 'transparent', border: '1.5px solid #DDD4C0',
                    opacity: inviting ? 0.5 : 1,
                    transitionProperty: 'color, border-color', transitionDuration: '140ms',
                  }}
                >
                  {inviteStep === 1 ? <X size={14} /> : <ArrowLeft size={14} />}
                  {inviteStep === 1 ? 'Cancel' : 'Back'}
                </button>
                <div className="flex-1" />
                {inviteStep < 3 ? (
                  <button
                    onClick={() => setInviteStep((inviteStep + 1) as 2 | 3)}
                    disabled={inviteStep === 1 && !inviteEmail.trim()}
                    className="rounded-xl focus:outline-none"
                    style={{
                      minHeight: 44, padding: '0 20px', fontFamily: OUTFIT, fontSize: 13, fontWeight: 800,
                      letterSpacing: '0.05em', border: 'none',
                      backgroundColor: (inviteStep === 1 && !inviteEmail.trim()) ? '#DDD4C0' : '#1B3828',
                      color: (inviteStep === 1 && !inviteEmail.trim()) ? NEU.inkSoft : '#EED98A',
                      cursor: (inviteStep === 1 && !inviteEmail.trim()) ? 'default' : 'pointer',
                      transitionProperty: 'background-color, scale', transitionDuration: '150ms',
                      transitionTimingFunction: EASE,
                    }}
                    onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.scale = '0.96'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.scale = '1'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.scale = '1'; }}
                  >
                    NEXT
                  </button>
                ) : (
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="rounded-xl focus:outline-none"
                    style={{
                      minHeight: 44, padding: '0 20px', fontFamily: OUTFIT, fontSize: 13, fontWeight: 800,
                      letterSpacing: '0.05em', border: 'none',
                      backgroundColor: (inviting || !inviteEmail.trim()) ? '#DDD4C0' : '#1B3828',
                      color: (inviting || !inviteEmail.trim()) ? NEU.inkSoft : '#EED98A',
                      cursor: (inviting || !inviteEmail.trim()) ? 'default' : 'pointer',
                      transitionProperty: 'background-color, scale', transitionDuration: '150ms',
                      transitionTimingFunction: EASE,
                    }}
                    onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.scale = '0.96'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.scale = '1'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.scale = '1'; }}
                  >
                    {inviting ? 'SENDING…' : 'SEND INVITE'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
      {/* ── Member sheet ─────────────────────────────────────────────────────
          Everything that would otherwise crowd a node of the tree: the public
          listing switch, the public-facing role, page access, public-page order
          and removal. One member at a time, so the tree stays a tree. */}
      {memberSheetId && (() => {
        const org = organizers.find(o => o.id === memberSheetId);
        // The row can vanish underneath this sheet (a co-chair removed them, a
        // failed write re-read the truth). Close rather than render a ghost.
        if (!org) return null;
        // `organizers` is kept in sort_order order by loadOrganizers and by
        // handleMoveOrganizer's normalisation, so this index is the one
        // handleMoveOrganizer expects.
        const idx = organizers.findIndex(o => o.id === org.id);
        const name = org.profiles?.display_name ?? 'Unknown';
        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        const orgIsOwner = org.role === 'owner';
        const perms = org.permissions ?? {};
        const bundle = detectBundle(perms);
        const readOnlyMoney = financialsAreReadOnly(perms);
        const editable = canManageTeam && !orgIsOwner;
        const close = () => setMemberSheetId(null);

        const groupHeading = (text: string) => (
          <p className="font-bold text-[10px] mb-2" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, letterSpacing: '0.14em' }}>
            {text}
          </p>
        );

        return (
          <Portal>
            <div
              className="fixed inset-0 flex items-center justify-center px-4"
              style={{ zIndex: 130, backgroundColor: 'rgba(28,20,16,0.42)', backdropFilter: 'blur(3px)' }}
              onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`Manage ${name}`}
                className="w-full"
                style={{
                  maxWidth: 520, maxHeight: '86vh', overflowY: 'auto',
                  backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 24,
                  boxShadow: '0 26px 70px rgba(27,56,40,0.30)', padding: 24,
                }}
              >
                {/* Identity */}
                <div className="flex items-center gap-3.5">
                  {org.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={org.profiles.avatar_url}
                      alt={name}
                      className="rounded-full object-cover flex-shrink-0"
                      style={{ width: 52, height: 52, outline: '1px solid rgba(0, 0, 0, 0.1)', outlineOffset: -1 }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
                      style={{
                        width: 52, height: 52, fontFamily: OUTFIT, fontSize: 17,
                        backgroundColor: orgIsOwner ? 'rgba(182,135,31,0.16)' : 'rgba(27,56,40,0.10)',
                        color: orgIsOwner ? '#7A5A10' : '#1B3828',
                      }}
                    >
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-lg truncate" style={{ color: '#1C1410', fontFamily: OUTFIT, textWrap: 'balance' }}>
                      {name}
                      {orgIsOwner && <Crown size={15} className="inline-block ml-1.5 -mt-1" style={{ color: '#B6871F' }} aria-label="Owner" />}
                    </p>
                    <p className="text-xs truncate" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
                      {org.profiles?.email ?? ''}
                    </p>
                  </div>
                  <button
                    onClick={close}
                    aria-label="Close"
                    className="flex items-center justify-center rounded-full focus:outline-none flex-shrink-0"
                    style={{
                      width: 40, height: 40, color: NEU.inkSoft, background: 'transparent',
                      border: 'none', cursor: 'pointer',
                      transitionProperty: 'color, background-color', transitionDuration: '140ms',
                    }}
                    onMouseEnter={(e) => { const t = e.currentTarget as HTMLElement; t.style.color = '#1C1410'; t.style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
                    onMouseLeave={(e) => { const t = e.currentTarget as HTMLElement; t.style.color = NEU.inkSoft; t.style.backgroundColor = 'transparent'; }}
                  >
                    <X size={17} />
                  </button>
                </div>

                {/* ── Public page ─────────────────────────────────────────── */}
                <div className="mt-6 pt-5" style={{ borderTop: '1px solid #E4DAC4' }}>
                  {groupHeading('PUBLIC CONFERENCE PAGE')}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                        Show {name.split(' ')[0]} on the public page
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty', lineHeight: 1.5 }}>
                        Team members are listed publicly by default, with photo, name and role.
                      </p>
                    </div>
                    <span className="flex-shrink-0">
                      <PillToggle
                        value={org.show_on_public}
                        onChange={() => toggleOrganizerPublic(org.id)}
                        size="md"
                        disabled={!canManageTeam}
                      />
                    </span>
                  </div>

                  <label
                    htmlFor="member-public-title"
                    className="block font-semibold text-sm mt-4 mb-2"
                    style={{ color: '#1C1410', fontFamily: OUTFIT }}
                  >
                    Role they represent
                  </label>
                  <input
                    id="member-public-title"
                    type="text"
                    // Keyed on the member so switching rows re-seeds the field.
                    key={`title-${org.id}`}
                    defaultValue={org.public_title ?? ''}
                    placeholder="e.g. Secretary-General"
                    maxLength={80}
                    disabled={!canManageTeam}
                    aria-label={`Public role for ${name}`}
                    onFocus={fgInput}
                    onBlur={(e) => { bgInput(e); setOrganizerTitle(org.id, e.target.value); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                    style={{ ...inputStyle, width: '100%', opacity: canManageTeam ? 1 : 0.6 }}
                  />

                  {canManageTeam && organizers.length > 1 && (
                    <div className="flex items-center gap-2 mt-4">
                      <p className="text-xs flex-1" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                        Position {idx + 1} of {organizers.length} in the public listing order.
                      </p>
                      <button
                        onClick={() => handleMoveOrganizer(idx, -1)}
                        disabled={idx <= 0}
                        aria-label={`Move ${name} earlier on the public page`}
                        className="flex items-center justify-center rounded-xl focus:outline-none flex-shrink-0"
                        style={{
                          width: 40, height: 40, color: NEU.inkSoft, background: 'transparent',
                          border: '1.5px solid #DDD4C0',
                          cursor: idx <= 0 ? 'default' : 'pointer', opacity: idx <= 0 ? 0.35 : 1,
                          transitionProperty: 'color, border-color', transitionDuration: '140ms',
                        }}
                        onMouseEnter={(e) => { if (idx > 0) (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.inkSoft; }}
                      >
                        <ArrowUp size={15} strokeWidth={2.4} />
                      </button>
                      <button
                        onClick={() => handleMoveOrganizer(idx, 1)}
                        disabled={idx >= organizers.length - 1}
                        aria-label={`Move ${name} later on the public page`}
                        className="flex items-center justify-center rounded-xl focus:outline-none flex-shrink-0"
                        style={{
                          width: 40, height: 40, color: NEU.inkSoft, background: 'transparent',
                          border: '1.5px solid #DDD4C0',
                          cursor: idx >= organizers.length - 1 ? 'default' : 'pointer',
                          opacity: idx >= organizers.length - 1 ? 0.35 : 1,
                          transitionProperty: 'color, border-color', transitionDuration: '140ms',
                        }}
                        onMouseEnter={(e) => { if (idx < organizers.length - 1) (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.inkSoft; }}
                      >
                        <ArrowDown size={15} strokeWidth={2.4} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Privileges ──────────────────────────────────────────── */}
                <div className="mt-6 pt-5" style={{ borderTop: '1px solid #E4DAC4' }}>
                  {groupHeading('WHAT THEY CAN OPEN')}
                  {orgIsOwner ? (
                    <p className="text-sm" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty', lineHeight: 1.55 }}>
                      The owner opens every page and can do everything, including handing ownership
                      on. That is enforced by is_conference_owner() in the database and is not a
                      bundle anyone can pick from a menu.
                    </p>
                  ) : (
                    <>
                      {/* The bundle picker lives here now. It used to be a chip
                          on the card, back when the card was a permissions
                          summary; the card is a portrait now, and this is where
                          privileges are. */}
                      <div className="flex items-center flex-wrap gap-2 mb-3">
                        {editable ? (
                          <button
                            onClick={(e) => {
                              const el = e.currentTarget;
                              setBundleMenuFor(prev => (prev?.orgId === org.id ? null : { orgId: org.id, el }));
                            }}
                            aria-haspopup="menu"
                            aria-expanded={bundleMenuFor?.orgId === org.id}
                            className="flex items-center gap-1.5 focus:outline-none"
                            style={{
                              minHeight: 38, padding: '9px 14px', borderRadius: 999, fontFamily: OUTFIT,
                              fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
                              color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.09)',
                              border: '1.5px solid rgba(27,56,40,0.28)', cursor: 'pointer',
                              transitionProperty: 'background-color, scale',
                              transitionDuration: '140ms', transitionTimingFunction: EASE,
                            }}
                            onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.15)'; }}
                            onMouseLeave={(ev) => { const el = ev.currentTarget as HTMLElement; el.style.backgroundColor = 'rgba(27,56,40,0.09)'; el.style.scale = '1'; }}
                            onMouseDown={(ev) => { (ev.currentTarget as HTMLElement).style.scale = '0.96'; }}
                            onMouseUp={(ev) => { (ev.currentTarget as HTMLElement).style.scale = '1'; }}
                          >
                            {bundleLabel(bundle).toUpperCase()}
                            <ChevronDown size={13} strokeWidth={2.6} />
                          </button>
                        ) : (
                          <Pill tone="forest" size="sm">{bundleLabel(bundle)}</Pill>
                        )}
                        {readOnlyMoney && (
                          <Pill tone="gold" size="sm">Money read-only</Pill>
                        )}
                      </div>
                      <p className="text-sm mb-3" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty', lineHeight: 1.55 }}>
                        {BUNDLES.find(b => b.id === bundle)?.summary}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ORGANIZER_SECTIONS.map(s => {
                          const on = perms[s.key] === true;
                          const interactive = editable && bundle === 'custom';
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={interactive ? () => toggleOrgPermission(org.id, s.key) : undefined}
                              disabled={!interactive}
                              title={`${s.label}: ${on ? 'can open' : 'cannot open'}. ${s.blurb}`}
                              aria-pressed={on}
                              aria-label={`${s.label}: ${on ? 'granted' : 'not granted'}`}
                              className="flex items-center gap-1.5 focus:outline-none"
                              style={{
                                minHeight: 40, padding: '9px 12px', borderRadius: 999, fontFamily: OUTFIT,
                                fontSize: 12, fontWeight: 700,
                                color: on ? '#1B3828' : NEU.inkSoft,
                                backgroundColor: on ? 'rgba(27,56,40,0.10)' : 'transparent',
                                border: on ? '1.5px solid rgba(27,56,40,0.30)' : '1.5px dashed #D8CDB6',
                                opacity: on ? 1 : 0.75,
                                cursor: interactive ? 'pointer' : 'default',
                                transitionProperty: 'background-color, border-color, color, opacity, scale',
                                transitionDuration: '140ms', transitionTimingFunction: EASE,
                              }}
                              onMouseDown={interactive ? (e) => { (e.currentTarget as HTMLElement).style.scale = '0.96'; } : undefined}
                              onMouseUp={interactive ? (e) => { (e.currentTarget as HTMLElement).style.scale = '1'; } : undefined}
                              onMouseLeave={interactive ? (e) => { (e.currentTarget as HTMLElement).style.scale = '1'; } : undefined}
                            >
                              <Icon size={14} strokeWidth={2.2} />
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                      {!editable && (
                        <p className="text-xs mt-3" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                          Only a team manager can change these.
                        </p>
                      )}
                      {editable && bundle !== 'custom' && (
                        <p className="text-xs mt-3" style={{ color: NEU.inkSoft, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                          A bundle grants every page. Move them to Custom to pick pages individually.
                        </p>
                      )}

                      {/* The one capability with a read/write distinction. */}
                      {perms.financials === true && (
                        <button
                          type="button"
                          onClick={editable ? () => toggleFinancialsReadOnly(org.id) : undefined}
                          disabled={!editable}
                          title={readOnlyMoney
                            ? 'Financials are read-only for this member: they see fees, invoices and payouts but cannot change them. Enforced in the database.'
                            : 'This member can change financial details. Click to make financials read-only for them.'}
                          aria-pressed={readOnlyMoney}
                          className="flex items-center gap-1.5 mt-3 focus:outline-none"
                          style={{
                            minHeight: 40, padding: '9px 12px', borderRadius: 999, fontFamily: OUTFIT,
                            fontSize: 12, fontWeight: 700,
                            color: readOnlyMoney ? '#7A5A10' : NEU.inkSoft,
                            backgroundColor: readOnlyMoney ? 'rgba(182,135,31,0.14)' : 'transparent',
                            border: readOnlyMoney ? '1.5px solid rgba(182,135,31,0.42)' : '1.5px dashed #D8CDB6',
                            cursor: editable ? 'pointer' : 'default',
                            transitionProperty: 'background-color, border-color, color, scale',
                            transitionDuration: '140ms', transitionTimingFunction: EASE,
                          }}
                          onMouseDown={editable ? (e) => { (e.currentTarget as HTMLElement).style.scale = '0.96'; } : undefined}
                          onMouseUp={editable ? (e) => { (e.currentTarget as HTMLElement).style.scale = '1'; } : undefined}
                          onMouseLeave={editable ? (e) => { (e.currentTarget as HTMLElement).style.scale = '1'; } : undefined}
                        >
                          <Lock size={13} strokeWidth={2.2} />
                          {readOnlyMoney ? 'Money read-only' : 'Can change money'}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* ── Remove ──────────────────────────────────────────────── */}
                {canManageTeam && !orgIsOwner && (
                  <div className="mt-6 pt-5" style={{ borderTop: '1px solid #E4DAC4' }}>
                    <button
                      onClick={() => { close(); handleRemoveOrganizer(org.id); }}
                      className="flex items-center justify-center gap-2 w-full focus:outline-none"
                      style={{
                        minHeight: 44, borderRadius: 14, fontFamily: OUTFIT, fontSize: 13, fontWeight: 800,
                        letterSpacing: '0.04em', color: '#8B2020', background: 'transparent',
                        border: '1.5px solid rgba(139,32,32,0.30)', cursor: 'pointer',
                        transitionProperty: 'background-color, scale', transitionDuration: '140ms',
                        transitionTimingFunction: EASE,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.06)'; }}
                      onMouseLeave={(e) => { const t = e.currentTarget as HTMLElement; t.style.backgroundColor = 'transparent'; t.style.scale = '1'; }}
                      onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.scale = '0.96'; }}
                      onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.scale = '1'; }}
                    >
                      <Trash2 size={14} strokeWidth={2.3} />
                      REMOVE FROM TEAM
                    </button>
                  </div>
                )}

                {organizersError && (
                  <p
                    role="alert"
                    className="text-xs mt-4 rounded-lg px-3 py-2"
                    style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)', fontFamily: OUTFIT }}
                  >
                    {organizersError}
                  </p>
                )}
              </div>
            </div>
          </Portal>
        );
      })()}

      {confirmModal}
    </div>
  );
}
