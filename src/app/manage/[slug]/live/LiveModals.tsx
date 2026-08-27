'use client';

import { useCallback, useRef, useState } from 'react';
import { X, Mic, FileText, ScrollText, Users, Gavel, Trophy, MessageSquareText, ExternalLink, ChevronDown, Timer, Clock, CheckCircle2, Megaphone, FileCheck } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';
import { LogoDisc } from '@/components/LogoDisc';
import { getCountryByName } from '@/lib/countries';
import Portal from '@/components/Portal';
import Avatar from '@/components/Avatar';
import {
  NeuInset, NeuIconDisc, NEU, NEU_GRADIENTS, type NeuGradient, OUTFIT, EASE,
} from '@/components/neu';
// `NEU.muted` measures 2.81:1 on this surface and no longer appears in this
// file at all: every label, caption and sentence here is SOFT (5.55:1). The two
// accent colours that were also carrying text are read through their inks —
// `NEU.green` is 4.30:1 and drops to 3.86:1 inside the adopted-resolution tint,
// so GREEN_INK carries the words and `NEU.green` survives on dots and fills
// only, where the 3:1 non-text bar applies. See ./tokens for the full sweep.
import { SOFT, GREEN_INK } from './tokens';
import { committeeIdentity } from './identity';

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
    /** `committees.updated_at`, maintained by `committees_updated_at_trigger`
     *  (BEFORE UPDATE ON committees). Half of the STATUS axis — see
     *  `lastActiveAt` in cardModel.ts for why it is never used on its own. */
    updatedAt: string | null;
    /** The one-shot resume latch (`committees.resuming_chair`). NOT the gavel —
     *  see AGENTS.md, "resuming_chair is NOT the gavel". Read here only so a
     *  suspended card can name who is bringing the room back, and so a latch
     *  that was claimed and never cleared can be reported as the deadlock it is. */
    resumingChair: string | null;
    /** `settings.quorumThreshold` straight off the row — never via the settings
     *  store, which is never hydrated outside the chair page (AGENTS.md rule 14).
     *  Default 'none'; only 13 of 509 production committees set it at all. */
    quorumThreshold: string;
    /** Enabled ranking factors + scale from committees.settings.scoring, so
     *  feedback ratings can be labelled with the chair's own factor names. */
    scoringFactors: { id: string; name: string }[];
    factorScaleMax: number;
  } | null;
  currentSpeaker: { country: string | null; timeRemaining: number; startedAt: string | null } | null;
  /** `isObserver` mirrors `delegates.is_observer`. Observers sit in the room but
   *  are NOT part of the voting body, so every present/total count on this page
   *  excludes them — the same rule the chair console applies
   *  (`chair/[code]/page.tsx:2620, 2627-2628`). */
  delegates: { country: string; status: string; isObserver: boolean }[];
  gslQueue: string[];
  caucusQueue: string[];
  // The `motions` table is DELIBERATELY not read by this page. The cards report
  // the stage a room is in, never what is sitting on the chair's desk, and the
  // recap's "Motions raised" tile counts `motion-raised` ledger events in
  // `messages` (see `motionsLogged` below) rather than motion rows — which are
  // hard-deleted on both accept and reject and so cannot be counted anyway.
  documents: {
    type: string; status: string; docCode: string; title: string; sponsors: string[];
    /** Public Supabase Storage URL, or null — 17 of 23 production rows (74%) have none. */
    fileUrl: string | null;
    fileName: string | null;
    /** Inline body, used only when there is no file. Blank on 22 of 23 production rows. */
    content: string | null;
    createdAt: string | null;
  }[];
  /** ONLY `type: 'speech'` ledger rows, with the `__chair__` sentinel country
   *  removed. `logEvent` (committeeService.ts:899-914) writes six event types
   *  onto the same `__log__:` channel; treating all of them as speeches inflated
   *  every count on this page by ~37%. `at` is the payload timestamp, falling
   *  back to `messages.created_at`. */
  speechLogs: { country: string; seconds: number; context: string; topic: string; at: string | null }[];
  /** Every ledger row regardless of type, for counting non-speech activity. */
  eventLogs: { country: string; type: string; at: string | null }[];
  /** Most recent sign of life in the room, from any source we can see. Drives
   *  the staleness guard on the voting variant — see `votingLooksLive`. */
  lastActivityAt: string | null;
  /** `max(messages.created_at)` over EVERY message in the room, chat included —
   *  the other half of `GREATEST(committees.updated_at, max(messages.created_at))`.
   *  Chat is the one kind of activity that touches neither the `committees` row
   *  nor the ledger, so without it a room where delegates are talking but the
   *  chair has not pressed anything reads as stalled. */
  lastMessageAt: string | null;
  /** True when this committee has demonstrably run before: chairs joined, a
   *  preserved queue, documents, ledger rows or chair feedback. Separates a
   *  resume roll call from a session that was never opened — both sit at
   *  `phase='pre-session'` (`committeeService.ts:1097-1105`). */
  hasHistory: boolean;
  feedback: FeedbackEntry[];
}

