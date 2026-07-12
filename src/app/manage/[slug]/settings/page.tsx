'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  SlidersHorizontal, Building2, Users2, ShieldCheck,
} from 'lucide-react';
import { useManage, type Conference } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@supabase/supabase-js';
import { UN_COUNTRIES } from '@/lib/countries';
import { Pill } from '@/app/account/accountUi';
import { useConfirmModal } from '@/components/ConfirmModal';
import { LogoDisc } from '@/components/LogoDisc';
import { LogoCropModal } from '@/components/LogoCropModal';

// ── Types ──────────────────────────────────────────────────────────────────

interface CustomQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea';
  required: boolean;
}

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
  custom_questions: CustomQuestion[];
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

const SWAP_MODE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'off', label: 'OFF', desc: 'Only organizers manage allocations.' },
  { value: 'request', label: 'REQUEST', desc: 'Advisors and head delegates can request swaps; you approve them.' },
  { value: 'self_serve', label: 'SELF-SERVE', desc: "Advisors and head delegates can swap within their delegation; you're notified." },
];

// ── Constants & helpers ────────────────────────────────────────────────────

const ROLES = ['delegate', 'chair', 'head-delegate', 'faculty-advisor', 'observer'] as const;

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

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
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

// ── QuestionModal ──────────────────────────────────────────────────────────

