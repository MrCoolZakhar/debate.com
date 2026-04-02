'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { Committee, CommitteeDocument } from '@/lib/types';
import { getCountryByName, getFlagEmoji } from '@/lib/countries';

type VoteChoice = 'for' | 'against' | 'for-rights' | 'against-rights';
interface DelegateVote {
  delegateId: string;
  country: string;
  choice: VoteChoice;
}

type VotingPhase = 'roll-call' | 'rights-speakers' | 'result';

function getFlag(country: string) {
  const found = getCountryByName(country);
  return found ? getFlagEmoji(found.code) : '🌐';
}

export default function VotingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { committees } = useCommitteeStore();

  const [committee, setCommittee] = useState<Committee | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [votes, setVotes] = useState<DelegateVote[]>([]);
  const [phase, setPhase] = useState<VotingPhase>('roll-call');
  const [rightsIndex, setRightsIndex] = useState(0);

  useEffect(() => {
    const found = Object.values(committees).find((c) => c.code === code.toUpperCase());
    if (found) setCommittee(found);
  }, [committees, code]);

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-white mb-2">Committee not found</h1>
          <p className="text-[#C4A882] mb-6">Code "{code}" is invalid or the session ended.</p>
          <Link href="/" className="bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const introducedDRs = (committee.documents ?? []).filter(
    (d) => d.type === 'draft-resolution' && d.status === 'introduced'
  );

  const selectedDoc = introducedDRs.find((d) => d.id === selectedDocId) ?? introducedDRs[0] ?? null;

  const presentDelegates = committee.delegates
    .filter((d) => d.status !== 'absent')
    .sort((a, b) => a.country.localeCompare(b.country));

  const votedIds = new Set(votes.map((v) => v.delegateId));

  const forCount = votes.filter((v) => v.choice === 'for' || v.choice === 'for-rights').length;
  const againstCount = votes.filter((v) => v.choice === 'against' || v.choice === 'against-rights').length;
  const withRights = votes
    .filter((v) => v.choice === 'for-rights' || v.choice === 'against-rights')
    .sort((a, b) => a.country.localeCompare(b.country));

  const allVoted = votes.length === presentDelegates.length;

  const castVote = (delegateId: string, country: string, choice: VoteChoice) => {
    setVotes((prev) => {
      const existing = prev.find((v) => v.delegateId === delegateId);
      if (existing) {
        return prev.map((v) => v.delegateId === delegateId ? { ...v, choice } : v);
      }
      return [...prev, { delegateId, country, choice }];
    });
  };

  const startNewVote = (docId: string) => {
    setSelectedDocId(docId);
    setVotes([]);
    setPhase('roll-call');
    setRightsIndex(0);
  };

  const handleFinishRollCall = () => {
    if (withRights.length > 0) {
      setPhase('rights-speakers');
      setRightsIndex(0);
    } else {
      setPhase('result');
    }
  };

  const handleNextRightsSpeaker = () => {
    if (rightsIndex + 1 >= withRights.length) {
      setPhase('result');
    } else {
      setRightsIndex((i) => i + 1);
    }
  };

  const passed = forCount > againstCount;

  return (
    <div className="min-h-screen bg-[#0D0906] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2E1E0F] bg-[#150F08] px-6 h-14 flex items-center gap-4 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <img src="/gavelling-logo.png" alt="Gavelling" className="h-8 w-auto" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm truncate">{committee.name}</div>
          <div className="text-xs text-[#7A5A38] truncate">Draft Resolution Voting</div>
        </div>
        <span className="text-xs font-mono font-bold text-[#7B4A1E] bg-[#2E1E0F] px-2 py-1 rounded">{committee.code}</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — DR list */}
        <aside className="w-80 shrink-0 border-r border-[#2E1E0F] bg-[#120D07] flex flex-col overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-mono text-[#7A5A38] mb-3">INTRODUCED DRAFT RESOLUTIONS</p>
            {introducedDRs.length === 0 ? (
              <p className="text-sm text-[#7A5A38] text-center py-8">No introduced draft resolutions.</p>
            ) : (
              <div className="space-y-2">
                {introducedDRs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => startNewVote(doc.id)}
                    className={`w-full text-left px-3 py-3 rounded-xl border transition-colors ${
                      (selectedDoc?.id === doc.id)
                        ? 'bg-[#7B4A1E]/20 border-[#7B4A1E]/60 text-white'
                        : 'bg-[#1A1209] border-[#2E1E0F] text-[#C4A882] hover:border-[#7B4A1E]/40'
                    }`}
                  >
                    <span className="text-xs font-mono font-bold text-[#7B4A1E] block">{doc.docCode}</span>
                    <span className="text-sm font-semibold leading-snug block mt-0.5">{doc.title}</span>
                    {doc.sponsors.length > 0 && (
                      <span className="text-xs text-[#7A5A38] block mt-1">Sponsors: {doc.sponsors.join(', ')}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-auto px-4 pb-4 pt-2">
            <button
              onClick={() => router.back()}
              className="w-full text-xs text-[#7A5A38] hover:text-[#C4A882] transition-colors py-2"
            >
              ← Back to Chair Session
            </button>
          </div>
        </aside>

        {/* Right panel — voting UI */}
        <main className="flex-1 overflow-y-auto p-6">
          {!selectedDoc ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-5xl mb-4">🗳️</div>
                <p className="text-[#C4A882] font-semibold text-lg">Select a Draft Resolution</p>
                <p className="text-sm text-[#7A5A38] mt-1">Choose from the left panel to begin voting.</p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Document header */}
              <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <span className="text-xs font-mono font-bold text-[#7B4A1E]">{selectedDoc.docCode}</span>
                    <h2 className="text-lg font-black text-white mt-1">{selectedDoc.title}</h2>
                    {selectedDoc.sponsors.length > 0 && (
                      <p className="text-sm text-[#C4A882] mt-1">Sponsors: {selectedDoc.sponsors.join(', ')}</p>
                    )}
                  </div>
                </div>

                {/* Live tally */}
                <div className="mt-4 flex items-center gap-4 text-sm">
                  <span className="text-green-400 font-bold">✓ {forCount} For</span>
                  <span className="text-red-400 font-bold">✗ {againstCount} Against</span>
                  <span className="text-amber-400 font-bold">★ {withRights.length} w/ Rights</span>
                  <span className="text-[#7A5A38]">{votes.length}/{presentDelegates.length} voted</span>
                </div>
              </div>

              {/* Phase: Roll Call */}
              {phase === 'roll-call' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#C4A882] font-mono">ROLL CALL VOTE</h3>
                  {presentDelegates.map((delegate) => {
                    const vote = votes.find((v) => v.delegateId === delegate.id);
                    const voted = !!vote;
                    return (
                      <div
                        key={delegate.id}
                        className={`bg-[#1A1209] border rounded-xl p-3 flex items-center gap-3 transition-opacity ${voted ? 'opacity-60 border-[#2E1E0F]' : 'border-[#2E1E0F]'}`}
                      >
                        <span className="text-sm font-bold text-white flex-1 flex items-center gap-2">
                          {getFlag(delegate.country)} {delegate.country}
                        </span>
                        {voted ? (
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            vote.choice === 'for' ? 'bg-green-900/40 text-green-400' :
                            vote.choice === 'against' ? 'bg-red-900/40 text-red-400' :
                            vote.choice === 'for-rights' ? 'bg-amber-900/40 text-amber-400' :
                            'bg-amber-900/20 text-amber-300 border border-amber-700/40'
                          }`}>
                            {vote.choice === 'for' ? '✓ For' :
                             vote.choice === 'against' ? '✗ Against' :
                             vote.choice === 'for-rights' ? '★ For w/ Rights' : '★ Against w/ Rights'}
                          </span>
                        ) : (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => castVote(delegate.id, delegate.country, 'for')}
                              className="bg-green-900/30 hover:bg-green-800/50 border border-green-700/40 text-green-400 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                            >For</button>
                            <button
                              onClick={() => castVote(delegate.id, delegate.country, 'against')}
                              className="bg-red-900/30 hover:bg-red-800/50 border border-red-700/40 text-red-400 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                            >Against</button>
                            <button
                              onClick={() => castVote(delegate.id, delegate.country, 'for-rights')}
                              className="bg-amber-900/30 hover:bg-amber-800/50 border border-amber-700/40 text-amber-400 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                            >For w/ Rights</button>
                            <button
                              onClick={() => castVote(delegate.id, delegate.country, 'against-rights')}
                              className="bg-amber-900/10 hover:bg-amber-900/30 border border-amber-700/30 text-amber-300 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                            >Against w/ Rights</button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {allVoted && (
                    <button
                      onClick={handleFinishRollCall}
                      className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-3.5 rounded-xl font-bold transition-colors mt-2"
                    >
                      {withRights.length > 0 ? `Proceed to Rights Speakers (${withRights.length})` : 'See Final Result →'}
                    </button>
                  )}
                </div>
              )}

              {/* Phase: Rights Speakers */}
              {phase === 'rights-speakers' && withRights.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[#C4A882] font-mono">RIGHTS SPEAKERS</h3>
                  <p className="text-xs text-[#7A5A38]">
                    {rightsIndex + 1} of {withRights.length} delegates speaking with rights
                  </p>

                  <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-2xl p-6 text-center">
                    <div className="text-4xl mb-3">{getFlag(withRights[rightsIndex].country)}</div>
                    <p className="text-xl font-black text-white">{withRights[rightsIndex].country}</p>
                    <p className="text-sm text-amber-400 mt-1">
                      {withRights[rightsIndex].choice === 'for-rights' ? '★ For with Rights' : '★ Against with Rights'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {withRights.map((v, i) => (
                      <div
                        key={v.delegateId}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${i === rightsIndex ? 'bg-amber-900/20 border border-amber-700/30' : i < rightsIndex ? 'opacity-40' : ''}`}
                      >
                        <span className="text-[#7A5A38] text-xs w-4 font-mono">{i + 1}</span>
                        <span className="text-white">{getFlag(v.country)} {v.country}</span>
                        {i < rightsIndex && <span className="text-xs text-[#7A5A38] ml-auto">Done</span>}
                        {i === rightsIndex && <span className="text-xs text-amber-400 ml-auto font-bold">Speaking</span>}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleNextRightsSpeaker}
                    className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-3.5 rounded-xl font-bold transition-colors"
                  >
                    {rightsIndex + 1 < withRights.length ? 'Next Rights Speaker →' : 'See Final Result →'}
                  </button>
                </div>
              )}

              {/* Phase: Result */}
              {phase === 'result' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[#C4A882] font-mono">FINAL RESULT</h3>

                  <div className={`rounded-2xl border p-8 text-center ${passed ? 'bg-green-950/30 border-green-700/40' : 'bg-red-950/30 border-red-700/40'}`}>
                    <div className={`text-5xl font-black mb-2 ${passed ? 'text-green-400' : 'text-red-400'}`}>
                      {passed ? '✓ PASSED' : '✗ FAILED'}
                    </div>
                    <p className="text-lg font-bold text-white mt-1">{selectedDoc.title}</p>
                    <div className="flex justify-center gap-8 mt-6 text-sm">
                      <div className="text-center">
                        <div className="text-3xl font-black text-green-400">{forCount}</div>
                        <div className="text-[#C4A882] mt-1">For</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-black text-red-400">{againstCount}</div>
                        <div className="text-[#C4A882] mt-1">Against</div>
                      </div>
                      {withRights.length > 0 && (
                        <div className="text-center">
                          <div className="text-3xl font-black text-amber-400">{withRights.length}</div>
                          <div className="text-[#C4A882] mt-1">w/ Rights</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => router.back()}
                    className="w-full bg-[#2E1E0F] hover:bg-[#3E2A1A] border border-[#2E1E0F] text-[#C4A882] py-3.5 rounded-xl font-bold transition-colors"
                  >
                    ← Back to Chair Session
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
