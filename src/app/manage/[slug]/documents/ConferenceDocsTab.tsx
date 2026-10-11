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
import { ArrowDown, ArrowUp, Check, FileText, Library, Upload } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { useConfirmModal } from '@/components/ConfirmModal';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, IconDisc, TINT_GOLD, TINT_GREEN, INK, INK_SOFT, FOREST, DANGER } from '../financials/dashboardKit';
import {
  CONFERENCE_DOC_KINDS, CONFERENCE_DOCS_BUCKET, CONFERENCE_DOC_MAX_BYTES, CONFERENCE_DOC_TITLE_MAX,
  conferenceDocPath, formatDocSize, kindInfo, linkHost, loadConferenceDocs, normaliseDocUrl, openConferenceDoc,
  type ConferenceDoc, type ConferenceDocKind,
} from '@/lib/conferenceDocuments';

/** Roles an organiser can narrow a document to. Empty = everyone accepted. */
const ROLE_CHOICES: { key: string; label: string }[] = [
  { key: 'delegate', label: 'Delegates' },
  { key: 'head-delegate', label: 'Head delegates' },
  { key: 'faculty-advisor', label: 'Faculty advisors' },
  { key: 'observer', label: 'Observers' },
  { key: 'chair', label: 'Chairs' },
  { key: 'secretariat', label: 'Secretariat' },
  { key: 'staff', label: 'Staff' },
];

function audienceLine(visibleTo: string[]): string {
  if (!visibleTo || visibleTo.length === 0) return 'Everyone accepted';
  const names = ROLE_CHOICES.filter(r => visibleTo.includes(r.key)).map(r => r.label);
  return names.length ? `Only ${names.join(', ')}` : 'Everyone accepted';
}

function kindIcon(kind: string) {
  const info = kindInfo(kind);
  return { emoji: info.emoji, lucide: info.lucide ?? FileText, tint: info.tint === 'green' ? TINT_GREEN : TINT_GOLD };
}

const CSS = `
.gv-cd-hero{position:relative;margin-top:30px;padding:46px 28px 26px!important}
.gv-cd-hero-disc{position:absolute;top:-34px;left:26px}
.gv-cd-hero-title{margin:0;font-size:clamp(28px,3vw,34px);font-weight:800;letter-spacing:-0.02em;line-height:1.1;color:${INK}}
.gv-cd-hero-line{margin:8px 0 0;font-size:15px;line-height:1.5;color:${INK_SOFT};max-width:560px}
.gv-cd-hero-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:20px}
.gv-cd-count{display:inline-flex;align-items:baseline;gap:10px}
.gv-cd-count-word{font-size:16px;font-weight:700;color:${INK}}
.gv-cd-hero .gv-st-btn{min-height:50px;padding:0 22px;font-size:15.5px}
.gv-cd-rows{display:flex;flex-direction:column;gap:14px}
.gv-cd-row{display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:20px;background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -30px rgba(27,56,40,0.45)}
.gv-cd-row-main{flex:1 1 auto;min-width:0}
.gv-cd-row-title{margin:0;font-size:17.5px;font-weight:800;line-height:1.3;color:${INK};overflow-wrap:anywhere}
.gv-cd-row-sub{margin:4px 0 0;font-size:14px;line-height:1.45;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-cd-row-who{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:8px;font-size:13px;font-weight:700;color:${FOREST};background:rgba(61,122,82,0.10)}
.gv-cd-row-who[data-some="true"]{color:#7A5A10;background:rgba(238,217,138,0.40)}
.gv-cd-row-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
.gv-cd-row-actions .gv-st-btn{min-height:44px;padding:0 16px;font-size:14.5px}
.gv-cd-move{width:44px;height:44px;border-radius:12px;border:none;background:#F6F3EC;color:${FOREST};display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.gv-cd-move:hover:not(:disabled){background:#EFE9DC}
.gv-cd-move:disabled{opacity:0.35;cursor:default}
.gv-cd-move:focus{outline:none}
.gv-cd-move:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cd-del{color:${DANGER}!important;font-size:14.5px;font-weight:700;text-decoration:underline;text-underline-offset:3px}
@media (max-width:700px){.gv-cd-row{flex-wrap:wrap}.gv-cd-row-actions{width:100%;justify-content:flex-start;padding-left:68px}}
.gv-cd-kinds{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.gv-cd-kind{display:flex;align-items:center;gap:10px;min-height:58px;padding:6px 12px 6px 6px;border-radius:14px;border:1.5px solid rgba(27,56,40,0.18);background:#FFFFFF;color:${INK};font-family:inherit;font-size:14.5px;font-weight:700;text-align:left;cursor:pointer}
.gv-cd-kind[aria-checked="true"]{border-color:${FOREST};box-shadow:0 0 0 1px ${FOREST};background:rgba(61,122,82,0.06)}
.gv-cd-kind:focus{outline:none}
.gv-cd-kind:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cd-input{width:100%;height:50px;padding:0 14px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;color:${INK};font-family:inherit;font-size:16px}
.gv-cd-input:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-cd-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;min-height:136px;padding:18px;border-radius:14px;border:2px dashed rgba(27,56,40,0.28);background:#FAF8F3;color:${INK};font-family:inherit;cursor:pointer}
.gv-cd-drop:hover,.gv-cd-drop[data-over="true"]{border-color:${FOREST};background:#F6F3EC}
.gv-cd-drop:focus{outline:none}
.gv-cd-drop:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cd-file{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:rgba(61,122,82,0.08)}
.gv-cd-chips{display:flex;flex-wrap:wrap;gap:8px}
.gv-cd-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid rgba(27,56,40,0.22);background:#FFFFFF;color:${INK};font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer}
.gv-cd-chip[aria-checked="true"],.gv-cd-chip[aria-pressed="true"]{background:${FOREST};border-color:${FOREST};color:#EED98A}
.gv-cd-chip:focus{outline:none}
.gv-cd-chip:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cd-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding:30px 12px 12px}
.gv-cd-empty-title{margin:0;font-size:22px;font-weight:800;color:${INK}}
`;

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; docs: ConferenceDoc[] };

