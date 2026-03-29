'use client';

import { useState, useRef } from 'react';
import { Committee, PendingMotion, PendingMotionType } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';
import { getCountryByName, getFlagEmoji } from '@/lib/countries';

type ModalView = 'list' | 'raise' | 'vote';

const TYPE_META: Record<PendingMotionType, { icon: string; label: string; sub: string }> = {
  consultation: { icon: '🤝', label: 'Consultation of the Whole', sub: 'Informal session, all together' },
  tour:         { icon: '🔄', label: 'Tour de Table',              sub: 'Everyone gets a brief turn' },
  unmoderated:  { icon: '💬', label: 'Unmoderated Caucus',        sub: 'Free time for delegates to talk' },
  moderated:    { icon: '🎙️', label: 'Moderated Caucus',          sub: 'Structured speeches, one by one' },
};

// Ordered most → least disruptive (for choosing type)
const TYPE_ORDER: PendingMotionType[] = ['consultation', 'tour', 'unmoderated', 'moderated'];

function DisruptivenessBadge({ type }: { type: PendingMotionType }) {
  const labels: Record<PendingMotionType, string> = {
    consultation: 'Most disruptive',
    tour: 'Very disruptive',
    unmoderated: 'Disruptive',
    moderated: 'Least disruptive',
  };
  const colors: Record<PendingMotionType, string> = {
    consultation: 'bg-red-900/40 text-red-400 border-red-800/40',
    tour: 'bg-orange-900/40 text-orange-400 border-orange-800/40',
    unmoderated: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/40',
    moderated: 'bg-blue-900/40 text-blue-400 border-blue-800/40',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}

function CountryAutocomplete({
  placeholder,
  value,
  onChange,
  candidates,
  onSelect,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  candidates: string[];
  onSelect: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = value.trim()
    ? candidates
        .filter((c) => c.toLowerCase().startsWith(value.toLowerCase()))
        .concat(candidates.filter((c) => !c.toLowerCase().startsWith(value.toLowerCase()) && c.toLowerCase().includes(value.toLowerCase())))
    : [];
  const top = matches[0] ?? null;
  const commit = (country: string) => { onSelect(country); onChange(country); };
  return (
    <div className="relative">
      <div className="flex items-center bg-[#141929] border border-[#1e2540] focus-within:border-blue-600 rounded-xl overflow-hidden transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && top) { e.preventDefault(); commit(top); }
            if (e.key === 'Escape') onChange('');
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none text-sm"
        />
        {top && value && <span className="text-xs text-[#4a5580] px-3 truncate max-w-[140px]">↵ {top}</span>}
      </div>
      {value && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden z-30 shadow-xl max-h-48 overflow-y-auto">
          {matches.slice(0, 6).map((country, i) => {
            const found = getCountryByName(country);
            return (
              <button key={country} onMouseDown={(e) => { e.preventDefault(); commit(country); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-blue-900/30 text-white' : 'text-[#c0c8d8] hover:bg-[#1e2540]'}`}>
                <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                <span className="text-sm">{country}</span>
                {i === 0 && <span className="ml-auto text-xs text-[#4a5580]">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Raise Motion Form ──
function RaiseMotionForm({
  committee,
  onBack,
  onRaised,
}: {
  committee: Committee;
  onBack: () => void;
  onRaised: () => void;
}) {
  const { addPendingMotion } = useCommitteeStore();
  const [type, setType] = useState<PendingMotionType | null>(null);
  const [proposerQuery, setProposerQuery] = useState('');
  const [proposer, setProposer] = useState('');
  const [totalMins, setTotalMins] = useState(10);
  const [totalSecs, setTotalSecs] = useState(0);
  const [speakingTime, setSpeakingTime] = useState(60);
  const [topic, setTopic] = useState('');
  const [speakerQuery, setSpeakerQuery] = useState('');
  const [speakerList, setSpeakerList] = useState<string[]>([]);
  const [proposerPosition, setProposerPosition] = useState<'first' | 'last'>('first');

  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  const totalTime = totalMins * 60 + totalSecs;
  const maxSpeakers = speakingTime > 0 ? Math.floor(totalTime / speakingTime) : 0;
  const spotsLeft = maxSpeakers - speakerList.length;

  const speakerCandidates = presentCountries.filter((c) => !speakerList.includes(c));

  const addSpeaker = (country: string) => {
    if (speakerList.length >= maxSpeakers) return;
    setSpeakerList((p) => [...p, country]);
    setSpeakerQuery('');
  };

  const buildFinalList = (): string[] => {
    if (!type || type !== 'moderated' || !proposer) return speakerList;
    // Insert proposer first or last
    const without = speakerList.filter((c) => c !== proposer);
    return proposerPosition === 'first' ? [proposer, ...without] : [...without, proposer];
  };

  const canSubmit = () => {
    if (!type || !proposer) return false;
    if (type === 'moderated' && !topic.trim()) return false;
    if (type !== 'tour' && totalTime <= 0) return false;
    return true;
  };

  const submit = () => {
    if (!type || !canSubmit()) return;
    const finalList = buildFinalList();
    addPendingMotion(committee.id, {
      type,
      proposedBy: proposer,
      totalTime: type === 'tour' ? 0 : totalTime,
      speakingTime: type === 'moderated' ? speakingTime : 0,
      topic: topic.trim(),
      speakerList: finalList,
      proposerPosition: type === 'moderated' ? proposerPosition : null,
    });
    onRaised();
  };

  return (
    <div className="px-7 pb-7 space-y-5 overflow-y-auto max-h-[80vh]">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={onBack} className="text-sm text-[#8892aa] hover:text-white transition-colors">← Back</button>
        <h2 className="text-2xl font-black text-white">Raise a Motion</h2>
      </div>

      {/* Type selection */}
      {!type ? (
        <div className="grid grid-cols-2 gap-3">
          {TYPE_ORDER.map((t) => {
            const m = TYPE_META[t];
            return (
              <button key={t} onClick={() => setType(t)}
                className="flex flex-col items-start gap-2 bg-[#141929] hover:bg-[#1a2240] border border-[#1e2540] hover:border-blue-600/40 rounded-2xl p-5 text-left transition-all group">
                <span className="text-4xl">{m.icon}</span>
                <div>
                  <div className="text-base font-bold text-white group-hover:text-blue-300 leading-tight">{m.label}</div>
                  <div className="text-xs text-[#8892aa] mt-1">{m.sub}</div>
                </div>
                <DisruptivenessBadge type={t} />
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{TYPE_META[type].icon}</span>
            <div>
              <div className="text-lg font-bold text-white">{TYPE_META[type].label}</div>
              <DisruptivenessBadge type={type} />
            </div>
            <button onClick={() => setType(null)} className="ml-auto text-xs text-[#4a5580] hover:text-white">change</button>
          </div>

          {/* Proposed by */}
          <div>
            <label className="block text-sm font-semibold text-[#c0c8d8] mb-2">Proposed by</label>
            <CountryAutocomplete
              placeholder="Type country name..."
              value={proposerQuery}
              onChange={setProposerQuery}
              candidates={presentCountries}
              onSelect={(c) => { setProposer(c); setProposerQuery(c); }}
            />
          </div>

          {/* Tour de table — just confirm */}
          {type === 'tour' && (
            <div className="bg-[#141929] border border-[#1e2540] rounded-2xl p-4">
              <p className="text-white font-semibold">Add all {presentCountries.length} present delegates to the speakers list</p>
              <p className="text-sm text-[#8892aa] mt-1">They will be called in order during the speakers list</p>
            </div>
          )}

          {/* Total time (not for tour) */}
          {type !== 'tour' && (
            <div>
              <label className="block text-sm font-semibold text-[#c0c8d8] mb-2">Total time</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-[#141929] border border-[#1e2540] rounded-xl px-3 py-2.5">
                  <input type="number" min={0} value={totalMins} onChange={(e) => setTotalMins(parseInt(e.target.value) || 0)}
                    className="w-12 bg-transparent text-white text-xl font-bold text-center focus:outline-none" />
                  <span className="text-[#8892aa] text-sm">min</span>
                </div>
                <div className="flex items-center gap-2 bg-[#141929] border border-[#1e2540] rounded-xl px-3 py-2.5">
                  <input type="number" min={0} max={59} value={totalSecs} onChange={(e) => setTotalSecs(Math.min(59, parseInt(e.target.value) || 0))}
                    className="w-12 bg-transparent text-white text-xl font-bold text-center focus:outline-none" />
                  <span className="text-[#8892aa] text-sm">sec</span>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                {[[2,0],[5,0],[10,0],[15,0],[20,0]].map(([m,s]) => (
                  <button key={m} onClick={() => { setTotalMins(m); setTotalSecs(s); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${totalMins === m && totalSecs === s ? 'bg-blue-700 text-white font-bold' : 'bg-[#141929] text-[#8892aa] hover:text-white'}`}>
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Speaking time + speaker list (moderated only) */}
          {type === 'moderated' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-[#c0c8d8] mb-2">Speaking time per delegate</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#141929] border border-[#1e2540] rounded-xl px-3 py-2.5">
                    <input type="number" min={0} value={speakingTime} onChange={(e) => setSpeakingTime(parseInt(e.target.value) || 0)}
                      className="w-16 bg-transparent text-white text-xl font-bold text-center focus:outline-none" />
                    <span className="text-[#8892aa] text-sm">sec</span>
                  </div>
                  {speakingTime > 0 && totalTime > 0 && (
                    <span className="text-blue-400 text-sm">≈ {maxSpeakers} speakers max</span>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  {[30, 45, 60, 90, 120].map((t) => (
                    <button key={t} onClick={() => setSpeakingTime(t)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${speakingTime === t ? 'bg-blue-700 text-white font-bold' : 'bg-[#141929] text-[#8892aa] hover:text-white'}`}>
                      {t}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic — mandatory */}
              <div>
                <label className="block text-sm font-semibold text-[#c0c8d8] mb-2">
                  Topic <span className="text-red-400">*</span>
                </label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Humanitarian response in conflict zones"
                  className="w-full bg-[#141929] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors" />
              </div>

              {/* Proposer position */}
              {proposer && (
                <div>
                  <label className="block text-sm font-semibold text-[#c0c8d8] mb-2">
                    Does {proposer} want to speak first or last?
                  </label>
                  <div className="flex gap-3">
                    {(['first', 'last'] as const).map((pos) => (
                      <button key={pos} onClick={() => setProposerPosition(pos)}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors capitalize ${proposerPosition === pos ? 'bg-blue-700 text-white' : 'bg-[#141929] border border-[#1e2540] text-[#8892aa] hover:text-white'}`}>
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Speaker list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-[#c0c8d8]">Speaker list</label>
                  <span className={`text-xs font-mono ${spotsLeft <= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {speakerList.length}/{maxSpeakers} — {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : 'Full'}
                  </span>
                </div>
                {speakerList.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {speakerList.map((country, i) => {
                      const found = getCountryByName(country);
                      return (
                        <div key={country} className="flex items-center gap-2 bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2">
                          <span className="text-xs text-[#4a5580] font-mono w-4">{i + 1}</span>
                          <span className="text-base">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                          <span className="text-sm text-white flex-1">{country}</span>
                          <button onClick={() => setSpeakerList((p) => p.filter((_, idx) => idx !== i))}
                            className="text-[#3a4060] hover:text-red-400 text-xs transition-colors">✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {spotsLeft > 0 && (
                  <CountryAutocomplete
                    placeholder="Add speaker..."
                    value={speakerQuery}
                    onChange={setSpeakerQuery}
                    candidates={speakerCandidates}
                    onSelect={addSpeaker}
                  />
                )}
              </div>
            </>
          )}

          {/* Topic optional for unmod */}
          {type === 'unmoderated' && (
            <div>
              <label className="block text-sm font-semibold text-[#c0c8d8] mb-2">Topic <span className="text-[#4a5580] font-normal">(optional)</span></label>
              <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Informal consultations"
                className="w-full bg-[#141929] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors" />
            </div>
          )}

          <button onClick={submit} disabled={!canSubmit()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white py-4 rounded-2xl text-base font-black transition-colors">
            Raise Motion →
          </button>
        </>
      )}
    </div>
  );
}

// ── Voting view ──
function VotingView({
  committee,
  onDone,
}: {
  committee: Committee;
  onDone: () => void;
}) {
  const { enactPendingMotion, removePendingMotion } = useCommitteeStore();
  const sorted = [...(committee.pendingMotions ?? [])].sort((a, b) => b.disruptiveness - a.disruptiveness);
  const [current, setCurrent] = useState(0);
  const [forVotes, setForVotes] = useState('');
  const [againstVotes, setAgainstVotes] = useState('');
  const [abstainVotes, setAbstainVotes] = useState('');

  if (sorted.length === 0) {
    return (
      <div className="px-7 pb-7 text-center">
        <p className="text-[#8892aa] mb-4">No motions to vote on.</p>
        <button onClick={onDone} className="text-sm text-blue-400 hover:text-blue-300">← Back</button>
      </div>
    );
  }

  const motion = sorted[current];
  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const majority = Math.floor(present / 2) + 1;
  const forN = parseInt(forVotes) || 0;
  const againstN = parseInt(againstVotes) || 0;

  const pass = () => {
    enactPendingMotion(committee.id, motion.id);
    onDone();
  };

  const fail = () => {
    removePendingMotion(committee.id, motion.id);
    if (current < sorted.length - 1) {
      setCurrent((c) => c + 1);
      setForVotes(''); setAgainstVotes(''); setAbstainVotes('');
    } else {
      onDone();
    }
  };

  const meta = TYPE_META[motion.type];
  const mins = Math.floor(motion.totalTime / 60);
  const secs = motion.totalTime % 60;

  return (
    <div className="px-7 pb-7 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">Vote on Motions</h2>
        <span className="text-sm text-[#4a5580]">{current + 1} / {sorted.length}</span>
      </div>

      {/* Motion card */}
      <div className="bg-[#141929] border border-[#1e2540] rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <div className="text-lg font-bold text-white">{meta.label}</div>
            <DisruptivenessBadge type={motion.type} />
          </div>
        </div>
        {motion.type !== 'tour' && (
          <div className="text-sm text-[#8892aa]">
            Total: <span className="text-white">{mins > 0 ? `${mins}m ` : ''}{secs > 0 ? `${secs}s` : ''}</span>
            {motion.type === 'moderated' && <> · Speaking: <span className="text-white">{motion.speakingTime}s</span></>}
          </div>
        )}
        {motion.topic && <div className="text-sm text-blue-300">"{motion.topic}"</div>}
        <div className="text-sm text-[#8892aa]">Proposed by <span className="text-white">{motion.proposedBy}</span></div>
        {motion.speakerList.length > 0 && (
          <div className="text-xs text-[#4a5580]">
            {motion.speakerList.length} speaker{motion.speakerList.length !== 1 ? 's' : ''} listed: {motion.speakerList.slice(0, 3).join(', ')}{motion.speakerList.length > 3 ? '...' : ''}
          </div>
        )}
        <div className="text-xs text-[#4a5580]">Needs {majority} votes to pass ({present} present)</div>
      </div>

      {/* Vote inputs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'In Favour', color: 'text-green-400', val: forVotes, set: setForVotes },
          { label: 'Against', color: 'text-red-400', val: againstVotes, set: setAgainstVotes },
          { label: 'Abstain', color: 'text-yellow-400', val: abstainVotes, set: setAbstainVotes },
        ].map(({ label, color, val, set }) => (
          <div key={label}>
            <label className={`block text-xs font-bold mb-1.5 ${color}`}>{label}</label>
            <input type="number" min={0} value={val} onChange={(e) => set(e.target.value)}
              className="w-full bg-[#141929] border border-[#1e2540] rounded-xl px-2 py-3 text-white text-2xl font-black text-center focus:outline-none focus:border-blue-600" />
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={pass} disabled={forN < majority}
          className="flex-1 py-4 rounded-2xl font-black text-base transition-colors bg-green-700 hover:bg-green-600 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white">
          ✓ Motion Passes
        </button>
        <button onClick={fail}
          className="flex-1 py-4 rounded-2xl font-black text-base transition-colors bg-[#1e2540] hover:bg-red-900/40 hover:text-red-400 text-[#8892aa]">
          ✗ Fails → Next
        </button>
      </div>
    </div>
  );
}

// ── Main modal ──
export default function MotionsModal({ committee, onClose }: { committee: Committee; onClose: () => void }) {
  const { removePendingMotion } = useCommitteeStore();
  const [view, setView] = useState<ModalView>('list');
  const pending = [...(committee.pendingMotions ?? [])].sort((a, b) => b.disruptiveness - a.disruptiveness);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0f1526] border border-[#1e2540] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-3 shrink-0">
          <span />
          <button onClick={onClose} className="text-[#4a5580] hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {view === 'raise' && (
            <RaiseMotionForm
              committee={committee}
              onBack={() => setView('list')}
              onRaised={() => setView('list')}
            />
          )}

          {view === 'vote' && (
            <VotingView
              committee={committee}
              onDone={() => { setView('list'); onClose(); }}
            />
          )}

          {view === 'list' && (
            <div className="px-7 pb-7 space-y-4">
              <h2 className="text-3xl font-black text-white">Motions</h2>

              {pending.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-[#8892aa]">No motions raised yet.</p>
                  <p className="text-sm text-[#4a5580] mt-1">The floor is open — invite delegates to raise motions.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#4a5580] font-mono">RANKED BY DISRUPTIVENESS (vote most disruptive first)</p>
                  {pending.map((m, i) => {
                    const meta = TYPE_META[m.type];
                    const mins = Math.floor(m.totalTime / 60);
                    const secs = m.totalTime % 60;
                    return (
                      <div key={m.id} className="flex items-center gap-3 bg-[#141929] border border-[#1e2540] rounded-xl px-4 py-3">
                        <span className="text-xs text-[#4a5580] font-mono w-4">{i + 1}</span>
                        <span className="text-2xl">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white">{meta.label}</div>
                          <div className="text-xs text-[#8892aa] truncate">
                            {m.proposedBy}
                            {m.type !== 'tour' && <> · {mins > 0 ? `${mins}m ` : ''}{secs > 0 ? `${secs}s` : ''}</>}
                            {m.type === 'moderated' && <> · {m.speakingTime}s/speaker</>}
                            {m.topic && <> · "{m.topic}"</>}
                          </div>
                        </div>
                        <DisruptivenessBadge type={m.type} />
                        <button onClick={() => removePendingMotion(committee.id, m.id)}
                          className="text-[#3a4060] hover:text-red-400 text-xs transition-colors ml-1">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setView('raise')}
                  className="flex-1 bg-[#141929] hover:bg-[#1a2240] border border-[#1e2540] hover:border-blue-600/40 text-white py-3.5 rounded-2xl font-bold transition-all">
                  + Raise Motion
                </button>
                {pending.length > 0 && (
                  <button onClick={() => setView('vote')}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl font-black transition-colors">
                    Vote on Motions →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
