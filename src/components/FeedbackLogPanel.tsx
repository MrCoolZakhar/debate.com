'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SeatFlag } from '@/components/SeatFlag';
import { CaucusState, Committee } from '@/lib/types';
import { getCountryDisplayName } from '@/lib/countries';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { getScoringConfig, RATING_MIN } from '@/lib/scoring';
import { factorName } from '@/lib/scoringNames';
import { addFeedback, updateFeedback, getFeedbackForCommittee } from '@/lib/committeeService';
import { serverNow } from '@/lib/serverClock';
import { buildSessionHistory, liveSegment, RTR_CONTEXT, type SegmentKind } from '@/lib/sessionHistory';
import { motionNames } from '@/lib/committeeFlags';
import { ListOrdered, Gavel, Users, MicVocal, CircleDot, MessagesSquare, type LucideIcon } from 'lucide-react';

const KIND_ICON: Record<SegmentKind, LucideIcon> = {
  'speakers-list': ListOrdered,
  'moderated-caucus': Gavel,
  'unmoderated-caucus': Users,
  'tour-de-table': MicVocal,
  consultation: MessagesSquare,
  other: CircleDot,
};

/** One section of the dock: a debate segment of the session, as the History tab reads it. */
interface DockSection { id: string; kind: SegmentKind; topic: string; startedAt: string; items: FeedItem[] }

const instant = (iso?: string) => (iso ? Date.parse(iso) : NaN);

type ItemKind = 'past' | 'live' | 'next';
interface FeedItem {
  key: string;
  kind: ItemKind;
  country: string;
  context: string;
  /** What the speech was ABOUT: the caucus topic or motion label, or the committee
   *  topic on the GSL. `context` is only a three-value enum, so on its own it
   *  cannot tell one caucus from the next — which is exactly what a chair reading
   *  their notes back needs to know. */
  topic?: string;
  /** When the speech was GIVEN. Distinct from the row's `created_at`, which is
   *  when the chair typed, and can be an hour later for a note written on a past
   *  speech through the collapsed capsule. Absent on `next` cards, and on a `live`
   *  card it is the moment this turn started. */
  spokenAt?: string;
  seconds?: number;
  timestamp?: string;
}
interface RowState { id?: string; content: string; scores: Record<string, number>; country: string; reconciled?: boolean; }
/** Another chair's note on the same speech. Read-only here — each chair edits only their own row. */
interface OtherNote { chairName: string; content: string; scores: Record<string, number>; }

/** Has this row a rating a chair actually set? A stored score below `RATING_MIN`
 *  means "never rated" to every reader of `factor_scores`, so it must mean the
 *  same thing on write. One helper, so the write guard and the display tick can
 *  never disagree about what a rating is. */
const hasRating = (scores: Record<string, number>) =>
  Object.values(scores).some((v) => (v ?? 0) >= RATING_MIN);

/** Two rows minimum, six rows maximum, then it scrolls. Height is written to the node, never
 *  held in state: a re-render per keystroke for a box height is exactly the kind of cascade
 *  RULE 3 exists to avoid, and the value is derived from the DOM anyway. */
