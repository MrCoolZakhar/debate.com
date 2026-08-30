'use client';

// Non-blocking nudge shown after a platform action's queueEventEmail call
// resolves to a state that needs organizer attention: either nothing is
// configured for the event at all ('unconfigured'), or it sent our built-in
// default copy instead of a drafted one ('sent-default'). Shared by every page
// that calls queueEventEmail (applications, assignment + its delegations/
// independents views, committees, communications).
//
// 'off' and 'sent-custom' never reach here — see notifyIfNeeded in emailEvents.ts.
//
// ── This is a TOAST now, not a bar ─────────────────────────────────────────
//
// It used to paint a full-width amber strip above the page content, which
// pushed the work the organiser was doing down the screen to tell them about
// an email — and then took the space back eight seconds later. It now goes to
// the corner notification stack, the same tinted liquid-glass card the live
// committee session raises: `notify()` from `@/lib/sessionNotifications`,
// drawn by the ONE `<NotificationStack/>` mounted in `manage/[slug]/layout`.
//
// The public API is deliberately UNCHANGED — `useDraftNotices()` still returns
// `{ draftNotices, pushDraftNotice, dismissDraftNotice }` and `DraftNoticeList`
// still takes the same props — so all eight call sites kept working without
// edits. What changed is what `DraftNoticeList` renders: nothing. It is now a
// PUMP, not a list. Each queued item is handed to the store (which owns the
// dedupe, the TTL, dismissal and swipe-to-dismiss) and dropped from local state
// in the same pass.
//
// Why the pump instead of notifying straight from `pushDraftNotice`: the two
// affordances the card must keep — TURN ON and DRAFT — need `conferenceSlug`
// and `onTurnOn`, and those are props of the component, not of the hook. Moving
// them into the hook would have meant editing every call site. The component
// already has both, so it is the right place to assemble the actions.
//
// The hook no longer runs its own 8s `setTimeout` or its own dedupe: the store
// does both, better. Dedupe is by notification key (`email-draft:<eventKey>`),
// so a burst of the same event upserts one card rather than stacking.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getEventLabel } from '@/lib/emailEvents';
import { notify } from '@/lib/sessionNotifications';

/** Long enough to read two actions and reach for one. */
const DRAFT_NOTICE_TTL_MS = 12_000;

const noticeKey = (eventKey: string) => `email-draft:${eventKey}`;

export type DraftNoticeOutcome = 'unconfigured' | 'sent-default';

export interface DraftNoticeItem {
  id: string;
  eventKey: string;
  outcome: DraftNoticeOutcome;
}

export function useDraftNotices() {
  const [draftNotices, setDraftNotices] = useState<DraftNoticeItem[]>([]);

  const pushDraftNotice = useCallback(
    (eventKey: string, outcome: DraftNoticeOutcome = 'unconfigured') => {
      // No dedupe and no expiry timer here any more — this list is a one-shot
      // queue drained by DraftNoticeList on the next render. The store enforces
      // one live card per key and owns the countdown.
      const id = `${eventKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setDraftNotices((prev) => [...prev, { id, eventKey, outcome }]);
    },
    [],
  );

  const dismissDraftNotice = useCallback((id: string) => {
    setDraftNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { draftNotices, pushDraftNotice, dismissDraftNotice };
}

export function DraftNoticeList({
  notices, conferenceSlug, onDismiss, onTurnOn,
}: {
  notices: DraftNoticeItem[];
  conferenceSlug: string;
  onDismiss: (id: string) => void;
  /** Creates the event's stub template (enabled, empty body) so future
   *  actions send our default instead of nothing. Omit to hide TURN ON. */
  onTurnOn?: (eventKey: string) => Promise<void>;
}) {
  const router = useRouter();

  useEffect(() => {
    if (notices.length === 0) return;
    for (const n of notices) {
      const label = getEventLabel(n.eventKey);
      const draftHref = `/manage/${conferenceSlug}/communications?event=${n.eventKey}`;
      const sentDefault = n.outcome === 'sent-default';
      notify({
        key: noticeKey(n.eventKey),
        kind: 'info',
        title: sentDefault ? 'Default email sent' : 'No email was sent',
        body: sentDefault
          ? `‘${label}’ went out with our built-in copy.`
          : `Nothing is set up for ‘${label}’.`,
        ttlMs: DRAFT_NOTICE_TTL_MS,
        actions: [
          // TURN ON only exists for 'unconfigured', and only when the host page
          // gave us a handler — same condition the bar used.
          ...(!sentDefault && onTurnOn
            ? [{
                id: 'turn-on',
                label: 'TURN ON',
                tone: 'accept' as const,
                // Returned so the card stays busy until the write settles;
                // NotificationStack dismisses it either way afterwards.
                run: () => onTurnOn(n.eventKey),
              }]
            : []),
          {
            id: 'draft',
            label: sentDefault ? 'DRAFT A REPLACEMENT' : 'DRAFT',
            tone: 'neutral' as const,
            run: () => { router.push(draftHref); },
          },
        ],
      });
      // Handed off. The store owns it from here.
      onDismiss(n.id);
    }
  }, [notices, conferenceSlug, onTurnOn, onDismiss, router]);

  // Renders nothing on purpose — see the header note. Kept as a component so
  // every existing call site keeps its wiring (slug + onTurnOn) in one place.
  return null;
}
