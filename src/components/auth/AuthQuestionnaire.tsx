'use client';

// The /auth/onboarding questionnaire, as the last steps of the sign-up pop-up
// (owner, 18 Sep 2026: "I would still like the questionnaire to pop up when
// they are signing up"). Same four questions and the same writes as the page:
//   1. Where do you do MUN?       → profiles.education_level
//   2. Which countries?           → profiles.mun_countries (ISO codes)
//   3. How experienced?           → profiles.mun_experience_level
//   4. Past conferences           → mun_cv_entries, through the shared
//                                   CVEntryModal (saved as they are added)
// Every question is optional and "Skip for now" (the header) ends it at once,
// still saving whatever was already picked, exactly like "I'll do this later".

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, X } from 'lucide-react';
import { supabaseAuthClient } from '@/lib/supabase-auth';
import { CVEntryModal, type CVEntry } from '@/components/CVEntryModal';
import { CVSummaryRow } from '@/components/CVSummaryRow';
import { FlagImg } from '@/components/FlagImg';
import { UN_COUNTRIES } from '@/lib/countries';
import { FloatInput, GreenButton, OptionRow } from './authModalKit';

export const QUESTION_COUNT = 4;

const EDUCATION = [
  { key: 'high_school', label: 'High School', sub: 'MUN clubs, school delegations, and student conferences.', image: '/onboarding/classroom-01.jpg' },
  { key: 'university', label: 'University', sub: 'Collegiate circuits, societies, and international conferences.', image: '/onboarding/campus-01.jpg' },
];

const LEVELS = [
  { key: 'beginner', label: 'Beginner', sub: '0 to 1 conferences', icon: '🌱' },
  { key: 'intermediate', label: 'Intermediate', sub: '2 to 4 conferences', icon: '📘' },
  { key: 'advanced', label: 'Advanced', sub: '5 to 8 conferences', icon: '🏅' },
  { key: 'expert', label: 'Expert', sub: '9 or more conferences', icon: '🏆' },
];

export const QUESTION_TITLES = [
  'Where do you do MUN?',
  'Where do you usually compete?',
  'How experienced are you?',
  'Been to conferences before?',
];

