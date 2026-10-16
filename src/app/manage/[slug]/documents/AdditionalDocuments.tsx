'use client';

/**
 * Additional Documents (prompt 130, 16 Oct 2026; one pop-up since prompt 131):
 * under Things to Do on the Documents page. The number of documents shared,
 * "View Documents" and "Add Document", in the Financials card look.
 *
 * Everything opens in ONE pop-up whose content changes (owner: a pop-up never
 * opens another pop-up on top of itself): the list (ConferenceDocsTab in its
 * pop-up mode), the add flow (DocumentPopup embedded, step 1 has "Back to
 * Documents"), Edit (the same flow on Review) and a document's submissions
 * (DocumentReturnsPopup embedded). Add from the page card opens straight on the
 * flow; its "Back to Documents" shows the list. After a save the list is shown.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { fetchDocsOverview, loadConferenceDocs, type DocsOverviewItem } from '@/lib/conferenceDocuments';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, DashCard, TINT_GOLD } from '../financials/dashboardKit';
import ConferenceDocsTab from './ConferenceDocsTab';
import DocumentPopup, { type EditableDoc } from './DocumentPopup';
import DocumentReturnsPopup from './DocumentReturnsPopup';

type View =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; doc: EditableDoc }
  | { kind: 'returns'; doc: DocsOverviewItem };


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
  /** null = closed. The one pop-up shows one view at a time. */
  const [view, setView] = useState<View | null>(null);
  const [listKey, setListKey] = useState(0);
  const [flowSize, setFlowSize] = useState<'narrow' | 'wide'>('narrow');
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

  // A ?doc= deep link opens the list, which opens that document's copies.
  if (initialDocId && deepDoc !== initialDocId) {
    setDeepDoc(initialDocId);
    setView({ kind: 'list' });
  }

  const refresh = () => { setListKey(k => k + 1); void loadCount(); onChanged?.(); };
  const toList = () => { setView({ kind: 'list' }); setListKey(k => k + 1); };
  const close = () => { setView(null); refresh(); };
  const onFlowSize = useCallback((size: 'narrow' | 'wide') => setFlowSize(size), []);

  const inFlow = view?.kind === 'add' || view?.kind === 'edit';
  const panelClass = view?.kind === 'returns' ? 'gv-cd-rev'
    : inFlow ? (flowSize === 'wide' ? 'gv-cd-rev' : 'gv-cd-pop')
    : 'gv-adoc-pop';
  const label = view?.kind === 'add' ? 'Add a document'
    : view?.kind === 'edit' ? 'Edit the document'
    : view?.kind === 'returns' ? `Submissions for ${view.doc.title}`
    : 'Additional Documents';

  return (
    <>
      <style>{CARD_CSS}</style>
      <DashCard
        title="Additional Documents"
        hint="Documents you share with participants, like Rules of Procedure or a consent form. You can ask them to send a copy back"
        icon={{ emoji: 'File folder', lucide: FolderOpen, tint: TINT_GOLD }}
        hang="start"
        className="gv-docs-dash gv-adoc-card"
      >
        <div className="gv-adoc-mid">
          <span className="gv-fd-todo-num">{count ?? '…'}</span>
          <span className="gv-fd-todo-word">{count === 1 ? 'document shared' : 'documents shared'}</span>
        </div>
        <div className="gv-fd-foot">
          <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setView({ kind: 'list' })}>View Documents</button>
          <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { setFlowSize('narrow'); setView({ kind: 'add' }); }}>Add Document</button>
        </div>
      </DashCard>

      {view && (
        <>
          <style>{PURCHASE_CSS}</style>
          <style>{STORE_CSS}</style>
          <style>{DASH_CSS}</style>
          <PurchaseShell tone="light" label={label} onClose={close} panelClass={panelClass} testId="additional-documents">
            {view.kind === 'list' && (
              <div className="gv-adoc-pop-body">
                <div className="gv-adoc-pop-head">
                  <h2 className="gv-fd-pop-title" style={{ margin: 0 }}>Additional Documents</h2>
                  <button type="button" className="gv-st-btn gv-st-forest" onClick={() => { setFlowSize('narrow'); setView({ kind: 'add' }); }}>Add Document</button>
                </div>
                <ConferenceDocsTab
                  key={listKey}
                  conferenceId={conferenceId}
                  inPopup
                  initialDocId={initialDocId}
                  onInitialDocUsed={onInitialDocUsed}
                  onViewSubmissions={extra ? doc => setView({ kind: 'returns', doc }) : undefined}
                  onEdit={doc => { setFlowSize('wide'); setView({ kind: 'edit', doc }); }}
                />
              </div>
            )}

            {inFlow && (
              <div className="gv-adoc-flow">
                {view.kind === 'edit' && (
                  <button type="button" className="gv-st-link gv-adoc-back" onClick={toList}>
                    <ArrowLeft size={16} strokeWidth={2.4} aria-hidden /> Back to Documents
                  </button>
                )}
                <DocumentPopup
                  key={view.kind === 'edit' ? `edit-${view.doc.id}` : 'add'}
                  embedded
                  conferenceId={conferenceId}
                  extra={extra}
                  editing={view.kind === 'edit' ? view.doc : null}
                  onClose={toList}
                  onSaved={() => { refresh(); setView({ kind: 'list' }); }}
                  onBackToList={view.kind === 'add' ? toList : undefined}
                  onPanelChange={onFlowSize}
                />
              </div>
            )}

            {view.kind === 'returns' && (
              <DocumentReturnsPopup
                embedded
                documentId={view.doc.id}
                title={view.doc.title}
                onBack={toList}
                onClose={close}
              />
            )}
          </PurchaseShell>
        </>
      )}
    </>
  );
}

const CARD_CSS = `
.gv-adoc-mid{display:flex;align-items:baseline;flex-wrap:wrap;margin-top:auto;padding-top:8px}
.gv-buy-panel.gv-adoc-pop{max-width:1040px;width:100%;min-height:0;max-height:calc(100dvh - 48px)}
.gv-buy-panel.gv-adoc-pop .gv-buy-body{flex-direction:column;min-height:0;overflow-y:auto}
.gv-adoc-pop-body{padding:26px 28px 28px;display:flex;flex-direction:column;gap:18px;width:100%;box-sizing:border-box}
.gv-adoc-pop-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-right:44px}
.gv-adoc-flow{display:flex;flex-direction:column;min-height:0;height:100%;width:100%}
.gv-adoc-back{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;margin:20px 28px 0}
@media (max-width:743px){.gv-buy-panel.gv-adoc-pop{max-height:100dvh;height:100dvh;border-radius:0}}
`;
