// Shared primitives for the participant view (person tab). Small and
// self-contained on purpose, duplicated from ConferenceDetailClient's own
// SectionCard rather than imported, since ConferenceDetailClient imports
// ParticipantView and an import back the other way would cycle.

export const OUTFIT = "'Outfit', sans-serif";

export function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
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
