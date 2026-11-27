'use client';

// ── /jobs: the Job Board for seekers (docs/conferences/job-board.md) ────────
//
// Grid first (prompt 50, owner 18 Nov 2026, Explore's model): /jobs without
// ?listing= is the landing, the heading with Post a listing and Promote
// listing, the tabs, ONE row of search and filter chips, the count with Save
// as alert and the grid / list toggle (remembered per browser), then the
// roles: 4 a row at 1440 and up, 3 from 1100, 2 on tablets, 1 on a phone,
// promoted first as the server orders them. Every tab uses the same view.
//
// A click (or /jobs?listing=<id>) opens the split view from 1024px: Back to
// all, the filters and the list on the left, the listing on the right. The
// page itself does not scroll there; both columns fill the viewport under
// the nav (its height measured) and scroll on their own, and the footer is
// not drawn. Back to all (or the browser's back) returns to the landing in
// the same view and at the same scroll position. On a phone the listing
// opens full width with Back to all at the top (a history entry, so the
// phone's own back works too). The URL carries the filters, the tab and the
// listing, so any view can be shared.
//
// Signed in, three quiet tabs sit over the list: All roles, Saved and My
// Applications (job_my()). The tabs are data; prompt 5 adds Your Listings
// (the standalone listings this person posted), shown only when job_my()
// has some. JobTab (jobQuery.ts) knows only all / saved / applications, so
// Your Listings is LOCAL state (`listingsTab`): the URL keeps tab=all while
// it shows, and ?tab=listings is honoured once on load. "Post a listing" in
// the header opens the standalone posting pop-up (useStandalonePosting,
// which stays mounted here and holds the short-on-credits retry). The first page of the board is rendered on the server
// (page.tsx) so the list is in the HTML; every later read is job_board().

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Clock, LayoutGrid, Rows3, Send, X } from 'lucide-react';
import { HoverHint, InfoHint } from '@/components/HoverHint';
import SiteNav from '@/components/SiteNav';
import NotificationStack from '@/components/notifications/NotificationStack';
import { GoldWord } from '@/components/BrandHeading';
import { useAuth } from '@/components/AuthProvider';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import { openAuth } from '@/lib/authModal';
import {
  fetchJobBoard, fetchJobMy, fetchMyInvites, fetchTalentSettings, jobContinuePath, respondToInvite,
  type JobBoardPage, type JobCard as JobCardData, type JobListingResult, type JobMyApplication, type JobMyListing, type JobMyResult, type JobMyStatus, type JobInvite,
} from '@/lib/jobBoard';
import { notifyOk } from '@/lib/appNotify';
import PostListingButton, { PromoteListingButton, useStandalonePosting } from './PostListingButton';
import YourListings from './YourListings';
import SaveAlertAction from './SaveAlertAction';
import AlertsPanel from './AlertsPanel';
import InvitesBlock, { unansweredInvites } from './InvitesBlock';
import NoMatches from './NoMatches';
import TalentPrompt, { TALENT_CHANGED_EVENT } from '@/components/TalentPrompt';
import Link from 'next/link';
import JobCard, { JobCardSkeleton } from './JobCard';
import JobFilters from './JobFilters';
import JobListing from './JobListing';
import {
  EMPTY_JOB_QUERY, hasActiveFilters, jobFilterKey, jobFiltersOf, readJobQuery, writeJobQuery,
  type JobQuery, type JobTab,
} from './jobQuery';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const PAGE_SIZE = 32; // 8 rows of 4
const VIEW_STORAGE_KEY = 'gavelling-jobs-view';

/** The URL's tabs plus Your Listings, which is local state (see the header). */
type BoardTab = JobTab | 'listings';

const TABS: { key: BoardTab; label: string; signedIn: boolean }[] = [
  { key: 'all', label: 'All roles', signedIn: false },
  { key: 'saved', label: 'Saved', signedIn: true },
  { key: 'applications', label: 'My Applications', signedIn: true },
  { key: 'listings', label: 'Your Listings', signedIn: true },
];

const STATUS_WORD: Record<JobMyStatus, { label: string; icon: typeof Check; tone: string }> = {
  submitted: { label: 'Submitted', icon: Send, tone: FOREST },
  accepted: { label: 'Accepted', icon: Check, tone: FOREST },
  rejected: { label: 'Rejected', icon: X, tone: '#8A3A22' },
  not_finished: { label: 'Not finished', icon: Clock, tone: '#8A5A12' },
};

