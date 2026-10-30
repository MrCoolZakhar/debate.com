'use client';
// Gavelling Crisis: a full-screen image viewer. The whole picture, never cropped, on a dark wash; Escape, the
// close button or a press on the wash closes it. It sits above every pop-up (z 10080) and takes the Escape key
// first (capture phase), so the pop-up underneath stays open. `ZoomableImage` is the usual way in: a picture that
// opens this viewer when it is pressed (owner, 30 Oct 2026: every news image can be opened fully).

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Expand, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { CK, useScrollLock } from '../../crisisKit';

export function ImageLightbox({ src, alt = '', onClose }: { src: string; alt?: string; onClose: () => void }) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useScrollLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return (
    <Portal>
      <div data-image-lightbox role="dialog" aria-modal="true" aria-label={alt || 'Image'} onMouseDown={(e) => { e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 10080, display: 'grid', placeItems: 'center', padding: 'clamp(12px, 3vw, 40px)', background: 'rgba(24,6,8,0.88)', cursor: 'zoom-out', fontFamily: CK.font }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} draggable={false} onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 10, boxShadow: '0 24px 70px rgba(0,0,0,0.5)', cursor: 'default', background: '#fff' }} />
        <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close the image" title="Close (Escape)"
          className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{ position: 'absolute', top: 16, right: 16, width: 42, height: 42, borderRadius: '50%', border: 0, background: 'rgba(255,244,230,0.18)', color: '#FFF4E6', cursor: 'pointer' }}>
          <X size={22} strokeWidth={1.6} />
        </button>
      </div>
    </Portal>
  );
}

/**
 * A picture that opens full size when pressed. It is a button, so do not put it inside another button; where the
 * picture sits inside a clickable card use `asSpan` (a span with role="button") instead.
 */
export function ZoomableImage({ src, alt = '', style, imgStyle, asSpan, hint = true, onError }: {
  src: string;
  alt?: string;
  /** The frame (size, radius). */
  style?: CSSProperties;
  /** The picture itself; it covers the frame by default. */
  imgStyle?: CSSProperties;
  asSpan?: boolean;
  /** A small "open full size" mark in the corner. */
  hint?: boolean;
  onError?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const show = (e: MouseEvent | React.KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); setOpen(true); };
  const frame: CSSProperties = { position: 'relative', display: 'block', padding: 0, border: 0, background: 'transparent', cursor: 'zoom-in', overflow: 'hidden', lineHeight: 0, ...style };
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} onError={onError} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...imgStyle }} />
      {hint && (
        <span aria-hidden className="grid place-items-center" style={{ position: 'absolute', right: 6, bottom: 6, width: 24, height: 24, borderRadius: 8, background: 'rgba(28,20,16,0.55)', color: '#fff' }}>
          <Expand size={13} strokeWidth={1.6} />
        </span>
      )}
    </>
  );
  return (
    <>
      {asSpan ? (
        <span role="button" tabIndex={0} aria-label={alt ? `Open ${alt} full size` : 'Open the image full size'} title="Open full size"
          onClick={show} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') show(e); }}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={frame}>{inner}</span>
      ) : (
        <button type="button" aria-label={alt ? `Open ${alt} full size` : 'Open the image full size'} title="Open full size" onClick={show}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={frame}>{inner}</button>
      )}
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
