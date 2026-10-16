'use client';

// Documents → For everyone (11 Oct 2026). Conference-wide documents (Rules of
// Procedure, logistics, schedules, a code of conduct) that every accepted
// participant reads on the You tab. An organiser adds a PDF or a link, gives it
// a title and a kind, chooses who sees it, edits those three later, reorders
// and deletes.
//
// Backed by `conference_documents` and the PRIVATE `conference-documents`
// bucket (migration `conference_documents`, applied 11 Oct 2026; source
// scratch-conference-documents.sql). Every write asks for `.select('id')` and
// counts the rows, because supabase-js resolves an RLS refusal or a zero-row
// write with `error: null`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileText, Library } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useConfirmModal } from '@/components/ConfirmModal';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, IconDisc, TINT_GOLD } from '../financials/dashboardKit';
import { CD_CSS as CSS, audienceLine, kindIcon } from './docsTabKit';
import {
  CONFERENCE_DOCS_BUCKET,
  formatDocSize, kindInfo, linkHost, loadConferenceDocs, openConferenceDoc,
  fetchDocsOverview, type ConferenceDoc, type DocsOverview, type DocsOverviewItem,
} from '@/lib/conferenceDocuments';
import DocumentsExtraTab from './DocumentsExtraTab';
import DocumentPopup from './DocumentPopup';

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; docs: ConferenceDoc[] };

/**
 * The Documents for Everyone tab. With Document Uploads switched on for the
 * conference (conference_documents_overview answers enabled) it is the new
 * DocumentsExtraTab; when it is off, or that read fails, it is the classic tab
 * below, exactly as before (prompt 111).
 */
export default function ConferenceDocsTab({ conferenceId, initialDocId, onInitialDocUsed, inPopup = false, onViewSubmissions }: {
  conferenceId: string;
  /** From ?doc=: open that document's Returned copies (Document Uploads only). */
  initialDocId?: string | null;
  onInitialDocUsed?: () => void;
  /** Drawn inside the View Documents pop-up (prompt 130): no hero, no Open. */
  inPopup?: boolean;
  /** View submissions on a document that asks for copies back (Document Uploads only). */
  onViewSubmissions?: (doc: DocsOverviewItem) => void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [mode, setMode] = useState<{ key: string; overview: DocsOverview | null } | null>(null);
  const key = `${userId}|${conferenceId}`;

  // Keyed on the user id, never the token.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void fetchDocsOverview(conferenceId).then(res => {
      if (alive) setMode({ key: `${userId}|${conferenceId}`, overview: res.ok && res.enabled ? res : null });
    });
    return () => { alive = false; };
  }, [userId, conferenceId]);

  if (!mode || mode.key !== key) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <style>{DASH_CSS}</style>
        {[0, 1, 2].map(i => <div key={i} className="gv-fd-ph" style={{ height: i === 0 ? 180 : 92 }} />)}
      </div>
    );
  }
  if (mode.overview) {
    return <DocumentsExtraTab conferenceId={conferenceId} initial={mode.overview} initialDocId={initialDocId} onInitialDocUsed={onInitialDocUsed} inPopup={inPopup} onViewSubmissions={onViewSubmissions} />;
  }
  return <ClassicDocsTab conferenceId={conferenceId} inPopup={inPopup} />;
}

