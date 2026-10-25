'use client';

import { Committee } from '@/lib/types';
import { getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { useLanguage } from '@/contexts/LanguageContext';
import SeatName from '@/components/SeatName';

// A round flag tile (CLAUDE.md §8 rule 10: a circle is always SeatCircleFlag, crest then
// flag then the seat's initials; never a rectangular flag in a rounded box).
function FlagTile({ seat, active, spoken }: { seat: Committee['delegates'][number]; active: boolean; spoken: boolean }) {
  const { language } = useLanguage();
  const country = seat.country;
  return (
    <div className="relative flex flex-col items-center gap-1" style={{ width: 64 }}>
      <div className="relative rounded-full flex items-center justify-center"
        style={{
          width: 44, height: 44,
          boxShadow: active ? '0 0 0 3px #EED98A, 0 0 12px 2px rgba(184,132,74,0.5)' : '0 0 0 1px rgba(28,20,16,0.12)',
        }}>
        <SeatCircleFlag seat={seat} size={44} decorative fallback="initials" />
        {spoken && !active && (
          <span style={{ position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#3D7A52', boxShadow: '0 0 0 1.5px #FAF8F3' }} />
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
          const tile = <FlagTile seat={d} active={d.country === current} spoken={spoken.has(d.country)} />;
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
