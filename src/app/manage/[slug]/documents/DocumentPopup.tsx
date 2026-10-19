'use client';

// DocumentPopup.tsx — Add Document / edit a document as a step flow (prompt
// 130, 16 Oct 2026), in the Financials welcome pop-up's manner ("Step 1 of 5",
// Back and Continue). It replaced the single form of prompt 111 and reuses its
// upload, validation and field-error code.
//
//   1 Upload Your Document   a file (PDF, Word, JPG or PNG, up to 10 MB) or a
//                            link. Continue uploads the file.
//   2 Name and Description
//   3 Who Sees It?           "Show to applicants under review too", the roles
//                            with Select all (no Secretariat; a document that
//                            already has it keeps it). All roles = everyone.
//   4 Ask Them to Send It Back?   (docs_extra on only)
//   5 Review                 every answer with Edit links, then save.
//
// From step 2 on the document sits on the RIGHT of every step. Two save paths:
// docs_extra on → save_conference_document (p_notify true for a new document:
// the automatic emails are on by default and edited in Communications);
// docs_extra off → the classic direct write ConferenceDocsTab always used
// (kind 'other', no email, the file of an existing document is not swapped).
// A file uploaded for a document that is never saved is removed again.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, FileText, Upload } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import PdfViewer, { type PdfZoom } from '@/components/documents/PdfViewer';
import { DatePicker } from '@/components/DatePicker';
import { friendlyError } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import { dayInZone, endOfDayIso } from '@/lib/applicationWindow';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, IconDisc, TINT_GREEN, TINT_GOLD, INK, INK_SOFT, FOREST } from '../financials/dashboardKit';
import { CD_CSS, EXTRA_CSS, ROLE_CHOICES } from './docsTabKit';
import { formatDate } from './CommitteeDocsPopup';
import {
  CONFERENCE_DOCS_BUCKET, CONFERENCE_DOC_MAX_BYTES, CONFERENCE_DOC_TITLE_MAX, DOC_FILE_ACCEPT,
  conferenceDocPath, docMimeFor, docTypeLabel, formatDocSize, isAllowedDocFile, linkHost, normaliseDocUrl, saveConferenceDocument,
  type ConferenceDocKind,
} from '@/lib/conferenceDocuments';

const DESC_MAX = 1000;
/** The roles offered (Secretariat works from the organizer dashboard). */
const PICK_ROLES = ROLE_CHOICES.filter(r => r.key !== 'secretariat');

type Field = 'title' | 'description' | 'file' | 'url' | 'audience' | 'due_at' | 'ask_back';
type Step = 1 | 2 | 3 | 4 | 5;

/** What the flow needs of a saved document (either mode's row has it). */
export interface EditableDoc {
  id: string;
  title: string;
  description?: string | null;
  kind: ConferenceDocKind;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type?: string | null;
  url: string | null;
  visible_to: string[];
  accepted_only?: boolean;
  ask_back?: boolean;
  due_at?: string | null;
  required?: boolean;
}

const STEP_FIELD: Record<Field, Step> = { file: 1, url: 1, title: 2, description: 2, audience: 3, ask_back: 4, due_at: 4 };

