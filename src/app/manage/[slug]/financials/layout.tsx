'use client';

/**
 * Shell for every route under /manage/[slug]/financials: header + the
 * display-currency switcher (via FinancialsCurrencyProvider, see shared.tsx)
 * + a sub-nav of real routes (Overview / History / Invoices / Settings).
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, LayoutGrid, Receipt, Settings as SettingsIcon } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { currencySymbol } from '@/lib/finance';
import {
  NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuPill, type NeuGradient,
} from '@/components/neu';
import { FinancialsCurrencyProvider, useFinancialsCurrency, mutedCaption } from './shared';

// Local mirror of NeuPill's visual treatment, but rendered as a real <Link>
// so the sub-nav is genuine navigation (usePathname-driven active state),
// not tab-switch state.
function grad(g: NeuGradient) {
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
}

function NavPill({ href, active, icon: Icon, children }: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const gradient = NEU_GRADIENTS.forest;
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center gap-1.5 focus:outline-none"
      style={{
        padding: '4px 12px',
        borderRadius: 999,
        fontFamily: OUTFIT,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.04em',
        backgroundColor: active ? undefined : NEU.surface,
        background: active ? grad(gradient) : undefined,
        color: active ? '#FFFFFF' : hovered ? NEU.forest : NEU.ink,
        boxShadow: active ? `0 3px 8px ${gradient[0]}55, ${NEU.outSm}` : hovered ? NEU.outSmHover : NEU.outSm,
        transition: `box-shadow 200ms ${EASE}, color 200ms ${EASE}`,
        textDecoration: 'none',
      }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {children}
    </Link>
  );
}

function FinancialsHeader({ acronym }: { acronym: string }) {
  const { currency, displayCurrency, setDisplayCurrency, currencyOptions, converted } = useFinancialsCurrency();
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      <div>
        <p
          className="mb-1"
          style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: NEU.deepGold, textTransform: 'uppercase' }}
        >
          {acronym} · Financials
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 26, color: NEU.ink, letterSpacing: '-0.01em' }}>
            Financials
          </h1>
          {/* Display-currency switcher, conference currency first, then the
              full CURRENCIES list. Scrollable so 13 codes stay on one clean
              row without wrapping. */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto"
            style={{ maxWidth: 320, scrollbarWidth: 'none', paddingBottom: 2 }}
          >
            {currencyOptions.map(c => (
              <span key={c} className="flex-shrink-0">
                <NeuPill
                  active={displayCurrency === c}
                  gradient={NEU_GRADIENTS.forest}
                  onClick={currencyOptions.length > 1 ? () => setDisplayCurrency(c) : undefined}
                >
                  {currencySymbol(c)} {c}
                </NeuPill>
              </span>
            ))}
          </div>
        </div>
        {converted && (
          <p className="mt-1" style={mutedCaption}>
            Approximate conversion: payments settle in {currency}.
          </p>
        )}
      </div>
    </div>
  );
}

function FinancialsSubNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/manage/${slug}/financials`;
  const isOverview = pathname === base;
  const isHistory = pathname?.startsWith(`${base}/history`) ?? false;
  const isInvoices = pathname?.startsWith(`${base}/invoices`) ?? false;
  const isSettings = pathname?.startsWith(`${base}/settings`) ?? false;

  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      <NavPill href={base} active={isOverview} icon={LayoutGrid}>OVERVIEW</NavPill>
      <NavPill href={`${base}/history`} active={isHistory} icon={History}>HISTORY</NavPill>
      <NavPill href={`${base}/invoices`} active={isInvoices} icon={Receipt}>INVOICES</NavPill>
      <NavPill href={`${base}/settings`} active={isSettings} icon={SettingsIcon}>SETTINGS</NavPill>
    </div>
  );
}

export default function FinancialsLayout({ children }: { children: React.ReactNode }) {
  const { conference } = useManage();
  if (!conference) return null;

  return (
    <FinancialsCurrencyProvider conference={conference}>
      <div className="px-6 md:px-10 py-8">
        <div style={{ maxWidth: 1020, margin: '0 auto' }}>
          <FinancialsHeader acronym={conference.acronym} />
          <FinancialsSubNav slug={conference.slug} />
          {children}
        </div>
      </div>
    </FinancialsCurrencyProvider>
  );
}
