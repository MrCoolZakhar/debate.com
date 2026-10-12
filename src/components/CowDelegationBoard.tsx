'use client';

import { Committee } from '@/lib/types';
import { getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { SeatFlag, useSeatArt } from '@/components/SeatFlag';
import { useLanguage } from '@/contexts/LanguageContext';
import { UnknownSeatIcon } from '@/components/UnknownSeatIcon';
import SeatName from '@/components/SeatName';

// A flag tile with a VISIBLE globe fallback (not display:none).
function FlagTile({ country, active, spoken }: { country: string; active: boolean; spoken: boolean }) {
  const { language } = useLanguage();
  // Seat crest first, national flag second — same tile, same ring, same globe
  // fallback. `hasArt` replaces the old `code` truthiness check.
  const art = useSeatArt(country);
  const hasArt = art.kind !== 'none';
  return (
    <div className="relative flex flex-col items-center gap-1" style={{ width: 64 }}>
      <div className="relative rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          width: 52, height: 38,
          boxShadow: active ? '0 0 0 3px #EED98A, 0 0 12px 2px rgba(184,132,74,0.5)' : '0 0 0 1px rgba(28,20,16,0.12)',
          backgroundColor: '#DDD4C0',
        }}>
        {hasArt ? (
          <SeatFlag country={country} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
        <span style={{ display: hasArt ? 'none' : 'flex', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><UnknownSeatIcon size={30} bare /></span>
        {spoken && !active && (
          <span style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', backgroundColor: '#3D7A52', boxShadow: '0 0 0 1.5px #FAF8F3' }} />
        )}
      </div>
      {/* A long seat (a crisis character) is two rows: the short form, the full name smaller
          beneath, wrapping; never cut (CLAUDE.md §8, src/components/SeatName.tsx). */}
      <SeatName
        name={getCountryDisplayName(country, language)}
        max={10}
        block
        align="center"
        subScale={0.86}
        className="text-[10px] leading-tight text-center w-full"
        style={{ color: active ? '#1B3828' : '#6A5A4A', fontWeight: active ? 800 : 600 }}
      />
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
          <SeatName name={getCountryDisplayName(current, language)} max={30} align="center" style={{ color: '#1B3828', fontWeight: 700, verticalAlign: 'top' }} />
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
