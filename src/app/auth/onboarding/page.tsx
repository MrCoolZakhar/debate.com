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
import { UN_COUNTRIES, getCountryByName } from '@/lib/countries';
import { CountryField } from '@/components/CountryField';
import { DatePicker } from '@/components/DatePicker';
import { ageAt } from '@/lib/age';

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
  // ── Mandatory basics gate ────────────────────────────────────────────────
  // The e-mail sign-up form asks for nationality and date of birth and will not
  // submit without them. Google sign-up never passes through that form, so
  // those accounts land here with both blank — and a delegate with no
  // nationality and no age silently fails allocation and every age check a
  // conference runs. This screen is the only unskippable thing in onboarding,
  // and it only ever appears for a profile that is actually missing them.
  const [basicsNeeded, setBasicsNeeded] = useState<boolean | null>(null);
  const [basicsNationality, setBasicsNationality] = useState('');
  const [basicsDob, setBasicsDob] = useState('');
  const [basicsError, setBasicsError] = useState('');
  const [basicsSaving, setBasicsSaving] = useState(false);
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
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return;
      if (!data.user) { router.replace('/'); return; }
      setUserId(data.user.id);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('nationality, date_of_birth')
        .eq('id', data.user.id)
        .maybeSingle();
      if (cancelled) return;
      // A row we could not read is NOT a row with blanks in it. Raising the
      // gate on a transient fetch error, an RLS refusal, or a profiles row the
      // signup trigger has not committed yet would show an unskippable screen
      // whose save has nothing to update — the user would fill it in, be let
      // through, and still have no nationality. Fall through instead.
      if (error || !profile) { setBasicsNeeded(false); return; }
      const row = profile as { nationality: string | null; date_of_birth: string | null };
      setBasicsNationality(row.nationality ?? '');
      setBasicsDob(row.date_of_birth ?? '');
      setBasicsNeeded(!row.nationality || !row.date_of_birth);
    });
    return () => { cancelled = true; };
  }, [supabase, router]);

  async function saveBasics() {
    if (!userId || basicsSaving) return;
    setBasicsError('');
    const country = getCountryByName(basicsNationality);
    if (!country) { setBasicsError('Please choose your nationality from the list.'); return; }
    if (!basicsDob) { setBasicsError('Please enter your date of birth.'); return; }
    const age = ageAt(basicsDob);
    if (age === null || age < 0 || age > 120) { setBasicsError('That date of birth doesn’t look right.'); return; }
    if (age < 13) { setBasicsError('You need to be at least 13 to use Gavelling.'); return; }
    setBasicsSaving(true);
    // `.select('id')` is load-bearing: an update that matches zero rows comes
    // back with error === null, so without it a save that changed nothing
    // would let the user through with the fields still blank — exactly the
    // state this screen exists to prevent.
    const { data, error } = await supabase
      .from('profiles')
      .update({ nationality: country.name, date_of_birth: basicsDob })
      .eq('id', userId)
      .select('id');
    setBasicsSaving(false);
    if (error || !data || data.length === 0) {
      setBasicsError('Could not save that. Please refresh and try again.');
      return;
    }
    setBasicsNeeded(false);
  }

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
  // a fresh delegate lands on the home page, where CreditsWelcomeGate greets them.
  function postOnboardingDest(): string {
    if (typeof window === 'undefined') return '/';
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/auth/onboarding')) {
      return next;
    }
    return '/';
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

  // ── The one screen with no way past it ──────────────────────────────────
  // Rendered instead of the questionnaire, never alongside it, and only for a
  // profile actually missing these. `null` = still checking; showing the
  // questionnaire first and yanking it away would be worse than a beat of
  // nothing.
  if (basicsNeeded !== false) {
    return (
      <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: NEU.base ?? '#EDE7D8' }}>
        <div className="flex items-center" style={{ padding: '18px 22px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gavel-mark.png" alt="Gavelling" className="h-9 w-9 object-contain" />
        </div>
        {basicsNeeded === null ? (
          <div className="flex-1" />
        ) : (
          <div className="flex-1 flex items-start justify-center px-5 pb-16">
            <div className="w-full" style={{ maxWidth: 460 }}>
              <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 'clamp(26px, 4vw, 34px)', color: NEU.ink, margin: '18px 0 8px', lineHeight: 1.1 }}>
                Two things before you start
              </h1>
              <p style={{ fontFamily: OUTFIT, fontSize: 14.5, lineHeight: 1.6, color: NEU.inkSoft, margin: '0 0 26px' }}>
                Conferences allocate seats by delegation and several set an age range for their
                delegates. Without these two, an application of yours can be rejected at allocation
                rather than at the point you filled it in.
              </p>

              <label className="block text-sm font-semibold mb-1.5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                Nationality
              </label>
              <CountryField
                value={basicsNationality}
                onChange={(v) => { setBasicsNationality(v); setBasicsError(''); }}
                placeholder="Start typing a country..."
                inputStyle={{
                  backgroundColor: '#FAF8F3', border: '1.5px solid #DDD4C0', borderRadius: 12,
                  color: NEU.ink, fontFamily: OUTFIT, fontSize: 14, paddingTop: 12, paddingBottom: 12,
                }}
              />

              <label className="block text-sm font-semibold mb-1.5 mt-5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                Date of birth
              </label>
              <DatePicker
                value={basicsDob}
                onChange={(iso) => { setBasicsDob(iso); setBasicsError(''); }}
                max={new Date().toISOString().slice(0, 10)}
                initialView="2005-06-15"
                placeholder="Select your date of birth"
              />
              <p className="text-xs mt-1.5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
                You must be at least 13. Only your age is ever shown to a conference, never the date.
              </p>

              {basicsError && (
                <p role="alert" className="text-sm mt-4" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                  {basicsError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void saveBasics()}
                disabled={basicsSaving}
                className="w-full mt-6 rounded-xl focus:outline-none"
                style={{
                  padding: '14px 20px', backgroundColor: NEU.forest, color: NEU.gold,
                  fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, letterSpacing: '0.08em',
                  border: 'none', cursor: basicsSaving ? 'wait' : 'pointer',
                  opacity: basicsSaving ? 0.7 : 1,
                  boxShadow: '0 8px 22px rgba(27,56,40,0.22)',
                  transition: `background-color 160ms ${EASE}`,
                }}
              >
                {basicsSaving ? 'SAVING…' : 'CONTINUE'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
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
            // The escape hatch is a sentence the new user has to read to know
            // they can leave. NEU.muted is 2.71:1 on the ivory page and fails
            // AA; inkSoft is 6.44:1.
            color: NEU.inkSoft,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: `color 180ms ${EASE}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.forest; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.inkSoft; }}
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
            <CardSelect options={LEVEL_OPTIONS} value={level} onChange={pickLevel} columns={2} size="lg" />
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
            // The only place the saved allocation / committee is read back,
            // so it has to be legible: NEU.muted is 2.78:1 on the card surface.
            style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 500, color: NEU.inkSoft, marginTop: 2 }}
          >
            {detail}
          </span>
        )}
      </div>
      {/* Not decorative: this glyph is the only standing cue that the row is
          editable, so it owes the 3:1 non-text minimum. NEU.muted is 2.78:1. */}
      <Pencil size={15} strokeWidth={2.2} style={{ color: NEU.inkSoft, flexShrink: 0 }} />
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
          // Matches WizardFooter in the conference apply flow: the skip link
          // is real copy, so it takes inkSoft (6.44:1) rather than muted.
          color: primary ? NEU.gold : NEU.inkSoft,
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
