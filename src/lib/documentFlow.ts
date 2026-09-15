/**
 * Documents: the introduction flow's persisted state (V-5), the approval gate read (D-10)
 * and a checked submit (V-6). Kept apart from committeeService.ts so the paper workflow
 * has one home.
 *
 * - `documents.intro_state` (jsonb, nullable) = `{stage, base, startedAt}`. RETIRED as a
 *   writer target (15 Sep 2026): the card's Resume / Pass / Fail were removed, so nothing reads
 *   a persisted stage any more and DocumentsModal only ever writes it back to null (on
 *   confirming the timings, on finishing, on skipping). The column and `parseIntroState` stay
 *   so existing rows still load. The on-screen stage clock is still anchor-based
 *   (`introRemainingNow`, database clock, `startedAt` null = paused), held in modal state.
 * - `documents.doc_code` is assigned by the BEFORE INSERT trigger `documents_assign_doc_code`
 *   under a per-(committee, type) advisory lock. The value a client sends is ignored, so the
 *   code shown in the submit form is a preview and the saved row's code is the truth.
 */
import type { Committee, DocIntroState, DocumentStatus } from '@/lib/types';
import { sessionClient } from '@/lib/sessionClient';
import { serverNow } from '@/lib/serverClock';

const STAGES = new Set(['reading', 'presentation', 'qa']);

export function parseIntroState(raw: unknown): DocIntroState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.stage !== 'string' || !STAGES.has(r.stage)) return null;
  const base = Number(r.base);
  return {
    stage: r.stage as DocIntroState['stage'],
    base: Number.isFinite(base) ? Math.max(0, Math.round(base)) : 0,
    startedAt: typeof r.startedAt === 'string' ? r.startedAt : null,
  };
}

/** Live remaining seconds of a stage clock. Pure. */
export function introRemainingNow(state: Pick<DocIntroState, 'base' | 'startedAt'>, now: number = serverNow()): number {
  if (!state.startedAt) return Math.max(0, state.base);
  const started = new Date(state.startedAt).getTime();
  if (!Number.isFinite(started)) return Math.max(0, state.base);
  return Math.max(0, state.base - Math.max(0, Math.round((now - started) / 1000)));
}

/** Chair approval gate, read from the committee ROW (never the localStorage store), so a
 *  toggle made on another chair device applies here too. */
export function requireDocApproval(committee: Pick<Committee, 'dbSettings'>): boolean {
  return committee.dbSettings?.requireDocApproval === true;
}

/** Write status and/or intro state and/or timings in one update. Resolves false on an
 *  error or a zero-row (RLS-refused) update. */
export async function updateDocumentFlow(
  docId: string,
  patch: {
    status?: DocumentStatus;
    introState?: DocIntroState | null;
    readingMinutes?: number;
    presentationMinutes?: number;
    qaMinutes?: number;
  },
  code: string,
  chairSuffix?: string,
): Promise<boolean> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.introState !== undefined) row.intro_state = patch.introState;
  if (patch.readingMinutes !== undefined) row.reading_minutes = patch.readingMinutes;
  if (patch.presentationMinutes !== undefined) row.presentation_minutes = patch.presentationMinutes;
  if (patch.qaMinutes !== undefined) row.qa_minutes = patch.qaMinutes;
  if (Object.keys(row).length === 0) return true;
  const { data, error } = await sessionClient(code, chairSuffix)
    .from('documents').update(row).eq('id', docId).select('id').maybeSingle();
  if (error) { console.error('Error updating document flow:', error); return false; }
  return !!data;
}

/** Remove a document; resolves false on error or when nothing was deleted. */
export async function deleteDocumentChecked(docId: string, code: string, chairSuffix?: string): Promise<boolean> {
  const { data, error } = await sessionClient(code, chairSuffix)
    .from('documents').delete().eq('id', docId).select('id');
  if (error) { console.error('Error removing document:', error); return false; }
  return (data ?? []).length > 0;
}
