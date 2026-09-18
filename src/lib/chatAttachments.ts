/**
 * Chat attachments (photos, PDFs) and GIFs.
 *
 * STORAGE. Files go to the same public `session-documents` bucket the session documents use
 * (anon INSERT, no UPDATE), under `chat/<committee_id>/<epoch>-<safe name>`. The bucket takes
 * PDF, JPEG, PNG, WebP and GIF up to 10 MB (migration `session_documents_bucket_allow_chat_images`).
 * The upload is a plain XHR so the composer can show progress and abort; the object key carries
 * a timestamp so there is never anything to upsert over.
 *
 * MESSAGE FORMAT. An attachment is an ordinary `messages` row whose content is TWO lines:
 *
 *   📎 report.pdf
 *   https://…/session-documents/chat/<id>/…-report.pdf#gva=pdf&m=application%2Fpdf&s=123456
 *
 * Line one is a readable label, line two the file's own URL with the metadata in the URL
 * FRAGMENT (never sent to the server). A bundle from before this shipped shows exactly those
 * two readable lines and the link still opens the file. A GIF is `GIF: <title>` + the GIPHY
 * original URL, with the small animated preview URL in `p=`.
 *
 * TRUST. Anyone with the session code can insert any content, so a URL is rendered as media
 * ONLY when it points at this project's chat prefix or at GIPHY's media hosts. Anything else
 * falls back to plain text.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { safeStorageKey } from '@/lib/storageKey';

export type ChatAttachmentKind = 'image' | 'pdf' | 'gif';

export interface ChatAttachment {
  kind: ChatAttachmentKind;
  /** The file itself (for a GIF, GIPHY's original rendition). */
  url: string;
  name: string;
  mime?: string;
  size?: number;
  width?: number;
  height?: number;
  /** GIF only: the small animated rendition shown in the bubble. */
  preview?: string;
}

export const CHAT_BUCKET = 'session-documents';
export const CHAT_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const CHAT_ACCEPT = [...CHAT_IMAGE_MIMES, 'application/pdf'].join(',');

const FRAG = '#gva=';
const CHAT_PATH = new RegExp(`^/storage/v1/object/public/${CHAT_BUCKET}/chat/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$`, 'i');
const PROJECT_ORIGIN = (() => { try { return new URL(SUPABASE_URL).origin; } catch { return ''; } })();
const GIPHY_HOST = /^https:\/\/(media\d*\.giphy\.com|i\.giphy\.com)\//;

/**
 * A file in this project's chat folder, and nothing that only LOOKS like one. A plain prefix
 * test let `.../chat/../../<other-bucket>/x.png` through, so the raw string must carry no dot
 * segment (literal or percent-encoded) and no backslash, and the PARSED URL must have exactly
 * this project's origin and the path `/storage/v1/object/public/session-documents/chat/<uuid>/<file>`.
 */
function trustedFileUrl(u: string): boolean {
  if (!PROJECT_ORIGIN) return false;
  const raw = u.split('#')[0].split('?')[0];
  if (raw.includes('\\') || /(^|\/)\.{1,2}(\/|$)/.test(raw) || /%2e|%2f|%5c/i.test(raw)) return false;
  let parsed: URL;
  try { parsed = new URL(u); } catch { return false; }
  if (parsed.origin !== PROJECT_ORIGIN || parsed.username || parsed.password) return false;
  // What was written must be exactly the origin plus the normalised pathname: nothing was
  // resolved away, re-encoded or smuggled in before the host.
  if (raw !== PROJECT_ORIGIN + parsed.pathname) return false;
  return CHAT_PATH.test(parsed.pathname);
}
function trustedGifUrl(u: string): boolean { return GIPHY_HOST.test(u); }

function oneLine(s: string, max = 120): string {
  return s.replace(/[\r\n]+/g, ' ').trim().slice(0, max) || 'file';
}

/** Encode an attachment as message content (see the file header). */
export function encodeAttachment(a: ChatAttachment): string {
  const p = new URLSearchParams();
  p.set('gva', a.kind);
  if (a.mime) p.set('m', a.mime);
  if (a.size != null) p.set('s', String(Math.round(a.size)));
  if (a.width) p.set('w', String(Math.round(a.width)));
  if (a.height) p.set('h', String(Math.round(a.height)));
  if (a.preview) p.set('p', a.preview);
  const label = a.kind === 'gif' ? `GIF: ${oneLine(a.name)}` : `📎 ${oneLine(a.name)}`;
  return `${label}\n${a.url.split('#')[0]}#${p.toString()}`;
}

