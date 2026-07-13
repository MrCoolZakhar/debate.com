'use client';

// Modernized roster + committee-name picker for the conference committee editor.
// Brings the conference editor to parity with the current standalone session
// flow (src/app/create/page.tsx):
//   • Committee-name presets in sync with /create (full 27-body list).
//   • Custom allocations — add arbitrary countries/entities by name, robust
//     multi-delimiter paste with a review/rename step, per-country importance
//     tiers (committee_country_slots.importance), reorder + remove.
//   • Crisis committees roster free-text CHARACTERS — no country search, no
//     country bundles, no flags, no country matching.
// Reuses shared logic (findCountryFlexible, UN_COUNTRIES) rather than copying.

import { useState, useRef } from 'react';
import { Globe, Users, PenLine, ArrowUp, ArrowDown, Megaphone } from 'lucide-react';
import { UN_COUNTRIES, getFlagUrl, getCountryByName, findCountryFlexible } from '@/lib/countries';
import { UNSC_MEMBERS, WHO_MEMBERS, IMF_MEMBERS, WORLD_BANK_MEMBERS, UNEP_MEMBERS } from '@/lib/presets';

// ── Importance tiers ──────────────────────────────────────────────────────────
// Mirrors the assignment page's model so tiers set here round-trip through the
// same committee_country_slots.importance column the allocator reads/cycles.
export type ImportanceTier = 'standard' | 'high' | 'medium' | 'low';
// Visible cycle order: standard → high → medium → low → standard, which also
// walks the dash count 1 → 2 → 3 → 4 → 1.
const TIER_CYCLE: ImportanceTier[] = ['standard', 'high', 'medium', 'low'];
// `label` is retained for the accessible title/aria text. `color` doubles as the
// dash colour; `dashes` is how many vertical bars render for the tier. `bg` is
// kept because it feeds nothing structural but documents the tier's tint.
const TIER_META: Record<ImportanceTier, { label: string; color: string; bg: string; dashes: number }> = {
  standard: { label: 'Standard', color: '#9A8A78', bg: 'rgba(154,138,120,0.12)', dashes: 1 },
  high:     { label: 'High',     color: '#3D7A52', bg: 'rgba(61,122,82,0.12)',   dashes: 2 },
  medium:   { label: 'Medium',   color: '#D4A72C', bg: 'rgba(212,167,44,0.14)',  dashes: 3 },
  low:      { label: 'Low',      color: '#8B2020', bg: 'rgba(139,32,32,0.10)',   dashes: 4 },
};

// A roster row: a country name (or free-text character/entity) plus its
// importance tier and observer flag. Characters always carry the neutral
// 'standard' tier. Observers apply to both countries and characters, mirroring
// the standalone session flow (src/app/create/page.tsx).
export interface RosterEntry {
  name: string;
  importance: ImportanceTier;
  isObserver?: boolean;
}

export const entry = (name: string, importance: ImportanceTier = 'standard', isObserver = false): RosterEntry => ({ name, importance, isObserver });