/** Delegates who count toward the voting body — observers excluded, matching
 *  the chair console exactly. */
export function votingBody(lc: LiveCommittee): LiveCommittee['delegates'] {
  return lc.delegates.filter((d) => !d.isObserver);
}

/** `{ present, total }` over the voting body, the chair's own numbers. */
export function presence(lc: LiveCommittee): { present: number; total: number } {
  const body = votingBody(lc);
  return { present: body.filter((d) => d.status !== 'absent').length, total: body.length };
}

/** `not-started` = never opened. `roll-call` = opened, initial roll call underway.
 *  `resumed` = ran before and is doing its roll call after a break. The last two
 *  are live rooms and must NOT get the dead "Session not in progress yet"
 *  placeholder — a resumed committee still holds its GSL, documents and chat. */
export type CardStatus =
  | 'no-session' | 'not-started' | 'roll-call' | 'resumed' | 'live' | 'suspended' | 'ended';

export function cardStatus(lc: LiveCommittee): CardStatus {
  if (!lc.session) return 'no-session';
  if (lc.session.endedAt) return 'ended';
  if (lc.session.phase === 'adjourned') return 'suspended';
  if (lc.session.phase === 'pre-session' || lc.session.phase === 'roll-call') {
    // A resume roll call is indistinguishable from a first roll call by phase
    // alone, so the room's own history is what separates them.
    if (lc.hasHistory) return 'resumed';
    if ((lc.session.chairNames?.length ?? 0) > 0) return 'roll-call';
    return 'not-started';
  }
  return 'live';
}

/** The three statuses that mean "a room is actually doing something right now". */
export function isOnTheFloor(s: CardStatus): boolean {
  return s === 'live' || s === 'roll-call' || s === 'resumed';
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

/** "1h 12m" / "4m 20s" / "0m". Mirrors `formatSpeakingTime` in
 *  `conferenceScoreboard.ts` so the recap and the scoreboard read alike. */
export function fmtSpeakingTotal(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function flagCodeFor(name: string): string {
  return getCountryByName(name)?.code ?? '';
}

// Score formula replicated from SettingsPanel.tsx computeScore:
// attendance 5 if not absent; WP sponsor ×10; DR sponsor ×20;
// speaking floor(totalSeconds/10); GSL speeches ×10; caucus speeches ×8.
//
// This used to be correct only by accident: it was handed EVERY ledger event and
// leaned on `context` being absent on the non-speech ones (`motion-raised` and
// `right-of-reply` pass neither `context` nor `seconds` — MotionsModal.tsx:1234,
// chair/[code]/page.tsx:3965), so they scored zero rather than being excluded.
// `lc.speechLogs` is now speech-only at the source, so the filters below are
// load-bearing on purpose instead of by luck.
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
      style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.08em' }}
    >
      {children}
    </p>
  );
}

/** Exported so the per-committee scoreboard and the scoped broadcast composer
 *  open in the SAME shell as the recap, roster and awards modals rather than
 *  each growing their own. `maxWidth` widens it for the scoreboard's table. */
