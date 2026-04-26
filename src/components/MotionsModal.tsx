'use client';

import { useState, useRef, useEffect } from 'react';
import { Committee, PendingMotion, PendingMotionType } from '@/lib/types';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import { useSettingsStore, DEFAULT_MOTION_NAMES, MotionNames } from '@/lib/settingsStore';
import {
  addPendingMotion as addPendingMotionInDB,
  removePendingMotion as removePendingMotionInDB,
  clearPendingMotions as clearPendingMotionsInDB,
  setPhase as setPhaseInDB,
  updateCaucus as updateCaucusInDB,
  addToCaucusList as addToCaucusListInDB,
  batchAddToCaucusList as batchAddToCaucusListInDB,
  clearCaucusList as clearCaucusListInDB,
  suspendDebate as suspendDebateInDB,
  endDebate as endDebateInDB,
} from '@/lib/committeeService';

type ModalView = 'list' | 'raise' | 'vote';
type TypeMeta = Record<PendingMotionType, { icon: string; label: string; sub: string }>;

const TYPE_STATIC: Record<PendingMotionType, { icon: string; sub: string }> = {
  'end-debate':     { icon: '🏁', sub: 'Formally close the session' },
  'suspend-debate': { icon: '⏸️', sub: 'Suspend the session temporarily' },
  consultation:     { icon: '🤝', sub: 'Informal session, all together' },
  tour:             { icon: '🔄', sub: 'Everyone speaks once, alphabetical order' },
  unmoderated:      { icon: '💬', sub: 'Free time for delegates to talk' },
  moderated:        { icon: '🎙️', sub: 'Structured speeches, blank slate to fill' },
};

function buildTypeMeta(motionNames: MotionNames): TypeMeta {
  return {
    'end-debate':     { ...TYPE_STATIC['end-debate'],     label: motionNames.endDebate },
    'suspend-debate': { ...TYPE_STATIC['suspend-debate'], label: motionNames.suspendDebate },
    consultation:     { ...TYPE_STATIC.consultation,      label: motionNames.consultation },
    tour:             { ...TYPE_STATIC.tour,              label: motionNames.tour },
    unmoderated:      { ...TYPE_STATIC.unmoderated,       label: motionNames.unmoderated },
    moderated:        { ...TYPE_STATIC.moderated,         label: motionNames.moderated },
  };
}

// Regular motion types (moderated first per design spec)
const TYPE_ORDER: PendingMotionType[] = ['moderated', 'unmoderated', 'tour', 'consultation'];

function requiredVotes(type: PendingMotionType, present: number): { needed: number; fraction: string } {
  if (type === 'consultation' || type === 'tour') return { needed: Math.ceil((present * 2) / 3), fraction: '2/3 majority' };
  return { needed: Math.floor(present / 2) + 1, fraction: 'Simple majority' };
}

