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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, Pencil } from 'lucide-react';
import { createAuthClient } from '@/lib/supabase-auth';
import { WizardShell, TwoTabPick, CardSelect, type WizardOption } from '@/components/wizard';
import { CVEntryModal, ENTRY_TYPE_MAP, type CVEntry } from '@/components/CVEntryModal';
import { LogoDisc } from '@/components/LogoDisc';
import { monogramFor } from '@/app/account/accountUi';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { FlagImg } from '@/components/FlagImg';
import { UN_COUNTRIES } from '@/lib/countries';

const TOTAL_STEPS = 4;

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

  // Past conferences use the SAME add-entry experience as the profile MUN CV
  // (the shared CVEntryModal). Each saved entry writes to mun_cv_entries
  // immediately (source: 'manual'), so this list mirrors what the CV page shows.
  const [cvEntries, setCvEntries] = useState<CVEntry[]>([]);
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [cvModalEntry, setCvModalEntry] = useState<CVEntry | null>(null);

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

  /**
   * Persist the questionnaire answers (education / countries / level). Past
   * conferences are NOT written here — they're saved as they're added via the
   * shared CVEntryModal, exactly like the profile MUN CV. Fire-and-forget safe.
   */
  async function persist() {
    if (!userId) return;
    const patch: Record<string, unknown> = {};
    if (education) patch.education_level = education;
    if (countries.length > 0) patch.mun_countries = countries;
    if (level) patch.mun_experience_level = level;
    if (Object.keys(patch).length > 0) {
      await supabase.from('profiles').update(patch).eq('id', userId);
    }
  }

  // Load whatever MUN CV entries the user already has (so returning here shows
  // them, and entries added via the modal appear immediately after each save).
  const fetchCvEntries = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('mun_cv_entries')
      .select('id, entry_type, conference_name, committee, allocation, expertise_level, award, awards, photos, description, logo_url, conference_id, event_date, source, created_at')
      .eq('user_id', userId);
    const rows = ((data as CVEntry[]) ?? []).map((r) => ({
      ...r,
      entry_type: r.entry_type ?? 'delegate',
      awards: r.awards ?? [],
      photos: r.photos ?? [],
    }));
    rows.sort((a, b) => {
      const da = new Date(a.event_date ? `${a.event_date}T00:00:00` : a.created_at).getTime();
      const db = new Date(b.event_date ? `${b.event_date}T00:00:00` : b.created_at).getTime();
      return db - da;
    });
    setCvEntries(rows);
  }, [supabase, userId]);

  useEffect(() => { void fetchCvEntries(); }, [fetchCvEntries]);

  async function handleDeleteCvEntry(id: string) {
    setCvEntries((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('mun_cv_entries').delete().eq('id', id);
  }

  // Where to send the user after onboarding. Honor a `?next=` param (the OAuth
  // callback forwards Google signups here with their intended destination — e.g.
  // an in-progress conference application to continue), but only same-origin
  // relative paths, and never back into onboarding (no loop). With no `next`,
  // a fresh delegate lands on their own profile by default.
  function postOnboardingDest(): string {
    if (typeof window === 'undefined') return '/account/profile';
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/auth/onboarding')) {
      return next;
    }
    return '/account/profile';
  }

  async function finish() {
    setSaving(true);
    try {
      await persist();
    } finally {
      router.push(postOnboardingDest());
    }
  }

  function skipAll() {
    // Save any partial answers, but leave immediately either way.
    void persist();
    router.push(postOnboardingDest());
  }

  function pickEducation(key: string) {
    setEducation(key);
    // Binary pick — advance automatically after the check animates in.
    setTimeout(() => setStep(2), 320);
  }

  function pickLevel(key: string) {
    setLevel(key);
  }

  function openAddConf() {
    setCvModalEntry(null);
    setCvModalOpen(true);
  }
  function openEditConf(entry: CVEntry) {
    setCvModalEntry(entry);
    setCvModalOpen(true);
  }

  const confCount = cvEntries.length;

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
            <div className="flex flex-col gap-3">
              {cvEntries.map((entry) => (
                <ConfSummaryRow key={entry.id} entry={entry} onEdit={() => openEditConf(entry)} />
              ))}

              <button
                type="button"
                onClick={openAddConf}
                className="flex items-center justify-center gap-2.5 w-full focus:outline-none"
                style={{
                  fontFamily: OUTFIT,
                  fontWeight: 700,
                  fontSize: 14,
                  color: NEU.forest,
                  padding: cvEntries.length > 0 ? '14px 20px' : '22px 20px',
                  borderRadius: 18,
                  border: '2px dashed rgba(27,56,40,0.18)',
                  backgroundColor: NEU.surface,
                  boxShadow: NEU.outSm,
                  cursor: 'pointer',
                  transition: `all 200ms ${EASE}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.borderColor = NEU.forest; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(27,56,40,0.18)'; }}
              >
                <Plus size={17} strokeWidth={2.6} />
                {cvEntries.length > 0 ? 'Add another conference' : 'Add a conference'}
              </button>
            </div>

            <StepFooter
              onNext={finish}
              nextLabel={
                saving
                  ? 'Saving…'
                  : confCount > 0
                    ? `Finish${confCount > 1 ? ` · ${confCount} added` : ''}`
                    : 'Skip & finish'
              }
              primary={confCount > 0}
              disabled={saving}
            />
          </WizardShell>
        )}
      </div>

      {cvModalOpen && userId && (
        <CVEntryModal
          existing={cvModalEntry}
          userId={userId}
          onClose={() => { setCvModalOpen(false); setCvModalEntry(null); }}
          onSaved={fetchCvEntries}
          onDelete={handleDeleteCvEntry}
        />
      )}
    </div>
  );
}

// ── Added-conference summary row (mirrors the profile CV timeline card) ───────
// A compact read-back of a saved mun_cv_entries row: conference logo, name, and
// a role chip. Click to reopen the shared CVEntryModal and edit / delete it.

function ConfSummaryRow({ entry, onEdit }: { entry: CVEntry; onEdit: () => void }) {
  const type = ENTRY_TYPE_MAP[entry.entry_type] ?? ENTRY_TYPE_MAP.delegate;
  const detail =
    entry.entry_type === 'delegate' ? [entry.allocation, entry.committee].filter(Boolean).join(' · ')
    : entry.entry_type === 'chair' ? entry.committee
    : entry.allocation;

  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex items-center gap-3.5 w-full text-left focus:outline-none"
      style={{
        padding: '14px 16px',
        borderRadius: 18,
        border: `1.5px solid ${type.border}`,
        backgroundColor: NEU.surface,
        boxShadow: NEU.outSm,
        cursor: 'pointer',
        transition: `all 200ms ${EASE}`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
    >
      <LogoDisc src={entry.logo_url} size={44} fallbackText={monogramFor(entry.conference_name)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="truncate"
            style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink, letterSpacing: '-0.01em' }}
          >
            {entry.conference_name}
          </span>
          <span
            style={{
              fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: type.chipInk,
              padding: '2px 8px', borderRadius: 999,
              background: `linear-gradient(150deg, ${type.accent}1C, ${type.accent}0C), ${NEU.surface}`,
              border: `1px solid ${type.accent}33`,
            }}
          >
            {type.label}
          </span>
        </div>
        {detail && (
          <span
            className="block truncate"
            style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 500, color: NEU.muted, marginTop: 2 }}
          >
            {detail}
          </span>
        )}
      </div>
      <Pencil size={15} strokeWidth={2.2} style={{ color: NEU.muted, flexShrink: 0 }} />
    </button>
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
