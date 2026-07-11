'use client';

// Allocation card — the centerpiece of the delegate participant view. Mirrors
// the public committee card language (monogram/logo, name, difficulty pill,
// roman-numeral topics) from ConferenceDetailClient's committee carousel,
// plus a large flag + country ribbon for the delegate's own allocation.

import { Compass } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { SectionCard, OUTFIT, capitalize } from './shared';
import type { ParticipantCommittee } from './types';

const DIFFICULTY_STYLES: Record<string, { bg: string; color: string }> = {
  beginner: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  intermediate: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  advanced: { bg: 'rgba(184,132,74,0.16)', color: '#B8844A' },
  expert: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
};

const ROMAN = ['I', 'II', 'III'];

export default function AllocationCard({ committee, countryCode, countryName }: {
  committee: ParticipantCommittee | null;
  countryCode: string | null;
  countryName: string | null;
}) {
  if (!committee || !countryName) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center text-center py-10">
          <div
            className="flex items-center justify-center mb-5"
            style={{ width: '64px', height: '64px', borderRadius: '9999px', backgroundColor: 'rgba(27,56,40,0.07)', border: '1px solid rgba(27,56,40,0.14)' }}
          >
            <Compass size={26} strokeWidth={1.8} style={{ color: '#1B3828' }} />
          </div>
          <p className="text-[15px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            Your committee allocation will appear here.
          </p>
        </div>
      </SectionCard>
    );
  }

  const diff = committee.difficulty?.toLowerCase() ?? '';
  const diffStyle = DIFFICULTY_STYLES[diff] ?? DIFFICULTY_STYLES.intermediate;
  const isCrisis = committee.committee_type === 'crisis';
  const topics = committee.topics ?? [];

  return (
    <SectionCard>
      <div className="flex flex-col items-center px-2 text-center">
        {committee.logo_url ? (
          <img
            src={committee.logo_url}
            alt={committee.abbreviation ?? committee.name}
            style={{ width: '104px', height: '104px', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 10px 18px rgba(27,56,40,0.28))' }}
          />
        ) : (
          <MonogramMedallion text={committee.abbreviation || committee.name} isCrisis={isCrisis} size={96} />
        )}

        <h3 className="font-bold text-[17px] leading-snug mt-4" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          {committee.name}
        </h3>

        <div className="flex items-center gap-2 mt-1.5">
          {committee.difficulty && (
            <span
              className="px-2.5 py-0.5 rounded-full"
              style={{ ...diffStyle, fontSize: '10px', fontFamily: OUTFIT, letterSpacing: '0.06em', fontWeight: 700 }}
            >
              {capitalize(diff)}
            </span>
          )}
          {isCrisis && (
            <>
              <span aria-hidden style={{ color: 'rgba(182,135,31,0.55)', fontSize: '7px' }}>◆</span>
              <span className="text-[10px] font-bold" style={{ color: '#8B2020', fontFamily: OUTFIT, letterSpacing: '0.12em' }}>
                CRISIS
              </span>
            </>
          )}
        </div>

        {topics.length > 0 && (
          <div className="w-full mt-5 pt-4 text-left" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
            {topics.map((topic, ti) => (
              <div key={topic} className="flex items-start gap-2.5 py-1">
                <span
                  className="flex-shrink-0 text-right"
                  style={{ fontFamily: OUTFIT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '11px', color: '#B6871F', width: '18px', lineHeight: '19px' }}
                >
                  {ROMAN[ti] ?? String(ti + 1)}.
                </span>
                <span className="text-[12.5px] font-medium" style={{ color: '#2E2820', fontFamily: OUTFIT, lineHeight: 1.55 }}>
                  {topic}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Your country — large */}
        <div className="w-full flex flex-col items-center mt-6 pt-6" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
          <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 12px 0' }}>
            YOUR COUNTRY
          </p>
          {countryCode && <FlagImg code={countryCode} size={56} className="rounded-lg shadow-lg" />}
          <p className="font-black text-xl mt-3" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            {countryName}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
