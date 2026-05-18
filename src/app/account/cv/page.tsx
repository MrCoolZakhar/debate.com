'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createAuthClient } from '@/lib/supabase-auth';

interface CVEntry {
  id: string;
  conference_name: string;
  committee: string;
  allocation: string;
  expertise_level: string;
  award: string;
  source: 'gavelling_verified' | 'manual';
  created_at: string;
}

const AWARD_OPTIONS = [
  'None',
  'Best Delegate',
  'Outstanding Delegate',
  'Honorable Mention',
  'Best Position Paper',
  'Best Speaker',
  'Other',
];

const EXPERTISE_LEVELS_MODAL = ['beginner', 'intermediate', 'advanced', 'expert'];

function AddCVEntryModal({
  onClose,
  onAdded,
  userId,
}: {
  onClose: () => void;
  onAdded: () => void;
  userId: string;
}) {
  const [conferenceName, setConferenceName] = useState('');
  const [committee, setCommittee]           = useState('');
  const [allocation, setAllocation]         = useState('');
  const [expertiseLevel, setExpertiseLevel] = useState('');
  const [award, setAward]                   = useState('None');
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!conferenceName || !committee || !allocation || !expertiseLevel) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    const supabase = createAuthClient();
    const { error: dbErr } = await supabase.from('mun_cv_entries').insert({
      user_id:        userId,
      conference_name: conferenceName,
      committee,
      allocation,
      expertise_level: expertiseLevel,
      award:           award || 'None',
      source:          'manual',
    });
    setSubmitting(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    onAdded();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-6"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 16px 48px rgba(28,20,16,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="font-semibold text-base mb-4"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          Add Conference
        </h2>

        {error && (
          <p
            className="text-xs mb-3 px-3 py-2 rounded-xl"
            style={{ backgroundColor: 'rgba(139,32,32,0.08)', color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Conference Name
            </label>
            <input
              type="text"
              required
              value={conferenceName}
              onChange={(e) => setConferenceName(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Committee
            </label>
            <input
              type="text"
              required
              value={committee}
              onChange={(e) => setCommittee(e.target.value)}
              placeholder="e.g. UN Security Council"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Country / Portfolio / Allocation
            </label>
            <input
              type="text"
              required
              value={allocation}
              onChange={(e) => setAllocation(e.target.value)}
              placeholder="e.g. China, EU Observer"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Expertise Level
            </label>
            <div className="flex gap-2 flex-wrap">
              {EXPERTISE_LEVELS_MODAL.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setExpertiseLevel(lvl)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none transition-all"
                  style={{
                    border: expertiseLevel === lvl ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                    backgroundColor: expertiseLevel === lvl ? 'rgba(27,56,40,0.06)' : 'transparent',
                    color: expertiseLevel === lvl ? '#1B3828' : '#9A8A78',
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '0.05em',
                  }}
                >
                  {lvl.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Award
            </label>
            <select
              value={award}
              onChange={(e) => setAward(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            >
              {AWARD_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 font-semibold text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', color: '#9A8A78', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: submitting ? '#DDD4C0' : '#1B3828',
                color: submitting ? '#9A8A78' : '#EED98A',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '0.06em',
              }}
            >
              {submitting ? 'SAVING...' : 'ADD ENTRY'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CVPage() {
  const { user, profile } = useAuth();
  const [entries, setEntries]         = useState<CVEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  async function fetchEntries() {
    if (!user) return;
    const supabase = createAuthClient();
    const { data } = await supabase
      .from('mun_cv_entries')
      .select('id, conference_name, committee, allocation, expertise_level, award, source, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setEntries((data as CVEntry[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const supabase = createAuthClient();
    await supabase.from('mun_cv_entries').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDeletingId(null);
  }

  const totalConferences = entries.length;
  const totalAwards      = entries.filter((e) => e.award && e.award !== 'None').length;
  const totalVerified    = entries.filter((e) => e.source === 'gavelling_verified').length;
  const expLevel         = profile ? (profile as any).mun_experience_level : null;

  if (loading) {
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
        MUN CV
      </h1>
      <p
        className="text-sm mb-8"
        style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
      >
        Your Model UN conference history.
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Conferences', value: totalConferences },
          { label: 'Awards', value: totalAwards },
          {
            label: 'Verified',
            value: (
              <span className="flex items-center justify-center gap-1">
                {totalVerified}
                {totalVerified > 0 && (
                  <span
                    className="text-xs"
                    style={{ color: '#3D7A52', fontFamily: "'DM Mono', monospace" }}
                  >
                    ✓
                  </span>
                )}
              </span>
            ),
          },
          {
            label: 'Experience Level',
            value: expLevel ? (
              <span className="capitalize">{expLevel}</span>
            ) : (
              <span style={{ color: '#9A8A78' }}>Not set</span>
            ),
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="rounded-xl p-4 text-center"
            style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
          >
            <p
              className="font-black text-2xl"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            >
              {stat.value}
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Header row with ADD button */}
      <div className="flex items-center justify-between mb-4">
        <p
          className="text-sm font-semibold"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-xl py-2 px-5 font-bold text-sm focus:outline-none transition-colors"
          style={{
            backgroundColor: '#1B3828',
            color: '#EED98A',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.06em',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          ADD ENTRY
        </button>
      </div>

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p
            className="text-lg font-semibold mb-2"
            style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
          >
            No entries yet
          </p>
          <p
            className="text-sm mb-6 max-w-sm"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          >
            Add your past conferences manually or they&apos;ll appear automatically when you attend Gavelling-verified conferences.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: '#1B3828',
              color: '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.06em',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            ADD YOUR FIRST ENTRY →
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const date = new Date(entry.created_at);
            const dateStr = date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
            const isVerified = entry.source === 'gavelling_verified';

            return (
              <div
                key={entry.id}
                className="rounded-2xl p-5 transition-colors"
                style={{
                  backgroundColor: '#FAF8F3',
                  border: '1px solid #DDD4C0',
                  borderLeft: `4px solid ${isVerified ? '#1B3828' : '#DDD4C0'}`,
                  cursor: 'default',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = isVerified ? '#1B3828' : '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.borderLeftColor = isVerified ? '#1B3828' : '#DDD4C0'; }}
              >
                {/* Row 1: Conference name + source badge */}
                <div className="flex items-start justify-between gap-3">
                  <p
                    className="font-semibold text-base"
                    style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                  >
                    {entry.conference_name}
                  </p>
                  <span
                    className="flex-shrink-0 rounded-full px-2 py-0.5"
                    style={
                      isVerified
                        ? { backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: "'DM Mono', monospace", fontSize: '9px' }
                        : { backgroundColor: 'rgba(154,138,120,0.1)', color: '#9A8A78', fontFamily: "'DM Mono', monospace", fontSize: '9px' }
                    }
                  >
                    {isVerified ? 'VERIFIED ✓' : 'SELF-REPORTED'}
                  </span>
                </div>

                {/* Row 2: Committee + allocation */}
                <p
                  className="text-sm mt-1"
                  style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
                >
                  {entry.committee}
                  {entry.allocation && (
                    <>
                      <span className="mx-1">·</span>
                      <span style={{ color: '#1C1410', fontWeight: 500 }}>{entry.allocation}</span>
                    </>
                  )}
                </p>

                {/* Row 3: Pills */}
                <div className="flex gap-2 flex-wrap mt-2">
                  {entry.expertise_level && (
                    <span
                      className="rounded-full px-2 py-0.5 capitalize"
                      style={{
                        backgroundColor: 'rgba(27,56,40,0.07)',
                        color: '#1B3828',
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '9px',
                      }}
                    >
                      {entry.expertise_level}
                    </span>
                  )}
                  {entry.award && entry.award !== 'None' && (
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: 'rgba(238,217,138,0.2)',
                        color: '#B6871F',
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '9px',
                      }}
                    >
                      {entry.award}
                    </span>
                  )}
                </div>

                {/* Row 4: Date + delete */}
                <div className="flex items-center justify-between mt-2">
                  <p
                    className="text-xs"
                    style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}
                  >
                    {dateStr}
                  </p>
                  {entry.source === 'manual' && (
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-xs focus:outline-none transition-colors"
                      style={{
                        color: deletingId === entry.id ? '#9A8A78' : '#8B2020',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                    >
                      {deletingId === entry.id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && user && (
        <AddCVEntryModal
          userId={user.id}
          onClose={() => setShowModal(false)}
          onAdded={fetchEntries}
        />
      )}
    </div>
  );
}
