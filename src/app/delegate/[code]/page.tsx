'use client';

import React, { use, useEffect, useState, useRef, useCallback, Suspense } from 'react';
import FitToScreen from '@/components/FitToScreen';
import { useSearchParams, useRouter } from 'next/navigation';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';
import { Committee, CommitteeDocument, DocumentType, PendingMotionType, SpeakingLogEntry, DelegateStatus } from '@/lib/types';
import { TranslationKey } from '@/lib/translations';
import ChatPanel from '@/components/ChatPanel';
import { useSettingsStore, DEFAULT_MOTION_NAMES } from '@/lib/settingsStore';
import { computeObjectiveScore, getScoringConfig, type LedgerRow } from '@/lib/scoring';
import { getDelegateFeedback } from '@/lib/committeeService';
import { getFlagUrl, getCountryByName, getCountryDisplayName, matchesCountryQuery } from '@/lib/countries';
import { getCommitteeDisplayName } from '@/lib/presetNames';
import { supabase } from '@/lib/supabase';
import { Emoji } from '@/components/Emoji';
import { FlagImg } from '@/components/FlagImg';
import CowDelegationBoard from '@/components/CowDelegationBoard';
import { getCommitteeFlags, sponsorLabel } from '@/lib/committeeFlags';
import {
  getCommitteeByCode,
  subscribeToCommittee,
  getCurrentSpeakerRow,
  getDelegatesList,
  getSpeakersLists,
  getMessagesList,
  getDocumentsList,
  getPendingMotionsList,
  addToSpeakersList as addToSpeakersListInDB,
  addDocument as addDocumentInDB,
  addPendingMotion as addPendingMotionInDB,
  requestJoinSession,
  requestGslSpot,
  setDelegateStatus as setDelegateStatusInDB,
} from '@/lib/committeeService';

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

// Point calculation — total/rows come from the shared objective scorer (single source of
// truth). Tiers are removed; only universal activity-based tips remain.
function calcPoints(logs: SpeakingLogEntry[], committee: Committee, country: string, t: (key: TranslationKey) => string): {
  total: number;
  rows: LedgerRow[];
  tips: string[];
} {
  const { total, rows } = computeObjectiveScore(committee, country);

  const myLogs = logs.filter((l) => l.country === country);
  const gslSpeeches = myLogs.filter((l) => l.context === 'speakers-list');
  const caucusSpeeches = myLogs.filter((l) => l.context === 'moderated-caucus' || l.context === 'unmoderated-caucus');
  const totalSeconds = myLogs.reduce((s, l) => s + l.seconds, 0);
  const myDocs = (committee.documents ?? []).filter((d) => d.sponsors.includes(country));
  const wps = myDocs.filter((d) => d.type === 'working-paper');
  const drs = myDocs.filter((d) => d.type === 'draft-resolution');

  // Universal conditional tips (no tier buckets)
  const tips: string[] = [];
  if (gslSpeeches.length === 0) tips.push(t('delegate_tip_gsl_not_spoken'));
  if (caucusSpeeches.length === 0 && committee.phase !== 'pre-session') tips.push(t('delegate_tip_no_caucus'));
  if (wps.length === 0 && drs.length === 0) tips.push(t('delegate_tip_no_docs'));
  if (totalSeconds > 0 && totalSeconds < 45) tips.push(t('delegate_tip_speaking_time'));
  if (drs.length === 0 && wps.length > 0) tips.push(t('delegate_tip_have_wp'));

  return { total, rows, tips };
}

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

