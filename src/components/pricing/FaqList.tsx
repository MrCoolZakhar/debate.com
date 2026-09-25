'use client';

// ── The FAQ, rendered the same way everywhere ────────────────────────────────
// Used by /pricing/credits, /pricing/subscription and the Pricing section of
// /help. Content comes from src/lib/pricingFaq.ts (one source). Each answer
// ends with a short row of actions: a link to where the thing lives, or a
// button that opens a purchase pop-up. Plain disclosure rows, no cards.

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { openCreditsPopup, openUnlimitedPopup } from '@/lib/purchasePopup';
import { useCreditPriceTable } from '@/lib/creditPricing';
import { answerFor, type FaqAction, type FaqEntry } from '@/lib/pricingFaq';

const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';
const RULE = 'rgba(27,56,40,0.14)';

function ActionChip({ action, context }: { action: FaqAction; context: 'pricing' | 'manage' | 'header' }) {
  const cls = 'gv-faq-act';
  if (action.kind === 'link') return <Link href={action.href} className={cls}>{action.label}</Link>;
  if (action.kind === 'open-credits') return <button type="button" className={cls} onClick={() => openCreditsPopup({ context })}>{action.label}</button>;
  return <button type="button" className={cls} onClick={() => openUnlimitedPopup()}>{action.label}</button>;
}

export function FaqList({ entries, defaultOpen, context = 'pricing', compact = false }: {
  entries: FaqEntry[];
  /** Ids open on first render (a URL fragment, say). */
  defaultOpen?: string[];
  /** Which context the "Buy credits" action opens the pop-up in. */
  context?: 'pricing' | 'manage' | 'header';
  /** Smaller type, for the help center's denser lists. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen ?? []));
  // The bundle-discount answer is built from credit_price_tiers() at render.
  const { table } = useCreditPriceTable();
  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  return (
    <div className="gv-faq" style={{ fontFamily: OUTFIT }}>
      <style>{`
        .gv-faq{border-top:1px solid ${RULE}}
        .gv-faq-row{border-bottom:1px solid ${RULE}}
        .gv-faq-q{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;padding:${compact ? '14px 0' : '18px 0'};background:none;border:none;text-align:left;cursor:pointer;font-family:${OUTFIT};color:${INK};font-size:${compact ? '15.5px' : '17px'};font-weight:700;letter-spacing:-0.005em;line-height:1.3}
        .gv-faq-q:focus{outline:none}
        .gv-faq-q:focus-visible{box-shadow:0 0 0 2px ${FOREST};border-radius:8px}
        .gv-faq-q svg{flex-shrink:0;color:${INK_SOFT};transition:transform 200ms cubic-bezier(0.22,1,0.36,1)}
        .gv-faq-q[aria-expanded="true"] svg{transform:rotate(180deg)}
        .gv-faq-a{padding:0 0 ${compact ? '16px' : '20px'};max-width:68ch}
        .gv-faq-a p{margin:0;font-size:${compact ? '14.5px' : '15.5px'};line-height:1.6;color:${INK_SOFT}}
        .gv-faq-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
        .gv-faq-act{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border:none;border-radius:999px;background:${FOREST};color:#EED98A;font-family:${OUTFIT};font-size:12.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;cursor:pointer;transition:background-color 140ms ease,transform 120ms ease}
        .gv-faq-act:hover{background:#2A5A3C}
        .gv-faq-act:active{transform:scale(0.98)}
        .gv-faq-act:focus{outline:none}
        .gv-faq-act:focus-visible{box-shadow:0 0 0 2px ${FOREST}}
        @media (prefers-reduced-motion:reduce){.gv-faq-q svg{transition:none}}
      `}</style>
      {entries.map((f) => {
        const isOpen = open.has(f.id);
        const panelId = `faq-${f.id}`;
        return (
          <div key={f.id} id={f.id} className="gv-faq-row" style={{ scrollMarginTop: 96 }}>
            <h3 style={{ margin: 0 }}>
              <button type="button" className="gv-faq-q" aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(f.id)}>
                <span>{f.question}</span>
                <ChevronDown size={18} strokeWidth={2.2} aria-hidden />
              </button>
            </h3>
            {isOpen && (
              <div id={panelId} className="gv-faq-a">
                <p>{answerFor(f, table)}</p>
                {f.actions.length > 0 && (
                  <div className="gv-faq-acts">
                    {f.actions.map((a) => <ActionChip key={a.label} action={a} context={context} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default FaqList;
