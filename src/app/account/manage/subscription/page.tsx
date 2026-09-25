'use client';

// Manage account: Subscription. The current Unlimited plan, read the way the
// old /account/unlimited page read it (a personal subscriptions row, active or
// trialing, not past its period end), with Go Unlimited through the global
// pop-up and Manage or cancel through Stripe's billing portal. There is no
// in-app cancel flow on purpose: the portal is the one place a plan changes.

import { useCallback, useEffect, useState } from 'react';
import { Infinity as InfinityIcon, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useUnlimitedStatus } from '@/lib/unlimitedStatus';
import { openUnlimitedPopup } from '@/lib/purchasePopup';
import { openBillingPortal, checkoutErrorText } from '@/lib/purchaseCheckout';
import { notifyErr } from '@/lib/appNotify';
import { friendlyError } from '@/lib/friendlyError';
import { Emoji3D } from '@/components/neu';
import { OUTFIT, T, W } from '../../accountUi';
import { PageHead, HelpLine, PrimaryButton, SecondaryButton, formatDay } from '../manageUi';

interface SubscriptionRow {
  plan: string;
  status: string;
  current_period_end: string | null;
}

type PlanView =
  | { kind: 'loading' }
  | { kind: 'free' }
  | { kind: 'trial'; daysLeft: number; endsOn: string | null }
  | { kind: 'paid'; cadence: 'monthly' | 'yearly'; renewsOn: string | null }
  | { kind: 'lapsed'; endedOn: string | null; wasTrial: boolean };

function isActiveRow(r: SubscriptionRow, now: number): boolean {
  return (r.status === 'active' || r.status === 'trialing')
    && (r.current_period_end === null || new Date(r.current_period_end).getTime() > now);
}

/** Any plan starting "unlimited" that is not "_monthly" or "_trial" is the yearly one
 *  (it has appeared as both unlimited_yearly and unlimited_annual). */
function cadenceOf(plan: string): 'monthly' | 'yearly' {
  return plan === 'unlimited_monthly' ? 'monthly' : 'yearly';
}

function daysLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function viewOf(rows: SubscriptionRow[]): PlanView {
  const now = Date.now();
  const active = rows.find((r) => isActiveRow(r, now)) ?? null;
  if (active) {
    if (active.plan === 'unlimited_trial' || active.status === 'trialing') {
      return { kind: 'trial', daysLeft: daysLeft(active.current_period_end), endsOn: active.current_period_end };
    }
    return { kind: 'paid', cadence: cadenceOf(active.plan), renewsOn: active.current_period_end };
  }
  const latest = rows[0];
  if (latest && latest.plan.startsWith('unlimited')) {
    return { kind: 'lapsed', endedOn: latest.current_period_end, wasTrial: latest.plan === 'unlimited_trial' };
  }
  return { kind: 'free' };
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const unlimitedStatus = useUnlimitedStatus();
  const [view, setView] = useState<PlanView>({ kind: 'loading' });
  const [loadError, setLoadError] = useState('');
  const [portalBusy, setPortalBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const client = await getFreshAuthedClient();
      if (!client) throw new Error('signed out');
      const { data, error } = await client
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('owner_user_id', user.id)
        .is('conference_id', null)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      setLoadError('');
      setView(viewOf((data as SubscriptionRow[] | null) ?? []));
    } catch (err) {
      setLoadError(friendlyError(err, 'Could not read your plan. Refresh the page to try again.'));
      setView({ kind: 'free' });
    }
  }, [user]);

  // Re-read on mount and whenever the Unlimited status moves (a purchase from
  // the pop-up, a promo code, a cancellation), so nothing needs a reload.
  useEffect(() => { void load(); }, [load, unlimitedStatus]);

  async function handlePortal() {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const url = await openBillingPortal();
      window.location.assign(url);
    } catch (err) {
      notifyErr(checkoutErrorText(err));
      setPortalBusy(false);
    }
  }

  return (
    <div>
      <PageHead title="Subscription" lede="Unlimited covers every application, so credits are never a question." />

      {loadError && (
        <p role="alert" style={{ margin: '0 0 16px', fontFamily: OUTFIT, fontSize: T.body, color: '#C13515' }}>
          {loadError}
        </p>
      )}

      <section
        aria-live="polite"
        className="rounded-[20px] p-6 md:p-8"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxWidth: 640 }}
      >
        {view.kind === 'loading' ? (
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.body, color: '#5A5046' }}>Reading your plan.</p>
        ) : (
          <PlanBlock view={view} portalBusy={portalBusy} onPortal={handlePortal} />
        )}
      </section>

      <HelpLine />
    </div>
  );
}

