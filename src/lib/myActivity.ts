'use client';

// ── "Needs your attention": everything waiting on the signed-in user ─────────
//
// One RPC, `my_attention_items()` (SECURITY DEFINER, authenticated only,
// migrations `my_attention_items` and `user_seen_markers_and_attention_colours`),
// answering for the CALLER only:
//
//   chair_invite      pending conference_chair_invites (by user id, or by the
//                     caller's VERIFIED email when no account is named)      -> /invites/chair/<token>
//   organiser_invite  pending conference_organizer_invites (same matching)   -> /invites/organizer/<token>
//   import_invite     an organiser-imported application for the caller's email -> /invites/import/<claim token>
//   proof_rejected    the caller's latest manual payment proof was turned down  -> /conferences/<slug>/pay
//   payment_due       collectable open invoices (none while a proof is in review) -> /conferences/<slug>/pay
//   reply             a secretariat reply the caller has not read              -> /conferences/<slug>/role/<role>
//   draft             an unfinished application                               -> /conferences/<slug>/apply?role=
//   allocation        a seat given in the last 30 days (INFORMATIONAL)        -> /conferences/<slug>/role/<role>
//   accepted          accepted by the secretariat in the last 30 days (INFORMATIONAL)
//   org_applications  organiser: applications waiting on a decision, with `new_count`
//   org_proofs        organiser: manual payment proofs waiting for review      -> /manage/<slug>/financials/invoices
//   org_inbox         organiser: unread participant messages                  -> /manage/<slug>/communications[?inbox=<id>]
//   org_aid           organiser: financial aid requests pending               -> /manage/<slug>/financial-aid
//
// THE TWO COLOURS (owner, 24 Sep 2026). The avatar badge carries two counts:
//   RED    = messages and drafts: an unread secretariat reply (1 per thread),
//            the organiser's unread inbox threads (their number), an unfinished
//            application (1 each). They count until they are dealt with.
//   ORANGE = everything else that is new or waiting: invites (chair, co-organiser,
//            imported place), payment due / proof refused, an application
//            accepted, a seat allocated, NEW applications for an organiser (the
//            number submitted since they last looked), proofs and aid requests
//            to review (1 per conference), and live rooms (added by the avatar).
//
// "SEEN". Actionable items count until resolved (pending invite, unpaid, draft,
// unread message, a proof or aid request to review). Informational ones
// (accepted, allocated, the NEW part of the applications queue) stop counting
// once seen: opening the menu or the phone sheet marks every one on screen, and
// opening /manage/<slug>/applications marks that conference's applications. The
// mark is stored in the DATABASE (`user_seen_markers` through `mark_items_seen`,
// own rows only), so it syncs across devices, and mirrored in `localStorage
// gavelling-activity-seen-keys:<uid>` (capped) so the badge clears at once even
// before the write lands. Keys: the item id for accepted / allocation
// (`accepted:<application id>`, `allocation:<allocation id>`), and
// `org-apps:<conference id>` for new applications. The old single timestamp
// `gavelling-activity-seen:<uid>` is still honoured for allocations it covered.
//
// Finished conferences never appear. Live rooms are NOT in this list: the menu
// reads `my_live_rooms()` through `useLiveRooms` (src/lib/liveRooms.ts).
// Same cache shape as useLiveRooms: one read per page load per account,
// re-read by the menu when the answer is more than a minute old. Never keyed on
// the access token.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { centsToFee } from '@/lib/invoices';
import { DRAFTS_CHANGED_EVENT } from '@/hooks/useDraftCount';

export type ActivityKind =
  | 'chair_invite' | 'organiser_invite' | 'import_invite'
  | 'proof_rejected' | 'payment_due' | 'reply' | 'draft' | 'allocation' | 'accepted'
  | 'org_applications' | 'org_proofs' | 'org_inbox' | 'org_aid';

