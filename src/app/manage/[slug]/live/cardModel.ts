// ─────────────────────────────────────────────────────────────────────────────
// The two axes of a live-status card.
//
//   STATUS  answers "is anyone actually in that room right now"
//   PHASE   answers "what are they doing"
//
// This split is not new to Gavelling — the staff board states it at
// `src/app/admin/LiveCommitteesTab.tsx:22-25` and implements it at `:100-103`
// with a 15-minute idle cut. This page shipped only the phase axis, so
// "In session" meant nothing more than `phase !== 'pre-session'`: a chair who
// opened a room at 09:00 and walked out at 09:05 still read "In session" at
// noon. Everything below exists to put the missing axis back.
//
// Everything here is a pure function of a `LiveCommittee` plus `now`, so it can
// be exercised head-to-head against real database rows without a browser.
// ─────────────────────────────────────────────────────────────────────────────

import { NEU } from '@/components/neu';
import {
  type LiveCommittee, cardStatus, presence, votingBody, fmtClock,
} from './LiveModals';
import {
  activeCaucus, isConsultation, isTourDeTable, isRoomOrderTour,
  liveCaucusSeconds, cardVariant,
} from './PhaseVariants';
import { speakerRemainingNow } from '@/lib/committeeService';

// ── Local colour + type tokens ───────────────────────────────────────────────
//
// The palette lives in ./tokens with the contrast measurements that justify it.
// Re-exported here so a consumer needs one import, not two.

export { SOFT, AMBER_INK, GREEN_INK, RED, HAIRLINE } from './tokens';
import { SOFT, AMBER_INK, GREEN_INK, RED, HAIRLINE } from './tokens';

// ── Activity ─────────────────────────────────────────────────────────────────

/** Most recent moment this room demonstrably did something.
 *
 *  `GREATEST(committees.updated_at, max(messages.created_at))`, widened with the
 *  timestamps the correctness pass already carries (ledger payloads, the speaker
 *  anchor, document submissions, chair feedback).
 *
 *  `committees.updated_at` alone is NOT enough and must never be used alone.
 *  Its trigger (`committees_updated_at_trigger`, BEFORE UPDATE ON committees)
 *  fires only on a write to the `committees` ROW — a phase change, a caucus
 *  blob, a settings edit. A room can run a full hour of speakers, with every
 *  tick landing in `current_speaker` and every logged speech landing in
 *  `messages`, without touching `committees` once. That is precisely why the
 *  message ledger has to be paired with it. */
