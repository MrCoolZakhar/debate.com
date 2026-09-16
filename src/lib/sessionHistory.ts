// ============================================================
// src/lib/sessionHistory.ts
//
// THE SESSION, AS IT HAPPENED — the model behind the Scoreboard's History tab.
//
// The chair asked for "all motions, and under those motions all the speeches
// that happened, with chair comments if any were given and how long they spoke".
// Everything needed for that is already in the committee, and none of it is
// re-derived here:
//
//   • `parseLedgerEvents` (scoring.ts) gives the `__log__` stream — every speech
//     with its SECONDS, its CONTEXT and the TOPIC it was given under, plus the
//     motion-raised / right-of-reply / manual rows. It is memoised on the
//     messages array identity and already drops duplicate turn keys, so calling
//     it here costs nothing extra and can never double-count a speech.
//   • the `feedback` rows the panel already loads carry the chair notes.
//
// WHAT A SEGMENT IS. The log does not record "a caucus started"; it records what
// every speech was given under. A run of consecutive speeches sharing the same
// `context` + `topic` IS one debate segment: a moderated caucus's speakers, a
// Tour de Table, or a stretch of the General Speakers' List (its own segment,
// with the committee topic as its heading). That is exactly the grouping a chair
// reads as "this motion, and the speeches under it" — a caucus segment's topic
// is the purpose the motion carried.
//
// A NON-SPEECH EVENT (a motion raised, a right of reply, a manual award) belongs
// to whichever segment was running when it happened. Events logged before the
// first speech are held and shown at the head of the first segment, so nothing
// in the log is ever silently dropped.
//
// NOTHING HERE IS A READ PATH AROUND ANYTHING. It folds objects the caller
// already holds; it does no I/O, scores nothing, and writes nothing. Chair notes
// are chair-private (CLAUDE.md §2) — the only surface that renders this is the
// chair's own ScoreboardPanel.
// ============================================================

import type { Committee } from './types';
import { parseLedgerEvents, type LedgerEvent } from './scoring';
import type { FeedbackEntry } from './committeeService';

/** A chair note, as the history shows it: what was written and who wrote it. */
export interface HistoryNote {
  id: string;
  chairName: string;
  content: string;
  /** Per-factor ratings written with the note, already filtered to real values (> 0). */
  ratings: { id: string; value: number }[];
}

export interface HistorySpeech {
  id: string;
  country: string;
  seconds: number;
  /** `speakers-list` | `moderated-caucus` | `unmoderated-caucus` | `tour-de-table`, or whatever the log carried. */
  context: string;
  topic: string;
  timestamp: string;
  notes: HistoryNote[];
}

/** Anything in the log that is not a speech, kept in place in the timeline. */
export interface HistoryEvent {
  id: string;
  type: string;
  country: string;
  timestamp: string;
  /** Manual awards only: the signed point value. */
  value?: number;
  note?: string;
}

export type SegmentKind =
  | 'speakers-list' | 'moderated-caucus' | 'unmoderated-caucus' | 'tour-de-table' | 'other';

export interface HistorySegment {
  /** Stable across rebuilds: kind + topic + the instant it opened. */
  id: string;
  kind: SegmentKind;
  /** The caucus purpose, or the committee topic for a GSL stretch. May be ''. */
  topic: string;
  startedAt: string;
  endedAt: string;
  speeches: HistorySpeech[];
  events: HistoryEvent[];
  /** Totals for the segment header. */
  totalSeconds: number;
  noteCount: number;
  /** Distinct delegations that took the floor in this segment. */
  speakerCount: number;
}

const SEGMENT_KINDS: SegmentKind[] = [
  'speakers-list', 'moderated-caucus', 'unmoderated-caucus', 'tour-de-table',
];

function kindOf(context: string | undefined): SegmentKind {
  const c = (context ?? 'speakers-list') as SegmentKind;
  return SEGMENT_KINDS.includes(c) ? c : 'other';
}

const ms = (iso: string | undefined): number => {
  if (!iso) return NaN;
  const n = new Date(iso).getTime();
  return Number.isFinite(n) ? n : NaN;
};

