'use client';
// Gavelling Crisis: the picture (banner) and the attached file of a newsflash written inside a reply.
// It uses the same upload helpers, file types and limits as the News page composer
// (uploadCrisisBanner / uploadCrisisFile). The file is uploaded as it is picked (storage only); it is
// attached to the news, and the news published, only when the reply is sent.

import { useRef, useState } from 'react';
import { ImagePlus, Paperclip, X } from 'lucide-react';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, uploadCrisisBanner, uploadCrisisFile } from '@/lib/crisis/api';
import { Btn, CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { ZoomableImage } from '../news/ImageLightbox';

export interface NewsMedia { bannerUrl: string | null; fileUrl: string | null; fileName: string | null }

export default function NewsMediaPicker({ media, onChange }: { media: NewsMedia; onChange: (patch: Partial<NewsMedia>) => void }) {
  const { ref } = useCrisis();
  const [uploading, setUploading] = useState<null | 'banner' | 'file'>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickBanner = async (file: File | undefined) => {
    if (!file) return;
    setUploading('banner');
    try { onChange({ bannerUrl: await uploadCrisisBanner(ref, file) }); }
    catch (e) { notifyErr(crisisError(e, 'Could not upload the picture. Try again.'), 'crisis-effects'); }
    finally { setUploading(null); if (bannerInput.current) bannerInput.current.value = ''; }
  };
  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading('file');
    try { const r = await uploadCrisisFile(ref, file); onChange({ fileUrl: r.url, fileName: r.name }); }
    catch (e) { notifyErr(crisisError(e, 'Could not upload the file. Try again.'), 'crisis-effects'); }
    finally { setUploading(null); if (fileInput.current) fileInput.current.value = ''; }
  };

  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {media.bannerUrl && (
        <div style={{ position: 'relative' }}>
          <ZoomableImage src={media.bannerUrl} alt="Picture of the newsflash" style={{ width: '100%', aspectRatio: '16 / 7', borderRadius: 14, boxShadow: CK.shadowSm }} />
          <button type="button" aria-label="Remove the picture" onClick={() => onChange({ bannerUrl: null })}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ position: 'absolute', top: 6, right: 6, border: 0, borderRadius: 9, width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.92)', color: CK.red, boxShadow: CK.shadowSm }}>
            <X size={15} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        <Btn tone="ghost" size="sm" icon={<ImagePlus size={14} strokeWidth={1.5} />} disabled={!!uploading} onClick={() => bannerInput.current?.click()}>
          {uploading === 'banner' ? 'Uploading the picture' : media.bannerUrl ? 'Change the picture' : 'Add a picture'}
        </Btn>
        <Btn tone="ghost" size="sm" icon={<Paperclip size={14} strokeWidth={1.5} />} disabled={!!uploading || !!media.fileUrl} onClick={() => fileInput.current?.click()}>
          {uploading === 'file' ? 'Uploading the file' : 'Attach a file'}
        </Btn>
        <input ref={bannerInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" aria-label="Choose a picture" onChange={(e) => { void pickBanner(e.target.files?.[0]); }} />
        <input ref={fileInput} type="file" accept="application/pdf,text/plain,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx" className="hidden" aria-label="Choose a file to attach" onChange={(e) => { void pickFile(e.target.files?.[0]); }} />
      </div>
      {media.fileUrl && (
        <div className="flex items-center" style={{ gap: 8, background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, borderRadius: 12, padding: '6px 10px' }}>
          <Paperclip size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.inkSoft, flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: CK.ink, overflowWrap: 'anywhere' }}>{media.fileName || 'Attached file'}</span>
          <button type="button" aria-label="Remove the file" onClick={() => onChange({ fileUrl: null, fileName: null })}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ border: 0, background: 'transparent', cursor: 'pointer', lineHeight: 0, color: CK.muted, padding: 4 }}>
            <X size={15} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
