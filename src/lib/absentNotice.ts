// The notice a chair gets when they try to put an ABSENT delegation on a list
// (owner, 13 Oct 2026, from sales calls): attendance changes only through Roll
// Call, so the add is refused and nothing about the delegation changes. Same
// top-right card as the caucus-queue-full refusal; one key per delegation, so
// repeated taps restart one card instead of stacking. Urgent, so it shows
// during a running speech (a refusal the chair cannot see reads as a dead click).

import { notify, NOTIFY_TTL } from '@/lib/sessionNotifications';
import type { useT } from '@/contexts/LanguageContext';

export function notifyDelegationAbsent(t: ReturnType<typeof useT>, delegateId: string): void {
  notify({
    key: `delegation-absent:${delegateId}`,
    kind: 'info',
    title: t('absent_add_title'),
    body: t('absent_add_body'),
    ttlMs: NOTIFY_TTL.notice,
    urgent: true,
  });
}
