// ============================================================
// src/lib/conferenceScoreboard.ts
//
// Conference-wide (secretariat) view of the SESSIONS scoreboard.
//
// The scoring maths is NOT re-implemented here. Every point in this module
// comes out of src/lib/scoring.ts — the same pure functions the chair's
// ScoreboardPanel calls (`computeObjectiveScore`, `computeLedger`,
// `computeQualityScore`, `computeHeadline`, `getScoringConfig`). This file only
// does two things scoring.ts cannot:
//
//   1. LOADS the session rows for every committee of a conference and assembles
//      them into the `Committee` shape those functions already accept.
//   2. FOLDS per-delegate activity counts (speeches / speaking time / motions /
//      docs) — `buildActivityRow` below is a straight extraction of
//      ScoreboardPanel's private `buildMatrix`, so the chair panel can adopt it
//      later with a one-line import swap. Its `total` still comes from
//      computeObjectiveScore; nothing about the arithmetic is duplicated.
//
// THE CONFERENCE ↔ SESSION LINK
// `committees` (sessions) carries NO conference foreign key. The link lives on
// the conferences side: `conference_committees.session_id` → `committees.id`,
// with `conference_committees.session_code` mirroring `committees.code`.
// (`committees.session_origin` is only a 'conference' | 'standalone' flag — it
// names no conference and cannot be joined on.)
//
// ACCESS
// Read-only. Every sessions table (`committees`, `delegates`, `messages`,
// `documents`, `feedback`) has an RLS SELECT policy of `USING (true)` for role
// `public`, so an authenticated organiser can already read all of it — no
// migration is needed for this surface. See scratch-scoreboard-rls.sql for the
// tightening that WOULD be required if those SELECT policies are ever narrowed.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Committee,
  Delegate,
  DelegateStatus,
  CommitteeDocument,
  DocumentStatus,
  SessionPhase,
  ChatMessage,
} from './types';
import type { RankingFactor, ScoringConfig } from './settingsStore';
import {
  computeObjectiveScore,
  computeLedger,
  computeQualityScore,
  computeHeadline,
  getScoringConfig,
  parseLedgerEvents,
  type LedgerRow,
} from './scoring';
import type { FeedbackEntry, FeedbackLevel } from './committeeService';

type DbRow = Record<string, unknown>;

// ── Public shapes ────────────────────────────────────────────────────────────

/** One chair note attached to a delegation. `content` is the chair's free text. */
export interface ScoreboardComment {
  id: string;
  chairName: string;
  content: string;
  level: FeedbackLevel;
  factorScores: Record<string, number>;
  speechContext: string | null;
  speechSeconds: number | null;
  createdAt: string;
}

/** One factor (Diplomacy, Public Speaking, …) averaged over a delegation's ratings. */
export interface ScoreboardFactor {
  id: string;
  name: string;
  average: number;
  scaleMax: number;
  ratings: number;
}

/** Everything the secretariat sees for one delegation in one committee. */
export interface ScoreboardDelegateRow {
  key: string;                       // `${sessionCommitteeId}|${country}`
  committeeId: string;               // conference_committees.id
  committeeName: string;
  committeeAbbrev: string | null;
  sessionCode: string;
  country: string;
  status: DelegateStatus;
  isObserver: boolean;

  headline: number;                  // objective blended with quality per config
  objective: number;
  quality: number | null;            // 0–100, null when no chair ratings exist

  gslSpeeches: number;
  caucusSpeeches: number;
  speakingSeconds: number;
  motions: number;
  rightsOfReply: number;
  workingPapers: number;
  draftResolutions: number;
  manual: number;

  ledger: LedgerRow[];
  comments: ScoreboardComment[];
  factors: ScoreboardFactor[];
}

export interface ScoreboardCommitteeSummary {
  id: string;                        // conference_committees.id
  name: string;
  abbreviation: string | null;
  sessionCode: string;
  sessionCommitteeId: string;
  delegates: number;
  speeches: number;
  speakingSeconds: number;
  comments: number;
  /** true when the chair blends subjective quality into the headline score. */
  blended: boolean;
}

