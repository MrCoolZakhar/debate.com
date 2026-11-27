'use client';

// MUNillion: seven MUN questions a day, 30 seconds each, the rarer the answer
// the more points (owner, 26 Nov 2026). The database keeps the clock and the
// score (munillion_open / _answer / _skip); this page only draws them, so a
// reload never resets a question's time and nobody can see the answers before
// they finish. Scores: 100 The Gavel, 85 Best Delegate, 60 Outstanding Delegate,
// 30 Honourable Mention, 10 Participation Certificate, 0 Absent.
//
// The stage fits one screen on every device. A pixel UN General Assembly hall
// sits behind it; a delegate's hand stands behind the panels, dimmed, holding a
// placard that shows what you type, and after every answer it GROWS with the
// score: fast, then slowing, swaying and twisting (a full spin for The Gavel).
// Sounds are synthesised chiptune (sound.ts). A near miss is autocorrected:
// the box fills with the answer the game means and submitting again confirms.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { ArmSprite, TierIcon } from '@/components/munillion/PixelArt';
import {
  ADD_CONFERENCE_HREF,
  MAX_POINTS,
  TIER_ORDER,
  conferenceHref,
  munAnswer,
  munConfAdd,
  munOpen,
  munResetPreview,
  munReveal,
  munSkip,
  munToday,
  shareText,
  tierMeta,
  type MunAnswerResult,
  type MunPlayAnswer,
  type MunQuestion,
  type MunReveal,
  type MunToday,
} from '@/lib/munillion';
import { isBlockedText } from '@/lib/munillionProfanity';
import RevealList from './RevealList';
import AddConferenceButton from './AddConferenceButton';
import {
  playBuzz, playReveal, playRise, playStart, playSuggest, playTick, setSoundMuted, soundMuted, unlockSound,
} from './sound';

type Phase = 'loading' | 'error' | 'nogame' | 'intro' | 'question' | 'growing' | 'result' | 'summary';

interface ResultView {
  position: number;
  tier: number;
  label: string | null;
  sub: string | null;
  slug: string | null;
  typed: string | null;
  reason: 'correct' | 'late' | 'skipped';
}

interface Bit { bx: string; by: string; br: string; c: string; delay: string }

// Fixed motes so the server and the browser draw the same thing.
const MOTES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  d: 11 + ((i * 7) % 9),
  delay: -((i * 13) % 17),
  x: (i % 2 ? 1 : -1) * (10 + ((i * 5) % 24)),
  paper: i % 3 === 0,
}));

const BURST_COLOURS = ['#EED98A', '#FF8FA3', '#7BC9A0', '#F3EEDF', '#5AC8FF'];

/** How big the hand stands for a score: 0.85 at zero, about 4 at a perfect 700 (it fills the hall behind the panels). */
function scaleFor(total: number): number {
  return 0.85 + Math.min(1, Math.max(0, total) / MAX_POINTS) * 3.2;
}

/** How long the placard keeps growing before the score shows: longer for rarer answers, so the wait builds. */
function growMs(tier: number): number {
  return tier >= 100 ? 4800 : tier >= 85 ? 3900 : tier >= 60 ? 3100 : tier >= 30 ? 2400 : tier > 0 ? 1700 : 1000;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function msToNextUtcMidnight(now: number): number {
  const d = new Date(now);
  return Math.max(0, Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now);
}

function hms(ms: number): string {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

function Countdown({ prefix }: { prefix: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <p className="mn-countdown mn-px">{prefix} {hms(msToNextUtcMidnight(now))}</p>;
}

/** Points that count up when a result lands. */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}

function firstOpenPosition(questions: MunQuestion[], answers: Record<number, MunPlayAnswer>): number {
  for (const q of questions) {
    const a = answers[q.position];
    if (!a || a.tier === null) return q.position;
  }
  return questions.length + 1;
}

function makeBurst(tier: number): Bit[] {
  const n = tier >= 100 ? 70 : tier >= 85 ? 44 : tier >= 60 ? 26 : tier >= 30 ? 14 : tier > 0 ? 6 : 0;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const r = 120 + Math.random() * (tier >= 85 ? 380 : 220);
    return {
      bx: `${Math.round(Math.cos(a) * r)}px`,
      by: `${Math.round(Math.sin(a) * r - 60)}px`,
      br: `${Math.round(Math.random() * 540 - 270)}deg`,
      c: BURST_COLOURS[i % BURST_COLOURS.length],
      delay: `${Math.round(Math.random() * 120)}ms`,
    };
  });
}

