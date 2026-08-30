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
// The per-speech countdown. Derived from the stored anchor
// (`current_speaker.started_at` + `time_remaining`) on every render, never
// counted down and never written — the same contract `liveCaucusSeconds` has.
import { speakerRemainingNow } from '@/lib/committeeService';
import {
  type LiveCommittee, cardStatus, presence, votingBody, fmtClock,
} from './LiveModals';
import {
  activeCaucus, isConsultation, isTourDeTable, isRoomOrderTour,
  liveCaucusSeconds, cardVariant,
} from './PhaseVariants';

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

// THE ELAPSED SPAN IS NO LONGER PRINTED ON THE CARD, on the owner's
// instruction. `idleLabel` used to render "quiet 44d" beneath the status word;
// the status WORD alone carries it, and a card that says "Stalled" next to
// "quiet 44d" is saying one thing twice.
//
// Staleness is untouched as a SIGNAL — it still decides `roomStatus` (and with
// it the status word and the rail colour) and it still drives `urgencyRank`,
// which is what floats a dead room to the top of the grid. Only the printed
// number went. `idleMinutes` and `fmtSpan` therefore stay exactly as they were;
// `fmtSpan` is still used by the stuck-resume warning and by the panel's own
// "suspended 20m" / "closed 3h ago" captions, where the span IS the fact rather
// than a restatement of the word beside it.

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
//
// 'unresolved-dr' is GONE, on the owner's instruction. `documents.status` is a
// one-way door — nothing clears 'introduced' except a chair resolving the vote —
// so the pill fired on every room that had ever introduced a resolution and
// never got round to recording the verdict, which is most of them. It reported a
// bookkeeping gap as a live emergency. The draft-resolution count and its
// passed/failed breakdown are still on the card's DR chip, where they are a fact
// rather than an alarm.
export type WarningId =
  | 'below-quorum' | 'no-chair' | 'caucus-overrun' | 'stuck-resume';

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

  // A "nothing has happened for Nm" warning is DELIBERATELY not raised, on the
  // owner's instruction. It restated, in a red pill, exactly what the status
  // word ("Stalled"), the rail colour, the "quiet 34m" line and the sort order
  // were already saying — four sayings of one fact, and the only one of them
  // that cost the warning slot. Staleness still drives all of those:
  // `roomStatus` keeps STALLED_MINUTES and `urgencyRank` still floats a stalled
  // room to the top of the grid. Only the redundant pill is gone.

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

  return out;
}

// ── Sorting: urgency, not the alphabet ───────────────────────────────────────

/** LIVE → STALLED → SUSPENDED → Idle → Roll call → Not started → Ended.
 *
 *  THE ORDER IS THE OWNER'S, VERBATIM: "cards should be sorted by
 *  live-stalled-suspended". It used to open Stalled → Suspended → warned → Live,
 *  i.e. an attention-first board where a room running perfectly well was ranked
 *  below one nobody had touched in an hour.
 *
 *  A WARNING IS NO LONGER A RANK OF ITS OWN. It used to be rank 2, which lifted
 *  a warned idle room above every live one and so cut across the three-word
 *  order above. It survives as the TIE-BREAK inside each rank (see
 *  `sortByUrgency`), so a live room with a warning still sits at the top of the
 *  live block — the attention is kept, the ordering is not overridden. */
export function urgencyRank(lc: LiveCommittee, now: number): number {
  const status = roomStatus(lc, now);
  if (status === 'live') return 0;
  if (status === 'stalled') return 1;
  if (status === 'suspended') return 2;
  if (status === 'ended') return 6;
  if (status === 'not-started') return 5;
  // A room still taking attendance is on the floor but is not yet doing the
  // thing anyone needs to watch.
  const base = cardStatus(lc);
  if (base === 'roll-call' || base === 'resumed') return 4;
  return 3;
}

