'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  SlidersHorizontal, Building2, Users2, ShieldCheck, X, Lock, Copy,
} from 'lucide-react';
import { useManage, type Conference } from '@/app/manage/[slug]/layout';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@supabase/supabase-js';
import { UN_COUNTRIES } from '@/lib/countries';
import { Pill } from '@/app/account/accountUi';
import { useConfirmModal, ConfirmModal } from '@/components/ConfirmModal';
import Portal from '@/components/Portal';
import { LogoDisc } from '@/components/LogoDisc';
import { LogoCropModal } from '@/components/LogoCropModal';
import { DatePicker } from '@/components/DatePicker';
import { sendOrganizerInvite, listPendingOrganizerInvites, revokeOrganizerInvite, type OrganizerInviteRow } from '@/lib/organizerInvites';
import { activeFeePhase, type FeePhase } from '@/lib/finance';
import { currencyPickerGroups } from '@/lib/currencies';
import { normalizeSocialUrl } from '@/lib/socialLinks';
import { type FormBlock, normalizeBlocks } from '@/lib/customQuestions';
import QuestionBuilder from '@/components/QuestionBuilder';

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
  fee_gates_acceptance: boolean;
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

// What a delegate may express as preferences on the apply form. Persisted on
// conferences.delegate_preference_mode; read by the apply flow to decide which
// pickers (committees / countries / neither) to show.
const PREF_MODE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'committees_and_countries', label: 'COMMITTEES + COUNTRIES', desc: 'Delegates rank committee-and-country pairings — the fullest picture for allocation.' },
  { value: 'committees_only', label: 'COMMITTEES', desc: 'Delegates rank committees only; you assign the countries.' },
  { value: 'countries_only', label: 'COUNTRIES', desc: 'Delegates rank countries only; committees follow from the country.' },
  { value: 'none', label: 'NONE', desc: 'No preference step — you allocate everyone manually.' },
];

const SWAP_MODE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'off', label: 'OFF', desc: 'Only organizers manage allocations.' },
  { value: 'request', label: 'REQUEST', desc: 'Advisors and head delegates can request swaps; you approve them.' },
  { value: 'self_serve', label: 'SELF-SERVE', desc: "Advisors and head delegates can swap within their delegation; you're notified." },
];

// ── Constants & helpers ────────────────────────────────────────────────────

const ROLES = ['delegate', 'chair', 'head-delegate', 'faculty-advisor', 'observer'] as const;

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

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

// Standard failure copy for every verified-write save in this page: a write
// that returns an error OR affects zero rows (RLS silently filtered it, or
// the row vanished) is treated identically, never a silent false success.
function saveFailMessage(error?: { message: string } | null): string {
  return "Couldn't save, please refresh and try again." + (error?.message ? ' ' + error.message : '');
}

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

