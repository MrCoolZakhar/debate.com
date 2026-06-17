'use client';

import { useEffect, useRef, useState } from 'react';
import { Committee } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SpeakersListPanel({ committee }: { committee: Committee }) {
  const { addToSpeakersList, removeFromSpeakersList, nextSpeaker, setSpeakerTimeLimit, tickSpeakerTimer, setPhase } = useCommitteeStore();
  const [running, setRunning] = useState(false);
  const [newTimeLimit, setNewTimeLimit] = useState(String(committee.speakerTimeLimit));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (running && committee.currentSpeaker) {
      intervalRef.current = setInterval(() => {
        tickSpeakerTimer(committee.id);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, committee.id, committee.currentSpeaker, tickSpeakerTimer]);

  useEffect(() => {
    if (committee.speakerTimeRemaining === 0 && running) {
      setRunning(false);
    }
  }, [committee.speakerTimeRemaining, running]);

  const progress = committee.currentSpeaker
    ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100
    : 100;

  const presentDelegates = committee.delegates.filter((d) => d.status !== 'absent');
  const onList = new Set(committee.speakersList.map((s) => s.delegateId));
  const isCurrentSpeaker = (id: string) => committee.currentSpeaker?.delegateId === id;

  return (
    <div className="flex gap-4 h-full">
      {/* Current Speaker */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Speaker timer */}
        <div className={`rounded-xl p-5 border ${committee.currentSpeaker ? 'bg-[#1B3828]/40 border-[#3D7A52]/40' : 'bg-[#1B3828] border-[#3D7A52]/30'}`}>
          <div className="text-xs text-[#9A8A78] font-mono mb-2">CURRENT SPEAKER</div>
          {committee.currentSpeaker ? (
            <>
              <div className="text-2xl font-black text-[#1C1410] mb-4">{committee.currentSpeaker.country}</div>
              <div className="flex justify-between items-end mb-2">
                <span className={`text-4xl font-mono font-bold ${committee.speakerTimeRemaining <= 10 ? 'text-[#8B2020]' : 'text-[#1C1410]'}`}>
                  {formatTime(committee.speakerTimeRemaining)}
                </span>
                <span className="text-sm text-[#9A8A78]">/ {formatTime(committee.speakerTimeLimit)}</span>
              </div>
              <div className="h-2 bg-[#DDD4C0]/30 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all ${
                    progress > 50 ? 'bg-[#2A5A3C]' : progress > 20 ? 'bg-[#B6871F]' : 'bg-red-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRunning((r) => !r)}
                  className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    running ? 'bg-[#B6871F] hover:bg-[#B6871F]/80 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'
                  }`}
                >
                  {running ? '⏸ Pause' : '▶ Start'}
                </button>
                <button
                  onClick={() => { setRunning(false); nextSpeaker(committee.id); }}
                  className="flex-1 bg-[#2A5A3C]/40 hover:bg-[#3D7A52]/40 text-[#1C1410] py-2.5 rounded-lg font-semibold text-sm transition-colors"
                >
                  Next →
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">🎙️</div>
              <p className="text-[#9A8A78] text-sm">No current speaker</p>
              <button
                onClick={() => nextSpeaker(committee.id)}
                disabled={committee.speakersList.length === 0}
                className="mt-4 bg-[#2A5A3C] hover:bg-[#3D7A52] disabled:bg-[#1B3828]/40 disabled:text-[#9A8A78] text-[#1C1410] px-6 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Call Next Speaker
              </button>
            </div>
          )}
        </div>

        {/* Time limit setting */}
        <div className="bg-[#1B3828] border border-[#3D7A52]/30 rounded-xl p-4">
          <div className="text-xs text-[#9A8A78] font-mono mb-3">SPEAKING TIME LIMIT</div>
          <div className="flex gap-2">
            <input
              type="number"
              value={newTimeLimit}
              onChange={(e) => setNewTimeLimit(e.target.value)}
              className="flex-1 bg-[#1B3828] border border-[#3D7A52]/30 rounded-lg px-3 py-2 text-[#1C1410] text-sm focus:outline-none focus:border-[#3D7A52]"
              min={10}
              max={600}
            />
            <span className="text-sm text-[#9A8A78] self-center">sec</span>
            <button
              onClick={() => setSpeakerTimeLimit(committee.id, parseInt(newTimeLimit) || 90)}
              className="bg-[#2A5A3C]/40 hover:bg-[#3D7A52]/40 text-[#1C1410] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Set
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {[30, 60, 90, 120, 180].map((t) => (
              <button
                key={t}
                onClick={() => { setSpeakerTimeLimit(committee.id, t); setNewTimeLimit(String(t)); }}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  committee.speakerTimeLimit === t ? 'bg-[#2A5A3C] text-[#1C1410]' : 'bg-[#1B3828] text-[#9A8A78] hover:text-[#1C1410]'
                }`}
              >
                {t}s
              </button>
            ))}
          </div>
        </div>

        {/* Phase buttons */}
        <div className="bg-[#1B3828] border border-[#3D7A52]/30 rounded-xl p-4">
          <div className="text-xs text-[#9A8A78] font-mono mb-3">SESSION ACTIONS</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPhase(committee.id, 'voting')}
              className="bg-[#1B3828]/40 hover:bg-[#1B3828]/40 border border-[#3D7A52]/30 text-[#EED98A] py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              Open Voting
            </button>
            <button
              onClick={() => setPhase(committee.id, 'adjourned')}
              className="bg-[#8B2020]/20 hover:bg-[#8B2020]/20 border border-[#8B2020]/30 text-[#8B2020] py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              Adjourn Session
            </button>
          </div>
        </div>
      </div>

      {/* Speakers list */}
      <div className="w-64 flex flex-col bg-[#1B3828] border border-[#3D7A52]/30 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-[#3D7A52]/30">
          <div className="text-xs text-[#9A8A78] font-mono">SPEAKERS LIST</div>
          <div className="text-[#1C1410] text-sm font-bold mt-0.5">{committee.speakersList.length} queued</div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {committee.speakersList.length === 0 ? (
            <div className="text-center py-8 text-[#9A8A78] text-xs">List is empty</div>
          ) : (
            committee.speakersList.map((s, i) => (
              <div key={s.delegateId} className="flex items-center gap-2 bg-[#1B3828] rounded-lg px-2 py-2">
                <span className="text-xs text-[#9A8A78] w-4 font-mono">{i + 1}</span>
                <span className="flex-1 text-xs text-[#6A5A4A]">{s.country}</span>
                <button
                  onClick={() => removeFromSpeakersList(committee.id, s.delegateId)}
                  className="text-[#9A8A78] hover:text-[#8B2020] text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
        <div className="p-2 border-t border-[#3D7A52]/30">
          <div className="text-xs text-[#9A8A78] mb-2 font-mono">ADD SPEAKER</div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {presentDelegates
              .filter((d) => !onList.has(d.id) && !isCurrentSpeaker(d.id))
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => addToSpeakersList(committee.id, d.id)}
                  className="w-full text-start text-xs text-[#9A8A78] hover:text-[#1C1410] hover:bg-[#2A5A3C]/40 px-2 py-1.5 rounded transition-colors"
                >
                  + {d.country}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
