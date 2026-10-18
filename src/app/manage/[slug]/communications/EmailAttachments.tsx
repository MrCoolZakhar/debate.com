'use client';

// EmailAttachments.tsx — "Attachments" in the email builder (prompt 113), and
// since prompt 133 in the automatic email editor too, where they ARE saved
// (email_templates.attachments; the page writes them, this row only edits).
// Only for one-off builder emails, and only when the conference has
// attachments switched on (conference_documents_overview().attachments_enabled).
// The list lives in the page's builder state for ONE send: it is never saved
// with the template. Uploaded files go to conference-documents under
// <conference>/email/ (removing a chip never deletes the file); "From your
// documents" picks the conference's own documents that are files (links cannot
// be attached). The outbox trigger is the real check (10 files, 10 MB, types).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, File as FileIcon, FileImage, FileText, FolderOpen, Paperclip, Upload, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import {
  CONFERENCE_DOC_MAX_BYTES, DOC_FILE_ACCEPT, fetchDocsOverview, formatDocSize, isAllowedDocFile, type DocsOverviewItem,
} from '@/lib/conferenceDocuments';
import {
  EMAIL_ATTACH_MAX_BYTES, EMAIL_ATTACH_MAX_FILES, attachmentsProblem, attachmentsTotalBytes, formatMb,
  uploadEmailAttachment, type EmailAttachment,
} from '@/lib/emailAttachments';

const FOREST = '#1B3828';
const INK = '#1C1410';
const SOFT = '#5C4A3A';
const RED = '#8B2020';
const LINE = 'rgba(27,56,40,0.14)';

export interface AttachmentsSupport { enabled: boolean; docs: DocsOverviewItem[] }

/** Whether this conference can attach files, and its documents that are files.
 *  One read per conference per account; never keyed on the token. */
export function useEmailAttachmentsSupport(conferenceId: string | null): AttachmentsSupport {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const key = `${conferenceId ?? ''}:${userId ?? ''}`;
  const [state, setState] = useState<{ key: string; value: AttachmentsSupport } | null>(null);
  useEffect(() => {
    if (!conferenceId || !userId) return;
    let alive = true;
    void fetchDocsOverview(conferenceId).then(res => {
      if (!alive) return;
      setState({
        key: `${conferenceId}:${userId}`,
        value: res.ok && res.attachments_enabled
          ? { enabled: true, docs: (res.documents ?? []).filter(d => !!d.file_path) }
          : { enabled: false, docs: [] },
      });
    });
    return () => { alive = false; };
  }, [conferenceId, userId]);
  return state?.key === key ? state.value : { enabled: false, docs: [] };
}

function typeIcon(a: { file_name: string; mime?: string | null }) {
  const m = (a.mime ?? '').toLowerCase();
  const props = { size: 18, strokeWidth: 2.2, style: { color: FOREST, flexShrink: 0, marginTop: 1 }, 'aria-hidden': true } as const;
  if (m.startsWith('image/') || /\.(jpe?g|png)$/i.test(a.file_name)) return <FileImage {...props} />;
  if (m === 'application/pdf' || /\.pdf$/i.test(a.file_name) || m.includes('word') || /\.docx?$/i.test(a.file_name)) return <FileText {...props} />;
  return <FileIcon {...props} />;
}

function Chip({ a, onRemove, disabled }: { a: EmailAttachment; onRemove?: () => void; disabled?: boolean }) {
  return (
    <li
      className="flex items-start gap-2.5"
      style={{ padding: '8px 10px', borderRadius: 12, backgroundColor: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${LINE}` }}
    >
      {typeIcon(a)}
      <span className="min-w-0 flex-1">
        <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere', lineHeight: 1.35 }}>{a.file_name}</span>
        <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 12, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
          {formatDocSize(a.size)}{a.isConferenceDocument ? ' · From your documents' : ''}
        </span>
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${a.file_name}`}
          title="Remove"
          className="focus:outline-none inline-flex items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: 999, border: 'none', backgroundColor: 'rgba(27,56,40,0.06)', color: SOFT, cursor: 'pointer', flexShrink: 0 }}
        >
          <X size={14} strokeWidth={2.6} />
        </button>
      )}
    </li>
  );
}

