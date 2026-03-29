'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { Committee } from '@/lib/types';
import RollCallPanel from '@/components/RollCallPanel';
import SpeakersListPanel from '@/components/SpeakersListPanel';
import MotionsPanel from '@/components/MotionsPanel';
import CaucusPanel from '@/components/CaucusPanel';
import ResolutionsPanel from '@/components/ResolutionsPanel';
import ChatPanel from '@/components/ChatPanel';

type Tab = 'motions' | 'resolutions' | 'chat';

export default function ChairSession({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { committees } = useCommitteeStore();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [tab, setTab] = useState<Tab>('motions');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const found = Object.values(committees).find((c) => c.code === code.toUpperCase());
    if (found) {
      setCommittee(found);
    }
  }, [committees, code]);

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-white mb-2">Committee not found</h1>
          <p className="text-[#8892aa] mb-6">The session code "{code}" doesn't exist.</p>
          <Link href="/create" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Create a Committee
          </Link>
        </div>
      </div>
    );
  }

  const copyCode = () => {
    navigator.clipboard.writeText(committee.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const presentCount = committee.delegates.filter((d) => d.status !== 'absent').length;
  const totalCount = committee.delegates.length;

  const phaseLabel: Record<string, { label: string; color: string }> = {
    'pre-session': { label: 'Pre-Session', color: 'text-yellow-400' },
    'roll-call': { label: 'Roll Call', color: 'text-orange-400' },
    'speakers-list': { label: 'In Session', color: 'text-green-400' },
    'moderated-caucus': { label: 'Moderated Caucus', color: 'text-blue-400' },
    'unmoderated-caucus': { label: 'Unmoderated Caucus', color: 'text-purple-400' },
    'voting': { label: 'Voting Procedure', color: 'text-yellow-400' },
    'adjourned': { label: 'Adjourned', color: 'text-red-400' },
  };

  const phase = phaseLabel[committee.phase] || { label: committee.phase, color: 'text-white' };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e2540] bg-[#0d1120] px-6 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">M</div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white truncate">{committee.name}</span>
            <span className="text-[#4a5580] text-sm hidden md:block">—</span>
            <span className="text-[#8892aa] text-sm truncate hidden md:block">{committee.topic}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm text-[#8892aa]">
            <span className={`font-bold ${phase.color}`}>● {phase.label}</span>
          </div>
          <div className="text-sm text-[#8892aa]">
            {presentCount}/{totalCount} present
          </div>
          <button
            onClick={copyCode}
            className="flex items-center gap-2 bg-[#1e2540] hover:bg-[#2a3050] text-white px-3 py-1.5 rounded-lg text-sm font-mono transition-colors"
          >
            {copied ? '✓ Copied' : committee.code}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
        {/* Left: Roll call / delegates */}
        <aside className="w-64 border-r border-[#1e2540] bg-[#0d1120] flex flex-col overflow-hidden shrink-0">
          {committee.phase === 'pre-session' || committee.phase === 'roll-call' ? (
            <RollCallPanel committee={committee} />
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-[#1e2540]">
                <div className="text-xs text-[#4a5580] font-mono mb-1">DELEGATION STATUS</div>
                <div className="text-sm text-[#8892aa]">{presentCount}/{totalCount} present</div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {committee.delegates.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#141929]">
                    <span className="text-xs text-[#c0c8d8]">{d.country}</span>
                    <span className={`text-xs font-medium ${
                      d.status === 'present' ? 'text-green-400' :
                      d.status === 'present-voting' ? 'text-blue-400' : 'text-red-400'
                    }`}>
                      {d.status === 'present' ? 'P' : d.status === 'present-voting' ? 'P&V' : 'A'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Center: main session view */}
        <main className="flex-1 overflow-y-auto p-6">
          {committee.phase === 'pre-session' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="text-5xl mb-4">🌐</div>
                <h2 className="text-2xl font-black text-white mb-3">Ready to Begin</h2>
                <p className="text-[#8892aa] mb-6">
                  Committee <strong className="text-white">{committee.name}</strong> is set up with{' '}
                  <strong className="text-white">{totalCount} delegates</strong>.
                </p>
                <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4 mb-6">
                  <div className="text-xs text-[#4a5580] font-mono mb-2">SESSION CODE</div>
                  <div className="text-4xl font-black font-mono text-white tracking-widest">{committee.code}</div>
                  <p className="text-xs text-[#8892aa] mt-2">Share this code with your delegates</p>
                </div>
                <button
                  onClick={() => useCommitteeStore.getState().setPhase(committee.id, 'roll-call')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold text-lg transition-colors"
                >
                  Begin Roll Call →
                </button>
              </div>
            </div>
          )}

          {(committee.phase === 'roll-call') && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-4">📋</div>
                <h2 className="text-2xl font-black text-white mb-2">Roll Call in Progress</h2>
                <p className="text-[#8892aa]">Use the panel on the left to mark delegate attendance.</p>
              </div>
            </div>
          )}

          {committee.phase === 'speakers-list' && !committee.caucus && (
            <SpeakersListPanel committee={committee} />
          )}

          {(committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus') && committee.caucus && (
            <CaucusPanel committee={committee} />
          )}

          {committee.phase === 'voting' && (
            <VotingProcedure committee={committee} />
          )}

          {committee.phase === 'adjourned' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="text-5xl mb-4">🔔</div>
                <h2 className="text-2xl font-black text-white mb-3">Session Adjourned</h2>
                <p className="text-[#8892aa] mb-6">The committee session has been formally adjourned.</p>
                <button
                  onClick={() => useCommitteeStore.getState().setPhase(committee.id, 'speakers-list')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                >
                  Resume Session
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="w-80 border-l border-[#1e2540] bg-[#0d1120] flex flex-col overflow-hidden shrink-0">
          <div className="flex border-b border-[#1e2540]">
            {(['motions', 'resolutions', 'chat'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors ${
                  tab === t
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-[#4a5580] hover:text-[#8892aa]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {tab === 'motions' && <MotionsPanel committee={committee} />}
            {tab === 'resolutions' && <ResolutionsPanel committee={committee} />}
            {tab === 'chat' && <ChatPanel committee={committee} senderName={committee.chairName + ' (Chair)'} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function VotingProcedure({ committee }: { committee: Committee }) {
  const { updateResolutionStatus, setPhase } = useCommitteeStore();
  const [votes, setVotes] = useState<Record<string, { for: number; against: number; abstain: number }>>({});
  const approvedResolutions = committee.resolutions.filter((r) => r.status === 'approved');
  const presentVoting = committee.delegates.filter((d) => d.status !== 'absent').length;

  const castVote = (resId: string, field: 'for' | 'against' | 'abstain', value: number) => {
    setVotes((v) => ({ ...v, [resId]: { ...{ for: 0, against: 0, abstain: 0 }, ...v[resId], [field]: value } }));
  };

  const finalizeVote = (resId: string) => {
    const v = votes[resId] || { for: 0, against: 0, abstain: 0 };
    const passed = v.for > v.against;
    updateResolutionStatus(committee.id, resId, passed ? 'passed' : 'failed');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Voting Procedure</h2>
          <p className="text-[#8892aa] text-sm mt-1">{presentVoting} delegates present and voting</p>
        </div>
        <button
          onClick={() => setPhase(committee.id, 'speakers-list')}
          className="text-sm text-[#8892aa] hover:text-white border border-[#1e2540] px-4 py-2 rounded-lg transition-colors"
        >
          ← Return to Debate
        </button>
      </div>

      {approvedResolutions.length === 0 ? (
        <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-8 text-center">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-[#8892aa]">No approved resolutions to vote on.</p>
          <p className="text-[#4a5580] text-sm mt-1">Approve resolutions in the Resolutions panel first.</p>
        </div>
      ) : (
        approvedResolutions.map((res) => {
          const v = votes[res.id] || { for: 0, against: 0, abstain: 0 };
          const total = v.for + v.against + v.abstain;
          const isFinalized = res.status === 'passed' || res.status === 'failed';
          return (
            <div key={res.id} className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-1">{res.title}</h3>
              <p className="text-sm text-[#8892aa] mb-4">Sponsors: {res.sponsors.join(', ')}</p>
              {isFinalized ? (
                <div className={`text-center py-4 rounded-xl ${res.status === 'passed' ? 'bg-green-950/40 border border-green-800/40' : 'bg-red-950/40 border border-red-800/40'}`}>
                  <div className={`text-3xl font-black ${res.status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>
                    {res.status === 'passed' ? '✓ PASSED' : '✗ FAILED'}
                  </div>
                  <div className="text-sm text-[#8892aa] mt-2">
                    For: {v.for} · Against: {v.against} · Abstain: {v.abstain}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {(['for', 'against', 'abstain'] as const).map((field) => (
                      <div key={field}>
                        <label className={`block text-sm font-semibold mb-2 ${
                          field === 'for' ? 'text-green-400' : field === 'against' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                          {field.charAt(0).toUpperCase() + field.slice(1)}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={presentVoting}
                          value={v[field]}
                          onChange={(e) => castVote(res.id, field, parseInt(e.target.value) || 0)}
                          className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2.5 text-white text-lg font-bold text-center focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    ))}
                  </div>
                  {total > 0 && (
                    <div className="flex h-3 rounded-full overflow-hidden">
                      {v.for > 0 && <div className="bg-green-500 transition-all" style={{ width: `${(v.for / total) * 100}%` }} />}
                      {v.against > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(v.against / total) * 100}%` }} />}
                      {v.abstain > 0 && <div className="bg-yellow-500 transition-all" style={{ width: `${(v.abstain / total) * 100}%` }} />}
                    </div>
                  )}
                  <button
                    onClick={() => finalizeVote(res.id)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition-colors"
                  >
                    Finalize Vote
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
