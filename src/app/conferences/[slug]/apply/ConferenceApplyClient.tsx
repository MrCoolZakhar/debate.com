'use client';

import { Fragment, Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { getFlagUrl } from '@/lib/countries';
import { ageAt } from '@/lib/age';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// ── Types ──────────────────────────────────────────────────────────────────

interface Conference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  fee_amount: number;
  fee_currency: string;
  start_date: string;
  min_age: number | null;
}

interface RoleConfig {
  role: string;
  is_enabled: boolean;
  applications_open_at: string | null;
  applications_close_at: string | null;
  fee_amount: number;
  fee_currency: string;
  auto_accept: boolean;
  pay_at_application: boolean;
  custom_questions: Array<{ id: string; label: string; required: boolean; type: string }>;
}

interface CommitteeOption {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[];
  difficulty: string;
  total_slots: number;
}

interface CountrySlot {
  id: string;
  country_code: string;
  country_name: string;
}

interface Society {
  id: string;
  name: string;
  name_normalized: string;
}

interface Preference {
  committeeId: string;
  committeeName: string;
  countryCode: string;
  countryName: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function currencySymbol(currency: string): string {
  const map: Record<string, string> = {
    GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$',
    CHF: 'CHF ', JPY: '¥', CNY: '¥', INR: '₹', BRL: 'R$', MXN: 'MX$',
  };
  return map[currency?.toUpperCase()] ?? (currency + ' ');
}

// ── Inner component (requires Suspense for useSearchParams) ────────────────

function ConferenceApplyInner() {
  const { slug } = useParams() as { slug: string };
  const searchParams = useSearchParams();
  const role = searchParams.get('role') ?? 'delegate';
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  // ── Data
  const [conference, setConference] = useState<Conference | null>(null);
  const [roleConfig, setRoleConfig] = useState<RoleConfig | null | undefined>(undefined);
  const [committees, setCommittees] = useState<CommitteeOption[]>([]);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [existingApp, setExistingApp] = useState<{ id: string; status: string } | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Age gate (conference.min_age) — DOB comes from the user's profile
  const [myDob, setMyDob] = useState<string | null>(null);
  const [dobInput, setDobInput] = useState('');
  const [dobSaving, setDobSaving] = useState(false);
  const [dobError, setDobError] = useState('');

  // ── Step
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Step 2 — Society
  const [isIndependent, setIsIndependent] = useState(false);
  const [societyInput, setSocietyInput] = useState('');
  const [societySuggestions, setSocietySuggestions] = useState<Society[]>([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState<string | null>(null);
  const [isHeadDelegate, setIsHeadDelegate] = useState(false);
  const [societyDropdownOpen, setSocietyDropdownOpen] = useState(false);
  const [societyError, setSocietyError] = useState('');

  // ── Step 3 — Preferences
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [countrySlots, setCountrySlots] = useState<Record<string, CountrySlot[]>>({});
  const [prefError, setPrefError] = useState('');

  // ── Step 4 — Experience & Questions
  const [experienceLevel, setExperienceLevel] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  // ── Age gate derivations — age is computed at the conference START DATE
  const minAgeLimit = conference?.min_age ?? null;
  const ageAtStart = minAgeLimit != null && myDob && conference ? ageAt(myDob, conference.start_date) : null;
  const underAge = minAgeLimit != null && ageAtStart !== null && ageAtStart < minAgeLimit;
  const needsDob = minAgeLimit != null && !myDob;

  const isPreferenceRole = role === 'delegate' || role === 'head-delegate';
  const isObserver = role === 'observer';
  const totalSteps = isPreferenceRole ? 4 : 3;
  const stepLabels = isPreferenceRole
    ? ['Role', 'Society', 'Preferences', 'Experience']
    : ['Role', isObserver ? 'Background' : 'Society', 'Experience'];

  // ── Auth gate + fetch
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth/signin?next=/conferences/${slug}/apply?role=${role}`);
      return;
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, slug, role]);

  async function fetchAll() {
    setLoading(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);

    const { data: confData } = await supabase
      .from('conferences')
      .select('id, slug, full_name, acronym, fee_amount, fee_currency, start_date, min_age')
      .eq('slug', slug)
      .single();

    if (!confData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setConference(confData as Conference);

    const [roleRes, committeesRes, societiesRes, appRes, profileRes] = await Promise.all([
      supabase
        .from('application_role_configs')
        .select('*')
        .eq('conference_id', confData.id)
        .eq('role', role)
        .maybeSingle(),
      supabase
        .from('conference_committees')
        .select('id, name, abbreviation, topics, difficulty, total_slots')
        .eq('conference_id', confData.id)
        .order('name', { ascending: true }),
      supabase
        .from('societies')
        .select('id, name, name_normalized')
        .eq('conference_id', confData.id)
        .order('name', { ascending: true }),
      supabase
        .from('applications')
        .select('id, status')
        .eq('conference_id', confData.id)
        .eq('user_id', user!.id)
        .eq('role', role)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('date_of_birth')
        .eq('id', user!.id)
        .maybeSingle(),
    ]);

    setRoleConfig((roleRes.data as RoleConfig) ?? null);
    setCommittees((committeesRes.data as CommitteeOption[]) ?? []);
    setSocieties((societiesRes.data as Society[]) ?? []);
    setExistingApp((appRes.data as { id: string; status: string }) ?? null);
    setMyDob((profileRes.data as { date_of_birth: string | null } | null)?.date_of_birth ?? null);
    setLoading(false);
  }

  // Society autocomplete
  useEffect(() => {
    if (!societyInput.trim()) {
      setSocietySuggestions([]);
      setSocietyDropdownOpen(false);
      return;
    }
    const q = societyInput.toLowerCase();
    const filtered = societies.filter(s => s.name.toLowerCase().includes(q));
    setSocietySuggestions(filtered);
    setSocietyDropdownOpen(true);
  }, [societyInput, societies]);

  async function fetchSlotsForCommittee(committeeId: string) {
    if (countrySlots[committeeId]) return;
    if (!session) return;
    setLoadingSlots(true);
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('committee_country_slots')
      .select('id, country_code, country_name')
      .eq('conference_committee_id', committeeId)
      .order('country_name', { ascending: true });
    setCountrySlots(prev => ({ ...prev, [committeeId]: (data as CountrySlot[]) ?? [] }));
    setLoadingSlots(false);
  }

  async function handleSaveDob() {
    if (!session || !user) return;
    setDobError('');
    const age = ageAt(dobInput);
    if (age === null || age < 0 || age > 120) {
      setDobError('That date of birth doesn’t look right — please double-check it.');
      return;
    }
    setDobSaving(true);
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('profiles').update({ date_of_birth: dobInput }).eq('id', user.id);
    setDobSaving(false);
    if (error) {
      setDobError('Your date of birth could not be saved. Please try again.');
      return;
    }
    setMyDob(dobInput);
  }

  function handleContinue() {
    if (step === 2) {
      if (!isObserver && !isIndependent && !societyInput.trim()) {
        setSocietyError('Please enter your society name.');
        return;
      }
      setSocietyError('');
      setStep(s => s + 1);
      return;
    }
    if (step === 3 && isPreferenceRole) {
      if (preferences.length < 3) {
        setPrefError('Please add at least 3 preferences.');
        return;
      }
      const allFilled = preferences.every(p => p.committeeId && p.countryCode);
      if (!allFilled) {
        setPrefError('Please complete all preferences (select a committee and country for each).');
        return;
      }
      setPrefError('');
      setStep(s => s + 1);
      return;
    }
    setStep(s => s + 1);
  }

  async function handleSubmit() {
    if (needsDob || underAge) {
      setSubmitError(
        minAgeLimit != null
          ? `This conference requires delegates to be at least ${minAgeLimit} years old.`
          : 'This conference has an age requirement you do not meet.'
      );
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    if (!session) { setSubmitError('Session expired. Please sign in again.'); setSubmitting(false); return; }
    const supabase = getAuthedClient(session.access_token);

    try {
      let societyId: string | null = null;
      if (!isIndependent && !isObserver && societyInput.trim()) {
        if (selectedSocietyId) {
          societyId = selectedSocietyId;
        } else {
          const normalized = societyInput.trim().toLowerCase();
          const { data: existingSoc } = await supabase
            .from('societies')
            .select('id')
            .eq('conference_id', conference!.id)
            .eq('name_normalized', normalized)
            .maybeSingle();

          if (existingSoc) {
            societyId = (existingSoc as { id: string }).id;
          } else {
            const { data: newSoc } = await supabase
              .from('societies')
              .insert({ conference_id: conference!.id, name: societyInput.trim(), name_normalized: normalized })
              .select('id')
              .single();
            societyId = (newSoc as { id: string } | null)?.id ?? null;
          }
        }
      }

      const { data: app, error: appError } = await supabase
        .from('applications')
        .insert({
          conference_id: conference!.id,
          user_id: user!.id,
          role,
          status: roleConfig?.auto_accept ? 'accepted' : 'submitted',
          is_independent: isIndependent,
          society_id: societyId,
          is_head_delegate: isHeadDelegate && !isIndependent,
          experience_level: experienceLevel || null,
          custom_answers: customAnswers,
          payment_status: 'unpaid',
        })
        .select('id')
        .single();

      if (appError) throw appError;

      if (isPreferenceRole && preferences.length > 0) {
        const prefRows = preferences.map((p, i) => ({
          application_id: (app as { id: string }).id,
          preference_order: i + 1,
          conference_committee_id: p.committeeId,
          country_code: p.countryCode,
          country_name: p.countryName,
        }));
        await supabase.from('application_preferences').insert(prefRows);
      }

      router.push(`/conferences/${slug}/apply/confirmation?role=${role}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(msg);
      setSubmitting(false);
    }
  }

  // ── Step render helpers ───────────────────────────────────────────────────

  function renderStep1() {
    const rc = roleConfig!;
    return (
      <>
        <h2 className="font-semibold text-base mb-4" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Applying as
        </h2>

        <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'rgba(27,56,40,0.06)', border: '1px solid rgba(27,56,40,0.15)' }}>
          <p className="font-black text-xl capitalize" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            {role.replace(/-/g, ' ')}
          </p>
          <p className="text-sm mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            {conference?.full_name}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {rc.fee_amount > 0 ? (
              <span className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                Registration fee: {currencySymbol(rc.fee_currency)}{rc.fee_amount}
              </span>
            ) : (
              <span className="text-sm" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>
                No registration fee
              </span>
            )}
            {rc.auto_accept && (
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(61,122,82,0.1)', color: '#1B3828', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}
              >
                AUTO-ACCEPTED
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'rgba(238,217,138,0.08)', border: '1px solid rgba(238,217,138,0.2)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(28,20,16,0.7)', fontFamily: "'Outfit', sans-serif" }}>
            By applying you confirm you meet the requirements for this role. Your application will be reviewed by the conference organizing team.
          </p>
        </div>

        <button
          onClick={() => setStep(2)}
          className="w-full rounded-xl py-3 font-bold text-sm focus:outline-none transition-colors"
          style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          CONTINUE →
        </button>
      </>
    );
  }

  function renderStep2() {
    const showSociety = !isObserver;
    return (
      <>
        <h2 className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          {isObserver ? 'Background' : 'Your Delegation'}
        </h2>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          {showSociety
            ? 'Are you applying independently or as part of a school/society?'
            : 'As an observer, no delegation information is required.'}
        </p>

        {showSociety && (
          <>
            {/* Toggle */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {(['independent', 'society'] as const).map(type => {
                const selected = type === 'independent' ? isIndependent : !isIndependent;
                return (
                  <button
                    key={type}
                    onClick={() => setIsIndependent(type === 'independent')}
                    className="relative rounded-xl p-4 text-center focus:outline-none transition-all"
                    style={{
                      border: selected ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                      backgroundColor: selected ? 'rgba(27,56,40,0.06)' : 'transparent',
                    }}
                  >
                    <div
                      className="absolute top-3 right-3 w-4 h-4 rounded-full border"
                      style={selected
                        ? { backgroundColor: '#1B3828', borderColor: '#1B3828' }
                        : { backgroundColor: 'transparent', borderColor: '#DDD4C0' }}
                    />
                    <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
                      {type === 'independent' ? 'INDEPENDENT' : 'WITH A SOCIETY'}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Society input */}
            {!isIndependent && (
              <>
                <div className="relative">
                  <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                    Society / School Name
                  </label>
                  <input
                    type="text"
                    value={societyInput}
                    onChange={(e) => {
                      setSocietyInput(e.target.value);
                      setSelectedSocietyId(null);
                      setSocietyError('');
                    }}
                    onFocus={() => { if (societySuggestions.length > 0) setSocietyDropdownOpen(true); }}
                    onBlur={() => setTimeout(() => setSocietyDropdownOpen(false), 150)}
                    placeholder="e.g. HultMUN, LSE MUN Society..."
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{
                      border: societyError ? '1.5px solid #8B2020' : '1.5px solid #DDD4C0',
                      backgroundColor: '#FAF8F3',
                      color: '#1C1410',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  />
                  {societyDropdownOpen && societyInput.trim() && (
                    <div
                      className="absolute left-0 right-0 rounded-xl shadow-lg overflow-y-auto"
                      style={{ top: 'calc(100% + 4px)', maxHeight: '200px', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', zIndex: 20 }}
                    >
                      {societySuggestions.map(s => (
                        <button
                          key={s.id}
                          className="w-full text-left px-4 py-2.5 text-sm focus:outline-none"
                          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          onMouseDown={() => {
                            setSocietyInput(s.name);
                            setSelectedSocietyId(s.id);
                            setSocietyDropdownOpen(false);
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                      {!societySuggestions.some(s => s.name.toLowerCase() === societyInput.toLowerCase()) && (
                        <button
                          className="w-full text-left px-4 py-2.5 text-sm focus:outline-none"
                          style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", borderTop: '1px solid #F0EDE6' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          onMouseDown={() => {
                            setSelectedSocietyId(null);
                            setSocietyDropdownOpen(false);
                          }}
                        >
                          Create &quot;{societyInput}&quot;
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {societyError && (
                  <p className="mt-1.5 text-xs" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                    {societyError}
                  </p>
                )}

                {/* Head delegate */}
                {isPreferenceRole && (
                  <button
                    onClick={() => setIsHeadDelegate(v => !v)}
                    className="flex items-start gap-3 mt-4 p-4 rounded-xl w-full text-left focus:outline-none"
                    style={{ backgroundColor: 'rgba(27,56,40,0.04)', border: '1px solid rgba(27,56,40,0.1)' }}
                  >
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded"
                      style={{
                        width: 18, height: 18, marginTop: 2,
                        border: isHeadDelegate ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                        backgroundColor: isHeadDelegate ? '#1B3828' : 'transparent',
                      }}
                    >
                      {isHeadDelegate && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <polyline points="1.5 5 4 7.5 8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                        Apply as Head Delegate for my society
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        Head delegates represent their society and help coordinate the delegation.
                      </p>
                    </div>
                  </button>
                )}
              </>
            )}
          </>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(1)}
            className="rounded-xl py-2.5 px-5 text-sm font-bold focus:outline-none transition-colors"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            ← BACK
          </button>
          <button
            onClick={handleContinue}
            className="rounded-xl py-2.5 px-6 text-sm font-bold focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            CONTINUE →
          </button>
        </div>
      </>
    );
  }

  function renderStep3Preferences() {
    return (
      <>
        <h2 className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          Your Preferences
        </h2>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Add at least 3 preferences in order of priority. Each preference is a committee + country combination.
        </p>

        {preferences.map((pref, idx) => (
          <div key={idx} className="mb-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(27,56,40,0.04)', border: '1px solid rgba(27,56,40,0.1)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                Preference {idx + 1}
              </span>
              <button
                onClick={() => setPreferences(prev => prev.filter((_, i) => i !== idx))}
                className="text-sm focus:outline-none"
                style={{ color: '#9A8A78' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
              >
                ×
              </button>
            </div>

            <div className="mt-2">
              <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Committee</label>
              <select
                value={pref.committeeId}
                onChange={(e) => {
                  const selected = committees.find(c => c.id === e.target.value);
                  setPreferences(prev => prev.map((p, i) =>
                    i === idx ? { ...p, committeeId: e.target.value, committeeName: selected?.name ?? '', countryCode: '', countryName: '' } : p
                  ));
                  if (e.target.value) fetchSlotsForCommittee(e.target.value);
                }}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              >
                <option value="" disabled>Select a committee...</option>
                {committees.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.abbreviation ? ` (${c.abbreviation})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {pref.committeeId && (
              <div className="mt-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Country / Portfolio</label>
                <div className="relative">
                  {pref.countryCode && (
                    <img
                      src={getFlagUrl(pref.countryCode)}
                      alt={pref.countryName}
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 13, borderRadius: 3, objectFit: 'cover', zIndex: 1, pointerEvents: 'none' }}
                    />
                  )}
                  <select
                    value={pref.countryCode}
                    onChange={(e) => {
                      const slot = (countrySlots[pref.committeeId] ?? []).find(s => s.country_code === e.target.value);
                      setPreferences(prev => prev.map((p, i) =>
                        i === idx ? { ...p, countryCode: e.target.value, countryName: slot?.country_name ?? '' } : p
                      ));
                    }}
                    disabled={loadingSlots && !countrySlots[pref.committeeId]}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{
                      border: '1.5px solid #DDD4C0',
                      backgroundColor: '#FAF8F3',
                      color: '#1C1410',
                      fontFamily: "'Outfit', sans-serif",
                      paddingLeft: pref.countryCode ? 36 : 16,
                    }}
                  >
                    <option value="" disabled>
                      {loadingSlots && !countrySlots[pref.committeeId] ? 'Loading countries...' : 'Select a country...'}
                    </option>
                    {countrySlots[pref.committeeId]?.length === 0 && (
                      <option value="" disabled>No countries available</option>
                    )}
                    {(countrySlots[pref.committeeId] ?? []).map(slot => (
                      <option key={slot.id} value={slot.country_code}>{slot.country_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}

        {preferences.length < 8 && (
          <button
            onClick={() => setPreferences(prev => [...prev, { committeeId: '', committeeName: '', countryCode: '', countryName: '' }])}
            className="w-full rounded-xl py-3 text-sm font-semibold focus:outline-none mb-2"
            style={{ border: '1.5px dashed #DDD4C0', backgroundColor: 'transparent', color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          >
            + ADD PREFERENCE
          </button>
        )}

        {prefError && (
          <p className="mb-3 text-xs" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
            {prefError}
          </p>
        )}

        <div className="flex justify-between mt-4">
          <button
            onClick={() => setStep(2)}
            className="rounded-xl py-2.5 px-5 text-sm font-bold focus:outline-none transition-colors"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            ← BACK
          </button>
          <button
            onClick={handleContinue}
            className="rounded-xl py-2.5 px-6 text-sm font-bold focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            CONTINUE →
          </button>
        </div>
      </>
    );
  }

  function renderStepExperience() {
    const prevStep = isPreferenceRole ? 3 : 2;
    const levels = [
      { value: 'beginner', label: 'BEGINNER', sub: 'First or second conference' },
      { value: 'intermediate', label: 'INTERMEDIATE', sub: '3–10 conferences' },
      { value: 'advanced', label: 'ADVANCED', sub: '10–20 conferences' },
      { value: 'expert', label: 'EXPERT', sub: '20+ conferences or chairing experience' },
    ];
    const questions = roleConfig?.custom_questions ?? [];

    return (
      <>
        <h2 className="font-semibold text-base mb-6" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          About You
        </h2>

        <div className="mb-6">
          <label className="block font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            MUN Experience Level
          </label>
          <div className="grid grid-cols-2 gap-3">
            {levels.map(lvl => (
              <button
                key={lvl.value}
                onClick={() => setExperienceLevel(lvl.value)}
                className="rounded-xl p-3 text-center focus:outline-none transition-all"
                style={{
                  border: experienceLevel === lvl.value ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                  backgroundColor: experienceLevel === lvl.value ? 'rgba(27,56,40,0.06)' : 'transparent',
                }}
              >
                <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{lvl.label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{lvl.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {questions.length > 0 && (
          <div className="flex flex-col gap-4 mb-6">
            {questions.map(q => (
              <div key={q.id}>
                <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  {q.label}
                  {q.required && <span className="ml-1 text-xs font-normal" style={{ color: '#9A8A78' }}>(required)</span>}
                </label>
                {q.type === 'text' ? (
                  <input
                    type="text"
                    value={customAnswers[q.id] ?? ''}
                    onChange={(e) => setCustomAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{ border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                  />
                ) : (
                  <textarea
                    rows={4}
                    value={customAnswers[q.id] ?? ''}
                    onChange={(e) => setCustomAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                    style={{ border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between mt-2 gap-4">
          <button
            onClick={() => setStep(prevStep)}
            className="rounded-xl py-2.5 px-5 text-sm font-bold focus:outline-none transition-colors flex-shrink-0"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            ← BACK
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-xl py-3 px-8 text-sm font-bold focus:outline-none transition-colors"
            style={{
              backgroundColor: submitting ? 'rgba(27,56,40,0.5)' : '#1B3828',
              color: '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.08em',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#EED98A', borderTopColor: 'transparent' }} />
                SUBMITTING...
              </span>
            ) : 'SUBMIT APPLICATION'}
          </button>
        </div>
      </>
    );
  }

  // ── Early returns ─────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (notFound || !conference) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20 text-center">
          <div>
            <p className="text-xs tracking-widest mb-3" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>404</p>
            <h1 className="font-black text-2xl mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Conference Not Found</h1>
            <Link href="/conferences/explore" className="text-sm font-semibold" style={{ color: '#1B3828', textDecoration: 'none' }}>
              Explore conferences →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (existingApp) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 text-center max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              You&apos;ve already applied
            </h2>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              Your application as {role.replace(/-/g, ' ')} is {existingApp.status}.
            </p>
            <Link
              href={`/conferences/${slug}`}
              className="inline-block rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              VIEW CONFERENCE →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!roleConfig || !roleConfig.is_enabled) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 text-center max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Applications are not open
            </h2>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              Applications for {role.replace(/-/g, ' ')} are not currently open for this conference.
            </p>
            <Link
              href={`/conferences/${slug}`}
              className="text-sm font-semibold"
              style={{ color: '#1B3828', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Age gate screens ──────────────────────────────────────────────────────

  if (underAge) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 text-center max-w-md w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 mb-4 text-[11px] font-bold"
              style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.25)', color: '#8B2020', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              AGE REQUIREMENT
            </span>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              This conference requires delegates to be at least {minAgeLimit} years old
            </h2>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}>
              Based on your date of birth, you will be {ageAtStart} when {conference.acronym} starts, so you can&apos;t apply this time. If your date of birth is wrong, you can update it in your profile.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/account/profile"
                className="text-sm font-semibold"
                style={{ color: '#1B3828', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
              >
                Edit profile
              </Link>
              <Link
                href={`/conferences/${slug}`}
                className="text-sm font-semibold"
                style={{ color: '#9A8A78', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
              >
                ← Back to {conference.acronym}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (needsDob) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 max-w-md w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 mb-4 text-[11px] font-bold"
              style={{ backgroundColor: 'rgba(182,135,31,0.12)', border: '1px solid rgba(182,135,31,0.35)', color: '#B6871F', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              {minAgeLimit}+ CONFERENCE
            </span>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Add your date of birth to continue
            </h2>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}>
              This conference requires delegates to be at least {minAgeLimit} years old, and your profile doesn&apos;t have a date of birth yet. It will be saved to your profile.
            </p>
            <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Date of birth
            </label>
            <input
              type="date"
              value={dobInput}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => { setDobInput(e.target.value); setDobError(''); }}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{
                border: dobError ? '1.5px solid #8B2020' : '1.5px solid #DDD4C0',
                backgroundColor: '#FAF8F3',
                color: '#1C1410',
                fontFamily: "'Outfit', sans-serif",
              }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = dobError ? '#8B2020' : '#DDD4C0'; }}
            />
            {dobError && (
              <p className="mt-1.5 text-xs" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                {dobError}
              </p>
            )}
            <button
              onClick={handleSaveDob}
              disabled={dobSaving || !dobInput}
              className="w-full mt-4 rounded-xl py-3 font-bold text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: (dobSaving || !dobInput) ? '#DDD4C0' : '#1B3828',
                color: (dobSaving || !dobInput) ? '#9A8A78' : '#EED98A',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '0.08em',
                cursor: (dobSaving || !dobInput) ? 'default' : 'pointer',
              }}
              onMouseEnter={(e) => { if (!dobSaving && dobInput) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { if (!dobSaving && dobInput) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {dobSaving ? 'SAVING...' : 'SAVE & CONTINUE'}
            </button>
            <div className="text-center mt-4">
              <Link
                href={`/conferences/${slug}`}
                className="text-sm font-semibold"
                style={{ color: '#9A8A78', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
              >
                ← Back to {conference.acronym}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      <SiteNav />

      <div className="relative z-10 flex-1 px-6 py-10" style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href={`/conferences/${slug}`}
            className="text-xs"
            style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", textDecoration: 'none' }}
          >
            ← {conference.acronym}
          </Link>
        </div>

        {/* Step indicator */}
        <div className="flex items-start mb-8">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === step;
            const isCompleted = stepNum < step;
            return (
              <Fragment key={stepNum}>
                {i > 0 && (
                  <div style={{ flex: 1, height: 1, backgroundColor: '#DDD4C0', marginTop: 16 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                      backgroundColor: isActive ? '#1B3828' : isCompleted ? 'rgba(27,56,40,0.12)' : '#EDE7D8',
                      color: isActive ? '#EED98A' : isCompleted ? '#1B3828' : '#9A8A78',
                      border: (!isActive && !isCompleted) ? '1px solid #DDD4C0' : 'none',
                    }}
                  >
                    {isCompleted ? '✓' : stepNum}
                  </div>
                  <span style={{ fontSize: 10, marginTop: 4, color: '#9A8A78', fontFamily: "'DM Mono', monospace", textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </div>
                {i < totalSteps - 1 && (
                  <div style={{ flex: 1, height: 1, backgroundColor: '#DDD4C0', marginTop: 16 }} />
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Form card */}
        <div className="rounded-2xl p-6 md:p-8" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && isPreferenceRole && renderStep3Preferences()}
          {step === 3 && !isPreferenceRole && renderStepExperience()}
          {step === 4 && isPreferenceRole && renderStepExperience()}
        </div>

        {submitError && (
          <p className="mt-4 text-sm text-center" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
            {submitError}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Default export with Suspense ───────────────────────────────────────────

export default function ConferenceApplyClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      }
    >
      <ConferenceApplyInner />
    </Suspense>
  );
}