// My Applications' filters (prompt 77): every application job_my returns,
// narrowed by outcome. In progress is submitted and not finished.
type AppFilter = 'all' | 'progress' | 'won' | 'lost';
const APP_FILTERS: { key: AppFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'progress', label: 'In progress' },
  { key: 'won', label: 'Successful' },
  { key: 'lost', label: 'Not accepted' },
];
function appInFilter(a: JobMyApplication, f: AppFilter): boolean {
  if (f === 'progress') return a.status === 'submitted' || a.status === 'not_finished';
  if (f === 'won') return a.status === 'accepted';
  if (f === 'lost') return a.status === 'rejected';
  return true;
}
/** job_my's can_resubmit (a turned-down application that can still be edited and sent again). */
type MyApp = JobMyApplication & { can_resubmit?: boolean };
/** A successful application's page: the chair role page, else the conference page. */
function rolePageHref(a: JobMyApplication): string | null {
  const slug = a.conference.slug;
  if (!slug) return null;
  return a.role === 'chair' ? `/conferences/${encodeURIComponent(slug)}/role/chair` : `/conferences/${encodeURIComponent(slug)}`;
}

function useIsWide(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

type BoardState =
  | { k: 'ready'; key: string; page: JobBoardPage }
  | { k: 'loading'; key: string; page: JobBoardPage | null }
  | { k: 'error'; key: string; message: string };

export default function JobBoardClient({ initialQuery, initialPage, initialError, initialDetail, footer = null }: {
  initialQuery: JobQuery;
  initialPage: JobBoardPage | null;
  initialError: string | null;
  initialDetail: JobListingResult | null;
  /** The site footer: drawn on the landing, never in the split view. */
  footer?: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const wide = useIsWide();
  const [query, setQuery] = useState<JobQuery>(initialQuery);
  const filterKey = jobFilterKey(query);
  const [board, setBoard] = useState<BoardState>(() => (
    initialPage ? { k: 'ready', key: jobFilterKey(initialQuery), page: initialPage }
      : initialError ? { k: 'error', key: jobFilterKey(initialQuery), message: initialError }
        : { k: 'loading', key: jobFilterKey(initialQuery), page: null }
  ));
  const [moreBusy, setMoreBusy] = useState(false);
  const [my, setMy] = useState<JobMyResult | null>(null);
  const [myErr, setMyErr] = useState<string | null>(null);
  const [listingsTab, setListingsTab] = useState(false);
  // Invites to apply (prompt 11), and the invite this visit arrived with.
  const [invites, setInvites] = useState<JobInvite[]>([]);
  const [inviteParam] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return new URLSearchParams(window.location.search).get('invite'); } catch { return null; }
  });
  // The listing an invite pop-up opened (its small "Invited by" line).
  const [inviteListing, setInviteListing] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState<AppFilter>('all');
  // Open to team roles, for the line under the invites (null until read).
  const [talentOn, setTalentOn] = useState<boolean | null>(null);
  const [pane, setPane] = useState<HTMLDivElement | null>(null);
  const seq = useRef(0);
  const pushedRef = useRef(false);
  const listScroll = useRef(0);
  const restoreY = useRef<number | null>(null);
  const boardUser = useRef<string | null | undefined>(undefined);

  // ── The URL: written in place for filters, a history entry for a phone's listing ──
  const commit = useCallback((next: JobQuery, push = false) => {
    setQuery(next);
    const url = writeJobQuery(next);
    if (push) {
      try { window.history.pushState(null, '', url); pushedRef.current = true; } catch { replaceUrlInPlace(url); }
    } else {
      replaceUrlInPlace(url);
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      pushedRef.current = false;
      const next = readJobQuery(new URLSearchParams(window.location.search));
      // Leaving a listing for the landing: back to where the list was.
      if (queryRef.current.listing && !next.listing && restoreY.current == null) restoreY.current = listScroll.current;
      setQuery(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const patch = useCallback((p: Partial<JobQuery>) => {
    setQuery((q) => {
      const next = { ...q, ...p };
      replaceUrlInPlace(writeJobQuery(next));
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setQuery((q) => {
      const next = { ...EMPTY_JOB_QUERY, tab: q.tab, listing: q.listing };
      replaceUrlInPlace(writeJobQuery(next));
      return next;
    });
  }, []);

  // ── The board: read again whenever the filters change, and once the
  // viewer is known (their own listings ride on a signed-in read). ──
  const loadBoard = useCallback(async (q: JobQuery, quiet: boolean) => {
    const mine = ++seq.current;
    const key = jobFilterKey(q);
    if (!quiet) setBoard((b) => ({ k: 'loading', key, page: b.k === 'error' ? null : b.page }));
    const res = await fetchJobBoard(jobFiltersOf(q), PAGE_SIZE, 0);
    if (mine !== seq.current) return;
    if ('ok' in res) setBoard({ k: 'error', key, message: res.message });
    else setBoard({ k: 'ready', key, page: res });
  }, []);

  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => {
    if (authLoading) return;
    const userChanged = boardUser.current !== undefined && boardUser.current !== userId;
    const first = boardUser.current === undefined;
    boardUser.current = userId;
    if (board.key === filterKey && board.k === 'ready' && !userChanged && !(first && userId)) return;
    void loadBoard(queryRef.current, board.key === filterKey && board.k === 'ready');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, userId, authLoading, loadBoard]);

  async function loadMore() {
    if (board.k !== 'ready' || moreBusy) return;
    setMoreBusy(true);
    const mine = seq.current;
    const res = await fetchJobBoard(jobFiltersOf(query), PAGE_SIZE, board.page.items.length);
    setMoreBusy(false);
    if (mine !== seq.current || 'ok' in res) return;
    setBoard((b) => {
      if (b.k !== 'ready') return b;
      const seen = new Set(b.page.items.map((i) => i.id));
      return { ...b, page: { ...res, items: [...b.page.items, ...res.items.filter((i) => !seen.has(i.id))] } };
    });
  }

  // ── Saved and My Applications ──
  const loadMy = useCallback(async () => {
    const [res, inv] = await Promise.all([fetchJobMy(), fetchMyInvites()]);
    if (Array.isArray(inv)) setInvites(inv);
    if (!res.ok) { setMyErr(res.message); return; }
    setMyErr(null);
    setMy(res);
  }, []);
  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setMy(null); setMyErr(null); setInvites([]); return; }
    void loadMy();
  }, [userId, authLoading, loadMy]);

  // /jobs?listing=<id>&invite=<invite id> (the invite email's "See the role"):
  // signed in and theirs, the invite is marked opened once and the param
  // leaves the URL; the listing then shows "<short> invited you to apply".
  // Signed out nothing happens beyond showing the listing.
  const inviteOpened = useRef(false);
  useEffect(() => {
    if (!inviteParam || !userId || inviteOpened.current) return;
    const inv = invites.find((i) => i.invite_id === inviteParam);
    if (!inv) return;
    inviteOpened.current = true;
    if (inv.invite_status === 'sent') void respondToInvite(inv.invite_id, 'opened');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      replaceUrlInPlace(url.pathname + url.search + url.hash);
    } catch { /* the param simply stays */ }
  }, [inviteParam, userId, invites]);

  // ?tab=listings opens Your Listings once on load (jobQuery reads it as 'all').
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('tab') === 'listings') setListingsTab(true);
    } catch { /* no URL to read */ }
  }, []);

  const myListings = useMemo(() => (my?.listings ?? []) as JobMyListing[], [my]);
  const tab: BoardTab = !userId ? 'all' : listingsTab && myListings.length > 0 ? 'listings' : query.tab;
  const tabs = TABS.filter((t) => (!t.signedIn || !!userId) && (t.key !== 'listings' || myListings.length > 0));

  const posting = useStandalonePosting({
    onChanged: () => {
      if (userId) void loadMy();
      void loadBoard(queryRef.current, true);
    },
    onPosted: () => setListingsTab(true),
    myListings: userId && my ? myListings : null,
  });

  // /jobs?tab=listings&promote=<id> (the "Promote for 3 credits" button in the
  // poster's nudge emails): Your Listings, then the Promote pop-up for that
  // listing when it is one of theirs and live; the param then leaves the URL.
  // Signed out, sign-in comes first and it carries on afterwards.
  const promoteDone = useRef(false);
  const promoteAsked = useRef(false);
  useEffect(() => {
    if (promoteDone.current || authLoading) return;
    const url = new URL(window.location.href);
    const pid = url.searchParams.get('promote');
    if (!pid) { promoteDone.current = true; return; }
    if (!userId) {
      if (!promoteAsked.current) { promoteAsked.current = true; openAuth(); }
      return;
    }
    if (!my) return;
    const target = myListings.find((l) => l.id === pid && l.shown === 'live');
    // One beat later, and only once: a re-render in between reschedules it.
    const t = window.setTimeout(() => {
      if (promoteDone.current) return;
      promoteDone.current = true;
      url.searchParams.delete('promote');
      replaceUrlInPlace(url.pathname + url.search + url.hash);
      if (target) { setListingsTab(true); posting.promote(target); }
    }, 0);
    return () => window.clearTimeout(t);
  }, [authLoading, userId, my, myListings, posting]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchTalentSettings().then((r) => { if (!cancelled && !('ok' in r)) setTalentOn(r.open); });
    const onChanged = (e: Event) => {
      const open = (e as CustomEvent<{ open?: unknown }>).detail?.open;
      if (typeof open === 'boolean') setTalentOn(open);
    };
    window.addEventListener(TALENT_CHANGED_EVENT, onChanged);
    return () => { cancelled = true; window.removeEventListener(TALENT_CHANGED_EVENT, onChanged); };
  }, [userId]);

  const appCounts = useMemo(() => {
    const list = my?.applications ?? [];
    return Object.fromEntries(APP_FILTERS.map((f) => [f.key, list.filter((a) => appInFilter(a, f.key)).length])) as Record<AppFilter, number>;
  }, [my]);

  const items: JobCardData[] = useMemo(() => {
    if (tab === 'listings') return myListings;
    if (tab === 'saved') return my?.saved ?? [];
    if (tab === 'applications') return (my?.applications ?? []).filter((a) => appInFilter(a, appFilter));
    return board.k === 'error' ? [] : board.page?.items ?? [];
  }, [tab, my, board, myListings, appFilter]);

  const appliedAt = useMemo(() => {
    const m = new Map<string, string | null>();
    my?.applications.forEach((a) => m.set(a.id, a.applied_at));
    return m;
  }, [my]);

  const findCard = useCallback((id: string): JobCardData | null => {
    return items.find((c) => c.id === id)
      ?? my?.saved.find((c) => c.id === id)
      ?? my?.applications.find((c) => c.id === id)
      ?? myListings.find((c) => c.id === id)
      ?? (board.k !== 'error' ? board.page?.items.find((c) => c.id === id) : undefined)
      ?? null;
  }, [items, my, board, myListings]);

  // The split view opens only when a listing is chosen (a click, or a
  // /jobs?listing= link); without one the page is the landing grid.
  const selectedId = query.listing;
  const splitWide = wide && !!selectedId;

  // ── The landing's grid or list, remembered per browser (as Explore). ──
  const [view, setView] = useState<'grid' | 'list'>('grid');
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_STORAGE_KEY) === 'list') void Promise.resolve().then(() => setView('list'));
    } catch { /* storage off: the grid */ }
  }, []);
  const changeView = (v: 'grid' | 'list') => {
    setView(v);
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, v); } catch { /* ignore */ }
  };

  // ── The split view fills the viewport under the nav, measured, not guessed. ──
  const navEndRef = useRef<HTMLDivElement | null>(null);
  const [navTop, setNavTop] = useState(72);
  useLayoutEffect(() => {
    if (!splitWide) return;
    const measure = () => {
      const el = navEndRef.current;
      if (!el) return;
      const top = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY));
      setNavTop((t) => (t === top ? t : top));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [splitWide]);

  // Back on the landing: the scroll position the person left it at.
  useEffect(() => {
    if (query.listing || restoreY.current == null) return;
    const y = restoreY.current;
    restoreY.current = null;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo({ top: y })));
  }, [query.listing]);

  const select = useCallback((id: string) => {
    // From the landing: remember where it was and add a history entry, so
    // Back to all (and the browser's back) returns there. Inside the split
    // view another listing replaces the open one.
    const fromLanding = !queryRef.current.listing;
    if (fromLanding) listScroll.current = window.scrollY;
    commit({ ...queryRef.current, listing: id }, fromLanding);
    if (fromLanding || !wide) window.scrollTo({ top: 0 });
  }, [wide, commit]);

  const back = useCallback(() => {
    restoreY.current = listScroll.current;
    if (pushedRef.current) {
      window.history.back();
    } else {
      commit({ ...queryRef.current, listing: null });
    }
  }, [commit]);

  const changeTab = (t: BoardTab) => {
    setListingsTab(t === 'listings');
    commit({ ...queryRef.current, tab: t === 'listings' ? 'all' : t });
  };

  const phoneListing = !wide && !!query.listing;
  const listLoading = tab === 'all' ? board.k === 'loading' && !board.page : !!userId && !my && !myErr;
  const total = tab === 'all' ? (board.k === 'error' ? 0 : board.page?.total ?? 0) : items.length;

  const listing = selectedId ? (
    <JobListing
      key={selectedId}
      id={selectedId}
      initialCard={findCard(selectedId)}
      initialDetail={initialDetail}
      onBack={wide ? undefined : back}
      scrollRoot={wide ? pane : null}
      appliedAt={appliedAt.get(selectedId) ?? null}
      onChanged={() => { if (userId) void loadMy(); }}
      onSelectListing={select}
      onSeeAll={back}
      inviteNote={(() => {
        const inv = invites.find((i) => i.id === selectedId && ((!!inviteParam && i.invite_id === inviteParam) || i.id === inviteListing)) ?? null;
        return inv ? { short: inv.conference.short || inv.conference.name || 'a conference', by: inv.invited_by, avatar: inv.invited_by_avatar ?? null, byId: inv.invited_by_id ?? null } : null;
      })()}
    />
  ) : null;

  const tabRow = tabs.length > 1 && (
    <div role="tablist" aria-label="Show" className="gv-jobs-tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => changeTab(t.key)}
          className={`gv-jobs-tab${tab === t.key ? ' gv-jobs-tab-on' : ''}`}
        >
          {t.label}
          {t.key === 'applications' && unansweredInvites(invites) > 0 && (
            <span style={{ marginLeft: 6, fontSize: 12.5, fontWeight: 800, color: FOREST, fontVariantNumeric: 'tabular-nums' }}>{unansweredInvites(invites)}</span>
          )}
        </button>
      ))}
    </div>
  );

  const countLine = !listLoading && (tab === 'all' ? board.k !== 'error' : !myErr) ? (
    <p style={{ margin: 0 }}>
      <span className="gv-jobs-count-n">{total.toLocaleString()}</span>{' '}
      {tab === 'listings' ? (total === 1 ? 'listing' : 'listings')
        : tab === 'saved' ? (total === 1 ? 'saved role' : 'saved roles')
        : tab === 'applications' ? (total === 1 ? 'application' : 'applications')
          : total === 1 ? 'open role' : 'open roles'}
    </p>
  ) : <span />;

  // The roles: a grid or a list on the landing, one column beside the listing.
  const asGrid = !splitWide && view === 'grid';
  const cards = listLoading ? (
    <div className={`gv-jobs-cards ${asGrid ? 'gv-jobs-cards-grid' : ''}`}>{[0, 1, 2, 3, 4, 5, 6, 7].slice(0, asGrid ? 8 : 4).map((i) => <JobCardSkeleton key={i} />)}</div>
  ) : tab === 'all' && board.k === 'error' ? (
    <p className="gv-jobs-empty">
      {board.message}{' '}
      <button type="button" className="gv-jobs-link" onClick={() => { void loadBoard(query, false); }}>Try again</button>
    </p>
  ) : tab !== 'all' && myErr ? (
    <p className="gv-jobs-empty">
      {myErr}{' '}
      <button type="button" className="gv-jobs-link" onClick={() => { void loadMy(); }}>Try again</button>
    </p>
  ) : tab === 'listings' ? (
    <YourListings
      listings={myListings}
      selectedId={splitWide ? selectedId : null}
      onSelect={select}
      onEdit={posting.edit}
      onPromote={posting.promote}
      onChanged={(message) => {
        notifyOk(message, 'jobs');
        void loadMy();
        void loadBoard(queryRef.current, true);
      }}
    />
  ) : items.length === 0 ? (
    <>
      <p className="gv-jobs-empty">
        {tab === 'saved' ? (
          <>Nothing saved yet. <button type="button" className="gv-jobs-link" onClick={() => changeTab('all')}>Browse all roles</button></>
        ) : tab === 'applications' ? (
          appFilter !== 'all' && (my?.applications.length ?? 0) > 0
            ? <>Nothing here. <button type="button" className="gv-jobs-link" onClick={() => setAppFilter('all')}>Show all</button></>
            : <>You have not applied through the Job Board yet. <button type="button" className="gv-jobs-link" onClick={() => changeTab('all')}>Browse all roles</button></>
        ) : !hasActiveFilters(query) ? (
          <>There are no open roles yet.</>
        ) : (
          <>No roles match these filters. <button type="button" className="gv-jobs-link" onClick={clearAll}>Clear filters</button></>
        )}
      </p>
      {/* Under the sentence, the offer to save the search as an alert (prompt 12). */}
      {tab === 'all' && !splitWide && (
        <div style={{ marginTop: 16 }}><NoMatches query={query} onClear={clearAll} compact={!wide} empty={!hasActiveFilters(query)} /></div>
      )}
    </>
  ) : (
    <ul className={`gv-jobs-cards ${asGrid ? 'gv-jobs-cards-grid' : ''}`} style={{ opacity: board.k === 'loading' && tab === 'all' ? 0.55 : 1 }}>
      {items.map((c) => {
        const app = tab === 'applications' ? (c as MyApp) : null;
        const unfinished = app?.status === 'not_finished' && !!c.conference.slug;
        // A turned-down application that can be sent again opens the application; a successful one its role page.
        const resend = app?.status === 'rejected' && !!app.can_resubmit && !!c.conference.slug;
        const won = app?.status === 'accepted' ? rolePageHref(app) : null;
        const href = unfinished || resend ? jobContinuePath(c.conference.slug as string, c.role, c.id) : won ?? undefined;
        return (
          <li key={c.id}>
            <JobCard
              card={c}
              selected={splitWide && c.id === selectedId}
              onSelect={href ? undefined : select}
              href={href}
              closed={tab === 'saved' && 'open' in c && !(c as { open: boolean }).open}
              status={app ? <StatusLine status={app.status} resend={resend} rolePage={!!won} /> : undefined}
            />
          </li>
        );
      })}
    </ul>
  );

  const showMore = tab === 'all' && board.k === 'ready' && board.page.items.length < board.page.total && (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
      <button type="button" className="gv-jobs-more" onClick={() => { void loadMore(); }} disabled={moreBusy} aria-busy={moreBusy || undefined}>
        {moreBusy ? 'Loading' : 'Show more roles'}
      </button>
    </div>
  );

  const filters = tab === 'all' && (
    <JobFilters
      query={query}
      onChange={patch}
      onClearAll={clearAll}
      conferenceLabel={query.conference ? (items.find((c) => c.conference.id === query.conference)?.conference.short ?? null) : null}
    />
  );

  const tabExtras = (
    <>
      {/* Members manage their alerts in the Saved tab. */}
      {tab === 'saved' && <div style={{ marginTop: 4 }}><AlertsPanel /></div>}
      {/* Invites to apply, above My Applications (prompt 11). */}
      {tab === 'applications' && (
        <InvitesBlock invites={invites} onChange={setInvites} onSelect={(id) => { setInviteListing(id); select(id); }} />
      )}
      {/* Turning invites on or off (prompt 77), under the invites or alone. */}
      {tab === 'applications' && talentOn !== null && (
        <p className="gv-jobs-talent">
          {talentOn ? (
            <>Don&apos;t want invites? <Link href="/account/cv?settings=open" className="gv-jobs-talent-a">Turn them off in your MUN CV Settings</Link></>
          ) : (
            <>Want conferences to invite you to chair or join their team? <Link href="/account/cv?settings=open" className="gv-jobs-talent-a">Turn on Open to team roles</Link></>
          )}
        </p>
      )}
    </>
  );

  // My Applications: All, In progress, Successful, Not accepted, each with its number.
  const appFilters = tab === 'applications' && (my?.applications.length ?? 0) > 0 && (
    <div className="gv-jobs-view" role="group" aria-label="Show applications">
      {APP_FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={appFilter === f.key}
          onClick={() => setAppFilter(f.key)}
          className={`gv-jobs-af${appFilter === f.key ? ' gv-jobs-view-on' : ''}`}
        >
          {f.label} <span className="gv-jobs-af-n">{appCounts[f.key]}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col flex-1" style={{ fontFamily: FONT, color: INK }}>
      <style>{PAGE_CSS}</style>
      <SiteNav hideLanguage />
      <div ref={navEndRef} aria-hidden />
      <NotificationStack topPx={84} />

      {phoneListing ? (
        <main className="gv-jobs-wrap" style={{ paddingTop: 8, paddingBottom: 40 }}>
          <h1 className="sr-only">Job Board</h1>
          {listing}
        </main>
      ) : splitWide ? (
        // LinkedIn's model: the page itself does not scroll; each column does.
        <main className="gv-jobs-wrap gv-jobs-split" style={{ height: `calc(100dvh - ${navTop}px)` }}>
          <h1 className="sr-only">Job Board</h1>
          <section className="gv-jobs-col gv-jobs-col-left" aria-label="Roles">
            <button type="button" className="gv-jobs-backall" onClick={back}>
              <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
              Back to all
            </button>
            {tabRow}
            {filters}
            {tabExtras}
            <div className="gv-jobs-count" aria-live="polite">{countLine}</div>
            {appFilters && <div style={{ marginBottom: 12 }}>{appFilters}</div>}
            {cards}
            {showMore}
          </section>
          <div ref={setPane} className="gv-jobs-col gv-jobs-pane">
            {listing}
          </div>
        </main>
      ) : (
        <main className="gv-jobs-wrap" style={{ paddingBottom: 'clamp(40px, 4vw, 64px)' }}>
          <header className="gv-jobs-head" style={{ paddingTop: 'clamp(12px, 1.4vw, 22px)' }}>
            <h1 className="gv-jobs-h1">Job <GoldWord>Board</GoldWord></h1>
            <div className="gv-jobs-head-acts">
              <span className="gv-jobs-act">
                <PostListingButton onClick={posting.post} />
                <InfoHint label="About posting a listing" text="Post a chair, secretariat or staff role so people across Gavelling can find it and apply." side="bottom" />
              </span>
              <span className="gv-jobs-act">
                <PromoteListingButton onClick={posting.promoteAny} />
                <InfoHint label="About promoted listings" text="Promoted listings are paid for by the conference. They show first wherever they match the filters, with a Promoted tag, and on the homepage if you choose." side="bottom" />
              </span>
            </div>
          </header>

          {/* The one-time "Open to team roles" nudge (prompt 11), signed in only. */}
          <TalentPrompt style={{ marginTop: 14 }} />

          <section aria-label="Roles" style={{ marginTop: 14 }}>
            {tabRow}
            {filters}
            {tabExtras}
            <div className="gv-jobs-countrow">
              <div className="gv-jobs-count" aria-live="polite">{countLine}</div>
              <div className="gv-jobs-countacts">
                {/* Save the current filters as a job alert (Unlimited). */}
                {tab === 'all' && <SaveAlertAction query={query} />}
                {appFilters}
                {tab !== 'listings' && <JobsViewToggle view={view} onChange={changeView} />}
              </div>
            </div>
            {cards}
            {showMore}
          </section>
        </main>
      )}
      {!splitWide && footer}
      {posting.node}
    </div>
  );
}