function PlanBlock({ view, portalBusy, onPortal }: { view: Exclude<PlanView, { kind: 'loading' }>; portalBusy: boolean; onPortal: () => void }) {
  const eyebrow = (
    <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.caption, fontWeight: W.section, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B6871F' }}>
      Your plan
    </p>
  );

  const title = (text: string) => (
    <h2 style={{ margin: '6px 0 0', fontFamily: OUTFIT, fontWeight: W.title, fontSize: 'clamp(24px, 6vw, 30px)', lineHeight: 1.15, color: '#1C1410', letterSpacing: '-0.01em' }}>
      {text}
    </h2>
  );

  const line = (text: string) => (
    <p style={{ margin: '10px 0 0', fontFamily: OUTFIT, fontSize: T.body, lineHeight: 1.55, color: '#5A5046', maxWidth: '60ch' }}>
      {text}
    </p>
  );

  const icon = (name: string) => (
    <span className="flex-shrink-0 inline-flex items-center justify-center rounded-2xl" style={{ width: 52, height: 52, backgroundColor: 'rgba(238,217,138,0.28)' }} aria-hidden>
      <Emoji3D name={name} size={30} fallback={name === 'Infinity' ? InfinityIcon : Sparkles} fallbackColor="#1B3828" />
    </span>
  );

  if (view.kind === 'free') {
    return (
      <div className="flex items-start gap-4">
        {icon('Sparkles')}
        <div className="min-w-0 flex-1">
          {eyebrow}
          {title('Free')}
          {line('Each application costs one credit. Unlimited takes credits out of the picture for as long as it runs.')}
          <div className="mt-5">
            <PrimaryButton onClick={() => openUnlimitedPopup()}>Go Unlimited</PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  if (view.kind === 'trial') {
    const days = view.daysLeft;
    return (
      <div className="flex items-start gap-4">
        {icon('Infinity')}
        <div className="min-w-0 flex-1">
          {eyebrow}
          {title('Unlimited, trial')}
          {line(
            days === 0
              ? 'Your trial ends today.'
              : `${days} day${days === 1 ? '' : 's'} left${view.endsOn ? `, until ${formatDay(view.endsOn)}` : ''}.`,
          )}
          {line('Keep it going with a plan and nothing changes on the day the trial ends.')}
          <div className="mt-5">
            <PrimaryButton onClick={() => openUnlimitedPopup()}>Go Unlimited</PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  if (view.kind === 'paid') {
    return (
      <div className="flex items-start gap-4">
        {icon('Infinity')}
        <div className="min-w-0 flex-1">
          {eyebrow}
          {title(view.cadence === 'monthly' ? 'Unlimited, monthly' : 'Unlimited, yearly')}
          {view.renewsOn ? line(`Renews on ${formatDay(view.renewsOn)}.`) : line('Active.')}
          <div className="mt-5 flex flex-col items-start gap-3">
            <SecondaryButton onClick={onPortal} disabled={portalBusy}>
              {portalBusy ? 'Opening your billing portal' : 'Manage or cancel'}
            </SecondaryButton>
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.caption, lineHeight: 1.5, color: '#5A5046', maxWidth: '60ch' }}>
              Cancelling keeps Unlimited until the end of the period you paid for.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // lapsed
  return (
    <div className="flex items-start gap-4">
      {icon('Sparkles')}
      <div className="min-w-0 flex-1">
        {eyebrow}
        {title('Free')}
        {line(
          view.wasTrial
            ? `Your free trial ended${view.endedOn ? ` on ${formatDay(view.endedOn)}` : ''}. Subscribe to get Unlimited back.`
            : `Your Unlimited plan ended${view.endedOn ? ` on ${formatDay(view.endedOn)}` : ''}.`,
        )}
        <div className="mt-5">
          <PrimaryButton onClick={() => openUnlimitedPopup()}>Go Unlimited</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
