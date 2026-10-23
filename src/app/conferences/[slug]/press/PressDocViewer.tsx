'use client';

// Reading one introduced paper from the Press Desk: a pop-up with the code, the title, the
// sponsors and the paper itself (pdf.js through PdfViewer, or the text on a page card).
// Escape, the X and the backdrop close it; focus returns to the paper's row.

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import PdfViewer, { type PdfZoom } from '@/components/documents/PdfViewer';
import { OUTFIT } from '@/components/neu';
import type { PressDocument, PressRoom } from '@/lib/press';
import { committeeShort } from '../participant/dashboardKit';
import { INK, INK_SOFT, SLATE } from './pressKit';
import { SponsorChips } from './PressRoomCard';

export default function PressDocViewer({ room, doc, onClose }: {
  room: PressRoom;
  doc: PressDocument;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState<PdfZoom>('fit');
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])');
      if (f.length === 0) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      back?.focus?.();
    };
  }, [onClose]);

  const isPdf = !!doc.fileUrl;
  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-0 sm:p-6"
        style={{ zIndex: 80, backgroundColor: 'rgba(28,20,16,0.45)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="press-doc-title"
          className="flex h-full w-full flex-col overflow-hidden sm:h-[min(92dvh,980px)] sm:max-w-[1100px] sm:rounded-[22px]"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 24px 64px color-mix(in srgb, var(--gv-main) 28%, transparent)' }}
        >
          <header className="flex items-start gap-3 px-5 pt-4 pb-3" style={{ boxShadow: 'inset 0 -1px 0 color-mix(in srgb, var(--gv-main) 8%, transparent)' }}>
            <div className="min-w-0 flex-1">
              <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: '#8A6614', margin: 0 }}>
                {committeeShort(room.name, room.abbreviation)}
              </p>
              <h2 id="press-doc-title" className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 800, color: INK, margin: '2px 0 8px 0', lineHeight: 1.25 }}>
                {doc.docCode && <span style={{ color: SLATE }}>{doc.docCode} </span>}
                {doc.title || 'Untitled paper'}
              </h2>
              <SponsorChips sponsors={doc.sponsors} logos={room.session?.seatLogos} />
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-[background-color] duration-150 hover:bg-[var(--gv-main)]/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]"
              style={{ color: INK_SOFT }}
            >
              <X size={19} />
            </button>
          </header>
          <div className="relative min-h-0 flex-1" style={{ backgroundColor: '#E4DCCA' }}>
            {isPdf ? (
              <PdfViewer
                url={doc.fileUrl!}
                title={doc.title || doc.docCode || 'Paper'}
                fileName={doc.fileName ?? undefined}
                zoom={zoom}
                onZoomChange={setZoom}
                className="absolute inset-0"
              />
            ) : doc.content ? (
              <div className="absolute inset-0 overflow-y-auto px-4 py-6">
                <div
                  className="mx-auto max-w-[760px] rounded-[10px] p-6 sm:p-10 whitespace-pre-wrap [overflow-wrap:anywhere]"
                  style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 10px color-mix(in srgb, var(--gv-main) 12%, transparent)', fontFamily: OUTFIT, fontSize: 15.5, lineHeight: 1.65, color: INK }}
                >
                  {doc.content}
                </div>
              </div>
            ) : (
              <p className="p-8 text-center" style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT }}>This paper has no file or text attached</p>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
