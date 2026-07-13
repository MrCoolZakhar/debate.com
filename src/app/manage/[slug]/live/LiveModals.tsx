'use client';

import { X, Mic, FileText, ScrollText, Users, Gavel, Trophy, MessageSquareText, ExternalLink } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByName } from '@/lib/countries';

const OUTFIT = "'Outfit', sans-serif";

// ── Shared types (page.tsx imports these, page files can't export extras) ──

export interface CaucusJson {
  active?: boolean;
  type?: 'moderated' | 'unmoderated';
  motionLabel?: string;
  purpose?: string;
  totalTime?: number;
  remainingTime?: number;
  speakingTime?: number;
  currentSpeaker?: string | null;
}

export interface LiveCommittee {
  conf: {
    id: string;
    name: string;
    abbreviation: string | null;
    topics: string[] | null;
    totalSlots: number;
    sessionId: string | null;
    sessionCode: string | null;
    chairUserIds: string[];
  };
  session: {
    id: string;
    code: string;
    name: string;
    phase: string;
    caucus: CaucusJson | null;
    chairNames: string[];
    suspendedAt: string | null;
    endedAt: string | null;
  } | null;
  currentSpeaker: { country: string | null; timeRemaining: number; startedAt: string | null } | null;
  delegates: { country: string; status: string }[];
  gslQueue: string[];
  caucusQueue: string[];
  pendingMotions: { type: string; topic: string }[];
  documents: { type: string; status: string; docCode: string; sponsors: string[] }[];
  speechLogs: { country: string; seconds: number; context: string; topic: string }[];
  feedback: { country: string; chairName: string; content: string; createdAt: string }[];
}

export type CardStatus = 'no-session' | 'not-started' | 'live' | 'suspended' | 'ended';

export function cardStatus(lc: LiveCommittee): CardStatus {
  if (!lc.session) return 'no-session';
  if (lc.session.endedAt) return 'ended';
  if (lc.session.phase === 'adjourned') return 'suspended';
  if (lc.session.phase === 'pre-session' || lc.session.phase === 'roll-call') return 'not-started';
  return 'live';
}

export const PHASE_LABELS: Record<string, string> = {
  'pre-session': 'Pre-session',
  'roll-call': 'Roll Call',
  'speakers-list': "General Speakers' List",
  'moderated-caucus': 'Moderated Caucus',
  'unmoderated-caucus': 'Unmoderated Caucus',
  'voting': 'Voting Procedure',
  'adjourned': 'Adjourned',
};

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function flagCodeFor(name: string): string {
  return getCountryByName(name)?.code ?? '';
}

// Score formula replicated from SettingsPanel.tsx computeScore:
// attendance 5 if not absent; WP sponsor ×10; DR sponsor ×20;
// speaking floor(totalSeconds/10); GSL speeches ×10; caucus speeches ×8.
export function computeScores(lc: LiveCommittee): { country: string; total: number }[] {
  return lc.delegates.map((d) => {
    const attendancePoints = d.status !== 'absent' ? 5 : 0;
    const wpPoints = lc.documents.filter((doc) => doc.type === 'working-paper' && doc.sponsors.includes(d.country)).length * 10;
    const drPoints = lc.documents.filter((doc) => doc.type === 'draft-resolution' && doc.sponsors.includes(d.country)).length * 20;
    const logs = lc.speechLogs.filter((e) => e.country === d.country);
    const speakingPoints = Math.floor(logs.reduce((sum, e) => sum + (e.seconds || 0), 0) / 10);
    const gslPoints = logs.filter((e) => e.context === 'speakers-list').length * 10;
    const caucusPoints = logs.filter((e) => e.context === 'moderated-caucus' || e.context === 'unmoderated-caucus' || e.context === 'tour-de-table').length * 8;
    return { country: d.country, total: attendancePoints + wpPoints + drPoints + speakingPoints + gslPoints + caucusPoints };
  });
}

