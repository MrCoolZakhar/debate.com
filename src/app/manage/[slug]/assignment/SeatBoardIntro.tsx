'use client';

// ── Introducing the seat board (owner, 22 Oct 2026) ──────────────────────────
// "For the next ~2 weeks people get used to it": the Assignment page opens on
// the classic board by default (CLASSIC_BY_DEFAULT, read by page.tsx; a board
// this browser picked before always wins), and this small card sits beside the
// "Seat board" switch until the organiser tries it or says Not now. Not now is
// remembered per browser. Flip CLASSIC_BY_DEFAULT to false (about 5 Nov 2026,
// an owner's call) to open on the seat board again; the card then never shows.

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { SoftButton } from '@/app/manage/[slug]/assignment/seatBoardShared';

/** The delegates board opens on the classic view unless this browser chose. */
export const CLASSIC_BY_DEFAULT = true;

/** localStorage: '1' once this browser said Not now. */
const DISMISSED_KEY = 'gavelling-seat-board-intro-dismissed';

export default function SeatBoardIntro({ onTry }: { onTry: () => void }) {
  // Read once on mount; the card only renders after the page has loaded on
  // the client, so there is no server render to disagree with.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    try { return window.localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; /* storage blocked: shown this visit */ }
  });
  if (dismissed) return null;

  const notNow = () => {
    setDismissed(true);
    try { window.localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* storage blocked: this visit only */ }
  };

  return (
    <div
      role="note"
      className="flex items-center gap-3 flex-wrap"
      style={{
        padding: '10px 12px 10px 14px', borderRadius: 16, background: '#FFFFFF', fontFamily: OUTFIT, color: NEU.ink,
        boxShadow: 'inset 0 0 0 1px rgba(182,135,31,0.28), 0 1px 2px rgba(27,56,40,0.06), 0 8px 22px -10px rgba(27,56,40,0.22)',
        maxWidth: 520,
      }}
    >
      <Sparkles size={18} strokeWidth={1.5} style={{ color: NEU.ink, flexShrink: 0 }} aria-hidden />
      <span className="flex-1" style={{ minWidth: 200, fontSize: 13.5, lineHeight: 1.35 }}>
        We&apos;re introducing a new way to do allocations. <strong style={{ fontWeight: 600 }}>Try the seat board</strong>
      </span>
      <span className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={onTry}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/25 transition-transform duration-150 active:scale-[0.96]"
          style={{ height: 32, padding: '0 15px', borderRadius: 999, border: 'none', background: '#2C4A39', color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Try it
        </button>
        <SoftButton onClick={notNow} size="sm">Not now</SoftButton>
      </span>
    </div>
  );
}
