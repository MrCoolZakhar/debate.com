'use client';

// Shared committee editor modal — extracted from manage/[slug]/committees/page.tsx
// so the organiser committees tab and the public conference page can share it.
// Exposes: CommitteeEditorModal (create + edit, with built-in type picker for the
// create flow), MonogramMedallion (fallback emblem), ModalOverlay (house modal
// backdrop) and mintConferenceSession (session minting for conference committees).

import { useState, useEffect, useMemo } from 'react';
import { X, Globe, Users, ClipboardList } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { getCountryByName, findCountryFlexible, UN_COUNTRIES } from '@/lib/countries';
import { UNSC_MEMBERS } from '@/lib/presets';
import { FlagImg } from '@/components/FlagImg';
import { CountryMatrixPicker } from '@/components/CountryMatrixPicker';
import { CommitteeNameInput } from '@/components/CommitteeNameInput';

// ── Design constants ──────────────────────────────────────────────────────────

// Same recipe as the public conference detail page committee cards.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #DDD4C0',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  color: '#1C1410',
  backgroundColor: '#FAF8F3',
  outline: 'none',
  fontFamily: "'Outfit', sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#6E5F4E',
  fontFamily: "'Outfit', sans-serif",
  letterSpacing: '0.01em',
  marginBottom: 4,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EditableCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  session_id: string | null;
  logo_url: string | null;
}

// ── Quick roster templates ────────────────────────────────────────────────────
// Country-name arrays validated against UN_COUNTRIES at module load (dev warn on
// misses). Clicking a chip REPLACES the current selection (confirmed if the
// organiser already hand-picked >3 countries). Hidden for crisis committees.

// Non-UN-member entries in UN_COUNTRIES — excluded from the "UN Full" roster.
const NON_UN_MEMBER_CODES = new Set(['TW', 'XK', 'PS', 'VA', 'CK', 'NU', 'EU']);
const UN_FULL_MEMBERS: string[] = UN_COUNTRIES.filter((c) => !NON_UN_MEMBER_CODES.has(c.code)).map((c) => c.name);

// A geographically balanced 60-country General Assembly / DISEC sample.
const GA_SAMPLE_60: string[] = [
  // Africa (14)
  'Algeria', 'DR Congo', 'Egypt', 'Ethiopia', 'Ghana', 'Kenya', 'Morocco', 'Nigeria',
  'Rwanda', 'Senegal', 'South Africa', 'Sudan', 'Tanzania', 'Tunisia',
  // Asia (16)
  'Bangladesh', 'China', 'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Japan',
  'Kazakhstan', 'Malaysia', 'Pakistan', 'Philippines', 'Qatar', 'Saudi Arabia', 'South Korea', 'Vietnam',
  // Europe (14)
  'France', 'Germany', 'Greece', 'Italy', 'Netherlands', 'Norway', 'Poland', 'Romania',
  'Russia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom',
  // Americas (12)
  'Argentina', 'Brazil', 'Canada', 'Chile', 'Colombia', 'Cuba', 'Guatemala', 'Jamaica',
  'Mexico', 'Peru', 'United States', 'Venezuela',
  // Oceania (4)
  'Australia', 'Fiji', 'New Zealand', 'Papua New Guinea',
];

// 54-seat ECOSOC roster following the UN regional-group distribution
// (14 African, 11 Asia-Pacific, 6 Eastern European, 10 GRULAC, 13 WEOG).
const ECOSOC_54: string[] = [
  // African states (14)
  'Algeria', 'Cameroon', "Côte d'Ivoire", 'DR Congo', 'Egypt', 'Ethiopia', 'Ghana',
  'Kenya', 'Libya', 'Mauritius', 'Nigeria', 'Senegal', 'South Africa', 'Zimbabwe',
  // Asia-Pacific states (11)
  'China', 'India', 'Indonesia', 'Japan', 'Pakistan', 'Qatar', 'Saudi Arabia',
  'Solomon Islands', 'South Korea', 'Turkmenistan', 'Vietnam',
  // Eastern European states (6)
  'Armenia', 'Bulgaria', 'Poland', 'Russia', 'Serbia', 'Ukraine',
  // Latin American and Caribbean states (10)
  'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Costa Rica', 'Haiti',
  'Mexico', 'Paraguay', 'Peru',
  // Western European and other states (13)
  'Canada', 'Denmark', 'France', 'Germany', 'Italy', 'Netherlands', 'New Zealand',
  'Norway', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom', 'United States',
];

