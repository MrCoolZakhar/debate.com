'use client';

// "Import delegates": the delegation card's pop-up (25 Sep 2026), opened by
// the button left of "Paid spots" for a delegation leader while the conference
// allows leader imports. The purchase pop-up shell, light, one column, two
// tabs: Import (the rows, Add row, Paste a list, the stats and the import
// button) and Imported (each imported delegate, status and invite date; the
// tab carries the count). ONE DelegationImportCard instance stays mounted and
// only its `tab` changes, so typed rows survive a tab switch. Every RPC, the
// fresh-token client, the ref guard and "buy the missing credits, then import
// by itself" are the card's own, unchanged.

import { useState } from 'react';
import { CreditCoin } from '@/components/CreditCoin';
import { useCredits } from '@/hooks/useCredits';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { GoldWord } from '@/components/BrandHeading';
import { OUTFIT } from './shared';
import DelegationImportCard, { type LeaderImport } from './DelegationImportCard';

const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';

export default function DelegationImportPopup({
  societyId, data, reload, conferenceAcronym, userEmail, onPledgeMore, onImported, onClose,
}: {
  societyId: string;
  data: LeaderImport;
  reload: () => Promise<void>;
  conferenceAcronym: string;
  userEmail: string | null;
  onPledgeMore: () => void;
  onImported?: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'import' | 'imported'>('import');
  const count = data.imports.length;
  // The leader's own credits, the header counter's number (shared reader, so
  // a purchase updates it at once).
  const { balance } = useCredits();

  return (
    <PurchaseShell tone="light" label="Import delegates" onClose={onClose} panelClass="gv-dimp" testId="delegation-import">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-dimp-body">
        <div>
          <h2 className="gv-buy-title" style={{ fontSize: 30 }}>Import <GoldWord tone="light">Delegates</GoldWord></h2>
          <p className="gv-buy-sub">Add a name and an email for each delegate and we&rsquo;ll invite them to join your delegation</p>
        </div>

        <div className="gv-dimp-tabs" role="tablist" aria-label="Import delegates">
          <button type="button" role="tab" aria-selected={tab === 'import'} className="gv-dimp-tab" onClick={() => setTab('import')}>
            Import
          </button>
          <button type="button" role="tab" aria-selected={tab === 'imported'} className="gv-dimp-tab" onClick={() => setTab('imported')}>
            Imported
            {count > 0 && <span className="gv-dimp-badge" aria-label={`${count} imported`}>{count}</span>}
          </button>
        </div>

        {/* The leader's credits, as the site header shows them: the coin pill.
            A press opens the credits pop-up in the import context. */}
        <div className="gv-dimp-credits">
          <span className="gv-dimp-credits-label">Your credits</span>
          <button
            type="button"
            className="gv-dimp-coin"
            aria-label={`Your credits: ${balance ?? 'loading'}. Buy credits`}
            title="Buy credits"
            onClick={() => openCreditsPopup({ context: 'pay', purpose: 'import', onComplete: () => { void reload(); } })}
          >
            <CreditCoin size={16} />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{balance ?? '–'}</span>
            <span aria-hidden className="gv-dimp-coin-plus">+</span>
          </button>
        </div>

        <div role="tabpanel">
          <DelegationImportCard
            bare
            tab={tab}
            societyId={societyId}
            data={data}
            reload={reload}
            conferenceAcronym={conferenceAcronym}
            userEmail={userEmail}
            onPledgeMore={onPledgeMore}
            onImported={() => { onImported?.(); }}
          />
        </div>
      </div>
    </PurchaseShell>
  );
}

const CSS = `
.gv-buy-panel.gv-dimp{max-width:760px;min-height:0}
.gv-buy-panel.gv-dimp .gv-buy-body{flex-direction:column}
.gv-dimp-body{padding:30px 28px 26px;display:flex;flex-direction:column;gap:18px;font-family:${OUTFIT};color:${INK}}
.gv-dimp-tabs{display:flex;gap:6px;border-bottom:1px solid rgba(28,20,16,0.12)}
.gv-dimp-tab{position:relative;min-height:44px;padding:0 16px;border:none;background:transparent;font-family:${OUTFIT};font-size:14.5px;font-weight:700;color:${INK_SOFT};cursor:pointer;border-bottom:2.5px solid transparent;margin-bottom:-1px}
.gv-dimp-tab[aria-selected="true"]{color:${INK};border-bottom-color:${FOREST}}
.gv-dimp-tab:focus{outline:none}
.gv-dimp-tab:focus-visible{outline:2px solid ${FOREST};outline-offset:-2px;border-radius:8px}
.gv-dimp-credits{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:-6px}
.gv-dimp-credits-label{font-size:12.5px;font-weight:700;color:${INK_SOFT}}
.gv-dimp-coin{position:relative;display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:7px 16px 7px 14px;border:none;border-radius:999px;background:${FOREST};color:#EED98A;font-family:${OUTFIT};font-size:13px;font-weight:700;letter-spacing:0.04em;cursor:pointer;transition:background-color 150ms ease}
.gv-dimp-coin:hover{background:#2A5A3C}
.gv-dimp-coin:focus{outline:none}
.gv-dimp-coin:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-dimp-coin-plus{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:999px;background:#EED98A;color:${FOREST};font-size:13px;font-weight:900;line-height:18px;text-align:center;box-shadow:0 0 0 2px #FAF8F3}
.gv-dimp-badge{position:absolute;top:4px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:${FOREST};color:#EED98A;font-size:11px;font-weight:800;line-height:18px;text-align:center;font-variant-numeric:tabular-nums}
@media (max-width:743px){.gv-dimp-body{padding:calc(22px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))}}
`;
