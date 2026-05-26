'use client';

import { useEffect, useRef, useState } from 'react';
import { Committee } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCountryDisplayName } from '@/lib/countries';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CaucusPanel({ committee }: { committee: Committee }) {
  const { tickCaucus, endCaucus, nextCaucusSpeaker } = useCommitteeStore();
  const [running, setRunning] = useState(true);
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const caucus = committee.caucus;
  const t = useT();
  const { language } = useLanguage();

  useEffect(() => {
    if (running && caucus?.active) {
      intervalRef.current = setInterval(() => {
        tickCaucus(committee.id);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, caucus?.active, committee.id, tickCaucus]);

  if (!caucus) return null;

  const totalProgress = (caucus.remainingTime / caucus.totalTime) * 100;
  const speakerProgress = caucus.currentSpeaker
    ? (caucus.speakerTimeRemaining / caucus.speakingTime) * 100
    : 100;

  return (
    <div className="flex flex-col gap-4">
      {/* Caucus header */}
      <div className={`rounded-xl p-5 border ${caucus.type === 'moderated' ? 'bg-[#1B3828]/40 border-[#3D7A52]/40' : 'bg-[#1B3828]/40 border-[#3D7A52]/30'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className={`text-xs font-mono mb-1 ${caucus.type === 'moderated' ? 'text-[#EED98A]' : 'text-[#EED98A]'}`}>
              {caucus.type === 'moderated' ? t('caucus_starting_moderated') : t('caucus_unmod_starting').replace('{name}', '').trim()}
            </div>
            {caucus.purpose && <div className="text-[#1C1410] font-semibold text-sm">{caucus.purpose}</div>}
          </div>
          <button
            onClick={endCaucus.bind(null, committee.id)}
            className="text-xs text-[#8B2020] hover:text-[#8B2020] transition-colors border border-[#8B2020]/40 px-3 py-1 rounded-lg"
          >
            {t('caucus_end')}
          </button>
        </div>

        <div className="text-5xl font-black font-mono text-[#1C1410] mb-2">
          {formatTime(caucus.remainingTime)}
        </div>
        <div className="h-2 bg-[#DDD4C0]/30 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all ${caucus.type === 'moderated' ? 'bg-[#2A5A3C]' : 'bg-[#B6871F]'}`}
            style={{ width: `${totalProgress}%` }}
          />
        </div>
        <button
          onClick={() => setRunning((r) => !r)}
          className={`px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${
            running ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'
          }`}
        >
          {running ? t('gsl_pause') : t('session_resume_btn')}
        </button>
      </div>

      {/* Moderated caucus speaker management */}
      {caucus.type === 'moderated' && (
        <div className="bg-[#1B3828] border border-[#3D7A52]/30 rounded-xl p-4">
          <div className="text-xs text-[#9A8A78] font-mono mb-3">{t('gsl_speaker_queue').toUpperCase()}</div>

          {caucus.currentSpeaker && (
            <div className="mb-4 p-3 bg-[#B6871F]/15 border border-[#B6871F]/30 rounded-lg">
              <div className="text-xs text-[#EED98A] mb-1">{t('gsl_speaking').toUpperCase()}</div>
              <div className="text-[#1C1410] font-bold">{caucus.currentSpeaker}</div>
              <div className="flex justify-between items-end mt-2 mb-1">
                <span className={`text-2xl font-mono font-bold ${caucus.speakerTimeRemaining <= 5 ? 'text-[#8B2020]' : 'text-[#1C1410]'}`}>
                  {formatTime(caucus.speakerTimeRemaining)}
                </span>
              </div>
              <div className="h-1.5 bg-[#DDD4C0]/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${speakerProgress > 50 ? 'bg-[#2A5A3C]' : speakerProgress > 20 ? 'bg-[#B6871F]' : 'bg-red-500'}`}
                  style={{ width: `${speakerProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <select
              value={selectedSpeaker}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className="flex-1 bg-[#1B3828] border border-[#3D7A52]/30 rounded-lg px-3 py-2 text-[#1C1410] text-sm focus:outline-none focus:border-[#3D7A52]"
            >
              <option value="">{t('caucus_add_placeholder')}</option>
              {committee.delegates.filter((d) => d.status !== 'absent').map((d) => (
                <option key={d.id} value={d.country}>{getCountryDisplayName(d.country, language)}</option>
              ))}
            </select>
            <button
              onClick={() => { if (selectedSpeaker) { nextCaucusSpeaker(committee.id, selectedSpeaker); setSelectedSpeaker(''); } }}
              disabled={!selectedSpeaker}
              className="bg-[#2A5A3C] hover:bg-[#3D7A52] disabled:bg-[#1B3828]/40 disabled:text-[#9A8A78] text-[#1C1410] px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {t('gsl_call_next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
