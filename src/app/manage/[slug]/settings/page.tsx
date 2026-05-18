'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useManage } from '@/app/manage/[slug]/layout';
import { createAuthClient } from '@/lib/supabase-auth';

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

type BooleanRoleKey = 'auto_accept' | 'pay_at_application' | 'must_pay_before_allocation';

// ── Constants & helpers ────────────────────────────────────────────────────

const ROLES = ['delegate', 'chair', 'head-delegate', 'faculty-advisor', 'observer'] as const;

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

  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [configVersion, setConfigVersion] = useState(0);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('delegate');
  const [questionModal, setQuestionModal] = useState<{ open: boolean; existing: CustomQuestion | null }>({ open: false, existing: null });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);

  // ── Data loaders ────────────────────────────────────────────────────────

  const loadRoleConfigs = useCallback(async () => {
    if (!conference) return;
    const supabase = createAuthClient();
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
    const supabase = createAuthClient();
    const { data } = await supabase
      .from('conference_organizers')
      .select('id, role, user_id, profiles(display_name, email, avatar_url)')
      .eq('conference_id', conference.id);
    if (data) setOrganizers(data as unknown as Organizer[]);
  }, [conference]);

  const ensureRoleConfigs = useCallback(async () => {
    if (!conference) return;
    const supabase = createAuthClient();
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
  }, [conference, loadRoleConfigs, loadOrganizers]);

  useEffect(() => {
    if (!conference || roleConfigs.length > 0) return;
    ensureRoleConfigs();
  }, [conference, roleConfigs.length, ensureRoleConfigs]);

  // ── Role config save ────────────────────────────────────────────────────

  async function saveRoleConfig(role: string, updates: Partial<RoleConfig>) {
    if (!conference) return;
    const supabase = createAuthClient();
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
    const supabase = createAuthClient();

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
    const supabase = createAuthClient();
    await supabase.from('conference_organizers').delete().eq('id', organizerId);
    await loadOrganizers();
  }

  // ── Privacy actions ─────────────────────────────────────────────────────

  async function handlePublicToggle(next: boolean) {
    if (!conference) return;
    const supabase = createAuthClient();
    await supabase.from('conferences').update({
      is_public: next,
      status: next ? 'published' : 'draft',
    }).eq('id', conference.id);
    await refreshConference();
  }

  async function handleArchive() {
    if (!conference) return;
    if (!window.confirm('Archive this conference? It will be hidden from all listings.')) return;
    const supabase = createAuthClient();
    await supabase.from('conferences').update({
      status: 'archived',
      is_public: false,
    }).eq('id', conference.id);
    await refreshConference();
    router.push('/conferences/organise');
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

  return (
    <div className="px-6 md:px-10 py-8 max-w-3xl">
      {/* Header */}
      <p className="text-xs mb-2" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' }}>
        {conference.acronym} / Settings
      </p>
      <h1 className="font-black text-2xl mb-8" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
        Settings
      </h1>

      {/* ── Card 1: Application Windows & Role Configuration ── */}
      <div style={cardStyle}>
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
      </div>

      {/* ── Card 2: Custom Questions ── */}
      <div style={cardStyle}>
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
      </div>

      {/* ── Card 3: Organizing Team ── */}
      <div style={cardStyle}>
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
      </div>

      {/* ── Card 4: Privacy & Publishing ── */}
      <div style={cardStyle}>
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
        </div>
      </div>

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
