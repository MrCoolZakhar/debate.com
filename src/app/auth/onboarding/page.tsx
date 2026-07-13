'use client';

/**
 * /auth/onboarding — post-signup questionnaire, one question per screen.
 * Built on the shared wizard kit (WizardShell / TwoTabPick / CardSelect).
 *
 * Entirely skippable: "I'll do this later" is always visible, every answer
 * is optional, and nothing here ever blocks entry into the app. Answers
 * persist to profiles (education_level, mun_countries jsonb, and — for the
 * self-reported starting point — mun_experience_level).
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, Trash2, User, Gavel, Briefcase, Sparkles } from 'lucide-react';
import { createAuthClient } from '@/lib/supabase-auth';
import { WizardShell, TwoTabPick, CardSelect, type WizardOption } from '@/components/wizard';
import { DatePicker } from '@/components/DatePicker';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { FlagImg } from '@/components/FlagImg';
import { UN_COUNTRIES } from '@/lib/countries';

const TOTAL_STEPS = 4;

// Mirrors the MUN CV entry roles (src/app/account/cv/page.tsx). A previous
// conference the user types here becomes a self-reported mun_cv_entries row.
type PrevRole = 'delegate' | 'chair' | 'secretariat' | 'other';

const PREV_ROLES: { key: PrevRole; label: string; Icon: typeof User }[] = [
  { key: 'delegate', label: 'Delegate', Icon: User },
  { key: 'chair', label: 'Chair', Icon: Gavel },
  { key: 'secretariat', label: 'Secretariat', Icon: Briefcase },
  { key: 'other', label: 'Other', Icon: Sparkles },
];

interface PrevConf {
  id: string;
  name: string;
  role: PrevRole;
  detail: string; // country/allocation (delegate) · committee (chair) · title (secretariat/other)
  award: string;
  date: string; // ISO YYYY-MM-DD, optional
}

const emptyConf = (): PrevConf => ({
  id: Math.random().toString(36).slice(2),
  name: '',
  role: 'delegate',
  detail: '',
  award: '',
  date: '',
});

const EDUCATION_OPTIONS: WizardOption[] = [
  {
    key: 'high_school',
    label: 'High School',
    sub: 'MUN clubs, school delegations, and student conferences.',
    image: '/onboarding/classroom-01.jpg',
  },
  {
    key: 'university',
    label: 'University',
    sub: 'Collegiate circuits, societies, and international conferences.',
    image: '/onboarding/campus-01.jpg',
  },
];

const LEVEL_OPTIONS: WizardOption[] = [
  { key: 'beginner', label: 'Beginner', sub: '0–1 conferences', icon: '🌱' },
  { key: 'intermediate', label: 'Intermediate', sub: '2–4 conferences', icon: '📘' },
  { key: 'advanced', label: 'Advanced', sub: '5–8 conferences', icon: '🏅' },
  { key: 'expert', label: 'Expert', sub: '9+ conferences', icon: '🏆' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createAuthClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [education, setEducation] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [level, setLevel] = useState<string | null>(null);
  const [prevConfs, setPrevConfs] = useState<PrevConf[]>([emptyConf()]);
  const [saving, setSaving] = useState(false);

  // Resolve the signed-in user once. Never block: without a session we just
  // send the visitor home rather than gating them behind auth.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user) setUserId(data.user.id);
      else router.replace('/');
    });
    return () => { cancelled = true; };
  }, [supabase, router]);

  const countryOptions = useMemo<WizardOption[]>(
    () =>
      UN_COUNTRIES.map((c) => ({
        key: c.code,
        label: c.name,
        icon: <FlagImg code={c.code} size={30} />,
      })),
    [],
  );

  function toggleCountry(code: string) {
    setCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  /** Persist whatever has been answered so far (fire-and-forget safe). */
  async function persist() {
    if (!userId) return;
    const patch: Record<string, unknown> = {};
    if (education) patch.education_level = education;
    if (countries.length > 0) patch.mun_countries = countries;
    if (level) patch.mun_experience_level = level;
    if (Object.keys(patch).length > 0) {
      await supabase.from('profiles').update(patch).eq('id', userId);
    }
    await persistConferences();
  }

  /**
   * Turn any filled-in previous-conference rows into self-reported
   * mun_cv_entries rows so the user's MUN CV is pre-populated. Fully optional:
   * rows without a conference name are skipped and nothing here can block entry.
   * committee/allocation are NOT NULL in the DB, so we always send strings.
   */
  async function persistConferences() {
    if (!userId) return;
    const rows = prevConfs
      .filter((c) => c.name.trim())
      .map((c) => {
        const isChair = c.role === 'chair';
        const detail = c.detail.trim();
        const awards = c.award.trim() ? [c.award.trim()] : [];
        return {
          user_id: userId,
          entry_type: c.role,
          conference_name: c.name.trim(),
          committee: isChair ? detail : '',
          allocation: isChair ? '' : detail,
          event_date: c.date || null,
          awards,
          award: awards[0] ?? 'None',
          source: 'manual' as const,
        };
      });
    if (rows.length === 0) return;
    await supabase.from('mun_cv_entries').insert(rows);
  }

  async function finish() {
    setSaving(true);
    try {
      await persist();
    } finally {
      router.push('/');
    }
  }

  function skipAll() {
    // Save any partial answers, but leave immediately either way.
    void persist();
    router.push('/');
  }

  function pickEducation(key: string) {
    setEducation(key);
    // Binary pick — advance automatically after the check animates in.
    setTimeout(() => setStep(2), 320);
  }

  function pickLevel(key: string) {
    setLevel(key);
  }

  function updateConf(id: string, patch: Partial<PrevConf>) {
    setPrevConfs((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function addConf() {
    setPrevConfs((prev) => [...prev, emptyConf()]);
  }
  function removeConf(id: string) {
    setPrevConfs((prev) => (prev.length <= 1 ? [emptyConf()] : prev.filter((c) => c.id !== id)));
  }

  const filledConfCount = prevConfs.filter((c) => c.name.trim()).length;

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: NEU.base ?? '#EDE7D8' }}>
      {/* Top bar: mark on the left, escape hatch on the right */}
      <div className="flex items-center justify-between" style={{ padding: '18px 22px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gavel-mark.png" alt="Gavelling" className="h-9 w-9 object-contain" />
        <button
          type="button"
          onClick={skipAll}
          className="text-sm font-semibold focus:outline-none"
          style={{
            fontFamily: OUTFIT,
            color: NEU.muted,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: `color 180ms ${EASE}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.forest; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
        >
          I&apos;ll do this later →
        </button>
      </div>

      <div style={{ padding: '12px 20px 40px' }}>
        {step === 1 && (
          <WizardShell
            step={1}
            total={TOTAL_STEPS}
            title="Where do you do MUN?"
            sub="This helps us show you the right conferences first."
          >
            <TwoTabPick options={EDUCATION_OPTIONS} value={education} onChange={pickEducation} />
            <StepFooter
              onNext={() => setStep(2)}
              nextLabel={education ? 'Continue' : 'Skip this question'}
              primary={!!education}
            />
          </WizardShell>
        )}

        {step === 2 && (
          <WizardShell
            step={2}
            total={TOTAL_STEPS}
            title="Which countries do you usually do MUN in?"
            sub="Search and pick as many as you like, and we'll surface conferences in your region."
            onBack={() => setStep(1)}
          >
            <CardSelect
              options={countryOptions}
              value={countries}
              onChange={toggleCountry}
              multiple
              searchable
              columns={3}
            />
            <StepFooter
              onNext={() => setStep(3)}
              nextLabel={countries.length > 0 ? 'Continue' : 'Skip this question'}
              primary={countries.length > 0}
            />
          </WizardShell>
        )}

        {step === 3 && (
          <WizardShell
            step={3}
            total={TOTAL_STEPS}
            title="How experienced a delegate are you?"
            sub="A rough starting point. Your level updates automatically as your MUN CV grows."
            onBack={() => setStep(2)}
          >
            <CardSelect options={LEVEL_OPTIONS} value={level} onChange={pickLevel} columns={2} />
            <StepFooter
              onNext={() => setStep(4)}
              nextLabel={level ? 'Continue' : 'Skip this question'}
              primary={!!level}
            />
          </WizardShell>
        )}

        {step === 4 && (
          <WizardShell
            step={4}
            total={TOTAL_STEPS}
            title="Been to conferences before?"
            sub="Add any you've attended and we'll start your MUN CV for you. Skip if you'd rather add them later."
            onBack={() => setStep(3)}
          >
            <div className="flex flex-col gap-4">
              {prevConfs.map((conf, i) => (
                <PrevConfRow
                  key={conf.id}
                  conf={conf}
                  index={i}
                  canRemove={prevConfs.length > 1 || !!conf.name.trim()}
                  onChange={(patch) => updateConf(conf.id, patch)}
                  onRemove={() => removeConf(conf.id)}
                />
              ))}

              <button
                type="button"
                onClick={addConf}
                className="inline-flex items-center justify-center gap-2 self-center focus:outline-none"
                style={{
                  fontFamily: OUTFIT,
                  fontWeight: 700,
                  fontSize: 13,
                  color: NEU.forest,
                  padding: '10px 20px',
                  borderRadius: 999,
                  border: 'none',
                  backgroundColor: NEU.surface,
                  boxShadow: NEU.outSm,
                  cursor: 'pointer',
                  transition: `all 200ms ${EASE}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                <Plus size={15} strokeWidth={2.6} />
                Add another conference
              </button>
            </div>

            <StepFooter
              onNext={finish}
              nextLabel={
                saving
                  ? 'Saving…'
                  : filledConfCount > 0
                    ? `Finish${filledConfCount > 1 ? ` · ${filledConfCount} added` : ''}`
                    : 'Skip & finish'
              }
              primary={filledConfCount > 0}
              disabled={saving}
            />
          </WizardShell>
        )}
      </div>
    </div>
  );
}

// ── Previous-conference add-row (mirrors the MUN CV entry fields) ────────────

function PrevConfRow({
  conf,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  conf: PrevConf;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<PrevConf>) => void;
  onRemove: () => void;
}) {
  const isChair = conf.role === 'chair';
  const detailLabel =
    conf.role === 'delegate' ? 'Country / allocation'
    : conf.role === 'chair' ? 'Committee chaired'
    : conf.role === 'secretariat' ? 'Position / title'
    : 'Role';
  const detailPlaceholder =
    conf.role === 'delegate' ? 'e.g. France'
    : conf.role === 'chair' ? 'e.g. UN Security Council'
    : conf.role === 'secretariat' ? 'e.g. Under-Secretary-General'
    : 'e.g. Press Corps';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    border: '1.5px solid transparent',
    backgroundColor: NEU.base,
    boxShadow: NEU.inSm,
    fontFamily: OUTFIT,
    fontSize: 14,
    color: NEU.ink,
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: OUTFIT,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: NEU.muted,
    marginBottom: 5,
    display: 'block',
    textTransform: 'uppercase',
  };
  const focusOn = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = NEU.forest; };
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = 'transparent'; };

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: NEU.surface,
        borderRadius: 18,
        boxShadow: NEU.outSm,
        padding: '18px 18px 16px',
      }}
    >
      {/* Header: index + remove */}
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 12, letterSpacing: '0.08em', color: NEU.deepGold, textTransform: 'uppercase' }}>
          Conference {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove this conference"
            className="flex items-center justify-center focus:outline-none"
            style={{ width: 30, height: 30, borderRadius: 999, border: 'none', background: 'transparent', color: NEU.muted, cursor: 'pointer', transition: `color 180ms ${EASE}` }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
          >
            <Trash2 size={16} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* Role selector */}
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Role</span>
        <div className="grid grid-cols-4 gap-2">
          {PREV_ROLES.map((r) => {
            const active = conf.role === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => onChange({ role: r.key })}
                className="flex flex-col items-center justify-center gap-1 focus:outline-none"
                style={{
                  padding: '9px 4px',
                  borderRadius: 12,
                  border: active ? `1.5px solid ${NEU.forest}` : '1.5px solid rgba(27,56,40,0.10)',
                  backgroundColor: active ? NEU.base : 'transparent',
                  boxShadow: active ? NEU.inSm : 'none',
                  cursor: 'pointer',
                  transition: `all 200ms ${EASE}`,
                }}
              >
                <r.Icon size={16} strokeWidth={2.2} style={{ color: active ? NEU.forest : NEU.muted }} />
                <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: active ? NEU.ink : NEU.muted }}>{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conference name */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Conference name</label>
        <input
          type="text"
          value={conf.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Harvard WorldMUN 2025"
          style={inputStyle}
          onFocus={focusOn}
          onBlur={focusOff}
        />
      </div>

      {/* Detail (role-dependent) + award */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>{detailLabel}</label>
          <input
            type="text"
            value={conf.detail}
            onChange={(e) => onChange({ detail: e.target.value })}
            placeholder={detailPlaceholder}
            style={inputStyle}
            onFocus={focusOn}
            onBlur={focusOff}
          />
        </div>
        <div>
          <label style={labelStyle}>
            {isChair ? 'Note' : 'Award'} <span style={{ textTransform: 'none', fontWeight: 500 }}>· optional</span>
          </label>
          <input
            type="text"
            value={conf.award}
            onChange={(e) => onChange({ award: e.target.value })}
            placeholder={isChair ? 'e.g. Director' : 'e.g. Best Delegate'}
            style={inputStyle}
            onFocus={focusOn}
            onBlur={focusOff}
          />
        </div>
      </div>

      {/* When */}
      <div>
        <label style={labelStyle}>When <span style={{ textTransform: 'none', fontWeight: 500 }}>· optional</span></label>
        <DatePicker
          value={conf.date}
          onChange={(iso) => onChange({ date: iso })}
          max={new Date().toISOString().slice(0, 10)}
          placeholder="Pick a date"
        />
      </div>
    </div>
  );
}

function StepFooter({
  onNext,
  nextLabel,
  primary,
  disabled,
}: {
  onNext: () => void;
  nextLabel: string;
  primary: boolean;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div className="flex justify-center" style={{ marginTop: 26 }}>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="inline-flex items-center gap-2 focus:outline-none"
        style={{
          fontFamily: OUTFIT,
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: '0.06em',
          padding: '14px 34px',
          borderRadius: 999,
          border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          color: primary ? NEU.gold : NEU.muted,
          background: primary ? NEU.forest : 'transparent',
          boxShadow: primary ? (hover ? NEU.outSmHover : NEU.outSm) : 'none',
          textDecoration: primary ? 'none' : 'underline',
          textUnderlineOffset: 4,
          opacity: disabled ? 0.6 : 1,
          transform: primary && hover && !disabled ? 'translateY(-1px)' : 'translateY(0)',
          transition: `all 220ms ${EASE}`,
        }}
      >
        {nextLabel}
        <ArrowRight size={16} strokeWidth={2.6} />
      </button>
    </div>
  );
}
