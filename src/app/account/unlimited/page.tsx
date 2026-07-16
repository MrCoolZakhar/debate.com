'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Ticket, Crown, Coins, Infinity as InfinityIcon, Check, Loader2, Minus, Plus, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { useCredits } from '@/hooks/useCredits';
import { extractFunctionErrorMessage, unlimitedPricing, creditPricing, proPricing } from '@/lib/payments';
import { formatFee } from '@/lib/finance';
import { Eyebrow, GlassCard } from '../accountUi';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuButton, NeuPill, NeuIconDisc, NeuInset } from '@/components/neu';

interface Subscription {
  plan: string;
  status: string;
  current_period_end: string | null;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// localStorage key for the "buy credits mid-apply, come back" round trip —
// written on mount when ?returnTo is present, read once an entitlement
// (subscription or credit purchase) is confirmed. Must be an internal path:
// starts with "/" and NOT "//" (a "//evil.com"-style protocol-relative URL),
// so a tampered value can never bounce someone off-site.
const RETURN_TO_KEY = 'gavelling-credits-returnto';

function isInternalPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//');
}

function planLabel(sub: Subscription): string {
  if (sub.plan === 'unlimited_monthly') return 'Monthly plan';
  return sub.current_period_end ? `Yearly pass, valid until ${formatExpiry(sub.current_period_end)}` : 'Yearly pass';
}

/** Whole days remaining until `iso`, floored at 0 (never negative). */
function trialDaysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** Monthly button: "$5 A MONTH". Annual button: "$3.75 A MONTH · BILLED
 *  ANNUALLY ($45)", the annual total divided evenly across 12 months, both
 *  derived from unlimitedPricing(code) so the copy always matches whatever
 *  the server actually charges. */
function monthlyLabel(price: { monthly: number; currency: string }): string {
  return `${formatFee(price.monthly, price.currency)} A MONTH`;
}
function annualLabel(price: { yearly: number; currency: string }): string {
  const perMonth = Math.round((price.yearly / 12) * 100) / 100;
  return `${formatFee(perMonth, price.currency)} A MONTH · BILLED ANNUALLY (${formatFee(price.yearly, price.currency)})`;
}

interface PlanFeature {
  text: string;
  comingSoon?: boolean;
}

/** A single feature row: small check badge + text + optional COMING SOON tag. */
function PlanFeatureRow({ feature, accent }: { feature: PlanFeature; accent: 'forest' | 'gold' }) {
  return (
    <div className="flex items-start gap-2.5">
      <NeuIconDisc
        gradient={accent === 'gold' ? NEU_GRADIENTS.gold : NEU_GRADIENTS.sage}
        icon={Check}
        size={20}
        style={{ marginTop: 1 }}
      />
      <span className="flex-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[13px]" style={{ color: NEU.ink, fontFamily: OUTFIT, fontWeight: 600, lineHeight: 1.5 }}>
          {feature.text}
        </span>
        {feature.comingSoon && (
          <span
            style={{
              fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em',
              color: NEU.muted, backgroundColor: NEU.base, boxShadow: NEU.inSm,
              padding: '2.5px 7px', borderRadius: 999, whiteSpace: 'nowrap',
            }}
          >
            COMING SOON
          </span>
        )}
      </span>
    </div>
  );
}

const FREE_FEATURES: PlanFeature[] = [
  { text: 'Apply to any conference' },
  { text: 'Committee sessions, documents and placards' },
  { text: 'Delegation tools and Q&A with organizers' },
  { text: 'Pay per application with Gavelling credits' },
];

const PRO_FEATURES: PlanFeature[] = [
  { text: '1 Gavelling credit every month' },
  { text: 'Archive of past conferences', comingSoon: true },
  { text: 'Upcoming conferences tools', comingSoon: true },
];