export type ActivityTone = 'red' | 'orange';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** false = informational: counts and shows until it has been seen. */
  action: boolean;
  /** ISO, when the thing happened (may be null for a legacy row). */
  at: string | null;
  title: string;
  detail: string;
  href: string;
  /** Conference label, already carrying the edition year. */
  conference: string;
  logoUrl: string | null;
  countryCode: string | null;
  countryName: string | null;
  /** The organiser side (drives the icon / tone). */
  organiser: boolean;
  /** Which of the avatar's two counts this item feeds. */
  tone: ActivityTone;
  /** The server says the caller already saw it (informational items only). */
  serverSeen: boolean;
  /** The seen-marker key, for items that stop counting once seen; else null. */
  seenKey: string | null;
  /** org_applications: submitted since last seen (per the server). */
  newCount: number;
  /** Invite rows: the token the respond RPC takes. */
  token: string | null;
  /** Chair invites: the committee as the chair should read it. */
  committeeName: string | null;
  committeeAbbr: string | null;
  committeeLogo: string | null;
  /** Chair or co-organiser title named on the invite. */
  roleTitle: string | null;
}

interface RawConf { slug: string; acronym: string | null; full_name: string | null; logo_url: string | null; start_date: string | null }
interface Raw {
  id: string; kind: string; action: boolean; at: string | null; conference: RawConf | null; seen?: boolean | null;
  token?: string | null; committee?: string | null; title?: string | null; role?: string | null;
  committee_name?: string | null; committee_abbr?: string | null; committee_logo?: string | null;
  due_cents?: number | null; currency?: string | null; subject?: string | null;
  country_name?: string | null; country_code?: string | null; count?: number | null; new_count?: number | null;
  request_id?: string | null;
}

const ROLE_WORD: Record<string, string> = {
  delegate: 'delegate', 'head-delegate': 'head delegate', 'faculty-advisor': 'faculty advisor',
  observer: 'observer', chair: 'chair', staff: 'staff',
};
const roleWord = (r: string | null | undefined) => (r ? ROLE_WORD[r] ?? r.replace(/-/g, ' ') : 'participant');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const roleHref = (slug: string, role: string | null | undefined) =>
  role ? `/conferences/${slug}/role/${encodeURIComponent(role)}` : `/conferences/${slug}`;
const idTail = (id: string) => id.slice(id.indexOf(':') + 1);

