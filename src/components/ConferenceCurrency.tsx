'use client';

/**
 * The conference's ONE currency, shown fixed where prices are typed (prompt
 * 126): the role pop-up's Prices, the Registration Fee and Add-ons. It is
 * chosen once in the Financials welcome pop-up ("What's Your Currency of
 * Choice?") and changed only from Settings, Payments, so these screens never
 * offer a picker and their writes never send a currency (the database keeps
 * every price in the conference's currency).
 *
 * The chip has the CurrencyPicker's footprint (the same height and width as
 * the bordered trigger it replaced), so nothing beside it moves.
 */

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { findCurrency, currencyFlagCode } from '@/lib/currencies';
import { FlagImg } from '@/components/FlagImg';

export function CurrencyChip({ code, width = 112, height, title }: {
  code: string;
  width?: number;
  height?: number;
  /** Tooltip; defaults to the currency's name. */
  title?: string;
}) {
  const c = (code || '').toUpperCase();
  const name = findCurrency(c)?.name ?? c;
  return (
    <span
      role="img"
      aria-label={`${c}, ${name}`}
      title={title ?? name}
      className="inline-flex items-center justify-center gap-1.5 flex-shrink-0"
      style={{
        width, height, minHeight: height ? undefined : 44, padding: '0 10px', borderRadius: 12,
        background: 'rgba(27,56,40,0.05)', boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.14)',
        fontFamily: 'var(--font-brand), sans-serif', fontSize: 14.5, fontWeight: 800, color: '#1C1410', letterSpacing: '0.02em',
      }}
    >
      {currencyFlagCode(c) && <FlagImg code={currencyFlagCode(c)} size={16} />}
      {c}
      <Lock size={12} strokeWidth={2.4} aria-hidden style={{ color: '#5A5046' }} />
    </span>
  );
}

/** "In {CODE}, your conference's currency. Change it in Payments". */
export function ConferenceCurrencyLine({ code, slug, style }: { code: string; slug: string; style?: React.CSSProperties }) {
  const c = (code || '').toUpperCase();
  return (
    <p style={{ margin: 0, fontFamily: 'var(--font-brand), sans-serif', fontSize: 13, color: '#5A5046', lineHeight: 1.45, ...style }}>
      In {c}, your conference&apos;s currency. Change it in{' '}
      <Link href={`/manage/${slug}/settings?tab=payments`} style={{ color: '#1B3828', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2 }}>Payments</Link>
    </p>
  );
}
