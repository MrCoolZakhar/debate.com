'use client';

// DocumentsExtraTab.tsx — the Documents for Everyone list when Document Uploads
// is switched on for the conference (prompt 111). Every read is
// conference_documents_overview; adding and editing go through
// save_conference_document (DocumentPopup), Remove through
// remove_conference_document (the row stops showing, the stored file and every
// returned copy are kept), and "Returned copies" opens DocumentReturnsPopup.
// The move arrows write sort_order exactly as the classic tab does.

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FileText, Library } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useConfirmModal } from '@/components/ConfirmModal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import {
  fetchDocsOverview, formatDocSize, kindInfo, linkHost, openConferenceDoc, removeConferenceDocument,
  type ConferenceDoc, type DocsOverview, type DocsOverviewItem,
} from '@/lib/conferenceDocuments';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, IconDisc, TINT_GOLD } from '../financials/dashboardKit';
import { CD_CSS, EXTRA_CSS, audienceLine, kindIcon } from './docsTabKit';
import DocumentPopup from './DocumentPopup';
import DocumentReturnsPopup from './DocumentReturnsPopup';

export default function DocumentsExtraTab({ conferenceId, initial, initialDocId, onInitialDocUsed }: {
  conferenceId: string;
  initial: DocsOverview;
  /** From ?doc=: open that document's Returned copies once. */
  initialDocId?: string | null;
  onInitialDocUsed?: () => void;
}) {
  const [overview, setOverview] = useState<DocsOverview>(initial);
  const [dialog, setDialog] = useState<{ mode: 'add' } | { mode: 'edit'; doc: DocsOverviewItem } | null>(null);
  const [returnsOf, setReturnsOf] = useState<DocsOverviewItem | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, modal: confirmModal } = useConfirmModal();

  const reload = useCallback(async () => {
    const res = await fetchDocsOverview(conferenceId);
    if (res.ok) setOverview(res);
  }, [conferenceId]);

  // The ?doc= deep link opens that document's Returned copies, once.
  useEffect(() => {
    if (!initialDocId) return;
    const doc = overview.documents.find(d => d.id === initialDocId);
    if (doc) void Promise.resolve().then(() => setReturnsOf(doc));
    onInitialDocUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDocId]);

  const docs = overview.documents;

  async function move(index: number, dir: -1 | 1) {
    if (busy) return;
    const target = index + dir;
    if (target < 0 || target >= docs.length) return;
    const previous = overview;
    const next = [...docs];
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((d, i) => ({ ...d, sort_order: i }));
    const changed = renumbered.filter(d => docs.find(p => p.id === d.id)?.sort_order !== d.sort_order);
    setOverview({ ...overview, documents: renumbered });
    setBusy(true);
    const supabase = await getFreshAuthedClient();
    const results = supabase ? await Promise.all(changed.map(d =>
      supabase.from('conference_documents').update({ sort_order: d.sort_order }).eq('id', d.id).select('id'),
    )) : null;
    setBusy(false);
    const failed = !results || results.some(r => r.error || (r.data ?? []).length === 0);
    if (failed) {
      setOverview(previous);
      notifyErr("Couldn't change the order. Please try again.", 'conference-docs');
      void reload();
    }
  }

  async function remove(doc: DocsOverviewItem) {
    if (busy) return;
    const { confirmed } = await confirm({
      title: 'Remove This Document?',
      body: `"${doc.title}" disappears from every participant's page. Copies people already sent back are kept.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    setBusy(true);
    const res = await removeConferenceDocument(doc.id);
    setBusy(false);
    if (!res.ok) { notifyErr(res.error, 'conference-docs'); return; }
    notifyOk('Document removed', 'conference-docs');
    void reload();
  }

  async function open(doc: DocsOverviewItem) {
    const client = await getFreshAuthedClient();
    const ok = client ? await openConferenceDoc(client, doc as unknown as ConferenceDoc) : false;
    if (!ok) notifyErr("Couldn't open the document. Please try again.", 'conference-docs');
  }

  const toReview = overview.to_review;

  return (
    <div className="gv-st flex flex-col gap-6" style={{ maxWidth: 900 }}>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CD_CSS}</style>
      <style>{EXTRA_CSS}</style>

      <section className="gv-st-card gv-fd-card gv-fd-wash-gold gv-cd-hero" aria-label="Documents for everyone">
        <span className="gv-cd-hero-disc"><IconDisc icon={{ emoji: 'Books', lucide: Library, tint: TINT_GOLD }} size={68} /></span>
        <h2 className="gv-cd-hero-title">Documents for Everyone</h2>
        <p className="gv-cd-hero-line">Rules of Procedure, schedules, forms to fill in and anything else your participants need. They find them on their You tab.</p>
        <div className="gv-cd-hero-foot">
          <span className="gv-cd-count">
            <span className="gv-st-big">{docs.length}</span>
            <span className="gv-cd-count-word">{docs.length === 1 ? 'document shared' : 'documents shared'}</span>
          </span>
          <button type="button" className="gv-st-btn gv-st-forest" onClick={() => setDialog({ mode: 'add' })}>Add a document</button>
        </div>
        {toReview > 0 && (
          <div className="gv-cd-hero-review">
            <span>{toReview} returned {toReview === 1 ? 'copy' : 'copies'} to review</span>
            <button
              type="button"
              className="gv-st-btn gv-st-outline"
              onClick={() => { const first = docs.find(d => d.to_review > 0); if (first) setReturnsOf(first); }}
            >
              Review now
            </button>
          </div>
        )}
      </section>

      {docs.length === 0 ? (
        <section className="gv-st-card gv-fd-card">
          <div className="gv-cd-empty">
            <IconDisc icon={{ emoji: 'Scroll', lucide: FileText, tint: TINT_GOLD }} size={72} />
            <p className="gv-cd-empty-title">No documents yet</p>
            <button type="button" className="gv-st-btn gv-st-forest" style={{ minHeight: 50, padding: '0 22px', fontSize: 15.5 }} onClick={() => setDialog({ mode: 'add' })}>
              Add a document
            </button>
          </div>
        </section>
      ) : (
        <ul className="gv-cd-rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {docs.map((doc, i) => {
            const info = kindInfo(doc.kind);
            const source = doc.url ? linkHost(doc.url) : [doc.file_name, formatDocSize(doc.file_size_bytes)].filter(Boolean).join(', ');
            const some = (doc.visible_to ?? []).length > 0;
            return (
              <li key={doc.id} className="gv-cd-row">
                <IconDisc icon={kindIcon(doc.kind)} size={54} />
                <div className="gv-cd-row-main">
                  <p className="gv-cd-row-title">{doc.title}</p>
                  <p className="gv-cd-row-sub">{info.label}{source ? ` · ${source}` : ''}</p>
                  {doc.description && <p className="gv-cd-row-desc" title={doc.description}>{doc.description}</p>}
                  {doc.ask_back && (
                    <p className="gv-cd-row-ret">
                      <span><b>{doc.returned}</b> of {doc.audience} returned</span>
                      {doc.to_review > 0 && <span className="gv-cd-gold">{doc.to_review} to review</span>}
                      {doc.due_label && <span>Due {doc.due_label}</span>}
                      {doc.required && <span style={{ fontWeight: 700 }}>Required</span>}
                    </p>
                  )}
                  <span className="gv-cd-row-who" data-some={some}>
                    {audienceLine(doc.visible_to)}{doc.accepted_only ? '' : ' · Including applicants under review'}
                  </span>
                </div>
                <div className="gv-cd-row-actions">
                  <button type="button" className="gv-st-btn gv-st-outline" onClick={() => open(doc)}>Open</button>
                  <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => setDialog({ mode: 'edit', doc })}>Edit</button>
                  {doc.ask_back && (
                    <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setReturnsOf(doc)}>Returned copies</button>
                  )}
                  <button type="button" className="gv-cd-move" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${doc.title} up`} title="Move up">
                    <ArrowUp size={19} strokeWidth={2.4} />
                  </button>
                  <button type="button" className="gv-cd-move" disabled={busy || i === docs.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${doc.title} down`} title="Move down">
                    <ArrowDown size={19} strokeWidth={2.4} />
                  </button>
                  <button type="button" className="gv-st-link gv-cd-del" style={{ padding: '0 8px', minHeight: 44 }} disabled={busy} onClick={() => remove(doc)}>Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <DocumentPopup
          conferenceId={conferenceId}
          editing={dialog.mode === 'edit' ? dialog.doc : null}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); void reload(); }}
        />
      )}
      {returnsOf && (
        <DocumentReturnsPopup
          documentId={returnsOf.id}
          title={returnsOf.title}
          onClose={() => { setReturnsOf(null); void reload(); }}
        />
      )}
      {confirmModal}
    </div>
  );
}
