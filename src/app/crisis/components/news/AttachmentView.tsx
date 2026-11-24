'use client';
// Gavelling Crisis: the file attached to a crisis update (news). Audio and video play right where they are (native players),
// an image opens full size, anything else (PDF, Word, zip and so on) is a download chip. `compact` draws the chip only,
// with the kind's icon, for lists and small cards. `onRemove` adds the X the composer needs.

import { FileAudio, FileDown, FileVideo, ImageIcon, X } from 'lucide-react';
import { mediaKindOf, type MediaKind } from '@/lib/crisis/mediaTypes';
import { CK } from '../../crisisKit';
import { ZoomableImage } from './ImageLightbox';

export const KIND_WORD: Record<MediaKind, string> = { image: 'Image', audio: 'Audio', video: 'Video', file: 'File' };

export function KindIcon({ kind, size = 16 }: { kind: MediaKind; size?: number }) {
  const common = { size, strokeWidth: 1.5, 'aria-hidden': true as const, style: { flexShrink: 0 } };
  if (kind === 'audio') return <FileAudio {...common} />;
  if (kind === 'video') return <FileVideo {...common} />;
  if (kind === 'image') return <ImageIcon {...common} />;
  return <FileDown {...common} />;
}

export default function AttachmentView({ url, name, compact, onRemove }: {
  url: string; name?: string | null; compact?: boolean; onRemove?: () => void;
}) {
  const byName = mediaKindOf(name);
  const kind = byName !== 'file' ? byName : mediaKindOf(url);
  const label = name || (kind === 'file' ? 'Download the attached file' : `Attached ${KIND_WORD[kind].toLowerCase()}`);
  const remove = onRemove && (
    <button
      type="button" aria-label="Remove the file" onClick={onRemove}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{ border: 0, background: 'transparent', cursor: 'pointer', lineHeight: 0, color: CK.muted, padding: 4, flex: 'none' }}
    ><X size={16} strokeWidth={1.5} aria-hidden /></button>
  );

  const chip = (
    <div className="flex items-center gap-2" style={{ background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, borderRadius: 12, padding: '8px 12px', fontFamily: CK.font }}>
      <span style={{ color: CK.inkSoft, display: 'inline-flex' }}><KindIcon kind={kind} /></span>
      {compact || onRemove ? (
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{label}</span>
      ) : (
        <a
          href={url} target="_blank" rel="noopener noreferrer" download={name || undefined}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: CK.forest, textDecoration: 'underline', overflowWrap: 'anywhere' }}
        >{label}</a>
      )}
      {remove}
    </div>
  );

  if (compact || kind === 'file') return chip;

  if (kind === 'image') {
    return (
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <ZoomableImage src={url} alt={name || 'Attached image'} style={{ width: 'min(100%, 420px)', aspectRatio: '16 / 10', borderRadius: 14, boxShadow: CK.shadowSm }} />
        {onRemove && (
          <button
            type="button" aria-label="Remove the file" onClick={onRemove}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ position: 'absolute', top: 6, right: 6, border: 0, borderRadius: 9, width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.92)', color: CK.red, boxShadow: CK.shadowSm }}
          ><X size={15} strokeWidth={1.5} aria-hidden /></button>
        )}
      </div>
    );
  }

  // Audio and video: the browser's own player, with the file name above and a download link beneath.
  return (
    <div style={{ background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, borderRadius: 14, padding: '10px 12px', fontFamily: CK.font }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <span style={{ color: CK.inkSoft, display: 'inline-flex' }}><KindIcon kind={kind} /></span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>{label}</span>
        {remove}
      </div>
      {kind === 'audio' ? (
        <audio controls preload="metadata" src={url} style={{ width: '100%', display: 'block' }}>
          <a href={url} target="_blank" rel="noopener noreferrer">Open the audio</a>
        </audio>
      ) : (
        <video controls playsInline preload="metadata" src={url} style={{ width: '100%', maxHeight: 360, display: 'block', borderRadius: 10, background: '#000' }}>
          <a href={url} target="_blank" rel="noopener noreferrer">Open the video</a>
        </video>
      )}
      <a
        href={url} target="_blank" rel="noopener noreferrer" download={name || undefined}
        className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: CK.forest, textDecoration: 'underline' }}
      >Download</a>
    </div>
  );
}

/** One small line for a card or pop-up: the kind's icon and "Audio attached", "Video attached", "File attached". `light` is for the dark red pop-up. */
export function AttachmentTag({ url, name, light }: { url: string; name?: string | null; light?: boolean }) {
  const byName = mediaKindOf(name);
  const kind = byName !== 'file' ? byName : mediaKindOf(url);
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12.5, fontWeight: 700, color: light ? CK.gold : CK.inkSoft }}>
      <KindIcon kind={kind} size={14} />{KIND_WORD[kind]} attached
    </span>
  );
}
