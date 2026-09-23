'use client';

// ── "Needs your attention": everything waiting on the signed-in user ─────────
//
// One RPC, `my_attention_items()` (SECURITY DEFINER, authenticated only,
// migration `my_attention_items`), answering for the CALLER only:
//
//   chair_invite      pending conference_chair_invites (by user id or email)   -> /invites/chair/<token>
//   organiser_invite  pending conference_organizer_invites                     -> /invites/organizer/<token>
//   import_invite     an organiser-imported application for the caller's email -> /invites/import/<claim token>
//   proof_rejected    the caller's latest manual payment proof was turned down  -> /conferences/<slug>/pay
//   payment_due       collectable open invoices (none while a proof is in review) -> /conferences/<slug>/pay
//   reply             a secretariat reply the caller has not read              -> /conferences/<slug>/role/<role>
//   draft             an unfinished application                               -> /conferences/<slug>/apply?role=
//   allocation        a seat given in the last 30 days (INFORMATIONAL)        -> /conferences/<slug>/role/<role>
//   org_applications  organiser: applications waiting on a decision           -> /manage/<slug>/applications?status=submitted
//   org_proofs        organiser: manual payment proofs waiting for review      -> /manage/<slug>/financials/invoices
//   org_inbox         organiser: unread participant messages                  -> /manage/<slug>/communications[?inbox=<id>]
//   org_aid           organiser: financial aid requests pending               -> /manage/<slug>/financial-aid
//
// Finished conferences never appear. Live rooms are NOT in this list: the menu
// already reads `my_live_rooms()` through `useLiveRooms` (src/lib/liveRooms.ts),
// and only the badge adds them.
//
// Actionable items stay until the thing is done. Informational ones (allocation)
// count toward the badge until the menu is opened; opening stamps
// `localStorage gavelling-activity-seen:<uid>` and they stop showing after that
// open. Same cache shape as useLiveRooms: one read per page load per account,
// re-read by the menu when the answer is more than a minute old. Never keyed on
// the access token.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { centsToFee } from '@/lib/invoices';
import { DRAFTS_CHANGED_EVENT } from '@/hooks/useDraftCount';

export type ActivityKind =
  | 'chair_invite' | 'organiser_invite' | 'import_invite'
  | 'proof_rejected' | 'payment_due' | 'reply' | 'draft' | 'allocation'
  | 'org_applications' | 'org_proofs' | 'org_inbox' | 'org_aid';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** false = informational: shown until the menu has been opened once after it. */
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
}

interface RawConf { slug: string; acronym: string | null; full_name: string | null; logo_url: string | null; start_date: string | null }
interface Raw {
  id: string; kind: string; action: boolean; at: string | null; conference: RawConf | null;
  token?: string | null; committee?: string | null; title?: string | null; role?: string | null;
  due_cents?: number | null; currency?: string | null; subject?: string | null;
  country_name?: string | null; country_code?: string | null; count?: number | null; request_id?: string | null;
}

const ROLE_WORD: Record<string, string> = {
  delegate: 'delegate', 'head-delegate': 'head delegate', 'faculty-advisor': 'faculty advisor',
  observer: 'observer', chair: 'chair', staff: 'staff',
};
const roleWord = (r: string | null | undefined) => (r ? ROLE_WORD[r] ?? r.replace(/-/g, ' ') : 'participant');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const roleHref = (slug: string, role: string | null | undefined) =>
  role ? `/conferences/${slug}/role/${encodeURIComponent(role)}` : `/conferences/${slug}`;

