'use client';

// ── The Store's Job Board carousel (24 Nov 2026) ────────────────────────────
//
// The conference's live listings as compact public cards (src/app/jobs/JobCard),
// each with "Promoted until …" when promoted and a Promote button. The motion is
// the logic of src/app/jobs/MoreFromConference.tsx, copied (not imported) with
// as many visible as fit (5, 4 or 3, see below):
//   - 5 or fewer: the cards sit centred, no arrows, no motion.
//   - more than 5: Previous and Next at the edges slide by ONE card, wrapping
//     round with the copy-and-jump trick; it also advances by one card every
//     10 seconds, paused while the pointer is over it, while anything in it has
//     keyboard focus and while the tab is hidden; Previous or Next restart the
//     10 seconds; never with prefers-reduced-motion. A transform only.
//   - phones (max-width 639px): a swipe row with scroll snap, no arrows, no
//     auto motion.
// Every card in a row is the same height, its button at the bottom.
//
// 24 Nov 2026 (prompt 64): each slot is ONE small card made for this carousel
// (the public JobCard was built for a wide list and squeezed titles to one
// letter a line): the logo, the role glyph and the title on the full card
// width, the committee, "Promoted" with its end day, then Promote. A promoted
// listing has the public card's gold edge. How many fit follows the
// carousel's own width (ResizeObserver): 5 from 1000 px, 4 from 760 px, else 3.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { JobLogo, JobTag } from '@/app/jobs/JobCard';
import { JobRoleGlyph } from '@/lib/jobRoleIcon';
import { JOB_ROLE_LABEL } from '@/lib/jobBoard';
import { dayLabel, type OrgListing } from '../jobs/jobsApi';

const FONT = "var(--font-brand), sans-serif";
const FOREST = '#1B3828';
const GAP = 14;

/** How many cards fit in the carousel's own width. */
function visibleFor(width: number): number {
  return width >= 1000 ? 5 : width >= 760 ? 4 : 3;
}
const AUTO_MS = 10_000;

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

