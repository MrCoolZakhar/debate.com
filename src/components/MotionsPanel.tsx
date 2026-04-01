'use client';

import { useState } from 'react';
import { Committee, MotionType } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';

type SimpleMotionType = 'moderated-caucus' | 'unmoderated-caucus' | 'tour-de-table' | 'close-debate' | 'custom';

const MOTION_INFO: Record<SimpleMotionType, { label: string; icon: string; description: string; hasTime: boolean; hasSpeakingTime: boolean }> = {
  'moderated-caucus': { label: 'Moderated Caucus', icon: '🎙️', description: 'Structured debate with speaking slots', hasTime: true, hasSpeakingTime: true },
  'unmoderated-caucus': { label: 'Unmoderated Caucus', icon: '💬', description: 'Open networking time', hasTime: true, hasSpeakingTime: false },
  'tour-de-table': { label: 'Tour de Table', icon: '🔄', description: 'Every delegate speaks briefly', hasTime: false, hasSpeakingTime: true },
  'close-debate': { label: 'Close Debate', icon: '🔔', description: 'Move to voting procedure', hasTime: false, hasSpeakingTime: false },
  'custom': { label: 'Custom Motion', icon: '✏️', description: 'Enter any other motion', hasTime: false, hasSpeakingTime: false },
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s > 0 ? s + 's' : ''}`.trim() : `${s}s`;
}

function speakersCount(totalSeconds: number, speakingSeconds: number) {
  if (!speakingSeconds) return 0;
  return Math.floor(totalSeconds / speakingSeconds);
}

export default function MotionsPanel({ committee }: { committee: Committee }) {
  const { proposeMotion, voteOnMotion, dismissMotion, startCaucus, setPhase, addToSpeakersList } = useCommitteeStore();
  const [selected, setSelected] = useState<SimpleMotionType | null>(null);
  const [proposedBy, setProposedBy] = useState('');
  const [totalTime, setTotalTime] = useState(600);
  const [speakingTime, setSpeakingTime] = useState(60);
  const [purpose, setPurpose] = useState('');
  const [customText, setCustomText] = useState('');
  const [votingId, setVotingId] = useState<string | null>(null);
  const [forV, setForV] = useState('');
  const [againstV, setAgainstV] = useState('');
  const [abstainV, setAbstainV] = useState('');

  const presentDelegates = committee.delegates.filter((d) => d.status !== 'absent');

  const handleSubmit = () => {
    if (!proposedBy && selected !== 'close-debate' && selected !== 'tour-de-table') return;
    if (!selected) return;

    if (selected === 'close-debate') {
      setPhase(committee.id, 'voting');
      setSelected(null);
      return;
    }

    if (selected === 'tour-de-table') {
      // Add all present delegates to the speakers list
      presentDelegates.forEach((d) => addToSpeakersList(committee.id, d.id));
      setSelected(null);
      return;
    }

    const motionType: MotionType = selected === 'custom' ? 'adjourn' : selected as MotionType;
    proposeMotion(committee.id, motionType, proposedBy, {
      totalTime: MOTION_INFO[selected].hasTime ? totalTime : undefined,
      speakingTime: MOTION_INFO[selected].hasSpeakingTime ? speakingTime : undefined,
      purpose: purpose || customText || undefined,
    });
    setSelected(null);
    setProposedBy('');
    setPurpose('');
    setCustomText('');
  };

  const handleVote = (motionId: string) => {
    const f = parseInt(forV) || 0;
    const a = parseInt(againstV) || 0;
    const abs = parseInt(abstainV) || 0;
    voteOnMotion(committee.id, motionId, f, a, abs);
    const motion = committee.motions.find((m) => m.id === motionId);
    if (motion && f > a && (motion.type === 'moderated-caucus' || motion.type === 'unmoderated-caucus')) {
      startCaucus(committee.id, {
        active: true,
        type: motion.type === 'moderated-caucus' ? 'moderated' : 'unmoderated',
        totalTime: motion.totalTime || 600,
        speakingTime: motion.speakingTime || 60,
        purpose: motion.purpose || '',
        proposedBy: motion.proposedBy,
        proposerPosition: null,
        spokenCountries: [],
      });
    }
    setVotingId(null);
    setForV(''); setAgainstV(''); setAbstainV('');
  };

  const pending = committee.motions.filter((m) => m.status === 'pending');

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[#1e2540]">
        <span className="text-xs font-mono text-[#4a5580]">MOTIONS</span>
      </div>

      {/* Motion type selector */}
      {!selected ? (
        <div className="p-3 space-y-1.5">
          <p className="text-xs text-[#4a5580] mb-2">Raise a motion:</p>
          {(Object.entries(MOTION_INFO) as [SimpleMotionType, typeof MOTION_INFO[SimpleMotionType]][]).map(([key, info]) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#141929] hover:bg-[#1e2540] border border-transparent hover:border-blue-700/30 rounded-xl transition-all text-left"
            >
              <span className="text-lg">{info.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">{info.label}</div>
                <div className="text-xs text-[#4a5580]">{info.description}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-3 space-y-3">
          <button onClick={() => setSelected(null)} className="text-xs text-[#8892aa] hover:text-white transition-colors">
            ← Back
          </button>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <span>{MOTION_INFO[selected].icon}</span>
            {MOTION_INFO[selected].label}
          </div>

          {selected !== 'close-debate' && selected !== 'tour-de-table' && (
            <div>
              <label className="text-xs text-[#8892aa] block mb-1">Proposed by</label>
              <select
                value={proposedBy}
                onChange={(e) => setProposedBy(e.target.value)}
                className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
              >
                <option value="">Select delegate...</option>
                {presentDelegates.map((d) => (
                  <option key={d.id} value={d.country}>{d.country}</option>
                ))}
              </select>
            </div>
          )}

          {selected === 'custom' && (
            <div>
              <label className="text-xs text-[#8892aa] block mb-1">Motion text</label>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Describe the motion..."
                className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600 placeholder-[#4a5580]"
              />
            </div>
          )}

          {MOTION_INFO[selected].hasTime && (
            <div>
              <label className="text-xs text-[#8892aa] block mb-1">Total time (seconds)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={totalTime}
                  onChange={(e) => setTotalTime(parseInt(e.target.value) || 0)}
                  className="flex-1 bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
                />
                <span className="text-xs text-[#8892aa]">= {formatTime(totalTime)}</span>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {[120, 300, 600, 900, 1200].map((t) => (
                  <button key={t} onClick={() => setTotalTime(t)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${totalTime === t ? 'bg-blue-700 text-white' : 'bg-[#141929] text-[#8892aa] hover:text-white'}`}>
                    {formatTime(t)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {MOTION_INFO[selected].hasSpeakingTime && (
            <div>
              <label className="text-xs text-[#8892aa] block mb-1">Speaking time per delegate (seconds)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={speakingTime}
                  onChange={(e) => setSpeakingTime(parseInt(e.target.value) || 0)}
                  className="flex-1 bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
                />
                <span className="text-xs text-[#8892aa]">{speakingTime}s</span>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {[30, 45, 60, 90, 120].map((t) => (
                  <button key={t} onClick={() => setSpeakingTime(t)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${speakingTime === t ? 'bg-blue-700 text-white' : 'bg-[#141929] text-[#8892aa] hover:text-white'}`}>
                    {t}s
                  </button>
                ))}
              </div>
              {MOTION_INFO[selected].hasTime && speakingTime > 0 && (
                <p className="text-xs text-blue-400 mt-1.5">
                  ≈ {speakersCount(totalTime, speakingTime)} speakers fit in this time
                </p>
              )}
            </div>
          )}

          {(selected === 'moderated-caucus') && (
            <div>
              <label className="text-xs text-[#8892aa] block mb-1">Purpose (optional)</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Discuss humanitarian aid..."
                className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600 placeholder-[#4a5580]"
              />
            </div>
          )}

          {selected === 'tour-de-table' && (
            <p className="text-xs text-[#8892aa]">
              Adds all {presentDelegates.length} present delegates to the speakers list in their current order.
            </p>
          )}
          {selected === 'close-debate' && (
            <p className="text-xs text-[#8892aa]">Immediately opens voting procedure.</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!selected || (!proposedBy && selected !== 'close-debate' && selected !== 'tour-de-table')}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white py-2.5 rounded-lg text-sm font-bold transition-colors"
          >
            {selected === 'close-debate' ? 'Open Voting' : selected === 'tour-de-table' ? 'Add All to List' : 'Submit Motion'}
          </button>
        </div>
      )}

      {/* Pending motions */}
      {pending.length > 0 && (
        <div className="border-t border-[#1e2540] flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-xs text-[#4a5580] font-mono">PENDING ({pending.length})</p>
          {pending.map((m) => (
            <div key={m.id} className="bg-[#141929] border border-[#1e2540] rounded-xl p-3">
              <div className="flex items-start justify-between mb-1">
                <div className="text-sm font-semibold text-white truncate">
                  {m.purpose || m.type.replace(/-/g, ' ')}
                </div>
                <button onClick={() => dismissMotion(committee.id, m.id)} className="text-[#3a4060] hover:text-red-400 text-xs ml-2 transition-colors shrink-0">✕</button>
              </div>
              <div className="text-xs text-[#8892aa] mb-2">By {m.proposedBy}</div>
              {m.totalTime && (
                <div className="text-xs text-[#4a5580] mb-2">
                  {formatTime(m.totalTime)}{m.speakingTime ? ` · ${m.speakingTime}s/speaker · ≈${speakersCount(m.totalTime, m.speakingTime)} speakers` : ''}
                </div>
              )}
              {votingId === m.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[['For', 'text-green-400', forV, setForV], ['Against', 'text-red-400', againstV, setAgainstV], ['Abstain', 'text-yellow-400', abstainV, setAbstainV]] .map(([label, color, val, setter]) => (
                      <div key={label as string}>
                        <label className={`block text-xs font-bold mb-1 ${color}`}>{label as string}</label>
                        <input type="number" min={0} value={val as string}
                          onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                          className="w-full bg-[#1e2540] rounded px-2 py-1.5 text-white text-sm text-center focus:outline-none font-bold" />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => handleVote(m.id)} className="w-full bg-green-700 hover:bg-green-600 text-white py-1.5 rounded text-xs font-bold transition-colors">
                    Record Vote
                  </button>
                </div>
              ) : (
                <button onClick={() => setVotingId(m.id)} className="w-full bg-[#1e2540] hover:bg-[#2a3050] text-white py-1.5 rounded text-xs font-medium transition-colors">
                  Put to Vote
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
