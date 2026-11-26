// The /games look: Gavelling's ivory, forest and gold drawn as pixel art
// (thick ink borders, hard offset shadows, stepped motion). Plain CSS so the
// server page can inline it before the game hydrates.

export const MUNILLION_CSS = `
.mn-page {
  background-color: #EDE7D8;
  background-image: radial-gradient(rgba(27,56,40,.10) 1px, transparent 1px);
  background-size: 12px 12px;
  color: #1C1410;
}
.mn-header { text-align: center; padding: clamp(20px, 3vw, 40px) 16px 4px; }
.mn-title {
  font-family: var(--font-pixel), monospace; font-weight: 700;
  font-size: clamp(40px, 6.4vw, 84px); line-height: 1; letter-spacing: .03em; margin: 0;
  color: #1B3828; text-shadow: 4px 4px 0 #EED98A, 8px 8px 0 rgba(27,56,40,.16);
}
.mn-tagline {
  font-family: var(--font-pixel-body), sans-serif; color: #4A3F36;
  font-size: clamp(15px, 1.3vw, 19px); margin: 14px auto 0; max-width: 52ch; text-wrap: balance;
}
.mn-skeleton { height: 62vh; margin: 24px clamp(16px, 2.4vw, 32px); background: rgba(27,56,40,.07); }

.mn-wrap {
  display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(16px, 2vw, 28px);
  padding: clamp(16px, 2.4vw, 32px);
}
@media (min-width: 1024px) {
  .mn-wrap { grid-template-columns: minmax(220px, 25%) minmax(0, 1fr) minmax(240px, 24%); align-items: start; }
  .mn-scene-col { position: sticky; top: 88px; }
}

.mn-frame { border: 3px solid #1C1410; box-shadow: 6px 6px 0 #1B3828; background: #FBF7EC; }
.mn-scene-frame { border: 3px solid #1C1410; box-shadow: 6px 6px 0 #1B3828; background: #EFE7D4; overflow: hidden; height: 230px; }
.mn-scene-frame svg { width: 100%; height: 100%; }
@media (min-width: 1024px) { .mn-scene-frame { height: min(calc(100vh - 150px), 780px); } }

.mn-card { background: #FBF7EC; border: 3px solid #1C1410; box-shadow: 6px 6px 0 #1B3828; padding: clamp(18px, 2.6vw, 36px); }
.mn-hud { display: flex; align-items: stretch; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.mn-box { border: 3px solid #1C1410; background: #FBF7EC; padding: 8px 12px; min-width: 92px; }
.mn-box-label { font-family: var(--font-pixel), monospace; font-size: 11px; color: #4A3F36; letter-spacing: .06em; }
.mn-box-value { font-family: var(--font-pixel), monospace; font-size: 26px; color: #1B3828; line-height: 1.15; }
.mn-progress { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.mn-dots { display: flex; gap: 6px; }
.mn-dot { width: 16px; height: 16px; border: 3px solid #1C1410; background: #FBF7EC; }
.mn-dot.is-done { background: #1B3828; }
.mn-dot.is-zero { background: #CFC5AE; }
.mn-dot.is-now { background: #EED98A; }
.mn-progress-label { font-family: var(--font-pixel), monospace; font-size: 11px; color: #4A3F36; letter-spacing: .06em; }

.mn-kicker { font-family: var(--font-pixel), monospace; font-size: 13px; letter-spacing: .06em; color: #1B3828; }
.mn-prompt {
  font-family: var(--font-pixel-body), sans-serif; font-weight: 600; color: #1C1410;
  font-size: clamp(26px, 2.9vw, 40px); line-height: 1.18; margin: 10px 0 8px; text-wrap: balance;
}
.mn-hint { font-family: var(--font-pixel-body), sans-serif; color: #4A3F36; font-size: 17px; margin: 0; }
.mn-h2 { font-family: var(--font-pixel), monospace; font-weight: 700; font-size: clamp(22px, 2.4vw, 32px); color: #1B3828; margin: 0; line-height: 1.15; }
.mn-p { font-family: var(--font-pixel-body), sans-serif; color: #4A3F36; font-size: 17px; line-height: 1.45; margin: 10px 0 0; }

.mn-answer-row { display: flex; gap: 10px; margin-top: 26px; align-items: stretch; }
.mn-timer {
  width: 64px; flex: none; border: 3px solid #1C1410; background: #FBF7EC;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-pixel), monospace; font-size: 24px; color: #1B3828;
}
.mn-timer.is-low { background: #EED98A; animation: mn-blink 1s steps(2, end) infinite; }
@keyframes mn-blink { 50% { background: #FBF7EC; } }
.mn-input {
  flex: 1; min-width: 0; border: 3px solid #1C1410; background: #FFFFFF; color: #1C1410;
  font-family: var(--font-pixel-body), sans-serif; font-size: 20px; padding: 12px 14px; outline: none; border-radius: 0;
}
.mn-input:focus { box-shadow: inset 0 0 0 3px #EED98A; }
.mn-bar { height: 14px; border: 3px solid #1C1410; background: #FBF7EC; margin-top: 12px; }
.mn-bar > span { display: block; height: 100%; background: #1B3828; transition: width 200ms steps(2, end); }
.mn-msg { font-family: var(--font-pixel-body), sans-serif; font-size: 17px; color: #1C1410; min-height: 26px; margin-top: 12px; }
@keyframes mn-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.mn-shake { animation: mn-shake 240ms steps(4, end) 1; }
.mn-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 16px; }
.mn-row.is-center { justify-content: center; }

.mn-btn {
  font-family: var(--font-pixel), monospace; font-size: 15px; letter-spacing: .03em; line-height: 1.2;
  background: #1B3828; color: #FBF7EC; border: 3px solid #1C1410; box-shadow: 4px 4px 0 #1C1410;
  padding: 12px 18px; cursor: pointer; border-radius: 0; outline: none;
  display: inline-flex; align-items: center; gap: 8px;
  transition: transform 80ms steps(2, end), box-shadow 80ms steps(2, end);
}
.mn-btn:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 #1C1410; }
.mn-btn:focus-visible { box-shadow: 0 0 0 3px #EED98A, 4px 4px 0 #1C1410; }
.mn-btn:disabled { opacity: .55; cursor: default; }
.mn-btn.is-ghost { background: #FBF7EC; color: #1C1410; }
.mn-btn.is-gold { background: #EED98A; color: #1C1410; }
.mn-btn.is-small { font-size: 12px; padding: 8px 12px; box-shadow: 3px 3px 0 #1C1410; }
.mn-link { font-family: var(--font-pixel-body), sans-serif; font-weight: 700; color: #1B3828; text-decoration: underline; text-underline-offset: 3px; background: none; border: 0; padding: 0; cursor: pointer; font-size: inherit; outline: none; }

.mn-result { text-align: center; }
.mn-result-icon { display: flex; justify-content: center; margin: 2px 0 14px; animation: mn-pop 420ms steps(5, end) 1; }
@keyframes mn-pop { 0% { transform: scale(.4); } 70% { transform: scale(1.12); } 100% { transform: scale(1); } }
.mn-tier-name { font-family: var(--font-pixel), monospace; font-weight: 700; font-size: clamp(24px, 3vw, 38px); color: #1B3828; line-height: 1.1; }
.mn-points { display: inline-block; margin-top: 12px; padding: 4px 12px; border: 3px solid #1C1410; background: #EED98A; font-family: var(--font-pixel), monospace; font-size: 18px; }
.mn-points.is-zero { background: #CFC5AE; }
.mn-label { font-family: var(--font-pixel-body), sans-serif; font-weight: 600; font-size: 24px; margin-top: 16px; overflow-wrap: anywhere; }
.mn-sub { font-family: var(--font-pixel-body), sans-serif; font-size: 16px; color: #4A3F36; overflow-wrap: anywhere; margin-top: 2px; }
.mn-label a, .mn-answers a, .mn-today a { color: #1B3828; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }

.mn-side { display: grid; gap: 16px; }
.mn-h3 { font-family: var(--font-pixel), monospace; font-weight: 700; font-size: 14px; letter-spacing: .04em; color: #1B3828; margin: 0 0 12px; }
.mn-today, .mn-legend { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.mn-today li, .mn-legend li { display: flex; gap: 10px; align-items: center; font-family: var(--font-pixel-body), sans-serif; font-size: 15px; line-height: 1.3; }
.mn-today li span, .mn-legend li span { overflow-wrap: anywhere; }
.mn-numsq { width: 28px; height: 28px; flex: none; border: 3px solid #1C1410; background: #FBF7EC; display: flex; align-items: center; justify-content: center; font-family: var(--font-pixel), monospace; font-size: 11px; }
.mn-numsq.is-now { background: #EED98A; }
.mn-muted { color: #6B5F54; }
.mn-pts { font-family: var(--font-pixel), monospace; font-size: 12px; color: #1B3828; margin-left: auto; flex: none; }

.mn-total { font-family: var(--font-pixel), monospace; font-weight: 700; font-size: clamp(48px, 7vw, 92px); color: #1B3828; line-height: 1; }
.mn-total small { font-size: .32em; color: #4A3F36; font-weight: 400; }
.mn-icons { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin: 20px 0 6px; }
.mn-icons figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; font-family: var(--font-pixel), monospace; font-size: 10px; color: #4A3F36; }
.mn-countdown { font-family: var(--font-pixel), monospace; font-size: 14px; color: #1B3828; margin-top: 18px; }

.mn-answers { display: grid; gap: 16px; margin-top: 28px; }
@media (min-width: 1500px) { .mn-answers { grid-template-columns: 1fr 1fr; } }
.mn-answer-card { border: 3px solid #1C1410; background: #FFFFFF; padding: 16px 18px; }
.mn-answer-card h3 { font-family: var(--font-pixel-body), sans-serif; font-weight: 600; font-size: 19px; margin: 0 0 10px; line-height: 1.25; }
.mn-tier-row { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; align-items: start; padding: 9px 0; border-top: 2px dashed #DCD2BC; }
.mn-tier-row b { display: block; font-family: var(--font-pixel), monospace; font-size: 11px; letter-spacing: .04em; color: #1B3828; font-weight: 700; }
.mn-tier-row p { margin: 3px 0 0; font-family: var(--font-pixel-body), sans-serif; font-size: 15px; line-height: 1.45; overflow-wrap: anywhere; }
.mn-tier-row.is-mine { background: rgba(238,217,138,.28); }
.mn-preview { margin: 0 clamp(16px, 2.4vw, 32px); padding: 10px 14px; border: 3px solid #1C1410; background: #EED98A; font-family: var(--font-pixel), monospace; font-size: 12px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between; }

.mn-lift { transition: transform 900ms steps(9, end); }
@keyframes mn-wiggle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-4deg); } 75% { transform: rotate(4deg); } }
.mn-wiggle { animation: mn-wiggle 360ms steps(4, end) 1; }
@keyframes mn-speck { 0%, 100% { opacity: .15; } 50% { opacity: .9; } }
.mn-speck { animation: mn-speck 3.4s steps(4, end) infinite; }
@media (prefers-reduced-motion: reduce) {
  .mn-lift, .mn-bar > span { transition: none; }
  .mn-wiggle, .mn-speck, .mn-shake, .mn-result-icon, .mn-timer.is-low { animation: none; }
}
`;
