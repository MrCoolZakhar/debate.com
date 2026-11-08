'use client';

// ── A file answer (question type 'file_upload', WorldMUN, 8 Nov 2026) ──────
//
// One file per question; the answer is the object path in the private bucket
// application-uploads (src/lib/applicationUploads.ts). Signed in, the file goes
// to the user's folder; signed out, to the conference's drafts folder under a
// browser token (add only: it becomes readable once it is an answer on their
// own submitted application). onChange is called ONLY after an upload landed.
// Remove and Replace remove the old object afterwards, best effort.
//
// Shared by ApplicationQuestionCard (the apply form) and CustomQuestionsField
// (the aid form and the other plain forms). Colours follow the conference's
// own scheme (var(--gv-main)) with Gavelling's forest as the fallback.

import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { supabase as anonClient } from '@/lib/supabase';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { notifyErr } from '@/lib/appNotify';
import {
  APPLICATION_UPLOADS_BUCKET, UPLOAD_ACCEPT, removeApplicationFile, uploadApplicationFile,
  uploadDraftToken, uploadPath, uploadProblem, uploadedFileName,
} from '@/lib/applicationUploads';

const FONT = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const DANGER = '#8B2020';
const MAIN = 'var(--gv-main, #1B3828)';

export interface UploadContext { conferenceId: string; userId: string | null }

function sizeWords(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const textBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 13,
  fontWeight: 700, color: INK, textDecoration: 'underline', textUnderlineOffset: 3,
};

export default function FileUploadField({ questionId, value, onChange, upload, describedBy, invalid = false, onUploadingChange }: {
  questionId: string;
  value: string;
  onChange: (path: string) => void;
  upload?: UploadContext;
  describedBy?: string;
  invalid?: boolean;
  /** Told when an upload starts and ends, so the page can hold Next / Submit. */
  onUploadingChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The latest onChange: an upload resolves after the click, and the parent's
  // callback from that render may hold answers that changed since.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const onBusyRef = useRef(onUploadingChange);
  useEffect(() => { onBusyRef.current = onUploadingChange; }, [onUploadingChange]);
  // An upload still running when the field unmounts must not hold the page.
  useEffect(() => () => { if (busyRef.current) onBusyRef.current?.(false); }, []);

  if (!upload) {
    return <p style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, margin: 0 }}>File uploads are not available here.</p>;
  }

  async function clientFor() {
    if (upload?.userId) return await getFreshAuthedClient();
    return anonClient;
  }

  async function handleFile(file: File | null | undefined) {
    if (!file || !upload || busyRef.current) return;
    setErr('');
    const problem = uploadProblem(file);
    if (problem) { setErr(problem); return; }
    busyRef.current = true;
    setBusy(true);
    onBusyRef.current?.(true);
    try {
      const client = await clientFor();
      if (!client) { setErr('Your session has expired. Please sign in again.'); return; }
      const owner = upload.userId ? { userId: upload.userId } : { draftToken: uploadDraftToken(upload.conferenceId) };
      const path = uploadPath(upload.conferenceId, owner, questionId, file.name);
      const r = await uploadApplicationFile(client, path, file);
      if (!r.ok) { setErr(r.message); return; }
      const previous = value;
      setSizes(prev => ({ ...prev, [path]: file.size }));
      onChangeRef.current(path);
      if (previous) void removeApplicationFile(client, previous);
    } finally {
      busyRef.current = false;
      setBusy(false);
      onBusyRef.current?.(false);
    }
  }

  async function remove() {
    if (busyRef.current || !value) return;
    const previous = value;
    setErr('');
    onChangeRef.current('');
    const client = await clientFor();
    if (client) void removeApplicationFile(client, previous);
  }

  async function open() {
    if (!value) return;
    // The tab opens inside the click, before any await, so it is never blocked.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const client = await getFreshAuthedClient();
      const { data, error } = client
        ? await client.storage.from(APPLICATION_UPLOADS_BUCKET).createSignedUrl(value, 600)
        : { data: null, error: true };
      if (error || !data?.signedUrl) { tab?.close(); notifyErr('You can open this file once your application is submitted.'); return; }
      if (tab) tab.location.href = data.signedUrl; else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      tab?.close();
      notifyErr('You can open this file once your application is submitted.');
    }
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={UPLOAD_ACCEPT}
      className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void handleFile(f); }}
    />
  );

  const name = value ? uploadedFileName(value) : '';
  const size = value ? sizes[value] : undefined;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void handleFile(e.dataTransfer.files?.[0]); }}
      style={{ fontFamily: FONT }}
    >
      {picker}
      {value && !busy ? (
        <div
          className="flex items-start gap-2.5 flex-wrap"
          style={{ padding: '10px 12px', borderRadius: 14, border: `1px solid ${over ? MAIN : 'rgba(28,20,16,0.12)'}`, background: '#FFFFFF' }}
        >
          <FileText size={20} strokeWidth={1.5} aria-hidden style={{ color: MAIN, flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1 min-w-0" style={{ minWidth: 150 }}>
            {upload.userId ? (
              <button
                type="button"
                onClick={() => { void open(); }}
                className="text-left focus:outline-none [overflow-wrap:anywhere]"
                style={{ ...textBtn, fontSize: 14, fontWeight: 700, color: INK }}
              >
                {name}
              </button>
            ) : (
              <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK }}>{name}</p>
            )}
            {size ? <p style={{ margin: '2px 0 0', fontSize: 12, color: INK_SOFT }}>{sizeWords(size)}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="focus:outline-none" style={textBtn} onClick={() => inputRef.current?.click()}>Replace</button>
            <button type="button" className="focus:outline-none" style={textBtn} onClick={() => { void remove(); }}>Remove</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            data-upload
            aria-describedby={describedBy}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
            style={{
              border: `1.5px ${over ? 'solid' : 'dashed'} ${invalid ? DANGER : MAIN}`, borderRadius: 12, padding: '10px 16px',
              background: '#FFFFFF', color: MAIN, fontFamily: FONT, fontSize: 14, fontWeight: 700,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Upload size={16} strokeWidth={1.75} aria-hidden />}
            {busy ? 'Uploading...' : 'Upload file'}
          </button>
          <span style={{ fontSize: 12.5, color: INK_SOFT }}>PDF, Word, JPG or PNG, up to 10 MB</span>
        </div>
      )}
      {err && (
        <p role="alert" style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: DANGER, margin: '9px 0 0' }}>{err}</p>
      )}
    </div>
  );
}