export default function ConferenceDocsTab({ conferenceId }: { conferenceId: string }) {
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
    <div className="gv-st flex flex-col gap-6" style={{ maxWidth: 900 }}>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CSS}</style>

      <section className="gv-st-card gv-fd-card gv-fd-wash-gold gv-cd-hero" aria-label="Documents for everyone">
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
      </section>

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
            <button type="button" className="gv-st-btn gv-st-forest" style={{ minHeight: 50, padding: '0 22px', fontSize: 15.5 }} onClick={() => setDialog({ mode: 'add' })}>
              Add your Rules of Procedure
            </button>
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
                    {info.label}{source ? ` · ${source}` : ''}
                  </p>
                  <span className="gv-cd-row-who" data-some={some}>{audienceLine(doc.visible_to)}</span>
                </div>
                <div className="gv-cd-row-actions">
                  <button type="button" className="gv-st-btn gv-st-outline" onClick={() => open(doc)}>
                    Open
                  </button>
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
        <DocumentDialog
          conferenceId={conferenceId}
          editing={dialog.mode === 'edit' ? dialog.doc : null}
          nextOrder={docs.reduce((m, d) => Math.max(m, d.sort_order + 1), 0)}
          onClose={() => setDialog(null)}
          onSaved={(edited) => {
            setDialog(null);
            notifyOk(edited ? 'Document saved' : 'Document added', 'conference-docs');
            void reload();
          }}
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

// ── Add or edit a document ─────────────────────────────────────────────────────