function shape(r: Raw): ActivityItem | null {
  const c = r.conference;
  if (!c?.slug) return null;
  const conf = conferenceAcronymLabel(c) || (c.full_name ?? '').trim() || 'your conference';
  const slug = c.slug;
  const n = Number(r.count ?? 0);
  const base = {
    id: r.id, action: r.action !== false, at: r.at ?? null, conference: conf,
    logoUrl: c.logo_url ?? null, countryCode: null as string | null, countryName: null as string | null, organiser: false,
    tone: 'orange' as ActivityTone, serverSeen: r.seen === true, seenKey: null as string | null, newCount: 0,
    token: null as string | null, committeeName: null as string | null, committeeAbbr: null as string | null,
    committeeLogo: null as string | null, roleTitle: null as string | null,
  };
  switch (r.kind) {
    case 'chair_invite': {
      if (!r.token) return null;
      const abbr = (r.committee_abbr ?? '').trim() || null;
      const full = (r.committee_name ?? '').trim() || null;
      const short = abbr ?? full ?? (r.committee ?? '').trim() ?? null;
      return { ...base, kind: 'chair_invite', token: r.token,
        committeeName: full, committeeAbbr: abbr, committeeLogo: r.committee_logo ?? null, roleTitle: (r.title ?? '').trim() || null,
        title: short ? `Chair ${short} at ${conf}` : `Chair invitation from ${conf}`,
        detail: full && abbr && full !== abbr ? full : `Invitation to chair at ${conf}.`,
        href: `/invites/chair/${r.token}` };
    }
    case 'organiser_invite':
      if (!r.token) return null;
      return { ...base, kind: 'organiser_invite', token: r.token, roleTitle: (r.title ?? '').trim() || null,
        title: `Join the ${conf} secretariat`,
        detail: r.title ? `As ${r.title}.` : 'Co-organiser invitation.', href: `/invites/organizer/${r.token}` };
    case 'import_invite':
      if (!r.token) return null;
      return { ...base, kind: 'import_invite', title: `${conf} added you`,
        detail: `Claim your place as ${roleWord(r.role)}.`, href: `/invites/import/${r.token}` };
    case 'proof_rejected':
      return { ...base, kind: 'proof_rejected', title: 'Payment proof not accepted',
        detail: `${conf}. Upload a new one or pay online.`, href: `/conferences/${slug}/pay` };
    case 'payment_due': {
      const amount = r.due_cents && r.currency ? centsToFee(Number(r.due_cents), r.currency) : null;
      return { ...base, kind: 'payment_due', title: `Payment due for ${conf}`,
        detail: amount ? `${amount} to pay.` : 'Your fee is ready to pay.', href: `/conferences/${slug}/pay` };
    }
    case 'reply':
      return { ...base, kind: 'reply', tone: 'red', title: `${conf} replied`,
        detail: (r.subject ?? '').trim() || 'A new message from the secretariat.', href: roleHref(slug, r.role) };
    case 'draft':
      return { ...base, kind: 'draft', tone: 'red', title: `Finish your ${conf} application`,
        detail: `Unfinished ${roleWord(r.role)} application.`,
        href: `/conferences/${slug}/apply?role=${encodeURIComponent(r.role ?? 'delegate')}` };
    case 'allocation':
      return { ...base, kind: 'allocation', action: false, seenKey: r.id,
        countryCode: r.country_code ?? null, countryName: r.country_name ?? null,
        title: r.country_name ? `You are ${r.country_name}` : `Your ${conf} seat is ready`,
        detail: r.committee ? `${r.committee} at ${conf}.` : conf, href: roleHref(slug, r.role) };
    case 'accepted':
      return { ...base, kind: 'accepted', action: false, seenKey: r.id,
        title: `Accepted to ${conf}`, detail: `As ${roleWord(r.role)}.`, href: roleHref(slug, r.role) };
    case 'org_applications': {
      if (n <= 0) return null;
      const fresh = Math.max(0, Number(r.new_count ?? 0));
      return { ...base, organiser: true, kind: 'org_applications', newCount: fresh,
        seenKey: `org-apps:${idTail(r.id)}`,
        title: plural(n, 'application to review', 'applications to review'),
        detail: conf, href: `/manage/${slug}/applications?status=submitted` };
    }
    case 'org_proofs':
      if (n <= 0) return null;
      return { ...base, organiser: true, kind: 'org_proofs', title: plural(n, 'payment proof to check', 'payment proofs to check'),
        detail: conf, href: `/manage/${slug}/financials/invoices` };
    case 'org_inbox':
      if (n <= 0) return null;
      return { ...base, organiser: true, kind: 'org_inbox', tone: 'red', newCount: n,
        title: plural(n, 'unread message', 'unread messages'),
        detail: conf, href: r.request_id ? `/manage/${slug}/communications?inbox=${r.request_id}` : `/manage/${slug}/communications` };
    case 'org_aid':
      if (n <= 0) return null;
      return { ...base, organiser: true, kind: 'org_aid', title: plural(n, 'aid request to decide', 'aid requests to decide'),
        detail: conf, href: `/manage/${slug}/financial-aid` };
    default:
      return null;
  }
}

export async function fetchMyActivity(accessToken: string): Promise<ActivityItem[] | null> {
  try {
    const { data, error } = await getAuthedClient(accessToken).rpc('my_attention_items');
    if (error || !Array.isArray(data)) return null;
    return (data as Raw[]).map(shape).filter((x): x is ActivityItem => !!x);
  } catch {
    return null;
  }
}

// ── Shared cache (one read per page load per account) ─────────────────────────

