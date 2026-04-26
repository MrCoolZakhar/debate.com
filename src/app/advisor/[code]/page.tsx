'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
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
  const { sendMessage } = useCommitteeStore();
  const { getSettings } = useSettingsStore();
  const mn = { ...DEFAULT_MOTION_NAMES, ...(getSettings(committee.code).motionNames ?? {}) };
  const [nudgeSent, setNudgeSent] = useState<string | null>(null);

  const queueIndex = committee.speakersList.findIndex((s) => s.delegateId === delegate.id);
  const isCurrentSpeaker = committee.currentSpeaker?.delegateId === delegate.id;

  // Find last motion raised by this country (check pendingMotions by proposedBy)
  const lastMotion = [...(committee.pendingMotions ?? [])].reverse().find(
    (m) => m.proposedBy === delegate.country
  );

  const statusLabel =
    delegate.status === 'present' ? 'Present' :
    delegate.status === 'present-voting' ? 'Present & Voting' : 'Absent';

  const statusColor =
    delegate.status === 'present' ? 'text-green-400' :
    delegate.status === 'present-voting' ? 'text-[#B8844A]' :
    'text-[#7A5A38]';

  const found = getCountryByName(delegate.country);
  const flagEl = found
    ? <img src={getFlagUrl(found.code)} alt={found.code} style={{ width: '4.5rem', height: '4.5rem', objectFit: 'contain' }} />
    : <Emoji size="4.5rem">🌐</Emoji>;

  const handleNudge = (emoji: string) => {
    sendMessage(committee.id, 'Faculty Advisor', `${emoji} to ${delegate.country}`, false);
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
      className="relative bg-[#1A1209] border border-[#7B4A1E]/60 rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* X button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-[#7A5A38] hover:text-white text-xl leading-none"
        aria-label="Close"
      >
        ×
      </button>

      {/* Flag + name */}
      <div className="flex flex-col items-center gap-2 pt-2">
        {flagEl}
        <h2 className="text-3xl font-black text-white text-center">{delegate.country}</h2>
        <span className={`text-sm font-bold ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Info rows */}
      <div className="space-y-3 w-full">
        <div className="bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3">
          <p className="text-xs text-[#7A5A38] font-mono uppercase tracking-wider mb-1">Last Motion Raised</p>
          <p className="text-sm text-white">{motionDisplay}</p>
        </div>

        <div className="bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3">
          <p className="text-xs text-[#7A5A38] font-mono uppercase tracking-wider mb-1">Position in Speakers Queue</p>
          <p className="text-sm text-white">{queueDisplay}</p>
        </div>
      </div>

      {/* Nudge buttons */}
      <div>
        <p className="text-xs text-[#7A5A38] font-mono uppercase tracking-wider mb-2">Send Nudge</p>
        <div className="flex gap-2 flex-wrap">
          {NUDGE_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleNudge(emoji)}
              className="text-2xl bg-[#150F09] border border-[#2E1E0F] rounded-xl px-3 py-2 hover:border-[#7B4A1E] hover:bg-[#2E1E0F] transition-colors"
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
    ? <img src={getFlagUrl(found.code)} alt={found.code} style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain' }} />
    : <Emoji size="1.5rem">🌐</Emoji>;

  return (
    <button
      onClick={onSelect}
      className="flex flex-col items-center gap-1 w-16 h-16 justify-center rounded-xl border border-[#2E1E0F] bg-[#150F09] hover:border-[#7B4A1E] transition-all duration-200 shrink-0"
      title={delegate.country}
    >
      {flagEl}
      <span className="text-[9px] text-[#C4A882] truncate max-w-full px-1 leading-tight">{delegate.country}</span>
    </button>
  );
}

function NormalDelegateCard({ delegate, committee, onSelect }: { delegate: Committee['delegates'][0]; committee: Committee; onSelect: () => void }) {
  const queueIndex = committee.speakersList.findIndex((s) => s.delegateId === delegate.id);
  const isCurrentSpeaker = committee.currentSpeaker?.delegateId === delegate.id;

  const statusColor =
    delegate.status === 'present' ? 'bg-green-950/40 border-green-800/30' :
    delegate.status === 'present-voting' ? 'bg-[#7B4A1E]/20 border-[#7B4A1E]/30' :
    'border-transparent';

  const statusLabelColor =
    delegate.status === 'present' ? 'text-green-400' :
    delegate.status === 'present-voting' ? 'text-[#B8844A]' :
    'text-[#7A5A38]';

  const statusLabel =
    delegate.status === 'present' ? 'P' :
    delegate.status === 'present-voting' ? 'PV' : 'A';

  return (
    <div
      className={`border rounded-xl transition-all duration-200 cursor-pointer ${statusColor} ${isCurrentSpeaker ? 'ring-2 ring-[#B8844A]' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <FlagCircle country={delegate.country} size="xs" />
        <span className="flex-1 text-sm text-white truncate font-medium">{delegate.country}</span>
        {isCurrentSpeaker && (
          <span className="text-xs bg-[#B8844A]/30 text-[#B8844A] px-2 py-0.5 rounded-full font-bold shrink-0">SPEAKING</span>
        )}
        {!isCurrentSpeaker && queueIndex >= 0 && (
          <span className="text-xs text-[#C4A882] shrink-0">{ordinal(queueIndex + 1)} up</span>
        )}
        <span className={`text-xs font-bold ${statusLabelColor} shrink-0 w-6 text-center`}>{statusLabel}</span>
      </div>
    </div>
  );
}

export default function AdvisorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { committees } = useCommitteeStore();
  const { getSettings } = useSettingsStore();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  useEffect(() => {
    const found = Object.values(committees).find((c) => c.code === code.toUpperCase());
    setCommittee(found ?? null);
  }, [committees, code]);

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl font-bold mb-4">Committee not found</p>
          <Link href="/join" className="bg-[#7B4A1E] text-white px-6 py-3 rounded-xl font-semibold">Join page</Link>
        </div>
      </div>
    );
  }

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const progress = committee.currentSpeaker
    ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100
    : 100;
  const advisorMotionNames = { ...DEFAULT_MOTION_NAMES, ...(getSettings(committee.code).motionNames ?? {}) };
  const advisorPhaseDisplay = (() => {
    if (committee.phase === 'moderated-caucus') return advisorMotionNames.moderated;
    if (committee.phase === 'unmoderated-caucus') return advisorMotionNames.unmoderated;
    return committee.phase.replace(/-/g, ' ');
  })();

  const sortedDelegates = [...committee.delegates].sort((a, b) => a.country.localeCompare(b.country));
  const selectedDelegate = selectedCountry
    ? sortedDelegates.find((d) => d.country === selectedCountry) ?? null
    : null;
  const otherDelegates = selectedCountry
    ? sortedDelegates.filter((d) => d.country !== selectedCountry)
    : sortedDelegates;

  return (
    <div className="h-screen bg-[#0D0906] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-[#2E1E0F] bg-[#150F08] px-4 h-11 flex items-center gap-3 shrink-0">
        <Link href="/">
          <img src="/gavelling-logo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}} />
        </Link>
        <span className="font-bold text-white text-sm truncate">{committee.name}</span>
        <span className="text-[#7A5A38] text-xs hidden sm:block truncate flex-1">{committee.topic}</span>
        <span className="text-xs px-2 py-1 bg-[#2E1E0F] text-[#C4A882] rounded-lg shrink-0">Faculty Advisor — Read Only</span>
        <span className="text-xs font-mono bg-[#2E1E0F] text-white px-2.5 py-1 rounded-lg shrink-0">{committee.code}</span>
      </header>

      {/* Stats bar */}
      <div className="border-b border-[#2E1E0F] bg-[#150F08] px-4 py-1.5 flex items-center gap-6 shrink-0">
        <span className="text-xs text-[#C4A882] font-mono">{present} / {committee.delegates.length} present</span>
        <span className="text-xs text-[#C4A882]">Phase: <span className="text-white font-semibold capitalize">{advisorPhaseDisplay}</span></span>
        {committee.speakersList.length > 0 && (
          <span className="text-xs text-[#C4A882]">{committee.speakersList.length} in queue</span>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Current speaker + queue */}
        <div className="w-80 border-r border-[#2E1E0F] bg-[#0D0906] flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-[#2E1E0F] shrink-0">
            <p className="text-xs text-[#7A5A38] font-mono uppercase tracking-wider">Now Speaking</p>
          </div>

          {committee.currentSpeaker ? (
            <div className="flex flex-col items-center px-4 py-6 border-b border-[#2E1E0F] shrink-0">
              <FlagCircle country={committee.currentSpeaker.country} size="xl" />
              <h2 className="text-2xl font-black text-white mt-4 mb-1 text-center">{committee.currentSpeaker.country}</h2>
              <div className={`text-5xl font-black font-mono tabular-nums mt-2 ${
                committee.speakerTimeRemaining <= 10 ? 'text-red-400' : committee.speakerTimeRemaining <= 30 ? 'text-yellow-400' : 'text-white'
              }`}>
                {formatTime(committee.speakerTimeRemaining)}
              </div>
              <div className="w-full max-w-xs h-1.5 bg-[#2E1E0F] rounded-full overflow-hidden mt-3">
                <div className={`h-full rounded-full transition-all ${progress > 50 ? 'bg-[#B8844A]' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center px-4 py-6 border-b border-[#2E1E0F] shrink-0">
              <div className="mb-2"><Emoji size="2.5rem">🎙️</Emoji></div>
              <p className="text-[#C4A882] text-sm text-center">No current speaker</p>
            </div>
          )}

          {/* Queue */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2 border-b border-[#2E1E0F]">
              <p className="text-xs text-[#7A5A38] font-mono uppercase tracking-wider">Up Next ({committee.speakersList.length})</p>
            </div>
            {committee.speakersList.length === 0 ? (
              <div className="px-4 py-4 text-xs text-[#7A5A38]">No speakers queued</div>
            ) : (
              committee.speakersList.map((s, i) => (
                <div key={s.delegateId} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2E1E0F]/40">
                  <span className="text-xs text-[#7A5A38] font-mono w-5">{i + 1}</span>
                  <FlagCircle country={s.country} size="xs" />
                  <span className="text-sm text-white flex-1 truncate">{s.country}</span>
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
                <h2 className="text-sm font-bold text-[#C4A882]">All Delegates — click to expand</h2>
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
              {/* Expanded card — ~50% width */}
              <div className="w-1/2 shrink-0 transition-all duration-200">
                {selectedDelegate && (
                  <ExpandedDelegateCard
                    delegate={selectedDelegate}
                    committee={committee}
                    onClose={() => setSelectedCountry(null)}
                  />
                )}
              </div>

              {/* Other delegates — small cards wrapping flex row */}
              <div className="flex-1 overflow-y-auto">
                <p className="text-xs text-[#7A5A38] font-mono uppercase tracking-wider mb-3">
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
