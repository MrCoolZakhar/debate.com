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
  type LiveCommittee, cardStatus, presence, votingBody, PHASE_LABELS, fmtClock,
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

// ── The answer line ──────────────────────────────────────────────────────────

export interface AnswerLine {
  /** Country whose flag leads the sentence, when one delegation is the subject. */
  flag: string | null;
  /** The sentence. One line, largest type after the name — this IS the card. */
  text: string;
}

/** The phase chip: monochrome, small, and never the thing that carries colour. */
export function phaseChip(lc: LiveCommittee): string {
  const s = lc.session;
  if (!s) return 'No session';
  // `phase` is left at whatever the room was last doing when it was gavelled
  // out or suspended, so it must not be printed for either — an adjourned room
  // captioned "General Speakers' List" reads as still sitting.
  if (s.endedAt) return 'Adjourned';
  if (s.phase === 'adjourned') return 'Suspended';
  const caucus = activeCaucus(s);
  if (caucus) {
    if (isConsultation(caucus)) return 'Consultation of the Whole';
    if (isTourDeTable(caucus)) return 'Tour de Table';
    return caucus.type === 'unmoderated' ? 'Unmoderated caucus' : 'Moderated caucus';
  }
  if (cardVariant(lc) === 'voting') return 'Voting';
  return PHASE_LABELS[s.phase] ?? s.phase;
}

/** ONE SENTENCE THAT ANSWERS "WHAT IS HAPPENING IN THAT ROOM".
 *
 *  Every branch returns something a person can act on. There is no branch that
 *  returns a bare phase name — "Pre-session" under a heading told an organiser
 *  nothing, which is the whole complaint this rewrite answers. */
export function answerLine(lc: LiveCommittee, now: number): AnswerLine {
  const s = lc.session;
  if (!s) return { flag: null, text: 'No live session linked to this committee yet' };

  const base = cardStatus(lc);

  if (base === 'ended') {
    const passed = lc.documents.filter((d) => d.status === 'passed');
    const drs = passed.filter((d) => d.type === 'draft-resolution').length;
    const wps = passed.length - drs;
    if (drs === 0 && wps === 0) return { flag: null, text: 'Adjourned · nothing passed' };
    const bits: string[] = [];
    if (drs > 0) bits.push(`${drs} resolution${drs === 1 ? '' : 's'} passed`);
    if (wps > 0) bits.push(`${wps} working paper${wps === 1 ? '' : 's'} passed`);
    return { flag: null, text: `Adjourned · ${bits.join(' · ')}` };
  }

  if (base === 'suspended') {
    const mins = s.suspendedAt ? (now - Date.parse(s.suspendedAt)) / 60000 : NaN;
    const span = Number.isFinite(mins) ? ` ${fmtSpan(mins)}` : '';
    const who = s.resumingChair
      ? `${firstName(s.resumingChair)} is resuming`
      : 'waiting for a chair to resume';
    return { flag: null, text: `Suspended${span} · ${who}` };
  }

  if (base === 'no-session' || base === 'not-started') {
    return {
      flag: null,
      text: lc.conf.chairs.length > 0
        ? 'Not opened · chairs have the code'
        : 'Not opened · no chair assigned yet',
    };
  }

  if (base === 'roll-call' || base === 'resumed') {
    const { present, total } = presence(lc);
    const tail = base === 'resumed' ? ' · resuming after a break' : '';
    // 286 of 392 production committees have ZERO delegate rows — nobody has
    // joined the session yet — so "0/0 marked present" is the common case and
    // says nothing. Name the real situation instead.
    const head = total > 0 ? `Roll call · ${present}/${total} marked present` : 'Roll call · no delegates have joined yet';
    return { flag: null, text: `${head}${tail}` };
  }

  // ── On the floor ──
  const caucus = activeCaucus(s);
  if (caucus) {
    const left = liveCaucusSeconds(caucus, now);
    const clock = left > 0 ? `${fmtClock(left)} left` : 'time is up';

    if (isTourDeTable(caucus)) {
      const spoken = caucus.spokenCountries?.length ?? 0;
      const speakingTime = caucus.speakingTime ?? 0;
      const capacity = speakingTime > 0 ? Math.floor((caucus.totalTime ?? 0) / speakingTime) : 0;
      const total = capacity > 0 ? capacity : lc.caucusQueue.length + spoken;
      // A Room Order tour queues literal "Speaker 1".."Speaker N" placeholders
      // rather than delegations (MotionsModal.tsx:1315-1318), so it counts
      // SEATS, not delegations, and must not claim otherwise.
      const noun = isRoomOrderTour(caucus) ? 'seats called' : 'spoken';
      return { flag: null, text: `Tour de Table · ${spoken} of ${total} ${noun}` };
    }
    if (caucus.type === 'unmoderated') {
      const label = isConsultation(caucus) ? 'Consultation of the Whole' : 'Unmod';
      const purpose = caucus.purpose?.trim();
      return {
        flag: null,
        text: purpose && !isConsultation(caucus)
          ? `${label} · ${purpose} · ${clock}`
          : `${label} · ${clock}`,
      };
    }
    // Moderated caucus
    const speakingTime = caucus.speakingTime ?? 0;
    const capacity = speakingTime > 0 ? Math.floor((caucus.totalTime ?? 0) / speakingTime) : 0;
    const spoken = caucus.spokenCountries?.length ?? 0;
    const topic = caucus.purpose?.trim() || caucus.motionLabel?.trim() || 'Moderated caucus';
    const slots = capacity > 0 ? ` · ${spoken}/${capacity} slots` : '';
    return { flag: null, text: `${topic} · ${clock}${slots}` };
  }

  if (cardVariant(lc, now) === 'voting') {
    const dr = lc.documents.find((d) => d.type === 'draft-resolution' && d.status === 'introduced')
      ?? [...lc.documents].reverse().find((d) => d.type === 'draft-resolution');
    const name = dr ? (dr.docCode || dr.title || 'a draft resolution') : 'a draft resolution';
    const { present, total } = presence(lc);
    // 73% of production committees have no delegate rows at all, so "0/0 in the
    // room" is a common and meaningless thing to print. Say nothing instead.
    return { flag: null, text: total > 0 ? `Voting on ${name} · ${present}/${total} in the room` : `Voting on ${name}` };
  }

  // ── General speakers list ──
  const queue = lc.gslQueue.length;
  const queueBit = queue > 0 ? ` · ${queue} in queue` : ' · queue empty';
  const speaker = lc.currentSpeaker;

  if (speaker?.country && speaker.startedAt) {
    const left = speakerRemainingNow(speaker.timeRemaining, speaker.startedAt, now);
    return {
      flag: speaker.country,
      text: `${speaker.country} speaking · ${fmtClock(left)} left${queueBit}`,
    };
  }
  if (speaker?.country) {
    // A speaker sits in `current_speaker` with no anchor: the chair has the
    // delegation on the floor but the clock is not running.
    return {
      flag: speaker.country,
      text: `${speaker.country} has the floor · timer paused${queueBit}`,
    };
  }
  if (queue > 0) {
    return { flag: lc.gslQueue[0], text: `${lc.gslQueue[0]} is next · ${queue} in queue · nobody on the floor` };
  }
  // Empty queue, nobody speaking. If the room has also gone quiet, say when it
  // stopped — that is the difference between a gap between speakers and a room
  // that has been abandoned.
  const mins = idleMinutes(lc, now);
  if (roomStatus(lc, now) !== 'live' && mins !== null) {
    return { flag: null, text: `Queue empty · nothing has happened for ${fmtSpan(mins)}` };
  }
  return { flag: null, text: 'Queue empty · nobody on the floor' };
}

