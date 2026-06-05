'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Minus, Settings, Trophy, Award } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseAuthClient } from '@/lib/supabase-auth';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

interface LedgerEntry {
  id: string;
  amount: number;
  balance_after: number;
  type: string;
  description: string;
  created_at: string;
}

function getTransactionStyle(type: string): { Icon: React.ElementType; color: string } {
  if (type.startsWith('earned_'))    return { Icon: TrendingUp,  color: '#3D7A52' };
  if (type === 'purchased')          return { Icon: ShoppingBag, color: '#B6871F' };
  if (type.startsWith('spent_'))     return { Icon: Minus,       color: '#8B2020' };
  return                                    { Icon: Settings,    color: '#9A8A78' };
}

export default function PointsPage() {
  const { user, profile } = useAuth();
  const [ledger, setLedger]   = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = supabaseAuthClient;

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
  }, [user?.id]);

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
      <h1
        className="font-black text-2xl mb-1"
        style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
      >
        Gavelling Points
      </h1>
      <p
        className="text-sm mb-8"
        style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
      >
        Earn points by participating in conferences. Spend them on rewards.
      </p>

      {/* Balance hero card */}
      <div
        className="relative rounded-2xl p-8 mb-6 text-center overflow-hidden"
        style={{ backgroundColor: '#1B3828' }}
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
        <div className="relative z-10">
          <p
            className="mb-2 tracking-widest"
            style={{ color: 'rgba(238,217,138,0.6)', fontFamily: "'DM Mono', monospace", fontSize: '10px' }}
          >
            YOUR BALANCE
          </p>
          <p
            className="font-black"
            style={{ color: '#EED98A', fontFamily: "'DM Mono', monospace", fontSize: '60px', lineHeight: 1 }}
          >
            {balance.toLocaleString()}
          </p>
          <p
            className="text-sm mt-1"
            style={{ color: 'rgba(238,217,138,0.5)', fontFamily: "'DM Mono', monospace" }}
          >
            GAVELLING POINTS
          </p>
          {isUnlimited && (
            <div className="flex justify-center mt-3">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: 'rgba(238,217,138,0.15)',
                  color: '#EED98A',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                ✦ Unlimited Member
              </span>
            </div>
          )}
        </div>
      </div>

      {/* How to earn */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl p-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
          <Trophy size={20} style={{ color: '#1B3828', marginBottom: '8px' }} />
          <p
            className="font-semibold text-sm mb-1"
            style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
          >
            Attend a paid conference
          </p>
          <p
            className="text-xs"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          >
            Earn points when you participate in a paid Gavelling conference session.
          </p>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
          <Award size={20} style={{ color: '#1B3828', marginBottom: '8px' }} />
          <p
            className="font-semibold text-sm mb-1"
            style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
          >
            Receive an award
          </p>
          <p
            className="text-xs"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          >
            Bonus points for Best Delegate, Outstanding Delegate, and other awards.
          </p>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
          <ShoppingBag size={20} style={{ color: '#1B3828', marginBottom: '8px' }} />
          <p
            className="font-semibold text-sm mb-1"
            style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
          >
            Purchase points
          </p>
          <p
            className="text-xs mb-2"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
          >
            Buy points directly to spend on merchandise, courses, and fee waivers.
          </p>
          <span
            className="rounded-full px-2 py-0.5"
            style={{
              backgroundColor: 'rgba(154,138,120,0.1)',
              color: '#9A8A78',
              fontFamily: "'DM Mono', monospace",
              fontSize: '9px',
            }}
          >
            COMING SOON
          </span>
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h2
          className="font-semibold text-base mb-3"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          Transaction History
        </h2>

        {ledger.length === 0 ? (
          <div className="text-center py-12">
            <p
              className="text-sm"
              style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
            >
              No transactions yet
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
            >
              Attend a paid conference to earn your first points.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ledger.map((entry) => {
              const { Icon, color } = getTransactionStyle(entry.type);
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
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
                >
                  <Icon size={20} style={{ color, flexShrink: 0 }} />
                  <p
                    className="text-sm font-medium flex-1 min-w-0 truncate"
                    style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                  >
                    {entry.description}
                  </p>
                  <span
                    className="font-bold text-sm flex-shrink-0"
                    style={{ color: amountColor, fontFamily: "'DM Mono', monospace" }}
                  >
                    {amountStr}
                  </span>
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}
                  >
                    {date}
                  </span>
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
                  >
                    bal: {entry.balance_after}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
