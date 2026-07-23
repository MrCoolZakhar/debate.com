'use client';

// Shared in-site PDF viewer, used by both the organizer Documents page and
// the participant PositionPaperCard so a position paper opens inline instead
// of forcing a tab switch. Forest/ivory neumorphic dialog language, matching
// the other site modals (see documents/page.tsx's ModalOverlay).

import { Download, X } from 'lucide-react';
import Portal from '@/components/Portal';

const OUTFIT = "'Outfit', sans-serif";

export default function PositionPaperViewerModal({
  fileUrl, fileName, onClose,
}: {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}) {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="flex flex-col w-full"
          style={{
            backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', borderRadius: 16,
            maxWidth: 820, height: '90vh', boxShadow: '0 20px 60px rgba(27,56,40,0.22)', overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid #DDD4C0', flexShrink: 0 }}>
            <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 14, color: '#1C1410', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}
            </p>
            <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
              <a
                href={fileUrl}
                download={fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 focus:outline-none"
                style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, color: '#EED98A', backgroundColor: '#1B3828', border: 'none', borderRadius: 10, padding: '7px 14px', textDecoration: 'none', cursor: 'pointer' }}
              >
                <Download size={13} /> DOWNLOAD
              </a>
              <button
                onClick={onClose}
                className="flex items-center justify-center focus:outline-none"
                style={{ width: 30, height: 30, borderRadius: 9999, border: '1px solid #DDD4C0', backgroundColor: 'transparent', color: '#9A8A78', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: 12 }}>
            <iframe
              src={fileUrl}
              title={fileName}
              className="w-full h-full"
              style={{ border: '1px solid #DDD4C0', borderRadius: 12, backgroundColor: '#FFFFFF' }}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
