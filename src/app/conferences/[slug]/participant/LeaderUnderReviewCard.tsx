'use client';

/**
 * A delegation leader (head delegate or faculty advisor with a delegation)
 * whose application is still under review, while their dashboard is closed:
 * one card at the top of Overview saying why there is no Delegation section
 * yet (owner, 4 Nov 2026; YCMUN). The Delegation section and its invite link
 * still open only once the application is accepted.
 */
import { Hourglass } from 'lucide-react';
import { cardStyle, FONT, INK_SOFT, STROKE } from './delegation/leaderKit';
import { CardTitle, OVERVIEW_CARD } from './delegation/overview/SeatCard';

export default function LeaderUnderReviewCard() {
  return (
    <section aria-label="Your application is under review" className={OVERVIEW_CARD} style={cardStyle}>
      <div className="flex items-start gap-3 min-w-0">
        <Hourglass size={24} strokeWidth={STROKE} aria-hidden style={{ color: 'var(--gv-main)', flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <CardTitle>Your Application Is Under Review</CardTitle>
          <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14.5, color: INK_SOFT, margin: 0, lineHeight: 1.5 }}>
            Once the organisers accept your application, your Delegation section opens here with the invite link for your delegates.
          </p>
        </div>
      </div>
    </section>
  );
}
