'use client';

// DocumentPopup.tsx — "Add a Document" / "Edit the Document" for the Document
// Uploads mode of the Documents tab (prompt 111). Files go to the
// conference-documents bucket first, then save_conference_document writes the
// row (and, when asked, emails the audience). A file uploaded for a save that
// was refused is removed again. Field errors from the server show under their
// field.

import { useEffect, useRef, useState } from 'react';
import { Check, Upload } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { DatePicker } from '@/components/DatePicker';
import { friendlyError } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import { dayInZone, endOfDayIso } from '@/lib/applicationWindow';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS, IconDisc, TINT_GREEN, INK, INK_SOFT, FOREST } from '../financials/dashboardKit';
import { CD_CSS, EXTRA_CSS, ROLE_CHOICES, kindIcon } from './docsTabKit';
import {
  CONFERENCE_DOC_KINDS, CONFERENCE_DOCS_BUCKET, CONFERENCE_DOC_MAX_BYTES, CONFERENCE_DOC_TITLE_MAX, DOC_FILE_ACCEPT, EXTRA_DOC_KIND,
  conferenceDocPath, docMimeFor, formatDocSize, isAllowedDocFile, kindInfo, linkHost, normaliseDocUrl, saveConferenceDocument,
  type ConferenceDocKind, type DocsOverviewItem,
} from '@/lib/conferenceDocuments';

const DESC_MAX = 1000;
const KINDS = [EXTRA_DOC_KIND, ...CONFERENCE_DOC_KINDS];

type Field = 'title' | 'description' | 'file' | 'url' | 'audience' | 'due_at' | 'ask_back';

