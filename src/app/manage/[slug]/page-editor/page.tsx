'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Camera, Globe, Music, MessageCircle } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { createAuthClient } from '@/lib/supabase-auth';

// ── Shared form helpers ────────────────────────────────────────────────────

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
      <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function fg(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#1B3828';
}
function bg(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#DDD4C0';
}

function ToggleGroup<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map(opt => {
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

function SocialInput({
  icon, placeholder, value, onChange,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9A8A78' }}>{icon}</span>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingLeft: '38px' }}
        onFocus={fg}
        onBlur={bg}
      />
    </div>
  );
}

// ── Card wrapper ───────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 p-6 rounded-2xl" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
      <h2 className="font-semibold text-base mb-5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Page editor ────────────────────────────────────────────────────────────

export default function PageEditorPage() {
  const { conference, refreshConference } = useManage();

  // Form state
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
  const [description, setDescription] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const [initialized, setInitialized] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Initialize form from conference data once
  useEffect(() => {
    if (!conference || initialized) return;
    setFullName(conference.full_name);
    setAcronym(conference.acronym);
    setContactEmail(conference.contact_email);
    setStudentLevel(conference.student_level as 'school' | 'university' | 'both' | '');
    setStartDate(conference.start_date);
    setEndDate(conference.end_date);
    setCountry(conference.country);
    setCity(conference.city);
    setFormat(conference.format as 'in-person' | 'online' | 'hybrid' | '');
    setExpectedDelegates(String(conference.expected_delegates));
    setFeeAmount(String(conference.fee_amount));
    setFeeCurrency(conference.fee_currency);
    setDescription(conference.description ?? '');
    setInstagramUrl(conference.instagram_url ?? '');
    setFacebookUrl(conference.facebook_url ?? '');
    setTiktokUrl(conference.tiktok_url ?? '');
    setWhatsappUrl(conference.whatsapp_url ?? '');
    setWebsiteUrl(conference.website_url ?? '');
    setIsPublic(conference.is_public);
    setInitialized(true);
  }, [conference, initialized]);

  function markChanged() {
    setHasChanges(true);
    setSaveStatus('idle');
  }

  function validateAcronym(val: string) {
    const upper = val.toUpperCase();
    if (upper.length < 4) setAcronymError('Acronym must be at least 4 characters.');
    else if (!upper.includes('MUN')) setAcronymError("Acronym must include 'MUN' — e.g. TEIMUN, LIMUN, SMUNC.");
    else setAcronymError('');
  }

  async function handlePublicToggle() {
    if (!conference) return;
    const next = !isPublic;
    setIsPublic(next);
    const supabase = createAuthClient();
    await supabase.from('conferences').update({ is_public: next }).eq('id', conference.id);
    await refreshConference();
  }

  async function handleSave() {
    if (!conference) return;
    setSaveStatus('saving');
    const supabase = createAuthClient();
    const { error } = await supabase.from('conferences').update({
      full_name: fullName,
      acronym: acronym.toUpperCase(),
      contact_email: contactEmail,
      student_level: studentLevel,
      start_date: startDate,
      end_date: endDate,
      country,
      city,
      format,
      expected_delegates: parseInt(expectedDelegates) || 0,
      fee_amount: parseFloat(feeAmount) || 0,
      fee_currency: feeCurrency,
      description: description || null,
      instagram_url: instagramUrl || null,
      facebook_url: facebookUrl || null,
      tiktok_url: tiktokUrl || null,
      whatsapp_url: whatsappUrl || null,
      website_url: websiteUrl || null,
    }).eq('id', conference.id);

    if (error) {
      setSaveStatus('error');
    } else {
      setSaveStatus('saved');
      setHasChanges(false);
      await refreshConference();
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 3000);
    }
  }

  if (!conference) return null;

  return (
    <div className="px-6 md:px-10 py-8 max-w-3xl pb-32">
      <h1 className="font-black text-2xl mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Conference Page</h1>
      <p className="text-sm mb-8" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
        Edit how your conference appears publicly on Gavelling.
      </p>

      {/* Card 1 — Basic Info */}
      <Card title="Basic Info">
        <div className="flex flex-col gap-5">
          <Field label="Full Conference Name">
            <input
              type="text"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); markChanged(); }}
              style={inputStyle}
              onFocus={fg} onBlur={bg}
              placeholder="e.g. The European International Model United Nations"
            />
          </Field>

          <Field label="Short Name / Acronym">
            <input
              type="text"
              value={acronym.toUpperCase()}
              onChange={(e) => { setAcronym(e.target.value.toUpperCase()); markChanged(); }}
              onBlur={(e) => { bg(e); validateAcronym(e.target.value); }}
              onFocus={fg}
              style={inputStyle}
              placeholder="e.g. TEIMUN"
            />
            {acronymError && (
              <p className="flex items-center gap-1.5 mt-1.5 text-sm" style={{ color: '#B8844A', fontFamily: "'Outfit', sans-serif" }}>
                <AlertTriangle size={14} />{acronymError}
              </p>
            )}
          </Field>

          <Field label="Organizer Contact Email">
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => { setContactEmail(e.target.value); markChanged(); }}
              style={inputStyle}
              onFocus={fg} onBlur={bg}
              placeholder="conference@example.com"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date">
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); markChanged(); }} style={inputStyle} onFocus={fg} onBlur={bg} />
            </Field>
            <Field label="End Date">
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); markChanged(); }} style={inputStyle} onFocus={fg} onBlur={bg} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Country">
              <input type="text" value={country} onChange={(e) => { setCountry(e.target.value); markChanged(); }} style={inputStyle} onFocus={fg} onBlur={bg} placeholder="e.g. Netherlands" />
            </Field>
            <Field label="City">
              <input type="text" value={city} onChange={(e) => { setCity(e.target.value); markChanged(); }} style={inputStyle} onFocus={fg} onBlur={bg} placeholder="e.g. The Hague" />
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
              onChange={(v) => { setFormat(v); markChanged(); }}
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
              onChange={(v) => { setStudentLevel(v); markChanged(); }}
            />
          </Field>

          <Field label="Expected Delegates">
            <input
              type="number"
              min={1}
              value={expectedDelegates}
              onChange={(e) => { setExpectedDelegates(e.target.value); markChanged(); }}
              style={inputStyle}
              onFocus={fg} onBlur={bg}
              placeholder="e.g. 300"
            />
          </Field>

          <Field label="Conference Fee">
            <div className="flex gap-3">
              <select
                value={feeCurrency}
                onChange={(e) => { setFeeCurrency(e.target.value); markChanged(); }}
                style={{ ...inputStyle, width: '30%', cursor: 'pointer' }}
                onFocus={fg} onBlur={bg}
              >
                {['GBP', 'USD', 'EUR', 'CHF'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number"
                min={0}
                step={0.01}
                value={feeAmount}
                onChange={(e) => { setFeeAmount(e.target.value); markChanged(); }}
                style={{ ...inputStyle, width: '70%' }}
                onFocus={fg} onBlur={bg}
                placeholder="0.00"
              />
            </div>
          </Field>
        </div>
      </Card>

      {/* Card 2 — Description */}
      <Card title="Description">
        <textarea
          rows={8}
          value={description}
          onChange={(e) => { setDescription(e.target.value); markChanged(); }}
          placeholder="Describe your conference — theme, what to expect, fee inclusions, social events."
          style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
          onFocus={fg} onBlur={bg}
        />
        <p className="text-xs mt-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          Describe your conference — theme, what to expect, fee inclusions, social events.
        </p>
      </Card>

      {/* Card 3 — Social Media */}
      <Card title="Social Media">
        <div className="flex flex-col gap-3">
          <SocialInput icon={<Camera size={16} />} placeholder="Instagram URL" value={instagramUrl} onChange={(v) => { setInstagramUrl(v); markChanged(); }} />
          <SocialInput icon={<Globe size={16} />} placeholder="Facebook URL" value={facebookUrl} onChange={(v) => { setFacebookUrl(v); markChanged(); }} />
          <SocialInput icon={<Music size={16} />} placeholder="TikTok URL" value={tiktokUrl} onChange={(v) => { setTiktokUrl(v); markChanged(); }} />
          <SocialInput icon={<MessageCircle size={16} />} placeholder="WhatsApp URL" value={whatsappUrl} onChange={(v) => { setWhatsappUrl(v); markChanged(); }} />
          <SocialInput icon={<Globe size={16} />} placeholder="Website URL" value={websiteUrl} onChange={(v) => { setWebsiteUrl(v); markChanged(); }} />
        </div>
      </Card>

      {/* Card 4 — Privacy */}
      <Card title="Privacy">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Public listing</p>
            <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              When public, your conference appears on gavelling.com/conferences and can be found by delegates.
            </p>
          </div>
          {/* Toggle */}
          <button
            type="button"
            onClick={handlePublicToggle}
            className="relative flex-shrink-0 ml-6 focus:outline-none"
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '9999px',
              backgroundColor: isPublic ? '#1B3828' : '#DDD4C0',
              transition: 'background-color 200ms ease',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span
              className="absolute top-0.5 rounded-full transition-all duration-200"
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: 'white',
                left: isPublic ? '22px' : '2px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>
      </Card>

      {/* Sticky save bar */}
      <div
        className="fixed bottom-0 left-0 right-0 md:left-[220px] px-6 py-4 flex items-center justify-between z-20"
        style={{ backgroundColor: '#FAF8F3', borderTop: '1px solid #DDD4C0' }}
      >
        <span
          className="text-sm"
          style={{
            color: saveStatus === 'saved'
              ? '#3D7A52'
              : saveStatus === 'error'
              ? '#8B2020'
              : hasChanges
              ? '#B8844A'
              : '#9A8A78',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {saveStatus === 'saving' ? 'Saving...'
            : saveStatus === 'saved' ? 'All changes saved'
            : saveStatus === 'error' ? 'Failed to save. Try again.'
            : hasChanges ? 'Unsaved changes'
            : 'All changes saved'}
        </span>
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="rounded-xl py-2.5 px-8 font-bold text-sm tracking-widest transition-colors focus:outline-none"
          style={{
            backgroundColor: saveStatus === 'saving' ? '#DDD4C0' : '#1B3828',
            color: saveStatus === 'saving' ? '#9A8A78' : '#EED98A',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.07em',
          }}
          onMouseEnter={(e) => { if (saveStatus !== 'saving') (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={(e) => { if (saveStatus !== 'saving') (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          {saveStatus === 'saving' ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </div>
    </div>
  );
}
