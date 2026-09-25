'use client';

// The paywalled part of a premium guide page.
//
// Signed out: Sign in (the auth pop-up), then the same card again.
// Signed in, not on Unlimited: Go Unlimited (Christian's purchase pop-up).
// On Unlimited (useUnlimitedStatus): fetch /api/guides/<slug> with the access
// token and render the blocks into .premium-body. The route asks the database
// again with the caller's own JWT, so this component deciding "Unlimited" is a
// hint, never the permission.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Lock, RotateCcw } from 'lucide-react';
import { GoldButton, GoldButtonStyles } from '@/components/GoldButton';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { openUnlimitedPopup } from '@/lib/purchasePopup';
import { isUnlimited, notifyUnlimitedChanged, useUnlimitedStatus } from '@/lib/unlimitedStatus';
import { friendlyError } from '@/lib/friendlyError';
import type { Block } from '@/lib/premiumGuides/types';
import GuideBlocks from './GuideBlocks';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; blocks: Block[] }
  | { kind: 'refused'; reason: 'signin' | 'unlimited' }
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
  const status = useUnlimitedStatus();
  const unlocked = isUnlimited(status);
  const token = session?.access_token ?? null;
  const [load, setLoad] = useState<Load>({ kind: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!unlocked || !token) return;
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
          setLoad({ kind: 'refused', reason: 'unlimited' });
          // The server says no plan: re-read the plan so the card and the
          // profile menu agree with it.
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
  }, [slug, unlocked, userId, attempt]);

  const next = `/guides/${slug}`;

  if (unlocked && load.kind === 'done') {
    return (
      <div className="premium-body">
        <GuideBlocks blocks={load.blocks} />
      </div>
    );
  }

  const checking = authLoading || (!!user && status === null) || (unlocked && (load.kind === 'idle' || load.kind === 'loading'));

  let heading = 'Keep reading with Unlimited';
  let line = `The rest of ${title} is included with Gavelling Unlimited, together with every other premium guide.`;
  let action: React.ReactNode = null;

  if (checking) {
    heading = 'Opening the full guide';
    line = 'Checking your plan.';
  } else if (!user || (load.kind === 'refused' && load.reason === 'signin')) {
    line = `The rest of ${title} is included with Gavelling Unlimited. Sign in to read it if you are on Unlimited, or to join.`;
    action = (
      <GoldButton onClick={() => openAuth({ next })}>
        <Lock size={16} strokeWidth={2.5} aria-hidden="true" />
        Sign in to unlock
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
      <GoldButton onClick={() => openUnlimitedPopup()}>
        <Lock size={16} strokeWidth={2.5} aria-hidden="true" />
        Unlock with Unlimited
      </GoldButton>
    );
  }

  return (
    <>
      <GoldButtonStyles />
      {/* Empty until the body loads: Google's paywall markup points here. */}
      <div className="premium-body" hidden />
      {/* The rest of the page, frosted over and chained shut. The shapes under
          the frost are placeholders built from the locked section titles; the
          guide's own text never reaches this page without Unlimited. */}
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
