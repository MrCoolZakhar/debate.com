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
import { Infinity as InfinityIcon, Loader2, Lock, RotateCcw } from 'lucide-react';
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
      <button type="button" className="gvg-btn gvg-btn-gold" onClick={() => openAuth({ next })}>
        Sign in
      </button>
    );
  } else if (load.kind === 'error') {
    heading = 'The rest of the guide did not load';
    line = load.message;
    action = (
      <button type="button" className="gvg-btn gvg-btn-gold" onClick={() => setAttempt((a) => a + 1)}>
        <RotateCcw size={17} strokeWidth={2.4} aria-hidden="true" />
        Try again
      </button>
    );
  } else {
    action = (
      <button type="button" className="gvg-btn gvg-btn-gold" onClick={() => openUnlimitedPopup()}>
        <InfinityIcon size={18} strokeWidth={2.4} aria-hidden="true" />
        Go Unlimited
      </button>
    );
  }

  return (
    <>
      {/* Empty until the body loads: Google's paywall markup points here. */}
      <div className="premium-body" hidden />
      <section className="gvg-paywall" aria-labelledby="gvg-paywall-title" aria-busy={checking || undefined}>
        <div className="gvg-paywall-mark" aria-hidden="true">
          {checking ? <Loader2 size={26} className="gvg-spin" /> : <Lock size={26} strokeWidth={2.2} />}
        </div>
        <h2 id="gvg-paywall-title" className="gvg-paywall-title">{heading}</h2>
        <p className="gvg-paywall-line">{line}</p>
        {action ? (
          <div className="gvg-paywall-actions">
            {action}
            <Link href="/pricing/subscription" className="gvg-btn gvg-btn-quiet">
              What Unlimited includes
            </Link>
          </div>
        ) : null}
        {lockedSections.length > 0 ? (
          <div className="gvg-paywall-list">
            <p className="gvg-paywall-list-title">Still to read</p>
            <ol>
              {lockedSections.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>
    </>
  );
}
