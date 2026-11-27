// The /games look (owner, 26 Nov 2026): a pixel-art UN General Assembly hall
// behind everything, the site's top bar floating over it, and the whole game
// on ONE screen on any device (100dvh, nothing to scroll). A delegate's hand
// sits behind the panels, dimmed, and grows (fast, then slowing, swaying and
// twisting) as the score climbs. Press Start 2P for labels and numbers, VT323
// for prompts and text; both have one weight, so weights are pinned to 400.

export const MUNILLION_CSS = `
.mn-page { background: #0E141B; color: #F3EEDF; }
.mn-page .mn-px, .mn-page .mn-tx { font-weight: 400 !important; font-synthesis: none; }
.mn-px { font-family: var(--font-pixel), monospace; letter-spacing: .02em; line-height: 1.55; }
.mn-tx { font-family: var(--font-pixel-body), monospace; line-height: 1.15; }

.mn-shell { position: relative; }
.mn-stage {
  position: relative; overflow: hidden; isolation: isolate;
  /* the Motion to Save bar (SaleBar, 40px, --gv-sale-bar-offset) sits above the page while a sale runs */
  height: calc(100vh - var(--gv-sale-bar-offset, 0px)); height: calc(100dvh - var(--gv-sale-bar-offset, 0px)); min-height: 480px;
  display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: clamp(6px, 1.2vh, 12px);
  padding: 76px clamp(12px, 2vw, 24px) clamp(10px, 1.8vh, 18px);
}
/* below 1024px the site's bottom tab bar (62px, MobileTabBar) takes the bottom of the screen */
@media (max-width: 1023px) {
  .mn-stage { padding-top: 70px; height: calc(100vh - 62px - var(--gv-sale-bar-offset, 0px)); height: calc(100dvh - 62px - env(safe-area-inset-bottom, 0px) - var(--gv-sale-bar-offset, 0px)); min-height: 420px; }
}
.mn-bg { position: absolute; inset: -2%; z-index: -4; background: #1A2230 url('/games/munillion-hall.jpg') center 35% / cover no-repeat;
  image-rendering: pixelated; animation: mn-drift 40s ease-in-out infinite alternate; }
@keyframes mn-drift { from { transform: scale(1.04) translate(0, 0); } to { transform: scale(1.09) translate(-1.5%, 1%); } }
.mn-shade { position: absolute; inset: 0; z-index: -3; background:
  linear-gradient(180deg, rgba(8,11,16,.78) 0%, rgba(8,11,16,.35) 22%, rgba(8,11,16,.3) 55%, rgba(8,11,16,.85) 100%); }
.mn-scan { position: absolute; inset: 0; z-index: 3; pointer-events: none; opacity: .12;
  background: repeating-linear-gradient(180deg, rgba(0,0,0,.7) 0 1px, transparent 1px 3px); }
.mn-motes { position: absolute; inset: 0; z-index: -2; pointer-events: none; overflow: hidden; }
.mn-mote { position: absolute; bottom: -12px; width: 4px; height: 4px; background: #EED98A; opacity: 0;
  animation: mn-rise var(--d, 14s) steps(28, end) infinite; animation-delay: var(--delay, 0s); }
.mn-mote.is-paper { width: 6px; height: 4px; background: #F3EEDF; }
@keyframes mn-rise { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: .8; }
  50% { transform: translate(var(--x, 18px), -50vh); } 90% { opacity: .6; } 100% { transform: translate(0, -100vh); opacity: 0; } }

/* the growing hand: behind every panel, dimmed */
.mn-handlayer { position: absolute; inset: 0; z-index: -1; pointer-events: none; display: flex; justify-content: center; align-items: flex-end; }
.mn-grower { transform-origin: 50% 100%; will-change: transform; margin-bottom: 9vh; }
.mn-bob { display: flex; flex-direction: column; align-items: center; animation: mn-bob 2.4s ease-in-out infinite; transform-origin: 50% 100%; }
@keyframes mn-bob { 0%, 100% { transform: translateY(0) rotate(-1.2deg); } 50% { transform: translateY(-1.4vh) rotate(1.2deg); } }
.mn-hand-fig { filter: brightness(.68) saturate(.85) drop-shadow(0 0 24px rgba(238,217,138,.18)); opacity: .9; display: flex; flex-direction: column; align-items: center; }
.mn-placard { min-width: 20vh; max-width: min(70vw, 52vh); padding: 1vh 2vh .8vh; text-align: center; background: #FBF7EC; color: #1C1410;
  border: .6vh solid #1C1410; box-shadow: inset 0 -.8vh 0 #D8CFB8; font-size: clamp(18px, 3.4vh, 34px); overflow-wrap: anywhere; line-height: 1.05; }
.mn-placard small { display: block; color: #1B3828; font-size: clamp(7px, 1.1vh, 10px); margin-bottom: .5vh; }
.mn-placard.is-empty { color: #A99E86; }
.mn-arm { margin-top: -.9vh; line-height: 0; }
.mn-arm svg { width: 11vh !important; height: auto !important; }
.mn-dim { position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: radial-gradient(ellipse 55% 45% at 50% 42%, transparent 0%, rgba(8,11,16,.15) 60%, rgba(8,11,16,.5) 100%); }
.mn-halo { position: absolute; left: 50%; bottom: 30%; width: 70vh; height: 70vh; transform: translateX(-50%); z-index: -1; pointer-events: none; opacity: 0;
  background: conic-gradient(from 0deg, rgba(238,217,138,.0), rgba(238,217,138,.22), rgba(238,217,138,0) 12%, rgba(238,217,138,.22) 25%, rgba(238,217,138,0) 37%,
    rgba(238,217,138,.22) 50%, rgba(238,217,138,0) 62%, rgba(238,217,138,.22) 75%, rgba(238,217,138,0) 87%);
  border-radius: 50%; -webkit-mask: radial-gradient(closest-side, #000 30%, transparent); mask: radial-gradient(closest-side, #000 30%, transparent);
  animation: mn-spin 12s linear infinite; transition: opacity .6s; }
.mn-halo.is-on { opacity: 1; }
@keyframes mn-spin { to { transform: translateX(-50%) rotate(360deg); } }

/* bursts and flashes */
.mn-burst { position: absolute; left: 50%; top: 46%; z-index: 4; pointer-events: none; }
.mn-bit { position: absolute; width: 8px; height: 8px; background: var(--c, #EED98A); animation: mn-bit 1.3s cubic-bezier(.15,.8,.3,1) forwards; }
@keyframes mn-bit { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(var(--bx), var(--by)) rotate(var(--br)); opacity: 0; } }
.mn-flash { position: absolute; inset: 0; z-index: 5; pointer-events: none; background: #FFF6D0; animation: mn-flash .7s ease-out forwards; }
@keyframes mn-flash { from { opacity: .75; } to { opacity: 0; } }
.mn-shakeit { animation: mn-quake .5s steps(6, end) 1; }
@keyframes mn-quake { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-6px, 3px); } 40% { transform: translate(5px, -4px); } 60% { transform: translate(-4px, 2px); } 80% { transform: translate(3px, -1px); } }

.mn-title-row { text-align: center; }
.mn-title { margin: 0; color: #EED98A; font-size: clamp(30px, 6.4vh, 66px); line-height: 1.15;
  text-shadow: 3px 3px 0 #1B3828, -2px 0 0 rgba(255,90,120,.35), 2px 0 0 rgba(90,200,255,.35); }
.mn-tagline { margin: .8vh auto 0; color: #E6DFCC; font-size: clamp(15px, 2.5vh, 23px); white-space: nowrap; }
.mn-tag-short { display: none; }
@media (max-width: 760px) { .mn-tag-long { display: none; } .mn-tag-short { display: inline; } .mn-tagline { font-size: clamp(13px, 4.2vw, 18px); } }

.mn-panel { background: rgba(12,16,23,.88); border: 3px solid #EED98A; box-shadow: 0 0 0 3px #0B0E13, 5px 5px 0 3px rgba(0,0,0,.45); }
.mn-hud { width: min(100%, 1180px); justify-self: center; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; }
.mn-box { padding: .7vh 12px; min-width: 88px; }
.mn-box-label { color: #B9B09A; font-size: 8px; }
.mn-box-value { color: #EED98A; font-size: clamp(14px, 2.4vh, 20px); line-height: 1.3; }
.mn-progress { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.mn-dots { display: flex; gap: 5px; }
.mn-dot { width: 13px; height: 13px; border: 2px solid #EED98A; background: rgba(14,18,26,.7); }
.mn-dot.is-done { background: #EED98A; }
.mn-dot.is-zero { background: #5C5547; border-color: #8D846F; }
.mn-dot.is-now { background: #7BC9A0; }
.mn-progress-label { color: #E6DFCC; font-size: 8px; text-align: center; }
.mn-progress-label em { font-style: normal; color: #1C1410; background: #EED98A; padding: 1px 5px; margin-left: 6px; }
.mn-sound { justify-self: end; }

.mn-main { width: 100%; min-height: 0; position: relative; display: grid; grid-template-columns: minmax(0, 1fr); }
.mn-centre { min-height: 0; display: flex; flex-direction: column; align-items: center; }
.mn-card { width: min(100%, 640px); padding: clamp(12px, 2.2vh, 24px) clamp(14px, 2vw, 24px); }
.mn-kicker { color: #FF8FA3; font-size: 9px; }
.mn-prompt { margin: 1vh 0 .4vh; color: #F3EEDF; font-size: clamp(24px, 4.4vh, 40px); text-wrap: balance; }
.mn-hint { margin: 0; color: #B9B09A; font-size: clamp(16px, 2.4vh, 20px); }
.mn-h2 { margin: 0; color: #EED98A; font-size: clamp(12px, 2vh, 17px); line-height: 1.6; }
.mn-p { margin: 1vh 0 0; color: #E6DFCC; font-size: clamp(17px, 2.6vh, 21px); }

.mn-result { text-align: center; }
.mn-result-icon { display: flex; justify-content: center; animation: mn-pop .5s steps(5, end) 1; }
@keyframes mn-pop { 0% { transform: scale(.3); } 70% { transform: scale(1.18); } 100% { transform: scale(1); } }
.mn-tier-name { margin-top: .8vh; color: #EED98A; font-size: clamp(13px, 2.4vh, 22px); text-shadow: 2px 2px 0 #0B0E13; }
.mn-points { display: inline-block; margin-top: .8vh; padding: 4px 12px; background: #EED98A; color: #1C1410; font-size: clamp(12px, 2vh, 16px); border: 3px solid #0B0E13; }
.mn-points.is-zero { background: #8D846F; }
.mn-line { margin: .8vh 0 0; color: #E6DFCC; font-size: clamp(17px, 2.5vh, 21px); }
.mn-line a, .mn-answers a, .mn-link { color: #EED98A; text-decoration: underline; text-underline-offset: 3px; }

/* the compact right panel: today's seven and the scores */
.mn-side { display: none; position: absolute; top: 0; right: 0; width: 200px; flex-direction: column; gap: 10px; }
@media (min-width: 1200px) { .mn-side { display: flex; } }
.mn-side .mn-panel { padding: 10px 12px; }
.mn-side h2 { margin: 0 0 8px; color: #EED98A; font-size: 9px; }
.mn-mini { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; }
.mn-mini li { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 7px; align-items: center; color: #E6DFCC; font-size: 16px; }
.mn-mini li span { overflow-wrap: anywhere; }
.mn-mini .mn-px { color: #EED98A; font-size: 8px; }
.mn-mini .mn-num { width: 20px; height: 20px; border: 2px solid rgba(238,217,138,.6); display: flex; align-items: center; justify-content: center; font-size: 8px; color: #E6DFCC; }
.mn-mini .mn-num.is-now { background: #7BC9A0; color: #0B0E13; border-color: #7BC9A0; }
.mn-mini .is-muted { color: #8D846F; }

/* the answer bar */
.mn-bar-zone { width: min(100%, 720px); justify-self: center; position: relative; z-index: 2; }
.mn-answer-row { display: flex; gap: 8px; align-items: stretch; }
.mn-timer { width: 54px; height: 54px; flex: none; border-radius: 50%; border: 3px solid rgba(238,217,138,.35); background: rgba(12,16,23,.92);
  display: flex; align-items: center; justify-content: center; color: #EED98A; font-size: 13px; position: relative; }
.mn-timer svg { position: absolute; inset: -3px; transform: rotate(-90deg); }
.mn-timer.is-low { color: #FF8FA3; animation: mn-blink 1s steps(2, end) infinite; }
@keyframes mn-blink { 50% { opacity: .55; } }
.mn-input { flex: 1; min-width: 0; height: 54px; padding: 0 14px; border: 3px solid #EED98A; border-radius: 0; outline: none;
  background: rgba(12,16,23,.94); color: #F3EEDF; font-size: 26px; }
.mn-input::placeholder { color: #8D846F; }
.mn-input:focus { box-shadow: 0 0 0 3px rgba(238,217,138,.35); }
.mn-bubble { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%); width: max-content; max-width: 100%; padding: 7px 14px; text-align: center; animation: mn-pop .3s steps(3, end) 1; }
.mn-bubble .mn-tx { font-size: 21px; color: #F3EEDF; }
.mn-bubble .mn-tx b { color: #7BC9A0; font-weight: 400; }
.mn-bubble .mn-px { font-size: 8px; color: #B9B09A; margin-top: 3px; }
.mn-msg { position: absolute; left: 0; right: 0; bottom: calc(100% + 6px); margin: 0; text-align: center; color: #FF8FA3; font-size: 20px; text-shadow: 1px 1px 0 #0B0E13; }
@keyframes mn-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.mn-shake { animation: mn-shake 240ms steps(4, end) 1; }
.mn-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.mn-row.is-center { justify-content: center; }

.mn-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; min-height: 48px;
  background: #FF8FA3; color: #1C1410; border: 3px solid #0B0E13; box-shadow: 4px 4px 0 #0B0E13; border-radius: 0; outline: none;
  cursor: pointer; font-size: 10px; text-decoration: none; transition: transform 80ms steps(2, end), box-shadow 80ms steps(2, end); }
.mn-btn:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 #0B0E13; }
.mn-btn:focus-visible { box-shadow: 0 0 0 3px #EED98A, 4px 4px 0 #0B0E13; }
.mn-btn:disabled { opacity: .5; cursor: default; }
.mn-btn.is-gold { background: #EED98A; }
.mn-btn.is-ghost { background: rgba(12,16,23,.9); color: #F3EEDF; border-color: #EED98A; }
.mn-btn.is-small { min-height: 34px; font-size: 8px; padding: 0 10px; box-shadow: 3px 3px 0 #0B0E13; }
.mn-btn.is-wide { width: 100%; min-height: 54px; font-size: 12px; }
.mn-btn.is-icon { min-height: 34px; width: 38px; padding: 0; font-size: 10px; }

/* summary: fills the middle and scrolls inside, so the page itself never scrolls */
.mn-summary { width: min(100%, 760px); height: 100%; overflow-y: auto; padding: clamp(14px, 2.4vh, 26px); text-align: center; overscroll-behavior: contain; }
.mn-total { color: #EED98A; font-size: clamp(30px, 6vh, 56px); line-height: 1.2; margin-top: 1vh; }
.mn-total small { color: #B9B09A; font-size: .3em; }
.mn-icons { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin: 1.6vh 0 4px; }
.mn-icons figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.mn-icons figcaption { color: #B9B09A; font-size: 8px; }
.mn-countdown { margin-top: 1.4vh; color: #7BC9A0; font-size: 9px; }
.mn-answers { text-align: left; margin-top: 2.4vh; }
.mn-answers-head { display: flex; align-items: baseline; gap: 10px; color: #B9B09A; font-size: 8px; padding-bottom: 8px; border-bottom: 2px dashed rgba(238,217,138,.3); }
.mn-answers-head b { color: #EED98A; font-weight: 400; }
.mn-round { border-bottom: 2px dashed rgba(238,217,138,.18); }
.mn-round-btn { width: 100%; display: grid; grid-template-columns: 20px 30px minmax(0, 1fr) auto 14px; gap: 10px; align-items: center;
  padding: 10px 4px; background: none; border: 0; outline: none; cursor: pointer; text-align: left; color: inherit; }
.mn-round-btn:focus-visible { box-shadow: inset 0 0 0 2px #EED98A; }
.mn-round-n { color: #8D846F; font-size: 8px; }
.mn-round-q { display: block; color: #B9B09A; font-size: 16px; overflow-wrap: anywhere; }
.mn-round-a { display: block; color: #F3EEDF; font-size: 22px; overflow-wrap: anywhere; }
.mn-round-pts { color: #EED98A; font-size: 9px; }
.mn-round-chev { color: #EED98A; font-size: 9px; transition: transform .2s steps(2, end); }
.mn-round.is-open .mn-round-chev { transform: rotate(90deg); }
.mn-round-body { padding: 0 4px 12px 30px; }
.mn-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.mn-filter { padding: 6px 9px; border: 2px solid rgba(238,217,138,.45); background: rgba(14,18,26,.7); color: #E6DFCC; font-size: 7px; cursor: pointer; outline: none; border-radius: 0; }
.mn-filter.is-on { border-color: #EED98A; background: #EED98A; color: #1C1410; }
.mn-filter:focus-visible { box-shadow: 0 0 0 2px #7BC9A0; }
.mn-search { width: 100%; margin-top: 10px; height: 40px; padding: 0 12px; border: 2px solid rgba(238,217,138,.45); border-radius: 0; outline: none;
  background: rgba(10,14,20,.9); color: #F3EEDF; font-size: 21px; }
.mn-search:focus { border-color: #EED98A; }
.mn-list { list-style: none; margin: 10px 0 0; padding: 0 6px 0 0; max-height: 300px; overflow-y: auto; }
.mn-list li { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; gap: 10px; align-items: start; padding: 6px 0; border-bottom: 1px solid rgba(238,217,138,.1); }
.mn-list li.is-mine { background: rgba(238,217,138,.14); }
.mn-list .mn-a { color: #F3EEDF; font-size: 20px; overflow-wrap: anywhere; }
.mn-list .mn-note { display: block; color: #B9B09A; font-size: 16px; overflow-wrap: anywhere; }
.mn-list .mn-px { color: #EED98A; font-size: 8px; padding-top: 4px; }
.mn-list-foot { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; color: #8D846F; font-size: 7px; }

/* while the placard grows: the answer shows, the score doesn't */
.mn-growing { text-align: center; }
.mn-grow-answer { margin: 1.2vh 0 0; color: #F3EEDF; font-size: clamp(28px, 5vh, 44px); overflow-wrap: anywhere; }
.mn-grow-dots { margin-top: .6vh; color: #EED98A; font-size: 22px; letter-spacing: .4em; }
.mn-grow-dots span { animation: mn-dot 1.2s steps(2, end) infinite; }
.mn-grow-dots span:nth-child(2) { animation-delay: .2s; }
.mn-grow-dots span:nth-child(3) { animation-delay: .4s; }
@keyframes mn-dot { 0%, 100% { opacity: .2; } 50% { opacity: 1; } }
.mn-btn.is-waiting { cursor: default; background: repeating-linear-gradient(45deg, #EED98A 0 12px, #E2CB74 12px 24px); background-size: 34px 34px; animation: mn-stripes .8s linear infinite; }
@keyframes mn-stripes { to { background-position: 34px 0; } }

/* the "add it to Gavelling?" pop-up after naming a conference that isn't listed */
.mn-modal-back { position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(5,8,12,.62); }
.mn-modal { position: relative; width: min(100%, 470px); padding: 30px 22px 22px; text-align: center; animation: mn-pop .35s steps(4, end) 1; }
.mn-modal-x { position: absolute; top: -16px; right: -16px; width: 36px; height: 36px; border: 3px solid #0B0E13; background: #EED98A; color: #1C1410; font-size: 11px; cursor: pointer; outline: none; box-shadow: 3px 3px 0 #0B0E13; }
.mn-modal-x:focus-visible { box-shadow: 0 0 0 3px #7BC9A0; }
.mn-modal-plus { position: absolute; top: -34px; left: 50%; transform: translateX(-50%); width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;
  background: #7BC9A0; color: #0B0E13; border: 3px solid #0B0E13; box-shadow: 4px 4px 0 #0B0E13; font-family: var(--font-pixel), monospace; font-size: 30px; line-height: 1; animation: mn-throb 1.4s steps(2, end) infinite; }
@keyframes mn-throb { 50% { transform: translateX(-50%) scale(1.12); } }
.mn-gold { color: #EED98A; font-weight: 400; }

/* "Add <name>" on the end screen */
.mn-add-cta { margin: 4px 0 10px 30px; display: flex; flex-wrap: wrap; gap: 8px; }
.mn-add-big { display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; background: #7BC9A0; color: #0B0E13; border: 3px solid #0B0E13; box-shadow: 4px 4px 0 #0B0E13;
  cursor: pointer; outline: none; font-size: 20px; text-align: left; }
.mn-add-big:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 #0B0E13; }
.mn-add-big:focus-visible { box-shadow: 0 0 0 3px #EED98A, 4px 4px 0 #0B0E13; }
.mn-add-big .mn-add-plus { width: 34px; height: 34px; flex: none; display: flex; align-items: center; justify-content: center; background: #0B0E13; color: #7BC9A0; font-family: var(--font-pixel), monospace; font-size: 18px; }

@media (max-width: 640px) {
  .mn-hud { grid-template-columns: auto 1fr auto; gap: 6px; }
  .mn-box { min-width: 64px; padding: 4px 8px; }
  .mn-dot { width: 10px; height: 10px; }
  .mn-timer { width: 48px; height: 48px; }
  .mn-input { height: 48px; font-size: 22px; }
  .mn-btn.is-wide { min-height: 48px; }
}
@media (max-height: 640px) {
  .mn-tagline { display: none; }
  .mn-hint { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .mn-mote, .mn-bob, .mn-timer.is-low, .mn-shake, .mn-bg, .mn-halo, .mn-shakeit, .mn-bit { animation: none; }
}
`;
