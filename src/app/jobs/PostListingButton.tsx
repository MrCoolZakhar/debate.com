'use client';

// ── "Post a listing" on /jobs, and the controller behind it ────────────────
//
// docs/conferences/job-board.md, prompt 5. `useStandalonePosting` lives in
// JobBoardClient, which stays mounted, and owns everything around the
// standalone pop-ups:
//   - signed out, the button opens sign-in and remembers the press in
//     sessionStorage ('gavelling-job-post-pending'); once the person is
//     signed in the pop-up opens by itself;
//   - the posting pop-up (new or Edit) and the promotion pop-up (Promote);
//   - short on credits: the pop-up CLOSES first (never a pop-up on a pop-up,
//     the draft is already saved), the credits pop-up opens preselected to
//     need_credits, and its onComplete runs the SAME call once more with
//     p_top_up true (a ref-guarded one-shot), then a toast.
//
// "Promote listing" (prompt 50, owner 18 Nov 2026), beside Post a listing:
//   - signed out, sign-in first (the press is remembered like Post's and
//     carries on once job_my() has been read);
//   - one live listing of their own: PromotePopup for it straight away;
//   - several: the pop-up "Promote a Listing" lists them, and picking one
//     REPLACES it with PromotePopup (never a pop-up on a pop-up);
//   - none: the same pop-up says to post first, and its "Post a listing"
//     replaces it with the posting pop-up.
// Nothing new is written here; PromotePopup buys as before.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Loader2, Plus, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { refreshCreditsEverywhere, useCredits } from '@/hooks/useCredits';
import type { JobMyListing } from '@/lib/jobBoard';
import PromotePopup from '@/app/manage/[slug]/jobs/PromotePopup';
import { dayLabel } from '@/app/manage/[slug]/jobs/jobsApi';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { GOLD_CTA_BG, GOLD_CTA_BG_HOVER, GOLD_CTA_INK, GOLD_CTA_SHADOW, GOLD_CTA_SHADOW_HOVER } from '@/components/GoldButton';
import { jobDates } from './JobCard';
import StandalonePostingPopup, { type StandaloneShortRequest } from './StandalonePostingPopup';

const FONT = "var(--font-brand), sans-serif";
const FOREST = '#1B3828';
const PENDING_KEY = 'gavelling-job-post-pending';
const PROMOTE_PENDING_KEY = 'gavelling-job-promote-pending';
const INK = '#1C1410';
const INK_SOFT = '#5C5140';

