'use client';

// docsKit.tsx — the look of Invoices and Receipts (prompt 98): a "studio"
// pop-up with the words on the left and the paper on the right (like the
// Email Builder), and the fields inside it. Built on the purchase pop-up
// shell and the Financials dashboard kit.

import { OUTFIT } from '@/components/neu';
import { DANGER, FOREST, INK, INK_SOFT, LINE } from '../dashboardKit';

export const DOCS_CSS = `
.gv-buy-panel.gv-md-studio{max-width:1240px}
.gv-md-left{padding:30px 28px 0;display:flex;flex-direction:column;gap:16px;min-width:0}
.gv-md-right{padding:24px 16px 32px;background:#E4DCCA;min-width:0}
.gv-md-paper{max-width:720px;margin:0 auto}
@media (min-width:860px){
  .gv-buy-panel.gv-md-studio{height:calc(100dvh - 48px)}
  .gv-md-studio .gv-buy-body{overflow:hidden;flex:1 1 auto}
  .gv-md-left{flex:0 0 420px;overflow-y:auto;overscroll-behavior:contain}
  .gv-md-right{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;padding:40px 44px 48px}
}
.gv-md-title{margin:0;padding-right:44px;font-size:28px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;color:${INK}}
.gv-md-sub{margin:4px 0 0;font-size:14px;line-height:1.5;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-md-group{display:flex;flex-direction:column;gap:12px;padding-top:4px}
.gv-md-group + .gv-md-group{border-top:1px solid ${LINE};padding-top:16px}
.gv-md-sect{margin:0;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT}}
.gv-md-field{display:flex;flex-direction:column;gap:6px}
.gv-md-label{font-size:13.5px;font-weight:700;color:${INK}}
.gv-md-label small{font-weight:500;color:${INK_SOFT}}
.gv-md-input,.gv-md-area{width:100%;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;color:${INK};font-family:${OUTFIT};font-size:16px;line-height:1.45}
.gv-md-input{height:46px;padding:0 14px}
.gv-md-area{min-height:84px;padding:11px 14px;resize:vertical}
.gv-md-input:focus,.gv-md-area:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.14)}
.gv-md-input[aria-invalid="true"],.gv-md-area[aria-invalid="true"]{border-color:${DANGER}}
.gv-md-err{margin:0;font-size:13px;line-height:1.45;color:${DANGER}}
.gv-md-hint{margin:0;font-size:12.5px;line-height:1.45;color:${INK_SOFT}}
.gv-md-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
@media (max-width:420px){.gv-md-two{grid-template-columns:minmax(0,1fr)}}
.gv-md-foot{position:sticky;bottom:0;z-index:2;margin:auto -28px 0;padding:14px 28px calc(16px + env(safe-area-inset-bottom,0px));background:#F6F3EC;box-shadow:0 -1px 0 ${LINE};display:flex;flex-direction:column;gap:10px}
.gv-md-foot-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gv-md-swatches{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gv-md-swatch{width:38px;height:38px;border-radius:999px;border:none;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.12);display:inline-flex;align-items:center;justify-content:center;color:#FFFFFF}
.gv-md-swatch[aria-checked="true"]{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${FOREST}}
.gv-md-swatch:focus{outline:none}
.gv-md-swatch:focus-visible{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${FOREST}}
.gv-md-picker{position:relative;width:38px;height:38px;border-radius:999px;overflow:hidden;box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.35);background:conic-gradient(#E05252,#E0C452,#52E07A,#52B6E0,#7A52E0,#E052B6,#E05252)}
.gv-md-picker input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.gv-md-save{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:${INK_SOFT}}
.gv-md-example{display:inline-block;margin-left:4px;padding:2px 8px;border-radius:8px;background:#FFFFFF;font-weight:700;color:${INK};font-variant-numeric:tabular-nums}
`;

/** One labelled field with its error under it. */
export function Field({ id, label, hint, error, children }: {
  id: string; label: React.ReactNode; hint?: React.ReactNode; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="gv-md-field">
      <label htmlFor={id} className="gv-md-label">{label}</label>
      {children}
      {error ? <p className="gv-md-err" id={`${id}-err`} role="alert">{error}</p> : hint ? <p className="gv-md-hint">{hint}</p> : null}
    </div>
  );
}