export default function MunillionGame({ header }: { header?: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [preview, setPreview] = useState<boolean | null>(null);
  const [today, setToday] = useState<MunToday | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [answers, setAnswers] = useState<Record<number, MunPlayAnswer>>({});
  const [total, setTotal] = useState(0);
  const [pos, setPos] = useState(1);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ typed: string; to: string } | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResultView | null>(null);
  const [reveal, setReveal] = useState<MunReveal | null>(null);
  const [muted, setMuted] = useState(false);
  const [growKey, setGrowKey] = useState(0);
  const [burst, setBurst] = useState<{ key: number; bits: Bit[]; flash: boolean; quake: boolean } | null>(null);
  const [confMisses, setConfMisses] = useState<string[]>([]);
  const [addPrompt, setAddPrompt] = useState<string | null>(null);
  const pendingRef = useRef<{ total: number; tier: number } | null>(null);
  const stopRiseRef = useRef<(() => void) | null>(null);
  const finishGrowRef = useRef<() => void>(() => {});
  const revealedAtRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const growRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const growTargetRef = useRef<{ total: number; tier: number }>({ total: 0, tier: 0 });
  const expiringRef = useRef(false);
  const tickRef = useRef(0);

  const questions = useMemo(() => today?.questions ?? [], [today]);
  const count = questions.length || 7;
  const q = questions.find((x) => x.position === pos) ?? null;
  const game = today?.game ?? null;

  // ?preview=1 plays the newest game, published or not (read here, not through useSearchParams, so the page renders on the server).
  useEffect(() => {
    setPreview(new URLSearchParams(window.location.search).get('preview') === '1');
    setMuted(soundMuted());
  }, []);

  // The hand stands at the size of the score already earned when the page loads (no animation).
  useEffect(() => {
    if (growKey !== 0 || !growRef.current) return;
    scaleRef.current = scaleFor(total);
    growRef.current.style.transform = `scale(${scaleRef.current})`;
  }, [total, growKey]);

  // After each answer the hand grows slowly with a rising sound and the score stays hidden until it stops
  // (owner, 26 Nov 2026: the wait is the point). It sways side to side as it grows; The Gavel spins it round.
  useEffect(() => {
    const el = growRef.current;
    if (!growKey || !el) return;
    const { total: target, tier } = growTargetRef.current;
    const a = scaleRef.current;
    const b = scaleFor(target);
    scaleRef.current = b;
    const ms = growMs(tier);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.style.transform = `scale(${b})`;
      stopRiseRef.current?.();
      stopRiseRef.current = null;
      finishGrowRef.current();
    };
    stopRiseRef.current = playRise(ms);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof el.animate !== 'function') {
      const id = window.setTimeout(finish, Math.min(ms, 900));
      return () => window.clearTimeout(id);
    }
    const frames: Keyframe[] = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      if (tier === 0) {
        const droop = Math.sin(p * Math.PI);
        frames.push({ transform: `scale(${a - (a - b) * p - droop * a * 0.12}) rotate(${Math.sin(p * Math.PI * 3) * 8 * (1 - p)}deg)` });
        continue;
      }
      // smootherstep: starts gently, picks up, then eases into the final size
      const e = p * p * p * (p * (p * 6 - 15) + 10);
      const sway = Math.sin(p * Math.PI * 4) * 7 * (1 - p * 0.7);
      const drift = Math.sin(p * Math.PI * 3) * 2.5 * (1 - p);
      const spin = tier >= 100 ? ` rotateY(${Math.round(e * 360)}deg)` : '';
      frames.push({ transform: `scale(${a + (b - a) * e})${spin} rotate(${sway}deg) translateX(${drift}%)` });
    }
    const anim = el.animate(frames, { duration: ms, easing: 'linear', fill: 'forwards' });
    anim.onfinish = () => { finish(); anim.cancel(); };
    const safety = window.setTimeout(finish, ms + 400);
    return () => { anim.onfinish = null; window.clearTimeout(safety); };
  }, [growKey]);

  // On phones the site's top bar, bottom tab bar and sale bar step aside while a game is in play (owner, 27 Nov 2026).
  useEffect(() => {
    const playing = phase === 'question' || phase === 'growing' || phase === 'result';
    const root = document.documentElement;
    root.classList.toggle('mn-playing', playing);
    return () => root.classList.remove('mn-playing');
  }, [phase]);

  // A big score shakes the hall for half a second (a class toggle, so nothing remounts).
  useEffect(() => {
    const el = stageRef.current;
    if (!burst?.quake || !el) return;
    el.classList.remove('mn-shakeit');
    void el.offsetWidth;
    el.classList.add('mn-shakeit');
    const id = window.setTimeout(() => el.classList.remove('mn-shakeit'), 600);
    return () => window.clearTimeout(id);
  }, [burst]);

  const startQuestion = useCallback((position: number, secondsLeft: number) => {
    expiringRef.current = false;
    tickRef.current = 0;
    setPos(position);
    setInput('');
    setMsg(null);
    setSuggestion(null);
    setResult(null);
    setConfMisses([]);
    setAddPrompt(null);
    setDeadline(Date.now() + Math.max(0, secondsLeft) * 1000);
    setNow(Date.now());
    setPhase('question');
  }, []);

  const loadReveal = useCallback(async (pv: boolean) => {
    setReveal(null);
    try {
      setReveal(await munReveal(pv));
    } catch (e) {
      notifyErr(friendlyError(e, "Couldn't load today's answers"));
    }
  }, []);

  const load = useCallback(async () => {
    if (preview === null) return;
    try {
      const t = await munToday(preview);
      setToday(t);
      if (!t.game) { setPhase('nogame'); return; }
      const map: Record<number, MunPlayAnswer> = {};
      for (const a of t.play?.answers ?? []) map[a.position] = a;
      setAnswers(map);
      setTotal(t.play?.total ?? 0);
      if (t.play?.finished) { setPhase('summary'); void loadReveal(preview); return; }
      const open = (t.play?.answers ?? []).find((a) => a.tier === null);
      if (open) { startQuestion(open.position, open.seconds_left ?? 0); return; }
      setPos(firstOpenPosition(t.questions ?? [], map));
      setPhase('intro');
    } catch (e) {
      setPhase('error');
      notifyErr(friendlyError(e, "Couldn't load today's game"));
    }
  }, [preview, startQuestion, loadReveal]);

  // Keyed on the user id: signing in re-reads (and the database moves this browser's games onto the account).
  useEffect(() => {
    if (authLoading || preview === null) return;
    void load();
  }, [authLoading, userId, preview, load]);

  const openQuestion = useCallback(async (position: number) => {
    if (preview === null) return;
    unlockSound();
    setBusy(true);
    try {
      const r = await munOpen(position, preview);
      if (!r.ok || r.answered) { await load(); return; }
      const fallback = questions.find((x) => x.position === position)?.seconds ?? 30;
      startQuestion(position, r.seconds_left ?? fallback);
      playStart();
    } catch (e) {
      notifyErr(friendlyError(e, "Couldn't open the next question"));
    } finally {
      setBusy(false);
    }
  }, [preview, load, questions, startQuestion]);

  const applyResult = useCallback((position: number, r: MunAnswerResult, reason: ResultView['reason'], typed: string | null) => {
    const tier = r.tier ?? 0;
    const newTotal = typeof r.total === 'number' ? r.total : total + tier;
    setAnswers((m) => ({
      ...m,
      [position]: { position, tier, typed, label: r.label ?? null, sub: r.sub ?? null, slug: r.slug ?? null, seconds_left: null },
    }));
    setSuggestion(null);
    setMsg(null);
    setResult({ position, tier, label: r.label ?? null, sub: r.sub ?? null, slug: r.slug ?? null, typed, reason });
    pendingRef.current = { total: newTotal, tier };
    growTargetRef.current = { total: newTotal, tier };
    setGrowKey((k) => k + 1);
    setPhase('growing');
  }, [total]);

  // The placard stopped growing: now the score shows, with the burst, the sound and (on the conference
  // question) the offer to add a conference that isn't on Gavelling.
  finishGrowRef.current = () => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    setTotal(p.total);
    setBurst({ key: Date.now(), bits: makeBurst(p.tier), flash: p.tier >= 100, quake: p.tier >= 85 });
    playReveal(p.tier);
    revealedAtRef.current = Date.now();
    setPhase('result');
    const kind = questions.find((x) => x.position === result?.position)?.kind;
    if (kind === 'conference' && confMisses.length) setAddPrompt(confMisses[confMisses.length - 1]);
  };

  const giveUp = useCallback(async (reason: 'late' | 'skipped') => {
    if (!q || preview === null) return;
    setBusy(true);
    try {
      const r = await munSkip(q.position, preview);
      if (!r.ok) { await load(); return; }
      applyResult(q.position, r, reason, null);
    } catch (e) {
      notifyErr(friendlyError(e, "Couldn't save that"));
    } finally {
      setBusy(false);
    }
  }, [q, preview, load, applyResult]);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || !q || preview === null) return;
    unlockSound();
    setBusy(true);
    try {
      const r = await munAnswer(q.position, text, preview);
      if (!r.ok) { await load(); return; }
      if (r.status === 'suggest' && r.suggestion) {
        setSuggestion({ typed: text, to: r.suggestion });
        setInput(r.suggestion);
        setMsg(null);
        playSuggest();
        window.setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      if (r.status === 'unknown') {
        setShake((s) => s + 1);
        setSuggestion(null);
        playBuzz();
        if (r.not_listed && !isBlockedText(text)) setConfMisses((m) => (m.some((x) => x.toLowerCase() === text.toLowerCase()) ? m : [...m, text]));
        if (r.reason === 'blocked') setMsg("Let's keep it clean. Try another answer");
        else if ((r.attempts_left ?? 1) <= 0) setMsg("That's every try for this one");
        else if (q.kind === 'conference') setMsg('Not on Gavelling yet. Try another, or add yours with the plus');
        else if (q.kind === 'number') setMsg('Type a resolution number, like 242');
        else setMsg('Not on the list. Try another before the clock runs out');
        window.setTimeout(() => inputRef.current?.select(), 0);
        return;
      }
      applyResult(q.position, r, r.status === 'late' ? 'late' : 'correct', text);
    } catch (e) {
      notifyErr(friendlyError(e, "Couldn't send that answer"));
    } finally {
      setBusy(false);
    }
  }, [input, busy, q, preview, load, applyResult]);

  const goNext = useCallback(async () => {
    if (!result || preview === null) return;
    const after = result.position + 1;
    if (after > count) {
      setPhase('summary');
      void loadReveal(preview);
      try { setToday(await munToday(preview)); } catch { /* the streak shows once the page is read again */ }
      return;
    }
    await openQuestion(after);
  }, [result, count, loadReveal, preview, openQuestion]);

  // The question clock (local drawing only; the database decides what counts).
  useEffect(() => {
    if (phase !== 'question') return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [phase]);

  const remainingMs = phase === 'question' ? Math.max(0, deadline - now) : 0;
  const remaining = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    if (phase !== 'question' || remaining > 5 || remaining <= 0 || tickRef.current === remaining) return;
    tickRef.current = remaining;
    playTick(remaining > 2);
  }, [phase, remaining]);

  useEffect(() => {
    if (phase !== 'question' || !deadline || remainingMs > 0 || expiringRef.current) return;
    expiringRef.current = true;
    void giveUp('late');
  }, [phase, deadline, remainingMs, giveUp]);

  useEffect(() => {
    if (phase === 'question') inputRef.current?.focus();
  }, [phase, pos]);

  // Enter moves on from a result.
  useEffect(() => {
    if (phase !== 'result' || addPrompt) return;
    const onKey = (e: KeyboardEvent) => {
      // a beat after the reveal first, so an Enter meant for the answer box never skips the result
      if (e.key === 'Enter' && !busy && Date.now() - revealedAtRef.current > 900) { e.preventDefault(); void goNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, busy, goNext, addPrompt]);

  const tiersInOrder = useMemo(() => questions.map((x) => answers[x.position]?.tier ?? null), [questions, answers]);

  const share = useCallback(async () => {
    if (!game) return;
    const text = shareText(game.number, total, tiersInOrder);
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      notifyOk('Copied. Paste it anywhere');
    } catch { /* the share sheet was closed */ }
  }, [game, total, tiersInOrder]);

  const resetMyPlay = useCallback(async () => {
    try {
      // Anyone may clear their own play of an unpublished game (the preview is not behind a staff account).
      const r = await munResetPreview();
      if (!r?.ok) { notifyErr("Couldn't reset your play"); return; }
      setReveal(null);
      setResult(null);
      setGrowKey(0);
      await load();
      notifyOk('Your play was reset');
    } catch (e) {
      notifyErr(friendlyError(e, "Couldn't reset your play"));
    }
  }, [load]);

  const toggleSound = useCallback(() => {
    unlockSound();
    setMuted((m) => { setSoundMuted(!m); return !m; });
  }, []);

  const signedIn = !!today?.signed_in;
  const streak = today?.streak ?? 0;
  const answeredCount = questions.filter((x) => answers[x.position] && answers[x.position].tier !== null).length;

  // ── the hand (behind everything) ──────────────────────────────────────────

  const placardText = (phase === 'result' || phase === 'growing') && result
    ? (result.tier > 0 || phase === 'growing' ? (result.label || result.typed || '...') : 'Absent')
    : phase === 'question' ? (isBlockedText(input) ? '****' : input.trim())
    : phase === 'intro' ? 'Ready?'
    : phase === 'summary' ? `${total} points`
    : phase === 'nogame' ? 'Soon' : '';
  const placardSmall = phase === 'result' && result ? tierMeta(result.tier).name : phase === 'growing' ? 'Raising' : phase === 'question' ? `Question ${pos}` : 'Delegate';

  const handLayer = (
    <>
      <div className={`mn-halo${phase === 'result' && (result?.tier ?? 0) >= 85 ? ' is-on' : ''}`} aria-hidden />
      <div className="mn-handlayer" aria-hidden>
        <div ref={growRef} className="mn-grower">
          <div className="mn-bob">
            <div className="mn-hand-fig">
              <div className={`mn-placard mn-tx${placardText ? '' : ' is-empty'}`}>
                <small className="mn-px">{placardSmall}</small>
                {placardText || 'Your answer'}
              </div>
              <div className="mn-arm"><ArmSprite size={84} /></div>
            </div>
          </div>
        </div>
      </div>
      <div className="mn-dim" aria-hidden />
    </>
  );

  // ── the panels ────────────────────────────────────────────────────────────

  const hud = (
    <div className="mn-hud">
      <div className="mn-panel mn-box">
        <div className="mn-box-label mn-px">Points</div>
        <div className="mn-box-value mn-px">{total}</div>
      </div>
      <div className="mn-progress">
        <div className="mn-dots" aria-hidden>
          {Array.from({ length: count }, (_, i) => {
            const p = i + 1;
            const a = answers[p];
            const done = a && a.tier !== null;
            const cls = done ? (a.tier === 0 ? 'is-zero' : 'is-done') : (phase === 'question' || phase === 'result') && p === pos ? 'is-now' : '';
            return <span key={p} className={`mn-dot ${cls}`} />;
          })}
        </div>
        <div className="mn-progress-label mn-px">
          {phase === 'summary' ? 'Done for today' : `Question ${Math.min(pos, count)} of ${count}`}
          {preview && game?.preview ? <em>Preview</em> : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="mn-panel mn-box" style={{ textAlign: 'right' }}>
          <div className="mn-box-label mn-px">Streak</div>
          <div className="mn-box-value mn-px">{streak}</div>
        </div>
        <button type="button" className="mn-btn mn-px is-ghost is-icon focus:outline-none" onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
          {muted ? <VolumeX size={16} strokeWidth={1.5} aria-hidden /> : <Volume2 size={16} strokeWidth={1.5} aria-hidden />}
        </button>
      </div>
    </div>
  );

  const side = (
    <aside className="mn-side" aria-label="Scoring">
      <div className="mn-panel">
        <h2 className="mn-px">Scoring</h2>
        <ul className="mn-mini">
          {TIER_ORDER.map((t) => (
            <li key={t} className="mn-tx">
              <TierIcon tier={t} size={20} label={tierMeta(t).name} />
              <span>{tierMeta(t).name}</span>
              <span className="mn-px">{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );

  const openAddConference = (name: string, choice: 'now' | 'later') => {
    // the tab opens inside the click, before anything is awaited (pop-up blockers)
    window.open(ADD_CONFERENCE_HREF, '_blank', 'noopener');
    void munConfAdd(name, choice).catch(() => {});
    setAddPrompt(null);
  };

  const addPopup = addPrompt ? (
    <div className="mn-modal-back" role="presentation" onClick={() => { void munConfAdd(addPrompt, 'dismiss').catch(() => {}); setAddPrompt(null); }}>
      <div className="mn-panel mn-modal" role="dialog" aria-modal="true" aria-labelledby="mn-add-title" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="mn-modal-x mn-px focus:outline-none"
          aria-label="Close"
          onClick={() => { void munConfAdd(addPrompt, 'dismiss').catch(() => {}); setAddPrompt(null); }}
        >
          X
        </button>
        <div className="mn-modal-plus" aria-hidden>+</div>
        <h2 id="mn-add-title" className="mn-h2 mn-px">Add It to Gavelling?</h2>
        <p className="mn-p mn-tx">
          You named <b className="mn-gold">{addPrompt}</b>, and it isn&apos;t on Gavelling yet. List it and every MUNillion player can name it tomorrow
        </p>
        <div className="mn-row is-center" style={{ marginTop: 16 }}>
          <button type="button" className="mn-btn mn-px is-gold focus:outline-none" onClick={() => openAddConference(addPrompt, 'now')}>Add now</button>
          <button type="button" className="mn-btn mn-px is-ghost focus:outline-none" onClick={() => openAddConference(addPrompt, 'later')}>Add later</button>
        </div>
      </div>
    </div>
  ) : null;

  let centre: ReactNode = null;
  let bar: ReactNode = null;

  if (phase === 'loading') {
    centre = <div className="mn-panel mn-card" aria-hidden style={{ minHeight: 120, opacity: 0.6 }} />;
  } else if (phase === 'error') {
    centre = (
      <div className="mn-panel mn-card">
        <h2 className="mn-h2 mn-px">Couldn&apos;t Load Today&apos;s Game</h2>
        <p className="mn-p mn-tx">Check your connection and try again</p>
      </div>
    );
    bar = <button type="button" className="mn-btn mn-px is-wide focus:outline-none" onClick={() => { setPhase('loading'); void load(); }}>Try again</button>;
  } else if (phase === 'nogame') {
    centre = (
      <div className="mn-panel mn-card">
        <h2 className="mn-h2 mn-px">The First MUNillion Is Almost Here</h2>
        <p className="mn-p mn-tx">Seven questions go live at midnight UTC. Come back and grow your placard</p>
        <Countdown prefix="Next check in" />
      </div>
    );
  } else if (phase === 'intro' && game) {
    const started = answeredCount > 0;
    centre = (
      <div className="mn-panel mn-card">
        <div className="mn-kicker mn-px">MUNillion #{game.number} · {formatDate(game.date)}</div>
        <h2 className="mn-h2 mn-px" style={{ marginTop: '1vh' }}>{started ? 'Pick Up Where You Left Off' : "Today's Seven Questions"}</h2>
        <p className="mn-p mn-tx">Thirty seconds each, one answer per question. Rare answers make your placard grow, and one answer on every list wins The Gavel</p>
        {!signedIn ? (
          <p className="mn-p mn-tx">
            <button type="button" className="mn-link mn-tx focus:outline-none" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 'inherit' }} onClick={() => openAuth({ next: '/games' })}>
              Sign in
            </button>{' '}to keep your streak on every device
          </p>
        ) : null}
      </div>
    );
    bar = (
      <button type="button" className="mn-btn mn-px is-wide focus:outline-none" disabled={busy} onClick={() => void openQuestion(pos)}>
        {started ? `Continue with question ${pos}` : "Start today's game"}
      </button>
    );
  } else if (phase === 'question' && q) {
    const pct = q.seconds > 0 ? Math.max(0, Math.min(1, remainingMs / (q.seconds * 1000))) : 0;
    centre = (
      <div className="mn-panel mn-card">
        <div className="mn-kicker mn-px">Question {q.position} of {count}</div>
        <h2 className="mn-prompt mn-tx">{q.prompt}</h2>
        {q.hint ? <p className="mn-hint mn-tx">{q.hint}</p> : null}
      </div>
    );
    bar = (
      <>
        {suggestion ? (
          <div className="mn-panel mn-bubble" role="status">
            <div className="mn-tx">Did you mean <b>&ldquo;{suggestion.to}&rdquo;</b>?</div>
            <div className="mn-px">Submit again to confirm, or edit</div>
          </div>
        ) : msg ? (
          <p className="mn-msg mn-tx" role="status" aria-live="polite">{msg}</p>
        ) : null}
        <form key={shake} className={`mn-answer-row${shake ? ' mn-shake' : ''}`} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className={`mn-timer mn-px${remaining <= 5 ? ' is-low' : ''}`} aria-label={`${remaining} seconds left`}>
            <svg viewBox="0 0 60 60" aria-hidden>
              <circle cx="30" cy="30" r="28.33" fill="none" stroke={remaining <= 5 ? '#FF8FA3' : '#EED98A'} strokeWidth="3.34" pathLength={100} strokeDasharray={`${pct * 100} 100`} />
            </svg>
            {remaining}
          </div>
          <input
            ref={inputRef}
            className="mn-input mn-tx"
            value={input}
            onChange={(e) => { setInput(e.target.value); if (msg) setMsg(null); if (suggestion) setSuggestion(null); }}
            placeholder={q.kind === 'number' ? 'A number' : 'Type one answer'}
            inputMode={q.kind === 'number' ? 'numeric' : 'text'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            maxLength={120}
            aria-label="Your answer"
          />
          <button type="submit" className="mn-btn mn-px focus:outline-none" disabled={busy || !input.trim()}>Raise</button>
        </form>
        <div className="mn-row is-center">
          <button type="button" className="mn-btn mn-px is-ghost is-small focus:outline-none" disabled={busy} onClick={() => void giveUp('skipped')}>Pass</button>
          {q.kind === 'conference' ? <AddConferenceButton /> : null}
        </div>
      </>
    );
  } else if (phase === 'growing' && result) {
    centre = (
      <div className="mn-panel mn-card mn-result mn-growing">
        <div className="mn-kicker mn-px">Question {result.position} of {count}</div>
        <p className="mn-grow-answer mn-tx">{result.reason === 'correct' ? (result.label || result.typed) : result.reason === 'late' ? 'Out of time' : 'Passed'}</p>
        <div className="mn-grow-dots mn-px" aria-label="Raising your placard"><span>.</span><span>.</span><span>.</span></div>
      </div>
    );
    bar = <div className="mn-btn mn-px is-wide is-waiting" aria-hidden>Raising your placard</div>;
  } else if (phase === 'result' && result) {
    const meta = tierMeta(result.tier);
    const resQ = questions.find((x) => x.position === result.position);
    const last = result.position >= count;
    centre = (
      <div key={`r-${result.position}`} className="mn-panel mn-card mn-result">
        <div className="mn-kicker mn-px">Question {result.position} of {count}</div>
        <div className="mn-result-icon" style={{ marginTop: '1vh' }}><TierIcon tier={result.tier} size={72} label={meta.name} /></div>
        <div className="mn-tier-name mn-px">{meta.name}</div>
        <div className={`mn-points mn-px${result.tier === 0 ? ' is-zero' : ''}`}>+<CountUp to={result.tier} /></div>
        <p className="mn-line mn-tx">
          {result.reason === 'late' ? 'Out of time' : result.reason === 'skipped' ? 'You passed on this one' : (
            <>
              {result.slug ? <><a href={conferenceHref(result.slug)} target="_blank" rel="noopener noreferrer">{result.label}</a>{result.sub ? ` · ${result.sub}` : ''}</> : null}
              {!result.slug ? `${result.label ?? ''}${result.sub ? ` · ${result.sub}` : ''}` : null}
              <br />{meta.line}
            </>
          )}
        </p>
      </div>
    );
    bar = (
      <div className="mn-row is-center" style={{ marginTop: 0 }}>
        <button type="button" className="mn-btn mn-px is-wide focus:outline-none" style={{ flex: 1 }} disabled={busy} onClick={() => void goNext()}>
          {last ? 'See your results' : 'Next question'}
        </button>
        {resQ?.kind === 'conference' ? <AddConferenceButton small={false} /> : null}
      </div>
    );
  } else if (phase === 'summary' && game) {
    centre = (
      <div className="mn-panel mn-summary">
        <div className="mn-kicker mn-px">MUNillion #{game.number} · {formatDate(game.date)}</div>
        <div className="mn-total mn-px">{total}<small> / {MAX_POINTS}</small></div>
        <p className="mn-p mn-tx" style={{ marginTop: 6 }}>{streak} day{streak === 1 ? '' : 's'} in a row</p>
        <div className="mn-icons">
          {questions.map((x) => {
            const t = answers[x.position]?.tier ?? 0;
            return (
              <figure key={x.position}>
                <TierIcon tier={t} size={34} label={`Question ${x.position}: ${tierMeta(t).name}`} />
                <figcaption className="mn-px">{t}</figcaption>
              </figure>
            );
          })}
        </div>
        <div className="mn-row is-center">
          <button type="button" className="mn-btn mn-px focus:outline-none" onClick={() => void share()}>Share your score</button>
          {!signedIn ? (
            <button type="button" className="mn-btn mn-px is-ghost focus:outline-none" onClick={() => openAuth({ next: '/games' })}>Sign in to save your streak</button>
          ) : (
            <Link className="mn-btn mn-px is-ghost focus:outline-none" href="/account/games">Your past games</Link>
          )}
          {preview && game.preview ? (
            <button type="button" className="mn-btn mn-px is-gold is-small focus:outline-none" onClick={() => void resetMyPlay()}>Reset my play</button>
          ) : null}
        </div>
        <Countdown prefix="Next game in" />
        <RevealList reveal={reveal} />
      </div>
    );
  }

  return (
    <div className="mn-stage" ref={stageRef}>
      <div className="mn-bg" aria-hidden />
      <div className="mn-shade" aria-hidden />
      <div className="mn-motes" aria-hidden>
        {MOTES.map((m, i) => (
          <span
            key={i}
            className={`mn-mote${m.paper ? ' is-paper' : ''}`}
            style={{ left: `${m.left}%`, '--d': `${m.d}s`, '--delay': `${m.delay}s`, '--x': `${m.x}px` } as CSSProperties}
          />
        ))}
      </div>
      {handLayer}
      {burst && burst.bits.length ? (
        <div className="mn-burst" key={burst.key} aria-hidden>
          {burst.bits.map((b, i) => (
            <span key={i} className="mn-bit" style={{ '--bx': b.bx, '--by': b.by, '--br': b.br, '--c': b.c, animationDelay: b.delay } as CSSProperties} />
          ))}
        </div>
      ) : null}
      {burst?.flash ? <div className="mn-flash" key={`f-${burst.key}`} aria-hidden /> : null}
      <div className="mn-scan" aria-hidden />

      <div>{phase === 'intro' || phase === 'nogame' || phase === 'loading' || phase === 'error' ? header : null}</div>
      {phase !== 'loading' ? hud : <div />}
      <div className="mn-main">
        <section className="mn-centre" aria-label="MUNillion">{centre}</section>
        {side}
      </div>
      <div className="mn-bar-zone">{bar}</div>
      {addPopup}
    </div>
  );
}
