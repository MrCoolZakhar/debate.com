'use client';

// ReturnFileViewer.tsx — shows one copy a participant sent back (prompt 111).
// A PDF in PdfViewer, an image fitted with "Open full size", a Word file as its
// name and size with "Download to open". Files live in the private
// document-returns bucket and are read through 300-second signed URLs; a link
// that opens a new tab is signed inside the click.

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import PdfViewer, { type PdfZoom } from '@/components/documents/PdfViewer';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { notifyErr } from '@/lib/appNotify';
import { DOCUMENT_RETURNS_BUCKET, docTypeLabel, formatDocSize, openStoredFile } from '@/lib/conferenceDocuments';
import { IconDisc, TINT_GOLD, INK, INK_SOFT } from '../financials/dashboardKit';

const SIGN_SECONDS = 300;

type Kind = 'pdf' | 'image' | 'other';
function kindOf(mime: string | null, name: string | null): Kind {
  const m = (mime ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (m.startsWith('image/') || /\.(jpe?g|png)$/.test(n)) return 'image';
  return 'other';
}

export default function ReturnFileViewer({ path, fileName, mime, size }: {
  path: string; fileName: string | null; mime: string | null; size: number | null;
}) {
  const kind = kindOf(mime, fileName);
  const [url, setUrl] = useState<{ path: string; url: string | null } | null>(null);
  const [zoom, setZoom] = useState<PdfZoom>('fit');

  // A short signed URL for showing it here (Word files are not shown, so not signed).
  useEffect(() => {
    if (kind === 'other') return;
    let alive = true;
    void (async () => {
      const client = await getFreshAuthedClient();
      const res = client ? await client.storage.from(DOCUMENT_RETURNS_BUCKET).createSignedUrl(path, SIGN_SECONDS) : null;
      if (alive) setUrl({ path, url: res && !res.error ? res.data?.signedUrl ?? null : null });
    })();
    return () => { alive = false; };
  }, [path, kind]);

  async function openNew() {
    const client = await getFreshAuthedClient();
    const ok = client ? await openStoredFile(client, DOCUMENT_RETURNS_BUCKET, path, SIGN_SECONDS) : false;
    if (!ok) notifyErr("The file couldn't be opened. Try again in a moment.", 'conference-docs');
  }

  const current = url && url.path === path ? url : null;

  if (kind === 'other') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, textAlign: 'center' }}>
        <IconDisc icon={{ emoji: 'Page facing up', lucide: FileText, tint: TINT_GOLD }} size={72} />
        <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{fileName ?? 'Their copy'}</p>
        <p style={{ margin: 0, fontSize: 14, color: INK_SOFT }}>{[docTypeLabel(mime), formatDocSize(size)].filter(Boolean).join(', ')}</p>
        <button type="button" className="gv-st-btn gv-st-forest" onClick={openNew}>Download to open</button>
      </div>
    );
  }

  if (!current) return <div className="gv-fd-ph" style={{ flex: 1, margin: 16, minHeight: 240 }} aria-busy="true" />;
  if (!current.url) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 }}>
        <p style={{ margin: 0, fontSize: 15, color: INK_SOFT }}>This copy couldn&apos;t be shown here.</p>
        <button type="button" className="gv-st-btn gv-st-outline" onClick={openNew}>Open in a new tab</button>
      </div>
    );
  }

  if (kind === 'pdf') {
    return (
      <PdfViewer url={current.url} title={fileName ?? 'Their copy'} fileName={fileName ?? undefined} zoom={zoom} onZoomChange={setZoom} compact className="relative flex-1 min-h-0" />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F6F3EC', borderRadius: 14, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={fileName ?? 'Their copy'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
      <div><button type="button" className="gv-st-link" onClick={openNew}>Open full size</button></div>
    </div>
  );
}
