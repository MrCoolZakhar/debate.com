'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { CaucusState, Committee } from '@/lib/types';
import { getCountryDisplayName } from '@/lib/countries';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { getScoringConfig, RATING_MIN } from '@/lib/scoring';
import { factorName } from '@/lib/scoringNames';
import { serverNow } from '@/lib/serverClock';
import { buildSessionHistory, liveSegment, RTR_CONTEXT, type SegmentKind } from '@/lib/sessionHistory';
import { motionNames } from '@/lib/committeeFlags';
import { fetchDockFeedback } from '@/lib/feedbackEdit';
import type { FeedbackEntry } from '@/lib/committeeService';
import {
  NoteSync, noteSyncFor, draftNamespace, matchDockRows,
  type MatchCard, type MatchReply, type MatchSpeech, type NoteMeta, type StoredDraft,
} from '@/lib/commentDockSync';
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

const instant = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);

/** A delegation that comes back to the floor this soon after leaving it, with no speech of
 *  theirs logged in between, is the SAME turn: the floor flickered (two realtime slices
 *  landing apart, a catch-up), nobody spoke. It used to start a new turn every time, which
 *  is what drew "Switzerland, South Africa, Switzerland, South Africa" as empty cards. */
const TURN_RESUME_MS = 8000;
/** The dock never moves a chair off the note they are writing. After the last keystroke
 *  (and the blur) it waits this long before going to the next speaker. */
const TYPING_IDLE_MS = 4000;
/** The delay before the dock scrolls to a newly focused card. */
const SCROLL_DELAY_MS = 600;
/** Turns that left the floor with a note that is not filed on a logged speech yet. */
const HOLD_CAP = 6;
/** A safety read of every chair's notes, on top of the realtime bumps (a missed event
 *  after a dropped connection otherwise hid another chair's note until the next one). */
const POLL_MS = 15000;

type ItemKind = 'past' | 'live' | 'next';
interface FeedItem {
  /** The card's identity: React key, note key, draft key. Already resolved through the
   *  alias map, so a note keeps ONE key from the first keystroke to its logged speech. */
  key: string;
  kind: ItemKind;
  country: string;
  context: string;
  /** What the speech was ABOUT: the caucus topic or motion label, or the committee
   *  topic on the GSL. */
  topic?: string;
  /** When the speech was GIVEN (a live card: when this turn started). Absent on `next`. */
  spokenAt?: string;
  seconds?: number;
  timestamp?: string;
}
interface RowState { content: string; scores: Record<string, number>; country: string; }
/** Another chair's note on the same speech. Read-only here — each chair edits only their own row. */
interface OtherNote { chairName: string; content: string; scores: Record<string, number>; }

/** Has this row a rating a chair actually set? A stored score below `RATING_MIN`
 *  means "never rated" to every reader of `factor_scores`. */
const hasRating = (scores: Record<string, number>) =>
  Object.values(scores).some((v) => (v ?? 0) >= RATING_MIN);
const hasNote = (rs?: RowState) => !!rs && (rs.content.trim().length > 0 || hasRating(rs.scores));

/** Two rows minimum, six rows maximum, then it scrolls. Height is written to the node, never
 *  held in state (RULE 3 spirit). */