export function lastActiveAt(lc: LiveCommittee): number | null {
  const candidates = [
    lc.session?.updatedAt ?? null,
    lc.lastMessageAt,
    lc.lastActivityAt,
  ]
    .filter((t): t is string => !!t)
    .map((t) => Date.parse(t))
    .filter((n) => Number.isFinite(n));
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

/** Minutes since the room last showed a sign of life, or null when it never has. */
export function idleMinutes(lc: LiveCommittee, now: number): number | null {
  const t = lastActiveAt(lc);
  if (t === null) return null;
  return Math.max(0, (now - t) / 60000);
}

/** A room has been quiet long enough that its own state is no longer credible. */
export const STALLED_MINUTES = 20;
/** Quiet, but plausibly just a long speech or a reading period. */
export const IDLE_MINUTES = 8;

// ── Status ───────────────────────────────────────────────────────────────────

export type RoomStatus =
  | 'live' | 'idle' | 'stalled' | 'suspended' | 'not-started' | 'ended';

/** The colour, the rail and the sort key. Deliberately NOT the phase.
 *
 *  Built on top of the correctness pass's `cardStatus`, which is kept intact —
 *  it still separates a first roll call from a resume, and `BroadcastComposer`
 *  keys its target list off it. The phase-shaped answers it gives
 *  ('roll-call' / 'resumed' / 'live') all collapse to "on the floor" here, and
 *  the idle clock decides which of live / idle / stalled that really means. */
export function roomStatus(lc: LiveCommittee, now: number): RoomStatus {
  const base = cardStatus(lc);
  if (base === 'ended') return 'ended';
  if (base === 'suspended') return 'suspended';
  if (base === 'no-session' || base === 'not-started') return 'not-started';
  const idle = idleMinutes(lc, now);
  // No timestamp at all on a room the phase says is running: we cannot claim it
  // is live, and it is not a room that was never opened either. Treat unknown
  // as stalled — the honest reading, and the one that puts it where a human
  // will look at it.
  if (idle === null) return 'stalled';
  if (idle > STALLED_MINUTES) return 'stalled';
  if (idle > IDLE_MINUTES) return 'idle';
  return 'live';
}

export interface StatusMeta {
  /** The status WORD. Colour is never the only signal. */
  label: string;
  /** Rail + dot. */
  color: string;
  /** Text colour for the label — never `color` itself for amber or muted. */
  ink: string;
  /** True for the one status that pulses. */
  pulse?: boolean;
}

export const STATUS_META: Record<RoomStatus, StatusMeta> = {
  // The rail and the dot are NEU.green; the WORD is GREEN_INK. `NEU.green` is
  // 4.30:1 as 11px text and fails AA — it clears the 3:1 bar as a rail only.
  live: { label: 'Live', color: NEU.green, ink: GREEN_INK, pulse: true },
  idle: { label: 'Idle', color: NEU.muted, ink: SOFT },
  // Amber earns the rail and the glyph; the WORD is written in a darker amber
  // that actually passes. `NEU.amber` as text is 2.74:1.
  stalled: { label: 'Stalled', color: NEU.amber, ink: AMBER_INK },
  suspended: { label: 'Suspended', color: RED, ink: RED },
  'not-started': { label: 'Not started', color: HAIRLINE, ink: SOFT },
  ended: { label: 'Adjourned', color: NEU.forest, ink: NEU.forest },
};

/** "live" while a room is warm; "quiet 14m" once it is not. Deliberately
 *  reported next to the status word rather than instead of it. */
export function idleLabel(lc: LiveCommittee, now: number): string {
  const status = roomStatus(lc, now);
  if (status === 'not-started') return 'never opened';
  // A gavelled-out room is not "quiet" — it is finished. Report WHEN, not how
  // long it has been silent since.
  if (status === 'ended') {
    const t = lc.session?.endedAt ? Date.parse(lc.session.endedAt) : NaN;
    return Number.isFinite(t) ? `closed ${fmtSpan((now - t) / 60000)} ago` : 'closed';
  }
  const mins = idleMinutes(lc, now);
  if (mins === null) return 'no activity on record';
  if (status === 'live') return 'live';
  return `quiet ${fmtSpan(mins)}`;
}

/** Compact, honest duration: 14m · 3h · 2d. Never "0m". */
export function fmtSpan(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

// ── Warnings ─────────────────────────────────────────────────────────────────

/** The ONLY things allowed in the warning slot. Anything else belongs in the
 *  facts strip or in the modal — a warning row that cries about ordinary state
 *  is a warning row nobody reads. */
export type WarningId =
  | 'below-quorum' | 'no-chair' | 'stalled' | 'caucus-overrun'
  | 'unresolved-dr' | 'stuck-resume';

export interface CardWarning {
  id: WarningId;
  text: string;
  /** 'red' = someone must act now; 'amber' = someone should look. */
  tone: 'red' | 'amber';
}

const QUORUM_FRACTION: Record<string, number> = {
  none: 0, '1-4': 1 / 4, '1-3': 1 / 3, '1-2': 1 / 2,
};

/** Quorum, computed exactly as the chair console computes it
 *  (`chair/[code]/page.tsx:2628-2632`): observers excluded from BOTH sides.
 *
 *  In production only 13 of 509 committees set `quorumThreshold` at all, and
 *  the default is 'none', so this warning is silent for almost every room —
 *  which is correct. A committee with no quorum rule cannot be below quorum. */
export function belowQuorum(lc: LiveCommittee): { below: boolean; present: number; total: number } {
  const body = votingBody(lc);
  const total = body.length;
  const present = body.filter((d) => d.status !== 'absent').length;
  const fraction = QUORUM_FRACTION[lc.session?.quorumThreshold ?? 'none'] ?? 0;
  return { below: fraction > 0 && total > 0 && present / total < fraction, present, total };
}

/** How long a resume claim may sit before it reads as a stuck latch.
 *
 *  `resuming_chair` is a one-shot lock, and `startResumeRollCall` is the only
 *  thing that clears it on the success path (AGENTS.md, FEATURE: SUSPEND
 *  DEBATE). If that second write fails, the latch stays set and NO chair can
 *  ever resume that committee again — a real deadlock users have hit. This
 *  surfaces it to the secretariat instead of leaving a chair to discover a dead
 *  button.
 *
 *  MEASURED AGAINST `updated_at`, NOT `suspended_at`. There is no claim
 *  timestamp anywhere, and `suspended_at` is when the room was suspended, which
 *  can be hours before a chair presses Resume — using it would fire on every
 *  normal resume of a long break. `claimResumeSession` writes `resuming_chair`
 *  onto the `committees` row, so the row's own `updated_at` IS the claim
 *  instant, and a successful follow-up would have bumped it again while
 *  clearing the latch. Three minutes is generous for two consecutive writes. */
const STUCK_RESUME_MINUTES = 3;

export function cardWarnings(lc: LiveCommittee, now: number): CardWarning[] {
  const out: CardWarning[] = [];
  const s = lc.session;
  if (!s) return out;
  const status = roomStatus(lc, now);

  if (status === 'suspended') {
    if (s.resumingChair && s.updatedAt) {
      const mins = (now - Date.parse(s.updatedAt)) / 60000;
      if (Number.isFinite(mins) && mins > STUCK_RESUME_MINUTES) {
        out.push({
          id: 'stuck-resume', tone: 'red',
          text: `${firstName(s.resumingChair)} claimed the resume ${fmtSpan(mins)} ago and it never completed — no chair can resume this room`,
        });
      }
    }
    return out;
  }
  if (status === 'not-started' || status === 'ended') return out;

  if (status === 'stalled') {
    const mins = idleMinutes(lc, now);
    out.push({
      id: 'stalled', tone: 'red',
      text: mins === null
        ? 'Marked in session but has never shown any activity'
        : `Nothing has happened in this room for ${fmtSpan(mins)}`,
    });
  }

  if (s.chairNames.length === 0) {
    out.push({ id: 'no-chair', tone: 'red', text: 'No chair has joined this session' });
  }

  const q = belowQuorum(lc);
  if (q.below) {
    out.push({ id: 'below-quorum', tone: 'red', text: `Below quorum · ${q.present}/${q.total} present` });
  }

  const caucus = activeCaucus(s);
  if (caucus && liveCaucusSeconds(caucus, now) <= 0) {
    out.push({ id: 'caucus-overrun', tone: 'amber', text: 'Caucus clock has run out' });
  }

  if (lc.documents.some((d) => d.type === 'draft-resolution' && d.status === 'introduced')) {
    out.push({ id: 'unresolved-dr', tone: 'amber', text: 'A draft resolution is on the floor unresolved' });
  }

  return out;
}

// ── Sorting: urgency, not the alphabet ───────────────────────────────────────

/** Stalled → Suspended → warned → Live → Idle → Roll call → Not started → Ended.
 *  The rooms that need feet go to the top; `.order('name')` put them wherever
 *  the alphabet happened to leave them. */
export function urgencyRank(lc: LiveCommittee, now: number): number {
  const status = roomStatus(lc, now);
  if (status === 'stalled') return 0;
  if (status === 'suspended') return 1;
  if (status === 'ended') return 7;
  if (status === 'not-started') return 6;
  if (cardWarnings(lc, now).length > 0) return 2;
  // A room still taking attendance is on the floor but is not yet doing the
  // thing anyone needs to watch.
  const base = cardStatus(lc);
  if (base === 'roll-call' || base === 'resumed') return 5;
  return status === 'live' ? 3 : 4;
}

export function sortByUrgency(rows: LiveCommittee[], now: number): LiveCommittee[] {
  return [...rows].sort((a, b) =>
    urgencyRank(a, now) - urgencyRank(b, now)
    || a.conf.name.localeCompare(b.conf.name));
}

// ── Chair names ──────────────────────────────────────────────────────────────

/** Title-case a name token. 9 of 153 production `display_chairs` entries are
 *  all-lowercase and 11 are all-uppercase; printing them raw makes a dais look
 *  like a database dump. Anything already mixed-case ("McTavish", "van Dijk")
 *  is left exactly as typed. */
export function titleCase(token: string): string {
  if (!token) return token;
  const isFlat = token === token.toLowerCase() || token === token.toUpperCase();
  if (!isFlat) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/** First name only. 139 of 153 production entries have two or more words;
 *  single-token entries are already first-name-only and pass through. */
export function firstName(full: string): string {
  const tok = (full ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? '';
  return titleCase(tok);
}

/** The dais, as first names.
 *
 *  Precedence is the one the existing `chairs` assembly already establishes:
 *  `display_chairs[].name` (the conference's own roster), falling back to the
 *  `profiles.display_name` resolved from `chair_user_ids`. Both are folded into
 *  `conf.chairs` upstream, so this reads that.
 *
 *  `committees.chair_names[]` is DELIBERATELY not used: 41% of its entries are
 *  a single arbitrary token and the join page will happily put a raw email
 *  address in there. It is a session join log, not a roster. */
export function chairFirstNames(lc: LiveCommittee): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of lc.conf.chairs) {
    const n = firstName(c.name ?? '');
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out;
}

// ── The now-playing panel ────────────────────────────────────────────────────
//
// ONE panel, ONE fixed footprint, on every card in every state — including the
// states where nothing at all is happening. Spotify does not collapse its
// now-playing bar when the queue runs out; it says "Nothing playing". That
// constancy is the whole point. It is what lets a reader sweep twenty rooms and
// always find the live fact in the same place, and it is what keeps every card
// in a row the same height without a per-stage layout variant.
//
// The anatomy is borrowed deliberately:
//
//   art       the delegation's flag, or a stage glyph when no ONE delegation is
//             the subject of what is happening
//   context   the "album" — the procedural frame, secondary and smaller:
//             General Speakers' List · Moderated caucus — Climate finance ·
//             Consultation of the Whole · Voting procedure · Roll call
//   headline  the "track" — the delegation holding the floor, the largest type
//             on the card after the committee's own name
//   meter     the "scrubber" — elapsed on the left, remaining on the right, a
//             fill in between. ALWAYS derived from the stored anchor
//             (`current_speaker.started_at`, `caucus.totalStartedAt`) and never
//             counted down from a stored number (AGENTS.md RULE 3/4). Nothing
//             on this page writes to the database.
//
// The stage decides what this panel SAYS. It never decides which regions the
// card has — four layout variants are what produced the unequal heights this
// grid was rebuilt to fix.

export type NowPlayingKind =
  | 'motion' | 'speaker' | 'caucus' | 'tour' | 'voting'
  | 'roll-call' | 'idle-floor' | 'suspended' | 'not-started' | 'ended';

/** Which glyph fills the art slot when no single delegation is the subject. */
export type NowGlyph = 'gavel' | 'mic' | 'timer' | 'users' | 'ballot' | 'pause' | 'closed' | 'dormant';

/** `live` = a clock or a process is genuinely running. `warn` = running out,
 *  paused, or waiting on a human. `off` = nothing is happening, said plainly. */
export type NowTone = 'live' | 'warn' | 'off';

export interface NowPlaying {
  kind: NowPlayingKind;
  /** Secondary line. The procedural frame. */
  context: string;
  /** Primary line. Never empty — an honest absence is still a headline. */
  headline: string;
  /** Country whose flag fills the art slot; null → `glyph`. */
  flag: string | null;
  glyph: NowGlyph;
  tone: NowTone;
  /** True when the headline states an ABSENCE rather than names a subject, so
   *  the card can render it in SOFT instead of ink. Never used to hide it. */
  dim: boolean;
  /** Meter fill 0…100, or null when there is genuinely nothing to measure. A
   *  null meter renders as an empty track, not as a hidden one. */
  pct: number | null;
  /** Caption at the reading-start end of the track. */
  left: string;
  /** Caption at the reading-end end of the track — the number people look for. */
  right: string;
  /** Who is still waiting, EXCLUDING anyone `headline` already names.
   *
   *  `label` states WHICH list this is. RULE 1: the General Speakers' List and
   *  the caucus queue are strictly separate and must never be reported as one
   *  number, so the panel always says which one it is counting. */
  next: { label: string; names: string[]; more: number } | null;
}

/** Up to two names off a queue, plus however many are left behind them.
 *  `skip` drops the delegations the headline has already named. */
function upNext(label: string, queue: string[], skip: number): NowPlaying['next'] {
  const rest = queue.slice(skip);
  if (rest.length === 0) return null;
  return { label, names: rest.slice(0, 2), more: Math.max(0, rest.length - 2) };
}

// ── Motions: what can and cannot be known ────────────────────────────────────
//
// THE FINDING, WRITTEN DOWN SO NOBODY RE-DERIVES IT.
//
// There is NO stored signal anywhere that separates "a motion is being voted on
// right now" from "a motion is sitting on the chair's desk". Specifically:
//
//   • `motions.status` is `text NOT NULL DEFAULT 'pending'` and NOTHING in the
//     codebase ever updates it. Every write to the table is an INSERT or a hard
//     DELETE (`committeeService.ts:672, 683, 688, 846, 851, 884, 889`). All nine
//     production rows read 'pending'.
//   • Accepting a motion and rejecting one both end in `.delete()`, so a ruled
//     motion leaves no row and no timestamp behind. The `motion-raised` ledger
//     event survives an ACCEPT only.
//   • The chair "voting on a motion" is `ModalView === 'vote'` — React state
//     inside `MotionsModal.tsx:27, 1105`. It is never persisted, never
//     broadcast, and never lands in any column this page can read.
//
// So the honest reading is narrower than "being decided", and this surface says
// only what it can prove: a motion row that still EXISTS is a motion no chair
// has ruled on, and `created_at` is the only field on it that moves. A row
// raised moments ago, in a room that is demonstrably awake, is the closest a
// database read can come to "the chair is at the motions modal right now" — so
// that, and only that, is what takes the panel over. The copy says "Motion on
// the floor · awaiting the chair's ruling", not "being voted on", because the
// second claim is not available.
//
// A motion older than the window is deliberately shown NOWHERE on the card. The
// owner's instruction was explicit: a pending count is not information.

/** How long an unruled motion counts as the thing currently happening.
 *
 *  Five minutes. A chair entertains a motion, reads it out and rules within a
 *  minute or two in practice; five gives a stacked "entertaining motions" run
 *  room to breathe without letting a forgotten row squat on the panel. */
export const MOTION_LIVE_MINUTES = 5;

export interface FloorMotion {
  /** "10-minute moderated caucus — Climate finance" */
  label: string;
  /** The delegation that moved it, or '' when the row does not name one. */
  proposedBy: string;
  ageSeconds: number;
}

const MOTION_NOUNS: Record<string, string> = {
  moderated: 'moderated caucus',
  unmoderated: 'unmoderated caucus',
  consultation: 'Consultation of the Whole',
  tour: 'Tour de Table',
};

/** A motion row as a sentence a person can read out.
 *
 *  `topic` is overloaded by the schema: it is the caucus purpose on a moderated
 *  caucus, the optional free-text name on a custom motion, and a JSON blob on
 *  the two pseudo-types — which never reach here, because the page filters
 *  `join-request` and `gsl-request` out at the read. */
export function motionLabel(m: LiveCommittee['pendingMotions'][number]): string {
  const topic = (m.topic ?? '').trim();
  if (m.type === 'suspend-debate') return 'Motion to suspend debate';
  if (m.type === 'end-debate') return 'Motion to end debate';
  if (m.type === 'custom') return topic || 'A custom motion';
  const noun = MOTION_NOUNS[m.type] ?? 'motion';
  const mins = m.totalTime > 0 ? Math.round(m.totalTime / 60) : 0;
  const head = mins > 0 ? `${mins}-minute ${noun}` : noun;
  return topic && m.type === 'moderated' ? `${head} — ${topic}` : head;
}

/** The freshest unruled motion, when the room is awake and the row is recent
 *  enough to be the thing currently happening. Otherwise null. */
export function motionOnTheFloor(lc: LiveCommittee, now: number): FloorMotion | null {
  // A stalled or idle room is not deciding anything; a row sitting in one is
  // abandoned, not live.
  if (roomStatus(lc, now) !== 'live') return null;
  let best: FloorMotion | null = null;
  for (const m of lc.pendingMotions) {
    if (!m.createdAt) continue;
    const t = Date.parse(m.createdAt);
    if (!Number.isFinite(t)) continue;
    const age = (now - t) / 1000;
    // Clock skew between the database and the browser can make a brand-new row
    // read as slightly in the future. Treat that as "just now", not as invalid.
    if (age > MOTION_LIVE_MINUTES * 60) continue;
    const ageSeconds = Math.max(0, age);
    if (!best || ageSeconds < best.ageSeconds) {
      best = { label: motionLabel(m), proposedBy: (m.proposedBy ?? '').trim(), ageSeconds };
    }
  }
  return best;
}

/** "45s ago" / "3m ago". Seconds resolution for the first minute, because a
 *  motion raised eleven seconds ago and one raised fifty are different rooms. */
export function fmtAgo(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s}s ago` : `${fmtSpan(s / 60)} ago`;
}

/** THE PANEL. One pure function of the row and the page's clock. */
export function nowPlaying(lc: LiveCommittee, now: number): NowPlaying {
  const s = lc.session;
  if (!s) {
    return {
      kind: 'not-started', context: 'No session',
      headline: 'No live session linked yet', flag: null, glyph: 'dormant',
      tone: 'off', dim: true, pct: null,
      left: 'never opened', right: 'nothing to show', next: null,
    };
  }

  const base = cardStatus(lc);

  // ── Adjourned ──
  if (base === 'ended') {
    const passed = lc.documents.filter((d) => d.status === 'passed');
    const drs = passed.filter((d) => d.type === 'draft-resolution').length;
    const wps = passed.length - drs;
    const bits: string[] = [];
    if (drs > 0) bits.push(`${drs} resolution${drs === 1 ? '' : 's'} passed`);
    if (wps > 0) bits.push(`${wps} working paper${wps === 1 ? '' : 's'} passed`);
    const t = s.endedAt ? Date.parse(s.endedAt) : NaN;
    return {
      kind: 'ended', context: 'Adjourned',
      headline: bits.length > 0 ? bits.join(' · ') : 'Nothing passed',
      flag: null, glyph: 'closed', tone: 'off', dim: bits.length === 0, pct: null,
      left: Number.isFinite(t) ? `closed ${fmtSpan((now - t) / 60000)} ago` : 'closed',
      right: 'session closed', next: null,
    };
  }

  // ── Suspended ──
  if (base === 'suspended') {
    const mins = s.suspendedAt ? (now - Date.parse(s.suspendedAt)) / 60000 : NaN;
    return {
      kind: 'suspended', context: 'Suspended',
      headline: s.resumingChair
        ? `${firstName(s.resumingChair)} is resuming`
        : 'Waiting for a chair to resume',
      flag: null, glyph: 'pause', tone: 'warn', dim: !s.resumingChair, pct: null,
      left: Number.isFinite(mins) ? `suspended ${fmtSpan(mins)}` : 'suspended',
      right: 'no debate in progress', next: null,
    };
  }

  // ── Never opened ──
  if (base === 'no-session' || base === 'not-started') {
    return {
      kind: 'not-started', context: 'Not opened yet',
      headline: lc.conf.chairs.length > 0 ? 'Chairs have the code' : 'No chair assigned yet',
      flag: null, glyph: 'dormant', tone: 'off', dim: true, pct: null,
      left: 'never opened',
      right: lc.conf.sessionCode ? `code ${lc.conf.sessionCode}` : 'no session code',
      next: null,
    };
  }

  // ── A motion the chair has not ruled on ──
  // The ONE thing allowed to displace the floor, and only while it is fresh.
  // See the block comment above for exactly how much this can and cannot claim.
  const motion = motionOnTheFloor(lc, now);
  if (motion) {
    // Only flag a proposer this room can vouch for. `proposed_by` also carries
    // chair names and free text, and `flagCodeFor` would answer a globe for both.
    const isDelegation = !!motion.proposedBy
      && lc.delegates.some((d) => d.country === motion.proposedBy);
    return {
      kind: 'motion', context: 'Motion on the floor',
      headline: motion.label,
      flag: isDelegation ? motion.proposedBy : null,
      glyph: 'gavel', tone: 'warn', dim: false, pct: null,
      left: motion.proposedBy
        ? `moved by ${motion.proposedBy} · ${fmtAgo(motion.ageSeconds)}`
        : `raised ${fmtAgo(motion.ageSeconds)}`,
      right: "awaiting the chair's ruling", next: null,
    };
  }

  // ── Roll call ──
  if (base === 'roll-call' || base === 'resumed') {
    const { present, total } = presence(lc);
    return {
      kind: 'roll-call',
      context: base === 'resumed' ? 'Roll call · resuming after a break' : 'Roll call',
      // 286 of 392 production committees have zero delegate rows, so
      // "0 of 0 marked present" is the common case and says nothing.
      headline: total > 0 ? `${present} of ${total} marked present` : 'No delegates have joined yet',
      flag: null, glyph: 'users', tone: 'live', dim: total === 0,
      pct: total > 0 ? (present / total) * 100 : null,
      left: total > 0 ? `${present} present` : 'empty roll',
      right: total > 0 ? `${total} delegations` : 'waiting for delegates', next: null,
    };
  }

  // ── A caucus the PHASE confirms ──
  const caucus = activeCaucus(s);
  if (caucus) {
    const totalSecs = Math.max(0, caucus.totalTime ?? 0);
    const leftSecs = liveCaucusSeconds(caucus, now);
    const elapsed = Math.max(0, totalSecs - leftSecs);
    const running = !!caucus.totalStartedAt;
    const expired = totalSecs > 0 && leftSecs <= 0;
    // RULE 1: this is the CAUCUS queue. It is never the GSL, and the captions
    // below say which one they are counting.
    const qn = lc.caucusQueue.length;

    // The delegation on the floor during a caucus lives on the caucus blob;
    // `current_speaker` holds the same delegation once the chair has advanced
    // through it, and is the row that carries the clock anchor.
    const floorCountry = (caucus.currentSpeaker ?? '').trim()
      || (lc.currentSpeaker?.country ?? '').trim();
    const anchored = lc.currentSpeaker
      && (lc.currentSpeaker.country ?? '').trim() === floorCountry
      && lc.currentSpeaker.startedAt
      ? lc.currentSpeaker
      : null;

    // Tour de Table — every delegation speaks once, in order. Progress through
    // the room IS the meter; spare capacity is the wrong reading.
    if (isTourDeTable(caucus)) {
      const spoken = caucus.spokenCountries?.length ?? 0;
      const speakingTime = caucus.speakingTime ?? 0;
      const capacity = speakingTime > 0 ? Math.floor(totalSecs / speakingTime) : 0;
      const seats = capacity > 0 ? capacity : spoken + qn;
      // A Room Order tour queues literal "Speaker 1".."Speaker N" placeholders
      // rather than delegations, so it counts SEATS and must never be flagged.
      const roomOrder = isRoomOrderTour(caucus);
      return {
        kind: 'tour',
        context: roomOrder ? 'Tour de Table · room order' : 'Tour de Table',
        headline: floorCountry || (qn > 0 ? `${lc.caucusQueue[0]} is next` : 'Between speakers'),
        flag: !roomOrder && floorCountry ? floorCountry : null,
        glyph: 'mic', tone: expired ? 'warn' : 'live', dim: !floorCountry,
        pct: seats > 0 ? (spoken / seats) * 100 : null,
        left: `${spoken} of ${seats} ${roomOrder ? 'seats called' : 'spoken'}`,
        right: totalSecs > 0
          ? (expired ? 'tour time is up' : `${fmtClock(leftSecs)} left`)
          : (qn > 0 ? `${qn} in the caucus queue` : 'caucus queue empty'),
        next: upNext(floorCountry ? 'Caucus queue' : 'Then in caucus', lc.caucusQueue, floorCountry ? 0 : 1),
      };
    }

    // Unmoderated / Consultation of the Whole — a block of time and nothing
    // else. A CoW is a FORMAL sitting and must not inherit the unmod's copy.
    if (caucus.type === 'unmoderated') {
      const cow = isConsultation(caucus);
      const purpose = caucus.purpose?.trim();
      return {
        kind: 'caucus',
        context: cow ? 'Consultation of the Whole' : 'Unmoderated caucus',
        headline: purpose || (cow ? 'The committee is in consultation' : 'The floor is informal'),
        flag: null, glyph: 'timer',
        tone: expired || !running ? 'warn' : 'live', dim: !purpose,
        pct: totalSecs > 0 ? (elapsed / totalSecs) * 100 : null,
        left: totalSecs > 0 ? `${fmtClock(elapsed)} of ${fmtClock(totalSecs)}` : 'no clock set',
        right: expired ? 'time is up' : running ? `${fmtClock(leftSecs)} left` : 'clock paused',
        next: null,
      };
    }

    // Moderated caucus — the topic is the album, the speaker is the track.
    const topic = caucus.purpose?.trim() || caucus.motionLabel?.trim() || '';
    const context = topic ? `Moderated caucus — ${topic}` : 'Moderated caucus';

    if (anchored) {
      // `timeRemaining` is the value AT the anchor, so it IS this speech's
      // allotment and the elapsed side is derived, never stored.
      const allotted = Math.max(0, anchored.timeRemaining);
      const secsLeft = speakerRemainingNow(anchored.timeRemaining, anchored.startedAt, now);
      const spent = Math.max(0, allotted - secsLeft);
      return {
        kind: 'caucus', context, headline: floorCountry, flag: floorCountry,
        glyph: 'mic', tone: secsLeft > 0 ? 'live' : 'warn', dim: false,
        pct: allotted > 0 ? (spent / allotted) * 100 : null,
        left: `${fmtClock(spent)} into this speech`,
        right: secsLeft > 0 ? `${fmtClock(secsLeft)} left` : 'speech time is up',
        next: upNext('Caucus queue', lc.caucusQueue, 0),
      };
    }

    return {
      kind: 'caucus', context,
      headline: floorCountry || (qn > 0 ? `${lc.caucusQueue[0]} is next` : 'Nobody on the floor'),
      flag: floorCountry || (qn > 0 ? lc.caucusQueue[0] : null),
      glyph: 'mic', tone: expired ? 'warn' : 'live', dim: !floorCountry && qn === 0,
      pct: totalSecs > 0 ? (elapsed / totalSecs) * 100 : null,
      left: qn > 0 ? `${qn} in the caucus queue` : 'caucus queue empty',
      right: expired ? 'caucus time is up' : running ? `${fmtClock(leftSecs)} left` : 'caucus clock paused',
      next: upNext(floorCountry ? 'Caucus queue' : 'Then in caucus', lc.caucusQueue, floorCountry ? 0 : 1),
    };
  }

  // ── Voting ──
  if (cardVariant(lc, now) === 'voting') {
    const dr = lc.documents.find((d) => d.type === 'draft-resolution' && d.status === 'introduced')
      ?? [...lc.documents].reverse().find((d) => d.type === 'draft-resolution');
    const body = votingBody(lc);
    const total = body.length;
    const eligible = body.filter((d) => d.status !== 'absent').length;
    return {
      kind: 'voting', context: 'Voting procedure',
      headline: dr ? (dr.docCode || dr.title || 'A draft resolution') : 'A draft resolution',
      flag: null, glyph: 'ballot', tone: 'live', dim: false,
      pct: total > 0 ? (eligible / total) * 100 : null,
      left: total > 0 ? `${eligible} of ${total} can ballot` : 'no roll on record',
      // Individual ballots are held in React state on /voting/[code] and never
      // persisted — only the verdict reaches this page. Say so rather than
      // inventing a tally.
      right: 'ballots are not stored', next: null,
    };
  }

  // ── General Speakers' List ──
  // RULE 1: this is the GSL and nothing else. The caucus queue is a separate
  // list and is never mixed into these counts.
  const queue = lc.gslQueue;
  const qn = queue.length;
  const context = "General Speakers' List";
  const speaker = lc.currentSpeaker;

  if (speaker?.country && speaker.startedAt) {
    const allotted = Math.max(0, speaker.timeRemaining);
    const secsLeft = speakerRemainingNow(speaker.timeRemaining, speaker.startedAt, now);
    const spent = Math.max(0, allotted - secsLeft);
    return {
      kind: 'speaker', context, headline: speaker.country, flag: speaker.country,
      glyph: 'mic', tone: secsLeft > 0 ? 'live' : 'warn', dim: false,
      pct: allotted > 0 ? (spent / allotted) * 100 : null,
      left: `${fmtClock(spent)} into this speech`,
      right: secsLeft > 0 ? `${fmtClock(secsLeft)} left` : 'speech time is up',
      next: upNext("Speakers' list", queue, 0),
    };
  }
  if (speaker?.country) {
    // A delegation sits in `current_speaker` with no anchor: it has the floor
    // but the clock is not running.
    return {
      kind: 'speaker', context, headline: speaker.country, flag: speaker.country,
      glyph: 'mic', tone: 'warn', dim: false, pct: null,
      left: 'timer paused',
      right: `${fmtClock(Math.max(0, speaker.timeRemaining))} on the clock`,
      next: upNext("Speakers' list", queue, 0),
    };
  }
  if (qn > 0) {
    return {
      kind: 'idle-floor', context, headline: `${queue[0]} is next`, flag: queue[0],
      glyph: 'mic', tone: 'off', dim: false, pct: null,
      left: 'nobody on the floor',
      right: `${qn} on the speakers' list`,
      next: upNext('Then on the list', queue, 1),
    };
  }
  const mins = idleMinutes(lc, now);
  const quiet = roomStatus(lc, now) !== 'live' && mins !== null;
  return {
    kind: 'idle-floor', context, headline: 'Nobody on the floor',
    flag: null, glyph: 'dormant', tone: 'off', dim: true, pct: null,
    left: "speakers' list empty",
    right: quiet ? `quiet for ${fmtSpan(mins)}` : 'waiting for the chair',
    next: null,
  };
}

