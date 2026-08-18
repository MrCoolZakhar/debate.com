'use client';

import React, { use, useEffect, useState, useRef, useCallback, Suspense } from 'react';
import SessionsHeaderLogo from '@/components/SessionsHeaderLogo';
import { Mic, FileText, MessageCircle, MessageSquare, Clock, Mic2, Languages, LogOut, Check, FolderOpen, Hand } from 'lucide-react';
import { OUTFIT, Emoji3D } from '@/components/neu';
import {
  DelegateStyles, DG, LIFT, Panel, SectionLabel, FlagDisc, FlagOrdinalDisc, StatRow,
  RollCallSwitch, ChunkyButton, SquareButton, QueueRow, Sheet, Equalizer,
  useMeasuredSize, useFitCount, ordinalSuffixFor, arcInset,
} from '@/components/delegate/DelegateUI';
import { useSearchParams, useRouter } from 'next/navigation';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { Committee, CaucusState, Delegate, DocumentType, SpeakingLogEntry, DelegateStatus } from '@/lib/types';
import ChatPanel from '@/components/ChatPanel';
import { getScoringConfig } from '@/lib/scoring';
import { selectDelegateTips } from '@/lib/delegateTips';
import { getDelegateFeedback } from '@/lib/committeeService';
import { getFlagUrl, getCountryByName, getCountryDisplayName, matchesCountryQuery } from '@/lib/countries';
import { getCommitteeDisplayName } from '@/lib/presetNames';
import { supabase } from '@/lib/supabase';
import { Emoji } from '@/components/Emoji';
import CowDelegationBoard from '@/components/CowDelegationBoard';
import ChatDisabledNotice from '@/components/ChatDisabledNotice';
import { getCommitteeFlags, sponsorLabel, motionNames } from '@/lib/committeeFlags';
import { docName, docCount, docLimit, docLimitReached } from '@/lib/docNames';
import { chatUnreadTotal, mergeMessagesById } from '@/lib/chatConversations';
import { loadChatReadCounts, saveChatReadCounts } from '@/lib/chatReadKey';
import { catchUpMessages, useChatCatchUp, useReSubscribeCatchUp } from '@/lib/useChatCatchUp';
import {
  getCommitteeByCode,
  // Explicitly sanctioned on this surface: a pure reader over the committee row,
  // no store, no localStorage (see its comment banner in committeeService).
  caucusRemainingNow,
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

// How long a locally-written delegate status stays pinned against an incoming refetch before
// control goes back to the DB row. Same number as the chair page's STATUS_PIN_TTL_MS — both
// are the backstop for a status write that never lands, and the two surfaces should not give
// up at different moments.
const STATUS_PIN_TTL_MS = 8000;

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

// Give back the slot burned by a status change whose DB write was rejected. Pops the most
// recent timestamp only — the optimistic `recordStatusChange` stays where it is (moving it
// behind an await would reopen the double-click hole it exists to close).
function refundStatusChange(committeeId: string, country: string): void {
  try {
    const key = getRateLimitKey(committeeId, country);
    const now = Date.now();
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const recent = getStatusChangeTimes(committeeId, country).filter((t) => now - t < THREE_HOURS);
    recent.pop();
    localStorage.setItem(key, JSON.stringify(recent));
  } catch {}
}

function statusChangesRemaining(committeeId: string, country: string): number {
  const now = Date.now();
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const recent = getStatusChangeTimes(committeeId, country).filter((t) => now - t < THREE_HOURS);
  return Math.max(0, 3 - recent.length);
}

// ── GSL request cooldowns ────────────────────────────────────────────────────
// Two independent clocks on the "request to speak" button, both persisted so a
// reload cannot be used to skip either one:
//
//  • GSL_RETRY_MS — how long a delegate waits on a chair who has not acted. The
//    request stays pending the whole time; this only re-enables the button so a
//    delegate whose request was quietly ignored is not stuck forever.
//  • GSL_DENIED_MS — the lockout after a chair actually says no. Without it,
//    "Request Again" is a spam button pointed at the dais.
//
// Keyed per committee AND per country, exactly like the status-change limiter
// above: one browser can hold two delegations (a shared laptop), and the two
// must not share a cooldown.
const GSL_RETRY_MS = 60 * 1000;
const GSL_DENIED_MS = 15 * 60 * 1000;
// How long to wait before believing a vanished request was actually refused.
// An approval writes speakers_list and deletes the motion separately, so the
// delegate briefly looks refused when the delete arrives first; this outlasts
// that gap without being long enough for a real refusal to feel unacknowledged.
const GSL_DENIAL_GRACE_MS = 2500;

type GslCooldown = { requestedAt?: number; deniedAt?: number };

function getGslCooldownKey(committeeId: string, country: string): string {
  return `gsl-request:${committeeId}:${country}`;
}

function readGslCooldown(committeeId: string, country: string): GslCooldown {
  try {
    const raw = localStorage.getItem(getGslCooldownKey(committeeId, country));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as GslCooldown) : {};
  } catch { return {}; }
}