export default function AuthQuestionnaire({
  q, setQ, onDone, registerSave, onNestedOpen,
}: {
  q: number;
  setQ: (n: number) => void;
  onDone: () => void;
  registerSave: (fn: () => Promise<void>) => void;
  /** A dialog of its own (the conference form) is open over the pop-up. */
  onNestedOpen: (open: boolean) => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [education, setEducation] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [level, setLevel] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [cvEntries, setCvEntries] = useState<CVEntry[]>([]);
  const [cvOpen, setCvOpen] = useState(false);
  const [cvEntry, setCvEntry] = useState<CVEntry | null>(null);

  useEffect(() => {
    supabaseAuthClient.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => { onNestedOpen(cvOpen); }, [cvOpen, onNestedOpen]);

  /** The same patch /auth/onboarding writes. Only what was answered. */
  const persist = useCallback(async () => {
    if (!userId) return;
    const patch: Record<string, unknown> = {};
    if (education) patch.education_level = education;
    if (countries.length > 0) patch.mun_countries = countries;
    if (level) patch.mun_experience_level = level;
    if (Object.keys(patch).length > 0) {
      await supabaseAuthClient.from('profiles').update(patch).eq('id', userId);
    }
  }, [userId, education, countries, level]);

  useEffect(() => { registerSave(persist); }, [persist, registerSave]);

  const fetchCv = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabaseAuthClient
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
  }, [userId]);

  useEffect(() => { void fetchCv(); }, [fetchCv]);

  const shownCountries = useMemo(() => {
    const t = query.trim().toLowerCase();
    const list = t ? UN_COUNTRIES.filter((c) => c.name.toLowerCase().includes(t)) : UN_COUNTRIES;
    return list.slice(0, 200);
  }, [query]);

  async function finish() {
    setSaving(true);
    try { await persist(); } finally { setSaving(false); onDone(); }
  }

  const label = (answered: boolean) => (answered ? 'Continue' : 'Skip this question');

  return (
    <div className="gv-auth-screen">
      <p className="gv-auth-count">{q + 1} of {QUESTION_COUNT}</p>
      <h2 id="gv-auth-title" className="gv-auth-qtitle">{QUESTION_TITLES[q]}</h2>

      {q === 0 && (
        <>
          <p className="gv-auth-sub" style={{ margin: '0 0 6px' }}>This helps us show you the right conferences first.</p>
          <div role="radiogroup" aria-label={QUESTION_TITLES[0]} className="gv-auth-screen" style={{ gap: 10 }}>
            {EDUCATION.map((o) => (
              <OptionRow
                key={o.key}
                selected={education === o.key}
                onClick={() => { setEducation(o.key); window.setTimeout(() => setQ(1), 260); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.image} alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                <span>
                  <span className="gv-opt-title">{o.label}</span>
                  <span className="gv-opt-sub">{o.sub}</span>
                </span>
              </OptionRow>
            ))}
          </div>
          <GreenButton type="button" onClick={() => setQ(1)}>{label(!!education)}</GreenButton>
        </>
      )}

      {q === 1 && (
        <>
          <p className="gv-auth-sub" style={{ margin: '0 0 6px' }}>Pick as many as you like, and we will surface conferences in your region.</p>
          <FloatInput id="gv-q-country" label="Search countries" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          {countries.length > 0 && (
            <div className="gv-pills" aria-label="Chosen countries">
              {countries.map((code) => {
                const c = UN_COUNTRIES.find((x) => x.code === code);
                return (
                  <button
                    key={code}
                    type="button"
                    className="gv-pill"
                    onClick={() => setCountries((p) => p.filter((x) => x !== code))}
                    aria-label={`Remove ${c?.name ?? code}`}
                  >
                    <FlagImg code={code} size={18} />
                    {c?.name ?? code}
                    <X size={13} strokeWidth={2.4} aria-hidden />
                  </button>
                );
              })}
            </div>
          )}
          <div className="gv-list" role="group" aria-label={QUESTION_TITLES[1]}>
            {shownCountries.map((c) => {
              const on = countries.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className="gv-list-row"
                  onClick={() => setCountries((p) => (on ? p.filter((x) => x !== c.code) : [...p, c.code]))}
                >
                  <FlagImg code={c.code} size={24} />
                  <span>{c.name}</span>
                  <span className={`gv-check${on ? ' gv-check-on' : ''}`} aria-hidden>{on ? <Check size={14} strokeWidth={3} /> : null}</span>
                </button>
              );
            })}
            {shownCountries.length === 0 && <p className="gv-hint" style={{ padding: 14 }}>No country matches that.</p>}
          </div>
          <GreenButton type="button" onClick={() => setQ(2)}>{label(countries.length > 0)}</GreenButton>
        </>
      )}

      {q === 2 && (
        <>
          <p className="gv-auth-sub" style={{ margin: '0 0 6px' }}>A rough starting point. It updates as your MUN CV grows.</p>
          <div role="radiogroup" aria-label={QUESTION_TITLES[2]} className="gv-auth-screen" style={{ gap: 10 }}>
            {LEVELS.map((o) => (
              <OptionRow key={o.key} selected={level === o.key} onClick={() => setLevel(o.key)}>
                <span style={{ fontSize: 26, lineHeight: 1, width: 32, textAlign: 'center' }} aria-hidden>{o.icon}</span>
                <span>
                  <span className="gv-opt-title">{o.label}</span>
                  <span className="gv-opt-sub">{o.sub}</span>
                </span>
              </OptionRow>
            ))}
          </div>
          <GreenButton type="button" onClick={() => setQ(3)}>{label(!!level)}</GreenButton>
        </>
      )}

      {q === 3 && (
        <>
          <p className="gv-auth-sub" style={{ margin: '0 0 6px' }}>Add any you have attended and we will start your MUN CV. You can always add them later.</p>
          {cvEntries.map((entry) => (
            <CVSummaryRow key={entry.id} entry={entry} onEdit={() => { setCvEntry(entry); setCvOpen(true); }} />
          ))}
          <button type="button" className="gv-add" onClick={() => { setCvEntry(null); setCvOpen(true); }} disabled={!userId}>
            <Plus size={17} strokeWidth={2.4} aria-hidden />
            {cvEntries.length > 0 ? 'Add another conference' : 'Add a conference'}
          </button>
          <GreenButton type="button" busy={saving} busyText="Saving…" onClick={() => void finish()}>
            {cvEntries.length > 0 ? 'Finish' : 'Skip and finish'}
          </GreenButton>
        </>
      )}

      {cvOpen && userId && createPortal(
        // Its own dialog, over the pop-up (z 9100): a body-level layer above it.
        <div style={{ position: 'fixed', inset: 0, zIndex: 9200 }}>
          <CVEntryModal
            existing={cvEntry}
            userId={userId}
            onClose={() => { setCvOpen(false); setCvEntry(null); }}
            onSaved={fetchCv}
            onDelete={async (id: string) => {
              setCvEntries((p) => p.filter((e) => e.id !== id));
              await supabaseAuthClient.from('mun_cv_entries').delete().eq('id', id);
            }}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
