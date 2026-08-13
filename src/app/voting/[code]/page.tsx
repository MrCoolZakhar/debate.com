'use client';

import { use, useEffect, useRef, useState } from 'react';
import FitToScreen from '@/components/FitToScreen';
import Portal from '@/components/Portal';
import SessionsHeaderLogo from '@/components/SessionsHeaderLogo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { Committee, DelegateStatus } from '@/lib/types';
import { getCountryByName, getFlagUrl, getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';
import { MajorityPie } from '@/components/RollCallPanel';
import { getCommitteeByCode, setPhase as setPhaseInDB, setDelegateStatus as setDelegateStatusInDB, updateDocumentStatus as updateDocumentStatusInDB, saveCommitteeSettings } from '@/lib/committeeService';
import { useSettingsStore, DEFAULT_SETTINGS, impliedSettings, type CommitteeSettings } from '@/lib/settingsStore';
import { VotingRulesPanel, VotingRulesPopover, computeVoteOutcome, isVetoDelegation } from '@/components/VotingRulesPanel';
import { useAuth } from '@/components/AuthProvider';
import { detectConferenceSession, verifyConferenceAccess } from '@/lib/conferenceAccess';
import { sponsorLabel } from '@/lib/committeeFlags';
import { docName } from '@/lib/docNames';
import { SettingsPanel } from '@/components/SettingsPanel';

/**
 * Device-local evidence that this browser has actually been a chair of `code`.
 *
 * Two sources, both written by /chair/[code] and by nothing else:
 *   • `gavelling-settings` → settings[CODE].chairJoinSuffix — the chair page mirrors
 *     the DB credential there on every load (the delegate and advisor pages never
 *     write it, so its presence really does mean "this device opened the chair view")
 *   • `gavelling-rejoin` → { code, chairSuffix, chairName } for THIS committee
 *
 * Read straight out of localStorage rather than through the Zustand selector, and
 * captured during the FIRST render, because the access-granted effect below writes
 * the DB suffix into that same store. Reading it back afterwards would hand the
 * gate its own answer and let anyone in on the second page load.
 */
function readChairDeviceProof(code: string): { suffix: string | null; chairName: string | null } {
  if (typeof window === 'undefined') return { suffix: null, chairName: null };
  const upper = code.toUpperCase();
  let suffix: string | null = null;
  let chairName: string | null = null;
  try {
    const raw = localStorage.getItem('gavelling-settings');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { settings?: Record<string, { chairJoinSuffix?: string }> } };
      const bag = parsed?.state?.settings ?? {};
      const entry = bag[upper] ?? bag[code];
      if (entry?.chairJoinSuffix) suffix = String(entry.chairJoinSuffix);
    }
  } catch { /* unreadable store — fall through to the rejoin blob */ }
  try {
    const raw = localStorage.getItem('gavelling-rejoin');
    if (raw) {
      const parsed = JSON.parse(raw) as { code?: string; chairSuffix?: string | null; chairName?: string | null };
      if ((parsed?.code ?? '').toUpperCase() === upper) {
        if (!suffix && parsed.chairSuffix) suffix = String(parsed.chairSuffix);
        if (parsed.chairName) chairName = String(parsed.chairName);
      }
    }
  } catch { /* malformed blob — no proof from here */ }
  return { suffix, chairName };
}

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

type VoteChoice = 'for' | 'against' | 'for-rights' | 'against-rights' | 'abstain';
interface DelegateVote {
  delegateId: string;
  country: string;
  choice: VoteChoice;
}

type VotingPhase = 'voting' | 'rights-speakers' | 'result';

