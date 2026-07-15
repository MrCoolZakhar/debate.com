'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Crown, Infinity as InfinityIcon, Check, Ticket, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { extractFunctionErrorMessage, unlimitedPricing } from '@/lib/payments';
import { formatFee } from '@/lib/finance';
import { Eyebrow, GlassCard, OUTFIT } from '../accountUi';
import { NEU, NeuInset } from '@/components/neu';

interface Subscription {
  plan: string;
  status: string;
  current_period_end: string | null;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function planLabel(sub: Subscription): string {
  if (sub.plan === 'unlimited_monthly') return 'Monthly plan';
  return sub.current_period_end ? `Yearly pass, valid until ${formatExpiry(sub.current_period_end)}` : 'Yearly pass';
}

export default function UnlimitedPage() {
  const { user, session, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  // ── Personal subscription: owner_user_id = the viewer, conference_id NULL ──
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);

  const fetchSubscription = useCallback(async (): Promise<boolean> => {
    if (!user || !session) return false;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('owner_user_id', user.id)
      .is('conference_id', null)
      .in('status', ['active', 'trialing'])
      .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle();
    const row = (data as Subscription | null) ?? null;
    setSubscription(row);
    setSubscriptionLoaded(true);
    return !!row;
  }, [user?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  // ?unlimited=success|cancelled, the redirect back from Stripe's hosted
  // checkout. Success polls for the webhook-written subscriptions row (every
  // 2s, up to 12s); cancelled just strips the param.
  const [confirming, setConfirming] = useState(false);
  const [confirmTimedOut, setConfirmTimedOut] = useState(false);

  useEffect(() => {
    if (!user || !session) return;
    const unlimitedParam = new URLSearchParams(window.location.search).get('unlimited');
    if (unlimitedParam !== 'success' && unlimitedParam !== 'cancelled') return;
    let cancelled = false;
    if (unlimitedParam === 'success') {
      setConfirming(true);
      let attempts = 0;
      const tick = async () => {
        attempts++;
        const found = await fetchSubscription();
        if (cancelled) return;
        if (found) {
          setConfirming(false);
          return;
        }
        if (attempts >= 6) {
          setConfirming(false);
          setConfirmTimedOut(true);
          return;
        }
        setTimeout(tick, 2000);
      };
      tick();
    }
    router.replace('/account/unlimited');
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  // ── Purchase surface: the buyer's own country decides the region price ──
  const [geoCountry, setGeoCountry] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/geo')
      .then(r => r.json())
      .then(g => setGeoCountry((g?.countryCode as string | null) ?? null))
      .catch(() => {});
  }, []);
  const price = unlimitedPricing(geoCountry);

  const [busy, setBusy] = useState<'monthly' | 'yearly' | null>(null);
  const [purchaseError, setPurchaseError] = useState('');

  async function startCheckout(plan: 'monthly' | 'yearly') {
    if (busy) return;
    setBusy(plan);
    setPurchaseError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setBusy(null);
      setPurchaseError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
      body: { plan, ...(geoCountry ? { country: geoCountry } : {}) },
    });
    if (error) {
      setBusy(null);
      setPurchaseError(await extractFunctionErrorMessage(error));
      return;
    }
    const result = data as { ok?: boolean; url?: string; error?: string } | null;
    if (!result?.ok || !result.url) {
      setBusy(null);
      setPurchaseError(result?.error || 'Could not start checkout. Please try again.');
      return;
    }
    window.location.assign(result.url);
  }

  // ── Entitlements + voucher redemption (context='subscription') ────────────
  // The partial unique index voucher_redemptions_sub_once makes each platform
  // voucher single-use per user; redeem_voucher applies the Unlimited grant.
  const [isAmbassador, setIsAmbassador] = useState(false);
  const [unlimitedRemaining, setUnlimitedRemaining] = useState(0);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);

