// Single source of truth for committee scoring. Reads the DB-backed scoring config
// (never localStorage) and produces an itemized ledger — one row per point-earning event.
import type { Committee } from './types';
import { DEFAULT_SCORING, type ScoringConfig } from './settingsStore';

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
      rows.push({ type: 'speech', sourceId: sid, label: name(cfg, sid), country, pts: base + timePts, detail, timestamp: e.timestamp ?? '' });
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

  // Documents — sponsorship + DR passed
  const myDocs = (committee.documents ?? []).filter((d) => d.sponsors.includes(country));
  for (const d of myDocs) {
    if (d.type === 'working-paper') {
      const v = val(cfg, 'wpSponsor');
      if (v != null) rows.push({ type: 'wp', sourceId: 'wpSponsor', label: name(cfg, 'wpSponsor'), country, pts: v, detail: d.docCode || d.title, timestamp: d.submittedAt });
    } else if (d.type === 'draft-resolution') {
      const v = val(cfg, 'drSponsor');
      if (v != null) rows.push({ type: 'dr', sourceId: 'drSponsor', label: name(cfg, 'drSponsor'), country, pts: v, detail: d.docCode || d.title, timestamp: d.submittedAt });
      if (d.status === 'passed') {
        const pv = val(cfg, 'drPassed');
        if (pv != null) rows.push({ type: 'drPassed', sourceId: 'drPassed', label: name(cfg, 'drPassed'), country, pts: pv, detail: d.docCode || d.title, timestamp: d.submittedAt });
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
