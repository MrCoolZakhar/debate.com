'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Committee, CommitteeDocument, DocumentType, DocumentStatus } from '@/lib/types';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';
import { useSettingsStore } from '@/lib/settingsStore';
import {
  addDocument as addDocumentInDB,
  updateDocumentStatus as updateDocumentStatusInDB,
  updateDocumentTimings as updateDocumentTimingsInDB,
  removeDocument as removeDocumentInDB,
  suspendDebate as suspendDebateInDB,
} from '@/lib/committeeService';

type DocTab = 'working-paper' | 'draft-resolution';
// Flow stages for the fullscreen presentation experience
type PresentationStage = 'setup' | 'reading' | 'presentation' | 'qa' | 'vote' | null;

const STATUS_META: Record<DocumentStatus, { label: string; color: string }> = {
  submitted:   { label: 'Submitted',  color: 'bg-[#1B3828]/20 text-[#1B3828] border-[#1B3828]/30' },
  'on-floor':  { label: 'On Floor',   color: 'bg-transparent text-[#B8844A] border-[#B8844A]/50' },
  introduced:  { label: 'Introduced', color: 'bg-transparent text-[#B8844A] border-[#B8844A]/50' },
  passed:      { label: 'Passed',     color: 'bg-[#1B3828] text-[#EED98A] border-[#1B3828]' },
  failed:      { label: 'Failed',     color: 'bg-red-950/40 text-red-500 border-red-800/40' },
};

const STATUS_NEXT: Partial<Record<DocumentStatus, DocumentStatus>> = {
  submitted: 'on-floor', 'on-floor': 'introduced', introduced: 'passed',
};

function StatusBadge({ status }: { status: DocumentStatus }) {
  const meta = STATUS_META[status];
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>{meta.label}</span>;
}

function CountryChip({ country, onRemove }: { country: string; onRemove: () => void }) {
  const found = getCountryByName(country);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DDD4C0] border border-[#DDD4C0] rounded-full text-xs text-[#1C1410]">
      {found ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-4 h-4 object-contain inline-block mr-1" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : '🌐'}{country}
      <button onClick={onRemove} className="text-[#9A8A78] hover:text-red-500 ml-0.5 leading-none">✕</button>
    </span>
  );
}

