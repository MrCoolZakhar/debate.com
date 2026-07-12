'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Minus, Settings, Trophy, Award, ArrowUpRight, ArrowDownRight, Ticket, Crown, Infinity as InfinityIcon, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { Eyebrow, GlassCard, Pill, OUTFIT, MONO } from '../accountUi';
import { NEU, NeuInset } from '@/components/neu';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

interface LedgerEntry {
  id: string;
  amount: number;
  balance_after: number;
  type: string;
  description: string;
  created_at: string;
}

function getTransactionStyle(type: string): { Icon: React.ElementType; color: string; bg: string } {
  if (type.startsWith('earned_'))    return { Icon: TrendingUp,  color: '#3D7A52', bg: 'rgba(61,122,82,0.1)' };
  if (type === 'purchased')          return { Icon: ShoppingBag, color: '#B6871F', bg: 'rgba(182,135,31,0.1)' };
  if (type.startsWith('spent_'))     return { Icon: Minus,       color: '#8B2020', bg: 'rgba(139,32,32,0.08)' };
  return                                    { Icon: Settings,    color: '#9A8A78', bg: 'rgba(154,138,120,0.1)' };
}

// Each earn route carries a saturated accent so the trio reads as an escalation
// (gold honour → forest participation → amber purchase) rather than three flat
// muted tiles — matching the CV disc language.
const EARN_CARDS = [
  { Icon: Trophy, title: 'Attend a paid conference', desc: 'Earn points when you participate in a paid Gavelling conference session.', soon: false, accent: '#B6871F' },
  { Icon: Award,  title: 'Receive an award',        desc: 'Bonus points for Best Delegate, Outstanding Delegate, and other awards.', soon: false, accent: '#2A5A3C' },
  { Icon: ShoppingBag, title: 'Purchase points',    desc: 'Buy points directly to spend on merchandise, courses, and fee waivers.', soon: true,  accent: '#B8844A' },
];

// Group ledger rows under month sub-headers so the wall breaks up.
function monthKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { month: 'long', year: 'numeric' });
}