function readPending(key = PENDING_KEY): boolean {
  try { return window.sessionStorage.getItem(key) === '1'; } catch { return false; }
}
function writePending(on: boolean, key = PENDING_KEY) {
  try {
    if (on) window.sessionStorage.setItem(key, '1');
    else window.sessionStorage.removeItem(key);
  } catch { /* storage off: the person presses again after signing in */ }
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Promoted until 3 Dec" while a promotion runs, else null. */
function promotedUntil(l: JobMyListing): string | null {
  const end = l.promotion?.ends_on ?? null;
  return end && end.slice(0, 10) >= todayIso() ? `Promoted until ${dayLabel(end)}` : null;
}

type Open =
  | null
  | { kind: 'post'; listing: JobMyListing | null }
  | { kind: 'promote'; listing: JobMyListing }
  | { kind: 'pick' };

export function useStandalonePosting({ onChanged, onPosted, myListings = null }: {
  /** Read job_my (and the board) again. */
  onChanged: () => void;
  /** A listing went live: show Your Listings. */
  onPosted?: () => void;
  /** The person's own listings from job_my() (what Your Listings reads); null until read. */
  myListings?: JobMyListing[] | null;
}) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const { balance } = useCredits();
  const [open, setOpen] = useState<Open>(null);
  const pendingRef = useRef<(StandaloneShortRequest & { posted: boolean }) | null>(null);
  const aliveRef = useRef(true);
  const changedRef = useRef(onChanged);
  const postedRef = useRef(onPosted);
  useEffect(() => { changedRef.current = onChanged; postedRef.current = onPosted; }, [onChanged, onPosted]);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const post = useCallback(() => {
    if (!userId) {
      writePending(true);
      openAuth();
      return;
    }
    setOpen({ kind: 'post', listing: null });
  }, [userId]);

  const edit = useCallback((listing: JobMyListing) => setOpen({ kind: 'post', listing }), []);
  const promote = useCallback((listing: JobMyListing) => setOpen({ kind: 'promote', listing }), []);

  const live = useMemo(() => (myListings ? myListings.filter((l) => l.shown === 'live') : null), [myListings]);

  /** "Promote listing": sign-in, PromotePopup for the one live listing, or the list. */
  const promoteAny = useCallback(() => {
    if (!userId) {
      writePending(true, PROMOTE_PENDING_KEY);
      openAuth();
      return;
    }
    if (live && live.length === 1) { setOpen({ kind: 'promote', listing: live[0] }); return; }
    setOpen({ kind: 'pick' });
  }, [userId, live]);

  // The list was opened before job_my() answered: one live listing goes
  // straight to PromotePopup once it has.
  useEffect(() => {
    if (open?.kind !== 'pick' || !live || live.length !== 1) return;
    const t = window.setTimeout(() => setOpen({ kind: 'promote', listing: live[0] }), 0);
    return () => window.clearTimeout(t);
  }, [open, live]);

  // After signing in, a Promote press made while signed out carries on.
  useEffect(() => {
    if (!userId || !live || !readPending(PROMOTE_PENDING_KEY)) return;
    const t = window.setTimeout(() => {
      writePending(false, PROMOTE_PENDING_KEY);
      setOpen(live.length === 1 ? { kind: 'promote', listing: live[0] } : { kind: 'pick' });
    }, 0);
    return () => window.clearTimeout(t);
  }, [userId, live]);

  // /jobs?post=1 (the homepage's "Post a listing" tile) acts as one press of
  // the button, once the viewer is known (signed out: sign-in first, then it
  // carries on as above). The param leaves the URL so a refresh never reopens it.
  const postParamRef = useRef(false);
  useEffect(() => {
    if (authLoading || postParamRef.current) return;
    if (new URL(window.location.href).searchParams.get('post') !== '1') { postParamRef.current = true; return; }
    const t = window.setTimeout(() => {
      if (postParamRef.current) return;
      postParamRef.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete('post');
      replaceUrlInPlace(url.pathname + url.search + url.hash);
      post();
    }, 0);
    return () => window.clearTimeout(t);
  }, [authLoading, post]);

  // After signing in, the press made while signed out carries on.
  useEffect(() => {
    if (!userId || !readPending()) return;
    // A beat later, so the sign-in pop-up has closed first.
    const t = window.setTimeout(() => {
      writePending(false);
      setOpen({ kind: 'post', listing: null });
    }, 0);
    return () => window.clearTimeout(t);
  }, [userId]);

  const close = useCallback(() => setOpen(null), []);

  /** Close the pop-up, buy credits, then run the same call once more. */
  const topUp = useCallback((req: StandaloneShortRequest, posted: boolean) => {
    setOpen(null);
    pendingRef.current = { ...req, posted };
    openCreditsPopup({
      context: 'header',
      preselect: Math.max(1, Math.trunc(req.need)),
      onComplete: () => {
        const again = pendingRef.current;
        pendingRef.current = null;
        if (!again || !aliveRef.current) return;
        void again.retry().then((r) => {
          if (!aliveRef.current) return;
          if (r.ok) {
            refreshCreditsEverywhere();
            notifyOk(again.okMessage(r as Record<string, unknown>), 'jobs');
            if (again.posted) postedRef.current?.();
          } else {
            notifyErr(r.message, 'jobs');
          }
          changedRef.current();
        });
      },
    });
  }, []);

  const published = useCallback((message: string) => {
    setOpen(null);
    notifyOk(message, 'jobs');
    refreshCreditsEverywhere();
    changedRef.current();
    postedRef.current?.();
  }, []);

  const promoted = useCallback((endsOn: string | null) => {
    setOpen(null);
    notifyOk(endsOn ? `Promoted until ${dayLabel(endsOn)}` : 'Promoted', 'jobs');
    refreshCreditsEverywhere();
    changedRef.current();
  }, []);

  let node: React.ReactNode = null;
  if (open?.kind === 'pick' && userId) {
    node = (
      <PromotePicker
        listings={live}
        onClose={close}
        onPick={(l) => setOpen({ kind: 'promote', listing: l })}
        onPost={() => setOpen({ kind: 'post', listing: null })}
      />
    );
  } else if (open?.kind === 'post' && userId) {
    node = (
      <StandalonePostingPopup
        listing={open.listing}
        userId={userId}
        onClose={close}
        onSaved={() => changedRef.current()}
        onPublished={published}
        onShort={(req) => topUp(req, !open.listing)}
        onPromoted={promoted}
      />
    );
  } else if (open?.kind === 'promote') {
    const l = open.listing;
    node = (
      <PromotePopup
        listingId={l.id}
        listingTitle={l.title}
        conferenceCredits={balance ?? 0}
          payer="you"
        onClose={close}
        onDone={promoted}
        onShort={(req) => topUp({ ...req, okMessage: (a) => `Promoted until ${dayLabel(typeof a.ends_on === 'string' ? a.ends_on : null)}` }, false)}
      />
    );
  }

  return { post, edit, promote, promoteAny, node };
}

