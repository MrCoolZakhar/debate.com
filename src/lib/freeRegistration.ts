// freeRegistration.ts — "is this registration free?", written once.
//
// A conference that charges a role nothing must never behave like a
// conference that charges and has not been paid. Before this existed every
// surface answered the question its own way, or did not ask it at all:
// `getGateState` locked a free delegate's dashboard behind a fee of zero,
// the public page offered "PAY AND REQUEST AID" to someone with nothing to
// pay, and the organiser's Unpaid tile counted them.
//
// THE RULE. A registration is free only when nothing about it can ever
// produce a bill:
//
//   1. the role's fee resolved for TODAY is 0. Always through
//      `activePhaseFee`, never `fee_amount` alone — a phased conference
//      legitimately stores fee_amount 0 and prices each phase, so reading
//      the flat column calls a £95 conference free.
//   2. the conference has no active registration surcharge
//      (`application_surcharges`, the app_fee invoice). Deliberately
//      conservative: a conference that charges a surcharge at all is not a
//      free conference, whoever the surcharge is finally billed to.
//   3. the application pledges no delegation spots and no advisor tickets,
//      each of which mints its own priced invoice.
//
// THE AUTHORITY IS THE DATABASE. `registration_is_free(conference, role,
// spots, advisors)` is the same three clauses in SQL, and the BEFORE INSERT
// trigger `zz_applications_mark_free_as_paid` stamps a free application
// `payment_status = 'paid'` the moment it is filed (migration
// `free_registration_is_paid_on_arrival`). Every reader of `payment_status`
// — the gate, the organiser list, financials, the delegation pools — is
// therefore already correct without knowing anything about fees.
//
// What the helpers below are for is the handful of surfaces that decide
// something BEFORE, or INSTEAD OF, reading payment_status: the pay entry
// point's label, the pay gate's belt-and-braces, and the organiser's
// payment controls. Clause 1 is all they can answer from data they hold;
// they pair it with payment_status, which carries clauses 2 and 3.

import { activePhaseFee, type FeePhase } from '@/lib/finance';

/** The shape every caller already has: one `application_role_configs` row. */
export interface RoleFeeConfig {
  fee_amount?: number | null;
  fee_phases?: FeePhase[] | null;
}

/**
 * What this role charges TODAY, through the fee-phase rule. 0 for a missing
 * config (a conference with no row for the role charges nothing).
 */
export function roleFeeToday(config: RoleFeeConfig | null | undefined, today?: Date): number {
  if (!config) return 0;
  const { amount } = activePhaseFee(
    { fee_amount: config.fee_amount ?? 0, fee_phases: config.fee_phases ?? null },
    today ?? new Date(),
  );
  return Number(amount) || 0;
}

/** Clause 1 on its own: this role is not charging anything today. */
export function roleIsFreeToday(config: RoleFeeConfig | null | undefined, today?: Date): boolean {
  return roleFeeToday(config, today) <= 0;
}

/**
 * Whether this role EVER charges — a flat fee, or any priced phase, past or
 * future. The right question for an organiser-facing affordance that should
 * stay put between phases (payment controls, the Unpaid tile) rather than
 * appearing and disappearing with the calendar.
 */
export function roleChargesFeeEver(config: RoleFeeConfig | null | undefined): boolean {
  if (!config) return false;
  if ((config.fee_amount ?? 0) > 0) return true;
  return (config.fee_phases ?? []).some(p => (Number(p?.amount) || 0) > 0);
}

/**
 * The participant-side answer: this person has nothing to pay.
 *
 * Both halves are required. `roleFeeToday` alone misses a surcharge or a
 * delegation pledge; `payment_status` alone cannot tell "free" from
 * "already paid a real fee", and the two want different words on screen.
 * The database has already applied all three clauses when it stamped
 * 'paid' on arrival, so a free role that is still 'unpaid' means something
 * IS owed (a surcharge, a pledge, or an invoice left behind by a surcharge
 * that has since been switched off) and the pay route must stay open.
 */
export function hasNothingToPay(
  roleConfig: RoleFeeConfig | null | undefined,
  paymentStatus: string | null | undefined,
  today?: Date,
): boolean {
  if (!roleIsFreeToday(roleConfig, today)) return false;
  return paymentStatus === 'paid' || paymentStatus === 'waived';
}
