/**
 * The gavel knock, synthesised with the Web Audio API. No audio file, no download.
 *
 * One strike on a hardwood sound block is three layers, all enveloped with a ~1.5 ms
 * attack and an exponential decay:
 *   1. CRACK  - a 45 ms white-noise burst, high-passed at 700 Hz and band-passed around
 *               2.4 kHz. This is the contact of the gavel head on the block.
 *   2. BODY   - three damped sine partials (190 / 440 / 1040 Hz) that each glide down ~6 %
 *               in the first 20 ms and die in 200 / 130 / 70 ms. Inharmonic, short and
 *               falling in pitch, so it reads as wood and never as a beep.
 *   3. THUMP  - a 70 ms burst of low-passed (320 Hz) noise, the weight of the head.
 * Two strikes 180 ms apart (the second slightly softer and lower) is what makes it
 * unmistakably a gavel. Everything runs through a master gain and a hard limiter, so
 * the level is moderate and can never clip.
 *
 * Browsers refuse to start audio without a user gesture, so ONE shared AudioContext is
 * created and resumed from a gesture (`primeGavelAudio`, driven by
 * `retainGavelAudioUnlock` on the chair page and by the Settings "Test sound" button).
 * A knock fired later from a timer reuses that context. If audio was never unlocked, or
 * is unavailable, every call is a silent no-op.
 */

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let output: AudioNode | null = null;
let noise: AudioBuffer | null = null;
let lastKnockAt = 0;

/** The bounds of the "knock at N seconds" setting. */
export const GAVEL_MIN_SECONDS = 1;
export const GAVEL_MAX_SECONDS = 600;
export const GAVEL_DEFAULT_SECONDS = 15;

/** Clamp any stored or typed value to a whole number of seconds in 1..600. */
export function clampGavelSeconds(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return GAVEL_DEFAULT_SECONDS;
  return Math.min(GAVEL_MAX_SECONDS, Math.max(GAVEL_MIN_SECONDS, Math.round(n)));
}

function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function buildOutput(c: AudioContext): AudioNode {
  // Master level, then a brick-wall-ish limiter. Worst case the layers sum to about 2.4,
  // so through the 0.42 master they can touch full scale; the limiter (threshold -8 dB,
  // ratio 20) is what keeps the output near 0.7 and makes clipping impossible.
  const master = c.createGain();
  master.gain.value = 0.42;
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.12;
  master.connect(limiter);
  limiter.connect(c.destination);
  return master;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const len = Math.floor(c.sampleRate * 0.1);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

/** Attack to `peak` in 1.5 ms, exponential decay to silence by `t + decay`. */
function envelope(c: AudioContext, t: number, peak: number, decay: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  return g;
}

function noiseLayer(c: AudioContext, out: AudioNode, t: number, filters: BiquadFilterNode[], peak: number, decay: number) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const env = envelope(c, t, peak, decay);
  let node: AudioNode = src;
  for (const f of filters) { node.connect(f); node = f; }
  node.connect(env);
  env.connect(out);
  src.onended = () => { try { src.disconnect(); filters.forEach((f) => f.disconnect()); env.disconnect(); } catch { /* already gone */ } };
  src.start(t);
  src.stop(t + decay + 0.02);
}

function filter(c: AudioContext, type: BiquadFilterType, freq: number, q = 0.707): BiquadFilterNode {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

// [frequency Hz, peak gain, decay seconds]
const BODY: [number, number, number][] = [
  [190, 0.5, 0.2],
  [440, 0.34, 0.13],
  [1040, 0.16, 0.07],
];

function strike(c: AudioContext, out: AudioNode, t: number, level: number, pitch: number) {
  // 1. crack
  noiseLayer(c, out, t, [filter(c, 'highpass', 700), filter(c, 'bandpass', 2400 * pitch, 0.9)], 0.9 * level, 0.045);
  // 3. thump
  noiseLayer(c, out, t, [filter(c, 'lowpass', 320 * pitch)], 0.5 * level, 0.07);
  // 2. body
  for (const [f, peak, decay] of BODY) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * pitch * 1.06, t);
    osc.frequency.exponentialRampToValueAtTime(f * pitch, t + 0.02);
    const env = envelope(c, t, peak * level, decay);
    osc.connect(env);
    env.connect(out);
    osc.onended = () => { try { osc.disconnect(); env.disconnect(); } catch { /* already gone */ } };
    osc.start(t);
    osc.stop(t + decay + 0.02);
  }
}

function knockNow(c: AudioContext) {
  if (!output) output = buildOutput(c);
  const t = c.currentTime + 0.01;
  strike(c, output, t, 1, 1);
  strike(c, output, t + 0.18, 0.82, 0.985);
}

/**
 * Create (once) and resume the shared AudioContext. Call ONLY from a user gesture
 * handler: that is what the browser needs to let a later, gesture-less knock play.
 */
export function primeGavelAudio(): void {
  try {
    if (!ctx) {
      const C = audioCtor();
      if (!C) return;
      ctx = new C();
      output = buildOutput(ctx);
    }
    if (ctx.state !== 'running') void ctx.resume().catch(() => { /* not allowed yet */ });
  } catch {
    /* audio unavailable: stay silent */
  }
}

/**
 * Play the double knock. Silent when audio was never unlocked or is unavailable.
 *
 * A suspended context is resumed, and the knock plays only if that succeeds within
 * 400 ms: otherwise a knock requested now could sound much later, at the next click.
 * Two knocks within 700 ms collapse into one, so two countdowns reaching their mark on
 * the same tick never double up.
 */
export function playGavelKnock(): void {
  try {
    const c = ctx;
    if (!c) return;
    const now = Date.now();
    if (now - lastKnockAt < 700) return;
    lastKnockAt = now;
    if (c.state === 'running') { knockNow(c); return; }
    const asked = now;
    c.resume()
      .then(() => { if (c.state === 'running' && Date.now() - asked < 400) knockNow(c); })
      .catch(() => { /* not allowed yet */ });
  } catch {
    /* audio unavailable: stay silent */
  }
}

// ── Gesture unlock, reference-counted ────────────────────────────────────────
// The listeners exist only while some mounted component wants the knock (the chair
// page, while this device is the Moderator), so leaving the page removes them.
let unlockRefs = 0;
const onGesture = () => {
  if (ctx && ctx.state === 'running') return;
  primeGavelAudio();
};

/** Install the first-gesture unlock listeners; returns the release function. */
export function retainGavelAudioUnlock(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (unlockRefs++ === 0) {
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--unlockRefs === 0) {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
    }
  };
}
