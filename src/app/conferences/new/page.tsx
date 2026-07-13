'use client';

/**
 * /conferences/new — page-by-page conference creation wizard.
 *
 * One question per screen, built on the shared wizard kit
 * (src/components/wizard.tsx). The submit logic writes exactly the same
 * columns as the old two-step form and redirects to /manage/{slug}.
 * Optional fields from the old form (description, socials, banner,
 * visibility, previous editions) are deferred to Settings after creation.
 *
 * Progress lives in component state only — a refresh restarts the wizard.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, CalendarDays, Mail, Pencil } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@supabase/supabase-js';
import { generateSlug } from '@/lib/utils';
import { UN_COUNTRIES } from '@/lib/countries';
import { FlagImg } from '@/components/FlagImg';
import { WizardShell, TwoTabPick, CardSelect } from '@/components/wizard';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuButton, NeuInset, Emoji3D } from '@/components/neu';

// Mirrors settings' ensureRoleConfigs default set (source of truth there) —
// seeded here too so a freshly created conference already has per-role fee
// configs instead of relying on that lazy $0-delegate-fee fallback.
const ROLE_DEFAULTS = ['delegate', 'chair', 'head-delegate', 'faculty-advisor', 'observer'] as const;

// ── Step model ─────────────────────────────────────────────────────────────

const TOTAL_STEPS = 8;
// 1 name+acronym · 2 format · 3 level · 4 where · 5 when · 6 delegates · 7 fee · 8 review

const DELEGATE_RANGES = [
  { key: '50', label: 'Up to 50', sub: 'Intimate', emoji: 'Bust in silhouette' },
  { key: '100', label: '~100', sub: 'Mid-size', emoji: 'Busts in silhouette' },
  { key: '250', label: '~250', sub: 'Large', emoji: 'People with bunny ears' },
  { key: '500', label: '500+', sub: 'Flagship', emoji: 'Globe showing europe-africa' },
];

// ── Small shared bits ──────────────────────────────────────────────────────

const bigInputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: NEU.base,
  border: '1.5px solid transparent',
  borderRadius: 16,
  padding: '15px 18px',
  fontSize: 16,
  fontWeight: 600,
  color: NEU.ink,
  fontFamily: OUTFIT,
  outline: 'none',
  boxShadow: NEU.inSm,
  transition: `border-color 180ms ${EASE}`,
};

function focusForest(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = NEU.forest;
}
function blurClear(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'transparent';
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
        color: NEU.muted, textTransform: 'uppercase', marginBottom: 8,
      }}
    >
      {children}
    </p>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="flex items-center gap-1.5"
      style={{ color: NEU.amber, fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, marginTop: 8 }}
    >
      <AlertTriangle size={14} />
      {children}
    </p>
  );
}

/** Subtle third choice under a TwoTabPick (hybrid / both). */
function TertiaryPick({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus:outline-none"
      style={{
        marginTop: 14,
        padding: '9px 20px',
        borderRadius: 999,
        border: selected ? `2px solid ${NEU.forest}` : '2px solid rgba(27,56,40,0.14)',
        backgroundColor: selected ? NEU.surface : 'transparent',
        boxShadow: selected ? NEU.outSm : 'none',
        color: selected ? NEU.forest : NEU.muted,
        fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
        cursor: 'pointer',
        transition: `all 220ms ${EASE}`,
      }}
    >
      {label}
    </button>
  );
}

function ContinueButton({ label = 'Continue', disabled, onClick }: { label?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-center" style={{ marginTop: 26 }}>
      <NeuButton onClick={onClick} disabled={disabled} icon={ArrowRight} style={{ padding: '13px 34px', fontSize: 14 }}>
        {label}
      </NeuButton>
    </div>
  );
}

// ── Acronym suggestion ─────────────────────────────────────────────────────

const STOP_WORDS = new Set(['the', 'of', 'and', 'for', 'a', 'an', 'in', 'on', 'at']);