function DocumentDialog({ conferenceId, editing, nextOrder, onClose, onSaved }: {
  conferenceId: string;
  /** The document being edited, or null to add a new one. */
  editing: ConferenceDoc | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: (edited: boolean) => void;
}) {
  const { session, user } = useAuth();
  const isEdit = !!editing;
  const [kind, setKind] = useState<ConferenceDocKind>(editing?.kind ?? 'rop');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [titleTouched, setTitleTouched] = useState(isEdit);
  const [source, setSource] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [everyone, setEveryone] = useState((editing?.visible_to ?? []).length === 0);
  const [roles, setRoles] = useState<string[]>(editing?.visible_to ?? []);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [over, setOver] = useState(false);
  const savingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The title follows the kind until the organiser types one of their own.
  const shownTitle = titleTouched ? title : (kind === 'other' ? title : kindInfo(kind).label);

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!isPdf) { setErr('Only PDF files can be uploaded. For anything else, add a link.'); return; }
    if (f.size > CONFERENCE_DOC_MAX_BYTES) { setErr('The PDF must be 10 MB or smaller.'); return; }
    setErr('');
    setFile(f);
  }

  const cleanTitle = shownTitle.trim();
  const linkValue = normaliseDocUrl(link);
  const audienceOk = everyone || roles.length > 0;
  const sourceOk = isEdit || (source === 'file' ? !!file : !!linkValue);
  const ready = cleanTitle.length > 0 && cleanTitle.length <= CONFERENCE_DOC_TITLE_MAX && sourceOk && audienceOk;

  async function save() {
    if (!session || !ready || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setErr('');
    const supabase = getAuthedClient(session.access_token);
    const visibleTo = everyone ? [] : roles;

    if (editing) {
      try {
        const { data, error } = await supabase.from('conference_documents')
          .update({ title: cleanTitle, kind, visible_to: visibleTo })
          .eq('id', editing.id)
          .select('id');
        if (error || (data ?? []).length === 0) throw error ?? new Error('not saved');
        onSaved(true);
      } catch (e) {
        setErr(friendlyError(e, "Couldn't save the changes. Please try again."));
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
      return;
    }

    let path: string | null = null;
    try {
      if (source === 'file' && file) {
        path = conferenceDocPath(conferenceId, file.name);
        const { error: upErr } = await supabase.storage.from(CONFERENCE_DOCS_BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false });
        if (upErr) { path = null; throw upErr; }
      }
      const { data, error } = await supabase.from('conference_documents').insert({
        conference_id: conferenceId,
        title: cleanTitle,
        kind,
        file_path: path,
        file_name: source === 'file' && file ? file.name : null,
        file_size_bytes: source === 'file' && file ? file.size : null,
        url: source === 'link' ? linkValue : null,
        visible_to: visibleTo,
        sort_order: nextOrder,
        created_by: user?.id ?? null,
      }).select('id');
      if (error || (data ?? []).length === 0) throw error ?? new Error('not saved');
      onSaved(false);
    } catch (e) {
      // A file uploaded for a row that was refused would be an orphan.
      if (path) void removeStoredFile(supabase, path);
      setErr(friendlyError(e, "Couldn't add the document. Please try again."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const label = isEdit ? 'Edit the document' : 'Add a document';
  const editingSource = editing
    ? (editing.url ? linkHost(editing.url) : [editing.file_name, formatDocSize(editing.file_size_bytes)].filter(Boolean).join(', '))
    : '';

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CSS}</style>
      <PurchaseShell tone="light" label={label} onClose={() => { if (!savingRef.current) onClose(); }} panelClass="gv-fd-mid" testId="conference-docs-dialog">
        <div className="gv-fd-pop gv-st" style={{ overflowY: 'auto' }}>
          <h2 className="gv-fd-pop-title">{isEdit ? 'Edit the Document' : 'Add a Document'}</h2>

          <div>
            <p className="gv-fd-label" id="gv-cd-kind-l">What is it?</p>
            <div className="gv-cd-kinds" role="radiogroup" aria-labelledby="gv-cd-kind-l">
              {CONFERENCE_DOC_KINDS.map(k => (
                <button
                  key={k.key}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.key}
                  className="gv-cd-kind"
                  disabled={saving}
                  onClick={() => setKind(k.key)}
                >
                  <IconDisc icon={kindIcon(k.key)} size={42} />
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{k.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="gv-fd-label" htmlFor="gv-cd-title">Title</label>
            <input
              id="gv-cd-title"
              className="gv-cd-input"
              value={shownTitle}
              maxLength={CONFERENCE_DOC_TITLE_MAX}
              disabled={saving}
              placeholder="e.g. Delegate Handbook"
              onChange={e => { setTitleTouched(true); setTitle(e.target.value); }}
            />
          </div>

          {isEdit ? (
            <div>
              <p className="gv-fd-label">{editing?.url ? 'Link' : 'File'}</p>
              <div className="gv-cd-file">
                <Check size={18} strokeWidth={2.6} style={{ color: FOREST, flexShrink: 0 }} aria-hidden />
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{editingSource}</p>
              </div>
              <p className="gv-fd-note" style={{ marginTop: 8 }}>To use a different file or link, add it as a new document and delete this one.</p>
            </div>
          ) : (
            <div>
              <p className="gv-fd-label" id="gv-cd-src-l">Add it as</p>
              <div className="gv-st-dir" role="radiogroup" aria-labelledby="gv-cd-src-l" style={{ marginBottom: 10 }}>
                <button type="button" role="radio" aria-checked={source === 'file'} disabled={saving} onClick={() => { setSource('file'); setErr(''); }}>A PDF</button>
                <button type="button" role="radio" aria-checked={source === 'link'} disabled={saving} onClick={() => { setSource('link'); setErr(''); }}>A link</button>
              </div>
              {source === 'file' ? (
                <>
                  <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                  {file ? (
                    <div className="gv-cd-file">
                      <Check size={18} strokeWidth={2.6} style={{ color: FOREST, flexShrink: 0 }} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{file.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>{formatDocSize(file.size)}</p>
                      </div>
                      <button type="button" className="gv-st-link" disabled={saving} onClick={() => fileRef.current?.click()}>Change</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="gv-cd-drop"
                      data-over={over}
                      disabled={saving}
                      onClick={() => fileRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setOver(true); }}
                      onDragLeave={() => setOver(false)}
                      onDrop={e => { e.preventDefault(); setOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                    >
                      <IconDisc icon={{ emoji: 'Inbox tray', lucide: Upload, tint: TINT_GREEN }} size={52} />
                      <span style={{ fontSize: 15.5, fontWeight: 700 }}>Choose a PDF or drop it here</span>
                      <span style={{ fontSize: 13, color: INK_SOFT }}>Up to 10 MB</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <label className="sr-only" htmlFor="gv-cd-link">Link</label>
                  <input
                    id="gv-cd-link"
                    className="gv-cd-input"
                    type="url"
                    inputMode="url"
                    value={link}
                    disabled={saving}
                    placeholder="https://drive.google.com/…"
                    onChange={e => setLink(e.target.value)}
                  />
                  {link.trim() && !linkValue && (
                    <p className="gv-st-err">That link doesn&apos;t look right. Paste the full address.</p>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <p className="gv-fd-label" id="gv-cd-who-l">Who can see it</p>
            <div className="gv-cd-chips" role="radiogroup" aria-labelledby="gv-cd-who-l">
              <button type="button" role="radio" aria-checked={everyone} className="gv-cd-chip" disabled={saving} onClick={() => setEveryone(true)}>
                Everyone accepted
              </button>
              <button type="button" role="radio" aria-checked={!everyone} className="gv-cd-chip" disabled={saving} onClick={() => setEveryone(false)}>
                Only some roles
              </button>
            </div>
            {!everyone && (
              <div className="gv-cd-chips" role="group" aria-label="Roles that can see it" style={{ marginTop: 10 }}>
                {ROLE_CHOICES.map(r => {
                  const on = roles.includes(r.key);
                  return (
                    <button
                      key={r.key}
                      type="button"
                      aria-pressed={on}
                      className="gv-cd-chip"
                      disabled={saving}
                      onClick={() => setRoles(prev => on ? prev.filter(x => x !== r.key) : [...prev, r.key])}
                    >
                      {on && <Check size={15} strokeWidth={2.8} aria-hidden />}
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}
            {!everyone && roles.length === 0 && (
              <p className="gv-fd-note" style={{ marginTop: 8 }}>Pick at least one role.</p>
            )}
          </div>

          {err && <p className="gv-st-err" role="alert">{err}</p>}

          <div className="gv-fd-footbar">
            <button type="button" className="gv-st-btn gv-st-forest" disabled={!ready || saving} onClick={save}>
              {isEdit ? (saving ? 'Saving…' : 'Save changes') : (saving ? 'Adding…' : 'Add document')}
            </button>
            <button type="button" className="gv-st-btn gv-st-outline" disabled={saving} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </PurchaseShell>
    </>
  );
}
