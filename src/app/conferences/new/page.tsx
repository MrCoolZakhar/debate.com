'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Camera, Globe, Music, MessageCircle, Search, X,
  Type, Hash, Mail, GraduationCap, CalendarDays, MapPin, Monitor, Users, Banknote, Sparkles, Gavel,
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@supabase/supabase-js';
import { generateSlug } from '@/lib/utils';
import { UN_COUNTRIES } from '@/lib/countries';

// License-safe banner presets shipped in /public/banners (see its README.md).
const BANNER_PRESETS = [
  '/banners/preset-1.jpg',
  '/banners/preset-2.jpg',
  '/banners/preset-3.jpg',
  '/banners/preset-4.jpg',
  '/banners/preset-5.jpg',
];

// ── Input / label helpers ──────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#FAF8F3',
  border: '1.5px solid #DDD4C0',
  borderRadius: '10px',
  padding: '12px 16px',
  fontSize: '14px',
  color: '#1C1410',
  fontFamily: "'Outfit', sans-serif",
  outline: 'none',
  transition: 'border-color 150ms ease',
};

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="flex items-center gap-1.5 text-sm font-semibold mb-1.5"
        style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
      >
        {icon && <span className="inline-flex items-center" style={{ color: '#9A8A78' }}>{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * A text/number input with a leading lucide icon prefix — the same pattern as
 * `SocialInput`, generalised so Step 1's fields get the icon affordance Step 2
 * already has.
 */
function IconInput({
  icon, value, onChange, placeholder, type = 'text', min, step, required, onBlur,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  step?: number;
  required?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9A8A78' }}>
        {icon}
      </span>
      <input
        type={type}
        required={required}
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingLeft: '40px' }}
        onFocus={focusGreen}
        onBlur={onBlur ?? blurGray}
      />
    </div>
  );
}

function focusGreen(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#1B3828';
}
function blurGray(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#DDD4C0';
}