/** "Promote a Listing": the person's live listings to pick from, or a line to post first. */
function PromotePicker({ listings, onClose, onPick, onPost }: {
  listings: JobMyListing[] | null;
  onClose: () => void;
  onPick: (l: JobMyListing) => void;
  onPost: () => void;
}) {
  // One press only: the pop-up is replaced on the first.
  const done = useRef(false);
  const once = (fn: () => void) => () => { if (done.current) return; done.current = true; fn(); };
  return (
    <PurchaseShell tone="light" label="Promote a Listing" onClose={onClose} testId="job-promote-pick" panelClass="gv-st-pop gv-pp-pop">
      <style>{PURCHASE_CSS}</style>
      <style>{PICKER_CSS}</style>
      <style>{BUTTON_CSS}</style>
      <h2 className="gv-pp-title">Promote a Listing</h2>
      {!listings ? (
        <p className="gv-pp-line" aria-busy="true"><Loader2 size={16} className="animate-spin" aria-hidden /> Reading your listings</p>
      ) : listings.length === 0 ? (
        <>
          <p className="gv-pp-line">Post a listing first, then promote it here.</p>
          <button type="button" className="gv-jobs-post gv-pp-post" onClick={once(onPost)}>
            <Plus size={17} strokeWidth={2.6} aria-hidden />
            Post a listing
          </button>
        </>
      ) : (
        <ul className="gv-pp-list">
          {listings.map((l) => {
            const until = promotedUntil(l);
            const short = l.conference.short || l.conference.name;
            return (
              <li key={l.id}>
                <button type="button" className="gv-pp-row" onClick={once(() => onPick(l))}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="gv-pp-row-title">{l.title}</span>
                    <span className="gv-pp-row-meta">
                      {short && <span>{short}</span>}
                      {short && <span aria-hidden className="gv-pp-dot">·</span>}
                      <span style={{ whiteSpace: 'nowrap' }}>{jobDates(l.conference)}</span>
                    </span>
                    {until && (
                      <span className="gv-pp-row-until"><Sparkles size={13} strokeWidth={1.75} aria-hidden /> {until}</span>
                    )}
                  </span>
                  <ChevronRight size={18} strokeWidth={1.75} aria-hidden style={{ flexShrink: 0, color: FOREST }} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PurchaseShell>
  );
}

/** The gold "Promote listing" button beside Post a listing. */
export function PromoteListingButton({ onClick }: { onClick: () => void }) {
  return (
    <>
      <style>{BUTTON_CSS}</style>
      <button type="button" className="gv-jobs-promote" onClick={onClick}>
        <Sparkles size={17} strokeWidth={2.2} aria-hidden />
        Promote listing
      </button>
    </>
  );
}

export default function PostListingButton({ onClick }: { onClick: () => void }) {
  return (
    <>
      <style>{BUTTON_CSS}</style>
      <button type="button" className="gv-jobs-post" onClick={onClick}>
        <Plus size={17} strokeWidth={2.6} aria-hidden />
        Post a listing
      </button>
    </>
  );
}

const BUTTON_CSS = `
.gv-jobs-post{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 20px;border:none;border-radius:11px;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:#FFFFFF;white-space:nowrap;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);box-shadow:0 6px 16px rgba(27,56,40,0.22);transition:transform 120ms ease,box-shadow 140ms ease}
.gv-jobs-post:hover{box-shadow:0 8px 20px rgba(27,56,40,0.28)}
.gv-jobs-post:active{transform:scale(0.98)}
.gv-jobs-post:focus{outline:none}
.gv-jobs-post:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-jobs-promote{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 20px;border:none;border-radius:11px;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700;color:${GOLD_CTA_INK};white-space:nowrap;background:${GOLD_CTA_BG};box-shadow:${GOLD_CTA_SHADOW};transition:transform 120ms ease,box-shadow 160ms ease,background 160ms ease}
.gv-jobs-promote:hover{background:${GOLD_CTA_BG_HOVER};box-shadow:${GOLD_CTA_SHADOW_HOVER}}
.gv-jobs-promote:active{transform:scale(0.98)}
.gv-jobs-promote:focus{outline:none}
.gv-jobs-promote:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (prefers-reduced-motion:reduce){.gv-jobs-post,.gv-jobs-promote{transition:none}}
`;

const PICKER_CSS = `
.gv-pp-title{margin:0 0 10px;font-size:26px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;color:${INK}}
.gv-pp-line{display:flex;align-items:center;gap:8px;margin:0 0 16px;font-size:15px;line-height:1.55;color:${INK_SOFT}}
.gv-pp-list{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
.gv-pp-row{width:100%;display:flex;align-items:center;gap:12px;min-height:60px;padding:12px 14px;border-radius:14px;border:1px solid rgba(28,20,16,0.1);background:#FFFFFF;cursor:pointer;text-align:left;font-family:${FONT};
  box-shadow:0 1px 2px rgba(27,56,40,0.05);transition:box-shadow 160ms ease,border-color 160ms ease}
.gv-pp-row:hover{border-color:rgba(27,56,40,0.3);box-shadow:0 6px 16px rgba(27,56,40,0.1)}
.gv-pp-row:focus{outline:none}
.gv-pp-row:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-pp-row-title{display:block;font-size:15.5px;font-weight:700;line-height:1.3;color:${INK};overflow-wrap:anywhere}
.gv-pp-row-meta{display:block;margin-top:3px;font-size:13.5px;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-pp-dot{margin:0 6px;color:rgba(28,20,16,0.3)}
.gv-pp-row-until{display:inline-flex;align-items:center;gap:5px;margin-top:5px;font-size:13px;font-weight:700;color:#8A5A12}
.gv-pp-post{align-self:flex-start}
`;
