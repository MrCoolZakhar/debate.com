// Pre-send check for merge fields that would render as ⚠field⚠.
//
// KenyaMUN (18 Sep 2026) sent "⚠country⚠ to ⚠committee⚠" to 281 people,
// because their allocations did not exist yet. resolveTokens leaves any
// {{token}} with no value as a ⚠token⚠ marker, which is right for a preview
// and wrong in someone's inbox. This answers, per recipient, which fields
// would come out as markers, so a send can refuse those recipients.
//
// It checks what the recipient would SEE: the subject, every paragraph, every
// button label, and every facts row that renderEmailHtml keeps. A facts row
// whose value resolves to nothing but markers is dropped by the renderer (a
// receipt legitimately goes out before an allocation exists), so it does not
// count here either. Pure, no I/O.

import { resolveTokens, UNRESOLVED_MARKER_PATTERN, EMAIL_TOKEN_LABELS, type EmailTokenContext, type EmailTokenKey } from '@/lib/emailTokens';
import type { EmailBlock } from '@/lib/emailBlocks';

function markersIn(text: string, into: Set<string>) {
  for (const m of text.matchAll(new RegExp(UNRESOLVED_MARKER_PATTERN))) into.add(m[1]);
}

/** Field keys that would render as ⚠key⚠ for this context, sorted, unique. */
export function unresolvedFields(subject: string, blocks: EmailBlock[], ctx: EmailTokenContext): string[] {
  const found = new Set<string>();
  markersIn(resolveTokens(subject, ctx), found);
  for (const b of blocks) {
    if (b.type === 'paragraph') markersIn(resolveTokens(b.content, ctx), found);
    else if (b.type === 'button') markersIn(resolveTokens(b.label, ctx), found);
    else if (b.type === 'facts') {
      for (const item of b.items) {
        const value = resolveTokens(item.value, ctx).trim();
        // Mirrors renderEmailHtml: an all-marker value drops the whole row.
        if (!item.label.trim() || !value || value.replace(new RegExp(UNRESOLVED_MARKER_PATTERN), '').trim() === '') continue;
        markersIn(value, found);
        markersIn(resolveTokens(item.label, ctx), found);
      }
    }
  }
  return [...found].sort();
}

/** "Allocation Country" for a known key, the raw key otherwise ({{typo}}). */
export function unresolvedFieldLabel(key: string): string {
  return (EMAIL_TOKEN_LABELS as Record<string, string>)[key as EmailTokenKey] ?? key;
}

export interface UnresolvedSummary {
  /** Recipients whose email would contain at least one unresolved field. */
  affectedIds: string[];
  /** Every field that is missing for at least one recipient, with how many. */
  fields: { key: string; label: string; count: number }[];
}

export function summarizeUnresolved(
  subject: string,
  blocks: EmailBlock[],
  recipients: { id: string; ctx: EmailTokenContext }[],
): UnresolvedSummary {
  const affectedIds: string[] = [];
  const counts = new Map<string, number>();
  for (const r of recipients) {
    const keys = unresolvedFields(subject, blocks, r.ctx);
    if (keys.length === 0) continue;
    affectedIds.push(r.id);
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const fields = [...counts.entries()]
    .map(([key, count]) => ({ key, label: unresolvedFieldLabel(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { affectedIds, fields };
}

/** A context for a surface that knows only the PER-RECIPIENT fields (name,
 *  committee, country, ...) and not the conference-level ones (fee, dates).
 *  Every known key gets a stand-in value, then `known` overrides it, so only a
 *  genuinely missing recipient field (or an unknown {{typo}}) reads as
 *  unresolved. queueAdHocEmail re-checks with the full context at send time. */
export function recipientFieldsContext(known: Partial<Record<EmailTokenKey, string | null>>): EmailTokenContext {
  const ctx: EmailTokenContext = {};
  for (const key of Object.keys(EMAIL_TOKEN_LABELS) as EmailTokenKey[]) ctx[key] = `[${EMAIL_TOKEN_LABELS[key]}]`;
  return { ...ctx, ...known };
}