export interface ConferenceScoreboard {
  committees: ScoreboardCommitteeSummary[];
  rows: ScoreboardDelegateRow[];
  /** Conference committees with no linked live session yet — nothing to score. */
  unlinked: { id: string; name: string; abbreviation: string | null }[];
}

// ── Loading helpers ──────────────────────────────────────────────────────────

const PAGE = 1000; // PostgREST's default ceiling

/** Fetch every row matching `committee_id IN (ids)`, paging past the 1000-row cap. */
async function fetchAllByCommittee(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  ids: string[],
  equals: Record<string, string> = {},
): Promise<DbRow[]> {
  if (ids.length === 0) return [];
  const out: DbRow[] = [];
  // Chunk the IN list too — a very large conference can blow the URL length.
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    let from = 0;
    for (;;) {
      let q = supabase.from(table).select(columns).in('committee_id', chunk);
      for (const [col, value] of Object.entries(equals)) q = q.eq(col, value);
      const { data, error } = await q.range(from, from + PAGE - 1);
      if (error) {
        console.error(`[conferenceScoreboard] ${table} load failed:`, error);
        break;
      }
      const rows = (data ?? []) as unknown as DbRow[];
      out.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }
  return out;
}

function groupBy(rows: DbRow[], key = 'committee_id'): Map<string, DbRow[]> {
  const map = new Map<string, DbRow[]>();
  for (const r of rows) {
    const k = r[key] as string;
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

/**
 * A session `committees` row plus the four child tables scoring.ts reads,
 * assembled into the `Committee` shape. Live-session fields the scoreboard has
 * no use for (speakers list, caucus queue, current speaker, motions) are left
 * empty on purpose — nothing in scoring.ts touches them.
 */
function assembleScoringCommittee(
  row: DbRow,
  delegateRows: DbRow[],
  messageRows: DbRow[],
  documentRows: DbRow[],
): Committee {
  const settings = (row.settings as Record<string, unknown>) ?? null;

  const delegates: Delegate[] = delegateRows.map((d) => ({
    id: d.id as string,
    country: d.country as string,
    status: d.status as DelegateStatus,
    isObserver: (d.is_observer as boolean) ?? false,
  }));

  const messages: ChatMessage[] = messageRows.map((m) => ({
    id: m.id as string,
    sender: m.sender as string,
    content: (m.content as string) ?? '',
    timestamp: new Date(m.created_at as string),
    isPrivate: false,
    recipient: (m.recipient as string) ?? undefined,
  }));

  const documents: CommitteeDocument[] = documentRows.map((d) => ({
    id: d.id as string,
    type: d.type as CommitteeDocument['type'],
    docCode: (d.doc_code as string) ?? '',
    title: (d.title as string) ?? '',
    sponsors: (d.sponsors as string[]) ?? [],
    content: '',
    status: d.status as DocumentStatus,
    submittedAt: d.created_at as string,
  }));

  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    topic: (row.topic as string) ?? '',
    chairName: ((row.chair_names as string[]) ?? [])[0] ?? 'Chair',
    chairNames: (row.chair_names as string[]) ?? [],
    delegates,
    phase: row.phase as SessionPhase,
    speakersList: [],
    caucusQueue: [],
    currentSpeaker: null,
    speakerTimeLimit: (row.speaker_time_limit as number) ?? 0,
    speakerTimeRemaining: 0,
    speakerStartedAt: null,
    motions: [],
    pendingMotions: [],
    resolutions: [],
    documents,
    caucus: null,
    messages,
    createdAt: new Date(row.created_at as string),
    dbSettings: settings,
    dbScoring: (settings?.scoring as ScoringConfig | undefined) ?? null,
  };
}

// ── Per-delegate folds ───────────────────────────────────────────────────────

/**
 * Activity counts for ONE delegation. Extracted verbatim from
 * ScoreboardPanel's private `buildMatrix` so the two surfaces can never drift;
 * `total` still comes from computeObjectiveScore, so the arithmetic lives in
 * exactly one place.
 */
export function buildActivityRow(committee: Committee, country: string) {
  const mine = parseLedgerEvents(committee).filter((e) => e.country === country);
  const speeches = mine.filter((e) => (e.type ?? 'speech') === 'speech');
  const docs = (committee.documents ?? []).filter((doc) => doc.sponsors.includes(country));
  return {
    gsl: speeches.filter((e) => e.context === 'speakers-list').length,
    caucus: speeches.filter((e) => e.context !== 'speakers-list').length,
    seconds: speeches.reduce((s, e) => s + (e.seconds ?? 0), 0),
    motions: mine.filter((e) => e.type === 'motion-raised').length,
    rtr: mine.filter((e) => e.type === 'right-of-reply').length,
    wp: docs.filter((doc) => doc.type === 'working-paper').length,
    dr: docs.filter((doc) => doc.type === 'draft-resolution').length,
    manual: mine
      .filter((e) => e.type === 'manual-award' || e.type === 'manual-deduct')
      .reduce((s, e) => s + (e.type === 'manual-deduct' ? -Math.abs(e.value ?? 0) : Math.abs(e.value ?? 0)), 0),
    total: computeObjectiveScore(committee, country).total,
  };
}

/** Mean of each ENABLED factor across every rating a delegation actually received.
 *
 *  Exported so the chair's own scoreboard (`src/lib/sessionScoreboard.ts`) folds
 *  factors the identical way rather than growing a second copy of this loop.
 *  NOTE: it deliberately ignores `ScoringConfig.factorRatingsEnabled` — that flag
 *  gates the chair's rating INPUT, never the display of ratings already given. */
export function foldFactors(
  feedback: FeedbackEntry[],
  country: string,
  factors: RankingFactor[],
  scaleMax: number,
): ScoreboardFactor[] {
  const mine = feedback.filter((f) => f.country === country);
  const out: ScoreboardFactor[] = [];
  for (const f of factors) {
    if (!f.enabled) continue;
    const vals = mine
      .map((m) => m.factorScores?.[f.id])
      .filter((v): v is number => typeof v === 'number' && v > 0);
    if (!vals.length) continue;
    out.push({
      id: f.id,
      name: f.name,
      average: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
      scaleMax,
      ratings: vals.length,
    });
  }
  return out;
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function loadConferenceScoreboard(
  supabase: SupabaseClient,
  conferenceId: string,
): Promise<ConferenceScoreboard> {
  const { data: ccData, error: ccError } = await supabase
    .from('conference_committees')
    .select('id, name, abbreviation, session_id, session_code')
    .eq('conference_id', conferenceId)
    .order('name');

  if (ccError) {
    console.error('[conferenceScoreboard] conference_committees load failed:', ccError);
    return { committees: [], rows: [], unlinked: [] };
  }

  const confCommittees = (ccData ?? []) as unknown as {
    id: string; name: string; abbreviation: string | null;
    session_id: string | null; session_code: string | null;
  }[];

  const linked = confCommittees.filter((c) => !!c.session_id);
  const unlinked = confCommittees
    .filter((c) => !c.session_id)
    .map((c) => ({ id: c.id, name: c.name, abbreviation: c.abbreviation }));

  const sessionIds = linked.map((c) => c.session_id as string);
  if (sessionIds.length === 0) return { committees: [], rows: [], unlinked };

  // The session committee rows themselves (id is the PK here, not committee_id).
  const sessionRows: DbRow[] = [];
  for (let i = 0; i < sessionIds.length; i += 40) {
    const { data, error } = await supabase
      .from('committees')
      .select('id, code, name, topic, chair_names, phase, speaker_time_limit, settings, created_at')
      .in('id', sessionIds.slice(i, i + 40));
    if (error) {
      console.error('[conferenceScoreboard] committees load failed:', error);
      continue;
    }
    sessionRows.push(...((data ?? []) as unknown as DbRow[]));
  }
  const sessionById = new Map(sessionRows.map((r) => [r.id as string, r]));

  const [delegateRows, messageRows, documentRows, feedbackRows] = await Promise.all([
    fetchAllByCommittee(supabase, 'delegates', 'id, committee_id, country, status, is_observer', sessionIds),
    // Only the scoring ledger — never chat. `sender='__system__'` +
    // `recipient='__log__'` is exactly what parseLedgerEvents keeps, so this
    // filter changes nothing about the result and keeps the payload small.
    fetchAllByCommittee(
      supabase, 'messages', 'id, committee_id, sender, recipient, content, created_at', sessionIds,
      { sender: '__system__', recipient: '__log__' },
    ),
    fetchAllByCommittee(supabase, 'documents', 'id, committee_id, type, doc_code, title, sponsors, status, created_at', sessionIds),
    fetchAllByCommittee(
      supabase, 'feedback',
      'id, committee_id, country, chair_name, content, level, factor_scores, speech_context, speech_seconds, created_at',
      sessionIds,
    ),
  ]);

  const delegatesBy = groupBy(delegateRows);
  const messagesBy = groupBy(messageRows);
  const documentsBy = groupBy(documentRows);
  const feedbackBy = groupBy(feedbackRows);

  const committees: ScoreboardCommitteeSummary[] = [];
  const rows: ScoreboardDelegateRow[] = [];

  for (const cc of linked) {
    const sessionId = cc.session_id as string;
    const sessionRow = sessionById.get(sessionId);
    if (!sessionRow) continue; // link points at a deleted/expired session

    const committee = assembleScoringCommittee(
      sessionRow,
      delegatesBy.get(sessionId) ?? [],
      messagesBy.get(sessionId) ?? [],
      documentsBy.get(sessionId) ?? [],
    );

    const feedback: FeedbackEntry[] = (feedbackBy.get(sessionId) ?? []).map((f) => ({
      id: f.id as string,
      country: (f.country as string) ?? '',
      chairName: (f.chair_name as string) ?? '',
      content: (f.content as string) ?? '',
      level: ((f.level as FeedbackLevel) ?? 'speech'),
      factorScores: (f.factor_scores as Record<string, number>) ?? {},
      speechContext: (f.speech_context as string | null) ?? null,
      speechSeconds: (f.speech_seconds as number | null) ?? null,
      createdAt: f.created_at as string,
    }));

    const cfg = getScoringConfig(committee);

    let speeches = 0;
    let seconds = 0;

    for (const d of committee.delegates) {
      const activity = buildActivityRow(committee, d.country);
      const quality = computeQualityScore(feedback, d.country, cfg);
      const comments = feedback
        .filter((f) => f.country === d.country)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .map((f) => ({
          id: f.id,
          chairName: f.chairName,
          content: f.content,
          level: f.level,
          factorScores: f.factorScores,
          speechContext: f.speechContext,
          speechSeconds: f.speechSeconds,
          createdAt: f.createdAt,
        }));

      speeches += activity.gsl + activity.caucus;
      seconds += activity.seconds;

      rows.push({
        key: `${sessionId}|${d.country}`,
        committeeId: cc.id,
        committeeName: cc.name,
        committeeAbbrev: cc.abbreviation,
        sessionCode: cc.session_code ?? committee.code,
        country: d.country,
        status: d.status,
        isObserver: d.isObserver ?? false,

        headline: computeHeadline(activity.total, quality, cfg.scoreBlend),
        objective: activity.total,
        quality,

        gslSpeeches: activity.gsl,
        caucusSpeeches: activity.caucus,
        speakingSeconds: activity.seconds,
        motions: activity.motions,
        rightsOfReply: activity.rtr,
        workingPapers: activity.wp,
        draftResolutions: activity.dr,
        manual: activity.manual,

        ledger: computeLedger(committee, d.country),
        comments,
        factors: foldFactors(feedback, d.country, cfg.factors, cfg.factorScaleMax),
      });
    }

    committees.push({
      id: cc.id,
      name: cc.name,
      abbreviation: cc.abbreviation,
      sessionCode: cc.session_code ?? committee.code,
      sessionCommitteeId: sessionId,
      delegates: committee.delegates.length,
      speeches,
      speakingSeconds: seconds,
      comments: feedback.filter((f) => !!f.content).length,
      blended: cfg.scoreBlend > 0,
    });
  }

  return { committees, rows, unlinked };
}

// ── Presentation helpers (shared by the page and its CSV export) ─────────────

export function formatSpeakingTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (!m) return `${s}s`;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export const COMMENT_LEVEL_LABEL: Record<FeedbackLevel, string> = {
  speech: 'Speech note',
  session: 'Session recap',
  conference: 'Conference recap',
};
