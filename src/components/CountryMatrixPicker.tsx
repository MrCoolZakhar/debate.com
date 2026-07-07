'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { UN_COUNTRIES, getFlagUrl, getCountryByName } from '@/lib/countries';

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

const COUNTRY_ACRONYMS: Record<string, string> = {
  'uk': 'United Kingdom', 'us': 'United States', 'usa': 'United States',
  'uae': 'United Arab Emirates', 'drc': 'DR Congo', 'roc': 'Taiwan',
  'rok': 'South Korea', 'dprk': 'North Korea', 'car': 'Central African Republic',
  'png': 'Papua New Guinea',
};

function fuzzyMatchCountry(raw: string): string | null {
  const n = raw.trim().toLowerCase();
  if (!n) return null;
  if (COUNTRY_ACRONYMS[n]) return COUNTRY_ACRONYMS[n];
  const exact = UN_COUNTRIES.find((c) => c.name.toLowerCase() === n);
  if (exact) return exact.name;
  const sw = UN_COUNTRIES.find((c) => c.name.toLowerCase().startsWith(n));
  if (sw) return sw.name;
  const inc = UN_COUNTRIES.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()));
  if (inc) return inc.name;
  return null;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#9A8A78',
  fontFamily: "'Outfit', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  marginBottom: 4,
};

export function CountryMatrixPicker({ value, onChange, noun = 'country' }: { value: string[]; onChange: (countryNames: string[]) => void; noun?: 'country' | 'character' }) {
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');

  const available = UN_COUNTRIES.filter(
    (c) => !value.includes(c.name) && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const addDelegate = (name: string) => {
    if (!value.includes(name)) onChange([...value, name]);
  };

  const addBundle = (key: string) => {
    const bundle = BUNDLES[key];
    if (!bundle) return;
    onChange([...value, ...bundle.members.filter((m) => !value.includes(m))]);
  };

  const handlePaste = () => {
    const lines = pasteText.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
    const matched: string[] = [];
    const unmatched: string[] = [];
    for (const line of lines) {
      const found = fuzzyMatchCountry(line);
      if (found && !value.includes(found) && !matched.includes(found)) matched.push(found);
      else if (!found) unmatched.push(line);
    }
    onChange([...value, ...matched]);
    setPasteError(unmatched.length > 0 ? `Could not match: ${unmatched.join(', ')}` : '');
    setPasteText('');
  };

  return (
    <div className="flex gap-4" style={{ minHeight: 300 }}>
      {/* Left: add controls */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        {/* Search & Add */}
        <div>
          <label style={labelStyle}>Search &amp; Add</label>
          <div className="relative">
            <div className="flex items-center rounded-xl" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (available[0]) { addDelegate(available[0].name); setSearch(''); }
                    else if (search.trim() && !value.includes(search.trim())) { addDelegate(search.trim()); setSearch(''); }
                  }
                  if (e.key === 'Escape') setSearch('');
                }}
                placeholder={noun === 'character' ? 'Search characters or type a name...' : 'Search countries...'}
                className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
                style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              />
              {search && available[0] && (
                <span className="text-xs px-2 shrink-0" style={{ color: '#9A8A78' }}>↵ {available[0].name}</span>
              )}
            </div>
            {search && (available.length > 0 || (search.trim() && !value.includes(search.trim()))) && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 8px 24px rgba(27,56,40,0.12)' }}>
                {available.slice(0, 5).map((c, i) => (
                  <button
                    key={c.code}
                    onMouseDown={(e) => { e.preventDefault(); addDelegate(c.name); setSearch(''); }}
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
                {search.trim() && !value.includes(search.trim()) && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); addDelegate(search.trim()); setSearch(''); }}
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

        {/* Quick Bundles */}
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
                <span style={{ fontSize: 9, color: 'inherit', opacity: 0.6 }}>+{bundle.members.length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Paste Country List */}
        <div className="flex flex-col flex-1">
          <label style={labelStyle}>Paste Country List</label>
          <textarea
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
            placeholder={'France\nGermany\nBrazil, India...'}
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
              Auto-Match
            </button>
            {pasteError && <p className="text-xs" style={{ color: '#B6871F', fontFamily: "'Outfit', sans-serif" }}>{pasteError}</p>}
          </div>
        </div>
      </div>

      {/* Right: selected delegates */}
      <div className="flex flex-col" style={{ width: 196, flexShrink: 0 }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <label style={{ ...labelStyle, marginBottom: 0 }}>Selected</label>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#1B3828', backgroundColor: 'rgba(238,217,138,0.3)', padding: '1px 6px', borderRadius: 999, fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
              {value.length}
            </span>
          </div>
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
        <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', maxHeight: 260, overflowY: 'auto' }}>
          {value.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-3 py-8">
              <p className="text-xs font-bold uppercase text-center" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{noun === 'character' ? 'NO CHARACTERS' : 'NO DELEGATES'}</p>
              <p className="text-xs text-center mt-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{noun === 'character' ? 'Search or type a name to add' : 'Search or use bundles to add'}</p>
            </div>
          ) : (
            value.map((name) => {
              const found = getCountryByName(name);
              return (
                <div
                  key={name}
                  className="flex items-center gap-2 px-3 py-2 group transition-colors"
                  style={{ borderBottom: '1px solid #F0EDE6' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                >
                  {found
                    ? <img src={getFlagUrl(found.code)} alt={found.code} style={{ width: 18, height: 13, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <Globe size={13} strokeWidth={1.5} style={{ color: '#9A8A78', flexShrink: 0 }} />
                  }
                  <span className="flex-1 text-xs truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{name}</span>
                  <button
                    onClick={() => onChange(value.filter((d) => d !== name))}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs focus:outline-none"
                    style={{ color: '#9A8A78' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
