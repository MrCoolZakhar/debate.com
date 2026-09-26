'use client';

/**
 * LiveRoomsGate: mounted once in the root layout, like the other gates. When a
 * signed-in user lands on the site and one of their conference rooms is live,
 * it recommends going straight in (`my_live_rooms()`, src/lib/liveRooms.ts):
 *
 *   organiser -> "Open live status"  (/manage/[slug]/live), with live / in-session counts
 *   chair     -> first "Moderator or Commenter?" (two cards, ChairRoleChoice), then
 *                enter_live_chair_room and the chair page; a Moderator who did not
 *                get the gavel from the RPC takes it for this device
 *   delegate  -> "Join now"          (/delegate/CODE?country=NAME&locked=1, what /join builds
 *                                     for a verified allocated delegate: no picker, no typing)
 *   advisor   -> "Follow your delegation" (/advisor, the Faculty Advisor board): ONE
 *                                     entry per conference however many rooms are live,
 *                                     with how many of their students sit in them
 *
 * On /sessions it also offers the STANDALONE rejoin exactly as before (the
 * `gavelling-rejoin` blob, 18 hours, `gavelling-rejoin-dismissed`), with the room
 * read back for its topic and a deleted or ended room forgotten instead of offered.
 *
 * One prompt at a time: a single entry is a full card, several a compact list in
 * the order organiser, chair, delegate, advisor (then the standalone rejoin).
 * "Not now" / Escape / the backdrop close it for THIS page visit: the gate lives in
 * the root layout, so client-side navigation keeps it closed, and the next full
 * load of the site asks again. It stops by itself once the conference is over or
 * the room has ended (the RPC no longer returns it). The same rooms stay in the
 * profile menu's "Live now" section (LiveNowMenuSection).
 *
 * Never on a live session route (/chair, /delegate, /voting, /advisor), /join,
 * the auth pages, apply or pay paths, /unsubscribe, /drafts, /invites, /api. Never
 * stacks: it waits on `useBasicsGateBlocking()` (the auth modal and
 * CompleteBasicsGate) and on any other modal layer on screen (aria-modal /
 * role=dialog, or a full-screen fixed layer that takes the pointer, which is how
 * the credits welcome and the setup reminder are seen), polled every 700 ms while
 * it wants to open; if one of them opens later it steps aside and comes back.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useBasicsGateBlocking } from '@/lib/basicsGateState';
import { supabase } from '@/lib/supabase';
import { chairIdentity, entrySessionCodes, resolveEntryHref, useLiveRooms } from '@/lib/liveRooms';
import LiveRoomsDialog, { PROMPT_ATTR, itemHref, type PromptItem, type StandaloneItem } from './LiveRoomsDialog';

const EXCLUDED_PREFIXES = [
  '/chair', '/delegate', '/voting', '/advisor', '/join',
  '/auth', '/unsubscribe', '/drafts', '/invites', '/api',
];
const EXCLUDED_SEGMENTS = ['/apply', '/pay'];

export function isLiveRoomsExcludedPath(pathname: string | null): boolean {
  if (!pathname) return true;
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  return EXCLUDED_SEGMENTS.some((s) => pathname.includes(s + '/') || pathname.endsWith(s));
}

// ── The standalone rejoin (unchanged source and rules) ────────────────────────

const REJOIN_KEY = 'gavelling-rejoin';
const REJOIN_LEGACY_KEY = 'gavelling_active_session';
const REJOIN_DISMISSED_KEY = 'gavelling-rejoin-dismissed';
const REJOIN_MAX_AGE_MS = 18 * 60 * 60 * 1000;

interface StoredRejoin { code: string; chairName: string; committeeTitle: string }

function readStoredRejoin(): StoredRejoin | null {
  try {
    const raw = localStorage.getItem(REJOIN_KEY) ?? localStorage.getItem(REJOIN_LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; chairName?: unknown; committeeTitle?: unknown; savedAt?: unknown } | null;
    if (!parsed || typeof parsed.code !== 'string' || !parsed.code) {
      localStorage.removeItem(REJOIN_KEY);
      localStorage.removeItem(REJOIN_LEGACY_KEY);
      return null;
    }
    if (parsed.code === localStorage.getItem(REJOIN_DISMISSED_KEY)) {
      localStorage.removeItem(REJOIN_KEY);
      return null;
    }
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt >= REJOIN_MAX_AGE_MS) {
      localStorage.removeItem(REJOIN_KEY);
      localStorage.removeItem(REJOIN_LEGACY_KEY);
      return null;
    }
    // Migrate the legacy key forward, exactly as before.
    localStorage.setItem(REJOIN_KEY, raw);
    localStorage.removeItem(REJOIN_LEGACY_KEY);
    return {
      code: parsed.code,
      chairName: typeof parsed.chairName === 'string' ? parsed.chairName : '',
      committeeTitle: typeof parsed.committeeTitle === 'string' && parsed.committeeTitle ? parsed.committeeTitle : parsed.code,
    };
  } catch {
    return null;
  }
}

/** 'gone' = deleted or ended (forget it); null = the read failed (offer it as before). */
async function checkStandaloneRoom(code: string): Promise<{ name: string | null; topic: string | null } | 'gone' | null> {
  try {
    const { data, error } = await supabase
      .from('committees')
      .select('name, topic, ended_at')
      .eq('code', code.toUpperCase())
      .maybeSingle();
    if (error) return null;
    if (!data) return 'gone';
    const row = data as { name: string | null; topic: string | null; ended_at: string | null };
    if (row.ended_at) return 'gone';
    return { name: row.name, topic: row.topic };
  } catch {
    return null;
  }
}

