'use client';

// The organiser import's two pop-ups (25 Sep 2026):
//   ImportFlagDialog     step 1, only when the file has something to flag
//                        (delegates without a committee and country, rows with
//                        warnings, rows that will be skipped). No credit talk.
//   GavellingImportPopup step 2, "Gavelling Import", in the Store pop-ups'
//                        manner: the left explains, the right is the invoice.
//                        1 credit per new delegate, head delegate, faculty
//                        advisor or observer; the credits come from Conference
//                        Credits first, then the organiser's own, then a
//                        purchase. The page owns every write (import.page.tsx).

import { AlertTriangle, ArrowRightLeft, CalendarClock, UserPlus } from 'lucide-react';
import {
  PurchaseShell, PURCHASE_CSS, BrandTitle, Eyebrow, BenefitList, ErrorLine, GoldButton, type Benefit,
} from '@/components/purchase/purchaseKit';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const RED = '#8B2020';

// ── Step 1: the flag ────────────────────────────────────────────────────────

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

export function ImportFlagDialog({ flags, onCancel, onContinue }: {
  flags: ImportFlags; onCancel: () => void; onContinue: () => void;
}) {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <PurchaseShell tone="light" label="Check before importing" onClose={onCancel} panelClass="gv-imp-flag" testId="import-flag">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-imp-flag-body">
        <span className="gv-imp-flag-icon" aria-hidden><AlertTriangle size={26} strokeWidth={2.2} /></span>
        <h2 className="gv-imp-flag-title">Check Before Importing</h2>
        {flags.noAlloc > 0 && (
          <p className="gv-imp-flag-lead" role="alert">
            {plural(flags.noAlloc, 'delegate', 'delegates')} will be imported without a committee and country.
            {flags.unresolvedCommittee > 0 ? ` ${flags.unresolvedCommittee} of them name a committee that did not match.` : ''}
          </p>
        )}
        <ul className="gv-imp-flag-list">
          {flags.warnings > 0 && (
            <li><b>{plural(flags.warnings, 'row has', 'rows have')} a warning.</b> Each one is explained in the table.</li>
          )}
          {flags.errors > 0 && (
            <li><b>{plural(flags.errors, 'row has', 'rows have')} an error and will be skipped.</b> Fix them in the file to bring them in.</li>
          )}
          {flags.noAlloc > 0 && (
            <li>Emails that mention a country or committee will have none to show. You can assign them later in Assignment.</li>
          )}
        </ul>
        <div className="gv-imp-flag-actions">
          <button type="button" className="gv-imp-btn gv-imp-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="gv-imp-btn gv-imp-primary" onClick={onContinue}>Continue with import</button>
        </div>
      </div>
    </PurchaseShell>
  );
}

// ── Step 2: Gavelling Import ────────────────────────────────────────────────

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
.gv-buy-panel.gv-imp-flag{max-width:540px;min-height:0}
.gv-buy-panel.gv-imp-flag .gv-buy-body{flex-direction:column}
.gv-imp-flag-body{padding:30px 30px 26px;display:flex;flex-direction:column;gap:12px;font-family:${FONT};color:${INK}}
.gv-imp-flag-icon{width:48px;height:48px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:rgba(139,32,32,0.1);color:${RED}}
.gv-imp-flag-title{margin:4px 0 0;font-size:26px;font-weight:800;letter-spacing:-0.015em;line-height:1.15;padding-right:36px}
.gv-imp-flag-lead{margin:0;font-size:17px;font-weight:700;line-height:1.4;color:${RED}}
.gv-imp-flag-list{margin:0;padding:0 0 0 18px;display:flex;flex-direction:column;gap:6px;font-size:14.5px;line-height:1.5;color:${INK_SOFT}}
.gv-imp-flag-list b{color:${INK};font-weight:700}
.gv-imp-flag-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:10px}
.gv-imp-btn{min-height:46px;padding:0 20px;border-radius:10px;border:none;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:700}
.gv-imp-btn:focus{outline:none}
.gv-imp-btn:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
.gv-imp-primary{background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);color:#FFFFFF}
.gv-imp-secondary{background:#FFFFFF;color:${INK};box-shadow:inset 0 0 0 1.5px ${INK}}
@media (max-width:743px){.gv-imp-flag-body{padding:calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))}}
`;
