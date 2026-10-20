'use client';

// ── "More from <short>" under a listing (Job Board prompt 12) ──────────────
//
// The conference's other live listings (job_conference_listings), the one
// being read left out. Owner's rule (20 Oct 2026): always exactly 3 compact
// cards at a time (fewer only when fewer exist), with Previous and Next at the
// edges. Next slides by ONE: the left card leaves, the others shift left and
// the next role slots in on the right; it wraps around at the end. The arrows
// hide with 3 or fewer. The slide is a transform only and respects
// prefers-reduced-motion. On phones it is a swipe row, no arrows.
//
// Wrap-around: the track holds the list plus its first 3 again; sliding past
// the end lands on the copy and then jumps back to the start with no
// transition, so the motion is always one card.

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchConferenceListings, type JobCard as JobCardData } from '@/lib/jobBoard';
import JobCard from './JobCard';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const FOREST = '#1B3828';
const VISIBLE = 3;
const GAP = 12;

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

export default function MoreFromConference({ conferenceId, excludeId, short, onSelect }: {
  conferenceId: string;
  excludeId: string;
  short: string;
  /** Opens a listing in the same pane, as the list's cards do. */
  onSelect?: (id: string) => void;
}) {
  const [items, setItems] = useState<JobCardData[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(true);
  const phone = useIsPhone();
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchConferenceListings(conferenceId).then((list) => {
      if (!cancelled) setItems(list.filter((c) => c.id !== excludeId));
    });
    return () => { cancelled = true; };
  }, [conferenceId, excludeId]);

  const list = items ?? [];
  const n = list.length;
  const sliding = !phone && n > VISIBLE;
  const track = sliding ? [...list, ...list.slice(0, VISIBLE)] : list;

  // Back from the copy at the end (or to it at the start) with no transition.
  const onEnd = () => {
    if (idx >= n) { setAnimate(false); setIdx(idx - n); }
  };
  useEffect(() => {
    if (animate) return;
    const t = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setAnimate(true)));
    return () => window.cancelAnimationFrame(t);
  }, [animate]);

  if (n === 0) return null;

  // With reduced motion there is no transition to end, so wrap directly.
  const still = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const next = () => {
    if (still()) { setIdx((i) => (i + 1) % n); return; }
    setIdx((i) => i + 1);
  };
  const prev = () => {
    if (still()) { setIdx((i) => (i - 1 + n) % n); return; }
    if (idx === 0) {
      // Jump to the copy without motion, then slide one back.
      setAnimate(false);
      setIdx(n);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => { setAnimate(true); setIdx(n - 1); }));
    } else {
      setIdx((i) => i - 1);
    }
  };

  const cardWidth = `calc((100% - ${GAP * (VISIBLE - 1)}px) / ${VISIBLE})`;

  return (
    <section aria-label={`More from ${short}`} style={{ fontFamily: FONT }}>
      <style>{CSS}</style>
      <div className="gv-mfc-head">
        <h3 className="gv-mfc-title">More from {short}</h3>
        {sliding && (
          <div className="gv-mfc-arrows">
            <button type="button" className="gv-mfc-arrow" onClick={prev} aria-label="Previous roles"><ChevronLeft size={18} strokeWidth={2.4} aria-hidden /></button>
            <button type="button" className="gv-mfc-arrow" onClick={next} aria-label="Next roles"><ChevronRight size={18} strokeWidth={2.4} aria-hidden /></button>
          </div>
        )}
      </div>
      {phone ? (
        <ul className="gv-mfc-swipe">
          {list.map((c) => (
            <li key={c.id} className="gv-mfc-swipe-cell"><JobCard card={c} compact onSelect={onSelect} /></li>
          ))}
        </ul>
      ) : (
        <div className="gv-mfc-viewport">
          <div
            ref={trackRef}
            className={`gv-mfc-track${animate ? ' gv-mfc-anim' : ''}`}
            style={{ gap: GAP, transform: sliding ? `translateX(calc(-${idx} * (${cardWidth} + ${GAP}px)))` : undefined }}
            onTransitionEnd={onEnd}
          >
            {track.map((c, i) => (
              <div key={`${c.id}-${i}`} className="gv-mfc-cell" style={{ flex: `0 0 ${cardWidth}` }} aria-hidden={sliding && (i < idx || i >= idx + VISIBLE) ? true : undefined}>
                <JobCard card={c} compact onSelect={onSelect} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const CSS = `
.gv-mfc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.gv-mfc-title{margin:0;font-size:17px;font-weight:800;letter-spacing:-0.01em;color:${INK};overflow-wrap:anywhere}
.gv-mfc-arrows{display:flex;gap:6px;flex-shrink:0}
.gv-mfc-arrow{width:36px;height:36px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:${FOREST};
  background:linear-gradient(180deg,#FFFFFF 0%,#F2EDE2 100%);border:1px solid rgba(27,56,40,0.16);box-shadow:inset 0 1px 0 #FFFFFF,0 2px 6px rgba(27,56,40,0.14)}
.gv-mfc-arrow:focus{outline:none}
.gv-mfc-arrow:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-mfc-viewport{overflow:hidden;padding:4px 2px 8px;margin:-4px -2px -8px}
.gv-mfc-track{display:flex;width:100%}
.gv-mfc-anim{transition:transform 420ms cubic-bezier(0.22,1,0.36,1)}
.gv-mfc-cell{display:flex;min-width:0}
.gv-mfc-cell > a{flex:1}
.gv-mfc-swipe{list-style:none;margin:0 -4px;padding:4px 4px 8px;display:flex;gap:${GAP}px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.gv-mfc-swipe::-webkit-scrollbar{display:none}
.gv-mfc-swipe-cell{flex:0 0 min(78vw,280px);scroll-snap-align:start;display:flex}
.gv-mfc-swipe-cell > a{flex:1}
@media (prefers-reduced-motion:reduce){.gv-mfc-anim{transition:none}}
`;