/** The chips read only, for "See it for real" and the send confirmation. */
export function AttachmentChipsReadOnly({ value, line }: { value: EmailAttachment[]; line?: string }) {
  if (value.length === 0) return null;
  return (
    <div style={{ width: '100%' }}>
      <ul className="flex flex-col gap-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {value.map(a => <Chip key={a.path} a={a} />)}
      </ul>
      <p style={{ margin: '8px 0 0', fontFamily: OUTFIT, fontSize: 12.5, color: SOFT, lineHeight: 1.45, textWrap: 'pretty' }}>
        {line ?? 'Sent as attachments. Emails with attachments go out one by one, so a big send can take a few minutes'}
      </p>
    </div>
  );
}

export default function EmailAttachments({ conferenceId, docs, value, onChange, savedAsTemplate }: {
  conferenceId: string;
  docs: DocsOverviewItem[];
  value: EmailAttachment[];
  onChange: (next: EmailAttachment[]) => void;
  /** The email is kept as a template (every builder email is, once saved). */
  savedAsTemplate: boolean;
}) {
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  useLayoutEffect(() => { valueRef.current = value; }, [value]);

  // The menu is portaled at fixed coordinates so the scrolling side column never clips it.
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setMenu(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMenu(null); btnRef.current?.focus(); } };
    const away = () => setMenu(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc, true);
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc, true);
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', away);
    };
  }, [menu]);

  function openMenu() {
    if (menu) { setMenu(null); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 240;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const below = r.bottom + 6;
    const top = below + 120 > window.innerHeight ? Math.max(8, r.top - 6 - 112) : below;
    setMenu({ left, top });
  }

  async function uploadFiles(files: File[]) {
    if (busyRef.current || files.length === 0) return;
    setErr('');
    for (const f of files) {
      if (!isAllowedDocFile(f)) { setErr('Use a PDF, a Word document or a JPG or PNG image'); return; }
      if (f.size > CONFERENCE_DOC_MAX_BYTES) { setErr('The file is over 10 MB. Make it smaller and try again'); return; }
    }
    busyRef.current = true; setUploading(true);
    try {
      const client = await getFreshAuthedClient();
      if (!client) { setErr('Your session ended. Sign in again, then attach the file once more.'); return; }
      for (const f of files) {
        const res = await uploadEmailAttachment(client, conferenceId, f);
        if (!res.ok) { setErr(res.error); return; }
        onChange([...valueRef.current, res.attachment]);
        valueRef.current = [...valueRef.current, res.attachment];
      }
    } finally {
      busyRef.current = false; setUploading(false);
    }
  }

  function toggleDoc(d: DocsOverviewItem) {
    if (!d.file_path) return;
    const has = value.some(a => a.path === d.file_path);
    if (has) { onChange(value.filter(a => a.path !== d.file_path)); return; }
    onChange([...value, {
      path: d.file_path, file_name: d.file_name ?? d.title, size: d.file_size_bytes ?? 0, isConferenceDocument: true, mime: d.mime_type,
    }]);
  }

  const total = attachmentsTotalBytes(value);
  const problem = attachmentsProblem(value);
  const over = total > EMAIL_ATTACH_MAX_BYTES || value.length > EMAIL_ATTACH_MAX_FILES;
  const pct = Math.min(100, Math.round((total / EMAIL_ATTACH_MAX_BYTES) * 100));

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Emoji3D name="Paperclip" size={22} fallback={Paperclip} fallbackColor={FOREST} />
        <p style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 800, color: INK }}>Attachments</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          ref={btnRef}
          type="button"
          onClick={openMenu}
          disabled={uploading}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          className="focus:outline-none inline-flex items-center gap-2 disabled:opacity-60"
          style={{ height: 38, padding: '0 14px', borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: '#FFFFFF', color: INK, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          <Paperclip size={15} strokeWidth={2.4} aria-hidden />
          {uploading ? 'Uploading' : 'Attach files'}
        </button>
        {value.length > 0 && (
          <div className="min-w-0 flex-1" style={{ minWidth: 120 }}>
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: over ? RED : SOFT, fontVariantNumeric: 'tabular-nums' }}>
              {problem ?? `${formatMb(total)} of 10 MB`}
            </p>
            <div aria-hidden style={{ marginTop: 4, height: 4, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.10)', overflow: 'hidden' }}>
              <div style={{ width: `${over ? 100 : pct}%`, height: '100%', borderRadius: 999, backgroundColor: over ? RED : FOREST, transition: 'width 200ms ease' }} />
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={DOC_FILE_ACCEPT}
        className="hidden"
        onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void uploadFiles(fs); }}
      />

      {menu && (
        <Portal>
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[80] flex flex-col"
            style={{ left: menu.left, top: menu.top, width: 240, padding: 6, borderRadius: 14, backgroundColor: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.12), 0 18px 40px rgba(27,56,40,0.22)' }}
          >
            <MenuItem icon={Upload} label="Upload a file" sub="PDF, Word or an image, up to 10 MB each" onClick={() => { setMenu(null); fileRef.current?.click(); }} />
            <MenuItem
              icon={FolderOpen}
              label="From your documents"
              sub={docs.length === 0 ? 'No documents with a file yet' : undefined}
              disabled={docs.length === 0}
              onClick={() => { setMenu(null); setPicking(true); }}
            />
          </div>
        </Portal>
      )}

      {picking && (
        <div className="mt-3" style={{ padding: 10, borderRadius: 14, backgroundColor: 'rgba(27,56,40,0.04)', boxShadow: `inset 0 0 0 1px ${LINE}` }}>
          <p style={{ margin: '0 0 6px', fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: SOFT }}>From your documents</p>
          <ul className="flex flex-col gap-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {docs.map(d => {
              const on = value.some(a => a.path === d.file_path);
              return (
                <li key={d.id}>
                  <label className="flex items-start gap-2.5" style={{ padding: '6px 4px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => toggleDoc(d)} style={{ width: 18, height: 18, marginTop: 2, accentColor: FOREST, flexShrink: 0 }} />
                    <span className="min-w-0">
                      <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{d.title}</span>
                      <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 12, color: SOFT, overflowWrap: 'anywhere' }}>
                        {[d.file_name, formatDocSize(d.file_size_bytes)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="focus:outline-none mt-1 inline-flex items-center gap-1.5"
            style={{ border: 'none', background: 'none', padding: '4px 2px', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
          >
            <Check size={14} strokeWidth={2.6} aria-hidden />Done
          </button>
        </div>
      )}

      {err && (
        <p role="alert" style={{ margin: '8px 0 0', fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: RED, lineHeight: 1.45 }}>{err}</p>
      )}

      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5 mt-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {value.map(a => (
            <Chip key={a.path} a={a} disabled={uploading} onRemove={() => onChange(value.filter(x => x.path !== a.path))} />
          ))}
        </ul>
      )}
      {value.length > 0 && savedAsTemplate && (
        <p style={{ margin: '8px 0 0', fontFamily: OUTFIT, fontSize: 12.5, color: SOFT }}>Attachments are not saved with the template</p>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, sub, onClick, disabled }: {
  icon: typeof Upload; label: string; sub?: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="focus:outline-none flex items-start gap-2.5 text-left disabled:opacity-50"
      style={{ padding: '9px 10px', borderRadius: 10, border: 'none', backgroundColor: 'transparent', cursor: disabled ? 'default' : 'pointer', fontFamily: OUTFIT }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      <Icon size={17} strokeWidth={2.3} style={{ color: FOREST, flexShrink: 0, marginTop: 1 }} aria-hidden />
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: INK }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: SOFT, marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}