export function ModalShell({ children, onClose, maxWidth = 672 }: { children: React.ReactNode; onClose: () => void; maxWidth?: number }) {
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
          className="w-full rounded-[22px] p-8 relative overflow-y-auto"
          style={{ backgroundColor: NEU.surface, boxShadow: NEU.out, maxWidth, maxHeight: 'calc(100vh - 64px)', fontFamily: OUTFIT }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 inline-flex items-center justify-center rounded-full focus:outline-none"
            style={{ width: 32, height: 32, color: SOFT, backgroundColor: NEU.surface, boxShadow: NEU.outSm, transition: `box-shadow 200ms ${EASE}`, cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; (e.currentTarget as HTMLElement).style.color = NEU.ink; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; (e.currentTarget as HTMLElement).style.color = SOFT; }}
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

function StatTile({ icon: Icon, emoji, gradient, value, label, onClick }: { icon: LucideIcon; emoji: string; gradient: NeuGradient; value: string; label: string; onClick?: () => void }) {
  const body = (
    <>
      <NeuIconDisc gradient={gradient} emoji={emoji} icon={Icon} size={36} />
      <div className="min-w-0 text-left">
        <p className="font-black text-xl leading-none" style={{ color: NEU.ink, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: SOFT, fontFamily: OUTFIT }}>{label}</p>
      </div>
    </>
  );
  // A tile that leads somewhere says so by behaving like a control; the rest
  // stay inert insets.
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-3 w-full focus:outline-none"
        style={{
          backgroundColor: NEU.base, borderRadius: 14, padding: '13px 14px',
          boxShadow: NEU.inSm, border: 'none', cursor: 'pointer',
          transition: `box-shadow 200ms ${EASE}`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `inset 2px 2px 6px rgba(27,56,40,0.18), inset -2px -2px 6px rgba(255,255,255,0.85)`; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.inSm; }}
        title="Open this section below"
      >
        {body}
      </button>
    );
  }
  return (
    <NeuInset className="flex items-center gap-3" style={{ padding: '13px 14px', borderRadius: 14 }}>
      {body}
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
        <p className="text-xs mt-1" style={{ color: SOFT, fontFamily: OUTFIT, lineHeight: 1.5 }}>
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
  const label = committeeIdentity(data.conf).title;

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
                  <span className="text-[11px] flex-shrink-0" style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                    {cf.entries.length} {cf.entries.length === 1 ? 'speech' : 'speeches'}
                  </span>
                  <ChevronDown
                    size={16}
                    style={{ color: SOFT, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: `transform 200ms ${EASE}` }}
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
                                <span className="text-[10px] font-bold uppercase truncate" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>{f.name}</span>
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
                        <p className="text-xs" style={{ color: SOFT, fontFamily: OUTFIT }}>
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
                                <MessageSquareText size={12} style={{ flexShrink: 0, marginBlockStart: 3, color: SOFT }} />
                                <div className="min-w-0">
                                  <p className="text-xs" style={{ color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.5 }}>{n.content}</p>
                                  <p className="text-[10px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: SOFT, fontFamily: OUTFIT }}>
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

// ── Documents recap ─────────────────────────────────────────────────────────

/** Pipeline order, matching DocumentsModal: submitted → on-floor → introduced →
 *  passed/failed. Anything unrecognised falls to the end under its own name. */
const DOC_STATUS_ORDER = ['introduced', 'on-floor', 'submitted', 'passed', 'failed'];
const DOC_STATUS_LABELS: Record<string, string> = {
  'submitted': 'Submitted',
  'on-floor': 'On the floor',
  'introduced': 'Introduced',
  'passed': 'Passed',
  'failed': 'Failed',
};

export type DocFilter = 'all' | 'working-paper' | 'draft-resolution';

/** Working papers and draft resolutions the room has produced.
 *
 *  MOST DOCUMENTS HAVE NO BODY TO SHOW. Measured in production: of 23 documents,
 *  17 (74%) have a null `file_url`, 22 have blank `content`, and 16 have NEITHER
 *  — a chair typically tables a paper by title and sponsors alone. So "nothing
 *  attached" is the ordinary case here, not a failure, and it is worded as a
 *  plain statement rather than an error. */
function DocumentsRecap({
  data, filter = 'all', onFilter,
}: {
  data: LiveCommittee;
  /** Set by the WP / DR stat tiles above (and by the WP / DR chips on the
   *  card), which scroll here and narrow to one type rather than dropping the
   *  reader at the top of a mixed list. */
  filter?: DocFilter;
  onFilter?: (f: DocFilter) => void;
}) {
  const all = data.documents;
  if (all.length === 0) {
    return (
      <div className="mb-6">
        <Eyebrow>Documents</Eyebrow>
        <p className="text-sm mt-2" style={{ color: SOFT, fontFamily: OUTFIT }}>
          No working papers or draft resolutions submitted yet.
        </p>
      </div>
    );
  }

  const docs = filter === 'all' ? all : all.filter((d) => d.type === filter);

  // A PASSED DRAFT RESOLUTION IS THE OUTCOME OF THE WHOLE COMMITTEE. It is
  // lifted out of the pipeline list and given the top of the section, with its
  // file openable, rather than sitting as one more row under a "Passed" heading.
  const passedDrs = all.filter((d) => d.type === 'draft-resolution' && d.status === 'passed');

  const wpCount = all.filter((d) => d.type === 'working-paper').length;
  const drCount = all.length - wpCount;
  const TABS: { key: DocFilter; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: all.length },
    { key: 'working-paper', label: 'Working papers', n: wpCount },
    { key: 'draft-resolution', label: 'Draft resolutions', n: drCount },
  ];

  const statuses = Array.from(new Set(docs.map((d) => d.status)))
    .sort((a, b) => {
      const ai = DOC_STATUS_ORDER.indexOf(a); const bi = DOC_STATUS_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });

  return (
    <div className="mb-6">
      <Eyebrow>Documents</Eyebrow>

      {/* The verdict first. */}
      {passedDrs.length > 0 && (
        <div className="mt-2 mb-3 flex flex-col gap-2">
          {passedDrs.map((d, i) => (
            <div
              key={`passed-${d.docCode}-${i}`}
              className="flex items-start gap-3"
              style={{
                backgroundColor: 'rgba(61,122,82,0.09)',
                border: `1px solid rgba(61,122,82,0.30)`,
                borderRadius: 16, padding: '13px 15px',
              }}
            >
              <FileCheck size={18} style={{ color: GREEN_INK, flexShrink: 0, marginBlockStart: 1 }} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase" style={{ color: GREEN_INK, fontFamily: OUTFIT, letterSpacing: '0.1em' }}>
                  Adopted by the committee
                </p>
                <p className="text-base font-extrabold" style={{ color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.2 }}>
                  {d.docCode ? `${d.docCode} · ` : ''}{d.title || 'Draft resolution'}
                </p>
                {d.sponsors.length > 0 && (
                  <p className="text-[11px] mt-0.5" style={{ color: SOFT, fontFamily: OUTFIT }}>
                    Sponsored by {d.sponsors.slice(0, 4).join(', ')}
                    {d.sponsors.length > 4 && ` +${d.sponsors.length - 4}`}
                  </p>
                )}
                {d.fileUrl ? (
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold mt-2 rounded-full px-3 py-1.5"
                    style={{ color: NEU.gold, backgroundColor: NEU.forest, fontFamily: OUTFIT, textDecoration: 'none' }}
                  >
                    <ExternalLink size={12} />
                    {d.fileName || 'Open the adopted text'}
                  </a>
                ) : (
                  <p className="text-[11px] mt-1.5" style={{ color: SOFT, fontFamily: OUTFIT }}>
                    {(d.content ?? '').trim()
                      ? 'Text is below.'
                      : 'No file was uploaded with this resolution — the chair recorded it by title and sponsors.'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Type filter, driven by the WP / DR tiles as well as by clicking here. */}
      {onFilter && all.length > 1 && (
        <div className="flex items-center gap-1.5 mt-2 mb-1 flex-wrap">
          {TABS.filter((t) => t.n > 0 || t.key === 'all').map((t) => (
            <button
              key={t.key}
              onClick={() => onFilter(t.key)}
              className="text-[11px] font-bold rounded-full px-2.5 py-1 focus:outline-none"
              style={{
                fontFamily: OUTFIT, border: 'none', cursor: 'pointer',
                color: filter === t.key ? NEU.ink : SOFT,
                backgroundColor: filter === t.key ? NEU.base : NEU.surface,
                boxShadow: filter === t.key ? NEU.inSm : NEU.outSm,
                transition: `box-shadow 200ms ${EASE}`,
              }}
              aria-pressed={filter === t.key}
            >
              {t.label} · {t.n}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-col gap-3">
        {statuses.map((status) => {
          const group = docs.filter((d) => d.status === status);
          return (
            <div key={status}>
              <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.08em' }}>
                {DOC_STATUS_LABELS[status] ?? status} · {group.length}
              </p>
              <div className="flex flex-col gap-2">
                {group.map((d, i) => {
                  const isDR = d.type === 'draft-resolution';
                  const Icon = isDR ? ScrollText : FileText;
                  const body = (d.content ?? '').trim();
                  return (
                    <NeuInset key={`${d.docCode}-${d.title}-${i}`} style={{ padding: '11px 13px', borderRadius: 14 }}>
                      <div className="flex items-start gap-2.5">
                        <Icon size={14} style={{ color: NEU.forest, flexShrink: 0, marginBlockStart: 2 }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                            {d.docCode ? `${d.docCode} · ` : ''}{d.title || (isDR ? 'Draft resolution' : 'Working paper')}
                          </p>
                          {d.sponsors.length > 0 && (
                            <p className="text-[11px] mt-0.5" style={{ color: SOFT, fontFamily: OUTFIT }}>
                              Sponsored by {d.sponsors.slice(0, 4).join(', ')}
                              {d.sponsors.length > 4 && ` +${d.sponsors.length - 4}`}
                            </p>
                          )}

                          {/* A file wins over an inline body; the chair console
                              renders the same `file_url` in its PDF viewer. */}
                          {d.fileUrl ? (
                            <a
                              href={d.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold mt-1.5"
                              style={{ color: NEU.forest, fontFamily: OUTFIT, textDecoration: 'none' }}
                            >
                              <ExternalLink size={11} />
                              {d.fileName || 'Open document'}
                            </a>
                          ) : body ? (
                            <p
                              className="text-xs mt-1.5 whitespace-pre-wrap"
                              style={{ color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.5, maxHeight: 160, overflowY: 'auto' }}
                            >
                              {body}
                            </p>
                          ) : (
                            /* 17 of 23 production documents (74%) carry no
                               file and 22 of 23 carry no body, so "nothing
                               attached" is the ORDINARY case here. It is worded
                               as a plain fact, never as an error. */
                            <p className="text-[11px] mt-1.5" style={{ color: SOFT, fontFamily: OUTFIT }}>
                              Tabled by title and sponsors — no file or text attached.
                            </p>
                          )}
                        </div>
                      </div>
                    </NeuInset>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recap modal ─────────────────────────────────────────────────────────────

export function RecapModal({
  data, onClose, onOpenScoreboard, onBroadcast, floorDetail = null, initialDocFilter = 'all',
}: {
  data: LiveCommittee;
  onClose: () => void;
  /** Set when the recap was opened by a WP or DR chip on the card rather than by
   *  the card body. The modal then opens ALREADY scrolled to Documents and
   *  already narrowed to that type, instead of dropping the reader at the top of
   *  a session recap and asking them to find the section themselves. */
  initialDocFilter?: DocFilter;
  /** The phase-specific body (caucus clock, ballot breakdown, unmod countdown).
   *  Passed IN rather than imported, because `PhaseVariants` already imports
   *  this module and reaching back the other way would make the pair circular. */
  floorDetail?: React.ReactNode;
  /** Points → the same scoreboard the chairs see. */
  onOpenScoreboard: (d: LiveCommittee) => void;
  /** Broadcast scoped to THIS room. Absent when the committee has no session to
   *  address. */
  onBroadcast: ((d: LiveCommittee) => void) | null;
}) {
  const session = data.session;
  // `phase` is left at whatever the room was last doing when it was gavelled out
  // or suspended, so it must not be shown for either — an adjourned committee
  // badged "General Speakers' List" reads as still sitting. Same rule as
  // `phaseChip` on the card; kept inline because cardModel imports this module.
  const phaseLabel = !session
    ? 'No session'
    : session.endedAt
      ? 'Adjourned'
      : session.phase === 'adjourned'
        ? 'Suspended'
        : (PHASE_LABELS[session.phase] ?? session.phase);
  const ident = committeeIdentity(data.conf);

  // Documents section, targeted by the WP/DR tiles here AND by the WP/DR chips
  // on the card, which open this modal with `initialDocFilter` already set.
  const docsRef = useRef<HTMLDivElement | null>(null);
  const [docFilter, setDocFilter] = useState<DocFilter>(initialDocFilter);
  function jumpToDocs(type: 'working-paper' | 'draft-resolution') {
    setDocFilter(type);
    // The modal body is the scroll container, so `scrollIntoView` on the section
    // is the whole job — no manual offset arithmetic.
    requestAnimationFrame(() => docsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  // Opened FROM a document chip on a card: land on Documents rather than at the
  // top of a session recap the reader did not ask for.
  //
  // This is a REF CALLBACK, not an effect, and that is load-bearing. `ModalShell`
  // renders through `Portal`, which resolves its target inside an effect and so
  // commits NOTHING on its first pass. Every effect in this component therefore
  // runs while `docsRef.current` is still null — and never runs a second time,
  // because it is `Portal` that re-renders when the target resolves, not this
  // component. (A `useLayoutEffect` here silently did nothing at all: verified
  // against the real page, the modal opened at the top.) A ref callback fires at
  // the moment the node actually attaches, which is the moment there is
  // something to scroll to.
  const jumped = useRef(false);
  const attachDocs = useCallback((el: HTMLDivElement | null) => {
    docsRef.current = el;
    if (!el || jumped.current || initialDocFilter === 'all') return;
    jumped.current = true;
    // `auto`, not `smooth`: the reader asked for this section, not for a
    // scroll-past of everything above it.
    //
    // Twice, and the FIRST one is synchronous on purpose. The node is attached
    // and its scroll container is already laid out, so the immediate call is
    // what actually positions the modal; the extra frame only corrects for the
    // logo disc and the flag images resolving their boxes late. A lone
    // `requestAnimationFrame` would be a silent no-op in a background tab,
    // where rAF never fires at all.
    el.scrollIntoView({ behavior: 'auto', block: 'start' });
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }));
  }, [initialDocFilter]);

  // Speech-only: `speechLogs` no longer carries motions, rights of reply or
  // manual point adjustments, so this tile stops over-reporting.
  const speeches = data.speechLogs.length;

  // MOTIONS RAISED, from the ledger — replacing "Motions pending", which the
  // owner asked to drop.
  //
  // It is NOT derivable from the `motions` table: rows there are hard-deleted on
  // BOTH accept and reject (`committeeService.ts:683, 688, 846, 851, 884`), which
  // is why that whole table holds about five rows platform-wide. `motion-raised`
  // ledger events survive — 95 of them in production.
  //
  // The caveat is printed under the tiles rather than buried here: only motions
  // a chair ACCEPTED leave a ledger entry, so this is a floor and never a total.
  const motionsLogged = data.eventLogs.filter((e) => e.type === 'motion-raised').length;

  // TOTAL SPEAKING TIME — fully derivable, no caveat needed. All 333 production
  // speech rows carry their own `seconds`.
  const totalSpeakingSeconds = data.speechLogs.reduce((sum, l) => sum + (l.seconds || 0), 0);

  const wps = data.documents.filter((d) => d.type === 'working-paper').length;
  const drs = data.documents.filter((d) => d.type === 'draft-resolution').length;
  const { present, total: votingTotal } = presence(data);
  const observers = data.delegates.filter((d) => d.isObserver).length;

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
      {/* Header — same acronym-over-full-name rule the cards follow. */}
      <div className="flex items-center gap-3.5 mb-1">
        <LogoDisc src={data.conf.logoUrl} size={48} fallbackText={ident.mono} alt={ident.title} />
        <div className="min-w-0">
          <Eyebrow>Session recap</Eyebrow>
          <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
            <h2 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1 }}>
              {ident.title}
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
      {ident.subtitle
        ? <p className="text-sm mb-5" style={{ color: SOFT, fontFamily: OUTFIT }}>{ident.subtitle}</p>
        : <div className="mb-5" />}

      {/* THE LIVE FLOOR, IN FULL.
          The caucus clock, the ballot breakdown and the unmoderated countdown
          used to live on the CARD, where they forced four different card shapes
          and with them the height chaos. They are detail, not scanning
          information, so they moved here — where a detail view legitimately
          wants them, and where a caller has already chosen this one room. */}
      {floorDetail}

      {/* Stat tiles. The WP and DR tiles open the documents section below. */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatTile icon={Mic} emoji="Studio microphone" gradient={NEU_GRADIENTS.forest} value={String(speeches)} label="Speeches given" />
        <StatTile icon={Clock} emoji="Stopwatch" gradient={NEU_GRADIENTS.sage} value={fmtSpeakingTotal(totalSpeakingSeconds)} label="Total speaking time" />
        <StatTile icon={Gavel} emoji="Ballot box with ballot" gradient={NEU_GRADIENTS.gold} value={String(motionsLogged)} label="Motions raised" />
        <StatTile icon={Users} emoji="Person raising hand" gradient={NEU_GRADIENTS.sage} value={`${present}/${votingTotal}`} label="Delegates present" />
        <StatTile icon={FileText} emoji="Page facing up" gradient={NEU_GRADIENTS.green} value={String(wps)} label="Working papers" onClick={wps > 0 ? () => jumpToDocs('working-paper') : undefined} />
        <StatTile icon={ScrollText} emoji="Scroll" gradient={NEU_GRADIENTS.amber} value={String(drs)} label="Draft resolutions" onClick={drs > 0 ? () => jumpToDocs('draft-resolution') : undefined} />
      </div>
      <p className="text-[11px] -mt-4 mb-6" style={{ color: SOFT, fontFamily: OUTFIT, lineHeight: 1.5 }}>
        <strong>Speeches</strong> counts logged speeches only — motions, rights of reply and manual
        point adjustments share the same ledger but are not speeches.{' '}
        <strong>Motions raised</strong> counts motions a chair accepted: a rejected motion is deleted
        from the database outright and leaves no record anywhere, so the true total can only be
        higher than this.
        {observers > 0 && <> Present excludes {observers} observer{observers === 1 ? '' : 's'}, matching the chair&apos;s roll.</>}
      </p>

      {/* Points. The heading is now a door: it opens the per-committee
          scoreboard — the same view the chairs score from — instead of leaving
          the reader with two rows and no way further in. */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Points</Eyebrow>
          <button
            onClick={() => onOpenScoreboard(data)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 focus:outline-none"
            style={{
              color: NEU.forest, fontFamily: OUTFIT, backgroundColor: NEU.surface,
              boxShadow: NEU.outSm, border: 'none', cursor: 'pointer',
              transition: `box-shadow 200ms ${EASE}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
          >
            <Trophy size={12} />
            Full delegate performance
          </button>
        </div>
      </div>
      {scores.length > 0 && (
        <div className="mb-6" style={{ marginBlockStart: -14 }}>
          <div className="mt-2 flex flex-col gap-2">
            {[{ label: 'Top delegate', row: top }, ...(quietest ? [{ label: 'Quietest delegate', row: quietest }] : [])].map((entry) => (
              <NeuInset
                key={entry.label}
                className="flex items-center gap-3"
                style={{ padding: '11px 14px', borderRadius: 14 }}
              >
                <span className="text-[11px] font-bold uppercase flex-shrink-0" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.08em', width: 130 }}>
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

      {/* Working papers + draft resolutions, grouped by where they are in the
          pipeline. Reachable directly from the WP/DR tiles above. */}
      <div ref={attachDocs}>
        <DocumentsRecap data={data} filter={docFilter} onFilter={setDocFilter} />
      </div>

      {/* Broadcast to THIS room. `session_broadcasts` holds zero production rows
          — the feature has never once been used — so the scoped path was walked
          end to end rather than assumed. */}
      {onBroadcast && (
        <button
          onClick={() => onBroadcast(data)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3 font-bold text-sm tracking-widest focus:outline-none mb-3"
          style={{
            backgroundColor: NEU.surface, color: NEU.forest, fontFamily: OUTFIT,
            letterSpacing: '0.06em', border: 'none', cursor: 'pointer',
            boxShadow: NEU.outSm, transition: `box-shadow 220ms ${EASE}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
        >
          <Megaphone size={14} />
          MESSAGE THIS COMMITTEE
        </button>
      )}

      {/* Join as secretariat */}
      {session && (
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
      )}
    </ModalShell>
  );
}

// ── Roster / present-delegate detail modal ──────────────────────────────────

/** Present/absent visual language, forest-ivory. */
function statusMeta(status: string): { label: string; color: string; ring: string; dot: string } {
  if (status === 'present-voting') return { label: 'Present & Voting', color: NEU.forest, ring: 'rgba(27,56,40,0.32)', dot: NEU.forest };
  if (status === 'present') return { label: 'Present', color: GREEN_INK, ring: 'rgba(61,122,82,0.30)', dot: NEU.green };
  return { label: 'Absent', color: SOFT, ring: 'rgba(154,138,120,0.30)', dot: SOFT };
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
          <span className="inline-flex items-center gap-2 text-sm" style={{ color: SOFT, fontFamily: OUTFIT }}>
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
  const ident = committeeIdentity(data.conf);

  // Total speaking time + speech count per country, summed from the speaking logs
  // already assembled for this committee (messages sender='__system__' → __log__).
  const speakingByCountry = new Map<string, { seconds: number; speeches: number }>();
  for (const log of data.speechLogs) {
    const prev = speakingByCountry.get(log.country) ?? { seconds: 0, speeches: 0 };
    speakingByCountry.set(log.country, { seconds: prev.seconds + (log.seconds || 0), speeches: prev.speeches + 1 });
  }

  // Present first (present-voting, then present), absent last; alphabetical within
  // each band. Observers sort last — they are in the room but not in the body.
  const rank = (s: string) => (s === 'present-voting' ? 0 : s === 'present' ? 1 : 2);
  const roster = [...data.delegates].sort((a, b) =>
    Number(a.isObserver) - Number(b.isObserver)
    || rank(a.status) - rank(b.status)
    || a.country.localeCompare(b.country));

  // Counts are over the voting body only, so this modal agrees with the chair's
  // own "N present" rather than quietly counting observers as delegations.
  const body = votingBody(data);
  const { present, total } = presence(data);
  const voting = body.filter((d) => d.status === 'present-voting').length;
  const observers = data.delegates.length - total;
  const chairNames = data.session?.chairNames ?? [];

  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-1">
        <LogoDisc src={data.conf.logoUrl} size={48} fallbackText={ident.mono} alt={ident.title} />
        <div className="min-w-0">
          <Eyebrow>Roll call · present delegates</Eyebrow>
          <h2 className="font-black mt-0.5" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1 }}>
            {ident.title}
          </h2>
        </div>
      </div>
      {data.conf.abbreviation && data.conf.abbreviation !== data.conf.name && (
        <p className="text-sm" style={{ color: SOFT, fontFamily: OUTFIT }}>{data.conf.name}</p>
      )}

      {/* Present / voting summary */}
      <div className="grid grid-cols-3 gap-3 mt-4 mb-5">
        <StatTile icon={Users} emoji="Person raising hand" gradient={NEU_GRADIENTS.sage} value={`${present}/${total}`} label="Present" />
        <StatTile icon={CheckCircle2} emoji="Ballot box with ballot" gradient={NEU_GRADIENTS.forest} value={String(voting)} label="Present & voting" />
        <StatTile icon={Users} emoji="People holding hands" gradient={NEU_GRADIENTS.amber} value={String(total - present)} label="Absent" />
      </div>
      {observers > 0 && (
        <p className="text-[11px] -mt-3 mb-4" style={{ color: SOFT, fontFamily: OUTFIT }}>
          Plus {observers} observer{observers === 1 ? '' : 's'}, listed below but outside the voting body.
        </p>
      )}

      {/* Chairs — names + small avatars (shown with the detail per spec) */}
      <div className="mb-5">
        <ChairStrip chairs={data.conf.chairs} chairNames={chairNames} />
      </div>

      {/* Roster list — click a delegate to expand full detail */}
      <Eyebrow>Delegations</Eyebrow>
      {roster.length === 0 ? (
        <p className="text-sm mt-2" style={{ color: SOFT, fontFamily: OUTFIT }}>No delegates on the roster yet.</p>
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
                    <p className="text-[11px] truncate" style={{ color: SOFT, fontFamily: OUTFIT }}>
                      {d.isObserver ? 'Observer — not part of the voting body' : `Represents ${d.country}`}
                    </p>
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
                    style={{ color: SOFT, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: `transform 200ms ${EASE}` }}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 pt-1" style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                    {/* Full detail: total speaking time (sourced from speech logs) */}
                    <div className="flex items-center gap-2 mt-3">
                      <NeuIconDisc gradient={NEU_GRADIENTS.forest} emoji="Studio microphone" icon={Mic} size={30} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.08em' }}>Total speaking time</p>
                        <p className="text-base font-black leading-none mt-0.5" style={{ color: NEU.ink, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtClock(spoken.seconds)}
                          <span className="text-[11px] font-bold ml-2" style={{ color: SOFT }}>
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
                        <Clock size={14} style={{ color: SOFT, flexShrink: 0 }} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>Status changed</p>
                          <p className="text-xs" style={{ color: SOFT, fontFamily: OUTFIT }}>Not tracked in schema</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Timer size={14} style={{ color: SOFT, flexShrink: 0 }} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>Last roll call</p>
                          <p className="text-xs" style={{ color: SOFT, fontFamily: OUTFIT }}>Not tracked in schema</p>
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
  const ident = committeeIdentity(data.conf);
  // TODO(merge): wire to chair award allocation from production branch
  const rows: { label: string; emoji: string }[] = [
    { label: 'Best Delegate', emoji: '1st place medal' },
    { label: 'Outstanding Delegate', emoji: '2nd place medal' },
    { label: 'Honourable Mention', emoji: '3rd place medal' },
  ];
  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3.5 mb-1">
        <LogoDisc src={data.conf.logoUrl} size={48} fallbackText={ident.mono} alt={ident.title} />
        <div className="min-w-0">
          <Eyebrow>Awards board</Eyebrow>
          <h2 className="font-black mt-0.5" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.1 }}>
            {ident.title}
          </h2>
        </div>
      </div>
      <p className="text-sm mb-6" style={{ color: SOFT, fontFamily: OUTFIT }}>
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
            <span className="text-sm font-bold" style={{ color: SOFT, fontFamily: OUTFIT }}>—</span>
          </NeuInset>
        ))}
      </div>

      <p className="text-[11px]" style={{ color: SOFT, fontFamily: OUTFIT }}>
        Chairs will allocate awards from their console once the award feature ships; allocations will appear here automatically.
      </p>
    </ModalShell>
  );
}