export default function DocumentPopup({ conferenceId, editing, onClose, onSaved }: {
  conferenceId: string;
  /** The document being edited, or null to add one. */
  editing: DocsOverviewItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [kind, setKind] = useState<ConferenceDocKind>(editing?.kind ?? 'extra');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [titleTouched, setTitleTouched] = useState(isEdit);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [source, setSource] = useState<'file' | 'link'>(editing?.url ? 'link' : 'file');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState(editing?.url ?? '');
  const [everyone, setEveryone] = useState((editing?.visible_to ?? []).length === 0);
  const [roles, setRoles] = useState<string[]>(editing?.visible_to ?? []);
  const [underReview, setUnderReview] = useState(editing ? !editing.accepted_only : false);
  const [askBack, setAskBack] = useState(editing?.ask_back ?? false);
  const [dueDay, setDueDay] = useState('');
  const [required, setRequired] = useState(editing?.required ?? false);
  const [notify, setNotify] = useState(false);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [over, setOver] = useState(false);
  const savingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The conference's timezone: the due date is the end of that day there (else UTC).
  useEffect(() => {
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
  }, [conferenceId, editing?.due_at]);

  // The name follows the kind until the organiser types one of their own.
  const shownTitle = titleTouched ? title : (kind === 'other' || kind === 'extra' ? title : kindInfo(kind).label);

  function setFieldErr(field: Field, msg: string) { setErrors(prev => ({ ...prev, [field]: msg })); }
  function clearFieldErr(field: Field) { setErrors(prev => { const n = { ...prev }; delete n[field]; return n; }); }

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (!isAllowedDocFile(f)) { setFieldErr('file', 'Use a PDF, a Word document or a JPG or PNG image'); return; }
    if (f.size > CONFERENCE_DOC_MAX_BYTES) { setFieldErr('file', 'The file is over 10 MB. Make it smaller and try again'); return; }
    clearFieldErr('file');
    setFile(f);
  }

  const cleanTitle = shownTitle.trim();
  const cleanDesc = description.trim();
  const linkValue = normaliseDocUrl(link);
  const hasCurrentFile = !!editing?.file_path;
  const audienceOk = everyone || roles.length > 0;
  const sourceOk = source === 'file' ? (!!file || hasCurrentFile) : !!linkValue;
  const ready = cleanTitle.length > 0 && cleanTitle.length <= CONFERENCE_DOC_TITLE_MAX
    && cleanDesc.length <= DESC_MAX && sourceOk && audienceOk;

  async function save() {
    if (!ready || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setErrors({});
    setFormErr('');
    const client = await getFreshAuthedClient();
    if (!client) {
      setFormErr('Your session ended. Sign in again, then try once more.');
      savingRef.current = false; setSaving(false); return;
    }
    let uploaded: string | null = null;
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      if (source === 'file') {
        if (file) {
          uploaded = conferenceDocPath(conferenceId, file.name);
          const { error: upErr } = await client.storage.from(CONFERENCE_DOCS_BUCKET)
            .upload(uploaded, file, { contentType: docMimeFor(file) ?? undefined, upsert: false });
          if (upErr) { uploaded = null; setFieldErr('file', friendlyError(upErr, "The file couldn't be uploaded. Try again")); return; }
          filePath = uploaded;
          fileName = file.name;
        } else {
          filePath = editing?.file_path ?? null;
          fileName = editing?.file_name ?? null;
        }
      }
      const res = await saveConferenceDocument({
        conferenceId,
        documentId: editing?.id ?? null,
        title: cleanTitle,
        description: cleanDesc || null,
        filePath,
        fileName,
        url: source === 'link' ? linkValue : null,
        visibleTo: everyone ? [] : roles,
        acceptedOnly: !underReview,
        askBack: source === 'file' && askBack,
        dueAt: source === 'file' && askBack && dueDay ? endOfDayIso(dueDay, timeZone) : null,
        required: source === 'file' && askBack && required,
        notify,
        kind,
      });
      if (!res.ok) {
        if (uploaded) { void client.storage.from(CONFERENCE_DOCS_BUCKET).remove([uploaded]); uploaded = null; }
        const field = res.field as Field | undefined;
        if (field) setFieldErr(field === 'url' && source === 'file' ? 'file' : field, res.error);
        else setFormErr(res.error);
        return;
      }
      uploaded = null;
      notifyOk(notify ? `${isEdit ? 'Document saved' : 'Document added'}. We emailed ${res.notified} ${res.notified === 1 ? 'person' : 'people'}` : (isEdit ? 'Document saved' : 'Document added'), 'conference-docs');
      onSaved();
    } catch (e) {
      if (uploaded) void client.storage.from(CONFERENCE_DOCS_BUCKET).remove([uploaded]);
      setFormErr(friendlyError(e, "The document couldn't be saved. Try again in a moment."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const currentSource = editing
    ? (editing.url ? linkHost(editing.url) : [editing.file_name, formatDocSize(editing.file_size_bytes)].filter(Boolean).join(', '))
    : '';
  const today = new Date().toISOString().slice(0, 10);
  const err = (f: Field) => errors[f] ? <p className="gv-cd-err" role="alert">{errors[f]}</p> : null;

  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{CD_CSS}</style>
      <style>{EXTRA_CSS}</style>
      <PurchaseShell tone="light" label={isEdit ? 'Edit the document' : 'Add a document'} onClose={() => { if (!savingRef.current) onClose(); }} panelClass="gv-cd-pop" testId="conference-docs-popup">
        <div className="gv-fd-pop gv-st gv-cd-pop-scroll">
          <h2 className="gv-fd-pop-title">{isEdit ? 'Edit the Document' : 'Add a Document'}</h2>

          <div className="gv-cd-field">
            <label className="gv-fd-label" htmlFor="gv-cdx-title">Name</label>
            <input
              id="gv-cdx-title"
              className="gv-cd-input"
              value={shownTitle}
              maxLength={CONFERENCE_DOC_TITLE_MAX}
              disabled={saving}
              placeholder="For example Consent form"
              aria-invalid={!!errors.title}
              onChange={e => { setTitleTouched(true); setTitle(e.target.value); clearFieldErr('title'); }}
            />
            <div className="gv-cd-count-line"><span /><span>{shownTitle.length} / {CONFERENCE_DOC_TITLE_MAX}</span></div>
            {err('title')}
          </div>

          <div className="gv-cd-field">
            <label className="gv-fd-label" htmlFor="gv-cdx-desc">Description <span style={{ fontWeight: 500, color: INK_SOFT }}>(optional)</span></label>
            <textarea
              id="gv-cdx-desc"
              className="gv-cd-area"
              value={description}
              maxLength={DESC_MAX}
              disabled={saving}
              placeholder="What it is and what people should do with it"
              onChange={e => { setDescription(e.target.value); clearFieldErr('description'); }}
            />
            <div className="gv-cd-count-line"><span /><span>{description.length} / {DESC_MAX}</span></div>
            {err('description')}
          </div>

          <div>
            <p className="gv-fd-label" id="gv-cdx-kind-l">What is it?</p>
            <div className="gv-cd-kinds" role="radiogroup" aria-labelledby="gv-cdx-kind-l">
              {KINDS.map(k => (
                <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} className="gv-cd-kind" disabled={saving} onClick={() => setKind(k.key)}>
                  <IconDisc icon={kindIcon(k.key)} size={42} />
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{k.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="gv-fd-label" id="gv-cdx-src-l">Add it as</p>
            <div className="gv-st-dir" role="radiogroup" aria-labelledby="gv-cdx-src-l" style={{ marginBottom: 10 }}>
              <button type="button" role="radio" aria-checked={source === 'file'} disabled={saving} onClick={() => { setSource('file'); clearFieldErr('url'); }}>A file</button>
              <button type="button" role="radio" aria-checked={source === 'link'} disabled={saving || askBack} title={askBack ? 'To ask people to send it back, upload the file itself' : undefined} onClick={() => { setSource('link'); clearFieldErr('file'); }}>A link</button>
            </div>
            {askBack && source === 'file' && <p className="gv-fd-note" style={{ margin: '0 0 10px' }}>To ask people to send it back, upload the file itself</p>}
            {source === 'file' ? (
              <>
                <input ref={fileRef} type="file" accept={DOC_FILE_ACCEPT} className="hidden" onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                {file || hasCurrentFile ? (
                  <div className="gv-cd-file">
                    <Check size={18} strokeWidth={2.6} style={{ color: FOREST, flexShrink: 0 }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{file ? file.name : editing?.file_name ?? currentSource}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>{formatDocSize(file ? file.size : editing?.file_size_bytes ?? null)}</p>
                    </div>
                    <button type="button" className="gv-st-link" disabled={saving} onClick={() => fileRef.current?.click()}>{isEdit && !file ? 'Replace file' : 'Change'}</button>
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
                    <span style={{ fontSize: 15.5, fontWeight: 700 }}>Choose a file or drop it here</span>
                    <span style={{ fontSize: 13, color: INK_SOFT }}>PDF, Word or an image (JPG or PNG), up to 10 MB</span>
                  </button>
                )}
                {err('file')}
              </>
            ) : (
              <>
                <label className="sr-only" htmlFor="gv-cdx-link">Link</label>
                <input id="gv-cdx-link" className="gv-cd-input" type="url" inputMode="url" value={link} disabled={saving} placeholder="https://drive.google.com/…" onChange={e => { setLink(e.target.value); clearFieldErr('url'); }} />
                {link.trim() && !linkValue && <p className="gv-cd-err">That link doesn&apos;t look right. Paste the full address</p>}
                {err('url')}
              </>
            )}
          </div>

          <div>
            <p className="gv-fd-label" id="gv-cdx-who-l">Who can see it</p>
            <div className="gv-cd-chips" role="radiogroup" aria-labelledby="gv-cdx-who-l">
              <button type="button" role="radio" aria-checked={everyone} className="gv-cd-chip" disabled={saving} onClick={() => setEveryone(true)}>Everyone accepted</button>
              <button type="button" role="radio" aria-checked={!everyone} className="gv-cd-chip" disabled={saving} onClick={() => setEveryone(false)}>Only some roles</button>
            </div>
            {!everyone && (
              <div className="gv-cd-chips" role="group" aria-label="Roles that can see it" style={{ marginTop: 10 }}>
                {ROLE_CHOICES.map(r => {
                  const on = roles.includes(r.key);
                  return (
                    <button key={r.key} type="button" aria-pressed={on} className="gv-cd-chip" disabled={saving} onClick={() => setRoles(prev => on ? prev.filter(x => x !== r.key) : [...prev, r.key])}>
                      {on && <Check size={15} strokeWidth={2.8} aria-hidden />}
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}
            {!everyone && roles.length === 0 && <p className="gv-fd-note" style={{ marginTop: 8 }}>Pick at least one role.</p>}
            <div style={{ marginTop: 12 }}>
              <Switch on={underReview} disabled={saving} onChange={setUnderReview} title="Also show it to applicants under review" />
            </div>
            {err('audience')}
          </div>

          <div>
            <Switch
              on={askBack && source === 'file'}
              disabled={saving || source === 'link'}
              onChange={v => { setAskBack(v); clearFieldErr('ask_back'); }}
              title="Ask participants to send it back"
              line="They download it, fill it in or sign it, and upload their copy for you to check"
            />
            {source === 'link' && <p className="gv-fd-note" style={{ marginTop: 6 }}>To ask people to send it back, upload the file itself</p>}
            {err('ask_back')}
            {askBack && source === 'file' && (
              <div className="gv-cd-sub-block">
                <div className="gv-cd-field">
                  <label className="gv-fd-label" htmlFor="gv-cdx-due">Due date <span style={{ fontWeight: 500, color: INK_SOFT }}>(optional)</span></label>
                  <DatePicker id="gv-cdx-due" value={dueDay} min={today} clearable disabled={saving} onChange={v => { setDueDay(v); clearFieldErr('due_at'); }} placeholder="No due date" />
                  {err('due_at')}
                </div>
                <Switch on={required} disabled={saving} onChange={setRequired} title="Required" line="People who have not sent it see a reminder on their dashboard. It never stops check-in." />
              </div>
            )}
          </div>

          <label className="gv-cd-check">
            <input type="checkbox" checked={notify} disabled={saving} onChange={e => setNotify(e.target.checked)} />
            <span>
              <b style={{ display: 'block', fontSize: 15 }}>{isEdit ? 'Email them about this change' : 'Email the people it is for'}</b>
              <small style={{ display: 'block', fontSize: 13, color: INK_SOFT, marginTop: 2 }}>Sends them an email with a button to open it on Gavelling</small>
            </span>
          </label>

          {formErr && <p className="gv-st-err" role="alert">{formErr}</p>}

          <div className="gv-fd-footbar">
            <button type="button" className="gv-st-btn gv-st-forest" disabled={!ready || saving} onClick={save}>
              {isEdit ? (saving ? 'Saving' : 'Save changes') : (saving ? 'Adding' : 'Add document')}
            </button>
            <button type="button" className="gv-st-btn gv-st-outline" disabled={saving} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </PurchaseShell>
    </>
  );
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