export default function DocumentPopup({ conferenceId, editing, extra, onClose, onSaved, embedded = false, onBackToList, onPanelChange }: {
  conferenceId: string;
  /** The document being edited (opens on Review), or null to add one. */
  editing: EditableDoc | null;
  /** docs_extra on for the conference: save_conference_document and step 4. */
  extra: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Drawn inside the Documents pop-up (prompt 131: no pop-up on top of a
   *  pop-up): no shell of its own; the host's pop-up holds it. */
  embedded?: boolean;
  /** "Back to Documents" at the bottom left of step 1 (embedded only). */
  onBackToList?: () => void;
  /** The host sizes its pop-up: 'narrow' on step 1, 'wide' with the document beside. */
  onPanelChange?: (size: 'narrow' | 'wide') => void;
}) {
  const { user } = useAuth();
  const isEdit = !!editing;
  const steps: Step[] = extra ? [1, 2, 3, 4, 5] : [1, 2, 3, 5];
  const [step, setStep] = useState<Step>(isEdit ? 5 : 1);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [source, setSource] = useState<'file' | 'link'>(editing?.url ? 'link' : 'file');
  const [file, setFile] = useState<File | null>(null);
  /** The file uploaded for this flow (not saved yet), and the file it was. */
  const [uploaded, setUploaded] = useState<{ path: string; file: File } | null>(null);
  const [link, setLink] = useState(editing?.url ?? '');
  const secretariatKept = (editing?.visible_to ?? []).includes('secretariat');
  const [roles, setRoles] = useState<string[]>(() => {
    const v = editing?.visible_to ?? [];
    return v.length === 0 ? PICK_ROLES.map(r => r.key) : v.filter(k => k !== 'secretariat');
  });
  const [underReview, setUnderReview] = useState(editing ? editing.accepted_only === false : false);
  const [askBack, setAskBack] = useState(editing?.ask_back ?? false);
  const [dueDay, setDueDay] = useState('');
  const [required, setRequired] = useState(editing?.required ?? false);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const busyRef = useRef(false);
  const savedRef = useRef(false);
  const uploadedRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The conference's timezone: the due date is the end of that day there (else UTC).
  useEffect(() => {
    if (!extra) return;
    let alive = true;
    void (async () => {
      const client = await getFreshAuthedClient();
      if (!client) return;
      const { data } = await client.from('conferences').select('timezone').eq('id', conferenceId).maybeSingle();
      if (!alive) return;
      const tz = (data as { timezone?: string | null } | null)?.timezone ?? null;
      setTimeZone(tz);
      if (editing?.due_at) setDueDay(dayInZone(editing.due_at, tz));
    })();
    return () => { alive = false; };
  }, [conferenceId, editing?.due_at, extra]);

  // The host pop-up widens once the document sits on the right (embedded).
  useEffect(() => { onPanelChange?.(step >= 2 ? 'wide' : 'narrow'); }, [step, onPanelChange]);

  // A file uploaded but never saved does not stay behind in the bucket.
  useEffect(() => () => {
    const left = uploadedRef.current;
    if (left && !savedRef.current) {
      void getFreshAuthedClient().then(c => { if (c) void c.storage.from(CONFERENCE_DOCS_BUCKET).remove([left]); });
    }
  }, []);

  function setFieldErr(field: Field, msg: string) { setErrors(prev => ({ ...prev, [field]: msg })); }
  function clearFieldErr(field: Field) { setErrors(prev => { const n = { ...prev }; delete n[field]; return n; }); }

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (!isAllowedDocFile(f)) { setFieldErr('file', 'Use a PDF, a Word document or a JPG or PNG image'); return; }
    if (f.size > CONFERENCE_DOC_MAX_BYTES) { setFieldErr('file', 'The file is over 10 MB. Make it smaller and try again'); return; }
    clearFieldErr('file');
    setFile(f);
  }

  const cleanTitle = title.trim();
  const cleanDesc = description.trim();
  const linkValue = normaliseDocUrl(link);
  const hasCurrentFile = !!editing?.file_path;
  // The classic path never swaps the file or link of a saved document.
  const sourceLocked = isEdit && !extra;
  const allRoles = PICK_ROLES.every(r => roles.includes(r.key));
  const visibleTo = allRoles && !secretariatKept ? [] : [...roles, ...(secretariatKept ? ['secretariat'] : [])];
  const stepOk: Record<Step, boolean> = {
    1: sourceLocked || (source === 'file' ? (!!file || hasCurrentFile) : !!linkValue),
    2: cleanTitle.length > 0 && cleanTitle.length <= CONFERENCE_DOC_TITLE_MAX && cleanDesc.length <= DESC_MAX,
    3: roles.length > 0 || secretariatKept,
    4: true,
    5: true,
  };
  const allOk = stepOk[1] && stepOk[2] && stepOk[3];
  const askBackOn = extra && source === 'file' && askBack;

  function nextOf(s: Step): Step { const i = steps.indexOf(s); return steps[Math.min(steps.length - 1, i + 1)]; }
  function prevOf(s: Step): Step { const i = steps.indexOf(s); return steps[Math.max(0, i - 1)]; }

  /** Step 1's Continue: upload the chosen file now (once per file). */
  async function continueFromUpload() {
    if (busyRef.current) return;
    if (source === 'link' || !file || uploaded?.file === file) { setStep(nextOf(1)); return; }
    busyRef.current = true;
    setBusy(true);
    setFormErr('');
    try {
      const client = await getFreshAuthedClient();
      if (!client) { setFormErr('Your session ended. Sign in again, then try once more.'); return; }
      const path = conferenceDocPath(conferenceId, file.name);
      const { error: upErr } = await client.storage.from(CONFERENCE_DOCS_BUCKET)
        .upload(path, file, { contentType: docMimeFor(file) ?? undefined, upsert: false });
      if (upErr) { setFieldErr('file', friendlyError(upErr, "The file couldn't be uploaded. Try again")); return; }
      // The file uploaded before this one is no longer wanted.
      if (uploaded) void client.storage.from(CONFERENCE_DOCS_BUCKET).remove([uploaded.path]);
      setUploaded({ path, file });
      uploadedRef.current = path;
      setStep(nextOf(1));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function save() {
    if (!allOk || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrors({});
    setFormErr('');
    try {
      const client = await getFreshAuthedClient();
      if (!client) { setFormErr('Your session ended. Sign in again, then try once more.'); return; }
      const useFile = source === 'file';
      const filePath = useFile ? (uploaded?.path ?? editing?.file_path ?? null) : null;
      const fileName = useFile ? (uploaded?.file.name ?? editing?.file_name ?? null) : null;
      const kind: ConferenceDocKind = editing?.kind ?? (extra ? 'extra' : 'other');

      if (extra) {
        const res = await saveConferenceDocument({
          conferenceId,
          documentId: editing?.id ?? null,
          title: cleanTitle,
          description: cleanDesc || null,
          filePath,
          fileName,
          url: useFile ? null : linkValue,
          visibleTo,
          acceptedOnly: !underReview,
          askBack: askBackOn,
          dueAt: askBackOn && dueDay ? endOfDayIso(dueDay, timeZone) : null,
          required: askBackOn && required,
          notify: !isEdit,
          kind,
        });
        if (!res.ok) {
          const field = res.field as Field | undefined;
          if (field) {
            const f = field === 'url' && useFile ? 'file' : field;
            setFieldErr(f, res.error);
            setStep(STEP_FIELD[f] && steps.includes(STEP_FIELD[f]) ? STEP_FIELD[f] : 5);
          } else setFormErr(res.error);
          return;
        }
        savedRef.current = true;
        notifyOk(!isEdit && res.notified > 0
          ? `Document added. We emailed ${res.notified} ${res.notified === 1 ? 'person' : 'people'}`
          : (isEdit ? 'Document saved' : 'Document added'), 'conference-docs');
        onSaved();
        return;
      }

      // The classic path: the direct write ConferenceDocsTab always used.
      if (editing) {
        const { data, error } = await client.from('conference_documents')
          .update({ title: cleanTitle, description: cleanDesc || null, visible_to: visibleTo, accepted_only: !underReview })
          .eq('id', editing.id)
          .select('id');
        if (error || (data ?? []).length === 0) throw error ?? new Error('not saved');
      } else {
        const { data: last } = await client.from('conference_documents')
          .select('sort_order').eq('conference_id', conferenceId).order('sort_order', { ascending: false }).limit(1);
        const nextOrder = ((last as { sort_order: number }[] | null)?.[0]?.sort_order ?? -1) + 1;
        const { data, error } = await client.from('conference_documents').insert({
          conference_id: conferenceId,
          title: cleanTitle,
          description: cleanDesc || null,
          kind,
          file_path: filePath,
          file_name: fileName,
          file_size_bytes: useFile ? (uploaded?.file.size ?? null) : null,
          url: useFile ? null : linkValue,
          visible_to: visibleTo,
          accepted_only: !underReview,
          sort_order: nextOrder,
          created_by: user?.id ?? null,
        }).select('id');
        if (error || (data ?? []).length === 0) throw error ?? new Error('not saved');
      }
      savedRef.current = true;
      notifyOk(isEdit ? 'Document saved' : 'Document added', 'conference-docs');
      onSaved();
    } catch (e) {
      setFormErr(friendlyError(e, "The document couldn't be saved. Try again in a moment."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const err = (f: Field) => errors[f] ? <p className="gv-cd-err" role="alert">{errors[f]}</p> : null;
  const stepNo = steps.indexOf(step) + 1;
  const shownFile = file ?? null;
  const fileLabel = shownFile ? shownFile.name : editing?.file_name ?? '';
  const fileSize = shownFile ? shownFile.size : editing?.file_size_bytes ?? null;
  const rolesLine = allRoles && !secretariatKept
    ? 'Everyone'
    : [...PICK_ROLES.filter(r => roles.includes(r.key)).map(r => r.label), ...(secretariatKept ? ['Secretariat'] : [])].join(', ');

  const preview = step >= 2 ? (
    <DocPreview
      link={source === 'link' ? linkValue : null}
      localFile={source === 'file' ? shownFile : null}
      storedPath={source === 'file' && !shownFile ? editing?.file_path ?? null : null}
      storedName={editing?.file_name ?? null}
      storedMime={editing?.mime_type ?? null}
      storedSize={editing?.file_size_bytes ?? null}
    />
  ) : null;

  const body = (
        <div className="gv-st gv-dflow" data-split={step >= 2 || undefined}>
          <div className="gv-dflow-left">
            <p className="gv-dflow-step">Step {stepNo} of {steps.length}</p>

            {step === 1 && (
              <>
                <h2 className="gv-fd-pop-title">Upload Your Document</h2>
                {sourceLocked ? (
                  <>
                    <div className="gv-cd-file">
                      <Check size={18} strokeWidth={2.6} style={{ color: FOREST, flexShrink: 0 }} aria-hidden />
                      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>
                        {editing?.url ? linkHost(editing.url) : [editing?.file_name, formatDocSize(editing?.file_size_bytes ?? null)].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <p className="gv-fd-note">To use a different file or link, add it as a new document and remove this one.</p>
                  </>
                ) : (
                  <>
                    <div className="gv-st-dir" role="radiogroup" aria-label="Add it as" style={{ marginBottom: 4 }}>
                      <button type="button" role="radio" aria-checked={source === 'file'} disabled={busy} onClick={() => { setSource('file'); clearFieldErr('url'); }}>A file</button>
                      <button type="button" role="radio" aria-checked={source === 'link'} disabled={busy} onClick={() => { setSource('link'); clearFieldErr('file'); }}>A link</button>
                    </div>
                    {source === 'file' ? (
                      <>
                        <input ref={fileRef} type="file" accept={DOC_FILE_ACCEPT} className="hidden" onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                        {file || hasCurrentFile ? (
                          <div className="gv-cd-file">
                            <Check size={18} strokeWidth={2.6} style={{ color: FOREST, flexShrink: 0 }} aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{fileLabel}</p>
                              <p style={{ margin: '2px 0 0', fontSize: 13, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>{formatDocSize(fileSize)}</p>
                            </div>
                            <button type="button" className="gv-st-link" disabled={busy} onClick={() => fileRef.current?.click()}>{isEdit && !file ? 'Replace file' : 'Change'}</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="gv-cd-drop"
                            data-over={over}
                            disabled={busy}
                            onClick={() => fileRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setOver(true); }}
                            onDragLeave={() => setOver(false)}
                            onDrop={e => { e.preventDefault(); setOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                          >
                            <IconDisc icon={{ emoji: 'Inbox tray', lucide: Upload, tint: TINT_GREEN }} size={52} />
                            <span style={{ fontSize: 15.5, fontWeight: 700 }}>Choose a file or drop it here</span>
                            <span style={{ fontSize: 13, color: INK_SOFT }}>PDF, Word or an image (JPG or PNG), up to 10 MB</span>
                          </button>
                        )}
                        {err('file')}
                      </>
                    ) : (
                      <>
                        <label className="gv-fd-label" htmlFor="gv-dflow-link">Link</label>
                        <input id="gv-dflow-link" className="gv-cd-input" type="url" inputMode="url" value={link} disabled={busy} placeholder="https://drive.google.com/…" onChange={e => { setLink(e.target.value); clearFieldErr('url'); }} />
                        {link.trim() && !linkValue && <p className="gv-cd-err">That link doesn&apos;t look right. Paste the full address</p>}
                        {err('url')}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="gv-fd-pop-title">Name and Description</h2>
                <div className="gv-cd-field">
                  <label className="gv-fd-label" htmlFor="gv-dflow-title">Name</label>
                  <input
                    id="gv-dflow-title"
                    className="gv-cd-input"
                    value={title}
                    maxLength={CONFERENCE_DOC_TITLE_MAX}
                    disabled={busy}
                    placeholder="For example Consent form"
                    aria-invalid={!!errors.title}
                    onChange={e => { setTitle(e.target.value); clearFieldErr('title'); }}
                  />
                  <div className="gv-cd-count-line"><span /><span>{title.length} / {CONFERENCE_DOC_TITLE_MAX}</span></div>
                  {err('title')}
                </div>
                <div className="gv-cd-field">
                  <label className="gv-fd-label" htmlFor="gv-dflow-desc">Description (optional)</label>
                  <textarea
                    id="gv-dflow-desc"
                    className="gv-cd-area"
                    value={description}
                    maxLength={DESC_MAX}
                    disabled={busy}
                    placeholder="What it is and what people should do with it"
                    onChange={e => { setDescription(e.target.value); clearFieldErr('description'); }}
                  />
                  <div className="gv-cd-count-line"><span /><span>{description.length} / {DESC_MAX}</span></div>
                  {err('description')}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="gv-fd-pop-title">Who Sees It?</h2>
                <Switch on={underReview} disabled={busy} onChange={setUnderReview} title="Show to applicants under review too" />
                <div style={{ marginTop: 6 }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 8 }}>
                    <p className="gv-fd-label" id="gv-dflow-roles" style={{ margin: 0 }}>Roles</p>
                    <button type="button" className="gv-st-link" disabled={busy || allRoles} onClick={() => setRoles(PICK_ROLES.map(r => r.key))}>Select all</button>
                  </div>
                  <div className="gv-cd-chips" role="group" aria-labelledby="gv-dflow-roles">
                    {PICK_ROLES.map(r => {
                      const on = roles.includes(r.key);
                      return (
                        <button key={r.key} type="button" aria-pressed={on} className="gv-cd-chip" disabled={busy} onClick={() => setRoles(prev => on ? prev.filter(x => x !== r.key) : [...prev, r.key])}>
                          {on && <Check size={15} strokeWidth={2.8} aria-hidden />}
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                  {!stepOk[3] && <p className="gv-fd-note" style={{ marginTop: 8 }}>Pick at least one role.</p>}
                  {err('audience')}
                </div>
              </>
            )}

            {step === 4 && extra && (
              <>
                <h2 className="gv-fd-pop-title">Ask Them to Send It Back?</h2>
                <Switch
                  on={askBackOn}
                  disabled={busy || source === 'link'}
                  onChange={v => { setAskBack(v); clearFieldErr('ask_back'); }}
                  title="Ask applicants to send this document back"
                />
                {source === 'link' && <p className="gv-fd-note">To ask people to send it back, upload the file itself, not a link</p>}
                {err('ask_back')}
                {askBackOn && (
                  <div className="gv-cd-sub-block">
                    <div className="gv-cd-field">
                      <label className="gv-fd-label" htmlFor="gv-dflow-due">Due date (optional)</label>
                      <DatePicker id="gv-dflow-due" futureOnly value={dueDay} min={today} clearable disabled={busy} onChange={v => { setDueDay(v); clearFieldErr('due_at'); }} placeholder="No due date" />
                      {err('due_at')}
                    </div>
                    <Switch on={required} disabled={busy} onChange={setRequired} title="Required" line="People who have not sent it see a reminder on their dashboard. It never stops check-in." />
                  </div>
                )}
                <p className="gv-fd-note">Applicants get an email about this document automatically. Change or turn off that email in the Communications tab, under automatic notifications</p>
              </>
            )}

            {step === 5 && (
              <>
                <h2 className="gv-fd-pop-title">Review</h2>
                <dl className="gv-dflow-sum">
                  <SumRow label="Document" onEdit={() => setStep(1)} value={source === 'link' ? (linkValue ? linkHost(linkValue) : 'No link') : (fileLabel ? `${fileLabel}, ${formatDocSize(fileSize)}` : 'No file')} />
                  <SumRow label="Name" onEdit={() => setStep(2)} value={cleanTitle || 'No name yet'} />
                  <SumRow label="Description" onEdit={() => setStep(2)} value={cleanDesc || 'None'} />
                  <SumRow label="Who sees it" onEdit={() => setStep(3)} value={`${rolesLine}${underReview ? ', including applicants under review' : ', once accepted'}`} />
                  {extra && (
                    <SumRow
                      label="Send it back"
                      onEdit={() => setStep(4)}
                      value={askBackOn ? [`Yes`, dueDay ? `due ${formatDate(`${dueDay}T12:00:00`)}` : 'no due date', required ? 'required' : null].filter(Boolean).join(', ') : 'No'}
                    />
                  )}
                </dl>
                {!allOk && <p className="gv-fd-note">Finish the steps marked above before saving.</p>}
              </>
            )}

            {formErr && <p className="gv-st-err" role="alert">{formErr}</p>}

            <div className="gv-dflow-foot">
              {stepNo === 1 && onBackToList && (
                <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={onBackToList}>
                  <ArrowLeft size={15} strokeWidth={2.4} aria-hidden /> Back to Documents
                </button>
              )}
              {stepNo > 1 && (
                <button type="button" className="gv-st-btn gv-st-outline" disabled={busy} onClick={() => setStep(prevOf(step))}>
                  <ArrowLeft size={15} strokeWidth={2.4} aria-hidden /> Back
                </button>
              )}
              <span style={{ flex: 1 }} />
              {step === 5 ? (
                <button type="button" className="gv-st-btn gv-st-forest" disabled={!allOk || busy} onClick={() => { void save(); }}>
                  {busy ? 'Saving' : isEdit ? 'Save Changes' : 'Upload Document'}
                </button>
              ) : (
                <button
                  type="button"
                  className="gv-st-btn gv-st-forest"
                  disabled={!stepOk[step] || busy}
                  onClick={() => { if (step === 1) void continueFromUpload(); else setStep(nextOf(step)); }}
                >
                  {busy ? 'Uploading' : 'Continue'}
                </button>
              )}
            </div>
          </div>
          {preview && <div className="gv-dflow-right">{preview}</div>}
        </div>
  );

  const styles = (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CD_CSS}</style>
      <style>{EXTRA_CSS}</style>
      <style>{FLOW_CSS}</style>
    </>
  );
  if (embedded) return <>{styles}{body}</>;
  return (
    <>
      {styles}
      <PurchaseShell tone="light" label={isEdit ? 'Edit the document' : 'Add a document'} onClose={() => { if (!busyRef.current) onClose(); }} panelClass={step >= 2 ? 'gv-cd-rev' : 'gv-cd-pop'} testId="conference-docs-popup">
        {body}
      </PurchaseShell>
    </>
  );
}

function SumRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="gv-dflow-sumrow">
      <div className="min-w-0">
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
      <button type="button" className="gv-st-link" onClick={onEdit}>Edit</button>
    </div>
  );
}

/** The document on the right: the file itself, a file card for Word, or a link card. */
function DocPreview({ link, localFile, storedPath, storedName, storedMime, storedSize }: {
  link: string | null;
  localFile: File | null;
  storedPath: string | null;
  storedName: string | null;
  storedMime: string | null;
  storedSize: number | null;
}) {
  const [zoom, setZoom] = useState<PdfZoom>('fit');
  const [stored, setStored] = useState<{ path: string; url: string | null } | null>(null);
  // A chosen file is shown from memory; its object URL goes when it changes.
  const localUrl = useMemo(() => (localFile ? URL.createObjectURL(localFile) : null), [localFile]);
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);

  // A saved file through a short signed URL.
  useEffect(() => {
    if (!storedPath) return;
    let alive = true;
    void (async () => {
      const c = await getFreshAuthedClient();
      const res = c ? await c.storage.from(CONFERENCE_DOCS_BUCKET).createSignedUrl(storedPath, 600) : null;
      if (alive) setStored({ path: storedPath, url: res && !res.error ? res.data?.signedUrl ?? null : null });
    })();
    return () => { alive = false; };
  }, [storedPath]);

  if (link) {
    return (
      <div className="gv-dflow-card">
        <IconDisc icon={{ emoji: 'Link', lucide: ExternalLink, tint: TINT_GOLD }} size={68} />
        <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{linkHost(link)}</p>
        <a className="gv-st-btn gv-st-forest" href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          View document <ExternalLink size={14} strokeWidth={2.4} aria-hidden />
        </a>
      </div>
    );
  }

  const name = localFile ? localFile.name : storedName;
  const mime = localFile ? (docMimeFor(localFile) ?? localFile.type) : storedMime;
  const size = localFile ? localFile.size : storedSize;
  const n = (name ?? '').toLowerCase();
  const isPdf = (mime ?? '') === 'application/pdf' || n.endsWith('.pdf');
  const isImage = (mime ?? '').startsWith('image/') || /\.(jpe?g|png)$/.test(n);
  const url = localFile ? localUrl : (stored && stored.path === storedPath ? stored.url : null);

  if (!localFile && !storedPath) {
    return <div className="gv-dflow-card"><p style={{ margin: 0, color: INK_SOFT }}>No file yet.</p></div>;
  }
  if (!isPdf && !isImage) {
    return (
      <div className="gv-dflow-card">
        <IconDisc icon={{ emoji: 'Page facing up', lucide: FileText, tint: TINT_GOLD }} size={72} />
        <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{name ?? 'Document'}</p>
        <p style={{ margin: 0, fontSize: 14, color: INK_SOFT }}>{[docTypeLabel(mime), formatDocSize(size)].filter(Boolean).join(', ')}</p>
      </div>
    );
  }
  if (!url) return <div className="gv-fd-ph" style={{ flex: 1, margin: 16, minHeight: 240 }} aria-busy="true" />;
  if (isImage) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#F6F3EC' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name ?? 'Document'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    );
  }
  return <PdfViewer url={url} title={name ?? 'Document'} fileName={name ?? undefined} zoom={zoom} onZoomChange={setZoom} compact className="relative flex-1 min-h-0" />;
}

/** A switch beside its words; pressing the words presses the switch. */
function Switch({ on, onChange, title, line, disabled }: {
  on: boolean; onChange: (v: boolean) => void; title: string; line?: string; disabled?: boolean;
}) {
  return (
    <div className="gv-cd-switch" onClick={() => { if (!disabled) onChange(!on); }}>
      <button type="button" role="switch" aria-checked={on} aria-label={title} className="gv-cd-switch-track" disabled={disabled} onClick={e => { e.stopPropagation(); onChange(!on); }} />
      <span>
        <b>{title}</b>
        {line && <small>{line}</small>}
      </span>
    </div>
  );
}

const FLOW_CSS = `
.gv-dflow{display:flex;flex-direction:column;width:100%;min-height:0;height:100%}
.gv-dflow[data-split]{display:grid;grid-template-columns:minmax(320px,440px) minmax(0,1fr)}
.gv-dflow-left{padding:26px 28px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;min-height:0}
.gv-dflow[data-split] .gv-dflow-left{border-right:1px solid rgba(27,56,40,0.10)}
.gv-dflow-right{min-height:0;display:flex;flex-direction:column;background:#FFFFFF}
.gv-dflow-step{margin:0;font-size:13px;font-weight:700;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-dflow-foot{display:flex;align-items:center;gap:10px;margin-top:auto;padding-top:14px}
.gv-dflow-card{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:28px;text-align:center}
.gv-dflow-sum{margin:0;display:flex;flex-direction:column;gap:8px}
.gv-dflow-sumrow{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:14px;background:#FAF8F3;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.07)}
.gv-dflow-sumrow dt{font-size:12.5px;font-weight:700;color:${INK_SOFT}}
.gv-dflow-sumrow dd{margin:2px 0 0;font-size:15px;font-weight:600;color:${INK};overflow-wrap:anywhere;white-space:pre-wrap}
@media (max-width:860px){
  .gv-dflow[data-split]{grid-template-columns:1fr;grid-template-rows:auto minmax(300px,1fr);overflow-y:auto}
  .gv-dflow[data-split] .gv-dflow-left{border-right:none;border-bottom:1px solid rgba(27,56,40,0.10)}
}
`;