function PillToggle({ value, onChange, size = 'md' }: {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: 'md' | 'sm';
}) {
  const w = size === 'md' ? 40 : 32;
  const h = size === 'md' ? 22 : 18;
  const thumb = size === 'md' ? 18 : 14;
  const onLeft = size === 'md' ? 20 : 16;

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative flex-shrink-0 focus:outline-none"
      style={{
        width: `${w}px`, height: `${h}px`,
        borderRadius: '9999px',
        backgroundColor: value ? '#1B3828' : '#DDD4C0',
        transition: 'background-color 200ms ease',
        border: 'none', cursor: 'pointer',
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
  // applications for any missing/unknown value.
  const initialTab = ((): 'applications' | 'conference' | 'organizers' | 'privacy' => {
    const t = searchParams.get('tab') ?? searchParams.get('section');
    return t === 'conference' || t === 'organizers' || t === 'privacy' ? t : 'applications';
  })();
  const [activeTab, setActiveTab] = useState<'applications' | 'conference' | 'organizers' | 'privacy'>(initialTab);
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
  const [studentLevel, setStudentLevel] = useState<'school' | 'university' | 'both' | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [format, setFormat] = useState<'in-person' | 'online' | 'hybrid' | ''>('');
  const [expectedDelegates, setExpectedDelegates] = useState('');
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  // Minimum age (Applications tab)
  const [minAge, setMinAge] = useState('');
  const [minAgeSaved, setMinAgeSaved] = useState(false);
  const [minAgeError, setMinAgeError] = useState('');

  // Delegation allocation swaps (Applications tab)
  const [swapMode, setSwapMode] = useState('request');
  const [swapModeError, setSwapModeError] = useState('');

  // Delegate preference mode (Applications tab). Not part of the layout's
  // conference column allowlist, so it's loaded + saved directly here.
  const [prefMode, setPrefMode] = useState('committees_and_countries');
  const [prefModeSaving, setPrefModeSaving] = useState(false);
  const [prefModeError, setPrefModeError] = useState('');

  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [configVersion, setConfigVersion] = useState(0);
  const [roleConfigError, setRoleConfigError] = useState('');
  // Roles with at least one application already in the pipeline (submitted or
  // further along) — their existing questions are locked to protect answers
  // that have already been collected against them.
  const [lockedRoles, setLockedRoles] = useState<Set<string>>(new Set());
  const { confirm, modal: confirmModal } = useConfirmModal();
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('delegate');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteNotice, setInviteNotice] = useState('');
  // Consent-based invite flow, mirrors chair invites: a pending row + email,
  // accepted/declined by the invitee via /invites/organizer/[token].
  const [pendingInvites, setPendingInvites] = useState<OrganizerInviteRow[]>([]);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

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
  const detailsSnap = () => snap({ fullName, acronym, contactEmail, studentLevel, startDate, endDate, country, city, format, expectedDelegates });
  const visualSnap = () => snap({ description, instagramUrl, facebookUrl, tiktokUrl, whatsappUrl, websiteUrl });
  const minAgeSnap = () => snap({ minAge });

  // Stale-response guards: each loader bumps its counter at call start and
  // bails after every await if a newer call has started since.
  const roleSeq = useRef(0);
  const lockedRolesSeq = useRef(0);
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
  // submitted-or-further application gets its existing questions locked.
  const loadLockedRoles = useCallback(async () => {
    if (!conference) return;
    if (!session) return;
    const seq = ++lockedRolesSeq.current;
    const supabase = getAuthedClient(session.access_token);
    const results = await Promise.all(ROLES.map(async (role) => {
      const { count } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('conference_id', conference.id)
        .eq('role', role)
        .in('status', ['submitted', 'accepted', 'assigned', 'checked-in']);
      return { role, locked: (count ?? 0) > 0 };
    }));
    if (seq !== lockedRolesSeq.current) return;
    setLockedRoles(new Set(results.filter(r => r.locked).map(r => r.role)));
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
    if (data) setOrganizers(data as unknown as Organizer[]);
  }, [conference]);

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
      is_enabled: role === 'delegate' || role === 'chair',
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
    loadLockedRoles();
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
    setSwapMode(conference.allocation_swap_mode ?? 'request');
    setSwapModeError('');
    setFullName(conference.full_name ?? '');
    setAcronym(conference.acronym ?? '');
    setAcronymError('');
    setContactEmail(conference.contact_email ?? '');
    setStudentLevel((conference.student_level as 'school' | 'university' | 'both' | '') ?? '');
    setStartDate(conference.start_date ?? '');
    setEndDate(conference.end_date ?? '');
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
      country: conference.country ?? '', city: conference.city ?? '',
      format: (conference.format as 'in-person' | 'online' | 'hybrid' | '') ?? '',
      expectedDelegates: conference.expected_delegates != null ? String(conference.expected_delegates) : '',
    });
    visualBaseline.current = snap({
      description: conference.description ?? '', instagramUrl: conference.instagram_url ?? '',
      facebookUrl: conference.facebook_url ?? '', tiktokUrl: conference.tiktok_url ?? '',
      whatsappUrl: conference.whatsapp_url ?? '', websiteUrl: conference.website_url ?? '',
    });
    minAgeBaseline.current = snap({ minAge: conference.min_age != null ? String(conference.min_age) : '' });
  }, [conference?.id, loadRoleConfigs, loadLockedRoles, loadOrganizers, loadPendingInvites, loadLineage, loadPartners, loadIncomingPartnerClaims]);

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

  async function saveRoleConfig(role: string, updates: Partial<RoleConfig>) {
    if (!conference) return;
    if (!session) return;

    // Optimistic: patch local state immediately so the control reflects the
    // click at once, independent of any other save's in-flight DB round trip.
    const previous = roleConfigs;
    setRoleConfigs(prev => prev.map(rc => (rc.role === role ? { ...rc, ...updates } : rc)));
    setRoleConfigError('');

    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setRoleConfigs(previous);
      setRoleConfigError('Your session has expired, please refresh and sign in again.');
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
    }
  }

  // Patch one field of one fee phase and persist the whole jsonb array —
  // rides saveRoleConfig's optimistic-update-with-rollback.
  function updateFeePhase(role: string, phases: FeePhase[], idx: number, patch: Partial<FeePhase>) {
    void saveRoleConfig(role, { fee_phases: phases.map((p, i) => (i === idx ? { ...p, ...patch } : p)) });
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

  // delegate_preference_mode isn't in the layout's conference column allowlist,
  // so read it straight from the row when the conference loads.
  useEffect(() => {
    if (!conference || !session) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('conferences')
        .select('delegate_preference_mode')
        .eq('id', conference.id)
        .maybeSingle();
      if (cancelled) return;
      const mode = (data as { delegate_preference_mode: string } | null)?.delegate_preference_mode;
      if (mode) setPrefMode(mode);
    })();
    return () => { cancelled = true; };
  }, [conference?.id, session]);

  // Same verified-write pattern as saveSwapMode: control-busy, exact rollback
  // (local prefMode only flips after the DB write is confirmed).
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
      .from('conferences')
      .update({ delegate_preference_mode: mode })
      .eq('id', conference.id)
      .select('id');

    if (error || !data || data.length !== 1) {
      setPrefModeSaving(false);
      setPrefModeError(saveFailMessage(error));
      return;
    }
    setPrefMode(mode);
    setPrefModeSaving(false);
  }

  // ── Organizer actions ───────────────────────────────────────────────────

  // Consent-based, mirrors sendChairInvite: always goes through
  // create_organizer_invite, no direct conference_organizers insert. Works
  // whether or not the invitee already has a Gavelling account, and the RPC
  // itself rejects an email already on the team.
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
    });
    setInviting(false);
    if (!res.ok) {
      setInviteError(res.error ?? "Couldn't send that invite. Please try again.");
      return;
    }
    setInviteEmail('');
    setInviteNotice(res.existing
      ? `An invite for ${res.invitedEmail} was already pending, the original link still works.`
      : `Invite sent to ${res.invitedEmail}. They'll appear on the team once they accept.`);
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

  const SECTION_KEYS: { key: string; label: string }[] = [
    { key: 'committees', label: 'Committees' },
    { key: 'applications', label: 'Applications' },
    { key: 'import', label: 'Import' },
    { key: 'assignment', label: 'Assignment' },
    { key: 'documents', label: 'Documents' },
    { key: 'email_builder', label: 'Email' },
    { key: 'financials', label: 'Financials' },
    { key: 'job_board', label: 'Jobs' },
    { key: 'settings', label: 'Settings' },
  ];

  function toggleOrgPermission(orgId: string, current: Record<string, boolean> | undefined, key: string) {
    if (!session) return;
    const next = { ...(current ?? {}), [key]: !(current?.[key]) };
    // Optimistic: flip the pill instantly; persist in the background and
    // restore only this organizer's prior permissions if the write fails —
    // a silent zero-row update counts as a failure too.
    setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, permissions: next } : o));
    setOrganizersError('');
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, permissions: current } : o));
        setOrganizersError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase.from('conference_organizers').update({ permissions: next }).eq('id', orgId).select('id');
      if (error || !data || data.length !== 1) {
        setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, permissions: current } : o));
        setOrganizersError(saveFailMessage(error));
      }
    })();
  }

  function handleRemoveOrganizer(organizerId: string) {
    if (!session) return;
    const idx = organizers.findIndex(o => o.id === organizerId);
    if (idx === -1) return;
    const removed = organizers[idx];
    // Optimistic: drop the row instantly; re-insert it at its old position
    // (with an inline error) if the delete fails, including a silent
    // zero-row delete, which is treated as a failure too.
    setOrganizers(prev => prev.filter(o => o.id !== organizerId));
    setOrganizersError('');
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setOrganizers(prev => {
          const arr = [...prev];
          arr.splice(Math.min(idx, arr.length), 0, removed);
          return arr;
        });
        setOrganizersError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase.from('conference_organizers').delete().eq('id', organizerId).select('id');
      if (error || !data || data.length !== 1) {
        setOrganizers(prev => {
          const arr = [...prev];
          arr.splice(Math.min(idx, arr.length), 0, removed);
          return arr;
        });
        setOrganizersError(saveFailMessage(error));
      }
    })();
  }

  // Public-page curation (owner only, enforced by RLS as well as the UI gate).
  // A DB trigger recomputes conferences.display_secretariat on every write, so
  // a confirmed write is followed by a quiet conference re-fetch to pick that
  // up in place (no full-screen reload).
  function updateOrganizerPublic(orgId: string, updates: { public_title?: string | null; show_on_public?: boolean }) {
    if (!session) return;
    const target = organizers.find(o => o.id === orgId);
    if (!target) return;
    const prior: { public_title?: string | null; show_on_public?: boolean } = {};
    if ('public_title' in updates) prior.public_title = target.public_title;
    if ('show_on_public' in updates) prior.show_on_public = target.show_on_public;
    setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, ...updates } : o));
    setOrganizersError('');
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, ...prior } : o));
        setOrganizersError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase.from('conference_organizers').update(updates).eq('id', orgId).select('id');
      if (error || !data || data.length !== 1) {
        setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, ...prior } : o));
        setOrganizersError(saveFailMessage(error));
        return;
      }
      void refreshConferenceQuiet();
    })();
  }

  function handleMoveOrganizer(idx: number, dir: -1 | 1) {
    if (!session) return;
    const j = idx + dir;
    if (j < 0 || j >= organizers.length) return;
    const previous = organizers;
    const order = [...organizers];
    [order[idx], order[j]] = [order[j], order[idx]];
    // Optimistic: render the new order (with normalized sort_order values so
    // consecutive moves diff correctly) and persist in the background.
    setOrganizers(order.map((o, i) => ({ ...o, sort_order: i })));
    setOrganizersError('');
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setOrganizers(previous);
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
        setOrganizers(previous);
        setOrganizersError(saveFailMessage(failed.error));
        return;
      }
      if (toWrite.length > 0) void refreshConferenceQuiet();
    })();
  }

  // ── Privacy actions ─────────────────────────────────────────────────────

  function handlePublicToggle(next: boolean) {
    if (!conference || publicToggleSaving) return;
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
  const selectedRoleLocked = lockedRoles.has(selectedRole);
  const enabledRoles = ROLES.filter(r => roleConfigs.find(rc => rc.role === r)?.is_enabled);
  const otherRoles = ROLES.filter(r => r !== selectedRole);
  const [copyNotice, setCopyNotice] = useState('');

  function handleBlocksChange(next: FormBlock[]) {
    void saveRoleConfig(selectedRole, { custom_questions: next });
  }

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
    const trimmed = minAge.trim();
    let value: number | null = null;
    if (trimmed !== '') {
      const parsed = parseInt(trimmed, 10);
      if (isNaN(parsed) || parsed < 10 || parsed > 99) {
        setMinAgeError('Minimum age must be between 10 and 99, or left empty for no limit.');
        return;
      }
      value = parsed;
    }
    setMinAgeSaving(true);
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setMinAgeSaving(false);
      setMinAgeError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.from('conferences').update({ min_age: value }).eq('id', conference.id).select('id');
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
    const upperAcr = acronym.toUpperCase().trim();
    if (!upperAcr) {
      setAcronymError('Acronym is required.');
      return;
    }
    if (!upperAcr.includes('MUN')) {
      setAcronymError("Acronym must include 'MUN', e.g. TEIMUN, LIMUN, SMUNC.");
      return;
    }
    setAcronymError('');
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
      acronym: upperAcr,
      contact_email: contactEmail || null,
      student_level: studentLevel || null,
      start_date: startDate || null,
      end_date: endDate || null,
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
  }, [minAge, minAgeSaving, conference]);

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
  }, [fullName, acronym, contactEmail, studentLevel, startDate, endDate, country, city, format, expectedDelegates, detailsSaving, conference]);

  if (!conference) return null;

  // Alias kept for the render code below, which reads every conference field
  // through `view`. It's a direct pass-through now: no optimistic overlay —
  // `conference` only changes once refreshConferenceQuiet() confirms a write.
  const view: Conference = conference;

  // Applications can't be configured or opened until the conference has
  // chosen a payment method, even free conferences need one on file (they
  // just pick Manual and note it's free) so the /pay page and
  // PledgeInvoicingCard always have somewhere to point delegates.
  const applicationsGated = activeTab === 'applications' && !conference.payment_method;

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
    <div className="px-4 sm:px-6 md:px-10 py-8" style={{ maxWidth: '1080px' }}>
      {/* Header */}
      <p className="text-xs mb-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
        {view.acronym} / Settings
      </p>
      <h1 className="font-black text-2xl mb-7" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
        Settings
      </h1>

      {/* Rail + floating panel shell */}
      <div className="flex flex-col md:flex-row md:items-start" style={{ gap: '22px' }}>

        {/* ── Section rail (desktop: vertical glass rail; mobile: horizontal scroller) ── */}
        <nav
          aria-label="Settings sections"
          className="md:flex-shrink-0"
          style={{ width: '100%', maxWidth: '244px' }}
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
          style={{
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
          <div className="flex items-center gap-3 mb-6 pb-5" style={{ borderBottom: '1.5px solid rgba(216,205,182,0.75)' }}>
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

      {/* ── APPLICATIONS TAB — locked until a payment method is on file ── */}
      {applicationsGated && (
        <div className="flex flex-col items-center text-center" style={{ ...cardStyle, padding: '48px 32px' }}>
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
            Set up how your conference gets paid before you can configure and open applications. Even free conferences must choose a method, so if yours is free, pick Manual and note &quot;This conference is free.&quot;
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
      )}

      {/* ── APPLICATIONS TAB ── */}
      {activeTab === 'applications' && !applicationsGated && <div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Application Windows
        </p>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Configure which roles can apply, their fees, and application windows.
        </p>

        {roleConfigError && (
          <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif" }}>
            {roleConfigError}
          </p>
        )}

        {ROLES.map((role, idx) => {
          const config = roleConfigs.find(rc => rc.role === role);
          const enabled = config?.is_enabled ?? false;
          const isLast = idx === ROLES.length - 1;

          return (
            <div
              key={`${role}-${configVersion}`}
              style={{
                marginBottom: isLast ? 0 : '24px',
                paddingBottom: isLast ? 0 : '24px',
                borderBottom: isLast ? 'none' : '1px solid #F0EDE6',
              }}
            >
              {/* Role header */}
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  {roleLabel(role)}
                </span>
                <PillToggle
                  value={enabled}
                  onChange={(v) => saveRoleConfig(role, { is_enabled: v })}
                  size="md"
                />
              </div>

              {enabled && config && (
                <>
                  {/* Date + fee grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Opens</label>
                      <input
                        type="datetime-local"
                        defaultValue={toDatetimeLocal(config.applications_open_at)}
                        onFocus={fgInput}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#DDD4C0';
                          saveRoleConfig(role, { applications_open_at: e.target.value || null });
                        }}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Closes</label>
                      <input
                        type="datetime-local"
                        defaultValue={toDatetimeLocal(config.applications_close_at)}
                        onFocus={fgInput}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#DDD4C0';
                          saveRoleConfig(role, { applications_close_at: e.target.value || null });
                        }}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Max Accepted</label>
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
                    return (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                            Fee phases
                          </label>
                          <button
                            type="button"
                            onClick={() => saveRoleConfig(role, {
                              fee_phases: [...phases, { label: `Phase ${phases.length + 1}`, start_date: '', end_date: '', amount: config.fee_amount }],
                            })}
                            className="text-[11px] font-bold focus:outline-none hover:underline"
                            style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            + ADD PHASE
                          </button>
                        </div>
                        {phases.length === 0 ? (
                          <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.55 }}>
                            Optional: charge different amounts by date, e.g. an Early Bird rate. When no phase covers today, the flat fee above applies.
                          </p>
                        ) : (
                          <>
                            {phases.map((phase, pi) => {
                              const isActive = active !== null && phase === active;
                              return (
                                <div
                                  key={`${pi}-${phases.length}-${configVersion}`}
                                  className="grid gap-2 items-center mb-2 rounded-[10px] px-2.5 py-2"
                                  style={{
                                    gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.8fr) 24px',
                                    backgroundColor: isActive ? 'rgba(27,56,40,0.06)' : 'rgba(27,56,40,0.02)',
                                    border: isActive ? '1.5px solid rgba(27,56,40,0.35)' : '1px solid #F0EDE6',
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

                  {/* Acceptance */}
                  <div className="mt-4">
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      Acceptance
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
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      Payment
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

                  {/* Fee gates acceptance */}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                        Must be paid before acceptance
                      </label>
                      <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        Delegates can&apos;t be accepted until this fee is paid.
                      </p>
                    </div>
                    <PillToggle
                      value={config.fee_gates_acceptance ?? false}
                      onChange={(v) => saveRoleConfig(role, { fee_gates_acceptance: v })}
                      size="md"
                    />
                  </div>

                  {/* Resubmission */}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                        Allow resubmission
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
                </>
              )}
            </div>
          );
        })}
      </div>}

      {/* ── Delegate preference mode card ── */}
      {activeTab === 'applications' && !applicationsGated && <div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Delegate Preferences
        </p>
        <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Choose what delegates rank when they apply. The application form shows only the pickers you enable here.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PREF_MODE_OPTIONS.map(opt => {
            const active = prefMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => savePrefMode(opt.value)}
                disabled={prefModeSaving}
                className="py-2.5 px-3 rounded-[10px] font-bold text-xs focus:outline-none transition-all"
                style={{
                  backgroundColor: active ? '#1B3828' : 'transparent',
                  color: active ? '#EED98A' : '#1C1410',
                  border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.04em',
                  opacity: prefModeSaving ? 0.6 : 1,
                  cursor: prefModeSaving ? 'wait' : 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-2">
          {prefModeSaving && (
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
          )}
          <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            {PREF_MODE_OPTIONS.find(o => o.value === prefMode)?.desc}
          </p>
        </div>
        {prefModeError && (
          <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{prefModeError}</p>
        )}
      </div>}

      {/* ── Delegation allocation swaps card ── */}
      {activeTab === 'applications' && !applicationsGated && <div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Delegation Allocation Swaps
        </p>
        <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Control whether delegation leaders can trade committee allocations within their own delegation.
        </p>
        <div className="flex gap-2 items-center">
          {SWAP_MODE_OPTIONS.map(opt => {
            const active = swapMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => saveSwapMode(opt.value)}
                disabled={swapModeSaving}
                className="flex-1 py-2.5 rounded-[10px] font-bold text-sm focus:outline-none transition-all"
                style={{
                  backgroundColor: active ? '#1B3828' : 'transparent',
                  color: active ? '#EED98A' : '#1C1410',
                  border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.06em',
                  opacity: swapModeSaving ? 0.6 : 1,
                  cursor: swapModeSaving ? 'wait' : 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
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
      </div>}

      {/* ── VISUAL TAB ── */}
      {activeTab === 'conference' && (
        <div>
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
                  value={acronym.toUpperCase()}
                  onChange={(e) => { setAcronym(e.target.value); if (acronymError) setAcronymError(''); }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                  onBlur={(e) => {
                    const upper = e.target.value.toUpperCase().trim();
                    if (!upper) setAcronymError('Acronym is required.');
                    else if (!upper.includes('MUN')) setAcronymError("Acronym must include 'MUN', e.g. TEIMUN, LIMUN, SMUNC.");
                    else setAcronymError('');
                    e.currentTarget.style.borderColor = '#DDD4C0';
                  }}
                  placeholder="e.g. LIMUN"
                  style={inputStyle}
                />
                {acronymError && (
                  <p className="text-xs mt-1" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{acronymError}</p>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Contact email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="hello@yourmun.org"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                />
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

            <div className="flex gap-3 mb-4">
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

          {/* Registration fee pointer, fees are configured per role now, not at the conference level (columns stay in the DB, just unused by this UI). */}
          <div style={cardStyle}>
            <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Registration Fee</p>
            <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Fees are configured per role in the Applications tab.</p>
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
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            />
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

      {/* ── Minimum age card ── */}
      {activeTab === 'applications' && !applicationsGated && <div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Minimum Age
        </p>
        <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Applicants below this age cannot apply. Leave empty for no limit. Age is checked against the applicant&apos;s date of birth on the conference start date.
        </p>
        <div className="flex items-end gap-3">
          <div style={{ width: '140px' }}>
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
        </div>
        <AutoSaveStatus saving={minAgeSaving} saved={minAgeSaved} />
        {minAgeError && (
          <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{minAgeError}</p>
        )}
        {view.min_age != null && !minAgeError && (
          <p className="text-xs mt-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
            Delegates must be at least {view.min_age} years old at the start of your conference to apply.
          </p>
        )}
      </div>}

      {activeTab === 'applications' && !applicationsGated && <div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Custom Questions
        </p>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Add custom questions to application forms for specific roles.
        </p>

        {/* Role tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {enabledRoles.length === 0 ? (
            <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              Enable roles above to add custom questions.
            </p>
          ) : (
            enabledRoles.map(role => {
              const active = selectedRole === role;
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className="px-4 py-1.5 rounded-[10px] text-xs font-bold focus:outline-none transition-all"
                  style={{
                    backgroundColor: active ? '#1B3828' : 'transparent',
                    color: active ? '#EED98A' : '#7A6E5E',
                    border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '0.01em',
                  }}
                >
                  {roleLabel(role)}
                </button>
              );
            })
          )}
        </div>

        {enabledRoles.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <CopyFormMenu roles={otherRoles} onPick={handleCopyFormTo} />
              {copyNotice && (
                <p className="text-xs font-semibold" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
                  {copyNotice} ✓
                </p>
              )}
            </div>
            {selectedRoleLocked && (
              <p className="flex items-start gap-2 text-xs mb-3 rounded-xl px-3 py-2.5" style={{ color: '#7A6E5E', backgroundColor: 'rgba(154,138,120,0.1)', border: '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif" }}>
                <Lock size={13} className="flex-shrink-0 mt-0.5" />
                Applications are in — existing questions are locked to protect submitted answers; you can still add new ones.
              </p>
            )}
            <QuestionBuilder value={currentBlocks} onChange={handleBlocksChange} locked={selectedRoleLocked} />
          </>
        )}
      </div>}

      {activeTab === 'organizers' && <div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Organizing Team
        </p>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Add co-organizers who can manage this view.
          {isOwner && ' Members marked public are shown on your public page with photo, name and title.'}
        </p>

        {/* Members list */}
        <div className="flex flex-col mb-6">
          {organizers.length === 0 ? (
            <p className="text-sm py-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>No team members yet.</p>
          ) : (
            organizers.map((org, idx) => {
              const isLast = idx === organizers.length - 1;
              const name = org.profiles?.display_name ?? 'Unknown';
              const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              const orgIsOwner = org.role === 'owner';

              return (
                <div
                  key={org.id}
                  className="py-3"
                  style={{ borderBottom: isLast ? 'none' : '1px solid #F0EDE6' }}
                >
                <div className="flex items-center gap-3">
                  {org.profiles?.avatar_url ? (
                    <img
                      src={org.profiles.avatar_url}
                      alt={name}
                      className="rounded-full object-cover flex-shrink-0"
                      style={{ width: '36px', height: '36px' }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center rounded-full font-bold text-sm flex-shrink-0"
                      style={{ width: '36px', height: '36px', backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}
                    >
                      {initials}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{name}</p>
                    <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{org.profiles?.email ?? ''}</p>
                  </div>

                  <span className="flex-shrink-0">
                    <Pill tone={orgIsOwner ? 'gold' : 'forest'} size="sm">
                      {orgIsOwner ? 'Owner' : 'Organizer'}
                    </Pill>
                  </span>

                  {!orgIsOwner && (
                    <button
                      onClick={() => handleRemoveOrganizer(org.id)}
                      className="text-xs font-semibold focus:outline-none hover:underline flex-shrink-0"
                      style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}
                    >
                      REMOVE
                    </button>
                  )}
                </div>
                {isOwner && !orgIsOwner && (
                  <div className="flex flex-wrap gap-1.5 mt-2" style={{ marginLeft: 48 }}>
                    {SECTION_KEYS.map(s => {
                      const on = org.permissions?.[s.key] === true;
                      return (
                        <button
                          key={s.key}
                          onClick={() => toggleOrgPermission(org.id, org.permissions, s.key)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg focus:outline-none transition-colors"
                          style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.01em', border: on ? '1.5px solid rgba(27,56,40,0.32)' : '1.5px solid #DDD4C0', backgroundColor: on ? 'rgba(27,56,40,0.10)' : 'transparent', color: on ? '#1B3828' : '#9A8A78' }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {isOwner && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2" style={{ marginLeft: 48 }}>
                    <button
                      onClick={() => updateOrganizerPublic(org.id, { show_on_public: !org.show_on_public })}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg focus:outline-none transition-colors flex-shrink-0"
                      style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.01em', border: org.show_on_public ? '1.5px solid rgba(27,56,40,0.32)' : '1.5px solid #DDD4C0', backgroundColor: org.show_on_public ? 'rgba(27,56,40,0.10)' : 'transparent', color: org.show_on_public ? '#1B3828' : '#9A8A78' }}
                    >
                      {org.show_on_public ? 'On public page' : 'Show on public page'}
                    </button>
                    {org.show_on_public && (
                      <>
                        <input
                          type="text"
                          defaultValue={org.public_title ?? ''}
                          placeholder="e.g. Secretary-General"
                          onFocus={fgInput}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#DDD4C0';
                            const next = e.target.value.trim() || null;
                            if (next !== (org.public_title ?? null)) updateOrganizerPublic(org.id, { public_title: next });
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                          style={{ ...inputStyle, width: '190px', padding: '5px 10px', fontSize: '12px' }}
                        />
                        <div className="flex items-center flex-shrink-0">
                          <button
                            onClick={() => handleMoveOrganizer(idx, -1)}
                            disabled={idx === 0}
                            aria-label={`Move ${name} up`}
                            className="text-xs focus:outline-none px-1 transition-colors"
                            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", background: 'transparent', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                            onMouseEnter={(e) => { if (idx !== 0) (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleMoveOrganizer(idx, 1)}
                            disabled={idx === organizers.length - 1}
                            aria-label={`Move ${name} down`}
                            className="text-xs focus:outline-none px-1 transition-colors"
                            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", background: 'transparent', border: 'none', cursor: idx === organizers.length - 1 ? 'default' : 'pointer', opacity: idx === organizers.length - 1 ? 0.3 : 1 }}
                            onMouseEnter={(e) => { if (idx !== organizers.length - 1) (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                          >
                            ▼
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                </div>
              );
            })
          )}
        </div>

        {/* Pending invites, sent but not yet accepted/declined. Declined and
            revoked invites never appear here (listPendingOrganizerInvites
            filters status='pending'), and there's no permissions row: those
            are configured once the invite is accepted and a real
            conference_organizers row exists. */}
        {pendingInvites.length > 0 && (
          <div className="mb-6">
            <p className="font-bold text-[10px] mb-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.14em' }}>
              PENDING INVITES
            </p>
            <div className="flex flex-col">
              {pendingInvites.map((inv, idx) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 py-2.5"
                  style={{ borderBottom: idx === pendingInvites.length - 1 ? 'none' : '1px solid #F0EDE6' }}
                >
                  <div
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ width: '36px', height: '36px', backgroundColor: 'rgba(182,135,31,0.10)', border: '1.5px dashed rgba(182,135,31,0.45)' }}
                  >
                    <Users2 size={15} style={{ color: '#B6871F' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{inv.email}</p>
                    <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      Invited {new Date(inv.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: "'Outfit', sans-serif", backgroundColor: 'rgba(182,135,31,0.18)', color: '#8A6614' }}
                  >
                    INVITED
                  </span>
                  <button
                    onClick={() => handleRevokeInvite(inv)}
                    disabled={revokingInviteId === inv.id}
                    title="Revoke invite"
                    aria-label={`Revoke invite to ${inv.email}`}
                    className="focus:outline-none flex-shrink-0"
                    style={{ color: '#9A8A78', lineHeight: 0, opacity: revokingInviteId === inv.id ? 0.5 : 1 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invite row */}
        <div>
          <label className="block font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Invite by email
          </label>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); setInviteNotice(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
              placeholder="colleague@example.com"
              style={{ ...inputStyle, flex: 1 }}
              onFocus={fgInput}
              onBlur={bgInput}
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors flex-shrink-0"
              style={{
                backgroundColor: (inviting || !inviteEmail.trim()) ? '#DDD4C0' : '#1B3828',
                color: (inviting || !inviteEmail.trim()) ? '#9A8A78' : '#EED98A',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '0.06em',
              }}
              onMouseEnter={(e) => { if (!inviting && inviteEmail.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { if (!inviting && inviteEmail.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {inviting ? 'INVITING...' : 'INVITE'}
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            They&apos;ll get an email with an invite link. It works whether or not they already have a Gavelling account, and they&apos;ll join the team once they accept.
          </p>
          {inviteError && (
            <p
              className="text-xs mt-2 rounded-lg px-3 py-2"
              style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)', fontFamily: "'Outfit', sans-serif" }}
            >
              {inviteError}
            </p>
          )}
          {inviteNotice && (
            <p className="text-xs mt-2" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{inviteNotice}</p>
          )}
        </div>
      </div>}

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
            <PillToggle value={view.is_public} onChange={publicToggleSaving ? () => {} : handlePublicToggle} size="md" />
          </span>
        </div>

        <p className="text-sm mt-3" style={{ color: view.is_public ? '#1B3828' : '#B8844A', fontFamily: "'Outfit', sans-serif" }}>
          {view.is_public
            ? 'Your conference is publicly listed on Gavelling.'
            : 'Your conference is private. Only people with the direct link can find it.'}
        </p>
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

      {confirmModal}
    </div>
  );
}