    supabase
      .from('profiles')
      .select('is_ambassador, unlimited_conferences_remaining')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const p = data as { is_ambassador: boolean; unlimited_conferences_remaining: number } | null;
        setIsAmbassador(p?.is_ambassador ?? false);
        setUnlimitedRemaining(p?.unlimited_conferences_remaining ?? 0);
      });
  }, [authLoading, user?.id, session?.access_token]);

  function redeemReasonText(reason: string): string {
    switch (reason) {
      case 'not_found': return 'That code doesn’t match any Gavelling voucher.';
      case 'inactive': return 'This code is no longer active.';
      case 'expired': return 'This code has expired.';
      case 'limit_reached': return 'This code has reached its redemption limit.';
      case 'already_redeemed': return 'You’ve already redeemed this code.';
      default: return 'That code could not be redeemed. Please check it and try again.';
    }
  }

  async function handleRedeem() {
    const code = redeemCode.trim().toUpperCase();
    if (!code || !session) return;
    setRedeemBusy(true);
    setRedeemResult(null);
    const supabase = getAuthedClient(session.access_token);

    const { data: v, error: vErr } = await supabase.rpc('validate_voucher', {
      p_code: code, p_conference_id: null, p_context: 'subscription',
    });
    const valid = v as { valid: boolean; reason: string | null; voucher_id: string } | null;
    if (vErr || !valid) {
      setRedeemBusy(false);
      setRedeemResult({ ok: false, text: 'Could not check that code right now. Please try again.' });
      return;
    }
    if (!valid.valid) {
      setRedeemBusy(false);
      setRedeemResult({ ok: false, text: redeemReasonText(valid.reason ?? '') });
      return;
    }

    const { data: r, error: rErr } = await supabase.rpc('redeem_voucher', {
      p_voucher_id: valid.voucher_id, p_context: 'subscription', p_application_id: null,
    });
    setRedeemBusy(false);
    const res = r as { ok: boolean; reason?: string; granted_unlimited?: number } | null;
    if (rErr || !res || !res.ok) {
      setRedeemResult({ ok: false, text: redeemReasonText(res?.reason ?? '') });
      return;
    }
    const granted = res.granted_unlimited ?? 0;
    if (granted > 0) {
      setUnlimitedRemaining(prev => prev + granted);
      setRedeemResult({
        ok: true,
        text: `Unlimited unlocked for your next ${granted} conference${granted === 1 ? '' : 's'}. The 5% Gavelling fee is waived automatically at checkout.`,
      });
    } else {
      setRedeemResult({ ok: true, text: 'Code redeemed successfully.' });
    }
    setRedeemCode('');
  }

  if (authLoading || !subscriptionLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const balance = profile?.points_balance ?? 0;
  const active = !!subscription;

  return (
    <div>
      <Eyebrow className="mb-2">Unlimited</Eyebrow>
      <h1
        className="font-black text-[26px] mb-1"
        style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '-0.01em' }}
      >
        Gavelling Unlimited
      </h1>
      <p className="text-sm mb-8" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.6, maxWidth: 560 }}>
        Skip the 5 percent Gavelling platform fee on your own registration fees, at every conference. Card processing still applies.
      </p>

      {/* Personal plan */}
      <Eyebrow className="mb-3">Your Plan</Eyebrow>
      <GlassCard className="!p-5 mb-3">
        {confirming ? (
          <div className="flex items-center gap-3">
            <span
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: 40, height: 40, backgroundColor: 'rgba(182,135,31,0.16)', border: '1.5px solid rgba(182,135,31,0.38)' }}
            >
              <Loader2 size={18} strokeWidth={2.2} className="animate-spin" style={{ color: NEU.deepGold }} />
            </span>
            <div>
              <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                Confirming your Unlimited purchase…
              </p>
              <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>This usually takes a few seconds.</p>
            </div>
          </div>
        ) : active ? (
          <div className="flex items-center gap-3">
            <span
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: 40, height: 40, backgroundColor: 'rgba(61,122,82,0.14)', border: '1.5px solid rgba(61,122,82,0.4)' }}
            >
              <Check size={18} strokeWidth={2.6} style={{ color: '#2A5A3C' }} />
            </span>
            <div>
              <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                Gavelling Unlimited active
                <span style={{ color: '#9A8A78', fontWeight: 700 }}> · {planLabel(subscription!)}</span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                Your registrations skip the 5 percent Gavelling platform fee at every conference.
              </p>
            </div>
          </div>
        ) : confirmTimedOut ? (
          <p className="text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.6 }}>
            Payment received. Unlimited will activate here within a minute.
          </p>
        ) : (
          <>
            <p className="font-bold text-sm mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Go Unlimited</p>
            <p className="text-xs mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.6 }}>
              One personal plan, applies to every conference you register for.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => startCheckout('monthly')}
                disabled={busy !== null}
                className="rounded-full px-3.5 py-1.5 text-xs font-extrabold focus:outline-none"
                style={{
                  border: 'none', fontFamily: OUTFIT, letterSpacing: '0.05em',
                  background: busy !== null ? 'rgba(27,56,40,0.14)' : NEU.forest,
                  color: busy !== null ? NEU.muted : NEU.gold,
                  cursor: busy !== null ? 'default' : 'pointer',
                }}
              >
                {busy === 'monthly' ? 'STARTING CHECKOUT…' : `GO UNLIMITED · ${formatFee(price.monthly, price.currency)}/MONTH`}
              </button>
              <button
                onClick={() => startCheckout('yearly')}
                disabled={busy !== null}
                className="rounded-full px-3.5 py-1.5 text-xs font-extrabold focus:outline-none"
                style={{
                  fontFamily: OUTFIT, letterSpacing: '0.05em',
                  border: busy !== null ? '1px solid rgba(154,138,120,0.3)' : '1px solid rgba(27,56,40,0.35)',
                  background: 'transparent',
                  color: busy !== null ? NEU.muted : NEU.forest,
                  cursor: busy !== null ? 'default' : 'pointer',
                }}
              >
                {busy === 'yearly' ? 'STARTING CHECKOUT…' : `PAY YEARLY · ${formatFee(price.yearly, price.currency)}`}
              </button>
            </div>
            {purchaseError && (
              <p className="mt-2.5 text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                {purchaseError}
              </p>
            )}
          </>
        )}
      </GlassCard>
      <p className="text-xs mb-10" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.6 }}>
        Applies to your own registration fees. Delegation spot purchases keep the standard service fee.
      </p>

      {/* Gavelling Unlimited — entitlements + voucher redemption */}
      <Eyebrow className="mb-3">Gavelling Unlimited</Eyebrow>
      <GlassCard className="!p-5 mb-10">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {isAmbassador && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold"
              style={{
                background: 'linear-gradient(150deg, rgba(238,217,138,0.36), rgba(182,135,31,0.16))',
                border: '1.5px solid rgba(182,135,31,0.5)',
                color: '#7A5A20', fontFamily: OUTFIT, letterSpacing: '0.08em',
              }}
            >
              <Crown size={12} strokeWidth={2.4} style={{ color: NEU.deepGold }} />
              AMBASSADOR: GAVELLING FEE WAIVED, ALWAYS
            </span>
          )}
          {unlimitedRemaining > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold"
              style={{
                backgroundColor: 'rgba(27,56,40,0.07)', border: '1.5px solid rgba(27,56,40,0.28)',
                color: NEU.forest, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums',
              }}
            >
              <InfinityIcon size={12} strokeWidth={2.6} />
              {unlimitedRemaining} conference{unlimitedRemaining === 1 ? '' : 's'} with the fee waived
            </span>
          )}
        </div>
        <p className="text-xs mb-3" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.65 }}>
          Have a Gavelling code? Redeem it here. Subscription codes are single-use per account.
        </p>
        <NeuInset small className="p-2">
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              value={redeemCode}
              onChange={(e) => { setRedeemCode(e.target.value.toUpperCase()); setRedeemResult(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
              placeholder="Voucher code"
              aria-label="Voucher code"
              className="flex-1 min-w-0 rounded-xl px-3.5 py-2 text-sm focus:outline-none"
              style={{
                border: 'none', backgroundColor: 'transparent', color: '#1C1410',
                fontFamily: OUTFIT, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}
            />
            <button
              onClick={handleRedeem}
              disabled={redeemBusy || !redeemCode.trim()}
              className="rounded-full px-4 py-1.5 text-xs font-extrabold focus:outline-none flex-shrink-0"
              style={{
                border: 'none', fontFamily: OUTFIT, letterSpacing: '0.1em',
                background: redeemBusy || !redeemCode.trim() ? 'rgba(27,56,40,0.14)' : NEU.forest,
                color: redeemBusy || !redeemCode.trim() ? NEU.muted : NEU.gold,
                cursor: redeemBusy || !redeemCode.trim() ? 'default' : 'pointer',
              }}
            >
              {redeemBusy ? 'REDEEMING…' : 'REDEEM'}
            </button>
          </div>
        </NeuInset>
        {redeemResult && (
          <p
            className="mt-2.5 text-xs inline-flex items-start gap-1.5"
            style={{ color: redeemResult.ok ? '#3D7A52' : '#8B2020', fontFamily: OUTFIT, lineHeight: 1.6 }}
          >
            {redeemResult.ok ? <Check size={13} strokeWidth={2.6} style={{ marginTop: 2 }} /> : <Ticket size={13} strokeWidth={2.2} style={{ marginTop: 2 }} />}
            {redeemResult.text}
          </p>
        )}
      </GlassCard>

      {/* Points balance, compact — points/rewards are not launched yet */}
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ backgroundColor: 'rgba(237,231,216,0.5)', border: '1px solid rgba(221,212,192,0.7)' }}
      >
        <Sparkles size={16} strokeWidth={2} style={{ color: '#9A8A78', flexShrink: 0 }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            Gavelling Points: {balance}
          </p>
          <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Rewards are coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
