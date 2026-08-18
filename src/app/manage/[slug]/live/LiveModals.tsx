'use client';

import { useState } from 'react';
import { X, Mic, FileText, ScrollText, Users, Gavel, Trophy, MessageSquareText, ExternalLink, ChevronDown, Timer, Clock, CheckCircle2 } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';
import { LogoDisc } from '@/components/LogoDisc';
import { getCountryByName } from '@/lib/countries';
import Portal from '@/components/Portal';
import Avatar from '@/components/Avatar';
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
  /** Wall-clock anchor for the total caucus countdown; null = paused.
   *  `remainingTime` is the value AT this instant — see caucusRemainingNow(). */
  totalStartedAt?: string | null;
  spokenCountries?: string[];
  isConsultation?: boolean;
}

/** A chair on the dais, resolved to a Gavelling profile where one exists.
 *  `id` is null for a hand-seeded display_chairs entry with no account. */
export interface ChairPerson {
  id: string | null;
  name: string;
  avatarUrl: string | null;
}

/** One `feedback` row. All five extra columns beyond the original
 *  country/chair/content triple are real: `level` ('speech' today), the
 *  per-factor ratings blob, and the speech the note was attached to. */
export interface FeedbackEntry {
  country: string;
  chairName: string;
  content: string;
  createdAt: string;
  level: string;
  factorScores: Record<string, number>;
  speechContext: string | null;
  speechSeconds: number | null;
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
    /** chair_user_ids resolved against profiles, falling back to the
     *  trigger-maintained display_chairs entry at the same index. */
    chairs: ChairPerson[];
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
    /** Enabled ranking factors + scale from committees.settings.scoring, so
     *  feedback ratings can be labelled with the chair's own factor names. */
    scoringFactors: { id: string; name: string }[];
    factorScaleMax: number;
  } | null;
  currentSpeaker: { country: string | null; timeRemaining: number; startedAt: string | null } | null;
  delegates: { country: string; status: string }[];
  gslQueue: string[];
  caucusQueue: string[];
  pendingMotions: { type: string; topic: string }[];
  documents: { type: string; status: string; docCode: string; title: string; sponsors: string[] }[];
  speechLogs: { country: string; seconds: number; context: string; topic: string }[];
  feedback: FeedbackEntry[];
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

// ── Chair feedback ──────────────────────────────────────────────────────────

/** Short relative age, e.g. "just now", "12m ago", "2h ago", "3 Sep". */
function timeAgo(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The label a chair's own console shows for the speech a note hangs off. */
function contextLabel(context: string | null): string | null {
  if (!context) return null;
  if (context === 'speakers-list') return 'GSL';
  if (context === 'unmoderated-caucus') return 'UNMOD';
  if (context === 'moderated-caucus') return 'CAUCUS';
  if (context === 'tour-de-table') return 'TOUR';
  return context.toUpperCase();
}

interface CountryFeedback {
  country: string;
  entries: FeedbackEntry[];
  notes: FeedbackEntry[];
  /** Mean rating per factor id — only over rows that actually carry that factor. */
  factorAvg: Record<string, number>;
  /** Mean across every rating this delegation has received, or null if unrated. */
  headline: number | null;
  latest: number;
}

/** Fold the raw `feedback` rows into one block per delegation. A chair rates a
 *  speech factor-by-factor and may leave the note empty (in practice most rows
 *  are ratings with no prose), so ratings and notes are surfaced separately
 *  instead of a note list that would render mostly blank. */
export function foldFeedback(rows: FeedbackEntry[]): CountryFeedback[] {
  const byCountry = new Map<string, FeedbackEntry[]>();
  for (const f of rows) {
    const list = byCountry.get(f.country);
    if (list) list.push(f);
    else byCountry.set(f.country, [f]);
  }
  const out: CountryFeedback[] = [];
  for (const [country, entries] of byCountry) {
    const sums: Record<string, { total: number; n: number }> = {};
    let all = 0;
    let allN = 0;
    for (const e of entries) {
      for (const [fid, raw] of Object.entries(e.factorScores ?? {})) {
        const v = Number(raw);
        if (!Number.isFinite(v)) continue;
        const cur = sums[fid] ?? { total: 0, n: 0 };
        cur.total += v;
        cur.n += 1;
        sums[fid] = cur;
        all += v;
        allN += 1;
      }
    }
    const factorAvg: Record<string, number> = {};
    for (const [fid, s] of Object.entries(sums)) factorAvg[fid] = s.total / s.n;
    out.push({
      country,
      entries,
      notes: entries.filter((e) => e.content.trim().length > 0).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
      factorAvg,
      headline: allN > 0 ? all / allN : null,
      latest: entries.reduce((max, e) => Math.max(max, Date.parse(e.createdAt) || 0), 0),
    });
  }
  // Most recently touched delegation first — an organiser scanning mid-session
  // wants what the dais just wrote, not the alphabet.
  return out.sort((a, b) => b.latest - a.latest || a.country.localeCompare(b.country));
}

function FeedbackEmpty({ committeeLabel }: { committeeLabel: string }) {
  return (
    <NeuInset className="flex items-start gap-3.5 mt-2" style={{ padding: '18px 18px', borderRadius: 16 }}>
      <NeuIconDisc gradient={NEU_GRADIENTS.sage} emoji="Memo" icon={MessageSquareText} size={40} />
      <div className="min-w-0">
        <p className="text-sm font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
          Nothing written on {committeeLabel} yet
        </p>
        <p className="text-xs mt-1" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.5 }}>
          Co-chairs rate each speech and leave private notes from the feedback dock in their console.
          Ratings and notes land here the moment they are saved — no action needed from you.
        </p>
      </div>
    </NeuInset>
  );
}

