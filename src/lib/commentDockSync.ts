// ============================================================
// src/lib/commentDockSync.ts
//
// The Commenter comment dock's note store (Oct 2026, after Asia WorldMUN / TY7ZZ3:
// "occasionally removes comments, around 5 times a full written comment got removed",
// "sometimes commenters can't see what other commenters are writing").
//
// Three pieces, all free of React:
//
//  1. `NoteSync`: ONE writer per card. The dock used to fire an INSERT on the first
//     keystroke and an UPDATE on every 700 ms pause, every blur and every speaker change,
//     all fire-and-forget. On venue Wi-Fi two UPDATEs a second apart could land in the
//     wrong order (the DB kept the shorter text), a lost INSERT response made a second
//     row, and a refused write simply vanished. Here a card has exactly one write in
//     flight; when it lands the next one carries whatever was typed meanwhile; a failure
//     is retried with backoff; the row id is chosen on the client, so a retried INSERT can
//     never make a duplicate (23505 = the first attempt landed). The local text wins until
//     the server is known to hold exactly that text.
//
//  2. Drafts in localStorage, per session code + chair name: every note that the server
//     has not confirmed is mirrored there and restored after a reload or a crash, then
//     cleared once the server holds it.
//
//  3. `matchDockRows`: which stored row belongs to which card, for this chair and for the
//     other chairs. Pure.
// ============================================================

import type { FeedbackEntry } from './committeeService';
import { insertDockNote, patchDockNote } from './feedbackEdit';
import { newRowId } from './offlineResilience';
import { RATING_MIN } from './scoring';
import { RTR_CONTEXT } from './sessionHistory';

export interface NoteMeta {
  country: string;
  speechContext: string | null;
  speechSeconds: number | null;
  speechTopic: string | null;
  spokenAt: string | null;
}

interface Snapshot { content: string; scores: string; meta: string }

interface Entry {
  id: string;
  inserted: boolean;
  content: string;
  scores: Record<string, number>;
  meta: NoteMeta;
  confirmed: Snapshot | null;
  inflight: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  failures: number;
  gone: number;
  updatedAt: number;
  /** Date.now() when the last write of this card landed. A read that started before it can
   *  carry older text and must never be taken over it. */
  confirmedAt: number;
}

export interface StoredDraft {
  id: string;
  content: string;
  scores: Record<string, number>;
  meta: NoteMeta;
  at: number;
  inserted: boolean;
}

/** How long a typed note waits before it is sent (owner brief: about a second and a half). */
export const NOTE_SAVE_DEBOUNCE_MS = 1200;
const SCORE_SAVE_DEBOUNCE_MS = 300;
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

const scoresKey = (s: Record<string, number>) =>
  JSON.stringify(Object.keys(s).sort().map((k) => [k, s[k]]));
const metaKey = (m: NoteMeta) =>
  JSON.stringify([m.country, m.speechContext, m.speechSeconds, m.speechTopic, m.spokenAt ? Date.parse(m.spokenAt) : null]);
const snap = (e: Entry): Snapshot => ({ content: e.content, scores: scoresKey(e.scores), meta: metaKey(e.meta) });
const same = (a: Snapshot | null, b: Snapshot) => !!a && a.content === b.content && a.scores === b.scores && a.meta === b.meta;

const worthSaving = (e: Entry) =>
  e.content.trim().length > 0 || Object.values(e.scores).some((v) => (v ?? 0) >= RATING_MIN);

export function draftNamespace(code: string, chairName: string): string {
  return `gavelling-dock-drafts:${code}:${chairName}`;
}

export function loadDrafts(ns: string): Record<string, StoredDraft> {
  try {
    const raw = localStorage.getItem(ns);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredDraft>;
    const out: Record<string, StoredDraft> = {};
    const now = Date.now();
    for (const [k, d] of Object.entries(parsed ?? {})) {
      if (d && typeof d.content === 'string' && typeof d.id === 'string' && now - (d.at ?? 0) < DRAFT_TTL_MS) out[k] = d;
    }
    return out;
  } catch {
    return {};
  }
}

