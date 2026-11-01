'use client';
// Gavelling Crisis: the strip shown on every page while this TAB is trying the crisis as someone else ("Try it as").
// The test token lasts 2 hours and lives in this tab only (src/lib/crisis/client.ts), so the person being tried is never
// signed out and the director's other tabs are untouched. Mount once, inside the crisis layout's provider, above the page.

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { clearCrisisToken, isViewingAs } from '@/lib/crisis/client';
import { ROLE_LABEL } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CK } from '../../crisisKit';

export default function ViewingAsBanner() {
  const { ref, role, displayName } = useCrisis();
  // sessionStorage is read after mount so the server and the first client render agree.
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(isViewingAs(ref.conf, ref.crisis)), 0);
    return () => window.clearTimeout(t);
  }, [ref.conf, ref.crisis]);
  if (!on) return null;
  const back = () => {
    clearCrisisToken(ref.conf, ref.crisis);
    window.location.assign(`/crisis/${ref.conf}/${ref.crisis}`);
  };
  return (
    <div role="status" className="sticky flex flex-wrap items-center justify-center"
      style={{ top: 0, zIndex: 70, gap: 10, padding: '7px 14px', background: CK.redGrad, color: '#FFE8D6', fontFamily: CK.font, fontSize: 13.5, fontWeight: 700, boxShadow: '0 2px 10px rgba(58,14,15,0.3)' }}>
      <Eye size={16} strokeWidth={1.5} aria-hidden style={{ flex: 'none' }} />
      <span style={{ overflowWrap: 'anywhere' }}>
        Trying it as {displayName || ROLE_LABEL[role]}{displayName ? `, ${ROLE_LABEL[role]}` : ''}. This is a test view for 2 hours and signs nobody out
      </span>
      <button type="button" onClick={back}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] active:scale-[0.97] transition-transform"
        style={{ border: 0, cursor: 'pointer', borderRadius: 10, padding: '5px 12px', fontFamily: CK.font, fontSize: 13, fontWeight: 800, background: CK.gold, color: CK.redDeep }}>
        Back to my account
      </button>
    </div>
  );
}
