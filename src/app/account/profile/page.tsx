'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { UN_COUNTRIES } from '@/lib/countries';

const EXPERIENCE_LEVELS = [
  { value: 'beginner',     label: 'BEGINNER',     sub: 'First or second conference' },
  { value: 'intermediate', label: 'INTERMEDIATE', sub: '3–10 conferences' },
  { value: 'advanced',     label: 'ADVANCED',     sub: '10–20 conferences' },
  { value: 'expert',       label: 'EXPERT',       sub: '20+ conferences' },
];

const NOTIFICATION_ROWS = [
  { field: 'notify_email_marketing'   as const, label: 'Marketing & Newsletter',   desc: 'Updates about new Gavelling features and MUN news' },
  { field: 'notify_email_applications' as const, label: 'Application Updates',     desc: 'Acceptance, rejection, and assignment notifications' },
  { field: 'notify_email_documents'   as const, label: 'Document Notifications',   desc: 'Study guide releases and position paper feedback' },
  { field: 'notify_email_reminders'   as const, label: 'Conference Reminders',     desc: 'Reminders before conferences you\'re attending' },
];

type NotifFields = {
  notify_email_marketing:    boolean;
  notify_email_applications: boolean;
  notify_email_documents:    boolean;
  notify_email_reminders:    boolean;
};

export default function ProfilePage() {
  const { user, session, profile, signOut, loading: authLoading } = useAuth();

  const [displayName, setDisplayName]       = useState('');
  const [nationality, setNationality]       = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [notifications, setNotifications]   = useState<NotifFields>({
    notify_email_marketing:    true,
    notify_email_applications: true,
    notify_email_documents:    true,
    notify_email_reminders:    true,
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);

    supabase
      .from('profiles')
      .select('display_name, nationality, mun_experience_level, notify_email_marketing, notify_email_applications, notify_email_documents, notify_email_reminders')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? '');
          setNationality(data.nationality ?? '');
          setExperienceLevel(data.mun_experience_level ?? '');
          setNotifications({
            notify_email_marketing:    data.notify_email_marketing    ?? true,
            notify_email_applications: data.notify_email_applications ?? true,
            notify_email_documents:    data.notify_email_documents    ?? true,
            notify_email_reminders:    data.notify_email_reminders    ?? true,
          });
        }
        setDataLoading(false);
      });
  }, [authLoading, user?.id, session?.access_token]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase
      .from('profiles')
      .update({
        display_name:        displayName,
        nationality:         nationality || null,
        mun_experience_level: experienceLevel || null,
      })
      .eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleToggle(field: keyof NotifFields, value: boolean) {
    setNotifications((prev) => ({ ...prev, [field]: value }));
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    supabase.from('profiles').update({ [field]: value }).eq('id', user!.id);
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = '/';
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div>
      <h1
        className="font-black text-2xl mb-1"
        style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
      >
        My Profile
      </h1>
      <p
        className="text-sm mb-8"
        style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
      >
        Manage your Gavelling account details.
      </p>

      {/* Card 1 — Basic Info */}
      <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
        <h2
          className="font-semibold text-base mb-4"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          Basic Information
        </h2>

        <div className="space-y-4">
          {/* Display Name */}
          <div>
            <label
              className="block text-sm font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            >
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label
              className="block text-sm font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            >
              Email
            </label>
            <input
              type="email"
              value={profile?.email ?? user?.email ?? ''}
              readOnly
              className="w-full rounded-xl px-4 py-3 text-sm"
              style={{
                border: '1px solid #DDD4C0',
                backgroundColor: 'rgba(0,0,0,0.03)',
                color: 'rgba(28,20,16,0.4)',
                fontFamily: "'Outfit', sans-serif",
                cursor: 'not-allowed',
              }}
            />
            <p
              className="text-xs mt-1"
              style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
            >
              Email cannot be changed here.
            </p>
          </div>

          {/* Nationality */}
          <div>
            <label
              className="block text-sm font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            >
              Nationality
            </label>
            <select
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            >
              <option value="">Select nationality</option>
              {UN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* MUN Experience Level */}
          <div>
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            >
              MUN Experience Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              {EXPERIENCE_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  onClick={() => setExperienceLevel(lvl.value)}
                  className="rounded-xl p-3 text-center focus:outline-none transition-all"
                  style={{
                    border: experienceLevel === lvl.value ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                    backgroundColor: experienceLevel === lvl.value ? 'rgba(27,56,40,0.06)' : 'transparent',
                  }}
                >
                  <p
                    className="font-semibold text-sm"
                    style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                  >
                    {lvl.label}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
                  >
                    {lvl.sub}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: saving ? '#DDD4C0' : '#1B3828',
              color: saving ? '#9A8A78' : '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.06em',
            }}
            onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
          {saved && (
            <span
              className="text-sm font-semibold"
              style={{ color: '#3D7A52', fontFamily: "'Outfit', sans-serif" }}
            >
              Saved ✓
            </span>
          )}
        </div>
      </div>

      {/* Card 2 — Notification Preferences */}
      <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
        <h2
          className="font-semibold text-base mb-1"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          Notification Preferences
        </h2>
        <p
          className="text-sm mb-4"
          style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
        >
          Control which emails Gavelling sends you.
        </p>

        <div>
          {NOTIFICATION_ROWS.map((row, i) => (
            <div
              key={row.field}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: i < NOTIFICATION_ROWS.length - 1 ? '1px solid #F0EDE6' : 'none' }}
            >
              <div className="flex-1 min-w-0 pr-4">
                <p
                  className="font-semibold text-sm"
                  style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                >
                  {row.label}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
                >
                  {row.desc}
                </p>
              </div>
              <button
                onClick={() => handleToggle(row.field, !notifications[row.field])}
                className="relative flex-shrink-0 focus:outline-none"
                style={{
                  width: '40px',
                  height: '22px',
                  borderRadius: '9999px',
                  backgroundColor: notifications[row.field] ? '#1B3828' : '#DDD4C0',
                  transition: 'background-color 200ms ease',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span
                  className="absolute top-[3px] rounded-full"
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: 'white',
                    left: notifications[row.field] ? '21px' : '3px',
                    transition: 'left 200ms ease',
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Card 3 — Danger Zone */}
      <div
        className="rounded-2xl p-6"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid rgba(139,32,32,0.2)' }}
      >
        <h2
          className="font-semibold text-base mb-4"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          Account
        </h2>
        <button
          onClick={handleSignOut}
          className="w-full rounded-xl py-2.5 font-semibold text-sm focus:outline-none transition-colors"
          style={{
            border: '1px solid rgba(139,32,32,0.3)',
            color: '#8B2020',
            backgroundColor: 'transparent',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.04em',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.05)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          SIGN OUT
        </button>
      </div>
    </div>
  );
}