function writeGslCooldown(committeeId: string, country: string, value: GslCooldown): void {
  try {
    const key = getGslCooldownKey(committeeId, country);
    if (!value.requestedAt && !value.deniedAt) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** ms left on the post-denial lockout, 0 when it is not running. */
function gslDeniedRemaining(cd: GslCooldown, now: number): number {
  if (!cd.deniedAt) return 0;
  return Math.max(0, GSL_DENIED_MS - (now - cd.deniedAt));
}

/** ms left before an unanswered request may be re-sent, 0 once it has elapsed. */
function gslRetryRemaining(cd: GslCooldown, now: number): number {
  if (!cd.requestedAt) return 0;
  return Math.max(0, GSL_RETRY_MS - (now - cd.requestedAt));
}

/** "14m" / "45s" — coarse on purpose, this is a wait, not a stopwatch. */
function formatCooldown(ms: number): string {
  const secs = Math.ceil(ms / 1000);
  return secs >= 60 ? `${Math.ceil(secs / 60)}m` : `${secs}s`;
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
  /* A failed attachment used to be console-only, so the button just snapped
     back to "Attach file" and the delegate had no idea why. */
  const [uploadError, setUploadError] = useState(false);
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
      // NO upsert. The bucket grants anon INSERT but not UPDATE, and `upsert: true`
      // needs both — every attachment was being refused with a 403 that only
      // reached the console, so the button silently snapped back to "Attach file".
      // Granting anon UPDATE would have been the wrong fix: it would let anyone
      // overwrite any existing document in any committee. The path already carries
      // Date.now(), so there is nothing to upsert over.
      const { error } = await supabase.storage.from('session-documents').upload(path, file);
      if (error) {
        console.error('Storage upload error:', error);
        setFileName(null);
        setUploadError(true);
        return;
      }
      setUploadError(false);
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
          {uploadError && (
            <p className="text-xs mt-1.5" style={{ color: '#8B2020' }}>
              {t('delegate_doc_upload_failed')}
            </p>
          )}
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
/**
 * Speeches only. Points, the category ledger, the by-time rank and the leaderboard are
 * deliberately gone: a delegate sees WHAT they said, under which topic or motion, and for
 * how long. The qualitative surfaces (the chair's factor recap, the coaching tips) stay —
 * neither states a score.
 */
function StatisticsTab({ committee, country }: { committee: Committee; country: string }) {
  const { language } = useLanguage();
  const t = useT();
  const cfg = getScoringConfig(committee);
  // Guidance never states a number or a rank, so it survives the removal of the score UI.
  // The one key that would surface a scoring-config label a delegate cannot otherwise see
  // (`delegate_tip_custom_source`) is suppressed inside the selector.
  const tips = selectDelegateTips(committee, country, language, t);
  // Renamed / localized motion labels, read off the committee row (never getSettings here).
  const mn = motionNames(committee, language);

  // Newest first. Reverse first so entries that share (or lack) a timestamp keep a stable
  // newest-first order under the sort rather than falling back to chronological.
  const myLogs = parseSpeakingLogs(committee)
    .filter((l) => l.country === country)
    .slice()
    .reverse()
    .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
  const totalSeconds = myLogs.reduce((s, l) => s + l.seconds, 0);

  const contextLabel = (ctx: SpeakingLogEntry['context']): string => {
    if (ctx === 'moderated-caucus') return mn.moderated;
    if (ctx === 'unmoderated-caucus') return mn.unmoderated;
    if (ctx === 'tour-de-table') return mn.tour;
    return t('delegate_gsl_fallback');
  };

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

  const num: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

  return (
    <div className="w-full max-w-2xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Compact summary — count + total time, nothing scored */}
      <Panel style={{ display: 'flex', gap: 12 }}>
        {[
          { value: String(myLogs.length), label: t('delegate_speeches_label') },
          { value: formatTime(totalSeconds), label: t('delegate_total_time_label') },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{ ...num, fontFamily: OUTFIT, fontSize: 28, fontWeight: 900, color: DG.forest, lineHeight: 1.1 }}>
              {s.value}
            </div>
            <div style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: DG.faint, marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </Panel>

      {/* Every speech: what it was under, and how long it ran */}
      <Panel style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionLabel>{t('delegate_speaking_history')}</SectionLabel>
        {myLogs.length === 0 ? (
          <p style={{ margin: 0, padding: '10px 0', textAlign: 'center', fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: DG.faint }}>
            {t('delegate_no_speeches')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myLogs.map((l, i) => (
              <div
                key={`${l.timestamp ?? ''}-${i}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: DG.cream, borderRadius: 14, padding: '10px 12px',
                  border: `1px solid ${DG.hairline}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="text-start"
                    style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: DG.ink, lineHeight: 1.25, overflowWrap: 'anywhere' }}
                  >
                    {l.topic || contextLabel(l.context)}
                  </div>
                  <div
                    className="text-start"
                    style={{ marginTop: 2, fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: DG.deepGold }}
                  >
                    {contextLabel(l.context)}
                  </div>
                </div>
                <span style={{ ...num, flexShrink: 0, fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: DG.forest }}>
                  {formatTime(l.seconds)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Chair recap — factor bars only, never the chair's private notes */}
      {latestRecap && recapFactors.length > 0 && (
        <Panel style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionLabel>{t('delegate_recap_header')}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recapFactors.map((f) => {
              const v = latestRecap.factorScores[f.id];
              return (
                <div key={f.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: DG.body, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                    <span style={{ ...num, flexShrink: 0, fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: DG.forest }}>{v}/{cfg.factorScaleMax}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: DG.ivory, boxShadow: LIFT.inSm, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: DG.forest, width: `${Math.min(100, (v / cfg.factorScaleMax) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <Panel style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionLabel>{t('delegate_tips_header_plain')}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tips.map((tip) => (
              <div key={tip.key} className="text-start" style={{ display: 'flex', gap: 8, fontFamily: OUTFIT, fontSize: 13, color: DG.body, lineHeight: 1.4 }}>
                <span style={{ flexShrink: 0, color: DG.deepGold }}>&rarr;</span>
                <span>{tip.text}</span>
              </div>
            ))}
          </div>
        </Panel>
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
  /* Latest committee, for callbacks that fire on a delay. The delayed denial
     check must re-read CURRENT state, never the closure it was armed in. */
  const committeeRef = useRef<Committee | null>(null);
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
  // Serialises concurrent refetches fired from the realtime subscription. Two rapid events
  // produce two in-flight fetches; without a ticket an OLDER snapshot resolving last would
  // overwrite the newer one with stale rows. Each fetch takes a ticket and only applies if
  // it is still the newest. Mirrors the chair page.
  const fetchSeq = useRef(0);
  // Statuses this delegate has written but not yet seen confirmed by a refetch. Without the
  // pin, ANY snapshot that predates the write — including one triggered by a completely
  // unrelated event (the chair pressing All Present, a phase change) — repaints the
  // roll-call switch with the pre-click status.
  const pendingStatusWrites = useRef<Record<string, { value: DelegateStatus; at: number }>>({});
  // Surfaced beneath the roll-call control when the delegate's own status write is rejected.
  const [statusError, setStatusError] = useState(false);

  // Merge a freshly fetched delegates array over this device's still-unconfirmed status
  // writes. Only rows written here are pinned; every other row is taken from the DB, so a
  // chair's roll call still lands. Each pin releases the moment DB truth agrees with it —
  // or after the TTL, if the write never landed at all.
  const applyPinnedStatuses = (fresh: Delegate[]): Delegate[] => {
    const pins = pendingStatusWrites.current;
    if (Object.keys(pins).length === 0) return fresh;
    const now = Date.now();
    return fresh.map((d) => {
      const pin = pins[d.id];
      if (!pin) return d;
      if (d.status === pin.value || now - pin.at >= STATUS_PIN_TTL_MS) {
        delete pins[d.id];
        return d;
      }
      return { ...d, status: pin.value };
    });
  };

  // Join request state
  const [joinRequesting, setJoinRequesting] = useState(false);
  const [joinStatus, setJoinStatus] = useState<DelegateStatus | null>(null);
  const [joinDenied, setJoinDenied] = useState(false);

  // GSL denial state
  const [gslDenied, setGslDenied] = useState(false);
  const prevPendingRef = useRef<Committee['pendingMotions']>([]);
  // Persisted request/denial clocks (see GSL_RETRY_MS / GSL_DENIED_MS above) plus
  // the coarse clock that drives the countdown on the button. The clock only runs
  // while one of the two windows is open, so this is never a permanent 1s
  // re-render of the whole board.
  const [gslCooldown, setGslCooldown] = useState<GslCooldown>({});
  /* Armed when a request vanishes, cancelled if the delegate turns up on the
     list before it fires — see the denial-detection effect. */
  const pendingDenialTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gslNow, setGslNow] = useState<number>(() => Date.now());

  // Live seconds on the TOTAL caucus clock. The committee row only ever carries
  // the value AT the anchor instant, so rendering it raw freezes the countdown
  // between chair writes. Recomputed from the anchor on every tick rather than
  // decremented, so a phone that was asleep wakes up on the right number.
  const [caucusSeconds, setCaucusSeconds] = useState(0);

  // Transient "N status changes remaining" reminder — shown when the delegate
  // actually moves the switch, then faded out. See the footnote block below.
  const [statusFlash, setStatusFlash] = useState(false);
  const statusFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (statusFlashTimer.current) clearTimeout(statusFlashTimer.current); }, []);

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
            // Every awaited fetch below takes a ticket off the same counter: whichever fetch
            // is newest wins, so an older snapshot can never resolve last and land.
            const seq = ++fetchSeq.current;
            const cs = await getCurrentSpeakerRow(cid);
            if (seq !== fetchSeq.current) return;
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
            const seq = ++fetchSeq.current;
            const { speakersList, caucusQueue } = await getSpeakersLists(cid);
            if (seq !== fetchSeq.current) return;
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
            const seq = ++fetchSeq.current;
            const delegates = await getDelegatesList(cid);
            if (seq !== fetchSeq.current) return;
            // Keep this delegation's own just-written status until the DB confirms it.
            setCommittee((prev) => prev ? { ...prev, delegates: applyPinnedStatuses(delegates) } : prev);
            return;
          }
          if (table === 'messages') {
            await catchUpMessages(cid, setCommittee);
            return;
          }
          if (table === 'documents') {
            const seq = ++fetchSeq.current;
            const documents = await getDocumentsList(cid);
            if (seq !== fetchSeq.current) return;
            setCommittee((prev) => prev ? { ...prev, documents } : prev);
            return;
          }
          if (table === 'motions') {
            const seq = ++fetchSeq.current;
            const pendingMotions = await getPendingMotionsList(cid);
            if (seq !== fetchSeq.current) return;
            setCommittee((prev) => prev ? { ...prev, pendingMotions } : prev);
            return;
          }

          // table === 'committees' (and any fallback): session state may have changed.
          const seq = ++fetchSeq.current;
          const updated = await getCommitteeByCode(code.toUpperCase());
          if (seq !== fetchSeq.current) return;   // a newer refetch already applied
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
            // Delegates go through the same pin as the scoped branch above — this fallback
            // fires on every phase change, so without it any unrelated `committees` event
            // would repaint this delegation's just-written status from a stale snapshot.
            setCommittee((prev) => prev
              ? { ...updated, messages: mergeMessagesById(prev.messages, updated.messages), delegates: applyPinnedStatuses(updated.delegates) }
              : { ...updated, delegates: applyPinnedStatuses(updated.delegates) });
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

  useEffect(() => { committeeRef.current = committee; }, [committee]);

  /* A pending denial must not fire after this page is gone. */
  useEffect(() => () => {
    if (pendingDenialTimer.current !== null) clearTimeout(pendingDenialTimer.current);
  }, []);

  // Detect GSL request denial — and waiting-room (join-request) denial
  useEffect(() => {
    if (!committee) return;
    const isOnSpeakersListNow = committee.speakersList.some((s) => s.country === country);
    const isCurrentSpeakerNow = committee.currentSpeaker?.country === country;
    const prev = prevPendingRef.current;
    const hadRequest = (prev ?? []).some((m) => (m.type as string) === 'gsl-request' && m.proposedBy === country);
    const hasRequest = (committee.pendingMotions ?? []).some((m) => (m.type as string) === 'gsl-request' && m.proposedBy === country);
    if (hadRequest && !hasRequest && !isOnSpeakersListNow && !isCurrentSpeakerNow) {
      /* DO NOT conclude denial here. "Motion gone and not on the list" is also
         what an APPROVAL looks like for a moment: approveGslRequest performs two
         separate writes — the speakers_list insert and the motion delete — which
         arrive as two independent realtime events in arbitrary order. When the
         delete wins the race the delegate is transiently in exactly this state,
         and stamping now told an accepted delegate they had been rejected and
         locked them out for 15 minutes.
         (This became reachable when motions got REPLICA IDENTITY FULL. Before
         that, motion DELETE events were filtered out server-side and never
         arrived, so this branch almost never fired.)
         So: wait for the other event. Only the absence of an insert AFTER the
         grace window is real evidence of a no. */
      if (pendingDenialTimer.current === null) {
        pendingDenialTimer.current = setTimeout(() => {
          pendingDenialTimer.current = null;
          const c = committeeRef.current;
          if (!c) return;
          const onList = c.speakersList.some((s) => s.country === country)
            || c.currentSpeaker?.country === country;
          const nowPending = (c.pendingMotions ?? [])
            .some((m) => (m.type as string) === 'gsl-request' && m.proposedBy === country);
          /* Landed on the list, or re-requested in the meantime → not a denial. */
          if (onList || nowPending) return;
          setGslDenied(true);
          const next: GslCooldown = { deniedAt: Date.now() };
          setGslCooldown(next);
          writeGslCooldown(c.id, country, next);
        }, GSL_DENIAL_GRACE_MS);
      }
    }
    if (isOnSpeakersListNow || isCurrentSpeakerNow) {
      /* The approval won the race after all — cancel any denial still waiting
         out its grace window, so it can never fire against a queued delegate. */
      if (pendingDenialTimer.current !== null) {
        clearTimeout(pendingDenialTimer.current);
        pendingDenialTimer.current = null;
      }
      setGslDenied(false);
      // On the list: both clocks are moot. Guarded so this does not hand back a
      // fresh object (and a fresh render) on every unrelated committee event.
      setGslCooldown((prev) => {
        if (!prev.requestedAt && !prev.deniedAt) return prev;
        writeGslCooldown(committee.id, country, {});
        return {};
      });
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

  // Rehydrate the GSL clocks from localStorage. A reload must not clear a lockout,
  // so the stored timestamps — not component state — are the source of truth.
  useEffect(() => {
    if (!committee?.id || !country) return;
    setGslCooldown(readGslCooldown(committee.id, country));
  }, [committee?.id, country]);

  // Countdown clock for the button label. Runs ONLY while a window is open and
  // stops itself the moment both have elapsed — at most 15 minutes of ticking,
  // and only after a delegate has actually been denied.
  useEffect(() => {
    const open = () => {
      const now = Date.now();
      return gslDeniedRemaining(gslCooldown, now) > 0 || gslRetryRemaining(gslCooldown, now) > 0;
    };
    if (!open()) return;
    setGslNow(Date.now());
    const id = setInterval(() => {
      setGslNow(Date.now());
      if (!open()) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [gslCooldown]);

  // ── Live caucus clock ─────────────────────────────────────────────────────
  // Re-seed whenever the anchor OR the anchored value changes (start, pause,
  // extend, speaker advance), and tick only while the anchor is set — null
  // `totalStartedAt` IS the paused signal, so no schema or type change is
  // needed. Recomputes from caucusRemainingNow each second instead of
  // decrementing, so a backgrounded phone catches up on wake rather than
  // drifting behind by however long it was asleep. Reader only: this tick NEVER
  // writes to the DB (MUST NEVER HAPPEN #4 — a per-second write would re-arm the
  // realtime debounce for every device in the committee).
  const caucusAnchor = committee?.caucus?.totalStartedAt ?? null;
  const caucusAnchoredRemaining = committee?.caucus?.remainingTime ?? null;
  useEffect(() => {
    const read = () => caucusRemainingNow(
      caucusAnchoredRemaining === null
        ? null
        : ({ remainingTime: caucusAnchoredRemaining, totalStartedAt: caucusAnchor } as CaucusState),
    );
    setCaucusSeconds(read());
    if (!caucusAnchor) return;
    const id = setInterval(() => setCaucusSeconds(read()), 1000);
    return () => clearInterval(id);
  }, [caucusAnchor, caucusAnchoredRemaining]);

  /* ── Board sizing ───────────────────────────────────────────────────────
     Declared above the early returns: hooks must run in the same order on
     every render, and everything below this point can bail out. `discBox`
     measures the hero's centre column; the queue measures its own slot and
     renders only the rows that genuinely fit, because the page never scrolls. */
  /* The 176 ceiling used to bind on every screen wider than a phone: the disc
     stopped growing while the middle grid track kept expanding, so the rails
     drifted out of the disc's orbit and the arc flattened into a straight
     column. The real ceiling now lives in CSS on `.dgv-hero-mid`
     (min(300px, 34vh)), which is height-aware; this number just has to stay
     above it so it is never the binding constraint. */
  const { ref: discBox, size: discSize } = useMeasuredSize(84, 320);
  /* Reserve only what the "view all" link actually occupies (~12px), not 30.
     The old figure was a guess and it cost most of a row: at typical phone
     heights it rounded the capacity down by one, leaving visible empty space
     under the last speaker. The speaking row is 12px taller than a normal one
     and that surplus is absorbed by the same reserve. */
  const { ref: queueBox, count: queueFit } = useFitCount(44, 12);

  /* Capped at 26, NOT scaled freely off the disc. The rails are width-capped so
     the crest can lead, and an icon that grows with the disc eats that fixed
     rail from the inside — at 34px it left ~51px for the label and clipped
     "SPEECHES" to "SPEECH". The glyph is an accent here; the number and its
     label are the content. */
  /* Bigger relative to the crest than before: at 0.12 the glyphs read as
     afterthoughts beside a 2.3x disc. The rail is fixed-width, so this is
     bounded by what still leaves room for the longest label beside it. */
  const statIcon = Math.round(Math.max(22, Math.min(30, discSize * 0.17)));
  const actionIcon = Math.round(Math.max(20, Math.min(30, discSize * 0.18)));
  /* The documents tile carries its own clamp rather than riding discSize
     unbounded — at a 300px disc a raw 0.46 multiplier would put a 138px folder
     in a rail that is ~94px wide. */
  /* Capped to the fixed left rail (76px on phone) minus a little breathing
     room. It still reads far larger than the ~29px it was, but it can no longer
     widen the rail — which would come straight out of the crest beside it. */
  const docIcon = Math.round(Math.max(52, Math.min(74, discSize * 0.40)));
  /* How far the outermost satellite tucks toward the disc. Scaled off the disc
     so the curve stays proportional from phone to laptop — the ceiling is 44,
     not 26, because a 300px disc needs ~42px of tuck to read the same as ~20px
     does against a 145px one. */
  /* How far the outer satellites tuck toward the crest. Bounded by geometry,
     not taste: a rail sits just past the disc's widest point, so an item at
     vertical offset h can only move inward by R − sqrt(R² − h²) before it slides
     under the circle. At R≈97 and h≈55 that is ~17px; 0.14×disc gave 27 and
     buried "ROLL CALL" and the stat glyphs behind the flag. */
  /* Scales DOWN with the crest, not up. The safe inward tuck for a satellite at
     vertical offset h is R - sqrt(R^2 - h^2), which SHRINKS as R grows — so a
     depth proportional to the disc had it backwards and drove the top stat 24px
     into the flag. Small and constant-ish is the honest bound here. */
  const arcDepth = Math.round(Math.max(4, Math.min(9, 640 / Math.max(discSize, 1))));

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
    const delegateId = myDelegate.id;
    // Tapping the status you ALREADY hold is a no-op, and a no-op must cost
    // nothing: no rate-limit slot, no DB write, no pin. The pin is consulted as
    // well as the row because a write from a second ago may not be confirmed
    // yet — without it, the second tap of a double-tap reads the pre-click row
    // and burns the delegate's next slot on a change that is already in flight.
    const pin = pendingStatusWrites.current[delegateId];
    const heldStatus = pin && Date.now() - pin.at < STATUS_PIN_TTL_MS ? pin.value : myDelegate.status;
    if (heldStatus === newStatus) return;
    if (changesLeft <= 0) return;
    const previousStatus = myDelegate.status;
    setStatusError(false);
    // Real change → surface the remaining-changes reminder, briefly. The line is
    // keyed on the remaining count, so a second change remounts it and the fade
    // animation restarts from the top instead of resuming mid-fade.
    if (statusFlashTimer.current) clearTimeout(statusFlashTimer.current);
    setStatusFlash(true);
    statusFlashTimer.current = setTimeout(() => setStatusFlash(false), 4300);
    // Pin this row against any refetch whose snapshot predates the write below — including
    // refetches fired by events this delegation had nothing to do with.
    pendingStatusWrites.current[delegateId] = { value: newStatus, at: Date.now() };
    setCommittee((prev) => prev ? {
      ...prev,
      delegates: prev.delegates.map((d) => d.id === delegateId ? { ...d, status: newStatus } : d),
    } : prev);
    // Recorded up front, NOT after the await: a delegate double-tapping the switch would
    // otherwise spend two writes against one slot. A write that fails refunds it below.
    recordStatusChange(committee.id, country);
    setDelegateStatusInDB(delegateId, newStatus, committee.code).then((ok) => {
      if (ok) return;
      // The write never landed: give the slot back, drop the pin, and put the switch back
      // where it was so the delegate is not looking at a status the committee never saw.
      refundStatusChange(committee.id, country);
      delete pendingStatusWrites.current[delegateId];
      setCommittee((prev) => prev ? {
        ...prev,
        delegates: prev.delegates.map((d) => d.id === delegateId ? { ...d, status: previousStatus } : d),
      } : prev);
      setStatusError(true);
    });
  };

  // ── Join request handler (absent → P or PV)
  const handleRequestJoin = async (desiredStatus: 'present' | 'present-voting') => {
    if (!myDelegate) return;
    setJoinDenied(false);
    // Chair approval OFF → delegates self-admit instantly (no waiting room).
    if (!requireChairApproval) {
      // Same pin as handleStatusChange — self-admitting is a status write like any other,
      // and an in-flight refetch would otherwise drop the delegate straight back to absent.
      pendingStatusWrites.current[myDelegate.id] = { value: desiredStatus, at: Date.now() };
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
    /* Belt and braces with the disabled CTA: a stale render, a queued tap or a
       phase that changed between paint and press must not slip a request
       through while a caucus or vote owns the floor. */
    if (committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus' || committee.phase === 'voting') return;
    /* Already seated — nothing to request. Guards the double-tap that produced
       a second queue entry. */
    if (isOnSpeakersList || isCurrentSpeaker) return;
    // No duplicate motion is possible: requestGslSpot already short-circuits when
    // this delegation has a pending gsl-request (committeeService.ts:844), so a
    // re-request after the no-response window REUSES the motion the chair is
    // already looking at. Remove-then-recreate was the alternative and it is
    // strictly worse here — deleting a motion row needs the chair suffix under
    // RLS, and it would yank the request out of the chair's queue and re-add it
    // at the bottom, punishing the delegate for the chair's silence.
    const next: GslCooldown = { requestedAt: Date.now() };
    setGslCooldown(next);
    writeGslCooldown(committee.id, country, next);
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

  // Request-to-speak reflects the existing GSL states plus the two cooldowns; the
  // underlying action is unchanged. Order matters: what the committee can see
  // (on the floor, in the queue) always outranks anything this device remembers.
  const deniedLeft = gslDeniedRemaining(gslCooldown, gslNow);
  const retryLeft = gslRetryRemaining(gslCooldown, gslNow);
  /* The GSL is not the live floor during a caucus or a vote, so a request to
     join it cannot be actioned then — the chair is running a different queue
     entirely (RULE 1: the caucus queue and the GSL are strictly separate). The
     button stayed live through both, which is how the same delegation ended up
     queued more than once: request during a caucus, chair approves it later
     without noticing they are already seated. Blocked at the source here, and
     independently guarded at the chair's approve. */
  const gslRequestsClosed = committee.phase === 'moderated-caucus'
    || committee.phase === 'unmoderated-caucus'
    || committee.phase === 'voting';

  const speakCta = (() => {
    if (isCurrentSpeaker) return { label: t('delegate_floor_now'), disabled: true, onClick: undefined as (() => void) | undefined };
    if (isOnSpeakersList) return { label: myQueueIndex === 0 ? t('delegate_up_next_queue') : t('delegate_in_queue'), disabled: true, onClick: undefined as (() => void) | undefined };
    if (gslRequestsClosed) {
      return { label: t('delegate_request_closed_motion'), disabled: true, onClick: undefined as (() => void) | undefined };
    }
    // Denied: locked out for 15 minutes, with the wait stated on the button so
    // it reads as a rule rather than a broken control.
    if (deniedLeft > 0) {
      return { label: t('delegate_request_retry_in', { t: formatCooldown(deniedLeft) }), disabled: true, onClick: undefined as (() => void) | undefined };
    }
    if (isGslRequestPending) {
      // Still pending and inside the no-response window → wait. Past it, the
      // chair has not acted, so the delegate may nudge again (same motion).
      if (retryLeft > 0) return { label: t('delegate_awaiting_approval'), disabled: true, onClick: undefined as (() => void) | undefined };
      return { label: t('delegate_request_again'), disabled: sessionEnded || isAbsent, onClick: handleAddMeToSpeakers };
    }
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

  /* `caucusSeconds`, not `caucus.remainingTime` — the row only holds the value at
     the anchor instant, so the raw field is a clock that moves once per chair
     write. Both the numerals and the bar read the live value so they can never
     disagree. */
  const caucusClock = committee.caucus && (
    <>
      <div style={{ fontFamily: OUTFIT, fontSize: 'clamp(26px, 8vw, 44px)', fontWeight: 900, color: DG.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {formatTime(caucusSeconds)}
      </div>
      <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: DG.ivory, boxShadow: LIFT.inSm, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: DG.forest, width: `${committee.caucus.totalTime > 0 ? Math.max(0, Math.min(100, (caucusSeconds / committee.caucus.totalTime) * 100)) : 0}%` }} />
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
      /* The motion's topic is NOT repeated here — it is the secondary line under
         the band label above, where it sits directly beneath the mode it belongs
         to. Printing it twice on one screen made the panel look like it was
         describing something else. */
      return (
        <Panel className="dgv-queue dgv-rise" style={{ padding: 14 }}>
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
              {/* LEFT — documents tile above the roll-call control, both
                  tucked toward the disc so the pair follows its curve.
                  Same convention as the stat rail: `arcDepth − arcInset`, i.e.
                  the gap to the disc SHRINKS the further an item sits from the
                  disc's widest point (its centre line). The rail previously used
                  the raw inset, which is that relationship inverted — it pushed
                  both controls a full arcDepth AWAY from the disc, which is why
                  the left side never read as wrapping. The documents tile sits
                  nearer the centre line than the switch (it is the taller of the
                  two blocks in a vertically-centred stack), so it takes the
                  middle slot of a three-point arc and the switch the outer one. */}
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
                  <Emoji3D name="File folder" size={docIcon} fallback={FolderOpen} fallbackColor={DG.forest} />
                  <span
                    style={{
                      fontFamily: OUTFIT, fontWeight: 800, color: DG.body, textAlign: 'center',
                      fontSize: 'clamp(7.5px, 2.3vw, 10.5px)', letterSpacing: '0.04em',
                      textTransform: 'uppercase', lineHeight: 1.15,
                    }}
                  >
                    {t('delegate_view_documents')}
                  </span>
                </button>

                {!isAbsent && !sessionEnded && !lockRollCall && (
                  /* Outer point of the left arc: tucks toward the crest, i.e.
                     positive on this side. Transform, not margin — see .dgv-arc. */
                  <div
                    className="dgv-arc"
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      ['--dgv-arc' as string]: `${arcInset(2, 3, arcDepth)}px`,
                    }}
                  >
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

              {/* RIGHT — the three live stats, curved around the disc */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 1.6vw, 12px)', minWidth: 0 }}>
                {[
                  { emoji: 'Alarm clock' as const, fb: Clock, value: formatTime(mySpokenSeconds), label: t('delegate_stat_time_spoken') },
                  { emoji: 'Megaphone' as const, fb: Mic2, value: String(myLogs.length), label: t('delegate_stat_speeches_given') },
                  { emoji: 'Speech balloon' as const, fb: MessageSquare, value: String(myMessagesSent), label: t('delegate_stat_messages_sent') },
                ].map((s, i, arr) => (
                  /* Pushed OUT at the middle, tucked in at top and bottom —
                     the disc's widest point is on the centre line, so that is
                     the item that sits furthest from it. */
                  /* Negative: ends tuck TOWARD the crest, middle stays put. A
                     positive push would shove the middle row outward into the
                     screen edge, and as a margin it also stole the width the
                     label needed. */
                  <div
                    key={s.label}
                    className="dgv-arc"
                    style={{ ['--dgv-arc' as string]: `-${arcInset(i, arr.length, arcDepth)}px` }}
                  >
                    <StatRow
                      emoji={<Emoji3D name={s.emoji} size={statIcon} fallback={s.fb} fallbackColor={DG.forest} />}
                      iconSize={statIcon}
                      value={s.value}
                      label={s.label}
                      onClick={() => setSheet('stats')}
                    />
                  </div>
                ))}
              </div>

            {/* ── ROLL-CALL FOOTNOTE ─────────────────────────────────────
                The lock explanation is permanent — it is the reason a missing
                control is missing, and that reason does not expire.
                The remaining-changes counter is NOT. A quota a delegate is not
                spending is noise, and a number parked on screen all session
                reads as a warning about nothing; it lands when it is actually
                news. So it appears for ~4s each time the delegate moves the
                switch, then fades itself out — EXCEPT at zero, where it stays
                up, because that is the moment it stops being a reminder and
                becomes the explanation for a dead control.
                It must not shove the bands below it either — this board does not
                scroll. It used to buy that with a permanently reserved 15px row,
                which also bought two 16px board gaps: 47px of dead space sitting
                under the crest whenever there was nothing to say, which was most
                of the time. Now it is an ABSOLUTE overlay hanging off the hero,
                so it costs the layout nothing when idle and still cannot reflow
                anything when it appears. */}
            {!isAbsent && !sessionEnded && (statusError || lockRollCall || changesLeft <= 0 || statusFlash) && (
              <div
                className="text-center"
                style={{
                  position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0,
                  top: '100%', marginTop: 2, pointerEvents: 'none',
                }}
              >
                {statusError && !lockRollCall && (
                  <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 'clamp(9px, 2.6vw, 11px)', fontWeight: 800, lineHeight: 1.25, color: DG.danger }}>
                    {t('delegate_status_change_failed')}
                  </p>
                )}
                {lockRollCall ? (
                  <p
                    style={{
                      margin: 0, fontFamily: OUTFIT, fontSize: 'clamp(9px, 2.6vw, 11px)',
                      fontWeight: 700, lineHeight: 1.25, color: DG.faint,
                    }}
                  >
                    {t('delegate_roll_call_locked')}
                  </p>
                ) : (changesLeft <= 0 || statusFlash) && (
                  <p
                    key={changesLeft}
                    className={changesLeft <= 0 ? undefined : 'dgv-hint'}
                    aria-live="polite"
                    style={{
                      margin: 0, fontFamily: OUTFIT, fontSize: 'clamp(9px, 2.6vw, 11px)',
                      fontWeight: 700, lineHeight: 1.25,
                      color: changesLeft <= 0 ? DG.danger : DG.faint,
                    }}
                  >
                    {t('delegate_status_changes_left', { n: changesLeft, s: changesLeft === 1 ? '' : 's' })}
                  </p>
                )}
              </div>
            )}
            </section>

            {/* ── BAND LABEL ──────────────────────────────────────────────
                Mode on top, the motion's own topic as a smaller line directly
                beneath it — a delegate needs "Moderated Caucus" AND "on the
                Sahel security corridor" together to know what to prepare. */}
            <div style={{ flexShrink: 0, minWidth: 0 }}>
              <h2
                style={{
                  margin: 0, fontFamily: OUTFIT, fontWeight: 900, color: DG.ink,
                  fontSize: 'clamp(15px, 4.6vw, 22px)', letterSpacing: '-0.02em',
                }}
              >
                {bandLabel}
              </h2>
              {caucusLive && committee.caucus?.purpose && (
                <p
                  className="text-start"
                  style={{
                    margin: '1px 0 0', fontFamily: OUTFIT, fontWeight: 700,
                    fontSize: 'clamp(11px, 3.2vw, 14px)', lineHeight: 1.2,
                    color: DG.forest, overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}
                >
                  {committee.caucus.purpose}
                </p>
              )}
            </div>

            {/* ── BOTTOM BAND: list | square actions ────────────────────── */}
            <section className="dgv-bottom">
              {bottomLeft}

              <div className="dgv-actions">
                {/* Flat monochrome glyphs, and the three silhouettes are
                    deliberately distinct at a squint — tall/pointed, blocky,
                    round — so a delegate watching the speakers list can hit
                    the right key in peripheral vision. */}
                <SquareButton
                  skin="green"
                  disabled={speakCta.disabled}
                  onClick={speakCta.onClick}
                  icon={<Hand size={actionIcon} strokeWidth={2.25} />}
                >
                  {speakCta.label}
                </SquareButton>
                <SquareButton
                  skin="blue"
                  onClick={() => openSheet('documents', 'submit')}
                  icon={<FileText size={actionIcon} strokeWidth={2.25} />}
                >
                  {t('delegate_submit_document')}
                </SquareButton>
                <SquareButton
                  skin="gold"
                  onClick={() => setSheet('chat')}
                  badge={chatDisabled ? undefined : unreadTotal}
                  icon={<MessageCircle size={actionIcon} strokeWidth={2.25} />}
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
