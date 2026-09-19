/**
 * "Request a language" from the sessions language pickers.
 *
 * The Rules of Procedure file goes to the PRIVATE storage bucket
 * `language-requests` (insert-only for anon/authenticated, no read policy, so
 * only the team reads it from the Supabase dashboard). The row goes to
 * `language_requests` (RLS insert-only, no select). A BEFORE INSERT trigger
 * normalises, rate limits (3 per email and 60 overall per hour) and checks the
 * named file exists; an AFTER INSERT trigger queues the team email in
 * `email_outbox` (conference_id null, reply_to the requester).
 */
import { supabase } from '@/lib/supabase';

export const LANGUAGE_REQUEST_MAX_BYTES = 10 * 1024 * 1024;
export const LANGUAGE_REQUEST_ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

/** The content type we upload with, or null when the file is not PDF / DOC / DOCX. */
export function languageRequestFileType(file: File): string | null {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const byExt = MIME_BY_EXT[ext];
  if (!byExt) return null;
  if (file.type && !Object.values(MIME_BY_EXT).includes(file.type) && file.type !== 'application/octet-stream') return null;
  return byExt;
}

function randomId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

export type LanguageRequestResult = 'ok' | 'rate_limited' | 'error';

export async function submitLanguageRequest(input: {
  language: string;
  email: string;
  file: File;
  locale: string;
  page: string;
}): Promise<LanguageRequestResult> {
  const contentType = languageRequestFileType(input.file);
  if (!contentType || input.file.size > LANGUAGE_REQUEST_MAX_BYTES) return 'error';
  const safe = input.file.name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+/, '').slice(-120) || 'rules-of-procedure';
  const path = `requests/${randomId()}/${safe}`;
  try {
    const up = await supabase.storage.from('language-requests').upload(path, input.file, { upsert: false, contentType });
    if (up.error) return 'error';
    const { error } = await supabase.from('language_requests').insert({
      language: input.language.trim().slice(0, 80),
      email: input.email.trim().toLowerCase(),
      file_path: path,
      locale: input.locale,
      page: input.page.slice(0, 200),
    });
    if (error) return /rate_limited/.test(error.message) ? 'rate_limited' : 'error';
    return 'ok';
  } catch {
    return 'error';
  }
}
