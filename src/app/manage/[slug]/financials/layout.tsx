'use client';

/**
 * Shell for every route under /manage/[slug]/financials (1 Oct 2026, prompt 92).
 * The tabs are gone: the dashboard (the base route) draws its own header with
 * the key numbers and the display-currency picker, and History, Invoices and
 * Settings are reached from its cards. Those three get a small "Back to
 * Financials" link, the title and the same picker here. The display currency
 * lives in FinancialsCurrencyProvider (shared.tsx) for all of them.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { NEU, OUTFIT } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { FinancialsCurrencyProvider, useFinancialsCurrency, mutedCaption } from './shared';

// Each sub-page names itself; the caption is one quiet line under the title.
const SUB_PAGES: Record<string, { title: string; caption?: string }> = {
  invoices: { title: 'Invoices' },
  history: { title: 'Transactions', caption: 'Every payment, refund and correction, newest first' },
};

function SubPageHeader({ slug, section }: { slug: string; section: string }) {
  const sub = SUB_PAGES[section] ?? { title: 'Financials' };
  const { currency, displayCurrency, setDisplayCurrency, currencyOptions, converted } = useFinancialsCurrency();
  return (
    <div className="mb-6">
      <Link
        href={`/manage/${slug}/financials`}
        className="inline-flex items-center gap-1.5 mb-3 focus:outline-none focus-visible:underline"
        style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: NEU.forest, textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        <ArrowLeft size={15} strokeWidth={2.4} aria-hidden />
        Back to Financials
      </Link>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 30, color: NEU.ink, letterSpacing: '-0.02em', margin: 0 }}>
          <GoldWord tone="light">{sub.title}</GoldWord>
        </h1>
        <CurrencyPicker
          value={displayCurrency}
          onChange={setDisplayCurrency}
          options={currencyOptions}
          variant="pill"
          showName
          disabled={currencyOptions.length <= 1}
          ariaLabel="Display currency"
        />
      </div>
      {sub.caption && <p className="mt-1" style={{ ...mutedCaption, fontSize: 14 }}>{sub.caption}</p>}
      {converted && (
        <p className="mt-1" style={mutedCaption}>
          Approximate conversion: payments settle in {currency}
        </p>
      )}
    </div>
  );
}

export default function FinancialsLayout({ children }: { children: React.ReactNode }) {
  const { conference } = useManage();
  const pathname = usePathname();
  if (!conference) return null;
  const base = `/manage/${conference.slug}/financials`;
  const isDashboard = pathname === base || pathname === `${base}/`;
  const section = (pathname ?? '').slice(base.length + 1).split('/')[0] ?? '';

  return (
    <FinancialsCurrencyProvider conference={conference}>
      <div className="px-6 md:px-10 py-8">
        {/* Full width of the manage content area, like the Store (owner, 8 Oct 2026). */}
        <div>
          {!isDashboard && <SubPageHeader slug={conference.slug} section={section} />}
          {children}
        </div>
      </div>
    </FinancialsCurrencyProvider>
  );
}
