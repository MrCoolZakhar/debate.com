'use client';

// ── A premium listing for someone who is not on Unlimited ───────────────────
//
// Drawn in place of About the Role (and the listing's Apply) when
// job_listing_get answers `premium_locked`. Placeholder lines under frosted
// glass, a gold lock and the gold button, which opens the Unlimited pop-up
// (it asks a signed-out visitor to sign in first). The description never
// reaches this page: the server leaves it out of a locked read. Once the plan
// turns active, JobListing reads the listing again and it opens normally.

import { Lock } from 'lucide-react';
import { GoldButton, GoldButtonStyles } from '@/components/GoldButton';
import { openUnlimitedPopup } from '@/lib/purchasePopup';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';

export default function PremiumLock({ className = '' }: { className?: string }) {
  return (
    <section className={`gv-pl ${className}`.trim()} aria-labelledby="gv-pl-title" style={{ fontFamily: FONT }}>
      <style>{PREMIUM_LOCK_CSS}</style>
      <GoldButtonStyles />
      <div className="gv-pl-ghost" aria-hidden>
        <span style={{ width: 150, height: 18, marginBottom: 6 }} />
        {[96, 90, 93, 70, 0, 88, 94, 62].map((w, i) => (
          w ? <span key={i} style={{ width: `${w}%` }} /> : <i key={i} />
        ))}
      </div>
      <div className="gv-pl-frost" aria-hidden />
      <div className="gv-pl-card">
        <span className="gv-pl-lock" aria-hidden><Lock size={26} strokeWidth={2.3} /></span>
        <h3 id="gv-pl-title" className="gv-pl-title">This role is for Gavelling Unlimited members</h3>
        <p className="gv-pl-line">Read the role and apply with Gavelling Unlimited</p>
        <GoldButton onClick={() => openUnlimitedPopup()} style={{ textTransform: 'none', letterSpacing: '0.01em' }}>
          <Lock size={16} strokeWidth={2.5} aria-hidden />
          Get Unlimited
        </GoldButton>
      </div>
    </section>
  );
}

const PREMIUM_LOCK_CSS = `
.gv-pl{position:relative;overflow:hidden;min-height:300px;display:flex;align-items:center;justify-content:center;padding:28px 24px;background:#FFFFFF;border-radius:20px;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 8px 24px rgba(27,56,40,0.08);color:${INK}}
.gv-pl-ghost{position:absolute;inset:0;padding:24px;display:flex;flex-direction:column;gap:11px}
.gv-pl-ghost span{display:block;height:13px;border-radius:7px;background:rgba(27,56,40,0.15)}
.gv-pl-ghost span:first-child{background:rgba(27,56,40,0.24)}
.gv-pl-ghost i{display:block;height:8px}
.gv-pl-frost{position:absolute;inset:0;background:rgba(255,255,255,0.6);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.gv-pl-card{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;max-width:440px;padding:26px 24px;border-radius:20px;
  background:rgba(255,255,255,0.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.9);box-shadow:0 12px 32px rgba(27,56,40,0.14)}
.gv-pl-lock{width:56px;height:56px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;color:${INK};
  background:linear-gradient(135deg,#F4E4A6 0%,#EED98A 38%,#D6B24C 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.65),0 8px 20px -6px rgba(182,135,31,0.6)}
.gv-pl-title{margin:4px 0 0;font-size:clamp(19px,1.6vw,22px);font-weight:800;letter-spacing:-0.01em;line-height:1.25;color:${INK};text-wrap:balance}
.gv-pl-line{margin:0 0 6px;font-size:15px;line-height:1.5;color:${INK_SOFT}}
@media (max-width:639px){.gv-pl{padding:20px 16px}.gv-pl-card{padding:22px 18px}}
`;
