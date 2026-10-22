'use client';

// A document's type and its icon on the organiser's delegation screens (owner,
// 22 Oct 2026: "appropriate icons for every document type"). Style A: a fine
// line Lucide file in bare ink, no tile behind it, with the type written small
// on it (PDF, Word, JPG, PNG) so colour is never the only signal.

import { File, FileImage, FileText, FileType } from 'lucide-react';
import { FONT, INK, STROKE } from './kit';

export type FileKind = 'pdf' | 'word' | 'image' | 'other';

/** The kind from the stored mime type, else the file name's extension. */
export function fileKindOf(mime: string | null | undefined, name: string | null | undefined): FileKind {
  const m = (mime ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase().split(/[?#]/)[0];
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (m.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/.test(n)) return 'image';
  if (m.includes('msword') || m.includes('wordprocessingml') || /\.(docx?|odt|rtf)$/.test(n)) return 'word';
  return 'other';
}

/** The short word on the icon and in sentences. */
export function fileKindWord(kind: FileKind, name: string | null | undefined): string {
  if (kind === 'pdf') return 'PDF';
  if (kind === 'word') return 'Word';
  if (kind === 'image') {
    const ext = (name ?? '').toLowerCase().split(/[?#]/)[0].match(/\.([a-z0-9]+)$/)?.[1];
    return ext === 'png' ? 'PNG' : ext === 'webp' ? 'WebP' : ext === 'gif' ? 'GIF' : 'JPG';
  }
  return 'File';
}

/** Accent for the small type label only (the outline stays ink). */
const LABEL_COLOUR: Record<FileKind, string> = {
  pdf: '#A3341F',
  word: '#2F5597',
  image: '#1F6B45',
  other: INK,
};

const ICON: Record<FileKind, typeof File> = { pdf: FileText, word: FileType, image: FileImage, other: File };

export function FileTypeIcon({ kind, name, size = 34 }: { kind: FileKind; name?: string | null; size?: number }) {
  const Icon = ICON[kind];
  const word = fileKindWord(kind, name);
  return (
    <span className="relative inline-flex flex-shrink-0" title={`${word} file`} style={{ width: size, height: size + 4 }}>
      <Icon size={size} strokeWidth={STROKE} aria-hidden style={{ color: INK }} />
      <span aria-hidden
        style={{
          position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)',
          padding: '0 4px', borderRadius: 4, background: '#FFFFFF', boxShadow: `0 0 0 1px ${LABEL_COLOUR[kind]}33`,
          fontFamily: FONT, fontSize: Math.max(8.5, Math.round(size * 0.27)), fontWeight: 700, lineHeight: 1.35,
          color: LABEL_COLOUR[kind], whiteSpace: 'nowrap',
        }}>
        {word}
      </span>
    </span>
  );
}