const stores = new Map<string, NoteSync>();

/** ONE store per committee + chair for the life of the page, reused across remounts (a gavel
 *  flip remounts the dock). Two stores used to write the same draft key from their own maps,
 *  so the older one could wipe the newer one's drafts. */
export function noteSyncFor(opts: NoteSyncOptions): NoteSync {
  const id = `${opts.committeeId}|${opts.chairName}`;
  let s = stores.get(id);
  if (!s) {
    s = new NoteSync(opts);
    stores.set(id, s);
  } else {
    s.setAccess(opts.code, opts.chairSuffix);
    s.setOnChange(opts.onChange);
  }
  return s;
}

export interface NoteSyncOptions {
  committeeId: string;
  chairName: string;
  code: string;
  chairSuffix?: string;
  draftNs: string;
  /** Called whenever a card's save state may have changed (settled, failing, id). */
  onChange?: (key: string) => void;
}

export class NoteSync {
  private entries = new Map<string, Entry>();
  private drafts: Record<string, StoredDraft>;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private opts: NoteSyncOptions) {
    this.drafts = loadDrafts(opts.draftNs);
  }

  setOnChange(fn?: (key: string) => void): void {
    this.opts.onChange = fn;
  }

  /** Unsaved notes as they stand now (a remount places them again). */
  currentDrafts(): Record<string, StoredDraft> {
    return { ...this.drafts };
  }

  /** Move a card's note to a new card key (a key left over from an earlier mount). */
  rekey(from: string, to: string): boolean {
    if (from === to) return true;
    const e = this.entries.get(from);
    if (!e || this.entries.has(to)) return false;
    this.entries.delete(from);
    this.entries.set(to, e);
    if (this.drafts[from]) { this.drafts[to] = this.drafts[from]; delete this.drafts[from]; }
    if (e.timer) { clearTimeout(e.timer); e.timer = null; this.schedule(to, 0); }
    this.saveDraftSoon(to);
    return true;
  }

  /** The chair suffix can arrive after the first render; writes always use the latest. */
  setAccess(code: string, chairSuffix?: string): void {
    this.opts.code = code;
    this.opts.chairSuffix = chairSuffix;
  }

  /** Drafts found in storage when this store was created (a reload, a crash). */
  initialDrafts(): Record<string, StoredDraft> {
    return { ...this.drafts };
  }

  has(key: string): boolean { return this.entries.has(key); }
  idOf(key: string): string | undefined { return this.entries.get(key)?.id; }
  ownerOf(id: string): string | undefined {
    for (const [k, e] of this.entries) if (e.id === id) return k;
    return undefined;
  }
  isInserted(key: string): boolean { return !!this.entries.get(key)?.inserted; }
  /** The server is known to hold exactly what this card shows. */
  isSettled(key: string): boolean {
    const e = this.entries.get(key);
    if (!e) return true;
    if (!e.inserted) return !worthSaving(e);
    return same(e.confirmed, snap(e));
  }
  isFailing(key: string): boolean { return (this.entries.get(key)?.failures ?? 0) >= 2; }
  contentOf(key: string): string | undefined { return this.entries.get(key)?.content; }
  countryOf(key: string): string | undefined { return this.entries.get(key)?.meta.country; }
  scoresOf(key: string): Record<string, number> | undefined {
    const e = this.entries.get(key);
    return e ? { ...e.scores } : undefined;
  }

  /** Create the card's entry (a fresh client id) if it has none. */
  ensure(key: string, meta: NoteMeta): Entry {
    let e = this.entries.get(key);
    if (!e) {
      e = {
        id: newRowId(), inserted: false, content: '', scores: {}, meta: { ...meta },
        confirmed: null, inflight: false, timer: null, failures: 0, gone: 0, updatedAt: Date.now(), confirmedAt: 0,
      };
      this.entries.set(key, e);
    }
    return e;
  }

  /** A stored row of THIS chair belongs to this card. Refused (false) when the card already
   *  writes a different row that the server holds, or when another card owns this row: one
   *  row, one card. */
  adoptServer(key: string, row: FeedbackEntry): boolean {
    const owner = this.ownerOf(row.id);
    if (owner && owner !== key) return false;
    const meta: NoteMeta = {
      country: row.country, speechContext: row.speechContext, speechSeconds: row.speechSeconds,
      speechTopic: row.speechTopic, spokenAt: row.spokenAt,
    };
    const server: Snapshot = { content: row.content, scores: scoresKey(row.factorScores ?? {}), meta: metaKey(meta) };
    const e = this.entries.get(key);
    if (!e) {
      this.entries.set(key, {
        id: row.id, inserted: true, content: row.content, scores: { ...(row.factorScores ?? {}) }, meta,
        confirmed: server, inflight: false, timer: null, failures: 0, gone: 0, updatedAt: Date.now(), confirmedAt: 0,
      });
      return true;
    }
    if (e.id === row.id) {
      e.inserted = true;
      // Only learn what the server holds, and only when nothing of ours has been confirmed:
      // a stale read must never move `confirmed` backwards. The local text is never replaced here.
      if (!e.inflight && !e.confirmed) e.confirmed = server;
      return true;
    }
    // The card has its own id. Switch to the stored row only while nothing of ours exists yet.
    if (e.inserted || e.inflight || worthSaving(e)) return false;
    if (e.timer) clearTimeout(e.timer);
    this.entries.set(key, {
      id: row.id, inserted: true, content: row.content, scores: { ...(row.factorScores ?? {}) }, meta,
      confirmed: server, inflight: false, timer: null, failures: 0, gone: 0, updatedAt: Date.now(), confirmedAt: 0,
    });
    return true;
  }

  /** Take the server's text for a settled card (an edit made on the scoreboard). */
  takeServerText(key: string, content: string, scores: Record<string, number>, readStartedAt: number): void {
    const e = this.entries.get(key);
    if (!e || e.inflight || !this.isSettled(key) || readStartedAt <= e.confirmedAt) return;
    e.content = content;
    e.scores = { ...scores };
    if (e.confirmed) e.confirmed = { ...e.confirmed, content, scores: scoresKey(scores) };
  }

  setContent(key: string, meta: NoteMeta, content: string): void {
    const e = this.ensure(key, meta);
    e.content = content;
    e.updatedAt = Date.now();
    this.saveDraftSoon(key);
    this.schedule(key, NOTE_SAVE_DEBOUNCE_MS);
  }

  setScores(key: string, meta: NoteMeta, scores: Record<string, number>): void {
    const e = this.ensure(key, meta);
    e.scores = { ...scores };
    e.updatedAt = Date.now();
    this.saveDraftSoon(key);
    this.schedule(key, SCORE_SAVE_DEBOUNCE_MS);
  }

  /** Re-file the note on the speech it belongs to (the reconcile and orphan passes). */
  setMeta(key: string, patch: Partial<NoteMeta>): void {
    const e = this.entries.get(key);
    if (!e) return;
    const next = { ...e.meta, ...patch };
    if (metaKey(next) === metaKey(e.meta)) return;
    e.meta = next;
    this.saveDraftSoon(key);
    this.schedule(key, 0);
  }

  /** Put a restored draft's text back on a card (the server holds less, or nothing). */
  restore(key: string, draft: StoredDraft): void {
    const e = this.ensure(key, draft.meta);
    if (!e.inserted && !e.inflight && e.id !== draft.id && !worthSaving(e)) e.id = draft.id;
    e.content = draft.content;
    e.scores = { ...draft.scores };
    e.updatedAt = Date.now();
    this.saveDraftSoon(key);
    this.schedule(key, 0);
  }

  schedule(key: string, ms: number): void {
    const e = this.entries.get(key);
    if (!e || this.disposed) return;
    if (e.timer) clearTimeout(e.timer);
    e.timer = setTimeout(() => { e.timer = null; void this.sync(key); }, ms);
  }

  flush(key: string): void {
    const e = this.entries.get(key);
    if (!e) return;
    if (e.timer) { clearTimeout(e.timer); e.timer = null; }
    void this.sync(key);
  }

  flushAll(): void {
    for (const key of this.entries.keys()) {
      if (!this.isSettled(key)) this.flush(key);
    }
    this.writeDrafts();
  }

  /** Retry everything that has not landed (the network came back, the tab is visible). */
  retryAll(): void {
    for (const [key, e] of this.entries) if (e.failures > 0 && !e.inflight) this.flush(key);
  }

  dispose(): void {
    this.flushAll();
    this.disposed = true;
  }

  private async sync(key: string): Promise<void> {
    const e = this.entries.get(key);
    if (!e || e.inflight) return;
    const want = snap(e);
    const { code, chairSuffix, chairName, committeeId } = this.opts;
    let ok = false;
    e.inflight = true;
    try {
      if (!e.inserted) {
        if (!worthSaving(e)) { e.inflight = false; this.settle(key); return; }
        const r = await insertDockNote({
          id: e.id, committeeId, country: e.meta.country, chairName,
          content: e.content, factorScores: e.scores,
          speechContext: e.meta.speechContext, speechSeconds: e.meta.speechSeconds,
          speechTopic: e.meta.speechTopic, spokenAt: e.meta.spokenAt,
        }, code, chairSuffix);
        if (r === 'ok') { e.inserted = true; e.confirmed = want; e.confirmedAt = Date.now(); ok = true; }
        else if (r === 'exists') {
          // An earlier attempt landed (its response was lost) or the id is taken. Whatever
          // the row holds is unknown: patch every field next.
          e.inserted = true; e.confirmed = null; e.confirmedAt = Date.now(); ok = true;
        }
      } else if (!same(e.confirmed, want)) {
        const c = e.confirmed;
        const patch: Parameters<typeof patchDockNote>[2] = {};
        if (!c || c.content !== want.content) patch.content = e.content;
        if (!c || c.scores !== want.scores) patch.factorScores = e.scores;
        if (!c || c.meta !== want.meta) {
          patch.speechContext = e.meta.speechContext;
          patch.speechSeconds = e.meta.speechSeconds;
          patch.speechTopic = e.meta.speechTopic;
          patch.spokenAt = e.meta.spokenAt;
        }
        const r = await patchDockNote(e.id, chairName, patch, code, chairSuffix);
        if (r === 'ok') { e.confirmed = want; e.confirmedAt = Date.now(); e.gone = 0; ok = true; }
        else if (r === 'gone') {
          // Deleted, or not ours. Insert it again; after a second miss under a fresh id, so a
          // row id held by someone else can never loop.
          e.gone += 1;
          e.inserted = false;
          e.confirmed = null;
          if (e.gone >= 2) { e.id = newRowId(); e.gone = 0; }
          ok = true;
        }
      } else {
        ok = true;
      }
    } catch (err) {
      console.error('Dock note save failed:', err);
    }
    e.inflight = false;
    if (this.disposed && !ok) return;
    if (ok) {
      e.failures = 0;
      if (!same(e.confirmed, snap(e)) && (e.inserted ? true : worthSaving(e))) {
        // Typed meanwhile (or re-filed): send the next version now, still one at a time.
        void this.sync(key);
      }
    } else {
      e.failures += 1;
      const wait = Math.min(1500 * 2 ** Math.min(e.failures - 1, 4), 20_000);
      if (e.failures <= 40) this.schedule(key, wait);
    }
    this.settle(key);
  }

  private settle(key: string): void {
    this.saveDraftSoon(key);
    this.opts.onChange?.(key);
  }

  private saveDraftSoon(key: string): void {
    const e = this.entries.get(key);
    if (!e) return;
    if (this.isSettled(key)) delete this.drafts[key];
    else {
      this.drafts[key] = {
        id: e.id, content: e.content, scores: { ...e.scores }, meta: { ...e.meta }, at: e.updatedAt, inserted: e.inserted,
      };
    }
    if (this.draftTimer) return;
    this.draftTimer = setTimeout(() => { this.draftTimer = null; this.writeDrafts(); }, 250);
  }

  /** Forget a stored draft that turned out to be on the server already. */
  dropDraft(key: string): void {
    if (!(key in this.drafts)) return;
    delete this.drafts[key];
    this.writeDrafts();
  }

  private writeDrafts(): void {
    try {
      const keys = Object.keys(this.drafts);
      if (keys.length === 0) localStorage.removeItem(this.opts.draftNs);
      else localStorage.setItem(this.opts.draftNs, JSON.stringify(this.drafts));
    } catch {
      /* storage blocked or full: the server copy is still the record */
    }
  }
}

