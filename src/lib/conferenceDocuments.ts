// Conference-wide documents (11 Oct 2026, owner: "add a tab in there that
// allows someone to upload a separate document which will come up under the
// applicants 'you' tab"). Rules of Procedure, logistics packs, schedules, a
// code of conduct: one upload for the whole conference, read by every
// accepted / assigned / checked-in participant.
//
// The table `conference_documents`, its RLS and the PRIVATE bucket
// `conference-documents` are live (migration `conference_documents`, applied
// 11 Oct 2026; source scratch-conference-documents.sql). Organisers manage;
// accepted / assigned / checked-in participants and committee chairs read,
// narrowed by `visible_to`. Files are opened through short-lived signed URLs,
// never a public URL.
//
// Document Uploads (12 Oct 2026, prompt 110). Behind store_flags.docs_extra
// (and email_attachments for files on emails); a demo conference (is_demo,
// e.g. the demo LIMUN) behaves as if both are on, and every new RPC refuses
// with a plain sentence on any other conference while the switch is off.
//   Columns  description (up to 1000), ask_back (people send a copy back),
//            due_at, required (with ask_back only; a warning, never a check-in
//            block), accepted_only (default true; false also shows it to
//            applicants under review), mime_type, active / removed_at /
//            removed_by (Remove is soft), and kind 'extra'. A document people
//            must send back needs an uploaded file, not a link.
//   Buckets  conference-documents (private, 10 MB): PDF, Word (.docx, .doc),
//            JPG, PNG. document-returns (private, same types, 10 MB): the
//            copies people send back, at <conference>/<document>/<application>/<file>;
//            only the applicant uploads (their own folder, upsert false: a new
//            copy is a new file); the uploader, the organizers and platform
//            admins read; nobody overwrites or deletes from the browser.
//   RPCs     organizers: save_conference_document, remove_conference_document,
//            conference_documents_overview, document_returns_overview,
//            review_document_return. Participants: my_conference_documents
//            (the two-argument one), submit_document_return,
//            replace_document_return. One typed wrapper each below; every one
//            takes the client from getFreshAuthedClient() at call time.
// A document people sent back is removed (active false), never deleted: the
// database refuses the delete. The five document emails are sent by the
// server only (event-emails v2), never from here.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { BookOpen, CalendarDays, FileText, Handshake, MapPin, type LucideIcon } from 'lucide-react';
import { safeStorageKey } from '@/lib/storageKey';

export const CONFERENCE_DOCS_BUCKET = 'conference-documents';
export const CONFERENCE_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const CONFERENCE_DOC_TITLE_MAX = 120;
/** The copies people send back (Document Uploads). */
export const DOCUMENT_RETURNS_BUCKET = 'document-returns';
/** The five file types both buckets take: PDF, Word (.docx and .doc), JPG, PNG. */
export const DOC_ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
] as const;
/** For a file input's accept attribute. */
export const DOC_FILE_ACCEPT = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', ...DOC_ALLOWED_MIME].join(',');

const DOC_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** The file's MIME type when it is one of the five, else from its extension, else null.
 *  Always upload with this as contentType: the buckets refuse anything else. */
export function docMimeFor(file: File): string | null {
  if ((DOC_ALLOWED_MIME as readonly string[]).includes(file.type)) return file.type;
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  return (ext && DOC_MIME_BY_EXT[ext]) || null;
}

export function isAllowedDocFile(file: File): boolean {
  return docMimeFor(file) !== null && file.size <= CONFERENCE_DOC_MAX_BYTES;
}

/** Whether a stored file can be drawn in the browser (a PDF or a JPG / PNG image);
 *  a Word document cannot, so screens offer Download for it instead. */
export function canPreviewDoc(mime: string | null | undefined, name: string | null | undefined): boolean {
  const m = mime ?? '';
  const n = (name ?? '').toLowerCase();
  return m === 'application/pdf' || m.startsWith('image/') || n.endsWith('.pdf') || /\.(jpe?g|png)$/.test(n);
}

