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

import type { SupabaseClient } from '@supabase/supabase-js';
import { BookOpen, CalendarDays, FileText, Handshake, MapPin, type LucideIcon } from 'lucide-react';
import { safeStorageKey } from '@/lib/storageKey';

export const CONFERENCE_DOCS_BUCKET = 'conference-documents';
export const CONFERENCE_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const CONFERENCE_DOC_TITLE_MAX = 120;

export type ConferenceDocKind = 'rop' | 'logistics' | 'schedule' | 'code_of_conduct' | 'other';

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

export function kindInfo(kind: string): ConferenceDocKindInfo {
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
  const tab = window.open('about:blank', '_blank');
  const { data, error } = await client.storage.from(CONFERENCE_DOCS_BUCKET).createSignedUrl(doc.file_path, 60 * 60);
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
