'use client';

// Small non-blocking "no email drafted for this notification" nudge, shown
// after a platform action finds no enabled template for its event. Shared by
// every page that calls queueEventEmail (applications, assignment + its
// delegations/independents views).

import { useState } from 'react';
import Link from 'next/link';

const OUTFIT = "'Outfit', sans-serif";

export interface DraftNoticeItem {
  id: string;
  eventKey: string;
}

export function useDraftNotices() {
  const [draftNotices, setDraftNotices] = useState<DraftNoticeItem[]>([]);

  function pushDraftNotice(eventKey: string) {
    const id = `${eventKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setDraftNotices(prev => [...prev, { id, eventKey }]);
    setTimeout(() => setDraftNotices(prev => prev.filter(n => n.id !== id)), 8000);
  }

  function dismissDraftNotice(id: string) {
    setDraftNotices(prev => prev.filter(n => n.id !== id));
  }

  return { draftNotices, pushDraftNotice, dismissDraftNotice };
}

export function DraftNoticeList({
  notices, conferenceSlug, onDismiss,
}: {
  notices: DraftNoticeItem[];
  conferenceSlug: string;
  onDismiss: (id: string) => void;
}) {
  if (notices.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 mb-4">
      {notices.map(n => (
        <div
          key={n.id}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          style={{ backgroundColor: 'rgba(182,135,31,0.08)', border: '1px solid rgba(182,135,31,0.25)', color: '#8A6614', fontFamily: OUTFIT }}
        >
          <span>No email is drafted for this notification —</span>
          <Link
            href={`/manage/${conferenceSlug}/communications?event=${n.eventKey}`}
            className="font-bold flex-shrink-0"
            style={{ color: '#8A6614', textDecoration: 'underline' }}
          >
            DRAFT IT
          </Link>
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