// ── "What has happened" ──────────────────────────────────────────────────────
//
// The static strip under the now-playing panel. Identical on every card, in
// every state, and deliberately SMALL — the panel above it is the thing that
// changes and the thing that should dominate.
//
// TWO NUMBERS ARE GONE FROM THE CARD ON PURPOSE.
//
//   • Motion counts — pending and raised alike. A count of motions on the floor
//     is not something an organiser can act on; a motion only matters while it
//     is actually being decided, and when it is, it takes the now-playing panel
//     over instead (see `motionOnTheFloor`).
//   • Total speaking time. It is a recap number, not a preview number, and it
//     stays in the recap modal (`RecapModal`'s "Total speaking time" tile).

export interface CardFacts {
  present: number;
  total: number;
  wps: number;
  drs: number;
  drsPassed: number;
  drsFailed: number;
  chairs: string[];
}

export function cardFacts(lc: LiveCommittee): CardFacts {
  const { present, total } = presence(lc);
  const drs = lc.documents.filter((d) => d.type === 'draft-resolution');
  return {
    present,
    total,
    wps: lc.documents.filter((d) => d.type === 'working-paper').length,
    drs: drs.length,
    drsPassed: drs.filter((d) => d.status === 'passed').length,
    drsFailed: drs.filter((d) => d.status === 'failed').length,
    chairs: chairFirstNames(lc),
  };
}


// ── Committee identity ──────────────────────────────────────────────────────
//
// Lives in ./identity so `LiveModals` can use it too — this module imports
// LiveModals, so LiveModals cannot import back from here.

export {
  acronymInName, committeeIdentity, committeeIdentities, type CommitteeIdentity,
} from './identity';
