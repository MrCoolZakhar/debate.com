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
        <div className={`rounded-xl p-5 border ${committee.currentSpeaker ? 'bg-blue-900/20 border-blue-700/40' : 'bg-[#0f1526] border-[#1e2540]'}`}>
          <div className="text-xs text-[#4a5580] font-mono mb-2">CURRENT SPEAKER</div>
          {committee.currentSpeaker ? (
            <>
              <div className="text-2xl font-black text-white mb-4">{committee.currentSpeaker.country}</div>
              <div className="flex justify-between items-end mb-2">
                <span className={`text-4xl font-mono font-bold ${committee.speakerTimeRemaining <= 10 ? 'text-red-400' : 'text-white'}`}>
                  {formatTime(committee.speakerTimeRemaining)}
                </span>
                <span className="text-sm text-[#4a5580]">/ {formatTime(committee.speakerTimeLimit)}</span>
              </div>
              <div className="h-2 bg-[#1a1f2e] rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all ${
                    progress > 50 ? 'bg-blue-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRunning((r) => !r)}
                  className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    running ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'
                  }`}
                >
                  {running ? '⏸ Pause' : '▶ Start'}
                </button>
                <button
                  onClick={() => { setRunning(false); nextSpeaker(committee.id); }}
                  className="flex-1 bg-[#1e2540] hover:bg-[#2a3050] text-white py-2.5 rounded-lg font-semibold text-sm transition-colors"
                >
                  Next →
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">🎙️</div>
              <p className="text-[#8892aa] text-sm">No current speaker</p>
              <button
                onClick={() => nextSpeaker(committee.id)}
                disabled={committee.speakersList.length === 0}
                className="mt-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Call Next Speaker
              </button>
            </div>
          )}
        </div>

        {/* Time limit setting */}
        <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4">
          <div className="text-xs text-[#4a5580] font-mono mb-3">SPEAKING TIME LIMIT</div>
          <div className="flex gap-2">
            <input
              type="number"
              value={newTimeLimit}
              onChange={(e) => setNewTimeLimit(e.target.value)}
              className="flex-1 bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
              min={10}
              max={600}
            />
            <span className="text-sm text-[#8892aa] self-center">sec</span>
            <button
              onClick={() => setSpeakerTimeLimit(committee.id, parseInt(newTimeLimit) || 90)}
              className="bg-[#1e2540] hover:bg-[#2a3050] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
                  committee.speakerTimeLimit === t ? 'bg-blue-700 text-white' : 'bg-[#141929] text-[#8892aa] hover:text-white'
                }`}
              >
                {t}s
              </button>
            ))}
          </div>
        </div>

        {/* Phase buttons */}
        <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4">
          <div className="text-xs text-[#4a5580] font-mono mb-3">SESSION ACTIONS</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPhase(committee.id, 'voting')}
              className="bg-purple-900/40 hover:bg-purple-800/40 border border-purple-700/30 text-purple-300 py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              Open Voting
            </button>
            <button
              onClick={() => setPhase(committee.id, 'adjourned')}
              className="bg-red-900/30 hover:bg-red-800/30 border border-red-700/30 text-red-400 py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              Adjourn Session
            </button>
          </div>
        </div>
      </div>

      {/* Speakers list */}
      <div className="w-64 flex flex-col bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden">
        <div className="p-3 border-b border-[#1e2540]">
          <div className="text-xs text-[#4a5580] font-mono">SPEAKERS LIST</div>
          <div className="text-white text-sm font-bold mt-0.5">{committee.speakersList.length} queued</div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {committee.speakersList.length === 0 ? (
            <div className="text-center py-8 text-[#4a5580] text-xs">List is empty</div>
          ) : (
            committee.speakersList.map((s, i) => (
              <div key={s.delegateId} className="flex items-center gap-2 bg-[#141929] rounded-lg px-2 py-2">
                <span className="text-xs text-[#4a5580] w-4 font-mono">{i + 1}</span>
                <span className="flex-1 text-xs text-[#c0c8d8]">{s.country}</span>
                <button
                  onClick={() => removeFromSpeakersList(committee.id, s.delegateId)}
                  className="text-[#4a5580] hover:text-red-400 text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
        <div className="p-2 border-t border-[#1e2540]">
          <div className="text-xs text-[#4a5580] mb-2 font-mono">ADD SPEAKER</div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {presentDelegates
              .filter((d) => !onList.has(d.id) && !isCurrentSpeaker(d.id))
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => addToSpeakersList(committee.id, d.id)}
                  className="w-full text-left text-xs text-[#8892aa] hover:text-white hover:bg-[#1e2540] px-2 py-1.5 rounded transition-colors"
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
