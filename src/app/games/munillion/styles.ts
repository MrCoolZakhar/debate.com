// The /games look (owner, 26 Nov 2026): a pixel-art UN General Assembly hall
// behind everything, dark pixel panels on top, a delegate's hand floating in
// the middle that raises its placard to the score line. Two pixel typefaces:
// Press Start 2P for labels, numbers and buttons, VT323 for prompts and text.
// Both have one weight, so weights are pinned to 400 and never synthesised.

export const MUNILLION_CSS = `
.mn-page { background: #0E141B; color: #F3EEDF; }
.mn-page .mn-px, .mn-page .mn-tx { font-weight: 400 !important; font-synthesis: none; }
.mn-px { font-family: var(--font-pixel), monospace; letter-spacing: .02em; line-height: 1.5; }
.mn-tx { font-family: var(--font-pixel-body), monospace; line-height: 1.2; }

.mn-stage {
  position: relative; overflow: hidden; isolation: isolate;
  min-height: calc(100vh - 72px); min-height: calc(100svh - 72px);
  display: flex; flex-direction: column; align-items: center;
  padding: clamp(14px, 2vw, 24px) 16px 0;
}
.mn-bg {
  position: absolute; inset: 0; z-index: -2;
  background: #1A2230 url('/games/munillion-hall.jpg') center 35% / cover no-repeat;
  image-rendering: pixelated;
  transform: scale(1.04); transition: transform 1.6s steps(16, end);
}
.mn-bg.is-up { transform: scale(1.04) translateY(2%); }
.mn-shade { position: absolute; inset: 0; z-index: -1; background:
  linear-gradient(180deg, rgba(10,14,20,.55) 0%, rgba(10,14,20,.25) 35%, rgba(10,14,20,.55) 75%, rgba(10,14,20,.9) 100%); }
.mn-scan { position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: .18;
  background: repeating-linear-gradient(180deg, rgba(0,0,0,.6) 0 1px, transparent 1px 3px); }

/* floating motes: paper scraps and gold dust drifting up through the hall */
.mn-motes { position: absolute; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
.mn-mote { position: absolute; bottom: -12px; width: 4px; height: 4px; background: #EED98A; opacity: 0;
  animation: mn-rise var(--d, 14s) steps(28, end) infinite; animation-delay: var(--delay, 0s); }
.mn-mote.is-paper { width: 6px; height: 4px; background: #F3EEDF; }
@keyframes mn-rise {
  0% { transform: translate(0, 0); opacity: 0; }
  10% { opacity: .8; }
  50% { transform: translate(var(--x, 18px), -50vh); }
  90% { opacity: .6; }
  100% { transform: translate(0, -100vh); opacity: 0; }
}

.mn-title-row { text-align: center; margin-bottom: 10px; }
.mn-title { margin: 0; color: #EED98A; font-size: clamp(22px, 3.6vw, 44px); line-height: 1.2;
  text-shadow: 3px 3px 0 #1B3828, -2px 0 0 rgba(255,90,120,.35), 2px 0 0 rgba(90,200,255,.35); }
.mn-tagline { margin: 10px auto 0; color: #E6DFCC; font-size: clamp(18px, 1.7vw, 22px); max-width: 46ch; }

.mn-panel { background: rgba(14,18,26,.86); border: 3px solid #EED98A; box-shadow: 0 0 0 3px #0B0E13, 6px 6px 0 3px rgba(0,0,0,.45); }
.mn-hud { width: min(100%, 980px); display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; }
.mn-box { padding: 8px 14px; min-width: 96px; }
.mn-box-label { color: #B9B09A; font-size: 9px; }
.mn-box-value { color: #EED98A; font-size: 20px; line-height: 1.3; }
.mn-progress { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.mn-dots { display: flex; gap: 5px; }
.mn-dot { width: 14px; height: 14px; border: 2px solid #EED98A; background: rgba(14,18,26,.7); }
.mn-dot.is-done { background: #EED98A; }
.mn-dot.is-zero { background: #5C5547; border-color: #8D846F; }
.mn-dot.is-now { background: #7BC9A0; }
.mn-progress-label { color: #E6DFCC; font-size: 9px; }

.mn-centre { width: min(100%, 980px); flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
.mn-card { width: min(100%, 640px); padding: clamp(16px, 2.4vw, 26px); margin-top: clamp(14px, 3vh, 34px); }
.mn-kicker { color: #FF8FA3; font-size: 10px; }
.mn-prompt { margin: 12px 0 6px; color: #F3EEDF; font-size: clamp(28px, 3vw, 40px); text-wrap: balance; }
.mn-hint { margin: 0; color: #B9B09A; font-size: 20px; }
.mn-h2 { margin: 0; color: #EED98A; font-size: clamp(14px, 1.6vw, 18px); line-height: 1.6; }
.mn-p { margin: 12px 0 0; color: #E6DFCC; font-size: 21px; }

/* the floating hand and its placard */
.mn-hand-zone { position: relative; width: 100%; flex: 1; min-height: 300px; }
.mn-ladder { position: absolute; inset: 6% 0 0 0; pointer-events: none; }
.mn-rung { position: absolute; left: 4%; right: 4%; height: 0; border-top: 2px dashed rgba(238,217,138,.35); opacity: 0; transition: opacity .3s steps(3, end); }
.mn-ladder.is-on .mn-rung { opacity: 1; }
.mn-rung span { position: absolute; right: 0; top: -22px; color: rgba(243,238,223,.75); font-size: 9px; white-space: nowrap; }
.mn-rung.is-hit { border-top-color: #EED98A; }
.mn-rung.is-hit span { color: #EED98A; }
.mn-hand {
  position: absolute; left: 50%; top: var(--top, 100%);
  transform: translate(-50%, -18%);
  transition: top 1.5s steps(15, end);
  display: flex; flex-direction: column; align-items: center; z-index: 1;
}
.mn-hand-bob { display: flex; flex-direction: column; align-items: center; animation: mn-bob 1.8s steps(2, end) infinite; }
@keyframes mn-bob { 50% { transform: translateY(-8px); } }
.mn-placard {
  min-width: 150px; max-width: min(78vw, 420px); padding: 10px 16px 8px; text-align: center;
  background: #FBF7EC; color: #1C1410; border: 4px solid #1C1410; box-shadow: inset 0 -5px 0 #D8CFB8, 5px 5px 0 rgba(0,0,0,.35);
  font-size: clamp(22px, 2.6vw, 30px); overflow-wrap: anywhere;
}
.mn-placard small { display: block; color: #1B3828; font-size: 9px; margin-bottom: 4px; }
.mn-placard.is-empty { color: #A99E86; }
.mn-arm { margin-top: -6px; image-rendering: pixelated; }
.mn-glow { position: absolute; top: -30px; width: 220px; height: 120px; background: radial-gradient(closest-side, rgba(238,217,138,.35), transparent); z-index: -1; }

.mn-result-tag { position: absolute; left: 50%; transform: translateX(-50%); bottom: 8px; text-align: center; width: min(100%, 520px); }
.mn-tier-name { color: #EED98A; font-size: clamp(14px, 2vw, 20px); text-shadow: 2px 2px 0 #0B0E13; }
.mn-points { display: inline-block; margin-top: 8px; padding: 4px 10px; background: #EED98A; color: #1C1410; font-size: 12px; border: 3px solid #0B0E13; }
.mn-points.is-zero { background: #8D846F; }
.mn-line { margin: 8px 0 0; color: #E6DFCC; font-size: 20px; text-shadow: 1px 1px 0 #0B0E13; }
.mn-line a, .mn-answers a, .mn-link { color: #EED98A; text-decoration: underline; text-underline-offset: 3px; }

/* the answer bar */
.mn-bar-zone { width: min(100%, 720px); padding: 14px 0 clamp(16px, 3vh, 28px); position: relative; }
.mn-answer-row { display: flex; gap: 10px; align-items: stretch; }
.mn-timer { width: 58px; height: 58px; flex: none; border-radius: 50%; border: 3px solid #EED98A; background: rgba(14,18,26,.9);
  display: flex; align-items: center; justify-content: center; color: #EED98A; font-size: 14px; position: relative; }
.mn-timer svg { position: absolute; inset: -3px; transform: rotate(-90deg); }
.mn-timer.is-low { color: #FF8FA3; border-color: #FF8FA3; animation: mn-blink 1s steps(2, end) infinite; }
@keyframes mn-blink { 50% { opacity: .55; } }
.mn-input { flex: 1; min-width: 0; height: 58px; padding: 0 16px; border: 3px solid #EED98A; border-radius: 0; outline: none;
  background: rgba(14,18,26,.92); color: #F3EEDF; font-size: 26px; }
.mn-input::placeholder { color: #8D846F; }
.mn-input:focus { box-shadow: 0 0 0 3px rgba(238,217,138,.35); }
.mn-drain { height: 4px; margin: 8px 0 0 68px; background: rgba(238,217,138,.18); }
.mn-drain > span { display: block; height: 100%; background: #EED98A; transition: width .25s steps(2, end); }
.mn-bubble { position: absolute; left: 50%; bottom: calc(100% - 4px); transform: translateX(-50%); width: max-content; max-width: 100%;
  padding: 8px 14px; text-align: center; }
.mn-bubble .mn-tx { font-size: 21px; color: #F3EEDF; }
.mn-bubble .mn-tx b { color: #7BC9A0; font-weight: 400; }
.mn-bubble .mn-px { font-size: 8px; color: #B9B09A; margin-top: 4px; }
.mn-msg { min-height: 26px; margin: 8px 0 0; text-align: center; color: #FF8FA3; font-size: 20px; }
@keyframes mn-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.mn-shake { animation: mn-shake 240ms steps(4, end) 1; }
.mn-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 14px; }
.mn-row.is-center { justify-content: center; }

.mn-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; min-height: 52px;
  background: #FF8FA3; color: #1C1410; border: 3px solid #0B0E13; box-shadow: 4px 4px 0 #0B0E13; border-radius: 0; outline: none;
  cursor: pointer; font-size: 11px; text-decoration: none; transition: transform 80ms steps(2, end), box-shadow 80ms steps(2, end); }
.mn-btn:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 #0B0E13; }
.mn-btn:focus-visible { box-shadow: 0 0 0 3px #EED98A, 4px 4px 0 #0B0E13; }
.mn-btn:disabled { opacity: .5; cursor: default; }
.mn-btn.is-gold { background: #EED98A; }
.mn-btn.is-ghost { background: rgba(14,18,26,.9); color: #F3EEDF; border-color: #EED98A; }
.mn-btn.is-small { min-height: 40px; font-size: 9px; padding: 0 12px; box-shadow: 3px 3px 0 #0B0E13; }
.mn-btn.is-wide { width: 100%; min-height: 58px; font-size: 13px; }

.mn-legend { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 8px; }
.mn-legend li { display: flex; align-items: center; gap: 10px; color: #E6DFCC; font-size: 20px; }
.mn-legend .mn-px { margin-left: auto; color: #EED98A; font-size: 10px; }

/* summary */
.mn-summary { width: min(100%, 720px); padding: clamp(18px, 2.6vw, 30px); margin: clamp(14px, 3vh, 30px) 0; text-align: center; }
.mn-total { color: #EED98A; font-size: clamp(34px, 6vw, 60px); line-height: 1.2; margin-top: 12px; }
.mn-total small { color: #B9B09A; font-size: .3em; }
.mn-icons { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin: 18px 0 4px; }
.mn-icons figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.mn-icons figcaption { color: #B9B09A; font-size: 8px; }
.mn-countdown { margin-top: 16px; color: #7BC9A0; font-size: 10px; }

/* the answers, Krillion style: one row per round, opens to every answer */
.mn-answers { text-align: left; margin-top: 26px; }
.mn-answers-head { display: flex; align-items: baseline; gap: 10px; color: #B9B09A; font-size: 9px; padding-bottom: 8px; border-bottom: 2px dashed rgba(238,217,138,.3); }
.mn-answers-head b { color: #EED98A; font-weight: 400; }
.mn-round { border-bottom: 2px dashed rgba(238,217,138,.18); }
.mn-round-btn { width: 100%; display: grid; grid-template-columns: 22px 32px minmax(0, 1fr) auto 14px; gap: 10px; align-items: center;
  padding: 12px 4px; background: none; border: 0; outline: none; cursor: pointer; text-align: left; color: inherit; }
.mn-round-btn:focus-visible { box-shadow: inset 0 0 0 2px #EED98A; }
.mn-round-n { color: #8D846F; font-size: 9px; }
.mn-round-q { display: block; color: #B9B09A; font-size: 17px; overflow-wrap: anywhere; }
.mn-round-a { display: block; color: #F3EEDF; font-size: 23px; overflow-wrap: anywhere; }
.mn-round-pts { color: #EED98A; font-size: 10px; }
.mn-round-chev { color: #EED98A; font-size: 10px; transition: transform .2s steps(2, end); }
.mn-round.is-open .mn-round-chev { transform: rotate(90deg); }
.mn-round-body { padding: 0 4px 14px 32px; }
.mn-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.mn-filter { padding: 6px 10px; border: 2px solid rgba(238,217,138,.45); background: rgba(14,18,26,.7); color: #E6DFCC; font-size: 8px; cursor: pointer; outline: none; border-radius: 0; }
.mn-filter.is-on { border-color: #EED98A; background: #EED98A; color: #1C1410; }
.mn-filter:focus-visible { box-shadow: 0 0 0 2px #7BC9A0; }
.mn-search { width: 100%; margin-top: 10px; height: 42px; padding: 0 12px; border: 2px solid rgba(238,217,138,.45); border-radius: 0; outline: none;
  background: rgba(10,14,20,.9); color: #F3EEDF; font-size: 21px; }
.mn-search:focus { border-color: #EED98A; }
.mn-list { list-style: none; margin: 10px 0 0; padding: 0 6px 0 0; max-height: 360px; overflow-y: auto; }
.mn-list li { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 10px; align-items: start; padding: 7px 0; border-bottom: 1px solid rgba(238,217,138,.1); }
.mn-list li.is-mine { background: rgba(238,217,138,.14); }
.mn-list .mn-a { color: #F3EEDF; font-size: 21px; overflow-wrap: anywhere; }
.mn-list .mn-note { display: block; color: #B9B09A; font-size: 17px; overflow-wrap: anywhere; }
.mn-list .mn-px { color: #EED98A; font-size: 9px; padding-top: 4px; }
.mn-list-foot { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; color: #8D846F; font-size: 8px; }

.mn-preview { width: min(100%, 980px); margin-bottom: 10px; padding: 8px 12px; background: #EED98A; color: #1C1410; border: 3px solid #0B0E13;
  display: flex; gap: 12px; flex-wrap: wrap; justify-content: space-between; align-items: center; font-size: 9px; }
.mn-preview .mn-link { color: #1B3828; }
.mn-skeleton { min-height: calc(100vh - 72px); background: #0E141B; }

@media (max-width: 640px) {
  .mn-hud { grid-template-columns: 1fr 1fr; }
  .mn-progress { grid-column: 1 / -1; order: 3; }
  .mn-rung span { font-size: 7px; }
  .mn-hand-zone { min-height: 240px; }
}
@media (prefers-reduced-motion: reduce) {
  .mn-mote, .mn-hand-bob, .mn-timer.is-low, .mn-shake { animation: none; }
  .mn-hand, .mn-bg, .mn-drain > span { transition: none; }
}
`;