function ClassicDocsTab({ conferenceId, inPopup }: { conferenceId: string; inPopup: boolean }) {
  const { session, user } = useAuth();
  const userId = user?.id ?? null;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [dialog, setDialog] = useState<{ mode: 'add' } | { mode: 'edit'; doc: ConferenceDoc } | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, modal: confirmModal } = useConfirmModal();
  const tokenRef = useRef<string | undefined>(session?.access_token);
  useEffect(() => { tokenRef.current = session?.access_token; }, [session?.access_token]);

  // Keyed on the user id, never the token (a token refresh must not refetch).
  const reload = useCallback(async () => {
    const token = tokenRef.current ?? session?.access_token;
    if (!userId || !token) return;
    const res = await loadConferenceDocs(getAuthedClient(token), conferenceId);
    setLoad(res);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, conferenceId]);

  // Started a microtask later so no state is set synchronously in the effect.
  useEffect(() => { void Promise.resolve().then(() => reload()); }, [reload]);

  const docs = load.kind === 'ok' ? load.docs : [];

  async function move(index: number, dir: -1 | 1) {
    if (!session || busy || load.kind !== 'ok') return;
    const target = index + dir;
    if (target < 0 || target >= docs.length) return;
    const previous = docs;
    const next = [...docs];
    [next[index], next[target]] = [next[target], next[index]];
    // Every row's sort_order becomes its place; only rows that moved are written.
    const renumbered = next.map((d, i) => ({ ...d, sort_order: i }));
    const changed = renumbered.filter(d => previous.find(p => p.id === d.id)?.sort_order !== d.sort_order);
    setLoad({ kind: 'ok', docs: renumbered });
    setBusy(true);
    const supabase = getAuthedClient(session.access_token);
    const results = await Promise.all(changed.map(d =>
      supabase.from('conference_documents').update({ sort_order: d.sort_order }).eq('id', d.id).select('id'),
    ));
    setBusy(false);
    const failed = results.some(r => r.error || (r.data ?? []).length === 0);
    if (failed) {
      setLoad({ kind: 'ok', docs: previous });
      notifyErr("Couldn't change the order. Please try again.", 'conference-docs');
      void reload();
    }
  }

  async function remove(doc: ConferenceDoc) {
    if (!session || busy) return;
    const { confirmed } = await confirm({
      title: 'Delete This Document?',
      body: `"${doc.title}" disappears from every participant's page.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    const previous = docs;
    setLoad({ kind: 'ok', docs: docs.filter(d => d.id !== doc.id) });
    setBusy(true);
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.from('conference_documents').delete().eq('id', doc.id).select('id');
    if (error || (data ?? []).length === 0) {
      setBusy(false);
      setLoad({ kind: 'ok', docs: previous });
      notifyErr(friendlyError(error, "Couldn't delete the document. It is back in the list."), 'conference-docs');
      return;
    }
    // The row is gone, so participants can no longer reach the file (the
    // storage read policy needs the row). The file goes too: tried twice.
    if (doc.file_path) {
      const removed = await removeStoredFile(supabase, doc.file_path)
        || await removeStoredFile(supabase, doc.file_path);
      if (!removed) console.warn('[conference-docs] file left in storage after its row was deleted', doc.file_path);
    }
    setBusy(false);
    notifyOk('Document deleted', 'conference-docs');
  }

  async function open(doc: ConferenceDoc) {
    if (!session) return;
    const ok = await openConferenceDoc(getAuthedClient(session.access_token), doc);
    if (!ok) notifyErr("Couldn't open the document. Please try again.", 'conference-docs');
  }

  return (
    <div className="gv-st flex flex-col gap-6">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CSS}</style>

      {!inPopup && <section className="gv-st-card gv-fd-card gv-fd-wash-gold gv-cd-hero" aria-label="Documents for everyone">
        <span className="gv-cd-hero-disc"><IconDisc icon={{ emoji: 'Books', lucide: Library, tint: TINT_GOLD }} size={68} /></span>
        <h2 className="gv-cd-hero-title">Documents for Everyone</h2>
        <p className="gv-cd-hero-line">Rules of Procedure, logistics and schedules. Accepted participants find them on their You tab.</p>
        {load.kind === 'ok' && (
          <div className="gv-cd-hero-foot">
            <span className="gv-cd-count">
              <span className="gv-st-big">{docs.length}</span>
              <span className="gv-cd-count-word">{docs.length === 1 ? 'document shared' : 'documents shared'}</span>
            </span>
            <button type="button" className="gv-st-btn gv-st-forest" onClick={() => setDialog({ mode: 'add' })}>
              Add a document
            </button>
          </div>
        )}
      </section>}

      {load.kind === 'loading' && (
        <div className="gv-cd-rows" aria-busy="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="gv-fd-ph" style={{ height: 92 }} />
          ))}
        </div>
      )}

      {load.kind === 'error' && (
        <section className="gv-st-card gv-fd-card">
          <p className="gv-st-quiet" style={{ fontSize: 15 }}>Couldn&apos;t load the documents.</p>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="gv-st-btn gv-st-outline" onClick={() => { setLoad({ kind: 'loading' }); void reload(); }}>
              Try again
            </button>
          </div>
        </section>
      )}

      {load.kind === 'ok' && docs.length === 0 && (
        <section className="gv-st-card gv-fd-card">
          <div className="gv-cd-empty">
            <IconDisc icon={{ emoji: 'Scroll', lucide: FileText, tint: TINT_GOLD }} size={72} />
            <p className="gv-cd-empty-title">No documents yet</p>
            {!inPopup && (
              <button type="button" className="gv-st-btn gv-st-forest" style={{ minHeight: 50, padding: '0 22px', fontSize: 15.5 }} onClick={() => setDialog({ mode: 'add' })}>
                Add your Rules of Procedure
              </button>
            )}
          </div>
        </section>
      )}

      {load.kind === 'ok' && docs.length > 0 && (
        <ul className="gv-cd-rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {docs.map((doc, i) => {
            const info = kindInfo(doc.kind);
            const source = doc.url
              ? linkHost(doc.url)
              : [doc.file_name, formatDocSize(doc.file_size_bytes)].filter(Boolean).join(', ');
            const some = (doc.visible_to ?? []).length > 0;
            return (
              <li key={doc.id} className="gv-cd-row">
                <IconDisc icon={kindIcon(doc.kind)} size={54} />
                <div className="gv-cd-row-main">
                  <p className="gv-cd-row-title">{doc.title}</p>
                  <p className="gv-cd-row-sub">
                    {inPopup ? (source || 'No file') : `${info.label}${source ? ` · ${source}` : ''}`}
                  </p>
                  <span className="gv-cd-row-who" data-some={some}>{audienceLine(doc.visible_to)}</span>
                </div>
                <div className="gv-cd-row-actions">
                  {!inPopup && (
                    <button type="button" className="gv-st-btn gv-st-outline" onClick={() => open(doc)}>
                      Open
                    </button>
                  )}
                  <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => setDialog({ mode: 'edit', doc })}>
                    Edit
                  </button>
                  <button type="button" className="gv-cd-move" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${doc.title} up`} title="Move up">
                    <ArrowUp size={19} strokeWidth={2.4} />
                  </button>
                  <button type="button" className="gv-cd-move" disabled={busy || i === docs.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${doc.title} down`} title="Move down">
                    <ArrowDown size={19} strokeWidth={2.4} />
                  </button>
                  <button type="button" className="gv-st-link gv-cd-del" style={{ padding: '0 8px', minHeight: 44 }} disabled={busy} onClick={() => remove(doc)}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialog && session && (
        <DocumentPopup
          conferenceId={conferenceId}
          extra={false}
          editing={dialog.mode === 'edit' ? dialog.doc : null}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); void reload(); }}
        />
      )}
      {confirmModal}
    </div>
  );
}

/** Removes one object and says whether it is really gone (storage answers the
 *  removed objects; an empty list means nothing matched or it was refused). */
async function removeStoredFile(supabase: ReturnType<typeof getAuthedClient>, path: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(CONFERENCE_DOCS_BUCKET).remove([path]);
    return !error && (data ?? []).length > 0;
  } catch {
    return false;
  }
}
