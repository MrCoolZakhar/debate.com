import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { currencySymbol } from "@/lib/currencies"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

// ── Fee formatting ───────────────────────────────────────────────────────────
// Single source of truth for displaying conference fees (F14). Amounts are
// never rounded: whole numbers show no decimals ("70"), fractional amounts
// always show exactly two ("44.98") — so conference cards, the apply flow,
// and manage pages all agree on the same figure instead of drifting via
// their own toFixed(0) / duplicated currencySymbol implementations.
//
// currencySymbol itself lives in src/lib/currencies.ts (the canonical
// currency list), re-exported here since most fee-formatting call sites
// already import it alongside formatFee/formatFeeAmount from this module.
export { currencySymbol };

/** Exact fee amount, never rounded: whole numbers show no decimals, fractional amounts show exactly two. */
export function formatFeeAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/** Fee amount with its currency symbol prefixed, exact (see formatFeeAmount). */
export function formatFee(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${formatFeeAmount(amount)}`;
}

/**
 * Fee amount for DISPLAY on conference listings: abbreviated once it reaches
 * 10,000 so large-denomination currencies (INR, IDR, VND, KRW…) don't blow out
 * a price chip — "₹15000" renders as "₹15k".
 *
 *   9999 → "9999"      (under the threshold, exact and unchanged)
 *   10000 → "10k"       15500 → "15.5k"      150000 → "150k"
 *   1500000 → "1.5M"   (millions, so an IDR fee never reads "1500k")
 *
 * One decimal at most, and never a trailing ".0". This is a PRESENTATION
 * helper only — accounting surfaces (invoices, revenue, aid grants, vouchers)
 * must keep using the exact formatFee/formatFeeAmount.
 */
export function formatFeeAmountCompact(amount: number): string {
  if (!Number.isFinite(amount) || Math.abs(amount) < 10_000) return formatFeeAmount(amount);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  let value = round1(amount / 1_000);
  let suffix = 'k';
  // 999,999 would otherwise round to "1000k" — promote it to millions instead.
  if (Math.abs(value) >= 1_000) {
    value = round1(amount / 1_000_000);
    suffix = 'M';
  }
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

/** Currency symbol + abbreviated amount, for listing price chips. */
export function formatFeeCompact(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${formatFeeAmountCompact(amount)}`;
}
