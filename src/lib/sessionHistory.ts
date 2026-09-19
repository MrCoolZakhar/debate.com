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
// A CAUCUS THAT PASSED OPENS ITS OWN SEGMENT (18 Sep 2026). Segments used to be derived
// from speech contexts ONLY, and the log said nothing when the room changed phase. So an
// unmoderated caucus (which logs no speech at all) never started a segment: everything
// that happened in it, and the motion that opened it, was filed under the General
// Speakers' List that preceded it, and it stayed there until the next GSL speech. The
// `motion-passed` event (src/lib/motionLog.ts) is now the segment opener for the four
// caucus motions, and the committee's LIVE phase closes the gap for anything the log
// cannot show yet (see `liveSegment`).
//
// A MOTION IS A LINE (18 Sep 2026). Every motion raised is one `motion` event in the
// segment it was raised in, carrying what it was and how it ended (passed, rejected,
// failed, fell, still on the floor). Its pass / failure / edit events update that line
// rather than adding more.
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

import type { Committee, PendingMotionType } from './types';
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

/** How a motion ended, as far as the log knows. `unknown` = it left the floor with no
 *  outcome written (an older client, or a write that never landed). */
export type MotionStatus = 'pending' | 'passed' | 'rejected' | 'failed' | 'fell' | 'unknown';

/** One motion, as its History line shows it. */
export interface HistoryMotion {
  motionId?: string;
  motionType?: PendingMotionType;
  topic?: string;
  totalTime?: number;
  speakingTime?: number;
  tourOrder?: 'asc' | 'desc' | 'custom';
  status: MotionStatus;
  /** A `motion-raised` row from before 18 Sep 2026: written on ACCEPT, with no motion fields. */
  legacy?: boolean;
}

/** Anything in the log that is not a speech, kept in place in the timeline. */
export interface HistoryEvent {
  id: string;
  /** 'motion' for a motion line; otherwise the log type (right-of-reply, manual-award, ...). */
  type: string;
  country: string;
  timestamp: string;
  /** Manual awards only: the signed point value. */
  value?: number;
  note?: string;
  /** Motion lines only. */
  motion?: HistoryMotion;
  /** Rights of reply only: chair notes written on the reply (context 'right-of-reply'). */
  notes?: HistoryNote[];
}

export type SegmentKind =
  | 'speakers-list' | 'moderated-caucus' | 'unmoderated-caucus' | 'consultation' | 'tour-de-table' | 'other';

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
  /** Total speaking time, for the segment header. */
  totalSeconds: number;
  /** Distinct delegations that took the floor in this segment. */
  speakerCount: number;
  /** The motion that opened it (a caucus that passed), when the log has one. */
  motion?: HistoryMotion;
  /** Not in the log (yet): the committee's current phase, added so the debate the room is
   *  in always has a segment (see `liveSegment`). */
  live?: boolean;
}

