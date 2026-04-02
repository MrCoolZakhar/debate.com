'use client';

import { useState, useRef } from 'react';
import { Committee, PendingMotion, PendingMotionType } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';
import { getCountryByName, getFlagEmoji } from '@/lib/countries';

type ModalView = 'list' | 'raise' | 'vote';

const TYPE_META: Record<PendingMotionType, { icon: string; label: string; sub: string }> = {
  consultation: { icon: '🤝', label: 'Consultation of the Whole', sub: 'Informal session, all together' },
  tour:         { icon: '🔄', label: 'Tour de Table',              sub: 'Everyone gets a brief turn' },
  unmoderated:  { icon: '💬', label: 'Unmoderated Caucus',         sub: 'Free time for delegates to talk' },
  moderated:    { icon: '🎙️', label: 'Moderated Caucus',           sub: 'Structured speeches, one by one' },
};

const TYPE_ORDER: PendingMotionType[] = ['consultation', 'tour', 'unmoderated', 'moderated'];

// 2/3 majority for COW and Tour de Table, simple majority for others
function requiredVotes(type: PendingMotionType, present: number): { needed: number; fraction: string } {
  if (type === 'consultation' || type === 'tour') {
    return { needed: Math.ceil((present * 2) / 3), fraction: '2/3 majority' };
  }
  return { needed: Math.floor(present / 2) + 1, fraction: 'Simple majority' };
}

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
    moderated: 'bg-[#7B4A1E]/30 text-[#E8C49A] border-[#7B4A1E]/40',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[type]}`}>{labels[type]}</span>;
}

// ── Proposer autocomplete (clears dropdown after selection) ───────────────────
function ProposerInput({
  candidates,
  value,
  onChange,
}: {
  candidates: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = query.trim()
    ? candidates
        .filter((c) => c.toLowerCase().startsWith(query.toLowerCase()))
        .concat(candidates.filter((c) => !c.toLowerCase().startsWith(query.toLowerCase()) && c.toLowerCase().includes(query.toLowerCase())))
    : [];
  const top = matches[0] ?? null;

  const commit = (country: string) => {
    onChange(country);
    setQuery(country);
    setOpen(false);
  };

  return (
    <div className="relative">
      {value && !open ? (
        <div className="flex items-center gap-3 bg-green-950/30 border border-green-800/30 rounded-xl px-4 py-3">
          <span className="text-lg">{(() => { const f = getCountryByName(value); return f ? getFlagEmoji(f.code) : '🌐'; })()}</span>
          <span className="text-sm text-white flex-1">{value}</span>
          <button onClick={() => { setOpen(true); setQuery(''); onChange(''); inputRef.current?.focus(); }}
            className="text-xs text-[#7A5A38] hover:text-white transition-colors">change</button>
        </div>
      ) : (
        <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-hidden transition-colors">
          <input
            ref={inputRef}
            autoFocus={open}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(''); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && top) { e.preventDefault(); commit(top); }
              if (e.key === 'Escape') { setQuery(''); setOpen(false); }
            }}
            placeholder="Type country name…"
            className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm"
          />
          {top && query && <span className="text-xs text-[#7A5A38] px-3 truncate max-w-[120px]">↵ {top}</span>}
        </div>
      )}
      {open && query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-30 shadow-xl max-h-48 overflow-y-auto">
          {matches.slice(0, 6).map((country, i) => {
            const found = getCountryByName(country);
            return (
              <button key={country} onMouseDown={(e) => { e.preventDefault(); commit(country); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'}`}>
                <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                <span className="text-sm">{country}</span>
                {i === 0 && <span className="ml-auto text-xs text-[#7A5A38]">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Raise Motion Form ─────────────────────────────────────────────────────────
function RaiseMotionForm({ committee, onBack, onRaised }: { committee: Committee; onBack: () => void; onRaised: () => void }) {
  const { addPendingMotion } = useCommitteeStore();
  const [type, setType] = useState<PendingMotionType | null>(null);
  const [proposer, setProposer] = useState('');
  const [totalMins, setTotalMins] = useState(10);
  const [totalSecs, setTotalSecs] = useState(0);
  const [speakingTime, setSpeakingTime] = useState(60);
  const [topic, setTopic] = useState('');

  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  const totalTime = totalMins * 60 + totalSecs;

  const canSubmit = () => {
    if (!type || !proposer) return false;
    if (type === 'moderated' && !topic.trim()) return false;
    if (type !== 'tour' && totalTime <= 0) return false;
    return true;
  };

  const submit = () => {
    if (!type || !canSubmit()) return;
    addPendingMotion(committee.id, {
      type,
      proposedBy: proposer,
      totalTime: type === 'tour' ? 0 : totalTime,
      speakingTime: type === 'moderated' ? speakingTime : 0,
      topic: topic.trim(),
      speakerList: [],
      proposerPosition: null,
    });
    onRaised();
  };

  return (
    <div className="px-7 pb-7 space-y-5 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-[#C4A882] hover:text-white transition-colors">← Back</button>
        <h2 className="text-2xl font-black text-white">Raise a Motion</h2>
      </div>

      {!type ? (
        <div className="grid grid-cols-2 gap-3">
          {TYPE_ORDER.map((t) => {
            const m = TYPE_META[t];
            return (
              <button key={t} onClick={() => setType(t)}
                className="flex flex-col items-start gap-2 bg-[#1A1209] hover:bg-[#2E1E0F] border border-[#2E1E0F] hover:border-[#7B4A1E] rounded-2xl p-5 text-left transition-all group">
                <span className="text-4xl">{m.icon}</span>
                <div>
                  <div className="text-base font-bold text-white leading-tight">{m.label}</div>
                  <div className="text-xs text-[#C4A882] mt-1">{m.sub}</div>
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
            <button onClick={() => setType(null)} className="ml-auto text-xs text-[#7A5A38] hover:text-white">change</button>
          </div>

          {/* Proposed by */}
          <div>
            <label className="block text-sm font-semibold text-[#C4A882] mb-2">Proposed by</label>
            <ProposerInput candidates={presentCountries} value={proposer} onChange={setProposer} />
          </div>

          {/* Tour: simple confirm */}
          {type === 'tour' && (
            <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-2xl p-4">
              <p className="text-white font-semibold">Add all {presentCountries.length} present delegates to the speakers list</p>
              <p className="text-sm text-[#C4A882] mt-1">They will be called in order after the motion passes</p>
            </div>
          )}

          {/* Total time */}
          {type !== 'tour' && (
            <div>
              <label className="block text-sm font-semibold text-[#C4A882] mb-2">Total time</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2.5">
                  <input type="number" min={0} value={totalMins} onChange={(e) => setTotalMins(parseInt(e.target.value) || 0)}
                    className="w-12 bg-transparent text-white text-xl font-bold text-center focus:outline-none" />
                  <span className="text-[#C4A882] text-sm">min</span>
                </div>
                <div className="flex items-center gap-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2.5">
                  <input type="number" min={0} max={59} value={totalSecs} onChange={(e) => setTotalSecs(Math.min(59, parseInt(e.target.value) || 0))}
                    className="w-12 bg-transparent text-white text-xl font-bold text-center focus:outline-none" />
                  <span className="text-[#C4A882] text-sm">sec</span>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                {[2, 5, 10, 15, 20].map((m) => (
                  <button key={m} onClick={() => { setTotalMins(m); setTotalSecs(0); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${totalMins === m && totalSecs === 0 ? 'bg-[#7B4A1E] text-white font-bold' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Speaking time (moderated only) */}
          {type === 'moderated' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-[#C4A882] mb-2">Speaking time per delegate</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2.5">
                    <input type="number" min={0} value={speakingTime} onChange={(e) => setSpeakingTime(parseInt(e.target.value) || 0)}
                      className="w-16 bg-transparent text-white text-xl font-bold text-center focus:outline-none" />
                    <span className="text-[#C4A882] text-sm">sec</span>
                  </div>
                  {speakingTime > 0 && totalTime > 0 && (
                    <span className="text-[#7B4A1E] text-sm">≈ {Math.floor(totalTime / speakingTime)} speakers max</span>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  {[30, 45, 60, 90, 120].map((t) => (
                    <button key={t} onClick={() => setSpeakingTime(t)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${speakingTime === t ? 'bg-[#7B4A1E] text-white font-bold' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                      {t}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic — mandatory */}
              <div>
                <label className="block text-sm font-semibold text-[#C4A882] mb-2">
                  Topic <span className="text-red-500">*</span>
                </label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Humanitarian response in conflict zones"
                  className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors" />
              </div>
            </>
          )}

          {/* Topic optional for unmod */}
          {type === 'unmoderated' && (
            <div>
              <label className="block text-sm font-semibold text-[#C4A882] mb-2">Topic <span className="text-[#7A5A38] font-normal">(optional)</span></label>
              <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Informal consultations"
                className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors" />
            </div>
          )}

          <button onClick={submit} disabled={!canSubmit()}
            className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-4 rounded-2xl text-base font-black transition-colors">
            Raise Motion →
          </button>
        </>
      )}
    </div>
  );
}

// ── Speaker list builder (shown after a moderated caucus motion passes) ────────
function SpeakerListBuilder({
  committee,
  motion,
  onDone,
}: {
  committee: Committee;
  motion: PendingMotion;
  onDone: (list: string[]) => void;
}) {
  const maxSpeakers = motion.speakingTime > 0 ? Math.floor(motion.totalTime / motion.speakingTime) : 0;
  const [speakerList, setSpeakerList] = useState<string[]>([]);
  const [position, setPosition] = useState<'first' | 'last'>('first');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  const candidates = presentCountries.filter((c) => !speakerList.includes(c));
  const matches = query.trim()
    ? candidates.filter((c) => c.toLowerCase().startsWith(query.toLowerCase()))
        .concat(candidates.filter((c) => !c.toLowerCase().startsWith(query.toLowerCase()) && c.toLowerCase().includes(query.toLowerCase())))
    : [];
  const top = matches[0] ?? null;

  const addSpeaker = (country: string) => {
    if (speakerList.length >= maxSpeakers) return;
    setSpeakerList((p) => [...p, country]);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const buildFinal = () => {
    const without = speakerList.filter((c) => c !== motion.proposedBy);
    const base = position === 'first' ? [motion.proposedBy, ...without] : [...without, motion.proposedBy];
    return base.slice(0, maxSpeakers);
  };

  const spotsLeft = maxSpeakers - speakerList.length;

  return (
    <div className="px-7 pb-7 space-y-5 overflow-y-auto">
      <div>
        <h2 className="text-2xl font-black text-white mb-1">Build Speaker List</h2>
        <p className="text-sm text-[#C4A882]">
          {motion.topic} · {motion.speakingTime}s/speaker · up to {maxSpeakers} speakers
        </p>
      </div>

      {/* Proposer position */}
      <div>
        <label className="block text-sm font-semibold text-[#C4A882] mb-2">
          Does <span className="text-white">{motion.proposedBy}</span> speak first or last?
        </label>
        <div className="flex gap-3">
          {(['first', 'last'] as const).map((pos) => (
            <button key={pos} onClick={() => setPosition(pos)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm capitalize transition-colors ${position === pos ? 'bg-[#7B4A1E] text-white' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Speaker list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-[#C4A882]">Speakers</label>
          <span className={`text-xs font-mono ${spotsLeft <= 0 ? 'text-red-400' : 'text-green-400'}`}>
            {speakerList.length}/{maxSpeakers} — {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : 'Full'}
          </span>
        </div>

        {speakerList.length > 0 && (
          <div className="mb-3 space-y-1">
            {speakerList.map((country, i) => {
              const found = getCountryByName(country);
              return (
                <div key={country} className="flex items-center gap-2 bg-[#1A1209] border border-[#2E1E0F] rounded-lg px-3 py-2">
                  <span className="text-xs text-[#7A5A38] font-mono w-4">{i + 1}</span>
                  <span className="text-base">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                  <span className="text-sm text-white flex-1">{country}</span>
                  <button onClick={() => setSpeakerList((p) => p.filter((_, idx) => idx !== i))}
                    className="text-[#7A5A38] hover:text-red-500 text-xs transition-colors">✕</button>
                </div>
              );
            })}
          </div>
        )}

        {spotsLeft > 0 && (
          <div className="relative">
            <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-hidden transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && top) { e.preventDefault(); addSpeaker(top); }
                  if (e.key === 'Escape') { setQuery(''); setOpen(false); }
                }}
                placeholder="Add speaker…"
                className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm"
              />
              {top && query && <span className="text-xs text-[#7A5A38] px-3 truncate max-w-[120px]">↵ {top}</span>}
            </div>
            {open && query && matches.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-30 shadow-xl max-h-44 overflow-y-auto">
                {matches.slice(0, 6).map((country, i) => {
                  const found = getCountryByName(country);
                  return (
                    <button key={country} onMouseDown={(e) => { e.preventDefault(); addSpeaker(country); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'}`}>
                      <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                      <span className="text-sm">{country}</span>
                      {i === 0 && <span className="ml-auto text-xs text-[#7A5A38]">Enter ↵</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <button onClick={() => onDone(buildFinal())}
        className="w-full bg-green-700 hover:bg-green-600 text-white py-4 rounded-2xl text-base font-black transition-colors">
        Start Caucus →
      </button>
    </div>
  );
}

// ── Inline motion editor ──────────────────────────────────────────────────────
function MotionEditor({ committee, motion, onDone }: { committee: Committee; motion: PendingMotion; onDone: () => void }) {
  const { updatePendingMotion } = useCommitteeStore();
  const [totalMins, setTotalMins] = useState(Math.floor(motion.totalTime / 60));
  const [totalSecs, setTotalSecs] = useState(motion.totalTime % 60);
  const [speakingTime, setSpeakingTime] = useState(motion.speakingTime || 60);
  const [topic, setTopic] = useState(motion.topic || '');
  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  const [proposer, setProposer] = useState(motion.proposedBy);

  const save = () => {
    const totalTime = totalMins * 60 + totalSecs;
    updatePendingMotion(committee.id, motion.id, {
      totalTime,
      speakingTime: motion.type === 'moderated' ? speakingTime : motion.speakingTime,
      topic,
      proposedBy: proposer,
    });
    onDone();
  };

  return (
    <div className="mt-3 pt-3 border-t border-[#2E1E0F] space-y-3">
      <p className="text-xs font-semibold text-[#C4A882] font-mono">EDIT MOTION</p>

      {/* Proposer */}
      <div>
        <label className="block text-xs text-[#C4A882] mb-1">Proposed by</label>
        <ProposerInput candidates={presentCountries} value={proposer} onChange={setProposer} />
      </div>

      {/* Total time */}
      {motion.type !== 'tour' && (
        <div>
          <label className="block text-xs text-[#C4A882] mb-1">Total time</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2.5 py-2">
              <input type="number" min={0} value={totalMins} onChange={(e) => setTotalMins(parseInt(e.target.value) || 0)}
                className="w-10 bg-transparent text-white text-sm font-bold text-center focus:outline-none" />
              <span className="text-[#7A5A38] text-xs">min</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2.5 py-2">
              <input type="number" min={0} max={59} value={totalSecs} onChange={(e) => setTotalSecs(Math.min(59, parseInt(e.target.value) || 0))}
                className="w-10 bg-transparent text-white text-sm font-bold text-center focus:outline-none" />
              <span className="text-[#7A5A38] text-xs">sec</span>
            </div>
          </div>
        </div>
      )}

      {/* Speaking time */}
      {motion.type === 'moderated' && (
        <div>
          <label className="block text-xs text-[#C4A882] mb-1">Speaking time / delegate</label>
          <div className="flex items-center gap-1.5 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2.5 py-2 w-fit">
            <input type="number" min={0} value={speakingTime} onChange={(e) => setSpeakingTime(parseInt(e.target.value) || 0)}
              className="w-12 bg-transparent text-white text-sm font-bold text-center focus:outline-none" />
            <span className="text-[#7A5A38] text-xs">sec</span>
          </div>
        </div>
      )}

      {/* Topic */}
      {(motion.type === 'moderated' || motion.type === 'unmoderated') && (
        <div>
          <label className="block text-xs text-[#C4A882] mb-1">
            Topic {motion.type === 'moderated' && <span className="text-red-500">*</span>}
          </label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E]" />
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={save} className="flex-1 bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-2 rounded-lg font-bold text-sm transition-colors">
          Save
        </button>
        <button onClick={onDone} className="px-4 py-2 bg-[#2E1E0F] hover:bg-[#3D2A15] border border-[#2E1E0F] text-[#C4A882] rounded-lg text-sm transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Voting view — all motions at once ──────────────────────────────────────────
function VotingView({
  committee,
  onAccepted,
  onAllDone,
}: {
  committee: Committee;
  onAccepted: (motion: PendingMotion) => void;
  onAllDone: () => void;
}) {
  const { removePendingMotion } = useCommitteeStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const sorted = [...(committee.pendingMotions ?? [])].sort((a, b) => b.disruptiveness - a.disruptiveness);
  const present = committee.delegates.filter((d) => d.status !== 'absent').length;

  if (sorted.length === 0) {
    return (
      <div className="px-7 pb-7 text-center py-8">
        <p className="text-[#C4A882]">No motions to vote on.</p>
        <button onClick={onAllDone} className="mt-4 text-sm text-[#B8844A] hover:text-[#E8C49A]">← Back</button>
      </div>
    );
  }

  const primary = sorted[0];
  const rest = sorted.slice(1, 4);

  const renderMotionCard = (m: typeof sorted[0], large: boolean) => {
    const meta = TYPE_META[m.type];
    const { needed, fraction } = requiredVotes(m.type, present);
    const mins = Math.floor(m.totalTime / 60);
    const secs = m.totalTime % 60;
    const isEditing = editingId === m.id;
    return (
      <div key={m.id} className={`bg-[#1A1209] border border-[#2E1E0F] rounded-2xl flex flex-col ${large ? 'p-6 space-y-4 flex-1 min-w-0' : 'p-4 space-y-3'}`}>
        <div className="flex items-start gap-3">
          <span className={large ? 'text-5xl' : 'text-2xl'}>{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`font-black text-white ${large ? 'text-xl' : 'text-sm'}`}>{meta.label}</span>
              <DisruptivenessBadge type={m.type} />
            </div>
            {(() => { const f = getCountryByName(m.proposedBy); return (
              <div className="flex items-center gap-2 mt-1">
                <span className={large ? 'text-xl' : 'text-base'}>{f ? getFlagEmoji(f.code) : '🌐'}</span>
                <span className={`font-semibold text-white ${large ? 'text-base' : 'text-xs'}`}>{m.proposedBy}</span>
              </div>
            ); })()}
            {large && m.topic && (
              <div className="mt-2 px-3 py-1.5 bg-[#150F09] border border-[#2E1E0F] rounded-lg">
                <span className="text-xs font-mono text-[#7A5A38] uppercase tracking-wide">Topic</span>
                <p className="text-sm font-semibold text-white mt-0.5">"{m.topic}"</p>
              </div>
            )}
            {!large && m.topic && (
              <p className="text-xs text-[#C4A882] mt-1 truncate">"{m.topic}"</p>
            )}
            {large && m.type !== 'tour' && (
              <div className="flex items-center gap-3 mt-2">
                <div className="px-3 py-1 bg-[#150F09] border border-[#2E1E0F] rounded-lg text-sm font-bold text-[#7B4A1E]">
                  {mins > 0 ? `${mins}m` : ''}{secs > 0 ? ` ${secs}s` : ''} total
                </div>
                {m.type === 'moderated' && (
                  <div className="px-3 py-1 bg-[#150F09] border border-[#2E1E0F] rounded-lg text-sm font-bold text-[#3D6B35]">
                    {m.speakingTime}s / speaker
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setEditingId(isEditing ? null : m.id)}
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${isEditing ? 'bg-[#7B4A1E]/20 text-[#7B4A1E]' : 'text-[#7A5A38] hover:text-white hover:bg-[#2E1E0F]'}`}
            title="Edit motion"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>

        {isEditing && (
          <MotionEditor committee={committee} motion={m} onDone={() => setEditingId(null)} />
        )}

        {!isEditing && (
          <>
            <div className="flex items-center gap-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2">
              <span className="text-xs text-[#7A5A38]">{fraction}</span>
              <span className="text-xs text-white font-bold ml-auto">Needs {needed} of {present}</span>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => onAccepted(m)}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm transition-colors"
              >
                ✓ Accept
              </button>
              <button
                onClick={() => removePendingMotion(committee.id, m.id)}
                className="flex-1 bg-[#2E1E0F] hover:bg-red-950/40 hover:text-red-500 text-[#C4A882] border border-[#2E1E0F] hover:border-red-800/40 py-2.5 rounded-xl font-bold text-sm transition-colors"
              >
                ✗ Reject
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="px-7 pb-7 space-y-4 min-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-black text-white">Vote on Motions</h2>
        <span className="text-xs text-[#7A5A38] font-mono">MOST DISRUPTIVE FIRST</span>
      </div>

      {sorted.length === 1 ? (
        <div className="flex-1 flex flex-col">
          {renderMotionCard(primary, true)}
        </div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          {renderMotionCard(primary, true)}
          <div className="w-72 flex flex-col gap-3">
            {rest.map((m) => renderMotionCard(m, false))}
          </div>
        </div>
      )}

      <button onClick={onAllDone} className="w-full text-sm text-[#7A5A38] hover:text-white transition-colors py-2 shrink-0">
        Close floor (no motion passes)
      </button>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function MotionsModal({ committee, onClose }: { committee: Committee; onClose: () => void }) {
  const { removePendingMotion, enactPendingMotion } = useCommitteeStore();
  const [view, setView] = useState<ModalView>('list');

  const pending = [...(committee.pendingMotions ?? [])].sort((a, b) => b.disruptiveness - a.disruptiveness);

  const handleMotionAccepted = (motion: PendingMotion) => {
    // All motion types enact immediately; moderated caucus handles proposer position on the caucus page
    enactPendingMotion(committee.id, motion.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-[#1A1209] border border-[#2E1E0F] rounded-3xl w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col ${view === 'vote' ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {/* Header */}
        <div className="flex items-center justify-end px-7 pt-6 pb-0 shrink-0">
          <button onClick={onClose} className="text-[#7A5A38] hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 pt-2">
          {view === 'raise' && (
            <RaiseMotionForm committee={committee} onBack={() => setView('list')} onRaised={() => setView('list')} />
          )}

          {view === 'vote' && (
            <VotingView
              committee={committee}
              onAccepted={handleMotionAccepted}
              onAllDone={() => { setView('list'); onClose(); }}
            />
          )}

          {view === 'list' && (
            <div className="px-7 pb-7 space-y-4">
              <h2 className="text-3xl font-black text-white">Motions</h2>

              {pending.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-[#C4A882]">No motions raised yet.</p>
                  <p className="text-sm text-[#7A5A38] mt-1">The floor is open — invite delegates to raise motions.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#7A5A38] font-mono">RANKED — MOST DISRUPTIVE FIRST</p>
                  {pending.map((m, i) => {
                    const meta = TYPE_META[m.type];
                    const mins = Math.floor(m.totalTime / 60);
                    const secs = m.totalTime % 60;
                    const proposerFlag = getCountryByName(m.proposedBy);
                    return (
                      <div key={m.id} className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl px-4 py-4">
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-[#7A5A38] font-mono w-4 mt-1">{i + 1}</span>
                          <span className="text-2xl">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-black text-white">{meta.label}</span>
                              <DisruptivenessBadge type={m.type} />
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-base">{proposerFlag ? getFlagEmoji(proposerFlag.code) : '🌐'}</span>
                              <span className="text-sm font-semibold text-white">{m.proposedBy}</span>
                            </div>
                            {m.topic && (
                              <p className="text-sm text-[#C4A882] mt-1 font-medium">"{m.topic}"</p>
                            )}
                            {m.type !== 'tour' && (
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-xs font-bold text-[#7B4A1E] bg-[#150F09] border border-[#2E1E0F] px-2 py-0.5 rounded-md">
                                  {mins > 0 ? `${mins}m` : ''}{secs > 0 ? ` ${secs}s` : ''} total
                                </span>
                                {m.type === 'moderated' && (
                                  <span className="text-xs font-bold text-[#3D6B35] bg-[#150F09] border border-[#2E1E0F] px-2 py-0.5 rounded-md">
                                    {m.speakingTime}s/speaker
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <button onClick={() => removePendingMotion(committee.id, m.id)}
                            className="text-[#7A5A38] hover:text-red-500 text-sm transition-colors mt-0.5">✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setView('raise')}
                  className="flex-1 bg-[#1A1209] hover:bg-[#2E1E0F] border border-[#2E1E0F] hover:border-[#7B4A1E] text-white py-3.5 rounded-2xl font-bold transition-all">
                  + Raise Motion
                </button>
                {pending.length > 0 && (
                  <button onClick={() => setView('vote')}
                    className="flex-1 bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-3.5 rounded-2xl font-black transition-colors">
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
