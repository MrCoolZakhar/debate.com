'use client';

/**
 * ProfileDropdown, the shared account menu used by SiteNav and the
 * organiser (/manage) top bar.
 *
 * Owns the whole dropdown behaviour: hover-open with a ~200ms grace timer
 * (desktop pointer only, touch stays click-toggle), click-outside close,
 * the kokonutui-style panel (header, menu rows, lazily fetched
 * "YOUR CONFERENCES" section, sign out). Callers only supply the trigger
 * visual via a render prop, so each surface keeps its own trigger styling.
 *
 * DRAFTS LIVE INSIDE "YOUR CONFERENCES", AT THE TOP
 * A half-finished application used to be one aggregate "DRAFTS TO COMPLETE"
 * menu row, sitting nowhere near the conferences it was about. It is now the
 * first entry (or entries) of the same list — because a draft is a conference
 * you are in the middle of, and the list is where you look for one.
 *
 * They must NOT read as attendance. An accepted conference row is a plain
 * ivory row ending in its ROLE; a draft row is gold-washed, carries a
 * FileClock instead of a role, and is labelled UNFINISHED. Clicking one
 * resumes the wizard rather than opening the conference page.
 *
 * PENDING INVITATIONS SIT ABOVE THE DRAFTS
 * An imported delegate who creates an account has no other surface telling
 * them somebody is waiting on them, so their invitation now leads the same
 * list, ahead of drafts and ahead of accepted conferences. It reads the same
 * way a draft does but in the opposite direction: forest-washed instead of
 * gold-washed, carries a Ticket instead of a role, and is labelled INVITED.
 * Clicking one goes to the claim page, not the conference page.
 *
 * The order is deliberate. An invitation has somebody waiting on it and takes
 * one click to resolve; a draft is your own unfinished work with nobody
 * blocked behind it; neither is a conference you are actually attending yet.
 *
 * NEEDS YOUR ATTENTION (23 Sep 2026) SUPERSEDES THE TWO SECTIONS ABOVE
 * Owner: "a little notification on the profile dropdown whenever there is any
 * activity ... and make sure when there is any action to be taken that it leads
 * them to it." Invitations (chair, co-organiser, imported place), drafts, money
 * due, a rejected payment proof, an unread secretariat reply, a new allocation
 * and, for organisers, applications / proofs / messages / aid requests waiting
 * now come from ONE read, `my_attention_items()` (src/lib/myActivity.ts), and
 * render as the first section of the menu (components/profile/ActivityNotices).
 * The invitation and draft rows were therefore taken OUT of "YOUR CONFERENCES"
 * so nothing is listed twice. The avatar (ProfileAvatarMenu) carries the count.
 * Opening the menu stamps informational items (a new allocation) as seen.
 *
 * THE ROWS, TOP TO BOTTOM
 * Header (avatar, name, email); Live now; Needs your attention; then MY
 * PROFILE, MANAGE ACCOUNT (the credit count at its right edge and a + that
 * opens the buy-credits pop-up), PRICING (a Free / Unlimited badge, and on Free
 * an up arrow that opens the Unlimited pop-up); YOUR CONFERENCES (three rows,
 * then "All conferences" or "Create a conference"); SIGN OUT. The MUN CV and
 * calendar rows moved to the account area's own menu.
 */

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { compareStartDate, hasConcluded } from '@/lib/conferenceDates';
import { User, Settings2, Tag, ArrowUp, LogOut, ArrowRight, Plus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCredits } from '@/hooks/useCredits';
import { openCreditsPopup, openUnlimitedPopup } from '@/lib/purchasePopup';
import LiveNowMenuSection from '@/components/liveRooms/LiveNowMenuSection';
import ActivityNotices from '@/components/profile/ActivityNotices';
import { useMyActivity, useOpenSeenState, markActivitySeen, isVisibleActivity } from '@/lib/myActivity';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { invoiceDueCents, isInvoicePayable, type InvoiceStatus } from '@/lib/invoices';
import { CircleFlag } from '@/components/CircleFlag';
import { deriveCommitteeAcronym } from '@/lib/presetNames';
import { useUnlimitedStatus, isUnlimited } from '@/lib/unlimitedStatus';
import { useClaimImportedOnLoad } from '@/lib/importClaim';