const EU_27: string[] = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark',
  'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy',
  'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal',
  'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
];

const G20_MEMBERS: string[] = [
  'Argentina', 'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany', 'India',
  'Indonesia', 'Italy', 'Japan', 'Mexico', 'South Korea', 'Russia', 'Saudi Arabia',
  'South Africa', 'Turkey', 'United Kingdom', 'United States',
];

const NATO_32: string[] = [
  'Albania', 'Belgium', 'Bulgaria', 'Canada', 'Croatia', 'Czech Republic', 'Denmark',
  'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy',
  'Latvia', 'Lithuania', 'Luxembourg', 'Montenegro', 'Netherlands', 'North Macedonia',
  'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
  'Turkey', 'United Kingdom', 'United States',
];

const ROSTER_TEMPLATES: { key: string; label: string; members: string[] }[] = [
  { key: 'unsc',   label: 'UNSC 2026', members: UNSC_MEMBERS },
  { key: 'ga60',   label: 'GA Sample', members: GA_SAMPLE_60 },
  { key: 'un193',  label: 'UN Full',   members: UN_FULL_MEMBERS },
  { key: 'ecosoc', label: 'ECOSOC',    members: ECOSOC_54 },
  { key: 'eu',     label: 'EU',        members: EU_27 },
  { key: 'g20',    label: 'G20',       members: G20_MEMBERS },
  { key: 'nato',   label: 'NATO',      members: NATO_32 },
];

// Dev-time validation: every template member must resolve in UN_COUNTRIES.
if (process.env.NODE_ENV !== 'production') {
  for (const tpl of ROSTER_TEMPLATES) {
    for (const m of tpl.members) {
      if (!getCountryByName(m)) console.warn(`[CommitteeEditorModal] Roster template "${tpl.label}" has unknown country: "${m}"`);
    }
  }
  if (UN_FULL_MEMBERS.length !== 193) console.warn(`[CommitteeEditorModal] UN Full roster has ${UN_FULL_MEMBERS.length} members, expected 193`);
}

// ── Paste-list parsing ────────────────────────────────────────────────────────

// Common shorthands findCountryFlexible can't resolve on its own ("UK" would
// otherwise prefix-match Ukraine). Checked before the flexible matcher.
const COUNTRY_ALIASES: Record<string, string> = {
  'uk': 'United Kingdom', 'gb': 'United Kingdom', 'britain': 'United Kingdom', 'great britain': 'United Kingdom',
  'us': 'United States', 'usa': 'United States', 'america': 'United States', 'united states of america': 'United States',
  'uae': 'United Arab Emirates', 'drc': 'DR Congo', 'roc': 'Taiwan', 'rok': 'South Korea',
  'dprk': 'North Korea', 'car': 'Central African Republic', 'png': 'Papua New Guinea',
  'holland': 'Netherlands', 'ivory coast': "Côte d'Ivoire", 'turkiye': 'Turkey', 'czechia': 'Czech Republic',
  // Official UN names that differ from our canonical short names.
  'republic of korea': 'South Korea', "democratic people's republic of korea": 'North Korea',
  'russian federation': 'Russia', 'viet nam': 'Vietnam',
};

function matchCountryToken(raw: string): string | null {
  // Fold accents so e.g. "Türkiye" hits the 'turkiye' alias.
  const n = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!n) return null;
  if (COUNTRY_ALIASES[n]) return COUNTRY_ALIASES[n];
  return findCountryFlexible(raw);
}

