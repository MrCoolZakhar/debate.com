'use client';

// ── The Job Board's first-time onboarding (prompt 14) ──────────────────────
//
// Owner, 21 Oct 2026: the set-up step "List Chair, Secretariat or Staff
// Positions" opens the Job Board, where a conference that has never had a
// listing (job_conference_panel's onboarding) gets this card at the top in
// place of the empty Your Listings state (not a pop-up). There is no "Do it
// Later" any more (prompt 81): looking at the Job Board completes the set-up
// step (JobBoardPanel stamps the visit). Posting a first listing makes the card
// go on the next panel read.

import Link from 'next/link';
import { Layers, Plus } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { EmptyArt } from './jobKit';

const INK = '#1C1410';
const INK_SOFT = '#5C5140';

const STEPS = [
  'Pick the role: chair, secretariat or staff',
  'Write the listing: title, what you offer and up to 5 screening questions',
  'People apply on Gavelling, free for you, and land in Team',
];

export default function JobBoardOnboarding({ canPack, onPost, onPack, openChairHref = null }: {
  /** Chair applications are not open (prompt 44): lead with opening them, since that drafts a chair listing per committee. */
  openChairHref?: string | null;
  /** The conference has committees and the chair role is on. */
  canPack: boolean;
  onPost: () => void;
  onPack: () => void;
}) {
  return (
    <EmptyArt image="/onboarding/podium-01.jpg">
    <div style={{ fontFamily: OUTFIT, padding: '4px 4px 6px' }}>
      {openChairHref ? (
        <>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: INK }}>Open Chair Applications</p>
          <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.5, color: INK_SOFT }}>
            Gavelling drafts a chair listing for every committee as soon as chair applications open. You check them and publish.
          </p>
        </>
      ) : (
      <>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: INK }}>Post your first listing</p>
      <ol style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STEPS.map((t, i) => (
          <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span
              aria-hidden
              style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 9999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#4A3410', background: 'rgba(238,217,138,0.6)' }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 15, lineHeight: 1.5, color: INK, paddingTop: 2 }}>{t}</span>
          </li>
        ))}
      </ol>
      </>
      )}
      <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 18 }}>
        {openChairHref && (
          <Link href={openChairHref} className="gv-st-btn gv-st-forest">Open chair applications</Link>
        )}
        {/* Light: the page header carries the view's one solid forest button. */}
        <button type="button" className="gv-st-btn gv-st-outline" onClick={onPost}>
          <Plus size={16} strokeWidth={1.6} aria-hidden /> {openChairHref ? 'Post a listing' : 'Post your first listing'}
        </button>
        {canPack && (
          <button type="button" className="gv-st-btn gv-st-outline" onClick={onPack}>
            <Layers size={16} strokeWidth={1.6} aria-hidden /> Post chair roles for every committee
          </button>
        )}
      </div>
    </div>
    </EmptyArt>
  );
}