/** "PDF", "Word" or "Image". */
export function docTypeLabel(mime: string | null | undefined): string {
  if (!mime) return '';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.includes('word')) return 'Word';
  return '';
}

/** Where a sent-back copy goes: <conference>/<document>/<application>/<epoch>-<name>.
 *  Exactly four segments; the database checks it. */
export function documentReturnPath(conferenceId: string, documentId: string, applicationId: string, fileName: string): string {
  return safeStorageKey(`${conferenceId}/${documentId}/${applicationId}`, String(Date.now()), fileName);
}

export type ConferenceDocKind = 'rop' | 'logistics' | 'schedule' | 'code_of_conduct' | 'other' | 'extra';

export interface ConferenceDocKindInfo {
  key: ConferenceDocKind;
  label: string;
  /** Fluent 3D emoji folder name (Emoji3D). */
  emoji: string;
  /** Shown if the emoji image cannot load. */
  lucide: LucideIcon;
  /** 'gold' for paperwork, 'green' for people and places (the Financials tints). */
  tint: 'gold' | 'green';
}

export const CONFERENCE_DOC_KINDS: ConferenceDocKindInfo[] = [
  { key: 'rop', label: 'Rules of Procedure', emoji: 'Scroll', lucide: BookOpen, tint: 'gold' },
  { key: 'logistics', label: 'Logistics', emoji: 'Round pushpin', lucide: MapPin, tint: 'green' },
  { key: 'schedule', label: 'Schedule', emoji: 'Spiral calendar', lucide: CalendarDays, tint: 'gold' },
  { key: 'code_of_conduct', label: 'Code of Conduct', emoji: 'Handshake', lucide: Handshake, tint: 'green' },
  { key: 'other', label: 'Other', emoji: 'Page facing up', lucide: FileText, tint: 'gold' },
];

/** Document Uploads' own kind. Kept out of CONFERENCE_DOC_KINDS so today's kind picker is unchanged. */
export const EXTRA_DOC_KIND: ConferenceDocKindInfo = { key: 'extra', label: 'Document', emoji: 'Page facing up', lucide: FileText, tint: 'gold' };

export function kindInfo(kind: string): ConferenceDocKindInfo {
  if (kind === 'extra') return EXTRA_DOC_KIND;
  return CONFERENCE_DOC_KINDS.find(k => k.key === kind) ?? CONFERENCE_DOC_KINDS[CONFERENCE_DOC_KINDS.length - 1];
}

export interface ConferenceDoc {
  id: string;
  conference_id: string;
  title: string;
  kind: ConferenceDocKind;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  url: string | null;
  visible_to: string[];
  sort_order: number;
  created_at: string;
  // Document Uploads (optional: older reads do not select them).
  description?: string | null;
  ask_back?: boolean;
  due_at?: string | null;
  required?: boolean;
  accepted_only?: boolean;
  mime_type?: string | null;
  active?: boolean;
  removed_at?: string | null;
  removed_by?: string | null;
}

export type ConferenceDocsRead =
  | { kind: 'ok'; docs: ConferenceDoc[] }
  | { kind: 'error' };

const COLUMNS = 'id, conference_id, title, kind, file_path, file_name, file_size_bytes, url, visible_to, sort_order, created_at';

/** Every document of a conference the caller may read, in the organiser's order. */
export async function loadConferenceDocs(client: SupabaseClient, conferenceId: string): Promise<ConferenceDocsRead> {
  const { data, error } = await client
    .from('conference_documents')
    .select(COLUMNS)
    .eq('conference_id', conferenceId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return { kind: 'error' };
  return {
    kind: 'ok',
    docs: ((data ?? []) as ConferenceDoc[]).map(d => ({ ...d, visible_to: d.visible_to ?? [] })),
  };
}

/** The object name for a new upload: <conference id>/<epoch>-<safe name>. */
export function conferenceDocPath(conferenceId: string, fileName: string): string {
  return safeStorageKey(conferenceId, String(Date.now()), fileName);
}

/** Only an https:// link is stored (the database refuses anything else). */
export function normaliseDocUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t.replace(/^http:\/\//i, 'https://') : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' || !u.hostname.includes('.')) return null;
    return u.toString().slice(0, 1000);
  } catch {
    return null;
  }
}