interface CacheState { uid: string; at: number; items: ActivityItem[] }
let cache: CacheState | null = null;
let inflight: { uid: string; p: Promise<void> } | null = null;
let lastToken: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(uid: string, token: string): Promise<void> {
  if (inflight && inflight.uid === uid) return inflight.p;
  const p = fetchMyActivity(token).then((items) => {
    // A failed read keeps what this account already had; with nothing yet it is
    // an empty list, so the section simply does not render.
    const prev = cache && cache.uid === uid ? cache.items : [];
    cache = { uid, at: Date.now(), items: items ?? prev };
    emit();
  }).finally(() => { if (inflight?.p === p) inflight = null; });
  inflight = { uid, p };
  return p;
}

/** Drop one item at once (an invite just answered) and re-read in the background. */
export function removeActivityItem(uid: string, id: string) {
  if (!cache || cache.uid !== uid) return;
  cache = { ...cache, at: 0, items: cache.items.filter((i) => i.id !== id) };
  emit();
  if (lastToken) void load(uid, lastToken);
}

// A draft deleted or submitted elsewhere on the page: re-read if anyone is mounted.
if (typeof window !== 'undefined') {
  window.addEventListener(DRAFTS_CHANGED_EVENT, () => {
    if (cache) cache = { ...cache, at: 0 };
    if (cache && lastToken && listeners.size > 0) void load(cache.uid, lastToken);
  });
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
const getSnapshot = () => cache;
const getServerSnapshot = () => null;

// ── Seen markers ──────────────────────────────────────────────────────────────

const MAX_LOCAL_KEYS = 200;
const keysKey = (uid: string) => `gavelling-activity-seen-keys:${uid}`;
const legacyKey = (uid: string) => `gavelling-activity-seen:${uid}`;

interface SeenState {
  /** key -> ms it was marked seen on this device. */
  keys: Record<string, number>;
  /** The pre-24 Sep single stamp (allocations only). */
  legacy: number;
  /** Item ids whose news was unseen when the menu / sheet last opened: they
   *  stay on screen (with their dot) for the rest of that opening. */
  openShown: ReadonlySet<string>;
}
const EMPTY_SEEN: SeenState = { keys: {}, legacy: 0, openShown: new Set() };
const seenStates = new Map<string, SeenState>();
const seenListeners = new Set<() => void>();

function readSeen(uid: string): SeenState {
  const got = seenStates.get(uid);
  if (got) return got;
  let keys: Record<string, number> = {};
  let legacy = 0;
  try {
    const raw = window.localStorage.getItem(keysKey(uid));
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) if (typeof v === 'number') keys[k] = v;
    }
    const l = window.localStorage.getItem(legacyKey(uid));
    const t = l ? Date.parse(l) : NaN;
    if (Number.isFinite(t)) legacy = t;
  } catch { keys = {}; /* blocked storage: the server's answer still applies */ }
  const s: SeenState = { keys, legacy, openShown: new Set() };
  seenStates.set(uid, s);
  return s;
}

function writeSeen(uid: string, next: SeenState) {
  seenStates.set(uid, next);
  try {
    const entries = Object.entries(next.keys).sort((a, b) => b[1] - a[1]).slice(0, MAX_LOCAL_KEYS);
    window.localStorage.setItem(keysKey(uid), JSON.stringify(Object.fromEntries(entries)));
  } catch { /* ignore */ }
  seenListeners.forEach((l) => l());
}

const atMs = (i: ActivityItem) => (i.at ? Date.parse(i.at) || 0 : 0);

/** Has this item's "new" part already been seen (server or this device)? */
function isSeen(i: ActivityItem, s: SeenState): boolean {
  if (!i.seenKey) return false;
  if (i.kind !== 'org_applications' && i.serverSeen) return true;
  const local = s.keys[i.seenKey];
  if (local !== undefined && local >= atMs(i)) return true;
  if (i.kind === 'allocation' && s.legacy > 0 && atMs(i) <= s.legacy) return true;
  return false;
}

/** How much this item adds to its colour's count right now. */
export function activityWeight(i: ActivityItem, s: SeenState): number {
  switch (i.kind) {
    case 'org_inbox': return i.newCount;
    case 'org_applications': return isSeen(i, s) ? 0 : i.newCount;
    case 'allocation':
    case 'accepted': return isSeen(i, s) ? 0 : 1;
    default: return 1;
  }
}

