'use client';

// Conference Documents with Document Uploads on (prompt 112). The list comes
// from my_conference_documents(conference, the application on screen), which
// already decides what this application may see (role, status, accepted_only),
// so nothing is filtered again here. A document the organisers want back
// carries a second block: the due date and where this person's copy stands,
// with Send it back / Replace / Send a new copy. Copies go to the private
// document-returns bucket (the browser can never delete or overwrite there);
// the RPC records them. Every file opens through a signed URL made inside the
// click (sent-back copies: 5 minutes).
//
// When the server answers enabled false, or the read fails, the caller keeps
// the classic card (ConferenceDocsSection) exactly as before.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, CornerUpLeft, FileText, Upload, CircleDashed } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { friendlyError } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import { STORE_CSS } from '@/app/manage/[slug]/store/storeKit';
import { DASH_CSS, IconDisc, INK, INK_SOFT, DANGER } from '@/app/manage/[slug]/financials/dashboardKit';
import { DashCard as YouCard, CardHeading, FOREST, TINT_ACCENT as TINT_GOLD, TINT_MAIN as TINT_GREEN, CONF_BUTTON_CSS } from './dashboardKit';
import {
  CONFERENCE_DOC_MAX_BYTES, DOC_FILE_ACCEPT, DOCUMENT_RETURNS_BUCKET,
  docMimeFor, docTypeLabel, documentReturnPath, downloadConferenceDoc, downloadStoredFile, fetchMyConferenceDocuments, formatDocSize,
  kindInfo, linkHost, openConferenceDoc, openStoredFile, replaceDocumentReturn, submitDocumentReturn,
  type ConferenceDoc, type MyConferenceDoc, type MyConferenceDocs,
} from '@/lib/conferenceDocuments';

const RETURN_LINK_SECONDS = 300;
const GOLD_TEXT = '#8A6410';
const GREEN_TEXT = 'var(--gv-main-mid)';

export type MyDocsState =
  | { status: 'loading' }
  | { status: 'off' }
  | { status: 'on'; data: MyConferenceDocs };

/** my_conference_documents for the application on screen. Keyed on the user id
 *  and the application id, never the token. 'off' = the server said the switch
 *  is off, or the read failed: the caller keeps the classic card. */
export function useMyConferenceDocs(conferenceId: string, applicationId: string | null, signedIn: boolean) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const key = `${conferenceId}:${userId ?? ''}:${applicationId ?? ''}`;
  const [state, setState] = useState<{ key: string; value: MyDocsState } | null>(null);

  const read = useCallback(async () => {
    if (!signedIn || !userId || !applicationId) return;
    const res = await fetchMyConferenceDocuments(conferenceId, applicationId);
    const value: MyDocsState = res.ok && res.enabled
      ? { status: 'on', data: { enabled: true, warnings: Number(res.warnings) || 0, documents: res.documents ?? [] } }
      : { status: 'off' };
    setState({ key, value });
  }, [signedIn, userId, applicationId, conferenceId, key]);

  // Started a microtask later so no state is set synchronously in the effect.
  useEffect(() => { void Promise.resolve().then(() => read()); }, [read]);

  const value: MyDocsState = !signedIn || !userId || !applicationId
    ? { status: 'off' }
    : state?.key === key ? state.value : { status: 'loading' };
  return { state: value, reload: read };
}

/** The required documents still to send back (what `warnings` counts). */
export function requiredOutstanding(docs: MyConferenceDoc[]): MyConferenceDoc[] {
  return docs.filter(d => d.required && d.can_send_back
    && !(d.my_return && (d.my_return.status === 'submitted' || d.my_return.status === 'accepted')));
}

