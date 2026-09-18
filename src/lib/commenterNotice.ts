'use client';

// ── "Only the Moderator can do this" ────────────────────────────────────────
//
// A Commenter (a chair whose name does not hold the gavel, see AGENTS.md → CHAIR ROLES) sees
// the Moderator's controls disabled. When they try one anyway (a speaker button, the clock,
// an add bar, a queue row or flag, raising or deciding a motion), ONE glass card in the
// NotificationStack says why and how to take control (the GavelChip's "Take the gavel").
//
// UI only (rule 15): nothing here is a permission and nothing is written. One key, so a burst
// of attempts restarts the same card instead of stacking; urgent, so it shows during a
// running speech (a refused click the chair cannot explain reads as a broken button).

import { notify } from '@/lib/sessionNotifications';
import type { TranslationKey } from '@/lib/translations';

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export const COMMENTER_NOTICE_KEY = 'commenter-only';

/** The gavel holder's name as the chair page derives it (`dbHeadChair`, else the creator). */
export function moderatorNameOf(committee: { dbHeadChair?: string | null; chairNames?: string[] } | null | undefined): string {
  return committee?.dbHeadChair || committee?.chairNames?.[0] || '';
}

export function notifyCommenterOnly(t: Translate, moderatorName: string): void {
  const name = moderatorName.trim();
  notify({
    key: COMMENTER_NOTICE_KEY,
    kind: 'info',
    title: t('commenter_only_title'),
    body: t('commenter_only_body', { name: name || t('stg_role_moderator') }),
    ttlMs: 5_000,
    urgent: true,
  });
}