export function sortByUrgency(rows: LiveCommittee[], now: number): LiveCommittee[] {
  const warned = (lc: LiveCommittee) => (cardWarnings(lc, now).length > 0 ? 0 : 1);
  return [...rows].sort((a, b) =>
    urgencyRank(a, now) - urgencyRank(b, now)
    || warned(a) - warned(b)
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
  | 'speaker' | 'caucus' | 'tour' | 'voting'
  | 'roll-call' | 'idle-floor' | 'suspended' | 'not-started' | 'ended';

/** Which glyph fills the art slot when no single delegation is the subject. */
export type NowGlyph = 'mic' | 'timer' | 'users' | 'ballot' | 'pause' | 'closed' | 'dormant';

/** `live` = a clock or a process is genuinely running. `warn` = running out,
 *  paused, or waiting on a human. `off` = nothing is happening, said plainly. */
export type NowTone = 'live' | 'warn' | 'off';

export interface NowPlaying {
  kind: NowPlayingKind;
  /** Secondary line. The procedural frame — the MOTION or stage NAME only, and
   *  always short: "Moderated caucus", "Unmoderated caucus", "Roll call". */
  context: string;
  /** The motion's TOPIC, split out of `context` so the card can set it on its
   *  own line directly below — smaller, and in a different (still AA-passing)
   *  ink. It used to be glued on as "Moderated caucus — Financing loss and
   *  damage adaptation…", which made one eyebrow run to four or five lines and
   *  forced the card to drop its uppercase to buy width. Null whenever the
   *  stage has no topic, which is every stage except the three caucus kinds. */
  contextTopic: string | null;
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
   *  number, so the panel always says which one it is counting — the label is
   *  what keeps a row of flags from being read as one merged queue.
   *
   *  `names` are the delegations in queue order. The card renders them as FLAGS
   *  ONLY: dropping the names is exactly what buys the room to show ten instead
   *  of two, and in a body where every delegation is a country the flag already
   *  identifies the seat. Each flag still carries its delegation as a `title`,
   *  so nothing is actually lost — only unstacked.
   *
   *  `all` is the WHOLE remaining queue, in order — `names` is its first
   *  `UP_NEXT_MAX`. The card's "+N" is a button that opens the rest, on the
   *  owner's instruction (">10 speakers add a +X and clicking could see the
   *  total"), so the tail has to survive the slice rather than be counted and
   *  thrown away. */
  next: { label: string; names: string[]; more: number; all: string[] } | null;
}

/** How many delegations the up-next column shows before it starts counting.
 *  Ten, on the owner's instruction. Ten flags fit because they are flags. */
export const UP_NEXT_MAX = 10;

/** Up to `UP_NEXT_MAX` delegations off a queue, plus however many are left
 *  behind them. `skip` drops the delegations the headline has already named. */
function upNext(label: string, queue: string[], skip: number): NowPlaying['next'] {
  const rest = queue.slice(skip);
  if (rest.length === 0) return null;
  return {
    label,
    names: rest.slice(0, UP_NEXT_MAX),
    more: Math.max(0, rest.length - UP_NEXT_MAX),
    all: rest,
  };
}

// ── The panel states the STAGE, and nothing else ─────────────────────────────
//
// The context line answers one question: what stage is this room in. General
// Speakers' List · Moderated caucus · Consultation of the Whole · Unmoderated
// caucus · Tour de Table · Voting procedure · Roll call · Suspended ·
// Adjourned · Not opened. The TOPIC of a caucus is no longer glued onto that
// line — it comes back as `contextTopic` and the card sets it underneath.
//
// ── WHICH CLOCK THIS PANEL IS ALLOWED TO SHOW ───────────────────────────────
//
// TWO RULES, both on the owner's instruction, and the second is the subtle one.
//
//   • THE ROOM'S CLOCK SITS IN `right`, THE CAPTION DIRECTLY ABOVE THE QUEUE.
//     "Add the speaker time or motion time right on top of the queue on the
//     right side, don't move anything" — so it went into the slot that is
//     already immediately above the queue strip and already right-aligned,
//     rather than into a new row that would have pushed the strip down. A
//     caucus card was already reporting its total clock there and is untouched;
//     what changed is the GSL, which used to report "14 still on the list" and
//     now reports the delegate's own countdown.
//
//     This REVERSES the earlier "the GSL has no clock here at all" rule, on the
//     owner's later instruction. `speakerRemainingNow` is imported again — the
//     seconds are derived from `current_speaker.started_at` on every render, so
//     a paused speaker (a null anchor) shows a frozen number and says so, and
//     nothing is counted down or written. `pct` stays null on those branches:
//     the per-speech TOTAL is a chair-console setting that never reaches this
//     page, so there is no honest denominator to draw a fill from.
//
//   • A CAUCUS SHOWS ITS TOTAL CLOCK, AND ONLY ITS TOTAL CLOCK. The moderated
//     branch used to prefer a per-SPEECH countdown whenever `current_speaker`
//     carried an anchor for the delegation on the floor; that branch is gone, so
//     every caucus kind now reads the one number a corridor-walking organiser
//     actually wants — how much of the caucus is left.
//
// AND THE TOTAL CLOCK MUST NOT TICK WHILE NOBODY IS SPEAKING. That is not a
// rule this file has to enforce with a condition — it is a property of the data,
// and it is worth writing down because it looks like a bug until you check:
//
//   `liveCaucusSeconds` → `caucusRemainingNow` (committeeService.ts:59-67), and
//   its FIRST branch is `if (!caucus.totalStartedAt) return Math.max(0, base)`.
//   A null anchor returns the stored `remainingTime` UNCHANGED — frozen, not
//   extrapolated. So `leftSecs`, the derived `elapsed`, and `pct` all hold
//   perfectly still, and the caption says "caucus clock paused" rather than
//   inventing motion.
//
//   In a moderated caucus the chair console clears that anchor constantly. The
//   total clock advances in LOCKSTEP with the speaker clock — pausing the
//   speaker timer writes `totalStartedAt: null` (`chair/[code]/page.tsx:2739-2746`),
//   and so do "next speaker" (`:2772`) and "restart" (`:2850`). Between two
//   speeches there is no anchor, so the total clock genuinely does not move.
//
//   This is also why the paused branch is the one that matters most: measured on
//   production, MOST caucus blobs carry no `totalStartedAt` at all. The paused
//   path is the common path, and it renders a still number and says so.
//
// Motions are deliberately absent, on the owner's instruction: what is sitting
// on the chair's desk is not something this board reports. Nor is it a missing
// stage — a caucus IS the outcome of a motion, so the four caucus stages above
// already cover it, and a generic "Motion" stage on top of them would count the
// same event twice. The recap modal's "Motions raised" tile stays where it is;
// it counts `motion-raised` ledger events in `messages`, not the `motions` table.

/** THE PANEL. One pure function of the row and the page's clock. */
export function nowPlaying(lc: LiveCommittee, now: number): NowPlaying {
  const s = lc.session;
  if (!s) {
    return {
      kind: 'not-started', context: 'No session', contextTopic: null,
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
      kind: 'ended', context: 'Adjourned', contextTopic: null,
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
      kind: 'suspended', context: 'Suspended', contextTopic: null,
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
      kind: 'not-started', context: 'Not opened yet', contextTopic: null,
      headline: lc.conf.chairs.length > 0 ? 'Chairs have the code' : 'No chair assigned yet',
      flag: null, glyph: 'dormant', tone: 'off', dim: true, pct: null,
      left: 'never opened',
      right: lc.conf.sessionCode ? `code ${lc.conf.sessionCode}` : 'no session code',
      next: null,
    };
  }

  // ── Roll call ──
  if (base === 'roll-call' || base === 'resumed') {
    const { present, total } = presence(lc);
    return {
      kind: 'roll-call',
      context: 'Roll call',
      contextTopic: base === 'resumed' ? 'Resuming after a break' : null,
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
    // through it.
    //
    // The per-SPEECH clock that `current_speaker.started_at` anchors is NOT read
    // here any more. A caucus card shows the total caucus clock and nothing
    // else, so the delegation's name is all this row still wants from it.
    const floorCountry = (caucus.currentSpeaker ?? '').trim()
      || (lc.currentSpeaker?.country ?? '').trim();

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
        context: 'Tour de Table',
        contextTopic: roomOrder ? 'Room order' : null,
        headline: floorCountry || (qn > 0 ? `${lc.caucusQueue[0]} is next` : 'Between speakers'),
        flag: !roomOrder && floorCountry ? floorCountry : null,
        // A tour whose anchor is released is between speakers, and saying "live"
        // of a clock that is standing still is the one thing this panel must not
        // do. Paused reads as `warn`, exactly as the unmod branch already did.
        glyph: 'mic', tone: expired || !running ? 'warn' : 'live', dim: !floorCountry,
        pct: seats > 0 ? (spoken / seats) * 100 : null,
        left: `${spoken} of ${seats} ${roomOrder ? 'seats called' : 'spoken'}`,
        right: totalSecs > 0
          ? (expired ? 'tour time is up' : running ? `${fmtClock(leftSecs)} left` : 'tour clock paused')
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
        // The purpose is the motion's TOPIC and now sits on its own line under
        // the motion name, so the headline goes back to stating what the room is
        // doing rather than doubling as the topic slot.
        contextTopic: purpose || null,
        headline: cow ? 'The committee is in consultation' : 'The floor is informal',
        flag: null, glyph: 'timer',
        tone: expired || !running ? 'warn' : 'live', dim: true,
        pct: totalSecs > 0 ? (elapsed / totalSecs) * 100 : null,
        left: totalSecs > 0 ? `${fmtClock(elapsed)} of ${fmtClock(totalSecs)}` : 'no clock set',
        right: expired ? 'time is up' : running ? `${fmtClock(leftSecs)} left` : 'clock paused',
        next: null,
      };
    }

    // Moderated caucus — the motion name is the album, the delegation on the
    // floor is the track, and the topic sits between them on its own line.
    //
    // ONE RETURN, not two. There used to be a preferred branch here that swapped
    // the total clock for a per-SPEECH countdown whenever `current_speaker`
    // carried an anchor for the delegation on the floor. That is the countdown
    // the owner asked to be gone: a caucus card reports the caucus, and the
    // seconds left in one delegate's speech are a chair-console number.
    return {
      kind: 'caucus',
      context: 'Moderated caucus',
      contextTopic: caucus.purpose?.trim() || caucus.motionLabel?.trim() || null,
      headline: floorCountry || (qn > 0 ? `${lc.caucusQueue[0]} is next` : 'Nobody on the floor'),
      flag: floorCountry || (qn > 0 ? lc.caucusQueue[0] : null),
      // `!running` ⇒ the anchor is released, which in a moderated caucus is the
      // ordinary state between two speeches. The clock is standing still, so the
      // panel must not claim to be live while it does.
      glyph: 'mic', tone: expired || !running ? 'warn' : 'live', dim: !floorCountry && qn === 0,
      // Frozen when paused: `elapsed` is derived from `leftSecs`, and
      // `caucusRemainingNow` returns the stored `remainingTime` untouched
      // whenever `totalStartedAt` is null. The bar does not creep.
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
      kind: 'voting', context: 'Voting procedure', contextTopic: null,
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

  // THE SPEAKER'S OWN CLOCK, and nothing else in the captions.
  //
  // "No need to say has the floor or 6 still on the list" — both are gone. The
  // flag in the art slot already says who is speaking, and the row of flags
  // below already says who is waiting, so the two captions were labelling
  // things the panel had drawn one line above and one line below them.
  //
  // What replaces the right-hand one is the number that was genuinely missing:
  // the seconds left in the speech, derived from the stored anchor. `pct` stays
  // null — see the note above; the speech's total length is not on this page,
  // so the track stays an empty one rather than an invented one.
  if (speaker?.country) {
    const running = !!speaker.startedAt;
    const rem = speakerRemainingNow(speaker.timeRemaining ?? 0, speaker.startedAt, now);
    return {
      kind: 'speaker', context, contextTopic: null,
      headline: speaker.country, flag: speaker.country,
      glyph: 'mic', tone: 'live', dim: false, pct: null,
      left: '',
      // A released anchor is the ordinary state between two speeches, so the
      // number is frozen and the caption says so rather than implying motion.
      right: running ? `${fmtClock(rem)} left` : `${fmtClock(rem)} paused`,
      next: upNext("Speakers' list", queue, 0),
    };
  }
  if (qn > 0) {
    return {
      kind: 'idle-floor', context, contextTopic: null,
      headline: `${queue[0]} is next`, flag: queue[0],
      glyph: 'mic', tone: 'off', dim: false, pct: null,
      left: 'nobody on the floor',
      right: `${qn} on the speakers' list`,
      next: upNext('Then on the list', queue, 1),
    };
  }
  return {
    kind: 'idle-floor', context, contextTopic: null,
    headline: 'Nobody on the floor',
    flag: null, glyph: 'dormant', tone: 'off', dim: true, pct: null,
    left: "speakers' list empty",
    right: 'waiting for the chair',
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
//   • Motion counts — pending and raised alike. Motions are not tracked on this
//     card at all: the panel above reports the STAGE the room is in, and the
//     caucus stages already say what a passed motion produced.
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

// `committeeTopic` LIVED HERE AND IS GONE, on the owner's instruction: "remove
// topics completely now". It returned `conference_committees.topics[0]` plus a
// "+N" count of the rest, for the line the card drew under the committee's name.
//
// WHEN THE SESSIONS SIDE INTRODUCES TOPIC SELECTION, SHOW ONLY THE SINGLE
// SELECTED TOPIC HERE — NOT THE ARRAY. `topics` is the committee's whole agenda;
// what belongs on a live card is the one topic the room is actually debating,
// which is a fact the session does not record today. The "+N" behaviour above is
// exactly what should NOT come back: an agenda is not an identity line.
//
// See the matching note at the removal point in `CommitteeCard`.

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