const SEGMENT_KINDS: SegmentKind[] = [
  'speakers-list', 'moderated-caucus', 'unmoderated-caucus', 'tour-de-table',
];
// ('consultation' is never a speech context; only a consultation motion opens one.)

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

  // Consumed PER AUTHOR: two chairs each writing a note on the same speech must both land on
  // it. A global "taken" sent the second chair's note to the next identical-signature speech,
  // however far away in time.
  const taken = new Set<string>();
  const takenKey = (author: string, speechId: string) => `${author}|${speechId}`;
  const nearest = (pool: HistorySpeech[], at: number, freeOnly: boolean, author: string): HistorySpeech | null => {
    const open = freeOnly ? pool.filter((s) => !taken.has(takenKey(author, s.id))) : pool;
    if (open.length === 0) return null;
    if (open.length === 1 || !Number.isFinite(at)) return open[0];
    return open.reduce((best, s) =>
      Math.abs(ms(s.timestamp) - at) < Math.abs(ms(best.timestamp) - at) ? s : best);
  };

  const notes = feedback
    // A note on a right of reply is attached to the reply (`attachReplyNotes`), never to a
    // speech of the same delegation.
    .filter((f) => f.level === 'speech' && f.content.trim() && f.speechContext !== RTR_CONTEXT)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  for (const f of notes) {
    const at = ms(f.spokenAt ?? undefined) || ms(f.createdAt);
    let hit: HistorySpeech | null = null;
    if (f.speechSeconds != null && f.speechContext) {
      const pool = bySignature.get(`${f.country}|${f.speechContext}|${f.speechSeconds}`) ?? [];
      hit = nearest(pool, at, true, f.chairName) ?? nearest(pool, at, false, f.chairName);
    }
    if (!hit) {
      const pool = byCountry.get(f.country) ?? [];
      const near = nearest(pool, at, true, f.chairName) ?? nearest(pool, at, false, f.chairName);
      // Ten minutes: long enough to cover a note typed after the speaker sat down,
      // short enough that it cannot wander into a different caucus.
      if (near && Number.isFinite(at) && Math.abs(ms(near.timestamp) - at) <= 10 * 60_000) hit = near;
    }
    if (!hit) continue;
    taken.add(takenKey(f.chairName, hit.id));
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

/** The `speech_context` a chair note on a right of reply is stored under (FeedbackLogPanel). */
export const RTR_CONTEXT = 'right-of-reply';

// A note on a right of reply names the reply by its delegation and the instant it was
// granted (`spoken_at` = the log timestamp of the right-of-reply event). Nearest reply of
// that delegation within five minutes, consumed once per author.
function attachReplyNotes(replies: HistoryEvent[], feedback: FeedbackEntry[]): void {
  if (replies.length === 0) return;
  const taken = new Set<string>();
  const notes = feedback
    .filter((f) => f.level === 'speech' && f.speechContext === RTR_CONTEXT && f.content.trim())
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  for (const f of notes) {
    const at = ms(f.spokenAt ?? undefined) || ms(f.createdAt);
    const pool = replies.filter((r) => r.country === f.country && !taken.has(`${f.chairName}|${r.id}`));
    if (pool.length === 0 || !Number.isFinite(at)) continue;
    const hit = pool.reduce((best, r) => (Math.abs(ms(r.timestamp) - at) < Math.abs(ms(best.timestamp) - at) ? r : best));
    if (Math.abs(ms(hit.timestamp) - at) > 5 * 60_000) continue;
    taken.add(`${f.chairName}|${hit.id}`);
    (hit.notes ??= []).push({
      id: f.id,
      chairName: f.chairName,
      content: f.content.trim(),
      ratings: Object.entries(f.factorScores ?? {})
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .map(([id, value]) => ({ id, value })),
    });
  }
}

// ── Which segment a caucus motion opens ──────────────────────────────────────
const OPENS: Partial<Record<PendingMotionType, { kind: SegmentKind; accepts: string[] }>> = {
  moderated: { kind: 'moderated-caucus', accepts: ['moderated-caucus'] },
  unmoderated: { kind: 'unmoderated-caucus', accepts: ['unmoderated-caucus'] },
  consultation: { kind: 'consultation', accepts: ['unmoderated-caucus'] },
  // An A-Z / Z-A tour logs its turns as moderated-caucus; a Room Order tour credits
  // everyone once as tour-de-table when it ends.
  tour: { kind: 'tour-de-table', accepts: ['moderated-caucus', 'tour-de-table'] },
};

/**
 * The debate the committee is IN right now, as a segment kind and topic, or null when it is
 * not debating (roll call, voting, suspended, ended). Mirrors `liveCaucus` in the comment
 * dock: phase and caucus must agree before it is a caucus.
 */
export function liveSegment(committee: Committee): { kind: SegmentKind; topic: string } | null {
  if (committee.endedAt || committee.suspendedAt) return null;
  if (committee.phase === 'speakers-list') return { kind: 'speakers-list', topic: committee.topic ?? '' };
  const c = committee.caucus;
  if (!c) return null;
  if (committee.phase === 'unmoderated-caucus') {
    return { kind: c.isConsultation ? 'consultation' : 'unmoderated-caucus', topic: c.purpose || '' };
  }
  if (committee.phase === 'moderated-caucus') {
    const tour = (c.purpose ?? '').startsWith('Tour de Table');
    return { kind: tour ? 'tour-de-table' : 'moderated-caucus', topic: tour ? '' : (c.purpose || '') };
  }
  return null;
}

// Speech before any other event at the same instant, and a pass (which may open a segment)
// after both: the speech a caucus interrupted is stamped in the same millisecond as the pass
// at times, and it belongs to the segment the caucus replaces.
const TIE_RANK = (type: string) => (type === 'speech' ? 0 : type === 'motion-passed' ? 2 : 1);

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
    .sort((a, b) => (a.e.timestamp || '').localeCompare(b.e.timestamp || '')
      || TIE_RANK(a.e.type ?? 'speech') - TIE_RANK(b.e.type ?? 'speech') || a.i - b.i)
    .map(({ e }) => e);

  const segments: HistorySegment[] = [];
  const allSpeeches: HistorySpeech[] = [];
  const replies: HistoryEvent[] = [];
  const motionLines = new Map<string, HistoryEvent>();
  let pending: HistoryEvent[] = [];
  let currentKey = '';
  /** Set while the newest segment was opened by a caucus motion: the speech contexts it takes. */
  let accepts: string[] | null = null;
  let n = 0;

  const newSegment = (id: string, kind: SegmentKind, topic: string, stamp: string): HistorySegment => ({
    id, kind, topic, startedAt: stamp, endedAt: stamp,
    speeches: [], events: [], totalSeconds: 0, speakerCount: 0,
  });
  const place = (row: HistoryEvent) => {
    const seg = segments[segments.length - 1];
    if (seg) { seg.events.push(row); if (row.timestamp) seg.endedAt = row.timestamp; }
    else pending.push(row);
  };
  const motionOf = (e: LedgerEvent, status: MotionStatus): HistoryMotion => ({
    motionId: e.motionId, motionType: e.motionType, topic: (e.topic ?? '').trim() || undefined,
    totalTime: e.totalTime, speakingTime: e.speakingTime, tourOrder: e.tourOrder, status,
  });
  const motionLine = (e: LedgerEvent, status: MotionStatus, legacy = false): HistoryEvent => ({
    id: `mo-${n++}`, type: 'motion', country: e.country, timestamp: e.timestamp ?? '',
    motion: { ...motionOf(e, status), ...(legacy ? { legacy: true } : {}) },
  });

  for (const e of events) {
    const type = e.type ?? 'speech';
    const stamp = e.timestamp ?? '';
    if (type === 'speech') {
      const context = e.context ?? 'speakers-list';
      const topic = (e.topic ?? '').trim();
      const key = `${context}|${topic}`;
      let seg = segments[segments.length - 1];
      const joinsOpened = !!seg && !!accepts && accepts.includes(context);
      if (!seg || (!joinsOpened && (accepts || key !== currentKey))) {
        seg = newSegment(`${context}|${topic}|${stamp || n}`, kindOf(context), topic, stamp);
        segments.push(seg);
        currentKey = key;
        accepts = null;
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
    } else if (type === 'motion-raised') {
      // No motionId = a legacy row, written when a caucus motion was ACCEPTED.
      const line = e.motionId ? motionLine(e, 'pending') : motionLine(e, 'passed', true);
      if (e.motionId) motionLines.set(e.motionId, line);
      place(line);
    } else if (type === 'motion-passed' || type === 'motion-failed') {
      const status: MotionStatus = type === 'motion-passed'
        ? 'passed'
        : (e.outcome === 'rejected' || e.outcome === 'fell' ? e.outcome : 'failed');
      let line = e.motionId ? motionLines.get(e.motionId) : undefined;
      if (line?.motion) line.motion.status = status;
      else {
        // Raised before motions were logged (or its raise never landed): the outcome draws
        // the line on its own, in the segment it happened in.
        line = motionLine(e, status);
        if (e.motionId) motionLines.set(e.motionId, line);
        place(line);
      }
      const opens = type === 'motion-passed' && e.motionType ? OPENS[e.motionType] : undefined;
      if (opens) {
        // Motions raised before anything was logged were raised on the General Speakers'
        // List (roll call has no motions): give them that segment rather than filing them
        // under the caucus they led to.
        if (pending.length) {
          const gsl = newSegment(`speakers-list||${pending[0].timestamp || n++}`, 'speakers-list', committee.topic ?? '', pending[0].timestamp);
          gsl.events.push(...pending);
          gsl.endedAt = pending[pending.length - 1].timestamp;
          segments.push(gsl);
          pending = [];
        }
        const seg = newSegment(`motion|${e.motionId || stamp || n++}`, opens.kind, (e.topic ?? '').trim(), stamp);
        seg.motion = line.motion;
        segments.push(seg);
        accepts = opens.accepts;
        currentKey = '';
      }
    } else if (type === 'motion-edited') {
      // Same motion under a new id (an edit, or Undo after it fell): update the original line.
      const line = e.prevMotionId ? motionLines.get(e.prevMotionId) : undefined;
      if (line?.motion) {
        Object.assign(line.motion, motionOf(e, 'pending'));
        if (e.motionId) motionLines.set(e.motionId, line);
      } else {
        const fresh = motionLine(e, 'pending');
        if (e.motionId) motionLines.set(e.motionId, fresh);
        place(fresh);
      }
    } else {
      const row: HistoryEvent = {
        id: `ev-${n++}`, type, country: e.country, timestamp: stamp,
        value: e.value, note: e.note,
      };
      if (type === 'right-of-reply') replies.push(row);
      place(row);
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
      speeches: [], events: pending, totalSeconds: 0, speakerCount: 0,
    });
  }

  // THE ROOM IS AHEAD OF THE LOG. A caucus accepted by an older client wrote no opener, and
  // the GSL a caucus returns to logs nothing until its first speech. The debate the room is
  // in now always gets a segment, newest, so the History never files it under the previous
  // one and the comment dock always has a section for the delegation on the floor.
  const live = liveSegment(committee);
  if (live) {
    const newest = segments[segments.length - 1];
    const same = !!newest && (newest.kind === live.kind
      // A legacy caucus segment is keyed off its speeches' context, which cannot tell a
      // consultation or a tour from an ordinary caucus.
      || (newest.kind === 'unmoderated-caucus' && live.kind === 'consultation')
      || (newest.kind === 'moderated-caucus' && live.kind === 'tour-de-table'))
      && (!newest.topic || !live.topic || newest.topic === live.topic || live.kind === 'speakers-list');
    if (!same && (segments.length > 0 || live.kind !== 'speakers-list')) {
      segments.push({
        ...newSegment(`live|${live.kind}|${live.topic}|${newest?.id ?? ''}`, live.kind, live.topic, ''),
        live: true,
      });
    }
  }

  // Still on the floor, or gone without a word: the committee's own pending list decides.
  const onFloor = new Set((committee.pendingMotions ?? []).map((m) => m.id));
  for (const line of motionLines.values()) {
    if (line.motion?.status === 'pending' && line.motion.motionId && !onFloor.has(line.motion.motionId)) {
      // An edit re-keyed the line: any of its ids still on the floor keeps it pending.
      const ids = [...motionLines.entries()].filter(([, l]) => l === line).map(([id]) => id);
      if (!ids.some((id) => onFloor.has(id))) line.motion.status = 'unknown';
    }
  }

  attachNotes(allSpeeches, feedback);
  attachReplyNotes(replies, feedback);

  for (const seg of segments) {
    seg.speakerCount = new Set(seg.speeches.map((s) => s.country)).size;
    seg.events.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  }

  // Newest first: the segment the committee is in (or just left) is the one a
  // chair wants open, and it is the one the tab expands by default.
  return segments.reverse();
}

/**
 * The chair notes of every speech, keyed the way a ledger speech row can find
 * them: `speechKey(country, timestamp, context, seconds)`. Both sides come out
 * of the same `parseLedgerEvents` stream, so a speech and its ledger row carry
 * the identical timestamp, context and seconds.
 *
 * This is what lets a delegation's profile print a note beside the speech it was
 * written on without a second matching rule: the notes were already placed by
 * `attachNotes` above, once, for the whole session.
 */
export function speechKey(country: string, timestamp: string, context: string | undefined, seconds: number | undefined): string {
  return `${country}|${timestamp}|${context ?? 'speakers-list'}|${Math.max(0, Math.round(seconds ?? 0))}`;
}