/** Grid or list, Explore's two icons (with the site's hints, no browser tooltip). */
function JobsViewToggle({ view, onChange }: { view: 'grid' | 'list'; onChange: (v: 'grid' | 'list') => void }) {
  const options: { key: 'grid' | 'list'; icon: typeof LayoutGrid; label: string }[] = [
    { key: 'grid', icon: LayoutGrid, label: 'Grid view' },
    { key: 'list', icon: Rows3, label: 'List view' },
  ];
  return (
    <div className="gv-jobs-view" role="group" aria-label="View">
      {options.map(({ key, icon: Icon, label }) => {
        const active = view === key;
        return (
          <HoverHint key={key} text={label} side="bottom">
            <button
              type="button"
              aria-label={label}
              aria-pressed={active}
              onClick={() => onChange(key)}
              className={`gv-jobs-view-btn${active ? ' gv-jobs-view-on' : ''}`}
            >
              <Icon size={16} strokeWidth={2.25} aria-hidden />
            </button>
          </HoverHint>
        );
      })}
    </div>
  );
}

function StatusLine({ status, resend = false, rolePage = false }: { status: JobMyStatus; resend?: boolean; rolePage?: boolean }) {
  // A turned-down application that can still be sent again (fewer than 3 turn-downs).
  if (status === 'rejected' && resend) {
    return (
      <span className="inline-flex items-center flex-wrap" style={{ gap: 6, fontSize: 13.5, fontWeight: 700, color: '#8A5A12' }}>
        <Clock size={14} strokeWidth={2.6} aria-hidden />
        Not accepted yet. You can edit and send it again
        <span style={{ fontWeight: 600, color: INK_SOFT }}>· Edit application</span>
      </span>
    );
  }
  const s = STATUS_WORD[status] ?? STATUS_WORD.submitted;
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center flex-wrap" style={{ gap: 6, fontSize: 13.5, fontWeight: 700, color: s.tone }}>
      <Icon size={14} strokeWidth={2.6} aria-hidden />
      {s.label}
      {status === 'not_finished' && <span style={{ fontWeight: 600, color: INK_SOFT }}>· Continue application</span>}
      {status === 'accepted' && rolePage && <span style={{ fontWeight: 600, color: INK_SOFT }}>· Open my role page</span>}
    </span>
  );
}