// ── Matching a chair note to the speech it was written on ────────────────────
//
// A note carries the country, the speaking context and the seconds of the speech
// it hangs off — the same three fields the CSV export has always matched on. Two
// things make that not quite enough on its own, and both are handled here rather
// than by loosening the match:
//
//   • a delegation can give two speeches of the same length in the same caucus,
//     and a signature match alone would print BOTH notes under BOTH speeches;
//   • `speech_seconds` is NULL on a note started while the delegate still holds
//     the floor, until the reconcile effect back-patches it (AGENTS.md, chair
//     roles). Such a row has no signature at all.
//
// So: signature candidates first, resolved by the nearest instant and consumed
// once; then, for a note that still has nowhere to go, the same delegation's
// nearest speech within ten minutes. A note that matches nothing is simply not in
// the history — it is never attached to an arbitrary speech — and it is still on
// the delegation's own profile, which lists every note unconditionally.
function attachNotes(speeches: HistorySpeech[], feedback: FeedbackEntry[]): void {
  if (speeches.length === 0) return;

  const bySignature = new Map<string, HistorySpeech[]>();
  const byCountry = new Map<string, HistorySpeech[]>();
  const push = (map: Map<string, HistorySpeech[]>, key: string, s: HistorySpeech) => {
    const list = map.get(key);
    if (list) list.push(s); else map.set(key, [s]);
  };
  for (const s of speeches) {
    push(bySignature, `${s.country}|${s.context}|${s.seconds}`, s);
    push(byCountry, s.country, s);
  }

  const taken = new Set<string>();
  const nearest = (pool: HistorySpeech[], at: number, freeOnly: boolean): HistorySpeech | null => {
    const open = freeOnly ? pool.filter((s) => !taken.has(s.id)) : pool;
    if (open.length === 0) return null;
    if (open.length === 1 || !Number.isFinite(at)) return open[0];
    return open.reduce((best, s) =>
      Math.abs(ms(s.timestamp) - at) < Math.abs(ms(best.timestamp) - at) ? s : best);
  };

  const notes = feedback
    .filter((f) => f.level === 'speech' && f.content.trim())
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  for (const f of notes) {
    const at = ms(f.spokenAt ?? undefined) || ms(f.createdAt);
    let hit: HistorySpeech | null = null;
    if (f.speechSeconds != null && f.speechContext) {
      const pool = bySignature.get(`${f.country}|${f.speechContext}|${f.speechSeconds}`) ?? [];
      hit = nearest(pool, at, true) ?? nearest(pool, at, false);
    }
    if (!hit) {
      const pool = byCountry.get(f.country) ?? [];
      const near = nearest(pool, at, true) ?? nearest(pool, at, false);
      // Ten minutes: long enough to cover a note typed after the speaker sat down,
      // short enough that it cannot wander into a different caucus.
      if (near && Number.isFinite(at) && Math.abs(ms(near.timestamp) - at) <= 10 * 60_000) hit = near;
    }
    if (!hit) continue;
    taken.add(hit.id);
    hit.notes.push({
      id: f.id,
      chairName: f.chairName,
      content: f.content.trim(),
      ratings: Object.entries(f.factorScores ?? {})
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .map(([id, value]) => ({ id, value })),
    });
  }
}

/**
 * The whole session as an ordered list of debate segments, NEWEST FIRST.
 *
 * Pass the same `feedback` rows the scoreboard already loaded. Pure, and cheap
 * enough to run on render: the one potentially expensive step, parsing the log,
 * is memoised on the messages array identity inside `scoring.ts`.
 */
export function buildSessionHistory(committee: Committee, feedback: FeedbackEntry[]): HistorySegment[] {
  const events: LedgerEvent[] = [...parseLedgerEvents(committee)]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.timestamp || '').localeCompare(b.e.timestamp || '') || a.i - b.i)
    .map(({ e }) => e);

  const segments: HistorySegment[] = [];
  const allSpeeches: HistorySpeech[] = [];
  let pending: HistoryEvent[] = [];
  let currentKey = '';
  let n = 0;

  for (const e of events) {
    const type = e.type ?? 'speech';
    const stamp = e.timestamp ?? '';
    if (type === 'speech') {
      const context = e.context ?? 'speakers-list';
      const topic = (e.topic ?? '').trim();
      const key = `${context}|${topic}`;
      let seg = segments[segments.length - 1];
      if (!seg || key !== currentKey) {
        seg = {
          id: `${context}|${topic}|${stamp || n}`,
          kind: kindOf(context),
          topic,
          startedAt: stamp,
          endedAt: stamp,
          speeches: [],
          events: [],
          totalSeconds: 0,
          noteCount: 0,
          speakerCount: 0,
        };
        segments.push(seg);
        currentKey = key;
        // Whatever was logged before the first speech opens the segment it ran into.
        if (pending.length) { seg.events.push(...pending); pending = []; }
      }
      const speech: HistorySpeech = {
        id: `sp-${n++}`,
        country: e.country,
        seconds: Math.max(0, Math.round(e.seconds ?? 0)),
        context,
        topic,
        timestamp: stamp,
        notes: [],
      };
      seg.speeches.push(speech);
      allSpeeches.push(speech);
      seg.totalSeconds += speech.seconds;
      if (stamp) seg.endedAt = stamp;
    } else {
      const row: HistoryEvent = {
        id: `ev-${n++}`, type, country: e.country, timestamp: stamp,
        value: e.value, note: e.note,
      };
      const seg = segments[segments.length - 1];
      if (seg) { seg.events.push(row); if (stamp) seg.endedAt = stamp; }
      else pending.push(row);
    }
  }

  // A session whose log holds only motions and awards and not one speech still has
  // a history worth reading.
  if (pending.length) {
    segments.push({
      id: `other|${pending[0].timestamp || '0'}`,
      kind: 'other',
      topic: committee.topic ?? '',
      startedAt: pending[0].timestamp,
      endedAt: pending[pending.length - 1].timestamp,
      speeches: [], events: pending, totalSeconds: 0, noteCount: 0, speakerCount: 0,
    });
  }

  attachNotes(allSpeeches, feedback);

  for (const seg of segments) {
    seg.noteCount = seg.speeches.reduce((s, sp) => s + sp.notes.length, 0);
    seg.speakerCount = new Set(seg.speeches.map((s) => s.country)).size;
    seg.events.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  }

  // Newest first: the segment the committee is in (or just left) is the one a
  // chair wants open, and it is the one the tab expands by default.
  return segments.reverse();
}
