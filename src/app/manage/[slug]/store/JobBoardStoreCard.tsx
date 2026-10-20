'use client';

// JobBoardStoreCard — the Store's Job Board card: this conference's live
// listings, each with Promote (PromotePopup). Prices come from the panel
// (readPanel → prices) and the quote, never typed here. Short on credits:
// the pop-up closes first, then useJobTopUp opens the credits pop-up and
// re-runs the same promotion once.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { notifyOk } from '@/lib/appNotify';
import { JOB_ROLE_LABEL } from '@/lib/jobBoard';
import { StoreCard } from './storeKit';
import PromotePopup from '../jobs/PromotePopup';
import { useJobTopUp } from '../jobs/useJobTopUp';
import { readPanel, dayLabel, plural, type JobPanel, type Refusal } from '../jobs/jobsApi';

export default function JobBoardStoreCard({ conferenceId, slug, onChanged }: {
  conferenceId: string; slug: string; onChanged?: () => void;
}) {
  const [panel, setPanel] = useState<JobPanel | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<{ id: string; title: string } | null>(null);
  const aliveRef = useRef(true);
  const startTopUp = useJobTopUp();

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readPanel(conferenceId).then((r: JobPanel | Refusal) => {
      if (cancelled) return;
      if (r.ok) { setPanel(r); setLoadErr(''); } else { setLoadErr(r.message); }
    });
    return () => { cancelled = true; };
  }, [conferenceId, attempt]);

  const reload = useCallback(() => {
    if (aliveRef.current) setAttempt((n) => n + 1);
  }, []);

  const tryAgain = () => { setLoadErr(''); setPanel(null); reload(); };

  const extra = panel ? Number(panel.prices?.homepage_extra) : NaN;
  const hint = `Promote a listing so it shows first on the Job Board, on Explore and in job alerts. ${
    Number.isFinite(extra) && extra > 0 ? `Add the homepage for ${plural(extra, 'more credit')}` : 'You can add the homepage too'
  }`;

  const live = panel ? panel.listings.filter((l) => l.shown === 'live') : [];

  return (
    <StoreCard title="Job Board" line="Put a listing first on the Job Board" hint={hint}>
      {!panel && !loadErr ? (
        <div aria-busy="true" aria-label="Loading your listings" className="flex flex-col gap-2.5">
          {[0, 1].map((i) => <span key={i} className="block rounded-[14px]" style={{ height: 64, background: 'rgba(28,20,16,0.07)' }} />)}
        </div>
      ) : null}

      {loadErr ? (
        <p className="gv-st-quiet">
          {loadErr}{' '}
          <button type="button" className="gv-st-link" onClick={tryAgain}>Try again</button>
        </p>
      ) : null}

      {panel && live.length === 0 ? (
        <>
          <p className="gv-st-quiet" style={{ marginBottom: 14 }}>You have no live listings yet</p>
          <Link href={`/manage/${slug}/jobs`} className="gv-st-btn gv-st-forest">Post a listing</Link>
        </>
      ) : null}

      {panel && live.length > 0 ? (
        <div className="gv-st-rows">
          {live.map((l) => {
            const sub = [JOB_ROLE_LABEL[l.role] ?? '', l.committee ?? ''].filter(Boolean).join(', ');
            return (
              <div key={l.id} className="gv-st-row" style={{ alignItems: 'center' }}>
                <div style={{ minWidth: 0, flex: '1 1 180px' }}>
                  <p className="gv-st-row-title" style={{ overflowWrap: 'anywhere' }}>{l.title}</p>
                  {sub ? <p className="gv-st-quiet" style={{ overflowWrap: 'anywhere' }}>{sub}</p> : null}
                  {l.promotion ? <p className="gv-st-quiet" style={{ fontWeight: 600, color: '#2A5A3C' }}>Promoted until {dayLabel(l.promotion.ends_on)}</p> : null}
                </div>
                {panel.can_promote ? (
                  <button
                    type="button"
                    className="gv-st-btn gv-st-outline"
                    disabled={!!open}
                    onClick={() => { if (!open) setOpen({ id: l.id, title: l.title }); }}
                  >
                    Promote
                  </button>
                ) : null}
              </div>
            );
          })}
          {!panel.can_promote ? <p className="gv-st-quiet">Only organizers who can spend the conference&rsquo;s credits can promote a listing</p> : null}
        </div>
      ) : null}

      {open && panel ? (
        <PromotePopup
          listingId={open.id}
          listingTitle={open.title}
          conferenceCredits={panel.conference_credits}
          onClose={() => setOpen(null)}
          onDone={(endsOn) => {
            setOpen(null);
            notifyOk(endsOn ? `Promoted until ${dayLabel(endsOn)}` : 'Your listing is promoted', 'store');
            reload();
            onChanged?.();
          }}
          onShort={({ need, retry }) => {
            setOpen(null);
            startTopUp({
              need,
              retry,
              okMessage: (a) => (typeof a.ends_on === 'string' && a.ends_on ? `Promoted until ${dayLabel(a.ends_on)}` : 'Your listing is promoted'),
              onSettled: () => { reload(); onChanged?.(); },
            });
          }}
        />
      ) : null}
    </StoreCard>
  );
}
