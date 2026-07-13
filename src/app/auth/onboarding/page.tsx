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
import { ArrowRight } from 'lucide-react';
import { createAuthClient } from '@/lib/supabase-auth';
import { WizardShell, TwoTabPick, CardSelect, type WizardOption } from '@/components/wizard';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { FlagImg } from '@/components/FlagImg';
import { UN_COUNTRIES } from '@/lib/countries';

const TOTAL_STEPS = 3;

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
    if (Object.keys(patch).length === 0) return;
    await supabase.from('profiles').update(patch).eq('id', userId);
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
            sub="Search and pick as many as you like — we'll surface conferences in your region."
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
            sub="A rough starting point — your level updates automatically as your MUN CV grows."
            onBack={() => setStep(2)}
          >
            <CardSelect options={LEVEL_OPTIONS} value={level} onChange={pickLevel} columns={2} />
            <StepFooter
              onNext={finish}
              nextLabel={saving ? 'Saving…' : level ? 'Finish' : 'Skip & finish'}
              primary={!!level}
              disabled={saving}
            />
          </WizardShell>
        )}
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