/** One row in the dropdown's "YOUR CONFERENCES" section. */
interface NavConference {
  id: string;
  slug: string;
  acronym: string;
  logo_url: string | null;
  start_date: string;
  /** Carried only so hasConcluded() can drop finished conferences. Nullable
   *  because a dates-TBD conference has neither date. */
  end_date: string | null;
  role: 'DELEGATE' | 'CHAIR' | 'ORGANIZER';
  /** An application that is in but not decided yet. The row still lists the
   *  conference (that was the bug: applying as a delegate made a conference
   *  vanish from this menu until somebody accepted you), and says APPLIED
   *  rather than claiming a role nobody has given yet. */
  pending?: boolean;
  /** Something here is waiting on this person. One short phrase, shown as a
   *  quiet gold dot whose accessible name is this text. */
  attention?: string;
  /** Delegates and faculty advisors only: where their application stands.
   *  Allocation first (flag + committee), then Unpaid, then Approved. */
  standing?:
    | { kind: 'allocated'; countryCode: string | null; countryName: string | null; committee: string }
    | { kind: 'unpaid' }
    | { kind: 'approved' };
}

/** Roles that get the standing line: everyone who attends as a participant
 *  rather than running the room. */
const STANDING_ROLES = new Set(['delegate', 'head-delegate', 'faculty-advisor', 'observer']);

/** Type of the plain menu rows (MY PROFILE, MANAGE ACCOUNT, PRICING). */
const ROW_TEXT: React.CSSProperties = {
  color: '#1C1410',
  fontFamily: "var(--font-brand), sans-serif",
  letterSpacing: '0.05em',
  fontSize: '12px',
};

/** Attention, most urgent first: money the conference is waiting for, then work
 *  an organiser owes their applicants, then a decision this person is waiting
 *  on. Only one shows per row — a menu row is a signpost, not a to-do list. */
const ATTENTION_RANK = ['pay', 'review', 'waiting'] as const;
type AttentionKind = (typeof ATTENTION_RANK)[number];

/** Supabase joins come back as object or array depending on cardinality. */
function firstRow<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

interface ProfileDropdownProps {
  /** Trigger visual, rendered inside the hover/click zone. */
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  /** Extra styles merged onto the panel (e.g. z-index above a fixed top bar). */
  panelStyle?: React.CSSProperties;
}