// ── Which row belongs to which card ─────────────────────────────────────────

export interface MatchSpeech { key: string; country: string; context: string; seconds: number; timestamp: string }
export interface MatchReply { key: string; country: string; timestamp: string }
export interface MatchCard { key: string; country: string; at?: number }

export interface DockMatch {
  /** This chair's row per card (natural keys). */
  mine: Record<string, FeedbackEntry>;
  /** Other chairs' rows per card, one per chair. */
  others: Record<string, FeedbackEntry[]>;
  /** This chair's orphan rows filed onto a logged speech: re-file them in the database. */
  refile: { key: string; row: FeedbackEntry; speech: MatchSpeech }[];
}

const t = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);
const EXACT_MS = 2000;
const ORPHAN_SLACK_MS = 120_000;

/**
 * Files every stored speech note on the card it belongs to.
 *
 * Order: rights of reply (context + instant), logged speeches by `spoken_at` (exact: a
 * reconciled row carries the log timestamp), logged speeches by context + seconds (rows
 * from before `spoken_at` was set), orphans (no seconds yet) onto the FIRST speech of that
 * delegation that ended after the turn began, then the floor, then the upcoming cards.
 * A row is filed once. The floor never takes a row that belongs to an earlier speech of
 * the same delegation, and an upcoming card only takes rows written on an upcoming card
 * (no `spoken_at`): that is what used to hand an old note to a later turn, where the next
 * keystroke overwrote it.
 */
