import type { ReactNode } from 'react';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
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
        .gv-pr-tabs{list-style:none;margin:0;padding:4px;display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#FFFFFF;border-radius:16px;box-shadow:0 1px 0 rgba(27,56,40,0.08)}
        .gv-pr-tab{display:flex;align-items:center;justify-content:center;min-height:48px;padding:8px 14px;border-radius:12px;text-decoration:none;color:${INK};font-size:16px;font-weight:700;letter-spacing:-0.01em;transition:background-color 160ms ease-out,color 160ms ease-out}
        .gv-pr-tab:hover{background:rgba(27,56,40,0.08)}
        .gv-pr-tab:focus{outline:none}
        .gv-pr-tab:focus-visible{box-shadow:0 0 0 3px ${IVORY},0 0 0 6px ${FOREST}}
        .gv-pr-tab[data-active="true"]{background:${FOREST};color:#EED98A;font-weight:800}
        @media (min-width:1024px){
          .gv-pr-shell{flex-direction:row;align-items:flex-start;gap:56px;padding:40px 32px 96px}
          .gv-pr-rail{position:sticky;top:96px;flex:0 0 224px;width:224px}
          .gv-pr-tabs{grid-template-columns:1fr;background:none;padding:0;gap:6px;border-radius:0;box-shadow:none}
          .gv-pr-tab{justify-content:flex-start;min-height:56px;padding:10px 18px;font-size:18px}
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
      <SiteFooter />
    </div>
  );
}