export function formatDocSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The host of a link, for the line under its title. */
export function linkHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/** Opens a document in a new tab. The tab is opened INSIDE the click (a tab
 *  opened after an await is blocked), then sent to the signed URL. Returns
 *  false when the file could not be opened. */
export async function openConferenceDoc(client: SupabaseClient, doc: ConferenceDoc): Promise<boolean> {
  if (doc.url) {
    // noopener makes window.open answer null even when the tab opened.
    window.open(doc.url, '_blank', 'noopener,noreferrer');
    return true;
  }
  if (!doc.file_path) return false;
  return openStoredFile(client, CONFERENCE_DOCS_BUCKET, doc.file_path, 60 * 60);
}

/** Opens any stored file in a new tab: the tab inside the click, then the signed URL
 *  (document-returns links last 5 minutes: pass 300). False when it could not open. */
export async function openStoredFile(client: SupabaseClient, bucket: string, path: string, seconds: number): Promise<boolean> {
  const tab = window.open('about:blank', '_blank');
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) {
    tab?.close();
    return false;
  }
  if (tab) {
    tab.opener = null;
    tab.location.href = data.signedUrl;
  } else {
    window.location.href = data.signedUrl;
  }
  return true;
}

/** Downloads a stored file with its original name (prompt 143): a signed URL made with
 *  storage's download option (the file comes back as an attachment named `fileName`),
 *  followed by a hidden link in this tab, so it never opens in a new tab.
 *  False when the link could not be made. */
export async function downloadStoredFile(client: SupabaseClient, bucket: string, path: string, fileName: string | null, seconds = 300): Promise<boolean> {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, seconds, { download: fileName || true });
  if (error || !data?.signedUrl) return false;
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.rel = 'noopener';
  if (fileName) a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

/** Downloads a conference document's file (never a link) with its file name. */
export async function downloadConferenceDoc(client: SupabaseClient, doc: { file_path: string | null; file_name: string | null }): Promise<boolean> {
  if (!doc.file_path) return false;
  return downloadStoredFile(client, CONFERENCE_DOCS_BUCKET, doc.file_path, doc.file_name);
}

// ── Document Uploads: types and RPC wrappers (prompt 110) ─────────────────────

export type DocAnswer<T> = ({ ok: true } & T) | { ok: false; error: string; field?: string };

export interface DocsOverviewItem {
  id: string; title: string; description: string | null; kind: ConferenceDocKind;
  file_path: string | null; file_name: string | null; file_size_bytes: number | null; mime_type: string | null; url: string | null;
  visible_to: string[]; accepted_only: boolean; ask_back: boolean; due_at: string | null; due_label: string | null; required: boolean;
  sort_order: number; created_at: string;
  /** How many people the document is for, how many sent a copy, how many wait for review. */
  audience: number; returned: number; to_review: number;
}
export interface DocsOverview { enabled: boolean; attachments_enabled: boolean; to_review: number; documents: DocsOverviewItem[] }

export interface SaveDocumentInput {
  conferenceId: string;
  /** null = a new document. */
  documentId: string | null;
  title: string;
  description: string | null;
  filePath: string | null;
  fileName: string | null;
  url: string | null;
  visibleTo: string[];
  acceptedOnly: boolean;
  askBack: boolean;
  dueAt: string | null;
  required: boolean;
  notify: boolean;
  kind?: ConferenceDocKind;
}

export type ReturnState = 'not_yet' | 'submitted' | 'accepted' | 'sent_back';

export interface ReturnPerson {
  application_id: string; in_audience: boolean; joined: boolean; name: string | null; email: string | null; role: string;
  is_head_delegate: boolean; application_status: string; delegation: string | null; state: ReturnState;
  return_id: string | null; file_name: string | null; mime_type: string | null; file_size_bytes: number | null; file_path: string | null;
  submitted_at: string | null; reviewed_at: string | null; review_note: string | null; replaced_count: number;
}
export interface DocumentReturns {
  document: DocsOverviewItem;
  counts: { audience: number; returned: number; to_review: number; accepted: number; sent_back: number; not_yet: number };
  people: ReturnPerson[];
}

