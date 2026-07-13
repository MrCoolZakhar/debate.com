'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import Portal from '@/components/Portal';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { Committee, CommitteeDocument, DocumentType, DocumentStatus } from '@/lib/types';
import { sponsorLabel } from '@/lib/committeeFlags';
import { TranslationKey } from '@/lib/translations';
import { getCountryByName, getFlagUrl, getCountryDisplayName, matchesCountryQuery, startsWithCountryQuery } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';
import { useSettingsStore } from '@/lib/settingsStore';
import { supabase } from '@/lib/supabase';
import {
  addDocument as addDocumentInDB,
  updateDocumentStatus as updateDocumentStatusInDB,
  updateDocumentTimings as updateDocumentTimingsInDB,
  removeDocument as removeDocumentInDB,
  updateDocumentApproval as updateDocumentApprovalInDB,
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
  submitted: 'introduced', 'on-floor': 'introduced', introduced: 'passed',
};

function getStatusLabel(status: DocumentStatus, t: (key: TranslationKey) => string): string {
  const map: Record<DocumentStatus, string> = {
    submitted:   t('documents_status_submitted'),
    'on-floor':  t('documents_status_on_floor'),
    introduced:  t('documents_status_introduced'),
    passed:      t('documents_status_passed'),
    failed:      t('documents_status_failed'),
  };
  return map[status] ?? status;
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const t = useT();
  const meta = STATUS_META[status];
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>{getStatusLabel(status, t)}</span>;
}

function CountryChip({ country, onRemove }: { country: string; onRemove: () => void }) {
  const { language } = useLanguage();
  const found = getCountryByName(country);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DDD4C0] border border-[#DDD4C0] rounded-full text-xs text-[#1C1410]">
      {found ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-4 h-4 object-contain inline-block me-1" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : '🌐'}{getCountryDisplayName(country, language)}
      <button onClick={onRemove} className="text-[#9A8A78] hover:text-red-500 ms-0.5 leading-none">✕</button>
    </span>
  );
}

