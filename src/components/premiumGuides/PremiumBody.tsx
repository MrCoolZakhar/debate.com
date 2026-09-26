'use client';

// The paywalled part of a premium guide page.
//
// Signed out: Sign in (the auth pop-up), then the same card again.
// Signed in, cannot read: two ways in, "Unlock with Unlimited" (the purchase
// pop-up) and "Unlock this guide · 1 credit" (unlock_guide, yours forever). A
// reader short of credits goes to the credits pop-up for one credit, and the
// unlock runs once by itself when the payment completes.
// Can read (guide_access says so: Unlimited OR unlocked): fetch
// /api/guides/<slug> with the access token and render the blocks into
// .premium-body. The route asks the database again with the caller's own JWT,
// so this component deciding "can read" is a hint, never the permission.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Coins, Loader2, Lock, RotateCcw } from 'lucide-react';
import { GoldButton, GoldButtonStyles } from '@/components/GoldButton';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { openCreditsPopup, openUnlimitedPopup } from '@/lib/purchasePopup';
import { primeGuideAccess } from '@/lib/useGuideAccess';
import { notifyUnlimitedChanged, useUnlimitedStatus } from '@/lib/unlimitedStatus';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import { notifyOk } from '@/lib/appNotify';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { fetchGuideAccess, unlockGuide, type GuideAccess } from '@/lib/guideAccess';
import type { Block } from '@/lib/premiumGuides/types';
import GuideBlocks from './GuideBlocks';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; blocks: Block[] }
  | { kind: 'refused'; reason: 'signin' | 'locked' }
  | { kind: 'error'; message: string };