export default function PointsPage() {
  const { user, session, profile, loading: authLoading } = useAuth();
  const [ledger, setLedger]   = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
      .from('points_ledger')
      .select('id, amount, balance_after, type, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLedger((data as LedgerEntry[]) ?? []);
        setLoading(false);
      });

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
        text: `Unlimited unlocked for your next ${granted} conference${granted === 1 ? '' : 's'} — the 5% Gavelling fee is waived automatically at checkout.`,
      });
    } else {
      setRedeemResult({ ok: true, text: 'Code redeemed successfully.' });
    }
    setRedeemCode('');
  }

  if (loading) {
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
  const isUnlimited = profile?.unlimited_status && profile.unlimited_status !== 'none';

  // Lifetime earned vs spent, for the summary medallions + split bar.
  const earnedTotal = ledger.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const spentTotal  = ledger.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  const flowTotal   = earnedTotal + spentTotal;
  const earnedPct   = flowTotal > 0 ? (earnedTotal / flowTotal) * 100 : 100;

  // Group ledger rows by month, preserving newest-first order.
  const groupedLedger: { key: string; entries: LedgerEntry[] }[] = [];
  for (const entry of ledger) {
    const key = monthKey(entry.created_at);
    const last = groupedLedger[groupedLedger.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groupedLedger.push({ key, entries: [entry] });
  }

  return (
    <div>
      <Eyebrow className="mb-2">Rewards</Eyebrow>
      <h1
        className="font-black text-[26px] mb-1"
        style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '-0.01em' }}
      >
        Gavelling Points
      </h1>
      <p className="text-sm mb-8" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Earn points by participating in conferences. Spend them on rewards.
      </p>

      {/* Balance hero card */}
      <div
        className="relative rounded-[20px] p-8 mb-6 text-center overflow-hidden"
        style={{ backgroundColor: '#1B3828', border: '1.5px solid rgba(238,217,138,0.4)', boxShadow: '0 16px 44px rgba(27,56,40,0.3)' }}
      >
        {/* Grain overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: GRAIN,
            backgroundRepeat: 'repeat',
            backgroundSize: '300px 300px',
            mixBlendMode: 'multiply',
            opacity: 0.18,
          }}
        />
        {/* Soft gold glow */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: '-60px', left: '50%', transform: 'translateX(-50%)',
            width: '340px', height: '180px', borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(238,217,138,0.14), transparent)',
          }}
        />
        <div className="relative z-10">
          <p
            className="mb-2"
            style={{ color: 'rgba(238,217,138,0.65)', fontFamily: MONO, fontSize: '9px', letterSpacing: '0.26em' }}
          >
            YOUR BALANCE
          </p>
          <p
            className="font-black"
            style={{ color: '#EED98A', fontFamily: MONO, fontSize: '60px', lineHeight: 1 }}
          >
            {balance.toLocaleString()}
          </p>
          <p
            className="mt-2"
            style={{ color: 'rgba(238,217,138,0.5)', fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em' }}
          >
            GAVELLING POINTS
          </p>
          {isUnlimited && (
            <div className="flex justify-center mt-4">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: 'rgba(238,217,138,0.14)',
                  border: '1px solid rgba(238,217,138,0.35)',
                  color: '#EED98A',
                  fontFamily: OUTFIT,
                }}
              >
                ✦ Unlimited Member
              </span>
            </div>
          )}
        </div>
      </div>

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
              AMBASSADOR — GAVELLING FEE WAIVED, ALWAYS
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
          Have a Gavelling code? Redeem it here — subscription codes are single-use per account.
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

      {/* How to earn */}
      <Eyebrow className="mb-3">How to Earn</Eyebrow>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
        {EARN_CARDS.map((card) => (
          <GlassCard
            key={card.title}
            className="!p-5"
            style={{ borderColor: `${card.accent}44`, boxShadow: `0 1px 3px rgba(27,56,40,0.07), 0 12px 32px ${card.accent}14` }}
          >
            <span
              className="flex items-center justify-center mb-3"
              style={{
                width: '38px', height: '38px', borderRadius: '11px',
                background: `linear-gradient(150deg, ${card.accent}22, ${card.accent}10)`,
                border: `1px solid ${card.accent}55`,
              }}
            >
              <card.Icon size={18} strokeWidth={2} style={{ color: card.accent }} />
            </span>
            <p className="font-semibold text-sm mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              {card.title}
            </p>
            <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.65 }}>
              {card.desc}
            </p>
            {card.soon && (
              <div className="mt-3">
                <Pill tone="amber" size="sm">Coming soon</Pill>
              </div>
            )}
          </GlassCard>
        ))}
      </div>

      {/* Earned vs spent summary — show, don't list */}
      {ledger.length > 0 && (
        <>
          <Eyebrow className="mb-3">Lifetime Flow</Eyebrow>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Earned medallion */}
            <div
              className="rounded-[16px] p-4 flex items-center gap-3"
              style={{
                backgroundColor: 'rgba(61,122,82,0.08)',
                border: '1.5px solid rgba(61,122,82,0.3)',
                boxShadow: '0 1px 3px rgba(27,56,40,0.05), 0 8px 22px rgba(27,56,40,0.06)',
              }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'linear-gradient(150deg, rgba(61,122,82,0.22), rgba(61,122,82,0.1))', border: '1px solid rgba(61,122,82,0.4)' }}
              >
                <ArrowUpRight size={20} strokeWidth={2.2} style={{ color: '#3D7A52' }} />
              </span>
              <div className="min-w-0">
                <p className="font-black leading-none" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: '24px' }}>
                  {earnedTotal.toLocaleString()}
                </p>
                <p className="mt-1" style={{ color: '#3D7A52', fontFamily: OUTFIT, fontSize: '12px', fontWeight: 600 }}>
                  Earned
                </p>
              </div>
            </div>
            {/* Spent medallion */}
            <div
              className="rounded-[16px] p-4 flex items-center gap-3"
              style={{
                backgroundColor: 'rgba(139,32,32,0.06)',
                border: '1.5px solid rgba(139,32,32,0.28)',
                boxShadow: '0 1px 3px rgba(27,56,40,0.05), 0 8px 22px rgba(27,56,40,0.06)',
              }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'linear-gradient(150deg, rgba(139,32,32,0.2), rgba(139,32,32,0.08))', border: '1px solid rgba(139,32,32,0.35)' }}
              >
                <ArrowDownRight size={20} strokeWidth={2.2} style={{ color: '#8B2020' }} />
              </span>
              <div className="min-w-0">
                <p className="font-black leading-none" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: '24px' }}>
                  {spentTotal.toLocaleString()}
                </p>
                <p className="mt-1" style={{ color: '#8B2020', fontFamily: OUTFIT, fontSize: '12px', fontWeight: 600 }}>
                  Spent
                </p>
              </div>
            </div>
          </div>
          {/* Split bar */}
          <div
            className="flex overflow-hidden mb-10"
            style={{ height: '8px', borderRadius: '9999px', backgroundColor: 'rgba(139,32,32,0.14)' }}
            title={`${earnedTotal} earned · ${spentTotal} spent`}
          >
            <div style={{ width: `${earnedPct}%`, backgroundColor: '#3D7A52', transition: 'width 300ms ease' }} />
          </div>
        </>
      )}

      {/* Transaction history */}
      <Eyebrow className="mb-3">Transaction History</Eyebrow>

      {ledger.length === 0 ? (
        <GlassCard className="text-center !py-12">
          <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            No transactions yet
          </p>
          <p className="text-xs mt-1" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Attend a paid conference to earn your first points.
          </p>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedLedger.map(group => (
            <div key={group.key}>
              <p
                className="mb-2 px-1"
                style={{ color: '#9A8A78', fontFamily: MONO, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase' }}
              >
                {group.key}
              </p>
              <GlassCard className="!p-2 md:!p-2.5">
                {group.entries.map((entry, i) => {
                  const { Icon, color, bg } = getTransactionStyle(entry.type);
                  const isPositive = entry.amount > 0;
                  const amountStr  = isPositive ? `+${entry.amount}` : `${entry.amount}`;
                  const amountColor = isPositive ? '#3D7A52' : '#8B2020';
                  const edge = isPositive ? '#3D7A52' : '#8B2020';
                  const date = new Date(entry.created_at).toLocaleDateString('en', {
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <div
                      key={entry.id}
                      className="pr-3 py-2.5 flex items-center gap-3"
                      style={{
                        borderBottom: i < group.entries.length - 1 ? '1px solid rgba(221,212,192,0.5)' : 'none',
                        borderLeft: `3px solid ${edge}`,
                        paddingLeft: '12px',
                        borderRadius: '2px',
                      }}
                    >
                      <span
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: '30px', height: '30px', borderRadius: '9px', backgroundColor: bg }}
                      >
                        <Icon size={14} strokeWidth={2} style={{ color }} />
                      </span>
                      <p
                        className="text-sm font-medium flex-1 min-w-0 truncate"
                        style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}
                      >
                        {entry.description}
                      </p>
                      <span
                        className="font-bold text-sm flex-shrink-0"
                        style={{ color: amountColor, fontFamily: MONO }}
                      >
                        {amountStr}
                      </span>
                      <span
                        className="text-xs flex-shrink-0 hidden sm:inline"
                        style={{ color: '#9A8A78', fontFamily: MONO }}
                      >
                        {date}
                      </span>
                      <span
                        className="text-[10px] flex-shrink-0 hidden md:inline"
                        style={{ color: '#B3A896', fontFamily: MONO }}
                      >
                        bal {entry.balance_after}
                      </span>
                    </div>
                  );
                })}
              </GlassCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