// ── Toggle button group ───────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="flex-1 py-3 rounded-[10px] font-bold text-sm tracking-widest transition-all focus:outline-none"
            style={{
              backgroundColor: active ? '#1B3828' : 'transparent',
              color: active ? '#EED98A' : '#1C1410',
              border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.08em',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Social input with icon ────────────────────────────────────────────────

function SocialInput({
  icon,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: '#9A8A78' }}
      >
        {icon}
      </span>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingLeft: '38px' }}
        onFocus={focusGreen}
        onBlur={blurGray}
      />
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  const labels: Record<number, string> = { 1: 'The Basics', 2: 'Details' };
  const pct = step === 1 ? 50 : 100;
  return (
    <div className="mb-6">
      {/* Labels row */}
      <div className="flex items-center justify-between mb-2.5">
        {([1, 2] as const).map((n) => {
          const active = step >= n;
          return (
            <div key={n} className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-all"
                style={{
                  backgroundColor: active ? '#1B3828' : '#DDD4C0',
                  color: active ? '#EED98A' : '#9A8A78',
                }}
              >
                {n}
              </span>
              <span
                className="text-sm font-bold transition-colors"
                style={{
                  color: step === n ? '#1B3828' : active ? '#6B5F52' : '#9A8A78',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                {labels[n]}
              </span>
            </div>
          );
        })}
      </div>
      {/* Progress bar */}
      <div className="rounded-full overflow-hidden" style={{ height: '6px', backgroundColor: '#DDD4C0' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(to right, #1B3828, #3D7A52)' }}
        />
      </div>
    </div>
  );
}

// ── Predecessor (previous edition) types ─────────────────────────────────

interface PredecessorOption {
  id: string;
  full_name: string;
  acronym: string;
  slug: string;
  start_date: string;
  city: string;
  country: string;
}

// ── Main page ─────────────────────────────────────────────────────────────

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

  // Auth gate
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/signin?next=/conferences/new');
    }
  }, [loading, user, router]);

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1 fields
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
  const [feeAmount, setFeeAmount] = useState('0');
  const [feeCurrency, setFeeCurrency] = useState('GBP');

  // Step 2 fields
  const [description, setDescription] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  // Previous editions (lineage claim)
  const [hasPredecessor, setHasPredecessor] = useState<'yes' | 'no'>('no');
  const [predecessorQuery, setPredecessorQuery] = useState('');
  const [predecessorResults, setPredecessorResults] = useState<PredecessorOption[]>([]);
  const [predecessorSearching, setPredecessorSearching] = useState(false);
  const [predecessor, setPredecessor] = useState<PredecessorOption | null>(null);

  // Debounced predecessor search: own organized conferences AND public ones
  // (RLS limits results to exactly that set for an authed client).
  useEffect(() => {
    if (loading || hasPredecessor !== 'yes' || !session) return;
    const q = predecessorQuery.trim();
    if (q.length < 2) { setPredecessorResults([]); setPredecessorSearching(false); return; }
    let cancelled = false;
    setPredecessorSearching(true);
    const t = setTimeout(async () => {
      const supabase = getAuthedClient();
      const safe = q.replace(/[%,()]/g, '');
      const { data } = await supabase
        .from('conferences')
        .select('id, full_name, acronym, slug, start_date, city, country')
        .or(`full_name.ilike.%${safe}%,acronym.ilike.%${safe}%`)
        .order('start_date', { ascending: false })
        .limit(8);
      if (!cancelled) {
        setPredecessorResults((data as PredecessorOption[] | null) ?? []);
        setPredecessorSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predecessorQuery, hasPredecessor, loading, session?.access_token]);

  // Pre-fill email from profile
  useEffect(() => {
    if (profile?.email && !contactEmail) setContactEmail(profile.email);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.email]);

  function validateAcronym(val: string) {
    const upper = val.toUpperCase();
    if (upper.length < 4) {
      setAcronymError('Acronym must be at least 4 characters.');
    } else if (!upper.includes('MUN')) {
      setAcronymError("Acronym must include 'MUN' — e.g. TEIMUN, LIMUN, SMUNC.");
    } else {
      setAcronymError('');
    }
  }

  function handleContinue() {
    if (
      !fullName.trim() ||
      !acronym.trim() ||
      acronymError ||
      !contactEmail.trim() ||
      !studentLevel ||
      !startDate ||
      !endDate ||
      !country.trim() ||
      !city.trim() ||
      !format ||
      !expectedDelegates
    ) {
      setError('Please fill in all required fields before continuing.');
      return;
    }
    // Run acronym validation in case user never blurred
    const upper = acronym.toUpperCase();
    if (upper.length < 4) {
      setAcronymError('Acronym must be at least 4 characters.');
      setError('Please fix the errors above before continuing.');
      return;
    }
    if (!upper.includes('MUN')) {
      setAcronymError("Acronym must include 'MUN' — e.g. TEIMUN, LIMUN, SMUNC.");
      setError('Please fix the errors above before continuing.');
      return;
    }
    setError('');
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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

      // No .select() after insert: the new row is only SELECT-visible once the
      // ownership trigger has run, so RETURNING fails RLS for private conferences.
      // We already know the slug — we generated it.
      const { error: dbError } = await supabase
        .from('conferences')
        .insert({
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
          fee_amount: parseFloat(feeAmount) || 0,
          fee_currency: feeCurrency,
          description: description || null,
          instagram_url: instagramUrl || null,
          facebook_url: facebookUrl || null,
          tiktok_url: tiktokUrl || null,
          whatsapp_url: whatsappUrl || null,
          website_url: websiteUrl || null,
          banner_url: bannerUrl,
          is_public: isPublic,
          status: isPublic ? 'public' : 'private',
          predecessor_conference_id: hasPredecessor === 'yes' && predecessor ? predecessor.id : null,
        });

      setSubmitting(false);

      if (dbError) {
        setError('Failed to create conference: ' + dbError.message);
        return;
      }

      router.push('/manage/' + slug);
    } catch (err) {
      setSubmitting(false);
      setError('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleBannerUpload(file: File) {
    if (!file) return;
    if (!session) {
      alert('You must be signed in to upload a banner.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Banner image must be under 5MB.');
      return;
    }
    setBannerUploading(true);
    const supabase = createClient(
      'https://luruhkwrgisytejswlas.supabase.co',
      'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV',
      { global: { headers: { Authorization: 'Bearer ' + session.access_token } } }
    );
    const ext = file.name.split('.').pop();
    const path = 'banners/' + Date.now() + '-' + Math.random().toString(36).substring(2, 7) + '.' + ext;
    const { error } = await supabase.storage
      .from('conference-assets')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      alert('Failed to upload banner: ' + error.message);
      setBannerUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from('conference-assets')
      .getPublicUrl(path);
    setBannerUrl(urlData.publicUrl);
    setBannerUploading(false);
  }

  // Loading / auth spinner
  if (loading || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#EDE7D8' }}
      >
        <div
          className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
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

        <main className="flex-1 flex justify-center px-6 py-12">
          <div className="w-full max-w-[680px]">

            <StepIndicator step={step} />

            {/* Card */}
            <div
              style={{
                backgroundColor: '#FAF8F3',
                border: '1px solid #DDD4C0',
                borderRadius: '16px',
                boxShadow: '0 8px 40px rgba(28, 20, 16, 0.09), 0 2px 8px rgba(28, 20, 16, 0.05)',
                padding: 'clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px)',
              }}
            >
              {step === 1 ? (
                <Step1
                  fullName={fullName} setFullName={setFullName}
                  acronym={acronym} setAcronym={setAcronym}
                  acronymError={acronymError} validateAcronym={validateAcronym}
                  contactEmail={contactEmail} setContactEmail={setContactEmail}
                  studentLevel={studentLevel} setStudentLevel={setStudentLevel}
                  startDate={startDate} setStartDate={setStartDate}
                  endDate={endDate} setEndDate={setEndDate}
                  country={country} setCountry={setCountry}
                  city={city} setCity={setCity}
                  format={format} setFormat={setFormat}
                  expectedDelegates={expectedDelegates} setExpectedDelegates={setExpectedDelegates}
                  feeAmount={feeAmount} setFeeAmount={setFeeAmount}
                  feeCurrency={feeCurrency} setFeeCurrency={setFeeCurrency}
                  error={error}
                  onContinue={handleContinue}
                />
              ) : (
                <Step2
                  description={description} setDescription={setDescription}
                  instagramUrl={instagramUrl} setInstagramUrl={setInstagramUrl}
                  facebookUrl={facebookUrl} setFacebookUrl={setFacebookUrl}
                  tiktokUrl={tiktokUrl} setTiktokUrl={setTiktokUrl}
                  whatsappUrl={whatsappUrl} setWhatsappUrl={setWhatsappUrl}
                  websiteUrl={websiteUrl} setWebsiteUrl={setWebsiteUrl}
                  bannerUrl={bannerUrl}
                  setBannerUrl={setBannerUrl}
                  bannerUploading={bannerUploading}
                  onBannerUpload={handleBannerUpload}
                  isPublic={isPublic}
                  setIsPublic={setIsPublic}
                  hasPredecessor={hasPredecessor}
                  setHasPredecessor={setHasPredecessor}
                  predecessorQuery={predecessorQuery}
                  setPredecessorQuery={setPredecessorQuery}
                  predecessorResults={predecessorResults}
                  predecessorSearching={predecessorSearching}
                  predecessor={predecessor}
                  setPredecessor={setPredecessor}
                  error={error}
                  submitting={submitting}
                  onBack={() => { setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  onCreate={handleCreate}
                />
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

// ── Step 1 component ──────────────────────────────────────────────────────

function Step1({
  fullName, setFullName,
  acronym, setAcronym, acronymError, validateAcronym,
  contactEmail, setContactEmail,
  studentLevel, setStudentLevel,
  startDate, setStartDate,
  endDate, setEndDate,
  country, setCountry,
  city, setCity,
  format, setFormat,
  expectedDelegates, setExpectedDelegates,
  feeAmount, setFeeAmount,
  feeCurrency, setFeeCurrency,
  error,
  onContinue,
}: {
  fullName: string; setFullName: (v: string) => void;
  acronym: string; setAcronym: (v: string) => void;
  acronymError: string; validateAcronym: (v: string) => void;
  contactEmail: string; setContactEmail: (v: string) => void;
  studentLevel: 'school' | 'university' | 'both' | ''; setStudentLevel: (v: 'school' | 'university' | 'both') => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  city: string; setCity: (v: string) => void;
  format: 'in-person' | 'online' | 'hybrid' | ''; setFormat: (v: 'in-person' | 'online' | 'hybrid') => void;
  expectedDelegates: string; setExpectedDelegates: (v: string) => void;
  feeAmount: string; setFeeAmount: (v: string) => void;
  feeCurrency: string; setFeeCurrency: (v: string) => void;
  error: string;
  onContinue: () => void;
}) {
  return (
    <div>
      <h2
        className="font-semibold mb-6"
        style={{ color: '#1C1410', fontSize: '18px', fontFamily: "'Outfit', sans-serif" }}
      >
        The Basics
      </h2>

      <div className="flex flex-col gap-5">

        <Field label="Full Conference Name">
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. The European International Model United Nations"
            style={inputStyle}
            onFocus={focusGreen}
            onBlur={blurGray}
          />
        </Field>

        <Field label="Short Name / Acronym">
          <input
            type="text"
            required
            value={acronym.toUpperCase()}
            onChange={(e) => setAcronym(e.target.value.toUpperCase())}
            onBlur={(e) => { blurGray(e); validateAcronym(e.target.value); }}
            onFocus={focusGreen}
            placeholder="e.g. TEIMUN"
            style={inputStyle}
          />
          {acronymError && (
            <p
              className="flex items-center gap-1.5 mt-1.5 text-sm"
              style={{ color: '#B8844A', fontFamily: "'Outfit', sans-serif" }}
            >
              <AlertTriangle size={14} />
              {acronymError}
            </p>
          )}
        </Field>

        <Field label="Organizer Contact Email">
          <input
            type="email"
            required
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="conference@example.com"
            style={inputStyle}
            onFocus={focusGreen}
            onBlur={blurGray}
          />
        </Field>

        <Field label="Student Level">
          <ToggleGroup
            options={[
              { value: 'school', label: 'HIGH SCHOOL' },
              { value: 'university', label: 'UNIVERSITY' },
              { value: 'both', label: 'BOTH' },
            ]}
            value={studentLevel}
            onChange={setStudentLevel}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date">
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
              onFocus={focusGreen}
              onBlur={blurGray}
            />
          </Field>
          <Field label="End Date">
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={inputStyle}
              onFocus={focusGreen}
              onBlur={blurGray}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Country">
            <select
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
              onFocus={focusGreen}
              onBlur={blurGray}
            >
              <option value="">Select a country</option>
              {UN_COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="City">
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. The Hague"
              style={inputStyle}
              onFocus={focusGreen}
              onBlur={blurGray}
            />
          </Field>
        </div>

        <Field label="Format">
          <ToggleGroup
            options={[
              { value: 'in-person', label: 'IN-PERSON' },
              { value: 'online', label: 'ONLINE' },
              { value: 'hybrid', label: 'HYBRID' },
            ]}
            value={format}
            onChange={setFormat}
          />
        </Field>

        <Field label="Expected Delegates">
          <input
            type="number"
            required
            min={1}
            value={expectedDelegates}
            onChange={(e) => setExpectedDelegates(e.target.value)}
            placeholder="e.g. 300"
            style={inputStyle}
            onFocus={focusGreen}
            onBlur={blurGray}
          />
        </Field>

        <Field label="Conference Fee">
          <div className="flex gap-3">
            <select
              value={feeCurrency}
              onChange={(e) => setFeeCurrency(e.target.value)}
              style={{ ...inputStyle, width: '30%', cursor: 'pointer' }}
              onFocus={focusGreen}
              onBlur={blurGray}
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
              style={{ ...inputStyle, width: '70%' }}
              onFocus={focusGreen}
              onBlur={blurGray}
            />
          </div>
          <p
            className="text-xs mt-1.5"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          >
            Set to 0 for free conferences. Gavelling adds a 5% surcharge for delegates without Gavelling Unlimited.
          </p>
        </Field>

      </div>

      {error && (
        <div
          className="mt-5 px-4 py-3 rounded-xl text-sm"
          style={{
            backgroundColor: 'rgba(139, 32, 32, 0.08)',
            border: '1px solid rgba(139, 32, 32, 0.2)',
            color: '#8B2020',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={onContinue}
        className="w-full mt-6 rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
        style={{
          backgroundColor: '#1B3828',
          color: '#EED98A',
          fontFamily: "'Outfit', sans-serif",
          letterSpacing: '0.08em',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
      >
        CONTINUE TO DETAILS →
      </button>
    </div>
  );
}

// ── Step 2 component ──────────────────────────────────────────────────────

function Step2({
  description, setDescription,
  instagramUrl, setInstagramUrl,
  facebookUrl, setFacebookUrl,
  tiktokUrl, setTiktokUrl,
  whatsappUrl, setWhatsappUrl,
  websiteUrl, setWebsiteUrl,
  bannerUrl, setBannerUrl,
  bannerUploading,
  onBannerUpload,
  isPublic, setIsPublic,
  hasPredecessor, setHasPredecessor,
  predecessorQuery, setPredecessorQuery,
  predecessorResults, predecessorSearching,
  predecessor, setPredecessor,
  error,
  submitting,
  onBack,
  onCreate,
}: {
  description: string; setDescription: (v: string) => void;
  instagramUrl: string; setInstagramUrl: (v: string) => void;
  facebookUrl: string; setFacebookUrl: (v: string) => void;
  tiktokUrl: string; setTiktokUrl: (v: string) => void;
  whatsappUrl: string; setWhatsappUrl: (v: string) => void;
  websiteUrl: string; setWebsiteUrl: (v: string) => void;
  bannerUrl: string | null; setBannerUrl: (url: string | null) => void;
  bannerUploading: boolean;
  onBannerUpload: (file: File) => void;
  isPublic: boolean; setIsPublic: (v: boolean) => void;
  hasPredecessor: 'yes' | 'no'; setHasPredecessor: (v: 'yes' | 'no') => void;
  predecessorQuery: string; setPredecessorQuery: (v: string) => void;
  predecessorResults: PredecessorOption[]; predecessorSearching: boolean;
  predecessor: PredecessorOption | null; setPredecessor: (v: PredecessorOption | null) => void;
  error: string;
  submitting: boolean;
  onBack: () => void;
  onCreate: () => void;
}) {
  return (
    <div>
      <h2
        className="font-semibold mb-1"
        style={{ color: '#1C1410', fontSize: '18px', fontFamily: "'Outfit', sans-serif" }}
      >
        Details
      </h2>
      <p
        className="text-sm mb-6"
        style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
      >
        All optional — you can fill these in later from your dashboard.
      </p>

      <div className="flex flex-col gap-5">

        <Field label="Conference Banner">
          <div
            style={{
              border: '1.5px dashed #DDD4C0',
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: '#FAF8F3',
              minHeight: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              cursor: 'pointer',
            }}
            onClick={() => { if (!bannerUploading) document.getElementById('banner-upload')?.click(); }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          >
            {bannerUrl ? (
              <>
                <img src={bannerUrl} alt="Banner" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={(e) => { e.stopPropagation(); setBannerUrl(null); }}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    backgroundColor: 'rgba(27,56,40,0.8)', color: '#EDE7D8',
                    border: 'none', borderRadius: 8, padding: '4px 10px',
                    fontSize: 11, fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  CHANGE
                </button>
              </>
            ) : bannerUploading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-2" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
                <p style={{ fontSize: 12, color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Uploading...</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1410', fontFamily: "'Outfit', sans-serif", marginBottom: 4 }}>Upload Conference Banner</p>
                <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Recommended: 1200×630px · JPG, PNG or WebP · Max 5MB</p>
              </div>
            )}
            <input
              id="banner-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onBannerUpload(f); }}
            />
          </div>

          {/* Preset picker — sets the local bannerUrl; saved with the conference on create */}
          <div style={{ marginTop: 12 }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: '0.14em', color: '#9A8A78', margin: '0 0 8px 0' }}>
              OR PICK A PRESET
            </p>
            <div className="flex flex-wrap gap-2">
              {BANNER_PRESETS.map(p => {
                const selected = bannerUrl === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setBannerUrl(p)}
                    disabled={bannerUploading}
                    aria-label={'Use preset banner ' + p}
                    style={{
                      width: 84, height: 48, padding: 0, borderRadius: 10, overflow: 'hidden',
                      cursor: bannerUploading ? 'wait' : 'pointer',
                      border: selected ? '2px solid #B6871F' : '1.5px solid #DDD4C0',
                      boxShadow: selected ? '0 0 0 3px rgba(238,217,138,0.55)' : 'none',
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
        </Field>

        <Field label="Conference Description">
          <textarea
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell delegates about your conference — theme, highlights, what to expect, fee inclusions, social events..."
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: '1.6',
            }}
            onFocus={focusGreen}
            onBlur={blurGray}
          />
        </Field>

        <Field label="Social Media & Links">
          <div className="flex flex-col gap-3">
            <SocialInput
              icon={<Camera size={16} />}
              placeholder="Instagram URL"
              value={instagramUrl}
              onChange={setInstagramUrl}
            />
            <SocialInput
              icon={<Globe size={16} />}
              placeholder="Facebook URL"
              value={facebookUrl}
              onChange={setFacebookUrl}
            />
            <SocialInput
              icon={<Music size={16} />}
              placeholder="TikTok URL"
              value={tiktokUrl}
              onChange={setTiktokUrl}
            />
            <SocialInput
              icon={<MessageCircle size={16} />}
              placeholder="WhatsApp URL"
              value={whatsappUrl}
              onChange={setWhatsappUrl}
            />
            <SocialInput
              icon={<Globe size={16} />}
              placeholder="Website URL"
              value={websiteUrl}
              onChange={setWebsiteUrl}
            />
          </div>
        </Field>

        <Field label="Previous Editions">
          <p className="text-sm mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            Have you organised previous editions of this conference on Gavelling?
          </p>
          <ToggleGroup
            options={[
              { value: 'no', label: 'NO' },
              { value: 'yes', label: 'YES' },
            ]}
            value={hasPredecessor}
            onChange={(v) => {
              setHasPredecessor(v);
              if (v === 'no') { setPredecessor(null); setPredecessorQuery(''); }
            }}
          />

          {hasPredecessor === 'yes' && (
            <div className="mt-3">
              {predecessor ? (
                <div
                  className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{ border: '1.5px solid #1B3828', backgroundColor: 'rgba(27,56,40,0.04)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 10, color: '#B6871F', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em', fontVariantNumeric: 'tabular-nums', textTransform: 'uppercase', marginBottom: 2 }}>
                      {predecessor.acronym}
                      {predecessor.start_date ? ' · ' + new Date(predecessor.start_date + 'T00:00:00').getFullYear() : ''}
                    </p>
                    <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      {predecessor.full_name}
                    </p>
                    <p className="text-xs mt-1.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
                      The Main Organiser of this conference will be asked to confirm the link after you create yours. Nothing is shown publicly until they approve.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPredecessor(null); setPredecessorQuery(''); }}
                    className="flex-shrink-0 focus:outline-none"
                    style={{ color: '#9A8A78', marginTop: 2 }}
                    aria-label="Remove selected previous edition"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-[22px] -translate-y-1/2 pointer-events-none" style={{ color: '#9A8A78' }}>
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    value={predecessorQuery}
                    onChange={(e) => setPredecessorQuery(e.target.value)}
                    placeholder="Search by conference name or acronym..."
                    style={{ ...inputStyle, paddingLeft: '38px' }}
                    onFocus={focusGreen}
                    onBlur={blurGray}
                  />
                  <p className="text-xs mt-1.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                    A past edition may belong to a different account — its Main Organiser approves the link.
                  </p>
                  {(predecessorSearching || predecessorResults.length > 0 || predecessorQuery.trim().length >= 2) && (
                    <div
                      className="mt-2 rounded-xl overflow-hidden"
                      style={{ border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3' }}
                    >
                      {predecessorSearching ? (
                        <p className="px-4 py-3 text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                          Searching...
                        </p>
                      ) : predecessorResults.length === 0 ? (
                        <p className="px-4 py-3 text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                          No conferences found. Try the full name or acronym.
                        </p>
                      ) : (
                        predecessorResults.map((opt, idx) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPredecessor(opt)}
                            className="w-full text-left px-4 py-2.5 focus:outline-none transition-colors"
                            style={{
                              backgroundColor: 'transparent',
                              borderTop: idx > 0 ? '1px solid #F0EDE6' : 'none',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          >
                            <p style={{ fontSize: 10, color: '#B6871F', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em', fontVariantNumeric: 'tabular-nums', textTransform: 'uppercase' }}>
                              {opt.acronym}
                              {opt.start_date ? ' · ' + new Date(opt.start_date + 'T00:00:00').getFullYear() : ''}
                              {opt.city ? ' · ' + opt.city : ''}
                            </p>
                            <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                              {opt.full_name}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Field>

        <Field label="Conference Visibility">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              { value: false, label: 'PRIVATE', desc: 'Only visible to people with a direct link. Delegates cannot find or apply through Gavelling until you make it public.' },
              { value: true, label: 'PUBLIC', desc: 'Listed in the Gavelling conference directory. Delegates can find and apply immediately.' },
            ] as { value: boolean; label: string; desc: string }[]).map(({ value, label, desc }) => (
              <div
                key={label}
                onClick={() => setIsPublic(value)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                  border: isPublic === value ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                  backgroundColor: isPublic === value ? 'rgba(27,56,40,0.04)' : 'transparent',
                  transition: 'all 150ms ease',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                  border: isPublic === value ? '5px solid #1B3828' : '2px solid #DDD4C0',
                  backgroundColor: 'transparent', transition: 'all 150ms ease',
                }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#1C1410', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 12, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Field>

      </div>

      {error && (
        <div
          className="mt-5 px-4 py-3 rounded-xl text-sm"
          style={{
            backgroundColor: 'rgba(139, 32, 32, 0.08)',
            border: '1px solid rgba(139, 32, 32, 0.2)',
            color: '#8B2020',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          disabled={submitting}
          className="rounded-xl py-3 px-6 font-bold text-sm tracking-widest transition-colors focus:outline-none"
          style={{
            backgroundColor: 'transparent',
            color: '#1C1410',
            border: '1.5px solid #DDD4C0',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.06em',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
        >
          ← BACK
        </button>

        <button
          onClick={onCreate}
          disabled={submitting}
          className="flex-1 rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none flex items-center justify-center gap-2"
          style={{
            backgroundColor: submitting ? '#DDD4C0' : '#1B3828',
            color: submitting ? '#9A8A78' : '#EED98A',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.08em',
          }}
          onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          {submitting && (
            <div
              className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
              style={{ borderColor: '#9A8A78', borderTopColor: 'transparent' }}
            />
          )}
          {submitting ? 'CREATING...' : 'CREATE CONFERENCE'}
        </button>
      </div>
    </div>
  );
}
