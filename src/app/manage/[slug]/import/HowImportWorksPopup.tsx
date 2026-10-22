'use client';

// "How Importing Works": the organiser import page's help pop-up (Oct 2026).
// The purchase pop-up shell, one column, like src/app/jobs/JobApplyPopup.tsx.
// ONE pop-up: it never opens another. Every rule below is copied from the
// code that enforces it, so change them together:
//   the columns and their order   CANONICAL_HEADERS, buildImportTemplateCSV (src/lib/applicantImport.ts)
//   the header rule               recordsToRows + page.tsx handleFile ("Missing required column")
//   role, payment, seat values    mapRole / ROLE_ALIASES, mapPayment, classifyImportRows
//   committee and country         matchCommitteeCell (committeeMatch.ts), matchRosterSlot
//   invites                       ImportReview's inviteCount (new rows only)
//   the cost                      IMPORTS_PAID_LAUNCH (importQuote.ts), GavellingImportPopup
// Presentation only: it reads nothing and writes nothing.

import Link from 'next/link';
import { Download } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { CANONICAL_HEADERS, type CanonicalHeader } from '@/lib/applicantImport';
import { IMPORTS_PAID_LAUNCH } from './importQuote';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';

type Column = { what: string; needed: string; values: string };

const COLUMNS: Record<CanonicalHeader, Column> = {
  email: {
    what: 'Where their invite goes',
    needed: 'Yes',
    values: 'A full email address, such as name@school.edu',
  },
  name: {
    what: "The person's full name",
    needed: 'Yes',
    values: 'Any name',
  },
  role: {
    what: 'What they come as',
    needed: 'Yes',
    values: 'delegate, head delegate, faculty advisor or observer. Chairs are invited from Committees',
  },
  delegation: {
    what: 'Their school or delegation',
    needed: 'No',
    values: 'Any name. A new one is added to your delegations',
  },
  payment: {
    what: 'Whether they have paid',
    needed: 'No',
    values: 'paid, unpaid or waived. Empty means unpaid',
  },
  committee: {
    what: 'The committee they sit in',
    needed: 'No',
    values: "One of this conference's committees, by name or abbreviation",
  },
  country: {
    what: 'The country or character they represent',
    needed: 'No, and only with a committee',
    values: "One from that committee's country list",
  },
  seat: {
    what: 'Which seat, in a double delegation',
    needed: 'No',
    values: '1 or 2. Empty fills the next free seat',
  },
};

