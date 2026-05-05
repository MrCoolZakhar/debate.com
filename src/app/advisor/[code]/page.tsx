'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getCommitteeByCode, subscribeToCommittee, sendMessage as sendMessageDB } from '@/lib/committeeService';
import { useSettingsStore, DEFAULT_MOTION_NAMES } from '@/lib/settingsStore';
import { Committee } from '@/lib/types';
import { FlagCircle } from '@/components/RollCallPanel';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const NUDGE_EMOJIS = ['👍', '💪', '🌟', '⭐', '🎯'];

function ExpandedDelegateCard({
  delegate,
  committee,
  onClose,
}: {
  delegate: Committee['delegates'][0];
  committee: Committee;
  onClose: () => void;
}) {
  const { getSettings } = useSettingsStore();
  const mn = { ...DEFAULT_MOTION_NAMES, ...(getSettings(committee.code).motionNames ?? {}) };
  const [nudgeSent, setNudgeSent] = useState<string | null>(null);

  const queueIndex = committee.speakersList.findIndex((s) => s.delegateId === delegate.id);
  const isCurrentSpeaker = committee.currentSpeaker?.delegateId === delegate.id;

  const lastMotion = [...(committee.pendingMotions ?? [])].reverse().find(
    (m) => m.proposedBy === delegate.country
  );

  const statusLabel =
    delegate.status === 'present' ? 'Present' :
    delegate.status === 'present-voting' ? 'Present & Voting' : 'Absent';

  const statusColor =
    delegate.status === 'present' ? 'text-green-400' :
    delegate.status === 'present-voting' ? 'text-[#B6871F]' :
    'text-[#9A8A78]';

  const found = getCountryByName(delegate.country);
  const flagEl = found
    ? <img src={getFlagUrl(found.code)} alt={found.code} style={{ width: '4.5rem', height: '4.5rem', objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    : <Emoji size="4.5rem">🌐</Emoji>;

  const handleNudge = (emoji: string) => {
    sendMessageDB(committee.id, 'Faculty Advisor', `${emoji} to ${delegate.country}`, false);
    setNudgeSent(emoji);
    setTimeout(() => setNudgeSent(null), 1500);
  };

  let queueDisplay: string;
  if (isCurrentSpeaker) {
    queueDisplay = '🎤 Currently Speaking';
  } else if (queueIndex >= 0) {
    queueDisplay = `Next up: #${queueIndex + 1} in queue`;
  } else {
    queueDisplay = 'Not in queue';
  }

  let motionDisplay: string;
  if (lastMotion) {
    const typeLabel: Record<string, string> = {
      moderated: mn.moderated,
      unmoderated: mn.unmoderated,
      consultation: mn.consultation,
      tour: mn.tour,
      'suspend-debate': mn.suspendDebate,
      'end-debate': mn.endDebate,
    };
    motionDisplay = typeLabel[lastMotion.type] || lastMotion.type;
    if (lastMotion.topic) motionDisplay += ` — ${lastMotion.topic}`;
  } else {
    motionDisplay = 'No motion raised';
  }

  return (
    <div
      className="relative bg-[#EDE7D8] border border-[#1B3828]/60 rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-[#9A8A78] hover:text-[#1C1410] text-xl leading-none"
        aria-label="Close"
      >
        ×
      </button>

      <div className="flex flex-col items-center gap-2 pt-2">
        {flagEl}
        <h2 className="text-3xl font-black text-[#1C1410] text-center">{delegate.country}</h2>
        <span className={`text-sm font-bold ${statusColor}`}>{statusLabel}</span>
      </div>

      <div className="space-y-3 w-full">
        <div className="bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3">
          <p className="text-xs text-[#9A8A78] font-mono uppercase tracking-wider mb-1">Last Motion Raised</p>
          <p className="text-sm text-[#1C1410]">{motionDisplay}</p>
        </div>

        <div className="bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3">
          <p className="text-xs text-[#9A8A78] font-mono uppercase tracking-wider mb-1">Position in Speakers Queue</p>
          <p className="text-sm text-[#1C1410]">{queueDisplay}</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-[#9A8A78] font-mono uppercase tracking-wider mb-2">Send Nudge</p>
        <div className="flex gap-2 flex-wrap">
          {NUDGE_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleNudge(emoji)}
              className="text-2xl bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2 hover:border-[#1B3828] hover:bg-[#DDD4C0] transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
        {nudgeSent && (
          <p className="text-xs text-green-400 mt-2">Sent! {nudgeSent}</p>
        )}
      </div>
    </div>
  );
}

function CollapsedDelegateCard({
  delegate,
  onSelect,
}: {
  delegate: Committee['delegates'][0];
  onSelect: () => void;
}) {
  const found = getCountryByName(delegate.country);
  const flagEl = found
    ? <img src={getFlagUrl(found.code)} alt={found.code} style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    : <Emoji size="1.5rem">🌐</Emoji>;

  return (
    <button
      onClick={onSelect}
      className="flex flex-col items-center gap-1 w-16 h-16 justify-center rounded-xl border border-[#DDD4C0] bg-[#FAF8F3] hover:border-[#1B3828] transition-all duration-200 shrink-0"
      title={delegate.country}
    >
      {flagEl}
      <span className="text-[9px] text-[#6A5A4A] truncate max-w-full px-1 leading-tight">{delegate.country}</span>
    </button>
  );
}

function NormalDelegateCard({ delegate, committee, onSelect }: { delegate: Committee['delegates'][0]; committee: Committee; onSelect: () => void }) {
  const queueIndex = committee.speakersList.findIndex((s) => s.delegateId === delegate.id);
  const isCurrentSpeaker = committee.currentSpeaker?.delegateId === delegate.id;

  const statusColor =
    delegate.status === 'present' ? 'bg-green-950/40 border-green-800/30' :
    delegate.status === 'present-voting' ? 'bg-[#1B3828]/20 border-[#1B3828]/30' :
    'border-transparent';

  const statusLabelColor =
    delegate.status === 'present' ? 'text-green-400' :
    delegate.status === 'present-voting' ? 'text-[#B6871F]' :
    'text-[#9A8A78]';

  const statusLabel =
    delegate.status === 'present' ? 'P' :
    delegate.status === 'present-voting' ? 'PV' : 'A';

  return (
    <div
      className={`border rounded-xl transition-all duration-200 cursor-pointer ${statusColor} ${isCurrentSpeaker ? 'ring-2 ring-[#B6871F]' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <FlagCircle country={delegate.country} size="xs" />
        <span className="flex-1 text-sm text-[#1C1410] truncate font-medium">{delegate.country}</span>
        {isCurrentSpeaker && (
          <span className="text-xs bg-[#B6871F]/30 text-[#B6871F] px-2 py-0.5 rounded-full font-bold shrink-0">SPEAKING</span>
        )}
        {!isCurrentSpeaker && queueIndex >= 0 && (
          <span className="text-xs text-[#6A5A4A] shrink-0">{ordinal(queueIndex + 1)} up</span>
        )}
        <span className={`text-xs font-bold ${statusLabelColor} shrink-0 w-6 text-center`}>{statusLabel}</span>
      </div>
    </div>
  );
}

export default function AdvisorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { getSettings } = useSettingsStore();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  useEffect(() => {
    const upperCode = code.toUpperCase();
    let unsub: (() => void) | null = null;

    getCommitteeByCode(upperCode).then((c) => {
      if (!c) return;
      setCommittee(c);
      unsub = subscribeToCommittee(c.id, async () => {
        const updated = await getCommitteeByCode(upperCode);
        if (updated) setCommittee(updated);
      });
    });

    return () => { unsub?.(); };
  }, [code]);

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#F6F1E9] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#1C1410] text-xl font-bold mb-4">Committee not found</p>
          <Link href="/join" className="bg-[#1B3828] text-white px-6 py-3 rounded-xl font-semibold">Join page</Link>
        </div>
      </div>
    );
  }

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;

  const isModeratedCaucus = committee.phase === 'moderated-caucus';
  const isUnmoderatedCaucus = committee.phase === 'unmoderated-caucus';
  const isCaucus = isModeratedCaucus || isUnmoderatedCaucus;

  const advisorMotionNames = { ...DEFAULT_MOTION_NAMES, ...(getSettings(committee.code).motionNames ?? {}) };
  const advisorPhaseDisplay = (() => {
    if (committee.phase === 'moderated-caucus') return advisorMotionNames.moderated;
    if (committee.phase === 'unmoderated-caucus') return advisorMotionNames.unmoderated;
    return committee.phase.replace(/-/g, ' ');
  })();

  const caucus = committee.caucus as {
    type: string;
    purpose?: string;
    totalTime: number;
    remainingTime: number;
    speakingTime: number;
    speakerTimeRemaining: number;
    currentSpeaker: string | null;
  } | null;

  const gslProgress = committee.currentSpeaker
    ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100
    : 100;

  const caucusSpeakerProgress = caucus && caucus.speakingTime > 0
    ? (caucus.speakerTimeRemaining / caucus.speakingTime) * 100
    : 100;

  const displayQueue = isCaucus ? (committee.caucusQueue ?? []) : committee.speakersList;

  const sortedDelegates = [...committee.delegates].sort((a, b) => a.country.localeCompare(b.country));
  const selectedDelegate = selectedCountry
    ? sortedDelegates.find((d) => d.country === selectedCountry) ?? null
    : null;
  const otherDelegates = selectedCountry
    ? sortedDelegates.filter((d) => d.country !== selectedCountry)
    : sortedDelegates;

  return (
    <div className="h-screen bg-[#F6F1E9] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-[#DDD4C0] bg-[#FAF8F3] px-4 h-11 flex items-center gap-3 shrink-0">
        <Link href="/">
          <img src="/GavellingLogo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}} />
        </Link>
        <span className="font-bold text-[#1C1410] text-sm truncate">{committee.name}</span>
        <span className="text-[#9A8A78] text-xs hidden sm:block truncate flex-1">{committee.topic}</span>
        <span className="text-xs px-2 py-1 bg-[#DDD4C0] text-[#6A5A4A] rounded-lg shrink-0">Faculty Advisor — Read Only</span>
        <span className="text-xs font-mono bg-[#DDD4C0] text-[#1C1410] px-2.5 py-1 rounded-lg shrink-0">{committee.code}</span>
      </header>

      {/* Stats bar */}
      <div className="border-b border-[#DDD4C0] bg-[#FAF8F3] px-4 py-1.5 flex items-center gap-6 shrink-0">
        <span className="text-xs text-[#6A5A4A] font-mono">{present} / {committee.delegates.length} present</span>
        <span className="text-xs text-[#6A5A4A]">Phase: <span className="text-[#1C1410] font-semibold capitalize">{advisorPhaseDisplay}</span></span>
        {displayQueue.length > 0 && (
          <span className="text-xs text-[#6A5A4A]">{displayQueue.length} in queue</span>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Current speaker + queue */}
        <div className="w-80 border-r border-[#DDD4C0] bg-[#F6F1E9] flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-[#DDD4C0] shrink-0">
            <p className="text-xs text-[#9A8A78] font-mono uppercase tracking-wider">
              {isCaucus ? (caucus?.type === 'moderated' ? 'Caucus Speaker' : 'Caucus') : 'Now Speaking'}
            </p>
          </div>

          {/* Moderated caucus — show caucus current speaker */}
          {isModeratedCaucus && (
            caucus?.currentSpeaker ? (
              <div className="flex flex-col items-center px-4 py-6 border-b border-[#DDD4C0] shrink-0">
                <FlagCircle country={caucus.currentSpeaker} size="xl" />
                <h2 className="text-2xl font-black text-[#1C1410] mt-4 mb-1 text-center">{caucus.currentSpeaker}</h2>
                <div className={`text-5xl font-black font-mono tabular-nums mt-2 ${
                  caucus.speakerTimeRemaining <= 10 ? 'text-red-400' : caucus.speakerTimeRemaining <= 30 ? 'text-yellow-400' : 'text-[#1C1410]'
                }`}>
                  {formatTime(caucus.speakerTimeRemaining)}
                </div>
                <div className="w-full max-w-xs h-1.5 bg-[#DDD4C0] rounded-full overflow-hidden mt-3">
                  <div className={`h-full rounded-full transition-all ${caucusSpeakerProgress > 50 ? 'bg-[#B6871F]' : caucusSpeakerProgress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${caucusSpeakerProgress}%` }} />
                </div>
                {caucus.purpose && (
                  <p className="text-xs text-[#9A8A78] mt-3 text-center">{caucus.purpose}</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center px-4 py-6 border-b border-[#DDD4C0] shrink-0">
                <div className="mb-2"><Emoji size="2.5rem">🎙️</Emoji></div>
                <p className="text-[#6A5A4A] text-sm text-center">No speaker yet</p>
                {caucus?.purpose && (
                  <p className="text-xs text-[#9A8A78] mt-2 text-center">{caucus.purpose}</p>
                )}
              </div>
            )
          )}

          {/* Unmoderated caucus — show countdown + purpose */}
          {isUnmoderatedCaucus && (
            <div className="flex flex-col items-center px-4 py-6 border-b border-[#DDD4C0] shrink-0">
              <div className={`text-5xl font-black font-mono tabular-nums ${
                (caucus?.remainingTime ?? 0) <= 30 ? 'text-red-400' : (caucus?.remainingTime ?? 0) <= 60 ? 'text-yellow-400' : 'text-[#1C1410]'
              }`}>
                {formatTime(caucus?.remainingTime ?? 0)}
              </div>
              <p className="text-xs text-[#9A8A78] mt-2 font-mono uppercase tracking-wider">
                {caucus?.type === 'consultation' ? advisorMotionNames.consultation :
                 caucus?.type === 'tour' ? advisorMotionNames.tour :
                 advisorMotionNames.unmoderated}
              </p>
              {caucus?.purpose && (
                <p className="text-sm text-[#6A5A4A] mt-3 text-center">{caucus.purpose}</p>
              )}
            </div>
          )}

          {/* GSL — show currentSpeaker */}
          {!isCaucus && (
            committee.currentSpeaker ? (
              <div className="flex flex-col items-center px-4 py-6 border-b border-[#DDD4C0] shrink-0">
                <FlagCircle country={committee.currentSpeaker.country} size="xl" />
                <h2 className="text-2xl font-black text-[#1C1410] mt-4 mb-1 text-center">{committee.currentSpeaker.country}</h2>
                <div className={`text-5xl font-black font-mono tabular-nums mt-2 ${
                  committee.speakerTimeRemaining <= 10 ? 'text-red-400' : committee.speakerTimeRemaining <= 30 ? 'text-yellow-400' : 'text-[#1C1410]'
                }`}>
                  {formatTime(committee.speakerTimeRemaining)}
                </div>
                <div className="w-full max-w-xs h-1.5 bg-[#DDD4C0] rounded-full overflow-hidden mt-3">
                  <div className={`h-full rounded-full transition-all ${gslProgress > 50 ? 'bg-[#B6871F]' : gslProgress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${gslProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center px-4 py-6 border-b border-[#DDD4C0] shrink-0">
                <div className="mb-2"><Emoji size="2.5rem">🎙️</Emoji></div>
                <p className="text-[#6A5A4A] text-sm text-center">No current speaker</p>
              </div>
            )
          )}

          {/* Queue */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2 border-b border-[#DDD4C0]">
              <p className="text-xs text-[#9A8A78] font-mono uppercase tracking-wider">
                Up Next ({displayQueue.length})
              </p>
            </div>
            {displayQueue.length === 0 ? (
              <div className="px-4 py-4 text-xs text-[#9A8A78]">No speakers queued</div>
            ) : (
              displayQueue.map((s, i) => (
                <div key={s.delegateId} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#DDD4C0]/40">
                  <span className="text-xs text-[#9A8A78] font-mono w-5">{i + 1}</span>
                  <FlagCircle country={s.country} size="xs" />
                  <span className="text-sm text-[#1C1410] flex-1 truncate">{s.country}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: All delegates grid */}
        <main className="flex-1 overflow-y-auto p-4">
          {selectedCountry === null ? (
            <>
              <div className="mb-3">
                <h2 className="text-sm font-bold text-[#6A5A4A]">All Delegates — click to expand</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {sortedDelegates.map((d) => (
                  <NormalDelegateCard
                    key={d.id}
                    delegate={d}
                    committee={committee}
                    onSelect={() => setSelectedCountry(d.country)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex gap-4">
              <div className="w-1/2 shrink-0 transition-all duration-200">
                {selectedDelegate && (
                  <ExpandedDelegateCard
                    delegate={selectedDelegate}
                    committee={committee}
                    onClose={() => setSelectedCountry(null)}
                  />
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                <p className="text-xs text-[#9A8A78] font-mono uppercase tracking-wider mb-3">
                  Other Delegates ({otherDelegates.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {otherDelegates.map((d) => (
                    <CollapsedDelegateCard
                      key={d.id}
                      delegate={d}
                      onSelect={() => setSelectedCountry(d.country)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
