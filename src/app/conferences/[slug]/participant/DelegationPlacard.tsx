'use client';

// Delegation placard — society name, advisors, and the delegate's own
// payment status within that delegation. Independent delegates get a plain
// "Independent delegate" card instead.
//
// Advisor lookup relies on the recursion-safe "Members read society
// leadership" policy on applications (via the my_society_ids() /
// is_society_leader() SECURITY DEFINER helpers) plus "Society co-members
// read profiles" on profiles (via shares_society_with()) — both applied
// server-side. Verified end-to-end under RLS as a real delegate and a real
// head-delegate in seeded data; falls back to "No faculty advisor listed"
// for societies with none on record.

import { useState, useEffect, useCallback } from 'react';
import { Users2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { SectionCard, OUTFIT } from './shared';

type Chip = 'PAID' | 'COVERED' | 'WAIVED' | 'PARTIAL' | 'UNPAID' | 'REFUNDED';

const CHIP_STYLES: Record<Chip, { bg: string; color: string }> = {
  PAID: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  COVERED: { bg: 'rgba(61,122,82,0.13)', color: '#2A6858' },
  WAIVED: { bg: 'rgba(154,138,120,0.16)', color: '#6B5F52' },
  PARTIAL: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  UNPAID: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
  REFUNDED: { bg: 'rgba(154,138,120,0.16)', color: '#6B5F52' },
};

function deriveChip(paymentStatus: string, selfPaid: boolean, amountPaid: number): Chip {
  if (paymentStatus === 'paid') return selfPaid ? 'PAID' : 'COVERED';
  if (paymentStatus === 'waived') return 'WAIVED';
  if (paymentStatus === 'refunded') return 'REFUNDED';
  return amountPaid > 0 ? 'PARTIAL' : 'UNPAID';
}

export interface DelegationPlacardProps {
  isIndependent: boolean;
  societyId: string | null;
  paymentStatus: string;
  selfPaid: boolean;
  amountPaid: number;
}

export default function DelegationPlacard({ isIndependent, societyId, paymentStatus, selfPaid, amountPaid }: DelegationPlacardProps) {
  const { session } = useAuth();
  const [societyName, setSocietyName] = useState<string | null>(null);
  const [advisorNames, setAdvisorNames] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (isIndependent || !societyId || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const [{ data: societyRow }, { data: advisorRows }] = await Promise.all([
      supabase.from('societies').select('name').eq('id', societyId).maybeSingle(),
      supabase
        .from('applications')
        .select('profiles (display_name)')
        .eq('society_id', societyId)
        .eq('role', 'faculty-advisor')
        .in('status', ['accepted', 'assigned']),
    ]);
    setSocietyName((societyRow as { name?: string } | null)?.name ?? null);
    setAdvisorNames(
      ((advisorRows ?? []) as { profiles: { display_name: string } | { display_name: string }[] | null }[])
        .map(r => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles)?.display_name)
        .filter((n): n is string => !!n)
    );
  }, [isIndependent, societyId, session]);

  useEffect(() => { load(); }, [load]);

  const chip = deriveChip(paymentStatus, selfPaid, amountPaid);

  if (isIndependent) {
    return (
      <SectionCard>
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 10px 0' }}>
          DELEGATION
        </p>
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 38, height: 38, borderRadius: '9999px', backgroundColor: 'rgba(27,56,40,0.07)' }}
          >
            <Users2 size={16} style={{ color: '#1B3828' }} />
          </span>
          <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
            Independent delegate
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
          DELEGATION
        </p>
        <span
          className="px-2.5 py-0.5 rounded-full"
          style={{ ...CHIP_STYLES[chip], fontSize: '10px', fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.08em' }}
        >
          {chip}
        </span>
      </div>
      <p className="font-bold text-[15px]" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
        {societyName ?? 'Delegation'}
      </p>
      <p className="text-xs mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        {advisorNames.length > 0 ? advisorNames.join(', ') : 'No faculty advisor listed'}
      </p>
    </SectionCard>
  );
}
