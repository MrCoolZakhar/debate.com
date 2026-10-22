'use client';

// ── "300+ MUN Sponsors" on the finished set-up card (prompt 14) ────────────
//
// Owner, 21 Oct 2026: once set-up is finished (all done and verified), the
// card under the share link offers the sponsor list. Shown only in the
// allSetAndVerified branch of the dashboard, so only organizers of a verified
// conference see it. Opens the sheet in a new tab.

import { Handshake } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';

const SPONSOR_LIST_URL = 'https://docs.google.com/spreadsheets/d/1KxwXAq_OheccHdwEhF4fu0X_4aLBQndssaDhOmhp1iM/edit?usp=drivesdk';

export default function SponsorListRow() {
  return (
    <div
      className="flex flex-wrap items-center gap-3"
      style={{ marginTop: 12, padding: '12px 14px', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.7)', boxShadow: NEU.inSm }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{ width: 36, height: 36, borderRadius: 9999, color: NEU.forest, background: 'rgba(238,217,138,0.5)' }}
      >
        <Handshake size={18} strokeWidth={2.2} />
      </span>
      <div className="min-w-0" style={{ flex: '1 1 200px' }}>
        <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: NEU.ink }}>300+ MUN Sponsors</p>
        <p style={{ margin: '2px 0 0', fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.4, color: NEU.inkSoft, overflowWrap: 'anywhere' }}>
          301 companies and brands that have sponsored MUN conferences. For your organizing team only.
        </p>
      </div>
      <a
        href={SPONSOR_LIST_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2"
        style={{
          minHeight: 38, padding: '0 16px', borderRadius: 11, textDecoration: 'none',
          fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: '#FFFFFF',
          background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%)',
        }}
      >
        Open the sponsor list
      </a>
    </div>
  );
}