export default function JobPromoteCarousel({ listings, canPromote, promoteOpen, onPromote }: {
  listings: OrgListing[];
  canPromote: boolean;
  /** A promote pop-up is open: every Promote button waits. */
  promoteOpen: boolean;
  onPromote: (listing: OrgListing) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(true);
  const phone = useIsPhone();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [restart, setRestart] = useState(0);
  const [visible, setVisible] = useState(5);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const visibleRef = useRef(5);

  // Measure the carousel itself, never the window. A new count starts again at the first card, with no motion.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.getBoundingClientRect().width;
      const v = visibleFor(w);
      if (v === visibleRef.current) return;
      visibleRef.current = v;
      setAnimate(false);
      setIdx(0);
      setVisible(v);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === 'hidden');
    onVis();
    document.addEventListener('visibilitychange', onVis);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => setReduced(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      mq.removeEventListener('change', onMq);
    };
  }, []);

  const n = listings.length;
  const sliding = !phone && n > visible;
  const track = sliding ? [...listings, ...listings.slice(0, visible)] : listings;

  // Back from the copy at the end with no transition.
  const onEnd = () => {
    if (idx >= n) { setAnimate(false); setIdx(idx - n); }
  };
  // One card every 10 s, restarted by every move (and by Previous / Next).
  useEffect(() => {
    if (!sliding || hovered || focused || hidden || reduced) return;
    const t = window.setTimeout(() => setIdx((i) => i + 1), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [sliding, hovered, focused, hidden, reduced, idx, restart]);

  useEffect(() => {
    if (animate) return;
    const t = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setAnimate(true)));
    return () => window.cancelAnimationFrame(t);
  }, [animate]);

  if (n === 0) return null;

  // With reduced motion there is no transition to end, so wrap directly.
  const still = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const next = () => {
    setRestart((r) => r + 1);
    if (still()) { setIdx((i) => (i + 1) % n); return; }
    setIdx((i) => i + 1);
  };
  const prev = () => {
    setRestart((r) => r + 1);
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

  const cardWidth = `calc((100% - ${GAP * (visible - 1)}px) / ${visible})`;

  const slot = (l: OrgListing) => (
    <div className={`gv-jpc-slot${l.promotion ? ' gv-jpc-slot-promoted' : ''}`}>
      <Link href={`/jobs?listing=${l.id}`} className="gv-jpc-link focus:outline-none">
        <JobLogo conf={l.conference} size={34} standalone={l.standalone} />
        <span className="gv-jpc-titlerow">
          <span role="img" aria-label={JOB_ROLE_LABEL[l.role]} className="gv-jpc-glyph"><JobRoleGlyph role={l.role} size={15} /></span>
          <span className="gv-jpc-title">{l.title}</span>
        </span>
        {l.committee ? <span className="gv-jpc-committee">{l.committee}</span> : null}
      </Link>
      {l.promotion ? (
        <div className="gv-jpc-promo">
          <JobTag kind="promoted" />
          <span className="gv-jpc-until">Until {dayLabel(l.promotion.ends_on)}</span>
        </div>
      ) : null}
      {canPromote ? (
        <button
          type="button"
          className="gv-st-btn gv-st-outline gv-jpc-btn"
          disabled={promoteOpen}
          onClick={() => { if (!promoteOpen) onPromote(l); }}
        >
          Promote
        </button>
      ) : null}
    </div>
  );

  return (
    <div
      ref={frameRef}
      className="gv-jpc"
      style={{ fontFamily: FONT }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
    >
      <style>{CSS}</style>
      {phone ? (
        <ul className="gv-jpc-swipe">
          {listings.map((l) => <li key={l.id} className="gv-jpc-swipe-cell">{slot(l)}</li>)}
        </ul>
      ) : (
        <div className="gv-jpc-frame">
          {sliding && (
            <button type="button" className="gv-jpc-arrow gv-jpc-prev" onClick={prev} aria-label="Previous listings">
              <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
            </button>
          )}
          <div className="gv-jpc-viewport">
            <div
              className={`gv-jpc-track${animate ? ' gv-jpc-anim' : ''}`}
              style={{
                gap: GAP,
                justifyContent: sliding ? 'flex-start' : 'center',
                transform: sliding ? `translateX(calc(-${idx} * (${cardWidth} + ${GAP}px)))` : undefined,
              }}
              onTransitionEnd={onEnd}
            >
              {track.map((l, i) => (
                <div
                  key={`${l.id}-${i}`}
                  className="gv-jpc-cell"
                  style={{ flex: `0 0 ${cardWidth}` }}
                  aria-hidden={sliding && (i < idx || i >= idx + visible) ? true : undefined}
                  inert={sliding && (i < idx || i >= idx + visible) ? true : undefined}
                >
                  {slot(l)}
                </div>
              ))}
            </div>
          </div>
          {sliding && (
            <button type="button" className="gv-jpc-arrow gv-jpc-next" onClick={next} aria-label="Next listings">
              <ChevronRight size={18} strokeWidth={2.4} aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const CSS = `
.gv-jpc-frame{position:relative}
.gv-jpc-viewport{overflow:hidden;padding:4px 2px 10px;margin:-4px -2px -10px}
.gv-jpc-track{display:flex;width:100%;align-items:stretch}
.gv-jpc-anim{transition:transform 420ms cubic-bezier(0.22,1,0.36,1)}
.gv-jpc-cell{display:flex;min-width:0}
.gv-jpc-slot{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:18px;background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
.gv-jpc-slot-promoted{box-shadow:0 0 0 1.5px #E2C467,0 8px 22px rgba(182,135,31,0.18)}
.gv-jpc-link{display:flex;flex-direction:column;gap:8px;min-width:0;text-decoration:none;color:inherit;border-radius:12px}
.gv-jpc-link:focus-visible{outline:2px solid ${FOREST};outline-offset:3px}
.gv-jpc-titlerow{display:flex;align-items:flex-start;gap:6px;min-width:0}
.gv-jpc-glyph{display:inline-flex;flex-shrink:0;margin-top:2px;color:${FOREST}}
.gv-jpc-title{min-width:0;flex:1;font-size:14.5px;font-weight:700;line-height:1.25;color:#1C1410;overflow-wrap:break-word}
.gv-jpc-committee{font-size:12px;font-weight:600;color:${FOREST};overflow-wrap:break-word}
.gv-jpc-promo{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.gv-jpc-until{font-size:12.5px;font-weight:600;color:#2A5A3C}
.gv-jpc-btn{width:100%;margin-top:auto}
.gv-jpc-arrow{position:absolute;top:50%;z-index:2;width:36px;height:36px;margin-top:-18px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:${FOREST};
  background:linear-gradient(180deg,#FFFFFF 0%,#F2EDE2 100%);border:1px solid rgba(27,56,40,0.16);box-shadow:inset 0 1px 0 #FFFFFF,0 2px 6px rgba(27,56,40,0.14)}
.gv-jpc-prev{left:-14px}
.gv-jpc-next{right:-14px}
.gv-jpc-arrow:focus{outline:none}
.gv-jpc-arrow:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-jpc-swipe{list-style:none;margin:0 -4px;padding:4px 4px 10px;display:flex;gap:${GAP}px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.gv-jpc-swipe::-webkit-scrollbar{display:none}
.gv-jpc-swipe-cell{flex:0 0 min(78vw,280px);scroll-snap-align:start;display:flex}
@media (prefers-reduced-motion:reduce){.gv-jpc-anim{transition:none}}
`;
