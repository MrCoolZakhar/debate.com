import type { ReactNode } from 'react';
import SiteNav from '@/components/SiteNav';
import FooterLegal from '@/components/FooterLegal';
import PricingRail from '@/components/pricing/PricingRail';

// ── The pricing section frame ────────────────────────────────────────────────
// Ivory page, the site nav, a sticky two-tab rail beside the content from
// 1024px (a segmented control above it below that), the legal footer. The
// pages themselves are /pricing/credits and /pricing/subscription.

const IVORY = '#EDE7D8';
const FOREST = '#1B3828';
const INK = '#1C1410';
const INK_SOFT = '#5A5046';

export default function PricingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden" style={{ backgroundColor: IVORY, fontFamily: 'var(--font-brand), sans-serif' }}>
      <style>{`
        .gv-pr-shell{position:relative;z-index:1;width:100%;max-width:1360px;margin:0 auto;padding:16px 20px 72px;display:flex;flex-direction:column;gap:20px}
        .gv-pr-main{min-width:0;width:100%}
        .gv-pr-rail{display:flex;flex-direction:column;gap:10px}
        .gv-pr-rail-eyebrow{margin:0;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT}}
        .gv-pr-rail-note{display:none;margin:14px 0 0;font-size:13.5px;line-height:1.5;color:${INK_SOFT};max-width:22ch}
        .gv-pr-tabs{list-style:none;margin:0;padding:4px;display:grid;grid-template-columns:1fr 1fr;gap:4px;background:rgba(27,56,40,0.07);border-radius:16px}
        .gv-pr-tab{display:flex;flex-direction:column;justify-content:center;min-height:48px;padding:8px 14px;border-radius:12px;text-decoration:none;color:${INK};font-weight:500;transition:background-color 160ms ease-out,color 160ms ease-out}
        .gv-pr-tab:hover{background:rgba(27,56,40,0.08)}
        .gv-pr-tab[data-active="true"]{background:${FOREST};color:#FAF8F3;font-weight:700}
        .gv-pr-tab-label{font-size:15.5px;line-height:1.2}
        .gv-pr-tab-hint{display:none;font-size:12.5px;line-height:1.3;margin-top:2px;opacity:0.72}
        @media (min-width:1024px){
          .gv-pr-shell{flex-direction:row;align-items:flex-start;gap:56px;padding:40px 32px 96px}
          .gv-pr-rail{position:sticky;top:96px;flex:0 0 224px;width:224px}
          .gv-pr-rail-note{display:block}
          .gv-pr-tabs{grid-template-columns:1fr;background:none;padding:0;gap:6px;border-radius:0}
          .gv-pr-tab{min-height:56px;padding:10px 16px}
          .gv-pr-tab-hint{display:block}
          .gv-pr-main{flex:1 1 auto}
        }
        @media (prefers-reduced-motion:reduce){.gv-pr-tab{transition:none}}
      `}</style>
      {/* Grain, the same sheet every public page lays over the ivory. */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />
      <SiteNav />
      <div className="gv-pr-shell">
        <PricingRail />
        <main className="gv-pr-main">{children}</main>
      </div>
      <footer className="relative z-10 w-full px-6 pb-8" style={{ borderTop: '1px solid rgba(27,56,40,0.14)' }}>
        <div className="mx-auto w-full" style={{ maxWidth: 1360 }}>
          <FooterLegal tone="ivory" showCopyright />
        </div>
      </footer>
    </div>
  );
}
