// readMoneyDocument — get_money_document for organizers and payers alike
// (prompt 98). The server decides who may read it; a refusal reads as
// "not found" and is shown as the server wrote it.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { plainOrFallback, UserFacingError } from '@/lib/friendlyError';
import { toMoneyDoc, type MoneyDoc } from './moneyDocument';

export async function readMoneyDocument(documentId: string): Promise<MoneyDoc> {
  const c = await getFreshAuthedClient();
  if (!c) throw new UserFacingError('Your session has expired. Please sign in again.');
  const { data, error } = await c.rpc('get_money_document', { p_document_id: documentId });
  if (error) throw error;
  const a = (data ?? {}) as Record<string, unknown>;
  if (a.ok !== true) throw new UserFacingError(plainOrFallback(a.error, 'This document could not be read. Try again in a moment.'));
  return toMoneyDoc(a);
}