function SponsorSelect({ candidates, selected, onChange }: {
  candidates: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const available = candidates.filter((c) => !selected.includes(c) && c.toLowerCase().includes(query.toLowerCase()));
  const add = (country: string) => { onChange([...selected, country]); setQuery(''); };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); if (available.length > 0) add(available[0]); }
  };
  return (
    <div>
      <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">Sponsors <span className="text-red-500">*</span></label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {selected.map((c) => <CountryChip key={c} country={c} onRemove={() => onChange(selected.filter((s) => s !== c))} />)}
      </div>
      <div className="relative">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Type to filter delegates, Enter to add…"
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 text-[#1C1410] placeholder-[#9A8A78] text-sm focus:outline-none focus:border-[#1B3828] transition-colors" />
        {query && available.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-20 shadow-lg max-h-36 overflow-y-auto">
            {available.slice(0, 6).map((c, i) => {
              const found = getCountryByName(c);
              return (
                <button key={c} onMouseDown={(e) => { e.preventDefault(); add(c); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                  {found ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <span>🌐</span>}
                  <span className="text-sm">{c}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function autoDocCode(type: DocumentType, existingDocs: CommitteeDocument[]): string {
  const prefix = type === 'working-paper' ? 'WP' : 'DR';
  const sep = type === 'working-paper' ? '.' : '/';
  return `${prefix} 1${sep}${existingDocs.filter((d) => d.type === type).length + 1}`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60); const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Countdown Timer (reading / presentation / Q&A) ────────────────────────────
function StageTimer({
  label, color, totalSeconds, doc, showDocument,
  onComplete, onToggleDocument, onBack,
}: {
  label: React.ReactNode; color: string; totalSeconds: number;
  doc: CommitteeDocument; showDocument: boolean;
  onComplete: () => void; onToggleDocument: () => void; onBack: () => void;
}) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const remainingRef = useRef(totalSeconds);
  remainingRef.current = remaining;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        if (remainingRef.current <= 0) { setRunning(false); return; }
        setRemaining((r) => Math.max(0, r - 1));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const done = remaining === 0;
  const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 100;

  return (
    <div className={`flex-1 flex ${showDocument ? 'flex-row items-stretch' : 'flex-col items-center justify-center px-8 py-8 text-center'}`}>
      <div className={`flex flex-col items-center justify-center text-center ${showDocument ? 'w-1/2 px-6 py-8 border-r border-[#DDD4C0]' : 'w-full px-8 py-8'}`}>
      <p className="text-xs font-mono tracking-widest mb-2" style={{ color: '#9A8A78' }}>
        {doc.type === 'working-paper' ? 'WORKING PAPER' : 'DRAFT RESOLUTION'} · {doc.docCode}
      </p>
      <h2 className="text-2xl font-black mb-1" style={{ color: '#1C1410' }}>{doc.title}</h2>
      <p className="text-xs font-black mb-6 mt-1 tracking-widest uppercase" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>{label}</p>

      {!done ? (
        <>
          <div className="text-8xl font-black font-mono tabular-nums mb-4" style={{ color: remaining <= 30 ? '#B8844A' : '#1C1410' }}>
            {formatTime(remaining)}
          </div>
          <div className="w-full max-w-sm h-2 bg-[#DDD4C0] rounded-full overflow-hidden mb-8">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: '#1B3828' }} />
          </div>
          <div className="flex gap-3 flex-wrap justify-center items-center">
            <button onClick={onBack}
              className="w-10 h-10 rounded-xl font-bold transition-colors focus:outline-none flex items-center justify-center"
              style={{ backgroundColor: 'transparent', color: '#6A5A4A', border: '1px solid #DDD4C0' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#6A5A4A'; }}
              title="Back">
              ←
            </button>
            <button onClick={() => { setRunning((r) => !r); setStarted(true); }}
              className="px-8 py-3 rounded-xl font-bold transition-colors focus:outline-none"
              style={{ backgroundColor: running ? '#B8844A' : '#2A5A3C', color: 'white', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="flex gap-[3px]"><span className="w-[3px] h-[13px] rounded-sm bg-white inline-block" /><span className="w-[3px] h-[13px] rounded-sm bg-white inline-block" /></span>
                  PAUSE
                </span>
              ) : started ? '▶ RESUME' : '▶ START'}
            </button>
            <button onClick={onToggleDocument}
              className="px-5 py-3 rounded-xl font-bold transition-colors focus:outline-none text-sm"
              style={{ backgroundColor: showDocument ? '#1B3828' : 'transparent', color: showDocument ? 'white' : '#6A5A4A', border: showDocument ? 'none' : '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif" }}
              onMouseEnter={(e) => { if (!showDocument) { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; } }}
              onMouseLeave={(e) => { if (!showDocument) { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#6A5A4A'; } }}>
              {showDocument ? 'HIDE DOC' : 'SHOW DOC'}
            </button>
            <button onClick={onComplete}
              className="w-10 h-10 rounded-xl font-bold transition-colors focus:outline-none flex items-center justify-center"
              style={{ backgroundColor: 'transparent', color: '#6A5A4A', border: '1px solid #DDD4C0' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#6A5A4A'; }}
              title="Skip">
              →
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-lg mb-8" style={{ color: '#6A5A4A' }}>{label} complete.</p>
          <button onClick={onComplete}
            className="px-10 py-4 rounded-2xl font-black text-lg transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828', color: 'white' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}>
            CONTINUE →
          </button>
        </>
      )}

      </div>

      {showDocument && (
        <div className="w-1/2 flex flex-col p-4 overflow-hidden">
          {doc.fileUrl ? (
            <iframe
              src={doc.fileUrl}
              title={doc.title}
              className="flex-1 w-full rounded-xl border border-[#DDD4C0]"
              style={{ minHeight: 0 }}
            />
          ) : doc.content ? (
            <div className="flex-1 overflow-y-auto bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-mono font-bold text-[#1B3828]">{doc.docCode}</span>
                <span className="text-sm font-bold text-[#1C1410]">{doc.title}</span>
              </div>
              <pre className="text-sm text-[#1C1410] whitespace-pre-wrap font-sans leading-relaxed">{doc.content}</pre>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl">
              <p className="text-[#9A8A78] text-sm text-center px-6">No document content saved.<br/>Delegates can view via shared file.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Document Vote Screen (DR only) ────────────────────────────────────────────
function DocumentVote({ doc, committee, onDone, onStatusChange }: {
  doc: CommitteeDocument; committee: Committee;
  onDone: () => void; onStatusChange: (docId: string, status: DocumentStatus) => void;
}) {
  const router = useRouter();
  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const [forVotes, setFor] = useState(0);
  const [against, setAgainst] = useState(0);
  const [abstain, setAbstain] = useState(0);
  const [result, setResult] = useState<'passed' | 'failed' | null>(null);
  const [showProceedPanel, setShowProceedPanel] = useState(false);
  const [suspendProposer, setSuspendProposer] = useState('');
  const [showSuspendVote, setShowSuspendVote] = useState(false);
  const [showSuspended, setShowSuspended] = useState(false);
  const needed = Math.floor(present / 2) + 1;

  useEffect(() => {
    if (!showSuspended) return;
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') router.push('/'); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSuspended, router]);

  const finalize = () => {
    const r = forVotes > against ? 'passed' : 'failed';
    setResult(r);
    onStatusChange(doc.id, r);
  };

  // Suspend vote prompt
  if (showSuspendVote && !showSuspended) {
    return (
      <div className="fixed inset-0 z-[70] bg-[#F6F1E9] flex flex-col items-center justify-center text-center px-8">
        <p className="text-xs font-mono tracking-widest text-[#9A8A78] mb-6">MOTION TO SUSPEND DEBATE · {suspendProposer}</p>
        <h1 className="text-4xl font-black mb-14 tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>DOES THIS MOTION PASS?</h1>
        <div className="flex gap-8">
          <button
            onClick={async () => {
              await suspendDebateInDB(committee.id);
              setShowSuspended(true);
            }}
            className="px-16 py-8 rounded-3xl text-white text-2xl font-black transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}>
            YES
          </button>
          <button
            onClick={() => { setShowSuspendVote(false); setShowProceedPanel(false); }}
            className="px-16 py-8 rounded-3xl text-white text-2xl font-black transition-colors focus:outline-none" style={{ backgroundColor: '#8B2020', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#7A1C1C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}>
            NO
          </button>
        </div>
      </div>
    );
  }

  if (showSuspended) {
    return (
      <div className="fixed inset-0 z-[70] bg-[#F6F1E9] flex flex-col items-center justify-center text-center px-8">
        <h1 className="text-6xl font-black text-[#1C1410] mb-4">Session is now suspended.</h1>
        <p className="text-4xl font-black text-[#1C1410] mb-16">See you again soon!</p>
        <p className="text-lg text-[#1C1410]/40">— Press ESC to go back to main menu</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
      <p className="text-xs font-mono tracking-widest mb-2 text-[#9A8A78]">{doc.docCode} · VOTE</p>
      <h2 className="text-2xl font-black text-[#1C1410] mb-1">{doc.title}</h2>
      <p className="text-sm text-[#6A5A4A] mb-8">Needs {needed} of {present} in favour to pass</p>
      {result ? (
        <>
          <div className={`w-full max-w-sm px-8 py-10 rounded-2xl ${result === 'passed' ? 'bg-green-950/40 border border-green-800/40' : 'bg-red-950/40 border border-red-800/40'}`}>
            <p className={`text-4xl font-black mb-2 ${result === 'passed' ? 'text-green-400' : 'text-red-400'}`}>{result === 'passed' ? '✓ PASSED' : '✗ FAILED'}</p>
            <p className="text-sm text-[#6A5A4A]">{forVotes} for · {against} against · {abstain} abstain</p>
            <button onClick={onDone} className="mt-6 px-8 py-3 rounded-xl font-bold bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#1C1410] transition-colors">← Back to Documents</button>
          </div>
          <button
            onClick={() => setShowProceedPanel(true)}
            className="mt-6 text-sm text-[#1C1410]/40 hover:text-[#1C1410]/70 transition-colors">
            Click to proceed with Session.
          </button>

          {/* Proceed with Session panel */}
          {showProceedPanel && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)' }}>
              <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-3xl w-full max-w-md shadow-2xl p-8 space-y-6">
                <h2 className="text-2xl font-black text-[#1C1410]">Proceed with Session</h2>

                <div className="bg-[#FAF8F3] border border-[#DDD4C0] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⏸️</span>
                    <span className="text-base font-bold text-[#1C1410]">Motion to Suspend Debate</span>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#6A5A4A] mb-2">Proposed by</label>
                    <input
                      type="text"
                      value={suspendProposer}
                      onChange={(e) => setSuspendProposer(e.target.value)}
                      placeholder="Country name…"
                      className="w-full bg-[#F6F1E9] border border-[#DDD4C0] focus:border-[#1B3828] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => { if (suspendProposer.trim()) setShowSuspendVote(true); }}
                    disabled={!suspendProposer.trim()}
                    className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-3 rounded-xl font-bold transition-colors">
                    Raise Motion →
                  </button>
                </div>

                <button
                  onClick={() => setShowProceedPanel(false)}
                  className="w-full py-3 rounded-xl font-bold text-[#6A5A4A] hover:text-[#1C1410] border border-[#DDD4C0] hover:border-[#1B3828] transition-colors">
                  Go back to Session
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full max-w-sm space-y-4">
          {[
            { label: 'In Favour', value: forVotes, set: setFor, color: 'text-green-400' },
            { label: 'Against', value: against, set: setAgainst, color: 'text-red-400' },
            { label: 'Abstain', value: abstain, set: setAbstain, color: 'text-yellow-400' },
          ].map(({ label, value, set, color }) => (
            <div key={label} className="flex items-center justify-between bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl px-4 py-3">
              <span className={`font-bold text-sm ${color}`}>{label}</span>
              <div className="flex items-center gap-3">
                <button onClick={() => set((v) => Math.max(0, v - 1))} className="w-8 h-8 rounded-full bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#1C1410] font-bold flex items-center justify-center">−</button>
                <span className="text-2xl font-black text-[#1C1410] w-8 text-center">{value}</span>
                <button onClick={() => set((v) => v + 1)} className="w-8 h-8 rounded-full bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#1C1410] font-bold flex items-center justify-center">+</button>
              </div>
            </div>
          ))}
          <button onClick={finalize} className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-4 rounded-2xl font-black text-base transition-colors mt-2">Finalize Vote →</button>
        </div>
      )}
    </div>
  );
}

// ── Submit Form ───────────────────────────────────────────────────────────────
function SubmitForm({ committee, type, onDone, onDocumentAdded }: {
  committee: Committee; type: DocumentType; onDone: () => void;
  onDocumentAdded: (doc: CommitteeDocument) => void;
}) {
  const { getSettings } = useSettingsStore();
  const settings = getSettings(committee.code);
  const existingCount = (committee.documents ?? []).filter((d) => d.type === type).length;
  const limit = type === 'working-paper' ? settings.wpSubmissionLimit : settings.drSubmissionLimit;
  const limitReached = limit !== null && existingCount >= limit;

  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  const [title, setTitle] = useState('');
  const [sponsors, setSponsors] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docCode = autoDocCode(type, committee.documents ?? []);
  const canSubmit = !limitReached && title.trim() && sponsors.length > 0 && !!fileUrl;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setFileUrl(reader.result as string); setFileName(file.name); };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const newDoc: Omit<CommitteeDocument, 'id' | 'submittedAt'> = {
      type, docCode, title: title.trim(), sponsors, content: content.trim(), status: 'submitted',
      ...(fileUrl && fileName ? { fileUrl, fileName } : {}),
    };
    // Insert first to get the real UUID back — never use temp IDs for DB operations
    const saved = await addDocumentInDB(committee.id, newDoc);
    if (saved) {
      onDocumentAdded(saved);
    }
    onDone();
  };

  return (
    <div className="space-y-4 px-7 pb-7">
      <div className="flex flex-col items-center gap-1 relative">
        <button onClick={onDone} className="absolute left-0 top-1/2 -translate-y-1/2 text-sm transition-colors focus:outline-none" style={{ color: '#9A8A78' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}>← Back</button>
        <h2 className="text-xl font-black text-center uppercase tracking-wide" style={{ color: '#1B3828' }}>
          {type === 'working-paper' ? 'SUBMIT WORKING PAPER' : 'SUBMIT DRAFT RESOLUTION'}
        </h2>
      </div>
      <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl px-4 py-2.5">
        <span className="text-xs text-[#9A8A78] font-mono">DOCUMENT CODE</span>
        <span className="ml-3 text-sm font-bold text-[#1C1410] font-mono">{docCode}</span>
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">Title <span className="text-red-500">*</span></label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Strengthening international cooperation on…"
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors" />
      </div>
      <SponsorSelect candidates={presentCountries} selected={sponsors} onChange={setSponsors} />
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">Google Docs Link <span className="text-[#9A8A78] font-normal">(Optional)</span></label>
        <input type="text" value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="https://docs.google.com/..."
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors text-sm" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">Attachment <span className="text-red-500">*</span></label>
        {fileName ? (
          <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3">
            <span className="text-sm text-[#1C1410] flex-1 truncate">📎 {fileName}</span>
            <button onClick={() => { setFileName(null); setFileUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="text-[#9A8A78] hover:text-red-500 transition-colors text-sm">✕</button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-full bg-[#FAF8F3] border border-dashed border-[#DDD4C0] hover:border-[#1B3828] rounded-xl px-4 py-3 text-[#9A8A78] hover:text-[#6A5A4A] text-sm transition-colors text-left">
            + Upload PDF
          </button>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
      </div>
      {limitReached && (
        <p className="text-xs text-red-400 text-center">
          Limit reached ({existingCount}/{limit}) — no more {type === 'working-paper' ? 'working papers' : 'draft resolutions'} can be submitted.
        </p>
      )}
      <button onClick={handleSubmit} disabled={!canSubmit}
        className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-3.5 rounded-xl font-bold transition-colors">
        {limitReached ? `Limit reached (${existingCount}/${limit})` : 'Submit Document'}
      </button>
    </div>
  );
}

// ── Timing Setup Dialog ───────────────────────────────────────────────────────
function TimingSetup({ doc, onStart, onSkip }: {
  doc: CommitteeDocument;
  onStart: (readingMins: number, presentationMins: number, qaMins: number) => void;
  onSkip: () => void;
}) {
  const isWP = doc.type === 'working-paper';
  const [readingMins, setReadingMins] = useState(5);
  const [presentationMins, setPresentationMins] = useState(5);
  const [qaMins, setQaMins] = useState(isWP ? 0 : 3);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
      <p className="text-xs font-mono tracking-widest mb-2 text-[#9A8A78]">{doc.docCode} · SET UP TIMERS</p>
      <h2 className="text-2xl font-black text-[#1C1410] mb-1">{doc.title}</h2>
      <p className="text-sm text-[#6A5A4A] mb-8">
        {isWP ? 'Working Paper: Reading → Presentation → Q&A → Auto Pass' : 'Draft Resolution: Reading → Presentation → Q&A → Vote'}
      </p>

      <div className="w-full max-w-sm space-y-4">
        {[
          { key: 'reading', label: 'READING TIME', value: readingMins, set: setReadingMins, note: 'Delegates read the document' },
          { key: 'presentation', label: 'PRESENTATION', value: presentationMins, set: setPresentationMins, note: 'Sponsors present the document' },
          { key: 'qa', label: 'Q&A', value: qaMins, set: setQaMins, note: isWP ? 'Optional for Working Papers' : 'Questions from delegates' },
        ].map(({ key, label, value, set, note }) => (
          <div key={key} className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-black text-sm" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>{label}</span>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={60}
                  value={value === 0 ? '' : value}
                  onChange={(e) => set(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                  onBlur={(e) => { if (e.target.value === '') set(0); }}
                  className="w-16 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1 text-[#1C1410] text-sm text-center focus:outline-none focus:border-[#1B3828]" />
                <span className="text-sm text-[#9A8A78]">min</span>
              </div>
            </div>
            <p className="text-xs text-[#9A8A78]">{note}</p>
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <button onClick={() => onStart(readingMins, presentationMins, qaMins)}
            className="flex-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-3.5 rounded-2xl font-black transition-colors focus:outline-none" style={{ letterSpacing: '0.05em' }}>
            START →
          </button>
          <button onClick={onSkip}
            className="px-6 py-3.5 rounded-2xl font-bold bg-transparent border border-[#DDD4C0] hover:border-[#1B3828] transition-colors focus:outline-none" style={{ color: '#6A5A4A' }}>
            SKIP
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Doc Card ──────────────────────────────────────────────────────────────────
function DocCard({ doc, committee, onStatusChange, onRemove, onStartPresentation }: {
  doc: CommitteeDocument; committee: Committee;
  onStatusChange: (docId: string, status: DocumentStatus) => void;
  onRemove: (docId: string) => void;
  onStartPresentation: (doc: CommitteeDocument) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const nextStatus = STATUS_NEXT[doc.status];
  const needsPresentation = nextStatus === 'introduced';

  const handleAdvance = () => {
    if (!nextStatus) return;
    if (needsPresentation) onStartPresentation(doc);
    else onStatusChange(doc.id, nextStatus);
  };

  return (
    <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono font-bold text-[#1B3828]">{doc.docCode}</span>
            <StatusBadge status={doc.status} />
          </div>
          <p className="text-sm font-bold text-[#1C1410] leading-snug">{doc.title}</p>
        </div>
        <button onClick={() => onRemove(doc.id)} className="text-[#9A8A78] hover:text-red-500 transition-colors text-sm shrink-0 focus:outline-none" title="Delete">✕</button>
      </div>
      <div className="text-xs text-[#6A5A4A]"><span className="font-semibold">Sponsors: </span>{doc.sponsors.join(', ') || '—'}</div>
      {doc.readingMinutes && <div className="text-xs flex items-center gap-1 flex-wrap" style={{ color: '#1C1410' }}>{doc.readingMinutes}m reading{doc.presentationMinutes ? ` · ${doc.presentationMinutes}m presentation` : ''}{doc.qaMinutes ? ` · ${doc.qaMinutes}m Q&A` : ''}</div>}
      {doc.fileUrl && doc.fileName && (
        <div className="text-xs space-y-2">
          <button onClick={() => setShowPdf((v) => !v)} className="transition-colors focus:outline-none" style={{ color: '#1B3828' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}>
            📎 {doc.fileName} {showPdf ? '▲' : '▼'}
          </button>
          {showPdf && (
            <iframe src={doc.fileUrl} title={doc.fileName} className="w-full rounded-lg border border-[#DDD4C0]" style={{ height: '480px' }} />
          )}
        </div>
      )}
      {doc.content && (
        <div>
          <button onClick={() => setExpanded((v) => !v)} className="text-xs text-[#1B3828] hover:text-[#6A5A4A] transition-colors">
            {expanded ? '▲ Hide content' : '▼ Show content'}
          </button>
          {expanded && <pre className="mt-2 text-xs text-[#1C1410] bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">{doc.content}</pre>}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        {nextStatus && doc.status !== 'passed' && doc.status !== 'failed' && doc.status !== 'introduced' && (
          <button onClick={handleAdvance} className="flex-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-2 rounded-lg font-bold text-xs transition-colors">
            {needsPresentation ? 'Introduce →' : `Advance → ${STATUS_META[nextStatus].label}`}
          </button>
        )}
      </div>
      <div className="text-xs text-[#9A8A78]">Submitted {new Date(doc.submittedAt).toLocaleDateString()}</div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function DocumentsModal({ committee, onClose, onCommitteeUpdate }: {
  committee: Committee; onClose: () => void;
  onCommitteeUpdate?: (updater: (c: Committee) => Committee) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<DocTab>('working-paper');
  const hasWPs = (committee.documents ?? []).filter((d) => d.type === 'working-paper').length > 0;
  const [showForm, setShowForm] = useState(false);

  // Fullscreen presentation state
  const [activeDoc, setActiveDoc] = useState<CommitteeDocument | null>(null);
  const [stage, setStage] = useState<PresentationStage>(null);
  const [timings, setTimings] = useState({ reading: 0, presentation: 0, qa: 0 });
  const [showDocContent, setShowDocContent] = useState(false);

  const update = (updater: (c: Committee) => Committee) => onCommitteeUpdate?.(updater);
  const docs = (committee.documents ?? []).filter((d) => d.type === tab);

  const handleDocumentAdded = (doc: CommitteeDocument) => {
    update((c) => ({ ...c, documents: [...(c.documents ?? []), doc] }));
  };

  const handleStatusChange = (docId: string, status: DocumentStatus) => {
    update((c) => ({ ...c, documents: (c.documents ?? []).map((d) => d.id === docId ? { ...d, status } : d) }));
    updateDocumentStatusInDB(docId, status);
  };

  const handleRemove = (docId: string) => {
    update((c) => ({ ...c, documents: (c.documents ?? []).filter((d) => d.id !== docId) }));
    removeDocumentInDB(docId);
  };

  const handleStartPresentation = (doc: CommitteeDocument) => {
    setActiveDoc(doc);
    setStage('setup');
    setShowDocContent(false);
  };

  const handleTimingConfirmed = (readingMins: number, presentationMins: number, qaMins: number) => {
    if (!activeDoc) return;
    setTimings({ reading: readingMins, presentation: presentationMins, qa: qaMins });
    // Save timings to DB and mark as introduced
    const updatedDoc = { ...activeDoc, readingMinutes: readingMins, presentationMinutes: presentationMins, qaMinutes: qaMins, status: 'introduced' as DocumentStatus };
    update((c) => ({ ...c, documents: (c.documents ?? []).map((d) => d.id === activeDoc.id ? updatedDoc : d) }));
    updateDocumentTimingsInDB(activeDoc.id, readingMins, presentationMins, qaMins, 'introduced');
    setActiveDoc(updatedDoc);
    // Start first non-zero stage
    if (readingMins > 0) setStage('reading');
    else if (presentationMins > 0) setStage('presentation');
    else if (qaMins > 0) setStage('qa');
    else advanceFromStage('qa');
  };

  const advanceFromStage = (from: PresentationStage) => {
    if (!activeDoc) return;
    if (from === 'reading') {
      if (timings.presentation > 0) { setStage('presentation'); return; }
      if (timings.qa > 0) { setStage('qa'); return; }
    }
    if (from === 'presentation') {
      if (timings.qa > 0) { setStage('qa'); return; }
    }
    // After Q&A (or if all skipped)
    if (activeDoc.type === 'working-paper') {
      // WP auto-passes
      handleStatusChange(activeDoc.id, 'passed');
      setStage(null);
      setActiveDoc(null);
    } else {
      // DR: presentation complete — stay on documents page, chair navigates to voting manually
      setStage(null);
      setActiveDoc(null);
    }
  };

  const handleSkipToVote = () => {
    if (!activeDoc) return;
    if (activeDoc.type === 'working-paper') {
      handleStatusChange(activeDoc.id, 'passed');
      setStage(null);
      setActiveDoc(null);
    } else {
      handleStatusChange(activeDoc.id, 'introduced');
      setStage(null);
      setActiveDoc(null);
    }
  };

  // Fullscreen stages
  if (activeDoc && stage && stage !== 'setup') {
    return (
      <div className="fixed inset-0 z-50 bg-[#F6F1E9] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-[#DDD4C0] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#1C1410]">{activeDoc.docCode}</span>
            {['reading', 'presentation', 'qa'].map((s) => (
              <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-bold`} style={{ backgroundColor: stage === s ? '#1B3828' : '#DDD4C0', color: stage === s ? '#EED98A' : '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                {s === 'reading' ? 'READING' : s === 'presentation' ? 'PRESENTATION' : 'Q&A'}
              </span>
            ))}
          </div>
          <button onClick={() => { setStage(null); setActiveDoc(null); onClose(); }} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl">✕</button>
        </div>

        {stage === 'reading' && timings.reading > 0 && (
          <StageTimer label="READING TIME" color="text-[#1B3828]"
            totalSeconds={timings.reading * 60} doc={activeDoc}
            showDocument={showDocContent}
            onComplete={() => advanceFromStage('reading')}
            onToggleDocument={() => setShowDocContent((v) => !v)}
            onBack={() => setStage('setup')} />
        )}
        {stage === 'presentation' && timings.presentation > 0 && (
          <StageTimer label="PRESENTATION" color="text-[#1B3828]"
            totalSeconds={timings.presentation * 60} doc={activeDoc}
            showDocument={showDocContent}
            onComplete={() => advanceFromStage('presentation')}
            onToggleDocument={() => setShowDocContent((v) => !v)}
            onBack={() => setStage('reading')} />
        )}
        {stage === 'qa' && timings.qa > 0 && (
          <StageTimer label="Q&A" color="text-[#1B3828]"
            totalSeconds={timings.qa * 60} doc={activeDoc}
            showDocument={showDocContent}
            onComplete={() => advanceFromStage('qa')}
            onToggleDocument={() => setShowDocContent((v) => !v)}
            onBack={() => setStage('presentation')} />
        )}
        {stage === 'vote' && (
          <DocumentVote doc={activeDoc} committee={committee}
            onDone={() => { setStage(null); setActiveDoc(null); }}
            onStatusChange={handleStatusChange} />
        )}
      </div>
    );
  }

  // Timing setup screen
  if (activeDoc && stage === 'setup') {
    return (
      <div className="fixed inset-0 z-50 bg-[#F6F1E9] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-[#DDD4C0] shrink-0">
          <span className="text-sm font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>DOCUMENTS — INTRODUCE</span>
          <button onClick={() => { setStage(null); setActiveDoc(null); }} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl">✕</button>
        </div>
        <TimingSetup doc={activeDoc} onStart={handleTimingConfirmed} onSkip={handleSkipToVote} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-7 pt-6 pb-4 shrink-0 border-b border-[#DDD4C0]">
          <h2 className="text-2xl font-black text-[#1C1410]">Documents</h2>
          <button onClick={onClose} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl leading-none">✕</button>
        </div>

        {!showForm && (
          <div className="flex gap-2 px-7 pt-4 shrink-0">
            {(['working-paper', 'draft-resolution'] as const).map((t) => {
              const label = t === 'working-paper' ? 'Working Papers' : 'Draft Resolutions';
              const count = (committee.documents ?? []).filter((d) => d.type === t && (d.status === 'submitted' || d.status === 'on-floor')).length;
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors relative ${tab === t ? 'bg-[#1B3828] text-white' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'}`}>
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black ${tab === t ? 'bg-white/30 text-white' : 'bg-[#1B3828] text-white'}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-y-auto flex-1 pt-4">
          {showForm ? (
            <SubmitForm committee={committee} type={tab} onDone={() => setShowForm(false)} onDocumentAdded={handleDocumentAdded} />
          ) : (
            <div className="px-7 pb-7 space-y-3">
              {tab === 'draft-resolution' && (committee.documents ?? []).some((d) => d.type === 'draft-resolution' && d.status === 'introduced') && (
                <button
                  onClick={() => router.push(`/voting/${committee.code}`)}
                  className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] border border-[#1B3828] text-[#EED98A] py-3 rounded-xl font-black text-sm transition-colors"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(27,56,40,0.25)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                >
                  GO TO VOTING
                </button>
              )}
              {docs.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-2xl font-black mb-1" style={{ color: '#1B3828' }}>No {tab === 'working-paper' ? 'working papers' : 'draft resolutions'} yet.</p>
                  <p className="text-sm mt-1" style={{ color: '#9A8A78' }}>Submit the first one below.</p>
                </div>
              ) : (
                docs.map((doc) => (
                  <DocCard key={doc.id} doc={doc} committee={committee}
                    onStatusChange={handleStatusChange} onRemove={handleRemove}
                    onStartPresentation={handleStartPresentation} />
                ))
              )}
              <button onClick={() => setShowForm(true)}
                className="w-full bg-[#EDE7D8] hover:bg-[#DDD4C0] border border-[#DDD4C0] hover:border-[#1B3828] text-[#1C1410] py-3.5 rounded-2xl font-bold transition-all mt-2 text-center focus:outline-none" style={{ fontFamily: "'Outfit', sans-serif" }}>
                + Submit New {tab === 'working-paper' ? 'Working Paper' : 'Draft Resolution'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}