// ── Importance dashes ─────────────────────────────────────────────────────────
// A small clickable stack of vertical bars. Dash count + colour both encode the
// tier (1 grey / 2 green / 3 yellow / 4 red). Country mode only — characters
// keep the neutral 'standard' tier with no control.
function ImportanceDashes({ tier, onClick }: { tier: ImportanceTier; onClick: () => void }) {
  const meta = TIER_META[tier];
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Importance: ${meta.label}. Click to cycle: standard, high, medium, low.`}
      aria-label={`Importance: ${meta.label}`}
      className="flex items-end gap-[2px] focus:outline-none transition-opacity"
      style={{ padding: '3px 4px', borderRadius: 5, height: 20, opacity: 0.9 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
    >
      {Array.from({ length: meta.dashes }).map((_, i) => (
        <span key={i} style={{ width: 2, height: 11, borderRadius: 1, backgroundColor: meta.color, display: 'inline-block' }} />
      ))}
    </button>
  );
}

// ── Committee-name presets (kept in sync with src/app/create/page.tsx) ─────────
export interface CommitteePreset {
  name: string;
  acronym: string;
  logoPath: string;
  members: string[];
}

export const CONFERENCE_COMMITTEE_PRESETS: CommitteePreset[] = [
  { name: 'UN Security Council', acronym: 'UNSC', logoPath: '/logos/un.svg', members: UNSC_MEMBERS },
  { name: 'UN Environment Programme', acronym: 'UNEP', logoPath: '/logos/UNEP.png', members: UNEP_MEMBERS },
  { name: 'World Health Organization', acronym: 'WHO', logoPath: '/logos/who.png', members: WHO_MEMBERS },
  { name: 'International Monetary Fund', acronym: 'IMF', logoPath: '/logos/IMF.png', members: IMF_MEMBERS },
  { name: 'World Bank', acronym: 'WB', logoPath: '/logos/worldbank.svg', members: WORLD_BANK_MEMBERS },
  { name: 'UN General Assembly', acronym: 'GA/UNGA', logoPath: '/logos/un.svg', members: UN_COUNTRIES.filter((c) => !['Holy See', 'Kosovo', 'Niue', 'Palestine', 'Taiwan', 'Cook Islands', 'European Union', 'African Union'].includes(c.name)).map((c) => c.name) },
  { name: 'UN Human Rights Council', acronym: 'UNHRC', logoPath: '/logos/UNHRC.png', members: ['Afghanistan','Albania','Algeria','Argentina','Armenia','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Cameroon','Chile','China','Cuba','Czech Republic','Estonia','Finland','France','Gambia','Germany','Honduras','Iceland','India','Indonesia','Japan','Kazakhstan','Kenya','Libya','Luxembourg','Malawi','Malaysia','Maldives','Marshall Islands','Mexico','Montenegro','Morocco','Namibia','Nepal','Netherlands','Pakistan','Paraguay','Peru','Poland','Qatar','Romania','Senegal','Sierra Leone','Somalia','South Africa','Sudan','Togo','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Venezuela','Vietnam'] },
  { name: 'Economic and Social Council', acronym: 'ECOSOC', logoPath: '/logos/un.svg', members: ['Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Burundi','Canada','Chile','China','Colombia','Congo','Czech Republic','Denmark','Ecuador','Egypt','El Salvador','Estonia','Ethiopia','France','Germany','Ghana','Greece','Guatemala','Guinea','Haiti','Honduras','Hungary','India','Indonesia','Iran','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Lesotho','Libya','Malaysia','Maldives','Mali','Malta','Mexico','Mongolia','Morocco','Mozambique','Netherlands','New Zealand','Niger','Norway','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Serbia','South Africa','South Korea','Spain','Sweden','Switzerland','Tanzania','Thailand','Togo','Turkey','Uganda','Ukraine','United Kingdom','United States','Uzbekistan','Venezuela','Vietnam','Zimbabwe'] },
  { name: 'NATO', acronym: 'NATO', logoPath: '/logos/nato.png', members: ['Albania','Belgium','Bulgaria','Canada','Croatia','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Iceland','Italy','Latvia','Lithuania','Luxembourg','Montenegro','Netherlands','North Macedonia','Norway','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden','Turkey','United Kingdom','United States'] },
  { name: 'G20', acronym: 'G20', logoPath: '/logos/g20.svg', members: ['Argentina','Australia','Brazil','Canada','China','France','Germany','India','Indonesia','Italy','Japan','Mexico','South Korea','Russia','Saudi Arabia','South Africa','Turkey','United Kingdom','United States'] },
  { name: 'European Union', acronym: 'EU', logoPath: '/logos/eu.png', members: ['Austria','Belgium','Bulgaria','Croatia','Cyprus','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Ireland','Italy','Latvia','Lithuania','Luxembourg','Malta','Netherlands','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden'] },
  { name: 'African Union', acronym: 'AU', logoPath: '/logos/AU.png', members: ['Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Congo','Côte d\'Ivoire','DR Congo','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','São Tomé and Príncipe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe'] },
  { name: 'Arab League', acronym: 'LAS', logoPath: '/logos/arab-league.png', members: ['Algeria','Bahrain','Comoros','Djibouti','Egypt','Iraq','Jordan','Kuwait','Lebanon','Libya','Mauritania','Morocco','Oman','Palestine','Qatar','Saudi Arabia','Somalia','Sudan','Syria','Tunisia','United Arab Emirates','Yemen'] },
  { name: 'ASEAN', acronym: 'ASEAN', logoPath: '/logos/asean.png', members: ['Brunei','Cambodia','Indonesia','Laos','Malaysia','Myanmar','Philippines','Singapore','Thailand','Timor-Leste','Vietnam'] },
  { name: 'GA First Committee (Disarmament)',          acronym: 'DISEC',   logoPath: '/logos/un.svg',     members: [] },
  { name: 'GA Fourth Committee (Special Political)',   acronym: 'SPECPOL', logoPath: '/logos/un.svg',     members: [] },
  { name: 'GA Third Committee (Social, Humanitarian)', acronym: 'SOCHUM',  logoPath: '/logos/un.svg',     members: [] },
  { name: 'GA Sixth Committee (Legal)',                acronym: 'LEGAL',   logoPath: '/logos/un.svg',     members: [] },
  { name: 'UN Children\'s Fund',                       acronym: 'UNICEF',  logoPath: '/logos/unicef.png', members: [] },
  { name: 'UN Educational, Scientific & Cultural Org.', acronym: 'UNESCO', logoPath: '/logos/unesco.png', members: [] },
  { name: 'UN Refugee Agency',                         acronym: 'UNHCR',   logoPath: '/logos/un.svg',     members: [] },
  { name: 'World Food Programme',                      acronym: 'WFP',     logoPath: '/logos/un.svg',     members: [] },
  { name: 'Food and Agriculture Organization',         acronym: 'FAO',     logoPath: '/logos/fao.png',    members: [] },
  { name: 'International Labour Organization',          acronym: 'ILO',     logoPath: '/logos/un.svg',     members: [] },
  { name: 'International Atomic Energy Agency',         acronym: 'IAEA',    logoPath: '/logos/iaea.png',   members: [] },
  { name: 'UN Development Programme',                   acronym: 'UNDP',    logoPath: '/logos/un.svg',     members: [] },
  { name: 'UN Entity for Gender Equality (UN Women)',   acronym: 'UNW',     logoPath: '/logos/un.svg',     members: [] },
  { name: 'UN Office on Drugs and Crime',              acronym: 'UNODC',   logoPath: '/logos/un.svg',     members: [] },
];

// ── Country bundles (kept in sync with /create) ───────────────────────────────
const BUNDLES: Record<string, { label: string; logoPath?: string; members: string[] }> = {
  P5:         { label: 'P5',          logoPath: '/logos/un.svg',           members: ['China', 'France', 'Russia', 'United Kingdom', 'United States'] },
  G7:         { label: 'G7',          logoPath: '/logos/g7.png',           members: ['Canada', 'France', 'Germany', 'Italy', 'Japan', 'United Kingdom', 'United States'] },
  BRICS:      { label: 'BRICS+',      logoPath: '/logos/brics.png',        members: ['Brazil', 'Russia', 'India', 'China', 'South Africa', 'Egypt', 'Ethiopia', 'Iran', 'Saudi Arabia', 'United Arab Emirates'] },
  G20:        { label: 'G20',         logoPath: '/logos/g20.svg',          members: ['Argentina', 'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany', 'India', 'Indonesia', 'Italy', 'Japan', 'Mexico', 'South Korea', 'Russia', 'Saudi Arabia', 'South Africa', 'Turkey', 'United Kingdom', 'United States'] },
  EU:         { label: 'EU',          logoPath: '/logos/eu.png',           members: ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'] },
  NATO:       { label: 'NATO',        logoPath: '/logos/nato.png',         members: ['Albania', 'Belgium', 'Bulgaria', 'Canada', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Turkey', 'United Kingdom', 'United States'] },
  ASEAN:      { label: 'ASEAN',       logoPath: '/logos/asean.png',        members: ['Brunei', 'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar', 'Philippines', 'Singapore', 'Thailand', 'Timor-Leste', 'Vietnam'] },
  ArabLeague: { label: 'Arab League', logoPath: '/logos/arab-league.png',  members: ['Algeria', 'Bahrain', 'Comoros', 'Djibouti', 'Egypt', 'Iraq', 'Jordan', 'Kuwait', 'Lebanon', 'Libya', 'Mauritania', 'Morocco', 'Oman', 'Palestine', 'Qatar', 'Saudi Arabia', 'Somalia', 'Sudan', 'Syria', 'Tunisia', 'United Arab Emirates', 'Yemen'] },
};

// Common shorthands the paste matcher understands before falling through to
// the shared accent/locale-aware findCountryFlexible.
const COUNTRY_ACRONYMS: Record<string, string> = {
  uk: 'United Kingdom', us: 'United States', usa: 'United States',
  uae: 'United Arab Emirates', drc: 'DR Congo', roc: 'Taiwan',
  rok: 'South Korea', dprk: 'North Korea', car: 'Central African Republic',
  png: 'Papua New Guinea',
};

function fuzzyMatchCountry(raw: string): string | null {
  const n = raw.trim().toLowerCase();
  if (!n) return null;
  if (COUNTRY_ACRONYMS[n]) return COUNTRY_ACRONYMS[n];
  return findCountryFlexible(raw);
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#9A8A78',
  fontFamily: "'Outfit', sans-serif", textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #DDD4C0', borderRadius: 8, padding: '8px 12px',
  fontSize: 14, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none',
  fontFamily: "'Outfit', sans-serif",
};

// ── Committee-name input with preset dropdown ─────────────────────────────────
export function ConferenceCommitteeNameInput({ value, onChange, onPresetSelect }: {
  value: string;
  onChange: (v: string) => void;
  onPresetSelect: (preset: CommitteePreset) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = value.trim()
    ? CONFERENCE_COMMITTEE_PRESETS.filter((p) => {
        const v = value.toLowerCase();
        return p.name.toLowerCase().includes(v) || p.acronym.toLowerCase().includes(v);
      })
    : [];
  const topMatch = matches[0] ?? null;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && topMatch) { e.preventDefault(); onPresetSelect(topMatch); setOpen(false); }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="e.g. Human Rights Council or UNHRC"
        style={inputStyle}
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 8px 32px rgba(27,56,40,0.14), 0 2px 8px rgba(27,56,40,0.08)', maxHeight: 280, overflowY: 'auto' }}>
          {matches.slice(0, 8).map((p, i) => (
            <button
              key={p.name}
              onMouseDown={(e) => { e.preventDefault(); onPresetSelect(p); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#DDD4C0]/50 last:border-0 ${i === 0 ? 'text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#EDE7D8]'}`}
              style={i === 0 ? { backgroundColor: 'rgba(27,56,40,0.07)' } : {}}
            >
              {p.logoPath ? (
                <img src={p.logoPath} alt={p.acronym} width={18} height={18} className="rounded-sm shrink-0 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-[22px] h-[22px] rounded-md shrink-0" style={{ backgroundColor: 'rgba(27,56,40,0.08)' }} />
              )}
              <span className="text-sm flex-1">{p.name}</span>
              {p.members.length > 0 && (
                <span className="text-[10px] shrink-0" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>+{p.members.length}</span>
              )}
              <span className="text-[10px] font-bold shrink-0" style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', color: '#1B3828' }}>{p.acronym}</span>
              {i === 0 && <span className="text-[10px] shrink-0" style={{ color: '#9A8A78' }}>↵</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Roster picker (countries or characters) ───────────────────────────────────

interface ReviewRow { name: string; isCountry: boolean }

export function ConferenceRosterPicker({ mode, value, onChange }: {
  mode: 'country' | 'character';
  value: RosterEntry[];
  onChange: (roster: RosterEntry[]) => void;
}) {
  const isCharacter = mode === 'character';
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const names = value.map((r) => r.name);
  const nameSet = new Set(names.map((n) => n.toLowerCase()));

  const available = isCharacter
    ? []
    : UN_COUNTRIES.filter((c) => !nameSet.has(c.name.toLowerCase()) && c.name.toLowerCase().includes(search.toLowerCase()));

  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || nameSet.has(trimmed.toLowerCase())) return;
    onChange([...value, entry(trimmed)]);
  };

  const addBundle = (key: string) => {
    const bundle = BUNDLES[key];
    if (!bundle) return;
    const additions = bundle.members.filter((m) => !nameSet.has(m.toLowerCase())).map((m) => entry(m));
    onChange([...value, ...additions]);
  };

  const removeIdx = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const moveIdx = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const cycleTier = (idx: number) => {
    const cur = value[idx].importance;
    const nextTier = TIER_CYCLE[(TIER_CYCLE.indexOf(cur) + 1) % TIER_CYCLE.length];
    onChange(value.map((r, i) => (i === idx ? { ...r, importance: nextTier } : r)));
  };

  const toggleObserver = (idx: number) => {
    onChange(value.map((r, i) => (i === idx ? { ...r, isObserver: !r.isObserver } : r)));
  };

  const commitRename = (idx: number, raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) { removeIdx(idx); setEditingIdx(null); return; }
    // Reject a rename that collides with another existing row.
    if (value.some((r, i) => i !== idx && r.name.toLowerCase() === trimmed.toLowerCase())) { setEditingIdx(null); return; }
    onChange(value.map((r, i) => (i === idx ? { ...r, name: trimmed } : r)));
    setEditingIdx(null);
  };

  const sortAZ = () => onChange([...value].sort((a, b) => a.name.localeCompare(b.name)));

  // Paste. Countries → fuzzy-match + review/rename step. Characters → add all
  // pasted lines verbatim (no country matching), deduped case-insensitively.
  const handlePaste = () => {
    // Character mode uses a gentler split (no period / double-space rules) so
    // names with middle initials like "John F. Kennedy" survive intact.
    const splitter = isCharacter ? /\r?\n|[,;\t·•]/ : /\r?\n|[,;\t]|\s{2,}|[·•]|\.(?=\s|$)/;
    const tokens = pasteText
      .split(splitter)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen = new Set(nameSet);
    if (isCharacter) {
      const additions: RosterEntry[] = [];
      for (const tok of tokens) {
        const k = tok.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        additions.push(entry(tok));
      }
      if (additions.length === 0) { setPasteError('Nothing new to add'); return; }
      onChange([...value, ...additions]);
      setPasteError('');
      setPasteText('');
      return;
    }
    const rows: ReviewRow[] = [];
    for (const tok of tokens) {
      const found = fuzzyMatchCountry(tok);
      const name = found ?? tok;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({ name, isCountry: !!found });
    }
    if (rows.length === 0) { setPasteError('Nothing new to add'); return; }
    setPasteError('');
    setReview(rows);
  };

  const commitReview = () => {
    if (!review) return;
    const seen = new Set(nameSet);
    const additions: RosterEntry[] = [];
    for (const r of review) {
      const nm = r.name.trim();
      if (!nm) continue;
      const k = nm.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      additions.push(entry(nm));
    }
    onChange([...value, ...additions]);
    setReview(null);
    setPasteText('');
  };

  return (
    <div className="flex gap-4" style={{ minHeight: 300 }}>
      {/* Left: add controls */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        {/* Search & Add */}
        <div>
          <label style={labelStyle}>{isCharacter ? 'Add Character' : 'Search & Add'}</label>
          <div className="relative">
            <div className="flex items-center rounded-xl" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!isCharacter && available[0]) { add(available[0].name); setSearch(''); }
                    else if (search.trim()) { add(search.trim()); setSearch(''); }
                  }
                  if (e.key === 'Escape') setSearch('');
                }}
                placeholder={isCharacter ? 'Type a character or role name, press Enter…' : 'Search countries or type a name…'}
                className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
                style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              />
              {search.trim() && (isCharacter || available[0]) && (
                <span className="text-xs px-2 shrink-0" style={{ color: '#9A8A78' }}>↵ {isCharacter ? search.trim() : available[0]?.name ?? search.trim()}</span>
              )}
            </div>
            {search.trim() && (available.length > 0 || (search.trim() && !nameSet.has(search.trim().toLowerCase()))) && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 8px 24px rgba(27,56,40,0.12)' }}>
                {available.slice(0, 5).map((c, i) => (
                  <button
                    key={c.code}
                    onMouseDown={(e) => { e.preventDefault(); add(c.name); setSearch(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                    style={{ backgroundColor: i === 0 ? 'rgba(27,56,40,0.07)' : 'transparent', borderBottom: '1px solid #F0EDE6' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i === 0 ? 'rgba(27,56,40,0.07)' : 'transparent'; }}
                  >
                    <img src={getFlagUrl(c.code)} alt={c.code} style={{ width: 20, height: 14, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <span className="text-sm flex-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{c.name}</span>
                    {i === 0 && <span className="text-xs" style={{ color: '#9A8A78' }}>↵</span>}
                  </button>
                ))}
                {search.trim() && !nameSet.has(search.trim().toLowerCase()) && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); add(search.trim()); setSearch(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                    style={{ borderTop: available.length > 0 ? '1px solid #EDE7D8' : undefined, backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1B3828', flexShrink: 0, width: 20, textAlign: 'center' }}>+</span>
                    <span className="text-sm flex-1" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{`Add "${search.trim()}"`}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Bundles — country mode only */}
        {!isCharacter && (
          <div>
            <label style={labelStyle}>Quick Bundles</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(BUNDLES).map(([key, bundle]) => (
                <button
                  key={key}
                  onClick={() => addBundle(key)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                  style={{ backgroundColor: '#FAF8F3', color: '#1B3828', border: '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif" }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; el.style.borderColor = '#1B3828'; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#FAF8F3'; el.style.color = '#1B3828'; el.style.borderColor = '#DDD4C0'; }}
                >
                  {bundle.logoPath && (
                    <img src={bundle.logoPath} alt={bundle.label} width={12} height={12} className="rounded-sm shrink-0 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <span>{bundle.label}</span>
                  <span style={{ fontSize: 9, color: 'inherit', opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>+{bundle.members.length}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Paste list */}
        <div className="flex flex-col flex-1">
          <label style={labelStyle}>{isCharacter ? 'Paste Character List' : 'Paste Country List'}</label>
          <textarea
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
            placeholder={isCharacter ? 'Fidel Castro\nNikita Khrushchev\nJohn F. Kennedy…' : 'France\nGermany\nBrazil, India…'}
            className="flex-1 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none"
            style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif", minHeight: 72 }}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handlePaste}
              disabled={!pasteText.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}
              onMouseEnter={(e) => { if (pasteText.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {isCharacter ? 'Add All' : 'Auto-Match'}
            </button>
            {pasteError && <p className="text-xs" style={{ color: '#B6871F', fontFamily: "'Outfit', sans-serif" }}>{pasteError}</p>}
          </div>
        </div>
      </div>

      {/* Right: selected list */}
      <div className="flex flex-col" style={{ width: 232, flexShrink: 0 }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <label style={{ ...labelStyle, marginBottom: 0 }}>Selected</label>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#1B3828', backgroundColor: 'rgba(238,217,138,0.3)', padding: '1px 6px', borderRadius: 999, fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
              {value.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isCharacter && value.length > 1 && (
              <button
                onClick={sortAZ}
                className="text-xs font-bold uppercase tracking-wide transition-colors focus:outline-none"
                style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 9 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
              >
                A–Z
              </button>
            )}
            {value.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="text-xs font-bold uppercase tracking-wide transition-colors focus:outline-none"
                style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 9 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
              >
                CLEAR ALL
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', maxHeight: 260, overflowY: 'auto' }}>
          {value.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-3 py-8">
              <p className="text-xs font-bold uppercase text-center" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{isCharacter ? 'NO CHARACTERS' : 'NO COUNTRIES'}</p>
              <p className="text-xs text-center mt-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{isCharacter ? 'Type or paste names to add' : 'Search, use bundles, or paste'}</p>
            </div>
          ) : (
            value.map((row, idx) => {
              const found = isCharacter ? undefined : getCountryByName(row.name);
              const isCustom = !found;
              const isEditing = editingIdx === idx;
              const isObserver = !!row.isObserver;
              return (
                <div
                  key={`${row.name}-${idx}`}
                  className="flex items-center gap-2 px-3 py-2 group transition-colors"
                  style={{ borderBottom: '1px solid #F0EDE6' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                >
                  {found
                    ? <img src={getFlagUrl(found.code)} alt={found.code} style={{ width: 18, height: 13, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : (isCharacter
                        ? <Users size={13} strokeWidth={1.5} style={{ color: '#B6871F', flexShrink: 0 }} />
                        : <Globe size={13} strokeWidth={1.5} style={{ color: '#9A8A78', flexShrink: 0 }} />)
                  }
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(idx, editDraft); else if (e.key === 'Escape') setEditingIdx(null); }}
                      onBlur={() => commitRename(idx, editDraft)}
                      className="flex-1 text-xs bg-transparent outline-none"
                      style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", borderBottom: '1px solid #1B3828' }}
                    />
                  ) : (
                    <span className="flex-1 text-xs truncate flex items-center gap-1.5 min-w-0" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      <span className="truncate">{row.name}</span>
                      {isObserver && (
                        <span className="shrink-0 font-bold uppercase tracking-wide px-1 py-0.5 rounded" style={{ fontSize: 8, backgroundColor: 'rgba(182,135,31,0.15)', color: '#B6871F', border: '1px solid rgba(182,135,31,0.35)', letterSpacing: '0.06em' }}>OBSERVER</span>
                      )}
                    </span>
                  )}
                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Importance — country mode only. Vertical dashes: count + colour encode the tier. */}
                      {!isCharacter && (
                        <ImportanceDashes tier={row.importance} onClick={() => cycleTier(idx)} />
                      )}
                      {/* Observer toggle — countries AND characters, mirrors /create's megaphone */}
                      <button
                        onClick={() => toggleObserver(idx)}
                        title={isObserver ? 'Observer — click to make a voting delegate' : 'Mark as observer'}
                        aria-pressed={isObserver}
                        className="focus:outline-none transition-transform active:scale-90 shrink-0"
                        style={{ color: isObserver ? '#B6871F' : '#9A8A78', opacity: isObserver ? 1 : undefined }}
                      >
                        <Megaphone size={12} strokeWidth={1.75} className={isObserver ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'} />
                      </button>
                      {/* Reorder */}
                      <button onClick={() => moveIdx(idx, -1)} disabled={idx === 0} className="opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none disabled:opacity-0" style={{ color: '#9A8A78' }} title="Move up"><ArrowUp size={12} /></button>
                      <button onClick={() => moveIdx(idx, 1)} disabled={idx === value.length - 1} className="opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none disabled:opacity-0" style={{ color: '#9A8A78' }} title="Move down"><ArrowDown size={12} /></button>
                      {/* Rename — custom entries & all characters */}
                      {(isCustom || isCharacter) && (
                        <button onClick={() => { setEditingIdx(idx); setEditDraft(row.name); }} className="opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none" style={{ color: '#9A8A78' }} title="Rename"><PenLine size={12} /></button>
                      )}
                      <button
                        onClick={() => removeIdx(idx)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs focus:outline-none"
                        style={{ color: '#9A8A78' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Paste review overlay (country mode) — sits above the editor modal */}
      {review && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(5,4,3,0.5)', backdropFilter: 'blur(4px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setReview(null); }}
        >
          <div className="w-full max-w-md flex flex-col rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '78%' }}>
            <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #DDD4C0' }}>
              <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: '#1B3828', letterSpacing: '0.04em', fontFamily: "'Outfit', sans-serif" }}>Review pasted list</h2>
              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{review.length} to add. Edit any custom names before confirming.</p>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {review.map((r, idx) => {
                const found = getCountryByName(r.name);
                return (
                  <div key={idx} className="flex items-center gap-3 px-5 py-2.5 border-b border-[#DDD4C0]/50 last:border-0">
                    {found
                      ? <img src={getFlagUrl(found.code)} alt={found.code} width={20} height={14} style={{ objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                      : <Globe size={16} strokeWidth={1.5} style={{ color: '#9A8A78', flexShrink: 0 }} />}
                    {found ? (
                      <span className="text-sm flex-1 truncate font-medium" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{r.name}</span>
                    ) : (
                      <input
                        value={r.name}
                        onChange={(e) => setReview((prev) => prev ? prev.map((x, i) => i === idx ? { name: e.target.value, isCountry: !!getCountryByName(e.target.value.trim()) } : x) : prev)}
                        className="text-sm flex-1 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none"
                        style={{ border: '1px solid #C8BAA8', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                      />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 px-2 py-0.5 rounded-full" style={found ? { color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.1)' } : { color: '#B6871F', backgroundColor: 'rgba(182,135,31,0.12)' }}>
                      {found ? 'Country' : 'Custom'}
                    </span>
                    <button onClick={() => setReview((prev) => prev ? prev.filter((_, i) => i !== idx) : prev)} className="text-sm shrink-0 focus:outline-none" style={{ color: '#9A8A78' }}>✕</button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 shrink-0" style={{ borderTop: '1px solid #DDD4C0' }}>
              <button onClick={() => setReview(null)} className="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wide transition-colors focus:outline-none" style={{ color: '#6A5A4A', backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif" }}>Cancel</button>
              <button onClick={commitReview} disabled={review.length === 0} className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-30 focus:outline-none" style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}>
                Add {review.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