export interface MyReturn {
  id: string; status: Exclude<ReturnState, 'not_yet'>; file_name: string | null; mime_type: string | null; file_size_bytes: number | null;
  file_path: string | null; submitted_at: string | null; reviewed_at: string | null; review_note: string | null;
}
export interface MyConferenceDoc {
  id: string; title: string; description: string | null; kind: ConferenceDocKind;
  file_path: string | null; file_name: string | null; file_size_bytes: number | null; mime_type: string | null; url: string | null;
  visible_to: string[]; ask_back: boolean; required: boolean; due_at: string | null; due_label: string | null; overdue: boolean;
  application_id: string | null; can_send_back: boolean; my_return: MyReturn | null;
}
/** `warnings` = how many REQUIRED documents this application still has to send back. */
export interface MyConferenceDocs { enabled: boolean; warnings: number; documents: MyConferenceDoc[] }

/** One RPC, the server's object as is; an error or ok:false becomes a plain sentence. */
async function docRpc<T>(fn: string, args: Record<string, unknown>, fallback: string): Promise<DocAnswer<T>> {
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: 'Your session has expired. Please sign in again.' };
    const { data, error } = await c.rpc(fn, args);
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const a = (data ?? null) as Record<string, unknown> | null;
    if (!a || a.ok !== true) {
      return { ok: false, error: plainOrFallback(a?.error, fallback), field: typeof a?.field === 'string' ? a.field : undefined };
    }
    return a as { ok: true } & T;
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

export function fetchDocsOverview(conferenceId: string) {
  return docRpc<DocsOverview>('conference_documents_overview', { p_conference_id: conferenceId }, 'Your documents could not be read. Try again in a moment.');
}

export function saveConferenceDocument(d: SaveDocumentInput) {
  return docRpc<{ id: string; created: boolean; notified: number }>('save_conference_document', {
    p_conference_id: d.conferenceId, p_document_id: d.documentId, p_title: d.title, p_description: d.description,
    p_file_path: d.filePath, p_file_name: d.fileName, p_url: d.url, p_visible_to: d.visibleTo, p_accepted_only: d.acceptedOnly,
    p_ask_back: d.askBack, p_due_at: d.dueAt, p_required: d.required, p_notify: d.notify, p_kind: d.kind ?? 'extra',
  }, 'The document could not be saved. Try again in a moment.');
}

export function removeConferenceDocument(documentId: string) {
  return docRpc<{ kept_returns: number }>('remove_conference_document', { p_document_id: documentId }, 'The document could not be removed. Try again in a moment.');
}

export function fetchDocumentReturns(documentId: string) {
  return docRpc<DocumentReturns>('document_returns_overview', { p_document_id: documentId }, 'The copies sent back could not be read. Try again in a moment.');
}

export function reviewDocumentReturn(returnId: string, accept: boolean, note: string | null) {
  return docRpc<{ status: ReturnState }>('review_document_return', { p_return_id: returnId, p_accept: accept, p_note: note }, 'Your review could not be saved. Try again in a moment.');
}

export function fetchMyConferenceDocuments(conferenceId: string, applicationId: string | null) {
  return docRpc<MyConferenceDocs>('my_conference_documents', { p_conference_id: conferenceId, p_application_id: applicationId }, 'Your documents could not be read. Try again in a moment.');
}

export function submitDocumentReturn(documentId: string, path: string, fileName: string) {
  return docRpc<{ return_id: string; status: ReturnState; replaced: boolean }>('submit_document_return', { p_document_id: documentId, p_path: path, p_file_name: fileName }, 'Your copy could not be sent. Try again in a moment.');
}

export function replaceDocumentReturn(returnId: string, path: string, fileName: string) {
  return docRpc<{ return_id: string; status: ReturnState; replaced: boolean }>('replace_document_return', { p_return_id: returnId, p_path: path, p_file_name: fileName }, 'Your copy could not be replaced. Try again in a moment.');
}
