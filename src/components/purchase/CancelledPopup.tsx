'use client';

// After a cancel lands (26 Sep 2026): "We hate to see you go...". The
// purchase pop-up shell: the left says until when Unlimited stays on, that
// resuming changes nothing, and where to tell us what went wrong, with
// "Resume subscription"; the right is Gavin, large. The X closes it and the
// page's cancelled state is underneath, unchanged.

import Link from 'next/link';
import { PurchaseShell, PURCHASE_CSS, ErrorLine } from './purchaseKit';

const FONT = "var(--font-brand), sans-serif";

export default function CancelledPopup({ untilDate, gavinSrc, busy, err, onResume, onClose }: {
  untilDate: string | null; gavinSrc: string; busy: boolean; err: string;
  onResume: () => void; onClose: () => void;
}) {
  return (
    <PurchaseShell tone="light" label="We hate to see you go" onClose={onClose} panelClass="gv-bye" testId="cancelled-unlimited">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-bye-left">
        <h2 className="gv-bye-title">We hate to see you go...</h2>
        <p className="gv-bye-line">
          Unlimited stays on until {untilDate ?? 'the end of the period you paid for'}. You can resume any time before then and nothing
          changes. If something did not work for you, tell us on our <Link href="/contact" className="gv-bye-link">contact page</Link>.
        </p>
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        <button type="button" className="gv-bye-btn" onClick={onResume} disabled={busy} aria-busy={busy || undefined}>
          {busy ? 'Resuming…' : 'Resume subscription'}
        </button>
      </div>
      <div className="gv-bye-right" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gavinSrc} alt="" />
      </div>
    </PurchaseShell>
  );
}

const CSS = `
.gv-buy-panel.gv-bye{max-width:860px;min-height:0}
.gv-buy-panel.gv-bye .gv-buy-body{display:grid;grid-template-columns:1fr;align-items:stretch}
.gv-bye-left{display:flex;flex-direction:column;justify-content:center;gap:16px;padding:40px 36px;font-family:${FONT};color:#1C1410}
.gv-bye-title{margin:0;font-size:clamp(28px,3.4vw,38px);font-weight:800;letter-spacing:-0.02em;line-height:1.1;padding-right:36px}
.gv-bye-line{margin:0;font-size:16px;line-height:1.55;color:#4A4238}
.gv-bye-link{color:#1B3828;font-weight:800;text-decoration:underline;text-underline-offset:3px}
.gv-bye-btn{align-self:flex-start;min-height:50px;padding:0 24px;border:none;border-radius:11px;cursor:pointer;font-family:${FONT};font-size:16px;font-weight:700;color:#FFFFFF;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);box-shadow:0 6px 16px rgba(27,56,40,0.22)}
.gv-bye-btn:disabled{opacity:0.7;cursor:default}
.gv-bye-btn:focus{outline:none}
.gv-bye-btn:focus-visible{outline:2px solid #1B3828;outline-offset:3px}
.gv-bye-right{display:flex;align-items:flex-end;justify-content:center;background:linear-gradient(160deg,#F3EEE2 0%,#E8DFC9 100%);min-height:220px;overflow:hidden}
.gv-bye-right img{display:block;width:100%;max-width:420px;height:auto;max-height:100%;object-fit:contain}
@media (min-width:744px){
  .gv-buy-panel.gv-bye .gv-buy-body{grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);min-height:420px}
  .gv-bye-right{min-height:0;align-items:center;padding:24px}
}
`;
