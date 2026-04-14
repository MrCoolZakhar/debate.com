'use client';

import { use, useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Committee, CommitteeDocument, DocumentType, PendingMotionType, SpeakingLogEntry, DelegateStatus } from '@/lib/types';
import ChatPanel from '@/components/ChatPanel';
import { useSettingsStore } from '@/lib/settingsStore';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';
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
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function flagFor(country: string): string {
  const c = getCountryByName(country);
  return c ? getFlagEmoji(c.code) : '🌐';
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
        <span className="inline-flex items-center gap-1 text-xs bg-[#7B4A1E]/20 border border-[#7B4A1E]/30 text-[#C4A882] rounded-full px-2.5 py-0.5 font-medium">
          {flagFor(myCountry)} {myCountry} <span className="text-[#7A5A38] ml-0.5">(you)</span>
        </span>
        {value.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 text-xs bg-[#150F09] border border-[#2E1E0F] text-[#C4A882] rounded-full px-2.5 py-0.5">
            {flagFor(c)} {c}
            <button onClick={() => onChange(value.filter((x) => x !== c))} className="ml-1 text-[#7A5A38] hover:text-red-400 font-bold leading-none">×</button>
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
          className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E] placeholder-[#7A5A38]"
        />
        {matches.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-20 shadow-xl max-h-40 overflow-y-auto">
            {matches.slice(0, 8).map((c, i) => (
              <button
                key={c}
                onMouseDown={(e) => { e.preventDefault(); add(c); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${i === 0 ? 'bg-[#2E1E0F] text-white' : 'text-[#C4A882] hover:bg-[#2E1E0F]'}`}
              >
                {flagFor(c)} {c}
                {i === 0 && <span className="ml-auto text-xs text-[#7A5A38]">↵ Enter</span>}
              </button>
            ))}
          </div>
        )}
      </div>
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
      <h2 className="text-lg font-bold text-white">Submit Document</h2>
      {submitted && (
        <div className="bg-green-900/30 border border-green-700/30 rounded-xl p-3 text-green-300 text-sm">
          ✓ Document submitted to chair for review
        </div>
      )}
      <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4 space-y-4">
        {/* Type selector */}
        <div>
          <label className="text-xs text-[#C4A882] mb-1.5 block">Document type</label>
          <div className="flex gap-2">
            {(['working-paper', 'draft-resolution'] as DocumentType[]).map((dt) => (
              <button key={dt} onClick={() => setDocType(dt)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${docType === dt ? 'bg-[#2E1E0F] border-[#7B4A1E] text-white' : 'bg-[#150F09] border-[#2E1E0F] text-[#C4A882] hover:border-[#7B4A1E]'}`}>
                {dt === 'working-paper' ? 'Working Paper' : 'Draft Resolution'}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-[#C4A882] mb-1.5 block">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Strengthening climate adaptation frameworks"
            className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E]" />
        </div>

        {/* Co-sponsors */}
        <div>
          <label className="text-xs text-[#C4A882] mb-1.5 block">
            Sponsors <span className="text-[#7A5A38]">— you are automatically listed first</span>
          </label>
          <SponsorsInput committee={committee} myCountry={country} value={coSponsors} onChange={setCoSponsors} />
        </div>

        {/* File */}
        <div>
          <label className="text-xs text-[#C4A882] mb-1.5 block">Attach file <span className="text-[#7A5A38]">(optional)</span></label>
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()}
              className="text-xs bg-[#150F09] border border-[#2E1E0F] hover:border-[#7B4A1E] text-[#C4A882] px-3 py-2 rounded-lg transition-colors">
              {fileName ? `📎 ${fileName}` : '+ Attach file'}
            </button>
            {fileName && <button onClick={() => { setFileName(null); setFileUrl(null); }} className="text-xs text-[#7A5A38] hover:text-red-400">Remove</button>}
          </div>
          <input ref={fileInputRef} type="file" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => { setFileUrl(reader.result as string); setFileName(f.name); };
              reader.readAsDataURL(f);
            }} />
        </div>

        <button onClick={handleSubmit} disabled={!title.trim() || sending}
          className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
          {sending ? 'Submitting…' : 'Submit to Chair →'}
        </button>
      </div>

      {/* Existing docs */}
      {(committee.documents ?? []).length > 0 && (
        <div>
          <div className="text-xs font-mono text-[#7A5A38] mb-2">SUBMITTED DOCUMENTS</div>
          <div className="space-y-2">
            {(committee.documents ?? []).map((doc) => (
              <div key={doc.id} className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white text-sm">{doc.docCode} — {doc.title}</div>
                  <span className={`text-xs font-bold ml-2 ${doc.status === 'on-floor' ? 'text-[#B8844A]' : doc.status === 'passed' ? 'text-emerald-400' : doc.status === 'failed' ? 'text-red-400' : 'text-[#7A5A38]'}`}>{doc.status}</span>
                </div>
                <div className="text-xs text-[#7A5A38] mt-1">
                  {doc.sponsors.map((s, i) => (
                    <span key={s} className={i === 0 ? 'text-[#C4A882] font-medium' : ''}>
                      {i > 0 ? ', ' : ''}{flagFor(s)} {s}
                    </span>
                  ))}
                </div>
              </div>
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

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      {/* Score card */}
      <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-2xl p-5">
        <div className="text-xs font-mono text-[#7A5A38] mb-3">YOUR SCORE</div>
        <div className="flex items-end gap-3 mb-3">
          <span className="text-6xl font-black text-white">{total}</span>
          <span className="text-lg text-[#C4A882] font-medium mb-1">pts</span>
        </div>
        <div className="inline-block bg-[#7B4A1E]/20 border border-[#7B4A1E]/30 text-[#B8844A] text-sm font-bold px-3 py-1 rounded-full">
          {tier}
        </div>

        {/* Score breakdown */}
        {breakdown.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {breakdown.map((b) => (
              <div key={b.label} className="flex justify-between text-xs">
                <span className="text-[#C4A882]">{b.label}</span>
                <span className="text-white font-bold">+{b.pts}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Speaking stats */}
      <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-2xl p-5">
        <div className="text-xs font-mono text-[#7A5A38] mb-3">YOUR SPEAKING HISTORY</div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="text-2xl font-black text-white">{myLogs.length}</div>
            <div className="text-xs text-[#7A5A38]">Speeches</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-white">{formatTime(totalSeconds)}</div>
            <div className="text-xs text-[#7A5A38]">Total time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-white">{myRank > 0 ? `#${myRank}` : '—'}</div>
            <div className="text-xs text-[#7A5A38]">Rank by time</div>
          </div>
        </div>
        {myLogs.length > 0 ? (
          <div className="space-y-1.5">
            {myLogs.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-[#150F09] rounded-lg px-3 py-2">
                <span className="text-[#C4A882] truncate flex-1">{l.topic || 'General Speakers\' List'}</span>
                <span className="text-[#7A5A38] shrink-0 ml-2 capitalize">{l.context.replace(/-/g, ' ')}</span>
                <span className="text-white font-mono shrink-0 ml-2">{l.seconds}s</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[#7A5A38] text-sm text-center py-2">No speeches recorded yet</p>
        )}
      </div>

      {/* Committee leaderboard */}
      {ranking.length > 0 && (
        <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-2xl p-5">
          <div className="text-xs font-mono text-[#7A5A38] mb-3">COMMITTEE SPEAKING TIME</div>
          <div className="space-y-1.5">
            {ranking.slice(0, 10).map((r, i) => (
              <div key={r.country} className={`flex items-center gap-2 text-sm ${r.country === country ? 'bg-[#7B4A1E]/10 border border-[#7B4A1E]/20 rounded-lg px-2 py-1' : 'px-2 py-1'}`}>
                <span className="text-[#7A5A38] text-xs w-4 font-mono shrink-0">{i + 1}</span>
                <span className="text-base shrink-0">{flagFor(r.country)}</span>
                <span className={`flex-1 truncate ${r.country === country ? 'text-[#B8844A] font-bold' : 'text-[#C4A882]'}`}>{r.country}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-[#2E1E0F] rounded-full overflow-hidden">
                    <div className="h-full bg-[#7B4A1E] rounded-full" style={{ width: `${(r.seconds / ranking[0].seconds) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono text-[#7A5A38] w-10 text-right">{formatTime(r.seconds)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-2xl p-5">
          <div className="text-xs font-mono text-[#7A5A38] mb-3">HOW TO IMPROVE YOUR SCORE</div>
          <div className="space-y-2">
            {tips.map((tip) => (
              <div key={tip} className="flex gap-2 text-sm text-[#C4A882]">
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
  const searchParams = useSearchParams();
  const country = searchParams.get('country') || '';

  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DelegateTab>('session');
  const [showChat, setShowChat] = useState(false);
  const [chatReadCount, setChatReadCount] = useState(0);

  // Local timer countdown (smooth, doesn't wait for Supabase tick)
  const [localTime, setLocalTime] = useState(0);
  const [localTimerActive, setLocalTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const committeeIdRef = useRef('');
  // Track last seen speaker to only reset localTime when speaker changes
  const lastSpeakerIdRef = useRef<string | null>(null);
  const prevServerTimeRef = useRef<number>(0);

  // Join request state
  const [joinRequesting, setJoinRequesting] = useState(false);
  const [joinStatus, setJoinStatus] = useState<DelegateStatus | null>(null);
  const [joinDenied, setJoinDenied] = useState(false);

  const { getSettings } = useSettingsStore();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function load() {
      const found = await getCommitteeByCode(code.toUpperCase());
      setCommittee(found ?? null);
      setLoading(false);
      if (found) {
        committeeIdRef.current = found.id;
        setLocalTime(found.speakerTimeRemaining);
        lastSpeakerIdRef.current = found.currentSpeaker?.delegateId ?? null;
        unsubscribe = subscribeToCommittee(found.id, async () => {
          const updated = await getCommitteeByCode(code.toUpperCase());
          if (updated) {
            setCommittee(updated);
            const newSpeakerId = updated.currentSpeaker?.delegateId ?? null;
            if (newSpeakerId !== lastSpeakerIdRef.current) {
              setLocalTime(updated.speakerTimeRemaining);
              prevServerTimeRef.current = updated.speakerTimeRemaining;
              setLocalTimerActive(false); // Reset on new speaker
              lastSpeakerIdRef.current = newSpeakerId;
            } else if (updated.speakerTimeRemaining < prevServerTimeRef.current) {
              // Server time decreased — chair's timer is running
              setLocalTime(updated.speakerTimeRemaining); // Sync with server
              setLocalTimerActive(true);
              prevServerTimeRef.current = updated.speakerTimeRemaining;
            }
          }
        });
      }
    }
    load();
    return () => unsubscribe?.();
  }, [code]);

  // Local timer tick — smooth countdown independent of Supabase round-trips
  useEffect(() => {
    if (!committee?.currentSpeaker || committee.phase !== 'speakers-list' || !localTimerActive) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => {
      setLocalTime((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [committee?.currentSpeaker?.delegateId, committee?.phase, localTimerActive]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="text-center">
          <img
            src="/loading.gif"
            alt="Loading…"
            className="w-20 h-20 mx-auto mb-4 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const s = document.createElement('div');
              s.className = 'w-8 h-8 border-2 border-[#7B4A1E] border-t-transparent rounded-full animate-spin mx-auto mb-4';
              (e.target as HTMLImageElement).parentElement?.prepend(s);
            }}
          />
          <p className="text-[#C4A882] text-sm">Joining session…</p>
        </div>
      </div>
    );
  }

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-white mb-2">Session not found</h1>
          <p className="text-[#C4A882] mb-6">Code "{code}" is invalid or the session ended.</p>
          <Link href="/join" className="bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-6 py-3 rounded-lg font-semibold transition-colors">Try Again</Link>
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
  const progress = isCurrentSpeaker ? (localTime / committee.speakerTimeLimit) * 100 : 0;
  const changesLeft = myDelegate ? statusChangesRemaining(committee.id, country) : 0;

  const enabledMotionTypes = {
    moderated: settings.motionModeratedCaucus,
    unmoderated: settings.motionUnmoderatedCaucus,
    consultation: settings.motionCoW,
    tour: settings.motionTourDeTable,
  };

  const phaseDisplay = PHASE_LABELS[committee.phase] || committee.phase;

  const isAdjourned = committee.phase === 'adjourned';

  // ── Status change handler — optimistic update to avoid visible lag
  const handleStatusChange = async (newStatus: DelegateStatus) => {
    if (!myDelegate) return;
    if (changesLeft <= 0) return;
    // Apply immediately in local state (no waiting for DB round-trip)
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

  const tabs: { key: DelegateTab; label: string }[] = [
    { key: 'session', label: 'Session' },
    { key: 'motions', label: 'Motions' },
    { key: 'resolutions', label: 'Resolutions' },
    { key: 'documents', label: 'Documents' },
    { key: 'stats', label: 'Stats' },
  ];

  // ── Absent banner (blocks active interaction)
  const AbsentBanner = () => (
    <div className="mx-4 mt-4 bg-[#1A1209] border border-[#7B4A1E]/40 rounded-xl p-4">
      <div className="text-sm font-bold text-white mb-1">You are currently absent</div>
      <div className="text-xs text-[#C4A882] mb-3">Mark yourself Present or Present & Voting to participate actively.</div>
      {joinStatus && !joinDenied ? (
        <div className="text-xs text-[#7B4A1E] font-medium flex items-center gap-1.5">
          <div className="w-3 h-3 border border-[#7B4A1E] border-t-transparent rounded-full animate-spin" />
          Join request sent — waiting for chair approval…
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => handleRequestJoin('present')} disabled={joinRequesting}
            className="flex-1 bg-[#2E1E0F] hover:bg-[#3D2A15] border border-[#7B4A1E]/30 text-[#C4A882] py-2 rounded-lg text-xs font-semibold transition-colors">
            Mark Present (P)
          </button>
          <button onClick={() => handleRequestJoin('present-voting')} disabled={joinRequesting}
            className="flex-1 bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-2 rounded-lg text-xs font-semibold transition-colors">
            Present &amp; Voting (P&V)
          </button>
        </div>
      )}
      {joinDenied && <p className="text-red-400 text-xs mt-2">Your join request was denied by the chair.</p>}
    </div>
  );

  return (
    <div className="h-screen bg-[#0D0906] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-[#2E1E0F] bg-[#150F08] px-4 h-14 flex items-center gap-3 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <img src="/gavelling-logo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm truncate">{committee.name}</div>
          <div className="text-xs text-[#7A5A38] truncate">{committee.topic}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-bold text-white flex items-center gap-1.5 justify-end">
              <span className="text-lg">{flagFor(country)}</span>
              {country}
              <span className="ml-1 text-xs font-mono text-[#7B4A1E] bg-[#2E1E0F] px-1.5 py-0.5 rounded">{committee.code}</span>
            </div>
            <div className={`text-xs font-medium ${
              isAdjourned ? 'text-red-400' :
              committee.phase === 'voting' ? 'text-[#B8844A]' : 'text-[#7A5A38]'
            }`}>{phaseDisplay}</div>
          </div>
          <button
            onClick={() => {
              const newShow = !showChat;
              setShowChat(newShow);
              if (newShow) setChatReadCount(committee.messages.filter(m => !m.content.startsWith('__log__:')).length);
            }}
            className={`relative text-xs px-3 py-1.5 rounded-lg transition-colors font-semibold shrink-0 ${showChat ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'}`}
          >
            💬
            {!showChat && (() => {
              const total = committee.messages.filter((m) => !m.content.startsWith('__log__:')).length;
              const unread = total - chatReadCount;
              return unread > 0 ? (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#B8844A] rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                  {Math.min(unread, 99)}
                </span>
              ) : null;
            })()}
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <div className="flex border-b border-[#2E1E0F] bg-[#150F08] shrink-0">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-bold capitalize transition-colors ${
              tab === t.key ? 'text-white border-b-2 border-[#7B4A1E]' : 'text-[#7A5A38] hover:text-[#C4A882]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        {/* ── Session tab ── */}
        {tab === 'session' && (
          <div>
            {isAbsent && <AbsentBanner />}
            <div className={`p-4 space-y-4 max-w-2xl mx-auto ${isAbsent ? 'opacity-60 pointer-events-none select-none' : ''}`}>
              {/* Status card */}
              <div className={`rounded-xl p-5 border ${
                isCurrentSpeaker ? 'bg-[#7B4A1E]/20 border-[#7B4A1E]/50' :
                committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus' ? 'bg-purple-900/20 border-purple-700/30' :
                'bg-[#1A1209] border-[#2E1E0F]'
              }`}>
                <div className="flex gap-4 items-start">
                  {/* Big country flag */}
                  <div className="text-6xl select-none shrink-0 leading-none">{flagFor(country)}</div>
                  <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-[#7A5A38] mb-2">SESSION STATUS</div>
                <div className={`text-2xl font-black mb-1 ${isCurrentSpeaker ? 'text-[#B8844A]' : isAdjourned ? 'text-red-400' : 'text-white'}`}>
                  {isCurrentSpeaker ? '🎙️ You Have the Floor' : phaseDisplay}
                </div>

                {isCurrentSpeaker && (
                  <div className="mt-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-[#C4A882]">Remaining time</span>
                      <span className={`text-sm font-mono font-bold ${localTime <= 10 ? 'text-red-400' : 'text-white'}`}>
                        {formatTime(localTime)}
                      </span>
                    </div>
                    <div className="h-3 bg-[#2E1E0F] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${progress > 50 ? 'bg-[#B8844A]' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {!isCurrentSpeaker && committee.currentSpeaker && committee.phase === 'speakers-list' && (
                  <div className="mt-3">
                    <div className="text-xs text-[#7A5A38] mb-1">NOW SPEAKING</div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{flagFor(committee.currentSpeaker.country)}</span>
                      <span className="font-bold text-white">{committee.currentSpeaker.country}</span>
                    </div>
                    {/* Progress bar only (no time number for non-speakers) */}
                    <div className="mt-2 h-2 bg-[#2E1E0F] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${progress > 50 ? 'bg-[#B8844A]' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${(localTime / committee.speakerTimeLimit) * 100}%` }} />
                    </div>
                  </div>
                )}

                {committee.caucus && (
                  <div className="mt-3">
                    <div className="text-sm text-[#C4A882] mb-2">
                      {committee.caucus.type === 'moderated' ? 'Moderated' : 'Unmoderated'} Caucus
                      {committee.caucus.purpose && ` — ${committee.caucus.purpose}`}
                    </div>
                    <div className="text-3xl font-black font-mono text-white">
                      {formatTime(committee.caucus.remainingTime)}
                    </div>
                    <div className="h-2 bg-[#2E1E0F] rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${(committee.caucus.remainingTime / committee.caucus.totalTime) * 100}%` }} />
                    </div>
                    {committee.caucus.currentSpeaker && (
                      <div className="mt-3 text-sm flex items-center gap-2">
                        <span className="text-[#C4A882]">Speaking:</span>
                        <span className="text-xl">{flagFor(committee.caucus.currentSpeaker)}</span>
                        <span className={`font-bold ${committee.caucus.currentSpeaker === country ? 'text-[#B8844A]' : 'text-white'}`}>
                          {committee.caucus.currentSpeaker}{committee.caucus.currentSpeaker === country && ' (You)'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                  </div>{/* end flex-1 */}
                </div>{/* end flex gap-4 */}
              </div>

              {/* Speakers list */}
              {committee.phase === 'speakers-list' && (
                <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-[#7A5A38] font-mono">SPEAKERS LIST</div>
                    {!isOnSpeakersList && !isCurrentSpeaker && myDelegate?.status !== 'absent' && (
                      isGslRequestPending ? (
                        <span className="text-xs text-[#B8844A] font-medium">⏳ Awaiting approval</span>
                      ) : (
                        <button onClick={handleAddMeToSpeakers}
                          className="text-xs bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-3 py-1 rounded-lg font-medium transition-colors">
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
                    <p className="text-sm text-[#7A5A38]">No speakers queued</p>
                  ) : (
                    <div className="space-y-1.5">
                      {committee.speakersList.map((s, i) => (
                        <div key={s.delegateId} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-sm ${s.country === country ? 'bg-[#7B4A1E]/20 border border-[#7B4A1E]/30' : ''}`}>
                          <span className="text-[#7A5A38] text-xs w-4 font-mono shrink-0">{i + 1}</span>
                          <span className="text-lg shrink-0">{flagFor(s.country)}</span>
                          <span className={s.country === country ? 'text-[#B8844A] font-bold' : 'text-[#C4A882]'}>
                            {s.country}{s.country === country && ' (You)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* My delegation + status toggle */}
              <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4">
                <div className="text-xs text-[#7A5A38] font-mono mb-3">YOUR DELEGATION</div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{flagFor(country)}</span>
                  <div>
                    <div className="font-bold text-white">{country}</div>
                    <div className={`text-xs font-medium mt-0.5 ${
                      myDelegate?.status === 'present' ? 'text-green-400' :
                      myDelegate?.status === 'present-voting' ? 'text-[#B8844A]' : 'text-red-400'
                    }`}>
                      {myDelegate?.status === 'present' ? 'Present' :
                       myDelegate?.status === 'present-voting' ? 'Present & Voting' : 'Absent'}
                    </div>
                  </div>
                </div>
                {/* Status toggle — only when already present/PV */}
                {!isAbsent && (
                  <div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusChange('present')}
                        disabled={myDelegate?.status === 'present' || changesLeft <= 0}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          myDelegate?.status === 'present'
                            ? 'bg-green-900/30 border-green-700/40 text-green-300'
                            : changesLeft <= 0
                            ? 'bg-[#150F09] border-[#2E1E0F] text-[#7A5A38] cursor-not-allowed'
                            : 'bg-[#150F09] border-[#2E1E0F] text-[#C4A882] hover:border-[#7B4A1E]'
                        }`}
                      >
                        Present (P)
                      </button>
                      <button
                        onClick={() => handleStatusChange('present-voting')}
                        disabled={myDelegate?.status === 'present-voting' || changesLeft <= 0}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          myDelegate?.status === 'present-voting'
                            ? 'bg-[#7B4A1E]/30 border-[#7B4A1E]/40 text-[#B8844A]'
                            : changesLeft <= 0
                            ? 'bg-[#150F09] border-[#2E1E0F] text-[#7A5A38] cursor-not-allowed'
                            : 'bg-[#150F09] border-[#2E1E0F] text-[#C4A882] hover:border-[#7B4A1E]'
                        }`}
                      >
                        Present &amp; Voting (P&V)
                      </button>
                    </div>
                    <p className="text-[10px] text-[#7A5A38] mt-1.5 text-center">
                      {changesLeft} status change{changesLeft !== 1 ? 's' : ''} remaining (resets after 3 hrs)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Motions tab — COMING SOON ── */}
        {tab === 'motions' && (
          <div className="relative flex-1 min-h-[60vh]">
            {/* Grayed-out ghost content */}
            <div className="p-4 space-y-3 opacity-20 pointer-events-none select-none">
              <div className="h-8 bg-[#2E1E0F] rounded-lg w-48" />
              {[1,2,3].map(i => (
                <div key={i} className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4 space-y-2">
                  <div className="h-4 bg-[#2E1E0F] rounded w-32" />
                  <div className="h-3 bg-[#2E1E0F] rounded w-24" />
                  <div className="h-3 bg-[#2E1E0F] rounded w-40" />
                </div>
              ))}
            </div>
            {/* Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0906]/60 backdrop-blur-sm">
              <div className="text-5xl mb-6">🚧</div>
              <div className="text-3xl md:text-4xl font-black text-white tracking-tight text-center px-6">
                FEATURE IS COMING
              </div>
              <p className="text-[#7A5A38] text-sm mt-3 text-center px-6">
                Delegate motion requests will be live in the next update.
              </p>
            </div>
          </div>
        )}

        {/* ── Resolutions tab ── */}
        {tab === 'resolutions' && (
          <div className="p-4 max-w-2xl mx-auto space-y-3">
            <h2 className="text-lg font-bold text-white">Resolutions</h2>
            {committee.resolutions.length === 0 ? (
              <div className="text-center py-8 text-[#7A5A38]">No resolutions submitted</div>
            ) : (
              committee.resolutions.map((res) => (
                <div key={res.id} className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="font-semibold text-white text-sm">{res.title}</div>
                    <span className={`text-xs font-bold ml-3 ${res.status === 'passed' ? 'text-emerald-400' : res.status === 'failed' ? 'text-red-400' : res.status === 'approved' ? 'text-green-400' : res.status === 'submitted' ? 'text-[#B8844A]' : 'text-yellow-400'}`}>{res.status}</span>
                  </div>
                  <div className="text-xs text-[#C4A882] mt-1">Sponsors: {res.sponsors.join(', ')}</div>
                  {res.content && (
                    <div className="mt-2 text-xs text-[#7A5A38] bg-[#150F09] border border-[#2E1E0F] rounded-lg p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">{res.content}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Documents tab ── */}
        {tab === 'documents' && (
          <div>
            {isAbsent && <AbsentBanner />}
            <div className={isAbsent ? 'opacity-60 pointer-events-none select-none' : ''}>
              <DelegateDocumentsTab committee={committee} country={country} />
            </div>
          </div>
        )}

        {/* ── Stats tab ── */}
        {tab === 'stats' && (
          <StatisticsTab committee={committee} country={country} />
        )}
      </div>

      {/* Chat sidebar */}
      {showChat && (
        <aside className="w-[36rem] border-l border-[#2E1E0F] bg-[#0D0906] flex flex-col overflow-hidden shrink-0">
          <ChatPanel committee={committee} senderName={country} isChair={false} />
        </aside>
      )}
      </div>
    </div>
  );
}

export default function DelegateSession({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7B4A1E] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DelegateSessionInner params={params} />
    </Suspense>
  );
}
