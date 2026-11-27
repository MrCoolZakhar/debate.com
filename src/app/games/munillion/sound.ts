'use client';

// MUNillion's sounds, synthesised with Web Audio (no files): chiptune square
// waves and a brassy "toot" in the spirit of Krillion's boat horn. Nothing
// plays until the player's first tap (browsers require a gesture), and a mute
// switch is remembered on this device.

const MUTE_KEY = 'gavelling-munillion-muted';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function soundMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setSoundMuted(muted: boolean) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
  if (master) master.gain.value = muted ? 0 : 0.5;
}

/** Call inside a click or key press: creates or resumes the audio context. */
export function unlockSound() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = soundMuted() ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* no audio on this device */ }
}

function ready(): AudioContext | null {
  if (!ctx || !master || soundMuted()) return null;
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const c = ready();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(master);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

function noise(start: number, dur: number, vol: number, lowpass = 900) {
  const c = ready();
  if (!c || !master) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(c.currentTime + start);
}

/** The horn: two detuned saws through a soft filter, with a little bend. */
export function playToot(start = 0, base = 147) {
  const c = ready();
  if (!c || !master) return;
  [base, base * 1.5].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.94, c.currentTime + start);
    o.frequency.linearRampToValueAtTime(f, c.currentTime + start + 0.06);
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(i ? 0.09 : 0.13, c.currentTime + start + 0.03);
    g.gain.setValueAtTime(i ? 0.09 : 0.13, c.currentTime + start + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + 0.42);
    o.connect(lp).connect(g).connect(master!);
    o.start(c.currentTime + start);
    o.stop(c.currentTime + start + 0.45);
  });
}

const SCALE = [262, 330, 392, 523, 659, 784, 1047, 1319];

/**
 * The placard growing (Krillion's descent, upside down): a long rising whistle under
 * climbing bubbly blips, lasting as long as the growth, so nobody can tell the score
 * before it stops. Returns a stop function.
 */
export function playRise(ms: number): () => void {
  const c = ready();
  if (!c || !master) return () => {};
  const dur = Math.max(0.4, ms / 1000);
  const o = c.createOscillator();
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  o.type = 'triangle';
  o.frequency.setValueAtTime(130, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(130 + dur * 160, c.currentTime + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 0.15);
  g.gain.setValueAtTime(0.06, c.currentTime + dur - 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(lp).connect(g).connect(master);
  o.start();
  o.stop(c.currentTime + dur + 0.05);
  // the blips speed up and climb as it grows
  let t = 0.05;
  let i = 0;
  while (t < dur - 0.05) {
    const f = 330 * Math.pow(2, (t / dur) * 2) * (i % 2 ? 1.25 : 1);
    tone(f, t, 0.05, 'square', 0.028);
    t += Math.max(0.07, 0.26 - (t / dur) * 0.19);
    i++;
  }
  return () => { try { o.stop(); } catch { /* already stopped */ } };
}

/** Passing an award on the climb: a bright ding that rises with each rung (1 to 5). */
export function playDing(rung: number) {
  const f = [523, 659, 784, 988, 1319][Math.max(0, Math.min(4, rung - 1))];
  tone(f, 0, 0.16, 'square', 0.07);
  tone(f * 2, 0.02, 0.22, 'triangle', 0.04);
}

/** A soft tick while the marker climbs; called more often the faster it moves. */
export function playClimbTick(pos: number) {
  tone(380 + pos * 120, 0, 0.025, 'square', 0.022);
}

/** Falling back short of the next award: a low thud. */
export function playThud() {
  tone(160, 0, 0.18, 'triangle', 0.12, 70);
  noise(0, 0.06, 0.18, 400);
}

/** The drumroll under a stall: fast snare hits that swell. Returns a stop function. */
export function startDrumroll(): () => void {
  const c = ready();
  if (!c || !master) return () => {};
  let stopped = false;
  let n = 0;
  const hit = () => {
    if (stopped) return;
    noise(0, 0.035, Math.min(0.22, 0.06 + n * 0.006), 2400);
    n++;
    timer = window.setTimeout(hit, 46);
  };
  let timer = window.setTimeout(hit, 0);
  return () => { stopped = true; window.clearTimeout(timer); };
}

/** The moment it stops: the toot, louder and higher for rarer answers, the fanfare for The Gavel. */
export function playReveal(tier: number) {
  if (tier <= 0) { playAbsent(); return; }
  const top = tier >= 100 ? 8 : tier >= 85 ? 6 : tier >= 60 ? 4 : tier >= 30 ? 3 : 2;
  for (let i = 0; i < top; i++) tone(SCALE[i], i * 0.045, 0.1, 'square', 0.06);
  playToot(top * 0.045 + 0.02, tier >= 85 ? 196 : tier >= 60 ? 175 : 147);
  if (tier >= 100) playGavel(top * 0.045 + 0.45);
}

/** The placard growing: a rising arpeggio as long as the score is good, then a toot. */
export function playGrow(tier: number) {
  const steps = tier >= 100 ? 8 : tier >= 85 ? 6 : tier >= 60 ? 5 : tier >= 30 ? 4 : 3;
  for (let i = 0; i < steps; i++) tone(SCALE[i], i * 0.07, 0.12, 'square', 0.07);
  tone(110, 0, steps * 0.07 + 0.1, 'triangle', 0.08, 220 + tier * 2);
  playToot(steps * 0.07 + 0.04, tier >= 85 ? 196 : 147);
  if (tier >= 100) playGavel(steps * 0.07 + 0.5);
}

/** The Gavel: a fanfare and three knocks. */
export function playGavel(start = 0) {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, start + i * 0.09, 0.22, 'square', 0.08));
  tone(1047, start + 0.4, 0.5, 'square', 0.07);
  tone(1319, start + 0.4, 0.5, 'triangle', 0.06);
  [0.95, 1.15, 1.35].forEach((t) => { noise(start + t, 0.08, 0.5, 600); tone(90, start + t, 0.1, 'sine', 0.2, 50); });
}

/** Absent: a sad slide down. */
export function playAbsent() {
  tone(330, 0, 0.28, 'triangle', 0.1, 277);
  tone(277, 0.3, 0.45, 'triangle', 0.1, 196);
}

/** Not on the list: a short buzz. */
export function playBuzz() {
  tone(110, 0, 0.16, 'square', 0.06, 98);
}

/** Autocorrect offered: two quick blips up. */
export function playSuggest() {
  tone(659, 0, 0.07, 'square', 0.05);
  tone(988, 0.08, 0.09, 'square', 0.05);
}

/** The last seconds of the clock. */
export function playTick(low = false) {
  tone(low ? 880 : 1320, 0, 0.04, 'square', 0.035);
}

/** A question opens. */
export function playStart() {
  playToot(0, 131);
  tone(392, 0.32, 0.08, 'square', 0.05);
  tone(523, 0.4, 0.12, 'square', 0.05);
}