const NOTE_MIN_PX = 54;
const NOTE_MAX_PX = 132;
function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(NOTE_MAX_PX, Math.max(NOTE_MIN_PX, el.scrollHeight))}px`;
}

/** Follow the alias map: a natural card key (`live|…`, `past|…`) to the key its note lives under. */
function resolveKey(k: string, alias: Record<string, string>): string {
  let cur = k;
  for (let i = 0; i < 6; i++) {
    const n = alias[cur];
    if (!n || n === cur) break;
    cur = n;
  }
  return cur;
}

interface PastSpeech { country: string; context: string; topic: string; seconds: number; timestamp: string; }
function pastSpeeches(committee: Committee): PastSpeech[] {
  return (committee.messages ?? [])
    .filter((m) => m.sender === '__system__' && m.recipient === '__log__' && m.content.startsWith('__log__:'))
    .map((m) => { try { return JSON.parse(m.content.slice('__log__:'.length)); } catch { return null; } })
    .filter((e): e is { country: string; type?: string; context?: string; topic?: string; seconds?: number; timestamp?: string } =>
      !!e && (!e.type || e.type === 'speech') && typeof e.seconds === 'number')
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

// The topic those speakers will be logged under. Mirrors what the chair page logs
// (`caucus?.purpose ?? topic`), with the motion label as a second fallback.
function liveTopic(committee: Committee): string {
  const caucus = liveCaucus(committee);
  if (!caucus) return committee.topic ?? '';
  return caucus.purpose || caucus.motionLabel || committee.topic || '';
}

const metaOf = (item: FeedItem): NoteMeta => ({
  country: item.country,
  speechContext: item.context,
  speechSeconds: item.seconds ?? null,
  speechTopic: item.topic || null,
  spokenAt: item.spokenAt || null,
});

// ─────────────────────────────────────────────────────────────────────────────
// HOW A NOTE STAYS PUT (Oct 2026, after Asia WorldMUN / TY7ZZ3)
//
// Every card has ONE key from the first keystroke until its speech is logged and beyond.
// A note written on an upcoming card, then on the floor, then filed on the logged speech
// is the same card: the live card's natural key is ALIASED to the upcoming card's key when
// the delegation takes the floor, and the logged speech's natural key is aliased to the
// turn's key when the speech lands. No text is ever copied between cards, so no card can
// overwrite another's note, and React never remounts the box a chair is typing in.
//
// The writes go through `NoteSync` (src/lib/commentDockSync.ts): one write per card at a
// time, checked, retried, a client-chosen row id, and a localStorage draft until the
// server holds the exact text. Local text always wins over a read.
// ─────────────────────────────────────────────────────────────────────────────

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const past = useMemo(() => pastSpeeches(committee), [committee.messages]);

  // Upcoming queue (GSL or caucus), excluding whoever holds the floor. ONE card per
  // delegation: a delegate id or a country that appears twice in the list (an optimistic
  // row next to its realtime echo, a re-added delegation) is drawn once.
  const queue = (caucus ? committee.caucusQueue : committee.speakersList) ?? [];
  const upcoming: { delegateId: string; country: string }[] = [];
  {
    const seenId = new Set<string>();
    const seenCountry = new Set<string>();
    const floorKey = (currentCountry ?? '').trim().toLowerCase();
    for (const s of queue) {
      if (!s?.country) continue;
      const c = s.country.trim().toLowerCase();
      if (c === floorKey || seenId.has(s.delegateId) || seenCountry.has(c)) continue;
      seenId.add(s.delegateId);
      seenCountry.add(c);
      upcoming.push({ delegateId: s.delegateId, country: s.country });
    }
  }

  const [state, setState] = useState<Record<string, RowState>>({});
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  // Other chairs' notes on the same speeches, keyed by the same card key. Never edited here.
  const [others, setOthers] = useState<Record<string, OtherNote[]>>({});
  const [alias, setAlias] = useState<Record<string, string>>({});
  const aliasRef = useRef(alias);
  useEffect(() => { aliasRef.current = alias; }, [alias]);
  // An upcoming card's key carries a generation, bumped when its note moved onto the floor,
  // so a delegation queued again later gets a fresh, empty card.
  const [nextGen, setNextGen] = useState<Record<string, number>>({});
  const [failing, setFailing] = useState<Record<string, boolean>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // What the live card is ABOUT, read when a turn is held. Refs, so a caucus label changing
  // mid-turn cannot re-run anything.
  const ctxRef = useRef(ctx);
  const topicRef = useRef(liveTopicNow);
  useEffect(() => { ctxRef.current = ctx; topicRef.current = liveTopicNow; }, [ctx, liveTopicNow]);

  // ── The note store ─────────────────────────────────────────────────────────
  const suffix = committee.dbChairJoinSuffix ?? undefined;
  // The store's identity is the committee and the chair. The suffix can arrive late; it is
  // handed to the store on every render (setAccess), never a reason to start a new store,
  // which would forget every row id and insert duplicates.
  const syncId = `${committee.id}|${chairName}`;
  const syncRef = useRef<{ id: string; sync: NoteSync } | null>(null);
  const draftsRef = useRef<{ drafts: Record<string, StoredDraft>; placed: boolean }>({ drafts: {}, placed: false });
  const getSync = (): NoteSync => {
    const cur = syncRef.current;
    if (cur && cur.id === syncId) return cur.sync;
    cur?.sync.flushAll();
    const sync: NoteSync = noteSyncFor({
      committeeId: committee.id, chairName, code: committee.code, chairSuffix: suffix,
      draftNs: draftNamespace(committee.code, chairName),
      onChange: (key) => {
        if (!mountedRef.current) return;
        const f = sync.isFailing(key);
        setFailing((prev) => {
          if (!!prev[key] === f) return prev;
          const n = { ...prev };
          if (f) n[key] = true; else delete n[key];
          return n;
        });
      },
    });
    syncRef.current = { id: syncId, sync };
    // Unsaved notes: from storage on a fresh page, or still pending in the store after a remount.
    draftsRef.current = { drafts: { ...sync.initialDrafts(), ...sync.currentDrafts() }, placed: false };
    return sync;
  };
  const getSyncRef = useRef(getSync);
  useEffect(() => {
    getSyncRef.current = getSync;
    syncRef.current?.sync.setAccess(committee.code, suffix);
  });

  // ── Typing and focus ───────────────────────────────────────────────────────
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  /** The card whose textarea has keyboard focus right now. */
  const focusedKeyRef = useRef<string | null>(null);
  const lastTypeRef = useRef<{ key: string; at: number } | null>(null);
  const lastBlurRef = useRef(0);
  /** The floor moved while the chair was writing: go to it once they have stopped. */
  const returnPendingRef = useRef(false);
  const busyKey = (): string | null => {
    if (focusedKeyRef.current) return focusedKeyRef.current;
    const last = lastTypeRef.current;
    return last && Date.now() - last.at < TYPING_IDLE_MS ? last.key : null;
  };

  // ── The turn on the floor ──────────────────────────────────────────────────
  //
  // Which delegation holds the floor and WHEN this turn began, derived DURING RENDER so the
  // live key is right from the first paint (17 Sep 2026). A fresh turn gets a fresh card even
  // for the same delegation, UNLESS it is the same turn coming back after a flicker
  // (TURN_RESUME_MS, no speech of theirs logged since it began).
  const [turn, setTurn] = useState<{ country: string | null; at: number }>(
    () => ({ country: currentCountry, at: serverNow() }),
  );
  const [recent, setRecent] = useState<FeedItem[]>([]);   // held turns, see below
  const recentRef = useRef(recent);
  useEffect(() => { recentRef.current = recent; }, [recent]);
  const turnsRef = useRef<Record<string, { at: number; leftAt: number }>>({});
  /** The turn that has just left the floor, drained into `recent` by an effect below. */
  const pendingHoldRef = useRef<FeedItem | null>(null);
  if (turn.country !== currentCountry) {
    // Database clock (RULE 6b): this instant becomes `spoken_at` and is compared with
    // logged speech timestamps, which are stamped with serverNowIso().
    const now = serverNow();
    if (turn.country) {
      turnsRef.current[turn.country] = { at: turn.at, leftAt: now };
      const held: FeedItem = {
        key: `live|${turn.country}|${turn.at}`, kind: 'past', country: turn.country,
        context: ctxRef.current, topic: topicRef.current, spokenAt: new Date(turn.at).toISOString(),
      };
      pendingHoldRef.current = held;
      // Into the list in THIS render, so the outgoing card (and a box being typed in) is
      // never missing for a commit while its speech has not reached the log.
      setRecent((prev) => (prev.some((r) => r.key === held.key) ? prev : [...prev, held]));
    }
    let at = now;
    const prev = currentCountry ? turnsRef.current[currentCountry] : undefined;
    if (prev && now - prev.leftAt < TURN_RESUME_MS
      && !past.some((p) => p.country === currentCountry && instant(p.timestamp) >= prev.at)) {
      at = prev.at;
    }
    setTurn({ country: currentCountry, at });
    // Follow the floor, unless the chair is writing: then stay on their card (see below).
    const b = busyKey();
    if (b) { if (focusKey !== b) setFocusKey(b); returnPendingRef.current = true; }
    else { if (focusKey !== null) setFocusKey(null); returnPendingRef.current = false; }
  }
  const turnStart = turn.country === currentCountry ? turn.at : serverNow();
  const liveNatural = currentCountry ? `live|${currentCountry}|${turnStart}` : null;
  // A note written on this delegation's upcoming card moves onto the floor with them. Derived
  // here as well as recorded by the effect below, so the box keeps its key (and its caret)
  // from the very first render of the new turn.
  const nextNoteFor = (country: string, a: Record<string, string>, rows: Record<string, RowState>) => {
    const targets = new Set(Object.values(a));
    return Object.keys(rows).find((k) =>
      k.startsWith('next|') && rows[k].country === country && !targets.has(k) && hasNote(rows[k]));
  };
  const liveKey = liveNatural
    ? (alias[liveNatural] || hasNote(state[liveNatural]) ? resolveKey(liveNatural, alias) : (nextNoteFor(currentCountry!, alias, state) ?? liveNatural))
    : null;
  const nextNatural = (delegateId: string) => `next|${delegateId}|${nextGen[delegateId] ?? 0}`;

  // ── Turns that have LEFT the floor but are not filed on a logged speech yet ─
  //
  // The instant the Moderator presses Next the outgoing live card leaves the floor, but its
  // speech reaches the log only with the `messages` INSERT, a separate event; and a turn
  // under a second, or a Room Order placeholder, is never logged at all. So the outgoing turn
  // is HELD under its own key until a logged speech takes it over (the alias below). Only a
  // held turn WITH a note (or the card being written in) is drawn: an empty one has nothing
  // to keep, and drawing it is what put empty duplicates under the floor.
  /** Every turn seen on this device: when it began, when it left the floor, whether a logged
   *  speech has taken it over (`consumed`) or none ever will (`dead`). */
  const turnLogRef = useRef<{ natural: string; country: string; at: number; leftAt?: number; consumed: boolean; dead?: boolean }[]>([]);

  useEffect(() => {
    const held = pendingHoldRef.current;
    pendingHoldRef.current = null;
    const sync = getSyncRef.current();
    const cur = stateRef.current;
    const a = { ...aliasRef.current };
    let aliasChanged = false;
    const noteAt = (k: string) => hasNote(cur[k]) || sync.isInserted(k);

    const nowMs = serverNow();
    if (held) {
      const T = turnLogRef.current.find((x) => x.natural === held.key);
      if (T) T.leftAt = nowMs;
    }
    if (turn.country) {
      const nat = `live|${turn.country}|${turn.at}`;
      const T = turnLogRef.current.find((x) => x.natural === nat);
      if (T) T.leftAt = undefined;             // a resumed turn is on the floor again
      else {
        turnLogRef.current.push({ natural: nat, country: turn.country, at: turn.at, consumed: false });
        turnLogRef.current.sort((x, y) => x.at - y.at);
      }
    }

    // 1. A note written on the upcoming card follows the delegation onto the floor.
    if (turn.country) {
      const liveNat = `live|${turn.country}|${turn.at}`;
      if (!a[liveNat] && !noteAt(liveNat)) {
        const nextKey = nextNoteFor(turn.country, a, cur);
        if (nextKey) {
          a[liveNat] = nextKey;
          aliasChanged = true;
          sync.setMeta(nextKey, {
            spokenAt: new Date(turn.at).toISOString(), speechContext: ctxRef.current, speechTopic: topicRef.current || null,
          });
          const id = nextKey.split('|')[1];
          setNextGen((g) => ({ ...g, [id]: (g[id] ?? 0) + 1 }));
        }
      }
    }

    // 2. A turn is filed on the FIRST speech of that delegation logged after it began.
    const taken = new Set(Object.keys(a).filter((k) => k.startsWith('past|')));
    for (const T of turnLogRef.current) {
      if (T.consumed || T.dead) continue;
      // The speech a turn produced is logged as it leaves the floor: not before it began, and
      // not long after it ended. Without the upper bound a turn that was never logged (a
      // flicker, a Room Order placeholder) took the NEXT turn's speech, and that turn's note
      // was left unfiled.
      // A turn WITH a note waits for its speech however late the log is (a parked log row
      // landing minutes later), bounded only by the next turn of the same delegation.
      const tkNow = resolveKey(T.natural, a);
      const withNote = noteAt(tkNow);
      const nextSame = turnLogRef.current.find((x) => x.country === T.country && x.at > T.at);
      const until = Math.min(
        nextSame ? nextSame.at : Infinity,
        withNote || T.leftAt === undefined ? Infinity : T.leftAt + 20_000,
      );
      const p = past
        .filter((x) => x.country === T.country && instant(x.timestamp) >= T.at - 1000 && instant(x.timestamp) <= until)
        .sort((x, y) => instant(x.timestamp) - instant(y.timestamp))
        .find((x) => !taken.has(`past|${x.country}|${x.timestamp}`));
      if (!p) {
        if (!withNote && T.leftAt !== undefined && nowMs - T.leftAt > 60_000) T.dead = true;
        continue;
      }
      const pk = `past|${p.country}|${p.timestamp}`;
      const tk = resolveKey(T.natural, a);
      if (noteAt(pk) && pk !== tk) {
        // That speech already carries this chair's own row (from another device or a
        // reload). Keep the turn's note on its held card rather than hiding one of the two.
        if (!noteAt(tk)) T.consumed = true;
        continue;
      }
      T.consumed = true;
      taken.add(pk);
      a[pk] = tk;
      aliasChanged = true;
      sync.setMeta(tk, {
        speechContext: p.context, speechSeconds: p.seconds, speechTopic: p.topic || null, spokenAt: p.timestamp || null,
      });
    }
    if (aliasChanged) { aliasRef.current = a; setAlias(a); }

    const consumed = new Set(turnLogRef.current.filter((x) => x.consumed).map((x) => x.natural));
    const liveNat = turn.country ? `live|${turn.country}|${turn.at}` : null;
    setRecent((prev) => {
      let next = held && !prev.some((r) => r.key === held.key) ? [...prev, held] : prev;
      next = next.filter((r) => r.key !== liveNat && !consumed.has(r.key));
      // The cap only ever drops EMPTY held turns: a held note stays until its speech files it.
      const empty = next.filter((r) => !noteAt(resolveKey(r.key, a)));
      const drop = new Set(empty.slice(0, Math.max(0, empty.length - HOLD_CAP)).map((r) => r.key));
      if (drop.size) next = next.filter((r) => !drop.has(r.key));
      return next.length === prev.length && next.every((r, i) => r === prev[i]) ? prev : next;
    });
  }, [past, turn]);

  // ── The dock reads like the History (owner, 18 Sep 2026) ────────────────────
  const segments = useMemo(() => buildSessionHistory(committee, []), [committee]);
  const replies = useMemo(() => segments.flatMap((sg) => sg.events.filter((e) => e.type === 'right-of-reply')), [segments]);
  const nextIds = JSON.stringify(upcoming.map((u) => u.delegateId));

  const sections: DockSection[] = useMemo(() => {
    const res = (k: string) => resolveKey(k, alias);
    // Every card exactly once across ALL sections, whatever the inputs say.
    const emitted = new Set<string>();
    const push = (sc: DockSection, item: FeedItem) => {
      if (emitted.has(item.key)) return;
      emitted.add(item.key);
      sc.items.push(item);
    };
    const out: DockSection[] = segments.map((sg) => ({ id: sg.id, kind: sg.kind, topic: sg.topic, startedAt: sg.startedAt, items: [] }));
    segments.forEach((sg, i) => {
      for (const p of sg.speeches) {
        push(out[i], {
          key: res(`past|${p.country}|${p.timestamp}`), kind: 'past', country: p.country, context: p.context,
          topic: p.topic, spokenAt: p.timestamp, seconds: p.seconds, timestamp: p.timestamp,
        });
      }
      // A right of reply: seconds 0 (never null), so nothing mistakes its note for one
      // written on a speech still in progress.
      for (const e of sg.events) {
        if (e.type !== 'right-of-reply') continue;
        push(out[i], {
          key: res(`rtr|${e.country}|${e.timestamp}`), kind: 'past', country: e.country, context: RTR_CONTEXT,
          topic: sg.topic, spokenAt: e.timestamp, seconds: 0, timestamp: e.timestamp,
        });
      }
    });
    // Nothing logged and nothing live yet: one section for the floor.
    if (out.length === 0 && (currentCountry || upcoming.length || recent.length)) {
      const live = liveSegment(committee);
      out.push({ id: 'live|floor', kind: live?.kind ?? 'speakers-list', topic: live?.topic ?? '', startedAt: '', items: [] });
    }
    // `segments` is NEWEST FIRST. Held turns sit in the section they happened in.
    for (const r of recent) {
      const key = res(r.key);
      if (key === liveKey) continue;
      if (!hasNote(state[key]) && key !== focusKey) continue;
      const at = instant(r.spokenAt);
      const home = out.find((sc) => !sc.startedAt || !Number.isFinite(at) || instant(sc.startedAt) <= at) ?? out[0];
      if (home) push(home, { ...r, key });
    }
    const newest = out[0];
    if (newest) {
      if (currentCountry && liveKey) {
        push(newest, { key: liveKey, kind: 'live', country: currentCountry, context: ctx, topic: liveTopicNow, spokenAt: new Date(turnStart).toISOString() });
      }
      // Upcoming delegations only in the newest section, once each.
      for (const u of upcoming) {
        push(newest, { key: res(nextNatural(u.delegateId)), kind: 'next', country: u.country, context: ctx, topic: liveTopicNow });
      }
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
  }, [segments, recent, currentCountry, liveKey, turnStart, nextIds, ctx, liveTopicNow, alias, nextGen, state, focusKey]);

  // The cards in the order they are drawn: the focus recede reads this.
  const items: FeedItem[] = useMemo(() => sections.flatMap((sc) => sc.items), [sections]);

  // What a read needs, as of the latest render (applied when the read lands, not when it started).
  const inputsRef = useRef<{ speeches: MatchSpeech[]; replies: MatchReply[]; live: MatchCard | null; next: MatchCard[]; itemKeys: Set<string>; upcoming: typeof upcoming }>({
    speeches: [], replies: [], live: null, next: [], itemKeys: new Set(), upcoming: [],
  });
  useEffect(() => {
    inputsRef.current = {
      speeches: past.map((p) => ({ key: `past|${p.country}|${p.timestamp}`, country: p.country, context: p.context, seconds: p.seconds, timestamp: p.timestamp })),
      replies: replies.map((r) => ({ key: `rtr|${r.country}|${r.timestamp}`, country: r.country, timestamp: r.timestamp })),
      live: currentCountry && liveNatural ? { key: liveNatural, country: currentCountry, at: turnStart } : null,
      next: upcoming.map((u) => ({ key: nextNatural(u.delegateId), country: u.country })),
      itemKeys: new Set(items.map((i) => i.key)),
      upcoming,
    };
  });

  // ── Reading every chair's notes ────────────────────────────────────────────
  //
  // ONE read in flight; a bump that arrives meanwhile asks for exactly one more afterwards. A
  // result is applied unless a NEWER read has already been applied. The old effect cancelled
  // every read the moment the next `feedback` event arrived, so with three chairs typing
  // (an event every few hundred ms) on venue Wi-Fi no read ever finished and nobody saw the
  // others' notes; and a failed read answered [] and wiped them.
  const fetchCtl = useRef({ inflight: false, again: false, seq: 0, applied: 0 });
  const applyRef = useRef<(rows: FeedbackEntry[], startedAt: number) => void>(() => {});
  const fetchRef = useRef<() => void>(() => {});
  useEffect(() => {
    fetchRef.current = () => {
      const ctl = fetchCtl.current;
      if (ctl.inflight) { ctl.again = true; return; }
      ctl.inflight = true;
      const seq = ++ctl.seq;
      const startedAt = Date.now();
      void fetchDockFeedback(committee.id, committee.code, suffix)
        .then((rows) => {
          if (rows && mountedRef.current && seq > ctl.applied) {
            ctl.applied = seq;
            applyRef.current(rows, startedAt);
          }
        })
        .catch((err) => { console.error('Dock read failed:', err); })
        .finally(() => {
          ctl.inflight = false;
          if (ctl.again && mountedRef.current) { ctl.again = false; fetchRef.current(); }
        });
    };
    applyRef.current = (rows, startedAt) => {
      const inp = inputsRef.current;
      const a = aliasRef.current;
      const res = (k: string) => resolveKey(k, a);
      const sync = getSyncRef.current();
      const m = matchDockRows(rows, chairName, inp.speeches, inp.replies, inp.live, inp.next);

      const theirs: Record<string, OtherNote[]> = {};
      for (const [nat, list] of Object.entries(m.others)) {
        const key = res(nat);
        const bucket = (theirs[key] ??= []);
        for (const f of list) bucket.push({ chairName: f.chairName, content: f.content, scores: f.factorScores ?? {} });
      }
      setOthers(theirs);

      const touched = new Set<string>();
      const lateAlias: Record<string, string> = {};
      // A card key from an earlier mount of this dock (the store outlives a remount): nothing
      // here draws it, so its note may move to the card that is drawn now.
      const stale = (k: string) => !inp.itemKeys.has(k) && !(k in stateRef.current) && !recentRef.current.some((r) => resolveKey(r.key, a) === k);
      for (const [nat, row] of Object.entries(m.mine)) {
        const key = res(nat);
        const owner = sync.ownerOf(row.id);
        if (owner && owner !== key) {
          if (stale(owner)) sync.rekey(owner, key);
          else if (nat.startsWith('past|') && !a[nat] && !hasNote(stateRef.current[nat]) && !sync.has(nat)) {
            // The speech of a HELD note arrived late: file the speech card on the held note
            // (the same alias the turn effect writes) instead of drawing it empty.
            lateAlias[nat] = owner;
            const T = turnLogRef.current.find((x) => resolveKey(x.natural, a) === owner);
            if (T) T.consumed = true;
            const r = m.refile.find((x) => x.key === nat);
            if (r) {
              sync.setMeta(owner, {
                speechContext: r.speech.context, speechSeconds: r.speech.seconds,
                speechTopic: past.find((p) => p.timestamp === r.speech.timestamp && p.country === r.speech.country)?.topic || null,
                spokenAt: r.speech.timestamp || null,
              });
            }
            continue;
          }
        }
        // One row, one card: refused when another card owns this row or the card writes its own.
        if (!sync.adoptServer(key, row)) continue;
        touched.add(key);
        // A note edited on the scoreboard by this same chair: taken only when the card is
        // settled, not being written in, and the read began after our last write landed.
        if (busyKey() !== key) sync.takeServerText(key, row.content, row.factorScores ?? {}, startedAt);
      }
      if (Object.keys(lateAlias).length) {
        const next = { ...aliasRef.current, ...lateAlias };
        aliasRef.current = next;
        setAlias(next);
        const gone = new Set(Object.values(lateAlias));
        setRecent((prev) => prev.filter((r) => !gone.has(resolveKey(r.key, next))));
      }
      for (const r of m.refile) {
        if (lateAlias[r.key]) continue;
        const key = res(r.key);
        if (sync.idOf(key) !== r.row.id) continue;
        sync.setMeta(key, {
          speechContext: r.speech.context, speechSeconds: r.speech.seconds,
          speechTopic: past.find((p) => p.timestamp === r.speech.timestamp && p.country === r.speech.country)?.topic || null,
          spokenAt: r.speech.timestamp || null,
        });
      }

      // Drafts left in storage by a reload or a crash: put each back once.
      const dr = draftsRef.current;
      if (!dr.placed) {
        dr.placed = true;
        for (const [dKey, d] of Object.entries(dr.drafts)) {
          const row = rows.find((f) => f.id === d.id);
          if (row && row.content === d.content) { sync.dropDraft(dKey); continue; }
          let target: string | undefined = row ? sync.ownerOf(row.id) : undefined;
          if (!target && inp.itemKeys.has(dKey)) target = dKey;
          if (!target) {
            const c = d.meta.country;
            const from = instant(d.meta.spokenAt) || d.at;
            const speech = inp.speeches
              .filter((s) => s.country === c && instant(s.timestamp) >= from - 1000)
              .sort((x, y) => instant(x.timestamp) - instant(y.timestamp))[0];
            if (d.meta.speechSeconds == null && inp.live && inp.live.country === c && !speech) target = res(inp.live.key);
            else if (speech) target = res(speech.key);
            else {
              const u = inp.upcoming.find((x) => x.country === c);
              if (u) target = res(inp.next.find((n) => n.country === c)?.key ?? '');
            }
          }
          if (!target) continue;                       // kept in storage, never dropped
          const owner = sync.ownerOf(d.id);
          if (owner && owner !== target) {
            // Left over from an earlier mount: move it to the card drawn now. Otherwise its
            // row lives on another card and stays there.
            if (!stale(owner) || !sync.rekey(owner, target)) continue;
            touched.add(target);
            continue;
          }
          const curNote = sync.contentOf(target);
          if (curNote && curNote.trim() && curNote !== d.content && sync.idOf(target) !== d.id) continue;
          sync.restore(target, d);
          if (target !== dKey) sync.dropDraft(dKey);
          touched.add(target);
        }
      }

      if (touched.size) {
        setState((prev) => {
          const n = { ...prev };
          for (const key of touched) {
            const content = sync.contentOf(key);
            if (content === undefined) continue;
            const country = prev[key]?.country ?? sync.countryOf(key) ?? '';
            n[key] = { content, scores: sync.scoresOf(key) ?? {}, country };
          }
          return n;
        });
      }
    };
  });

  // Read on mount, on every realtime `feedback` bump, on a new speech, on a floor change.
  useEffect(() => { fetchRef.current(); },
    [committee.id, chairName, feedbackVersion, past.length, replies.length, currentCountry]);

  // A safety read, a retry of anything unsaved when the network or the tab comes back, and a
  // flush when the page is hidden or closed.
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') fetchRef.current();
    }, POLL_MS);
    const online = () => { getSyncRef.current().retryAll(); fetchRef.current(); };
    const vis = () => {
      if (document.visibilityState === 'visible') online();
      else getSyncRef.current().flushAll();
    };
    const hide = () => getSyncRef.current().flushAll();
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', hide);
    return () => {
      clearInterval(poll);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', hide);
      syncRef.current?.sync.flushAll();
    };
  }, []);

  // On speaker change: send everything unsaved now.
  useEffect(() => () => { syncRef.current?.sync.flushAll(); }, [currentCountry]);

  // ── The floor moved: follow it, but never off a note being written ─────────
  //
  // "The automatic scrolling can be quite annoying when a chair is typing" (owner, Oct 2026).
  // If a textarea has focus, or a key went down in the last TYPING_IDLE_MS, the focus STAYS
  // on that card; once the chair has left the box and stopped for TYPING_IDLE_MS, it goes to
  // the floor.
  // (The pin itself is decided during render, in the turn block above, so the box being
  // written in is never collapsed for even one commit.)
  useEffect(() => {
    const id = setInterval(() => {
      if (!returnPendingRef.current || focusedKeyRef.current) return;
      const last = Math.max(lastTypeRef.current?.at ?? 0, lastBlurRef.current);
      if (Date.now() - last < TYPING_IDLE_MS) return;
      returnPendingRef.current = false;
      setFocusKey(null);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const setNote = (item: FeedItem, content: string) => {
    lastTypeRef.current = { key: item.key, at: Date.now() };
    getSync().setContent(item.key, metaOf(item), content);
    setState((prev) => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { scores: {}, country: item.country }), content, country: item.country } }));
  };
  const setScore = (item: FeedItem, factorId: string, v: number) => {
    const sync = getSync();
    const scores = { ...(sync.scoresOf(item.key) ?? stateRef.current[item.key]?.scores ?? {}), [factorId]: v };
    sync.setScores(item.key, metaOf(item), scores);
    setState((prev) => {
      const cur = prev[item.key] ?? { content: '', scores: {}, country: item.country };
      return { ...prev, [item.key]: { ...cur, scores, country: item.country } };
    });
  };

  const effectiveFocus = focusKey && items.some((i) => i.key === focusKey) ? focusKey : liveKey;
  const focusIdx = items.findIndex((i) => i.key === effectiveFocus);

  // Roll the focused row into view when focus changes, a beat later, and never away from a
  // box the chair is writing in.
  useEffect(() => {
    if (!effectiveFocus) return;
    const id = setTimeout(() => {
      const b = busyKey();
      if (b && b !== effectiveFocus) return;
      rowRefs.current[effectiveFocus]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, SCROLL_DELAY_MS);
    return () => clearTimeout(id);
  }, [effectiveFocus]);

  const PILL_TRANSITION = 'transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease, opacity 260ms ease, box-shadow 260ms ease, background-color 260ms ease';
  // Reserved so pills/grids stay aligned across rows. Collapses to 0 when ratings are off.
  const GRID_COL = factors.length ? 280 : 0;
  // The tag belongs to the ROW, not to the room: a past speech keeps the context it was given under.
  const tagFor = (item: FeedItem) => {
    if (item.context === RTR_CONTEXT) return t('sb_hist_right_of_reply');
    if (item.context === 'speakers-list') return t('fb_tag_gsl');
    if (item.context === ctx && caucus?.motionLabel) return caucus.motionLabel;
    // Only a Consultation of the Whole floor holder logs this context.
    return item.context === 'unmoderated-caucus' ? motionNames(committee, language).consultation : t('fb_tag_caucus');
  };
  const maxScale = Math.max(RATING_MIN + 1, cfg.factorScaleMax);

  // Every chair's note on one speech, mine first. The author prefix appears ONLY when
  // more than one chair has written.
  const notesFor = (key: string, mine: RowState): { chairName: string; content: string; isMine: boolean }[] => {
    const out: { chairName: string; content: string; isMine: boolean }[] = [];
    if (mine.content.trim()) out.push({ chairName, content: mine.content.trim(), isMine: true });
    for (const o of others[key] ?? []) {
      if (o.content.trim()) out.push({ chairName: o.chairName || t('fb_chair'), content: o.content.trim(), isMine: false });
    }
    return out;
  };

  // Distance-based recede (index 0 = focused). No blur; the faintest row is 0.7.
  const scaleByDist = [1, 0.99, 0.985, 0.98];
  const opacityByDist = [1, 0.88, 0.78, 0.7];

  // Factor labels read exactly as the chair named them ("RoP/Diplomatic Conduct") and wrap
  // onto a second line instead of being capitalised and cut off in a 130px column.
  const factorLabelClass = 'text-[10px] leading-tight min-w-0 [overflow-wrap:anywhere]';

  // Qualitative ratings: sliders on the focused pill, compact read-only values on the
  // nearest neighbour. The scale starts at RATING_MIN, not 0 (0 reads as "never rated").
  const metricStack = (item: FeedItem, rs: RowState, interactive: boolean) => (
    <div className="grid gap-x-4 gap-y-1.5" style={{ width: GRID_COL, gridTemplateColumns: '1fr 1fr' }}>
      {factors.map((f) => {
        const v = rs.scores[f.id] ?? 0;
        const rated = v >= RATING_MIN;
        if (!interactive) {
          return (
            <div key={f.id} className="flex items-baseline gap-1.5">
              <span className={`${factorLabelClass} flex-1`} style={{ color: '#9A8A78' }}>{factorName(f, language)}</span>
              <span className="text-[11px] font-bold shrink-0" style={{ color: '#9A8A78' }}>{rated ? v : t('fb_not_rated')}</span>
            </div>
          );
        }
        return (
          <div key={f.id}>
            <div className="flex items-baseline justify-between gap-1">
              <span className={`${factorLabelClass} font-bold`} style={{ color: '#6A5A4A' }}>{factorName(f, language)}</span>
              <span className="text-xs font-black shrink-0" style={{ color: rated ? '#1B3828' : '#B8AE9C' }}>{rated ? v : t('fb_not_rated')}</span>
            </div>
            <input
              type="range" min={RATING_MIN} max={maxScale} step={1}
              value={rated ? v : RATING_MIN}
              aria-label={factorName(f, language)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setScore(item, f.id, parseInt(e.target.value))}
              // Releasing the control commits the bottom of the scale, which fires no change.
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
      <div key={`h|${sc.id}`} className="flex items-center gap-2 pt-3 pb-0.5 min-w-0" style={{ color: '#1B3828' }}>
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
          /* Active, wide writing bubble */
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
              <span title={item.topic || undefined} className="text-[11px] font-black uppercase tracking-wider shrink-0" style={{ color: '#1B3828' }}>{tagFor(item)}</span>
              <SeatCircleFlag country={item.country} size={26} decorative className="shrink-0" />
              <span className="flex-1 min-w-0 text-base font-bold leading-tight [overflow-wrap:anywhere]" style={{ color: '#1C1410' }}>{getCountryDisplayName(item.country, language)}</span>
              {!isLive && (
                <button
                  onClick={(e) => { e.stopPropagation(); returnPendingRef.current = false; setFocusKey(null); }}
                  className="shrink-0 text-sm focus:outline-none" style={{ color: '#9A8A78' }}
                >✕</button>
              )}
            </div>
            <textarea
              ref={(el) => { if (el) autoGrow(el); }}
              rows={2}
              value={rs.content}
              onChange={(e) => { autoGrow(e.currentTarget); setNote(item, e.target.value); }}
              onFocus={() => { focusedKeyRef.current = item.key; }}
              onBlur={() => {
                if (focusedKeyRef.current === item.key) focusedKeyRef.current = null;
                lastBlurRef.current = Date.now();
                getSync().flush(item.key);
              }}
              placeholder={t('fb_private_note')}
              className="w-full mt-2 text-sm rounded-lg px-3 py-2 outline-none resize-none"
              style={{ color: '#1C1410', backgroundColor: '#FAF8F3', border: '1px solid #EDE7D8', overflowY: 'auto' }}
            />
            {failing[item.key] && (
              <p role="status" className="mt-1 px-1 text-[11px] leading-snug" style={{ color: '#8B2020' }}>{t('fb_note_unsaved')}</p>
            )}
            {/* What the other chairs wrote on this same speech — read-only. */}
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
            onClick={() => { returnPendingRef.current = false; setFocusKey(item.key); }}
            className="flex-1 min-w-0 flex items-center gap-3"
            style={{
              height: 54, borderRadius: 9999, backgroundColor: '#EDE7D8',
              border: '1px solid rgba(221,212,192,0.85)', boxShadow,
              transform: `scale(${scale})`,
              transformOrigin: 'center', transition: PILL_TRANSITION,
              cursor: 'pointer', padding: '0 20px',
            }}
          >
            <SeatCircleFlag country={item.country} size={22} decorative className="shrink-0" />
            <span className="font-semibold shrink-0" style={{ color: '#1C1410' }}>{getCountryDisplayName(item.country, language)}</span>
            {notes.length > 0 ? (
              <span
                className="flex-1 min-w-0 truncate text-sm" style={{ color: '#6A5A4A' }}
                title={notes.map((n) => (notes.length === 1 && n.isMine ? n.content : `${n.chairName}: ${n.content}`)).join(' / ')}
              >
                {notes.length === 1 && notes[0].isMine ? `· ${notes[0].content}` : notes.map((n, ni) => (
                  <span key={ni}>
                    {ni > 0 && <span style={{ color: '#B8AE9C' }}> / </span>}
                    <span style={{ fontWeight: 700, color: '#1B3828' }}>{n.chairName}: </span>
                    {n.content}
                  </span>
                ))}
              </span>
            ) : <span className="flex-1" />}
            {failing[item.key] && <span aria-hidden className="shrink-0 text-sm font-black" style={{ color: '#8B2020' }}>!</span>}
            {scored && <span className="shrink-0 text-sm font-black" style={{ color: '#1B3828' }}>✓</span>}
          </div>
        )}

        {/* 2×2 metric grid, interactive for focused, read-only for nearest, absent otherwise */}
        <div className="shrink-0" style={{ width: GRID_COL }}>
          {factors.length > 0 && (isFocused || dist === 1) && metricStack(item, rs, isFocused)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ fontFamily: "'Poppins',var(--font-brand), sans-serif" }}>
      <style>{`.fb-dock-scroll::-webkit-scrollbar{display:none}`}</style>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs px-4" style={{ color: '#9A8A78' }}>{t('fb_empty')}</p>
        </div>
      ) : (
        // overflowX is pinned to hidden: `overflow-y: auto` alone computes overflow-x to auto.
        <div className="fb-dock-scroll flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'none', overflowX: 'hidden' }}>
          {/* ONE flat list (headers are rows of it), so a card that moves to another section
              is reordered, never unmounted: the box a chair is typing in keeps its caret. */}
          <div className="flex flex-col justify-start gap-2 pt-2 pb-6 px-6">
            {sections.flatMap((sc) => [
              sectionHeader(sc),
              ...sc.items.map((item) => renderItem(item, items.indexOf(item))),
            ])}
          </div>
        </div>
      )}
    </div>
  );
}