// Split pasted text on newlines / commas / semicolons / tabs / bullets and strip
// list markers ("1.", "-", "•") off each token.
function parsePasteTokens(text: string): string[] {
  return text
    .split(/\r?\n|[,;\t]|[·•]/)
    .map((s) => s.trim().replace(/^\d+[.)]\s*/, '').replace(/^[-–—*]\s*/, '').trim())
    .filter(Boolean);
}

function dedupeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const k = n.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(n.trim());
  }
  return out;
}

// ── Paste-list modal — house recipe of the sessions paste-review flow ─────────
// Non-crisis: fuzzy-matches each token via matchCountryToken and shows a review
// list (matched = flag + resolved name; unmatched = red, editable or discard).
// Crisis: skips country matching entirely — every token is a raw character name.

function PasteListModal({ isCrisis, existingCount, onCancel, onCommit }: {
  isCrisis: boolean;
  existingCount: number;
  onCancel: () => void;
  onCommit: (names: string[], mode: 'add' | 'replace') => void;
}) {
  const [text, setText] = useState('');
  const [overrides, setOverrides] = useState<Record<number, { name?: string; discarded?: boolean }>>({});

  // Parsed on the fly as the organiser types; edits/discards live in `overrides`
  // (reset whenever the raw text changes).
  const baseRows = useMemo(() => {
    const tokens = parsePasteTokens(text);
    const seen = new Set<string>();
    const rows: { original: string; name: string; matched: boolean }[] = [];
    for (const tok of tokens) {
      const found = isCrisis ? null : matchCountryToken(tok);
      const name = found ?? tok;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ original: tok, name, matched: !!found });
    }
    return rows;
  }, [text, isCrisis]);

  const rows = baseRows.map((r, i) => {
    const ov = overrides[i];
    if (!ov) return { ...r, discarded: false };
    const name = ov.name !== undefined ? ov.name : r.name;
    return {
      original: r.original,
      name,
      matched: ov.name !== undefined ? (!isCrisis && !!getCountryByName(name.trim())) : r.matched,
      discarded: !!ov.discarded,
    };
  });

  const kept = rows.filter((r) => !r.discarded && r.name.trim());
  const matchedCount = kept.filter((r) => r.matched).length;
  const unmatchedCount = kept.length - matchedCount;

  const commit = (mode: 'add' | 'replace') => {
    if (kept.length === 0) return;
    onCommit(kept.map((r) => r.name.trim()), mode);
  };

  const noun = isCrisis ? 'character' : 'country';

  return (
    <ModalOverlay onClose={onCancel}>
      <div className="w-full flex flex-col rounded-2xl overflow-hidden" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 460, maxWidth: '92vw', maxHeight: '80vh' }}>
        <div className="px-6 py-4 shrink-0 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
          <div>
            <h2 className="text-base font-black uppercase tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}>
              Paste {noun} list
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              {isCrisis
                ? 'One character per line — commas and semicolons work too.'
                : 'One country per line — names are matched automatically as you type.'}
            </p>
          </div>
          <button onClick={onCancel} className="focus:outline-none shrink-0 mt-0.5" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>
        <div className="px-6 pt-4 shrink-0">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setOverrides({}); }}
            autoFocus
            placeholder={isCrisis ? 'Napoleon Bonaparte\nTalleyrand, Joseph Fouché...' : 'France\nGermany, brazil; UK...'}
            className="w-full rounded-xl px-3 py-2 text-sm resize-none focus:outline-none"
            style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: "'Outfit', sans-serif", height: 104 }}
          />
        </div>
        {rows.length > 0 && (
          <div className="mx-6 mt-3 rounded-xl overflow-y-auto min-h-0" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', maxHeight: 240 }}>
            {rows.map((r, idx) => {
              if (r.discarded) return null;
              const found = !isCrisis ? getCountryByName(r.name.trim()) : undefined;
              return (
                <div key={idx} className="flex items-center gap-2.5 px-4 py-2" style={{ borderBottom: '1px solid #F0EDE6' }}>
                  {isCrisis
                    ? <Users size={14} strokeWidth={1.5} style={{ color: '#9A8A78', flexShrink: 0 }} />
                    : found
                      ? <FlagImg code={found.code} size={18} />
                      : <Globe size={14} strokeWidth={1.5} style={{ color: '#8B2020', flexShrink: 0 }} />}
                  {r.matched || isCrisis ? (
                    <span className="text-sm flex-1 truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      {r.name}
                      {!isCrisis && r.original.trim().toLowerCase() !== r.name.trim().toLowerCase() && (
                        <span className="text-xs ml-1.5" style={{ color: '#9A8A78' }}>from &quot;{r.original}&quot;</span>
                      )}
                    </span>
                  ) : (
                    <input
                      value={r.name}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [idx]: { ...prev[idx], name: e.target.value } }))}
                      className="text-sm flex-1 min-w-0 rounded-lg px-2 py-1 focus:outline-none"
                      style={{ border: '1px solid #C46A6A', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                    />
                  )}
                  {!isCrisis && (
                    <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 px-2 py-0.5 rounded-full" style={{ fontFamily: "'Outfit', sans-serif", ...(r.matched ? { color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.1)' } : { color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.1)' }) }}>
                      {r.matched ? 'Matched' : 'No match'}
                    </span>
                  )}
                  <button
                    onClick={() => setOverrides((prev) => ({ ...prev, [idx]: { ...prev[idx], discarded: true } }))}
                    className="text-xs shrink-0 focus:outline-none"
                    style={{ color: '#9A8A78' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="px-6 py-4 shrink-0 flex items-center gap-3">
          <p className="text-xs flex-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            {kept.length === 0
              ? 'Nothing to add yet.'
              : isCrisis
                ? `${kept.length} character${kept.length === 1 ? '' : 's'}`
                : `${matchedCount} matched${unmatchedCount > 0 ? `, ${unmatchedCount} unmatched` : ''}`}
          </p>
          <button
            onClick={() => commit('add')}
            disabled={kept.length === 0}
            className="rounded-xl py-2 px-4 font-bold text-xs focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ border: '1.5px solid #1B3828', color: '#1B3828', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em' }}
          >
            ADD {kept.length > 0 ? kept.length : ''}
          </button>
          <button
            onClick={() => commit('replace')}
            disabled={kept.length === 0}
            className="rounded-xl py-2 px-4 font-bold text-xs focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em' }}
            title={existingCount > 0 ? `Replaces the ${existingCount} currently selected` : undefined}
          >
            REPLACE {kept.length > 0 ? `WITH ${kept.length}` : ''}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Fallback emblem — gradient monogram disc with grain, matching the public card

export function MonogramMedallion({ text, isCrisis, size }: { text: string; isCrisis: boolean; size: number }) {
  const monogram = text.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || '—';
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: '9999px',
        background: isCrisis
          ? 'linear-gradient(135deg, #3C1414 0%, #6E1E1E 100%)'
          : 'linear-gradient(135deg, #16301F 0%, #2A5A3C 100%)',
        boxShadow: '0 10px 24px rgba(27,56,40,0.26)',
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.12 }} />
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: monogram.length > 4 ? Math.round(size * 0.135) : Math.round(size * 0.167), fontWeight: 700, color: '#EED98A', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
        {monogram}
      </span>
    </div>
  );
}

// ── Shared modal overlay ──────────────────────────────────────────────────────

export function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// ── Session minting ───────────────────────────────────────────────────────────

// Mint a real, joinable session for a conference committee and link it back.
// committees/current_speaker carry a public read/write RLS policy, so the authed
// organizer client can write them directly. Generates a unique 6-char code,
// retrying on a code-uniqueness collision. Returns the code, or null on failure.
export async function mintConferenceSession(
  supabase: ReturnType<typeof getAuthedClient>,
  confCommitteeId: string,
  name: string,
  topic: string,
  countries: string[],
): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const chairJoinSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const { data: sessionRow, error: sErr } = await supabase
      .from('committees')
      .insert({
        code,
        name,
        topic: topic || 'TBD',
        chair_names: [],
        phase: 'pre-session',
        speaker_time_limit: 90,
        settings: { chairJoinSuffix, separateChairCode: true },
        session_origin: 'conference',
      })
      .select('id')
      .single();
    if (sErr) {
      if (sErr.code === '23505') continue; // code collision — try a new code
      console.error('Error minting conference session:', sErr);
      return null;
    }
    await supabase.from('current_speaker').insert({
      committee_id: sessionRow.id,
      delegate_id: null,
      country: null,
      time_remaining: 90,
    });
    if (countries.length > 0) {
      await supabase.from('delegates').insert(
        countries.map((country) => ({ committee_id: sessionRow.id, country, status: 'absent' }))
      );
    }
    await supabase
      .from('conference_committees')
      .update({ session_id: sessionRow.id, session_code: code })
      .eq('id', confCommitteeId);
    return code;
  }
  return null;
}

