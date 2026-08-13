'use client';

import React, { use, useEffect, useState, useRef, useCallback, Suspense } from 'react';
import SessionsHeaderLogo from '@/components/SessionsHeaderLogo';
import { Mic, FileText, MessageCircle, MessageSquare, Clock, Mic2, Languages, LogOut, Check, FolderOpen } from 'lucide-react';
import { OUTFIT, Emoji3D } from '@/components/neu';
import {
  DelegateStyles, DG, LIFT, Panel, SectionLabel, FlagDisc, FlagOrdinalDisc, StatRow,
  RollCallSwitch, ChunkyButton, SquareButton, QueueRow, Sheet, Equalizer,
  useMeasuredSize, useFitCount, ordinalSuffixFor,
} from '@/components/delegate/DelegateUI';
import { useSearchParams, useRouter } from 'next/navigation';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { Committee, DocumentType, SpeakingLogEntry, DelegateStatus } from '@/lib/types';
import ChatPanel from '@/components/ChatPanel';
import { computeObjectiveScore, getScoringConfig } from '@/lib/scoring';
import { selectDelegateTips } from '@/lib/delegateTips';
import { getDelegateFeedback } from '@/lib/committeeService';
import { getFlagUrl, getCountryByName, getCountryDisplayName, matchesCountryQuery } from '@/lib/countries';
import { getCommitteeDisplayName } from '@/lib/presetNames';
import { supabase } from '@/lib/supabase';
import { Emoji } from '@/components/Emoji';
import { FlagImg } from '@/components/FlagImg';
import CowDelegationBoard from '@/components/CowDelegationBoard';
import ChatDisabledNotice from '@/components/ChatDisabledNotice';
import { getCommitteeFlags, sponsorLabel, motionNames } from '@/lib/committeeFlags';
import { docName, docCount, docLimit, docLimitReached } from '@/lib/docNames';
import { chatUnreadTotal, mergeMessagesById } from '@/lib/chatConversations';
import { loadChatReadCounts, saveChatReadCounts } from '@/lib/chatReadKey';
import { catchUpMessages, useChatCatchUp, useReSubscribeCatchUp } from '@/lib/useChatCatchUp';
import {
  getCommitteeByCode,
  subscribeToCommittee,
  getCurrentSpeakerRow,
  getDelegatesList,
  getSpeakersLists,
  getDocumentsList,
  getPendingMotionsList,
  addDocument as addDocumentInDB,
  requestJoinSession,
  requestGslSpot,
  setDelegateStatus as setDelegateStatusInDB,
} from '@/lib/committeeService';
import { useAuth } from '@/components/AuthProvider';
import { detectConferenceSession, verifyConferenceAccess } from '@/lib/conferenceAccess';

