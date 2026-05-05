'use client';

import { use, useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Committee, CommitteeDocument, DocumentType, PendingMotionType, SpeakingLogEntry, DelegateStatus } from '@/lib/types';
import ChatPanel from '@/components/ChatPanel';
import { useSettingsStore } from '@/lib/settingsStore';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';
import { FlagImg } from '@/components/FlagImg';
import {
  getCommitteeByCode,
  subscribeToCommittee,
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
    <div className="min-h-screen bg-[#F6F1E9] flex flex-col items-center justify-center gap-4">
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

// Speaking log parsing
function parseSpeakingLogs(committee: Committee): SpeakingLogEntry[] {
  return committee.messages
    .filter((m) => m.sender === '__system__' && m.recipient === '__log__' && m.content.startsWith('__log__:'))
    .map((m) => {
      try { return JSON.parse(m.content.slice('__log__:'.length)) as SpeakingLogEntry; }
      catch { return null; }
    })
    .filter(Boolean) as SpeakingLogEntry[];
}

// Point calculation
function calcPoints(logs: SpeakingLogEntry[], committee: Committee, country: string): {
  total: number;
  breakdown: { label: string; pts: number }[];
  tier: string;
  tips: string[];
} {
  const myLogs = logs.filter((l) => l.country === country);
  const breakdown: { label: string; pts: number }[] = [];
  let total = 0;

  // Attendance (present/PV)
  const delegate = committee.delegates.find((d) => d.country === country);
  if (delegate && delegate.status !== 'absent') {
    breakdown.push({ label: 'Attendance', pts: 5 });
    total += 5;
  }

  // GSL speeches
  const gslSpeeches = myLogs.filter((l) => l.context === 'speakers-list');
  if (gslSpeeches.length > 0) {
    const pts = gslSpeeches.length * 10;
    breakdown.push({ label: `GSL speeches (×${gslSpeeches.length})`, pts });
    total += pts;
  }

  // Caucus speeches
  const caucusSpeeches = myLogs.filter((l) => l.context === 'moderated-caucus' || l.context === 'unmoderated-caucus');
  if (caucusSpeeches.length > 0) {
    const pts = caucusSpeeches.length * 8;
    breakdown.push({ label: `Caucus speeches (×${caucusSpeeches.length})`, pts });
    total += pts;
  }

  // Speaking time bonus (1pt per 10 seconds)
  const totalSeconds = myLogs.reduce((s, l) => s + l.seconds, 0);
  const timePts = Math.floor(totalSeconds / 10);
  if (timePts > 0) {
    breakdown.push({ label: `Time bonus (${totalSeconds}s spoken)`, pts: timePts });
    total += timePts;
  }

  // Documents — 10pts per WP, 20pts per DR, per sponsor
  const myDocs = (committee.documents ?? []).filter((d) => d.sponsors.includes(country));
  const wps = myDocs.filter((d) => d.type === 'working-paper');
  const drs = myDocs.filter((d) => d.type === 'draft-resolution');
  if (wps.length > 0) {
    const pts = wps.length * 10;
    breakdown.push({ label: `Working papers sponsored (×${wps.length})`, pts });
    total += pts;
  }
  if (drs.length > 0) {
    const pts = drs.length * 20;
    breakdown.push({ label: `Draft resolutions sponsored (×${drs.length})`, pts });
    total += pts;
    const passedDrs = drs.filter((d) => d.status === 'passed').length;
    if (passedDrs > 0) {
      const passPts = passedDrs * 10;
      breakdown.push({ label: `DR passed (×${passedDrs})`, pts: passPts });
      total += passPts;
    }
  }

  // Motions raised (from system log)
  const motionsRaised = logs.filter((l) => (l as unknown as Record<string,unknown>).type === 'motion-raised' && l.country === country).length;
  if (motionsRaised > 0) {
    const pts = motionsRaised * 5;
    breakdown.push({ label: `Motions raised (×${motionsRaised})`, pts });
    total += pts;
  }

  // Right of reply (from system log)
  const rtrCount = logs.filter((l) => (l as unknown as Record<string,unknown>).type === 'right-of-reply' && l.country === country).length;
  if (rtrCount > 0) {
    const pts = rtrCount * 5;
    breakdown.push({ label: `Right of reply (×${rtrCount})`, pts });
    total += pts;
  }

  // Tier
  let tier = 'Observer';
  if (total >= 300) tier = 'Distinguished Delegate ⭐';
  else if (total >= 200) tier = 'Delegate 🏅';
  else if (total >= 120) tier = 'Active Speaker 🎙️';
  else if (total >= 70) tier = 'Debater 💬';
  else if (total >= 30) tier = 'Participant';

  // Tips — no point amounts mentioned
  const tips: string[] = [];
  if (gslSpeeches.length === 0) tips.push('📢 Get on the General Speakers\' List — each GSL speech boosts your score.');
  if (caucusSpeeches.length === 0) tips.push('💬 Speak during a moderated caucus to show engagement on specific topics.');
  if (wps.length === 0 && drs.length === 0) tips.push('📄 Submit or co-sponsor a working paper or draft resolution.');
  if (totalSeconds > 0 && totalSeconds < 60) tips.push('⏱ Use your full speaking time — longer speeches earn more time bonus points.');
  if (drs.length === 0 && wps.length > 0) tips.push('📜 Escalate your working paper into a draft resolution for bigger points.');
  if (myDocs.length === 0) tips.push('🤝 Co-sponsor a document to boost your score and signal cooperation.');

  return { total, breakdown, tier, tips };
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
  const [query, setQuery] = useState('');
  const allCountries = committee.delegates.map((d) => d.country).filter((c) => c !== myCountry);
  const matches = query.trim()
    ? allCountries.filter((c) => c.toLowerCase().includes(query.toLowerCase()) && !value.includes(c))
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
          {flagFor(myCountry)} {myCountry} <span className="text-[#9A8A78] ml-0.5">(you)</span>
        </span>
        {value.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 text-xs bg-[#FAF8F3] border border-[#DDD4C0] text-[#6A5A4A] rounded-full px-2.5 py-0.5">
            {flagFor(c)} {c}
            <button onClick={() => onChange(value.filter((x) => x !== c))} className="ml-1 text-[#9A8A78] hover:text-red-400 font-bold leading-none">×</button>
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
          placeholder="Search co-sponsors, press Enter to add…"
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 text-[#1C1410] text-sm focus:outline-none focus:border-[#1B3828] placeholder-[#9A8A78]"
        />
        {matches.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-20 shadow-xl max-h-40 overflow-y-auto">
            {matches.slice(0, 8).map((c, i) => (
              <button
                key={c}
                onMouseDown={(e) => { e.preventDefault(); add(c); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${i === 0 ? 'bg-[#DDD4C0] text-[#1C1410]' : 'text-[#6A5A4A] hover:bg-[#DDD4C0]'}`}
              >
                {flagFor(c)} {c}
                {i === 0 && <span className="ml-auto text-xs text-[#9A8A78]">↵ Enter</span>}
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
      <button onClick={() => setShow((v) => !v)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
        <Emoji size="1em">📎</Emoji> {fileName} {show ? '▲' : '▼'}
      </button>
      {show && (
        <iframe src={fileUrl} title={fileName} className="w-full rounded-lg border border-[#DDD4C0]" style={{ height: '400px' }} />
      )}
    </div>
  );
}

// ── Delegate Doc Card (with inline PDF viewer) ────────────────────────────────
function DelegateDocCard({ doc }: { doc: CommitteeDocument }) {
  const statusColor = doc.status === 'passed' ? 'text-emerald-400' : doc.status === 'failed' ? 'text-red-400' : doc.status === 'introduced' ? 'text-purple-400' : doc.status === 'on-floor' ? 'text-[#B6871F]' : 'text-[#9A8A78]';
  const statusLabel = doc.status === 'introduced' ? 'Being Presented' : doc.status === 'on-floor' ? 'On Floor' : doc.status === 'passed' ? 'Passed' : doc.status === 'failed' ? 'Failed' : 'Submitted';
  return (
    <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-[#1C1410] text-sm">{doc.docCode} — {doc.title}</div>
        <span className={`text-xs font-bold ml-2 shrink-0 ${statusColor}`}>{statusLabel}</span>
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
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocumentType>('working-paper');
  const [coSponsors, setCoSponsors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!title.trim() || sending) return;
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
      <h2 className="text-lg font-bold text-[#1C1410]">Submit Document</h2>
      {submitted && (
        <div className="bg-green-900/30 border border-green-700/30 rounded-xl p-3 text-green-300 text-sm">
          ✓ Document submitted to chair for review
        </div>
      )}
      <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4 space-y-4">
        {/* Type selector */}
        <div>
          <label className="text-xs text-[#6A5A4A] mb-1.5 block">Document type</label>
          <div className="flex gap-2">
            {(['working-paper', 'draft-resolution'] as DocumentType[]).map((dt) => (
              <button key={dt} onClick={() => setDocType(dt)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${docType === dt ? 'bg-[#DDD4C0] border-[#1B3828] text-[#1C1410]' : 'bg-[#FAF8F3] border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'}`}>
                {dt === 'working-paper' ? 'Working Paper' : 'Draft Resolution'}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-[#6A5A4A] mb-1.5 block">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Strengthening climate adaptation frameworks"
            className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 text-[#1C1410] text-sm focus:outline-none focus:border-[#1B3828]" />
        </div>

        {/* Co-sponsors */}
        <div>
          <label className="text-xs text-[#6A5A4A] mb-1.5 block">
            Sponsors <span className="text-[#9A8A78]">— you are automatically listed first</span>
          </label>
          <SponsorsInput committee={committee} myCountry={country} value={coSponsors} onChange={setCoSponsors} />
        </div>

        {/* File */}
        <div>
          <label className="text-xs text-[#6A5A4A] mb-1.5 block">Attach file <span className="text-[#9A8A78]">(optional)</span></label>
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()}
              className="text-xs bg-[#FAF8F3] border border-[#DDD4C0] hover:border-[#1B3828] text-[#6A5A4A] px-3 py-2 rounded-lg transition-colors">
              {fileName ? <><Emoji size="1em">📎</Emoji>{` ${fileName}`}</> : '+ Attach file'}
            </button>
            {fileName && <button onClick={() => { setFileName(null); setFileUrl(null); }} className="text-xs text-[#9A8A78] hover:text-red-400">Remove</button>}
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => { setFileUrl(reader.result as string); setFileName(f.name); };
              reader.readAsDataURL(f);
            }} />
        </div>

        <button onClick={handleSubmit} disabled={!title.trim() || sending}
          className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
          {sending ? 'Submitting…' : 'Submit to Chair →'}
        </button>
      </div>

      {/* Existing docs */}
      {(committee.documents ?? []).length > 0 && (
        <div>
          <div className="text-xs font-mono text-[#9A8A78] mb-2">SUBMITTED DOCUMENTS</div>
          <div className="space-y-2">
            {(committee.documents ?? []).map((doc) => (
              <DelegateDocCard key={doc.id} doc={doc} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Statistics Tab ────────────────────────────────────────────────────────────
function StatisticsTab({ committee, country }: { committee: Committee; country: string }) {
  const logs = parseSpeakingLogs(committee);
  const { total, breakdown, tier, tips } = calcPoints(logs, committee, country);
  const myLogs = logs.filter((l) => l.country === country);
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
    pointsByCountry[c] = calcPoints(logs, committee, c).total;
  });

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      {/* Score card */}
      <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-2xl p-5">
        <div className="text-xs font-mono text-[#9A8A78] mb-3">YOUR SCORE</div>
        <div className="flex items-end gap-3 mb-3">
          <span className="text-6xl font-black text-[#1C1410]">{total}</span>
          <span className="text-lg text-[#6A5A4A] font-medium mb-1">pts</span>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-[#7B4A1E]/20 border border-[#7B4A1E]/30 text-[#B8844A] text-sm font-bold px-3 py-1 rounded-full">
          <span>{tier.match(/\p{Emoji}/u)?.[0] ?? ''}</span>
          <span>{tier.replace(/\p{Emoji}/gu, '').trim()}</span>
        </div>

        {/* Score breakdown */}
        {breakdown.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {breakdown.map((b) => (
              <div key={b.label} className="flex justify-between text-xs">
                <span className="text-[#6A5A4A]">{b.label}</span>
                <span className="text-[#1C1410] font-bold">+{b.pts}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Speaking stats */}
      <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-2xl p-5">
        <div className="text-xs font-mono text-[#9A8A78] mb-3">YOUR SPEAKING HISTORY</div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="text-2xl font-black text-[#1C1410]">{myLogs.length}</div>
            <div className="text-xs text-[#9A8A78]">Speeches</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-[#1C1410]">{formatTime(totalSeconds)}</div>
            <div className="text-xs text-[#9A8A78]">Total time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-[#1C1410]">{myRank > 0 ? `#${myRank}` : '—'}</div>
            <div className="text-xs text-[#9A8A78]">Rank by time</div>
          </div>
        </div>
        {myLogs.length > 0 ? (
          <div className="space-y-1.5">
            {myLogs.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-[#FAF8F3] rounded-lg px-3 py-2">
                <span className="text-[#6A5A4A] truncate flex-1">{l.topic || 'General Speakers\' List'}</span>
                <span className="text-[#9A8A78] shrink-0 ml-2 capitalize">{l.context.replace(/-/g, ' ')}</span>
                <span className="text-[#1C1410] font-mono shrink-0 ml-2">{l.seconds}s</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[#9A8A78] text-sm text-center py-2">No speeches recorded yet</p>
        )}
      </div>

      {/* Committee leaderboard */}
      {ranking.length > 0 && (
        <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-2xl p-5">
          <div className="text-xs font-mono text-[#9A8A78] mb-3">COMMITTEE SPEAKING TIME</div>
          {/* Column headers */}
          <div className="flex items-center gap-2 text-[10px] text-[#7A5A38] font-mono mb-1.5 px-2">
            <span className="w-4 shrink-0" />
            <span className="flex-1">Country</span>
            <span className="w-16 text-right">Time</span>
            <span className="w-8 text-right">Pts</span>
          </div>
          <div className="space-y-1.5">
            {ranking.slice(0, 10).map((r, i) => (
              <div key={r.country} className={`flex items-center gap-2 text-sm ${r.country === country ? 'bg-[#1B3828]/10 border border-[#1B3828]/20 rounded-lg px-2 py-1' : 'px-2 py-1'}`}>
                <span className="text-[#9A8A78] text-xs w-4 font-mono shrink-0">{i + 1}</span>
                <FlagImg code={getCountryByName(r.country)?.code ?? ''} size={20} className="shrink-0" />
                <span className={`flex-1 truncate ${r.country === country ? 'text-[#B6871F] font-bold' : 'text-[#6A5A4A]'}`}>{r.country}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-[#DDD4C0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#1B3828] rounded-full" style={{ width: `${(r.seconds / ranking[0].seconds) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono text-[#9A8A78] w-10 text-right">{formatTime(r.seconds)}</span>
                </div>
                <span className="text-xs font-bold text-[#B8844A] w-8 text-right shrink-0">
                  {pointsByCountry[r.country] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-2xl p-5">
          <div className="text-xs font-mono text-[#9A8A78] mb-3">HOW TO IMPROVE YOUR SCORE</div>
          <div className="space-y-2">
            {tips.map((tip) => (
              <div key={tip} className="flex gap-2 text-sm text-[#6A5A4A]">
                <span className="shrink-0">{tip.slice(0, 2)}</span>
                <span>{tip.slice(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Delegate Session ─────────────────────────────────────────────────────
type DelegateTab = 'session' | 'motions' | 'resolutions' | 'documents' | 'stats';

function DelegateSessionInner({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const country = searchParams.get('country') || '';

  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DelegateTab>('session');
  const [sessionSuspended, setSessionSuspended] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endedTab, setEndedTab] = useState<'ended' | 'session'>('ended');
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
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
        unsubscribe = subscribeToCommittee(found.id, async () => {
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
      <div className="min-h-screen bg-[#F6F1E9] flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4"><Emoji size="2.5rem">🔍</Emoji></div>
          <h1 className="text-2xl font-bold text-[#1C1410] mb-2">Session not found</h1>
          <p className="text-[#6A5A4A] mb-6">Code "{code}" is invalid or the session ended.</p>
          <Link href="/join" className="bg-[#1B3828] hover:bg-[#2A5A3C] text-white px-6 py-3 rounded-lg font-semibold transition-colors">Try Again</Link>
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
    const mn = settings.motionNames;
    if (committee.phase === 'moderated-caucus') return mn?.moderated ?? PHASE_LABELS['moderated-caucus'];
    if (committee.phase === 'unmoderated-caucus') return mn?.unmoderated ?? PHASE_LABELS['unmoderated-caucus'];
    return PHASE_LABELS[committee.phase] || committee.phase;
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
  const tabs: { key: DelegateTab; label: string }[] = [
    { key: 'session',     label: 'Session' },
    { key: 'motions',     label: 'Motions' },
    { key: 'resolutions', label: 'DRs' },
    { key: 'documents',   label: 'Docs' },
    { key: 'stats',       label: 'Stats' },
  ];

  // ── Absent banner (blocks active interaction)
  const AbsentBanner = () => (
    <div className="mx-4 mt-4 bg-[#EDE7D8] border border-[#1B3828]/40 rounded-xl p-4">
      <div className="text-sm font-bold text-[#1C1410] mb-1">You are currently absent</div>
      <div className="text-xs text-[#6A5A4A] mb-3">Mark yourself Present or Present & Voting to participate actively.</div>
      {joinStatus && !joinDenied ? (
        <div className="text-xs text-[#1B3828] font-medium flex items-center gap-1.5">
          <div className="w-3 h-3 border border-[#1B3828] border-t-transparent rounded-full animate-spin" />
          Join request sent — waiting for chair approval…
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => handleRequestJoin('present')} disabled={joinRequesting}
            className="flex-1 bg-[#DDD4C0] hover:bg-[#C8BAA8] border border-[#1B3828]/30 text-[#6A5A4A] py-2 rounded-lg text-xs font-semibold transition-colors">
            Mark Present (P)
          </button>
          <button onClick={() => handleRequestJoin('present-voting')} disabled={joinRequesting}
            className="flex-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-2 rounded-lg text-xs font-semibold transition-colors">
            Present &amp; Voting (P&V)
          </button>
        </div>
      )}
      {joinDenied && <p className="text-red-400 text-xs mt-2">Your join request was denied by the chair.</p>}
    </div>
  );

  if (sessionSuspended && (committee.suspendedAt || wasEverSuspended.current)) {
    return (
      <div className="min-h-screen bg-[#F6F1E9] flex flex-col items-center justify-center text-center px-8">
        <div className="text-sm font-mono text-[#9A8A78] mb-2">{committee.name} · {committee.code}</div>
        <div className="text-5xl mb-6">⏸️</div>
        <h1 className="text-3xl font-black text-[#1C1410] mb-4">Session is currently adjourned.</h1>
        <p className="text-lg text-[#6A5A4A]">Please wait until the chair reopens the session.</p>
        <p className="text-xs text-[#9A8A78] mt-8">Press ESC to return to main menu</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F6F1E9] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-[#DDD4C0] bg-[#FAF8F3] px-4 h-14 flex items-center gap-3 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <img src="/GavellingLogo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[#1C1410] text-sm truncate">{committee.name}</div>
          <div className="text-xs text-[#9A8A78] truncate">{committee.topic}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-bold text-[#1C1410] flex items-center gap-1.5 justify-end">
              <span className="text-lg">{flagFor(country)}</span>
              {country}
              <span className="ml-1 text-xs font-mono text-[#1B3828] bg-[#DDD4C0] px-1.5 py-0.5 rounded">{committee.code}</span>
            </div>
            <div className={`text-xs font-medium ${
              isAdjourned ? 'text-red-400' :
              committee.phase === 'voting' ? 'text-[#B6871F]' : 'text-[#9A8A78]'
            }`}>{phaseDisplay}</div>
          </div>
          {!sessionEnded && (
          <button
            onClick={() => {
              const newShow = !showChat;
              setShowChat(newShow);
              if (newShow) {
                setChatReadCounts((prev) => ({
                  ...prev,
                  everyone: committee.messages.filter((m) => !m.content.startsWith('__log__:') && !m.isPrivate && m.sender !== country).length,
                }));
              }
            }}
            className={`relative text-xs px-3 py-1.5 rounded-lg transition-colors font-semibold shrink-0 ${showChat ? 'bg-[#1B3828] text-white' : 'bg-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}
          >
            <Emoji size="1em">💬</Emoji>
            {!showChat && (() => {
              const total = committee.messages.filter((m) => m.sender !== country && !m.content.startsWith('__log__:') && !m.isPrivate).length;
              const unread = total - (chatReadCounts['everyone'] ?? 0);
              return unread > 0 ? (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#B6871F] rounded-full text-[#1C1410] text-[9px] flex items-center justify-center font-bold">
                  {Math.min(unread, 99)}
                </span>
              ) : null;
            })()}
          </button>
          )}
        </div>
      </header>

      {/* Ended tab bar */}
      {sessionEnded && (
        <div className="flex border-b border-[#DDD4C0] bg-[#FAF8F3] shrink-0">
          <button onClick={() => setEndedTab('ended')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors border-b-2 ${endedTab === 'ended' ? 'text-[#1C1410] border-[#1B3828]' : 'text-[#9A8A78] border-transparent hover:text-[#6A5A4A]'}`}>
            🏁 End View
          </button>
          <button onClick={() => setEndedTab('session')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors border-b-2 ${endedTab === 'session' ? 'text-[#1C1410] border-[#1B3828]' : 'text-[#9A8A78] border-transparent hover:text-[#6A5A4A]'}`}>
            👁 Session View
          </button>
        </div>
      )}

      {sessionEnded && endedTab === 'ended' ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="mb-6"><Emoji size="3rem">🏁</Emoji></div>
          <h1 className="text-4xl font-black text-[#1C1410] mb-4">This committee has ended.</h1>
          <p className="text-xl text-[#6A5A4A] mb-2">{committee.name}</p>
          <p className="text-base text-[#9A8A78] mb-8">{committee.topic}</p>
          {hoursRemaining !== null && (
            <p className="text-sm text-[#9A8A78]">{hoursRemaining} hour{hoursRemaining !== 1 ? 's' : ''} until committee is deleted</p>
          )}
          <p className="text-xs text-[#9A8A78] mt-8">Press ESC to return to main menu</p>
        </div>
      ) : (
      <>
      {sessionEnded && endedTab === 'session' && (
        <div className="shrink-0 bg-amber-900/20 border-b border-amber-700/40 px-4 py-2 text-center text-amber-300 text-sm font-semibold">
          Session has ended — view only
        </div>
      )}
      {/* Tab nav — Section 7: shorter labels, text-sm */}
      <div className="flex border-b border-[#DDD4C0] bg-[#FAF8F3] shrink-0">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-bold capitalize transition-colors ${
              tab === t.key ? 'text-[#1C1410] border-b-2 border-[#1B3828]' : 'text-[#9A8A78] hover:text-[#6A5A4A]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
      {showChat && !sessionEnded && (
        <ChatPanel
          committee={committee}
          senderName={country}
          isChair={false}
          onClose={() => setShowChat(false)}
          initialReadCounts={chatReadCounts}
          onReadCountsChange={setChatReadCounts}
          readOnly={sessionEnded}
          speakerCard={null}
        />
      )}
      {!showChat && <div className="flex-1 overflow-y-auto">

        {/* ── Session tab ── */}
        {tab === 'session' && (
          <div>
            {isAbsent && !sessionEnded && <AbsentBanner />}

            {/* Moderated caucus special view */}
            {committee.phase === 'moderated-caucus' && committee.caucus && (
              <div className="p-4 max-w-2xl mx-auto space-y-4">
                {/* Section 1: FlagImg replaces text-8xl emoji */}
                <div className="flex justify-center">
                  <FlagImg code={getCountryByName(country)?.code ?? ''} size={88} className="rounded-full shadow-lg" />
                </div>
                <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-5 text-center">
                  <p className="text-5xl font-black text-[#B6871F] tracking-tight">MODERATED CAUCUS</p>
                  <p className="text-3xl text-[#6A5A4A] mt-2">{committee.caucus.purpose}</p>
                  {committee.caucus.currentSpeaker && (
                    <div className="mt-4">
                      <div className="text-xs text-[#9A8A78] mb-2 font-mono">NOW SPEAKING</div>
                      {/* Section 1: FlagImg replaces text-6xl emoji */}
                      <div className="flex justify-center">
                        <FlagImg code={getCountryByName(committee.caucus.currentSpeaker)?.code ?? ''} size={64} />
                      </div>
                      <div className={`text-xl font-bold mt-1 ${committee.caucus.currentSpeaker === country ? 'text-[#B6871F]' : 'text-[#1C1410]'}`}>
                        {committee.caucus.currentSpeaker}{committee.caucus.currentSpeaker === country && ' (You)'}
                      </div>
                    </div>
                  )}
                  <div className="text-3xl font-black font-mono text-[#1C1410] mt-4">
                    {formatTime(committee.caucus.remainingTime)}
                  </div>
                  <div className="h-2 bg-[#DDD4C0] rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${committee.caucus.totalTime > 0 ? (committee.caucus.remainingTime / committee.caucus.totalTime) * 100 : 0}%` }} />
                  </div>
                </div>
                {/* Upcoming speakers in caucus queue */}
                {(committee.caucusQueue ?? []).length > 0 && (
                  <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4">
                    <div className="text-xs text-[#9A8A78] font-mono mb-2">UPCOMING SPEAKERS</div>
                    <div className="space-y-1.5">
                      {committee.caucusQueue.slice(0, 8).map((s, i) => (
                        <div key={s.delegateId} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-sm ${s.country === country ? 'bg-[#1B3828]/20 border border-[#1B3828]/30' : ''}`}>
                          <span className="text-[#9A8A78] text-xs w-4 font-mono shrink-0">{i + 1}</span>
                          {/* Section 1: FlagImg replaces text-lg emoji */}
                          <FlagImg code={getCountryByName(s.country)?.code ?? ''} size={20} className="shrink-0" />
                          <span className={s.country === country ? 'text-[#B6871F] font-bold' : 'text-[#6A5A4A]'}>
                            {s.country}{s.country === country && ' (You)'}
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
                <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-6 text-center space-y-3">
                  <p className="text-4xl font-black text-[#B8844A] tracking-tight">UNMODERATED CAUCUS</p>
                  {committee.caucus.purpose && (
                    <p className="text-xl text-[#C4A882]">{committee.caucus.purpose}</p>
                  )}
                  <div className="text-5xl font-black font-mono text-white">
                    {formatTime(committee.caucus.remainingTime)}
                  </div>
                  <div className="h-2 bg-[#2E1E0F] rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${committee.caucus.totalTime > 0 ? (committee.caucus.remainingTime / committee.caucus.totalTime) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[#7A5A38] text-sm">Get networking — use this time to lobby and draft.</p>
                </div>
              </div>
            )}

            {/* Section 3: exclude both moderated and unmoderated caucus phases */}
            {committee.phase !== 'moderated-caucus' && committee.phase !== 'unmoderated-caucus' && (
            <div className={`p-4 space-y-4 max-w-2xl mx-auto ${isAbsent ? 'opacity-60 pointer-events-none select-none' : ''}`}>
              {(() => {
                type C = { bg: string; border: string; text: string; msg: string };
                const v: C = isCurrentSpeaker
                  ? { bg: 'bg-amber-900/30', border: 'border-amber-700/40', text: 'text-amber-300', msg: 'You have the floor!' }
                  : !isOnSpeakersList
                  ? { bg: 'bg-gray-800/30', border: 'border-gray-600/30', text: 'text-gray-400', msg: 'Not on any speaker list' }
                  : myQueueIndex === 0
                  ? { bg: 'bg-amber-900/30', border: 'border-amber-700/40', text: 'text-amber-300', msg: "You're up next!" }
                  : myQueueIndex <= 5
                  ? { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-300', msg: `${myQueueIndex} speaker${myQueueIndex !== 1 ? 's' : ''} until your speech` }
                  : { bg: 'bg-green-900/30', border: 'border-green-700/30', text: 'text-green-300', msg: `${myQueueIndex} speakers until your speech` };
                return (
                  <div className={`${v.bg} border ${v.border} rounded-xl p-4 text-center`}>
                    <div className={`${v.text} font-bold text-lg`}>{v.msg}</div>
                  </div>
                );
              })()}

              {/* Section 1: FlagImg replaces text-8xl emoji in main session */}
              <div className="flex justify-center">
                <FlagImg code={getCountryByName(country)?.code ?? ''} size={88} className="rounded-full shadow-lg" />
              </div>

              {/* Section 5: Voting card */}
              {committee.phase === 'voting' && (() => {
                const activeDoc = (committee.documents ?? []).find(
                  (d) => d.status === 'on-floor' || d.status === 'introduced'
                );
                return (
                  <div className="bg-[#7B4A1E]/20 border border-[#7B4A1E]/40 rounded-xl p-5 text-center space-y-2">
                    <p className="text-xs font-mono text-[#7A5A38]">VOTING PROCEDURE</p>
                    <p className="text-2xl font-black text-[#B8844A]">🗳️ Vote in Progress</p>
                    {activeDoc && (
                      <>
                        <p className="text-sm font-mono text-[#7B4A1E]">{activeDoc.docCode}</p>
                        <p className="text-base font-bold text-white">{activeDoc.title}</p>
                      </>
                    )}
                    <p className="text-xs text-[#7A5A38] mt-2">
                      Your chair is conducting the vote. Check the voting screen for results.
                    </p>
                  </div>
                );
              })()}

              {/* Status card — Section 2: removed flag-with-ring from inside */}
              <div className={`rounded-xl p-5 border ${
                isCurrentSpeaker ? 'bg-[#1B3828]/20 border-[#1B3828]/50' :
                'bg-[#EDE7D8] border-[#DDD4C0]'
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-[#9A8A78] mb-2">SESSION STATUS</div>
                  <div className={`text-2xl font-black mb-1 ${isCurrentSpeaker ? 'text-[#B6871F]' : isAdjourned ? 'text-red-400' : 'text-[#1C1410]'}`}>
                    {isCurrentSpeaker ? <><Emoji size="1em">🎙️</Emoji>{' You Have the Floor'}</> : phaseDisplay}
                  </div>

                  {!isCurrentSpeaker && committee.currentSpeaker && committee.phase === 'speakers-list' && (
                    <div className="mt-3">
                      <div className="text-xs text-[#9A8A78] mb-1">NOW SPEAKING</div>
                      <div className="flex items-center gap-2">
                        {/* Section 1: FlagImg replaces text-2xl */}
                        <FlagImg code={getCountryByName(committee.currentSpeaker.country)?.code ?? ''} size={24} />
                        <span className="font-bold text-[#1C1410]">{committee.currentSpeaker.country}</span>
                      </div>
                    </div>
                  )}

                  {committee.caucus && (
                    <div className="mt-3">
                      <div className="text-sm text-[#6A5A4A] mb-2">
                        {committee.caucus.type === 'moderated' ? 'Moderated' : 'Unmoderated'} Caucus
                        {committee.caucus.purpose && ` — ${committee.caucus.purpose}`}
                      </div>
                      <div className="text-3xl font-black font-mono text-[#1C1410]">
                        {formatTime(committee.caucus.remainingTime)}
                      </div>
                      <div className="h-2 bg-[#DDD4C0] rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${(committee.caucus.remainingTime / committee.caucus.totalTime) * 100}%` }} />
                      </div>
                      {committee.caucus.currentSpeaker && (
                        <div className="mt-3 text-sm flex items-center gap-2">
                          <span className="text-[#6A5A4A]">Speaking:</span>
                          {/* Section 1: FlagImg replaces text-xl */}
                          <FlagImg code={getCountryByName(committee.caucus.currentSpeaker)?.code ?? ''} size={20} />
                          <span className={`font-bold ${committee.caucus.currentSpeaker === country ? 'text-[#B6871F]' : 'text-[#1C1410]'}`}>
                            {committee.caucus.currentSpeaker}{committee.caucus.currentSpeaker === country && ' (You)'}
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
                    <div className="text-xs text-[#9A8A78] font-mono">SPEAKERS LIST</div>
                    {!isOnSpeakersList && !isCurrentSpeaker && myDelegate?.status !== 'absent' && !sessionEnded && (
                      isGslRequestPending ? (
                        <span className="text-xs text-[#B6871F] font-medium flex items-center gap-1"><Emoji size="0.875rem">⏳</Emoji> Awaiting approval</span>
                      ) : gslDenied ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Your request was denied</span>
                          <button onClick={() => setGslDenied(false)}
                            className="text-xs bg-[#DDD4C0] hover:bg-[#C8BAA8] border border-[#1B3828]/30 text-[#6A5A4A] px-2 py-1 rounded-lg font-medium transition-colors">
                            Request Again
                          </button>
                        </div>
                      ) : (
                        <button onClick={handleAddMeToSpeakers}
                          className="text-xs bg-[#1B3828] hover:bg-[#2A5A3C] text-white px-3 py-1 rounded-lg font-medium transition-colors">
                          + Request to Speak
                        </button>
                      )
                    )}
                    {isOnSpeakersList && (
                      <span className="text-xs text-green-400 font-medium">
                        {myQueueIndex === 0 ? '✓ Up next' : `✓ After ${myQueueIndex} speaker${myQueueIndex !== 1 ? 's' : ''}`}
                      </span>
                    )}
                  </div>
                  {committee.speakersList.length === 0 ? (
                    <p className="text-sm text-[#9A8A78]">No speakers queued</p>
                  ) : (
                    <div className="space-y-1.5">
                      {committee.speakersList.map((s, i) => (
                        <div key={s.delegateId} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-sm ${s.country === country ? 'bg-[#1B3828]/20 border border-[#1B3828]/30' : ''}`}>
                          <span className="text-[#9A8A78] text-xs w-4 font-mono shrink-0">{i + 1}</span>
                          {/* Section 1: FlagImg replaces text-lg */}
                          <FlagImg code={getCountryByName(s.country)?.code ?? ''} size={20} className="shrink-0" />
                          <span className={s.country === country ? 'text-[#B6871F] font-bold' : 'text-[#6A5A4A]'}>
                            {s.country}{s.country === country && ' (You)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* My delegation + status toggle */}
              <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4">
                <div className="text-xs text-[#9A8A78] font-mono mb-3">YOUR DELEGATION</div>
                <div className="flex items-center gap-3 mb-3">
                  {/* Section 1: FlagImg replaces text-3xl */}
                  <FlagImg code={getCountryByName(country)?.code ?? ''} size={36} />
                  <div>
                    <div className="font-bold text-[#1C1410]">{country}</div>
                    <div className={`text-xs font-medium mt-0.5 ${
                      myDelegate?.status === 'present' ? 'text-green-400' :
                      myDelegate?.status === 'present-voting' ? 'text-[#B6871F]' : 'text-red-400'
                    }`}>
                      {myDelegate?.status === 'present' ? 'Present' :
                       myDelegate?.status === 'present-voting' ? 'Present & Voting' : 'Absent'}
                    </div>
                  </div>
                </div>
                {/* Status toggle — only when already present/PV and session not ended */}
                {!isAbsent && !sessionEnded && (
                  <div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusChange('present')}
                        disabled={myDelegate?.status === 'present' || changesLeft <= 0}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          myDelegate?.status === 'present'
                            ? 'bg-green-900/30 border-green-700/40 text-green-300'
                            : changesLeft <= 0
                            ? 'bg-[#FAF8F3] border-[#DDD4C0] text-[#9A8A78] cursor-not-allowed'
                            : 'bg-[#FAF8F3] border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'
                        }`}
                      >
                        Present (P)
                      </button>
                      <button
                        onClick={() => handleStatusChange('present-voting')}
                        disabled={myDelegate?.status === 'present-voting' || changesLeft <= 0}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          myDelegate?.status === 'present-voting'
                            ? 'bg-[#1B3828]/30 border-[#1B3828]/40 text-[#B6871F]'
                            : changesLeft <= 0
                            ? 'bg-[#FAF8F3] border-[#DDD4C0] text-[#9A8A78] cursor-not-allowed'
                            : 'bg-[#FAF8F3] border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'
                        }`}
                      >
                        Present &amp; Voting (P&V)
                      </button>
                    </div>
                    <p className="text-[10px] text-[#9A8A78] mt-1.5 text-center">
                      {changesLeft} status change{changesLeft !== 1 ? 's' : ''} remaining (resets after 3 hrs)
                    </p>
                  </div>
                )}
              </div>
            </div>
            )}{/* end phase !== moderated-caucus && !== unmoderated-caucus */}
          </div>
        )}

        {/* ── Motions tab — COMING SOON ── */}
        {tab === 'motions' && (
          <div className="relative flex-1 min-h-[60vh]">
            {/* Grayed-out ghost content */}
            <div className="p-4 space-y-3 opacity-20 pointer-events-none select-none">
              <div className="h-8 bg-[#DDD4C0] rounded-lg w-48" />
              {[1,2,3].map(i => (
                <div key={i} className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4 space-y-2">
                  <div className="h-4 bg-[#DDD4C0] rounded w-32" />
                  <div className="h-3 bg-[#DDD4C0] rounded w-24" />
                  <div className="h-3 bg-[#DDD4C0] rounded w-40" />
                </div>
              ))}
            </div>
            {/* Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F6F1E9]/60 backdrop-blur-sm">
              <div className="mb-6"><Emoji size="3rem">🚧</Emoji></div>
              <div className="text-3xl md:text-4xl font-black text-[#1C1410] tracking-tight text-center px-6">
                FEATURE IS COMING
              </div>
              <p className="text-[#9A8A78] text-sm mt-3 text-center px-6">
                Delegate motion requests will be live in the next update.
              </p>
            </div>
          </div>
        )}

        {/* ── Resolutions tab — Section 4: filter to on-floor+ only ── */}
        {tab === 'resolutions' && (
          <div className="p-4 max-w-2xl mx-auto space-y-3">
            <h2 className="text-lg font-bold text-[#1C1410]">Draft Resolutions</h2>
            {(() => {
              const drs = (committee.documents ?? []).filter(
                (d) => d.type === 'draft-resolution' &&
                  ['introduced', 'on-floor', 'passed', 'failed'].includes(d.status)
              );
              if (drs.length === 0) return <div className="text-center py-8 text-[#7A5A38]">No draft resolutions on the floor yet</div>;
              return drs.map((doc) => {
                const isPresenting = doc.status === 'introduced';
                const isPassed = doc.status === 'passed';
                const isFailed = doc.status === 'failed';
                const isPendingVote = doc.status === 'on-floor';
                return (
                  <div key={doc.id} className={`bg-[#EDE7D8] border rounded-xl p-4 space-y-2 ${isPassed ? 'border-emerald-800/40' : isFailed ? 'border-red-800/40' : isPresenting ? 'border-purple-800/40' : 'border-[#DDD4C0]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-mono font-bold text-[#1B3828] mr-2">{doc.docCode}</span>
                        <span className="font-semibold text-[#1C1410] text-sm">{doc.title}</span>
                      </div>
                      {isPassed && <span className="shrink-0 text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">Passed</span>}
                      {isFailed && <span className="shrink-0 text-xs font-bold text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded-full">Failed</span>}
                      {isPresenting && <span className="shrink-0 text-xs font-bold text-purple-400 bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded-full animate-pulse">Now Presenting</span>}
                      {isPendingVote && <span className="shrink-0 text-xs font-bold text-yellow-400 bg-yellow-950/40 border border-yellow-800/40 px-2 py-0.5 rounded-full">Pending Vote</span>}
                    </div>
                    <div className="text-xs text-[#9A8A78]">
                      {doc.sponsors.map((s, i) => (
                        <span key={s} className={i === 0 ? 'text-[#6A5A4A] font-medium' : ''}>
                          {i > 0 ? ', ' : ''}{flagFor(s)} {s}
                        </span>
                      ))}
                    </div>
                    {isPresenting && doc.readingMinutes && doc.readingMinutes > 0 && (
                      <div className="text-xs text-purple-300 mt-1">
                        📖 {doc.readingMinutes}m reading · 🎤 {doc.presentationMinutes ?? 0}m presentation{doc.qaMinutes ? ` · ❓ ${doc.qaMinutes}m Q&A` : ''}
                      </div>
                    )}
                    {doc.fileUrl && doc.fileName && (
                      <InlinePdfViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ── Documents tab ── */}
        {tab === 'documents' && (
          <div>
            {isAbsent && !sessionEnded && <AbsentBanner />}
            {!sessionEnded ? (
              <div className={isAbsent ? 'opacity-60 pointer-events-none select-none' : ''}>
                <DelegateDocumentsTab committee={committee} country={country} />
              </div>
            ) : (
              <div className="p-8 text-center text-[#9A8A78]">Document submission is closed — session has ended.</div>
            )}
          </div>
        )}

        {/* ── Stats tab ── */}
        {tab === 'stats' && (
          <StatisticsTab committee={committee} country={country} />
        )}
      </div>}
      </div>
      </>
      )}
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