function shape(r: Raw): ActivityItem | null {
  const c = r.conference;
  if (!c?.slug) return null;
  const conf = conferenceAcronymLabel(c) || (c.full_name ?? '').trim() || 'your conference';
  const slug = c.slug;
  const n = Number(r.count ?? 0);
  const base = {
    id: r.id, action: r.action !== false, at: r.at ?? null, conference: conf,
    logoUrl: c.logo_url ?? null, countryCode: null as string | null, countryName: null as string | null, organiser: false,
  };
  switch (r.kind) {
    case 'chair_invite':
      if (!r.token) return null;
      return { ...base, kind: 'chair_invite', title: `Chair invitation from ${conf}`,
        detail: r.committee ? `${r.committee}. Accept or decline.` : 'Accept or decline.', href: `/invites/chair/${r.token}` };
    case 'organiser_invite':
      if (!r.token) return null;
      return { ...base, kind: 'organiser_invite', title: `Join the ${conf} secretariat`,
        detail: r.title ? `As ${r.title}. Accept or decline.` : 'Accept or decline.', href: `/invites/organizer/${r.token}` };
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
      return { ...base, kind: 'reply', title: `${conf} replied`,
        detail: (r.subject ?? '').trim() || 'A new message from the secretariat.', href: roleHref(slug, r.role) };
    case 'draft':
      return { ...base, kind: 'draft', title: `Finish your ${conf} application`,
        detail: `Unfinished ${roleWord(r.role)} application.`,
        href: `/conferences/${slug}/apply?role=${encodeURIComponent(r.role ?? 'delegate')}` };
    case 'allocation':
      return { ...base, kind: 'allocation', countryCode: r.country_code ?? null, countryName: r.country_name ?? null,
        title: r.country_name ? `You are ${r.country_name}` : `Your ${conf} seat is ready`,
        detail: r.committee ? `${r.committee} at ${conf}.` : conf, href: roleHref(slug, r.role) };
    case 'org_applications':
      if (n <= 0) return null;
      return { ...base, organiser: true, kind: 'org_applications', title: plural(n, 'application to review', 'applications to review'),
        detail: conf, href: `/manage/${slug}/applications?status=submitted` };
    case 'org_proofs':
      if (n <= 0) return null;
      return { ...base, organiser: true, kind: 'org_proofs', title: plural(n, 'payment proof to check', 'payment proofs to check'),
        detail: conf, href: `/manage/${slug}/financials/invoices` };
    case 'org_inbox':
      if (n <= 0) return null;
      return { ...base, organiser: true, kind: 'org_inbox', title: plural(n, 'unread message', 'unread messages'),
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

// ── Seen stamp for informational items ────────────────────────────────────────

const seenKey = (uid: string) => `gavelling-activity-seen:${uid}`;
const seenListeners = new Set<() => void>();
const seenCache = new Map<string, number>();
/** The stamp that was in force before the latest markActivitySeen: what an open
 *  menu or sheet filters against, so the news it is showing stays on screen
 *  for the rest of that opening. */
const priorCache = new Map<string, number>();

function readSeen(uid: string): number {
  if (seenCache.has(uid)) return seenCache.get(uid)!;
  let v = 0;
  try {
    const raw = window.localStorage.getItem(seenKey(uid));
    const t = raw ? Date.parse(raw) : NaN;
    if (Number.isFinite(t)) v = t;
  } catch { /* blocked storage: everything informational reads as new */ }
  seenCache.set(uid, v);
  return v;
}

/** Stamp "seen up to now" for this account (call once per opening, from an
 *  effect). Returns the stamp it replaced. */
export function markActivitySeen(uid: string): number {
  const prev = readSeen(uid);
  const now = Date.now();
  priorCache.set(uid, prev);
  seenCache.set(uid, now);
  try { window.localStorage.setItem(seenKey(uid), new Date(now).toISOString()); } catch { /* ignore */ }
  seenListeners.forEach((l) => l());
  return prev;
}

function useSeenAt(uid: string | null): number {
  return useSyncExternalStore(
    (l) => { seenListeners.add(l); return () => { seenListeners.delete(l); }; },
    () => (uid ? readSeen(uid) : 0),
    () => 0,
  );
}

/** The seen stamp an OPEN menu should filter against (see priorCache). */
export function useOpenSeenAt(uid: string | null): number {
  return useSyncExternalStore(
    (l) => { seenListeners.add(l); return () => { seenListeners.delete(l); }; },
    () => (uid ? priorCache.get(uid) ?? readSeen(uid) : 0),
    () => 0,
  );
}

const atMs = (i: ActivityItem) => (i.at ? Date.parse(i.at) || 0 : 0);

/** Is this item still worth showing, given the seen stamp in force? */
export function isVisibleActivity(i: ActivityItem, seenAt: number): boolean {
  return i.action || atMs(i) > seenAt;
}

/**
 * The caller's attention items. `items` is null until this account's first
 * answer. `count` = actionable items + informational ones newer than the seen
 * stamp (the avatar badge). `maxAgeMs`: re-read when the cached answer is older.
 */
export function useMyActivity(
  userId: string | null,
  accessToken: string | null,
  opts: { enabled?: boolean; maxAgeMs?: number } = {},
): { items: ActivityItem[] | null; count: number; seenAt: number } {
  const { enabled = true, maxAgeMs = Infinity } = opts;
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const seenAt = useSeenAt(userId);
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
  if (!userId || !snap || snap.uid !== userId) return { items: null, count: 0, seenAt };
  const count = snap.items.filter((i) => isVisibleActivity(i, seenAt)).length;
  return { items: snap.items, count, seenAt };
}