// ── Blocking: never on top of another modal ───────────────────────────────────

function otherModalOnScreen(): boolean {
  if (typeof document === 'undefined') return false;
  const mine = (el: Element) => !!el.closest(`[${PROMPT_ATTR}]`);
  const dialogs = document.querySelectorAll('[aria-modal="true"], [role="dialog"], [role="alertdialog"]');
  for (const el of Array.from(dialogs)) {
    if (!mine(el) && (el as HTMLElement).getClientRects().length > 0) return true;
  }
  const layers = document.querySelectorAll('.fixed.inset-0');
  for (const el of Array.from(layers)) {
    if (mine(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents !== 'none' && cs.display !== 'none' && cs.visibility !== 'hidden') return true;
  }
  return false;
}

// ── The gate ──────────────────────────────────────────────────────────────────

export default function LiveRoomsGate() {
  const pathname = usePathname();
  const { user, session, profile, loading: authLoading } = useAuth();
  const gatesBlocking = useBasicsGateBlocking();
  const excluded = isLiveRoomsExcludedPath(pathname);
  const onSessions = pathname === '/sessions';

  const userId = authLoading ? null : user?.id ?? null;
  const { entries } = useLiveRooms(userId, session?.access_token ?? null);

  // "Not now" for this page visit (the gate stays mounted across client-side navigation).
  const [dismissed, setDismissed] = useState(false);
  // Assume something else is on screen until the first check has looked.
  const [otherModal, setOtherModal] = useState(true);

  // Standalone rejoin: read once, the first time /sessions is shown in this visit.
  // `undefined` = not answered yet, `null` = nothing to offer.
  const [standalone, setStandalone] = useState<StandaloneItem | null | undefined>(undefined);
  useEffect(() => {
    if (!onSessions || standalone !== undefined) return;
    const stored = readStoredRejoin();
    let cancelled = false;
    (stored ? checkStandaloneRoom(stored.code) : Promise.resolve('gone' as const)).then((res) => {
      if (cancelled) return;
      if (!stored) { setStandalone(null); return; }
      if (res === 'gone') {
        try { localStorage.removeItem(REJOIN_KEY); } catch { /* ignore */ }
        setStandalone(null);
        return;
      }
      setStandalone({
        role: 'standalone',
        key: `s:${stored.code.toUpperCase()}`,
        code: stored.code,
        chairName: stored.chairName,
        topic: res?.topic && res.topic.trim() && res.topic !== 'TBD' ? res.topic : null,
        name: res?.name?.trim() || stored.committeeTitle,
      });
    });
    return () => { cancelled = true; };
  }, [onSessions, standalone]);

  const items = useMemo<PromptItem[]>(() => {
    const live: PromptItem[] = (entries ?? []).filter((e) => itemHref(e) !== pathname);
    if (!onSessions || !standalone) return live;
    const codes = new Set((entries ?? []).flatMap(entrySessionCodes));
    return codes.has(standalone.code.toUpperCase()) ? live : [...live, standalone];
  }, [entries, onSessions, standalone, pathname]);

  // Open only once every source has answered, so an entry never "appears" into an
  // already open card and a list never collapses under the pointer.
  const liveSettled = !authLoading && (!user || entries !== null);
  const standaloneSettled = !onSessions || standalone !== undefined;
  const wanted = !excluded && !dismissed && liveSettled && standaloneSettled && items.length > 0;

  useEffect(() => {
    if (!wanted) return;
    const check = () => setOtherModal(otherModalOnScreen());
    const first = window.setTimeout(check, 0);
    const id = window.setInterval(check, 700);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [wanted]);

  const close = useCallback(() => setDismissed(true), []);
  // A chair walks straight in: `resolveEntryHref` calls `enter_live_chair_room`,
  // which decides at PRESS TIME whether this press starts the session or joins an
  // open dais, and lands on the chair page with the profile name as the chair
  // identity. Every other role is the plain href.
  // A chair has already answered "Moderator or Commenter?" in the pop-up (chairRole).
  const go = useCallback(async (item: PromptItem, chairRole?: 'head' | 'co') => {
    const href = item.role === 'standalone'
      ? itemHref(item)
      : await resolveEntryHref(item, {
          accessToken: session?.access_token ?? null,
          chairName: chairIdentity(profile?.display_name, user?.email),
          chairRole,
        });
    window.location.href = href;
  }, [session?.access_token, profile?.display_name, user?.email]);
  const forget = useCallback((item: PromptItem) => {
    if (item.role !== 'standalone') return;
    try {
      localStorage.setItem(REJOIN_DISMISSED_KEY, item.code);
      localStorage.removeItem(REJOIN_KEY);
    } catch { /* storage blocked */ }
    setStandalone(null);
  }, []);

  if (!wanted || gatesBlocking || otherModal) return null;

  const displayName = profile?.display_name?.trim() || (standalone ? standalone.chairName : '') || '';
  return (
    <LiveRoomsDialog
      items={items}
      displayName={displayName}
      avatarUrl={user ? profile?.avatar_url ?? null : null}
      showAvatar={!!user || !!displayName}
      onGo={go}
      onClose={close}
      onForget={forget}
      chairName={chairIdentity(profile?.display_name, user?.email)}
    />
  );
}
