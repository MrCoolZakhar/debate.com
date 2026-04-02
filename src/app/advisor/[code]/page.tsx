'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { Committee } from '@/lib/types';
import { FlagCircle } from '@/components/RollCallPanel';

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

function DelegateCard({ delegate, committee }: { delegate: Committee['delegates'][0]; committee: Committee }) {
  const [expanded, setExpanded] = useState(false);

  const queueIndex = committee.speakersList.findIndex((s) => s.delegateId === delegate.id);
  const isCurrentSpeaker = committee.currentSpeaker?.delegateId === delegate.id;

  const statusColor =
    delegate.status === 'present' ? 'bg-green-950/40 border-green-800/30' :
    delegate.status === 'present-voting' ? 'bg-[#7B4A1E]/20 border-[#7B4A1E]/30' :
    'border-transparent';

  const statusLabel =
    delegate.status === 'present' ? 'P' :
    delegate.status === 'present-voting' ? 'PV' : 'A';
  const statusLabelColor =
    delegate.status === 'present' ? 'text-green-400' :
    delegate.status === 'present-voting' ? 'text-[#B8844A]' :
    'text-[#7A5A38]';

  return (
    <div
      className={`border rounded-xl transition-all cursor-pointer ${statusColor} ${isCurrentSpeaker ? 'ring-2 ring-[#B8844A]' : ''}`}
      onClick={() => setExpanded((v) => !v)}
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

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[#2E1E0F] space-y-1.5">
          <div className="text-xs text-[#C4A882]">
            Status: <span className="text-white font-semibold capitalize">{delegate.status.replace('-', ' ')}</span>
          </div>
          {isCurrentSpeaker && committee.speakerTimeRemaining !== undefined && (
            <div className="text-xs text-[#C4A882]">
              Time remaining: <span className="text-white font-semibold font-mono">{formatTime(committee.speakerTimeRemaining)}</span>
            </div>
          )}
          {queueIndex >= 0 && !isCurrentSpeaker && (
            <div className="text-xs text-[#C4A882]">
              Queue position: <span className="text-white font-semibold">{ordinal(queueIndex + 1)}</span>
            </div>
          )}
          {queueIndex < 0 && !isCurrentSpeaker && (
            <div className="text-xs text-[#7A5A38]">Not on speakers list</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdvisorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { committees } = useCommitteeStore();
  const [committee, setCommittee] = useState<Committee | null>(null);

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

  const sortedDelegates = [...committee.delegates].sort((a, b) => a.country.localeCompare(b.country));

  return (
    <div className="h-screen bg-[#0D0906] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-[#2E1E0F] bg-[#150F08] px-4 h-11 flex items-center gap-3 shrink-0">
        <Link href="/">
          <img src="/gavelling-logo.png" alt="Gavelling" className="h-8 w-auto" />
        </Link>
        <span className="font-bold text-white text-sm truncate">{committee.name}</span>
        <span className="text-[#7A5A38] text-xs hidden sm:block truncate flex-1">{committee.topic}</span>
        <span className="text-xs px-2 py-1 bg-[#2E1E0F] text-[#C4A882] rounded-lg shrink-0">Faculty Advisor — Read Only</span>
        <span className="text-xs font-mono bg-[#2E1E0F] text-white px-2.5 py-1 rounded-lg shrink-0">{committee.code}</span>
      </header>

      {/* Stats bar */}
      <div className="border-b border-[#2E1E0F] bg-[#150F08] px-4 py-1.5 flex items-center gap-6 shrink-0">
        <span className="text-xs text-[#C4A882] font-mono">{present} / {committee.delegates.length} present</span>
        <span className="text-xs text-[#C4A882]">Phase: <span className="text-white font-semibold capitalize">{committee.phase.replace('-', ' ')}</span></span>
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
              <div className="text-4xl mb-2">🎙️</div>
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
          <div className="mb-3">
            <h2 className="text-sm font-bold text-[#C4A882]">All Delegates — click to expand</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {sortedDelegates.map((d) => (
              <DelegateCard key={d.id} delegate={d} committee={committee} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
