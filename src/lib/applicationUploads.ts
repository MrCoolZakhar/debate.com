// Application file answers (question type 'file_upload', WorldMUN, 8 Nov 2026).
//
// One file per question; PDF, Word (.doc, .docx), JPG and PNG; 10 MB. The file
// goes to the PRIVATE bucket 'application-uploads' and the ANSWER is its object
// path, a plain string in custom_answers / aid_custom_answers:
//   signed in:  <conference_id>/<user_id>/<question_id>/<uuid>-<file name>
//   signed out: <conference_id>/drafts/<browser token>/<question_id>/<uuid>-<file name>
// The applicant reads their own files; organisers of the conference read every
// file; a draft-folder file can only be added (never read, listed, replaced or
// deleted) until it is an answer on the caller's own submitted application
// (storage rule application_upload_mine). Files are opened only through
// /files/application/<application>/<question>, which signs a URL on open.
// Never store or render a signed URL.

import type { SupabaseClient } from '@supabase/supabase-js';
import { friendlyError } from '@/lib/friendlyError';

export const APPLICATION_UPLOADS_BUCKET = 'application-uploads';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
export const UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];
/** The file input's accept list: extensions first, so phones and old browsers still match. */
export const UPLOAD_ACCEPT = [...UPLOAD_EXTENSIONS, ...UPLOAD_MIME_TYPES].join(',');

const TYPE_PROBLEM = 'Only PDF, Word, JPG or PNG files can be uploaded.';
const SIZE_PROBLEM = 'This file is over 10 MB. Please upload a smaller file.';
const EMPTY_PROBLEM = 'This file is empty. Please choose another.';
const UPLOAD_FAILED = 'Your file could not be uploaded. Check your connection and try again.';

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

/** Why this file cannot be uploaded, or null. A good extension passes even
 *  with a wrong or empty mime type: the bucket is the final check. */
export function uploadProblem(file: File): string | null {
  const extOk = UPLOAD_EXTENSIONS.includes(extensionOf(file.name));
  const mimeOk = UPLOAD_MIME_TYPES.includes((file.type || '').toLowerCase());
  if (!extOk && !mimeOk) return TYPE_PROBLEM;
  if (file.size === 0) return EMPTY_PROBLEM;
  if (file.size > MAX_UPLOAD_BYTES) return SIZE_PROBLEM;
  return null;
}

/** Letters, digits, dot, dash, underscore and spaces; anything else is "_";
 *  at most 120 characters, keeping the extension. */
function safeFileName(name: string): string {
  const cleaned = (name || 'file').replace(/[^A-Za-z0-9._\- ]/g, '_').trim() || 'file';
  if (cleaned.length <= 120) return cleaned;
  const ext = extensionOf(cleaned);
  const keep = ext.length < 20 ? ext : '';
  return cleaned.slice(0, 120 - keep.length) + keep;
}

/** The object path for a new file (a fresh uuid prefix every time). */
export function uploadPath(
  conferenceId: string,
  owner: { userId: string } | { draftToken: string },
  questionId: string,
  fileName: string,
): string {
  const folder = 'userId' in owner ? owner.userId : `drafts/${owner.draftToken}`;
  return `${conferenceId}/${folder}/${questionId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
}

const memoryTokens = new Map<string, string>();

/** One token per browser per conference for signed-out uploads (the drafts folder). */
export function uploadDraftToken(conferenceId: string): string {
  const key = `gv-apply-upload-token:${conferenceId}`;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored && /^[0-9a-f-]{20,64}$/i.test(stored)) return stored;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    let t = memoryTokens.get(key);
    if (!t) { t = crypto.randomUUID(); memoryTokens.set(key, t); }
    return t;
  }
}

/** The name shown everywhere: the last path segment without its "<uuid>-" prefix. */
export function uploadedFileName(path: string): string {
  const last = (path || '').split('/').pop() ?? '';
  return last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '') || last;
}

/** Where a file answer is opened (signs on open). */
export function applicationFileHref(applicationId: string, questionId: string): string {
  return `/files/application/${applicationId}/${questionId}`;
}

/** Uploads one file to its path. Never upserts: every file gets its own path. */
export async function uploadApplicationFile(
  client: SupabaseClient,
  path: string,
  file: File,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { error } = await client.storage.from(APPLICATION_UPLOADS_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (!error) return { ok: true };
    const raw = `${(error as { message?: string }).message ?? ''} ${String((error as { statusCode?: string | number }).statusCode ?? '')}`;
    if (/413|exceeded the maximum allowed size|Payload too large/i.test(raw)) return { ok: false, message: SIZE_PROBLEM };
    if (/mime type .* is not supported|invalid_mime_type/i.test(raw)) return { ok: false, message: TYPE_PROBLEM };
    if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) return { ok: false, message: UPLOAD_FAILED };
    return { ok: false, message: friendlyError(error, UPLOAD_FAILED) };
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return { ok: false, message: UPLOAD_FAILED };
    return { ok: false, message: friendlyError(e, UPLOAD_FAILED) };
  }
}

/** Best effort: a failure is ignored (a draft file cannot be deleted by design). */
export async function removeApplicationFile(client: SupabaseClient, path: string): Promise<void> {
  try { await client.storage.from(APPLICATION_UPLOADS_BUCKET).remove([path]); } catch { /* ignored */ }
}
