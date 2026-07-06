'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@supabase/supabase-js';

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
  pay_at_application: boolean;
  must_pay_before_allocation: boolean;
  custom_questions: CustomQuestion[];
}

interface Organizer {
  id: string;
  role: string;
  user_id: string;
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

type BooleanRoleKey = 'auto_accept' | 'pay_at_application' | 'must_pay_before_allocation';

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
  const [activeTab, setActiveTab] = useState<'applications' | 'visual' | 'organizers' | 'privacy'>('applications');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Visual tab state
  const [bannerUploading, setBannerUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [visualSaving, setVisualSaving] = useState(false);
  const [visualSaved, setVisualSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeCurrency, setFeeCurrency] = useState('GBP');
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeSaved, setFeeSaved] = useState(false);

  // Minimum age (Applications tab)
  const [minAge, setMinAge] = useState('');
  const [minAgeSaving, setMinAgeSaving] = useState(false);
  const [minAgeSaved, setMinAgeSaved] = useState(false);
  const [minAgeError, setMinAgeError] = useState('');

  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [configVersion, setConfigVersion] = useState(0);
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

  // ── Data loaders ────────────────────────────────────────────────────────

  const loadRoleConfigs = useCallback(async () => {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('application_role_configs')
      .select('*')
      .eq('conference_id', conference.id);
    if (data) {
      setRoleConfigs(data as RoleConfig[]);
      setConfigVersion(v => v + 1);
    }
  }, [conference]);

  const loadOrganizers = useCallback(async () => {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_organizers')
      .select('id, role, user_id, profiles(display_name, email, avatar_url)')
      .eq('conference_id', conference.id);
    if (data) setOrganizers(data as unknown as Organizer[]);
  }, [conference]);