// Parsing runs for every bubble and list row on every render; content strings are immutable,
// so a small cache keeps it a map lookup.
const cache = new Map<string, ChatAttachment | null>();

/** The attachment in a message's content, or null for an ordinary (or untrusted) message. */
export function parseAttachment(content: string): ChatAttachment | null {
  if (!content || content.indexOf(FRAG) === -1) return null;
  const hit = cache.get(content);
  if (hit !== undefined) return hit;
  const out = parseUncached(content);
  if (cache.size > 500) cache.clear();
  cache.set(content, out);
  return out;
}

function parseUncached(content: string): ChatAttachment | null {
  const lines = content.split('\n');
  if (lines.length !== 2) return null;
  const [label, link] = lines;
  const hash = link.indexOf('#');
  if (hash < 0) return null;
  const url = link.slice(0, hash);
  let p: URLSearchParams;
  try { p = new URLSearchParams(link.slice(hash + 1)); } catch { return null; }
  const kind = p.get('gva');
  const num = (k: string) => { const v = Number(p.get(k)); return Number.isFinite(v) && v > 0 ? v : undefined; };
  if (kind === 'gif') {
    const preview = p.get('p') ?? url;
    if (!trustedGifUrl(url) || !trustedGifUrl(preview) || !label.startsWith('GIF: ')) return null;
    return { kind, url, preview, name: label.slice(5), width: num('w'), height: num('h') };
  }
  if (kind === 'image' || kind === 'pdf') {
    if (!trustedFileUrl(url) || !label.startsWith('📎 ')) return null;
    return {
      kind, url, name: label.slice('📎 '.length),
      mime: p.get('m') ?? undefined, size: num('s'), width: num('w'), height: num('h'),
    };
  }
  return null;
}

/** "Photo" / the PDF's name / "GIF", for the conversation list's last-message line. */
export function attachmentPreview(a: ChatAttachment, photoLabel: string): string {
  if (a.kind === 'image') return `📷 ${photoLabel}`;
  if (a.kind === 'gif') return 'GIF';
  return `📄 ${a.name}`;
}

export function formatBytes(n?: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type FileCheck = { ok: true; kind: 'image' | 'pdf' } | { ok: false; reason: 'type' | 'size' };

export function checkChatFile(file: File): FileCheck {
  const type = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
  const kind = type === 'application/pdf' ? 'pdf' : (CHAT_IMAGE_MIMES as readonly string[]).includes(type) ? 'image' : null;
  if (!kind) return { ok: false, reason: 'type' };
  if (file.size > CHAT_MAX_BYTES) return { ok: false, reason: 'size' };
  return { ok: true, kind };
}

/** Natural size of an image file, or null when the browser cannot decode it. */
export async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file);
      const out = { width: bmp.width, height: bmp.height };
      bmp.close();
      return out;
    }
  } catch { /* fall through to <img> */ }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

export interface UploadHandle {
  promise: Promise<{ url: string } | null>;
  abort: () => void;
}

/**
 * Upload one chat file with progress. Resolves `{url}` on success, null on failure or abort.
 * Goes to the storage REST endpoint with the publishable key, exactly the permission the
 * supabase-js upload in DocumentsModal uses (anon INSERT on the bucket), no upsert.
 */
export function uploadChatFile(committeeId: string, file: File, onProgress: (fraction: number) => void): UploadHandle {
  const path = safeStorageKey(`chat/${committeeId}`, String(Date.now()), file.name);
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const xhr = new XMLHttpRequest();
  const promise = new Promise<{ url: string } | null>((resolve) => {
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${CHAT_BUCKET}/${encodedPath}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(1, e.loaded / e.total)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve({ url: `${SUPABASE_URL}/storage/v1/object/public/${CHAT_BUCKET}/${encodedPath}` });
      } else {
        console.error('Chat attachment upload failed:', xhr.status, xhr.responseText);
        resolve(null);
      }
    };
    xhr.onerror = () => resolve(null);
    xhr.onabort = () => resolve(null);
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}