/** Is this item still worth listing in the menu? */
export function isVisibleActivity(i: ActivityItem, s: SeenState): boolean {
  if (i.action) return true;
  return !isSeen(i, s) || s.openShown.has(i.id);
}

/** Stamp everything informational on screen as seen (call once per opening,
 *  from an effect). Local first, then `mark_items_seen` in the background. */
export function markActivitySeen(uid: string, token: string | null) {
  const s = readSeen(uid);
  const items = cache && cache.uid === uid ? cache.items : [];
  const fresh = items.filter((i) => i.seenKey && activityWeight(i, s) > 0);
  const openShown = new Set(fresh.map((i) => i.id));
  const now = Date.now();
  const keys = { ...s.keys };
  for (const i of fresh) keys[i.seenKey!] = now;
  writeSeen(uid, { ...s, keys, openShown });
  if (fresh.length > 0) sendSeen(fresh.map((i) => i.seenKey!), token);
}

/** Mark one key seen (e.g. the organiser opened that conference's applications). */
export function markActivityKeySeen(uid: string, key: string, token: string | null) {
  const s = readSeen(uid);
  writeSeen(uid, { ...s, keys: { ...s.keys, [key]: Date.now() } });
  sendSeen([key], token);
}

function sendSeen(keys: string[], token: string | null) {
  const t = token ?? lastToken;
  if (!t || keys.length === 0) return;
  // Best effort: the local mirror already cleared the badge on this device.
  void Promise.resolve(getAuthedClient(t).rpc('mark_items_seen', { p_keys: keys.slice(0, 100) }))
    .catch(() => { /* ignore */ });
}

function useSeenState(uid: string | null): SeenState {
  return useSyncExternalStore(
    (l) => { seenListeners.add(l); return () => { seenListeners.delete(l); }; },
    () => (uid ? readSeen(uid) : EMPTY_SEEN),
    () => EMPTY_SEEN,
  );
}

/** The seen state an open menu should filter with (isVisibleActivity). */
export const useOpenSeenState = useSeenState;

export interface ActivityCounts { red: number; orange: number }

/** The two badge counts for a list of items under a seen state. */
export function activityCounts(items: ActivityItem[] | null, s: SeenState): ActivityCounts {
  let red = 0;
  let orange = 0;
  for (const i of items ?? []) {
    const w = activityWeight(i, s);
    if (w <= 0) continue;
    if (i.tone === 'red') red += w; else orange += w;
  }
  return { red, orange };
}

/**
 * The caller's attention items. `items` is null until this account's first
 * answer. `counts` are the avatar's red and orange numbers (live rooms not
 * included). `maxAgeMs`: re-read when the cached answer is older.
 */
export function useMyActivity(
  userId: string | null,
  accessToken: string | null,
  opts: { enabled?: boolean; maxAgeMs?: number } = {},
): { items: ActivityItem[] | null; counts: ActivityCounts; seen: SeenState } {
  const { enabled = true, maxAgeMs = Infinity } = opts;
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const seen = useSeenState(userId);
  // The token is read at fetch time only, so an hourly refresh never re-reads.
  const tokenRef = useRef<string | null>(accessToken);
  useEffect(() => { tokenRef.current = accessToken; if (accessToken) lastToken = accessToken; }, [accessToken]);
  const hasToken = !!accessToken;
  useEffect(() => {
    const token = tokenRef.current;
    if (!enabled || !userId || !token) return;
    const fresh = cache && cache.uid === userId && Date.now() - cache.at < maxAgeMs;
    if (!fresh) void load(userId, token);
  }, [enabled, userId, maxAgeMs, hasToken]);
  if (!userId || !snap || snap.uid !== userId) return { items: null, counts: { red: 0, orange: 0 }, seen };
  return { items: snap.items, counts: activityCounts(snap.items, seen), seen };
}

export type { SeenState as ActivitySeenState };