/** Live chair feedback for one committee. Replaces the "format changes on the
 *  production branch" placeholder that used to sit in the recap. */
export function FeedbackRecap({ data }: { data: LiveCommittee }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const folded = foldFeedback(data.feedback);
  const factors = data.session?.scoringFactors ?? [];
  const scaleMax = Math.max(1, data.session?.factorScaleMax ?? 100);
  const factorName = (id: string) => factors.find((f) => f.id === id)?.name ?? id;
  const totalNotes = data.feedback.filter((f) => f.content.trim().length > 0).length;
  const totalRated = data.feedback.filter((f) => Object.keys(f.factorScores ?? {}).length > 0).length;
  const label = data.conf.abbreviation ?? data.conf.name;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Eyebrow>Chair feedback</Eyebrow>
        {data.feedback.length > 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: NEU.surface, color: NEU.forest, boxShadow: NEU.outSm, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}
          >
            {totalRated} rated · {totalNotes} note{totalNotes === 1 ? '' : 's'} · {folded.length} delegation{folded.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {folded.length === 0 ? (
        <FeedbackEmpty committeeLabel={label} />
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {folded.map((cf) => {
            const isOpen = expanded === cf.country;
            const ratedFactors = factors.filter((f) => cf.factorAvg[f.id] !== undefined);
            // A factor the chair renamed away, or a custom one not in the
            // current config, still has stored ratings — show it rather than
            // silently dropping the chair's work.
            const orphanIds = Object.keys(cf.factorAvg).filter((id) => !factors.some((f) => f.id === id));
            return (
              <NeuInset key={cf.country} style={{ borderRadius: 14, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : cf.country)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 text-left focus:outline-none"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: OUTFIT }}
                >
                  <FlagImg code={flagCodeFor(cf.country)} size={20} />
                  <span className="text-sm font-bold flex-1 truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{cf.country}</span>
                  {cf.headline !== null && (
                    <span
                      className="text-[11px] font-extrabold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ color: NEU.forest, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}
                      title={`Mean of every factor rating this delegation has received, out of ${scaleMax}`}
                    >
                      {Math.round(cf.headline)}/{scaleMax}
                    </span>
                  )}
                  <span className="text-[11px] flex-shrink-0" style={{ color: NEU.muted, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                    {cf.entries.length} {cf.entries.length === 1 ? 'speech' : 'speeches'}
                  </span>
                  <ChevronDown
                    size={16}
                    style={{ color: NEU.muted, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: `transform 200ms ${EASE}` }}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 pt-3" style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                    {/* Per-factor means, using the chair's own factor names. */}
                    {(ratedFactors.length > 0 || orphanIds.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {[...ratedFactors.map((f) => ({ id: f.id, name: f.name })), ...orphanIds.map((id) => ({ id, name: factorName(id) }))].map((f) => {
                          const v = cf.factorAvg[f.id];
                          const pct = Math.max(0, Math.min(100, (v / scaleMax) * 100));
                          return (
                            <div key={f.id}>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase truncate" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>{f.name}</span>
                                <span className="text-xs font-black flex-shrink-0" style={{ color: NEU.ink, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>{Math.round(v)}</span>
                              </div>
                              <div className="w-full overflow-hidden mt-1" style={{ height: 6, borderRadius: 6, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
                                <div style={{ inlineSize: `${pct}%`, height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${NEU_GRADIENTS.sage[1]}, ${NEU_GRADIENTS.forest[0]})` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Written notes. Most rows are ratings only, so say so. */}
                    <div className="mt-3">
                      {cf.notes.length === 0 ? (
                        <p className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                          Rated, but the dais left no written note for this delegation yet.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {cf.notes.map((n, i) => {
                            const ctx = contextLabel(n.speechContext);
                            return (
                              <div
                                key={`${n.createdAt}-${i}`}
                                className="flex items-start gap-2 rounded-xl px-3 py-2"
                                style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
                              >
                                <MessageSquareText size={12} style={{ flexShrink: 0, marginBlockStart: 3, color: NEU.muted }} />
                                <div className="min-w-0">
                                  <p className="text-xs" style={{ color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.5 }}>{n.content}</p>
                                  <p className="text-[10px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                                    <span className="font-bold">{n.chairName || 'Chair'}</span>
                                    <span>· {timeAgo(n.createdAt)}</span>
                                    {ctx && <span>· {ctx}</span>}
                                    {typeof n.speechSeconds === 'number' && n.speechSeconds > 0 && (
                                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>· {fmtClock(n.speechSeconds)}</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </NeuInset>
            );
          })}
        </div>
      )}
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

      {/* Chair feedback — live off the `feedback` table (ratings + private notes) */}
      <FeedbackRecap data={data} />

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

// ── Roster / present-delegate detail modal ──────────────────────────────────

/** Present/absent visual language, forest-ivory. */
function statusMeta(status: string): { label: string; color: string; ring: string; dot: string } {
  if (status === 'present-voting') return { label: 'Present & Voting', color: NEU.forest, ring: 'rgba(27,56,40,0.32)', dot: NEU.forest };
  if (status === 'present') return { label: 'Present', color: NEU.green, ring: 'rgba(61,122,82,0.30)', dot: NEU.green };
  return { label: 'Absent', color: NEU.muted, ring: 'rgba(154,138,120,0.30)', dot: NEU.muted };
}

/** Small forest disc holding a chair's initials — a lightweight avatar. */
function ChairAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.34),
        background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
        color: NEU.gold, fontFamily: OUTFIT, fontWeight: 900, fontSize: size * 0.4,
        boxShadow: `0 3px 8px ${NEU_GRADIENTS.forest[0]}33, ${NEU.outSm}`,
        letterSpacing: '0.02em',
      }}
      title={name}
    >
      {initials}
    </span>
  );
}

/** Committee chairs as small labelled avatars — reused inside the roster detail.
 *  Prefers the conference dais (real profile pictures) and falls back to the
 *  names that actually joined the session, which may include a chair with no
 *  Gavelling account. Names stay visible here: this is a detail surface, unlike
 *  the card corner where the stack is deliberately name-free. */
function ChairStrip({ chairs, chairNames }: { chairs: ChairPerson[]; chairNames: string[] }) {
  const people: ChairPerson[] = chairs.length > 0
    ? chairs
    : chairNames.map((name) => ({ id: null, name, avatarUrl: null }));
  return (
    <div>
      <Eyebrow>Chairs</Eyebrow>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {people.length === 0 ? (
          <span className="inline-flex items-center gap-2 text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            <Gavel size={14} /> No chairs joined yet
          </span>
        ) : (
          people.map((p, i) => (
            <span
              key={`${p.id ?? p.name}-${i}`}
              className="inline-flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5"
              style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
            >
              {p.avatarUrl
                ? <Avatar url={p.avatarUrl} name={p.name} size={26} rounded />
                : <ChairAvatar name={p.name} size={26} />}
              <span className="text-xs font-bold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, maxWidth: 140 }}>{p.name}</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export function RosterModal({ data, onClose }: { data: LiveCommittee; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Total speaking time + speech count per country, summed from the speaking logs
  // already assembled for this committee (messages sender='__system__' → __log__).
  const speakingByCountry = new Map<string, { seconds: number; speeches: number }>();
  for (const log of data.speechLogs) {
    const prev = speakingByCountry.get(log.country) ?? { seconds: 0, speeches: 0 };
    speakingByCountry.set(log.country, { seconds: prev.seconds + (log.seconds || 0), speeches: prev.speeches + 1 });
  }

  // Present first (present-voting, then present), absent last; alphabetical within each band.
  const rank = (s: string) => (s === 'present-voting' ? 0 : s === 'present' ? 1 : 2);
  const roster = [...data.delegates].sort((a, b) => rank(a.status) - rank(b.status) || a.country.localeCompare(b.country));

  const present = data.delegates.filter((d) => d.status !== 'absent').length;
  const voting = data.delegates.filter((d) => d.status === 'present-voting').length;
  const chairNames = data.session?.chairNames ?? [];

  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-1">
        <LogoDisc src={data.conf.logoUrl} size={48} fallbackText={(data.conf.abbreviation ?? data.conf.name).slice(0, 3)} alt={data.conf.abbreviation ?? data.conf.name} />
        <div className="min-w-0">
          <Eyebrow>Roll call · present delegates</Eyebrow>
          <h2 className="font-black mt-0.5" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1 }}>
            {data.conf.abbreviation ?? data.conf.name}
          </h2>
        </div>
      </div>
      {data.conf.abbreviation && data.conf.abbreviation !== data.conf.name && (
        <p className="text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{data.conf.name}</p>
      )}

      {/* Present / voting summary */}
      <div className="grid grid-cols-3 gap-3 mt-4 mb-5">
        <StatTile icon={Users} emoji="Person raising hand" gradient={NEU_GRADIENTS.sage} value={`${present}/${data.delegates.length}`} label="Present" />
        <StatTile icon={CheckCircle2} emoji="Ballot box with ballot" gradient={NEU_GRADIENTS.forest} value={String(voting)} label="Present & voting" />
        <StatTile icon={Users} emoji="People holding hands" gradient={NEU_GRADIENTS.amber} value={String(data.delegates.length - present)} label="Absent" />
      </div>

      {/* Chairs — names + small avatars (shown with the detail per spec) */}
      <div className="mb-5">
        <ChairStrip chairs={data.conf.chairs} chairNames={chairNames} />
      </div>

      {/* Roster list — click a delegate to expand full detail */}
      <Eyebrow>Delegations</Eyebrow>
      {roster.length === 0 ? (
        <p className="text-sm mt-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No delegates on the roster yet.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {roster.map((d) => {
            const meta = statusMeta(d.status);
            const isOpen = expanded === d.country;
            const spoken = speakingByCountry.get(d.country) ?? { seconds: 0, speeches: 0 };
            return (
              <NeuInset key={d.country} style={{ borderRadius: 14, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : d.country)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 text-left focus:outline-none"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: OUTFIT }}
                >
                  <span
                    className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
                    style={{ width: 34, height: 34, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
                  >
                    <FlagImg code={flagCodeFor(d.country)} size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* Name = the delegation's country (delegates join by nation; no personal name is stored) */}
                    <p className="text-sm font-extrabold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{d.country}</p>
                    <p className="text-[11px] truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }}>Represents {d.country}</p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ color: meta.color, backgroundColor: NEU.surface, boxShadow: `0 0 0 1.5px ${meta.ring}, ${NEU.outSm}`, fontFamily: OUTFIT, letterSpacing: '0.04em' }}
                  >
                    <span className="rounded-full" style={{ width: 7, height: 7, backgroundColor: meta.dot }} />
                    {meta.label}
                  </span>
                  <ChevronDown
                    size={16}
                    style={{ color: NEU.muted, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: `transform 200ms ${EASE}` }}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 pt-1" style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                    {/* Full detail: total speaking time (sourced from speech logs) */}
                    <div className="flex items-center gap-2 mt-3">
                      <NeuIconDisc gradient={NEU_GRADIENTS.forest} emoji="Studio microphone" icon={Mic} size={30} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.08em' }}>Total speaking time</p>
                        <p className="text-base font-black leading-none mt-0.5" style={{ color: NEU.ink, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtClock(spoken.seconds)}
                          <span className="text-[11px] font-bold ml-2" style={{ color: NEU.muted }}>
                            {spoken.speeches} {spoken.speeches === 1 ? 'speech' : 'speeches'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Status metadata. The delegates table stores only country/status/is_observer —
                        there is no updated_at or roll-call timestamp column, so these are surfaced
                        honestly as "not tracked" rather than fabricated.
                        TODO(schema): add delegates.status_changed_at + delegates.last_roll_call_at
                        (and expose them in live/page.tsx's delegates select) to fill these in. */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="flex items-center gap-2">
                        <Clock size={14} style={{ color: NEU.muted, flexShrink: 0 }} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>Status changed</p>
                          <p className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>Not tracked in schema</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Timer size={14} style={{ color: NEU.muted, flexShrink: 0 }} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>Last roll call</p>
                          <p className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>Not tracked in schema</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </NeuInset>
            );
          })}
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
