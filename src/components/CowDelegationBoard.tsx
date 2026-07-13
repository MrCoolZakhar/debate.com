'use client';

import { Committee } from '@/lib/types';
import { getCountryByName, getCountryDisplayName, getFlagUrl, compareCountryNames } from '@/lib/countries';
import { useLanguage } from '@/contexts/LanguageContext';

// A flag tile with a VISIBLE globe fallback (not display:none).
function FlagTile({ country, active, spoken }: { country: string; active: boolean; spoken: boolean }) {
  const code = getCountryByName(country)?.code ?? '';
  return (
    <div className="relative flex flex-col items-center gap-1" style={{ width: 64 }}>
      <div className="relative rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          width: 52, height: 38,
          boxShadow: active ? '0 0 0 3px #EED98A, 0 0 12px 2px rgba(184,132,74,0.5)' : '0 0 0 1px rgba(28,20,16,0.12)',
          backgroundColor: '#DDD4C0',
        }}>
        {code ? (
          <img src={getFlagUrl(code)} alt={country}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = 'none';
              const sib = img.nextElementSibling as HTMLElement | null;
              if (sib) sib.style.display = 'flex';
            }} />
        ) : null}
        <span style={{ display: code ? 'none' : 'flex', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🌐</span>
        {spoken && !active && (
          <span style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', backgroundColor: '#3D7A52', boxShadow: '0 0 0 1.5px #FAF8F3' }} />
        )}
      </div>
      <span className="text-[9px] leading-tight text-center truncate w-full" style={{ color: active ? '#1B3828' : '#6A5A4A', fontWeight: active ? 800 : 500 }}>
        {country}
      </span>
    </div>
  );
}

// Live delegation board for a Consultation of the Whole (open floor, no queue).
// Read-only everywhere; chairs pass onTap to set the current speaker.
export default function CowDelegationBoard({ committee, onTap }: {
  committee: Committee; onTap?: (country: string) => void;
}) {
  const { language } = useLanguage();
  const caucus = committee.caucus;
  if (!caucus) return null;
  const current = caucus.currentSpeaker;
  const spoken = new Set(caucus.spokenCountries ?? []);
  const delegates = [...committee.delegates]
    .filter((d) => d.status !== 'absent')
    .sort((a, b) => compareCountryNames(a.country, b.country, language));

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0' }}>
      {current && (
        <p className="text-xs text-center mb-2 font-mono" style={{ color: '#6A5A4A' }}>
          <span style={{ color: '#9A8A78' }}>Speaking: </span>
          <span style={{ color: '#1B3828', fontWeight: 700 }}>{getCountryDisplayName(current, language)}</span>
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2 max-h-[280px] overflow-y-auto">
        {delegates.map((d) => {
          const tile = <FlagTile country={d.country} active={d.country === current} spoken={spoken.has(d.country)} />;
          return onTap ? (
            <button key={d.id} onClick={() => onTap(d.country)} className="transition-transform active:scale-90 focus:outline-none">
              {tile}
            </button>
          ) : (
            <div key={d.id}>{tile}</div>
          );
        })}
      </div>
    </div>
  );
}
