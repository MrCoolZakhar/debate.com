'use client';

// ── The Job Board's first-time onboarding (prompt 14) ──────────────────────
//
// Owner, 21 Oct 2026: the set-up step "List Chair, Secretariat or Staff
// Positions" opens the Job Board, where a conference that has never had a
// listing (job_conference_panel's onboarding) gets this card at the top in
// place of the empty Your Listings state (not a pop-up). "Do it Later"
// records conferences.jobs_later_at through job_onboarding_later, which also
// completes the set-up step; the card then leaves for good. Posting a first
// listing makes it go on the next panel read.

import { useRef, useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { jobOnboardingLater } from './jobsApi';

const INK = '#1C1410';
const INK_SOFT = '#5C5140';

const STEPS = [
  'Pick the role: chair, secretariat or staff',
  'Write the listing: title, what you offer and up to 5 screening questions',
  'People apply on Gavelling, free for you, and land in Applications or Settings > Team',
];

export default function JobBoardOnboarding({ confId, canPack, onPost, onPack, onLater }: {
  confId: string;
  /** The conference has committees and the chair role is on. */
  canPack: boolean;
  onPost: () => void;
  onPack: () => void;
  /** "Do it Later" landed: the page shows the normal empty state. */
  onLater: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  if (hidden) return null;

  const later = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    setHidden(true);
    try {
      const r = await jobOnboardingLater(confId);
      if (!r.ok) { setHidden(false); setErr(r.message); return; }
      onLater();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: OUTFIT, padding: '18px 4px 6px' }}>
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
      <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 18 }}>
        {/* Light: the page header carries the view's one solid forest button. */}
        <button type="button" className="gv-st-btn gv-st-outline" onClick={onPost}>
          <Plus size={16} strokeWidth={1.6} aria-hidden /> Post your first listing
        </button>
        {canPack && (
          <button type="button" className="gv-st-btn gv-st-outline" onClick={onPack}>
            <Layers size={16} strokeWidth={1.6} aria-hidden /> Post chair roles for every committee
          </button>
        )}
        <button
          type="button"
          onClick={() => { void later(); }}
          disabled={busy}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
          style={{ background: 'none', border: 'none', padding: '6px 4px', cursor: busy ? 'default' : 'pointer', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: INK_SOFT, textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Do it Later
        </button>
      </div>
      {err && <p role="alert" style={{ margin: '10px 0 0', fontSize: 13.5, color: '#9E2A12' }}>{err}</p>}
    </div>
  );
}