// ── Helpers ───────────────────────────────────────────────────────────────────
function abbreviateCommitteeName(name: string): string {
  return name
    .replace(/\bUN\s+Security\s+Council\b/gi, 'UNSC')
    .replace(/\bUN\s+General\s+Assembly\b/gi, 'UNGA')
    .replace(/\bUN\s+Human\s+Rights\s+Council\b/gi, 'UNHRC')
    .replace(/United Nations Security Council/gi, 'UNSC')
    .replace(/Security Council/gi, 'UNSC')
    .replace(/United Nations General Assembly/gi, 'UNGA')
    .replace(/General Assembly/gi, 'UNGA')
    .replace(/United Nations Human Rights Council/gi, 'UNHRC')
    .replace(/Human Rights Council/gi, 'HRC')
    .replace(/^UN\s+/i, '');
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function GavelLoader() {
  return (
    <div className="min-h-screen bg-[#EDE7D8] flex flex-col items-center justify-center gap-4">
      <style>{`
        @keyframes gavel-strike {
          0%   { transform: rotate(-30deg); }
          35%  { transform: rotate(15deg); }
          50%  { transform: rotate(10deg); }
          65%  { transform: rotate(15deg); }
          100% { transform: rotate(-30deg); }
        }
        .gavel-anim {
          animation: gavel-strike 1s ease-in-out infinite;
          transform-origin: 85% 85%;
        }
      `}</style>
      <svg className="gavel-anim" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="38" y="38" width="8" height="28" rx="3" transform="rotate(-45 38 38)" fill="#1B3828" />
        <rect x="8" y="14" width="36" height="16" rx="5" transform="rotate(-45 8 14)" fill="#B6871F" />
        <rect x="10" y="16" width="36" height="7" rx="3" transform="rotate(-45 10 16)" fill="#6A5A4A" opacity="0.4" />
        <circle cx="56" cy="56" r="3" fill="#1B3828" opacity="0.5" />
      </svg>
      <p className="text-[#9A8A78] text-sm font-mono tracking-widest">LOADING…</p>
    </div>
  );
}

function flagFor(country: string) {
  const c = getCountryByName(country);
  return c ? <img src={getFlagUrl(c.code)} alt={c.code} className="inline-block object-contain" style={{ width: '1em', height: '1em' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Emoji size="1em">🌐</Emoji>;
}

function autoDocCode(type: DocumentType, existingDocs: { type: DocumentType }[]): string {
  const prefix = type === 'working-paper' ? 'WP' : 'DR';
  const sep = type === 'working-paper' ? '.' : '/';
  const sameType = existingDocs.filter((d) => d.type === type);
  return `${prefix} 1${sep}${sameType.length + 1}`;
}

const PHASE_LABELS: Record<string, string> = {
  'pre-session': 'Pre-Session',
  'roll-call': 'Roll Call',
  'speakers-list': "General Speakers' List",
  'moderated-caucus': 'Moderated Caucus',
  'unmoderated-caucus': 'Unmoderated Caucus',
  'voting': 'Voting Procedure',
  'adjourned': 'Debate Closed',
};

// Rate limit key in localStorage
function getRateLimitKey(committeeId: string, country: string): string {
  return `status-changes:${committeeId}:${country}`;
}

function getStatusChangeTimes(committeeId: string, country: string): number[] {
  try {
    const raw = localStorage.getItem(getRateLimitKey(committeeId, country));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function recordStatusChange(committeeId: string, country: string): void {
  const key = getRateLimitKey(committeeId, country);
  const now = Date.now();
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const recent = getStatusChangeTimes(committeeId, country).filter((t) => now - t < THREE_HOURS);
  localStorage.setItem(key, JSON.stringify([...recent, now]));
}

function statusChangesRemaining(committeeId: string, country: string): number {
  const now = Date.now();
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const recent = getStatusChangeTimes(committeeId, country).filter((t) => now - t < THREE_HOURS);
  return Math.max(0, 3 - recent.length);
}

// Speaking log parsing — only SPEECH events (the channel now also carries motion/RTR/manual
// events, which must not be counted as speeches in the speaking history).
function parseSpeakingLogs(committee: Committee): SpeakingLogEntry[] {
  return committee.messages
    .filter((m) => m.sender === '__system__' && m.recipient === '__log__' && m.content.startsWith('__log__:'))
    .map((m) => {
      try { return JSON.parse(m.content.slice('__log__:'.length)) as SpeakingLogEntry & { type?: string }; }
      catch { return null; }
    })
    .filter((e): e is SpeakingLogEntry & { type?: string } =>
      !!e && (!e.type || e.type === 'speech') && typeof e.seconds === 'number')
    .map((e) => e as SpeakingLogEntry);
}

// Tips no longer live here. They are chosen in `selectDelegateTips`
// (src/lib/delegateTips.ts) from this delegation's own per-source ledger, so a
// delegate is coached on the categories they are actually short on. Points come
// straight from the shared objective scorer, which stays the single source of truth.

// ── Co-Sponsors input ─────────────────────────────────────────────────────────
function SponsorsInput({
  committee,
  myCountry,
  value,
  onChange,
}: {
  committee: Committee;
  myCountry: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const allCountries = committee.delegates.map((d) => d.country).filter((c) => c !== myCountry);
  const matches = query.trim()
    ? allCountries.filter((c) => matchesCountryQuery(c, query.trim(), language) && !value.includes(c))
    : [];

  const add = (c: string) => {
    if (!value.includes(c)) onChange([...value, c]);
    setQuery('');
  };

  return (
    <div>
      {/* Selected sponsors tags */}
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
        <span className="inline-flex items-center gap-1 text-xs bg-[#1B3828]/20 border border-[#1B3828]/30 text-[#6A5A4A] rounded-full px-2.5 py-0.5 font-medium">
          {flagFor(myCountry)} {getCountryDisplayName(myCountry, language)} <span className="text-[#9A8A78] ms-0.5">{language === 'ar' ? '(أنت)' : language === 'fr' ? '(vous)' : language === 'es' ? '(tú)' : '(you)'}</span>
        </span>
        {value.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 text-xs bg-[#FAF8F3] border border-[#DDD4C0] text-[#6A5A4A] rounded-full px-2.5 py-0.5">
            {flagFor(c)} {getCountryDisplayName(c, language)}
            <button onClick={() => onChange(value.filter((x) => x !== c))} className="ms-1 text-[#9A8A78] hover:text-red-400 font-bold leading-none">×</button>
          </span>
        ))}
      </div>
      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches.length > 0) { e.preventDefault(); add(matches[0]); }
            if (e.key === 'Backspace' && !query && value.length > 0) onChange(value.slice(0, -1));
          }}
          placeholder={t('delegate_doc_cosponsor_placeholder')}
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 text-[#1C1410] text-sm focus:outline-none focus:border-[#1B3828] placeholder-[#9A8A78]"
        />
        {matches.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-20 shadow-xl max-h-40 overflow-y-auto">
            {matches.slice(0, 8).map((c, i) => (
              <button
                key={c}
                onMouseDown={(e) => { e.preventDefault(); add(c); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-start transition-colors ${i === 0 ? 'bg-[#DDD4C0] text-[#1C1410]' : 'text-[#6A5A4A] hover:bg-[#DDD4C0]'}`}
              >
                {flagFor(c)} {getCountryDisplayName(c, language)}
                {i === 0 && <span className="ms-auto text-xs text-[#9A8A78]">↵ Enter</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline PDF Viewer ─────────────────────────────────────────────────────────
function InlinePdfViewer({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <button onClick={() => setShow((v) => !v)} className="text-xs transition-colors focus:outline-none" style={{ color: '#1B3828' }}>
        📎 {fileName} {show ? '▲' : '▼'}
      </button>
      {show && (
        <iframe src={fileUrl} title={fileName} className="w-full rounded-lg border border-[#DDD4C0]" style={{ height: '400px' }} />
      )}
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────────
function DelegateDocumentsTab({ committee, country }: { committee: Committee; country: string }) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocumentType>('working-paper');
  const [coSponsors, setCoSponsors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission limits were only ever enforced in the chair's DocumentsModal, which
  // read them from the localStorage settings store. The delegate page never hydrates
  // that store, so the delegates the cap was aimed at could submit without bound.
  // docLimitReached reads committee.dbSettings, so both paths now agree.
  const existingCount = docCount(committee, docType);
  const limit = docLimit(committee, docType);
  const limitReached = docLimitReached(committee, docType);

  // Upload the PDF to Supabase Storage and store only the public URL — NOT the file bytes.
  // Previously this used FileReader.readAsDataURL, base64-inlining the whole PDF into the
  // documents row. That row is pulled by getCommitteeByCode on every realtime refetch, so a
  // single attachment fanned out (clients × events) MBs of egress. Mirrors DocumentsModal.
  const uploadFile = async (file: File) => {
    setFileName(file.name);
    setUploading(true);
    try {
      const path = committee.id + '/' + Date.now() + '-' + file.name;
      const { error } = await supabase.storage.from('session-documents').upload(path, file, { upsert: true });
      if (error) { console.error('Storage upload error:', error); setFileName(null); return; }
      const { data } = supabase.storage.from('session-documents').getPublicUrl(path);
      setFileUrl(data.publicUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || sending || uploading || limitReached) return;
    setSending(true);
    await addDocumentInDB(committee.id, {
      type: docType,
      docCode: autoDocCode(docType, committee.documents ?? []),
      title: title.trim(),
      sponsors: [country, ...coSponsors],
      content: '',
      status: 'submitted',
      ...(fileUrl && fileName ? { fileUrl, fileName } : {}),
    }, committee.code);
    setTitle('');
    setCoSponsors([]);
    setFileName(null);
    setFileUrl(null);
    setSubmitted(true);
    setSending(false);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <h2 className="text-lg font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('delegate_doc_submit_heading')}</h2>
      {submitted && (
        <div className="rounded-xl p-3 text-sm font-semibold" style={{ backgroundColor: 'rgba(27,56,40,0.1)', border: '1px solid rgba(27,56,40,0.3)', color: '#1B3828' }}>
          {t('delegate_doc_submitted_success')}
        </div>
      )}
      <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4 space-y-4">
        {/* Type selector */}
        <div>
          <label className="text-xs font-bold mb-1.5 block" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>{t('delegate_doc_type_label')}</label>
          <div className="flex gap-2">
            {(['working-paper', 'draft-resolution'] as DocumentType[]).map((dt) => (
              <button key={dt} onClick={() => setDocType(dt)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${docType === dt ? 'bg-[#DDD4C0] border-[#1B3828] text-[#1C1410]' : 'bg-[#FAF8F3] border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'}`}>
                {docName(committee, dt, 'singular', dt === 'working-paper' ? t('delegate_doc_type_wp') : t('delegate_doc_type_dr'))}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-bold mb-1.5 block" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>{t('delegate_doc_title_label')}</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={t('delegate_doc_title_placeholder')}
            className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 text-[#1C1410] text-sm focus:outline-none focus:border-[#1B3828]" />
        </div>

        {/* Co-sponsors */}
        <div>
          <label className="text-xs font-bold mb-1.5 block" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>
            {sponsorLabel(committee, t('delegate_doc_sponsors_label'))} <span className="font-normal" style={{ color: '#9A8A78' }}>{t('delegate_doc_sponsors_auto')}</span>
          </label>
          <SponsorsInput committee={committee} myCountry={country} value={coSponsors} onChange={setCoSponsors} />
        </div>

        {/* File */}
        <div>
          <label className="text-xs font-bold mb-1.5 block" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>{t('delegate_doc_attachment_label')} <span className="font-normal" style={{ color: '#9A8A78' }}>{t('delegate_doc_attachment_optional')}</span></label>
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="text-xs bg-[#FAF8F3] border border-[#DDD4C0] hover:border-[#1B3828] text-[#6A5A4A] px-3 py-2 rounded-lg transition-colors disabled:opacity-60">
              {uploading ? '⏳ …' : fileName ? `📎 ${fileName}` : t('delegate_doc_attach_btn')}
            </button>
            {fileName && <button onClick={() => { setFileName(null); setFileUrl(null); }} className="text-xs text-[#9A8A78] hover:text-red-400">{t('delegate_doc_remove')}</button>}
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              await uploadFile(f);
            }} />
        </div>

        {limitReached && (
          <p className="text-xs text-center" style={{ color: '#8B2020' }}>
            {t('documents_limit_exceeded')
              .replace('{current}', String(existingCount))
              .replace('{limit}', String(limit))
              .replace('{type}', docName(committee, docType, 'plural', docType === 'working-paper' ? t('documents_type_wp') : t('documents_type_dr')))}
          </p>
        )}
        {(() => {
          const disabled = !title.trim() || sending || uploading || limitReached;
          return (
            <button onClick={handleSubmit} disabled={disabled}
              className="w-full text-white py-3 rounded-xl text-sm font-black transition-colors focus:outline-none"
              style={{ backgroundColor: disabled ? '#DDD4C0' : '#1B3828', color: disabled ? '#9A8A78' : 'white', letterSpacing: '0.05em' }}>
              {limitReached
                ? t('documents_limit_reached').replace('{current}', String(existingCount)).replace('{limit}', String(limit))
                : sending ? t('delegate_doc_submitting') : t('delegate_doc_submit_to_chair')}
            </button>
          );
        })()}
      </div>

    </div>
  );
}

// ── Statistics Tab ────────────────────────────────────────────────────────────
function StatisticsTab({ committee, country }: { committee: Committee; country: string }) {
  const { language } = useLanguage();
  const t = useT();
  const cfg = getScoringConfig(committee);
  const hideScores = cfg.hideScoresFromDelegates === true;
  const logs = parseSpeakingLogs(committee);
  const { total, rows } = computeObjectiveScore(committee, country);
  // Guidance is deliberately NOT gated on `hideScores` — it never states a number or a
  // rank, so a chair who hides scores still gets their delegates coached. The one key
  // that would surface a scoring-config label they cannot otherwise see
  // (`delegate_tip_custom_source`) is suppressed inside the selector.
  const tips = selectDelegateTips(committee, country, language, t);
  const myLogs = logs.filter((l) => l.country === country);

  // Category subtotals (summary) — delegates see grouped categories, never the chair's itemized ledger.
  const categories: { label: string; pts: number }[] = [];
  for (const r of rows) {
    const existing = categories.find((c) => c.label === r.label);
    if (existing) existing.pts += r.pts; else categories.push({ label: r.label, pts: r.pts });
  }

  // End recap — factor scores only (never the chair's private notes).
  const [recap, setRecap] = useState<{ level: string; factorScores: Record<string, number>; createdAt: string }[]>([]);
  useEffect(() => {
    getDelegateFeedback(committee.id, country).then(setRecap);
  }, [committee.id, country]);
  const latestRecap = [...recap]
    .filter((f) => f.level === 'conference')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]
    ?? [...recap].filter((f) => f.level === 'session').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  const recapFactors = cfg.factors.filter((f) => f.enabled && latestRecap && typeof latestRecap.factorScores[f.id] === 'number');
  const totalSeconds = myLogs.reduce((s, l) => s + l.seconds, 0);

  // Top speakers by time
  const byCountry: Record<string, number> = {};
  logs.forEach((l) => { byCountry[l.country] = (byCountry[l.country] ?? 0) + l.seconds; });
  const ranking = Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1])
    .map(([c, s]) => ({ country: c, seconds: s }));
  const myRank = ranking.findIndex((r) => r.country === country) + 1;

  // Points per country for leaderboard
  const pointsByCountry: Record<string, number> = {};
  ranking.slice(0, 10).forEach(({ country: c }) => {
    pointsByCountry[c] = computeObjectiveScore(committee, c).total;
  });

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      {/* Score card — hidden when chairs disable scores for delegates */}
      {hideScores ? (
        <div className="rounded-2xl p-4 text-sm" style={{ border: '1px solid #DDD4C0', backgroundColor: '#EDE7D8', color: '#6A5A4A' }}>
          {t('delegate_scores_hidden')}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #DDD4C0' }}>
          <div className="px-5 py-3 flex items-center gap-3" style={{ backgroundColor: '#1B3828', borderBottom: '1px solid #3D7A52' }}>
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#EED98A' }} />
            <span className="text-xs font-mono font-bold tracking-widest" style={{ color: '#EED98A' }}>{t('delegate_score_header')}</span>
          </div>
          <div className="p-5" style={{ backgroundColor: '#EDE7D8' }}>
          <div className="flex items-end gap-3 mb-3">
            <span className="text-6xl font-black" style={{ color: '#1B3828' }}>{total}</span>
            <span className="text-lg font-medium mb-1" style={{ color: '#6A5A4A' }}>{t('delegate_pts_label')}</span>
          </div>
          {/* Category subtotals — summary, not the chair's itemized ledger */}
          {categories.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {categories.map((c) => (
                <div key={c.label} className="flex justify-between text-xs gap-2">
                  <span className="truncate" style={{ color: '#6A5A4A' }}>{c.label}</span>
                  <span className="font-bold shrink-0" style={{ color: c.pts < 0 ? '#8B2020' : '#1B3828' }}>{c.pts < 0 ? '' : '+'}{c.pts}</span>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Speaking stats */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #DDD4C0' }}>
        <div className="px-5 py-3 flex items-center gap-3" style={{ backgroundColor: '#1B3828', borderBottom: '1px solid #3D7A52' }}>
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#EED98A' }} />
          <span className="text-xs font-mono font-bold tracking-widest" style={{ color: '#EED98A' }}>{t('delegate_speaking_history')}</span>
        </div>
        <div className="p-5" style={{ backgroundColor: '#EDE7D8' }}>
        <div className={`grid ${hideScores ? 'grid-cols-2' : 'grid-cols-3'} gap-3 mb-4`}>
          <div className="text-center">
            <div className="text-2xl font-black" style={{ color: '#1B3828' }}>{myLogs.length}</div>
            <div className="text-xs" style={{ color: '#9A8A78' }}>{t('delegate_speeches_label')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black" style={{ color: '#1B3828' }}>{formatTime(totalSeconds)}</div>
            <div className="text-xs" style={{ color: '#9A8A78' }}>{t('delegate_total_time_label')}</div>
          </div>
          {!hideScores && (
            <div className="text-center">
              <div className="text-2xl font-black" style={{ color: '#1B3828' }}>{myRank > 0 ? `#${myRank}` : '—'}</div>
              <div className="text-xs" style={{ color: '#9A8A78' }}>{t('delegate_rank_label')}</div>
            </div>
          )}
        </div>
        {myLogs.length > 0 ? (
          <div className="space-y-1.5">
            {myLogs.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ backgroundColor: '#FAF8F3' }}>
                <span className="truncate flex-1" style={{ color: '#6A5A4A' }}>{l.topic || t('delegate_gsl_fallback')}</span>
                <span className="shrink-0 ms-2 capitalize" style={{ color: '#9A8A78' }}>{l.context.replace(/-/g, ' ')}</span>
                <span className="font-mono shrink-0 ms-2" style={{ color: '#1C1410' }}>{l.seconds}s</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-center py-2" style={{ color: '#9A8A78' }}>{t('delegate_no_speeches')}</p>
        )}
        </div>
      </div>

      {/* Committee leaderboard — hidden when chairs disable scores */}
      {!hideScores && ranking.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #DDD4C0' }}>
          <div className="px-5 py-3 flex items-center gap-3" style={{ backgroundColor: '#1B3828', borderBottom: '1px solid #3D7A52' }}>
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#EED98A' }} />
            <span className="text-xs font-mono font-bold tracking-widest" style={{ color: '#EED98A' }}>{t('delegate_committee_time')}</span>
          </div>
          <div className="p-5" style={{ backgroundColor: '#EDE7D8' }}>
          {/* Column headers */}
          <div className="flex items-center gap-2 text-[10px] text-[#7A5A38] font-mono mb-1.5 px-2">
            <span className="w-4 shrink-0" />
            <span className="flex-1">{t('delegate_country_col')}</span>
            <span className="w-16 text-end">{t('delegate_time_col')}</span>
            <span className="w-8 text-end">{t('delegate_pts_col')}</span>
          </div>
          <div className="space-y-1.5">
            {ranking.slice(0, 10).map((r, i) => (
              <div key={r.country} className={`flex items-center gap-2 text-sm ${r.country === country ? 'bg-[#1B3828]/10 border border-[#1B3828]/20 rounded-lg px-2 py-1' : 'px-2 py-1'}`}>
                <span className="text-[#9A8A78] text-xs w-4 font-mono shrink-0">{i + 1}</span>
                <FlagImg code={getCountryByName(r.country)?.code ?? ''} size={20} className="shrink-0" />
                <span className="flex-1 truncate font-semibold" style={{ color: r.country === country ? '#1B3828' : '#6A5A4A', fontWeight: r.country === country ? 700 : 400 }}>{getCountryDisplayName(r.country, language)}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-[#DDD4C0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#1B3828] rounded-full" style={{ width: `${(r.seconds / ranking[0].seconds) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono text-[#9A8A78] w-10 text-end">{formatTime(r.seconds)}</span>
                </div>
                <span className="text-xs font-black w-8 text-end shrink-0" style={{ color: '#1B3828' }}>
                  {pointsByCountry[r.country] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

      {/* Chair recap — factor scores only, never the chair's private notes */}
      {latestRecap && recapFactors.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #DDD4C0' }}>
          <div className="px-5 py-3 flex items-center gap-3" style={{ backgroundColor: '#1B3828', borderBottom: '1px solid #3D7A52' }}>
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#EED98A' }} />
            <span className="text-xs font-mono font-bold tracking-widest" style={{ color: '#EED98A' }}>{t('delegate_recap_header')}</span>
          </div>
          <div className="p-5 space-y-2.5" style={{ backgroundColor: '#EDE7D8' }}>
            {recapFactors.map((f) => {
              const v = latestRecap.factorScores[f.id];
              return (
                <div key={f.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: '#6A5A4A' }}>{f.name}</span>
                    <span className="font-bold" style={{ color: '#1B3828' }}>{v}/{cfg.factorScaleMax}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#DDD4C0' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (v / cfg.factorScaleMax) * 100)}%`, backgroundColor: '#1B3828' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #DDD4C0' }}>
          <div className="px-5 py-3 flex items-center gap-3" style={{ backgroundColor: '#1B3828', borderBottom: '1px solid #3D7A52' }}>
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#EED98A' }} />
            <span className="text-xs font-mono font-bold tracking-widest" style={{ color: '#EED98A' }}>{t('delegate_tips_header')}</span>
          </div>
          <div className="p-5" style={{ backgroundColor: '#EDE7D8' }}>
          <div className="space-y-2">
            {tips.map((tip) => (
              <div key={tip.key} className="flex gap-2 text-sm" style={{ color: '#6A5A4A' }}>
                <span className="shrink-0">→</span>
                <span>{tip.text}</span>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Delegate Session ─────────────────────────────────────────────────────
/** The tabs are gone: every secondary surface is now a bottom sheet. */
type DelegateSheet = null | 'stats' | 'documents' | 'chat' | 'queue';

function DelegateSessionInner({ params }: { params: Promise<{ code: string }> }) {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const PHASE_LABEL: Record<string, string> = {
    'pre-session': t('delegate_phase_pre_session'),
    'roll-call': t('delegate_phase_roll_call'),
    'speakers-list': t('delegate_phase_gsl'),
  };
  const { code } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const country = searchParams.get('country') || '';

  const { user, session, loading: authLoading } = useAuth();
  // Conference-session access guard. 'checking' until verified. Standalone sessions resolve to
  // 'allowed' immediately (anonymous by design); conference sessions require a matching allocation.
  const [accessState, setAccessState] = useState<'checking' | 'allowed' | 'denied' | 'signin'>('checking');

  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<DelegateSheet>(null);
  const [docsSection, setDocsSection] = useState<'submit' | 'view'>('submit');
  const [sessionSuspended, setSessionSuspended] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endedTab, setEndedTab] = useState<'ended' | 'session'>('ended');
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [chatReadCounts, setChatReadCounts] = useState<Record<string, number>>({});

  const committeeIdRef = useRef('');
  const wasEverSuspended = useRef(false);

  // Join request state
  const [joinRequesting, setJoinRequesting] = useState(false);
  const [joinStatus, setJoinStatus] = useState<DelegateStatus | null>(null);
  const [joinDenied, setJoinDenied] = useState(false);

  // GSL denial state
  const [gslDenied, setGslDenied] = useState(false);
  const prevPendingRef = useRef<Committee['pendingMotions']>([]);

  // NOTE: this page deliberately holds NO reference to useSettingsStore. It never
  // hydrates that store from the DB, so getSettings() here silently returns
  // DEFAULT_SETTINGS (AGENTS.md rule 14). Every setting this page needs is read
  // as a pure function of the committee row: getCommitteeFlags / sponsorLabel /
  // motionNames (committeeFlags), getScoringConfig (scoring), docName + docLimit
  // (docNames).

  // Realtime does not replay events missed while the socket was down — the normal case for a
  // backgrounded phone. Catch chat up on reconnect, tab-visible and back-online.
  const onRealtimeStatus = useReSubscribeCatchUp(setCommittee);
  useChatCatchUp(committee?.id, setCommittee);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function load() {
      const found = await getCommitteeByCode(code.toUpperCase());
      setCommittee(found ?? null);
      setLoading(false);
      if (found) {
        if (found.endedAt) setSessionEnded(true);
        else if (found.suspendedAt) { wasEverSuspended.current = true; setSessionSuspended(true); }
        committeeIdRef.current = found.id;
        const cid = found.id;
        unsubscribe = subscribeToCommittee(cid, async (table) => {
          // Patch only the slice that changed instead of re-pulling the whole committee
          // (7 tables, select('*')) on every event. Session-state transitions (suspend /
          // end / resume) only ever land on the `committees` table, so that one event type
          // keeps the full refetch and its setSessionEnded/Suspended logic. All other tables
          // can never change session state, so a scoped patch is safe.
          if (table === 'current_speaker') {
            const cs = await getCurrentSpeakerRow(cid);
            if (!cs) return;
            setCommittee((prev) => {
              if (!prev) return prev;
              const patched: Committee = {
                ...prev,
                currentSpeaker: cs.currentSpeaker,
                speakerTimeRemaining: cs.speakerTimeRemaining,
                speakerStartedAt: cs.speakerStartedAt,
                // Drop the new speaker from the local GSL to avoid a transient duplicate
                // before the speakers_list delete event arrives (mirrors getCommitteeByCode).
                speakersList: cs.currentSpeaker
                  ? prev.speakersList.filter((s) => s.delegateId !== cs.currentSpeaker!.delegateId)
                  : prev.speakersList,
              };
              if (prev.caucus && prev.caucus.type === 'moderated') {
                patched.caucus = { ...prev.caucus, currentSpeaker: cs.currentSpeaker?.country ?? null };
                patched.caucusQueue = cs.currentSpeaker
                  ? prev.caucusQueue.filter((s) => s.delegateId !== cs.currentSpeaker!.delegateId)
                  : prev.caucusQueue;
              }
              return patched;
            });
            return;
          }
          if (table === 'speakers_list') {
            const { speakersList, caucusQueue } = await getSpeakersLists(cid);
            setCommittee((prev) => prev ? {
              ...prev,
              speakersList: prev.currentSpeaker
                ? speakersList.filter((s) => s.delegateId !== prev.currentSpeaker!.delegateId)
                : speakersList,
              caucusQueue,
            } : prev);
            return;
          }
          if (table === 'delegates') {
            const delegates = await getDelegatesList(cid);
            setCommittee((prev) => prev ? { ...prev, delegates } : prev);
            return;
          }
          if (table === 'messages') {
            await catchUpMessages(cid, setCommittee);
            return;
          }
          if (table === 'documents') {
            const documents = await getDocumentsList(cid);
            setCommittee((prev) => prev ? { ...prev, documents } : prev);
            return;
          }
          if (table === 'motions') {
            const pendingMotions = await getPendingMotionsList(cid);
            setCommittee((prev) => prev ? { ...prev, pendingMotions } : prev);
            return;
          }

          // table === 'committees' (and any fallback): session state may have changed.
          const updated = await getCommitteeByCode(code.toUpperCase());
          if (updated) {
            if (updated.endedAt) {
              setSessionEnded(true);
              setSessionSuspended(false);
            } else if (updated.suspendedAt) {
              wasEverSuspended.current = true;
              setSessionSuspended(true);
              setSessionEnded(false);
            } else if (updated.phase === 'pre-session' && wasEverSuspended.current) {
              setSessionSuspended(true);
              setSessionEnded(false);
            } else {
              setSessionEnded(false);
              setSessionSuspended(false);
            }
            // Messages are append-only: merge rather than replace so this full refetch can
            // never drop a message that the scoped messages handler already delivered.
            setCommittee((prev) => prev
              ? { ...updated, messages: mergeMessagesById(prev.messages, updated.messages) }
              : updated);
          }
        }, (status) => onRealtimeStatus(cid, status));
      }
    }
    load();
    return () => unsubscribe?.();
  }, [code, onRealtimeStatus]);

  // Conference-session access guard. Runs independently of the committee load. For a standalone
  // session this resolves to 'allowed' (anonymous). For a conference session it requires a
  // signed-in user whose allocation matches the requested country, so a crafted
  // /delegate/CODE?country=... URL can no longer drop someone into a seat that is not theirs.
  useEffect(() => {
    let cancelled = false;
    async function guard() {
      if (authLoading) return; // stays 'checking' (loader) until auth resolves
      const isConf = await detectConferenceSession(code);
      if (cancelled) return;
      if (!isConf) { setAccessState('allowed'); return; }
      if (!session || !user) { setAccessState('signin'); return; }
      const access = await verifyConferenceAccess(code, session.access_token, user.id);
      if (cancelled) return;
      if (access.kind === 'delegate' && access.country.name === country) {
        setAccessState('allowed');
      } else {
        setAccessState('denied');
      }
    }
    setAccessState('checking');
    guard();
    return () => { cancelled = true; };
  }, [code, country, authLoading, session?.access_token, user?.id]);

  // Browser title abbreviation
  useEffect(() => {
    if (committee) document.title = `${abbreviateCommitteeName(committee.name)} - ${country || 'Delegate'}`;
    return () => { document.title = 'Gavelling'; };
  }, [committee?.name, country]);

  // Keyed by READER (this delegation), not just by committee — otherwise this tab and any
  // chair tab in the same browser overwrite each other's read-state. See
  // src/lib/chatReadKey.ts.
  useEffect(() => {
    if (!committee) return;
    const stored = loadChatReadCounts(committee.code, { role: 'delegate', identity: country });
    if (stored) setChatReadCounts(stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.code, country]);

  useEffect(() => {
    if (!committee) return;
    saveChatReadCounts(committee.code, { role: 'delegate', identity: country }, chatReadCounts);
  }, [chatReadCounts, committee?.code, country]);

  // Prevent browser back button from leaving an active session.
  // When sessionEnded or sessionSuspended become true the effect re-runs,
  // the cleanup removes the listener, and the early return skips re-adding it.
  useEffect(() => {
    if (sessionEnded || sessionSuspended) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [sessionEnded, sessionSuspended]);

  useEffect(() => {
    if (!sessionEnded && !sessionSuspended) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push('/sessions'); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sessionEnded, sessionSuspended, router]);

  useEffect(() => {
    if (committee?.endedAt) {
      setSessionEnded(true);
      setSessionSuspended(false);
    } else if (committee?.suspendedAt) {
      setSessionSuspended(true);
      setSessionEnded(false);
    }
  }, [committee?.endedAt, committee?.suspendedAt]);

  useEffect(() => {
    if (!committee?.expiresAt) { setHoursRemaining(null); return; }
    function calc() {
      const ms = new Date(committee!.expiresAt!).getTime() - Date.now();
      setHoursRemaining(Math.max(0, Math.floor(ms / (1000 * 60 * 60))));
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [committee?.expiresAt]);

  // Detect GSL request denial — and waiting-room (join-request) denial
  useEffect(() => {
    if (!committee) return;
    const isOnSpeakersListNow = committee.speakersList.some((s) => s.country === country);
    const isCurrentSpeakerNow = committee.currentSpeaker?.country === country;
    const prev = prevPendingRef.current;
    const hadRequest = (prev ?? []).some((m) => (m.type as string) === 'gsl-request' && m.proposedBy === country);
    const hasRequest = (committee.pendingMotions ?? []).some((m) => (m.type as string) === 'gsl-request' && m.proposedBy === country);
    if (hadRequest && !hasRequest && !isOnSpeakersListNow && !isCurrentSpeakerNow) {
      setGslDenied(true);
    }
    if (isOnSpeakersListNow || isCurrentSpeakerNow) {
      setGslDenied(false);
    }
    // Waiting room: a join request that vanished while still absent = the chair declined it.
    const admitted = (committee.delegates.find((d) => d.country === country)?.status ?? 'absent') !== 'absent';
    const hadJoinReq = (prev ?? []).some((m) => (m.type as string) === 'join-request' && m.proposedBy === country);
    const hasJoinReq = (committee.pendingMotions ?? []).some((m) => (m.type as string) === 'join-request' && m.proposedBy === country);
    if (hadJoinReq && !hasJoinReq && !admitted) {
      setJoinDenied(true);
      setJoinStatus(null);
    }
    if (admitted) {
      setJoinDenied(false);
      setJoinStatus(null);
    }
    prevPendingRef.current = committee.pendingMotions;
  }, [committee?.pendingMotions, committee?.speakersList, committee?.currentSpeaker, committee?.delegates, country]);

  /* ── Board sizing ───────────────────────────────────────────────────────
     Declared above the early returns: hooks must run in the same order on
     every render, and everything below this point can bail out. `discBox`
     measures the hero's centre column; the queue measures its own slot and
     renders only the rows that genuinely fit, because the page never scrolls. */
  const { ref: discBox, size: discSize } = useMeasuredSize(84, 176);
  const { ref: queueBox, count: queueFit } = useFitCount(44, 30);

  const statIcon = Math.round(Math.max(20, Math.min(34, discSize * 0.21)));
  const actionIcon = Math.round(Math.max(18, Math.min(34, discSize * 0.2)));

  if (loading || authLoading || accessState === 'checking') return <GavelLoader />;

  if (accessState === 'signin') {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: DG.ivory }}>
        <DelegateStyles />
        <Panel className="dgv-rise w-full max-w-sm text-center">
          <h1 style={{ margin: 0, fontFamily: OUTFIT, fontSize: 24, fontWeight: 900, color: DG.forest }}>Sign in to join this session</h1>
          <p style={{ margin: '10px 0 20px', fontFamily: OUTFIT, fontSize: 14, color: DG.body }}>This is a conference session. Sign in to verify your allocation.</p>
          <ChunkyButton onClick={() => router.push('/auth/signin?next=' + encodeURIComponent('/join?code=' + code))}>
            SIGN IN
          </ChunkyButton>
        </Panel>
      </div>
    );
  }

  if (accessState === 'denied') {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: DG.ivory }}>
        <DelegateStyles />
        <Panel className="dgv-rise w-full max-w-sm text-center">
          <h1 style={{ margin: 0, fontFamily: OUTFIT, fontSize: 24, fontWeight: 900, color: DG.forest }}>Allocation does not match account</h1>
          <p style={{ margin: '10px 0 20px', fontFamily: OUTFIT, fontSize: 14, color: DG.body }}>This session allocation is not associated with your account. Please try again, or contact your conference organisers.</p>
          <ChunkyButton onClick={() => router.push('/sessions')}>BACK TO HOME</ChunkyButton>
        </Panel>
      </div>
    );
  }

  if (!committee) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: DG.ivory }}>
        <DelegateStyles />
        <Panel className="dgv-rise w-full max-w-sm text-center">
          <h1 style={{ margin: 0, fontFamily: OUTFIT, fontSize: 24, fontWeight: 900, color: DG.forest }}>{t('delegate_session_not_found')}</h1>
          <p style={{ margin: '10px 0 20px', fontFamily: OUTFIT, fontSize: 14, color: DG.body }}>Code &quot;{code}&quot; is invalid or the session has ended.</p>
          <ChunkyButton onClick={() => router.push('/join')}>TRY AGAIN</ChunkyButton>
        </Panel>
      </div>
    );
  }

  const requireChairApproval = getCommitteeFlags(committee).requireChairApproval;
  const myDelegate = committee.delegates.find((d) => d.country === country);
  const isAbsent = !myDelegate || myDelegate.status === 'absent';
  const myQueueIndex = committee.speakersList.findIndex((s) => s.country === country);
  const isOnSpeakersList = myQueueIndex !== -1;
  const isCurrentSpeaker = committee.currentSpeaker?.country === country;
  const changesLeft = myDelegate ? statusChangesRemaining(committee.id, country) : 0;

  // The chair's renamed motion names, read off the committee row so they reach this
  // device whether or not a caucus is running (AGENTS.md rule 14 — never getSettings here).
  const mn = motionNames(committee, language);

  const phaseDisplay = (() => {
    // `caucus.motionLabel` still wins where it is set: it records WHICH motion opened
    // the caucus, and a Tour de Table is stored as a moderated caucus, so the caucus
    // type alone would mislabel it. `mn` is the fallback and covers every other surface.
    if (committee.phase === 'moderated-caucus') return committee.caucus?.motionLabel || mn.moderated || PHASE_LABELS['moderated-caucus'];
    if (committee.phase === 'unmoderated-caucus') return committee.caucus?.motionLabel || mn.unmoderated || PHASE_LABELS['unmoderated-caucus'];
    return PHASE_LABEL[committee.phase] ?? PHASE_LABELS[committee.phase] ?? committee.phase;
  })();

  // ── Status change handler — optimistic update to avoid visible lag
  const handleStatusChange = async (newStatus: DelegateStatus) => {
    if (!myDelegate) return;
    if (changesLeft <= 0) return;
    setCommittee((prev) => prev ? {
      ...prev,
      delegates: prev.delegates.map((d) => d.id === myDelegate.id ? { ...d, status: newStatus } : d),
    } : prev);
    recordStatusChange(committee.id, country);
    setDelegateStatusInDB(myDelegate.id, newStatus, committee.code);
  };

  // ── Join request handler (absent → P or PV)
  const handleRequestJoin = async (desiredStatus: 'present' | 'present-voting') => {
    if (!myDelegate) return;
    setJoinDenied(false);
    // Chair approval OFF → delegates self-admit instantly (no waiting room).
    if (!requireChairApproval) {
      setCommittee((prev) => prev ? {
        ...prev,
        delegates: prev.delegates.map((d) => d.id === myDelegate.id ? { ...d, status: desiredStatus } : d),
      } : prev);
      setDelegateStatusInDB(myDelegate.id, desiredStatus, committee.code);
      return;
    }
    // Chair approval ON → request a seat and wait in the waiting room.
    setJoinRequesting(true);
    setJoinStatus(desiredStatus);
    await requestJoinSession(committee.id, myDelegate.id, country, desiredStatus, committee.code);
    setJoinRequesting(false);
  };

  // ── Request to be added to speakers list (chair must approve)
  const isGslRequestPending = (committee.pendingMotions ?? []).some(
    (m) => (m.type as string) === 'gsl-request' && m.proposedBy === country
  );
  const handleAddMeToSpeakers = () => {
    if (!myDelegate || isAbsent) return;
    requestGslSpot(committee.id, myDelegate.id, myDelegate.country, committee.code);
  };

  // ── Derived presentation data ─────────────────────────────────────────────
  const flags = getCommitteeFlags(committee);
  const chatDisabled = flags.disableChat;
  const lockRollCall = flags.lockDelegateRollCall;

  const myIso = getCountryByName(country)?.code ?? '';
  const myName = getCountryDisplayName(country, language);
  const unreadTotal = chatUnreadTotal(
    committee.messages, country, false, committee.chairNames ?? [], chatReadCounts,
  );

  // Speaking + chat counters. The tiles and StatisticsTab both derive from the same
  // pure helpers over the same committee row, so the two surfaces can never disagree.
  const myLogs = parseSpeakingLogs(committee).filter((l) => l.country === country);
  const mySpokenSeconds = myLogs.reduce((s, l) => s + l.seconds, 0);
  // A speaking log is a '__system__' message on the '__log__' channel (see
  // parseSpeakingLogs) — everything else this delegation sent is a real chat message.
  const myMessagesSent = (committee.messages ?? []).filter(
    (m) => m.sender === country && m.sender !== '__system__' && m.recipient !== '__log__',
  ).length;

  /* The escalation ladder that drove the old hero is gone — the ordinal now
     lives on the flag itself, and `live` on FlagOrdinalDisc carries the only
     state that still changes the treatment. */
  const inQueue = isCurrentSpeaker || isOnSpeakersList;

  // No plural engine — one key per grammatical number.
  const aheadLabel = isCurrentSpeaker
    ? undefined
    : myQueueIndex === 0
      ? t('delegate_on_deck')
      : myQueueIndex === 1
        ? t('delegate_speaker_ahead_one')
        : myQueueIndex > 1
          ? t('delegate_speakers_ahead', { n: myQueueIndex })
          : undefined;

  // ETA is a pure function of (speakers ahead × the committee's configured per-speaker
  // seconds), so it recomputes only when the committee row changes — never on a per-second
  // tick. With no configured speaking time the line is omitted entirely rather than guessed.
  const etaLabel = (() => {
    const per = committee.speakerTimeLimit;
    if (isCurrentSpeaker || myQueueIndex < 1 || !per || per <= 0) return undefined;
    const mins = Math.max(5, Math.round((myQueueIndex * per) / 60 / 5) * 5);
    if (mins <= 60) return t('delegate_eta_about', { t: `${mins} min` });
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return t('delegate_eta_about', { t: m ? `${h} hr ${m} min` : `${h} hr` });
  })();

  // Request-to-speak reflects the existing GSL states; the action itself is unchanged.
  const speakCta = (() => {
    if (isCurrentSpeaker) return { label: t('delegate_floor_now'), disabled: true, onClick: undefined as (() => void) | undefined };
    if (isOnSpeakersList) return { label: myQueueIndex === 0 ? t('delegate_up_next_queue') : t('delegate_in_queue'), disabled: true, onClick: undefined as (() => void) | undefined };
    if (isGslRequestPending) return { label: t('delegate_awaiting_approval'), disabled: true, onClick: undefined as (() => void) | undefined };
    if (gslDenied) return { label: t('delegate_request_again'), disabled: sessionEnded, onClick: () => setGslDenied(false) };
    return { label: t('delegate_request_gsl'), disabled: sessionEnded || isAbsent, onClick: handleAddMeToSpeakers };
  })();

  const openSheet = (next: DelegateSheet, section?: 'submit' | 'view') => {
    if (section) setDocsSection(section);
    setSheet(next);
  };

  // ── Shared chrome ─────────────────────────────────────────────────────────
  const iconBtn: React.CSSProperties = {
    width: 44, height: 44, borderRadius: 14, border: 'none', flexShrink: 0,
    background: DG.ivory, color: DG.forest, cursor: 'pointer',
    display: 'grid', placeItems: 'center', boxShadow: LIFT.sm,
  };

  const header = (
    <header
      className="dgv-hdr sticky top-0 z-30 flex items-center gap-2 px-3 sm:px-5"
      style={{ height: 56, background: DG.cream, borderBottom: `1px solid ${DG.hairline}` }}
    >
      <SessionsHeaderLogo height={24} />
      <div className="min-w-0 flex-1 text-start">
        <div
          className="truncate"
          style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: DG.forest, lineHeight: 1.15 }}
        >
          {getCommitteeDisplayName(committee.name, language)}
        </div>
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(committee.code); }}
          className="dgv-focus dgv-code truncate"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: DG.faint, maxWidth: '100%',
          }}
        >
          {committee.code}
        </button>
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          aria-label="Language"
          aria-expanded={langOpen}
          onClick={() => setLangOpen((v) => !v)}
          className="dgv-tap dgv-focus"
          style={iconBtn}
        >
          <Languages size={19} strokeWidth={2.25} />
        </button>
        {langOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
            <div
              className="absolute end-0 top-full z-50 overflow-hidden"
              style={{
                marginTop: 8, minWidth: 168, borderRadius: 16,
                background: DG.cream, border: `1px solid ${DG.hairline}`,
                boxShadow: '0 18px 40px rgba(27,56,40,0.24)',
              }}
            >
              {([['en', t('settings_english')], ['es', t('settings_spanish')], ['fr', t('settings_french')], ['ar', 'العربية']] as [string, string][]).map(([lc, label], i) => {
                const on = language === lc;
                return (
                  <button
                    key={lc}
                    type="button"
                    onClick={() => { setLanguage(lc as 'en' | 'es' | 'fr' | 'ar'); setLangOpen(false); }}
                    className="dgv-focus w-full flex items-center gap-2.5 px-4 text-start"
                    style={{
                      minHeight: 44, border: 'none', cursor: 'pointer',
                      borderTop: i > 0 ? `1px solid ${DG.hairline}` : 'none',
                      background: on ? 'rgba(27,56,40,0.07)' : 'transparent',
                      fontFamily: OUTFIT, fontSize: 13, fontWeight: on ? 800 : 600,
                      color: on ? DG.forest : DG.body,
                    }}
                  >
                    <span style={{ fontFamily: OUTFIT, fontSize: 11, color: DG.faint }}>{lc.toUpperCase()}</span>
                    <span className="flex-1">{label}</span>
                    {on && <Check size={15} strokeWidth={2.25} style={{ color: DG.deepGold }} />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        aria-label={t('delegate_adjourned_esc')}
        onClick={() => router.push('/sessions')}
        className="dgv-tap dgv-focus"
        style={iconBtn}
      >
        <LogOut size={19} strokeWidth={2.25} />
      </button>
    </header>
  );

  // ── Absent banner (blocks active interaction)
  const AbsentBanner = () => (
    <Panel className="dgv-rise" style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 900, color: DG.forest }}>{t('delegate_absent_title')}</div>
      <div style={{ fontFamily: OUTFIT, fontSize: 13, color: DG.body, margin: '4px 0 14px' }}>{t('delegate_absent_desc')}</div>
      {joinStatus && !joinDenied ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: DG.forest }}>
          <span className="animate-spin" style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${DG.forest}`, borderTopColor: 'transparent', display: 'inline-block' }} />
          {t('delegate_join_waiting')}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2.5">
          <ChunkyButton tone="outline" disabled={joinRequesting} onClick={() => handleRequestJoin('present')}>
            {t('delegate_present_btn')}
          </ChunkyButton>
          <ChunkyButton tone="primary" disabled={joinRequesting} onClick={() => handleRequestJoin('present-voting')}>
            {t('delegate_pv_btn')}
          </ChunkyButton>
        </div>
      )}
      {joinDenied && (
        <p style={{ marginTop: 10, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: DG.danger }}>{t('delegate_join_denied')}</p>
      )}
    </Panel>
  );

  if (sessionSuspended && (committee.suspendedAt || wasEverSuspended.current)) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center text-center px-6" style={{ background: DG.ivory }}>
        <DelegateStyles />
        <p style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: DG.deepGold }}>
          {getCommitteeDisplayName(committee.name, language)} · {committee.code}
        </p>
        <h1 className="dgv-rise" style={{ margin: '12px 0 14px', fontFamily: OUTFIT, fontSize: 'clamp(30px, 9vw, 46px)', fontWeight: 900, letterSpacing: '-0.02em', color: DG.forest }}>
          {t('delegate_adjourned_title')}
        </h1>
        <p style={{ fontFamily: OUTFIT, fontSize: 17, color: DG.body }}>{t('delegate_adjourned_desc')}</p>
        <p style={{ marginTop: 32, fontFamily: OUTFIT, fontSize: 12, color: DG.faint }}>{t('delegate_adjourned_esc')}</p>
      </div>
    );
  }

  // ── Waiting Room — chair-approval gate (blocks the session until admitted) ──
  if (requireChairApproval && isAbsent && !sessionEnded) {
    const waitingHeading = language === 'ar' ? 'غرفة الانتظار' : language === 'fr' ? "Salle d'attente" : language === 'es' ? 'Sala de Espera' : 'Waiting Room';
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center text-center px-6 py-10" style={{ background: DG.ivory }}>
        <DelegateStyles />
        <p style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: DG.deepGold }}>
          {getCommitteeDisplayName(committee.name, language)}
        </p>
        {committee.topic && (
          <p style={{ marginTop: 6, fontFamily: OUTFIT, fontSize: 13, color: DG.body, maxWidth: 460 }}>{committee.topic}</p>
        )}

        <div className="dgv-rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, margin: '26px 0' }}>
          <FlagDisc code={myIso} name={myName} size={104} ring={DG.hairline} />
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 22, fontWeight: 900, color: DG.ink }}>{myName}</p>
        </div>

        <Panel className="w-full max-w-sm">
          <h1 style={{ margin: '0 0 10px', fontFamily: OUTFIT, fontSize: 22, fontWeight: 900, color: DG.forest }}>{waitingHeading}</h1>
          {joinDenied ? (
            <>
              <p style={{ margin: '0 0 16px', fontFamily: OUTFIT, fontSize: 14, color: DG.body }}>{t('delegate_join_denied')}</p>
              <ChunkyButton tone="gold" onClick={() => setJoinDenied(false)}>{t('delegate_request_again')}</ChunkyButton>
            </>
          ) : joinStatus ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <span className="animate-spin" style={{ width: 24, height: 24, borderRadius: '50%', border: `3px solid ${DG.forest}`, borderTopColor: 'transparent' }} />
              <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 14, color: DG.body }}>{t('delegate_join_waiting')}</p>
            </div>
          ) : (
            <>
              <p style={{ margin: '0 0 16px', fontFamily: OUTFIT, fontSize: 14, color: DG.body }}>{t('delegate_absent_desc')}</p>
              <div className="flex flex-col gap-2.5">
                <ChunkyButton tone="outline" disabled={joinRequesting} onClick={() => handleRequestJoin('present')}>
                  {t('delegate_present_btn')}
                </ChunkyButton>
                <ChunkyButton tone="primary" disabled={joinRequesting} onClick={() => handleRequestJoin('present-voting')}>
                  {t('delegate_pv_btn')}
                </ChunkyButton>
              </div>
            </>
          )}
        </Panel>
        <p style={{ marginTop: 30, fontFamily: OUTFIT, fontSize: 12, color: DG.faint }}>{t('delegate_adjourned_esc')}</p>
      </div>
    );
  }

  // ── Queue rows ────────────────────────────────────────────────────────────
  const queueRows = (limit?: number) =>
    (typeof limit === 'number' ? committee.speakersList.slice(0, limit) : committee.speakersList).map((s, i) => (
      <QueueRow
        key={s.delegateId}
        position={i + 1}
        code={getCountryByName(s.country)?.code ?? ''}
        name={getCountryDisplayName(s.country, language)}
        isSelf={s.country === country}
        speakingLabel={t('delegate_speaking_chip')}
        youLabel={t('delegate_you_chip')}
      />
    ));

  const currentSpeakerRow = committee.currentSpeaker && (
    <QueueRow
      position={0}
      speaking
      code={getCountryByName(committee.currentSpeaker.country)?.code ?? ''}
      name={getCountryDisplayName(committee.currentSpeaker.country, language)}
      isSelf={isCurrentSpeaker}
      speakingLabel={t('delegate_speaking_chip')}
      youLabel={t('delegate_you_chip')}
    />
  );

  const caucusLive = (committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus') && !!committee.caucus;
  const votingLive = committee.phase === 'voting';

  const bandLabel = caucusLive
    ? (committee.caucus?.motionLabel
        || (committee.phase === 'moderated-caucus' ? (mn.moderated || t('delegate_moderated_caucus_label')) : (mn.unmoderated || t('delegate_unmoderated_caucus_label'))))
    : votingLive ? t('delegate_voting_procedure')
      : `${t('delegate_speakers_list_header')}:`;

  const caucusClock = committee.caucus && (
    <>
      <div style={{ fontFamily: OUTFIT, fontSize: 'clamp(26px, 8vw, 44px)', fontWeight: 900, color: DG.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {formatTime(committee.caucus.remainingTime)}
      </div>
      <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: DG.ivory, boxShadow: LIFT.inSm, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: DG.forest, width: `${committee.caucus.totalTime > 0 ? (committee.caucus.remainingTime / committee.caucus.totalTime) * 100 : 0}%` }} />
      </div>
    </>
  );

  /* Whatever occupies the bottom-left slot: the GSL by default, or the live
     caucus / voting detail when one of those phases is running. Keeping them
     in one slot is what lets the board stay a single screen in every phase. */
  const bottomLeft = (() => {
    if (votingLive) {
      const activeDoc = (committee.documents ?? []).find((d) => d.status === 'on-floor' || d.status === 'introduced');
      return (
        <Panel className="dgv-queue dgv-rise" style={{ padding: 14, textAlign: 'center', justifyContent: 'center' }}>
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 'clamp(16px,5vw,24px)', fontWeight: 900, letterSpacing: '-0.02em', color: DG.forest }}>
            {t('delegate_vote_in_progress')}
          </p>
          {activeDoc && (
            <>
              <p style={{ margin: '8px 0 0', fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: DG.deepGold }}>{activeDoc.docCode}</p>
              <p style={{ margin: '3px 0 0', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: DG.ink }}>{activeDoc.title}</p>
            </>
          )}
          <p style={{ margin: '10px 0 0', fontFamily: OUTFIT, fontSize: 12, color: DG.body }}>{t('delegate_vote_desc')}</p>
        </Panel>
      );
    }

    if (caucusLive && committee.caucus) {
      const isMod = committee.phase === 'moderated-caucus';
      return (
        <Panel className="dgv-queue dgv-rise" style={{ padding: 14 }}>
          {committee.caucus.purpose && (
            <p style={{ margin: '0 0 10px', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: DG.forest, lineHeight: 1.25 }}>
              {committee.caucus.purpose}
            </p>
          )}
          {caucusClock}
          {isMod && committee.caucus.currentSpeaker && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
              <Equalizer color={DG.forest} size={14} />
              <FlagDisc code={getCountryByName(committee.caucus.currentSpeaker)?.code ?? ''} name={committee.caucus.currentSpeaker} size={26} ring={DG.ivory} />
              <span style={{ minWidth: 0, flex: 1, fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: committee.caucus.currentSpeaker === country ? DG.deepGold : DG.forest, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getCountryDisplayName(committee.caucus.currentSpeaker, language)}
                {committee.caucus.currentSpeaker === country && t('delegate_you_suffix')}
              </span>
            </div>
          )}
          {isMod && (committee.caucusQueue ?? []).length > 0 && (
            <div style={{ marginTop: 10, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {committee.caucusQueue.slice(0, 5).map((s, i) => (
                <QueueRow
                  key={s.delegateId}
                  position={i + 1}
                  compact
                  code={getCountryByName(s.country)?.code ?? ''}
                  name={getCountryDisplayName(s.country, language)}
                  isSelf={s.country === country}
                  speakingLabel={t('delegate_speaking_chip')}
                  youLabel={t('delegate_you_chip')}
                />
              ))}
            </div>
          )}
          {!isMod && committee.caucus.isConsultation && (
            <div style={{ marginTop: 12, minHeight: 0, overflow: 'hidden' }}>
              <CowDelegationBoard committee={committee} />
            </div>
          )}
        </Panel>
      );
    }

    /* The current speaker occupies one of the fitted slots, so the number of
       queue rows we can actually show is one fewer whenever they exist —
       computing overflow off `queueFit` alone silently dropped the last
       delegate and hid the "view all" that should have caught them. */
    const shown = committee.currentSpeaker ? Math.max(1, queueFit - 1) : queueFit;
    const overflow = Math.max(0, committee.speakersList.length - shown);
    return (
      <Panel className="dgv-queue dgv-rise" style={{ padding: 10 }}>
        <div ref={queueBox} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {!committee.currentSpeaker && committee.speakersList.length === 0 ? (
            <p style={{ margin: 'auto', fontFamily: OUTFIT, fontSize: 13, color: DG.faint, textAlign: 'center' }}>
              {t('delegate_no_speakers')}
            </p>
          ) : (
            <>
              {currentSpeakerRow}
              {queueRows(shown)}
            </>
          )}
        </div>
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => setSheet('queue')}
            className="dgv-focus"
            style={{
              flexShrink: 0, marginTop: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', textAlign: 'start', padding: '4px 6px',
              fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: DG.body,
            }}
          >
            {t('delegate_view_all_queue')}
          </button>
        )}
      </Panel>
    );
  })();

  const docBadge = (label: string, color: string, border?: string, pulse?: boolean) => (
    <span
      className={pulse ? 'animate-pulse' : undefined}
      style={{
        flexShrink: 0, padding: '3px 9px', borderRadius: 999,
        fontFamily: OUTFIT, fontSize: 10, fontWeight: 900, letterSpacing: '0.06em',
        color, border: border ?? `1px solid ${color}`,
      }}
    >
      {label}
    </span>
  );

  const docSponsors = (sponsors: string[]) => (
    <div style={{ fontFamily: OUTFIT, fontSize: 12, color: DG.faint }}>
      {sponsors.map((s, i) => (
        <span key={s} style={{ color: i === 0 ? DG.body : DG.faint, fontWeight: i === 0 ? 600 : 400 }}>
          {i > 0 ? ', ' : ''}{flagFor(s)} {getCountryDisplayName(s, language)}
        </span>
      ))}
    </div>
  );

  const drs = (committee.documents ?? []).filter((d) => d.type === 'draft-resolution');
  const wps = (committee.documents ?? []).filter((d) => d.type === 'working-paper');

  // ── Session-ended full-screen view ────────────────────────────────────────
  const endedView = (
    <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: 'calc(100dvh - 56px - 52px)' }}>
      <h1 className="dgv-rise" style={{ margin: 0, fontFamily: OUTFIT, fontSize: 'clamp(30px, 9vw, 46px)', fontWeight: 900, letterSpacing: '-0.02em', color: DG.forest }}>
        {t('session_ended_title').toUpperCase()}
      </h1>
      <p style={{ margin: '14px 0 2px', fontFamily: OUTFIT, fontSize: 19, color: DG.body }}>{getCommitteeDisplayName(committee.name, language)}</p>
      <p style={{ margin: '0 0 28px', fontFamily: OUTFIT, fontSize: 15, color: DG.faint }}>{committee.topic}</p>
      {hoursRemaining !== null && (
        <p style={{ fontFamily: OUTFIT, fontSize: 13, color: DG.body }}>
          {t('session_hours_until_delete', { n: hoursRemaining, s: hoursRemaining !== 1 ? 's' : '' })}
        </p>
      )}
      <p style={{ marginTop: 30, fontFamily: OUTFIT, fontSize: 12, color: DG.faint }}>{t('session_ended_hint')}</p>
    </div>
  );

  return (
    /* One screen, no page scroll. Fixed dvh + overflow hidden, and every band
       inside is flex with min-height:0 so the bottom row absorbs the slack. */
    <div
      className="flex flex-col"
      style={{ height: '100dvh', overflow: 'hidden', background: DG.ivory }}
    >
      <DelegateStyles />
      {header}

      {/* Ended tab bar */}
      {sessionEnded && (
        <div className="flex" style={{ background: DG.cream, borderBottom: `1px solid ${DG.hairline}` }}>
          {(['ended', 'session'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setEndedTab(k)}
              className="dgv-focus flex-1"
              style={{
                minHeight: 44, border: 'none', cursor: 'pointer', background: 'transparent',
                fontFamily: OUTFIT, fontSize: 12, fontWeight: 900, letterSpacing: '0.06em',
                color: endedTab === k ? DG.forest : DG.faint,
                boxShadow: endedTab === k ? `inset 0 -2px 0 ${DG.forest}` : 'none',
              }}
            >
              {k === 'ended' ? t('session_end_view') : t('session_view')}
            </button>
          ))}
        </div>
      )}

      {sessionEnded && endedTab === 'ended' ? endedView : (
        <main className="mx-auto flex w-full max-w-[900px] flex-1 flex-col px-3 sm:px-5" style={{ minHeight: 0, paddingBlock: 'clamp(8px, 2vw, 18px)' }}>
          {sessionEnded && endedTab === 'session' && (
            <div
              className="text-center"
              style={{
                marginBottom: 16, padding: '10px 16px', borderRadius: 14,
                background: DG.forest, color: DG.gold,
                fontFamily: OUTFIT, fontSize: 13, fontWeight: 800,
              }}
            >
              {t('session_ended_banner')}
            </div>
          )}

          {isAbsent && !sessionEnded && <AbsentBanner />}

          <div className={`dgv-board ${isAbsent ? 'opacity-60 pointer-events-none select-none' : ''}`}>
            {/* ── HERO BAND: tools | flag+ordinal | stats ───────────────── */}
            <section className="dgv-hero dgv-rise">
              {/* LEFT — documents tile above the roll-call control */}
              <div className="dgv-hero-side">
                <button
                  type="button"
                  onClick={() => openSheet('documents', 'view')}
                  className="dgv-tap dgv-focus"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  <Emoji3D name="File folder" size={discSize * 0.34} fallback={FolderOpen} fallbackColor={DG.forest} />
                  <span
                    style={{
                      fontFamily: OUTFIT, fontWeight: 800, color: DG.body, textAlign: 'center',
                      fontSize: 'clamp(6.5px, 2vw, 9px)', letterSpacing: '0.04em',
                      textTransform: 'uppercase', lineHeight: 1.15,
                    }}
                  >
                    {t('delegate_view_documents')}
                  </span>
                </button>

                {!isAbsent && !sessionEnded && !lockRollCall && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span
                      style={{
                        fontFamily: OUTFIT, fontWeight: 800, color: DG.body,
                        fontSize: 'clamp(6.5px, 2vw, 9px)', letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('delegate_roll_call_label')}
                    </span>
                    <RollCallSwitch
                      compact
                      value={myDelegate?.status === 'present-voting' ? 'present-voting' : 'present'}
                      onChange={(v) => handleStatusChange(v)}
                      presentLabel="P"
                      votingLabel="PV"
                      disabled={changesLeft <= 0}
                    />
                  </div>
                )}
              </div>

              {/* CENTRE — the delegate's own flag, dimmed, position over it */}
              <div className="dgv-hero-mid" ref={discBox}>
                <FlagOrdinalDisc
                  code={myIso}
                  name={myName}
                  size={discSize}
                  live={isCurrentSpeaker}
                  primary={
                    isCurrentSpeaker ? t('delegate_floor_now')
                      : inQueue ? `${myQueueIndex + 1}${ordinalSuffixFor(myQueueIndex + 1)}`
                        : '—'
                  }
                  caption={inQueue || isCurrentSpeaker ? t('delegate_in_the_queue') : t('delegate_not_in_queue')}
                />
                <span
                  style={{
                    fontFamily: OUTFIT, fontSize: 'clamp(13px, 4.2vw, 19px)', fontWeight: 900,
                    color: DG.ink, textAlign: 'center', lineHeight: 1.1, maxWidth: '100%',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {myName}
                </span>
              </div>

              {/* RIGHT — the three live stats, beside the flag as drawn */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 1.6vw, 12px)', minWidth: 0 }}>
                <StatRow
                  emoji={<Emoji3D name="Alarm clock" size={statIcon} fallback={Clock} fallbackColor={DG.forest} />}
                  iconSize={statIcon}
                  value={formatTime(mySpokenSeconds)}
                  label={t('delegate_stat_time_spoken')}
                  onClick={() => setSheet('stats')}
                />
                <StatRow
                  emoji={<Emoji3D name="Megaphone" size={statIcon} fallback={Mic2} fallbackColor={DG.forest} />}
                  iconSize={statIcon}
                  value={String(myLogs.length)}
                  label={t('delegate_stat_speeches_given')}
                  onClick={() => setSheet('stats')}
                />
                <StatRow
                  emoji={<Emoji3D name="Speech balloon" size={statIcon} fallback={MessageSquare} fallbackColor={DG.forest} />}
                  iconSize={statIcon}
                  value={String(myMessagesSent)}
                  label={t('delegate_stat_messages_sent')}
                  onClick={() => setSheet('stats')}
                />
              </div>
            </section>

            {/* ── BAND LABEL ────────────────────────────────────────────── */}
            <div className="flex items-baseline gap-3" style={{ flexShrink: 0 }}>
              <h2
                style={{
                  margin: 0, fontFamily: OUTFIT, fontWeight: 900, color: DG.ink,
                  fontSize: 'clamp(15px, 4.6vw, 22px)', letterSpacing: '-0.02em',
                }}
              >
                {bandLabel}
              </h2>
            </div>

            {/* ── BOTTOM BAND: list | square actions ────────────────────── */}
            <section className="dgv-bottom">
              {bottomLeft}

              <div className="dgv-actions">
                <SquareButton
                  skin="green"
                  disabled={speakCta.disabled}
                  onClick={speakCta.onClick}
                  emoji={<Emoji3D name="Microphone" size={actionIcon} fallback={Mic} fallbackColor="#FFFFFF" />}
                >
                  {speakCta.label}
                </SquareButton>
                <SquareButton
                  skin="blue"
                  onClick={() => openSheet('documents', 'submit')}
                  emoji={<Emoji3D name="Page facing up" size={actionIcon} fallback={FileText} fallbackColor="#FFFFFF" />}
                >
                  {t('delegate_submit_document')}
                </SquareButton>
                <SquareButton
                  skin="gold"
                  onClick={() => setSheet('chat')}
                  badge={chatDisabled ? undefined : unreadTotal}
                  emoji={<Emoji3D name="Speech balloon" size={actionIcon} fallback={MessageCircle} fallbackColor={DG.forest} />}
                >
                  {t('tab_chat')}
                </SquareButton>
              </div>
            </section>
          </div>
        </main>
      )}


      {/* ── Sheets ─────────────────────────────────────────────────────── */}
      <Sheet open={sheet === 'stats'} onClose={() => setSheet(null)} title={t('delegate_full_stats')}>
        <StatisticsTab committee={committee} country={country} />
      </Sheet>

      <Sheet open={sheet === 'queue'} onClose={() => setSheet(null)} title={t('delegate_queue_sheet_title')}>
        {!committee.currentSpeaker && committee.speakersList.length === 0 ? (
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 14, color: DG.faint }}>{t('delegate_no_speakers')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {currentSpeakerRow}
            {queueRows()}
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'chat'} onClose={() => setSheet(null)} title={t('tab_chat')}>
        {chatDisabled ? (
          <ChatDisabledNotice />
        ) : (
          // Full-bleed inside the sheet: ChatPanel's conversation rail is a fixed 280px,
          // so every pixel of sheet padding comes straight off the thread pane.
          <div className="flex overflow-hidden" style={{ height: '62vh', minHeight: 320, margin: '0 -16px -24px', borderRadius: 0 }}>
            <ChatPanel
              committee={committee}
              senderName={country}
              isChair={false}
              onClose={() => setSheet(null)}
              readCounts={chatReadCounts}
              onReadCountsChange={setChatReadCounts}
              readOnly={sessionEnded}
            />
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'documents'} onClose={() => setSheet(null)} title={t('delegate_docs_sheet_title')}>
        {/* Submit / view toggle — reuses the existing docsSection state */}
        <div
          role="group"
          style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: DG.ivory, boxShadow: LIFT.inSm, marginBottom: 16 }}
        >
          {(['submit', 'view'] as const).map((k) => {
            const on = docsSection === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setDocsSection(k)}
                className="dgv-tap dgv-focus"
                style={{
                  flex: 1, minHeight: 40, borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em',
                  background: on ? `linear-gradient(135deg, ${DG.forestMid}, ${DG.forest})` : 'transparent',
                  color: on ? DG.gold : DG.body,
                }}
              >
                {k === 'submit' ? t('delegate_submit_document') : t('delegate_view_documents')}
              </button>
            );
          })}
        </div>

        {docsSection === 'submit' && (
          sessionEnded ? (
            <p className="text-center" style={{ padding: '28px 0', fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: DG.faint }}>
              {t('delegate_session_closed_docs')}
            </p>
          ) : (
            <div className={isAbsent ? 'opacity-60 pointer-events-none select-none' : ''}>
              <DelegateDocumentsTab committee={committee} country={country} />
            </div>
          )
        )}

        {docsSection === 'view' && (
          <div className="w-full max-w-2xl mx-auto space-y-6">
            <div className="space-y-3">
              <SectionLabel>{docName(committee, 'draft-resolution', 'plural', t('delegate_draft_resolutions')).toUpperCase()}</SectionLabel>
              {drs.length === 0 ? (
                <p className="text-center" style={{ padding: '14px 0', fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: DG.faint }}>
                  {t('delegate_no_docs_floor', { doc: docName(committee, 'draft-resolution', 'plural', t('documents_draft_resolutions_tab')) })}
                </p>
              ) : (
                drs.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      background: DG.cream, borderRadius: 16, padding: 14,
                      border: `1.5px solid ${doc.status === 'passed' ? DG.forest : doc.status === 'failed' ? 'rgba(139,32,32,0.4)' : DG.hairline}`,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: DG.deepGold }}>{doc.docCode}</span>
                        <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: DG.ink, marginInlineStart: 8 }}>{doc.title}</span>
                      </div>
                      {doc.status === 'passed' && (
                        <span style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 999, background: DG.forest, color: DG.gold, fontFamily: OUTFIT, fontSize: 10, fontWeight: 900 }}>
                          {t('delegate_passed_badge')}
                        </span>
                      )}
                      {doc.status === 'failed' && docBadge(t('delegate_failed_badge'), DG.danger)}
                      {doc.status === 'introduced' && docBadge(t('delegate_now_presenting'), DG.deepGold, undefined, true)}
                      {doc.status === 'on-floor' && docBadge(t('delegate_pending_vote'), DG.deepGold)}
                    </div>
                    {docSponsors(doc.sponsors)}
                    {doc.fileUrl && doc.fileName && (
                      <InlinePdfViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <SectionLabel>{docName(committee, 'working-paper', 'plural', t('delegate_working_papers')).toUpperCase()}</SectionLabel>
              {wps.length === 0 ? (
                <p className="text-center" style={{ padding: '14px 0', fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: DG.faint }}>
                  {t('delegate_no_docs_submitted', { doc: docName(committee, 'working-paper', 'plural', t('documents_working_papers_tab')) })}
                </p>
              ) : (
                wps.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      background: DG.cream, borderRadius: 16, padding: 14,
                      border: `1.5px solid ${DG.hairline}`,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: DG.deepGold }}>{doc.docCode}</span>
                        <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: DG.ink, marginInlineStart: 8 }}>{doc.title}</span>
                      </div>
                      {doc.status === 'submitted' && docBadge(t('documents_status_submitted'), DG.forest, `1px solid ${DG.hairline}`)}
                    </div>
                    {docSponsors(doc.sponsors)}
                    {doc.fileUrl && doc.fileName && (
                      <InlinePdfViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function DelegateSession({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<GavelLoader />}>
      <DelegateSessionInner params={params} />
    </Suspense>
  );
}