function suggestAcronym(fullName: string): string {
  const initials = fullName
    .split(/[\s-]+/)
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase())
    .join('');
  if (!initials) return '';
  // The directory requires 'MUN' in the acronym. "Model United Nations" in the
  // name already yields …MUN; otherwise append it as a friendly starting point.
  return initials.includes('MUN') ? initials : initials + 'MUN';
}

function acronymProblem(acr: string): string {
  const upper = acr.toUpperCase();
  if (upper.length < 4) return 'Acronym must be at least 4 characters.';
  if (!upper.includes('MUN')) return "Acronym must include 'MUN' — e.g. TEIMUN, LIMUN, SMUNC.";
  return '';
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function NewConferencePage() {
  const router = useRouter();
  const { user, session, profile, loading } = useAuth();

  function getAuthedClient() {
    return createClient(
      'https://luruhkwrgisytejswlas.supabase.co',
      'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV',
      session ? { global: { headers: { Authorization: 'Bearer ' + session.access_token } } } : {}
    );
  }

  // Auth gate — unchanged from the old form.
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/signin?next=/conferences/new');
    }
  }, [loading, user, router]);

  const [step, setStep] = useState(1);
  const [returnToReview, setReturnToReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');

  // Answers
  const [fullName, setFullName] = useState('');
  const [acronym, setAcronym] = useState('');
  const acronymTouched = useRef(false);
  const [contactEmail, setContactEmail] = useState('');
  const [format, setFormat] = useState<'in-person' | 'online' | 'hybrid' | ''>('');
  const [studentLevel, setStudentLevel] = useState<'school' | 'university' | 'both' | ''>('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [delegateRange, setDelegateRange] = useState('');
  const [expectedDelegates, setExpectedDelegates] = useState('');
  const [feeKind, setFeeKind] = useState<'free' | 'paid' | ''>('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeCurrency, setFeeCurrency] = useState('GBP');

  // Pre-fill email from profile (same behaviour as the old form).
  useEffect(() => {
    if (profile?.email && !contactEmail) setContactEmail(profile.email);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.email]);

  const acronymError = acronym ? acronymProblem(acronym) : '';

  const countryOptions = useMemo(
    () =>
      UN_COUNTRIES.map((c) => ({
        key: c.name,
        label: c.name,
        icon: <FlagImg code={c.code} size={30} />,
      })),
    [],
  );

  function goTo(next: number) {
    setStepError('');
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function advance(from: number) {
    if (returnToReview) {
      setReturnToReview(false);
      goTo(8);
    } else {
      goTo(from + 1);
    }
  }

  function editFromReview(target: number) {
    setReturnToReview(true);
    goTo(target);
  }

  function back() {
    if (returnToReview) {
      setReturnToReview(false);
      goTo(8);
    } else if (step > 1) {
      goTo(step - 1);
    }
  }

  // ── Submit — preserved exactly from the old form ─────────────────────────
  async function handleCreate() {
    if (!user || !session) {
      setError('You must be signed in to create a conference.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const supabase = getAuthedClient();

      const baseSlug = generateSlug(fullName);
      const slug = baseSlug + '-' + Math.random().toString(36).substring(2, 7);
      // Minted client-side so the role-config seeding insert below can
      // reference this conference without reading it back (see the
      // RETURNING/RLS note just below).
      const conferenceId = crypto.randomUUID();

      // No .select() after insert: the new row is only SELECT-visible once the
      // ownership trigger has run, so RETURNING fails RLS for private conferences.
      // We already know the slug — we generated it.
      const { error: dbError } = await supabase
        .from('conferences')
        .insert({
          id: conferenceId,
          slug,
          organizer_id: user.id,
          full_name: fullName,
          acronym: acronym.toUpperCase(),
          contact_email: contactEmail,
          student_level: studentLevel,
          start_date: startDate,
          end_date: endDate,
          country,
          city,
          format,
          expected_delegates: parseInt(expectedDelegates),
          fee_amount: feeKind === 'paid' ? parseFloat(feeAmount) || 0 : 0,
          fee_currency: feeCurrency,
          description: null,
          instagram_url: null,
          facebook_url: null,
          tiktok_url: null,
          whatsapp_url: null,
          website_url: null,
          banner_url: null,
          is_public: false,
          status: 'private',
          predecessor_conference_id: null,
        });

      if (dbError) {
        setSubmitting(false);
        setError('Failed to create conference: ' + dbError.message);
        return;
      }

      // Seed default per-role application configs so the delegate fee
      // entered above is the role config's fee from day one — otherwise
      // Settings' own ensureRoleConfigs seeds it lazily with a $0 delegate
      // fee the first time the organizer opens Settings, disagreeing with
      // the fee just entered here. Non-fatal: that lazy fallback still
      // covers this conference if the insert below fails.
      const { error: roleConfigError } = await supabase.from('application_role_configs').insert(
        ROLE_DEFAULTS.map(role => ({
          conference_id: conferenceId,
          role,
          is_enabled: role === 'delegate' || role === 'chair',
          fee_amount: role === 'delegate' ? (parseFloat(feeAmount) || 0) : 0,
          fee_currency: feeCurrency,
          auto_accept: false,
          payment_timing: 'anytime' as const,
          custom_questions: [],
        }))
      );
      if (roleConfigError) {
        console.error('Failed to seed role configs:', roleConfigError.message);
      }

      setSubmitting(false);
      router.push('/manage/' + slug);
    } catch (err) {
      setSubmitting(false);
      setError('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  // ── Per-step validation before advancing ─────────────────────────────────

  function continueStep1() {
    if (!fullName.trim()) { setStepError('Give your conference its full name.'); return; }
    const problem = acronymProblem(acronym);
    if (problem) { setStepError(problem); return; }
    advance(1);
  }

  function continueStep4() {
    if (!country) { setStepError('Pick the country your conference is in.'); return; }
    if (!city.trim()) { setStepError('And the city — delegates will look for it.'); return; }
    advance(4);
  }

  function continueStep5() {
    if (!startDate || !endDate) { setStepError('Pick both a start and an end date.'); return; }
    if (endDate < startDate) { setStepError('The end date cannot be before the start date.'); return; }
    advance(5);
  }

  function continueStep6() {
    const n = parseInt(expectedDelegates);
    if (!expectedDelegates || isNaN(n) || n < 1) { setStepError('Give us a rough number of delegates.'); return; }
    advance(6);
  }

  function continueStep7() {
    if (!feeKind) { setStepError('Is your conference free or paid?'); return; }
    if (feeKind === 'paid') {
      const amt = parseFloat(feeAmount);
      if (!feeAmount || isNaN(amt) || amt <= 0) { setStepError('Enter the delegate fee amount.'); return; }
    }
    advance(7);
  }

  const readyToCreate =
    fullName.trim() && acronym.trim() && !acronymProblem(acronym) && contactEmail.trim() &&
    studentLevel && startDate && endDate && country && city.trim() && format &&
    expectedDelegates && parseInt(expectedDelegates) > 0 &&
    (feeKind === 'free' || (feeKind === 'paid' && parseFloat(feeAmount) > 0));

  // Loading / auth spinner
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
        <div
          className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: NEU.base }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        <main className="flex-1 flex justify-center px-5 py-10">
          <div className="w-full">

            {/* ── Step 1 — name + acronym ─────────────────────────────── */}
            {step === 1 && (
              <WizardShell
                step={1} total={TOTAL_STEPS}
                title="What's your conference called?"
                sub="The full name delegates will see — and the short acronym everyone actually uses."
                onBack={returnToReview ? back : undefined}
              >
                <div className="flex flex-col gap-5">
                  <div>
                    <FieldLabel>Full conference name</FieldLabel>
                    <input
                      type="text"
                      value={fullName}
                      autoFocus
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (!acronymTouched.current) setAcronym(suggestAcronym(e.target.value));
                      }}
                      placeholder="e.g. The European International Model United Nations"
                      style={bigInputStyle}
                      onFocus={focusForest}
                      onBlur={blurClear}
                    />
                  </div>
                  <div>
                    <FieldLabel>Short name / acronym</FieldLabel>
                    <input
                      type="text"
                      value={acronym}
                      onChange={(e) => {
                        acronymTouched.current = true;
                        setAcronym(e.target.value.toUpperCase());
                      }}
                      placeholder="e.g. TEIMUN"
                      style={{ ...bigInputStyle, letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' }}
                      onFocus={focusForest}
                      onBlur={blurClear}
                    />
                    {acronymError ? (
                      <ErrorNote>{acronymError}</ErrorNote>
                    ) : (
                      <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, marginTop: 8 }}>
                        Suggested from your conference name — every Gavelling acronym includes &lsquo;MUN&rsquo;.
                      </p>
                    )}
                  </div>
                </div>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={continueStep1} disabled={!fullName.trim() || !acronym.trim() || !!acronymError} />
              </WizardShell>
            )}

            {/* ── Step 2 — format ─────────────────────────────────────── */}
            {step === 2 && (
              <WizardShell
                step={2} total={TOTAL_STEPS}
                title="In person or online?"
                sub="How will delegates attend your conference?"
                onBack={back}
              >
                <TwoTabPick
                  options={[
                    { key: 'in-person', label: 'In Person', image: '/onboarding/hall-01.jpg', sub: 'A real venue, real gavels' },
                    { key: 'online', label: 'Online', image: '/onboarding/laptop-01.jpg', sub: 'Fully remote committees' },
                  ]}
                  value={format || null}
                  onChange={(k) => { setFormat(k as 'in-person' | 'online'); setStepError(''); }}
                />
                <div className="flex justify-center">
                  <TertiaryPick label="A bit of both — it's hybrid" selected={format === 'hybrid'} onClick={() => { setFormat('hybrid'); setStepError(''); }} />
                </div>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={() => (format ? advance(2) : setStepError('Pick how delegates will attend.'))} disabled={!format} />
              </WizardShell>
            )}

            {/* ── Step 3 — level ──────────────────────────────────────── */}
            {step === 3 && (
              <WizardShell
                step={3} total={TOTAL_STEPS}
                title="High school or university level?"
                sub="Who is your conference for?"
                onBack={back}
              >
                <TwoTabPick
                  options={[
                    { key: 'school', label: 'High School', image: '/onboarding/classroom-01.jpg', sub: 'Secondary-school delegates' },
                    { key: 'university', label: 'University', image: '/onboarding/campus-01.jpg', sub: 'University students and above' },
                  ]}
                  value={studentLevel || null}
                  onChange={(k) => { setStudentLevel(k as 'school' | 'university'); setStepError(''); }}
                />
                <div className="flex justify-center">
                  <TertiaryPick label="Open to both" selected={studentLevel === 'both'} onClick={() => { setStudentLevel('both'); setStepError(''); }} />
                </div>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={() => (studentLevel ? advance(3) : setStepError('Pick your delegate level.'))} disabled={!studentLevel} />
              </WizardShell>
            )}

            {/* ── Step 4 — where ──────────────────────────────────────── */}
            {step === 4 && (
              <WizardShell
                step={4} total={TOTAL_STEPS}
                title="Where is it happening?"
                sub="Country first, then the city."
                onBack={back}
              >
                <CardSelect
                  options={countryOptions}
                  value={country || null}
                  onChange={(k) => { setCountry(k); setStepError(''); }}
                  searchable
                  columns={3}
                />
                <div style={{ marginTop: 18 }}>
                  <FieldLabel>City</FieldLabel>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. The Hague"
                    style={bigInputStyle}
                    onFocus={focusForest}
                    onBlur={blurClear}
                  />
                </div>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={continueStep4} disabled={!country || !city.trim()} />
              </WizardShell>
            )}

            {/* ── Step 5 — when ───────────────────────────────────────── */}
            {step === 5 && (
              <WizardShell
                step={5} total={TOTAL_STEPS}
                title="When does it run?"
                sub="First and last day of the conference."
                onBack={back}
              >
                <NeuInset style={{ padding: '20px 22px', borderRadius: 20 }}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>First day</FieldLabel>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: NEU.muted }}>
                          <CalendarDays size={16} />
                        </span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value); }}
                          style={{ ...bigInputStyle, backgroundColor: NEU.surface, boxShadow: NEU.outSm, paddingLeft: 40, fontVariantNumeric: 'tabular-nums' }}
                          onFocus={focusForest}
                          onBlur={blurClear}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Last day</FieldLabel>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: NEU.muted }}>
                          <CalendarDays size={16} />
                        </span>
                        <input
                          type="date"
                          value={endDate}
                          min={startDate || undefined}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{ ...bigInputStyle, backgroundColor: NEU.surface, boxShadow: NEU.outSm, paddingLeft: 40, fontVariantNumeric: 'tabular-nums' }}
                          onFocus={focusForest}
                          onBlur={blurClear}
                        />
                      </div>
                    </div>
                  </div>
                </NeuInset>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={continueStep5} disabled={!startDate || !endDate} />
              </WizardShell>
            )}

            {/* ── Step 6 — expected delegates ─────────────────────────── */}
            {step === 6 && (
              <WizardShell
                step={6} total={TOTAL_STEPS}
                title="How many delegates do you expect?"
                sub="A rough number is fine — you can refine it later."
                onBack={back}
              >
                <CardSelect
                  options={DELEGATE_RANGES.map((r) => ({
                    key: r.key,
                    label: r.label,
                    sub: r.sub,
                    icon: <Emoji3D name={r.emoji} size={34} />,
                  }))}
                  value={delegateRange || null}
                  onChange={(k) => { setDelegateRange(k); setExpectedDelegates(k); setStepError(''); }}
                  columns={4}
                />
                <div style={{ marginTop: 18 }}>
                  <FieldLabel>Or an exact number</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    value={expectedDelegates}
                    onChange={(e) => { setExpectedDelegates(e.target.value); setDelegateRange(''); }}
                    placeholder="e.g. 300"
                    style={{ ...bigInputStyle, fontVariantNumeric: 'tabular-nums' }}
                    onFocus={focusForest}
                    onBlur={blurClear}
                  />
                </div>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={continueStep6} disabled={!expectedDelegates || parseInt(expectedDelegates) < 1} />
              </WizardShell>
            )}

            {/* ── Step 7 — fee ────────────────────────────────────────── */}
            {step === 7 && (
              <WizardShell
                step={7} total={TOTAL_STEPS}
                title="Is there a delegate fee?"
                sub="Free conferences fill fast. Paid fees are collected per delegate."
                onBack={back}
              >
                <TwoTabPick
                  options={[
                    { key: 'free', label: 'Free', icon: <Emoji3D name="Party popper" size={52} />, sub: 'No delegate fee' },
                    { key: 'paid', label: 'Paid', icon: <Emoji3D name="Money bag" size={52} />, sub: 'Delegates pay to attend' },
                  ]}
                  value={feeKind || null}
                  onChange={(k) => { setFeeKind(k as 'free' | 'paid'); setStepError(''); }}
                />
                {feeKind === 'paid' && (
                  <NeuInset style={{ padding: '18px 20px', borderRadius: 20, marginTop: 18 }}>
                    <FieldLabel>Delegate fee</FieldLabel>
                    <div className="flex gap-3">
                      <select
                        value={feeCurrency}
                        onChange={(e) => setFeeCurrency(e.target.value)}
                        style={{ ...bigInputStyle, width: 110, cursor: 'pointer', backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
                        onFocus={focusForest}
                        onBlur={blurClear}
                      >
                        {['GBP', 'USD', 'EUR', 'CHF'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                        style={{ ...bigInputStyle, flex: 1, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontVariantNumeric: 'tabular-nums' }}
                        onFocus={focusForest}
                        onBlur={blurClear}
                      />
                    </div>
                    <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, marginTop: 10, lineHeight: 1.5 }}>
                      Gavelling adds a 5% surcharge for delegates without Gavelling Unlimited.
                    </p>
                  </NeuInset>
                )}
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton
                  label="Review"
                  onClick={continueStep7}
                  disabled={!feeKind || (feeKind === 'paid' && !(parseFloat(feeAmount) > 0))}
                />
              </WizardShell>
            )}

            {/* ── Step 8 — review + create ────────────────────────────── */}
            {step === 8 && (
              <WizardShell
                step={8} total={TOTAL_STEPS}
                title="Ready to create it?"
                sub="Check everything over — tap any row to change it."
                onBack={back}
              >
                <div className="flex flex-col gap-2.5">
                  <ReviewRow label="Conference" value={`${fullName} (${acronym.toUpperCase()})`} onEdit={() => editFromReview(1)} />
                  <ReviewRow label="Format" value={format === 'in-person' ? 'In person' : format === 'online' ? 'Online' : 'Hybrid'} onEdit={() => editFromReview(2)} />
                  <ReviewRow label="Level" value={studentLevel === 'school' ? 'High school' : studentLevel === 'university' ? 'University' : 'Both'} onEdit={() => editFromReview(3)} />
                  <ReviewRow label="Location" value={`${city}, ${country}`} onEdit={() => editFromReview(4)} />
                  <ReviewRow label="Dates" value={formatDateRange(startDate, endDate)} onEdit={() => editFromReview(5)} />
                  <ReviewRow label="Expected delegates" value={expectedDelegates} onEdit={() => editFromReview(6)} />
                  <ReviewRow
                    label="Fee"
                    value={feeKind === 'free' ? 'Free' : `${feeCurrency} ${parseFloat(feeAmount || '0').toFixed(2)} per delegate`}
                    onEdit={() => editFromReview(7)}
                  />
                </div>

                {/* Contact email — required by the directory, prefilled from your profile */}
                <div style={{ marginTop: 20 }}>
                  <FieldLabel>Organizer contact email</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: NEU.muted }}>
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="conference@example.com"
                      style={{ ...bigInputStyle, paddingLeft: 42, fontSize: 14 }}
                      onFocus={focusForest}
                      onBlur={blurClear}
                    />
                  </div>
                </div>

                <p
                  style={{
                    fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, lineHeight: 1.6,
                    textAlign: 'center', marginTop: 22, padding: '0 12px',
                  }}
                >
                  Description, banner, social links, visibility and previous editions —
                  you can set everything else later in Settings. Your conference starts private.
                </p>

                {error && (
                  <div
                    className="mt-4 px-4 py-3 rounded-xl text-sm"
                    style={{
                      backgroundColor: 'rgba(139, 32, 32, 0.08)',
                      border: '1px solid rgba(139, 32, 32, 0.2)',
                      color: '#8B2020',
                      fontFamily: OUTFIT,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div className="flex justify-center" style={{ marginTop: 24 }}>
                  <NeuButton
                    onClick={handleCreate}
                    disabled={submitting || !readyToCreate || !contactEmail.trim()}
                    gradient={NEU_GRADIENTS.gold}
                    style={{ padding: '15px 44px', fontSize: 15 }}
                  >
                    {submitting ? 'CREATING…' : 'CREATE CONFERENCE'}
                  </NeuButton>
                </div>
              </WizardShell>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

// ── Review row ─────────────────────────────────────────────────────────────

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 text-left focus:outline-none"
      style={{
        padding: '13px 18px',
        borderRadius: 16,
        border: 'none',
        backgroundColor: NEU.surface,
        boxShadow: hovered ? NEU.outSmHover : NEU.outSm,
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: `all 220ms ${EASE}`,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em',
          color: NEU.muted, textTransform: 'uppercase', width: 132, flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        className="flex-1 truncate"
        style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
      <Pencil size={14} style={{ color: hovered ? NEU.forest : NEU.muted, flexShrink: 0, transition: `color 220ms ${EASE}` }} />
    </button>
  );
}

function formatDateRange(start: string, end: string): string {
  if (!start || !end) return '';
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}
