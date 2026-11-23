// Gavelling Crisis: the files a crisis update (news) can carry besides its banner picture.
// Audio (mp3, m4a, wav, ogg), video (mp4, webm, mov) and documents (PDF, Word, PowerPoint, Excel, text, csv, zip).
// One place for the allowed types, the size limits, the kind of a file and the `accept` text of the file pickers.
// The crisis-media bucket must allow the same types and the larger size (docs/crisis/sql/hultmun-press-media.sql).

export type MediaKind = 'image' | 'audio' | 'video' | 'file';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/webm'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const DOC_TYPES = [
  'application/pdf', 'text/plain', 'text/csv', 'application/rtf', 'application/zip',
  'application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/** Every type the bucket and the picker accept. */
export const ALL_FILE_TYPES: string[] = [...IMAGE_TYPES, ...AUDIO_TYPES, ...VIDEO_TYPES, ...DOC_TYPES];
/** The same list for the bucket's `allowed_mime_types`. */
export const BUCKET_MIME_TYPES: string[] = ALL_FILE_TYPES;

export const MAX_DOC_BYTES = 20 * 1024 * 1024;
/** Audio and video are bigger than a document; the bucket's limit is this one. */
export const MAX_RECORDING_BYTES = 50 * 1024 * 1024;

/** The `accept` of a file picker: every type by name, plus the extensions some systems give no type for. */
export const FILE_ACCEPT = [...ALL_FILE_TYPES, '.mp3', '.m4a', '.wav', '.ogg', '.aac', '.mp4', '.m4v', '.webm', '.mov', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv', '.rtf', '.zip', '.txt'].join(',');

const BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', aac: 'audio/aac',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', rtf: 'application/rtf', zip: 'application/zip',
  doc: 'application/msword', ppt: 'application/vnd.ms-powerpoint', xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function extOf(nameOrUrl: string): string {
  const clean = nameOrUrl.split(/[?#]/)[0] ?? '';
  const dot = clean.lastIndexOf('.');
  return dot < 0 ? '' : clean.slice(dot + 1).toLowerCase();
}

/** The kind of a file from its name or address (the extension decides). */
export function mediaKindOf(nameOrUrl: string | null | undefined): MediaKind {
  if (!nameOrUrl) return 'file';
  const t = BY_EXT[extOf(nameOrUrl)] ?? '';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('video/')) return 'video';
  return 'file';
}

/** The type to store a picked file under: its own type when allowed, else the one its extension says (some systems give none). Null = not allowed. */
export function resolveFileType(file: { type: string; name: string }): string | null {
  const own = file.type === 'audio/mp3' ? 'audio/mpeg' : file.type;
  if (own && ALL_FILE_TYPES.includes(own)) return own;
  const byExt = BY_EXT[extOf(file.name)];
  return byExt && ALL_FILE_TYPES.includes(byExt) ? byExt : null;
}

/** The size limit for a type: recordings may be larger than documents. */
export function maxBytesFor(type: string): number {
  return type.startsWith('audio/') || type.startsWith('video/') ? MAX_RECORDING_BYTES : MAX_DOC_BYTES;
}