const UNLIMITED_FEATURES: PlanFeature[] = [
  { text: 'Unlimited Gavelling credits — never think about it' },
  { text: 'Your MUN historical statistics', comingSoon: true },
  { text: 'Unlimited email builder use as a conference organizer', comingSoon: true },
  { text: 'Premium job board opportunities', comingSoon: true },
];

export default function UnlimitedPage() {
  const { user, session, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  // ── "Buy credits mid-apply, come back" round trip ─────────────────────────
  // ?returnTo arrives once, on the very first navigation here from
  // goBuyCredits — persist it to localStorage so it survives however many
  // Stripe redirects the buyer's chosen purchase button goes through.
  const [returnBannerVisible, setReturnBannerVisible] = useState(false);

  useEffect(() => {
    const returnTo = new URLSearchParams(window.location.search).get('returnTo');
    if (!returnTo) return;
    try {
      localStorage.setItem(RETURN_TO_KEY, returnTo);
    } catch { /* ignore */ }
    if (isInternalPath(returnTo)) setReturnBannerVisible(true);
  }, []);

  /** Called once an entitlement (subscription or credit purchase) is
   *  confirmed. Redirects back to the saved returnTo and clears it; returns
   *  false (does nothing) when there's no valid one, so the caller falls
   *  back to its normal "stay on this page" behavior. */
  function tryReturnTo(): boolean {
    let returnTo: string | null = null;
    try {
      returnTo = localStorage.getItem(RETURN_TO_KEY);
    } catch {
      return false;
    }
    if (!isInternalPath(returnTo)) return false;
    try { localStorage.removeItem(RETURN_TO_KEY); } catch { /* ignore */ }
    router.replace(returnTo);
    return true;
  }

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
          tryReturnTo();
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

  const [busy, setBusy] = useState<'monthly' | 'yearly' | 'pro' | null>(null);
  const [purchaseError, setPurchaseError] = useState('');
  const proPrice = proPricing(geoCountry);

  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState('');

  async function handleManageSubscription() {
    if (portalBusy) return;
    setPortalBusy(true);
    setPortalError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setPortalBusy(false);
      setPortalError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-billing-portal');
    if (error) {
      setPortalBusy(false);
      setPortalError(await extractFunctionErrorMessage(error));
      return;
    }
    const result = data as { ok?: boolean; url?: string; error?: string } | null;
    if (!result?.ok || !result.url) {
      setPortalBusy(false);
      setPortalError(result?.error || 'Could not open the billing portal. Please try again.');
      return;
    }
    window.location.assign(result.url);
  }

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

  async function startProCheckout() {
    if (busy) return;
    setBusy('pro');
    setPurchaseError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setBusy(null);
      setPurchaseError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
      body: { kind: 'pro_monthly', ...(geoCountry ? { country: geoCountry } : {}) },
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

  // ── Gavelling credits: balance (shared header hook) + expiry breakdown ────
  const { balance: creditBalance, loading: creditBalanceLoading, refresh: refreshCredits } = useCredits();

  interface CreditLot { remaining: number; source: string; expires_at: string | null }
  const [creditLots, setCreditLots] = useState<CreditLot[]>([]);
  const [creditLotsLoaded, setCreditLotsLoaded] = useState(false);

  const fetchCreditLots = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('credit_lots')
      .select('remaining, source, expires_at')
      .gt('remaining', 0);
    setCreditLots((data as CreditLot[] | null) ?? []);
    setCreditLotsLoaded(true);
  }, [user?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchCreditLots(); }, [fetchCreditLots]);

  const permanentCredits = creditLots.filter(l => !l.expires_at).reduce((n, l) => n + l.remaining, 0);
  const expiringLots = creditLots
    .filter((l): l is CreditLot & { expires_at: string } => !!l.expires_at)
    .sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  const expiringCredits = expiringLots.reduce((n, l) => n + l.remaining, 0);
  const soonestExpiry = expiringLots[0]?.expires_at ?? null;

  // ?credits=success|cancelled, the redirect back from create-credit-checkout.
  // Success polls credit_balance() directly (every 2s, up to 12s, mirrors the
  // ?unlimited=success confirm loop above); cancelled just strips the param.
  const [creditsConfirming, setCreditsConfirming] = useState(false);
  const [creditsConfirmTimedOut, setCreditsConfirmTimedOut] = useState(false);

  useEffect(() => {
    if (!user || !session) return;
    const creditsParam = new URLSearchParams(window.location.search).get('credits');
    if (creditsParam !== 'success' && creditsParam !== 'cancelled') return;
    let cancelled = false;
    if (creditsParam === 'success') {
      setCreditsConfirming(true);
      const supabase = getAuthedClient(session.access_token);
      const startingBalance = creditBalance;
      let attempts = 0;
      const tick = async () => {
        attempts++;
        const { data } = await supabase.rpc('credit_balance');
        if (cancelled) return;
        const newBalance = typeof data === 'number' ? data : null;
        if (newBalance !== null && newBalance !== startingBalance) {
          refreshCredits();
          fetchCreditLots();
          fetchSubscription();
          setCreditsConfirming(false);
          tryReturnTo();
          return;
        }
        if (attempts >= 6) {
          setCreditsConfirming(false);
          setCreditsConfirmTimedOut(true);
          refreshCredits();
          fetchCreditLots();
          fetchSubscription();
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

  // ── Buy credits, a simple quantity stepper ────────────────────────────────
  const [buyQty, setBuyQty] = useState(1);
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyError, setBuyError] = useState('');
  const creditPrice = creditPricing(geoCountry);
  const buyTotal = Math.round(creditPrice.each * buyQty * 100) / 100;

  async function handleBuyCredits() {
    if (buyBusy) return;
    setBuyBusy(true);
    setBuyError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setBuyBusy(false);
      setBuyError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
      body: { kind: 'credits', quantity: buyQty, ...(geoCountry ? { country: geoCountry } : {}) },
    });
    if (error) {
      setBuyBusy(false);
      setBuyError(await extractFunctionErrorMessage(error));
      return;
    }
    const result = data as { ok?: boolean; url?: string; error?: string } | null;
    if (!result?.ok || !result.url) {
      setBuyBusy(false);
      setBuyError(result?.error || 'Could not start checkout. Please try again.');
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
        text: `Unlimited unlocked for your next ${granted} conference${granted === 1 ? '' : 's'}. No credits needed while it's active.`,
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
  const isUnlimitedPlan = !!subscription && subscription.plan.startsWith('unlimited');
  const isProPlan = subscription?.plan === 'pro_monthly';

  return (
    <div>
      <Eyebrow className="mb-2">Credits</Eyebrow>
      <h1
        className="font-black text-[26px] mb-1"
        style={{ color: NEU.ink, fontFamily: OUTFIT, letterSpacing: '-0.01em' }}
      >
        Credits &amp; Subscription
      </h1>
      <p className="text-sm mb-8" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.6, maxWidth: 560 }}>
        Gavelling credits cover applying to conferences. Buy them as you go, get one free every month with Pro, or go Unlimited and never think about it.
      </p>

      {returnBannerVisible && (
        <div
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3 mb-6"
          style={{
            background: 'linear-gradient(150deg, rgba(238,217,138,0.32), rgba(182,135,31,0.14))',
            border: '1.5px solid rgba(182,135,31,0.4)',
          }}
        >
          <ArrowLeft size={15} strokeWidth={2.4} style={{ color: NEU.deepGold, flexShrink: 0 }} />
          <p className="text-sm font-semibold" style={{ color: '#7A5A20', fontFamily: OUTFIT, lineHeight: 1.5 }}>
            Add a credit to finish your application — we&apos;ll take you right back.
          </p>
        </div>
      )}

      {/* ── Your credits — balance, expiry breakdown, buy control ── */}
      <GlassCard className="!p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="flex items-start gap-4">
            <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Coins} size={48} />
            <div>
              <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.2em', color: NEU.muted, marginBottom: 4 }}>
                YOUR CREDITS
              </p>
              <p className="font-black text-[34px] leading-none" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                {creditBalanceLoading || creditBalance === null ? '—' : creditBalance}
              </p>
              {creditLotsLoaded && (permanentCredits > 0 || expiringCredits > 0) && (
                <p className="text-xs mt-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                  {permanentCredits} permanent
                  {expiringCredits > 0 && soonestExpiry ? ` · ${expiringCredits} expire ${formatExpiry(soonestExpiry)}` : ''}
                </p>
              )}
              <p className="text-[11px] mt-1.5" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.6, maxWidth: 340 }}>
                Purchased credits never expire. Credits included with a subscription refresh monthly and don&apos;t roll over.
              </p>
              {creditsConfirming ? (
                <div className="flex items-center gap-2 mt-2.5">
                  <Loader2 size={14} strokeWidth={2.4} className="animate-spin" style={{ color: NEU.deepGold }} />
                  <p className="text-xs font-semibold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                    Confirming your purchase…
                  </p>
                </div>
              ) : creditsConfirmTimedOut ? (
                <p className="text-xs mt-2.5" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.6 }}>
                  Payment received. Your credits will appear here within a minute.
                </p>
              ) : null}
            </div>
          </div>

          {/* Buy credits, quantity stepper + live total */}
          <div className="flex flex-col gap-2.5" style={{ minWidth: 220 }}>
            <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.14em', color: NEU.muted }}>
              BUY CREDITS
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full" style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm, padding: '4px' }}>
                <button
                  type="button"
                  onClick={() => setBuyQty(q => Math.max(1, q - 1))}
                  disabled={buyBusy || buyQty <= 1}
                  className="flex items-center justify-center rounded-full focus:outline-none"
                  style={{ width: 26, height: 26, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: buyBusy || buyQty <= 1 ? 'default' : 'pointer', opacity: buyBusy || buyQty <= 1 ? 0.5 : 1 }}
                >
                  <Minus size={13} strokeWidth={2.6} style={{ color: NEU.ink }} />
                </button>
                <span className="text-center font-bold text-sm" style={{ width: 28, fontFamily: OUTFIT, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {buyQty}
                </span>
                <button
                  type="button"
                  onClick={() => setBuyQty(q => Math.min(20, q + 1))}
                  disabled={buyBusy || buyQty >= 20}
                  className="flex items-center justify-center rounded-full focus:outline-none"
                  style={{ width: 26, height: 26, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: buyBusy || buyQty >= 20 ? 'default' : 'pointer', opacity: buyBusy || buyQty >= 20 ? 0.5 : 1 }}
                >
                  <Plus size={13} strokeWidth={2.6} style={{ color: NEU.ink }} />
                </button>
              </div>
              <span className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                {formatFee(creditPrice.each, creditPrice.currency)} each
              </span>
            </div>
            <NeuButton
              gradient={NEU_GRADIENTS.gold}
              disabled={buyBusy}
              onClick={handleBuyCredits}
              style={{ width: '100%' }}
            >
              {buyBusy ? 'STARTING CHECKOUT…' : `BUY FOR ${formatFee(buyTotal, creditPrice.currency)}`}
            </NeuButton>
            {buyError && (
              <p className="text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                {buyError}
              </p>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Free / Pro / Unlimited tiers */}
      <Eyebrow className="mb-3">Plans</Eyebrow>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-3 items-stretch">
        {/* FREE card, quieter */}
        <NeuCard style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column' }}>
          <NeuIconDisc gradient={NEU_GRADIENTS.sage} icon={Ticket} size={44} />
          <h2 className="font-black text-lg mt-4 mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Free
          </h2>
          <p className="text-[13px] mb-5" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.6 }}>
            Apply with credits · full platform access.
          </p>

          <div className="flex flex-col gap-3.5 flex-1">
            {FREE_FEATURES.map(f => <PlanFeatureRow key={f.text} feature={f} accent="forest" />)}
          </div>

          <div className="mt-6">
            {!active && <NeuPill>CURRENT PLAN</NeuPill>}
          </div>
        </NeuCard>

        {/* PRO card */}
        <NeuCard style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column' }}>
          <NeuIconDisc gradient={NEU_GRADIENTS.amber} icon={Coins} size={44} />
          <h2 className="font-black text-lg mt-4 mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Gavelling Pro
          </h2>
          <p className="text-[13px] mb-5" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.6 }}>
            {formatFee(proPrice.monthly, proPrice.currency)}/mo — 1 credit every month + archive &amp; upcoming tools.
          </p>

          <div className="flex flex-col gap-3.5 flex-1">
            {PRO_FEATURES.map(f => <PlanFeatureRow key={f.text} feature={f} accent="forest" />)}
          </div>

          <div className="mt-6">
            {isProPlan ? (
              <div className="flex flex-col gap-2 items-start">
                <NeuPill active gradient={NEU_GRADIENTS.green}>
                  <Check size={11} strokeWidth={2.6} /> ACTIVE
                </NeuPill>
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={portalBusy}
                  className="text-xs font-semibold focus:outline-none"
                  style={{
                    color: NEU.muted, fontFamily: OUTFIT, background: 'none', border: 'none', padding: 0,
                    textDecoration: 'underline', cursor: portalBusy ? 'default' : 'pointer',
                  }}
                  onMouseEnter={(e) => { if (!portalBusy) (e.currentTarget as HTMLElement).style.color = NEU.forest; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
                >
                  {portalBusy ? 'OPENING…' : 'MANAGE SUBSCRIPTION'}
                </button>
                {portalError && (
                  <p className="text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                    {portalError}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <NeuButton
                  gradient={NEU_GRADIENTS.amber}
                  disabled={busy !== null}
                  onClick={startProCheckout}
                  style={{ width: '100%' }}
                >
                  {busy === 'pro' ? 'STARTING CHECKOUT…' : `${formatFee(proPrice.monthly, proPrice.currency)} A MONTH`}
                </NeuButton>
                {purchaseError && (
                  <p className="text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                    {purchaseError}
                  </p>
                )}
              </div>
            )}
          </div>
        </NeuCard>

        {/* UNLIMITED card, hero treatment, gold accent */}
        <NeuCard
          style={{
            padding: '26px 24px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: `0 0 0 2px rgba(182,135,31,0.5), ${NEU.out}`,
          }}
        >
          <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Sparkles} size={44} />
          <h2 className="font-black text-lg mt-4 mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Gavelling Unlimited
          </h2>
          <p className="text-[13px] mb-5" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.6 }}>
            Unlimited credits — never think about it.
          </p>

          <div className="flex flex-col gap-3.5 flex-1">
            {UNLIMITED_FEATURES.map(f => <PlanFeatureRow key={f.text} feature={f} accent="gold" />)}
          </div>

          <div className="mt-6">
            {confirming ? (
              <div className="flex items-center gap-3">
                <Loader2 size={18} strokeWidth={2.2} className="animate-spin" style={{ color: NEU.deepGold }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                    Confirming your purchase…
                  </p>
                  <p className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>This usually takes a few seconds.</p>
                </div>
              </div>
            ) : isUnlimitedPlan && subscription!.plan === 'unlimited_trial' ? (
              <div className="flex flex-col gap-2.5 items-start" style={{ width: '100%' }}>
                <NeuPill active gradient={NEU_GRADIENTS.green}>
                  <Check size={11} strokeWidth={2.6} /> ACTIVE
                </NeuPill>
                <p className="text-xs font-semibold" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                  {subscription!.current_period_end
                    ? `Free trial, ${trialDaysLeft(subscription!.current_period_end)} day${trialDaysLeft(subscription!.current_period_end) === 1 ? '' : 's'} left`
                    : 'Free trial'}
                </p>
                {subscription!.current_period_end && (
                  <p className="text-[11px]" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.5 }}>
                    Your trial ends {formatExpiry(subscription!.current_period_end)}. Subscribe any time to keep Unlimited.
                  </p>
                )}
                <NeuButton
                  gradient={NEU_GRADIENTS.gold}
                  disabled={busy !== null}
                  onClick={() => startCheckout('monthly')}
                  style={{ width: '100%', padding: '8px 16px', fontSize: 11.5 }}
                >
                  {busy === 'monthly' ? 'STARTING CHECKOUT…' : 'SUBSCRIBE TO KEEP IT'}
                </NeuButton>
                {purchaseError && (
                  <p className="text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                    {purchaseError}
                  </p>
                )}
              </div>
            ) : isUnlimitedPlan ? (
              <div className="flex flex-col gap-2 items-start">
                <NeuPill active gradient={NEU_GRADIENTS.green}>
                  <Check size={11} strokeWidth={2.6} /> ACTIVE
                </NeuPill>
                <p className="text-xs font-semibold" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                  {planLabel(subscription!)}
                </p>
                {subscription!.plan === 'unlimited_monthly' && (
                  <button
                    type="button"
                    onClick={handleManageSubscription}
                    disabled={portalBusy}
                    className="text-xs font-semibold focus:outline-none"
                    style={{
                      color: NEU.muted, fontFamily: OUTFIT, background: 'none', border: 'none', padding: 0,
                      textDecoration: 'underline', cursor: portalBusy ? 'default' : 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!portalBusy) (e.currentTarget as HTMLElement).style.color = NEU.forest; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
                  >
                    {portalBusy ? 'OPENING…' : 'MANAGE SUBSCRIPTION'}
                  </button>
                )}
                {portalError && (
                  <p className="text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                    {portalError}
                  </p>
                )}
              </div>
            ) : confirmTimedOut ? (
              <p className="text-[13px]" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.6 }}>
                Payment received. Unlimited will activate here within a minute.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                <NeuButton
                  gradient={NEU_GRADIENTS.gold}
                  disabled={busy !== null}
                  onClick={() => startCheckout('monthly')}
                  style={{ width: '100%' }}
                >
                  {busy === 'monthly' ? 'STARTING CHECKOUT…' : monthlyLabel(price)}
                </NeuButton>
                <NeuButton
                  gradient={NEU_GRADIENTS.forest}
                  disabled={busy !== null}
                  onClick={() => startCheckout('yearly')}
                  style={{ width: '100%', background: busy !== null ? undefined : 'transparent', border: `1.5px solid ${busy !== null ? 'rgba(154,138,120,0.3)' : 'rgba(27,56,40,0.35)'}`, color: busy !== null ? NEU.muted : NEU.forest }}
                >
                  {busy === 'yearly' ? 'STARTING CHECKOUT…' : annualLabel(price)}
                </NeuButton>
                {purchaseError && (
                  <p className="text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                    {purchaseError}
                  </p>
                )}
              </div>
            )}
          </div>
        </NeuCard>
      </div>
      {/* Ambassador status + subscription voucher redemption */}
      <Eyebrow className="mb-3">Ambassador &amp; Vouchers</Eyebrow>
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
              AMBASSADOR STATUS — ALWAYS COVERED
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
              {unlimitedRemaining} conference{unlimitedRemaining === 1 ? '' : 's'} of Unlimited remaining
            </span>
          )}
        </div>
        <p className="text-xs mb-3" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.65 }}>
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
                border: 'none', backgroundColor: 'transparent', color: NEU.ink,
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
        <Sparkles size={16} strokeWidth={2} style={{ color: NEU.muted, flexShrink: 0 }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Gavelling Points: {balance}
          </p>
          <p className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            Rewards are coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
