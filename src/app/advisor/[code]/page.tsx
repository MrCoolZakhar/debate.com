'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getCommitteeByCode, subscribeToCommittee, sendMessage as sendMessageDB } from '@/lib/committeeService';
import { useSettingsStore, DEFAULT_MOTION_NAMES } from '@/lib/settingsStore';
import { Committee } from '@/lib/types';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';
import { MajorityPie } from '@/components/RollCallPanel';

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

const NUDGE_MESSAGES = ['Good job!', 'Keep going!', 'Great speech!', 'You got this!', 'Stay confident!'];

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
    delegate.status === 'present' ? '#3D7A52' :
    delegate.status === 'present-voting' ? '#1B3828' :
    '#9A8A78';

  const found = getCountryByName(delegate.country);
  const flagEl = found
    ? <img src={getFlagUrl(found.code)} alt={found.code} style={{ width: '96px', height: '68px', objectFit: 'cover', borderRadius: '10px', border: '1.5px solid rgba(28,20,16,0.10)' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    : null;

  const handleNudge = (emoji: string) => {
    sendMessageDB(committee.id, 'Faculty Advisor', emoji, true, delegate.country);
    setNudgeSent(emoji);
    setTimeout(() => setNudgeSent(null), 1500);
  };

  let queueDisplay: string;
  if (isCurrentSpeaker) {
    queueDisplay = 'Currently Speaking';
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
        <h2 className="text-3xl font-black text-center" style={{ color: '#1C1410' }}>{delegate.country}</h2>
        <span className="text-sm font-bold" style={{ color: statusColor }}>{statusLabel}</span>
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

      <div className="flex flex-col items-center">
        <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#9A8A78' }}>Send Nudge</p>
        <div className="flex gap-2 flex-wrap justify-center">
          {NUDGE_MESSAGES.map((msg) => (
            <button
              key={msg}
              onClick={() => handleNudge(msg)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-colors focus:outline-none"
              style={{ backgroundColor: 'transparent', border: '1px solid #DDD4C0', color: '#1B3828' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {msg}
            </button>
          ))}
        </div>
        {nudgeSent && (
          <p className="text-xs font-semibold mt-2" style={{ color: '#1B3828' }}>Sent: "{nudgeSent}"</p>
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
    ? <img src={getFlagUrl(found.code)} alt={found.code} style={{ width: '36px', height: '26px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    : null;

  return (
    <button
      onClick={onSelect}
      className="flex flex-col items-center gap-1 w-20 h-20 justify-center rounded-xl transition-all duration-200 shrink-0 focus:outline-none"
      style={{ backgroundColor: '#1B3828', border: '2px solid transparent' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
      title={delegate.country}
    >
      {flagEl}
      <span className="text-[9px] truncate max-w-full px-1 leading-tight" style={{ color: '#EDE7D8' }}>{delegate.country}</span>
    </button>
  );
}

function NormalDelegateCard({ delegate, committee, onSelect }: { delegate: Committee['delegates'][0]; committee: Committee; onSelect: () => void }) {
  const queueIndex = committee.speakersList.findIndex((s) => s.delegateId === delegate.id);
  const isCurrentSpeaker = committee.currentSpeaker?.delegateId === delegate.id;
  const found = getCountryByName(delegate.country);

  const statusLabel =
    delegate.status === 'present' ? 'P' :
    delegate.status === 'present-voting' ? 'P+V' : 'A';

  const statusLabelColor =
    delegate.status === 'present' ? '#EED98A' :
    delegate.status === 'present-voting' ? '#B8844A' :
    'rgba(237,231,216,0.4)';

  return (
    <div
      className="rounded-xl transition-all duration-200 cursor-pointer"
      style={{
        backgroundColor: '#1B3828',
        border: '2px solid transparent',
      }}
      onClick={onSelect}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      <div className="flex items-center gap-3 px-3 py-3">
        {found
          ? <img src={getFlagUrl(found.code)} alt={found.code} style={{ width: '32px', height: '22px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(28,20,16,0.15)', flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          : <div style={{ width: '32px', height: '22px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        }
        <span className="flex-1 text-sm font-bold truncate" style={{ color: '#EDE7D8' }}>{delegate.country}</span>
        {isCurrentSpeaker && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: '#EED98A', color: '#1B3828' }}>SPEAKING</span>
        )}
        {!isCurrentSpeaker && queueIndex >= 0 && (
          <span className="text-xs font-medium shrink-0" style={{ color: 'rgba(237,231,216,0.7)' }}>{ordinal(queueIndex + 1)} up</span>
        )}
        <span className="text-xs font-black shrink-0" style={{ color: statusLabelColor }}>{statusLabel}</span>
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

  const isAdjourned = committee.phase === 'adjourned' && !!committee.suspendedAt && !committee.endedAt;

  if (isAdjourned) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-8" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <p className="text-xs font-mono font-bold tracking-widest mb-2 relative z-10" style={{ color: '#1B3828' }}>{committee.name} · {committee.code}</p>
        <h1 className="text-5xl font-black mb-4 tracking-wide relative z-10" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>SESSION ADJOURNED</h1>
        <p className="text-lg relative z-10" style={{ color: '#6A5A4A' }}>Please wait until the chair reopens the session.</p>
        <p className="text-xs mt-8 relative z-10" style={{ color: '#9A8A78' }}>Press ESC to return to main menu</p>
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
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#EDE7D8' }}>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      {/* Header */}
      <header className="border-b border-[#DDD4C0] bg-[#FAF8F3] px-4 h-11 flex items-center gap-3 shrink-0 relative z-[2]">
        <Link href="/">
          <img src="/GavellingLogo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}} />
        </Link>
        <span className="flex-1" />
        <span className="text-xs px-2 py-1 bg-[#DDD4C0] text-[#6A5A4A] rounded-lg shrink-0">Faculty Advisor — Read Only</span>
        <span className="text-xs font-mono bg-[#DDD4C0] text-[#1C1410] px-2.5 py-1 rounded-lg shrink-0">{committee.code}</span>
      </header>

      {/* Stats bar removed — moved into left panel */}

      <div className="flex-1 flex overflow-hidden relative z-[2]">
        {/* Left: Current speaker + queue — forest green */}
        <div className="w-80 flex flex-col overflow-hidden shrink-0" style={{ backgroundColor: '#1B3828', borderRight: '1px solid #3D7A52' }}>
          {/* Header — matches RollCallPanel style */}
          <div className="px-4 pt-4 pb-3 shrink-0 relative z-10" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
            <p className="text-lg font-black leading-tight truncate mb-0.5" style={{ color: '#EED98A' }}>{committee.name}</p>
            {committee.topic && (
              <p className="text-xs leading-snug line-clamp-2 mb-2" style={{ color: 'rgba(238,217,138,0.55)' }}>
                <span className="font-semibold" style={{ color: 'rgba(238,217,138,0.7)' }}>Topic: </span>{committee.topic}
              </p>
            )}
            {/* Pie charts — using MajorityPie component */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <MajorityPie arcFill={1} color="#2A5A3C" label={`${present}`} />
                <MajorityPie arcFill={2/3} color="#B6871F" label={`${Math.ceil(present * 2 / 3)}`} />
                <MajorityPie arcFill={0.5} color="#8A7A6A" label={`${Math.floor(present / 2) + 1}`} />
              </div>
              <span className="text-xs font-black capitalize px-2 py-1 rounded-lg" style={{ backgroundColor: 'rgba(238,217,138,0.12)', color: '#EED98A', fontFamily: "'DM Mono', monospace" }}>{advisorPhaseDisplay}</span>
            </div>
          </div>
          {/* Now Speaking label */}
          <div className="px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
            <p className="text-xs font-mono uppercase tracking-wider" style={{ color: 'rgba(238,217,138,0.5)' }}>
              {isCaucus ? (caucus?.type === 'moderated' ? 'Caucus Speaker' : 'Caucus') : 'Now Speaking'}
            </p>
          </div>

          {/* Moderated caucus — show caucus current speaker */}
          {isModeratedCaucus && (
            caucus?.currentSpeaker ? (
              <div className="flex flex-col items-center px-4 py-5 shrink-0" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
                {(() => { const c = getCountryByName(caucus.currentSpeaker); return c ? <img src={getFlagUrl(c.code)} alt={caucus.currentSpeaker} style={{ width: '80px', height: '58px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid rgba(238,217,138,0.2)' }} /> : null; })()}
                <h2 className="text-2xl font-black mt-3 mb-1 text-center" style={{ color: '#EDE7D8' }}>{caucus.currentSpeaker}</h2>
                <div className="text-5xl font-black font-mono tabular-nums mt-1" style={{ color: caucus.speakerTimeRemaining <= 10 ? '#B8844A' : '#EDE7D8' }}>
                  {formatTime(caucus.speakerTimeRemaining)}
                </div>
                <div className="w-full max-w-xs h-1.5 rounded-full overflow-hidden mt-3" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${caucusSpeakerProgress}%`, backgroundColor: '#EED98A' }} />
                </div>
                {caucus.purpose && (
                  <p className="text-xs mt-3 text-center" style={{ color: 'rgba(238,217,138,0.5)' }}>{caucus.purpose}</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center px-4 py-5 shrink-0" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
                <p className="text-sm text-center" style={{ color: 'rgba(237,231,216,0.5)' }}>No speaker yet</p>
                {caucus?.purpose && (
                  <p className="text-xs mt-2 text-center" style={{ color: 'rgba(238,217,138,0.4)' }}>{caucus.purpose}</p>
                )}
              </div>
            )
          )}

          {/* Unmoderated caucus — show countdown + purpose */}
          {isUnmoderatedCaucus && (
            <div className="flex flex-col items-center px-4 py-5 shrink-0" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
              <div className="text-5xl font-black font-mono tabular-nums" style={{ color: (caucus?.remainingTime ?? 0) <= 30 ? '#B8844A' : '#EDE7D8' }}>
                {formatTime(caucus?.remainingTime ?? 0)}
              </div>
              <p className="text-xs mt-2 font-mono uppercase tracking-wider" style={{ color: 'rgba(238,217,138,0.5)' }}>
                {caucus?.type === 'consultation' ? advisorMotionNames.consultation :
                 caucus?.type === 'tour' ? advisorMotionNames.tour :
                 advisorMotionNames.unmoderated}
              </p>
              {caucus?.purpose && (
                <p className="text-sm mt-3 text-center" style={{ color: 'rgba(237,231,216,0.7)' }}>{caucus.purpose}</p>
              )}
            </div>
          )}

          {/* GSL — show currentSpeaker */}
          {!isCaucus && (
            committee.currentSpeaker ? (
              <div className="flex flex-col items-center px-4 py-5 shrink-0" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
                {(() => { const c = getCountryByName(committee.currentSpeaker.country); return c ? <img src={getFlagUrl(c.code)} alt={committee.currentSpeaker.country} style={{ width: '80px', height: '58px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid rgba(238,217,138,0.2)' }} /> : null; })()}
                <h2 className="text-2xl font-black mt-3 mb-1 text-center" style={{ color: '#EDE7D8' }}>{committee.currentSpeaker.country}</h2>
                <div className="text-5xl font-black font-mono tabular-nums mt-1" style={{ color: committee.speakerTimeRemaining <= 10 ? '#B8844A' : '#EDE7D8' }}>
                  {formatTime(committee.speakerTimeRemaining)}
                </div>
                <div className="w-full max-w-xs h-1.5 rounded-full overflow-hidden mt-3" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${gslProgress}%`, backgroundColor: '#EED98A' }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center px-4 py-5 shrink-0" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
                <p className="text-sm text-center" style={{ color: 'rgba(237,231,216,0.5)' }}>No current speaker</p>
              </div>
            )
          )}

          {/* Queue */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
              <p className="text-xs font-mono uppercase tracking-wider" style={{ color: 'rgba(238,217,138,0.5)' }}>
                Up Next ({displayQueue.length})
              </p>
            </div>
            {displayQueue.length === 0 ? (
              <div className="px-4 py-4 text-xs" style={{ color: 'rgba(237,231,216,0.4)' }}>No speakers queued</div>
            ) : (
              displayQueue.map((s, i) => {
                const c = getCountryByName(s.country);
                return (
                  <div key={s.delegateId} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(61,122,82,0.2)' }}>
                    <span className="text-xs font-mono w-5 shrink-0" style={{ color: 'rgba(238,217,138,0.5)' }}>{i + 1}</span>
                    {c ? <img src={getFlagUrl(c.code)} alt={s.country} style={{ width: '24px', height: '17px', objectFit: 'cover', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} /> : null}
                    <span className="text-sm flex-1 truncate font-semibold" style={{ color: '#EDE7D8' }}>{s.country}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: All delegates grid */}
        <main className="flex-1 overflow-y-auto p-4">
          {selectedCountry === null ? (
            <>
              <div className="mb-4 text-center">
                <h2 className="text-2xl font-black tracking-wide" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>ALL DELEGATES</h2>
                <p className="text-sm mt-1" style={{ color: '#9A8A78' }}>Click a card to expand delegate details</p>
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
                <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#1B3828', fontWeight: 700 }}>
                  Other Delegates ({otherDelegates.length})
                </p>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
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
