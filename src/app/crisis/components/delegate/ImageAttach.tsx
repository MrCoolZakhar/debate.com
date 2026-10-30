'use client';
// Gavelling Crisis: the optional picture on a directive or a clarification. `useImageAttach` uploads the picked
// picture at once (crisis-media bucket) and keeps its address; `AttachBar` is the small pin at the bottom inside a
// text box, with the picture's thumbnail (opens full size) and a remove button beside it. The address becomes the
// last line of the text (see directives/attachedImage.tsx).

import { useCallback, useRef, useState } from 'react';
import { LoaderCircle, Paperclip, X } from 'lucide-react';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, uploadCrisisImage, type CrisisRef } from '@/lib/crisis/api';
import { CK } from '../../crisisKit';
import { ZoomableImage } from '../news/ImageLightbox';

export function useImageAttach(cref: CrisisRef, initial: string | null = null) {
  const [url, setUrl] = useState<string | null>(initial);
  const [uploading, setUploading] = useState(false);
  const busy = useRef(false);
  const pick = useCallback(async (file: File | null | undefined) => {
    if (!file || busy.current) return;
    busy.current = true;
    setUploading(true);
    try { setUrl(await uploadCrisisImage(cref, file)); }
    catch (e) { notifyErr(crisisError(e, 'Could not attach the image. Try again.'), 'crisis-attach'); }
    finally { busy.current = false; setUploading(false); }
  }, [cref]);
  return { url, setUrl, uploading, pick };
}

export function AttachBar({ url, uploading, onPick, onClear, disabled }: {
  url: string | null; uploading: boolean; onPick: (f: File | null | undefined) => void; onClear: () => void; disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <span className="inline-flex items-center" style={{ gap: 8, fontFamily: CK.font }}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
        onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
      <button type="button" onClick={() => input.current?.click()} disabled={disabled || uploading}
        aria-label={url ? 'Replace the attached image' : 'Attach an image'} title={url ? 'Replace the image' : 'Attach an image (optional)'}
        className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] disabled:opacity-50"
        style={{ width: 30, height: 30, borderRadius: 9, border: 0, background: CK.well, color: CK.forest, cursor: 'pointer' }}>
        {uploading ? <LoaderCircle size={16} strokeWidth={1.6} className="animate-spin" aria-hidden /> : <Paperclip size={16} strokeWidth={1.5} aria-hidden />}
      </button>
      {url && (
        <span className="inline-flex items-center" style={{ gap: 6 }}>
          <ZoomableImage src={url} alt="Attached image" hint={false} style={{ width: 34, height: 34, borderRadius: 8, boxShadow: '0 0 0 1px rgba(110,30,30,0.18)' }} />
          <button type="button" onClick={onClear} aria-label="Remove the attached image" title="Remove the image"
            className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ width: 22, height: 22, borderRadius: '50%', border: 0, background: CK.well, color: CK.inkSoft, cursor: 'pointer' }}>
            <X size={13} strokeWidth={1.8} aria-hidden />
          </button>
        </span>
      )}
      {uploading && !url && <span style={{ fontSize: 12, fontWeight: 600, color: CK.muted }}>Uploading</span>}
    </span>
  );
}
