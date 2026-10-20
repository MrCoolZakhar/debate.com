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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { refreshCreditsEverywhere, useCredits } from '@/hooks/useCredits';
import type { JobMyListing } from '@/lib/jobBoard';
import PromotePopup from '@/app/manage/[slug]/jobs/PromotePopup';
import { dayLabel } from '@/app/manage/[slug]/jobs/jobsApi';
import StandalonePostingPopup, { type StandaloneShortRequest } from './StandalonePostingPopup';

const FONT = "var(--font-brand), sans-serif";
const FOREST = '#1B3828';
const PENDING_KEY = 'gavelling-job-post-pending';

function readPending(): boolean {
  try { return window.sessionStorage.getItem(PENDING_KEY) === '1'; } catch { return false; }
}
function writePending(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(PENDING_KEY, '1');
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch { /* storage off: the person presses again after signing in */ }
}

type Open =
  | null
  | { kind: 'post'; listing: JobMyListing | null }
  | { kind: 'promote'; listing: JobMyListing };

export function useStandalonePosting({ onChanged, onPosted }: {
  /** Read job_my (and the board) again. */
  onChanged: () => void;
  /** A listing went live: show Your Listings. */
  onPosted?: () => void;
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
  if (open?.kind === 'post' && userId) {
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

  return { post, edit, promote, node };
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
@media (prefers-reduced-motion:reduce){.gv-jobs-post{transition:none}}
`;
