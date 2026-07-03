'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Minus, Settings, Trophy, Award } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { Eyebrow, GlassCard, OUTFIT, MONO } from '../accountUi';

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

const EARN_CARDS = [
  { Icon: Trophy, title: 'Attend a paid conference', desc: 'Earn points when you participate in a paid Gavelling conference session.', soon: false },
  { Icon: Award, title: 'Receive an award', desc: 'Bonus points for Best Delegate, Outstanding Delegate, and other awards.', soon: false },
  { Icon: ShoppingBag, title: 'Purchase points', desc: 'Buy points directly to spend on merchandise, courses, and fee waivers.', soon: true },
];

export default function PointsPage() {
  const { user, session, profile, loading: authLoading } = useAuth();
  const [ledger, setLedger]   = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [authLoading, user?.id, session?.access_token]);

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
        style={{ backgroundColor: '#1B3828', boxShadow: '0 16px 44px rgba(27,56,40,0.28)' }}
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

      {/* How to earn */}
      <Eyebrow className="mb-3">How to Earn</Eyebrow>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
        {EARN_CARDS.map((card) => (
          <GlassCard key={card.title} className="!p-5">
            <span
              className="flex items-center justify-center mb-3"
              style={{
                width: '34px', height: '34px', borderRadius: '10px',
                backgroundColor: 'rgba(27,56,40,0.08)', border: '1px solid rgba(27,56,40,0.18)',
              }}
            >
              <card.Icon size={16} strokeWidth={1.9} style={{ color: '#1B3828' }} />
            </span>
            <p className="font-semibold text-sm mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              {card.title}
            </p>
            <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.65 }}>
              {card.desc}
            </p>
            {card.soon && (
              <span
                className="inline-block rounded-full px-2 py-0.5 mt-2.5"
                style={{
                  backgroundColor: 'rgba(154,138,120,0.1)',
                  border: '1px solid rgba(154,138,120,0.25)',
                  color: '#9A8A78',
                  fontFamily: MONO,
                  fontSize: '8.5px',
                  letterSpacing: '0.12em',
                }}
              >
                COMING SOON
              </span>
            )}
          </GlassCard>
        ))}
      </div>

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
        <GlassCard className="!p-2 md:!p-3">
          {ledger.map((entry, i) => {
            const { Icon, color, bg } = getTransactionStyle(entry.type);
            const isPositive = entry.amount > 0;
            const amountStr  = isPositive ? `+${entry.amount}` : `${entry.amount}`;
            const amountColor = isPositive ? '#3D7A52' : '#8B2020';
            const date = new Date(entry.created_at).toLocaleDateString('en', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div
                key={entry.id}
                className="px-3 py-3 flex items-center gap-3"
                style={{ borderBottom: i < ledger.length - 1 ? '1px solid rgba(221,212,192,0.5)' : 'none' }}
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
                  style={{ color: '#9A8A78', fontFamily: MONO }}
                >
                  bal {entry.balance_after}
                </span>
              </div>
            );
          })}
        </GlassCard>
      )}
    </div>
  );
}