const NOTE_MIN_PX = 54;
const NOTE_MAX_PX = 132;
function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(NOTE_MAX_PX, Math.max(NOTE_MIN_PX, el.scrollHeight))}px`;
}

interface PastSpeech { country: string; context: string; topic: string; seconds: number; timestamp: string; }
function pastSpeeches(committee: Committee): PastSpeech[] {
  return (committee.messages ?? [])
    .filter((m) => m.sender === '__system__' && m.recipient === '__log__' && m.content.startsWith('__log__:'))
    .map((m) => { try { return JSON.parse(m.content.slice('__log__:'.length)); } catch { return null; } })
    .filter((e): e is { country: string; type?: string; context?: string; topic?: string; seconds?: number; timestamp?: string } =>
      !!e && (!e.type || e.type === 'speech') && typeof e.seconds === 'number')
    // `topic` has been on the speaking log since `logSpeakingTime` was written
    // (`committee.caucus?.purpose ?? committee.topic`). It was simply never read
    // here, so the note the chair wrote about the speech lost what the speech was
    // about while the log two rows away still had it.
    .map((e) => ({
      country: e.country, context: e.context ?? 'speakers-list', topic: e.topic ?? '',
      seconds: e.seconds ?? 0, timestamp: e.timestamp ?? '',
    }));
}

// The caucus that is ACTUALLY on the floor right now. `committee.caucus` alone is not
// enough: the phase and the caucus JSONB can diverge (a suspend/end-debate leaves the
// caucus object behind, and the two writes that end a caucus land as separate rows), so
// a leftover object would otherwise keep the dock claiming a caucus long after the
// committee is back on the GSL. Both must agree before we call it a caucus.
export function liveCaucus(committee: Committee): CaucusState | null {
  const inCaucusPhase = committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus';
  return inCaucusPhase && committee.caucus ? committee.caucus : null;
}

// The context the live/upcoming speakers will be logged under (for later reconciliation).
function liveContext(committee: Committee): string {
  const caucus = liveCaucus(committee);
  if (!caucus) return 'speakers-list';
  return caucus.type === 'unmoderated' ? 'unmoderated-caucus' : 'moderated-caucus';
}

// The topic those speakers will be logged under. Deliberately mirrors what
// `logSpeakingTime` is given by the chair page (`caucus?.purpose ?? topic`), with
// the motion label as a second fallback so an untitled caucus still names itself
// the way `tagFor` below already labels it on screen. Matching the log matters:
// the reconcile pass overwrites this value with the log's once the speech lands,
// and the two should agree rather than flicker.
function liveTopic(committee: Committee): string {
  const caucus = liveCaucus(committee);
  if (!caucus) return committee.topic ?? '';
  return caucus.purpose || caucus.motionLabel || committee.topic || '';
}

export default function FeedbackLogPanel({ committee, chairName, currentCountry, feedbackVersion = 0 }: {
  committee: Committee; chairName: string; currentCountry: string | null;
  /** Bumped by the chair page on every realtime `feedback` event — the refetch key. */
  feedbackVersion?: number;
}) {
  const { language } = useLanguage();
  const t = useT();
  const cfg = getScoringConfig(committee);
  // Ratings are opt-in (Settings -> Points). When off there are no factors, so the
  // rating column collapses and the note gets the full width of the dock.
  const factors = cfg.factorRatingsEnabled ? cfg.factors.filter((f) => f.enabled) : [];
  const caucus = liveCaucus(committee);
  const ctx = liveContext(committee);
  const liveTopicNow = liveTopic(committee);

  const past = useMemo(() => pastSpeeches(committee), [committee.messages]);
  // Upcoming queue (GSL or caucus), excluding whoever currently holds the floor.
  const queue = (caucus ? committee.caucusQueue : committee.speakersList) ?? [];
  const upcoming = queue.filter((s) => s.country !== currentCountry);

  const [state, setState] = useState<Record<string, RowState>>({});
  // Other chairs' notes on the same speeches, keyed by the same item key. Never edited
  // here: a row belongs to the chair whose name is on it.
  const [others, setOthers] = useState<Record<string, OtherNote[]>>({});
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const creatingRef = useRef<Set<string>>(new Set());
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // What the live card is ABOUT, read when a turn is held below. Refs, not the values
  // themselves, so a caucus label changing mid-turn cannot re-run anything.
  const ctxRef = useRef(ctx);
  const topicRef = useRef(liveTopicNow);
  useEffect(() => { ctxRef.current = ctx; topicRef.current = liveTopicNow; }, [ctx, liveTopicNow]);

  // Focus-dock state. The focused bubble is the hero (editing UI); the live bubble is
  // primary by default. Hover lifts/sharpens any non-focused bubble.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  // ── The turn on the floor ──────────────────────────────────────────────────
  //
  // Which delegation holds the floor and WHEN this turn began. A fresh turn gets a fresh card
  // even for the same delegation (a right of reply, a second speech in one caucus).
  //
  // Derived DURING RENDER, not in an effect (fixed 17 Sep 2026). It used to be a ref written
  // by an effect, so on the first render of a new turn the live key still carried the previous
  // turn's instant and then silently changed under the card — the bubble remounted, losing
  // focus and the caret mid-sentence, and anything read off the ref in between named the wrong
  // turn. React re-renders immediately on a set during render, so the key is right from the
  // first paint and never moves within a turn.
  const [turn, setTurn] = useState<{ country: string | null; at: number }>(
    () => ({ country: currentCountry, at: serverNow() }),
  );
  /** The turn that has just left the floor, drained into `recent` by an effect below. */
  const pendingHoldRef = useRef<FeedItem | null>(null);
  if (turn.country !== currentCountry) {
    if (turn.country) {
      pendingHoldRef.current = {
        key: `live|${turn.country}|${turn.at}`, kind: 'past', country: turn.country,
        context: ctxRef.current, topic: topicRef.current, spokenAt: new Date(turn.at).toISOString(),
      };
    }
    // Database clock (RULE 6b): this instant becomes `spoken_at` and is compared with
    // logged speech timestamps, which are stamped with serverNowIso().
    setTurn({ country: currentCountry, at: serverNow() });
  }
  const turnStart = turn.country === currentCountry ? turn.at : serverNow();

  // Live card key, a fresh turn (even same country, e.g. right of reply) gets a new card.
  const liveKey = currentCountry ? `live|${currentCountry}|${turnStart}` : null;

  // ── Turns that have LEFT the floor but are not in the log yet ──────────────
  //
  // "Sometimes random speakers disappear" (owner, 17 Sep 2026), second cause. The instant the
  // Moderator presses Next, this device's `current_speaker` slice updates and the outgoing
  // delegation's live card leaves `items` — but the speech is only in the log once the
  // `messages` INSERT arrives, which is a separate realtime event. In that window the
  // delegation is nowhere on the dock, and the note just typed on it is unreachable. Worse,
  // `logFloorSpeech` writes nothing at all for a turn under a second or for a Room Order
  // placeholder, so for those the card never comes back and the note is stranded for good.
  //
  // So the outgoing turn is HELD here, with its own key (the same one its note is stored
  // under, so the text simply stays on screen), and released the moment a logged speech for
  // that delegation at or after its start shows up — which is exactly when the real `past`
  // card takes over. Capped at four, so a turn that is never logged rolls off instead of
  // accumulating. Pure local memory: no fetch, no write, no committee state.
  const [recent, setRecent] = useState<FeedItem[]>([]);
  // Drain the turn that just left the floor into the hold, and release any hold whose speech
  // has now reached the log (that is exactly when the real `past` card takes over).
  useEffect(() => {
    setRecent((prev) => {
      const held = pendingHoldRef.current;
      pendingHoldRef.current = null;
      const merged = held ? [...prev.filter((r) => r.key !== held.key), held].slice(-4) : prev;
      const next = merged.filter((r) => !past.some((p) =>
        p.country === r.country && (!r.spokenAt || !p.timestamp || Date.parse(p.timestamp) >= Date.parse(r.spokenAt))));
      return next.length === prev.length && next.every((r, i) => r === prev[i]) ? prev : next;
    });
  }, [past, turn]);

  // ── The dock reads like the History (owner, 18 Sep 2026) ────────────────────
  //
  // Sections are the History tab's debate segments (`buildSessionHistory`, which already
  // follows phase changes: a caucus that passed opens its own segment even before anyone
  // speaks, and the debate the room is in now is always the newest). Newest section first,
  // and inside a section newest first: the upcoming delegations on top, then the floor, then
  // what was said. Every card keeps the key it always had (`past|...`, `live|...`, `next|...`),
  // so notes, the held turn and the reconcile passes below are untouched by the regrouping.
  // Rights of reply are cards too (`rtr|...`), written on under context 'right-of-reply'.
  const segments = useMemo(() => buildSessionHistory(committee, []), [committee]);
  const replies = useMemo(() => segments.flatMap((sg) => sg.events.filter((e) => e.type === 'right-of-reply')), [segments]);
  const nextIds = JSON.stringify(upcoming.map((u) => u.delegateId));

  const sections: DockSection[] = useMemo(() => {
    const out: DockSection[] = segments.map((sg) => ({
      id: sg.id, kind: sg.kind, topic: sg.topic, startedAt: sg.startedAt,
      items: [
        ...sg.speeches.map((p): FeedItem => ({
          key: `past|${p.country}|${p.timestamp}`, kind: 'past', country: p.country, context: p.context,
          topic: p.topic, spokenAt: p.timestamp, seconds: p.seconds, timestamp: p.timestamp,
        })),
        // A right of reply: seconds 0 (never null), so no pass below mistakes its note for
        // one written on a speech still in progress.
        ...sg.events.filter((e) => e.type === 'right-of-reply').map((e): FeedItem => ({
          key: `rtr|${e.country}|${e.timestamp}`, kind: 'past', country: e.country, context: RTR_CONTEXT,
          topic: sg.topic, spokenAt: e.timestamp, seconds: 0, timestamp: e.timestamp,
        })),
      ],
    }));
    // Nothing logged and nothing live yet: one section for the floor.
    if (out.length === 0 && (currentCountry || upcoming.length)) {
      const live = liveSegment(committee);
      out.push({ id: 'live|floor', kind: live?.kind ?? 'speakers-list', topic: live?.topic ?? '', startedAt: '', items: [] });
    }
    // `segments` is already NEWEST FIRST. Held turns sit in the section they happened in (the
    // newest that had started by then).
    for (const r of recent) {
      if (r.key === liveKey) continue;
      const at = instant(r.spokenAt);
      const home = out.find((sc) => !sc.startedAt || !Number.isFinite(at) || instant(sc.startedAt) <= at) ?? out[0];
      home?.items.push(r);
    }
    const newest = out[0];
    if (newest) {
      // The live card's speech STARTED when this turn started, which is the only honest
      // answer available before the speech is logged. `next` cards have not happened yet,
      // so they carry no time at all and get one when they reconcile.
      if (currentCountry && liveKey) newest.items.push({ key: liveKey, kind: 'live', country: currentCountry, context: ctx, topic: liveTopicNow, spokenAt: new Date(turnStart).toISOString() });
      for (const u of upcoming) newest.items.push({ key: `next|${u.delegateId}`, kind: 'next', country: u.country, context: ctx, topic: liveTopicNow });
    }
    // Newest first, throughout. Upcoming (in reverse speaking order, so the next delegation
    // sits right above the floor), then the floor, then the log by time.
    const rank = (i: FeedItem) => (i.kind === 'next' ? 0 : i.kind === 'live' ? 1 : 2);
    for (const sc of out) {
      const order = new Map(sc.items.map((it, i) => [it.key, i]));
      sc.items.sort((a, b) => rank(a) - rank(b)
        || (a.kind === 'next' ? (order.get(b.key)! - order.get(a.key)!) : 0)
        || (instant(b.spokenAt) || 0) - (instant(a.spokenAt) || 0));
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, recent, currentCountry, liveKey, turnStart, nextIds, ctx, liveTopicNow]);

  // The cards in the order they are drawn: pass 3 below and the focus recede read this.
  const items: FeedItem[] = useMemo(() => sections.flatMap((sc) => sc.items), [sections]);

  // Load every chair's speech feedback, and re-load whenever a realtime `feedback`
  // event lands (`feedbackVersion`). This used to run exactly once per mount behind a
  // `loadedRef` latch, which broke the moment a second chair joined: neither could see
  // the other's notes, and — worse — the greedy match below took the FIRST row for a
  // speech regardless of who wrote it, so chair B would adopt chair A's row id and the
  // next keystroke would UPDATE it, silently overwriting A's note. Rows are now split
  // by author: you edit yours, you read theirs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await getFeedbackForCommittee(committee.id, { code: committee.code, chairSuffix: committee.dbChairJoinSuffix ?? undefined });
      if (cancelled) return;
      const fb = all.filter((f) => f.level === 'speech');

      const mineNext: Record<string, RowState> = {};
      const theirsNext: Record<string, OtherNote[]> = {};
      const used = new Set<string>();

      const claim = (key: string, f: typeof fb[number], reconciled: boolean) => {
        if (used.has(f.id)) return;
        if (f.chairName === chairName) {
          if (mineNext[key]) return;            // one row per speech per chair
          used.add(f.id);
          mineNext[key] = { id: f.id, content: f.content, scores: f.factorScores ?? {}, country: f.country, reconciled };
        } else {
          used.add(f.id);
          // One entry per chair per speech. Duplicate rows for the same chair DO exist in
          // production — before this effect matched unreconciled rows, a reload mid-speech
          // made a second row rather than adopting the first — so collapse them here
          // instead of listing the same name twice. The row with prose wins; failing that
          // the newest, since getFeedbackForCommittee returns them created_at ascending.
          const bucket = (theirsNext[key] ??= []);
          const at = bucket.findIndex((o) => o.chairName === f.chairName);
          const entry = { chairName: f.chairName, content: f.content, scores: f.factorScores ?? {} };
          if (at < 0) bucket.push(entry);
          else if (!bucket[at].content.trim()) bucket[at] = entry;
        }
      };

      // A RIGHT OF REPLY is identified by country + context + the instant it was granted
      // (`spoken_at` = the log timestamp). Its rows carry seconds 0, so the passes below
      // (which only look at seconds null or at speech contexts) never touch them.
      for (const r of replies) {
        const key = `rtr|${r.country}|${r.timestamp}`;
        const at = instant(r.timestamp);
        for (const f of fb) {
          if (f.country !== r.country || f.speechContext !== RTR_CONTEXT) continue;
          if (Math.abs(instant(f.spokenAt ?? undefined) - at) > 2000) continue;
          claim(key, f, true);
        }
      }
      // A LOGGED speech is identified by country + context + seconds.
      for (const p of past) {
        const key = `past|${p.country}|${p.timestamp}`;
        for (const f of fb) {
          if (f.country !== p.country) continue;
          if ((f.speechContext ?? '') !== p.context || (f.speechSeconds ?? 0) !== p.seconds) continue;
          claim(key, f, true);
        }
      }
      // PASS 2 — ORPHAN REPAIR. A row saved in the last moments of a speech is INSERTed
      // asynchronously, so `speech_seconds` is still null when the speech gets logged, and
      // the reconcile effect below skips it (it requires an id that has not arrived yet).
      // The row is then orphaned: it matches no past key, and pass 3 would hand it to the
      // NEXT card for the same country — whose first keystroke would UPDATE it, destroying
      // the earlier speech's note. Countries speak repeatedly in a moderated caucus, so
      // this fires constantly.
      //
      // So: adopt each orphan onto the earliest logged speech it can belong to, and patch the
      // DB so it is exact from then on. This repairs rows already orphaned in production, and
      // it consumes them BEFORE pass 3 can steal them, which is what stops the overwrite.
      //
      // WHICH ORPHAN BELONGS TO WHICH SPEECH (fixed 17 Sep 2026, "sometimes random speakers
      // disappear"). The test used to be `f.createdAt <= p.timestamp`: the note row must have
      // been created before the speech was logged. That is the WRONG WAY ROUND for the note
      // this pass exists to rescue. The Moderator writes the speech log the instant they press
      // Next; the Commenter's flush only fires when that speaker change reaches their device,
      // a few hundred milliseconds LATER, so the row it inserts is created after the log it
      // belongs to. The guard rejected it every time, pass 3 then handed it to the live card
      // for the same delegation, and the next keystroke overwrote the earlier speech's note —
      // the note vanished off the speech it was written on and turned up on a later turn.
      //
      // `spoken_at` is the honest key and it is already stored: it is when the TURN STARTED,
      // recorded by the card the chair typed on. A note belongs to a speech whose log
      // timestamp (when the speech ENDED) is at or after that instant, and a note on the
      // delegation currently holding the floor is excluded for free, because its turn started
      // after every logged speech. Rows with no `spoken_at` (a note written on an upcoming
      // card, or one written before the column existed) keep the created_at test with a
      // two-minute grace, which is what closes the race above for them too.
      const ORPHAN_SLACK_MS = 120_000;
      const orphanFits = (f: typeof fb[number], p: PastSpeech) => {
        if (!p.timestamp) return true;
        // Compared as instants, never as strings: `spoken_at` reads back as "+00:00" while log
        // timestamps are "Z", with different fraction lengths.
        if (f.spokenAt) return Date.parse(f.spokenAt) <= Date.parse(p.timestamp);
        if (!f.createdAt) return true;
        return new Date(f.createdAt).getTime() <= new Date(p.timestamp).getTime() + ORPHAN_SLACK_MS;
      };
      for (const p of past) {
        const key = `past|${p.country}|${p.timestamp}`;
        if (mineNext[key]) continue;
        const orphan = fb.find((f) =>
          !used.has(f.id) && f.country === p.country && f.chairName === chairName &&
          f.speechSeconds == null && orphanFits(f, p));
        if (!orphan) continue;
        claim(key, orphan, true);
        updateFeedback(orphan.id, { speechContext: p.context, speechSeconds: p.seconds, speechTopic: p.topic || null, spokenAt: p.timestamp || null },
          committee.code, committee.dbChairJoinSuffix ?? undefined);
      }

      // PASS 3 — a row written while the delegate still HOLDS the floor genuinely has no
      // seconds yet, so whatever survives pass 2 belongs to the live/next card.
      for (const item of items) {
        if (item.kind === 'past') continue;
        for (const f of fb) {
          if (f.country !== item.country || f.speechSeconds != null) continue;
          claim(item.key, f, false);
        }
      }

      if (cancelled) return;
      setOthers(theirsNext);
      setState((prev) => {
        const merged = { ...prev };
        for (const [key, row] of Object.entries(mineNext)) {
          const cur = merged[key];
          // A refetch must NEVER overwrite what this chair is typing — our own write
          // echoes back through realtime, so this runs mid-edit routinely. Adopt the
          // row only to learn its id (so the next keystroke UPDATEs rather than
          // inserting a duplicate); local text and scores always win.
          merged[key] = cur
            ? { ...cur, id: cur.id ?? row.id, reconciled: cur.reconciled || row.reconciled }
            : row;
        }
        return merged;
      });
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.id, past.length, replies.length, feedbackVersion, chairName, currentCountry]);

  // On speaker change: FLUSH FIRST, then start the new turn.
  //
  // The order matters. Once the turn moves, the outgoing speaker's live card has a
  // key nothing renders any more, so anything still unsaved is unreachable. `flushAll`
  // reads stateRef and the recorded item metadata, both of which still describe the
  // OUTGOING turn at this point, so the note lands on the right speech.
  //
  // `flushRef` keeps this effect off `flushAll`'s identity — it is redefined every
  // render, and depending on it would re-run this on every keystroke and reset the
  // chair's focus mid-sentence.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    return () => { flushRef.current(); };   // outgoing turn, and unmount
  }, [currentCountry]);
  // The focus goes back to the floor on every speaker change, so a chair reading an old note
  // is never left typing into the wrong turn. The turn instant itself is derived during render
  // (see `turn` above), not here.
  useEffect(() => { setFocusKey(null); }, [currentCountry]);

  // Reconcile live/upcoming comments onto a speech once it's actually logged.
  useEffect(() => {
    for (const p of past) {
      const pastKey = `past|${p.country}|${p.timestamp}`;
      if (stateRef.current[pastKey]?.id) continue;
      const candKey = Object.keys(stateRef.current).find((k) =>
        (k.startsWith('live|') || k.startsWith('next|')) &&
        stateRef.current[k].country === p.country &&
        stateRef.current[k].id && !stateRef.current[k].reconciled);
      if (!candKey) continue;
      const entry = stateRef.current[candKey];
      // The LOG is the authority on what the speech was about and when it ended, so
      // the note adopts its topic and timestamp rather than keeping the guess the
      // live card made from the caucus that happened to be on the floor.
      updateFeedback(entry.id!, { speechContext: p.context, speechSeconds: p.seconds, speechTopic: p.topic || null, spokenAt: p.timestamp || null }, committee.code, committee.dbChairJoinSuffix ?? undefined);
      setState((prev) => ({
        ...prev,
        [pastKey]: { ...entry, reconciled: true },
        [candKey]: { ...prev[candKey], reconciled: true },
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.messages]);

  const persist = (item: FeedItem, content: string, scores: Record<string, number>) => {
    const cur = stateRef.current[item.key];
    if (cur?.id) { updateFeedback(cur.id, { content, factorScores: scores }, committee.code, committee.dbChairJoinSuffix ?? undefined); return; }
    // Nothing worth a row yet. Blurring an untouched note box used to INSERT an empty
    // one — production carries several, each a chair who clicked into the box and
    // clicked straight back out. They render as a delegate having been "commented on"
    // when nobody wrote anything.
    //
    // `hasRating` is the ONLY thing that decides whether a rating counts as
    // deliberate, and it agrees with every reader: a score at or above RATING_MIN is
    // a rating, anything below it is "not rated". This guard used to discard the
    // bottom of the scale, because the slider offered 0 and 0 reads as absent — a
    // chair could mark a delegation lowest on every factor and have nothing saved at
    // all. The slider now starts at RATING_MIN, so the two ends agree.
    if (!content.trim() && !hasRating(scores)) return;
    if (creatingRef.current.has(item.key)) return;
    creatingRef.current.add(item.key);
    addFeedback(committee.id, item.country, chairName, content, committee.code, committee.dbChairJoinSuffix ?? undefined, {
      level: 'speech', factorScores: scores, speechContext: item.context, speechSeconds: item.seconds ?? null,
      speechTopic: item.topic || null, spokenAt: item.spokenAt || null,
    }).then((id) => {
      creatingRef.current.delete(item.key);
      if (!id) return;
      setState((prev) => {
        const latest = prev[item.key] ?? { content, scores, country: item.country };
        if (latest.content !== content || JSON.stringify(latest.scores) !== JSON.stringify(scores)) {
          updateFeedback(id, { content: latest.content, factorScores: latest.scores }, committee.code, committee.dbChairJoinSuffix ?? undefined);
        }
        return { ...prev, [item.key]: { ...latest, id, country: item.country } };
      });
    });
  };

  // ── Saving a note must NEVER depend on the textarea losing focus ───────────
  //
  // It used to: `persist` ran on `onBlur` only. The chair who writes notes is the
  // COMMENTER, and the chair who advances the speaker is the MODERATOR — a different
  // person on a different device. So the ordinary case is: the Commenter is mid-sentence,
  // the Moderator clicks Next, `currentCountry` changes, the turn resets, the live
  // card's key changes, the card unmounts, and the text that was never blurred is gone.
  // It never reached the database at all. That is the note loss chairs reported, and it
  // gets worse the faster the committee moves.
  //
  // Two belts: a debounced autosave while typing, and a hard flush of everything dirty
  // the moment the speaker changes (and on unmount).
  const dirtyRef = useRef<Set<string>>(new Set());
  const itemMetaRef = useRef<Record<string, FeedItem>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Typed text captured SYNCHRONOUSLY on every keystroke. `stateRef` is updated in an
  // effect, and React runs every cleanup before any effect — so if a keystroke and the
  // speaker change land in the same commit, the flush below would read the value from
  // before that keystroke and drop the last thing the chair typed. This ref cannot be
  // stale: it is written in the event handler itself.
  const typedRef = useRef<Record<string, string>>({});

  const flushKey = (key: string) => {
    const meta = itemMetaRef.current[key];
    const row = stateRef.current[key];
    const content = typedRef.current[key] ?? row?.content ?? '';
    if (!meta) return;
    dirtyRef.current.delete(key);
    persist(meta, content, row?.scores ?? {});
  };
  const flushAll = () => {
    for (const key of Array.from(dirtyRef.current)) flushKey(key);
  };
  // Kept current so the speaker-change cleanup above always calls today's closure
  // without taking a dependency on it.
  flushRef.current = flushAll;

  const setNote = (item: FeedItem, content: string) => {
    itemMetaRef.current[item.key] = item;
    dirtyRef.current.add(item.key);
    typedRef.current[item.key] = content;
    setState((prev) => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { scores: {}, country: item.country }), content, country: item.country } }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushAll, 700);
  };
  const setScore = (item: FeedItem, factorId: string, v: number) => {
    itemMetaRef.current[item.key] = item;
    return setState((prev) => {
      const cur = prev[item.key] ?? { content: '', scores: {}, country: item.country };
      const scores = { ...cur.scores, [factorId]: v };
      const nextRow = { ...cur, scores, country: item.country };
      dirtyRef.current.delete(item.key);
      persist(item, nextRow.content, scores);
      return { ...prev, [item.key]: nextRow };
    });
  };

  const effectiveFocus = focusKey ?? liveKey;
  const focusIdx = items.findIndex((i) => i.key === effectiveFocus);

  // Roll the focused row to the vertical centre whenever focus changes.
  useEffect(() => {
    if (!effectiveFocus) return;
    const id = setTimeout(() => {
      rowRefs.current[effectiveFocus]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 30);
    return () => clearTimeout(id);
  }, [effectiveFocus]);

  const PILL_TRANSITION = 'transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease, opacity 260ms ease, box-shadow 260ms ease, background-color 260ms ease';
  // Reserved so pills/grids stay aligned across rows. Collapses to 0 when ratings are
  // switched off, handing the full width of the dock back to the note.
  const GRID_COL = factors.length ? 280 : 0;
  // The tag belongs to the ROW, not to the room: a past speech keeps the context it was
  // actually given under. Only rows sitting on the live context borrow the running caucus's
  // own label — otherwise a finished caucus speech would be re-tagged by whatever is on the
  // floor now (or, once the caucus ends, re-tag the GSL rows as a caucus).
  const tagFor = (item: FeedItem) => {
    if (item.context === RTR_CONTEXT) return t('sb_hist_right_of_reply');
    if (item.context === 'speakers-list') return t('fb_tag_gsl');
    if (item.context === ctx && caucus?.motionLabel) return caucus.motionLabel;
    return item.context === 'unmoderated-caucus' ? t('fb_tag_unmod') : t('fb_tag_caucus');
  };
  // At least one notch above the floor, or the slider would be a single position
  // and could express nothing. The Settings slider already refuses to go below 2;
  // this covers an old committee whose stored value predates that floor.
  const maxScale = Math.max(RATING_MIN + 1, cfg.factorScaleMax);

  // Every chair's note on one speech, mine first. The author prefix appears ONLY when
  // more than one chair has written — a single chair (the overwhelmingly common case)
  // reads exactly as it always did, with no name eating the width.
  const notesFor = (key: string, mine: RowState): { chairName: string; content: string; isMine: boolean }[] => {
    const out: { chairName: string; content: string; isMine: boolean }[] = [];
    if (mine.content.trim()) out.push({ chairName, content: mine.content.trim(), isMine: true });
    for (const o of others[key] ?? []) {
      if (o.content.trim()) out.push({ chairName: o.chairName || t('fb_chair'), content: o.content.trim(), isMine: false });
    }
    return out;
  };

  // Distance-based recede (index 0 = focused). Gentle on scale so pills stay wide.
  //
  // 17 Sep 2026 ("some things are clipped and random", "sometimes random speakers disappear").
  // Rows used to fade to 0.45 opacity AND take up to 1.6px of blur, which at a glance is
  // indistinguishable from a delegation not being there: three rows from the floor a name was
  // unreadable, and on a long list most of the dock was mush. The blur is gone entirely — it
  // bought nothing a small step in opacity does not — and the faintest row now sits at 0.7,
  // which still reads as secondary and still reads as a name.
  const scaleByDist = [1, 0.99, 0.985, 0.98];
  const opacityByDist = [1, 0.88, 0.78, 0.7];

  // Qualitative ratings: sliders on the focused pill, compact greyed read-only
  // values on the nearest neighbour. The track reads low → high.
  //
  // THE SCALE STARTS AT RATING_MIN, NOT AT 0. It used to start at 0, and 0 is what
  // every reader of `factor_scores` treats as "never rated" — so a chair who marked
  // a delegation lowest on every factor watched the sliders move and saved nothing.
  // An unrated factor shows a dash rather than a number, so "lowest" and "not yet
  // judged" are visibly different states instead of both reading 0.
  const metricStack = (item: FeedItem, rs: RowState, interactive: boolean) => (
    <div className="grid gap-x-4 gap-y-1.5" style={{ width: GRID_COL, gridTemplateColumns: '1fr 1fr' }}>
      {/* Every ENABLED factor, not the first four. The old cap meant a chair could add
          a fifth factor in Settings, never be offered a slider for it here, and then see
          a permanently empty row for it on the scoreboard — which renders whatever is
          enabled. The grid simply grows another row. */}
      {factors.map((f) => {
        const v = rs.scores[f.id] ?? 0;
        const rated = v >= RATING_MIN;
        if (!interactive) {
          return (
            <div key={f.id} className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wide truncate flex-1" style={{ color: '#B8AE9C' }}>{factorName(f, language)}</span>
              <span className="text-[11px] font-bold shrink-0" style={{ color: '#9A8A78' }}>{rated ? v : '–'}</span>
            </div>
          );
        }
        return (
          <div key={f.id}>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wide truncate" style={{ color: '#6A5A4A' }}>{factorName(f, language)}</span>
              <span className="text-xs font-black shrink-0" style={{ color: rated ? '#1B3828' : '#B8AE9C' }}>{rated ? v : '–'}</span>
            </div>
            <input
              type="range" min={RATING_MIN} max={maxScale} step={1}
              // An unrated factor parks the thumb at the bottom of the scale without
              // claiming that value. Committing it is what `onPointerUp` is for.
              value={rated ? v : RATING_MIN}
              aria-label={factorName(f, language)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setScore(item, f.id, parseInt(e.target.value))}
              // RECORDING THE BOTTOM OF THE SCALE. The thumb already sits at
              // RATING_MIN while a factor is unrated, so dragging it there fires no
              // change event and the chair's deliberate "lowest" would be lost —
              // the same silent discard the old min={0} caused, one notch up.
              // Releasing the control commits whatever it is showing.
              onPointerUp={(e) => { if (!rated) setScore(item, f.id, parseInt((e.currentTarget as HTMLInputElement).value)); }}
              onKeyUp={(e) => { if (!rated) setScore(item, f.id, parseInt((e.currentTarget as HTMLInputElement).value)); }}
              className="w-full" style={{ accentColor: '#1B3828', height: 14, opacity: rated ? 1 : 0.65 }}
            />
          </div>
        );
      })}
    </div>
  );


  // ── A section header: which debate this is, and (for a caucus) what it is about ──────
  // Mirrors the History tab's segment header, with the caucus name printed beside the kind
  // (owner, 18 Sep 2026) and a hairline divider running out to the edge.
  const kindLabel = (k: SegmentKind): string => {
    switch (k) {
      case 'speakers-list': return t('sb_hist_seg_gsl');
      case 'moderated-caucus': return t('sb_hist_seg_moderated');
      case 'unmoderated-caucus': return t('sb_hist_seg_unmoderated');
      case 'tour-de-table': return t('sb_hist_seg_tour');
      case 'consultation': return motionNames(committee, language).consultation;
      default: return t('sb_hist_seg_other');
    }
  };
  const sectionHeader = (sc: DockSection) => {
    const Icon = KIND_ICON[sc.kind];
    const name = sc.kind !== 'speakers-list' && sc.kind !== 'tour-de-table' ? sc.topic : '';
    return (
      <div className="flex items-center gap-2 pt-3 pb-0.5 min-w-0" style={{ color: '#1B3828' }}>
        <Icon size={14} strokeWidth={2.4} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate text-[11px] uppercase tracking-wider" title={name || undefined}>
          <span className="font-black">{kindLabel(sc.kind)}</span>
          {name && <span className="font-medium normal-case tracking-normal" style={{ color: '#6A5A4A' }}>{` · ${name}`}</span>}
        </span>
        <span aria-hidden className="flex-1 h-px min-w-6" style={{ backgroundColor: 'rgba(27,56,40,0.16)' }} />
        {sc.startedAt && (
          <span className="shrink-0 text-[10px] tabular-nums" style={{ color: '#9A8A78' }}>
            {new Date(sc.startedAt).toLocaleTimeString(language === 'en' ? 'en-GB' : language, { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    );
  };

  const renderItem = (item: FeedItem, idx: number) => {
    const rs = state[item.key] ?? { content: '', scores: {}, country: item.country };
    const isLive = item.kind === 'live';
    const isFocused = item.key === effectiveFocus;
    const isHover = hoverKey === item.key && !isFocused;
    const scored = hasRating(rs.scores);
    const notes = notesFor(item.key, rs);
    const theirs = notes.filter((n) => !n.isMine);
    const dist = focusIdx >= 0 ? Math.min(Math.abs(idx - focusIdx), 3) : 0;

    let scale = scaleByDist[dist], opacity = opacityByDist[dist];
    let boxShadow = '0 3px 12px rgba(28,20,16,0.07)';
    if (isFocused) {
      scale = 1; opacity = 1;
      boxShadow = '0 0 0 2px #B8844A, 0 14px 36px rgba(28,20,16,0.18)';
    } else if (isHover) {
      scale = 1.01; opacity = 1;
      boxShadow = '0 10px 26px rgba(28,20,16,0.16)';
    }

    return (
      <div
        key={item.key}
        ref={(el) => { rowRefs.current[item.key] = el; }}
        className="w-full flex items-center gap-3 shrink-0"
        style={{ opacity, transition: PILL_TRANSITION }}
      >
        {isFocused ? (
          /* Active, wide, 2-row writing bubble */
          <div
            className="flex-1 min-w-0"
            style={{
              borderRadius: 22, backgroundColor: '#FFFFFF',
              border: '1px solid rgba(221,212,192,0.85)', boxShadow,
              transform: `scale(${scale})`, transformOrigin: 'center', transition: PILL_TRANSITION,
              padding: '12px 16px',
            }}
          >
            <div className="flex items-center gap-2.5">
              {/* The topic rides as a tooltip rather than a second line:
                  it is now SAVED with the note, so the scoreboard prints it
                  in full, and the dock header has no width to spare. */}
              <span title={item.topic || undefined} className="text-[11px] font-black uppercase tracking-wider shrink-0" style={{ color: '#1B3828' }}>{tagFor(item)}</span>
              <SeatFlag country={item.country} size={26} className="shrink-0" />
              <span className="flex-1 min-w-0 truncate text-base font-bold" style={{ color: '#1C1410' }}>{getCountryDisplayName(item.country, language)}</span>
              {!isLive && <button onClick={(e) => { e.stopPropagation(); setFocusKey(null); }} className="shrink-0 text-sm" style={{ color: '#9A8A78' }}>✕</button>}
            </div>
            {/* GROWS WITH THE NOTE. It was a hard `rows={2}` with `resize-none`, so
                anything past two lines scrolled inside a box with a hidden scrollbar:
                the chair could not see what they had just written ("some things are
                clipped", owner, 17 Sep 2026). It now measures itself on every change
                and on mount, between two and six rows, and only scrolls past six.
                Written straight to the node, no state, no re-render per keystroke
                beyond the one `setNote` already causes. */}
            <textarea
              ref={(el) => { if (el) autoGrow(el); }}
              rows={2}
              value={rs.content}
              onChange={(e) => { autoGrow(e.currentTarget); setNote(item, e.target.value); }}
              onBlur={() => persist(item, rs.content, rs.scores)}
              placeholder={t('fb_private_note')}
              className="w-full mt-2 text-sm rounded-lg px-3 py-2 outline-none resize-none"
              style={{ color: '#1C1410', backgroundColor: '#FAF8F3', border: '1px solid #EDE7D8', overflowY: 'auto' }}
            />
            {/* What the other chairs wrote on this same speech — read-only, in the
                same box, so the dais reads as one record rather than N private ones.
                Each chair edits only the row carrying their own name. */}
            {theirs.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs leading-snug px-1">
                {theirs.map((n, ni) => (
                  <span key={ni} className="inline-flex items-baseline gap-1">
                    {ni > 0 && <span style={{ color: '#B8AE9C' }}>/</span>}
                    <span style={{ fontWeight: 700, color: '#1B3828' }}>{n.chairName}</span>
                    <span style={{ color: '#6A5A4A' }}>{n.content}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Collapsed capsule, shows the note written for this delegate */
          <div
            onMouseEnter={() => setHoverKey(item.key)}
            onMouseLeave={() => setHoverKey((k) => (k === item.key ? null : k))}
            onClick={() => setFocusKey(item.key)}
            className="flex-1 min-w-0 flex items-center gap-3"
            style={{
              height: 54, borderRadius: 9999, backgroundColor: '#EDE7D8',
              border: '1px solid rgba(221,212,192,0.85)', boxShadow,
              transform: `scale(${scale})`,
              transformOrigin: 'center', transition: PILL_TRANSITION,
              cursor: 'pointer', padding: '0 20px',
            }}
          >
            <SeatFlag country={item.country} size={22} className="shrink-0" />
            <span className="font-semibold shrink-0" style={{ color: '#1C1410' }}>{getCountryDisplayName(item.country, language)}</span>
            {notes.length > 0 ? (
              <span className="flex-1 min-w-0 truncate text-sm" style={{ color: '#6A5A4A' }}>
                {/* Drop the author ONLY when the single note is your own — that is the
                    common case and it should read exactly as it always did. A lone note
                    written by SOMEONE ELSE must still carry their name, or you cannot tell
                    your own note from a colleague's. */}
                {notes.length === 1 && notes[0].isMine ? `— ${notes[0].content}` : notes.map((n, ni) => (
                  <span key={ni}>
                    {ni > 0 && <span style={{ color: '#B8AE9C' }}> / </span>}
                    <span style={{ fontWeight: 700, color: '#1B3828' }}>{n.chairName}: </span>
                    {n.content}
                  </span>
                ))}
              </span>
            ) : <span className="flex-1" />}
            {scored && <span className="shrink-0 text-sm font-black" style={{ color: '#1B3828' }}>✓</span>}
          </div>
        )}

        {/* 2×2 metric grid, interactive for focused, greyed read-only for nearest, absent otherwise */}
        <div className="shrink-0" style={{ width: GRID_COL }}>
          {factors.length > 0 && (isFocused || dist === 1) && metricStack(item, rs, isFocused)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ fontFamily: "'Poppins','Outfit',sans-serif" }}>
      <style>{`.fb-dock-scroll::-webkit-scrollbar{display:none}`}</style>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs px-4" style={{ color: '#9A8A78' }}>{t('fb_empty')}</p>
        </div>
      ) : (
        // overflowX is pinned to hidden. `overflow-y: auto` alone computes overflow-x to `auto`
        // too, so the focused bubble's 2px ring and its hover lift put a horizontal scrollbar
        // under the dock and clipped the ring at the edges ("some things are clipped", owner).
        <div className="fb-dock-scroll flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'none', overflowX: 'hidden' }}>
          <div className="flex flex-col justify-start gap-2 pt-2 pb-6 px-6">
            {sections.map((sc) => (
              <div key={sc.id} className="flex flex-col gap-2">
                {sectionHeader(sc)}
                {sc.items.map((item) => renderItem(item, items.indexOf(item)))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

