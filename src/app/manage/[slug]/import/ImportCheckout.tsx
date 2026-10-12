'use client';

// The organiser import's checkout (25 Sep 2026; Oct 2026 the flag pop-up was
// replaced by the page's own inline confirm, asked before EVERY import):
//   hasImportFlags       whether a file has something to flag (no longer read
//                        by the page, kept with ImportFlags for reference).
//   GavellingImportPopup "Gavelling Import", in the Store pop-ups' manner: the
//                        left explains, the right is the invoice. 1 credit per
//                        new delegate, head delegate, faculty advisor or
//                        observer; the credits come from Conference Credits
//                        first, then the organiser's own, then a purchase.
//                        Shown only once IMPORTS_PAID_LAUNCH is on. The page
//                        owns every write (page.tsx).

import { ArrowRightLeft, CalendarClock, UserPlus } from 'lucide-react';
import {
  PurchaseShell, PURCHASE_CSS, BrandTitle, Eyebrow, BenefitList, ErrorLine, GoldButton, type Benefit,
} from '@/components/purchase/purchaseKit';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5A5046';

// ── The flag ────────────────────────────────────────────────────────

export interface ImportFlags {
  /** Delegates and head delegates who will hold no allocation. */
  noAlloc: number;
  /** Of those, how many named a committee that did not match. */
  unresolvedCommittee: number;
  /** Rows marked WARNING in the table. */
  warnings: number;
  /** Rows marked ERROR, which are skipped. */
  errors: number;
}

export function hasImportFlags(f: ImportFlags): boolean {
  return f.noAlloc > 0 || f.warnings > 0 || f.errors > 0;
}

// ── Gavelling Import ────────────────────────────────────────────────

const BENEFITS: Benefit[] = [
  { emoji: 'Inbox tray', fallback: ArrowRightLeft, title: 'Handle applications outside Gavelling', live: true },
  { emoji: 'Calendar', fallback: CalendarClock, title: 'Join Gavelling after your applications have already started', live: true },
  { emoji: 'Busts in silhouette', fallback: UserPlus, title: 'Bring in external applicants in one step, and put them through your application process', live: true },
];

export interface ImportInvoice {
  /** Charged new rows by role, in display order. */
  charged: { role: string; count: number }[];
  /** Re-imported people (updates): never charged. */
  updates: number;
  /** Everything that will be written (new + updates). */
  rows: number;
  /** import_quote said charged: false (before launch), or it could not be read. */
  free: boolean;
  total: number;
  fromConference: number;
  fromOwn: number;
  toBuy: number;
  acceptMode: 'accepted' | 'submitted';
}

export function GavellingImportPopup({ invoice, busy, err, onClose, onPay }: {
  invoice: ImportInvoice; busy: boolean; err: string | null; onClose: () => void; onPay: () => void;
}) {
  const chargedCount = invoice.charged.reduce((n, c) => n + c.count, 0);
  const sources = [
    invoice.fromConference > 0 ? `${invoice.fromConference} from Conference Credits` : null,
    invoice.fromOwn > 0 ? `${invoice.fromOwn} from your credits` : null,
    invoice.toBuy > 0 ? `${invoice.toBuy} to buy` : null,
  ].filter(Boolean).join(', ');
  const label = invoice.free
    ? `Import ${invoice.rows} ${invoice.rows === 1 ? 'delegate' : 'delegates'}`
    : invoice.toBuy > 0
      ? 'Get credits and import'
      : `Pay ${invoice.total} ${invoice.total === 1 ? 'credit' : 'credits'}`;

  return (
    <PurchaseShell tone="light" label="Gavelling Import" onClose={onClose} panelClass="gv-imp-pop" testId="gavelling-import">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-buy-left">
        <BrandTitle word="Import" tone="light" sub={<>Bring the people you already have into Gavelling</>} />
        <div>
          <Eyebrow>What you get</Eyebrow>
          <BenefitList items={BENEFITS} tone="light" />
        </div>
      </div>
      <div className="gv-buy-right">
        <h3 className="gv-buy-rtitle">Your Invoice</h3>
        <div className="gv-imp-inv">
          {invoice.charged.map(c => (
            <div key={c.role} className="gv-imp-line">
              <span><b>{c.count}</b> {c.role}</span>
              <span className="gv-imp-num">{c.count} {c.count === 1 ? 'credit' : 'credits'}</span>
            </div>
          ))}
          {invoice.updates > 0 && (
            <div className="gv-imp-line">
              <span><b>{invoice.updates}</b> already imported, updated</span>
              <span className="gv-imp-num gv-imp-free">Free</span>
            </div>
          )}
          {chargedCount > 0 && <p className="gv-imp-rate">1 credit per delegate</p>}
          <div className="gv-imp-total">
            <span>Total</span>
            <span className="gv-imp-num">{invoice.total} {invoice.total === 1 ? 'credit' : 'credits'}</span>
          </div>
          {invoice.free ? (
            <p className="gv-imp-src">Imports are free until launch, so nothing is taken today.</p>
          ) : sources ? (
            <p className="gv-imp-src">{sources}</p>
          ) : null}
        </div>
        <p className="gv-imp-mode">
          {invoice.acceptMode === 'submitted'
            ? 'They arrive as submitted applications, for you to accept in Applications.'
            : 'They arrive accepted, or assigned when the file gives them a seat.'}
        </p>
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        <GoldButton onClick={onPay} busy={busy} busyText="One moment…" testId="gavelling-import-pay">{label}</GoldButton>
      </div>
    </PurchaseShell>
  );
}

const CSS = `
.gv-buy-panel.gv-imp-pop{min-height:0}
.gv-buy-panel.gv-imp-pop .gv-buy-gold{text-transform:none;letter-spacing:0.01em}
.gv-imp-inv{display:flex;flex-direction:column;gap:8px;padding:16px 18px;border-radius:16px;background:#FFFFFF;box-shadow:0 1px 3px rgba(27,56,40,0.08);font-family:${FONT};color:${INK}}
.gv-imp-line{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:15px}
.gv-imp-line b{font-weight:800;font-variant-numeric:tabular-nums}
.gv-imp-num{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.gv-imp-free{color:#2A5A3C}
.gv-imp-rate{margin:0;font-size:12.5px;color:${INK_SOFT}}
.gv-imp-total{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:4px;padding-top:10px;border-top:1px solid rgba(28,20,16,0.12);font-size:18px;font-weight:800}
.gv-imp-src{margin:2px 0 0;font-size:13.5px;line-height:1.45;color:${INK_SOFT}}
.gv-imp-mode{margin:0;font-family:${FONT};font-size:13px;line-height:1.45;color:${INK_SOFT}}
`;
