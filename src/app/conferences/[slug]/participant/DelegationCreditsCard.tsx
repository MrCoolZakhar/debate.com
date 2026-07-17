'use client';

// Delegation Credits, advisor-only. Lets the faculty advisor fund a shared
// credit pool their delegation applies against (see society_credit_balance /
// society_credit_covered_apps + create-credit-checkout's societyId param) —
// a delegate spending a pool credit never touches their own personal balance.
// Mirrors the buy-credits UI on src/app/account/unlimited/page.tsx, just
// scoped to this society instead of the viewer's personal account.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { extractFunctionErrorMessage, creditPricing } from '@/lib/payments';
import { formatFee } from '@/lib/utils';
import { SectionCard, OUTFIT } from './shared';

const MAX_QTY = 20;

export default function DelegationCreditsCard({ societyId }: { societyId: string }) {
  const { session } = useAuth();
  const router = useRouter();

  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  async function fetchBalance() {
    if (!session) return;
    const { data } = await getAuthedClient(session.access_token)
      .rpc('society_credit_balance', { p_society: societyId });
    setBalance(typeof data === 'number' ? data : null);
    setBalanceLoading(false);
  }

  useEffect(() => {
    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [societyId, session?.access_token]);

  // ?credits=success|cancelled, the redirect back from create-credit-checkout.
  // Success re-fetches the pool balance (the webhook has granted the society
  // lot by the time the buyer lands back here); cancelled just strips the param.
  useEffect(() => {
    if (!session) return;
    const creditsParam = new URLSearchParams(window.location.search).get('credits');
    if (creditsParam !== 'success' && creditsParam !== 'cancelled') return;
    if (creditsParam === 'success') {
      setConfirming(true);
      fetchBalance().finally(() => setConfirming(false));
    }
    router.replace(window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  // ── Purchase surface: the buyer's own country decides the region price ──
  const [geoCountry, setGeoCountry] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/geo')
      .then(r => r.json())
      .then(g => setGeoCountry((g?.countryCode as string | null) ?? null))
      .catch(() => {});
  }, []);
  const price = creditPricing(geoCountry);

  const [qty, setQty] = useState(1);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const total = Math.round(price.each * qty * 100) / 100;

  async function handleBuy() {
    if (buying) return;
    setBuying(true);
    setBuyError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setBuying(false);
      setBuyError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
      body: {
        kind: 'credits',
        quantity: qty,
        societyId,
        returnTo: window.location.pathname + window.location.search,
        ...(geoCountry ? { country: geoCountry } : {}),
      },
    });
    if (error) {
      setBuying(false);
      setBuyError(await extractFunctionErrorMessage(error));
      return;
    }
    const result = data as { ok?: boolean; url?: string; error?: string } | null;
    if (!result?.ok || !result.url) {
      setBuying(false);
      setBuyError(result?.error || 'Could not start checkout. Please try again.');
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <SectionCard>
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 12px 0' }}>
        DELEGATION CREDITS
      </p>

      <p className="font-black text-2xl mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
        {balanceLoading || balance === null ? '—' : balance}
      </p>
      <p className="text-xs mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.6 }}>
        Each credit lets one of your delegates apply to a conference without spending their own — unused credits never expire.
      </p>

      {confirming && (
        <p className="text-xs mb-3" style={{ color: '#B8844A', fontFamily: OUTFIT }}>
          Confirming your purchase…
        </p>
      )}

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-full" style={{ backgroundColor: '#EDE7D8', padding: 4 }}>
          <button
            type="button"
            onClick={() => setQty(q => Math.max(1, q - 1))}
            disabled={buying || qty <= 1}
            className="flex items-center justify-center rounded-full focus:outline-none"
            style={{ width: 26, height: 26, backgroundColor: '#FAF8F3', border: 'none', cursor: buying || qty <= 1 ? 'default' : 'pointer', opacity: buying || qty <= 1 ? 0.5 : 1 }}
          >
            <Minus size={13} strokeWidth={2.6} style={{ color: '#1C1410' }} />
          </button>
          <span className="text-center font-bold text-sm" style={{ width: 28, fontFamily: OUTFIT, color: '#1C1410', fontVariantNumeric: 'tabular-nums' }}>
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty(q => Math.min(MAX_QTY, q + 1))}
            disabled={buying || qty >= MAX_QTY}
            className="flex items-center justify-center rounded-full focus:outline-none"
            style={{ width: 26, height: 26, backgroundColor: '#FAF8F3', border: 'none', cursor: buying || qty >= MAX_QTY ? 'default' : 'pointer', opacity: buying || qty >= MAX_QTY ? 0.5 : 1 }}
          >
            <Plus size={13} strokeWidth={2.6} style={{ color: '#1C1410' }} />
          </button>
        </div>
        <span className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          {formatFee(price.each, price.currency)} each
        </span>
      </div>

      <button
        onClick={handleBuy}
        disabled={buying}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm transition-colors focus:outline-none"
        style={{
          backgroundColor: buying ? '#DDD4C0' : '#1B3828',
          color: buying ? '#9A8A78' : '#EED98A',
          fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', cursor: buying ? 'default' : 'pointer',
        }}
        onMouseEnter={e => { if (!buying) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
        onMouseLeave={e => { if (!buying) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
      >
        {buying ? 'STARTING CHECKOUT...' : `BUY FOR ${formatFee(total, price.currency)}`}
      </button>
      {buyError && (
        <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.6 }}>
          {buyError}
        </p>
      )}
    </SectionCard>
  );
}
