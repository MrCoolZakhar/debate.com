'use client';

import { useState } from 'react';
import { Committee, MotionType } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';

const MOTION_LABELS: Record<MotionType, string> = {
  'moderated-caucus': 'Moderated Caucus',
  'unmoderated-caucus': 'Unmoderated Caucus',
  'close-debate': 'Close Debate',
  'adjourn': 'Adjourn Session',
  'extend-speakers-time': 'Extend Speakers Time',
  'set-speakers-time': 'Set Speakers Time',
};

export default function MotionsPanel({ committee }: { committee: Committee }) {
  const { proposeMotion, voteOnMotion, dismissMotion, startCaucus } = useCommitteeStore();
  const [showForm, setShowForm] = useState(false);
  const [motionType, setMotionType] = useState<MotionType>('moderated-caucus');
  const [proposedBy, setProposedBy] = useState('');
  const [totalTime, setTotalTime] = useState('600');
  const [speakingTime, setSpeakingTime] = useState('60');
  const [purpose, setPurpose] = useState('');
  const [votingMotionId, setVotingMotionId] = useState<string | null>(null);
  const [forVotes, setForVotes] = useState('');
  const [againstVotes, setAgainstVotes] = useState('');
  const [abstainVotes, setAbstainVotes] = useState('');

  const handlePropose = () => {
    if (!proposedBy.trim()) return;
    proposeMotion(committee.id, motionType, proposedBy.trim(), {
      totalTime: parseInt(totalTime) || undefined,
      speakingTime: parseInt(speakingTime) || undefined,
      purpose: purpose.trim() || undefined,
    });
    setShowForm(false);
    setProposedBy('');
    setPurpose('');
  };

  const handleVoteResult = (motionId: string) => {
    voteOnMotion(committee.id, motionId, parseInt(forVotes) || 0, parseInt(againstVotes) || 0, parseInt(abstainVotes) || 0);
    const motion = committee.motions.find((m) => m.id === motionId);
    if (motion && (motion.type === 'moderated-caucus' || motion.type === 'unmoderated-caucus')) {
      const passed = (parseInt(forVotes) || 0) > (parseInt(againstVotes) || 0);
      if (passed) {
        startCaucus(committee.id, {
          active: true,
          type: motion.type === 'moderated-caucus' ? 'moderated' : 'unmoderated',
          totalTime: motion.totalTime || 600,
          speakingTime: motion.speakingTime || 60,
          purpose: motion.purpose || '',
        });
      }
    }
    setVotingMotionId(null);
    setForVotes('');
    setAgainstVotes('');
    setAbstainVotes('');
  };

  const pending = committee.motions.filter((m) => m.status === 'pending' || m.status === 'voting');
  const resolved = committee.motions.filter((m) => m.status === 'passed' || m.status === 'failed');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-[#1e2540]">
        <div>
          <h3 className="font-bold text-white">Motions</h3>
          <p className="text-[#8892aa] text-xs mt-0.5">{pending.length} pending</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          + New Motion
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-[#1e2540] bg-[#0d1120] space-y-3">
          <div>
            <label className="text-xs text-[#8892aa] block mb-1">Motion Type</label>
            <select
              value={motionType}
              onChange={(e) => setMotionType(e.target.value as MotionType)}
              className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
            >
              {Object.entries(MOTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#8892aa] block mb-1">Proposed By</label>
            <select
              value={proposedBy}
              onChange={(e) => setProposedBy(e.target.value)}
              className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
            >
              <option value="">Select delegate...</option>
              {committee.delegates.filter((d) => d.status !== 'absent').map((d) => (
                <option key={d.id} value={d.country}>{d.country}</option>
              ))}
            </select>
          </div>
          {(motionType === 'moderated-caucus' || motionType === 'unmoderated-caucus') && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[#8892aa] block mb-1">Total Time (sec)</label>
                  <input
                    type="number"
                    value={totalTime}
                    onChange={(e) => setTotalTime(e.target.value)}
                    className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>
                {motionType === 'moderated-caucus' && (
                  <div>
                    <label className="text-xs text-[#8892aa] block mb-1">Speaking Time (sec)</label>
                    <input
                      type="number"
                      value={speakingTime}
                      onChange={(e) => setSpeakingTime(e.target.value)}
                      className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-[#8892aa] block mb-1">Purpose</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Discuss climate change policy..."
                  className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600 placeholder-[#4a5580]"
                />
              </div>
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={handlePropose}
              disabled={!proposedBy}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Submit Motion
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-[#1e2540] hover:bg-[#2a3050] text-[#8892aa] rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {pending.length === 0 && (
          <div className="text-center py-8 text-[#4a5580] text-sm">No pending motions</div>
        )}
        {pending.map((motion) => (
          <div key={motion.id} className="bg-[#141929] border border-[#1e2540] rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-white text-sm">{MOTION_LABELS[motion.type]}</div>
                <div className="text-xs text-[#8892aa] mt-0.5">By {motion.proposedBy}</div>
              </div>
              <button
                onClick={() => dismissMotion(committee.id, motion.id)}
                className="text-[#4a5580] hover:text-red-400 text-xs transition-colors"
              >
                ✕
              </button>
            </div>
            {motion.purpose && (
              <div className="text-xs text-[#8892aa] mb-2 italic">"{motion.purpose}"</div>
            )}
            {(motion.totalTime || motion.speakingTime) && (
              <div className="flex gap-3 text-xs text-[#4a5580] mb-3">
                {motion.totalTime && <span>Total: {Math.floor(motion.totalTime / 60)}m {motion.totalTime % 60}s</span>}
                {motion.speakingTime && <span>Speaking: {motion.speakingTime}s</span>}
              </div>
            )}
            {votingMotionId === motion.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-green-400 block mb-1">For</label>
                    <input type="number" value={forVotes} onChange={(e) => setForVotes(e.target.value)}
                      className="w-full bg-[#1e2540] border border-green-700/30 rounded px-2 py-1 text-white text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-red-400 block mb-1">Against</label>
                    <input type="number" value={againstVotes} onChange={(e) => setAgainstVotes(e.target.value)}
                      className="w-full bg-[#1e2540] border border-red-700/30 rounded px-2 py-1 text-white text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-400 block mb-1">Abstain</label>
                    <input type="number" value={abstainVotes} onChange={(e) => setAbstainVotes(e.target.value)}
                      className="w-full bg-[#1e2540] border border-yellow-700/30 rounded px-2 py-1 text-white text-sm focus:outline-none" />
                  </div>
                </div>
                <button
                  onClick={() => handleVoteResult(motion.id)}
                  className="w-full bg-green-700 hover:bg-green-600 text-white py-1.5 rounded text-sm font-semibold transition-colors"
                >
                  Record Vote
                </button>
              </div>
            ) : (
              <button
                onClick={() => setVotingMotionId(motion.id)}
                className="w-full bg-[#1e2540] hover:bg-[#2a3050] text-white py-2 rounded-lg text-xs font-medium transition-colors"
              >
                Put to Vote
              </button>
            )}
          </div>
        ))}

        {resolved.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-[#4a5580] font-mono mb-2">RESOLVED</div>
            {resolved.map((motion) => (
              <div key={motion.id} className={`flex items-center justify-between px-3 py-2 rounded-lg mb-1 ${
                motion.status === 'passed' ? 'bg-green-950/30 border border-green-800/20' : 'bg-red-950/30 border border-red-800/20'
              }`}>
                <span className="text-xs text-[#c0c8d8]">{MOTION_LABELS[motion.type]}</span>
                <span className={`text-xs font-bold ${motion.status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>
                  {motion.status === 'passed' ? '✓ Passed' : '✗ Failed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