// ── Delegate Doc Card (with inline PDF viewer) ────────────────────────────────
function DelegateDocCard({ doc }: { doc: CommitteeDocument }) {
  const t = useT();
  const statusColor = doc.status === 'passed' ? '#1B3828' : doc.status === 'failed' ? '#8B2020' : doc.status === 'introduced' ? '#B8844A' : doc.status === 'on-floor' ? '#B8844A' : '#9A8A78';
  const statusBg = doc.status === 'passed' ? 'rgba(27,56,40,0.1)' : doc.status === 'failed' ? 'rgba(139,32,32,0.1)' : 'transparent';
  const statusLabel = doc.status === 'introduced' ? t('documents_status_introduced') : doc.status === 'on-floor' ? t('documents_status_on_floor') : doc.status === 'passed' ? t('documents_status_passed') : doc.status === 'failed' ? t('documents_status_failed') : t('documents_status_submitted');
  return (
    <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-[#1C1410] text-sm">{doc.docCode} — {doc.title}</div>
        <span className="text-xs font-black ms-2 shrink-0 px-2 py-0.5 rounded-full" style={{ color: statusColor, backgroundColor: statusBg, border: `1px solid ${statusColor}30` }}>{statusLabel}</span>
      </div>
      <div className="text-xs text-[#9A8A78]">
        {doc.sponsors.map((s, i) => (
          <span key={s} className={i === 0 ? 'text-[#6A5A4A] font-medium' : ''}>
            {i > 0 ? ', ' : ''}{flagFor(s)} {s}
          </span>
        ))}
      </div>
      {doc.fileUrl && doc.fileName && (
        <InlinePdfViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
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
    if (!title.trim() || sending || uploading) return;
    setSending(true);
    await addDocumentInDB(committee.id, {
      type: docType,
      docCode: autoDocCode(docType, committee.documents ?? []),
      title: title.trim(),
      sponsors: [country, ...coSponsors],
      content: '',
      status: 'submitted',
      ...(fileUrl && fileName ? { fileUrl, fileName } : {}),
    });
    setTitle('');
    setCoSponsors([]);
    setFileName(null);
    setFileUrl(null);
    setSubmitted(true);
    setSending(false);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
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
                {dt === 'working-paper' ? t('delegate_doc_type_wp') : t('delegate_doc_type_dr')}
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

        <button onClick={handleSubmit} disabled={!title.trim() || sending || uploading}
          className="w-full text-white py-3 rounded-xl text-sm font-black transition-colors focus:outline-none"
          style={{ backgroundColor: !title.trim() || sending || uploading ? '#DDD4C0' : '#1B3828', color: !title.trim() || sending || uploading ? '#9A8A78' : 'white', letterSpacing: '0.05em' }}>
          {sending ? t('delegate_doc_submitting') : t('delegate_doc_submit_to_chair')}
        </button>
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
  const { total, rows, tips } = calcPoints(logs, committee, country, t);
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
    pointsByCountry[c] = calcPoints(logs, committee, c, t).total;
  });

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
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
              <div key={tip} className="flex gap-2 text-sm" style={{ color: '#6A5A4A' }}>
                <span className="shrink-0">→</span>
                <span>{tip.replace(/^\p{Emoji}\s*/u, '')}</span>
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
type DelegateTab = 'session' | 'documents' | 'chat' | 'stats';

function DelegateSessionInner({ params }: { params: Promise<{ code: string }> }) {
  const t = useT();
  const { language } = useLanguage();
  const PHASE_LABEL: Record<string, string> = {
    'pre-session': t('delegate_phase_pre_session'),
    'roll-call': t('delegate_phase_roll_call'),
    'speakers-list': t('delegate_phase_gsl'),
  };
  const { code } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const country = searchParams.get('country') || '';

  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DelegateTab>('session');
  const [docsSection, setDocsSection] = useState<'submit' | 'view'>('submit');
  const [sessionSuspended, setSessionSuspended] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endedTab, setEndedTab] = useState<'ended' | 'session'>('ended');
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false); // kept for chatReadCounts compat only
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

  const { getSettings } = useSettingsStore();

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
            const messages = await getMessagesList(cid);
            setCommittee((prev) => prev ? { ...prev, messages } : prev);
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
            setCommittee(updated);
          }
        });
      }
    }
    load();
    return () => unsubscribe?.();
  }, [code]);

  // Browser title abbreviation
  useEffect(() => {
    if (committee) document.title = `${abbreviateCommitteeName(committee.name)} — ${country || 'Delegate'}`;
    return () => { document.title = 'Gavelling'; };
  }, [committee?.name, country]);

  useEffect(() => {
    if (!committee) return;
    try { const stored = localStorage.getItem(`chat-read-${committee.code}`); if (stored) setChatReadCounts(JSON.parse(stored)); } catch {}
  }, [committee?.code]);

  useEffect(() => {
    if (!committee) return;
    try { localStorage.setItem(`chat-read-${committee.code}`, JSON.stringify(chatReadCounts)); } catch {}
  }, [chatReadCounts, committee?.code]);

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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push('/'); };
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

  // Detect GSL request denial
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
    prevPendingRef.current = committee.pendingMotions;
  }, [committee?.pendingMotions, committee?.speakersList, committee?.currentSpeaker, country]);

  if (loading) return <GavelLoader />;

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1B3828' }}>{t('delegate_session_not_found')}</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>Code "{code}" is invalid or the session has ended.</p>
          <Link href="/join" className="font-black text-white px-6 py-3 rounded-xl transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828' }}>TRY AGAIN</Link>
        </div>
      </div>
    );
  }

  const settings = getSettings(committee.code);
  const myDelegate = committee.delegates.find((d) => d.country === country);
  const isAbsent = !myDelegate || myDelegate.status === 'absent';
  const myQueueIndex = committee.speakersList.findIndex((s) => s.country === country);
  const isOnSpeakersList = myQueueIndex !== -1;
  const isCurrentSpeaker = committee.currentSpeaker?.country === country;
  const changesLeft = myDelegate ? statusChangesRemaining(committee.id, country) : 0;

  const enabledMotionTypes = {
    moderated: settings.motionModeratedCaucus,
    unmoderated: settings.motionUnmoderatedCaucus,
    consultation: settings.motionCoW,
    tour: settings.motionTourDeTable,
  };

  const phaseDisplay = (() => {
    const mn = language === 'ar' ? {
      moderated: 'حوار منهجي',
      unmoderated: 'حوار حر',
      consultation: 'مشاورات الهيئة',
      tour: 'جولة المتحدثين',
      suspendDebate: 'تعليق النقاش',
      endDebate: 'إنهاء النقاش',
    } : language === 'fr' ? {
      moderated: 'Caucus modéré',
      unmoderated: 'Caucus non modéré',
      consultation: "Consultation de l'assemblée",
      tour: 'Tour de table',
      suspendDebate: 'Suspension du débat',
      endDebate: 'Clôture du débat',
    } : language === 'es' ? {
      moderated: 'Cáucus Moderado',
      unmoderated: 'Cáucus No Moderado',
      consultation: 'Consulta de Gabinete',
      tour: 'Round Robin',
      suspendDebate: 'Suspender Debate',
      endDebate: 'Cerrar Debate',
    } : { ...DEFAULT_MOTION_NAMES };
    if (committee.phase === 'moderated-caucus') return mn.moderated ?? PHASE_LABELS['moderated-caucus'];
    if (committee.phase === 'unmoderated-caucus') return mn.unmoderated ?? PHASE_LABELS['unmoderated-caucus'];
    return PHASE_LABEL[committee.phase] ?? PHASE_LABELS[committee.phase] ?? committee.phase;
  })();

  const isAdjourned = committee.phase === 'adjourned';

  // ── Status change handler — optimistic update to avoid visible lag
  const handleStatusChange = async (newStatus: DelegateStatus) => {
    if (!myDelegate) return;
    if (changesLeft <= 0) return;
    setCommittee((prev) => prev ? {
      ...prev,
      delegates: prev.delegates.map((d) => d.id === myDelegate.id ? { ...d, status: newStatus } : d),
    } : prev);
    recordStatusChange(committee.id, country);
    setDelegateStatusInDB(myDelegate.id, newStatus);
  };

  // ── Join request handler (absent → P or PV)
  const handleRequestJoin = async (desiredStatus: 'present' | 'present-voting') => {
    if (!myDelegate) return;
    setJoinRequesting(true);
    setJoinStatus(desiredStatus);
    setJoinDenied(false);
    await requestJoinSession(committee.id, myDelegate.id, country, desiredStatus);
    setJoinRequesting(false);
  };

  // ── Request to be added to speakers list (chair must approve)
  const isGslRequestPending = (committee.pendingMotions ?? []).some(
    (m) => (m.type as string) === 'gsl-request' && m.proposedBy === country
  );
  const handleAddMeToSpeakers = () => {
    if (!myDelegate || isAbsent) return;
    requestGslSpot(committee.id, myDelegate.id, myDelegate.country);
  };

  // Section 7 — shortened tab labels
  const chatDisabled = getCommitteeFlags(committee).disableChat;
  const tabs: { key: DelegateTab; label: string }[] = [
    { key: 'session',   label: t('delegate_tab_session') },
    { key: 'documents', label: t('delegate_tab_documents') },
    ...(chatDisabled ? [] : [{ key: 'chat' as DelegateTab, label: t('delegate_tab_chat') }]),
    { key: 'stats',     label: t('delegate_tab_stats') },
  ];
  // If chat gets disabled while it's the open tab, fall back to Session.
  useEffect(() => {
    if (chatDisabled && tab === 'chat') setTab('session');
  }, [chatDisabled, tab]);

  // ── Absent banner (blocks active interaction)
  const AbsentBanner = () => (
    <div className="mx-4 mt-4 rounded-xl p-4" style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #DDD4C0' }}>
      <div className="text-sm font-black mb-1" style={{ color: '#1B3828' }}>{t('delegate_absent_title')}</div>
      <div className="text-xs mb-3" style={{ color: '#6A5A4A' }}>{t('delegate_absent_desc')}</div>
      {joinStatus && !joinDenied ? (
        <div className="text-xs font-medium flex items-center gap-1.5" style={{ color: '#1B3828' }}>
          <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1B3828' }} />
          {t('delegate_join_waiting')}
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => handleRequestJoin('present')} disabled={joinRequesting}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors focus:outline-none"
            style={{ backgroundColor: 'transparent', border: '1px solid #DDD4C0', color: '#6A5A4A' }}>
            {t('delegate_present_btn')}
          </button>
          <button onClick={() => handleRequestJoin('present-voting')} disabled={joinRequesting}
            className="flex-1 py-2 rounded-xl text-xs font-black text-white transition-colors focus:outline-none"
            style={{ backgroundColor: '#1B3828' }}>
            {t('delegate_pv_btn')}
          </button>
        </div>
      )}
      {joinDenied && <p className="text-xs mt-2 font-semibold" style={{ color: '#8B2020' }}>{t('delegate_join_denied')}</p>}
    </div>
  );

  if (sessionSuspended && (committee.suspendedAt || wasEverSuspended.current)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-8" style={{ backgroundColor: '#EDE7D8' }}>
        <p className="text-xs font-mono font-bold tracking-widest mb-2" style={{ color: '#1B3828' }}>{getCommitteeDisplayName(committee.name, language)} · {committee.code}</p>
        <h1 className="text-4xl font-black mb-4 tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('delegate_adjourned_title')}</h1>
        <p className="text-lg" style={{ color: '#6A5A4A' }}>{t('delegate_adjourned_desc')}</p>
        <p className="text-xs mt-8" style={{ color: '#9A8A78' }}>{t('delegate_adjourned_esc')}</p>
      </div>
    );
  }

  return (
    <FitToScreen>
    <div className="h-full w-full flex flex-col overflow-hidden" style={{ backgroundColor: '#EDE7D8' }}>
      <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      {/* Header */}
      <header className="border-b border-[#DDD4C0] bg-[#FAF8F3] px-4 h-11 flex items-center gap-2 relative z-[2] shrink-0">
        <Link href="/">
          <img src="/GavellingLogo.png" alt="Gavelling" className="w-[150px] h-auto max-h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </Link>
        <div className="flex flex-1 min-w-0 h-full">
          {(['session', 'documents', 'chat', 'stats'] as DelegateTab[]).filter((t2) => t2 !== 'chat' || !chatDisabled).map((tab2, i) => {
            const labels: Record<DelegateTab, string> = { session: t('delegate_session_tab'), documents: t('delegate_documents_tab'), chat: t('tab_chat'), stats: t('delegate_stats_tab') };
            const isActive = tab === tab2;
            const chatUnread = (() => {
              if (tab2 !== 'chat') return 0;
              const total = committee.messages.filter((m) => m.sender !== country && !m.content.startsWith('__log__:') && !m.isPrivate).length;
              return Math.max(0, total - (chatReadCounts['everyone'] ?? 0));
            })();
            return (
              <React.Fragment key={tab2}>
                {i > 0 && <div style={{ width: '1px', height: '28px', alignSelf: 'center', backgroundColor: 'rgba(28,20,16,0.2)', flexShrink: 0 }} />}
                <button
                  onClick={() => {
                    setTab(tab2);
                    if (tab2 === 'chat') {
                      setChatReadCounts((prev) => ({
                        ...prev,
                        everyone: committee.messages.filter((m) => !m.content.startsWith('__log__:') && !m.isPrivate && m.sender !== country).length,
                      }));
                    }
                  }}
                  className="flex-1 flex items-center justify-center text-[18px] font-bold px-3 relative h-full transition-all duration-200"
                  style={{ color: isActive ? '#1B3828' : '#1C1410', backgroundColor: isActive ? 'rgba(27,56,40,0.07)' : 'transparent', fontWeight: isActive ? 900 : 700 }}
                  onMouseEnter={(e) => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.color = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.transform = 'translateY(-1px)'; } }}
                  onMouseLeave={(e) => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.color = '#1C1410'; el.style.backgroundColor = 'transparent'; el.style.transform = 'translateY(0)'; } }}>
                  {labels[tab2]}
                  {chatUnread > 0 && tab !== 'chat' && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-[#1B3828] rounded-full text-white text-[10px] flex items-center justify-center">{chatUnread}</span>
                  )}
                  <span style={{ position: 'absolute', bottom: '4px', left: '12px', right: '12px', height: '2px', backgroundColor: '#B6871F', transform: isActive ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform 200ms ease', borderRadius: '2px' }} />
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { navigator.clipboard.writeText(committee.code); }}
            className="text-xs font-mono bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#1C1410] px-2.5 py-1 rounded-lg transition-colors shrink-0 focus:outline-none">
            {committee.code}
          </button>
        </div>
      </header>

      {/* Ended tab bar */}
      {sessionEnded && (
        <div className="flex shrink-0" style={{ borderBottom: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
          <button onClick={() => setEndedTab('ended')}
            className="flex-1 py-2.5 text-xs font-black transition-colors focus:outline-none"
            style={{ color: endedTab === 'ended' ? '#1B3828' : '#9A8A78', borderBottom: endedTab === 'ended' ? '2px solid #1B3828' : '2px solid transparent', marginBottom: '-1px', fontFamily: "'Outfit', sans-serif" }}>
            {t('session_end_view')}
          </button>
          <button onClick={() => setEndedTab('session')}
            className="flex-1 py-2.5 text-xs font-black transition-colors focus:outline-none"
            style={{ color: endedTab === 'session' ? '#1B3828' : '#9A8A78', borderBottom: endedTab === 'session' ? '2px solid #1B3828' : '2px solid transparent', marginBottom: '-1px', fontFamily: "'Outfit', sans-serif" }}>
            {t('session_view')}
          </button>
        </div>
      )}

      {sessionEnded && endedTab === 'ended' ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <h1 className="text-4xl font-black mb-4 tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('session_ended_title').toUpperCase()}</h1>
          <p className="text-xl mb-1" style={{ color: '#6A5A4A' }}>{getCommitteeDisplayName(committee.name, language)}</p>
          <p className="text-base mb-8" style={{ color: '#9A8A78' }}>{committee.topic}</p>
          {hoursRemaining !== null && (
            <p className="text-sm" style={{ color: '#9A8A78' }}>{t('session_hours_until_delete', { n: hoursRemaining, s: hoursRemaining !== 1 ? 's' : '' })}</p>
          )}
          <p className="text-xs mt-8" style={{ color: '#9A8A78' }}>{t('session_ended_hint')}</p>
        </div>
      ) : (
      <>
      {sessionEnded && endedTab === 'session' && (
        <div className="shrink-0 px-4 py-2 text-center text-sm font-bold" style={{ backgroundColor: '#1B3828', borderBottom: '1px solid #3D7A52', color: '#EED98A' }}>
          {t('session_ended_banner')}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden relative z-[2]">
      {tab !== 'chat' && <div className="flex-1 overflow-y-auto">

        {/* ── Session tab ── */}
        {tab === 'session' && (
          <div>
            {/* Committee info strip */}
            <div className="px-4 pt-4 pb-2 text-center">
              <p className="text-xs font-mono font-bold uppercase tracking-widest mb-0.5" style={{ color: '#9A8A78' }}>{t('delegate_committee_label')}</p>
              <p className="font-black text-base" style={{ color: '#1B3828' }}>{getCommitteeDisplayName(committee.name, language)}</p>
              {committee.topic && <p className="text-xs mt-0.5" style={{ color: '#9A8A78' }}>{committee.topic}</p>}
            </div>
            {isAbsent && !sessionEnded && <AbsentBanner />}

            {/* Moderated caucus special view */}
            {committee.phase === 'moderated-caucus' && committee.caucus && (
              <div className="p-4 max-w-2xl mx-auto space-y-4">
                {/* Section 1: FlagImg replaces text-8xl emoji */}
                <div className="flex justify-center">
                  <FlagImg code={getCountryByName(country)?.code ?? ''} size={88} className="rounded-full shadow-lg" />
                </div>
                <div className="rounded-xl p-5 text-center" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                  <p className="text-3xl font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>{t('delegate_moderated_caucus_label')}</p>
                  <p className="text-xl mt-2" style={{ color: '#6A5A4A' }}>{committee.caucus.purpose}</p>
                  {committee.caucus.currentSpeaker && (
                    <div className="mt-4">
                      <div className="text-xs text-[#9A8A78] mb-2 font-mono">{t('delegate_now_speaking')}</div>
                      {/* Section 1: FlagImg replaces text-6xl emoji */}
                      <div className="flex justify-center">
                        <FlagImg code={getCountryByName(committee.caucus.currentSpeaker)?.code ?? ''} size={64} />
                      </div>
                      <div className={`text-xl font-bold mt-1 ${committee.caucus.currentSpeaker === country ? 'text-[#B6871F]' : 'text-[#1C1410]'}`}>
                        {committee.caucus.currentSpeaker}{committee.caucus.currentSpeaker === country && t('delegate_you_suffix')}
                      </div>
                    </div>
                  )}
                  <div className="text-3xl font-black font-mono mt-4" style={{ color: '#1C1410' }}>
                    {formatTime(committee.caucus.remainingTime)}
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mt-2" style={{ backgroundColor: '#DDD4C0' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${committee.caucus.totalTime > 0 ? (committee.caucus.remainingTime / committee.caucus.totalTime) * 100 : 0}%`, backgroundColor: '#1B3828' }} />
                  </div>
                </div>
                {/* Upcoming speakers in caucus queue */}
                {(committee.caucusQueue ?? []).length > 0 && (
                  <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4">
                    <div className="text-xs text-[#9A8A78] font-mono mb-2">{t('delegate_upcoming_speakers')}</div>
                    <div className="space-y-1.5">
                      {committee.caucusQueue.slice(0, 8).map((s, i) => (
                        <div key={s.delegateId} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-sm ${s.country === country ? 'bg-[#1B3828]/20 border border-[#1B3828]/30' : ''}`}>
                          <span className="text-[#9A8A78] text-xs w-4 font-mono shrink-0">{i + 1}</span>
                          {/* Section 1: FlagImg replaces text-lg emoji */}
                          <FlagImg code={getCountryByName(s.country)?.code ?? ''} size={20} className="shrink-0" />
                          <span className={s.country === country ? 'text-[#B6871F] font-bold' : 'text-[#6A5A4A]'}>
                            {getCountryDisplayName(s.country, language)}{s.country === country && t('delegate_you_suffix')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Unmoderated caucus dedicated view */}
            {committee.phase === 'unmoderated-caucus' && committee.caucus && (
              <div className="p-4 max-w-2xl mx-auto space-y-4">
                <div className="flex justify-center">
                  <FlagImg code={getCountryByName(country)?.code ?? ''} size={88} className="rounded-full shadow-lg" />
                </div>
                <div className="rounded-xl p-6 text-center space-y-3" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                  <p className="text-3xl font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>{t('delegate_unmoderated_caucus_label')}</p>
                  {committee.caucus.purpose && (
                    <p className="text-xl" style={{ color: '#6A5A4A' }}>{committee.caucus.purpose}</p>
                  )}
                  <div className="text-5xl font-black font-mono" style={{ color: '#1C1410' }}>
                    {formatTime(committee.caucus.remainingTime)}
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#DDD4C0' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${committee.caucus.totalTime > 0 ? (committee.caucus.remainingTime / committee.caucus.totalTime) * 100 : 0}%`, backgroundColor: '#1B3828' }} />
                  </div>
                  <p className="text-sm" style={{ color: '#9A8A78' }}>{t('delegate_unmod_desc')}</p>
                </div>
                {committee.caucus.isConsultation && <CowDelegationBoard committee={committee} />}
              </div>
            )}

            {/* Section 3: exclude both moderated and unmoderated caucus phases */}
            {committee.phase !== 'moderated-caucus' && committee.phase !== 'unmoderated-caucus' && (
            <div className={`p-4 space-y-4 max-w-2xl mx-auto ${isAbsent ? 'opacity-60 pointer-events-none select-none' : ''}`}>
              {/* Flag — larger, rectangular, with country name below */}
              <div className="flex flex-col items-center gap-2 py-2">
                {(() => { const c = getCountryByName(country); return c ? <img src={getFlagUrl(c.code)} alt={country} style={{ width: '120px', height: '86px', objectFit: 'cover', borderRadius: '10px', border: '1.5px solid rgba(28,20,16,0.12)', boxShadow: '0 4px 16px rgba(27,56,40,0.12)' }} /> : null; })()}
                <p className="font-black text-3xl" style={{ color: '#1C1410' }}>{getCountryDisplayName(country, language)}</p>
              </div>

              {/* Section 5: Voting card */}
              {committee.phase === 'voting' && (() => {
                const activeDoc = (committee.documents ?? []).find(
                  (d) => d.status === 'on-floor' || d.status === 'introduced'
                );
                return (
                  <div className="rounded-xl p-5 text-center space-y-2" style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #1B3828' }}>
                    <p className="text-xs font-mono font-bold" style={{ color: '#1B3828' }}>{t('delegate_voting_procedure')}</p>
                    <p className="text-2xl font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('delegate_vote_in_progress')}</p>
                    {activeDoc && (
                      <>
                        <p className="text-sm font-mono text-[#7B4A1E]">{activeDoc.docCode}</p>
                        <p className="text-base font-bold text-white">{activeDoc.title}</p>
                      </>
                    )}
                    <p className="text-xs text-[#7A5A38] mt-2">
                      {t('delegate_vote_desc')}
                    </p>
                  </div>
                );
              })()}

              {/* Status card */}
              <div className="rounded-xl p-5 border bg-[#EDE7D8] border-[#DDD4C0]">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-[#9A8A78] mb-2">{t('delegate_session_status')}</div>
                  <div className="text-2xl font-black mb-1" style={{ color: isCurrentSpeaker ? '#1B3828' : isAdjourned ? '#8B2020' : '#1C1410' }}>
                    {isCurrentSpeaker ? t('delegate_you_have_floor') : phaseDisplay}
                  </div>
                  {/* queue position text removed */}

                  {!isCurrentSpeaker && committee.currentSpeaker && committee.phase === 'speakers-list' && (
                    <div className="mt-3">
                      <div className="text-xs text-[#9A8A78] mb-1">{t('delegate_now_speaking')}</div>
                      <div className="flex items-center gap-2">
                        <FlagImg code={getCountryByName(committee.currentSpeaker.country)?.code ?? ''} size={24} />
                        <span className="font-bold text-[#1C1410]">{getCountryDisplayName(committee.currentSpeaker.country, language)}</span>
                      </div>
                      {isOnSpeakersList && myQueueIndex === 0 && (
                        <p className="text-sm font-black mt-2" style={{ color: '#B8844A' }}>
                          {t('delegate_up_next')}
                        </p>
                      )}
                    </div>
                  )}

                  {committee.caucus && (
                    <div className="mt-3">
                      <div className="text-sm text-[#6A5A4A] mb-2">
                        {committee.caucus.type === 'moderated' ? t('delegate_moderated') : t('delegate_unmoderated')} {language === 'ar' ? '' : language === 'es' ? 'Cáucus' : 'Caucus'}
                        {committee.caucus.purpose && ` — ${committee.caucus.purpose}`}
                      </div>
                      <div className="text-3xl font-black font-mono text-[#1C1410]">
                        {formatTime(committee.caucus.remainingTime)}
                      </div>
                      <div className="h-2 rounded-full overflow-hidden mt-2" style={{ backgroundColor: '#DDD4C0' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${(committee.caucus.remainingTime / committee.caucus.totalTime) * 100}%`, backgroundColor: '#1B3828' }} />
                      </div>
                      {committee.caucus.currentSpeaker && (
                        <div className="mt-3 text-sm flex items-center gap-2">
                          <span className="text-[#6A5A4A]">{t('delegate_speaking_label')}</span>
                          {/* Section 1: FlagImg replaces text-xl */}
                          <FlagImg code={getCountryByName(committee.caucus.currentSpeaker)?.code ?? ''} size={20} />
                          <span className={`font-bold ${committee.caucus.currentSpeaker === country ? 'text-[#B6871F]' : 'text-[#1C1410]'}`}>
                            {committee.caucus.currentSpeaker}{committee.caucus.currentSpeaker === country && t('delegate_you_suffix')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Speakers list */}
              {committee.phase === 'speakers-list' && (
                <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-[#9A8A78] font-mono">{t('delegate_speakers_list_header')}</div>
                    {!isOnSpeakersList && !isCurrentSpeaker && myDelegate?.status !== 'absent' && !sessionEnded && (
                      isGslRequestPending ? (
                        <span className="text-xs font-semibold" style={{ color: '#B8844A' }}>{t('delegate_awaiting_approval')}</span>
                      ) : gslDenied ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">{t('delegate_gsl_denied')}</span>
                          <button onClick={() => setGslDenied(false)}
                            className="text-xs bg-[#DDD4C0] hover:bg-[#C8BAA8] border border-[#1B3828]/30 text-[#6A5A4A] px-2 py-1 rounded-lg font-medium transition-colors">
                            {t('delegate_request_again')}
                          </button>
                        </div>
                      ) : (
                        <button onClick={handleAddMeToSpeakers}
                          className="text-xs text-white px-3 py-1.5 rounded-lg font-black transition-colors focus:outline-none"
                          style={{ backgroundColor: '#1B3828', letterSpacing: '0.04em' }}>
                          + {t('delegate_request_gsl')}
                        </button>
                      )
                    )}
                    {isOnSpeakersList && (
                      <span className="text-xs font-bold" style={{ color: '#1B3828' }}>
                        {myQueueIndex === 0 ? t('delegate_up_next_queue') : t('delegate_after_speakers').replace('{n}', String(myQueueIndex)).replace('{s}', myQueueIndex !== 1 ? 's' : '')}
                      </span>
                    )}
                  </div>
                  {committee.speakersList.length === 0 ? (
                    <p className="text-sm text-[#9A8A78]">{t('delegate_no_speakers')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {committee.speakersList.map((s, i) => (
                        <div key={s.delegateId} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-sm ${s.country === country ? 'bg-[#1B3828]/20 border border-[#1B3828]/30' : ''}`}>
                          <span className="text-[#9A8A78] text-xs w-4 font-mono shrink-0">{i + 1}</span>
                          {/* Section 1: FlagImg replaces text-lg */}
                          <FlagImg code={getCountryByName(s.country)?.code ?? ''} size={20} className="shrink-0" />
                          <span className="font-semibold" style={{ color: s.country === country ? '#1B3828' : '#1C1410', fontWeight: s.country === country ? 700 : 600 }}>
                            {getCountryDisplayName(s.country, language)}{s.country === country && t('delegate_you_suffix')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* My delegation + status toggle */}
              <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4">
                <div className="text-xs text-[#9A8A78] font-mono mb-3">{t('delegate_your_delegation')}</div>
                <div className="flex items-center gap-3 mb-3">
                  {/* Section 1: FlagImg replaces text-3xl */}
                  <FlagImg code={getCountryByName(country)?.code ?? ''} size={36} />
                  <div>
                    <div className="font-black text-base" style={{ color: '#1C1410' }}>{getCountryDisplayName(country, language)}</div>
                    <div className="text-xs font-semibold mt-0.5" style={{ color: myDelegate?.status === 'absent' ? '#8B2020' : '#1B3828' }}>
                      {myDelegate?.status === 'present' ? t('delegate_status_present') :
                       myDelegate?.status === 'present-voting' ? t('delegate_status_pv') : t('delegate_status_absent')}
                    </div>
                  </div>
                </div>
                {/* Status toggle — only when already present/PV and session not ended */}
                {!isAbsent && !sessionEnded && !getCommitteeFlags(committee).lockDelegateRollCall && (
                  <div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusChange('present')}
                        disabled={myDelegate?.status === 'present' || changesLeft <= 0}
                        className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors focus:outline-none"
                        style={{
                          backgroundColor: myDelegate?.status === 'present' ? '#1B3828' : 'transparent',
                          border: `1px solid ${myDelegate?.status === 'present' ? '#1B3828' : '#DDD4C0'}`,
                          color: myDelegate?.status === 'present' ? '#EDE7D8' : changesLeft <= 0 ? '#9A8A78' : '#6A5A4A',
                          cursor: changesLeft <= 0 && myDelegate?.status !== 'present' ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {t('delegate_present_btn')}
                      </button>
                      <button
                        onClick={() => handleStatusChange('present-voting')}
                        disabled={myDelegate?.status === 'present-voting' || changesLeft <= 0}
                        className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors focus:outline-none"
                        style={{
                          backgroundColor: myDelegate?.status === 'present-voting' ? '#1B3828' : 'transparent',
                          border: `1px solid ${myDelegate?.status === 'present-voting' ? '#1B3828' : '#DDD4C0'}`,
                          color: myDelegate?.status === 'present-voting' ? '#EDE7D8' : changesLeft <= 0 ? '#9A8A78' : '#6A5A4A',
                          cursor: changesLeft <= 0 && myDelegate?.status !== 'present-voting' ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {t('delegate_pv_btn')}
                      </button>
                    </div>
                    <p className="text-[10px] text-[#9A8A78] mt-1.5 text-center">
                      {t('delegate_status_changes_left').replace('{n}', String(changesLeft)).replace('{s}', changesLeft !== 1 ? 's' : '')}
                    </p>
                  </div>
                )}
              </div>
            </div>
            )}{/* end phase !== moderated-caucus && !== unmoderated-caucus */}
          </div>
        )}

        {/* Motions tab removed */}

        {/* Resolutions tab removed — merged into Documents tab */}

        {/* ── Documents tab (merged Submit + View DRs) ── */}
        {tab === 'documents' && (
          <div>
            {(() => {
              const drs = (committee.documents ?? []).filter(
                (d) => d.type === 'draft-resolution'
              );
              return (
                <>
                  {/* Tab-style subdirectory bar */}
                  <div className="flex shrink-0" style={{ borderBottom: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
                    <button
                      onClick={() => setDocsSection('submit')}
                      className="flex-1 py-2.5 text-xs font-black transition-colors focus:outline-none"
                      style={{ color: docsSection === 'submit' ? '#1B3828' : '#9A8A78', borderBottom: docsSection === 'submit' ? '2px solid #1B3828' : '2px solid transparent', marginBottom: '-1px', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}>
                      {t('delegate_submit_document')}
                    </button>
                    <button
                      onClick={() => setDocsSection('view')}
                      className="flex-1 py-2.5 text-xs font-black transition-colors focus:outline-none"
                      style={{ color: docsSection === 'view' ? '#1B3828' : '#9A8A78', borderBottom: docsSection === 'view' ? '2px solid #1B3828' : '2px solid transparent', marginBottom: '-1px', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}>
                      {t('delegate_view_documents')}
                    </button>
                  </div>

                  {/* Submit section */}
                  {docsSection === 'submit' && (
                    <>
                      {isAbsent && !sessionEnded && <AbsentBanner />}
                      {!sessionEnded ? (
                        <div className={isAbsent ? 'opacity-60 pointer-events-none select-none' : ''}>
                          <DelegateDocumentsTab committee={committee} country={country} />
                        </div>
                      ) : (
                        <div className="p-8 text-center font-semibold" style={{ color: '#9A8A78' }}>{t('delegate_session_closed_docs')}</div>
                      )}
                    </>
                  )}

                  {/* View DRs + WPs section */}
                  {docsSection === 'view' && (() => {
                    const wps = (committee.documents ?? []).filter((d) => d.type === 'working-paper');
                    return (
                      <div className="p-4 max-w-2xl mx-auto space-y-6">
                        <div className="space-y-3">
                          <h2 className="text-lg font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('delegate_draft_resolutions')}</h2>
                          {drs.length === 0 ? (
                            <div className="text-center py-4 font-semibold" style={{ color: '#9A8A78' }}>{t('delegate_no_drs')}</div>
                          ) : (
                            drs.map((doc) => {
                              const isPresenting = doc.status === 'introduced';
                              const isPassed = doc.status === 'passed';
                              const isFailed = doc.status === 'failed';
                              const isPendingVote = doc.status === 'on-floor';
                              return (
                                <div key={doc.id} className="rounded-xl p-4 space-y-2" style={{ backgroundColor: '#FAF8F3', border: `1.5px solid ${isPassed ? '#1B3828' : isFailed ? 'rgba(139,32,32,0.4)' : '#DDD4C0'}` }}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <span className="text-xs font-mono font-bold me-2" style={{ color: '#1B3828' }}>{doc.docCode}</span>
                                      <span className="font-semibold text-sm" style={{ color: '#1C1410' }}>{doc.title}</span>
                                    </div>
                                    {isPassed && <span className="shrink-0 text-xs font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>{t('delegate_passed_badge')}</span>}
                                    {isFailed && <span className="shrink-0 text-xs font-black px-2 py-0.5 rounded-full" style={{ color: '#8B2020', border: '1px solid rgba(139,32,32,0.3)' }}>{t('delegate_failed_badge')}</span>}
                                    {isPresenting && <span className="shrink-0 text-xs font-black px-2 py-0.5 rounded-full animate-pulse" style={{ color: '#B8844A', border: '1px solid #B8844A' }}>{t('delegate_now_presenting')}</span>}
                                    {isPendingVote && <span className="shrink-0 text-xs font-black px-2 py-0.5 rounded-full" style={{ color: '#B8844A', border: '1px solid rgba(184,132,74,0.5)' }}>{t('delegate_pending_vote')}</span>}
                                  </div>
                                  <div className="text-xs" style={{ color: '#9A8A78' }}>
                                    {doc.sponsors.map((s, i) => (
                                      <span key={s} style={{ color: i === 0 ? '#6A5A4A' : '#9A8A78', fontWeight: i === 0 ? 600 : 400 }}>
                                        {i > 0 ? ', ' : ''}{flagFor(s)} {getCountryDisplayName(s, language)}
                                      </span>
                                    ))}
                                  </div>
                                  {doc.fileUrl && doc.fileName && (
                                    <InlinePdfViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                        <div className="space-y-3">
                          <h2 className="text-lg font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('delegate_working_papers')}</h2>
                          {wps.length === 0 ? (
                            <div className="text-center py-4 font-semibold" style={{ color: '#9A8A78' }}>{t('delegate_no_wps')}</div>
                          ) : (
                            wps.map((doc) => (
                              <div key={doc.id} className="rounded-xl p-4 space-y-2" style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #DDD4C0' }}>
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <span className="text-xs font-mono font-bold me-2" style={{ color: '#1B3828' }}>{doc.docCode}</span>
                                    <span className="font-semibold text-sm" style={{ color: '#1C1410' }}>{doc.title}</span>
                                  </div>
                                  {doc.status === 'submitted' && <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828' }}>{t('documents_status_submitted')}</span>}
                                </div>
                                <div className="text-xs" style={{ color: '#9A8A78' }}>
                                  {doc.sponsors.map((s, i) => (
                                    <span key={s} style={{ color: i === 0 ? '#6A5A4A' : '#9A8A78', fontWeight: i === 0 ? 600 : 400 }}>
                                      {i > 0 ? ', ' : ''}{flagFor(s)} {getCountryDisplayName(s, language)}
                                    </span>
                                  ))}
                                </div>
                                {doc.fileUrl && doc.fileName && (
                                  <InlinePdfViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        )}

        {/* ── Stats tab ── */}
        {tab === 'stats' && (
          <StatisticsTab committee={committee} country={country} />
        )}
      </div>}
      {/* ── Chat tab ── */}
      {tab === 'chat' && !chatDisabled && (
        <div className="flex-1 flex overflow-hidden" style={{ height: '100%' }}>
          <ChatPanel
            committee={committee}
            senderName={country}
            isChair={false}
            onClose={() => setTab('session')}
            initialReadCounts={chatReadCounts}
            onReadCountsChange={setChatReadCounts}
            readOnly={sessionEnded}
            speakerCard={null}
          />
        </div>
      )}
      </div>
      </>
      )}
    </div>
    </FitToScreen>
  );
}

export default function DelegateSession({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<GavelLoader />}>
      <DelegateSessionInner params={params} />
    </Suspense>
  );
}
