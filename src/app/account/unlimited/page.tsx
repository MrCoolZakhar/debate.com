'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Crown, Infinity as InfinityIcon, Check, Ticket, ArrowRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { extractFunctionErrorMessage, unlimitedPricing } from '@/lib/payments';
import { formatFee } from '@/lib/finance';
import { Eyebrow, GlassCard, OUTFIT } from '../accountUi';
import { NEU, NeuInset } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';

interface OrgConference {
  id: string;
  slug: string;
  acronym: string;
  full_name: string;
  logo_url: string | null;
  country: string;
}

interface SubscriptionRow {
  conference_id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function planLabel(sub: SubscriptionRow): string {
  if (sub.plan === 'unlimited_monthly') return 'Monthly plan';
  return sub.current_period_end ? `Yearly pass, valid until ${formatExpiry(sub.current_period_end)}` : 'Yearly pass';
}

export default function UnlimitedPage() {
  const { user, session, profile, loading: authLoading } = useAuth();

  // ── Purchase surface: every conference the viewer organizes ──────────────
  const [conferences, setConferences] = useState<OrgConference[] | null>(null);
  const [subsByConference, setSubsByConference] = useState<Record<string, SubscriptionRow>>({});
  const [busy, setBusy] = useState<{ conferenceId: string; plan: 'monthly' | 'yearly' } | null>(null);
  const [purchaseErrors, setPurchaseErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const userId = user.id;
    const CONF = 'id, slug, acronym, full_name, logo_url, country';

    (async () => {
      const [ownedRes, orgRes] = await Promise.all([
        supabase.from('conferences').select(CONF).eq('organizer_id', userId),
        supabase.from('conference_organizers').select(`conferences (${CONF})`).eq('user_id', userId),
      ]);

      const byId = new Map<string, OrgConference>();
      for (const c of (ownedRes.data ?? []) as OrgConference[]) byId.set(c.id, c);
      for (const row of (orgRes.data ?? []) as { conferences: OrgConference | OrgConference[] | null }[]) {
        const c = Array.isArray(row.conferences) ? row.conferences[0] : row.conferences;
        if (c) byId.set(c.id, c);
      }
      const list = Array.from(byId.values()).sort((a, b) => a.acronym.localeCompare(b.acronym));
      setConferences(list);

      if (list.length > 0) {
        const { data: subsData } = await supabase
          .from('subscriptions')
          .select('conference_id, plan, status, current_period_end')
          .in('conference_id', list.map(c => c.id))
          .in('status', ['active', 'trialing'])
          .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`);
        const map: Record<string, SubscriptionRow> = {};
        for (const s of (subsData as SubscriptionRow[] | null) ?? []) map[s.conference_id] = s;
        setSubsByConference(map);
      } else {
        setSubsByConference({});
      }
    })();
  }, [authLoading, user?.id, session?.access_token]);

  async function startCheckout(conferenceId: string, plan: 'monthly' | 'yearly') {
    if (busy) return;
    setBusy({ conferenceId, plan });
    setPurchaseErrors(prev => ({ ...prev, [conferenceId]: '' }));
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setBusy(null);
      setPurchaseErrors(prev => ({ ...prev, [conferenceId]: 'Your session has expired, please refresh and sign in again.' }));
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
      body: { conferenceId, plan },
    });
    if (error) {
      setBusy(null);
      setPurchaseErrors(prev => ({ ...prev, [conferenceId]: '' }));
      const msg = await extractFunctionErrorMessage(error);
      setPurchaseErrors(prev => ({ ...prev, [conferenceId]: msg }));
      return;
    }
    const result = data as { ok?: boolean; url?: string; error?: string } | null;
    if (!result?.ok || !result.url) {
      setBusy(null);
      setPurchaseErrors(prev => ({ ...prev, [conferenceId]: result?.error || 'Could not start checkout. Please try again.' }));
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

  if (authLoading || conferences === null) {
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
        Your delegates skip the 5 percent Gavelling platform fee on their own registrations. Card processing still applies.
      </p>

      {/* Purchase surface */}
      <Eyebrow className="mb-3">Your Conferences</Eyebrow>
      {conferences.length === 0 ? (
        <GlassCard className="text-center !py-10 mb-10">
          <p className="text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.7 }}>
            Unlimited applies to conferences you organize. Create or join an organizing team first.
          </p>
          <Link
            href="/conferences"
            className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold"
            style={{ color: '#1B3828', fontFamily: OUTFIT, letterSpacing: '0.06em', textDecoration: 'none' }}
          >
            EXPLORE CONFERENCES <ArrowRight size={13} strokeWidth={2.5} />
          </Link>
        </GlassCard>
      ) : (
        <>
          <div className="flex flex-col gap-3 mb-3">
            {conferences.map(conf => {
              const sub = subsByConference[conf.id];
              const price = unlimitedPricing(conf.country);
              const rowBusy = busy?.conferenceId === conf.id ? busy.plan : null;
              const err = purchaseErrors[conf.id];
              return (
                <GlassCard key={conf.id} className="!p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <LogoDisc src={conf.logo_url} alt={conf.acronym} size={40} fallbackText={conf.acronym.slice(0, 3)} />
                    <div className="flex-1 min-w-[160px]">
                      <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{conf.acronym}</p>
                      <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{conf.full_name}</p>
                    </div>

                    {sub ? (
                      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold"
                          style={{ backgroundColor: 'rgba(61,122,82,0.14)', border: '1px solid rgba(61,122,82,0.4)', color: '#2A5A3C', fontFamily: OUTFIT, letterSpacing: '0.08em' }}
                        >
                          <Check size={11} strokeWidth={2.6} /> ACTIVE
                        </span>
                        <span className="text-xs font-semibold" style={{ color: '#6E5F4E', fontFamily: OUTFIT }}>
                          {planLabel(sub)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                        <button
                          onClick={() => startCheckout(conf.id, 'monthly')}
                          disabled={busy !== null}
                          className="rounded-full px-3.5 py-1.5 text-xs font-extrabold focus:outline-none"
                          style={{
                            border: 'none', fontFamily: OUTFIT, letterSpacing: '0.05em',
                            background: busy !== null ? 'rgba(27,56,40,0.14)' : NEU.forest,
                            color: busy !== null ? NEU.muted : NEU.gold,
                            cursor: busy !== null ? 'default' : 'pointer',
                          }}
                        >
                          {rowBusy === 'monthly' ? 'STARTING CHECKOUT…' : `GO UNLIMITED · ${formatFee(price.monthly, price.currency)}/MONTH`}
                        </button>
                        <button
                          onClick={() => startCheckout(conf.id, 'yearly')}
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
                          {rowBusy === 'yearly' ? 'STARTING CHECKOUT…' : `PAY YEARLY · ${formatFee(price.yearly, price.currency)}`}
                        </button>
                      </div>
                    )}
                  </div>
                  {err && (
                    <p className="mt-2.5 text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                      {err}
                    </p>
                  )}
                </GlassCard>
              );
            })}
          </div>
          <p className="text-xs mb-10" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.6 }}>
            Applies to each delegate&apos;s own registration fee. Delegation spot purchases keep the standard service fee.
          </p>
        </>
      )}

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
