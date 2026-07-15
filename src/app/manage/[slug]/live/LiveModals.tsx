'use client';

import { X, Mic, FileText, ScrollText, Users, Gavel, Trophy, MessageSquareText, ExternalLink } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';
import { LogoDisc } from '@/components/LogoDisc';
import { getCountryByName } from '@/lib/countries';
import Portal from '@/components/Portal';
import {
  NeuInset, NeuIconDisc, NEU, NEU_GRADIENTS, type NeuGradient, OUTFIT, EASE,
} from '@/components/neu';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

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
    logoUrl: string | null;
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
      style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.08em' }}
    >
      {children}
    </p>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Portal'd so the dim backdrop escapes the manage layout's `relative z-10`
  // content wrapper and covers the header/sidebar too.
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
        style={{ backgroundColor: 'rgba(27,20,16,0.42)' }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl rounded-[22px] p-8 relative overflow-y-auto"
          style={{ backgroundColor: NEU.surface, boxShadow: NEU.out, maxHeight: 'calc(100vh - 64px)', fontFamily: OUTFIT }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 inline-flex items-center justify-center rounded-full focus:outline-none"
            style={{ width: 32, height: 32, color: NEU.muted, backgroundColor: NEU.surface, boxShadow: NEU.outSm, transition: `box-shadow 200ms ${EASE}`, cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; (e.currentTarget as HTMLElement).style.color = NEU.ink; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
          {children}
        </div>
      </div>
    </Portal>
  );
}

function StatTile({ icon: Icon, emoji, gradient, value, label }: { icon: LucideIcon; emoji: string; gradient: NeuGradient; value: string; label: string }) {
  return (
    <NeuInset className="flex items-center gap-3" style={{ padding: '13px 14px', borderRadius: 14 }}>
      <NeuIconDisc gradient={gradient} emoji={emoji} icon={Icon} size={36} />
      <div className="min-w-0">
        <p className="font-black text-xl leading-none" style={{ color: NEU.ink, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        <p className="text-[11px] font-medium mt-1 truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{label}</p>
      </div>
    </NeuInset>
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
      <div className="flex items-center gap-3.5 mb-1">
        <LogoDisc src={data.conf.logoUrl} size={48} fallbackText={(data.conf.abbreviation ?? data.conf.name).slice(0, 3)} alt={data.conf.abbreviation ?? data.conf.name} />
        <div className="min-w-0">
          <Eyebrow>Session recap</Eyebrow>
          <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
            <h2 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1 }}>
              {data.conf.abbreviation ?? data.conf.name}
            </h2>
            <span
              className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase"
              style={{ backgroundColor: NEU.surface, color: NEU.forest, boxShadow: NEU.outSm, fontFamily: OUTFIT, letterSpacing: '0.08em' }}
            >
              {phaseLabel}
            </span>
          </div>
        </div>
      </div>
      {data.conf.abbreviation && data.conf.abbreviation !== data.conf.name && (
        <p className="text-sm mb-5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{data.conf.name}</p>
      )}
      {(!data.conf.abbreviation || data.conf.abbreviation === data.conf.name) && <div className="mb-5" />}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatTile icon={Mic} emoji="Studio microphone" gradient={NEU_GRADIENTS.forest} value={String(speeches)} label="Speeches given" />
        <StatTile icon={Gavel} emoji="Ballot box with ballot" gradient={NEU_GRADIENTS.gold} value={String(motionsPending)} label="Motions pending" />
        <StatTile icon={Users} emoji="Person raising hand" gradient={NEU_GRADIENTS.sage} value={`${present}/${data.delegates.length}`} label="Delegates present" />
        <StatTile icon={FileText} emoji="Page facing up" gradient={NEU_GRADIENTS.green} value={String(wps)} label="Working papers" />
        <StatTile icon={ScrollText} emoji="Scroll" gradient={NEU_GRADIENTS.amber} value={String(drs)} label="Draft resolutions" />
      </div>
      <p className="text-[11px] -mt-4 mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
        Motions count reflects pending motions only. Total motions raised isn&apos;t persisted.
      </p>

      {/* Points */}
      {scores.length > 0 && (
        <div className="mb-6">
          <Eyebrow>Points</Eyebrow>
          <div className="mt-2 flex flex-col gap-2">
            {[{ label: 'Top delegate', row: top }, ...(quietest ? [{ label: 'Quietest delegate', row: quietest }] : [])].map((entry) => (
              <NeuInset
                key={entry.label}
                className="flex items-center gap-3"
                style={{ padding: '11px 14px', borderRadius: 14 }}
              >
                <span className="text-[11px] font-bold uppercase flex-shrink-0" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.08em', width: 130 }}>
                  {entry.label}
                </span>
                <FlagImg code={flagCodeFor(entry.row.country)} size={20} />
                <span className="text-sm font-bold flex-1 truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{entry.row.country}</span>
                <span className="text-sm font-black" style={{ color: NEU.forest, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                  {entry.row.total} pts
                </span>
              </NeuInset>
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
            style={{ backgroundColor: 'rgba(238,217,138,0.25)', color: NEU.deepGold, boxShadow: NEU.outSm, fontFamily: OUTFIT }}
          >
            Feedback format changes on the production branch (placeholder)
          </span>
        </div>
        {feedbackCountries.length === 0 ? (
          <p className="text-sm mt-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No chair feedback recorded yet.</p>
        ) : (
          <div className="mt-2 space-y-2.5">
            {feedbackCountries.map((country) => (
              <NeuInset key={country} className="px-4 py-3" style={{ borderRadius: 14 }}>
                <div className="flex items-center gap-2 mb-1">
                  <FlagImg code={flagCodeFor(country)} size={16} />
                  <span className="text-sm font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{country}</span>
                </div>
                {feedbackByCountry[country].slice(0, 3).map((f, i) => (
                  <p key={i} className="text-xs flex items-start gap-1.5 mt-0.5" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                    <MessageSquareText size={12} style={{ flexShrink: 0, marginTop: 2, color: NEU.muted }} />
                    <span>
                      <span className="font-bold">{f.chairName}:</span>{' '}
                      {f.content.length > 110 ? f.content.slice(0, 110) + '…' : f.content}
                    </span>
                  </p>
                ))}
                {feedbackByCountry[country].length > 3 && (
                  <p className="text-[11px] mt-1" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                    +{feedbackByCountry[country].length - 3} more
                  </p>
                )}
              </NeuInset>
            ))}
          </div>
        )}
      </div>

      {/* Join as secretariat */}
      {session && (
        <div>
          <button
            onClick={joinAsSecretariat}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3 font-bold text-sm tracking-widest focus:outline-none"
            style={{
              background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
              color: NEU.gold, fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', cursor: 'pointer',
              boxShadow: `0 4px 10px ${NEU_GRADIENTS.forest[0]}4D, ${NEU.outSm}`,
              transition: `box-shadow 220ms ${EASE}, transform 220ms ${EASE}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 16px ${NEU_GRADIENTS.forest[0]}66, ${NEU.outSmHover}`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 10px ${NEU_GRADIENTS.forest[0]}4D, ${NEU.outSm}`; }}
          >
            JOIN AS SECRETARIAT
            <ExternalLink size={14} />
          </button>
          <p className="text-[11px] text-center mt-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
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
  const rows: { label: string; emoji: string }[] = [
    { label: 'Best Delegate', emoji: '1st place medal' },
    { label: 'Outstanding Delegate', emoji: '2nd place medal' },
    { label: 'Honourable Mention', emoji: '3rd place medal' },
  ];
  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3.5 mb-1">
        <LogoDisc src={data.conf.logoUrl} size={48} fallbackText={(data.conf.abbreviation ?? data.conf.name).slice(0, 3)} alt={data.conf.abbreviation ?? data.conf.name} />
        <div className="min-w-0">
          <Eyebrow>Awards board</Eyebrow>
          <h2 className="font-black mt-0.5" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1 }}>
            {data.conf.abbreviation ?? data.conf.name}
          </h2>
        </div>
      </div>
      <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
        Award allocation arrives with the production merge.
      </p>

      <div className="flex flex-col gap-2.5 mb-5">
        {rows.map((r) => (
          <NeuInset
            key={r.label}
            className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderRadius: 14 }}
          >
            <NeuIconDisc gradient={NEU_GRADIENTS.gold} emoji={r.emoji} icon={Trophy} size={36} />
            <span className="text-sm font-bold flex-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{r.label}</span>
            <span className="text-sm font-bold" style={{ color: NEU.muted, fontFamily: OUTFIT }}>—</span>
          </NeuInset>
        ))}
      </div>

      <p className="text-[11px]" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
        Chairs will allocate awards from their console once the award feature ships; allocations will appear here automatically.
      </p>
    </ModalShell>
  );
}