function DisruptivenessBadge({ type }: { type: PendingMotionType }) {
  const labels: Record<PendingMotionType, string> = {
    'end-debate': 'Ends session', 'suspend-debate': 'Suspends session',
    consultation: 'Most disruptive', tour: 'Very disruptive',
    unmoderated: 'Disruptive', moderated: 'Least disruptive',
  };
  const colors: Record<PendingMotionType, string> = {
    'end-debate': 'bg-red-900/40 text-red-400 border-red-800/40',
    'suspend-debate': 'bg-orange-900/40 text-orange-400 border-orange-800/40',
    consultation: 'bg-red-900/40 text-red-400 border-red-800/40',
    tour: 'bg-orange-900/40 text-orange-400 border-orange-800/40',
    unmoderated: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/40',
    moderated: 'bg-[#7B4A1E]/30 text-[#E8C49A] border-[#7B4A1E]/40',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[type]}`}>{labels[type]}</span>;
}

const COUNTRY_ACRONYMS: Record<string, string> = {
  'uk':   'United Kingdom',
  'us':   'United States',
  'usa':  'United States',
  'uae':  'United Arab Emirates',
  'drc':  'DR Congo',
  'roc':  'Taiwan',
  'rok':  'South Korea',
  'dprk': 'North Korea',
  'car':  'Central African Republic',
  'png':  'Papua New Guinea',
};

function ProposerInput({ candidates, value, onChange, blockedCountries }: {
  candidates: string[]; value: string; onChange: (v: string) => void; blockedCountries?: Set<string>;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resolved = COUNTRY_ACRONYMS[query.trim().toLowerCase()] ?? query.trim();
  const matches = resolved
    ? candidates.filter((c) => c.toLowerCase().startsWith(resolved.toLowerCase()))
        .concat(candidates.filter((c) => !c.toLowerCase().startsWith(resolved.toLowerCase()) && c.toLowerCase().includes(resolved.toLowerCase())))
    : [];
  const top = matches[0] ?? null;
  const commit = (country: string) => {
    if (blockedCountries?.has(country)) return;
    onChange(country); setQuery(country); setOpen(false);
  };
  return (
    <div className="relative">
      {value && !open ? (
        <div className="flex items-center gap-3 bg-green-950/30 border border-green-800/30 rounded-xl px-4 py-3">
          {(() => { const f = getCountryByName(value); return f ? <img src={getFlagUrl(f.code)} alt={f.code} className="w-5 h-5 object-contain inline-block" /> : <span className="text-lg">🌐</span>; })()}
          <span className="text-sm text-white flex-1">{value}</span>
          <button onClick={() => { setOpen(true); setQuery(''); onChange(''); inputRef.current?.focus(); }} className="text-xs text-[#7A5A38] hover:text-white transition-colors">change</button>
        </div>
      ) : (
        <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-hidden transition-colors">
          <input ref={inputRef} autoFocus={open} type="text" value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && top) { e.preventDefault(); commit(top); } if (e.key === 'Escape') { setQuery(''); setOpen(false); } }}
            placeholder="Type country name…"
            className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm" />
          {top && query && <span className="text-xs text-[#7A5A38] px-3 truncate max-w-[120px]">↵ {top}</span>}
        </div>
      )}
      {open && query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-30 shadow-xl max-h-48 overflow-y-auto">
          {matches.slice(0, 6).map((country, i) => {
            const found = getCountryByName(country);
            const isBlocked = blockedCountries?.has(country) ?? false;
            return (
              <button key={country}
                onMouseDown={(e) => { e.preventDefault(); if (!isBlocked) commit(country); }}
                disabled={isBlocked}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isBlocked ? 'opacity-50 cursor-not-allowed bg-[#150F09]' :
                  i === 0 ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'
                }`}>
                {found ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" /> : <span className="text-lg">🌐</span>}
                <span className="text-sm flex-1">{country}</span>
                {isBlocked
                  ? <span className="text-xs text-orange-400 shrink-0 font-semibold">Motion on floor</span>
                  : i === 0 && <span className="ml-auto text-xs text-[#7A5A38]">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Raise Motion Form ─────────────────────────────────────────────────────────
function RaiseMotionForm({ committee, typeMeta, onBack, onRaised, editingMotion }: {
  committee: Committee;
  typeMeta: TypeMeta;
  onBack: () => void;
  onRaised: (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => void;
  editingMotion?: PendingMotion | null;
}) {
  const [type, setType] = useState<PendingMotionType | null>(editingMotion?.type ?? 'moderated');
  const [proposer, setProposer] = useState(editingMotion?.proposedBy ?? '');
  const [totalMinsStr, setTotalMinsStr] = useState(editingMotion ? String(Math.floor(editingMotion.totalTime / 60)) : '10');
  const [totalSecsStr, setTotalSecsStr] = useState(editingMotion ? String(editingMotion.totalTime % 60) : '0');
  const [speakingTimeStr, setSpeakingTimeStr] = useState(editingMotion ? String(editingMotion.speakingTime) : '60');
  const [topic, setTopic] = useState(editingMotion?.topic ?? '');
  const [tourOrder, setTourOrder] = useState<'asc' | 'desc' | 'custom'>(editingMotion?.tourOrder ?? 'asc');
  const [error, setError] = useState('');

  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  const countriesWithMotions = new Set(
    (committee.pendingMotions ?? [])
      .filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request')
      .map((m) => m.proposedBy)
  );

  const totalMins = parseInt(totalMinsStr, 10) || 0;
  const totalSecs = Math.min(59, parseInt(totalSecsStr, 10) || 0);
  const speakingTime = parseInt(speakingTimeStr, 10) || 0;
  const totalTime = totalMins * 60 + totalSecs;

  const speakerCount = (totalTime > 0 && speakingTime > 0) ? Math.floor(totalTime / speakingTime) : null;
  const unusedSecs = (totalTime > 0 && speakingTime > 0) ? totalTime % speakingTime : 0;

  const numClass = 'bg-transparent text-white text-xl font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
  const numClassSm = 'bg-transparent text-white text-lg font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  const canSubmit = () => {
    if (!type || !proposer) return false;
    if (type === 'moderated' && !topic.trim()) return false;
    return true;
  };

  const submit = () => {
    if (!type || !canSubmit()) return;
    setError('');
    const isSuspendOrEnd = type === 'suspend-debate' || type === 'end-debate';
    if (!isSuspendOrEnd) {
      if ((type === 'moderated' || type === 'unmoderated') && totalTime === 0) {
        setError('Total caucus time cannot be zero.');
        return;
      }
      if (type === 'moderated' && speakingTime === 0) {
        setError('Speaking time per delegate cannot be zero.');
        return;
      }
    }
    const motion: Omit<PendingMotion, 'id' | 'disruptiveness'> = {
      type,
      proposedBy: proposer,
      totalTime: isSuspendOrEnd ? 0 : (type === 'tour' ? presentCountries.length * speakingTime : totalTime),
      speakingTime: isSuspendOrEnd ? 0 : speakingTime,
      topic: topic.trim(),
      speakerList: [],
      proposerPosition: null,
      ...(type === 'tour' ? { tourOrder } : {}),
    };
    onRaised(motion);
  };

  return (
    <div className="flex flex-col h-full">
      {/* PERMANENT NOTE: No scroll in raise motion form. If content doesn't fit, reduce spacing
          or lay fields side-by-side — never re-add overflow-y-auto here. */}
      <div className="flex-1 px-7 pt-0 pb-4 space-y-4">
        <h2 className="text-3xl font-black text-white">{editingMotion ? 'Edit Motion' : 'Raise a Motion'}</h2>

        {/* Type tabs — always shown */}
        <div className="flex gap-1.5 flex-wrap items-stretch">
          <div className="flex gap-1.5 flex-1 flex-wrap">
            {TYPE_ORDER.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`px-3 py-2 rounded-xl border font-bold text-base transition-all flex-1 min-w-[120px] ${
                  type === t ? 'bg-[#7B4A1E] border-[#8B5A2B] text-white' : 'bg-[#1A1209] border-[#2E1E0F] text-[#C4A882] hover:border-[#7B4A1E]'
                }`}>
                {typeMeta[t].label}
              </button>
            ))}
          </div>
          {/* Special debate control buttons — half size, red, stacked */}
          <div className="flex flex-col gap-1 self-stretch">
            <button type="button" onClick={() => setType('suspend-debate')}
              className={`px-2 flex-1 rounded-lg border text-xs font-bold transition-colors ${type === 'suspend-debate' ? 'bg-red-800 border-red-700 text-white' : 'border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-900/40'}`}>
              Suspend
            </button>
            <button type="button" onClick={() => setType('end-debate')}
              className={`px-2 flex-1 rounded-lg border text-xs font-bold transition-colors ${type === 'end-debate' ? 'bg-red-800 border-red-700 text-white' : 'border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-900/40'}`}>
              End Debate
            </button>
          </div>
        </div>

        {type && (
          <>
            {/* For moderated caucus: Topic first, then Proposed By */}
            {type !== 'moderated' && (
              <div>
                <label className="block text-lg font-semibold text-[#C4A882] mb-2">Proposed by</label>
                <ProposerInput candidates={presentCountries} value={proposer} onChange={setProposer} blockedCountries={countriesWithMotions} />
              </div>
            )}

            {/* Tour de Table — speaking time per delegate + order */}
            {type === 'tour' && (
              <>
                <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-2xl p-4 space-y-3">
                  <p className="text-white font-semibold text-sm">
                    All {presentCountries.length} present delegates will speak once each.
                  </p>
                  <div>
                    <label className="block text-lg font-semibold text-[#C4A882] mb-2">Speaking time per delegate</label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2">
                        <input type="number" min={10} value={speakingTimeStr}
                          onChange={(e) => setSpeakingTimeStr(e.target.value)}
                          className={`w-14 ${numClass}`} />
                        <span className="text-[#C4A882] text-sm">sec</span>
                      </div>
                      <span className="text-xs text-[#7A5A38]">
                        Total ≈ {speakingTime > 0 ? Math.ceil((presentCountries.length * speakingTime) / 60) : 0}m
                      </span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[30, 45, 60, 90, 120].map((t) => (
                        <button key={t} onClick={() => setSpeakingTimeStr(String(t))}
                          className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${speakingTime === t ? 'bg-[#7B4A1E] text-white font-bold' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                          {t}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-lg font-semibold text-[#C4A882] mb-2">Speaking order</label>
                    <div className="flex gap-3">
                      <button onClick={() => setTourOrder('asc')}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${tourOrder === 'asc' ? 'bg-[#7B4A1E] text-white' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                        A → Z
                      </button>
                      <button onClick={() => setTourOrder('desc')}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${tourOrder === 'desc' ? 'bg-[#7B4A1E] text-white' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                        Z → A
                      </button>
                      <button onClick={() => setTourOrder('custom')}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${tourOrder === 'custom' ? 'bg-[#7B4A1E] text-white' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                        Room Order
                      </button>
                    </div>
                    {tourOrder === 'custom' && (
                      <p className="text-xs text-[#7A5A38] mt-2 leading-relaxed">Follows the physical room order. Call each speaker manually — the chair decides who goes next based on seating.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Unmoderated / Consultation — total time */}
            {(type === 'unmoderated' || type === 'consultation') && (
              <div>
                <label className="block text-lg font-semibold text-[#C4A882] mb-2">Total time</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2.5">
                    <input type="number" min={0} value={totalMinsStr}
                      onChange={(e) => setTotalMinsStr(e.target.value)}
                      className={`w-12 ${numClass}`} />
                    <span className="text-[#C4A882] text-sm">min</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2.5">
                    <input type="number" min={0} max={59} value={totalSecsStr}
                      onChange={(e) => setTotalSecsStr(e.target.value)}
                      className={`w-12 ${numClass}`} />
                    <span className="text-[#C4A882] text-sm">sec</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {[2, 5, 10, 15, 20].map((m) => (
                    <button key={m} onClick={() => { setTotalMinsStr(String(m)); setTotalSecsStr('0'); }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${totalMins === m && totalSecs === 0 ? 'bg-[#7B4A1E] text-white font-bold' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Moderated caucus — Topic first, then Proposed By */}
            {type === 'moderated' && (
              <>
                <div>
                  <label className="block text-lg font-semibold text-[#C4A882] mb-2">Topic <span className="text-red-500">*</span></label>
                  <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Humanitarian response in conflict zones"
                    className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-4 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors" />
                </div>
                <div>
                  <label className="block text-lg font-semibold text-[#C4A882] mb-2">Proposed by</label>
                  <ProposerInput candidates={presentCountries} value={proposer} onChange={setProposer} blockedCountries={countriesWithMotions} />
                </div>
                {/* Total time + speaking time — side by side to avoid scroll */}
                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-[#C4A882] mb-2">Total time</label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2">
                        <input type="number" min={0} value={totalMinsStr}
                          onChange={(e) => setTotalMinsStr(e.target.value)}
                          className={`w-10 ${numClassSm}`} />
                        <span className="text-[#C4A882] text-xs">min</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2">
                        <input type="number" min={0} max={59} value={totalSecsStr}
                          onChange={(e) => setTotalSecsStr(e.target.value)}
                          className={`w-10 ${numClassSm}`} />
                        <span className="text-[#C4A882] text-xs">sec</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {[2, 5, 10, 15, 20].map((m) => (
                        <button key={m} onClick={() => { setTotalMinsStr(String(m)); setTotalSecsStr('0'); }}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${totalMins === m && totalSecs === 0 ? 'bg-[#7B4A1E] text-white font-bold' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-[#C4A882] mb-2">Per delegate</label>
                    <div className="flex items-center gap-1.5 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2 w-fit">
                      <input type="number" min={0} value={speakingTimeStr}
                        onChange={(e) => setSpeakingTimeStr(e.target.value)}
                        className={`w-12 ${numClassSm}`} />
                      <span className="text-[#C4A882] text-xs">sec</span>
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {[30, 45, 60, 90, 120].map((t) => (
                        <button key={t} onClick={() => setSpeakingTimeStr(String(t))}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${speakingTime === t ? 'bg-[#7B4A1E] text-white font-bold' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                          {t}s
                        </button>
                      ))}
                    </div>
                    {speakerCount !== null && (
                      <div className="mt-3 rounded-xl bg-white/10 border border-white/20 px-4 py-3">
                        <p className="text-white font-black text-2xl leading-tight">
                          {speakerCount} <span className="text-base font-semibold text-[#C4A882]">delegates can speak</span>
                        </p>
                        {unusedSecs > 0 && (
                          <p className="text-amber-400 text-sm font-semibold mt-1">
                            ⚠ {unusedSecs}s of caucus time will be unused
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {type && (
        <div className="px-7 pb-7 pt-3 border-t border-white/10 shrink-0">
          {error && <p className="text-red-400 text-sm font-medium mb-3">{error}</p>}
          <button onClick={submit} disabled={!canSubmit()}
            className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-5 rounded-2xl text-base font-black transition-colors">
            Raise Motion →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Voting View ───────────────────────────────────────────────────────────────
function VotingView({ committee, typeMeta, onAccepted, onAllDone, onRemove, onBack, onEdit, pendingIds }: {
  committee: Committee;
  typeMeta: TypeMeta;
  onAccepted: (motion: PendingMotion) => void;
  onAllDone: () => void;
  onRemove: (motionId: string) => void;
  onBack: () => void;
  onEdit: (motionId: string) => void;
  pendingIds: Set<string>;
}) {
  // Filter out join-request pseudo-motions — those are handled in the chair banner, not here
  const initialSorted = [...(committee.pendingMotions ?? [])]
    .filter((m) => m.type !== ('join-request' as string))
    .sort((a, b) => {
      if (b.disruptiveness !== a.disruptiveness) return b.disruptiveness - a.disruptiveness;
      const aIdx = (committee.pendingMotions ?? []).findIndex((m) => m.id === a.id);
      const bIdx = (committee.pendingMotions ?? []).findIndex((m) => m.id === b.id);
      return aIdx - bIdx;
    });

  const [order, setOrder] = useState<PendingMotion[]>(initialSorted);
  const dragIndexRef = useRef<number | null>(null);

  // Keep order in sync when motions are removed externally
  const motionIdKey = (committee.pendingMotions ?? []).map((m) => m.id).join(',');
  useEffect(() => {
    const current = (committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string));
    setOrder((prev) => {
      // Match by proposer+type so temp ID → real UUID swaps don't create duplicates
      const currentMap = new Map(current.map((m) => [`${m.proposedBy}|${m.type}`, m]));
      const merged = prev
        .map((p) => currentMap.get(`${p.proposedBy}|${p.type}`) ?? null)
        .filter((m): m is PendingMotion => m !== null);
      const mergedKeys = new Set(merged.map((m) => `${m.proposedBy}|${m.type}`));
      const newOnes = current
        .filter((m) => !mergedKeys.has(`${m.proposedBy}|${m.type}`))
        .sort((a, b) => b.disruptiveness - a.disruptiveness);
      return [...merged, ...newOnes].sort((a, b) => b.disruptiveness - a.disruptiveness);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionIdKey]);

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;

  if (order.length === 0) {
    return (
      <div className="px-7 pb-7 text-center py-8">
        <p className="text-[#C4A882]">No motions to vote on.</p>
        <button onClick={onAllDone} className="mt-4 text-sm text-[#B8844A] hover:text-[#E8C49A]">← Back</button>
      </div>
    );
  }

  const primary = order[0];
  const rest = order.slice(1, 4);

  const renderCard = (m: PendingMotion, large: boolean, idx: number) => {
    const meta = typeMeta[m.type];
    const { needed, fraction } = requiredVotes(m.type, present);
    const totalMins = Math.floor(m.totalTime / 60);
    const totalSecs = m.totalTime % 60;
    const speakMins = Math.floor(m.speakingTime / 60);
    const speakSecs = m.speakingTime % 60;
    const fmtTime = (mins: number, secs: number) =>
      mins > 0 ? (secs > 0 ? `${mins}m ${secs}s` : `${mins}m`) : `${secs}s`;
    const isPrimary = idx === 0;
    const f = getCountryByName(m.proposedBy);

    return (
      <div
        key={m.id}
        draggable
        onDragStart={() => { dragIndexRef.current = idx; }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          const from = dragIndexRef.current;
          if (from === null || from === idx) return;
          const newOrder = [...order];
          const [moved] = newOrder.splice(from, 1);
          newOrder.splice(idx, 0, moved);
          setOrder(newOrder);
          dragIndexRef.current = null;
        }}
        onDragEnd={() => { dragIndexRef.current = null; }}
        className={`bg-[#1A1209] rounded-2xl flex flex-col cursor-grab ${
          large
            ? `p-6 space-y-3 flex-1 min-w-0 border-2 ${isPrimary ? 'border-[#7B4A1E]' : 'border-[#2E1E0F]'}`
            : 'p-4 space-y-2 border border-[#2E1E0F]'
        }`}
      >
        {/* Header: icon + type label + modify button + flag in top-right */}
        <div className="flex items-center gap-2">
          <span className={large ? 'text-4xl' : 'text-2xl'}>{meta.icon}</span>
          <span className={`font-black text-white flex-1 ${large ? 'text-3xl' : 'text-lg'}`}>{meta.label}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(m.id); }}
            title="Edit this motion"
            className="p-1.5 rounded-lg bg-[#2E1E0F] hover:bg-[#3D2A15] border border-[#2E1E0F] hover:border-[#7B4A1E] text-[#7A5A38] hover:text-[#C4A882] transition-colors text-xs shrink-0"
          >
            ⚙
          </button>
          {f ? <img src={getFlagUrl(f.code)} alt={f.code} className={large ? 'w-10 h-10 object-contain inline-block' : 'w-6 h-6 object-contain inline-block'} /> : <span className={large ? 'text-4xl' : 'text-2xl'}>🌐</span>}
        </div>

        {/* Topic inline */}
        {m.topic && (
          <p className={`${large ? 'text-2xl' : 'text-base'} text-[#C4A882]`}>
            <span className="text-[#7A5A38] font-semibold">Topic: </span>{m.topic}
          </p>
        )}

        {/* Timings — emphasised */}
        {m.type !== 'tour' && m.totalTime > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-black ${large ? 'text-base text-white' : 'text-xs text-[#C4A882]'}`}>
              {fmtTime(totalMins, totalSecs)}
              {m.type === 'moderated' && m.speakingTime > 0 && (
                <span className="text-[#7B4A1E]"> — {fmtTime(speakMins, speakSecs)}</span>
              )}
              {m.type === 'moderated' && m.speakingTime > 0 && m.totalTime > 0 && (
                <span className="text-[#7A5A38]"> · {Math.floor(m.totalTime / m.speakingTime)} speakers{m.totalTime % m.speakingTime !== 0 ? ' ⚠' : ''}</span>
              )}
            </span>
          </div>
        )}
        {m.type === 'tour' && (
          <div className="flex items-center gap-2">
            <span className={`font-black ${large ? 'text-base text-white' : 'text-xs text-[#C4A882]'}`}>
              {fmtTime(0, m.speakingTime)} / delegate
            </span>
            <span className={`${large ? 'text-sm' : 'text-xs'} text-[#7A5A38]`}>
              {m.tourOrder === 'desc' ? 'Z→A' : m.tourOrder === 'custom' ? 'Custom' : 'A→Z'}
            </span>
          </div>
        )}

        {/* Required votes */}
        <div className="flex items-center gap-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-1.5">
          <span className="text-xs text-[#7A5A38]">{fraction}</span>
          <span className="text-xs text-white font-bold ml-auto">Needs {needed} of {present}</span>
        </div>

        {/* Accept/Reject — ONLY on the primary (idx===0) card being voted upon */}
        {isPrimary && (
          <div className="flex gap-2 mt-auto">
            <button onClick={() => onAccepted(m)}
              className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm transition-colors">
              ✓ Accept
            </button>
            <button onClick={() => onRemove(m.id)}
              disabled={pendingIds.has(m.id)}
              className={`flex-1 bg-[#2E1E0F] hover:bg-red-950/40 hover:text-red-500 text-[#C4A882] border border-[#2E1E0F] hover:border-red-800/40 py-2.5 rounded-xl font-bold text-sm transition-colors ${pendingIds.has(m.id) ? 'opacity-40 cursor-not-allowed' : ''}`}>
              ✗ Reject
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-7 pb-7 space-y-3 flex flex-col h-full overflow-hidden">
      <div className="flex items-center shrink-0">
        <h2 className="text-2xl font-black text-white">Vote on Motions</h2>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl text-xs text-[#7A5A38] shrink-0">
        <span>💡</span>
        <span>Drag motions to reorder them. Most disruptive is voted on first by default.</span>
      </div>
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left column — primary motion being voted on */}
        <div className="flex-1 flex flex-col min-w-0">
          {renderCard(primary, true, 0)}
        </div>
        {/* Right column — queued motions + Raise a Motion button */}
        <div className="w-72 flex flex-col gap-3 overflow-y-auto">
          {rest.map((m, i) => renderCard(m, false, i + 1))}
          <button
            onClick={onBack}
            className="w-full bg-[#3D6B35] hover:bg-[#4A7C42] text-white py-3 rounded-2xl font-black text-sm transition-colors shrink-0"
          >
            + Raise a Motion
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function MotionsModal({ committee, onClose, onCommitteeUpdate }: {
  committee: Committee;
  onClose: () => void;
  onCommitteeUpdate?: (updater: (c: Committee) => Committee) => void;
}) {
  const { getSettings } = useSettingsStore();
  const motionNames = { ...DEFAULT_MOTION_NAMES, ...(getSettings(committee.code).motionNames ?? {}) };
  const typeMeta = buildTypeMeta(motionNames);
  const pending = [...(committee.pendingMotions ?? [])].filter((m) => m.type !== ('join-request' as string)).sort((a, b) => b.disruptiveness - a.disruptiveness);
  const [view, setView] = useState<ModalView>(pending.length === 0 ? 'raise' : 'vote');
  const [specialVoteMotion, setSpecialVoteMotion] = useState<PendingMotion | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [editingMotionId, setEditingMotionId] = useState<string | null>(null);
  const update = (updater: (c: Committee) => Committee) => onCommitteeUpdate?.(updater);

  const handleRaised = (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => {
    if (committee.pendingMotions?.some(
      (m) => m.proposedBy === motion.proposedBy &&
        m.type !== ('join-request' as string) &&
        (m.type as string) !== 'gsl-request'
    )) return;

    const tempId = `temp-${Date.now()}`;
    const base = {
      'end-debate': 6_000_000, 'suspend-debate': 5_000_000,
      consultation: 4_000_000, tour: 3_000_000, unmoderated: 2_000_000, moderated: 1_000_000,
    };
    const disruptiveness = base[motion.type] + motion.totalTime;

    setPendingIds((prev) => new Set([...prev, tempId]));
    update((c) => ({ ...c, pendingMotions: [...(c.pendingMotions ?? []), { ...motion, id: tempId, disruptiveness }] }));

    addPendingMotionInDB(committee.id, motion).then((realId) => {
      if (!realId) return;
      update((c) => ({
        ...c,
        pendingMotions: (c.pendingMotions ?? []).map((m) =>
          m.id === tempId ? { ...m, id: realId } : m
        ),
      }));
      setPendingIds((prev) => { const next = new Set(prev); next.delete(tempId); return next; });
    });

    setView('vote');
  };

  const handleRemove = (motionId: string) => {
    update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
    // Only call DB if this is a real UUID (not a temp optimistic ID)
    if (!motionId.startsWith('temp-')) {
      removePendingMotionInDB(motionId);
    }
  };

  const handleEdited = (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => {
    if (!editingMotionId) return;
    handleRemove(editingMotionId);
    setEditingMotionId(null);
    handleRaised(motion);
  };

  const handleMotionAccepted = async (motion: PendingMotion) => {
    // Clear ALL other pending motions — only the accepted one proceeds
    // GSL (speakersList) is NEVER modified here

    if (motion.type === 'suspend-debate' || motion.type === 'end-debate') {
      setSpecialVoteMotion(motion);
      return;
    }

    if (motion.type === 'unmoderated') {
      const caucus = {
        active: true, type: 'unmoderated' as const, motionLabel: typeMeta['unmoderated'].label,
        purpose: motion.topic || '', proposedBy: motion.proposedBy,
        totalTime: motion.totalTime, remainingTime: motion.totalTime,
        speakingTime: 0, speakerTimeRemaining: 0, currentSpeaker: null,
        proposerPosition: null, spokenCountries: [],
      };
      update((c) => ({ ...c, phase: 'unmoderated-caucus', caucus, pendingMotions: [], caucusQueue: [], currentSpeaker: null }));
      onClose();
      clearPendingMotionsInDB(committee.id);
      clearCaucusListInDB(committee.id);
      updateCaucusInDB(committee.id, caucus);
      setPhaseInDB(committee.id, 'unmoderated-caucus');
      return;
    }
    if (motion.type === 'consultation') {
      const caucus = {
        active: true, type: 'unmoderated' as const, motionLabel: typeMeta['consultation'].label,
        purpose: motion.topic || '', proposedBy: motion.proposedBy,
        totalTime: motion.totalTime, remainingTime: motion.totalTime,
        speakingTime: 0, speakerTimeRemaining: 0, currentSpeaker: null,
        proposerPosition: null, spokenCountries: [],
      };
      // GSL preserved, caucusQueue cleared, phase → unmoderated-caucus
      update((c) => ({ ...c, phase: 'unmoderated-caucus', caucus, pendingMotions: [], caucusQueue: [], currentSpeaker: null }));
      onClose();
      clearPendingMotionsInDB(committee.id);
      clearCaucusListInDB(committee.id);
      updateCaucusInDB(committee.id, caucus);
      setPhaseInDB(committee.id, 'unmoderated-caucus');
      return;

    } else if (motion.type === 'moderated') {
      const caucus = {
        active: true, type: 'moderated' as const, motionLabel: typeMeta['moderated'].label,
        purpose: motion.topic || '', proposedBy: motion.proposedBy,
        totalTime: motion.totalTime, remainingTime: motion.totalTime,
        speakingTime: motion.speakingTime, speakerTimeRemaining: motion.speakingTime,
        currentSpeaker: null, proposerPosition: null, spokenCountries: [],
      };
      update((c) => ({ ...c, phase: 'moderated-caucus', caucus, pendingMotions: [], caucusQueue: [], currentSpeaker: null }));
      onClose();
      clearPendingMotionsInDB(committee.id);
      clearCaucusListInDB(committee.id);
      updateCaucusInDB(committee.id, caucus);
      setPhaseInDB(committee.id, 'moderated-caucus');
      return;

    } else if (motion.type === 'tour') {
      // Tour de Table — all present delegates ordered by tourOrder
      // GSL is NEVER touched — tour uses caucusQueue exclusively
      const alphabetical = committee.delegates
        .filter((d) => d.status !== 'absent')
        .sort((a, b) => a.country.localeCompare(b.country));

      if (motion.tourOrder === 'custom') {
        // Room Order — empty queue, chair calls speakers manually
        const n = alphabetical.length;
        const totalTourTime = n * motion.speakingTime;
        const caucus = {
          active: true, type: 'moderated' as const, motionLabel: typeMeta['tour'].label,
          purpose: 'Tour de Table (Room Order)',
          proposedBy: motion.proposedBy, totalTime: totalTourTime, remainingTime: totalTourTime,
          speakingTime: motion.speakingTime, speakerTimeRemaining: motion.speakingTime,
          currentSpeaker: null, proposerPosition: null, spokenCountries: [],
        };
        // Numbered placeholder queue — "Speaker 1", "Speaker 2", etc.
        const caucusQueue = alphabetical.map((_, i) => ({
          delegateId: `room-order-${i + 1}`,
          country: `Speaker ${i + 1}`,
        }));
        update((c) => ({ ...c, phase: 'moderated-caucus', caucus, pendingMotions: [], caucusQueue, currentSpeaker: null }));
        onClose();
        clearPendingMotionsInDB(committee.id);
        clearCaucusListInDB(committee.id);
        updateCaucusInDB(committee.id, caucus);
        setPhaseInDB(committee.id, 'moderated-caucus');
        return;
      }

      let presentDelegates: typeof alphabetical;
      if (motion.tourOrder === 'asc') {
        // Proposer first, then remaining countries in A→Z order
        const proposerIdx = alphabetical.findIndex((d) => d.country === motion.proposedBy);
        if (proposerIdx !== -1) {
          const rest = [...alphabetical.slice(proposerIdx + 1), ...alphabetical.slice(0, proposerIdx)];
          presentDelegates = [alphabetical[proposerIdx], ...rest];
        } else {
          presentDelegates = alphabetical;
        }
      } else {
        // desc — proposer first, then remaining in Z→A order
        const descAll = [...alphabetical].reverse();
        const proposerIdx = descAll.findIndex((d) => d.country === motion.proposedBy);
        if (proposerIdx !== -1) {
          const rest = [...descAll.slice(proposerIdx + 1), ...descAll.slice(0, proposerIdx)];
          presentDelegates = [descAll[proposerIdx], ...rest];
        } else {
          presentDelegates = descAll;
        }
      }

      const totalTourTime = presentDelegates.length * motion.speakingTime;
      const caucus = {
        active: true, type: 'moderated' as const, motionLabel: typeMeta['tour'].label,
        purpose: `Tour de Table (${motion.tourOrder === 'desc' ? 'Z→A' : 'A→Z'})`,
        proposedBy: motion.proposedBy, totalTime: totalTourTime, remainingTime: totalTourTime,
        speakingTime: motion.speakingTime, speakerTimeRemaining: motion.speakingTime,
        currentSpeaker: null, proposerPosition: null, spokenCountries: [],
      };
      const caucusQueue = presentDelegates.map((d) => ({ delegateId: d.id, country: d.country }));

      // GSL preserved, caucusQueue filled with ordered delegates
      update((c) => ({ ...c, phase: 'moderated-caucus', caucus, pendingMotions: [], caucusQueue, currentSpeaker: null }));
      onClose();
      clearPendingMotionsInDB(committee.id);
      clearCaucusListInDB(committee.id);
      updateCaucusInDB(committee.id, caucus);
      setPhaseInDB(committee.id, 'moderated-caucus');
      // Batch insert all delegates at once — no rate limits, all delegates added
      batchAddToCaucusListInDB(
        committee.id,
        presentDelegates.map((d) => ({ delegateId: d.id, country: d.country }))
      );
      return;
    }
  };

  // ── Special vote: "Does this motion pass?" ──────────────────────────────────
  if (specialVoteMotion) {
    const isSuspend = specialVoteMotion.type === 'suspend-debate';
    return (
      <div className="fixed inset-0 z-[60] bg-[#0D0906] flex flex-col items-center justify-center text-center px-8">
        <p className="text-xs font-mono tracking-widest text-[#7A5A38] mb-6">
          {typeMeta[specialVoteMotion.type].label.toUpperCase()} · {specialVoteMotion.proposedBy}
        </p>
        <h1 className="text-5xl font-black text-white mb-14">Does this motion pass?</h1>
        <div className="flex gap-8">
          <button
            onClick={async () => {
              const motionId = specialVoteMotion!.id;
              await removePendingMotionInDB(motionId);
              update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
              if (isSuspend) {
                onCommitteeUpdate?.((c) => ({ ...c, suspendedAt: new Date().toISOString(), phase: 'adjourned' as const }));
                suspendDebateInDB(committee.id);
              } else {
                const now = new Date();
                const expires = new Date(now.getTime() + 72 * 60 * 60 * 1000);
                onCommitteeUpdate?.((c) => ({ ...c, endedAt: now.toISOString(), expiresAt: expires.toISOString(), phase: 'adjourned' as const }));
                endDebateInDB(committee.id);
              }
              setSpecialVoteMotion(null);
              onClose();
            }}
            className="px-16 py-8 rounded-3xl bg-green-700 hover:bg-green-600 text-white text-2xl font-black transition-colors">
            Yes
          </button>
          <button
            onClick={() => {
              const motionId = specialVoteMotion.id;
              removePendingMotionInDB(motionId);
              update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
              setSpecialVoteMotion(null);
              onClose();
            }}
            className="px-16 py-8 rounded-3xl bg-red-800 hover:bg-red-700 text-white text-2xl font-black transition-colors">
            No
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-3xl w-full shadow-2xl overflow-hidden flex flex-col max-w-5xl" style={{ height: '88vh' }}>
        <div className="flex items-center justify-end px-7 pt-6 pb-0 shrink-0">
          <button onClick={onClose} className="text-[#7A5A38] hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 min-h-0 pt-2 flex flex-col">
          {view === 'raise' && (
            <RaiseMotionForm
              committee={committee}
              typeMeta={typeMeta}
              onBack={() => { setEditingMotionId(null); setView(pending.length > 0 ? 'vote' : 'list'); }}
              onRaised={editingMotionId ? handleEdited : handleRaised}
              editingMotion={editingMotionId ? (pending.find((m) => m.id === editingMotionId) ?? null) : null}
            />
          )}
          {view === 'vote' && (
            <VotingView
              committee={committee}
              typeMeta={typeMeta}
              onAccepted={handleMotionAccepted}
              onAllDone={() => { setView('list'); onClose(); }}
              onRemove={handleRemove}
              onBack={() => setView('raise')}
              onEdit={(motionId) => { setEditingMotionId(motionId); setView('raise'); }}
              pendingIds={pendingIds}
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
                    const meta = typeMeta[m.type];
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
                              {proposerFlag ? <img src={getFlagUrl(proposerFlag.code)} alt={proposerFlag.code} className="w-5 h-5 object-contain inline-block" /> : <span className="text-base">🌐</span>}
                              <span className="text-sm font-semibold text-white">{m.proposedBy}</span>
                            </div>
                            {m.topic && <p className="text-sm text-[#C4A882] mt-1 font-medium">"{m.topic}"</p>}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {m.type !== 'tour' && m.totalTime > 0 && (
                                <span className="text-xs font-bold text-[#7B4A1E] bg-[#150F09] border border-[#2E1E0F] px-2 py-0.5 rounded-md">
                                  {mins > 0 ? `${mins}m` : ''}{secs > 0 ? ` ${secs}s` : ''} total
                                </span>
                              )}
                              {m.type === 'moderated' && m.speakingTime > 0 && (
                                <span className="text-xs font-bold text-[#3D6B35] bg-[#150F09] border border-[#2E1E0F] px-2 py-0.5 rounded-md">
                                  {m.speakingTime}s/speaker
                                </span>
                              )}
                              {m.type === 'tour' && (
                                <>
                                  <span className="text-xs font-bold text-[#7B4A1E] bg-[#150F09] border border-[#2E1E0F] px-2 py-0.5 rounded-md">
                                    {m.speakingTime}s/delegate
                                  </span>
                                  <span className="text-xs font-bold text-[#C4A882] bg-[#150F09] border border-[#2E1E0F] px-2 py-0.5 rounded-md">
                                    {m.tourOrder === 'desc' ? 'Z→A' : 'A→Z'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleRemove(m.id)} className="text-[#7A5A38] hover:text-red-500 text-sm transition-colors mt-0.5">✕</button>
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