function QuestionModal({ existing, onSave, onClose }: {
  existing: CustomQuestion | null;
  onSave: (q: CustomQuestion) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? '');
  const [type, setType] = useState<'text' | 'textarea'>(existing?.type ?? 'text');
  const [required, setRequired] = useState(existing?.required ?? false);

  function handleSave() {
    if (!label.trim()) return;
    onSave({ id: existing?.id ?? crypto.randomUUID(), label: label.trim(), type, required });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-black text-lg mb-5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          {existing ? 'Edit Question' : 'Add Question'}
        </h2>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Question Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Why do you want to attend this conference?"
            style={inputStyle}
            onFocus={fgInput}
            onBlur={bgInput}
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Type
          </label>
          <div className="flex gap-2">
            {(['text', 'textarea'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="flex-1 py-2.5 rounded-[10px] font-bold text-sm focus:outline-none transition-all"
                style={{
                  backgroundColor: type === t ? '#1B3828' : 'transparent',
                  color: type === t ? '#EED98A' : '#1C1410',
                  border: type === t ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.06em',
                }}
              >
                {t === 'text' ? 'TEXT' : 'TEXTAREA'}
              </button>
            ))}
          </div>
          <p className="text-xs mt-1.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            {type === 'text' ? 'Single line answer' : 'Multi-line answer'}
          </p>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <input
            type="checkbox"
            id="q-required"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
            style={{ accentColor: '#1B3828' }}
          />
          <label htmlFor="q-required" className="text-sm font-medium cursor-pointer" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Required question
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: label.trim() ? '#1B3828' : '#DDD4C0',
              color: label.trim() ? '#EED98A' : '#9A8A78',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.06em',
            }}
          >
            {existing ? 'SAVE' : 'ADD QUESTION'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Settings page ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { conference, refreshConference } = useManage();
  const { user, session } = useAuth();
  const [activeTab, setActiveTab] = useState<'applications' | 'conference' | 'organizers' | 'privacy'>('applications');
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
  // Logo picked but not yet uploaded — the drag-to-fit crop modal is open.
  const [logoCropFile, setLogoCropFile] = useState<File | null>(null);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeCurrency, setFeeCurrency] = useState('GBP');
  const [feeSaved, setFeeSaved] = useState(false);
  const [feeError, setFeeError] = useState('');

  // Conference details (identity + logistics — mirrors the creation form)
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

  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [configVersion, setConfigVersion] = useState(0);
  const [roleConfigError, setRoleConfigError] = useState('');
  const { confirm, modal: confirmModal } = useConfirmModal();
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('delegate');
  const [questionModal, setQuestionModal] = useState<{ open: boolean; existing: CustomQuestion | null }>({ open: false, existing: null });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);

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

  // ── Optimistic conference overlay ───────────────────────────────────────
  // The manage layout's refreshConference() flips a full-screen loading flag,
  // which unmounts this entire page (the "page reloads" jank). We therefore
  // never call it mid-session: conference-row writes patch this local overlay
  // for instant rendering, and the layout context is refreshed once — on
  // unmount — if anything changed, so other manage pages catch up silently.
  const [confPatch, setConfPatch] = useState<Partial<Conference>>({});
  const confDirtyRef = useRef(false);
  const refreshRef = useRef(refreshConference);
  useEffect(() => { refreshRef.current = refreshConference; });
  useEffect(() => () => { if (confDirtyRef.current) void refreshRef.current(); }, []);
  // If fresh context data ever arrives while mounted, it already contains our
  // committed writes — drop the overlay so it can't mask newer server state.
  useEffect(() => { setConfPatch({}); }, [conference]);

  function patchConf(updates: Partial<Conference>) {
    setConfPatch(p => ({ ...p, ...updates }));
    confDirtyRef.current = true;
  }
  // Exact prior (merged) values for the given keys — captured before an
  // optimistic patch so a failed write can restore precisely what was shown.
  function priorConfValues(keys: (keyof Conference)[]): Partial<Conference> {
    if (!conference) return {};
    const merged = { ...conference, ...confPatch } as Conference;
    const out: Partial<Conference> = {};
    for (const k of keys) (out as Record<string, unknown>)[k] = merged[k];
    return out;
  }

  // Stale-response guards: each loader bumps its counter at call start and
  // bails after every await if a newer call has started since.
  const roleSeq = useRef(0);
  const orgSeq = useRef(0);
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
    loadOrganizers();
    loadLineage();
    loadPartners();
    loadIncomingPartnerClaims();
    setDescription(conference.description ?? '');
    setInstagramUrl(conference.instagram_url ?? '');
    setFacebookUrl(conference.facebook_url ?? '');
    setTiktokUrl(conference.tiktok_url ?? '');
    setWhatsappUrl(conference.whatsapp_url ?? '');
    setWebsiteUrl(conference.website_url ?? '');
    setFeeAmount(conference.fee_amount != null ? String(conference.fee_amount) : '');
    setFeeCurrency(conference.fee_currency ?? 'GBP');
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
  }, [conference?.id, loadRoleConfigs, loadOrganizers, loadLineage, loadPartners, loadIncomingPartnerClaims]);

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
    const supabase = getAuthedClient(session.access_token);

    // Optimistic: patch local state immediately so the control reflects the
    // click at once, independent of any other save's in-flight DB round trip.
    const previous = roleConfigs;
    setRoleConfigs(prev => prev.map(rc => (rc.role === role ? { ...rc, ...updates } : rc)));
    setRoleConfigError('');

    const { data, error } = await supabase
      .from('application_role_configs')
      .update(updates)
      .eq('conference_id', conference.id)
      .eq('role', role)
      .select('id');

    if (error || !data || data.length === 0) {
      // Revert the optimistic patch and surface the failure — a silent
      // no-op update (0 rows matched, no error) is treated as a failure too.
      setRoleConfigs(previous);
      setRoleConfigError(error ? error.message : "Couldn't save — that role config wasn't found.");
    }
  }

  // Same optimistic + error-capture pattern as saveRoleConfig, for the
  // single conference-level allocation_swap_mode field.
  async function saveSwapMode(mode: string) {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);

    const previous = swapMode;
    setSwapMode(mode);
    setSwapModeError('');

    const { data, error } = await supabase
      .from('conferences')
      .update({ allocation_swap_mode: mode })
      .eq('id', conference.id)
      .select('id');

    if (error || !data || data.length === 0) {
      setSwapMode(previous);
      setSwapModeError(error ? error.message : "Couldn't save — please try again.");
      return;
    }
    // Keep the local overlay in sync instead of refreshConference(), which
    // would unmount the whole page behind the layout's loading spinner.
    patchConf({ allocation_swap_mode: mode });
  }

  // ── Organizer actions ───────────────────────────────────────────────────

  async function handleInvite() {
    if (!conference || !session || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    const supabase = getAuthedClient(session.access_token);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('email', inviteEmail.trim().toLowerCase())
      .maybeSingle();

    if (!profile) {
      setInviteError("No Gavelling account found with that email. They need to create an account first.");
      setInviting(false);
      return;
    }

    const alreadyMember = organizers.some(o => o.user_id === (profile as { id: string }).id);
    if (alreadyMember) {
      setInviteError("This person is already on the team.");
      setInviting(false);
      return;
    }

    // The insert stays awaited: the server mints the row id, which the
    // remove/permission controls need. Only the INVITE button is busy.
    const { data: inserted, error: insertError } = await supabase.from('conference_organizers').insert({
      conference_id: conference.id,
      user_id: (profile as { id: string }).id,
      role: 'organizer',
    }).select('id').single();

    if (insertError || !inserted) {
      setInviteError(insertError?.message ?? "Couldn't add this person. Please try again.");
      setInviting(false);
      return;
    }

    // Show the new member instantly with what we already know; a silent
    // background reload reconciles avatar and canonical ordering.
    const prof = profile as { id: string; display_name: string };
    setOrganizers(prev => [...prev, {
      id: (inserted as { id: string }).id,
      role: 'organizer',
      user_id: prof.id,
      permissions: {},
      public_title: null,
      show_on_public: false,
      sort_order: 0,
      profiles: { display_name: prof.display_name, email: inviteEmail.trim().toLowerCase(), avatar_url: null },
    }]);
    setInviteEmail('');
    setInviting(false);
    void loadOrganizers();
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
    // restore only this organizer's prior permissions if the write fails.
    setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, permissions: next } : o));
    setOrganizersError('');
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const { error } = await supabase.from('conference_organizers').update({ permissions: next }).eq('id', orgId);
      if (error) {
        setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, permissions: current } : o));
        setOrganizersError(error.message);
      }
    })();
  }

  function handleRemoveOrganizer(organizerId: string) {
    if (!session) return;
    const idx = organizers.findIndex(o => o.id === organizerId);
    if (idx === -1) return;
    const removed = organizers[idx];
    // Optimistic: drop the row instantly; re-insert it at its old position
    // (with an inline error) if the delete fails.
    setOrganizers(prev => prev.filter(o => o.id !== organizerId));
    setOrganizersError('');
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const { error } = await supabase.from('conference_organizers').delete().eq('id', organizerId);
      if (error) {
        setOrganizers(prev => {
          const arr = [...prev];
          arr.splice(Math.min(idx, arr.length), 0, removed);
          return arr;
        });
        setOrganizersError(error.message);
      }
    })();
  }

  // Public-page curation (owner only — enforced by RLS as well as the UI gate).
  // The DB trigger recomputes conferences.display_secretariat on every write,
  // so we mark the conference overlay dirty for the on-unmount refresh.
  function updateOrganizerPublic(orgId: string, updates: { public_title?: string | null; show_on_public?: boolean }) {
    if (!session) return;
    const target = organizers.find(o => o.id === orgId);
    if (!target) return;
    const prior: { public_title?: string | null; show_on_public?: boolean } = {};
    if ('public_title' in updates) prior.public_title = target.public_title;
    if ('show_on_public' in updates) prior.show_on_public = target.show_on_public;
    setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, ...updates } : o));
    setOrganizersError('');
    confDirtyRef.current = true;
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const { error } = await supabase.from('conference_organizers').update(updates).eq('id', orgId);
      if (error) {
        setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, ...prior } : o));
        setOrganizersError(error.message);
      }
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
    confDirtyRef.current = true;
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      // Persist the displayed index as sort_order for every row that drifted —
      // a plain neighbour swap is a no-op while rows still share the default 0.
      const results = await Promise.all(
        order
          .map((o, i) => (o.sort_order === i ? null : supabase.from('conference_organizers').update({ sort_order: i }).eq('id', o.id)))
          .filter((p): p is NonNullable<typeof p> => p !== null)
      );
      const failed = results.find(r => r.error);
      if (failed?.error) {
        setOrganizers(previous);
        setOrganizersError(failed.error.message);
      }
    })();
  }

  // ── Privacy actions ─────────────────────────────────────────────────────

  function handlePublicToggle(next: boolean) {
    if (!conference) return;
    if (!session) return;
    // Optimistic: flip the pill instantly via the overlay; roll only these
    // two fields back (with an inline error) if the write fails.
    const prior = priorConfValues(['is_public', 'status']);
    patchConf({ is_public: next, status: next ? 'public' : 'private' });
    setPrivacyError('');
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const { error } = await supabase.from('conferences').update({
        is_public: next,
        status: next ? 'public' : 'private',
      }).eq('id', conference.id);
      if (error) {
        setConfPatch(p => ({ ...p, ...prior }));
        setPrivacyError(error.message);
      }
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
    if (!session) return;
    // The write stays awaited: navigating away must depend on it succeeding.
    // Only the ARCHIVE button is busy; no refreshConference (we leave the
    // manage shell entirely on success).
    setArchiving(true);
    setPrivacyError('');
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('conferences').update({
      status: 'archived',
      is_public: false,
    }).eq('id', conference.id);
    if (error) {
      setPrivacyError(error.message);
      setArchiving(false);
      return;
    }
    router.push('/conferences/organise');
  }

  // ── Lineage actions ─────────────────────────────────────────────────────

  const isOwner = organizers.some(o => o.user_id === user?.id && o.role === 'owner');

  function handleClaimDecision(successorId: string, approve: boolean) {
    if (!session) return;
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
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
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
    if (!conference || !session) return;
    const { confirmed } = await confirm({
      title: 'Withdraw the previous-edition claim?',
      body: 'The link (and any approval) will be removed.',
      confirmLabel: 'Withdraw',
      danger: true,
    });
    if (!confirmed) return;
    setLineageError('');
    // Optimistic: the predecessor card disappears instantly via the overlay
    // (mirroring the DB trigger that resets predecessor_approved); a failed
    // write restores the card and the summary exactly as they were.
    const prior = priorConfValues(['predecessor_conference_id', 'predecessor_approved']);
    const priorInfo = predecessorInfo;
    patchConf({ predecessor_conference_id: null, predecessor_approved: false });
    setPredecessorInfo(null);
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      // Only clear the id — predecessor_approved is reset by the DB trigger.
      const { error } = await supabase
        .from('conferences')
        .update({ predecessor_conference_id: null })
        .eq('id', conference.id);
      if (error) {
        setConfPatch(p => ({ ...p, ...prior }));
        setPredecessorInfo(priorInfo);
        setLineageError(error.message);
      }
    })();
  }

  // ── Partner conference actions ──────────────────────────────────────────

  function handleAddPartner(conf: PartnerConf) {
    if (!conference || !session) return;
    // Optimistic with a temp id (house pattern — see motions in AGENTS.md):
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
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
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
    // A just-added row is still waiting for its real UUID — skip reorders
    // until it lands (moments later) so we never write against a temp id.
    if (partners.some(p => p.id.startsWith('temp-'))) return;
    const previous = partners;
    const order = [...partners];
    [order[idx], order[j]] = [order[j], order[idx]];
    setPartners(order.map((p, i) => ({ ...p, sort_order: i })));
    setPartnerError('');
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const results = await Promise.all(
        order
          .map((p, i) => (p.sort_order === i ? null : supabase.from('conference_partners').update({ sort_order: i }).eq('id', p.id)))
          .filter((p): p is NonNullable<typeof p> => p !== null)
      );
      const failed = results.find(r => r.error);
      if (failed?.error) {
        setPartners(previous);
        setPartnerError(failed.error.message);
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
    // the delete fails.
    setPartners(prev => prev.filter(p => p.id !== link.id));
    setPartnerError('');
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const { error } = await supabase.from('conference_partners').delete().eq('id', link.id);
      if (error) {
        setPartners(prev => {
          const arr = [...prev];
          arr.splice(Math.min(idx, arr.length), 0, link);
          return arr;
        });
        setPartnerError(error.message);
      }
    })();
  }

  function handlePartnerClaimDecision(linkId: string, approve: boolean) {
    if (!session) return;
    if (partnerBusy === linkId) return;
    const previousIncoming = incomingPartnerClaims;
    setPartnerBusy(linkId);
    setPartnerError('');
    // Optimistic: the request row disappears instantly; silent (stale-guarded)
    // refetches afterwards pick up any server-side effects of the RPC.
    setIncomingPartnerClaims(prev => prev.filter(c => c.link_id !== linkId));
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
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
  const currentQuestions: CustomQuestion[] = selectedConfig?.custom_questions ?? [];
  const enabledRoles = ROLES.filter(r => roleConfigs.find(rc => rc.role === r)?.is_enabled);

  function handleSaveQuestion(q: CustomQuestion) {
    const updated = questionModal.existing
      ? currentQuestions.map(eq => eq.id === q.id ? q : eq)
      : [...currentQuestions, q];
    // saveRoleConfig patches local state synchronously (optimistic with its
    // own rollback + inline error) — close the modal immediately.
    void saveRoleConfig(selectedRole, { custom_questions: updated });
    setQuestionModal({ open: false, existing: null });
  }

  function handleDeleteQuestion(id: string) {
    void saveRoleConfig(selectedRole, { custom_questions: currentQuestions.filter(q => q.id !== id) });
  }

  async function handleBannerUpload(file: File) {
    if (!session || !conference) return;
    if (file.size > 5 * 1024 * 1024) { alert('Banner must be under 5MB.'); return; }
    setBannerUploading(true);
    setBannerError('');
    const supabase = getAuthedClient(session.access_token);
    const ext = file.name.split('.').pop();
    const path = 'banners/' + conference.id + '-' + Date.now() + '.' + ext;
    // The storage upload stays awaited — the server produces the public URL
    // we must display — but only this card shows the busy state.
    const { error } = await supabase.storage.from('conference-assets').upload(path, file, { contentType: file.type, upsert: true });
    if (error) { alert('Upload failed: ' + error.message); setBannerUploading(false); return; }
    const { data: urlData } = supabase.storage.from('conference-assets').getPublicUrl(path);
    // Optimistic from here: show the new banner instantly, persist the row
    // in the background, restore the previous banner if the write fails.
    const prior = priorConfValues(['banner_url']);
    patchConf({ banner_url: urlData.publicUrl });
    setBannerUploading(false);
    void (async () => {
      const { error: writeError } = await supabase.from('conferences').update({ banner_url: urlData.publicUrl }).eq('id', conference.id);
      if (writeError) {
        setConfPatch(p => ({ ...p, ...prior }));
        setBannerError("Couldn't save the banner: " + writeError.message);
      }
    })();
  }

  // Preset banner selection — same authed-client update path as the upload,
  // just pointing banner_url at a bundled /banners/preset-N.jpg instead.
  function handleBannerPreset(path: string) {
    if (!session || !conference || bannerUploading) return;
    const currentBanner = confPatch.banner_url !== undefined ? confPatch.banner_url : conference.banner_url;
    if (currentBanner === path) return;
    // Optimistic: highlight the preset instantly; roll back on failure.
    setBannerError('');
    patchConf({ banner_url: path });
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const { error } = await supabase.from('conferences').update({ banner_url: path }).eq('id', conference.id);
      if (error) {
        setConfPatch(p => ({ ...p, banner_url: currentBanner }));
        setBannerError('Could not set preset: ' + error.message);
      }
    })();
  }

  async function handleLogoUpload(file: File) {
    if (!session || !conference) return;
    if (file.size > 5 * 1024 * 1024) { alert('Logo must be under 5MB.'); return; }
    setLogoUploading(true);
    setLogoError('');
    const supabase = getAuthedClient(session.access_token);
    const ext = file.name.split('.').pop();
    const path = 'logos/' + conference.id + '-' + Date.now() + '.' + ext;
    // Storage upload awaited (server mints the URL); busy state scoped to
    // the logo card only. The row write is optimistic with rollback.
    const { error } = await supabase.storage.from('conference-assets').upload(path, file, { contentType: file.type, upsert: true });
    if (error) { alert('Upload failed: ' + error.message); setLogoUploading(false); return; }
    const { data: urlData } = supabase.storage.from('conference-assets').getPublicUrl(path);
    const prior = priorConfValues(['logo_url']);
    patchConf({ logo_url: urlData.publicUrl });
    setLogoUploading(false);
    void (async () => {
      const { error: writeError } = await supabase.from('conferences').update({ logo_url: urlData.publicUrl }).eq('id', conference.id);
      if (writeError) {
        setConfPatch(p => ({ ...p, ...prior }));
        setLogoError("Couldn't save the logo: " + writeError.message);
      }
    })();
  }

  function handleSaveFee() {
    if (!session || !conference || feeSaved) return;
    setFeeError('');
    const amount = parseFloat(feeAmount) || 0;
    // Optimistic: flash SAVED instantly (the flash doubles as the re-click
    // guard), persist in the background, and roll only these two overlay
    // fields back — with an inline error — if the write fails. Never
    // refreshConference() mid-session: the overlay renders the new value.
    const prior = priorConfValues(['fee_amount', 'fee_currency']);
    patchConf({ fee_amount: amount, fee_currency: feeCurrency });
    setFeeSaved(true);
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const { error } = await supabase.from('conferences').update({
        fee_amount: amount,
        fee_currency: feeCurrency,
      }).eq('id', conference.id);
      if (error) {
        setConfPatch(p => ({ ...p, ...prior }));
        setFeeSaved(false);
        setFeeError("Couldn't save the fee: " + error.message);
        return;
      }
      setTimeout(() => setFeeSaved(false), 2500);
    })();
  }

  function handleSaveMinAge() {
    if (!session || !conference || minAgeSaved) return;
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
    // Validation passed — optimistic from here: the overlay updates the
    // caption instantly, the write runs in the background, and a failure
    // restores exactly the prior min_age with an inline error.
    const prior = priorConfValues(['min_age']);
    patchConf({ min_age: value });
    setMinAgeSaved(true);
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const { error } = await supabase.from('conferences').update({ min_age: value }).eq('id', conference.id);
      if (error) {
        setConfPatch(p => ({ ...p, ...prior }));
        setMinAgeSaved(false);
        setMinAgeError('Could not save the minimum age. Please try again.');
        return;
      }
      setTimeout(() => setMinAgeSaved(false), 2500);
    })();
  }

  function handleSaveVisual() {
    if (!session || !conference || visualSaved) return;
    setVisualError('');
    const updates = {
      description: description || null,
      instagram_url: instagramUrl || null,
      facebook_url: facebookUrl || null,
      tiktok_url: tiktokUrl || null,
      whatsapp_url: whatsappUrl || null,
      website_url: websiteUrl || null,
    };
    // Optimistic: SAVED flashes instantly, the row write runs in the
    // background. On failure the overlay rolls back to the exact prior
    // values while the inputs keep the user's edits for a retry.
    const prior = priorConfValues(['description', 'instagram_url', 'facebook_url', 'tiktok_url', 'whatsapp_url', 'website_url']);
    patchConf(updates);
    setVisualSaved(true);
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const { error } = await supabase.from('conferences').update(updates).eq('id', conference.id);
      if (error) {
        setConfPatch(p => ({ ...p, ...prior }));
        setVisualSaved(false);
        setVisualError("Couldn't save: " + error.message + ' — your edits are still here, try again.');
        return;
      }
      setTimeout(() => setVisualSaved(false), 2500);
    })();
  }

  function handleSaveDetails() {
    if (!session || !conference || detailsSaved) return;
    const upperAcr = acronym.toUpperCase().trim();
    if (!upperAcr) {
      setAcronymError('Acronym is required.');
      return;
    }
    if (!upperAcr.includes('MUN')) {
      setAcronymError("Acronym must include 'MUN' — e.g. TEIMUN, LIMUN, SMUNC.");
      return;
    }
    setAcronymError('');
    setDetailsError('');
    const parsedDelegates = parseInt(expectedDelegates, 10);
    // Optimistic: capture the exact merged prior values for every field this
    // save touches, patch the overlay (header acronym etc. update instantly),
    // persist in the background, roll back with an inline error on failure.
    const prior = priorConfValues([
      'full_name', 'acronym', 'contact_email', 'student_level', 'start_date',
      'end_date', 'country', 'city', 'format', 'expected_delegates',
    ]);
    const expected = Number.isFinite(parsedDelegates) ? parsedDelegates : (prior.expected_delegates as number);
    patchConf({
      full_name: fullName,
      acronym: upperAcr,
      contact_email: contactEmail,
      student_level: studentLevel,
      start_date: startDate,
      end_date: endDate,
      country,
      city,
      format,
      expected_delegates: expected,
    });
    setDetailsSaved(true);
    const supabase = getAuthedClient(session.access_token);
    void (async () => {
      const { error } = await supabase.from('conferences').update({
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
      }).eq('id', conference.id);
      if (error) {
        setConfPatch(p => ({ ...p, ...prior }));
        setDetailsSaved(false);
        setDetailsError("Couldn't save: " + error.message + ' — your edits are still here, try again.');
        return;
      }
      setTimeout(() => setDetailsSaved(false), 2500);
    })();
  }

  if (!conference) return null;

  // Render view: the context row merged with this session's optimistic
  // overlay — every conference-field read in the JSX below must go through
  // `view`, never `conference`, so local writes are visible instantly.
  const view: Conference = { ...conference, ...confPatch };

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
  // already switch on — no logic change, purely the switcher's new skin.
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
          {/* Panel header — echoes the active rail item, gives the panel a protagonist */}
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

      {/* ── APPLICATIONS TAB ── */}
      {activeTab === 'applications' && <div style={cardStyle}>
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
                          {['GBP', 'USD', 'EUR', 'CHF'].map(c => <option key={c} value={c}>{c}</option>)}
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
                </>
              )}
            </div>
          );
        })}
      </div>}

      {/* ── Delegation allocation swaps card ── */}
      {activeTab === 'applications' && <div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Delegation Allocation Swaps
        </p>
        <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Control whether delegation leaders can trade committee allocations within their own delegation.
        </p>
        <div className="flex gap-2">
          {SWAP_MODE_OPTIONS.map(opt => {
            const active = swapMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => saveSwapMode(opt.value)}
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
                    else if (!upper.includes('MUN')) setAcronymError("Acronym must include 'MUN' — e.g. TEIMUN, LIMUN, SMUNC.");
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
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
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

            <button
              onClick={handleSaveDetails}
              disabled={detailsSaved}
              className="w-full rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
              style={{
                backgroundColor: detailsSaved ? '#3D7A52' : '#1B3828',
                color: '#EED98A',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '0.08em',
              }}
              onMouseEnter={(e) => { if (!detailsSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { if (!detailsSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {detailsSaved ? 'SAVED ✓' : 'SAVE CHANGES'}
            </button>
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

            {/* Preset picker — one click sets banner_url to a bundled photo */}
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

          {/* Registration fee card */}
          <div style={cardStyle}>
            <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Registration Fee</p>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>The headline delegate fee and the currency you charge in. Per-role fees are set in the Applications tab.</p>
            <div className="flex items-end gap-3">
              <div style={{ width: '30%' }}>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Currency</label>
                <select
                  value={feeCurrency}
                  onChange={(e) => setFeeCurrency(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                >
                  {['GBP', 'USD', 'EUR', 'CHF', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Fee per delegate</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="0.00"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                />
              </div>
              <button
                onClick={handleSaveFee}
                disabled={feeSaved}
                className="rounded-xl py-2.5 px-5 font-bold text-xs tracking-widest transition-colors focus:outline-none flex-shrink-0"
                style={{
                  backgroundColor: feeSaved ? '#3D7A52' : '#1B3828',
                  color: '#EED98A',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.07em',
                }}
                onMouseEnter={(e) => { if (!feeSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { if (!feeSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                {feeSaved ? 'SAVED ✓' : 'SAVE'}
              </button>
            </div>
            {feeError && (
              <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{feeError}</p>
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
              placeholder="Tell delegates about your conference — theme, highlights, what to expect..."
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
            <button
              onClick={handleSaveVisual}
              disabled={visualSaved}
              className="w-full mt-6 rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
              style={{
                backgroundColor: visualSaved ? '#3D7A52' : '#1B3828',
                color: '#EED98A',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '0.08em',
              }}
              onMouseEnter={(e) => { if (!visualSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { if (!visualSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {visualSaved ? 'SAVED ✓' : 'SAVE CHANGES'}
            </button>
            {visualError && (
              <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{visualError}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Minimum age card ── */}
      {activeTab === 'applications' && <div style={cardStyle}>
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
          <button
            onClick={handleSaveMinAge}
            disabled={minAgeSaved}
            className="rounded-xl py-2.5 px-5 font-bold text-xs tracking-widest transition-colors focus:outline-none flex-shrink-0"
            style={{
              backgroundColor: minAgeSaved ? '#3D7A52' : '#1B3828',
              color: '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.07em',
            }}
            onMouseEnter={(e) => { if (!minAgeSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!minAgeSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {minAgeSaved ? 'SAVED ✓' : 'SAVE'}
          </button>
        </div>
        {minAgeError && (
          <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{minAgeError}</p>
        )}
        {view.min_age != null && !minAgeError && (
          <p className="text-xs mt-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
            Delegates must be at least {view.min_age} years old at the start of your conference to apply.
          </p>
        )}
      </div>}

      {activeTab === 'applications' && <div style={cardStyle}>
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
            <div className="flex flex-col gap-3 mb-4">
              {currentQuestions.length === 0 ? (
                <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  No custom questions for {roleLabel(selectedRole)} yet.
                </p>
              ) : (
                currentQuestions.map(q => (
                  <div
                    key={q.id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: 'rgba(27,56,40,0.03)', border: '1px solid rgba(27,56,40,0.1)' }}
                  >
                    <p className="font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      {q.label}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <Pill tone="neutral" size="sm">{q.type === 'textarea' ? 'Paragraph' : 'Short answer'}</Pill>
                      {q.required && <Pill tone="forest" size="sm">Required</Pill>}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setQuestionModal({ open: true, existing: q })}
                        className="text-xs font-semibold focus:outline-none hover:underline"
                        style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-xs font-semibold focus:outline-none hover:underline"
                        style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setQuestionModal({ open: true, existing: null })}
              className="w-full rounded-xl py-2.5 text-sm font-semibold focus:outline-none transition-all"
              style={{ border: '1.5px dashed #DDD4C0', backgroundColor: 'transparent', color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
            >
              + ADD QUESTION
            </button>
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

        {/* Invite row */}
        <div>
          <label className="block font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Invite by email
          </label>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }}
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
          {inviteError && (
            <p className="text-xs mt-2" style={{ color: '#B8844A', fontFamily: "'Outfit', sans-serif" }}>{inviteError}</p>
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
          <PillToggle value={view.is_public} onChange={handlePublicToggle} size="md" />
        </div>

        <p className="text-sm mt-3" style={{ color: view.is_public ? '#1B3828' : '#B8844A', fontFamily: "'Outfit', sans-serif" }}>
          {view.is_public
            ? 'Your conference is publicly listed on Gavelling.'
            : 'Your conference is private. Only people with the direct link can find it.'}
        </p>

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
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(28,20,16,0.55)' }} onClick={() => { if (!deleting) setConfirmingDelete(false); }}>
              <div className="max-w-md w-full rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3' }} onClick={e => e.stopPropagation()}>
                <p className="font-bold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Delete this conference?</p>
                <p className="text-sm mb-6" style={{ color: '#6A5A4A', fontFamily: "'Outfit', sans-serif" }}>
                  Are you sure you want to delete this conference? This action is irreversible, all data relating to this conference will be lost.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!session || deleting) return;
                      setDeleting(true);
                      const supabase = getAuthedClient(session.access_token);
                      const { error } = await supabase.rpc('delete_conference', { p_conference_id: view.id });
                      if (error) { setDeleteError(error.message || 'Could not delete view.'); setConfirmingDelete(false); setDeleting(false); return; }
                      window.location.href = '/conferences';
                    }}
                    disabled={deleting}
                    className="flex-1 rounded-xl py-2.5 font-bold text-sm text-white focus:outline-none transition-colors"
                    style={{ backgroundColor: deleting ? '#DDD4C0' : '#8B2020', fontFamily: "'Outfit', sans-serif" }}
                  >
                    {deleting ? 'DELETING…' : 'YES, DELETE'}
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="flex-1 rounded-xl py-2.5 font-semibold text-sm focus:outline-none transition-colors"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
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
              disabled={lineageBusy === 'withdraw'}
              className="text-xs font-semibold focus:outline-none hover:underline flex-shrink-0"
              style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}
            >
              {lineageBusy === 'withdraw' ? 'WITHDRAWING...' : 'WITHDRAW'}
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
                        {cityLine ? cityLine + ' — ' : ''}wants to list {view.acronym} as a partner conference
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
      </>}

        </section>
      </div>

      {/* Question modal */}
      {questionModal.open && (
        <QuestionModal
          existing={questionModal.existing}
          onSave={handleSaveQuestion}
          onClose={() => setQuestionModal({ open: false, existing: null })}
        />
      )}

      {/* Drag-to-fit crop step — flattens the chosen framing into a square
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
