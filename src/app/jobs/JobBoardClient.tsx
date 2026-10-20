'use client';

// ── /jobs: the Job Board for seekers (docs/conferences/job-board.md) ────────
//
// Two panes from 1024px: the list with its filters on the left, the chosen
// listing on the right, sticky while the list scrolls. The URL carries the
// filters, the tab and the listing (/jobs?listing=<id>), so any view can be
// shared; opening such a URL selects that listing. On a phone, tapping a card
// opens the listing in place of the list with a back arrow (a history entry,
// so the phone's own back works too).
//
// Signed in, three quiet tabs sit over the list: All roles, Saved and My
// Applications (job_my()). The tabs are data, so prompt 5 adds Your Listings
// by adding a row. The first page of the board is rendered on the server
// (page.tsx) so the list is in the HTML; every later read is job_board().

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Send, X } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import NotificationStack from '@/components/notifications/NotificationStack';
import { GoldWord } from '@/components/BrandHeading';
import { useAuth } from '@/components/AuthProvider';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import {
  fetchJobBoard, fetchJobMy, jobContinuePath,
  type JobBoardPage, type JobCard as JobCardData, type JobListingResult, type JobMyApplication, type JobMyResult, type JobMyStatus,
} from '@/lib/jobBoard';
import JobCard, { JobCardSkeleton } from './JobCard';
import JobFilters from './JobFilters';
import JobListing from './JobListing';
import {
  EMPTY_JOB_QUERY, jobFilterKey, jobFiltersOf, readJobQuery, writeJobQuery,
  type JobQuery, type JobTab,
} from './jobQuery';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const PAGE_SIZE = 30;

const TABS: { key: JobTab; label: string; signedIn: boolean }[] = [
  { key: 'all', label: 'All roles', signedIn: false },
  { key: 'saved', label: 'Saved', signedIn: true },
  { key: 'applications', label: 'My Applications', signedIn: true },
];

const STATUS_WORD: Record<JobMyStatus, { label: string; icon: typeof Check; tone: string }> = {
  submitted: { label: 'Submitted', icon: Send, tone: FOREST },
  accepted: { label: 'Accepted', icon: Check, tone: FOREST },
  rejected: { label: 'Rejected', icon: X, tone: '#8A3A22' },
  not_finished: { label: 'Not finished', icon: Clock, tone: '#8A5A12' },
};

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

