'use client';

import { useEffect, useRef, useState } from 'react';
import { Committee } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';

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
      <div className={`rounded-xl p-5 border ${caucus.type === 'moderated' ? 'bg-blue-900/20 border-blue-700/40' : 'bg-purple-900/20 border-purple-700/40'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className={`text-xs font-mono mb-1 ${caucus.type === 'moderated' ? 'text-blue-400' : 'text-purple-400'}`}>
              {caucus.type === 'moderated' ? 'MODERATED CAUCUS' : 'UNMODERATED CAUCUS'}
            </div>
            {caucus.purpose && <div className="text-white font-semibold text-sm">{caucus.purpose}</div>}
          </div>
          <button
            onClick={endCaucus.bind(null, committee.id)}
            className="text-xs text-red-400 hover:text-red-300 transition-colors border border-red-800/40 px-3 py-1 rounded-lg"
          >
            End Caucus
          </button>
        </div>

        <div className="text-5xl font-black font-mono text-white mb-2">
          {formatTime(caucus.remainingTime)}
        </div>
        <div className="h-2 bg-[#1a1f2e] rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all ${caucus.type === 'moderated' ? 'bg-blue-500' : 'bg-purple-500'}`}
            style={{ width: `${totalProgress}%` }}
          />
        </div>
        <button
          onClick={() => setRunning((r) => !r)}
          className={`px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${
            running ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'
          }`}
        >
          {running ? '⏸ Pause' : '▶ Resume'}
        </button>
      </div>

      {/* Moderated caucus speaker management */}
      {caucus.type === 'moderated' && (
        <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4">
          <div className="text-xs text-[#4a5580] font-mono mb-3">CAUCUS SPEAKERS</div>

          {caucus.currentSpeaker && (
            <div className="mb-4 p-3 bg-blue-950/30 border border-blue-800/30 rounded-lg">
              <div className="text-xs text-blue-400 mb-1">NOW SPEAKING</div>
              <div className="text-white font-bold">{caucus.currentSpeaker}</div>
              <div className="flex justify-between items-end mt-2 mb-1">
                <span className={`text-2xl font-mono font-bold ${caucus.speakerTimeRemaining <= 5 ? 'text-red-400' : 'text-white'}`}>
                  {formatTime(caucus.speakerTimeRemaining)}
                </span>
              </div>
              <div className="h-1.5 bg-[#1a1f2e] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${speakerProgress > 50 ? 'bg-blue-500' : speakerProgress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${speakerProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <select
              value={selectedSpeaker}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className="flex-1 bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
            >
              <option value="">Select speaker...</option>
              {committee.delegates.filter((d) => d.status !== 'absent').map((d) => (
                <option key={d.id} value={d.country}>{d.country}</option>
              ))}
            </select>
            <button
              onClick={() => { if (selectedSpeaker) { nextCaucusSpeaker(committee.id, selectedSpeaker); setSelectedSpeaker(''); } }}
              disabled={!selectedSpeaker}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
