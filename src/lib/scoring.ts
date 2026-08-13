// Single source of truth for committee scoring. Reads the DB-backed scoring config
// (never localStorage) and produces an itemized ledger — one row per point-earning event.
import type { Committee } from './types';
import { DEFAULT_SCORING, DEFAULT_DOCUMENT_NAMES, type ScoringConfig } from './settingsStore';
import { docName } from './docNames';

// Parsed __log__ event (superset of the legacy speaking-log entry).
export interface LedgerEvent {
  country: string;
  type?: string;            // missing type === 'speech' (back-compat)
  sourceId?: string;
  seconds?: number;
  context?: string;
  topic?: string;
  value?: number;
  note?: string;
  timestamp?: string;
}

export interface LedgerRow {
  type: string;
  sourceId: string;
  label: string;
  country: string;
  pts: number;
  detail: string;
  timestamp: string;
  context?: string;   // speech rows: the speaking context (for matching feedback)
  seconds?: number;   // speech rows: seconds spoken (for matching feedback)
  // Speech rows only: how much of `pts` came from the speakingTimePer10s source
  // rather than the flat GSL/caucus speech value. The row itself stays whole — the
  // chair's itemized ledger is one line per speech and must not be split — but the
  // by-source fold below needs to attribute the time bonus to the source that
  // actually pays it. 0 when that source is disabled.
  timePts?: number;
}

// committee.dbScoring merged over DEFAULT_SCORING — never reads localStorage.
export function getScoringConfig(committee: Pick<Committee, 'dbScoring'>): ScoringConfig {
  const db = committee.dbScoring;
  if (!db) return DEFAULT_SCORING;
  return {
    ...DEFAULT_SCORING,
    ...db,
    sources: Array.isArray(db.sources) && db.sources.length ? db.sources : DEFAULT_SCORING.sources,
    factors: Array.isArray(db.factors) && db.factors.length ? db.factors : DEFAULT_SCORING.factors,
  };
}

function srcOf(cfg: ScoringConfig, id: string) {
  return cfg.sources.find((s) => s.id === id);
}
// Returns the source value if enabled, else null (→ row omitted).
function val(cfg: ScoringConfig, id: string): number | null {
  const s = srcOf(cfg, id);
  return s && s.enabled ? s.value : null;
}
function name(cfg: ScoringConfig, id: string): string {
  return srcOf(cfg, id)?.name ?? id;
}

export function parseLedgerEvents(committee: Committee): LedgerEvent[] {
  return parseLogEvents(committee);
}

function parseLogEvents(committee: Committee): LedgerEvent[] {
  return (committee.messages ?? [])
    .filter((m) => m.sender === '__system__' && m.recipient === '__log__' && m.content.startsWith('__log__:'))
    .map((m) => {
      try { return JSON.parse(m.content.slice('__log__:'.length)) as LedgerEvent; }
      catch { return null; }
    })
    .filter(Boolean) as LedgerEvent[];
}

// Itemized list: every speech / motion / RTR / document / manual adjustment as its own row.
// Each row's pts comes from the matching sources[].value and is omitted if that source is disabled.
export function computeLedger(committee: Committee, country: string): LedgerRow[] {
  const cfg = getScoringConfig(committee);
  const rows: LedgerRow[] = [];

  // Attendance
  const delegate = committee.delegates.find((d) => d.country === country);
  const attVal = val(cfg, 'attendance');
  if (delegate && delegate.status !== 'absent' && attVal != null) {
    rows.push({ type: 'attendance', sourceId: 'attendance', label: name(cfg, 'attendance'), country, pts: attVal, detail: delegate.status, timestamp: '' });
  }

  const per10 = val(cfg, 'speakingTimePer10s');
  const events = parseLogEvents(committee).filter((e) => e.country === country);
  for (const e of events) {
    const type = e.type ?? 'speech';
    if (type === 'speech') {
      const isGsl = e.context === 'speakers-list';
      const sid = isGsl ? 'gslSpeech' : 'caucusSpeech';
      const base = val(cfg, sid);
      if (base == null) continue;
      const secs = e.seconds ?? 0;
      const timePts = per10 != null ? Math.floor(secs / 10) * per10 : 0;
      const detail = [e.topic, secs ? `${secs}s` : ''].filter(Boolean).join(' · ');
      rows.push({ type: 'speech', sourceId: sid, label: name(cfg, sid), country, pts: base + timePts, detail, timestamp: e.timestamp ?? '', context: e.context ?? 'speakers-list', seconds: secs, timePts });
    } else if (type === 'motion-raised') {
      const v = val(cfg, 'motionRaised'); if (v == null) continue;
      rows.push({ type, sourceId: 'motionRaised', label: name(cfg, 'motionRaised'), country, pts: v, detail: '', timestamp: e.timestamp ?? '' });
    } else if (type === 'right-of-reply') {
      const v = val(cfg, 'rightOfReply'); if (v == null) continue;
      rows.push({ type, sourceId: 'rightOfReply', label: name(cfg, 'rightOfReply'), country, pts: v, detail: '', timestamp: e.timestamp ?? '' });
    } else if (type === 'manual-award') {
      rows.push({ type, sourceId: 'manual', label: e.note || 'Bonus', country, pts: Math.abs(e.value ?? 0), detail: e.note ?? '', timestamp: e.timestamp ?? '' });
    } else if (type === 'manual-deduct') {
      rows.push({ type, sourceId: 'manual', label: e.note || 'Deduction', country, pts: -Math.abs(e.value ?? 0), detail: e.note ?? '', timestamp: e.timestamp ?? '' });
    } else if (type === 'custom' && e.sourceId) {
      const v = val(cfg, e.sourceId); if (v == null) continue;
      rows.push({ type, sourceId: e.sourceId, label: name(cfg, e.sourceId), country, pts: v, detail: e.note ?? '', timestamp: e.timestamp ?? '' });
    }
  }

  // Documents — sponsorship + DR passed.
  // Ledger labels follow the committee's own names for the document types when the
  // chair has renamed them (Settings → Motions → Documents); the built-in scoring
  // source name stays the fallback.
  const wpLabel = docName(committee, 'working-paper', 'singular', name(cfg, 'wpSponsor'));
  const drLabel = docName(committee, 'draft-resolution', 'singular', name(cfg, 'drSponsor'));
  const drRenamed = docName(committee, 'draft-resolution', 'singular', DEFAULT_DOCUMENT_NAMES.draftResolution);
  const drPassedLabel = drRenamed === DEFAULT_DOCUMENT_NAMES.draftResolution
    ? name(cfg, 'drPassed')
    : `${drRenamed} passed`;
  const myDocs = (committee.documents ?? []).filter((d) => d.sponsors.includes(country));
  for (const d of myDocs) {
    if (d.type === 'working-paper') {
      const v = val(cfg, 'wpSponsor');
      if (v != null) rows.push({ type: 'wp', sourceId: 'wpSponsor', label: wpLabel, country, pts: v, detail: d.docCode || d.title, timestamp: d.submittedAt });
    } else if (d.type === 'draft-resolution') {
      const v = val(cfg, 'drSponsor');
      if (v != null) rows.push({ type: 'dr', sourceId: 'drSponsor', label: drLabel, country, pts: v, detail: d.docCode || d.title, timestamp: d.submittedAt });
      if (d.status === 'passed') {
        const pv = val(cfg, 'drPassed');
        if (pv != null) rows.push({ type: 'drPassed', sourceId: 'drPassed', label: drPassedLabel, country, pts: pv, detail: d.docCode || d.title, timestamp: d.submittedAt });
      }
    }
  }

  rows.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  return rows;
}

