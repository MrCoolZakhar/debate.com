'use client';

/**
 * Additional Documents (prompt 130, 16 Oct 2026): under Things to Do on the
 * Documents page. The number of documents shared, "View Documents" and
 * "Add Document".
 *
 * View Documents is a pop-up listing every document (ConferenceDocsTab in its
 * pop-up mode: the extra list when docs_extra is on, the classic list when it
 * is off), with "Add Document" at its top right. "View submissions" on a
 * document that asks for copies back turns the pop-up into that document's
 * returned copies (DocumentReturnsPopup, with a back arrow). Add Document is
 * the step flow (DocumentPopup).
 */

import { useCallback, useEffect, useState } from 'react';
import { Library } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { fetchDocsOverview, loadConferenceDocs, type DocsOverviewItem } from '@/lib/conferenceDocuments';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, IconDisc, TINT_GOLD } from '../financials/dashboardKit';
import ConferenceDocsTab from './ConferenceDocsTab';
import DocumentPopup from './DocumentPopup';
import DocumentReturnsPopup from './DocumentReturnsPopup';

const FONT = "var(--font-brand), sans-serif";

export default function AdditionalDocuments({ conferenceId, extra, initialDocId, onInitialDocUsed, onChanged }: {
  conferenceId: string;
  /** docs_extra on: the extra list, View submissions and step 4 of the flow. */
  extra: boolean;
  /** ?tab=everyone&doc=<id>: open that document's submissions once. */
  initialDocId?: string | null;
  onInitialDocUsed?: () => void;
  /** Something changed here (the page refreshes Things to Do). */
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [count, setCount] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [returnsOf, setReturnsOf] = useState<DocsOverviewItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [deepDoc, setDeepDoc] = useState<string | null>(null);

  const loadCount = useCallback(async () => {
    if (!userId) return;
    if (extra) {
      const res = await fetchDocsOverview(conferenceId);
      if (res.ok) setCount(res.documents.length);
      return;
    }
    const c = await getFreshAuthedClient();
    if (!c) return;
    const res = await loadConferenceDocs(c, conferenceId);
    if (res.kind === 'ok') setCount(res.docs.length);
  }, [userId, extra, conferenceId]);

  useEffect(() => { void Promise.resolve().then(() => loadCount()); }, [loadCount]);

  // A ?doc= deep link opens View Documents, which opens that document's copies.
  if (initialDocId && deepDoc !== initialDocId) {
    setDeepDoc(initialDocId);
    setListOpen(true);
  }

  const refresh = () => { setListKey(k => k + 1); void loadCount(); onChanged?.(); };

  return (
    <section className="gv-docs-card gv-adoc-card" aria-labelledby="gv-adoc-title">
      <style>{CARD_CSS}</style>
      <div className="gv-adoc-row">
        <IconDisc icon={{ emoji: 'Books', lucide: Library, tint: TINT_GOLD }} size={54} />
        <div className="min-w-0" style={{ flex: '1 1 160px' }}>
          <h2 id="gv-adoc-title" className="gv-docs-title">Additional Documents</h2>
          <p className="gv-adoc-count">
            <span className="gv-adoc-big">{count ?? '…'}</span>
            <span>{count === 1 ? 'document shared' : 'documents shared'}</span>
          </p>
        </div>
        <div className="gv-adoc-actions">
          <button type="button" className="gv-docs-btn gv-docs-btn-outline" onClick={() => setListOpen(true)}>View Documents</button>
          <button type="button" className="gv-docs-btn gv-docs-btn-primary" onClick={() => setAdding(true)}>Add Document</button>
        </div>
      </div>

      {listOpen && !returnsOf && (
        <>
          <style>{PURCHASE_CSS}</style>
          <style>{STORE_CSS}</style>
          <style>{DASH_CSS}</style>
          <PurchaseShell tone="light" label="Documents" onClose={() => { setListOpen(false); refresh(); }} panelClass="gv-adoc-pop" testId="additional-documents">
            <div className="gv-adoc-pop-body">
              <div className="gv-adoc-pop-head">
                <h2 className="gv-fd-pop-title" style={{ margin: 0 }}>Additional Documents</h2>
                <button type="button" className="gv-st-btn gv-st-forest" onClick={() => setAdding(true)}>Add Document</button>
              </div>
              <ConferenceDocsTab
                key={listKey}
                conferenceId={conferenceId}
                inPopup
                initialDocId={initialDocId}
                onInitialDocUsed={onInitialDocUsed}
                onViewSubmissions={extra ? doc => setReturnsOf(doc) : undefined}
              />
            </div>
          </PurchaseShell>
        </>
      )}

      {returnsOf && (
        <DocumentReturnsPopup
          documentId={returnsOf.id}
          title={returnsOf.title}
          onBack={() => { setReturnsOf(null); setListKey(k => k + 1); }}
          onClose={() => { setReturnsOf(null); setListOpen(false); refresh(); }}
        />
      )}

      {adding && (
        <DocumentPopup
          conferenceId={conferenceId}
          extra={extra}
          editing={null}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); refresh(); }}
        />
      )}
    </section>
  );
}

const CARD_CSS = `
.gv-adoc-card{flex:0 0 auto}
.gv-adoc-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.gv-adoc-count{margin:6px 0 0;display:flex;align-items:baseline;gap:8px;font-family:${FONT};font-size:14.5px;font-weight:600;color:#5A5046}
.gv-adoc-big{font-size:32px;font-weight:900;letter-spacing:-0.02em;line-height:1;color:#1C1410;font-variant-numeric:tabular-nums}
.gv-adoc-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
.gv-buy-panel.gv-adoc-pop{max-width:1040px;width:100%;min-height:0;max-height:calc(100dvh - 48px)}
.gv-buy-panel.gv-adoc-pop .gv-buy-body{flex-direction:column;min-height:0;overflow-y:auto}
.gv-adoc-pop-body{padding:26px 28px 28px;display:flex;flex-direction:column;gap:18px;width:100%;box-sizing:border-box}
.gv-adoc-pop-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-right:44px}
@media (max-width:743px){.gv-buy-panel.gv-adoc-pop{max-height:100dvh;height:100dvh;border-radius:0}}
`;