function SponsorSelect({ candidates, selected, onChange, committee }: {
  candidates: string[]; selected: string[]; onChange: (v: string[]) => void; committee: Committee;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const available = !query.trim()
    ? candidates.filter((c) => !selected.includes(c))
    : candidates
        .filter((c) => !selected.includes(c) && startsWithCountryQuery(c, query.trim(), language))
        .concat(candidates.filter((c) => !selected.includes(c) && !startsWithCountryQuery(c, query.trim(), language) && matchesCountryQuery(c, query.trim(), language)));
  const add = (country: string) => { onChange([...selected, country]); setQuery(''); };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); if (query.trim() && available.length > 0) add(available[0]); }
  };
  return (
    <div>
      <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">{sponsorLabel(committee, t('documents_sponsors_label'))}</label>
      <div className="relative">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={t('documents_sponsor_placeholder')}
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 text-[#1C1410] placeholder-[#9A8A78] text-sm focus:outline-none focus:border-[#1B3828] transition-colors" />
        {query && available.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-20 shadow-lg max-h-36 overflow-y-auto">
            {available.slice(0, 6).map((c, i) => {
              const found = getCountryByName(c);
              return (
                <button key={c} onMouseDown={(e) => { e.preventDefault(); add(c); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-start transition-colors ${i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                  {found ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <span>🌐</span>}
                  <span className="text-sm">{getCountryDisplayName(c, language)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* Selected sponsors, flags only, below input */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected.map((c) => {
            const f = getCountryByName(c);
            return (
              <button key={c} onClick={() => onChange(selected.filter((s) => s !== c))}
                title={`Remove ${c}`}
                className="relative group focus:outline-none">
                {f ? (
                  <img src={getFlagUrl(f.code)} alt={f.code}
                    className="w-10 h-7 object-cover rounded"
                    style={{ border: '1.5px solid rgba(28,20,16,0.15)' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span className="text-2xl">🌐</span>
                )}
                <span className="absolute inset-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-white"
                  style={{ backgroundColor: 'rgba(139,32,32,0.7)' }}>✕</span>
              </button>
            );
          })}
        </div>
      )}
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
  const t = useT();
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const remainingRef = useRef(totalSeconds);
  remainingRef.current = remaining;
  const [splitPct, setSplitPct] = useState(50);
  const isDraggingDivider = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingDivider.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingDivider.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(65, Math.max(35, pct)));
    };
    const onMouseUp = () => {
      isDraggingDivider.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

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
    <div ref={containerRef} className={`flex-1 flex ${showDocument ? 'flex-row items-stretch' : 'flex-col items-center justify-center px-8 py-8 text-center'}`}>
      <div className={`flex flex-col items-center justify-center text-center ${showDocument ? 'px-6 py-8' : 'w-full px-8 py-8'}`} style={showDocument ? { width: `${splitPct}%` } : undefined}>
      <p className="text-xs font-mono tracking-widest mb-2" style={{ color: '#9A8A78' }}>
        {doc.type === 'working-paper' ? t('documents_working_paper_type') : t('documents_draft_resolution_type')} · {doc.docCode}
      </p>
      <h2 className="text-2xl font-black mb-1" style={{ color: '#1C1410' }}>{doc.title}</h2>
      <p className="text-xs font-black mb-6 mt-1 tracking-widest uppercase" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{label}</p>

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
            <button
              onClick={() => { setRemaining(totalSeconds); setRunning(false); setStarted(false); }}
              title="Reset timer"
              className="w-10 h-10 rounded-xl font-bold transition-colors focus:outline-none flex items-center justify-center"
              style={{ backgroundColor: 'transparent', color: '#6A5A4A', border: '1px solid #DDD4C0' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#6A5A4A'; }}>
              ↺
            </button>
            <button onClick={() => { setRunning((r) => !r); setStarted(true); }}
              className="px-8 py-3 rounded-xl font-bold transition-colors focus:outline-none"
              style={{ backgroundColor: running ? '#B8844A' : '#2A5A3C', color: 'white', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="flex gap-[3px]"><span className="w-[3px] h-[13px] rounded-sm bg-white inline-block" /><span className="w-[3px] h-[13px] rounded-sm bg-white inline-block" /></span>
                  PAUSE
                </span>
              ) : started ? t('documents_resume_btn') : `▶ ${t('documents_start_btn').replace(' →', '')}`}
            </button>
            <button onClick={onToggleDocument}
              className="px-5 py-3 rounded-xl font-bold transition-colors focus:outline-none text-sm"
              style={{ backgroundColor: showDocument ? '#1B3828' : 'transparent', color: showDocument ? 'white' : '#6A5A4A', border: showDocument ? 'none' : '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif" }}
              onMouseEnter={(e) => { if (!showDocument) { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; } }}
              onMouseLeave={(e) => { if (!showDocument) { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#6A5A4A'; } }}>
              {showDocument ? t('documents_hide_doc') : t('documents_show_doc')}
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
          <p className="text-lg mb-8" style={{ color: '#6A5A4A' }}>{t('documents_stage_complete').replace('{stage}', String(label))}</p>
          <button onClick={onComplete}
            className="px-10 py-4 rounded-2xl font-black text-lg transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828', color: 'white' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}>
            {t('documents_continue_btn')}
          </button>
        </>
      )}

      </div>

      {showDocument && (
        <div
          onMouseDown={onDividerMouseDown}
          style={{ width: '6px', cursor: 'col-resize', backgroundColor: 'transparent', flexShrink: 0, position: 'relative' }}
          className="hover:bg-[#DDD4C0] transition-colors"
        >
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '2px', width: '2px', backgroundColor: '#DDD4C0', borderRadius: '1px' }} />
        </div>
      )}
      {showDocument && (
        <div className="flex flex-col p-4 overflow-hidden min-h-0" style={{ flex: 1, minWidth: 0 }}>
          {doc.fileUrl ? (
            <iframe
              src={doc.fileUrl}
              title={doc.title}
              className="flex-1 w-full rounded-xl border border-[#DDD4C0]"
              style={{ minHeight: 0 }}
            />
          ) : doc.content ? (
            <div className="flex-1 min-h-0 overflow-y-auto bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-6">
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
  const t = useT();
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
      <Portal><div className="fixed inset-0 z-[70] bg-[#F6F1E9] flex flex-col items-center justify-center text-center px-8">
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
      </div></Portal>
    );
  }

  if (showSuspended) {
    return (
      <Portal><div className="fixed inset-0 z-[70] bg-[#F6F1E9] flex flex-col items-center justify-center text-center px-8">
        <h1 className="text-6xl font-black text-[#1C1410] mb-4">Session is now suspended.</h1>
        <p className="text-4xl font-black text-[#1C1410] mb-16">See you again soon!</p>
        <p className="text-lg text-[#1C1410]/40">— Press ESC to go back to main menu</p>
      </div></Portal>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
      <p className="text-xs font-mono tracking-widest mb-2 text-[#9A8A78]">{doc.docCode} · {t('documents_vote_label')}</p>
      <h2 className="text-2xl font-black text-[#1C1410] mb-1">{doc.title}</h2>
      <p className="text-sm text-[#6A5A4A] mb-8">{t('documents_vote_needs').replace('{needed}', String(needed)).replace('{present}', String(present))}</p>
      {result ? (
        <>
          <div className={`w-full max-w-sm px-8 py-10 rounded-2xl ${result === 'passed' ? 'bg-green-950/40 border border-green-800/40' : 'bg-red-950/40 border border-red-800/40'}`}>
            <p className={`text-4xl font-black mb-2 ${result === 'passed' ? 'text-green-400' : 'text-red-400'}`}>{result === 'passed' ? t('documents_vote_passed') : t('documents_vote_failed')}</p>
            <p className="text-sm text-[#6A5A4A]">{forVotes} {t('documents_vote_result_for')} · {against} {t('documents_vote_result_against')} · {abstain} {t('documents_vote_result_abstain')}</p>
            <button onClick={onDone} className="mt-6 px-8 py-3 rounded-xl font-bold bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#1C1410] transition-colors">{t('documents_back_to_documents')}</button>
          </div>
          <button
            onClick={() => setShowProceedPanel(true)}
            className="mt-6 text-sm text-[#1C1410]/40 hover:text-[#1C1410]/70 transition-colors">
            {t('documents_proceed')}
          </button>

          {/* Proceed with Session panel */}
          {showProceedPanel && (
            <Portal><div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
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
                      placeholder={t('documents_country_placeholder')}
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
            </div></Portal>
          )}
        </>
      ) : (
        <div className="w-full max-w-sm space-y-4">
          {[
            { label: t('documents_in_favour'), value: forVotes, set: setFor, color: 'text-green-400' },
            { label: t('documents_against'), value: against, set: setAgainst, color: 'text-red-400' },
            { label: t('documents_abstain'), value: abstain, set: setAbstain, color: 'text-yellow-400' },
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
  const t = useT();
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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docCode = autoDocCode(type, committee.documents ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isDuplicate = (committee.documents ?? []).some(
    (d) => d.title.trim().toLowerCase() === title.trim().toLowerCase()
  );

  const canSubmit = !limitReached && !isSubmitting && !isUploading && !isDuplicate && !!title.trim();

  const uploadFile = async (file: File) => {
    setFileName(file.name);
    setIsUploading(true);
    try {
      const path = committee.id + '/' + Date.now() + '-' + file.name;
      const { error } = await supabase.storage.from('session-documents').upload(path, file, { upsert: true });
      if (error) { console.error('Storage upload error:', error); setFileName(null); return; }
      const { data } = supabase.storage.from('session-documents').getPublicUrl(path);
      setFileUrl(data.publicUrl);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await uploadFile(f);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    await uploadFile(file);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const newDoc: Omit<CommitteeDocument, 'id' | 'submittedAt'> = {
        type, docCode, title: title.trim(), sponsors, content: content.trim(), status: 'submitted',
        ...(fileUrl && fileName ? { fileUrl, fileName } : {}),
      };
      const saved = await addDocumentInDB(committee.id, newDoc);
      if (saved) onDocumentAdded(saved);
      onDone();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 px-7 pb-7">
      <div className="flex flex-col items-center gap-1 relative">
        <button onClick={onDone} className="absolute left-0 top-1/2 -translate-y-1/2 text-sm transition-colors focus:outline-none" style={{ color: '#9A8A78' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}>{t('documents_back')}</button>
        <h2 className="text-xl font-black text-center uppercase tracking-wide" style={{ color: '#1B3828' }}>
          {type === 'working-paper' ? t('documents_submit_wp_heading') : t('documents_submit_dr_heading')}
        </h2>
      </div>
      <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl px-4 py-2.5">
        <span className="text-xs text-[#9A8A78] font-mono">{t('documents_doc_code_label')}</span>
        <span className="ms-3 text-sm font-bold text-[#1C1410] font-mono">{docCode}</span>
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">{t('documents_title_label')} <span className="text-red-500">*</span></label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={type === 'working-paper' ? t('documents_title_placeholder_wp') : t('documents_title_placeholder_dr')}
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors" />
      </div>
      <SponsorSelect candidates={presentCountries} selected={sponsors} onChange={setSponsors} committee={committee} />
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">{t('documents_google_docs_label')} <span className="text-[#9A8A78] font-normal">({t('documents_google_docs_optional')})</span></label>
        <input type="text" value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="https://docs.google.com/..."
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors text-sm" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">
          {t('documents_attachment_label')} <span className="text-[#9A8A78] font-normal">(optional)</span>
        </label>
        {fileName ? (
          <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3">
            <span className="text-sm text-[#1C1410] flex-1 truncate flex items-center gap-2">
              {isUploading
                ? <><div className="w-3.5 h-3.5 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin shrink-0" /> Uploading…</>
                : <>📎 {fileName}</>
              }
            </span>
            <button onClick={() => { setFileName(null); setFileUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="text-[#9A8A78] hover:text-red-500 transition-colors text-sm">✕</button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`w-full border border-dashed rounded-xl px-4 py-5 text-sm transition-colors text-center cursor-pointer select-none ${
              isDragging
                ? 'border-[#1B3828] bg-[#1B3828]/10 text-[#1B3828]'
                : 'bg-[#FAF8F3] border-[#DDD4C0] hover:border-[#1B3828] text-[#9A8A78] hover:text-[#6A5A4A]'
            }`}
          >
            <span className="block text-xl mb-1">📎</span>
            {isDragging ? 'Drop PDF here' : 'Click to upload or drag & drop a PDF'}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
      </div>
      {limitReached && (
        <p className="text-xs text-red-400 text-center">
          {t('documents_limit_exceeded').replace('{current}', String(existingCount)).replace('{limit}', String(limit)).replace('{type}', type === 'working-paper' ? t('documents_type_wp') : t('documents_type_dr'))}
        </p>
      )}
      {isSubmitting ? (
        <button disabled className="w-full bg-[#9A8A78] text-white py-3.5 rounded-xl font-bold cursor-not-allowed">
          Uploading…
        </button>
      ) : (
        <button onClick={handleSubmit} disabled={!canSubmit}
          className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-3.5 rounded-xl font-bold transition-colors">
          {limitReached
            ? t('documents_limit_reached').replace('{current}', String(existingCount)).replace('{limit}', String(limit))
            : isDuplicate
              ? 'A document with this title already exists'
              : t('documents_submit_document')}
        </button>
      )}
    </div>
  );
}

// ── Timing Setup Dialog ───────────────────────────────────────────────────────
function TimingSetup({ doc, onStart, onSkip }: {
  doc: CommitteeDocument;
  onStart: (readingMins: number, presentationMins: number, qaMins: number) => void;
  onSkip: () => void;
}) {
  const t = useT();
  const isWP = doc.type === 'working-paper';
  const [readingMins, setReadingMins] = useState(0);
  const [presentationMins, setPresentationMins] = useState(0);
  const [qaMins, setQaMins] = useState(0);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
      <p className="text-xs font-mono tracking-widest mb-2 text-[#9A8A78]">{doc.docCode} · {t('documents_setup_timers')}</p>
      <h2 className="text-2xl font-black text-[#1C1410] mb-1">{doc.title}</h2>
      <p className="text-sm text-[#6A5A4A] mb-8">
        {isWP ? t('documents_working_paper_flow') : t('documents_dr_flow')}
      </p>

      <div className="w-full max-w-sm space-y-4">
        {[
          { key: 'reading', label: t('documents_stage_reading'), value: readingMins, set: setReadingMins, note: t('documents_stage_note_reading') },
          { key: 'presentation', label: t('documents_stage_presentation'), value: presentationMins, set: setPresentationMins, note: t('documents_stage_note_presentation') },
          { key: 'qa', label: t('documents_stage_qa'), value: qaMins, set: setQaMins, note: isWP ? t('documents_qa_optional') : t('documents_qa_note') },
        ].map(({ key, label, value, set, note }) => (
          <div key={key} className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-black text-sm" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{label}</span>
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
            {t('documents_start_btn')}
          </button>
          <button onClick={onSkip}
            className="px-6 py-3.5 rounded-2xl font-bold bg-transparent border border-[#DDD4C0] hover:border-[#1B3828] transition-colors focus:outline-none" style={{ color: '#6A5A4A' }}>
            {t('documents_skip_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Doc Card ──────────────────────────────────────────────────────────────────
function DocCard({ doc, committee, onStatusChange, onRemove, onStartPresentation, requireApproval, onApprovalChange }: {
  doc: CommitteeDocument; committee: Committee;
  onStatusChange: (docId: string, status: DocumentStatus) => void;
  onRemove: (docId: string) => void;
  onStartPresentation: (doc: CommitteeDocument) => void;
  requireApproval: boolean;
  onApprovalChange: (docId: string, approval: 'approved' | 'rejected') => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const nextStatus = STATUS_NEXT[doc.status];
  const needsPresentation = nextStatus === 'introduced';
  // Approval gate: while the setting is on and this doc isn't approved yet, offer Approve/Reject
  // (also lets a chair reverse a rejection) and hold back Introduce until approved. Once the doc has
  // been introduced/passed/failed the gate is moot.
  const canDecide = requireApproval && doc.approval !== 'approved' && (doc.status === 'submitted' || doc.status === 'on-floor');
  const approvalBlocksIntroduce = requireApproval && doc.approval !== 'approved';

  const handleAdvance = () => {
    if (!nextStatus) return;
    if (needsPresentation) onStartPresentation(doc);
    else onStatusChange(doc.id, nextStatus);
  };

  return (
    <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl overflow-hidden">
      <div className="flex items-stretch">

        {/* Left strip, doc thumbnail with padding from border */}
        <div className="flex flex-col items-center justify-between shrink-0 p-2"
          style={{ backgroundColor: 'rgba(27,56,40,0.10)', width: '88px' }}>

          {/* Thumbnail, PDF preview or fallback emoji */}
          <div className="w-full rounded-lg overflow-hidden flex-1 flex items-center justify-center"
            style={{ maxHeight: '120px', minHeight: '80px' }}>
            {doc.fileUrl ? (
              <iframe
                src={doc.fileUrl}
                title={doc.docCode}
                className="w-full"
                style={{ height: '120px', pointerEvents: 'none' }}
                scrolling="no"
              />
            ) : (
              <span style={{ fontSize: '5.5rem', lineHeight: 1, userSelect: 'none' }}>📋</span>
            )}
          </div>

          {/* Doc code below the thumbnail */}
          <span className="mt-1.5 text-center font-black"
            style={{ fontSize: '11px', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.03em' }}>
            {doc.docCode}
          </span>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 p-4 space-y-2.5">

          {/* Title row + delete */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-black text-[#1C1410] leading-snug">{doc.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={doc.status} />
                {doc.approval === 'approved' && (
                  <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-[#1B3828]/15 text-[#1B3828] border-[#1B3828]/40">{t('documents_status_approved')}</span>
                )}
                {doc.approval === 'rejected' && (
                  <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-[#8B2020]/10 text-[#8B2020] border-[#8B2020]/40">{t('documents_status_rejected')}</span>
                )}
              </div>
            </div>
            <button onClick={() => onRemove(doc.id)}
              className="text-[#9A8A78] hover:text-red-500 transition-colors text-sm shrink-0 focus:outline-none mt-0.5"
              title="Delete">✕</button>
          </div>

          {/* Sponsors with flags */}
          {doc.sponsors.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-[#6A5A4A] shrink-0">{sponsorLabel(committee, t('documents_sponsors_label_card'))}:</span>
              {doc.sponsors.map((s) => {
                const f = getCountryByName(s);
                return (
                  <span key={s} className="inline-flex items-center gap-1">
                    {f && (
                      <img src={getFlagUrl(f.code)} alt={f.code}
                        className="w-6 h-4 object-cover rounded-sm"
                        style={{ border: '1px solid rgba(28,20,16,0.12)' }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <span className="text-xs text-[#6A5A4A]">{getCountryDisplayName(s, language)}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* PDF toggle */}
          {doc.fileUrl && doc.fileName && (
            <div className="text-xs space-y-2">
              <button onClick={() => setShowPdf((v) => !v)}
                className="transition-colors focus:outline-none" style={{ color: '#1B3828' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}>
                📎 {doc.fileName} {showPdf ? '▲' : '▼'}
              </button>
              {showPdf && (
                <iframe src={doc.fileUrl} title={doc.fileName}
                  className="w-full rounded-lg border border-[#DDD4C0]"
                  style={{ height: '480px' }} />
              )}
            </div>
          )}

          {/* Content toggle */}
          {doc.content && (
            <div>
              <button onClick={() => setExpanded((v) => !v)}
                className="text-xs text-[#1B3828] hover:text-[#6A5A4A] transition-colors">
                {expanded ? '▲ Hide content' : '▼ Show content'}
              </button>
              {expanded && (
                <pre className="mt-2 text-xs text-[#1C1410] bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                  {doc.content}
                </pre>
              )}
            </div>
          )}

          {/* Chair approval gate, approve/reject before the doc can be introduced */}
          {canDecide && (
            <div className="flex gap-2">
              <button onClick={() => onApprovalChange(doc.id, 'approved')}
                className="flex-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-2 rounded-lg font-bold text-sm transition-colors focus:outline-none">
                {t('documents_approve')}
              </button>
              <button onClick={() => onApprovalChange(doc.id, 'rejected')}
                className="flex-1 py-2 rounded-lg font-bold text-sm transition-colors focus:outline-none"
                style={{ backgroundColor: '#8B2020', color: '#EDE7D8' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#7A1C1C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}>
                {t('documents_reject')}
              </button>
            </div>
          )}

          {/* Introduce / advance button, withheld until approved when approval is required */}
          {nextStatus && doc.status !== 'passed' && doc.status !== 'failed' && doc.status !== 'introduced' && !approvalBlocksIntroduce && (
            <button onClick={handleAdvance}
              className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-2 rounded-lg font-bold text-sm transition-colors focus:outline-none">
              {needsPresentation ? `${t('documents_introduce')} →` : `${t('documents_advance')}${getStatusLabel(nextStatus, t)}`}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function DocumentsModal({ committee, onClose, onCommitteeUpdate, isViewOnly = false }: {
  committee: Committee; onClose: () => void;
  onCommitteeUpdate?: (updater: (c: Committee) => Committee) => void;
  isViewOnly?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { getSettings } = useSettingsStore();
  const requireDocApproval = getSettings(committee.code).requireDocApproval;
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

  const handleApprovalChange = (docId: string, approval: 'approved' | 'rejected') => {
    update((c) => ({ ...c, documents: (c.documents ?? []).map((d) => d.id === docId ? { ...d, approval } : d) }));
    updateDocumentApprovalInDB(docId, approval);
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
      // DR: presentation complete, stay on documents page, chair navigates to voting manually
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
      <Portal><div className="fixed inset-0 z-50 bg-[#F6F1E9] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-[#DDD4C0] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#1C1410]">{activeDoc.docCode}</span>
            {['reading', 'presentation', 'qa'].map((s) => (
              <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-bold`} style={{ backgroundColor: stage === s ? '#1B3828' : '#DDD4C0', color: stage === s ? '#EED98A' : '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                {s === 'reading' ? t('documents_stage_reading_short') : s === 'presentation' ? t('documents_stage_presentation') : t('documents_stage_qa')}
              </span>
            ))}
          </div>
          <button onClick={() => { setStage(null); setActiveDoc(null); onClose(); }} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl">✕</button>
        </div>

        {stage === 'reading' && timings.reading > 0 && (
          <StageTimer label={t('documents_stage_reading')} color="text-[#1B3828]"
            totalSeconds={timings.reading * 60} doc={activeDoc}
            showDocument={showDocContent}
            onComplete={() => advanceFromStage('reading')}
            onToggleDocument={() => setShowDocContent((v) => !v)}
            onBack={() => setStage('setup')} />
        )}
        {stage === 'presentation' && timings.presentation > 0 && (
          <StageTimer label={t('documents_stage_presentation')} color="text-[#1B3828]"
            totalSeconds={timings.presentation * 60} doc={activeDoc}
            showDocument={showDocContent}
            onComplete={() => advanceFromStage('presentation')}
            onToggleDocument={() => setShowDocContent((v) => !v)}
            onBack={() => setStage('reading')} />
        )}
        {stage === 'qa' && timings.qa > 0 && (
          <StageTimer label={t('documents_stage_qa')} color="text-[#1B3828]"
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
      </div></Portal>
    );
  }

  // Timing setup screen
  if (activeDoc && stage === 'setup') {
    return (
      <Portal><div className="fixed inset-0 z-50 bg-[#F6F1E9] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-[#DDD4C0] shrink-0">
          <span className="text-sm font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('documents_introduce_header')}</span>
          <button onClick={() => { setStage(null); setActiveDoc(null); }} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl">✕</button>
        </div>
        <TimingSetup doc={activeDoc} onStart={handleTimingConfirmed} onSkip={handleSkipToVote} />
      </div></Portal>
    );
  }

  return (
    <Portal><div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92%] flex flex-col">
        <div className="flex items-center justify-between px-7 pt-6 pb-4 shrink-0 border-b border-[#DDD4C0]">
          <h2 className="text-2xl font-black text-[#1C1410]">{t('documents_title')}</h2>
          <button onClick={onClose} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl leading-none">✕</button>
        </div>

        {!showForm && (
          <div className="flex gap-2 px-7 pt-4 shrink-0">
            {(['working-paper', 'draft-resolution'] as const).map((tabItem) => {
              const count = (committee.documents ?? []).filter((d) => d.type === tabItem && (d.status === 'submitted' || d.status === 'on-floor')).length;
              return (
                <button key={tabItem} onClick={() => setTab(tabItem)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors relative ${tab === tabItem ? 'bg-[#1B3828] text-white' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'}`}>
                  {tabItem === 'working-paper' ? t('documents_working_papers_tab') : t('documents_draft_resolutions_tab')}
                  {count > 0 && (
                    <span className={`ms-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black ${tab === tabItem ? 'bg-white/30 text-white' : 'bg-[#1B3828] text-white'}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-y-auto flex-1 min-h-0 pt-4">
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
                  {t('documents_go_to_voting')}
                </button>
              )}
              {docs.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-2xl font-black mb-1" style={{ color: '#1B3828' }}>{tab === 'working-paper' ? t('documents_empty_wp') : t('documents_empty_dr')}</p>
                  <p className="text-sm mt-1" style={{ color: '#9A8A78' }}>{t('documents_empty_sub')}</p>
                </div>
              ) : (
                docs.map((doc) => (
                  <DocCard key={doc.id} doc={doc} committee={committee}
                    onStatusChange={handleStatusChange} onRemove={handleRemove}
                    onStartPresentation={handleStartPresentation}
                    requireApproval={requireDocApproval} onApprovalChange={handleApprovalChange} />
                ))
              )}
              {!isViewOnly && (
                <button onClick={() => setShowForm(true)}
                  className="w-full bg-[#EDE7D8] hover:bg-[#DDD4C0] border border-[#DDD4C0] hover:border-[#1B3828] text-[#1C1410] py-3.5 rounded-2xl font-bold transition-all mt-2 text-center focus:outline-none" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  + {tab === 'working-paper' ? t('documents_submit_new_wp').replace('+ ', '') : t('documents_submit_new_dr').replace('+ ', '')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div></Portal>
  );
}