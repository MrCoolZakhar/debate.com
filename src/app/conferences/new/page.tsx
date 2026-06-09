'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Camera, Globe, Music, MessageCircle } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { supabaseAuthClient } from '@/lib/supabase-auth';
import { generateSlug } from '@/lib/utils';

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-sm font-semibold mb-1.5"
        style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
      >
        {label}
      </label>
      {children}
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
  return (
    <div className="flex items-center gap-3 mb-8">
      {([1, 2] as const).map((n) => {
        const active = step === n;
        const labels: Record<number, string> = { 1: 'The Basics', 2: 'Details' };
        return (
          <div key={n} className="flex items-center gap-2">
            {n > 1 && (
              <div
                className="h-px flex-shrink-0"
                style={{ width: '28px', backgroundColor: '#DDD4C0' }}
              />
            )}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all"
              style={{
                backgroundColor: active ? '#1B3828' : 'transparent',
                color: active ? '#EED98A' : '#9A8A78',
                border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '0.04em',
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                style={{
                  backgroundColor: active ? '#EED98A' : '#DDD4C0',
                  color: active ? '#1B3828' : '#9A8A78',
                }}
              >
                {n}
              </span>
              {labels[n]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function NewConferencePage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

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
    setSubmitting(true);
    setError('');

    const supabase = supabaseAuthClient;
    const baseSlug = generateSlug(fullName);
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;

    const { data, error: dbError } = await supabase
      .from('conferences')
      .insert({
        slug,
        organizer_id: user!.id,
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
        status: 'draft',
      })
      .select('slug')
      .single();

    setSubmitting(false);

    if (dbError) {
      setError('Failed to create conference. Please try again.');
      return;
    }

    router.push(`/manage/${data.slug}`);
  }

  async function handleBannerUpload(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Banner image must be under 5MB.');
      return;
    }
    setBannerUploading(true);
    const ext = file.name.split('.').pop();
    const path = 'banners/' + Date.now() + '-' + Math.random().toString(36).substring(2, 7) + '.' + ext;
    const { error } = await supabaseAuthClient.storage
      .from('conference-assets')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      alert('Failed to upload banner. Please try again.');
      setBannerUploading(false);
      return;
    }
    const { data: urlData } = supabaseAuthClient.storage
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
              { value: 'school', label: 'SCHOOL' },
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
            <input
              type="text"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Netherlands"
              style={inputStyle}
              onFocus={focusGreen}
              onBlur={blurGray}
            />
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