const CSS = `
.gv-cdx{display:flex;flex-direction:column;gap:10px}
.gv-cdx-row{border-radius:16px;background:#FAF8F3;box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--gv-main) 6%, transparent);padding:12px 16px}
.gv-cdx-top{display:flex;align-items:flex-start;gap:14px}
.gv-cdx-main{flex:1 1 auto;min-width:0}
.gv-cdx-title{margin:0;font-size:15.5px;font-weight:800;line-height:1.3;color:${INK};overflow-wrap:anywhere}
.gv-cdx-desc{margin:4px 0 0;font-size:14px;line-height:1.5;color:${INK};overflow-wrap:anywhere;white-space:pre-wrap}
.gv-cdx-sub{margin:4px 0 0;font-size:13px;line-height:1.45;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-cdx-link{flex-shrink:0;align-self:center;border:none;background:none;padding:6px 2px;font-family:inherit;font-size:14px;font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-cdx-link:disabled{opacity:0.6;cursor:default}
.gv-cdx-side{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;align-self:flex-start}
.gv-cdx-links{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:flex-end}
.gv-cdx-req{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;background:rgba(139,32,32,0.1);color:#8B2020;font-size:12px;font-weight:800;line-height:1.5}
.gv-cdx-link:focus{outline:none}
.gv-cdx-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
.gv-cdx-back{margin-top:12px;padding:12px 14px;border-radius:12px;background:#FFFFFF;box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--gv-main) 8%, transparent);display:flex;flex-direction:column;gap:8px}
.gv-cdx-due{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13.5px;color:${INK}}
.gv-cdx-due b{font-weight:800}
.gv-cdx-state{display:flex;align-items:flex-start;gap:8px;font-size:14px;line-height:1.45;font-weight:600;overflow-wrap:anywhere}
.gv-cdx-state svg{flex-shrink:0;margin-top:2px}
.gv-cdx-file{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:13.5px;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-cdx-actions{display:flex;flex-wrap:wrap;gap:8px}
.gv-cdx-actions .gv-st-btn{min-height:40px;padding:0 16px;font-size:14px}
.gv-buy-panel.gv-cdx-pop{max-width:520px;min-height:0}
.gv-buy-panel.gv-cdx-pop .gv-buy-body{flex-direction:column;min-height:0}
@media (max-width:743px){.gv-buy-panel.gv-cdx-pop{height:auto;max-height:92dvh;margin-top:auto;border-radius:22px 22px 0 0}}
.gv-cdx-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;min-height:132px;padding:18px;border-radius:14px;border:2px dashed color-mix(in srgb, var(--gv-main) 28%, transparent);background:#FAF8F3;color:${INK};font-family:inherit;cursor:pointer;text-align:center}
.gv-cdx-drop:hover,.gv-cdx-drop[data-over="true"]{border-color:${FOREST};background:#F6F3EC}
.gv-cdx-drop:focus{outline:none}
.gv-cdx-drop:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cdx-chosen{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:color-mix(in srgb, var(--gv-main-light) 8%, transparent)}
`;

function docIcon(kind: string) {
  const info = kindInfo(kind);
  return { emoji: info.emoji, lucide: info.lucide ?? FileText, tint: info.tint === 'green' ? TINT_GREEN : TINT_GOLD };
}

/** "PDF · 1.2 MB", the link's host, or just the size. */
function sourceLine(doc: MyConferenceDoc): string {
  if (doc.url) return linkHost(doc.url);
  const type = docTypeLabel(doc.mime_type) || (/\.pdf$/i.test(doc.file_name ?? '') ? 'PDF' : '');
  return [type, formatDocSize(doc.file_size_bytes)].filter(Boolean).join(' · ');
}

const isWord = (mime: string | null | undefined, name: string | null | undefined) =>
  (mime ?? '').includes('word') || /\.docx?$/i.test(name ?? '');

