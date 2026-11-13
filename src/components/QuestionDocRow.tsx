'use client';

// ── A document attached to a form question (prompt 19) ─────────────────────
//
// In the application form builder (QuestionBuilder with a conferenceId) every
// question card can carry one document, for example a privacy policy above
// "I have read the privacy policy". The file goes to the public bucket
// application-form-docs at <conferenceId>/<question id>-<random>-<safe name>;
// the question keeps { path, name, size }. Removing only clears the question's
// doc and never deletes the file, since saved applications may point at it.
//
// The attach step opens IN the question card, never as a pop-up on the role
// pop-up (CLAUDE.md: a pop-up never opens another pop-up on top of itself).

import { useRef, useState } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { QUESTION_DOCS_BUCKET, type QuestionDoc } from '@/lib/customQuestions';

const FONT = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const DANGER = '#8B2020';
const LINE = '#EDE7D9';
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function mimeFor(file: File): string | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'doc') return 'application/msword';
  return null;
}

function safeName(name: string): string {
  const cleaned = name.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (cleaned || 'document').slice(-80);
}

function sizeWords(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 13,
  fontWeight: 700, color: INK, textDecoration: 'underline', textUnderlineOffset: 3,
};
const solidBtn: React.CSSProperties = {
  border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700,
  color: '#FFFFFF', background: `linear-gradient(180deg, #24493A 0%, ${FOREST} 100%)`,
};

export default function QuestionDocRow({ conferenceId, questionId, doc, onChange }: {
  conferenceId: string;
  questionId: string;
  doc: QuestionDoc | null | undefined;
  onChange: (doc: QuestionDoc | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => { setOpen(false); setFile(null); setErr(''); };

  function pick(f: File | null) {
    setErr('');
    if (!f) { setFile(null); return; }
    if (!mimeFor(f)) { setFile(null); setErr('This file type is not accepted. Choose a PDF or a Word document.'); return; }
    if (f.size > MAX_BYTES) { setFile(null); setErr('This file is larger than 10 MB. Choose a smaller file.'); return; }
    setFile(f);
  }

  async function attach() {
    if (!file || busyRef.current) return;
    const contentType = mimeFor(file);
    if (!contentType) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      const client = await getFreshAuthedClient();
      if (!client) { setErr('Sign in again to attach a document.'); return; }
      const path = `${conferenceId}/${questionId}-${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;
      const { error } = await client.storage.from(QUESTION_DOCS_BUCKET).upload(path, file, { contentType, upsert: false });
      if (error) {
        const m = (error.message || '').toLowerCase();
        setErr(m.includes('size') || m.includes('too large')
          ? 'This file is larger than 10 MB. Choose a smaller file.'
          : m.includes('mime') || m.includes('type')
            ? 'This file type is not accepted. Choose a PDF or a Word document.'
            : 'The document could not be attached. Try again in a moment.');
        return;
      }
      onChange({ path, name: file.name, size: file.size });
      setConfirmRemove(false);
      close();
    } catch {
      setErr('The document could not be attached. Try again in a moment.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-3" style={{ fontFamily: FONT }}>
      {!open && (doc ? (
        <div className="flex items-start gap-2.5 flex-wrap" style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${LINE}`, background: '#FFFFFF' }}>
          <FileText size={18} strokeWidth={1.5} aria-hidden style={{ color: INK, flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1 min-w-0" style={{ minWidth: 160 }}>
            <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: INK, lineHeight: 1.35 }}>{doc.name}</p>
            {doc.size > 0 && <p style={{ margin: '2px 0 0', fontSize: 12, color: INK_SOFT }}>{sizeWords(doc.size)}</p>}
          </div>
          {confirmRemove ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontSize: 13, color: INK }}>Remove it from this question?</span>
              <button type="button" className="focus:outline-none" style={{ ...linkBtn, color: DANGER }} onClick={() => { onChange(null); setConfirmRemove(false); }}>Remove</button>
              <button type="button" className="focus:outline-none" style={linkBtn} onClick={() => setConfirmRemove(false)}>Keep</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button type="button" className="focus:outline-none" style={linkBtn} onClick={() => { setOpen(true); setConfirmRemove(false); }}>Replace</button>
              <button type="button" className="focus:outline-none" style={linkBtn} onClick={() => setConfirmRemove(true)}>Remove</button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 focus:outline-none"
          style={{ background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK }}
        >
          <Paperclip size={16} strokeWidth={1.5} aria-hidden />
          Attach a document
        </button>
      ))}

      {open && (
        <section aria-label="Attach a Document" style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid ${LINE}`, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.05), 0 8px 20px rgba(27,56,40,0.08)' }}>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>Attach a Document</h4>
          <p style={{ margin: '4px 0 12px', fontSize: 13, color: INK_SOFT, lineHeight: 1.45 }}>
            People see it under this question and can download it. PDF or Word, up to 10 MB.
          </p>
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 focus:outline-none"
              style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '7px 14px', background: '#FFFFFF', cursor: busy ? 'default' : 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK }}
            >
              <Paperclip size={15} strokeWidth={1.5} aria-hidden />
              {file ? 'Choose another file' : 'Choose a file'}
            </button>
            {file && <span className="[overflow-wrap:anywhere] min-w-0" style={{ fontSize: 13, color: INK }}>{file.name}</span>}
          </div>
          {err && <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: DANGER }}>{err}</p>}
          <div className="flex items-center justify-end gap-4 mt-4">
            <button type="button" className="focus:outline-none" style={linkBtn} onClick={close} disabled={busy}>Cancel</button>
            <button
              type="button"
              className="focus:outline-none"
              style={{ ...solidBtn, opacity: !file || busy ? 0.55 : 1, cursor: !file || busy ? 'default' : 'pointer' }}
              disabled={!file || busy}
              onClick={() => { void attach(); }}
            >
              {busy ? 'Attaching' : 'Attach'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