// ── Small shared bits ───────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-bold uppercase"
      style={{ color: '#9A8A78', fontFamily: OUTFIT, letterSpacing: '0.08em' }}
    >
      {children}
    </p>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-8 relative overflow-y-auto"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: 'calc(100vh - 64px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 focus:outline-none transition-colors"
          style={{ color: '#9A8A78' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          aria-label="Close"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, value, label }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; value: string; label: string }) {
  return (
    <div
      className="p-3.5 rounded-xl flex items-center gap-3"
      style={{ backgroundColor: 'rgba(250,248,243,0.7)', border: '1px solid #DDD4C0' }}
    >
      <span className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(27,56,40,0.07)' }}>
        <Icon size={15} style={{ color: '#1B3828' }} />
      </span>
      <div className="min-w-0">
        <p className="font-black text-xl leading-none" style={{ color: '#1C1410', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        <p className="text-[11px] font-medium mt-1 truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{label}</p>
      </div>
    </div>
  );
}

// ── Recap modal ─────────────────────────────────────────────────────────────

export function RecapModal({ data, onClose }: { data: LiveCommittee; onClose: () => void }) {
  const session = data.session;
  const phaseLabel = session ? (PHASE_LABELS[session.phase] ?? session.phase) : 'No session';

  const speeches = data.speechLogs.length;
  const motionsPending = data.pendingMotions.length;
  const wps = data.documents.filter((d) => d.type === 'working-paper').length;
  const drs = data.documents.filter((d) => d.type === 'draft-resolution').length;
  const present = data.delegates.filter((d) => d.status !== 'absent').length;

  const scores = computeScores(data).sort((a, b) => b.total - a.total);
  const top = scores[0];
  const quietest = scores.length > 1 ? scores[scores.length - 1] : undefined;

  const feedbackByCountry: Record<string, { chairName: string; content: string }[]> = {};
  for (const f of data.feedback) {
    if (!feedbackByCountry[f.country]) feedbackByCountry[f.country] = [];
    feedbackByCountry[f.country].push({ chairName: f.chairName, content: f.content });
  }
  const feedbackCountries = Object.keys(feedbackByCountry).sort();

  function joinAsSecretariat() {
    if (!session) return;
    // TODO(merge): route to dedicated secretariat/co-chair mode once merged with production branch
    window.open(`/chair/${session.code}?chairName=Secretariat`, '_blank');
  }

  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <Eyebrow>Session recap</Eyebrow>
      <div className="flex items-center gap-3 mt-1 mb-1 flex-wrap">
        <h2 className="font-black" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1 }}>
          {data.conf.abbreviation ?? data.conf.name}
        </h2>
        <span
          className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase"
          style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828', border: '1px solid rgba(27,56,40,0.2)', fontFamily: OUTFIT, letterSpacing: '0.08em' }}
        >
          {phaseLabel}
        </span>
      </div>
      <p className="text-sm mb-5" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>{data.conf.name}</p>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatTile icon={Mic} value={String(speeches)} label="Speeches given" />
        <StatTile icon={Gavel} value={String(motionsPending)} label="Motions pending" />
        <StatTile icon={Users} value={`${present}/${data.delegates.length}`} label="Delegates present" />
        <StatTile icon={FileText} value={String(wps)} label="Working papers" />
        <StatTile icon={ScrollText} value={String(drs)} label="Draft resolutions" />
      </div>
      <p className="text-[11px] -mt-4 mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Motions count reflects pending motions only. Total motions raised isn&apos;t persisted.
      </p>

      {/* Points */}
      {scores.length > 0 && (
        <div className="mb-6">
          <Eyebrow>Points</Eyebrow>
          <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid #DDD4C0' }}>
            {[{ label: 'Top delegate', row: top }, ...(quietest ? [{ label: 'Quietest delegate', row: quietest }] : [])].map((entry, i) => (
              <div
                key={entry.label}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? '1px solid rgba(221,212,192,0.55)' : 'none', backgroundColor: '#FAF8F3' }}
              >
                <span className="text-[11px] font-bold uppercase flex-shrink-0" style={{ color: '#9A8A78', fontFamily: OUTFIT, letterSpacing: '0.08em', width: 130 }}>
                  {entry.label}
                </span>
                <FlagImg code={flagCodeFor(entry.row.country)} size={20} />
                <span className="text-sm font-bold flex-1 truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{entry.row.country}</span>
                <span className="text-sm font-black" style={{ color: '#1B3828', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                  {entry.row.total} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chair feedback recap */}
      {/* TODO(merge): feedback shape changes on main branch, swap this recap to the new format */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Eyebrow>Chair feedback</Eyebrow>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(238,217,138,0.25)', color: '#B6871F', border: '1px solid rgba(182,135,31,0.35)', fontFamily: OUTFIT }}
          >
            Feedback format changes on the production branch (placeholder)
          </span>
        </div>
        {feedbackCountries.length === 0 ? (
          <p className="text-sm mt-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No chair feedback recorded yet.</p>
        ) : (
          <div className="mt-2 space-y-2.5">
            {feedbackCountries.map((country) => (
              <div key={country} className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(27,56,40,0.04)', border: '1px solid rgba(221,212,192,0.7)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <FlagImg code={flagCodeFor(country)} size={16} />
                  <span className="text-sm font-bold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{country}</span>
                </div>
                {feedbackByCountry[country].slice(0, 3).map((f, i) => (
                  <p key={i} className="text-xs flex items-start gap-1.5 mt-0.5" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>
                    <MessageSquareText size={12} style={{ flexShrink: 0, marginTop: 2, color: '#9A8A78' }} />
                    <span>
                      <span className="font-bold">{f.chairName}:</span>{' '}
                      {f.content.length > 110 ? f.content.slice(0, 110) + '…' : f.content}
                    </span>
                  </p>
                ))}
                {feedbackByCountry[country].length > 3 && (
                  <p className="text-[11px] mt-1" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                    +{feedbackByCountry[country].length - 3} more
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Join as secretariat */}
      {session && (
        <div>
          <button
            onClick={joinAsSecretariat}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.06em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            JOIN AS SECRETARIAT
            <ExternalLink size={14} />
          </button>
          <p className="text-[11px] text-center mt-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Opens the chair console (co-chair view after production merge)
          </p>
        </div>
      )}
    </ModalShell>
  );
}

// ── Awards board modal (placeholder) ────────────────────────────────────────

export function AwardsModal({ data, onClose }: { data: LiveCommittee; onClose: () => void }) {
  // TODO(merge): wire to chair award allocation from production branch
  const rows = ['Best Delegate', 'Outstanding Delegate', 'Honourable Mention'];
  return (
    <ModalShell onClose={onClose}>
      <Eyebrow>Awards board</Eyebrow>
      <h2 className="font-black mt-1 mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1 }}>
        {data.conf.abbreviation ?? data.conf.name}
      </h2>
      <p className="text-sm mb-6" style={{ color: '#6B5F52', fontFamily: OUTFIT }}>
        Award allocation arrives with the production merge.
      </p>

      <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid #DDD4C0' }}>
        {rows.map((label, i) => (
          <div
            key={label}
            className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderTop: i > 0 ? '1px solid rgba(221,212,192,0.55)' : 'none', backgroundColor: '#FAF8F3' }}
          >
            <span className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(238,217,138,0.28)' }}>
              <Trophy size={15} style={{ color: '#B6871F' }} />
            </span>
            <span className="text-sm font-bold flex-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{label}</span>
            <span className="text-sm font-bold" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>—</span>
          </div>
        ))}
      </div>

      <p className="text-[11px]" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Chairs will allocate awards from their console once the award feature ships; allocations will appear here automatically.
      </p>
    </ModalShell>
  );
}