export default function HowImportWorksPopup({ slug, onClose, onDownloadTemplate }: {
  slug: string;
  onClose: () => void;
  /** The page's own template download, the same one as the button beside the drop zone. */
  onDownloadTemplate: () => void;
}) {
  return (
    <PurchaseShell tone="light" label="How Importing Works" onClose={onClose} panelClass="gv-hiw" testId="import-how-it-works">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-hiw-col">
        <header className="gv-hiw-head">
          <h2 className="gv-hiw-title">How Importing Works</h2>
          <p className="gv-hiw-line">Bring in people you already have, from one spreadsheet</p>
        </header>

        <ol className="gv-hiw-steps">
          <li className="gv-hiw-step">
            <span className="gv-hiw-num" aria-hidden>1</span>
            <div className="gv-hiw-body">
              <h3 className="gv-hiw-stitle">Download the Template</h3>
              <p className="gv-hiw-text">A CSV file with every column already in place. Open it in Excel, Google Sheets or Numbers</p>
              <div>
                <button type="button" className="gv-hiw-btn" onClick={onDownloadTemplate}>
                  <Download size={16} aria-hidden /> Download the template
                </button>
              </div>
            </div>
          </li>

          <li className="gv-hiw-step">
            <span className="gv-hiw-num" aria-hidden>2</span>
            <div className="gv-hiw-body">
              <h3 className="gv-hiw-stitle">Fill One Row per Person</h3>
              <p className="gv-hiw-text">
                Keep all eight column headers in the first row, even when a whole column is empty. A file missing a header is not read
              </p>
              <div className="gv-hiw-scroll">
                <table className="gv-hiw-table">
                  <thead>
                    <tr>
                      <th scope="col">Column</th>
                      <th scope="col">What it is</th>
                      <th scope="col">Needed</th>
                      <th scope="col">What to write</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CANONICAL_HEADERS.map(h => (
                      <tr key={h}>
                        <th scope="row"><code>{h}</code></th>
                        <td>{COLUMNS[h].what}</td>
                        <td>{COLUMNS[h].needed}</td>
                        <td>{COLUMNS[h].values}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="gv-hiw-text gv-hiw-small">
                Headers and values can be in any capitals. A committee or country we cannot match still imports the person, without a seat
              </p>
            </div>
          </li>

          <li className="gv-hiw-step">
            <span className="gv-hiw-num" aria-hidden>3</span>
            <div className="gv-hiw-body">
              <h3 className="gv-hiw-stitle">Upload and Check</h3>
              <p className="gv-hiw-text">
                Drop the file on this page, as CSV or Excel. You see every row first: ready, without a seat (they come in and you seat them later), or skipped (a missing email, name or role, or a value we do not accept). Fix a skipped row in place or leave it out
              </p>
              <p className="gv-hiw-text">Nothing is imported until you press Import and confirm</p>
            </div>
          </li>

          <li className="gv-hiw-step">
            <span className="gv-hiw-num" aria-hidden>4</span>
            <div className="gv-hiw-body">
              <h3 className="gv-hiw-stitle">What Happens Next</h3>
              <p className="gv-hiw-text">
                Everyone new gets an invite by email to join Gavelling and claim their place. People you import again are updated, never invited twice
              </p>
              <p className="gv-hiw-text">
                {IMPORTS_PAID_LAUNCH
                  ? 'Importing costs 1 credit for each new delegate, head delegate, faculty advisor or observer. People you import again are free, and you see the total before anything is taken'
                  : 'Importing is free'}
              </p>
            </div>
          </li>
        </ol>

        <p className="gv-hiw-foot">
          Faculty advisors and head delegates can also import their own delegation. Turn on &ldquo;Let delegation leaders import their delegates&rdquo; in{' '}
          <Link href={`/manage/${slug}/settings?tab=delegations`} className="gv-hiw-a">Settings &gt; Delegations</Link>.
        </p>
      </div>
    </PurchaseShell>
  );
}

const CSS = `
.gv-buy-panel.gv-hiw{max-width:720px;min-height:0}
.gv-buy-panel.gv-hiw .gv-buy-body{display:block}
.gv-hiw-col{display:flex;flex-direction:column;gap:22px;padding:34px 32px 30px;font-family:${FONT};color:${INK}}
.gv-hiw-head{padding-right:40px}
.gv-hiw-title{margin:0;font-size:clamp(24px,3vw,30px);font-weight:800;letter-spacing:-0.02em;line-height:1.12;color:${INK};text-wrap:balance}
.gv-hiw-line{margin:6px 0 0;font-size:15.5px;line-height:1.5;color:${INK_SOFT}}
.gv-hiw-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}
.gv-hiw-step{display:flex;gap:14px;align-items:flex-start;padding:18px;border-radius:16px;background:#FFFFFF;box-shadow:0 1px 2px rgba(27,56,40,0.05),0 4px 14px rgba(27,56,40,0.06);min-width:0}
.gv-hiw-num{flex-shrink:0;width:28px;height:28px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;font-size:13.5px;font-weight:700;background:rgba(238,217,138,0.55);color:#4A3410;font-variant-numeric:tabular-nums}
.gv-hiw-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}
.gv-hiw-stitle{margin:2px 0 0;font-size:17px;font-weight:700;letter-spacing:-0.01em;line-height:1.3;color:${INK}}
.gv-hiw-text{margin:0;font-size:15px;line-height:1.55;color:#3E352C;text-wrap:pretty}
.gv-hiw-small{font-size:13.5px;color:${INK_SOFT}}
.gv-hiw-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;border-radius:10px;cursor:pointer;font-family:${FONT};font-size:15px;font-weight:600;color:${INK};background:#FFFFFF;border:1.5px solid rgba(28,20,16,0.22)}
.gv-hiw-btn:hover{border-color:rgba(27,56,40,0.5)}
.gv-hiw-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:12px;border:1px solid rgba(27,56,40,0.1)}
.gv-hiw-table{width:100%;min-width:540px;border-collapse:collapse;font-size:13.5px;line-height:1.45;color:${INK}}
.gv-hiw-table th,.gv-hiw-table td{padding:9px 12px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.gv-hiw-table thead th{font-size:12.5px;font-weight:700;color:${INK_SOFT};background:#F7F4EC}
.gv-hiw-table tbody tr + tr > *{border-top:1px solid rgba(27,56,40,0.08)}
.gv-hiw-table tbody th{font-weight:600;white-space:nowrap}
.gv-hiw-table code{font-family:${FONT};font-weight:700;color:${FOREST}}
.gv-hiw-foot{margin:0;font-size:14.5px;line-height:1.55;color:#3E352C}
.gv-hiw-a{font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px}
.gv-hiw :is(button,a):focus{outline:none}
.gv-hiw :is(button,a):focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (max-width:743px){
  .gv-hiw-col{padding:calc(24px + env(safe-area-inset-top)) 18px calc(24px + env(safe-area-inset-bottom))}
  .gv-hiw-step{padding:14px;gap:12px}
}
`;