// ── Roll call modal — defined OUTSIDE VotingPage so React never remounts it ──
// (defining it inside caused new function type each render → unmount/remount → no CSS transitions)
function RollCallModal({
  delegates,
  rollCallStatuses,
  onCycleStatus,
  onConfirm,
  side,
}: {
  delegates: Committee['delegates'];
  rollCallStatuses: Record<string, DelegateStatus>;
  onCycleStatus: (id: string) => void;
  onConfirm: () => void;
  /** Rendered immediately beside the roll call card (the voting-rules console). */
  side?: React.ReactNode;
}) {
  const t = useT();
  const { language } = useLanguage();
  // Observers are excluded from the voting roster entirely.
  const votable = delegates.filter((d) => !d.isObserver);
  const sorted = [...votable].sort((a, b) => compareCountryNames(a.country, b.country, language));
  const thumbPos = (status: DelegateStatus) =>
    status === 'absent' ? 'left-[2px]' : status === 'present' ? 'left-[32px]' : 'left-[62px]';
  const thumbColor = (status: DelegateStatus) =>
    status === 'absent' ? 'bg-[#8B2020]' : status === 'present' ? 'bg-[#3D7A52]' : 'bg-[#B6871F]';
  const presentCount = votable.filter((d) => (rollCallStatuses[d.id] ?? d.status) !== 'absent').length;
  return (
    <Portal><div className="fixed inset-0 z-50 flex items-center justify-center gap-4 px-4" style={{ background: 'rgba(5,4,3,0.92)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl w-full max-w-md shadow-2xl flex flex-col" style={{ maxHeight: '85%', backgroundColor: '#1B3828', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-black text-white">{t('voting_roll_call_heading')}</h2>
            <div className="flex gap-1.5">
              <MajorityPie arcFill={1}     color="#2A5A3C" label={`${presentCount}`} />
              <MajorityPie arcFill={2 / 3} color="#B6871F" label={`${Math.ceil(presentCount * 2 / 3)}`} />
              <MajorityPie arcFill={0.5}   color="#8A7A6A" label={`${Math.floor(presentCount / 2) + 1}`} />
            </div>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {t('voting_roll_call_sub').replace('{present}', String(presentCount)).replace('{total}', String(votable.length))}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {sorted.map((d) => {
            const status = rollCallStatuses[d.id] ?? d.status;
            return (
              <div
                key={d.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
                style={{
                  backgroundColor: status === 'present' ? 'rgba(61,122,82,0.22)' : status === 'present-voting' ? 'rgba(182,135,31,0.18)' : 'transparent',
                  opacity: status === 'absent' ? 0.4 : 1,
                  border: status === 'present' ? '1px solid rgba(61,122,82,0.4)' : status === 'present-voting' ? '1px solid rgba(182,135,31,0.35)' : '1px solid transparent',
                }}
              >
                <div className="w-9 h-9 rounded-full bg-[#DDD4C0] border border-[#C8BAA8] flex items-center justify-center shrink-0 overflow-hidden">
                  {(() => { const f = getCountryByName(d.country); return f ? <img src={getFlagUrl(f.code)} alt={f.code} className="w-6 h-6 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Emoji size="1.25rem">🌐</Emoji>; })()}
                </div>
                <span className="flex-1 text-sm text-white truncate">{getCountryDisplayName(d.country, language)}</span>
                <button
                  onClick={() => onCycleStatus(d.id)}
                  className="relative w-[90px] h-[30px] rounded-full cursor-pointer shrink-0 select-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.22)' }}
                  title="Tap to cycle: Absent → Present → PV"
                >
                  <div className="absolute inset-0 grid grid-cols-3 items-center pointer-events-none">
                    <span className={`text-[10px] font-bold text-center ${status === 'absent' ? 'text-white' : 'text-white/40'}`}>A</span>
                    <span className={`text-[10px] font-bold text-center ${status === 'present' ? 'text-white' : 'text-white/40'}`}>P</span>
                    <span className={`text-[10px] font-bold text-center ${status === 'present-voting' ? 'text-white' : 'text-white/40'}`}>PV</span>
                  </div>
                  <div className={`absolute top-[2px] w-[26px] h-[22px] rounded-full transition-all duration-200 shadow-sm ${thumbPos(status)} ${thumbColor(status)}`} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <button
            onClick={onConfirm}
            disabled={presentCount === 0}
            className="w-full py-3 rounded-xl font-black text-sm transition-colors"
            style={{
              backgroundColor: presentCount > 0 ? '#EDE7D8' : 'rgba(255,255,255,0.15)',
              color: presentCount > 0 ? '#1C1410' : 'rgba(255,255,255,0.4)',
            }}
          >
            {presentCount > 0 ? t('voting_start_btn').replace('{n}', String(presentCount)) : t('voting_mark_present')}
          </button>
        </div>
      </div>
      {side}
    </div></Portal>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
// Declared at module scope (like RollCallModal) so React keeps the same element
// type across renders. Nested inside VotingPage it was a brand-new component type
// on every render, which remounted the whole bar — killing CSS transitions and
// resetting any state a header child owns (e.g. the open voting-rules popover).
function VotingHeader({ committeeName, onBack, onEndDebate, onOpenSettings, rules, children }: {
  committeeName: string;
  onBack: () => void;
  onEndDebate: () => void;
  onOpenSettings: () => void;
  rules?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const t = useT();
  return (
    <header className="border-b border-[#DDD4C0] bg-[#FAF8F3] px-4 h-11 flex items-center gap-4 shrink-0">
      <SessionsHeaderLogo />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-bold text-[#1C1410] truncate">{abbreviateCommitteeName(committeeName)}</span>
      </div>
      <button
        onClick={onBack}
        className="text-xs px-3 py-1.5 rounded-lg font-black transition-colors shrink-0"
        style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
      >
        {t('voting_back_to_session')}
      </button>
      <button
        onClick={onEndDebate}
        className="text-xs px-3 py-1.5 rounded-lg font-black transition-colors shrink-0"
        style={{ backgroundColor: '#8B2020', color: 'white' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#A03030'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}
      >
        {t('voting_end_debate')}
      </button>
      {rules}
      <button onClick={onOpenSettings} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors shrink-0 text-2xl">⚙</button>
      {children}
    </header>
  );
}

function getFlag(country: string) {
  const found = getCountryByName(country);
  return found
    ? <img src={getFlagUrl(found.code)} alt={found.code} className="inline-block object-contain" style={{ width: '1em', height: '1em' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    : <Emoji size="1em">🌐</Emoji>;
}

function VoteScale({ forCount, againstCount, totalVoted }: {
  forCount: number; againstCount: number; totalVoted: number;
}) {
  const t = useT();
  const forPct = totalVoted > 0 ? (forCount / totalVoted) * 50 : 0;
  const againstPct = totalVoted > 0 ? (againstCount / totalVoted) * 50 : 0;
  return (
    <div className="w-full px-0">
      <div className="relative h-7 bg-[#EDE7D8] rounded-full overflow-hidden border border-[#DDD4C0]">
        <div
          className="absolute right-1/2 top-0 bottom-0 bg-red-500/70 transition-all duration-300"
          style={{ width: `${againstPct}%` }}
        />
        <div
          className="absolute left-1/2 top-0 bottom-0 bg-green-500/70 transition-all duration-300"
          style={{ width: `${forPct}%` }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#9A8A78] -translate-x-px" />
      </div>
      <div className="flex justify-between mt-1.5 text-xs font-bold">
        <span className="text-red-400">{t('voting_against_bar').replace('{n}', String(againstCount))}</span>
        <span className="text-[#9A8A78] text-[10px] font-normal">{t('voting_voted_count').replace('{n}', String(totalVoted))}</span>
        <span className="text-green-400">{t('voting_for_bar').replace('{n}', String(forCount))}</span>
      </div>
    </div>
  );
}

function PieChart({ forVotes, against, abstain }: { forVotes: number; against: number; abstain: number }) {
  const total = forVotes + against + abstain;
  if (total === 0) return null;
  const cx = 60, cy = 60, r = 50;
  const slice = (startAngle: number, value: number, color: string) => {
    if (value === 0) return null;
    const pct = value / total;
    const angle = pct * 2 * Math.PI;
    const x1 = cx + r * Math.sin(startAngle);
    const y1 = cy - r * Math.cos(startAngle);
    const x2 = cx + r * Math.sin(startAngle + angle);
    const y2 = cy - r * Math.cos(startAngle + angle);
    const large = angle > Math.PI ? 1 : 0;
    return <path key={color} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`} fill={color} />;
  };
  const forAngle = (forVotes / total) * 2 * Math.PI;
  const againstAngle = (against / total) * 2 * Math.PI;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
      {slice(0, forVotes, '#4ade80')}
      {slice(forAngle, against, '#f87171')}
      {slice(forAngle + againstAngle, abstain, '#9A8A78')}
    </svg>
  );
}

function GavelLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#EDE7D8' }}>
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

export default function VotingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  // ── ALL hooks must be called before any early returns ──────────────────────
  const t = useT();
  const { language } = useLanguage();
  // Subscribe to the settings SLICE, not the getSettings selector: selecting the
  // (stable) function would never re-render this page when a rule changes, so the
  // inline rules console could not live-recompute the verdict.
  const settingsMap = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const { user, session, loading: authLoading } = useAuth();
  const [confAccess, setConfAccess] = useState<'checking' | 'standalone' | 'allowed' | 'denied' | 'signin'>('checking');
  const hydrateSettings = useSettingsStore((s) => s.hydrateSettings);
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // ── Standalone chair gate ──────────────────────────────────────────────────
  // This page ends debate, adjourns the committee, rewrites delegate statuses,
  // persists resolution results and hosts the whole SettingsPanel. It used to be
  // reachable by anyone who could read the six-character code off the header chip.
  // Standalone sessions now require the chair code — the same credential the join
  // page checks (`dbChairJoinSuffix`). Captured on the first render, before the
  // access-granted effect mirrors the DB value into the settings store.
  const [deviceChairProof] = useState(() => readChairDeviceProof(code));
  // ?chairName= read once, in the same first-render initializer, so the derived gate
  // below never touches `window` during render (this page has no Suspense boundary,
  // so useSearchParams() would break the prerender).
  const [urlChairName] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('chairName') ?? '',
  );
  const [chairCodeUnlocked, setChairCodeUnlocked] = useState(false);
  const [chairCodeInput, setChairCodeInput] = useState('');
  const [chairCodeError, setChairCodeError] = useState('');
  // Identity-implied settings seeded at load (UNSC → P5 veto) that still have to be
  // written back to the DB. Only flushed once access is granted.
  const settingsSeedRef = useRef<Partial<CommitteeSettings> | null>(null);

  // Conference-session access guard (#8). A conference session requires a signed-in
  // verified member of THIS committee's conference; a standalone session falls
  // through to the chair-code gate below.
  useEffect(() => {
    let cancelled = false;
    async function guard() {
      if (authLoading) return;
      const isConf = await detectConferenceSession(code);
      if (cancelled) return;
      if (!isConf) { setConfAccess('standalone'); return; }
      if (!session || !user) { setConfAccess('signin'); return; }
      const access = await verifyConferenceAccess(code, session.access_token, user.id);
      if (cancelled) return;
      setConfAccess(access.kind === 'chair' || access.kind === 'organizer' ? 'allowed' : 'denied');
    }
    setConfAccess('checking');
    guard();
    return () => { cancelled = true; };
  }, [code, authLoading, session?.access_token, user?.id]);

  // Standalone gate — DERIVED, not state. It is a pure function of the committee row
  // plus the credentials this device already held at first render, so there is no
  // window where it reads "allowed" before the committee has loaded.
  const chairGate: 'checking' | 'allowed' | 'locked' = (() => {
    if (confAccess !== 'standalone') return 'allowed';        // conference path owns its own gate
    if (loading) return 'checking';
    if (chairCodeUnlocked) return 'allowed';                  // chair code typed on this screen
    if (!committee) return 'allowed';                         // the "not found" screen owns this case
    const expected = (committee.dbChairJoinSuffix ?? '').trim();
    if (expected) return deviceChairProof.suffix === expected ? 'allowed' : 'locked';
    // Legacy committee with no chair code at all — there is no credential to check,
    // so fall back to the weaker device proof rather than locking its chairs out:
    // having been in this committee's chair view, or arriving with a ?chairName=
    // the committee itself knows.
    const knownName = !!urlChairName && committee.chairNames.includes(urlChairName);
    return deviceChairProof.chairName || knownName ? 'allowed' : 'locked';
  })();

  const accessGranted = confAccess === 'allowed' || (confAccess === 'standalone' && chairGate === 'allowed');

  // Post-access side effects. Deliberately NOT in the loader:
  //  • mirroring `chairJoinSuffix` into the settings store there would hand the gate
  //    its own answer on the next load (and is only needed so SettingsPanel does not
  //    mint a fresh suffix — SettingsPanel only renders once access is granted)
  //  • the identity-implied settings seed is a DB write, which must never fire for
  //    someone who has not proved they chair this committee
  useEffect(() => {
    if (!accessGranted || !committee) return;
    if (committee.dbChairJoinSuffix) {
      updateSetting(committee.code, 'chairJoinSuffix', committee.dbChairJoinSuffix);
    }
    const seed = settingsSeedRef.current;
    if (seed && Object.keys(seed).length > 0) {
      settingsSeedRef.current = null;
      // Read-merge write: it only ADDS the absent key, so it cannot disturb anything
      // the chair has already chosen.
      saveCommitteeSettings(committee.id, seed, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
  }, [accessGranted, committee?.id]);
  const [votes, setVotes] = useState<DelegateVote[]>([]);
  const [phase, setPhase] = useState<VotingPhase>('voting');
  const [currentVoterIndex, setCurrentVoterIndex] = useState(0);
  const [passedIds, setPassedIds] = useState<string[]>([]);
  const [rightsIndex, setRightsIndex] = useState(0);
  const [rightsSpeakerTime, setRightsSpeakerTime] = useState(60);
  const [rightsRunning, setRightsRunning] = useState(false);
  const rightsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [rollCallDone, setRollCallDone] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Local delegate statuses for roll call modal (mirrors committee.delegates)
  const [rollCallStatuses, setRollCallStatuses] = useState<Record<string, DelegateStatus>>({});
  const [rightsTimerLimit, setRightsTimerLimit] = useState(60);
  const [showEndDebateConfirm, setShowEndDebateConfirm] = useState(false);
  const [hideVotes, setHideVotes] = useState(false);
  const [orderedRights, setOrderedRights] = useState<DelegateVote[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const resultPersistedRef = useRef(false);

  useEffect(() => {
    async function load() {
      const found = await getCommitteeByCode(code);
      setCommittee(found ?? null);
      if (found) {
        // Defaults the committee's IDENTITY implies — today: a Security Council
        // starts with the P5 veto on. `impliedSettings` returns a key ONLY when it
        // is absent from the stored jsonb, so an explicit chair choice (including
        // deliberately switching the veto OFF) always wins and is never re-applied.
        const stored = (found.dbSettings ?? {}) as Record<string, unknown>;
        const implied = impliedSettings(found.name, stored);
        settingsSeedRef.current = Object.keys(implied).length > 0 ? implied : null;
        if (found.dbSettings) {
          // DB is the source of truth — apply the master chair's saved thresholds/veto/etc.
          //
          // `headChair` must NOT enter the store. Both write paths on this page
          // (`applyRule` below and SettingsPanel's `upd`) POST the WHOLE settings
          // object back, so a gavel holder captured at page load would silently
          // revert the gavel the moment another chair took it. Same for the
          // write-only `separateChairCode` marker. See AGENTS.md rule 12.
          // `chairJoinSuffix` is stripped here too — it is the credential the
          // standalone gate below checks against, and hydrating it would write the
          // DB answer into localStorage for anyone who merely opened this URL,
          // unlocking the gate on their next page load. The access-granted effect
          // above puts it back once the viewer has proved they chair this session.
          const { headChair: _hc, separateChairCode: _scc, chairJoinSuffix: _cjs, ...rest } = stored;
          void _hc; void _scc; void _cjs;
          // Key on found.code, not the URL param: getCommitteeByCode uppercases
          // before querying, and every read below goes through committee.code.
          // A lowercase URL would otherwise hydrate a key nothing ever reads.
          hydrateSettings(found.code, { ...(rest as Partial<CommitteeSettings>), ...implied });
        } else if (Object.keys(implied).length > 0) {
          hydrateSettings(found.code, implied);
        }
        // `chairJoinSuffix` DOES have to reach the store — it is the opposite case.
        // It is the only write credential (x-chair-suffix → is_session_chair) and
        // the code every chair typed on the join page. Leaving it out means the
        // store reads '' on any device that has no localStorage entry for this
        // committee (co-chair who arrived by link, fresh browser, incognito,
        // cleared cache); SettingsPanel's mount effect then MINTS A NEW RANDOM
        // SUFFIX and writes it to the DB, and `applyRule` writes '' back over the
        // real one — either way every chair holding the printed code is locked out.
        // It is written by the access-granted effect above rather than here, so the
        // standalone chair gate cannot be satisfied by this page's own write.
        const statuses: Record<string, DelegateStatus> = {};
        found.delegates.forEach((d) => { statuses[d.id] = d.status; });
        setRollCallStatuses(statuses);
      }
      setLoading(false);
    }
    load();
  }, [code]);

  useEffect(() => {
    if (committee) document.title = `${abbreviateCommitteeName(committee.name)}: Voting`;
    return () => { document.title = 'Gavelling'; };
  }, [committee?.name]);

  // Rights speaker countdown timer
  useEffect(() => {
    if (rightsRunning) {
      rightsTimerRef.current = setInterval(() => {
        setRightsSpeakerTime((prev) => {
          if (prev <= 1) { setRightsRunning(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (rightsTimerRef.current) { clearInterval(rightsTimerRef.current); rightsTimerRef.current = null; }
    }
    return () => { if (rightsTimerRef.current) { clearInterval(rightsTimerRef.current); rightsTimerRef.current = null; } };
  }, [rightsRunning]);

  // Reset rights timer when speaker index or limit changes
  useEffect(() => {
    setRightsSpeakerTime(rightsTimerLimit);
    setRightsRunning(false);
  }, [rightsIndex, rightsTimerLimit]);

  if (
    loading || authLoading || confAccess === 'checking' ||
    (confAccess === 'standalone' && chairGate === 'checking')
  ) {
    return <GavelLoader />;
  }

  if (confAccess === 'signin') {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1B3828' }}>Sign in to view this session</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>This is a conference session. Sign in to verify your access.</p>
          <Link href={'/auth/signin?next=' + encodeURIComponent('/join?code=' + code)} className="inline-block font-black text-white px-6 py-3 rounded-xl transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828' }}>SIGN IN</Link>
        </div>
      </div>
    );
  }

  if (confAccess === 'denied') {
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1B3828' }}>You don&apos;t chair this committee</h1>
          <p className="mb-6" style={{ color: '#6A5A4A' }}>The voting screen is part of the chair session. Only the committee&apos;s chair can open it.</p>
          <Link href="/sessions" className="inline-block font-black text-white px-6 py-3 rounded-xl transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828' }}>BACK TO HOME</Link>
        </div>
      </div>
    );
  }

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#F6F1E9] flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4"><Emoji size="2.5rem">🔍</Emoji></div>
          <h1 className="text-2xl font-bold text-[#1C1410] mb-2">Committee not found</h1>
          <p className="text-[#6A5A4A] mb-6">Code &ldquo;{code}&rdquo; is invalid or the session ended.</p>
          <Link href="/sessions" className="bg-[#1B3828] hover:bg-[#2A5A3C] text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // ── Standalone chair gate: prove the chair code before anything is writable ──
  if (confAccess === 'standalone' && chairGate !== 'allowed') {
    const expectedSuffix = (committee.dbChairJoinSuffix ?? '').trim();
    const submitChairCode = () => {
      const entered = chairCodeInput.trim();
      // Accept the full printed chair code ("UNSC26-4821") as well as the bare suffix.
      const bare = entered.includes('-') ? (entered.split('-').pop() ?? '').trim() : entered;
      if (!expectedSuffix || bare !== expectedSuffix) {
        setChairCodeError('Incorrect chair code. Ask your head chair.');
        return;
      }
      setChairCodeError('');
      setChairCodeUnlocked(true);
    };
    return (
      <div className="min-h-screen bg-[#EDE7D8] flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-3"><Emoji size="2.25rem">🪑</Emoji></div>
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1B3828' }}>Chairs only</h1>
          <p className="mb-6 text-sm leading-relaxed" style={{ color: '#6A5A4A' }}>
            The voting screen records resolution results, changes the committee&apos;s rules and can end
            debate. Enter the chair code for{' '}
            <span className="font-black" style={{ color: '#1B3828' }}>{committee.code}</span> to open it.
          </p>
          {expectedSuffix ? (
            <form
              onSubmit={(e) => { e.preventDefault(); submitChairCode(); }}
              className="space-y-3"
            >
              <input
                autoFocus
                inputMode="numeric"
                maxLength={24}
                value={chairCodeInput}
                onChange={(e) => { setChairCodeInput(e.target.value); setChairCodeError(''); }}
                placeholder="0000"
                aria-label="Chair code"
                className="w-full text-center rounded-xl px-4 py-3 font-black tracking-[0.4em] focus:outline-none"
                style={{
                  backgroundColor: '#FAF8F3',
                  border: `1.5px solid ${chairCodeError ? '#8B2020' : '#DDD4C0'}`,
                  color: '#1C1410',
                  fontFamily: "'DM Mono', monospace",
                }}
              />
              {chairCodeError && (
                <p className="text-xs font-semibold" style={{ color: '#8B2020' }}>{chairCodeError}</p>
              )}
              <button
                type="submit"
                className="w-full font-black text-white px-6 py-3 rounded-xl transition-colors focus:outline-none"
                style={{ backgroundColor: '#1B3828' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                OPEN VOTING
              </button>
            </form>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: '#6A5A4A' }}>
              This committee has no chair code. Open the voting screen from the chair session itself —
              Documents → Go to voting.
            </p>
          )}
          <Link
            href={`/join?code=${encodeURIComponent(committee.code)}&mode=chair`}
            className="inline-block mt-5 text-xs font-semibold underline"
            style={{ color: '#6A5A4A' }}
          >
            Re-join as chair
          </Link>
        </div>
      </div>
    );
  }

  // ── committee is guaranteed non-null and the viewer is a chair from here ────
  const settings: CommitteeSettings = { ...DEFAULT_SETTINGS, ...(settingsMap[committee.code] ?? {}) };

  const allDRs = (committee.documents ?? []).filter(
    (d) => d.type === 'draft-resolution' &&
      ['introduced', 'passed', 'failed'].includes(d.status)
  );
  const selectedDoc = allDRs.find((d) => d.id === selectedDocId) ?? null;
  // Use roll call statuses (local) if roll call is done, else use DB status
  const presentDelegates = committee.delegates
    .filter((d) => !d.isObserver && (rollCallDone ? rollCallStatuses[d.id] ?? d.status : d.status) !== 'absent')
    .sort((a, b) => compareCountryNames(a.country, b.country, language));

  const forCount = votes.filter((v) => v.choice === 'for' || v.choice === 'for-rights').length;
  const againstCount = votes.filter((v) => v.choice === 'against' || v.choice === 'against-rights').length;
  const abstainCount = votes.filter((v) => v.choice === 'abstain').length;
  const withRightsAll = votes
    .filter((v) => v.choice === 'for-rights' || v.choice === 'against-rights')
    .sort((a, b) => compareCountryNames(a.country, b.country, language));
  const withRights = withRightsAll.slice(0, 10);

  // Unanimous mode looks at every present delegate (P and PV)
  const presentAndPvDelegates = committee.delegates.filter(
    (d) => !d.isObserver && (rollCallStatuses[d.id] ?? d.status) !== 'absent'
  );
  const votableDelegates = committee.delegates.filter((d) => !d.isObserver);
  const tally = { forCount, againstCount, abstainCount };

  /** The veto seats in force under a given rule set. `custom` → the chair-picked
   *  list; `p5` → p5Delegations, falling back to the shipped P5 default. */
  const vetoListFor = (s: CommitteeSettings): string[] => {
    if (s.vetoMode === 'custom') return s.vetoCountries ?? [];
    if (s.vetoMode === 'p5') return s.p5Delegations?.length ? s.p5Delegations : DEFAULT_SETTINGS.p5Delegations;
    return [];
  };

  // ── Live outcome ───────────────────────────────────────────────────────────
  // One pure evaluation shared by the screen and the inline rules console, so
  // flipping a rule instantly moves the denominator, the required-to-pass number
  // and the verdict for the vote already in progress. `evaluate` is also called
  // with the *next* settings when a rule changes on the result screen.
  const evaluate = (s: CommitteeSettings) => {
    const vetoList = vetoListFor(s);
    // Matched by resolved country identity, NOT raw string equality. A roster
    // imported as "Russian Federation" / "United States of America" / "USA" / "UK"
    // used to match nothing here, so the veto never fired and a vetoed resolution
    // was recorded as PASSED with no warning anywhere. Entries that resolve to no
    // country (crisis cabinets, corporations) still match by exact name.
    const vetoBlocked = (s.vetoMode === 'p5' || s.vetoMode === 'custom')
      && vetoList.length > 0
      && votes.some((v) => (v.choice === 'against' || v.choice === 'against-rights')
        && isVetoDelegation(vetoList, v.country));
    // Unanimous: every present delegate must have voted 'for' or 'for-rights'
    const unanFail = s.vetoMode === 'unanimous' && presentAndPvDelegates.some((d) => {
      const vote = votes.find((v) => v.delegateId === d.id);
      return !vote || (vote.choice !== 'for' && vote.choice !== 'for-rights');
    });
    return {
      vetoBlocked,
      unanFail,
      outcome: computeVoteOutcome({
        tally,
        rules: s,
        presentCount: presentAndPvDelegates.length,
        totalCount: votableDelegates.length,
        vetoBlocked,
        unanimousFail: unanFail,
      }),
    };
  };

  const { vetoBlocked: p5Veto, unanFail: unanimousFail, outcome } = evaluate(settings);
  const totalDecisive = outcome.denominator;
  const thresholdMet = outcome.thresholdMet;
  const passed = outcome.passed;

  const persistResult = (docId: string, result: 'passed' | 'failed', force = false) => {
    if (resultPersistedRef.current && !force) return;
    resultPersistedRef.current = true;
    updateDocumentStatusInDB(docId, result, committee.code, committee.dbChairJoinSuffix ?? undefined);
    // Update local committee state so the DR list reflects the result immediately
    setCommittee((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.map((d) =>
          d.id === docId ? { ...d, status: result } : d
        ),
      };
    });
  };

  // ── Live rule changes from the inline console ──────────────────────────────
  // Same write path as SettingsPanel: the Zustand store (instant, this device)
  // AND the committees.settings jsonb, so every chair device that opens this
  // session computes the identical verdict. This page already treats the DB copy
  // as the source of truth on load (hydrateSettings in the loader above).
  const applyRule = <K extends keyof CommitteeSettings>(key: K, value: CommitteeSettings[K]) => {
    updateSetting(committee.code, key, value);
    const next: CommitteeSettings = { ...settings, [key]: value };
    // Never let the credential or the gavel ride along in the payload.
    // saveCommitteeSettings read-merges into the existing jsonb, so omitting a
    // key PRESERVES the DB's value. chairJoinSuffix is the chair password —
    // writing a stale/empty copy locks every chair out. headChair is the gavel —
    // writing a copy captured at page load reverts it to an earlier holder
    // (AGENTS.md rule 12/13). A localStorage entry persisted before this guard
    // existed can still carry either one, so strip on write as well as on load.
    const { chairJoinSuffix: _cjs, ...payload } =
      next as CommitteeSettings & { headChair?: string };
    void _cjs;
    delete (payload as { headChair?: string }).headChair;
    saveCommitteeSettings(committee.id, payload, committee.code, committee.dbChairJoinSuffix ?? undefined);
    // Result already on screen: the verdict can flip, so the DR's stored status
    // has to follow it rather than keeping the value from the first evaluation.
    if (phase === 'result' && selectedDoc) {
      const nextPassed = evaluate(next).outcome.passed;
      if (nextPassed !== passed) persistResult(selectedDoc.id, nextPassed ? 'passed' : 'failed', true);
    }
  };

  const rulesProps = {
    rules: settings,
    onChange: applyRule,
    vetoMode: settings.vetoMode,
    onVetoModeChange: (m: CommitteeSettings['vetoMode']) => applyRule('vetoMode', m),
    tally,
    outcome,
    votesCast: votes.length,
    eligible: presentDelegates.length,
    presentCount: presentAndPvDelegates.length,
    totalCount: votableDelegates.length,
    resultShown: phase === 'result',
    vetoBlocked: p5Veto,
    unanimousFail,
    // So the console can warn about veto seats that match NO delegation in the room
    // — a silent no-match is exactly how a missing veto used to hide.
    vetoEntries: vetoListFor(settings),
    delegationNames: votableDelegates.map((d) => d.country),
  };

  const startNewVote = (docId: string) => {
    setSelectedDocId(docId);
    setVotes([]);
    setPhase('voting');
    setCurrentVoterIndex(0);
    setRightsIndex(0);
    setOrderedRights([]);
    setPassedIds([]);
    resultPersistedRef.current = false;
  };

  const castVoteAndAdvance = (delegateId: string, country: string, choice: VoteChoice) => {
    setVotes((prev) => {
      const existing = prev.find((v) => v.delegateId === delegateId);
      if (existing) return prev.map((v) => v.delegateId === delegateId ? { ...v, choice } : v);
      return [...prev, { delegateId, country, choice }];
    });
    setCurrentVoterIndex((i) => i + 1);
  };

  const handlePass = (delegateId: string) => {
    setPassedIds(prev => [...prev, delegateId]);
    setCurrentVoterIndex(i => i + 1);
  };

  const handleFinishVoting = () => {
    if (withRights.length > 0) {
      setOrderedRights([...withRights]);
      setPhase('rights-speakers');
      setRightsIndex(0);
    } else {
      setPhase('result');
      if (selectedDoc) persistResult(selectedDoc.id, passed ? 'passed' : 'failed');
    }
  };

  const handleNextRightsSpeaker = () => {
    if (rightsIndex + 1 >= orderedRights.length) {
      setPhase('result');
      if (selectedDoc) persistResult(selectedDoc.id, passed ? 'passed' : 'failed');
    } else {
      setRightsIndex((i) => i + 1);
    }
  };

  const handleBackToSession = async () => {
    await setPhaseInDB(committee.id, 'speakers-list', committee.code, committee.dbChairJoinSuffix ?? undefined);
    // A chair's identity is ONLY ?chairName= — there is no session, cookie or DB row for it.
    // Dropping it here would make the session believe this device is the acting chair
    // (isViewOnly needs a non-empty name) and rename them to the literal 'Chair' in chat.
    // Read from window.location: this page has no Suspense boundary, so useSearchParams()
    // would fail the prerender, and this only ever runs in a click handler.
    const chairName = new URLSearchParams(window.location.search).get('chairName') ?? '';
    router.push(`/chair/${committee.code}${chairName ? `?chairName=${encodeURIComponent(chairName)}` : ''}`);
  };
  const handleEndDebate = async () => {
    await setPhaseInDB(committee.id, 'adjourned', committee.code, committee.dbChairJoinSuffix ?? undefined);
    router.push('/sessions');
  };

  // VotingHeader lives at module scope so it never remounts; the rules popover it
  // hosts therefore keeps its open state while votes are being cast.
  const headerProps = {
    committeeName: committee.name,
    onBack: handleBackToSession,
    onEndDebate: () => setShowEndDebateConfirm(true),
    onOpenSettings: () => setShowSettings(true),
    rules: <VotingRulesPopover {...rulesProps} />,
  };

  // ── Roll call modal (blocks until dismissed) ─────────────────────────────
  const cycleRollCallStatus = (id: string) => {
    setRollCallStatuses((prev) => {
      const cur = prev[id] ?? 'absent';
      const next: DelegateStatus = cur === 'absent' ? 'present' : cur === 'present' ? 'present-voting' : 'absent';
      setDelegateStatusInDB(id, next, committee.code, committee.dbChairJoinSuffix ?? undefined);
      return { ...prev, [id]: next };
    });
  };

  // ── Doc selection screen ──────────────────────────────────────────────────
  if (!selectedDoc) {
    return (
      <div className="min-h-screen bg-[#F6F1E9] flex flex-col">
        <VotingHeader {...headerProps} />
        {!rollCallDone && (
          <RollCallModal
            delegates={committee.delegates}
            rollCallStatuses={rollCallStatuses}
            onCycleStatus={cycleRollCallStatus}
            onConfirm={() => setRollCallDone(true)}
            side={
              <VotingRulesPanel
                {...rulesProps}
                className="hidden md:flex w-[336px] shrink-0"
                style={{ maxHeight: '85%', overflow: 'hidden' }}
              />
            }
          />
        )}
        {showSettings && <SettingsPanel committee={committee} onClose={() => setShowSettings(false)} />}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-3">
            <p className="text-xs font-mono text-[#9A8A78] text-center mb-5 tracking-widest">
              {t('voting_select_doc', { doc: docName(committee, 'draft-resolution', 'singular', t('documents_draft_resolution_type')).toUpperCase() })}
            </p>
            {allDRs.length === 0 ? (
              <p className="text-sm text-[#9A8A78] text-center py-8">
                {t('voting_no_introduced_docs', { doc: docName(committee, 'draft-resolution', 'plural', t('documents_type_dr')) })}
              </p>
            ) : (
              allDRs.map((doc) => {
                const isVoted = doc.status === 'passed' || doc.status === 'failed';
                return (
                  <button
                    key={doc.id}
                    onClick={() => !isVoted && startNewVote(doc.id)}
                    disabled={isVoted}
                    className={`w-full text-start px-4 py-4 rounded-xl border transition-colors ${
                      isVoted
                        ? 'border-[#DDD4C0] bg-[#F6F1E9] opacity-60 cursor-not-allowed'
                        : 'border-[#DDD4C0] bg-[#EDE7D8] text-[#6A5A4A] hover:border-[#1B3828]/60 hover:bg-[#1B3828]/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-mono font-bold text-[#1B3828]">{doc.docCode}</span>
                      {doc.status === 'passed' && (
                        <span className="text-[10px] font-bold text-green-400 bg-green-950/40 border border-green-800/40 px-2 py-0.5 rounded-full">✓ PASSED</span>
                      )}
                      {doc.status === 'failed' && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded-full">✗ FAILED</span>
                      )}
                    </div>
                    <span className="text-base font-bold text-[#1C1410] block">{doc.title}</span>
                    {doc.sponsors.length > 0 && (
                      <span className="text-xs text-[#9A8A78] block mt-1">{sponsorLabel(committee, t('voting_sponsors'))}: {doc.sponsors.join(', ')}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // Pass-round: derived, no extra state needed
  const mainRoundComplete = currentVoterIndex >= presentDelegates.length;
  const passVoterIndex = passedIds.filter(id => votes.some(v => v.delegateId === id)).length;
  const inPassRound = mainRoundComplete && passVoterIndex < passedIds.length;

  const currentDelegate = (() => {
    if (!mainRoundComplete) return presentDelegates[currentVoterIndex];
    if (inPassRound) {
      const nextId = passedIds[passVoterIndex];
      return committee.delegates.find(d => d.id === nextId) ?? null;
    }
    return null;
  })();

  const upcomingDelegates = (() => {
    if (!mainRoundComplete) return presentDelegates.slice(currentVoterIndex + 1, currentVoterIndex + 6);
    if (inPassRound) {
      return passedIds
        .slice(passVoterIndex + 1, passVoterIndex + 6)
        .map(id => committee.delegates.find(d => d.id === id)!)
        .filter(Boolean);
    }
    return [];
  })();

  return (
    <FitToScreen>
    <div className="h-full w-full bg-[#F6F1E9] flex flex-col overflow-hidden">
      <VotingHeader {...headerProps}>
        <span className="text-xs font-mono font-bold text-[#1B3828] bg-[#DDD4C0] px-2 py-0.5 rounded shrink-0">
          {selectedDoc.docCode}
        </span>
        <span className="text-sm font-bold text-[#1C1410] truncate hidden sm:block">{selectedDoc.title}</span>
        <span className="text-xs text-[#9A8A78] shrink-0">
          {votes.length}/{presentDelegates.length} voted
        </span>
        <button
          onClick={() => setSelectedDocId(null)}
          className="text-xs text-[#9A8A78] hover:text-[#6A5A4A] transition-colors shrink-0"
        >
          {t('voting_back_docs', { doc: docName(committee, 'draft-resolution', 'plural', t('documents_draft_resolutions_tab')) })}
        </button>
      </VotingHeader>

      {/* ── Active voting: one delegate at a time ── */}
      {phase === 'voting' && currentDelegate && (
        <div className="flex-1 flex flex-col items-center py-6 px-4 overflow-hidden">
          {inPassRound && (
            <div className="w-full max-w-3xl mb-2 flex items-center justify-center gap-2 py-1 px-3 rounded-xl"
              style={{ backgroundColor: 'rgba(182,135,31,0.15)', border: '1px solid rgba(182,135,31,0.35)' }}>
              <span className="text-[10px] font-black text-amber-400 font-mono tracking-widest">
                {t('voting_pass_round')}
              </span>
              <span className="text-[10px] text-[#9A8A78] font-mono">
                {t('voting_pass_round_sub')
                  .replace('{current}', String(passVoterIndex + 1))
                  .replace('{total}', String(passedIds.length))}
              </span>
            </div>
          )}
          {/* Current voter */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            <div className="select-none mb-3 flex items-center justify-center">
              {(() => {
                const f = getCountryByName(currentDelegate.country);
                const size = '220px';
                return f ? (
                  <div style={{ width: size, aspectRatio: '3 / 2', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 0 0 3.75px rgba(28,20,16,0.22)', flexShrink: 0 }}>
                    <img
                      src={getFlagUrl(f.code)}
                      alt={f.code}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div style={{ width: size, aspectRatio: '3 / 2', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 0 0 3.75px rgba(28,20,16,0.22)', flexShrink: 0, position: 'relative', backgroundColor: 'rgba(221,212,192,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Emoji size="5rem">🌐</Emoji>
                  </div>
                );
              })()}
            </div>
            <h1
              style={{ fontSize: '40px' }}
              className="font-black text-[#1C1410] text-center leading-tight mb-1"
            >
              {getCountryDisplayName(currentDelegate.country, language)}
            </h1>
            <p className="text-[#9A8A78] text-sm">
              {currentVoterIndex + 1} / {presentDelegates.length}
            </p>
          </div>

          {/* Vote buttons — wrap into a grid on small screens (up to 6 options
              won't fit a single non-wrapping row on a phone). */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex gap-3 w-full max-w-3xl mb-4">
            <button
              onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'for')}
              className="flex-1 bg-[#2A7A3C] hover:bg-[#3D8A52] border border-[#2A7A3C] text-white font-black text-base py-6 rounded-2xl transition-colors"
            >
              {t('voting_in_favour')}
            </button>
            <button
              onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'for-rights')}
              className="flex-1 bg-[#1B5C2E] hover:bg-[#2A7A3C] border border-[#3D7A52] text-[#EED98A] font-black text-sm py-6 rounded-2xl transition-colors leading-snug"
            >
              {t('voting_in_favour')}<br />{t('voting_with_rights_label')}
            </button>
            {settings.allowAbstentions && (
              (rollCallStatuses[currentDelegate.id] ?? currentDelegate.status) === 'present' ? (
                <button
                  onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'abstain')}
                  className="flex-1 bg-[#DDD4C0] hover:bg-[#C8BAA8] border border-[#C8BAA8] text-[#6A5A4A] font-black text-base py-6 rounded-2xl transition-colors"
                >
                  {t('voting_abstain')}
                </button>
              ) : (
                <button disabled className="flex-1 bg-[#EDE7D8] border border-[#DDD4C0] text-[#9A8A78] font-black text-base py-6 rounded-2xl opacity-40 cursor-not-allowed">
                  {t('voting_abstain_pv')}
                </button>
              )
            )}
            {!inPassRound && (
              <button
                onClick={() => handlePass(currentDelegate.id)}
                className="flex-1 bg-[#EDE7D8] hover:bg-[#DDD4C0] border border-[#DDD4C0] text-[#6A5A4A] font-black text-sm py-6 rounded-2xl transition-colors"
              >
                {t('voting_pass')}
              </button>
            )}
            <button
              onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'against-rights')}
              className="flex-1 bg-[#7A2020] hover:bg-[#8B3030] border border-[#7A2020] text-[#EED98A] font-black text-sm py-6 rounded-2xl transition-colors leading-snug"
            >
              {t('voting_against')}<br />{t('voting_with_rights_label')}
            </button>
            <button
              onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'against')}
              className="flex-1 bg-[#8B2020] hover:bg-[#A03030] border border-[#8B2020] text-white font-black text-base py-6 rounded-2xl transition-colors"
            >
              {t('voting_against')}
            </button>
          </div>

          {/* Scale */}
          <div className="mb-4 w-full max-w-3xl relative">
            <div className={hideVotes ? 'blur-sm select-none pointer-events-none' : ''}>
              <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />
            </div>
            <button
              onClick={() => setHideVotes((v) => !v)}
              title={hideVotes ? 'Show vote count' : 'Hide vote count'}
              className="absolute right-0 top-0 h-7 w-9 flex items-center justify-center rounded-r-full text-[#9A8A78] hover:text-[#1C1410] transition-colors focus:outline-none"
              style={{ backgroundColor: 'rgba(221,212,192,0.85)', borderLeft: '1px solid #DDD4C0' }}>
              {hideVotes ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

          {/* Upcoming voters — fixed height, invisible when empty so layout never shifts */}
          <div className={`mt-4 w-full max-w-2xl h-[110px] shrink-0 ${upcomingDelegates.length === 0 ? 'invisible' : ''}`}>
            <p className="text-[10px] text-[#9A8A78] font-mono text-center mb-2 tracking-widest">{t('voting_up_next')}</p>
            <div className="flex items-center justify-center gap-4 h-[80px]">
              {upcomingDelegates.map((d, i) => {
                const qf = getCountryByName(d.country);
                const qHeight = i === 0 ? 52 : Math.max(20, 38 - i * 5);
                const qWidth = Math.round(qHeight * 1.5);
                const qRadius = i === 0 ? 8 : 5;
                const qShadow = `0 0 0 ${i === 0 ? 2.5 : 1.5}px rgba(28,20,16,0.22)`;
                return (
                  <div key={d.id} className="flex flex-col items-center gap-1" style={{ opacity: Math.max(0.2, 1 - i * 0.18) }}>
                    {qf ? (
                      <div style={{ width: qWidth, height: qHeight, borderRadius: qRadius, overflow: 'hidden', boxShadow: qShadow, flexShrink: 0 }}>
                        <img src={getFlagUrl(qf.code)} alt={qf.code} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    ) : (
                      <div style={{ width: qWidth, height: qHeight, borderRadius: qRadius, overflow: 'hidden', boxShadow: qShadow, flexShrink: 0, position: 'relative', backgroundColor: 'rgba(221,212,192,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Emoji size={`${Math.round(qHeight * 0.65)}px`}>🌐</Emoji>
                      </div>
                    )}
                    <span className="text-[9px] text-[#9A8A78] text-center max-w-[52px] truncate">{getCountryDisplayName(d.country, language)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── All voted — proceed screen ── */}
      {phase === 'voting' && !currentDelegate && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <h2 className="text-4xl font-black text-[#1C1410]">
            {t('voting_all_voted').replace('{n}', String(presentDelegates.length))}
          </h2>
          <div className="flex gap-10 text-center">
            <div>
              <div className="text-4xl font-black text-green-400">{forCount}</div>
              <div className="text-[#6A5A4A] text-sm mt-1">{t('voting_for_label')}</div>
            </div>
            <div>
              <div className="text-4xl font-black text-red-400">{againstCount}</div>
              <div className="text-[#6A5A4A] text-sm mt-1">{t('voting_against_label')}</div>
            </div>
            {abstainCount > 0 && (
              <div>
                <div className="text-4xl font-black text-[#6A5A4A]">{abstainCount}</div>
                <div className="text-[#9A8A78] text-sm mt-1">{t('voting_abstain_label')}</div>
              </div>
            )}
            {withRights.length > 0 && (
              <div>
                <div className="text-4xl font-black text-amber-400">{withRights.length}</div>
                <div className="text-[#6A5A4A] text-sm mt-1">{t('voting_with_rights_label')}</div>
              </div>
            )}
          </div>
          <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />
          <p className="text-xs text-[#6A5A4A] tabular-nums -mt-2">
            {settings.substantiveThreshold === 'consensus'
              ? `${totalDecisive} counted · no votes against allowed`
              : `${totalDecisive} counted · ${outcome.needed} needed to pass`}
            {outcome.quorumNeeded > 0 && ` · quorum ${presentAndPvDelegates.length}/${outcome.quorumNeeded}`}
          </p>
          <button
            onClick={handleFinishVoting}
            className="bg-[#1B3828] hover:bg-[#2A5A3C] text-white px-12 py-4 rounded-2xl font-black text-lg transition-colors mt-2"
          >
            {withRights.length > 0
              ? t('voting_proceed_rights').replace('{n}', String(withRights.length))
              : t('voting_see_result')}
          </button>
        </div>
      )}

      {/* ── Rights speakers ── */}
      {phase === 'rights-speakers' && orderedRights.length > 0 && (
        <div className="flex-1 flex flex-col items-center justify-between py-8 px-8 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            <p className="text-xs text-amber-400 font-mono tracking-widest mb-6">
              {t('voting_rights_header').replace('{current}', String(rightsIndex + 1)).replace('{total}', String(orderedRights.length))}
            </p>
            <div className="select-none mb-3 flex items-center justify-center">
              {(() => {
                const f = getCountryByName(orderedRights[rightsIndex].country);
                const size = '196px';
                return f ? (
                  <div style={{ width: size, aspectRatio: '3 / 2', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 0 0 3.75px rgba(28,20,16,0.22)', flexShrink: 0 }}>
                    <img
                      src={getFlagUrl(f.code)}
                      alt={f.code}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div style={{ width: size, aspectRatio: '3 / 2', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 0 0 3.75px rgba(28,20,16,0.22)', flexShrink: 0, position: 'relative', backgroundColor: 'rgba(221,212,192,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Emoji size="5rem">🌐</Emoji>
                  </div>
                );
              })()}
            </div>
            <h1
              style={{ fontSize: '32px' }}
              className="font-black text-[#1C1410] text-center mb-2"
            >
              {getCountryDisplayName(orderedRights[rightsIndex].country, language)}
            </h1>
            <p className="text-amber-400 font-semibold">
              {orderedRights[rightsIndex].choice === 'for-rights' ? t('voting_rights_for') : t('voting_rights_against')}
            </p>
            {/* Rights speaker countdown timer */}
            <div className={`text-6xl font-black font-mono mt-4 tabular-nums ${rightsSpeakerTime <= 10 ? 'text-red-500' : rightsSpeakerTime <= 20 ? 'text-yellow-500' : 'text-[#1C1410]'}`}>
              {Math.floor(rightsSpeakerTime / 60)}:{String(rightsSpeakerTime % 60).padStart(2, '0')}
            </div>
            <div className="flex gap-2 mt-3 flex-wrap justify-center">
              <button
                onClick={() => setRightsRunning((r) => !r)}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${rightsRunning ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'}`}
              >
                {rightsRunning ? t('voting_pause') : t('voting_start')}
              </button>
              {[30, 45, 60, 90, 120].map((s) => (
                <button key={s} onClick={() => setRightsTimerLimit(s)}
                  className={`px-3 py-2.5 rounded-xl font-bold text-xs transition-colors ${rightsTimerLimit === s ? 'bg-[#1B3828] text-white' : 'bg-[#DDD4C0] text-[#6A5A4A] hover:bg-[#C8BAA8]'}`}>
                  {s}s
                </button>
              ))}
            </div>
          </div>

          <div className="w-full max-w-md space-y-1 mb-4 mt-6 overflow-y-auto" style={{ maxHeight: '220px' }}>
            {orderedRights.slice(rightsIndex).map((v, relIdx) => {
              const absIdx = rightsIndex + relIdx;
              const isCurrent = relIdx === 0;
              return (
                <div
                  key={v.delegateId}
                  draggable={!isCurrent}
                  onDragStart={() => { dragIndexRef.current = absIdx; }}
                  onDragOver={(e) => { if (!isCurrent) e.preventDefault(); }}
                  onDrop={() => {
                    const from = dragIndexRef.current;
                    if (from === null || from === absIdx || from <= rightsIndex || absIdx <= rightsIndex) return;
                    setOrderedRights((prev) => {
                      const arr = [...prev];
                      const [item] = arr.splice(from, 1);
                      arr.splice(absIdx, 0, item);
                      return arr;
                    });
                    dragIndexRef.current = null;
                  }}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${
                    isCurrent
                      ? 'bg-[#1B3828] border border-[#3D7A52] text-[#EED98A]'
                      : 'bg-[#FAF8F3] border border-[#DDD4C0] text-[#1C1410] opacity-80 cursor-grab'
                  }`}
                >
                  {!isCurrent && <span className="text-[#9A8A78] text-xs">⠿</span>}
                  <span className="text-xs w-5 font-mono text-end opacity-60">{absIdx + 1}</span>
                  <span>{getFlag(v.country)} {getCountryDisplayName(v.country, language)}</span>
                  <span className={`ms-auto text-xs font-semibold ${
                    isCurrent ? 'text-[#EED98A]' :
                    v.choice === 'for-rights' ? 'text-[#2A7A3C]' : 'text-[#8B2020]'
                  }`}>
                    {isCurrent ? t('voting_speaking') : v.choice === 'for-rights' ? t('voting_for_rights_list') : t('voting_against_rights_list')}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => { setRightsRunning(false); handleNextRightsSpeaker(); }}
            className="w-full max-w-md bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-4 rounded-2xl font-black text-lg transition-colors"
          >
            {rightsIndex + 1 < orderedRights.length ? t('voting_next_rights') : t('voting_see_result')}
          </button>
        </div>
      )}

      {/* ── Final result ── */}
      {phase === 'result' && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <p className="text-xs font-mono text-[#9A8A78] tracking-widest uppercase">
            {t('voting_final_result').replace('{code}', selectedDoc.docCode)}
          </p>

          {/* Main result bubble */}
          <div
            className="rounded-3xl px-16 py-12 text-center w-full max-w-xl"
            style={{
              backgroundColor: passed ? '#1B3828' : '#8B2020',
              boxShadow: passed
                ? '0 24px 64px rgba(27,56,40,0.30)'
                : '0 24px 64px rgba(139,32,32,0.30)',
            }}
          >
            <div className="text-6xl font-black mb-3" style={{ color: passed ? '#EED98A' : '#FFD0D0' }}>
              {passed ? t('voting_passed') : t('voting_failed')}
            </div>
            <p className="text-xl font-bold mb-6" style={{ color: passed ? 'rgba(238,217,138,0.75)' : 'rgba(255,208,208,0.75)' }}>
              {selectedDoc.title}
            </p>
            <div className="flex justify-center gap-10">
              <div className="text-center">
                <div className="text-4xl font-black" style={{ color: '#6EE7A0' }}>{forCount}</div>
                <div className="text-sm mt-1" style={{ color: passed ? 'rgba(238,217,138,0.6)' : 'rgba(255,208,208,0.6)' }}>{t('voting_for_label')}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black" style={{ color: '#FCA5A5' }}>{againstCount}</div>
                <div className="text-sm mt-1" style={{ color: passed ? 'rgba(238,217,138,0.6)' : 'rgba(255,208,208,0.6)' }}>{t('voting_against_label')}</div>
              </div>
              {abstainCount > 0 && (
                <div className="text-center">
                  <div className="text-4xl font-black" style={{ color: 'rgba(255,255,255,0.5)' }}>{abstainCount}</div>
                  <div className="text-sm mt-1" style={{ color: passed ? 'rgba(238,217,138,0.6)' : 'rgba(255,208,208,0.6)' }}>{t('voting_abstain_label')}</div>
                </div>
              )}
              {withRights.length > 0 && (
                <div className="text-center">
                  <div className="text-4xl font-black" style={{ color: '#FCD34D' }}>{withRights.length}</div>
                  <div className="text-sm mt-1" style={{ color: passed ? 'rgba(238,217,138,0.6)' : 'rgba(255,208,208,0.6)' }}>{t('voting_with_rights_label')}</div>
                </div>
              )}
            </div>
            {p5Veto && (
              <p className="text-sm mt-4 font-semibold flex items-center gap-1 justify-center" style={{ color: '#FCA5A5' }}>
                <Emoji size="1em">🛡️</Emoji> {t('voting_p5_veto')}
              </p>
            )}
            {unanimousFail && (
              <p className="text-sm mt-4 font-semibold" style={{ color: '#FCA5A5' }}>
                {t('voting_unanimous_fail')}
              </p>
            )}
            {!p5Veto && !unanimousFail && settings.substantiveThreshold === 'supermajority-2-3' && (
              <p className="text-sm mt-3 font-semibold" style={{ color: thresholdMet ? '#6EE7A0' : '#FCA5A5' }}>
                {t('voting_supermajority').replace('{for}', String(forCount)).replace('{total}', String(totalDecisive)).replace('{pct}', String(totalDecisive > 0 ? Math.round(forCount / totalDecisive * 100) : 0))}
              </p>
            )}
            {!p5Veto && !unanimousFail && settings.substantiveThreshold === 'consensus' && (
              <p className="text-sm mt-3 font-semibold" style={{ color: thresholdMet ? '#6EE7A0' : '#FCA5A5' }}>
                {t('voting_consensus').replace('{against}', String(againstCount))}
              </p>
            )}
            {!p5Veto && !unanimousFail && settings.substantiveThreshold === 'simple' && (
              <p className="text-sm mt-3 font-semibold tabular-nums" style={{ color: thresholdMet ? '#6EE7A0' : '#FCA5A5' }}>
                Simple majority · {forCount}/{totalDecisive} in favour, {outcome.needed} needed
              </p>
            )}
            {!outcome.quorumMet && (
              <p className="text-sm mt-3 font-semibold tabular-nums" style={{ color: '#FCA5A5' }}>
                Quorum not met · {presentAndPvDelegates.length} present, {outcome.quorumNeeded} required
              </p>
            )}
            {outcome.countsAbstentions && abstainCount > 0 && (
              <p className="text-xs mt-2" style={{ color: passed ? 'rgba(238,217,138,0.6)' : 'rgba(255,208,208,0.6)' }}>
                Abstentions counted toward the total
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-6">
            <PieChart forVotes={forCount} against={againstCount} abstain={abstainCount} />
            <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => startNewVote(selectedDoc.id)}
              className="py-3 px-6 rounded-xl font-bold transition-colors"
              style={{ backgroundColor: '#DDD4C0', color: '#1B3828', border: '1.5px solid #C8BAA8' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#C8BAA8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#DDD4C0'; }}
            >
              {t('voting_vote_again')}
            </button>
            <button
              onClick={() => setSelectedDocId(null)}
              className="py-3 px-6 rounded-xl font-black transition-colors"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', boxShadow: '0 4px 16px rgba(27,56,40,0.25)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {t('voting_next_doc', { doc: docName(committee, 'draft-resolution', 'singular', t('documents_draft_resolution')) })}
            </button>
            <button
              onClick={() => setShowEndDebateConfirm(true)}
              className="py-3 px-6 rounded-xl font-bold transition-colors"
              style={{ backgroundColor: '#8B2020', color: 'white', border: '1.5px solid #A03030' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#A03030'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}
            >
              {t('voting_end_debate')}
            </button>
          </div>
        </div>
      )}
      {showSettings && <SettingsPanel committee={committee} onClose={() => setShowSettings(false)} />}

      {/* ── End Debate confirmation modal ── */}
      {showEndDebateConfirm && (
        <Portal><div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(5,4,3,0.80)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowEndDebateConfirm(false)}
        >
          <div
            className="rounded-2xl w-full max-w-sm mx-4 shadow-2xl flex flex-col overflow-hidden"
            style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #EDE7D8' }}>
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl"
                  style={{ backgroundColor: '#8B2020' }}
                >
                  🔨
                </div>
                <h2 className="text-lg font-black text-[#1C1410]">{t('voting_end_debate_title')}</h2>
              </div>
              <p className="text-sm text-[#6A5A4A] leading-relaxed mt-2">
                {t('voting_end_debate_body')}
              </p>
            </div>
            {/* Buttons */}
            <div className="px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowEndDebateConfirm(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors"
                style={{ backgroundColor: '#EDE7D8', color: '#1C1410', border: '1.5px solid #DDD4C0' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#DDD4C0'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
              >
                {t('voting_cancel')}
              </button>
              <button
                onClick={() => { setShowEndDebateConfirm(false); handleEndDebate(); }}
                className="flex-1 py-3 rounded-xl font-black text-sm transition-colors"
                style={{ backgroundColor: '#8B2020', color: 'white' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#A03030'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}
              >
                {t('voting_confirm_end')}
              </button>
            </div>
          </div>
        </div></Portal>
      )}
    </div>
    </FitToScreen>
  );
}