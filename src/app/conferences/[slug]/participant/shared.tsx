'use client';

// Shared primitives for the participant view (person tab). Small and
// self-contained on purpose, duplicated from ConferenceDetailClient's own
// SectionCard rather than imported, since ConferenceDetailClient imports
// ParticipantView and an import back the other way would cycle.

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';

export const OUTFIT = "'Outfit', sans-serif";

export function SectionCard({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <div
      id={id}
      className={`rounded-[20px] p-6 md:p-7 ${className}`}
      style={{
        backgroundColor: '#FAF8F3',
        border: '1px solid #DDD4C0',
        boxShadow: '0 1px 3px rgba(27,56,40,0.04)',
      }}
    >
      {children}
    </div>
  );
}

// ── Pay gate state ───────────────────────────────────────────────────────────
// Single source of truth for "is this application's gated content visible /
// is payment actionable yet", shared by PayGate (content) and the /pay page
// (the "available once accepted" note).

export type GateState = 'full' | 'locked' | 'under_review';

const PAID_STATUSES = new Set(['paid', 'waived']);

export function getGateState(paymentTiming: string, applicationStatus: string, paymentStatus: string): GateState {
  if (paymentTiming === 'after_acceptance' && applicationStatus === 'submitted') return 'under_review';
  if (paymentTiming === 'anytime') return 'full';
  return PAID_STATUSES.has(paymentStatus) ? 'full' : 'locked';
}

// ── Role labels ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  delegate: 'Delegate',
  chair: 'Chair',
  'head-delegate': 'Head Delegate',
  'faculty-advisor': 'Faculty Advisor',
  observer: 'Observer',
  crisis: 'Crisis Staff',
  press: 'Press',
  staff: 'Staff',
};

export function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? capitalize(role.replace(/-/g, ' '));
}

// ── Application status priority ─────────────────────────────────────────────
// Default pill selection: most-active application first.

const STATUS_PRIORITY: Record<string, number> = {
  assigned: 0, 'checked-in': 0, accepted: 1, submitted: 2, rejected: 3, withdrawn: 3,
};

export function statusPriority(status: string): number {
  return STATUS_PRIORITY[status] ?? 9;
}

// ── Payment chip ─────────────────────────────────────────────────────────────
// PAID/WAIVED/UNPAID/PARTIAL plus the delegation-aware COVERED variant
// (paid, but not self-funded, the delegation's pool covered it). Shared by
// DelegationPlacard (viewer's own status) and DelegationPanel (every member).

export type PaymentChip = 'PAID' | 'COVERED' | 'WAIVED' | 'PARTIAL' | 'UNPAID' | 'REFUNDED';

export const CHIP_STYLES: Record<PaymentChip, { bg: string; color: string }> = {
  PAID: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  COVERED: { bg: 'rgba(61,122,82,0.13)', color: '#2A6858' },
  WAIVED: { bg: 'rgba(154,138,120,0.16)', color: '#6B5F52' },
  PARTIAL: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  UNPAID: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
  REFUNDED: { bg: 'rgba(154,138,120,0.16)', color: '#6B5F52' },
};

export function derivePaymentChip(paymentStatus: string, selfPaid: boolean, amountPaid: number): PaymentChip {
  if (paymentStatus === 'paid') return selfPaid ? 'PAID' : 'COVERED';
  if (paymentStatus === 'waived') return 'WAIVED';
  if (paymentStatus === 'refunded') return 'REFUNDED';
  return amountPaid > 0 ? 'PARTIAL' : 'UNPAID';
}

// ── Allocation partner lookup ─────────────────────────────────────────────
// A double-delegation country seats two users. Given the viewer's own
// allocation row, finds the OTHER seat-holder of the same committee +
// country (RLS lets seatmates read each other's allocation rows). Returns
// null when the country is single-seat (today's default) or the other seat
// isn't filled yet. Shared by AllocationCard ("Representing together with")
// and PositionPaperCard (paper-submitter attribution) so both resolve the
// same partner the same way.

export interface AllocationPartner {
  userId: string | null;
  name: string | null;
}

export function useAllocationPartner(
  myAllocation: { id: string; conference_committee_id: string; country_code: string } | null
): AllocationPartner | null {
  const { session } = useAuth();
  const [partner, setPartner] = useState<AllocationPartner | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!myAllocation || !session) { setPartner(null); return; }
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('conference_allocations')
        .select('user_id, profiles (display_name), applications:application_id (invited_name)')
        .eq('conference_committee_id', myAllocation.conference_committee_id)
        .eq('country_code', myAllocation.country_code)
        .neq('id', myAllocation.id);
      if (cancelled) return;
      const row = ((data ?? []) as unknown as {
        user_id: string | null;
        profiles: { display_name: string } | null;
        applications: { invited_name: string | null } | null;
      }[])[0] ?? null;
      setPartner(row ? { userId: row.user_id, name: row.profiles?.display_name ?? row.applications?.invited_name ?? null } : null);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAllocation?.id, myAllocation?.conference_committee_id, myAllocation?.country_code, session?.access_token]);

  return partner;
}

// ── Session release time ────────────────────────────────────────────────
// A session "opens" at its own release timestamp if set, otherwise the
// conference's start date at midnight. Shared by the delegate release gate
// (conference_committees.released_to_delegates_at) and the advisor/observer
// one (conferences.session_release_advisors_at) — same fallback rule,
// different source column.

export function effectiveReleaseTime(releaseAt: string | null, conferenceStartDate: string | null): number | null {
  if (releaseAt) return new Date(releaseAt).getTime();
  if (conferenceStartDate) return new Date(conferenceStartDate + 'T00:00:00').getTime();
  return null;
}

const RELEASE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatReleaseDate(ms: number): string {
  const d = new Date(ms);
  return `${RELEASE_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