export default function ProfileDropdown({ trigger, panelStyle }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PANEL_W = 280;
  // The panel is portaled at fixed viewport coords (computed from the trigger)
  // so it renders ABOVE every page's stacking context and can never slide under
  // sticky bars or transformed cards. Right-aligned to the trigger, clamped.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const place = useCallback(() => {
    const r = rootRef.current?.getBoundingClientRect();
    if (!r) return;
    let left = r.right - PANEL_W;
    if (left + PANEL_W > window.innerWidth - 8) left = window.innerWidth - 8 - PANEL_W;
    if (left < 8) left = 8;
    setPos({ top: r.bottom + 8, left });
  }, []);

  // "Your conferences" section, fetched lazily the first time the menu opens.
  const [myConfs, setMyConfs] = useState<NavConference[] | null>(null);
  const [confsLoading, setConfsLoading] = useState(false);
  const confsFetched = useRef(false);

  const { user, profile, session, signOut, loading: authLoading } = useAuth();
  // Unlimited is read from subscriptions (my_unlimited_status), never the dead
  // profiles.unlimited_status column. null = not known yet.
  const unlimitedStatus = useUnlimitedStatus();
  // The credit count shown on the MANAGE ACCOUNT row (refreshes itself after a purchase).
  const { balance: creditBalance, loading: creditsLoading } = useCredits();
  const creditText = creditsLoading || creditBalance === null
    ? '–'
    : `${creditBalance} ${creditBalance === 1 ? 'credit' : 'credits'}`;
  // Imported registrations for this account's verified address attach on
  // the first page of a visit (src/lib/importClaim.ts).
  useClaimImportedOnLoad(authLoading ? null : user?.id ?? null);

  // Needs your attention (src/lib/myActivity.ts). Read once per page load by the
  // avatar badge; re-read here when the menu opens on an answer over a minute old.
  const uid = authLoading ? null : user?.id ?? null;
  const activityToken = session?.access_token ?? null;
  const { items: activity } = useMyActivity(uid, activityToken, { maxAgeMs: open ? 60_000 : Infinity });
  // Opening marks every informational item on screen as seen (accepted,
  // allocated, new applications): they stay listed for THIS opening, stop
  // counting on the avatar at once and are gone the next time.
  const openSeen = useOpenSeenState(uid);
  const stampedOpen = useRef(false);
  useEffect(() => {
    if (!open) { stampedOpen.current = false; return; }
    // Once per opening (StrictMode re-runs effects; a second stamp would hide
    // the new items during the very opening that is meant to show them).
    // Waits for the first answer, so what is marked is what is on screen.
    if (!uid || stampedOpen.current || !activity) return;
    stampedOpen.current = true;
    markActivitySeen(uid, activityToken);
  }, [open, uid, activity, activityToken]);
  const attention = useMemo(
    () => (activity ?? []).filter((i) => isVisibleActivity(i, openSeen)),
    [activity, openSeen],
  );
  /** Something of the person's own is in flight (a draft, an imported place),
   *  so an empty conference list should still point at "All conferences". */
  const hasOwnPending = attention.some((i) => i.kind === 'draft' || i.kind === 'import_invite');

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return; // clicks inside the portaled panel
      setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Reposition the portaled panel while open (scroll / resize).
  useEffect(() => {
    if (!open) return;
    place();
    const handler = () => place();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, place]);

  // Clear any pending hover-close timer on unmount.
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Reset the cached conference list when the signed-in user changes.
  useEffect(() => {
    confsFetched.current = false;
    setMyConfs(null);
    setConfsLoading(false);
  }, [user?.id]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  // Hover-open (desktop pointer only, touch keeps pure click-toggle behaviour).
  const handlePointerEnter = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  // ~200ms grace so the cursor can travel from the trigger into the panel.
  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }, [cancelClose]);

  const toggle = useCallback(() => {
    cancelClose();
    setOpen((v) => !v);
  }, [cancelClose]);

  // Batched fetch of the user's conferences the first time the menu opens:
  // applications that are IN (submitted included, see below) + organizer
  // memberships + owned conferences, merged per conference (organizer wins),
  // soonest first, with anything waiting on this person marked.
  //
  // 'submitted' is in the status list on purpose. It used to be missing, so
  // applying as a delegate put a conference NOWHERE in this menu: not under
  // drafts (it is submitted), not here (it is not accepted). The person who had
  // just applied had no way back to the conference they applied to. Rejected
  // and withdrawn stay out: /account/conferences is where a closed application is
  // reviewed and resubmitted.
  useEffect(() => {
    if (!open || confsFetched.current) return;
    if (!user || !session) return;
    confsFetched.current = true;
    setConfsLoading(true);

    const userId = user.id;
    const supabase = getAuthedClient(session.access_token);
    // end_date is fetched only so finished conferences can be dropped below.
  const CONF = 'id, slug, acronym, logo_url, start_date, end_date';

    (async () => {
      try {
        const [appsRes, orgRes, ownedRes] = await Promise.all([
          supabase
            .from('applications')
            .select(`id, role, status, payment_status, conferences (${CONF})`)
            .eq('user_id', userId)
            .in('status', ['submitted', 'accepted', 'assigned', 'checked-in']),
          supabase
            .from('conference_organizers')
            .select(`conferences (${CONF})`)
            .eq('user_id', userId),
          supabase
            .from('conferences')
            .select(CONF)
            .eq('organizer_id', userId),
        ]);

        type ConfRow = { id: string; slug: string; acronym: string; logo_url: string | null; start_date: string; end_date: string | null };
        const byId = new Map<string, NavConference>();
        const add = (conf: ConfRow | null, role: NavConference['role'], pending = false) => {
          if (!conf) return;
          const existing = byId.get(conf.id);
          if (existing) {
            // Organizer trumps attendee roles (row links to /manage).
            if (role === 'ORGANIZER') { existing.role = 'ORGANIZER'; existing.pending = false; }
            // A decided application anywhere on this conference outranks a
            // pending one, so two applications never leave the row saying
            // APPLIED when one of them was accepted.
            else if (!pending) existing.pending = false;
            return;
          }
          byId.set(conf.id, { id: conf.id, slug: conf.slug, acronym: conf.acronym, logo_url: conf.logo_url, start_date: conf.start_date, end_date: conf.end_date, role, pending });
        };

        type AppRow = { id: string; role: string; status: string; payment_status: string | null; conferences: ConfRow | ConfRow[] | null };
        const appRows = (appsRes.data ?? []) as AppRow[];
        /** application id → the conference it belongs to and its status, so an
         *  unpaid invoice (which is keyed by application, never by user) can be
         *  attributed to the right row below. */
        const appMeta = new Map<string, { confId: string; status: string }>();
        for (const row of appRows) {
          const conf = firstRow(row.conferences);
          add(conf, row.role === 'chair' ? 'CHAIR' : 'DELEGATE', row.status === 'submitted');
          if (conf) appMeta.set(row.id, { confId: conf.id, status: row.status });
        }
        for (const row of (orgRes.data ?? []) as { conferences: ConfRow | ConfRow[] | null }[]) {
          add(firstRow(row.conferences), 'ORGANIZER');
        }
        for (const conf of (ownedRes.data ?? []) as ConfRow[]) {
          add(conf, 'ORGANIZER');
        }

        // Finished conferences leave the menu. This is a "where am I going
        // next" list, and a season of concluded ones pushes the live ones off
        // the bottom (it renders only the first three).
        //
        // hasConcluded, not a start_date test: a conference is over the day
        // AFTER its last day, so a start_date comparison would hide one that
        // is running right now, which is exactly when someone opens this menu
        // to find it. It also falls back to start_date when end_date is null,
        // and treats a dates-TBD conference as still to come rather than past.
        // ── Standing, for delegates and faculty advisors ───────────────────
        // Optional like the markers below: a failed read just leaves the line off.
        try {
          const allocRes = await supabase
            .from('conference_allocations')
            .select('conference_id, country_code, country_name, seat, conference_committees (name, abbreviation)')
            .eq('user_id', userId);
          type AllocRow = { conference_id: string; country_code: string | null; country_name: string | null; seat: number | null; conference_committees: { name: string | null; abbreviation: string | null } | { name: string | null; abbreviation: string | null }[] | null };
          const allocByConf = new Map<string, AllocRow>();
          for (const a of ((allocRes.data ?? []) as AllocRow[])) {
            const had = allocByConf.get(a.conference_id);
            if (!had || (a.seat ?? 1) < (had.seat ?? 1)) allocByConf.set(a.conference_id, a);
          }
          for (const row of appRows) {
            const conf = firstRow(row.conferences);
            const nav = conf ? byId.get(conf.id) : null;
            if (!nav || nav.role !== 'DELEGATE' || !STANDING_ROLES.has(row.role)) continue;
            const alloc = allocByConf.get(nav.id);
            if (alloc) {
              const cc = firstRow(alloc.conference_committees);
              const committee = cc?.abbreviation?.trim() || deriveCommitteeAcronym(cc?.name ?? '') || cc?.name || '';
              nav.standing = { kind: 'allocated', countryCode: alloc.country_code, countryName: alloc.country_name, committee };
            } else if (row.status !== 'submitted' && nav.standing?.kind !== 'allocated') {
              const unpaid = row.payment_status != null && row.payment_status !== 'paid' && row.payment_status !== 'waived';
              if (unpaid) nav.standing = { kind: 'unpaid' };
              else if (!nav.standing) nav.standing = { kind: 'approved' };
            }
          }
        } catch { /* the rows still list without a standing line */ }

        const list = Array.from(byId.values())
          .filter(c => !hasConcluded(c))
          .sort((a, b) => compareStartDate(a.start_date, b.start_date));

        // ── What is waiting on this person ──────────────────────────────────
        // Two follow-up reads, each scoped to rows this menu already knows
        // about, and each one optional: if either fails the menu still lists
        // every conference, just without its marker. A marker is never
        // invented — no fee, no dot.
        const attention = new Map<string, AttentionKind>();
        const mark = (confId: string, kind: AttentionKind) => {
          const had = attention.get(confId);
          if (!had || ATTENTION_RANK.indexOf(kind) < ATTENTION_RANK.indexOf(had)) attention.set(confId, kind);
        };

        // A pending application is a decision this person is waiting for.
        for (const c of list) if (c.pending) mark(c.id, 'waiting');

        const appIds = Array.from(appMeta.keys());
        const organiserIds = list.filter(c => c.role === 'ORGANIZER').map(c => c.id);
        const [invRes, reviewRes] = await Promise.all([
          appIds.length
            ? supabase
                .from('invoices')
                .select('application_id, conference_id, status, amount_cents, amount_paid_cents, payable_before_acceptance')
                .in('application_id', appIds)
                .in('status', ['open', 'partial'])
            : Promise.resolve({ data: [] as never[] }),
          organiserIds.length
            ? supabase
                .from('applications')
                .select('conference_id')
                .in('conference_id', organiserIds)
                .eq('status', 'submitted')
            : Promise.resolve({ data: [] as never[] }),
        ]);

        // Money owed. `isInvoicePayable` is the shared rule the pay page uses,
        // so a fee that is not collectable yet (payable only after acceptance,
        // on an application still being decided) raises nothing here.
        type InvRow = { application_id: string | null; conference_id: string; status: InvoiceStatus; amount_cents: number; amount_paid_cents: number; payable_before_acceptance: boolean };
        for (const inv of ((invRes.data ?? []) as InvRow[])) {
          const meta = inv.application_id ? appMeta.get(inv.application_id) : null;
          if (!meta) continue;
          if (invoiceDueCents(inv) <= 0) continue;
          if (!isInvoicePayable(inv, meta.status)) continue;
          mark(meta.confId, 'pay');
        }

        // Applications an organiser has not decided on.
        for (const row of ((reviewRes.data ?? []) as { conference_id: string }[])) {
          mark(row.conference_id, 'review');
        }

        const ATTENTION_TEXT: Record<AttentionKind, string> = {
          pay: 'Payment due',
          review: 'Applications to review',
          waiting: 'Waiting for a decision',
        };
        for (const c of list) {
          const kind = attention.get(c.id);
          if (kind) c.attention = ATTENTION_TEXT[kind];
        }
        setMyConfs(list);
      } catch {
        setMyConfs([]);
      } finally {
        setConfsLoading(false);
      }
    })();
  }, [open, user, session]);

  /** The three rows the menu has room for (five until the account area grew
   *  its own conferences page). Order on screen is always soonest
   *  first, that is what this list is for. The choice of WHICH three is where
   *  outstanding business counts: a conference that needs this person must not
   *  fall off the bottom behind ones that do not, so anything marked is taken
   *  into the three first and the three are then put back into date order. With
   *  three or fewer conferences this changes nothing at all. */
  const visibleConfs = useMemo(() => {
    const all = myConfs ?? [];
    if (all.length <= 3) return all;
    const picked = [...all.filter(c => c.attention), ...all.filter(c => !c.attention)].slice(0, 3);
    return picked.sort((a, b) => compareStartDate(a.start_date, b.start_date));
  }, [myConfs]);

  const avatarInitial = profile?.display_name
    ? profile.display_name[0].toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : '?';

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    window.location.href = '/';
  }

  if (!user) return null;

  return (
    <div
      className="relative"
      ref={rootRef}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {trigger(open, toggle)}

      {/* Dropdown, kokonutui profile-dropdown anatomy in house style. Portaled
          at fixed coords with z-index 9999 so it always renders over sticky bars
          / transformed cards, on every page. */}
      {/* Straight to document.body, never through Portal: on a FitToScreen
          page (/create) Portal targets the scaled #fit-root, where these
          viewport coordinates would land in the wrong place. */}
      {open && pos && createPortal(
        <div
          ref={panelRef}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          style={{
            ...panelStyle,
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: PANEL_W,
            backgroundColor: '#FAF8F3',
            border: '1px solid #DDD4C0',
            borderRadius: '16px',
            boxShadow: '0 20px 48px rgba(27, 56, 40, 0.16)',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'profileMenuIn 180ms ease both',
          }}
        >
          <style>{`@keyframes profileMenuIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          {/* Header, avatar + name + email */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="rounded-full object-cover shrink-0"
                style={{ width: '40px', height: '40px' }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center font-black shrink-0"
                style={{ width: '40px', height: '40px', backgroundColor: '#EED98A', color: '#1B3828', fontSize: '16px', fontFamily: "var(--font-brand), sans-serif" }}
              >
                {avatarInitial}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: '#1C1410', fontFamily: "var(--font-brand), sans-serif" }}>
                {profile?.display_name ?? user.email?.split('@')[0]}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: '#9A8A78', fontFamily: "var(--font-brand), sans-serif" }}>
                {profile?.email ?? user.email}
              </p>
            </div>
          </div>
          <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />

          {/* Live now: this account's conference rooms that are live right now
              (src/components/liveRooms). Nothing while there is none. */}
          <LiveNowMenuSection onNavigate={() => setOpen(false)} />

          {/* Needs your attention: every row goes straight to where it is done. */}
          {attention.length > 0 && (
            <>
              <ActivityNotices items={attention} onNavigate={() => setOpen(false)} />
              <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />
            </>
          )}

          {/* Menu rows. MANAGE ACCOUNT and PRICING each carry a small action
              button at their right edge (buy credits, go Unlimited) that opens a
              pop-up instead of navigating. A <button> cannot sit inside an <a>,
              so those rows are a flex wrapper holding the <Link> and the
              <button> side by side; the hover wash is on the wrapper so the row
              still reads as one. */}
          <div className="py-1">
            {/* MY PROFILE */}
            <Link
              href="/account/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-inset"
              style={{ ...ROW_TEXT, textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <User size={15} strokeWidth={2.1} style={{ color: '#9A8A78', flexShrink: 0 }} />
              <span className="flex-1">MY PROFILE</span>
            </Link>

            {/* MANAGE ACCOUNT, with the credit count and a + to buy more */}
            <div
              className="flex items-center transition-colors"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Link
                href="/account/manage/credits"
                onClick={() => setOpen(false)}
                className="flex flex-1 min-w-0 items-center gap-2.5 pl-4 pr-1 py-2 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-inset"
                style={{ ...ROW_TEXT, textDecoration: 'none' }}
              >
                <Settings2 size={15} strokeWidth={2.1} style={{ color: '#9A8A78', flexShrink: 0 }} />
                <span className="flex-1">MANAGE ACCOUNT</span>
                <span
                  className="shrink-0"
                  style={{ color: '#5A4E46', fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}
                >
                  {creditText}
                </span>
              </Link>
              <button
                type="button"
                aria-label="Buy credits"
                title="Buy credits"
                onClick={(e) => { e.stopPropagation(); setOpen(false); openCreditsPopup({ context: 'header' }); }}
                className="flex items-center justify-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-inset"
                // A 32px pressable box drawing an 18px gold disc; keeps the row
                // at its height while giving the + something to press.
                style={{ width: 32, height: 32, marginRight: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <span
                  aria-hidden
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 18, height: 18, backgroundColor: '#EED98A', color: '#1B3828' }}
                >
                  <Plus size={12} strokeWidth={3} />
                </span>
              </button>
            </div>

            {/* PRICING, with the plan badge; on Free, an arrow to go Unlimited */}
            <div
              className="flex items-center transition-colors"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Link
                href="/pricing/credits"
                onClick={() => setOpen(false)}
                className="flex flex-1 min-w-0 items-center gap-2.5 pl-4 py-2 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-inset"
                style={{
                  ...ROW_TEXT,
                  textDecoration: 'none',
                  // With no arrow button beside it the badge keeps the row's own inset.
                  paddingRight: unlimitedStatus !== null && !isUnlimited(unlimitedStatus) ? 4 : 16,
                }}
              >
                <Tag size={15} strokeWidth={2.1} style={{ color: '#9A8A78', flexShrink: 0 }} />
                <span className="flex-1">PRICING</span>
                {/* No badge while the status is not known yet. */}
                {unlimitedStatus !== null && (
                  isUnlimited(unlimitedStatus) ? (
                    <span
                      className="shrink-0 rounded-full"
                      style={{ backgroundColor: '#EED98A', color: '#1B3828', fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', padding: '2px 8px' }}
                    >
                      Unlimited
                    </span>
                  ) : (
                    <span
                      className="shrink-0 rounded-full"
                      style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: '#1C1410', fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', padding: '2px 8px' }}
                    >
                      Free
                    </span>
                  )
                )}
              </Link>
              {unlimitedStatus !== null && !isUnlimited(unlimitedStatus) && (
                <button
                  type="button"
                  aria-label="Go Unlimited"
                  title="Go Unlimited"
                  onClick={(e) => { e.stopPropagation(); setOpen(false); openUnlimitedPopup(); }}
                  className="flex items-center justify-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-inset"
                  style={{ width: 32, height: 32, marginRight: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <span
                    aria-hidden
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 18, height: 18, backgroundColor: '#1B3828', color: '#EED98A' }}
                  >
                    <ArrowUp size={12} strokeWidth={3} />
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Your conferences, lazily fetched. Invitations and drafts live in
              Needs your attention above, see the file header. It renders once the fetch
              has resolved even when the result is EMPTY, because the section header
              carries the + that starts a conference and somebody with none yet is
              exactly who needs it. Still hidden while the fetch is unresolved. */}
          {(confsLoading || myConfs !== null) && (
            <>
              <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />
              <div className="pt-2.5 pb-1">
                <div className="px-4 pb-1.5 flex items-center gap-2">
                  <p
                    className="font-bold flex-1"
                    style={{ color: '#9A8A78', fontSize: '10px', letterSpacing: '0.08em', fontFamily: "var(--font-brand), sans-serif" }}
                  >
                    YOUR CONFERENCES
                  </p>
                  {/* Start a conference. Last in the row so the two counts stay
                      where they were, and the only create affordance in this menu.
                      The section above it now renders once the list has loaded even
                      when it is empty, because somebody with no conference yet is
                      exactly who needs this. */}
                  <Link
                    href="/conferences/new"
                    onClick={() => setOpen(false)}
                    aria-label="Create a conference"
                    title="Create a conference"
                    className="flex-shrink-0 flex items-center justify-center rounded-full focus:outline-none transition-colors"
                    style={{
                      width: 18, height: 18,
                      backgroundColor: 'rgba(27,56,40,0.07)',
                      color: '#1B3828',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.16)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
                  >
                    <Plus size={12} strokeWidth={3} />
                  </Link>
                </div>

                {confsLoading ? (
                  /* Skeleton rows while the batched fetch is in flight */
                  <div className="px-4 py-1 flex flex-col gap-2.5" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-2.5 animate-pulse">
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'rgba(27,56,40,0.08)', flexShrink: 0 }} />
                        <div style={{ height: '9px', borderRadius: '4px', backgroundColor: 'rgba(27,56,40,0.08)', width: i === 1 ? '55%' : '70%' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {visibleConfs.map((conf) => (
                      <Link
                        key={conf.id}
                        href={conf.role === 'ORGANIZER' ? `/manage/${conf.slug}` : `/conferences/${conf.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 transition-colors"
                        style={{ textDecoration: 'none' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        {/* Small round logo on a near-white disc */}
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#FFFEFA',
                            border: '0.5px solid #E7E0CF',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          {conf.logo_url ? (
                            <img
                              src={conf.logo_url}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <span style={{ fontSize: '9.5px', fontWeight: 900, color: '#1B3828', fontFamily: "var(--font-brand), sans-serif" }}>
                              {conf.acronym?.[0] ?? '•'}
                            </span>
                          )}
                        </span>
                        <span
                          className="flex-1 truncate font-bold"
                          style={{ color: '#1C1410', fontSize: '12px', letterSpacing: '0.03em', fontFamily: "var(--font-brand), sans-serif" }}
                        >
                          {conferenceAcronymLabel({ acronym: conf.acronym, start_date: conf.start_date })}
                        </span>
                        {/* One quiet gold dot, never a number: what it means
                            is in its accessible name and its tooltip. The
                            printed word stays the role, so scanning the menu
                            still answers "what am I here" first. */}
                        {conf.attention && (
                          <span
                            role="img"
                            aria-label={conf.attention}
                            title={conf.attention}
                            className="shrink-0"
                            style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#B6871F' }}
                          />
                        )}
                        {conf.standing?.kind === 'allocated' ? (
                          <span
                            className="inline-flex min-w-0 max-w-[55%] shrink items-center gap-1.5 font-bold"
                            style={{ color: '#1B3828', fontSize: '11px', fontFamily: "var(--font-brand), sans-serif" }}
                            title={`${conf.standing.countryName ?? ''}${conf.standing.committee ? ` · ${conf.standing.committee}` : ''}`}
                          >
                            <CircleFlag code={conf.standing.countryCode} country={conf.standing.countryName} size={18} decorative />
                            <span className="truncate">{conf.standing.committee || conf.standing.countryName}</span>
                          </span>
                        ) : (
                          <span
                            className="font-bold uppercase shrink-0"
                            style={{
                              color: conf.standing?.kind === 'unpaid' ? '#8B2020' : conf.standing?.kind === 'approved' ? '#2A5A3C' : conf.pending ? '#8A6614' : '#9A8A78',
                              fontSize: '9px', letterSpacing: '0.06em', fontFamily: "var(--font-brand), sans-serif",
                            }}
                          >
                            {conf.standing?.kind === 'unpaid' ? 'UNPAID'
                              : conf.standing?.kind === 'approved' ? 'APPROVED'
                              : conf.pending ? 'APPLIED' : conf.role}
                          </span>
                        )}
                      </Link>
                    ))}

                    {/* With nothing to list, "All conferences" points at an empty
                        page. Send them where the + goes instead. */}
                    {(myConfs ?? []).length === 0 && !hasOwnPending ? (
                      <Link
                        href="/conferences/new"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 font-bold transition-colors"
                        style={{ color: '#1B3828', fontSize: '11px', letterSpacing: '0.05em', fontFamily: "var(--font-brand), sans-serif", textDecoration: 'none' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        <span className="flex-1">Create a conference</span>
                        <ArrowRight size={13} strokeWidth={2.2} style={{ color: '#9A8A78' }} />
                      </Link>
                    ) : (
                      <Link
                        href="/account/conferences"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 font-bold transition-colors"
                        style={{ color: '#1B3828', fontSize: '11px', letterSpacing: '0.05em', fontFamily: "var(--font-brand), sans-serif", textDecoration: 'none' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27, 56, 40, 0.05)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        <span className="flex-1">All conferences</span>
                        <ArrowRight size={13} strokeWidth={2.2} style={{ color: '#9A8A78' }} />
                      </Link>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 my-1 font-bold transition-colors focus:outline-none"
            style={{
              color: '#8B2020',
              fontFamily: "var(--font-brand), sans-serif",
              letterSpacing: '0.05em',
              fontSize: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139, 32, 32, 0.06)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <LogOut size={15} strokeWidth={2.1} style={{ color: '#8B2020', flexShrink: 0 }} />
            SIGN OUT
          </button>
        </div>
        , document.body)}
    </div>
  );
}
