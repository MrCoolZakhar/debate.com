import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£', USD: '$', EUR: '€', JPY: '¥', CNY: '¥', INR: '₹', KRW: '₩',
  CHF: 'Fr', CAD: 'C$', AUD: 'A$', NZD: 'NZ$', SGD: 'S$', HKD: 'HK$',
  TRY: '₺', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč',
  MXN: 'MX$', BRL: 'R$', ZAR: 'R', THB: '฿', PHP: '₱', VND: '₫',
  RUB: '₽', ILS: '₪', AED: 'AED',
};

export function currencySymbol(code: string): string {
  if (!code) return '';
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

/** Exact fee amount, never rounded: whole numbers show no decimals, fractional amounts show exactly two. */
export function formatFeeAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/** Fee amount with its currency symbol prefixed, exact (see formatFeeAmount). */
export function formatFee(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${formatFeeAmount(amount)}`;
}
