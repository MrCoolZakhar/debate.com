import type { Committee, DocumentType } from './types';
import { DEFAULT_DOCUMENT_NAMES, type DocumentNames } from './settingsStore';

// ── The one place that resolves a document type's DISPLAY name ────────────────
//
// Chairs can rename "Working Paper" / "Draft Resolution" per committee (e.g. to
// "Draft Directive", "Communiqué", "Clause"). The custom names live in
// CommitteeSettings.documentNames, which SettingsPanel mirrors into the
// `committees.settings` JSONB on every change — so we read them off the committee
// row (`dbSettings`), NOT the localStorage settings store. That is the only path
// that works identically on every device: the delegate and advisor pages never
// hydrate the settings store from the DB. Same pattern as `sponsorLabel` in
// ./committeeFlags.
//
// NOTHING here touches the data model: `DocumentType`, the `documents.type`
// column and the 'working-paper' / 'draft-resolution' discriminators are
// untouched. This is presentation only.

export type DocNameForm = 'singular' | 'plural';

const FIELD: Record<DocumentType, Record<DocNameForm, keyof DocumentNames>> = {
  'working-paper':    { singular: 'workingPaper',    plural: 'workingPapers' },
  'draft-resolution': { singular: 'draftResolution', plural: 'draftResolutions' },
};

/**
 * The visible name for a document type.
 *
 * @param committee  any object carrying `dbSettings` (the committee row).
 * @param type       the stored document type — never renamed, only displayed.
 * @param form       'singular' ("Submit a Working Paper") or 'plural' ("Working Papers").
 * @param fallback   the built-in, already-TRANSLATED default (e.g. t('documents_working_papers_tab')).
 *                   Used whenever the chair has not overridden this name, so the
 *                   locale still wins by default and a rename overrides it.
 */
export function docName(
  committee: Pick<Committee, 'dbSettings'> | null | undefined,
  type: DocumentType,
  form: DocNameForm,
  fallback: string,
): string {
  const field = FIELD[type][form];
  const stored = (committee?.dbSettings?.documentNames as Partial<DocumentNames> | undefined)?.[field];
  const custom = typeof stored === 'string' ? stored.trim() : '';
  // An unset value, or one still equal to the canonical English default, means
  // "no override" — fall through to the translated default.
  if (!custom || custom === DEFAULT_DOCUMENT_NAMES[field]) return fallback;
  return custom;
}

// ── Submission limits ─────────────────────────────────────────────────────────
//
// `wpSubmissionLimit` / `drSubmissionLimit` cap how many documents of a type a
// committee accepts. They are legacy: no Settings UI writes them any more, so in
// practice they are always null (unlimited) unless an old committee row still
// carries a value in its settings JSONB.
//
// They used to be read only inside the chair's DocumentsModal, via
// `getSettings(committee.code)` — the localStorage store. That store is hydrated
// on the chair page but NEVER on the delegate page, so the delegate submit path
// (the one the limit is actually aimed at) silently saw DEFAULT_SETTINGS and
// enforced nothing. Reading `dbSettings` here — the same pure-function-of-the-
// committee-row pattern as `docName` above — makes both paths agree on every
// device.
//
// SEMANTICS: the count is per COMMITTEE, not per delegation. That matches the
// existing copy ("No more working papers can be submitted") and preserves the
// chair-side behaviour exactly. See the note in the handover if this should ever
// become "each delegation may submit N".

const LIMIT_FIELD: Record<DocumentType, 'wpSubmissionLimit' | 'drSubmissionLimit'> = {
  'working-paper': 'wpSubmissionLimit',
  'draft-resolution': 'drSubmissionLimit',
};

/** The configured cap for a document type, or null when unlimited. */
export function docLimit(
  committee: Pick<Committee, 'dbSettings'> | null | undefined,
  type: DocumentType,
): number | null {
  const raw = (committee?.dbSettings as Record<string, unknown> | undefined)?.[LIMIT_FIELD[type]];
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null;
}

/** How many documents of this type the committee already has. */
export function docCount(
  committee: Pick<Committee, 'documents'> | null | undefined,
  type: DocumentType,
): number {
  return (committee?.documents ?? []).filter((d) => d.type === type).length;
}

/** True when no further document of this type may be submitted. */
export function docLimitReached(
  committee: Pick<Committee, 'dbSettings' | 'documents'> | null | undefined,
  type: DocumentType,
): boolean {
  const limit = docLimit(committee, type);
  return limit !== null && docCount(committee, type) >= limit;
}