export default function PremiumBody({
  slug,
  title,
  lockedSections,
}: {
  slug: string;
  title: string;
  /** Titles of the sections behind the paywall, for the card. */
  lockedSections: string[];
}) {
  const { user, session, loading: authLoading } = useAuth();
  const plan = useUnlimitedStatus();
  const token = session?.access_token ?? null;
  const userId = user?.id ?? null;
  const [access, setAccess] = useState<GuideAccess | null>(null);
  const [load, setLoad] = useState<Load>({ kind: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  // The unlock to run again once the credits pop-up completes. Consumed
  // exactly once, so a second onComplete can never take a second credit.
  const pendingUnlockRef = useRef(false);
  const unlockRef = useRef<(() => Promise<void>) | null>(null);

  // Who may read: guide_access, re-read when the account or the plan changes.
  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setAccess({ signed_in: false, unlimited: false, unlocked: false, can_read: false }); return; }
    let cancelled = false;
    void fetchGuideAccess(slug).then(a => {
      if (cancelled) return;
      setAccess(a);
      // The cards, the mark and the contents list read the same answer.
      primeGuideAccess(userId, slug, a);
    });
    return () => { cancelled = true; };
  }, [slug, userId, authLoading, plan, attempt]);

  const canRead = !!access?.can_read;

  useEffect(() => {
    if (!canRead || !token) return;
    let cancelled = false;
    setLoad({ kind: 'loading' });
    fetch(`/api/guides/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) { setLoad({ kind: 'refused', reason: 'signin' }); return; }
        if (res.status === 403) {
          setLoad({ kind: 'refused', reason: 'locked' });
          // The server says no: re-read the plan so the card and the profile
          // menu agree with it.
          notifyUnlimitedChanged(userId ?? undefined);
          return;
        }
        if (!res.ok) throw new Error(`guide ${res.status}`);
        const json = (await res.json()) as { blocks?: Block[] };
        if (!cancelled) setLoad({ kind: 'done', blocks: Array.isArray(json.blocks) ? json.blocks : [] });
      })
      .catch((e) => {
        if (!cancelled) setLoad({ kind: 'error', message: friendlyError(e, 'The rest of this guide did not load. Check your connection and try again.') });
      });
    return () => { cancelled = true; };
    // The token is read at call time; a refresh of it must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, canRead, userId, attempt]);

  const unlock = async () => {
    if (unlockBusy) return;
    setUnlockBusy(true);
    setUnlockError('');
    try {
      const a = await unlockGuide(slug);
      if (a.ok) {
        refreshCreditsEverywhere();
        notifyOk(plainOrFallback(a.message, 'Guide unlocked. It is yours to keep.'), 'guide');
        setAttempt(n => n + 1);
        return;
      }
      if (a.need_credits && a.need_credits > 0) {
        pendingUnlockRef.current = true;
        openCreditsPopup({
          context: 'header',
          preselect: a.need_credits,
          onComplete: () => {
            if (!pendingUnlockRef.current) return;
            pendingUnlockRef.current = false;
            void unlockRef.current?.();
          },
        });
        return;
      }
      setUnlockError(plainOrFallback(a.message, 'This guide could not be unlocked just now. Try again in a moment.'));
    } catch (e) {
      setUnlockError(friendlyError(e, 'This guide could not be unlocked just now. Try again in a moment.'));
    } finally {
      setUnlockBusy(false);
    }
  };
  unlockRef.current = unlock;

  const next = `/guides/${slug}`;

  if (canRead && load.kind === 'done') {
    return (
      <div className="premium-body">
        <GuideBlocks blocks={load.blocks} />
      </div>
    );
  }

  const checking = authLoading || (!!user && access === null) || (canRead && (load.kind === 'idle' || load.kind === 'loading'));

  let heading = 'Keep reading';
  let line = `The rest of ${title} is included with Gavelling Unlimited, or yours forever for 1 credit.`;
  let action: React.ReactNode = null;

  if (checking) {
    heading = 'Opening the full guide';
    line = 'Checking your plan.';
  } else if (!user || (load.kind === 'refused' && load.reason === 'signin')) {
    line = `The rest of ${title} is included with Gavelling Unlimited, or yours forever for 1 credit. Sign in to read it.`;
    action = (
      <GoldButton onClick={() => openAuth({ next })}>
        <Lock size={16} strokeWidth={2.5} aria-hidden="true" />
        Sign in to read
      </GoldButton>
    );
  } else if (load.kind === 'error') {
    heading = 'The rest of the guide did not load';
    line = load.message;
    action = (
      <GoldButton onClick={() => setAttempt((a) => a + 1)}>
        <RotateCcw size={17} strokeWidth={2.4} aria-hidden="true" />
        Try again
      </GoldButton>
    );
  } else {
    action = (
      <>
        <GoldButton onClick={() => openUnlimitedPopup()}>
          <Lock size={16} strokeWidth={2.5} aria-hidden="true" />
          Unlock with Unlimited
        </GoldButton>
        <button
          type="button"
          onClick={() => { void unlock(); }}
          disabled={unlockBusy}
          aria-busy={unlockBusy || undefined}
          className="gvg-unlock-once"
        >
          {unlockBusy ? <Loader2 size={16} className="gvg-spin" aria-hidden="true" /> : <Coins size={16} strokeWidth={2.4} aria-hidden="true" />}
          Unlock this guide · 1 credit
        </button>
      </>
    );
  }

  return (
    <>
      <GoldButtonStyles />
      <style>{`
        .gvg-unlock-once{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 20px;border-radius:12px;background:#FFFFFF;color:#1C1410;border:none;box-shadow:inset 0 0 0 1.5px #1C1410;font-family:var(--font-brand),sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:background-color 140ms ease,transform 120ms ease}
        .gvg-unlock-once:hover:not(:disabled){background:#FAF8F3}
        .gvg-unlock-once:active{transform:scale(0.985)}
        .gvg-unlock-once:disabled{opacity:0.6;cursor:default}
        .gvg-unlock-once:focus{outline:none}
        .gvg-unlock-once:focus-visible{outline:2px solid #1B3828;outline-offset:3px}
        .gvg-unlock-err{margin:10px 0 0;font-size:13.5px;line-height:1.45;color:#9E2A12;font-family:var(--font-brand),sans-serif}
      `}</style>
      {/* Empty until the body loads: Google's paywall markup points here. */}
      <div className="premium-body" hidden />
      {/* The rest of the page, frosted over and chained shut. The shapes under
          the frost are placeholders built from the locked section titles; the
          guide's own text never reaches this page without access. */}
      <section className="gvg-lock" aria-labelledby="gvg-paywall-title" aria-busy={checking || undefined}>
        <div className="gvg-lock-ghost" aria-hidden="true">
          {(lockedSections.length ? lockedSections : ['', '', '']).slice(0, 5).map((t, i) => (
            <div key={i}>
              <h3>{t || 'Section'}</h3>
              {[92, 100, 86, 97, 74].map((w, j) => <i key={j} style={{ width: `${(w + i * 7 + j * 3) % 40 + 60}%` }} />)}
            </div>
          ))}
        </div>
        <div className="gvg-lock-frost" aria-hidden="true" />
        <Chains />
        <div className="gvg-lock-card">
          <div className="gvg-paywall-mark" aria-hidden="true">
            {checking ? <Loader2 size={28} className="gvg-spin" /> : <Lock size={28} strokeWidth={2.3} />}
          </div>
          <h2 id="gvg-paywall-title" className="gvg-paywall-title">{heading}</h2>
          <p className="gvg-paywall-line">{line}</p>
          {action ? (
            <div className="gvg-paywall-actions">
              {action}
              <Link href="/pricing/subscription">What Unlimited includes</Link>
            </div>
          ) : null}
          {unlockError ? <p className="gvg-unlock-err" role="alert">{unlockError}</p> : null}
        </div>
      </section>
    </>
  );
}

/** Two chains crossing the locked page, drawn as interlocking links. */
function Chains() {
  const link = (i: number) => (
    <g key={i} transform={`translate(${i * 34} 0)`}>
      <rect x="0" y="-9" width="40" height="18" rx="9" fill="none" stroke="url(#gvgChainMetal)" strokeWidth="5" />
      <rect x="17" y="-3" width="40" height="6" rx="3" fill="none" stroke="url(#gvgChainMetal)" strokeWidth="5" opacity="0.9" />
    </g>
  );
  const run = Array.from({ length: 48 }, (_, i) => link(i));
  return (
    <svg className="gvg-lock-chains" viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="gvgChainMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4E4A6" />
          <stop offset="0.5" stopColor="#B6871F" />
          <stop offset="1" stopColor="#7A5812" />
        </linearGradient>
        <filter id="gvgChainShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#1C1410" floodOpacity="0.28" />
        </filter>
      </defs>
      <g filter="url(#gvgChainShadow)" opacity="0.92">
        <g transform="translate(-220 60) rotate(24)">{run}</g>
        <g transform="translate(-220 690) rotate(-24)">{run}</g>
      </g>
    </svg>
  );
}