export function computeObjectiveScore(committee: Committee, country: string): { total: number; rows: LedgerRow[] } {
  const rows = computeLedger(committee, country);
  const total = rows.reduce((s, r) => s + r.pts, 0);
  return { total, rows };
}

// One delegation's points broken down BY SCORE SOURCE — the same ledger, folded.
// Disabled sources never produce rows, so they never appear here either; that is
// what lets a caller (see ./delegateTips) reason about "which categories is this
// delegation short on" without ever re-implementing the scoring maths.
// The time bonus is banked against `speakingTimePer10s`, not against the speech
// source, so "you are short on speaking time" is answerable separately from
// "you are short on speeches". Row totals are untouched — summing this record
// still equals computeObjectiveScore().total.
export function computeSourceTotals(committee: Committee, country: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of computeLedger(committee, country)) {
    const timePts = r.timePts ?? 0;
    out[r.sourceId] = (out[r.sourceId] ?? 0) + (r.pts - timePts);
    if (timePts) out.speakingTimePer10s = (out.speakingTimePer10s ?? 0) + timePts;
  }
  return out;
}

// ── Quality (subjective) scoring from chair recaps ──
export interface QualityFeedback { country?: string; level: string; factorScores: Record<string, number>; createdAt: string; }

// Quality 0–100 from chair factor scores. Prefers the latest conference recap, then the
// latest session recap; with neither (e.g. recap removed), falls back to averaging the
// per-speech criteria the chair entered in the comment bar. Null when there's no data.
export function computeQualityScore(feedback: QualityFeedback[], country: string, cfg: ScoringConfig): number | null {
  const mine = feedback.filter((f) => !f.country || f.country === country);
  const enabled = cfg.factors.filter((f) => f.enabled);
  const latestOf = (lvl: string) =>
    mine.filter((f) => f.level === lvl).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  const latest = latestOf('conference') ?? latestOf('session');

  let factorMeans: number[];
  if (latest) {
    // Recap path — the single latest recap's enabled factor scores.
    factorMeans = enabled
      .map((f) => latest.factorScores[f.id])
      .filter((v): v is number => typeof v === 'number' && v > 0);
  } else {
    // Speech fallback — mean of each factor across all per-speech entries.
    const speeches = mine.filter((f) => f.level === 'speech');
    if (!speeches.length) return null;
    factorMeans = [];
    for (const f of enabled) {
      const vals = speeches
        .map((s) => s.factorScores[f.id])
        .filter((v): v is number => typeof v === 'number' && v > 0);
      if (vals.length) factorMeans.push(vals.reduce((s, v) => s + v, 0) / vals.length);
    }
  }
  if (!factorMeans.length) return null;
  const mean = factorMeans.reduce((s, v) => s + v, 0) / factorMeans.length;
  return Math.round((mean / Math.max(1, cfg.factorScaleMax)) * 100);
}

// Blend objective points with quality (0–100) by blend/100. 0 = pure objective, 100 = pure quality.
export function computeHeadline(objectiveTotal: number, quality: number | null, blend: number): number {
  const b = Math.max(0, Math.min(100, blend)) / 100;
  if (quality == null || b === 0) return objectiveTotal;
  return Math.round(objectiveTotal * (1 - b) + quality * b);
}