  const loadLineage = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);

    // Incoming claims: other conferences claiming this one as their previous edition.
    // Goes through a SECURITY DEFINER RPC because the successor may be private.
    const { data: claims } = await supabase.rpc('list_incoming_predecessor_claims', {
      p_conference_id: conference.id,
    });
    setIncomingClaims((claims as IncomingClaim[] | null) ?? []);

    // Outgoing claim: this conference's own predecessor, if any.
    if (conference.predecessor_conference_id) {
      const { data: pred } = await supabase
        .from('conferences')
        .select('id, full_name, acronym')
        .eq('id', conference.predecessor_conference_id)
        .maybeSingle();
      setPredecessorInfo((pred as PredecessorSummary | null) ?? null);
    } else {
      setPredecessorInfo(null);
    }
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
      pay_at_application: false,
      must_pay_before_allocation: false,
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
    setDescription(conference.description ?? '');
    setInstagramUrl(conference.instagram_url ?? '');
    setFacebookUrl(conference.facebook_url ?? '');
    setTiktokUrl(conference.tiktok_url ?? '');
    setWhatsappUrl(conference.whatsapp_url ?? '');
    setWebsiteUrl(conference.website_url ?? '');
    setFeeAmount(conference.fee_amount != null ? String(conference.fee_amount) : '');
    setFeeCurrency(conference.fee_currency ?? 'GBP');
    setMinAge(conference.min_age != null ? String(conference.min_age) : '');
  }, [conference?.id, loadRoleConfigs, loadOrganizers, loadLineage]);

  useEffect(() => {
    if (!conference || roleConfigs.length > 0) return;
    ensureRoleConfigs();
  }, [conference, roleConfigs.length, ensureRoleConfigs]);

  // ── Role config save ────────────────────────────────────────────────────

  async function saveRoleConfig(role: string, updates: Partial<RoleConfig>) {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase
      .from('application_role_configs')
      .update(updates)
      .eq('conference_id', conference.id)
      .eq('role', role);
    await loadRoleConfigs();
  }

  // ── Organizer actions ───────────────────────────────────────────────────

  async function handleInvite() {
    if (!conference || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    if (!session) return;
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

    await supabase.from('conference_organizers').insert({
      conference_id: conference.id,
      user_id: (profile as { id: string }).id,
      role: 'organizer',
    });
    setInviteEmail('');
    await loadOrganizers();
    setInviting(false);
  }

  async function handleRemoveOrganizer(organizerId: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('conference_organizers').delete().eq('id', organizerId);
    await loadOrganizers();
  }

  // ── Privacy actions ─────────────────────────────────────────────────────

  async function handlePublicToggle(next: boolean) {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('conferences').update({
      is_public: next,
      status: next ? 'public' : 'private',
    }).eq('id', conference.id);
    await refreshConference();
  }

  async function handleArchive() {
    if (!conference) return;
    if (!window.confirm('Archive this conference? It will be hidden from all listings.')) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('conferences').update({
      status: 'archived',
      is_public: false,
    }).eq('id', conference.id);
    await refreshConference();
    router.push('/conferences/organise');
  }

  // ── Lineage actions ─────────────────────────────────────────────────────

  const isOwner = organizers.some(o => o.user_id === user?.id && o.role === 'owner');

  async function handleClaimDecision(successorId: string, approve: boolean) {
    if (!session) return;
    setLineageBusy(successorId);
    setLineageError('');
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.rpc('approve_predecessor_link', {
      p_successor_id: successorId,
      p_approve: approve,
    });
    if (error) setLineageError(error.message);
    await loadLineage();
    setLineageBusy(null);
  }

  async function handleWithdrawClaim() {
    if (!conference || !session) return;
    if (!window.confirm('Withdraw the previous-edition claim? The link (and any approval) will be removed.')) return;
    setLineageBusy('withdraw');
    setLineageError('');
    const supabase = getAuthedClient(session.access_token);
    // Only clear the id — predecessor_approved is reset by the DB trigger.
    const { error } = await supabase
      .from('conferences')
      .update({ predecessor_conference_id: null })
      .eq('id', conference.id);
    if (error) setLineageError(error.message);
    // refreshConference replaces the conference object; the settings effect
    // re-runs loadLineage with the fresh predecessor_conference_id.
    await refreshConference();
    setLineageBusy(null);
  }

  // ── Custom questions ────────────────────────────────────────────────────

  const selectedConfig = roleConfigs.find(rc => rc.role === selectedRole);
  const currentQuestions: CustomQuestion[] = selectedConfig?.custom_questions ?? [];
  const enabledRoles = ROLES.filter(r => roleConfigs.find(rc => rc.role === r)?.is_enabled);

  async function handleSaveQuestion(q: CustomQuestion) {
    const updated = questionModal.existing
      ? currentQuestions.map(eq => eq.id === q.id ? q : eq)
      : [...currentQuestions, q];
    await saveRoleConfig(selectedRole, { custom_questions: updated });
    setQuestionModal({ open: false, existing: null });
  }

  async function handleDeleteQuestion(id: string) {
    await saveRoleConfig(selectedRole, { custom_questions: currentQuestions.filter(q => q.id !== id) });
  }

  async function handleBannerUpload(file: File) {
    if (!session || !conference) return;
    if (file.size > 5 * 1024 * 1024) { alert('Banner must be under 5MB.'); return; }
    setBannerUploading(true);
    const supabase = getAuthedClient(session.access_token);
    const ext = file.name.split('.').pop();
    const path = 'banners/' + conference.id + '-' + Date.now() + '.' + ext;
    const { error } = await supabase.storage.from('conference-assets').upload(path, file, { contentType: file.type, upsert: true });
    if (error) { alert('Upload failed: ' + error.message); setBannerUploading(false); return; }
    const { data: urlData } = supabase.storage.from('conference-assets').getPublicUrl(path);
    await supabase.from('conferences').update({ banner_url: urlData.publicUrl }).eq('id', conference.id);
    await refreshConference();
    setBannerUploading(false);
  }

  // Preset banner selection — same authed-client update path as the upload,
  // just pointing banner_url at a bundled /banners/preset-N.jpg instead.
  async function handleBannerPreset(path: string) {
    if (!session || !conference || bannerUploading) return;
    if (conference.banner_url === path) return;
    setBannerUploading(true);
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('conferences').update({ banner_url: path }).eq('id', conference.id);
    if (error) { alert('Could not set preset: ' + error.message); setBannerUploading(false); return; }
    await refreshConference();
    setBannerUploading(false);
  }

  async function handleLogoUpload(file: File) {
    if (!session || !conference) return;
    if (file.size > 5 * 1024 * 1024) { alert('Logo must be under 5MB.'); return; }
    setLogoUploading(true);
    const supabase = getAuthedClient(session.access_token);
    const ext = file.name.split('.').pop();
    const path = 'logos/' + conference.id + '-' + Date.now() + '.' + ext;
    const { error } = await supabase.storage.from('conference-assets').upload(path, file, { contentType: file.type, upsert: true });
    if (error) { alert('Upload failed: ' + error.message); setLogoUploading(false); return; }
    const { data: urlData } = supabase.storage.from('conference-assets').getPublicUrl(path);
    await supabase.from('conferences').update({ logo_url: urlData.publicUrl }).eq('id', conference.id);
    await refreshConference();
    setLogoUploading(false);
  }

  async function handleSaveFee() {
    if (!session || !conference) return;
    setFeeSaving(true);
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('conferences').update({
      fee_amount: parseFloat(feeAmount) || 0,
      fee_currency: feeCurrency,
    }).eq('id', conference.id);
    await refreshConference();
    setFeeSaving(false);
    setFeeSaved(true);
    setTimeout(() => setFeeSaved(false), 2500);
  }

  async function handleSaveMinAge() {
    if (!session || !conference) return;
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
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('conferences').update({ min_age: value }).eq('id', conference.id);
    if (error) {
      setMinAgeError('Could not save the minimum age. Please try again.');
      setMinAgeSaving(false);
      return;
    }
    await refreshConference();
    setMinAgeSaving(false);
    setMinAgeSaved(true);
    setTimeout(() => setMinAgeSaved(false), 2500);
  }

  async function handleSaveVisual() {
    if (!session || !conference) return;
    setVisualSaving(true);
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('conferences').update({
      description: description || null,
      instagram_url: instagramUrl || null,
      facebook_url: facebookUrl || null,
      tiktok_url: tiktokUrl || null,
      whatsapp_url: whatsappUrl || null,
      website_url: websiteUrl || null,
    }).eq('id', conference.id);
    await refreshConference();
    setVisualSaving(false);
    setVisualSaved(true);
    setTimeout(() => setVisualSaved(false), 2500);
  }

  if (!conference) return null;

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FAF8F3',
    border: '1px solid #DDD4C0',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
  };

  const TOGGLE_ROWS: { key: BooleanRoleKey; label: string; desc: string }[] = [
    { key: 'auto_accept', label: 'Auto-accept', desc: 'Automatically accept all applications' },
    { key: 'pay_at_application', label: 'Pay at application', desc: 'Delegates must pay when submitting' },
    { key: 'must_pay_before_allocation', label: 'Must pay before allocation', desc: 'Block country assignment until paid' },
  ];

  const TABS: { key: 'applications' | 'visual' | 'organizers' | 'privacy'; label: string }[] = [
    { key: 'applications', label: 'APPLICATIONS' },
    { key: 'visual', label: 'VISUAL' },
    { key: 'organizers', label: 'ORGANIZERS' },
    { key: 'privacy', label: 'PRIVACY' },
  ];

  return (
    <div className="px-6 md:px-10 py-8 max-w-3xl">
      {/* Header */}
      <p className="text-xs mb-2" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' }}>
        {conference.acronym} / Settings
      </p>
      <h1 className="font-black text-2xl mb-6" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
        Settings
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-1.5 rounded-full text-xs font-bold transition-all focus:outline-none"
            style={{
              backgroundColor: activeTab === tab.key ? '#1B3828' : 'transparent',
              color: activeTab === tab.key ? '#EED98A' : '#9A8A78',
              border: activeTab === tab.key ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0.06em',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── APPLICATIONS TAB ── */}
      {activeTab === 'applications' && <div style={cardStyle}>
        <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Application Windows
        </p>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Configure which roles can apply, their fees, and application windows.
        </p>

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

                  {/* Boolean toggles */}
                  <div className="flex flex-col gap-2 mt-3">
                    {TOGGLE_ROWS.map(({ key, label, desc }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between py-2.5 px-4 rounded-xl"
                        style={{ backgroundColor: 'rgba(27,56,40,0.03)', border: '1px solid rgba(27,56,40,0.08)' }}
                      >
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{label}</p>
                          <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{desc}</p>
                        </div>
                        <PillToggle
                          value={config[key]}
                          onChange={(v) => saveRoleConfig(role, { [key]: v } as Partial<RoleConfig>)}
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>}

      {/* ── VISUAL TAB ── */}
      {activeTab === 'visual' && (
        <div>
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
              {conference.banner_url ? (
                <>
                  <img src={conference.banner_url} alt="Banner" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
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
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: '#9A8A78', margin: '0 0 8px 0' }}>
                OR PICK A PRESET
              </p>
              <div className="flex flex-wrap gap-2">
                {BANNER_PRESETS.map(p => {
                  const selected = conference.banner_url === p;
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
                ) : conference.logo_url ? (
                  <img src={conference.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
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
                  {logoUploading ? 'UPLOADING...' : conference.logo_url ? 'REPLACE LOGO' : 'UPLOAD LOGO'}
                </button>
              </div>
              <input
                id="settings-logo-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }}
              />
            </div>
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
                disabled={feeSaving}
                className="rounded-xl py-2.5 px-5 font-bold text-xs tracking-widest transition-colors focus:outline-none flex-shrink-0"
                style={{
                  backgroundColor: feeSaved ? '#3D7A52' : feeSaving ? '#DDD4C0' : '#1B3828',
                  color: feeSaving ? '#9A8A78' : '#EED98A',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.07em',
                }}
                onMouseEnter={(e) => { if (!feeSaving && !feeSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { if (!feeSaving && !feeSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                {feeSaved ? 'SAVED ✓' : feeSaving ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
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
              disabled={visualSaving}
              className="w-full mt-6 rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
              style={{
                backgroundColor: visualSaved ? '#3D7A52' : visualSaving ? '#DDD4C0' : '#1B3828',
                color: visualSaving ? '#9A8A78' : '#EED98A',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '0.08em',
              }}
              onMouseEnter={(e) => { if (!visualSaving && !visualSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { if (!visualSaving && !visualSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {visualSaved ? 'SAVED ✓' : visualSaving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
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
            disabled={minAgeSaving}
            className="rounded-xl py-2.5 px-5 font-bold text-xs tracking-widest transition-colors focus:outline-none flex-shrink-0"
            style={{
              backgroundColor: minAgeSaved ? '#3D7A52' : minAgeSaving ? '#DDD4C0' : '#1B3828',
              color: minAgeSaving ? '#9A8A78' : '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.07em',
            }}
            onMouseEnter={(e) => { if (!minAgeSaving && !minAgeSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!minAgeSaving && !minAgeSaved) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {minAgeSaved ? 'SAVED ✓' : minAgeSaving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
        {minAgeError && (
          <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{minAgeError}</p>
        )}
        {conference.min_age != null && !minAgeError && (
          <p className="text-xs mt-3" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
            Delegates must be at least {conference.min_age} years old at the start of your conference to apply.
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
                  className="px-4 py-1.5 rounded-full text-xs font-semibold focus:outline-none transition-all"
                  style={{
                    backgroundColor: active ? '#1B3828' : 'transparent',
                    color: active ? '#EED98A' : '#9A8A78',
                    border: active ? '1px solid #1B3828' : '1px solid #DDD4C0',
                    fontFamily: "'DM Mono', monospace",
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
                    <div className="flex items-center gap-3 mb-2">
                      <span style={{ fontSize: '9px', color: '#9A8A78', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {q.type}
                      </span>
                      {q.required && (
                        <span style={{ fontSize: '9px', color: '#1B3828', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          REQUIRED
                        </span>
                      )}
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
          Add co-organizers who can manage this conference.
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
              const isOwner = org.role === 'owner';

              return (
                <div
                  key={org.id}
                  className="flex items-center gap-3 py-3"
                  style={{ borderBottom: isLast ? 'none' : '1px solid #F0EDE6' }}
                >
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

                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      ...(isOwner
                        ? { backgroundColor: 'rgba(238,217,138,0.2)', color: '#B6871F' }
                        : { backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828' }),
                    }}
                  >
                    {isOwner ? 'OWNER' : 'ORGANIZER'}
                  </span>

                  {!isOwner && (
                    <button
                      onClick={() => handleRemoveOrganizer(org.id)}
                      className="text-xs font-semibold focus:outline-none hover:underline flex-shrink-0"
                      style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}
                    >
                      REMOVE
                    </button>
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
          Control who can see your conference.
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
          <PillToggle value={conference.is_public} onChange={handlePublicToggle} size="md" />
        </div>

        <p className="text-sm mt-3" style={{ color: conference.is_public ? '#1B3828' : '#B8844A', fontFamily: "'Outfit', sans-serif" }}>
          {conference.is_public
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

          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="w-full rounded-xl py-2.5 mt-3 font-semibold text-sm focus:outline-none transition-colors"
              style={{ border: '1px solid rgba(139,32,32,0.3)', color: '#8B2020', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              DELETE CONFERENCE
            </button>
          ) : (
            <div className="mt-3 p-4 rounded-xl" style={{ border: '1px solid rgba(139,32,32,0.3)', backgroundColor: 'rgba(139,32,32,0.04)' }}>
              <p className="text-sm mb-4" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                Are you sure you want to delete this conference? This action is irreversible, all data relating to this conference will be lost.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!session || deleting) return;
                    setDeleting(true);
                    const supabase = getAuthedClient(session.access_token);
                    const { error } = await supabase.rpc('delete_conference', { p_conference_id: conference.id });
                    if (error) { alert(error.message || 'Could not delete conference.'); setDeleting(false); return; }
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
          className="text-[10px] mb-2"
          style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.16em', textTransform: 'uppercase' }}
        >
          Previous edition
        </p>
        {conference.predecessor_conference_id ? (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6"
            style={{ backgroundColor: 'rgba(27,56,40,0.03)', border: '1px solid rgba(27,56,40,0.08)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                {predecessorInfo?.full_name ?? 'A private conference'}
              </p>
              <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                {conference.predecessor_approved
                  ? 'Confirmed as the previous edition of this conference.'
                  : 'Waiting for its Main Organiser to confirm the link.'}
              </p>
            </div>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                fontFamily: "'DM Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                ...(conference.predecessor_approved
                  ? { backgroundColor: 'rgba(61,122,82,0.15)', color: '#3D7A52' }
                  : { backgroundColor: 'rgba(238,217,138,0.25)', color: '#B6871F' }),
              }}
            >
              {conference.predecessor_approved ? 'APPROVED' : 'PENDING APPROVAL'}
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
          className="text-[10px] mb-2"
          style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.16em', textTransform: 'uppercase' }}
        >
          Incoming claims
        </p>
        {incomingClaims.length === 0 ? (
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            No conferences currently claim {conference.acronym} as their previous edition.
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
                    <p style={{ fontSize: 10, color: '#B6871F', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {claim.acronym}{year ? ' · ' + year : ''}
                    </p>
                    <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      {claim.full_name}
                    </p>
                    <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      claims to be the next edition of {conference.acronym}
                    </p>
                  </div>

                  {claim.predecessor_approved ? (
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        backgroundColor: 'rgba(61,122,82,0.15)',
                        color: '#3D7A52',
                      }}
                    >
                      APPROVED
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
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        backgroundColor: 'rgba(154,138,120,0.15)',
                        color: '#9A8A78',
                      }}
                      title="Only the conference owner can approve or reject lineage claims."
                    >
                      OWNER DECIDES
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
      </>}

      {/* Question modal */}
      {questionModal.open && (
        <QuestionModal
          existing={questionModal.existing}
          onSave={handleSaveQuestion}
          onClose={() => setQuestionModal({ open: false, existing: null })}
        />
      )}
    </div>
  );
}