export default function JobBoardClient({ initialQuery, initialPage, initialError, initialDetail }: {
  initialQuery: JobQuery;
  initialPage: JobBoardPage | null;
  initialError: string | null;
  initialDetail: JobListingResult | null;
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
  const [showRanking, setShowRanking] = useState(false);
  const [pane, setPane] = useState<HTMLDivElement | null>(null);
  const seq = useRef(0);
  const pushedRef = useRef(false);
  const listScroll = useRef(0);
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
      setQuery(readJobQuery(new URLSearchParams(window.location.search)));
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
    const res = await fetchJobMy();
    if (!res.ok) { setMyErr(res.message); return; }
    setMyErr(null);
    setMy(res);
  }, []);
  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setMy(null); setMyErr(null); return; }
    void loadMy();
  }, [userId, authLoading, loadMy]);

  const tab: JobTab = userId ? query.tab : 'all';
  const tabs = TABS.filter((t) => !t.signedIn || !!userId);

  const items: JobCardData[] = useMemo(() => {
    if (tab === 'saved') return my?.saved ?? [];
    if (tab === 'applications') return my?.applications ?? [];
    return board.k === 'error' ? [] : board.page?.items ?? [];
  }, [tab, my, board]);

  const appliedAt = useMemo(() => {
    const m = new Map<string, string | null>();
    my?.applications.forEach((a) => m.set(a.id, a.applied_at));
    return m;
  }, [my]);

  const findCard = useCallback((id: string): JobCardData | null => {
    return items.find((c) => c.id === id)
      ?? my?.saved.find((c) => c.id === id)
      ?? my?.applications.find((c) => c.id === id)
      ?? (board.k !== 'error' ? board.page?.items.find((c) => c.id === id) : undefined)
      ?? null;
  }, [items, my, board]);

  // On a laptop the right pane is never empty: with nothing chosen it shows
  // the first listing of the list in view (the URL stays as it is).
  const selectedId = query.listing ?? (wide ? items[0]?.id ?? null : null);

  const select = useCallback((id: string) => {
    if (!wide) {
      listScroll.current = window.scrollY;
      commit({ ...queryRef.current, listing: id }, true);
      window.scrollTo({ top: 0 });
    } else {
      commit({ ...queryRef.current, listing: id });
    }
  }, [wide, commit]);

  const back = useCallback(() => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      commit({ ...queryRef.current, listing: null });
    }
    const y = listScroll.current;
    window.requestAnimationFrame(() => window.scrollTo({ top: y }));
  }, [commit]);

  const changeTab = (t: JobTab) => commit({ ...queryRef.current, tab: t, listing: wide ? null : queryRef.current.listing });

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
    />
  ) : null;

  return (
    <div className="flex flex-col flex-1" style={{ fontFamily: FONT, color: INK }}>
      <style>{PAGE_CSS}</style>
      <SiteNav hideLanguage />
      <NotificationStack topPx={84} />

      {phoneListing ? (
        <main className="gv-jobs-wrap" style={{ paddingTop: 8, paddingBottom: 40 }}>
          <h1 className="sr-only">Job Board</h1>
          {listing}
        </main>
      ) : (
        <main className="gv-jobs-wrap" style={{ paddingBottom: 'clamp(40px, 4vw, 64px)' }}>
          <header style={{ paddingTop: 'clamp(12px, 1.4vw, 22px)' }}>
            <h1 className="gv-jobs-h1">Job <GoldWord>Board</GoldWord></h1>
            <p className="gv-jobs-cap">Chair, secretariat and staff roles at conferences worldwide</p>
          </header>

          <div className="gv-jobs-grid">
            <section className="gv-jobs-left" aria-label="Roles">
              {tabs.length > 1 && (
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
                    </button>
                  ))}
                </div>
              )}

              {tab === 'all' && <JobFilters query={query} onChange={patch} onClearAll={clearAll} />}

              <div className="gv-jobs-count" aria-live="polite">
                {!listLoading && (tab === 'all' ? board.k !== 'error' : !myErr) && (
                  <p style={{ margin: 0 }}>
                    <span className="gv-jobs-count-n">{total.toLocaleString()}</span>{' '}
                    {tab === 'saved' ? (total === 1 ? 'saved role' : 'saved roles')
                      : tab === 'applications' ? (total === 1 ? 'application' : 'applications')
                        : total === 1 ? 'open role' : 'open roles'}
                  </p>
                )}
              </div>

              {listLoading ? (
                <div className="gv-jobs-list">{[0, 1, 2, 3, 4].map((i) => <JobCardSkeleton key={i} />)}</div>
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
              ) : items.length === 0 ? (
                <p className="gv-jobs-empty">
                  {tab === 'saved' ? (
                    <>Nothing saved yet. <button type="button" className="gv-jobs-link" onClick={() => changeTab('all')}>Browse all roles</button></>
                  ) : tab === 'applications' ? (
                    <>You have not applied through the Job Board yet. <button type="button" className="gv-jobs-link" onClick={() => changeTab('all')}>Browse all roles</button></>
                  ) : (
                    <>No roles match these filters. <button type="button" className="gv-jobs-link" onClick={clearAll}>Clear filters</button></>
                  )}
                </p>
              ) : (
                <ul className="gv-jobs-list" style={{ opacity: board.k === 'loading' && tab === 'all' ? 0.55 : 1 }}>
                  {items.map((c) => {
                    const app = tab === 'applications' ? (c as JobMyApplication) : null;
                    const unfinished = app?.status === 'not_finished' && !!c.conference.slug;
                    return (
                      <li key={c.id}>
                        <JobCard
                          card={c}
                          selected={wide && c.id === selectedId}
                          onSelect={unfinished ? undefined : select}
                          href={unfinished ? jobContinuePath(c.conference.slug as string, c.role, c.id) : undefined}
                          closed={tab === 'saved' && 'open' in c && !(c as { open: boolean }).open}
                          status={app ? <StatusLine status={app.status} /> : undefined}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}

              {tab === 'all' && board.k === 'ready' && board.page.items.length < board.page.total && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                  <button type="button" className="gv-jobs-more" onClick={() => { void loadMore(); }} disabled={moreBusy} aria-busy={moreBusy || undefined}>
                    {moreBusy ? 'Loading' : 'Show more roles'}
                  </button>
                </div>
              )}

              {tab === 'all' && (
                <div style={{ marginTop: 18 }}>
                  <button type="button" className="gv-jobs-link gv-jobs-link-quiet" aria-expanded={showRanking} onClick={() => setShowRanking((v) => !v)}>
                    How promoted listings are ranked
                  </button>
                  {showRanking && (
                    <p className="gv-jobs-explain">
                      Promoted listings are paid for by the conference. They show first where they match your filters, with a Promoted tag. Everything else is newest first
                    </p>
                  )}
                </div>
              )}
            </section>

            {wide && (
              <div className="gv-jobs-right">
                <div ref={setPane} className="gv-jobs-pane">
                  {listing ?? (!listLoading && (
                    <div className="gv-jobs-pane-empty">
                      <p style={{ margin: 0 }}>Choose a role on the left to read it here</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

function StatusLine({ status }: { status: JobMyStatus }) {
  const s = STATUS_WORD[status] ?? STATUS_WORD.submitted;
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center" style={{ gap: 6, fontSize: 13.5, fontWeight: 700, color: s.tone }}>
      <Icon size={14} strokeWidth={2.6} aria-hidden />
      {s.label}
      {status === 'not_finished' && <span style={{ fontWeight: 600, color: INK_SOFT }}>· Continue application</span>}
    </span>
  );
}

// Explore's wrap: full width up to 1720px with the same gutters, so the page
// fills its width at 1440 and 1920.
const PAGE_CSS = `
.gv-jobs-wrap{width:100%;max-width:1720px;margin:0 auto;padding-left:16px;padding-right:16px}
@media (min-width:640px){.gv-jobs-wrap{padding-left:24px;padding-right:24px}}
@media (min-width:1024px){.gv-jobs-wrap{padding-left:40px;padding-right:40px}}
.gv-jobs-h1{margin:0;font-weight:800;font-size:clamp(30px,3.4vw,48px);line-height:1.06;letter-spacing:-0.02em;color:${INK};text-wrap:balance}
.gv-jobs-cap{margin:8px 0 0;font-size:clamp(15px,1.1vw,17px);line-height:1.45;color:${INK_SOFT}}
.gv-jobs-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:24px;margin-top:clamp(16px,1.8vw,26px)}
@media (min-width:1024px){.gv-jobs-grid{grid-template-columns:minmax(360px,0.82fr) minmax(0,1.38fr);gap:28px;align-items:start}}
@media (min-width:1600px){.gv-jobs-grid{grid-template-columns:minmax(420px,0.75fr) minmax(0,1.45fr);gap:36px}}
.gv-jobs-left{min-width:0}
.gv-jobs-tabs{display:flex;gap:4px;margin-bottom:14px;border-bottom:1px solid rgba(28,20,16,0.1);overflow-x:auto;scrollbar-width:none}
.gv-jobs-tabs::-webkit-scrollbar{display:none}
.gv-jobs-tab{position:relative;flex-shrink:0;min-height:44px;padding:0 12px;background:none;border:none;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:600;color:${INK_SOFT};transition:color 140ms ease}
.gv-jobs-tab:hover{color:${INK}}
.gv-jobs-tab-on{color:${INK};font-weight:700}
.gv-jobs-tab-on::after{content:'';position:absolute;left:12px;right:12px;bottom:-1px;height:2px;border-radius:2px;background:${FOREST}}
.gv-jobs-tab:focus{outline:none}
.gv-jobs-tab:focus-visible{outline:2px solid ${FOREST};outline-offset:-2px;border-radius:8px}
.gv-jobs-count{min-height:34px;display:flex;align-items:flex-end;margin:16px 0 12px;font-size:15px;font-weight:600;color:${INK_SOFT}}
.gv-jobs-count-n{font-size:24px;font-weight:800;letter-spacing:-0.02em;color:${INK};font-variant-numeric:tabular-nums}
.gv-jobs-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;transition:opacity 160ms ease}
.gv-jobs-empty{margin:8px 0 0;font-size:15.5px;line-height:1.55;color:${INK}}
.gv-jobs-link{background:none;border:none;padding:0;cursor:pointer;font-family:${FONT};font-size:inherit;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px}
.gv-jobs-link:hover{color:${FOREST}}
.gv-jobs-link-quiet{font-size:13.5px;color:${INK_SOFT}}
.gv-jobs-link:focus{outline:none}
.gv-jobs-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
.gv-jobs-explain{margin:8px 0 0;max-width:62ch;font-size:13.5px;line-height:1.55;color:${INK_SOFT}}
.gv-jobs-more{min-height:46px;padding:0 22px;border-radius:11px;border:1.5px solid ${INK};background:#FFFFFF;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${INK}}
.gv-jobs-more:disabled{opacity:0.6;cursor:default}
.gv-jobs-more:focus{outline:none}
.gv-jobs-more:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-jobs-right{min-width:0;position:sticky;top:16px}
@media (min-width:1200px){.gv-jobs-right{top:84px}}
.gv-jobs-pane{max-height:calc(100dvh - 32px);overflow-y:auto;overscroll-behavior:contain;padding:4px 6px 24px;margin:-4px -6px 0;scrollbar-width:thin}
@media (min-width:1200px){.gv-jobs-pane{max-height:calc(100dvh - 100px)}}
.gv-jobs-pane-empty{display:flex;align-items:center;justify-content:center;min-height:320px;border-radius:20px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 8px 24px rgba(27,56,40,0.08);font-size:15.5px;color:${INK_SOFT};padding:24px;text-align:center}
@media (prefers-reduced-motion:reduce){.gv-jobs-list{transition:none}}
`;