// ── Facts strip ──────────────────────────────────────────────────────────────

export interface CardFacts {
  present: number;
  total: number;
  motions: number;
  /** Motions the ledger can prove were raised. See `motionsRaised`. */
  motionsRaised: number;
  wps: number;
  drs: number;
  drsPassed: number;
  drsFailed: number;
  speakingSeconds: number;
  speeches: number;
  chairs: string[];
}

/** Motions the room has raised, from the LEDGER — not from the `motions` table.
 *
 *  `motions` rows are hard-deleted on BOTH accept and reject
 *  (`committeeService.ts:683, 688, 846, 851, 884`), which is why the whole table
 *  holds about five rows across the entire platform. The `motion-raised` ledger
 *  event survives, and there are 95 of them in production.
 *
 *  THE CAVEAT MATTERS AND IS PRINTED IN THE UI: only motions a chair ACCEPTED
 *  leave a ledger entry, so this is a floor, not a total. A number whose label
 *  quietly means something narrower than it says is worse than no number. */
export function motionsRaised(lc: LiveCommittee): number {
  return lc.eventLogs.filter((e) => e.type === 'motion-raised').length;
}

/** Total time delegations have actually spent speaking. Fully derivable: every
 *  logged speech carries its own `seconds`, and all 333 production speech rows
 *  have one. */
export function speakingSeconds(lc: LiveCommittee): number {
  return lc.speechLogs.reduce((sum, l) => sum + (l.seconds || 0), 0);
}

export function cardFacts(lc: LiveCommittee): CardFacts {
  const { present, total } = presence(lc);
  const drs = lc.documents.filter((d) => d.type === 'draft-resolution');
  return {
    present,
    total,
    motions: lc.pendingMotions.length,
    motionsRaised: motionsRaised(lc),
    wps: lc.documents.filter((d) => d.type === 'working-paper').length,
    drs: drs.length,
    drsPassed: drs.filter((d) => d.status === 'passed').length,
    drsFailed: drs.filter((d) => d.status === 'failed').length,
    speakingSeconds: speakingSeconds(lc),
    speeches: lc.speechLogs.length,
    chairs: chairFirstNames(lc),
  };
}

/** "1h 12m" / "4m 20s" / "—". Mirrors `formatSpeakingTime` in
 *  `conferenceScoreboard.ts` so the two surfaces read the same. */
export function fmtSpeaking(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}


// ── Committee identity ──────────────────────────────────────────────────────
//
// Lives in ./identity so `LiveModals` can use it too — this module imports
// LiveModals, so LiveModals cannot import back from here.

export {
  acronymInName, committeeIdentity, committeeIdentities, type CommitteeIdentity,
} from './identity';
