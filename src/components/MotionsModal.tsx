'use client';

import { useState } from 'react';
import { Committee } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';

type MotionChoice = 'moderated' | 'unmoderated' | 'consultation' | 'tour';

const MOTION_TYPES: { id: MotionChoice; icon: string; label: string; sub: string }[] = [
  { id: 'moderated',    icon: '🎙️', label: 'Moderated Caucus',       sub: 'Structured speeches, one by one'  },
  { id: 'unmoderated',  icon: '💬', label: 'Unmoderated Caucus',     sub: 'Free time for delegates to talk'  },
  { id: 'consultation', icon: '🤝', label: 'Consultation of the Whole', sub: 'Informal session, all together' },
  { id: 'tour',         icon: '🔄', label: 'Tour de Table',           sub: 'Everyone gets a brief turn'       },
];

function formatSecs(s: number) {
  if (s <= 0) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec} seconds`;
  if (sec === 0) return `${m} minute${m > 1 ? 's' : ''}`;
  return `${m}m ${sec}s`;
}

function speakerCount(total: number, speaking: number) {
  if (!speaking || !total) return 0;
  return Math.floor(total / speaking);
}

export default function MotionsModal({ committee, onClose }: { committee: Committee; onClose: () => void }) {
  const { startCaucus, addToSpeakersList, setPhase } = useCommitteeStore();
  const [chosen, setChosen] = useState<MotionChoice | null>(null);
  const [totalTime, setTotalTime] = useState(600);
  const [speakingTime, setSpeakingTime] = useState(60);
  const [topic, setTopic] = useState('');

  const present = committee.delegates.filter((d) => d.status !== 'absent');

  const submit = () => {
    if (!chosen) return;
    if (chosen === 'tour') {
      present.forEach((d) => addToSpeakersList(committee.id, d.id));
      onClose();
      return;
    }
    if (chosen === 'moderated') {
      startCaucus(committee.id, { active: true, type: 'moderated', totalTime, speakingTime, purpose: topic });
      onClose();
      return;
    }
    if (chosen === 'unmoderated' || chosen === 'consultation') {
      startCaucus(committee.id, {
        active: true, type: 'unmoderated', totalTime, speakingTime: 0,
        purpose: chosen === 'consultation' ? 'Consultation of the Whole' : topic,
      });
      onClose();
      return;
    }
  };

  const info = chosen ? MOTION_TYPES.find((m) => m.id === chosen)! : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 8, 20, 0.85)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-[#0f1526] border border-[#1e2540] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-2">
          {chosen ? (
            <button onClick={() => setChosen(null)} className="text-sm text-[#8892aa] hover:text-white transition-colors flex items-center gap-1">
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button onClick={onClose} className="text-[#4a5580] hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {!chosen ? (
          /* ── Step 1: Choose ── */
          <div className="px-8 pb-8">
            <h2 className="text-3xl font-black text-white mb-1">Raise a Motion</h2>
            <p className="text-[#8892aa] mb-7">What would you like to do?</p>
            <div className="grid grid-cols-2 gap-3">
              {MOTION_TYPES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setChosen(m.id)}
                  className="flex flex-col items-start gap-2 bg-[#141929] hover:bg-[#1a2240] border border-[#1e2540] hover:border-blue-600/40 rounded-2xl p-5 text-left transition-all group"
                >
                  <span className="text-4xl">{m.icon}</span>
                  <div>
                    <div className="text-base font-bold text-white group-hover:text-blue-300 transition-colors leading-tight">{m.label}</div>
                    <div className="text-xs text-[#8892aa] mt-1 leading-snug">{m.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Step 2: Configure ── */
          <div className="px-8 pb-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl">{info!.icon}</span>
              <div>
                <h2 className="text-2xl font-black text-white">{info!.label}</h2>
                <p className="text-sm text-[#8892aa]">{info!.sub}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Tour de table — just confirm */}
              {chosen === 'tour' && (
                <div className="bg-[#141929] border border-[#1e2540] rounded-2xl p-5">
                  <p className="text-white font-semibold mb-1">Add all {present.length} present delegates to the speakers list?</p>
                  <p className="text-sm text-[#8892aa]">Speaking time per delegate</p>
                  <div className="flex items-center gap-3 mt-3">
                    <input type="number" value={speakingTime} onChange={(e) => setSpeakingTime(parseInt(e.target.value) || 0)}
                      className="w-20 bg-[#0f1526] border border-[#1e2540] rounded-xl px-3 py-2.5 text-white text-lg font-bold text-center focus:outline-none" />
                    <span className="text-[#8892aa]">seconds</span>
                    {speakingTime > 0 && <span className="text-blue-400 text-sm">= {formatSecs(speakingTime)}</span>}
                  </div>
                </div>
              )}

              {/* Total time */}
              {(chosen === 'moderated' || chosen === 'unmoderated' || chosen === 'consultation') && (
                <div>
                  <label className="block text-sm font-semibold text-[#c0c8d8] mb-3">Total time</label>
                  <div className="flex items-center gap-3">
                    <input type="number" value={totalTime} onChange={(e) => setTotalTime(parseInt(e.target.value) || 0)}
                      className="w-24 bg-[#141929] border border-[#1e2540] rounded-xl px-3 py-3 text-white text-xl font-bold text-center focus:outline-none focus:border-blue-600" />
                    <span className="text-[#8892aa]">seconds</span>
                    {totalTime > 0 && <span className="text-blue-400">{formatSecs(totalTime)}</span>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    {[120, 300, 600, 900, 1200].map((t) => (
                      <button key={t} onClick={() => setTotalTime(t)}
                        className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${totalTime === t ? 'bg-blue-700 text-white font-bold' : 'bg-[#141929] text-[#8892aa] hover:text-white'}`}>
                        {formatSecs(t)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Speaking time (moderated only) */}
              {chosen === 'moderated' && (
                <div>
                  <label className="block text-sm font-semibold text-[#c0c8d8] mb-3">Speaking time per delegate</label>
                  <div className="flex items-center gap-3">
                    <input type="number" value={speakingTime} onChange={(e) => setSpeakingTime(parseInt(e.target.value) || 0)}
                      className="w-24 bg-[#141929] border border-[#1e2540] rounded-xl px-3 py-3 text-white text-xl font-bold text-center focus:outline-none focus:border-blue-600" />
                    <span className="text-[#8892aa]">seconds</span>
                    {speakingTime > 0 && <span className="text-blue-400">{formatSecs(speakingTime)}</span>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    {[30, 45, 60, 90, 120].map((t) => (
                      <button key={t} onClick={() => setSpeakingTime(t)}
                        className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${speakingTime === t ? 'bg-blue-700 text-white font-bold' : 'bg-[#141929] text-[#8892aa] hover:text-white'}`}>
                        {t}s
                      </button>
                    ))}
                  </div>
                  {speakingTime > 0 && totalTime > 0 && (
                    <p className="text-sm text-green-400 mt-2">
                      About {speakerCount(totalTime, speakingTime)} speakers can speak
                    </p>
                  )}
                </div>
              )}

              {/* Topic/purpose */}
              {(chosen === 'moderated' || chosen === 'unmoderated') && (
                <div>
                  <label className="block text-sm font-semibold text-[#c0c8d8] mb-2">Topic <span className="text-[#4a5580] font-normal">(optional)</span></label>
                  <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Humanitarian response in conflict zones"
                    className="w-full bg-[#141929] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors" />
                </div>
              )}

              <button onClick={submit}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl text-base font-black transition-colors mt-2">
                {chosen === 'tour' ? `Add ${present.length} delegates to list →` : 'Start Now →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
