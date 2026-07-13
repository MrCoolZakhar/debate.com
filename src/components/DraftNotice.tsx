'use client';

// Small non-blocking nudge shown after a platform action's queueEventEmail
// call resolves to a state that needs organizer attention: either nothing
// is configured for the event at all ('unconfigured'), or it sent our
// built-in default copy instead of a drafted one ('sent-default'). Shared by
// every page that calls queueEventEmail (applications, assignment + its
// delegations/independents views, committees, communications).
//
// 'off' and 'sent-custom' never reach here — see notifyIfNeeded in emailEvents.ts.

import { useState } from 'react';
import Link from 'next/link';
import { getEventLabel } from '@/lib/emailEvents';

const OUTFIT = "'Outfit', sans-serif";
const MAX_VISIBLE = 3;

export type DraftNoticeOutcome = 'unconfigured' | 'sent-default';

export interface DraftNoticeItem {
  id: string;
  eventKey: string;
  outcome: DraftNoticeOutcome;
}

export function useDraftNotices() {
  const [draftNotices, setDraftNotices] = useState<DraftNoticeItem[]>([]);

  function pushDraftNotice(eventKey: string, outcome: DraftNoticeOutcome = 'unconfigured') {
    setDraftNotices(prev => {
      // Dedupe: a notice for this event is already visible, don't stack another.
      if (prev.some(n => n.eventKey === eventKey)) return prev;
      const id = `${eventKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setTimeout(() => setDraftNotices(p => p.filter(n => n.id !== id)), 8000);
      const next = [...prev, { id, eventKey, outcome }];
      // Cap at MAX_VISIBLE distinct events, the oldest collapses first.
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });
  }

  function dismissDraftNotice(id: string) {
    setDraftNotices(prev => prev.filter(n => n.id !== id));
  }

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
  const [turningOnId, setTurningOnId] = useState<string | null>(null);

  if (notices.length === 0) return null;

  async function handleTurnOn(id: string, eventKey: string) {
    if (!onTurnOn || turningOnId) return;
    setTurningOnId(id);
    await onTurnOn(eventKey);
    setTurningOnId(null);
    onDismiss(id);
  }

  return (
    <div className="flex flex-col gap-2 mb-4">
      {notices.map(n => (
        <div
          key={n.id}
          className="flex items-center flex-wrap gap-x-2 gap-y-1 rounded-xl px-4 py-2.5 text-sm"
          style={{ backgroundColor: 'rgba(182,135,31,0.08)', border: '1px solid rgba(182,135,31,0.25)', color: '#8A6614', fontFamily: OUTFIT }}
        >
          {n.outcome === 'sent-default' ? (
            <>
              <span>Default email sent for &lsquo;{getEventLabel(n.eventKey)}&rsquo;:</span>
              <Link
                href={`/manage/${conferenceSlug}/communications?event=${n.eventKey}`}
                className="font-bold flex-shrink-0"
                style={{ color: '#8A6614', textDecoration: 'underline' }}
              >
                DRAFT A REPLACEMENT
              </Link>
            </>
          ) : (
            <>
              <span>No email was sent for &lsquo;{getEventLabel(n.eventKey)}&rsquo;:</span>
              {onTurnOn && (
                <button
                  onClick={() => handleTurnOn(n.id, n.eventKey)}
                  disabled={turningOnId === n.id}
                  className="font-bold flex-shrink-0 focus:outline-none"
                  style={{ color: '#8A6614', textDecoration: 'underline', cursor: turningOnId === n.id ? 'wait' : 'pointer' }}
                >
                  {turningOnId === n.id ? 'TURNING ON…' : 'TURN ON'}
                </button>
              )}
              <span>to send our default, or</span>
              <Link
                href={`/manage/${conferenceSlug}/communications?event=${n.eventKey}`}
                className="font-bold flex-shrink-0"
                style={{ color: '#8A6614', textDecoration: 'underline' }}
              >
                DRAFT
              </Link>
              <span>your own.</span>
            </>
          )}
          <button
            onClick={() => onDismiss(n.id)}
            className="ml-auto flex-shrink-0 focus:outline-none"
            style={{ color: '#8A6614', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