// ── CommitteeEditor (create + edit) ───────────────────────────────────────────

function CommitteeEditor({ conferenceId, committeeType, existing, initialCountries, onClose, onSaved }: {
  conferenceId: string;
  committeeType: 'general-assembly' | 'crisis';
  existing?: EditableCommittee | null;
  initialCountries?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const isEdit = !!existing;
  const isCrisis = (existing ? existing.committee_type : committeeType) === 'crisis';
  const [name, setName] = useState(existing?.name ?? '');
  const [abbreviation, setAbbreviation] = useState(existing?.abbreviation ?? '');
  const [topics, setTopics] = useState<string[]>(existing?.topics ?? []);
  const [topicInput, setTopicInput] = useState('');
  const [difficulty, setDifficulty] = useState(existing?.difficulty ?? 'intermediate');
  const [countries, setCountries] = useState<string[]>(initialCountries ?? []);
  const [baselineCountries] = useState<string[]>(initialCountries ?? []);
  const [pendingRemovalCount, setPendingRemovalCount] = useState<number | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{ label: string; members: string[] } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(existing?.logo_url ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Mirrors the conference logo upload in manage/[slug]/settings — same bucket, own folder.
  async function handleEmblemUpload(file: File) {
    if (!session) return;
    if (file.size > 5 * 1024 * 1024) { setError('Emblem must be under 5MB.'); return; }
    setLogoUploading(true); setError('');
    const supabase = getAuthedClient(session.access_token);
    const ext = file.name.split('.').pop();
    const path = 'committee-emblems/' + conferenceId + '-' + Date.now() + '.' + ext;
    const { error: upErr } = await supabase.storage.from('conference-assets').upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) { setError('Upload failed: ' + upErr.message); setLogoUploading(false); return; }
    const { data: urlData } = supabase.storage.from('conference-assets').getPublicUrl(path);
    setLogoUrl(urlData.publicUrl);
    setLogoUploading(false);
  }

  // Quick roster chips REPLACE the selection; ask first if the organiser
  // already has more than a few countries picked.
  function applyTemplate(label: string, members: string[]) {
    if (countries.length > 3) { setPendingTemplate({ label, members }); return; }
    setCountries(dedupeNames(members));
  }

  function commitPaste(names: string[], mode: 'add' | 'replace') {
    if (mode === 'replace') setCountries(dedupeNames(names));
    else setCountries((prev) => dedupeNames([...prev, ...names]));
    setPasteOpen(false);
  }

  function addTopic() {
    const t = topicInput.trim();
    if (!t || topics.length >= 3 || topics.includes(t)) return;
    setTopics([...topics, t]);
    setTopicInput('');
  }

  async function doCreate(supabase: ReturnType<typeof getAuthedClient>): Promise<boolean> {
    const { data: created, error: err } = await supabase.from('conference_committees').insert({
      conference_id: conferenceId,
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics,
      difficulty,
      committee_type: committeeType,
      total_slots: countries.length,
      notification_email: null,
      logo_url: logoUrl,
    }).select('id').single();
    if (err || !created) { setError(err?.message ?? 'Failed to create committee.'); return false; }
    await supabase.from('committee_country_slots').insert(
      countries.map((country) => ({
        conference_committee_id: created.id,
        country_code: getCountryByName(country)?.code ?? country,
        country_name: country,
        delegation_size: 1,
      }))
    );
    await mintConferenceSession(supabase, created.id, name.trim(), topics[0] ?? '', countries);
    return true;
  }

  async function doEdit(supabase: ReturnType<typeof getAuthedClient>, force: boolean): Promise<'ok' | 'needs_confirm' | 'fail'> {
    const ex = existing!;
    const added = countries.filter(c => !baselineCountries.includes(c));
    const removed = baselineCountries.filter(c => !countries.includes(c));

    if (removed.length > 0 && !force) {
      const { data: allocs } = await supabase
        .from('conference_allocations')
        .select('id')
        .eq('conference_committee_id', ex.id)
        .in('country_name', removed);
      if ((allocs?.length ?? 0) > 0) {
        setPendingRemovalCount(allocs!.length);
        return 'needs_confirm';
      }
    }

    if (removed.length > 0) {
      await supabase.from('conference_allocations').delete().eq('conference_committee_id', ex.id).in('country_name', removed);
      await supabase.from('committee_country_slots').delete().eq('conference_committee_id', ex.id).in('country_name', removed);
      if (ex.session_id) {
        await supabase.from('delegates').delete().eq('committee_id', ex.session_id).in('country', removed);
      }
    }
    if (added.length > 0) {
      await supabase.from('committee_country_slots').insert(
        added.map((country) => ({
          conference_committee_id: ex.id,
          country_code: getCountryByName(country)?.code ?? country,
          country_name: country,
          delegation_size: 1,
        }))
      );
      if (ex.session_id) {
        await supabase.from('delegates').insert(
          added.map((country) => ({ committee_id: ex.session_id, country, status: 'absent' }))
        );
      }
    }
    await supabase.from('conference_committees').update({
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics,
      difficulty,
      total_slots: countries.length,
      logo_url: logoUrl,
    }).eq('id', ex.id);
    if (ex.session_id) {
      await supabase.from('committees').update({ name: name.trim(), topic: topics[0] ?? 'TBD' }).eq('id', ex.session_id);
    }
    return 'ok';
  }

  async function handleSave(force = false) {
    if (!name.trim()) { setError('Committee name is required.'); return; }
    if (topics.length === 0) { setError('Add at least one topic.'); return; }
    if (countries.length === 0) { setError(isCrisis ? 'Add at least one character.' : 'Add at least one country.'); return; }
    if (!session) return;
    setSaving(true); setError('');
    const supabase = getAuthedClient(session.access_token);
    if (isEdit) {
      const res = await doEdit(supabase, force);
      setSaving(false);
      if (res === 'needs_confirm') return;
      if (res !== 'ok') return;
    } else {
      const ok = await doCreate(supabase);
      setSaving(false);
      if (!ok) return;
    }
    onSaved();
    onClose();
  }

  return (
    <>
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-2xl rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-end mb-2">
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label style={labelStyle}>Committee Name *</label>
            {!isCrisis ? (
              <CommitteeNameInput
                value={name}
                onChange={setName}
                onPresetSelect={(p) => { setName(p.name); setAbbreviation(p.acronym); if (!isEdit) setCountries(p.members); }}
              />
            ) : (
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Cuban Missile Crisis, 1962" style={inputStyle} />
            )}
          </div>
          <div>
            <label style={labelStyle}>Difficulty</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={inputStyle}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Committee Emblem</label>
            <div className="flex items-center gap-4 rounded-xl p-3" style={{ border: '1px solid #EDE7D8', backgroundColor: 'rgba(237,231,216,0.35)' }}>
              {logoUploading ? (
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: 72, height: 72 }}>
                  <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
                </div>
              ) : logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Committee emblem"
                  style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 6px 12px rgba(27,56,40,0.24))' }}
                />
              ) : (
                <MonogramMedallion text={abbreviation || name} isCrisis={isCrisis} size={72} />
              )}
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { if (!logoUploading) document.getElementById('committee-emblem-upload')?.click(); }}
                    className="rounded-lg py-1.5 px-3.5 font-bold text-[11px] focus:outline-none"
                    style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em', cursor: 'pointer', transition: `background-color 250ms ${EASE}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                  >
                    {logoUploading ? 'UPLOADING...' : logoUrl ? 'REPLACE ART' : 'UPLOAD ART'}
                  </button>
                  {logoUrl && !logoUploading && (
                    <button
                      onClick={() => setLogoUrl(null)}
                      className="rounded-lg py-1.5 px-3.5 font-bold text-[11px] focus:outline-none"
                      style={{ border: '1.5px solid #DDD4C0', color: '#6E5F4E', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em', cursor: 'pointer', transition: `background-color 250ms ${EASE}` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      USE MONOGRAM
                    </button>
                  )}
                </div>
                <p className="text-[11px]" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.45 }}>
                  Square transparent PNG works best, max 5MB. Without art, the committee wears its monogram medallion.
                </p>
              </div>
              <input
                id="committee-emblem-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleEmblemUpload(f); e.target.value = ''; }}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Topics * (at least one, up to 3)</label>
            <div className="flex gap-2">
              <input value={topicInput} onChange={e => setTopicInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }} placeholder="Type a topic..." style={{ ...inputStyle, flex: 1 }} disabled={topics.length >= 3} />
              <button onClick={addTopic} disabled={topics.length >= 3} className="rounded-xl px-4 font-bold text-sm focus:outline-none" style={{ backgroundColor: topics.length >= 3 ? '#DDD4C0' : '#1B3828', color: topics.length >= 3 ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap' }}>Add topic</button>
            </div>
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {topics.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" style={{ backgroundColor: '#EDE7D8', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                    {t}
                    <button onClick={() => setTopics(topics.filter((_, j) => j !== i))} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid #EDE7D8' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              {isCrisis ? <Users size={15} style={{ color: '#B6871F' }} /> : <Globe size={15} style={{ color: '#B6871F' }} />}
              {isCrisis ? 'Committee Characters' : 'Committee Countries'}
            </p>
            <button
              onClick={() => setPasteOpen(true)}
              className="flex items-center gap-1.5 rounded-lg py-1.5 px-3 font-bold text-[11px] focus:outline-none"
              style={{ border: '1.5px solid #DDD4C0', color: '#1B3828', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em', cursor: 'pointer', transition: `background-color 250ms ${EASE}` }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <ClipboardList size={13} strokeWidth={2} />
              PASTE LIST
            </button>
          </div>
          {!isCrisis && (
            <div className="mb-3">
              <label style={{ ...labelStyle, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9A8A78' }}>Quick Rosters</label>
              <div className="flex flex-wrap gap-1.5">
                {ROSTER_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.key}
                    onClick={() => applyTemplate(tpl.label, tpl.members)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-all focus:outline-none"
                    style={{ backgroundColor: '#FAF8F3', color: '#1B3828', border: '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif" }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; el.style.borderColor = '#1B3828'; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#FAF8F3'; el.style.color = '#1B3828'; el.style.borderColor = '#DDD4C0'; }}
                  >
                    <span>{tpl.label}</span>
                    <span style={{ fontSize: 9, color: 'inherit', opacity: 0.6 }}>{tpl.members.length}</span>
                  </button>
                ))}
                <button
                  onClick={() => applyTemplate('Clear', [])}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-all focus:outline-none"
                  style={{ backgroundColor: 'transparent', color: '#9A8A78', border: '1px dashed #DDD4C0', fontFamily: "'Outfit', sans-serif" }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#8B2020'; el.style.borderColor = '#C46A6A'; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.borderColor = '#DDD4C0'; }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <CountryMatrixPicker value={countries} onChange={setCountries} noun={isCrisis ? 'character' : 'country'} />
        </div>
        {error && <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
          <button onClick={() => handleSave(false)} disabled={saving} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: saving ? '#DDD4C0' : '#1B3828', color: saving ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif" }}>{saving ? 'SAVING...' : (isEdit ? 'SAVE CHANGES' : 'ADD COMMITTEE')}</button>
        </div>
      </div>
    </ModalOverlay>
    {pasteOpen && (
      <PasteListModal
        isCrisis={isCrisis}
        existingCount={countries.length}
        onCancel={() => setPasteOpen(false)}
        onCommit={commitPaste}
      />
    )}
    {pendingTemplate && (
      <ModalOverlay onClose={() => setPendingTemplate(null)}>
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 380 }}>
          <p className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
            {pendingTemplate.members.length === 0
              ? `Clear all ${countries.length} selected countries?`
              : `Replace the ${countries.length} selected countries with the ${pendingTemplate.label} roster (${pendingTemplate.members.length} countries)?`}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPendingTemplate(null)} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
            <button
              onClick={() => { setCountries(dedupeNames(pendingTemplate.members)); setPendingTemplate(null); }}
              className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none"
              style={{ backgroundColor: pendingTemplate.members.length === 0 ? '#8B2020' : '#1B3828', color: pendingTemplate.members.length === 0 ? '#FFFFFF' : '#EED98A', fontFamily: "'Outfit', sans-serif" }}
            >
              {pendingTemplate.members.length === 0 ? 'CLEAR' : 'REPLACE'}
            </button>
          </div>
        </div>
      </ModalOverlay>
    )}
    {pendingRemovalCount !== null && (
      <ModalOverlay onClose={() => setPendingRemovalCount(null)}>
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 380 }}>
          <p className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
            {pendingRemovalCount} of the {isCrisis ? 'characters' : 'countries'} you removed {pendingRemovalCount === 1 ? 'has' : 'have'} an allocated delegate. Removing {pendingRemovalCount === 1 ? 'it' : 'them'} will return {pendingRemovalCount === 1 ? 'that delegate' : 'those delegates'} to the allocation pool. Proceed?
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPendingRemovalCount(null)} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
            <button onClick={() => { setPendingRemovalCount(null); handleSave(true); }} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: '#8B2020', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>PROCEED</button>
          </div>
        </div>
      </ModalOverlay>
    )}
    </>
  );
}

// ── CommitteeEditorModal — public API ─────────────────────────────────────────
// committee = null → create flow (opens with the GA/Crisis type picker);
// committee set    → edit flow (self-loads the committee's country slots).

export function CommitteeEditorModal({ conference, committee, onSaved, onClose }: {
  conference: { id: string };
  committee: EditableCommittee | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const isEdit = !!committee;
  const [pendingType, setPendingType] = useState<'general-assembly' | 'crisis' | null>(
    committee ? (committee.committee_type === 'crisis' ? 'crisis' : 'general-assembly') : null
  );
  // Edit flow: null until the committee's current slots are fetched.
  const [initialCountries, setInitialCountries] = useState<string[] | null>(committee ? null : []);

  useEffect(() => {
    if (!committee || !session) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('committee_country_slots')
        .select('country_name')
        .eq('conference_committee_id', committee.id);
      if (!cancelled) setInitialCountries((data ?? []).map((r: { country_name: string }) => r.country_name));
    })();
    return () => { cancelled = true; };
  }, [committee, session]);

  // Create flow — choose committee type first.
  if (!isEdit && !pendingType) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="rounded-2xl p-8 flex flex-col items-center gap-5" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 360 }}>
          <div className="w-full flex justify-end">
            <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
          </div>
          <p className="text-base font-bold text-center" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Choose committee type</p>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => setPendingType('general-assembly')}
              className="w-full rounded-xl py-4 font-black text-base focus:outline-none transition-colors"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              GENERAL ASSEMBLY
            </button>
            <button
              onClick={() => setPendingType('crisis')}
              className="w-full rounded-xl py-4 font-black text-base focus:outline-none transition-colors"
              style={{ border: '2px solid #1B3828', color: '#1B3828', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              CRISIS
            </button>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // Edit flow — brief spinner while the current slots load.
  if (isEdit && initialCountries === null) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="rounded-2xl p-10 flex items-center justify-center" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 200 }}>
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      </ModalOverlay>
    );
  }

  return (
    <CommitteeEditor
      conferenceId={conference.id}
      committeeType={pendingType ?? 'general-assembly'}
      existing={committee}
      initialCountries={initialCountries ?? []}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
