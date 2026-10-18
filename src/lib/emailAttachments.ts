// emailAttachments.ts — files attached to a one-off builder email (prompt 113),
// and since prompt 133 to an automatic email (saved on email_templates.attachments).
//
// The builder keeps a list of attachments for ONE send (never saved with the
// template). Every outbox row of the send carries them as
// [{ bucket: 'conference-documents', path, file_name }]; the database's insert
// trigger checks them (this conference's own files only, PDF / Word / JPG /
// PNG, at most 10 files and 10 MB in total) and fills mime type and size, and
// send-emails v19 sends a row with attachments on its own through Resend.
// The switch is conference_documents_overview().attachments_enabled
// (store_flags.email_attachments, or a demo conference).

import type { getAuthedClient } from '@/lib/supabase-auth';
import type { EmailBlock } from '@/lib/emailBlocks';
import { safeStorageKey } from '@/lib/storageKey';
import { CONFERENCE_DOCS_BUCKET, docMimeFor } from '@/lib/conferenceDocuments';
import { friendlyError } from '@/lib/friendlyError';

export const EMAIL_ATTACH_MAX_FILES = 10;
export const EMAIL_ATTACH_MAX_BYTES = 10 * 1024 * 1024;

export interface EmailAttachment {
  path: string;
  file_name: string;
  size: number;
  /** One of the conference's own documents (adds "Open on Gavelling"). */
  isConferenceDocument: boolean;
  /** For the chip's icon only. */
  mime?: string | null;
}

/** What goes on email_outbox.attachments. */
export interface OutboxAttachment { bucket: 'conference-documents'; path: string; file_name: string }

export function outboxAttachments(list: EmailAttachment[]): OutboxAttachment[] {
  return list.map(a => ({ bucket: 'conference-documents', path: a.path, file_name: a.file_name }));
}

/** What goes on email_templates.attachments (automatic emails only, prompt
 *  133): the same files, with type and size; the template trigger checks and
 *  normalises them, and every outbox row queued from the template copies them. */
export interface TemplateAttachment { bucket: 'conference-documents'; path: string; file_name: string; mime_type: string | null; size: number }

export function templateAttachments(list: EmailAttachment[]): TemplateAttachment[] | null {
  if (list.length === 0) return null;
  return list.map(a => ({ bucket: 'conference-documents', path: a.path, file_name: a.file_name, mime_type: a.mime ?? null, size: Number(a.size) || 0 }));
}

/** A template's saved attachments back into the picker's chips. A file that is
 *  one of the conference's documents (`docPaths`) counts as one. */
export function fromTemplateAttachments(raw: unknown, docPaths: Set<string>): EmailAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: EmailAttachment[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.path !== 'string' || !o.path) continue;
    out.push({
      path: o.path,
      file_name: typeof o.file_name === 'string' && o.file_name ? o.file_name : o.path.split('/').pop() ?? 'File',
      size: Number(o.size) || 0,
      isConferenceDocument: docPaths.has(o.path),
      mime: typeof o.mime_type === 'string' ? o.mime_type : null,
    });
  }
  return out;
}

export function attachmentsTotalBytes(list: EmailAttachment[]): number {
  return list.reduce((n, a) => n + (Number(a.size) || 0), 0);
}

/** "2.4 MB" (one decimal under 10, whole above); "0.3 MB" for small files. */
export function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb === 0) return '0 MB';
  if (mb < 10) return `${Math.max(0.1, Math.round(mb * 10) / 10)} MB`;
  return `${Math.round(mb)} MB`;
}

/** Why Send is blocked by the attachments, or null. */
export function attachmentsProblem(list: EmailAttachment[]): string | null {
  if (list.length > EMAIL_ATTACH_MAX_FILES) return 'Attach up to 10 files';
  if (attachmentsTotalBytes(list) > EMAIL_ATTACH_MAX_BYTES) return 'Over 10 MB. Remove a file to send';
  return null;
}

/** The blocks for THIS send: when a conference document is attached and the
 *  email has no "documents" button yet, one "Open on Gavelling" button is added
 *  at the end. The saved template is never changed. */
export function withDocumentsButton(blocks: EmailBlock[], list: EmailAttachment[] | undefined): EmailBlock[] {
  if (!list?.some(a => a.isConferenceDocument)) return blocks;
  if (blocks.some(b => b.type === 'button' && b.destination === 'documents')) return blocks;
  return [...blocks, { type: 'button', label: 'Open on Gavelling', destination: 'documents' }];
}

/** The trigger's own refusals (hint 'email_attachments'), read back as a sentence. */
export function isAttachmentMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return /^Attachments are not switched on/i.test(message)
    || /^Attach up to 10 files/i.test(message)
    || /^One attachment did not finish uploading/i.test(message)
    || /^Attach PDFs, Word documents/i.test(message)
    || /^The attachments come to/i.test(message);
}

/** Uploads one file for an email to conference-documents/<conference>/email/. */
export async function uploadEmailAttachment(
  client: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  file: File,
): Promise<{ ok: true; attachment: EmailAttachment } | { ok: false; error: string }> {
  const path = safeStorageKey(`${conferenceId}/email`, String(Date.now()), file.name);
  const mime = docMimeFor(file);
  try {
    const { error } = await client.storage.from(CONFERENCE_DOCS_BUCKET)
      .upload(path, file, { contentType: mime ?? undefined, upsert: false });
    if (error) return { ok: false, error: friendlyError(error, `"${file.name}" couldn't be uploaded. Try again in a moment.`) };
  } catch (e) {
    return { ok: false, error: friendlyError(e, `"${file.name}" couldn't be uploaded. Try again in a moment.`) };
  }
  return { ok: true, attachment: { path, file_name: file.name, size: file.size, isConferenceDocument: false, mime } };
}
