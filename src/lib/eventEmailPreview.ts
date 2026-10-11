// eventEmailPreview.ts — the one answer to "what does this automatic email look
// like as it ships today", shared by the preview pop-up
// (DefaultEmailPreviewModal) and the small thumbnails on Communications →
// Automatic emails (11 Oct 2026), so the two can never disagree.
//
// The same choice queueEventEmail makes: the organiser's written words win,
// an always-on invite's words only while that row is on; otherwise our
// default copy. Rendered through renderEmailHtml with the same variant, event
// and isDefault flag as a real send. Pure: reads nothing, writes nothing.

import { resolveTokens, type EmailTokenContext } from '@/lib/emailTokens';
import { normalizeBlocks, type EmailBlock } from '@/lib/emailBlocks';
import { renderEmailHtml, type EmailRenderConference } from '@/lib/emailHtml';
import { emailCardSubject } from '@/lib/emailCard';
import { getDefaultEventEmail } from '@/lib/defaultEmails';
import { hasDraftContent } from '@/lib/emailEvents';

export interface PreviewTemplate {
  subject: string;
  body: string;
  body_blocks: unknown;
  enabled: boolean;
}

export interface EventEmailPreview {
  /** null when there is no wording at all (no default and none written). */
  blocks: EmailBlock[] | null;
  /** The organiser's own wording is what sends. */
  own: boolean;
  /** The subject as written, before tokens (for a test send). */
  subjectSource: string;
}

export function eventEmailSource({ eventKey, template, functional, forceDefault }: {
  eventKey: string;
  template?: PreviewTemplate | null;
  functional?: boolean;
  forceDefault?: boolean;
}): EventEmailPreview {
  const def = getDefaultEventEmail(eventKey);
  const own = !forceDefault && !!template && hasDraftContent(template) && (!functional || template.enabled);
  const blocks: EmailBlock[] | null = own
    ? normalizeBlocks(template!.body_blocks, template!.body ?? '')
    : def?.blocks ?? null;
  return { blocks, own, subjectSource: own ? template!.subject : def?.subject ?? '' };
}

export function eventEmailHtml(src: EventEmailPreview, eventKey: string, conference: EmailRenderConference, ctx: EmailTokenContext): string {
  if (!src.blocks) return '';
  return renderEmailHtml({ blocks: src.blocks, conference, ctx, variant: 'transactional', event: eventKey, isDefault: !src.own });
}

export function eventEmailSubject(src: EventEmailPreview, conference: EmailRenderConference, ctx: EmailTokenContext): string {
  if (!src.blocks) return '';
  return emailCardSubject(resolveTokens(src.subjectSource, ctx), conference, !src.own);
}
