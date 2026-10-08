'use client';

// ProofDrop — the proof of payment box (prompt 96): drag and drop or pick an
// image or a PDF (up to 10 MB). The file is uploaded as soon as it is chosen,
// so "Finish" only ever sends a proof that is already stored; the preview is
// the image itself or the PDF's first page.

import { useEffect, useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { PdfThumb } from '@/components/documents/PdfViewer';
import { DANGER, FOREST, INK_SOFT, IVORY } from './payKit';
import { proofProblem, uploadProof } from './manualApi';

export default function ProofDrop({ conferenceId, onUploaded, disabled }: {
  conferenceId: string;
  /** The stored path once uploaded, or null when the file was removed. */
  onUploaded: (path: string | null) => void;
  disabled?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const seq = useRef(0);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const take = async (f: File | null) => {
    if (!f || disabled) return;
    const problem = proofProblem(f);
    if (problem) { setErr(problem); return; }
    setErr('');
    const my = ++seq.current;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    onUploaded(null);
    setBusy(true);
    const r = await uploadProof(conferenceId, f);
    if (my !== seq.current) return;
    setBusy(false);
    if ('error' in r) { setErr(r.error); setFile(null); setPreview(null); return; }
    onUploaded(r.path);
  };

  const clear = () => {
    seq.current++;
    setFile(null); setPreview(null); setErr(''); setBusy(false);
    if (input.current) input.current.value = '';
    onUploaded(null);
  };

  const isPdf = !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));

  return (
    <div>
      <span style={{ display: 'block', margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>Your proof of payment</span>
      <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" onChange={e => { void take(e.target.files?.[0] ?? null); }} />
      {file && preview ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, borderRadius: 14, background: '#FFFFFF', boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.15)' }}>
          <span style={{ width: 84, height: 108, borderRadius: 8, overflow: 'hidden', background: IVORY, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {isPdf
              ? <PdfThumb url={preview} width={84} height={108} fallback={<FileUp size={24} aria-hidden />} />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={preview} alt="Your proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{file.name}</span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: busy ? INK_SOFT : FOREST }} aria-live="polite">{busy ? 'Uploading' : 'Uploaded'}</span>
          </span>
          <button type="button" className="gv-pay-x" aria-label="Remove this file" onClick={clear} disabled={disabled}><X size={18} strokeWidth={2.4} /></button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files?.[0] ?? null); }}
          style={{
            width: '100%', minHeight: 140, borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', color: '#1C1410',
            background: over ? 'rgba(238,217,138,0.25)' : '#FFFFFF',
            border: `2px dashed ${over ? FOREST : 'rgba(27,56,40,0.28)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16,
          }}
        >
          <FileUp size={26} strokeWidth={2} aria-hidden style={{ color: FOREST }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Drop your proof here, or choose a file</span>
          <span style={{ fontSize: 13, color: INK_SOFT }}>An image or a PDF, up to 10 MB</span>
        </button>
      )}
      {err && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13.5, color: DANGER }}>{err}</p>}
    </div>
  );
}
