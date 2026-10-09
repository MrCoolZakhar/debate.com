'use client';

/**
 * Shell for every route under /manage/[slug]/financials (1 Oct 2026, prompt 92).
 * The tabs are gone: the dashboard (the base route) draws its own header with
 * the key numbers and the display-currency picker, and History, Invoices and
 * Settings are reached from its cards (Financial aid too, since 9 Oct 2026). Those three get a small "Back to
 * Financials" link, the title and the same picker here. The display currency
 * lives in FinancialsCurrencyProvider (shared.tsx) for all of them.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowLeftRight, FileText, HeartHandshake, ReceiptText, type LucideIcon } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { NEU, OUTFIT, Emoji3D } from '@/components/neu';
import { TINT_GOLD, TINT_GREEN } from './dashboardKit';
import { GoldWord } from '@/components/BrandHeading';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { FinancialsCurrencyProvider, useFinancialsCurrency, mutedCaption, conversionLine } from './shared';

// Each sub-page names itself; the caption is one quiet line under the title.
// `emoji` is the Fluent 3D emoji in the tinted disc beside the title (the
// organiser dashboard's icon idiom); `lucide` is its fallback if the CDN image
// fails. `noCurrency` hides the display-currency picker on a page that shows
// no money of its own (Financial aid).
const SUB_PAGES: Record<string, { title: string; caption?: string; emoji: string; lucide: LucideIcon; tint: string; noCurrency?: boolean }> = {
  invoices: { title: 'Invoices', emoji: 'Receipt', lucide: ReceiptText, tint: TINT_GOLD },
  history: { title: 'Transactions', caption: 'Every payment, refund and correction, newest first', emoji: 'Chart increasing', lucide: ArrowLeftRight, tint: TINT_GREEN },
  documents: { title: 'Invoices and Receipts', caption: 'Formal invoices and receipts in your conference\'s name', emoji: 'Page facing up', lucide: FileText, tint: TINT_GOLD },
  aid: { title: 'Financial Aid', caption: 'Who can ask for help paying, and the requests waiting on you', emoji: 'Heart with ribbon', lucide: HeartHandshake, tint: TINT_GREEN, noCurrency: true },
};

function SubPageHeader({ slug, section }: { slug: string; section: string }) {
  const sub = SUB_PAGES[section] ?? { title: 'Financials', emoji: 'Money bag', lucide: ReceiptText, tint: TINT_GREEN };
  const { currency, displayCurrency, setDisplayCurrency, currencyOptions, converted, ratesAsOf } = useFinancialsCurrency();
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
        <div className="flex items-center gap-3.5 min-w-0">
          <span
            aria-hidden
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{ width: 52, height: 52, borderRadius: 16, background: sub.tint, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 6px 16px -10px rgba(27,56,40,0.45)' }}
          >
            <Emoji3D name={sub.emoji} size={32} fallback={sub.lucide} fallbackColor={NEU.forest} />
          </span>
          <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 30, color: NEU.ink, letterSpacing: '-0.02em', margin: 0 }}>
            <GoldWord tone="light">{sub.title}</GoldWord>
          </h1>
        </div>
        {!sub.noCurrency && <CurrencyPicker
          value={displayCurrency}
          onChange={setDisplayCurrency}
          options={currencyOptions}
          variant="pill"
          showName
          disabled={currencyOptions.length <= 1}
          ariaLabel="Display currency"
        />}
      </div>
      {sub.caption && <p className="mt-1" style={{ ...mutedCaption, fontSize: 14 }}>{sub.caption}</p>}
      {converted && !sub.noCurrency && (
        <p className="mt-1" style={mutedCaption}>
          {conversionLine(currency, ratesAsOf)}
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