export default function ConferenceDocsExtra({ conferenceId, data, onChanged }: {
  conferenceId: string;
  data: MyConferenceDocs;
  /** Re-read my_conference_documents after a copy was sent. */
  onChanged: () => void;
}) {
  const { session } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState<MyConferenceDoc | null>(null);

  // Signed links are made inside the click (a tab opened after an await is blocked),
  // so the session's own client is used here, never a fresh one fetched first.
  async function openDoc(doc: MyConferenceDoc) {
    if (!session || busyId) return;
    setErr(''); setBusyId(`doc:${doc.id}`);
    const ok = await openConferenceDoc(getAuthedClient(session.access_token), doc as unknown as ConferenceDoc);
    setBusyId(null);
    if (!ok) setErr("Couldn't open that document. Please try again.");
  }

  async function viewCopy(doc: MyConferenceDoc) {
    const path = doc.my_return?.file_path;
    if (!session || !path || busyId) return;
    setErr(''); setBusyId(`copy:${doc.id}`);
    const ok = await openStoredFile(getAuthedClient(session.access_token), DOCUMENT_RETURNS_BUCKET, path, RETURN_LINK_SECONDS);
    setBusyId(null);
    if (!ok) setErr("Couldn't open your copy. Please try again.");
  }

  async function downloadDoc(doc: MyConferenceDoc) {
    if (!session || busyId) return;
    setErr(''); setBusyId(`dl:${doc.id}`);
    const ok = await downloadConferenceDoc(getAuthedClient(session.access_token), doc);
    setBusyId(null);
    if (!ok) setErr("Couldn't download that document. Please try again.");
  }

  async function downloadCopy(doc: MyConferenceDoc) {
    const r = doc.my_return;
    if (!session || !r?.file_path || busyId) return;
    setErr(''); setBusyId(`copydl:${doc.id}`);
    const ok = await downloadStoredFile(getAuthedClient(session.access_token), DOCUMENT_RETURNS_BUCKET, r.file_path, r.file_name ?? null, RETURN_LINK_SECONDS);
    setBusyId(null);
    if (!ok) setErr("Couldn't download your copy. Please try again.");
  }

  if (data.documents.length === 0) return null;

  return (
    <YouCard className="gv-st">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CONF_BUTTON_CSS}</style>
      <style>{CSS}</style>
      <CardHeading title="Conference Documents" stackedHide />
      <ul className="gv-cdx" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {data.documents.map(doc => {
          // Open where the browser can show it (a link, a PDF, an image); Download for every file.
          const canOpen = !!doc.url || !isWord(doc.mime_type, doc.file_name);
          const canDownload = !doc.url && !!doc.file_path;
          return (
            <li key={doc.id} className="gv-cdx-row">
              <div className="gv-cdx-top">
                <IconDisc icon={docIcon(doc.kind)} />
                <div className="gv-cdx-main">
                  <p className="gv-cdx-title">{doc.title}</p>
                  {doc.description && <p className="gv-cdx-desc">{doc.description}</p>}
                  <p className="gv-cdx-sub">{sourceLine(doc)}</p>
                </div>
                <div className="gv-cdx-side">
                  {doc.ask_back && doc.required && <span className="gv-cdx-req">Required</span>}
                  <div className="gv-cdx-links">
                    {canOpen && (
                      <button type="button" className="gv-cdx-link" disabled={busyId === `doc:${doc.id}`} onClick={() => openDoc(doc)} aria-label={`Open ${doc.title}`}>
                        {busyId === `doc:${doc.id}` ? 'Opening' : 'Open'}
                      </button>
                    )}
                    {canDownload && (
                      <button type="button" className="gv-cdx-link" disabled={busyId === `dl:${doc.id}`} onClick={() => downloadDoc(doc)} aria-label={`Download ${doc.title}`}>
                        {busyId === `dl:${doc.id}` ? 'Downloading' : 'Download'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {doc.ask_back && (doc.can_send_back || doc.my_return) && (
                <SendBackBlock
                  doc={doc}
                  viewing={busyId === `copy:${doc.id}`}
                  onView={() => viewCopy(doc)}
                  downloading={busyId === `copydl:${doc.id}`}
                  onDownload={() => downloadCopy(doc)}
                  onSend={() => setSending(doc)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {err && <p className="gv-st-err" role="alert">{err}</p>}
      {sending && (
        <SendBackPopup
          conferenceId={conferenceId}
          doc={sending}
          onClose={() => setSending(null)}
          onSent={() => {
            setSending(null);
            notifyOk('Sent. The organizers will check it', 'conference-docs-return');
            onChanged();
          }}
        />
      )}
    </YouCard>
  );
}

function SendBackBlock({ doc, viewing, onView, downloading, onDownload, onSend }: {
  doc: MyConferenceDoc; viewing: boolean; onView: () => void; downloading: boolean; onDownload: () => void; onSend: () => void;
}) {
  const r = doc.my_return;
  const state = r?.status ?? 'none';
  return (
    <div className="gv-cdx-back">
      {/* "Required" is the red tag at the card's top right (prompt 143). */}
      {doc.due_label && (
        <div className="gv-cdx-due">
          <span>Send it back by <b>{doc.due_label}</b></span>
          {doc.overdue && <b style={{ color: DANGER }}>Overdue</b>}
        </div>
      )}

      {state === 'none' && (
        <p className="gv-cdx-state" style={{ color: INK_SOFT, margin: 0 }}>
          <CircleDashed size={16} strokeWidth={2.4} aria-hidden />Not sent yet
        </p>
      )}
      {state === 'submitted' && (
        <p className="gv-cdx-state" style={{ color: GOLD_TEXT, margin: 0 }}>
          <Clock size={16} strokeWidth={2.4} aria-hidden />Sent. Waiting for the organizers to check it
        </p>
      )}
      {state === 'sent_back' && (
        <p className="gv-cdx-state" style={{ color: DANGER, margin: 0 }}>
          <CornerUpLeft size={16} strokeWidth={2.4} aria-hidden />
          <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>Sent back: {r?.review_note ?? ''}</span>
        </p>
      )}
      {state === 'accepted' && (
        <p className="gv-cdx-state" style={{ color: GREEN_TEXT, margin: 0 }}>
          <CheckCircle2 size={16} strokeWidth={2.4} aria-hidden />Accepted
        </p>
      )}

      {r?.file_path && (state === 'submitted' || state === 'accepted') && (
        <div className="gv-cdx-file">
          <span>{r.file_name ?? 'Your copy'}</span>
          <button type="button" className="gv-cdx-link" style={{ padding: 0 }} disabled={viewing} onClick={onView}>{viewing ? 'Opening' : 'View'}</button>
          <button type="button" className="gv-cdx-link" style={{ padding: 0 }} disabled={downloading} onClick={onDownload}>{downloading ? 'Downloading' : 'Download'}</button>
        </div>
      )}

      {/* A new copy can always be sent, even after it was accepted (prompt 130). */}
      {doc.can_send_back && (
        <div className="gv-cdx-actions">
          <button type="button" className={`gv-st-btn ${state === 'submitted' ? 'gv-st-outline' : 'gv-cf-main'}`} onClick={onSend}>
            {state === 'none' ? 'Send it back' : state === 'submitted' ? 'Replace' : 'Send a new copy'}
          </button>
        </div>
      )}
    </div>
  );
}

function SendBackPopup({ conferenceId, doc, onClose, onSent }: {
  conferenceId: string; doc: MyConferenceDoc; onClose: () => void; onSent: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [over, setOver] = useState(false);
  const busyRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null | undefined) {
    if (!f) return;
    if (docMimeFor(f) === null) { setErr('Use a PDF, a Word document or a JPG or PNG image'); return; }
    if (f.size > CONFERENCE_DOC_MAX_BYTES) { setErr('The file is over 10 MB. Make it smaller and try again'); return; }
    setErr('');
    setFile(f);
  }

  async function send() {
    if (!file || busyRef.current || !doc.application_id) return;
    busyRef.current = true; setSending(true); setErr('');
    try {
      const client = await getFreshAuthedClient();
      if (!client) { setErr('Your session ended. Sign in again, then send it once more.'); return; }
      const path = documentReturnPath(conferenceId, doc.id, doc.application_id, file.name);
      const { error: upErr } = await client.storage.from(DOCUMENT_RETURNS_BUCKET)
        .upload(path, file, { contentType: docMimeFor(file) ?? undefined, upsert: false });
      if (upErr) { setErr(friendlyError(upErr, "Your file couldn't be uploaded. Try again in a moment.")); return; }
      // Replace an existing copy in any state (accepted too, since prompt 130); otherwise a first send.
      const res = doc.my_return
        ? await replaceDocumentReturn(doc.my_return.id, path, file.name)
        : await submitDocumentReturn(doc.id, path, file.name);
      if (!res.ok) { setErr(res.error); return; }
      onSent();
    } catch (e) {
      setErr(friendlyError(e, "Your copy couldn't be sent. Try again in a moment."));
    } finally {
      busyRef.current = false; setSending(false);
    }
  }

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CONF_BUTTON_CSS}</style>
      <style>{CSS}</style>
      <PurchaseShell tone="light" label="Send it back" onClose={() => { if (!busyRef.current) onClose(); }} panelClass="gv-cdx-pop" testId="document-send-back">
        <div className="gv-fd-pop gv-st" style={{ overflowY: 'auto' }}>
          <div>
            <h2 className="gv-fd-pop-title">Send It Back</h2>
            <p style={{ margin: '6px 0 0', fontSize: 15.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{doc.title}</p>
            <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, color: INK_SOFT }}>
              Upload your filled-in or signed copy. PDF, Word or an image (JPG or PNG), up to 10 MB
            </p>
          </div>

          <input ref={fileRef} type="file" accept={DOC_FILE_ACCEPT} className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          {file ? (
            <div className="gv-cdx-chosen">
              <CheckCircle2 size={18} strokeWidth={2.6} style={{ color: FOREST, flexShrink: 0 }} aria-hidden />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{file.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>{formatDocSize(file.size)}</p>
              </div>
              <button type="button" className="gv-cdx-link" disabled={sending} onClick={() => fileRef.current?.click()}>Change</button>
            </div>
          ) : (
            <button
              type="button"
              className="gv-cdx-drop"
              data-over={over}
              disabled={sending}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={e => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
            >
              <IconDisc icon={{ emoji: 'Inbox tray', lucide: Upload, tint: TINT_GREEN }} size={52} />
              <span style={{ fontSize: 15.5, fontWeight: 700 }}>Choose a file or drop it here</span>
            </button>
          )}

          {err && (
            <p className="gv-st-err" role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: 0 }}>
              <AlertTriangle size={16} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />{err}
            </p>
          )}

          <div className="gv-fd-footbar">
            <button type="button" className="gv-st-btn gv-cf-main" disabled={!file || sending} onClick={send}>
              {sending ? 'Sending' : 'Send'}
            </button>
            <button type="button" className="gv-st-btn gv-st-outline" disabled={sending} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </PurchaseShell>
    </>
  );
}

/** The calm notice on Overview: required documents still to send back. Gold,
 *  or the danger colour when one is overdue. Never blocks anything. */
export function DocsRequiredNotice({ conferenceName, docs, onGo }: {
  conferenceName: string; docs: MyConferenceDoc[]; onGo: () => void;
}) {
  if (docs.length === 0) return null;
  const overdue = docs.some(d => d.overdue);
  const edge = overdue ? DANGER : 'var(--gv-accent)';
  return (
    <div
      role="status"
      className="gv-st"
      style={{
        marginTop: 14, padding: '14px 16px', borderRadius: 16, background: overdue ? 'rgba(139,32,32,0.06)' : 'color-mix(in srgb, var(--gv-accent-light) 22%, transparent)',
        boxShadow: `inset 3px 0 0 ${edge}`, display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <style>{STORE_CSS}</style>
      <style>{CONF_BUTTON_CSS}</style>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: INK, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
        {conferenceName} needs {docs.length} {docs.length === 1 ? 'document' : 'documents'} back from you
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {docs.map(d => (
          <li key={d.id} style={{ fontSize: 14, color: INK, overflowWrap: 'anywhere' }}>
            <b style={{ fontWeight: 700 }}>{d.title}</b>
            {d.due_label && <span style={{ color: d.overdue ? DANGER : INK_SOFT }}> · {d.overdue ? 'overdue, was due' : 'due'} {d.due_label}</span>}
          </li>
        ))}
      </ul>
      <div>
        <button type="button" className="gv-st-btn gv-cf-main" style={{ minHeight: 40, padding: '0 16px', fontSize: 14 }} onClick={onGo}>
          Go to documents
        </button>
      </div>
    </div>
  );
}
