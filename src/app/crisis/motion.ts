// Gavelling Crisis: the shared motion. One small CSS block (mounted once by the crisis layout through <MotionStyles />
// in crisisKit.tsx) that every page and pop-up borrows from by class name. Rules: 150 to 300 ms, transform and opacity
// only, nothing driven by a per-second tick (a class is added once, when something changes), and
// `prefers-reduced-motion` switches all of it off.
//
// Classes
//   cm-btn       Btn: lifts 1px on hover, presses to 0.97
//   cm-lift      a clickable card: lifts 2px on hover, settles on press
//   cm-rise      enters from 10px below; `--i` staggers a list (40 ms a step)
//   cm-fade      a plain fade-in (a pop-up's scrim, content swapped inside a card)
//   cm-pop-in    a pop-up panel rising in
//   cm-next      a card arriving from the right ("next of N"), cm-prev from the left
//   cm-tick      a number that just changed rolls up into place
//   cm-pop       a small thing that just changed pops once (the speaker's flag)
//   cm-ping      a ring that spreads once and fades (a live dot when the floor changes)
//   cm-fresh     a soft gold wash that fades away over 1.5 s (a story that just arrived)
//   cm-drop      a menu or panel dropping in from its trigger
//   cm-slide-in  a row sliding in from the right, staggered by `--i`
//   cm-skel      a grey placeholder with a light sweep
//   cm-chev      a chevron that turns half way round when its parent has aria-expanded
//   cm-grow      a bar that grows from its start (scaleX)

export const MOTION_EASE = 'cubic-bezier(0.22,1,0.36,1)';

export const CRISIS_MOTION_CSS = `
@keyframes cm-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes cm-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cm-pop-in { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }
@keyframes cm-next { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }
@keyframes cm-prev { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: none; } }
@keyframes cm-tick { from { opacity: 0; transform: translateY(55%); } to { opacity: 1; transform: none; } }
@keyframes cm-pop { 0% { transform: scale(0.8); opacity: 0.4; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: none; } }
@keyframes cm-ping { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(2.8); opacity: 0; } }
@keyframes cm-fresh { from { opacity: 1; } to { opacity: 0; } }
@keyframes cm-drop { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes cm-slide-in { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
@keyframes cm-sweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }

.cm-btn { transition: transform 150ms ${MOTION_EASE}; }
.cm-btn:hover:not(:disabled) { transform: translateY(-1px); }
.cm-btn:active:not(:disabled) { transform: scale(0.97); }

.cm-lift { transition: transform 180ms ${MOTION_EASE}; }
.cm-lift:hover { transform: translateY(-2px); }
.cm-lift:active { transform: translateY(0) scale(0.995); }

.cm-rise { animation: cm-rise 240ms ${MOTION_EASE} both; animation-delay: calc(var(--i, 0) * 40ms); }
.cm-fade { animation: cm-fade 180ms ease-out both; }
.cm-pop-in { animation: cm-pop-in 220ms ${MOTION_EASE}; }
.cm-next { animation: cm-next 220ms ${MOTION_EASE} both; }
.cm-prev { animation: cm-prev 220ms ${MOTION_EASE} both; }
.cm-tick { display: inline-block; animation: cm-tick 240ms ${MOTION_EASE} both; }
.cm-pop { animation: cm-pop 240ms ${MOTION_EASE}; }
.cm-ping { position: absolute; inset: 0; border-radius: 50%; background: currentColor; pointer-events: none; animation: cm-ping 900ms ease-out both; }
.cm-fresh { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: rgba(238,217,138,0.5); animation: cm-fresh 1500ms ease-out both; }
.cm-drop { transform-origin: top right; animation: cm-drop 180ms ${MOTION_EASE} both; }
.cm-slide-in { animation: cm-slide-in 240ms ${MOTION_EASE} both; animation-delay: calc(var(--i, 0) * 30ms); }

.cm-skel { position: relative; overflow: hidden; }
.cm-skel::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent); animation: cm-sweep 1.4s ease-in-out infinite; }

.cm-chev { transition: transform 180ms ${MOTION_EASE}; }
[aria-expanded="true"] > .cm-chev { transform: rotate(180deg); }

.cm-grow { transform-origin: left center; transition: transform 700ms linear; }

@media (prefers-reduced-motion: reduce) {
  .cm-btn, .cm-lift, .cm-chev, .cm-grow { transition: none !important; }
  .cm-btn:hover:not(:disabled), .cm-btn:active:not(:disabled), .cm-lift:hover, .cm-lift:active { transform: none !important; }
  .cm-rise, .cm-fade, .cm-pop-in, .cm-next, .cm-prev, .cm-tick, .cm-pop, .cm-ping, .cm-fresh, .cm-drop, .cm-slide-in, .cm-skel::after { animation: none !important; }
  .cm-fresh, .cm-ping { display: none; }
}
`;