export function matchDockRows(
  rows: FeedbackEntry[],
  chairName: string,
  speeches: MatchSpeech[],
  replies: MatchReply[],
  live: MatchCard | null,
  next: MatchCard[],
): DockMatch {
  const fb = rows.filter((f) => f.level === 'speech');
  const mine: Record<string, FeedbackEntry> = {};
  const others: Record<string, FeedbackEntry[]> = {};
  const refile: DockMatch['refile'] = [];
  const used = new Set<string>();

  const better = (a: FeedbackEntry, b: FeedbackEntry) =>
    (b.content.trim().length > a.content.trim().length ? b : a);
  const claim = (key: string, f: FeedbackEntry) => {
    used.add(f.id);
    if (f.chairName === chairName) {
      mine[key] = mine[key] ? better(mine[key], f) : f;
    } else {
      const bucket = (others[key] ??= []);
      const at = bucket.findIndex((o) => o.chairName === f.chairName);
      if (at < 0) bucket.push(f);
      else bucket[at] = better(bucket[at], f);
    }
  };
  const hasFor = (key: string, f: FeedbackEntry) =>
    f.chairName === chairName ? !!mine[key] : (others[key] ?? []).some((o) => o.chairName === f.chairName);

  // 1. Rights of reply.
  for (const r of replies) {
    const at = t(r.timestamp);
    for (const f of fb) {
      if (used.has(f.id) || f.country !== r.country || f.speechContext !== RTR_CONTEXT) continue;
      if (Math.abs(t(f.spokenAt) - at) > EXACT_MS) continue;
      claim(r.key, f);
    }
  }

  const byCountry = new Map<string, MatchSpeech[]>();
  for (const s of speeches) {
    const list = byCountry.get(s.country) ?? [];
    list.push(s);
    byCountry.set(s.country, list);
  }
  for (const list of byCountry.values()) list.sort((a, b) => t(a.timestamp) - t(b.timestamp));
  const exactSpeech = (f: FeedbackEntry): MatchSpeech | undefined => {
    if (!f.spokenAt) return undefined;
    const at = t(f.spokenAt);
    return (byCountry.get(f.country) ?? []).find((s) =>
      Math.abs(t(s.timestamp) - at) <= EXACT_MS && (!f.speechContext || f.speechContext === s.context));
  };

  // 2. Logged speeches, exact by spoken_at.
  for (const f of fb) {
    if (used.has(f.id) || f.speechSeconds == null || f.speechContext === RTR_CONTEXT) continue;
    const s = exactSpeech(f);
    if (s) claim(s.key, f);
  }

  // 3. Logged speeches by context + seconds (rows with no usable spoken_at). One row per
  //    chair per speech, so two equal-length speeches of one delegation each keep theirs.
  for (const s of speeches) {
    for (const f of fb) {
      if (used.has(f.id) || f.country !== s.country || f.speechSeconds == null) continue;
      if (f.speechContext === RTR_CONTEXT) continue;
      if ((f.speechContext ?? '') !== s.context || f.speechSeconds !== s.seconds) continue;
      if (hasFor(s.key, f)) continue;
      claim(s.key, f);
    }
  }

  // 4. Orphans: written on the floor or on deck, the speech logged before the note learned
  //    its seconds. The FIRST speech of that delegation that ended after the turn began.
  //    A row with NO spoken_at was written on an UPCOMING card (or before the column existed).
  //    While that delegation is on the floor or still queued it belongs there (steps 5 and 6),
  //    never on the speech it gave BEFORE the note was written: the 120 s slack used to file
  //    "France, next time…" onto France's previous speech.
  const waiting = new Set([...(live ? [live.country] : []), ...next.map((c) => c.country)]);
  for (const f of fb) {
    if (used.has(f.id) || f.speechSeconds != null || f.speechContext === RTR_CONTEXT) continue;
    if (!f.spokenAt && waiting.has(f.country)) continue;
    const list = byCountry.get(f.country) ?? [];
    const from = f.spokenAt ? t(f.spokenAt) : t(f.createdAt) - ORPHAN_SLACK_MS;
    if (!Number.isFinite(from)) continue;
    const s = list.find((x) => t(x.timestamp) >= from);
    if (!s) continue;
    // That speech already has this chair's note: leave the orphan where it is (the
    // History still shows it) rather than pushing it onto a speech it was not written on.
    if (hasFor(s.key, f)) {
      const cur = f.chairName === chairName ? mine[s.key] : undefined;
      if (!cur || cur.content.trim() || !f.content.trim()) continue;
    }
    claim(s.key, f);
    if (f.chairName === chairName) refile.push({ key: s.key, row: f, speech: s });
  }

  // 5. The floor: a note with no seconds that belongs to no earlier speech of this delegation.
  if (live) {
    const list = byCountry.get(live.country) ?? [];
    const lastEnd = list.length ? t(list[list.length - 1].timestamp) : -Infinity;
    for (const f of fb) {
      if (used.has(f.id) || f.country !== live.country || f.speechSeconds != null) continue;
      if (f.speechContext === RTR_CONTEXT) continue;
      const at = f.spokenAt ? t(f.spokenAt) : t(f.createdAt);
      if (Number.isFinite(at) && at < lastEnd - EXACT_MS) continue;
      claim(live.key, f);
    }
  }

  // 6. Upcoming cards: only notes written on an upcoming card (no spoken_at).
  for (const c of next) {
    for (const f of fb) {
      if (used.has(f.id) || f.country !== c.country || f.speechSeconds != null || f.spokenAt) continue;
      if (f.speechContext === RTR_CONTEXT) continue;
      claim(c.key, f);
    }
  }

  return { mine, others, refile };
}