// Explore's wrap: full width up to 1720px with the same gutters, so the page
// fills its width at 1440 and 1920.
const PAGE_CSS = `
.gv-jobs-wrap{width:100%;max-width:1720px;margin:0 auto;padding-left:16px;padding-right:16px}
@media (min-width:640px){.gv-jobs-wrap{padding-left:24px;padding-right:24px}}
@media (min-width:1024px){.gv-jobs-wrap{padding-left:40px;padding-right:40px}}
.gv-jobs-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px}
.gv-jobs-head-acts{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}
.gv-jobs-act{display:inline-flex;align-items:center;gap:2px}
.gv-jobs-h1{margin:0;font-weight:800;font-size:clamp(30px,3.4vw,48px);line-height:1.06;letter-spacing:-0.02em;color:${INK};text-wrap:balance}
.gv-jobs-tabs{display:flex;gap:4px;margin-bottom:14px;border-bottom:1px solid rgba(28,20,16,0.1);overflow-x:auto;scrollbar-width:none}
.gv-jobs-tabs::-webkit-scrollbar{display:none}
.gv-jobs-tab{position:relative;flex-shrink:0;min-height:44px;padding:0 12px;background:none;border:none;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:600;color:${INK_SOFT};transition:color 140ms ease}
.gv-jobs-tab:hover{color:${INK}}
.gv-jobs-tab-on{color:${INK};font-weight:700}
.gv-jobs-tab-on::after{content:'';position:absolute;left:12px;right:12px;bottom:-1px;height:2px;border-radius:2px;background:${FOREST}}
.gv-jobs-tab:focus{outline:none}
.gv-jobs-tab:focus-visible{outline:2px solid ${FOREST};outline-offset:-2px;border-radius:8px}
.gv-jobs-countrow{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px 16px;margin:16px 0 14px}
.gv-jobs-countrow .gv-jobs-count{margin:0}
.gv-jobs-countacts{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:10px 14px}
.gv-jobs-count{min-height:34px;display:flex;align-items:flex-end;margin:14px 0 12px;font-size:15px;font-weight:600;color:${INK_SOFT}}
.gv-jobs-count-n{font-size:24px;font-weight:800;letter-spacing:-0.02em;color:${INK};font-variant-numeric:tabular-nums}
.gv-jobs-cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;transition:opacity 160ms ease}
.gv-jobs-cards > li{display:flex;min-width:0}
.gv-jobs-cards > li > *{flex:1;min-width:0}
@media (min-width:640px){.gv-jobs-cards-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}
@media (min-width:1100px){.gv-jobs-cards-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (min-width:1400px){.gv-jobs-cards-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}}
.gv-jobs-empty{margin:8px 0 0;font-size:15.5px;line-height:1.55;color:${INK}}
.gv-jobs-link{background:none;border:none;padding:0;cursor:pointer;font-family:${FONT};font-size:inherit;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px}
.gv-jobs-link:hover{color:${FOREST}}
.gv-jobs-link:focus{outline:none}
.gv-jobs-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
.gv-jobs-more{min-height:46px;padding:0 22px;border-radius:11px;border:1.5px solid ${INK};background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${INK}}
.gv-jobs-more:disabled{opacity:0.6;cursor:default}
.gv-jobs-more:focus{outline:none}
.gv-jobs-more:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-jobs-view{display:flex;align-items:center;flex-shrink:0;gap:2px;padding:3px;border-radius:12px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.08),0 4px 12px rgba(27,56,40,0.06)}
.gv-jobs-view-btn{display:flex;align-items:center;justify-content:center;width:40px;height:34px;border-radius:9px;border:none;cursor:pointer;background:transparent;color:#6B5F52}
.gv-jobs-view-on{background:#EEF3EC;color:${FOREST}}
.gv-jobs-af{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:9px;border:none;cursor:pointer;background:transparent;font-family:${FONT};font-size:14px;font-weight:600;color:#6B5F52;white-space:nowrap}
.gv-jobs-af.gv-jobs-view-on{font-weight:700}
.gv-jobs-af-n{font-weight:800;font-variant-numeric:tabular-nums}
.gv-jobs-af:focus{outline:none}
.gv-jobs-af:focus-visible{outline:2px solid ${FOREST};outline-offset:1px}
.gv-jobs-talent{margin:0 0 14px;font-size:14.5px;line-height:1.5;color:${INK_SOFT}}
.gv-jobs-talent-a{font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px}
.gv-jobs-view-btn:focus{outline:none}
.gv-jobs-view-btn:focus-visible{outline:2px solid ${FOREST};outline-offset:1px}
.gv-jobs-split{display:grid;grid-template-columns:minmax(340px,0.62fr) minmax(0,1.38fr);gap:28px;overflow:hidden}
@media (min-width:1600px){.gv-jobs-split{grid-template-columns:minmax(400px,0.6fr) minmax(0,1.4fr);gap:36px}}
.gv-jobs-col{min-width:0;min-height:0;height:100%;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:12px 8px 32px;margin:0 -8px}
.gv-jobs-backall{display:inline-flex;align-items:center;gap:6px;min-height:40px;margin-bottom:6px;padding:0 4px;background:none;border:none;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px}
.gv-jobs-backall:hover{color:${FOREST}}
.gv-jobs-backall:focus{outline:none}
.gv-jobs-backall:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:6px}
@media (prefers-reduced-motion:reduce){.gv-jobs-cards{transition:none}}
`;
