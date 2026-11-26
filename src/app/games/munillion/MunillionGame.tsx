'use client';

// MUNillion: seven MUN questions a day, 30 seconds each, the rarer the answer
// the more points (owner, 26 Nov 2026). The database keeps the clock and the
// score (munillion_open / _answer / _skip); this page only draws them, so a
// reload never resets a question's time and nobody can see the answers before
// they finish. Scores: 100 The Gavel, 85 Best Delegate, 60 Outstanding Delegate,
// 30 Honourable Mention, 10 Participation Certificate, 0 Absent.
//
// The stage (Krillion's layout, our own art): a pixel UN General Assembly hall,
// a delegate's hand floating in the middle with a placard that shows what you
// type, and the score rungs it rises to after each answer. A near miss is
// autocorrected: the box fills with the answer the game thinks you meant and
// submitting again confirms it.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { ArmSprite, TierIcon } from '@/components/munillion/PixelArt';
import {
  MAX_POINTS,
  TIER_ORDER,
  conferenceHref,
  munAnswer,
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
import RevealList from './RevealList';
import AddConferenceButton from './AddConferenceButton';

type Phase = 'loading' | 'error' | 'nogame' | 'intro' | 'question' | 'result' | 'summary';

interface ResultView {
  position: number;
  tier: number;
  label: string | null;
  sub: string | null;
  slug: string | null;
  typed: string | null;
  reason: 'correct' | 'late' | 'skipped';
}

/** Where the hand floats (top of the hand zone, %) for each score; the rest spot is where it waits. */
const RUNG_TOP: Record<number, number> = { 100: 6, 85: 21, 60: 36, 30: 51, 10: 65, 0: 88 };
const REST_TOP = 74;
const RUNGS = [100, 85, 60, 30, 10];

// Fixed motes so the server and the browser draw the same thing.
const MOTES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  d: 11 + ((i * 7) % 9),
  delay: -((i * 13) % 17),
  x: ((i % 2 ? 1 : -1) * (10 + ((i * 5) % 24))),
  paper: i % 3 === 0,
}));

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

function firstOpenPosition(questions: MunQuestion[], answers: Record<number, MunPlayAnswer>): number {
  for (const q of questions) {
    const a = answers[q.position];
    if (!a || a.tier === null) return q.position;
  }
  return questions.length + 1;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const expiringRef = useRef(false);

  const questions = useMemo(() => today?.questions ?? [], [today]);
  const count = questions.length || 7;
  const q = questions.find((x) => x.position === pos) ?? null;
  const game = today?.game ?? null;

  // ?preview=1 plays the newest game, published or not (read here, not through useSearchParams, so the page renders on the server).
  useEffect(() => {
    setPreview(new URLSearchParams(window.location.search).get('preview') === '1');
  }, []);

  const startQuestion = useCallback((position: number, secondsLeft: number) => {
    expiringRef.current = false;
    setPos(position);
    setInput('');
    setMsg(null);
    setSuggestion(null);
    setResult(null);
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
    setBusy(true);
    try {
      const r = await munOpen(position, preview);
      if (!r.ok || r.answered) { await load(); return; }
      const fallback = questions.find((x) => x.position === position)?.seconds ?? 30;
      startQuestion(position, r.seconds_left ?? fallback);
    } catch (e) {
      notifyErr(friendlyError(e, "Couldn't open the next question"));
    } finally {
      setBusy(false);
    }
  }, [preview, load, questions, startQuestion]);

  const applyResult = useCallback((position: number, r: MunAnswerResult, reason: ResultView['reason'], typed: string | null) => {
    const tier = r.tier ?? 0;
    setAnswers((m) => ({
      ...m,
      [position]: { position, tier, typed, label: r.label ?? null, sub: r.sub ?? null, slug: r.slug ?? null, seconds_left: null },
    }));
    if (typeof r.total === 'number') setTotal(r.total);
    setSuggestion(null);
    setResult({ position, tier, label: r.label ?? null, sub: r.sub ?? null, slug: r.slug ?? null, typed, reason });
    setPhase('result');
  }, []);

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
    setBusy(true);
    try {
      const r = await munAnswer(q.position, text, preview);
      if (!r.ok) { await load(); return; }
      if (r.status === 'suggest' && r.suggestion) {
        setSuggestion({ typed: text, to: r.suggestion });
        setInput(r.suggestion);
        setMsg(null);
        window.setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      if (r.status === 'unknown') {
        setShake((s) => s + 1);
        setSuggestion(null);
        if ((r.attempts_left ?? 1) <= 0) setMsg("That's every try for this one");
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
    if (phase !== 'question' || !deadline || remainingMs > 0 || expiringRef.current) return;
    expiringRef.current = true;
    void giveUp('late');
  }, [phase, deadline, remainingMs, giveUp]);

  useEffect(() => {
    if (phase === 'question') inputRef.current?.focus();
  }, [phase, pos]);

  // Enter moves on from a result.
  useEffect(() => {
    if (phase !== 'result') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !busy) { e.preventDefault(); void goNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, busy, goNext]);

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
      await load();
      notifyOk('Your play was reset');
    } catch (e) {
      notifyErr(friendlyError(e, "Couldn't reset your play"));
    }
  }, [load]);

  const signedIn = !!today?.signed_in;
  const streak = today?.streak ?? 0;
  const answeredCount = questions.filter((x) => answers[x.position] && answers[x.position].tier !== null).length;

  // ── the floating hand ─────────────────────────────────────────────────────

  const handTop = phase === 'result' && result ? RUNG_TOP[result.tier] ?? REST_TOP : REST_TOP;
  const placardText = phase === 'result' && result
    ? (result.tier > 0 ? (result.label || result.typed || '') : 'Absent')
    : phase === 'question' ? input.trim() : phase === 'intro' ? 'Ready?' : '';
  const placardSmall = phase === 'result' && result ? tierMeta(result.tier).name : phase === 'question' ? `Question ${pos}` : 'Delegate';

  const handZone = (
    <div className="mn-hand-zone">
      <div className={`mn-ladder${phase === 'result' ? ' is-on' : ''}`} aria-hidden>
        {RUNGS.map((t) => (
          <div key={t} className={`mn-rung${result && phase === 'result' && result.tier === t ? ' is-hit' : ''}`} style={{ top: `${RUNG_TOP[t]}%` }}>
            <span className="mn-px">{tierMeta(t).name} · {t}</span>
          </div>
        ))}
      </div>
      <div className="mn-hand" style={{ '--top': `${handTop}%` } as CSSProperties}>
        <div className="mn-hand-bob">
          {phase === 'result' && result && result.tier >= 85 ? <div className="mn-glow" aria-hidden /> : null}
          <div className={`mn-placard mn-tx${placardText ? '' : ' is-empty'}`} aria-live="polite">
            <small className="mn-px">{placardSmall}</small>
            {placardText || 'Your answer'}
          </div>
          <div className="mn-arm"><ArmSprite size={84} /></div>
        </div>
      </div>
      {phase === 'result' && result ? (
        <div className="mn-result-tag">
          <div className="mn-tier-name mn-px">{tierMeta(result.tier).name}</div>
          <div className={`mn-points mn-px${result.tier === 0 ? ' is-zero' : ''}`}>+{result.tier}</div>
          <p className="mn-line mn-tx">
            {result.reason === 'late' ? 'Out of time' : result.reason === 'skipped' ? 'You passed on this one' : (
              <>
                {result.slug ? (
                  <a href={conferenceHref(result.slug)} target="_blank" rel="noopener noreferrer">{result.label}</a>
                ) : null}
                {result.slug && result.sub ? <> · {result.sub}</> : null}
                {!result.slug ? (result.sub ? `${result.sub}. ` : '') + tierMeta(result.tier).line : null}
              </>
            )}
          </p>
        </div>
      ) : null}
    </div>
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
        </div>
      </div>
      <div className="mn-panel mn-box" style={{ textAlign: 'right' }}>
        <div className="mn-box-label mn-px">Streak</div>
        <div className="mn-box-value mn-px">{streak}</div>
      </div>
    </div>
  );

  let centre: ReactNode = null;
  let bar: ReactNode = null;

  if (phase === 'loading') {
    centre = <div className="mn-panel mn-card" aria-hidden style={{ minHeight: 180, opacity: 0.6 }} />;
  } else if (phase === 'error') {
    centre = (
      <div className="mn-panel mn-card">
        <h2 className="mn-h2 mn-px">Couldn&apos;t Load Today&apos;s Game</h2>
        <p className="mn-p mn-tx">Check your connection and try again</p>
        <div className="mn-row">
          <button type="button" className="mn-btn mn-px focus:outline-none" onClick={() => { setPhase('loading'); void load(); }}>Try again</button>
        </div>
      </div>
    );
  } else if (phase === 'nogame') {
    centre = (
      <>
        <div className="mn-panel mn-card">
          <h2 className="mn-h2 mn-px">The First MUNillion Is Almost Here</h2>
          <p className="mn-p mn-tx">Seven questions go live at midnight UTC. Come back and raise your placard</p>
          <Countdown prefix="Next check in" />
        </div>
        {handZone}
      </>
    );
  } else if (phase === 'intro' && game) {
    const started = answeredCount > 0;
    centre = (
      <>
        <div className="mn-panel mn-card">
          <div className="mn-kicker mn-px">MUNillion #{game.number} · {formatDate(game.date)}</div>
          <h2 className="mn-h2 mn-px" style={{ marginTop: 12 }}>{started ? 'Pick Up Where You Left Off' : "Today's Seven Questions"}</h2>
          <p className="mn-p mn-tx">Thirty seconds each, one answer per question. Common answers keep your placard low, rare ones raise it, and one answer on every list wins The Gavel</p>
          <ul className="mn-legend">
            {TIER_ORDER.map((t) => (
              <li key={t} className="mn-tx">
                <TierIcon tier={t} size={26} label={tierMeta(t).name} />
                <span>{tierMeta(t).name}</span>
                <span className="mn-px">{t}</span>
              </li>
            ))}
          </ul>
          {!signedIn ? (
            <p className="mn-p mn-tx" style={{ fontSize: 19 }}>
              <button type="button" className="mn-link mn-tx focus:outline-none" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 'inherit' }} onClick={() => openAuth({ next: '/games' })}>
                Sign in
              </button>{' '}to keep your streak on every device
            </p>
          ) : null}
        </div>
        {handZone}
      </>
    );
    bar = (
      <button type="button" className="mn-btn mn-px is-wide focus:outline-none" disabled={busy} onClick={() => void openQuestion(pos)}>
        {started ? `Continue with question ${pos}` : "Start today's game"}
      </button>
    );
  } else if (phase === 'question' && q) {
    const pct = q.seconds > 0 ? Math.max(0, Math.min(1, remainingMs / (q.seconds * 1000))) : 0;
    const C = 2 * Math.PI * 30;
    centre = (
      <>
        <div className="mn-panel mn-card">
          <div className="mn-kicker mn-px">Question {q.position} of {count}</div>
          <h2 className="mn-prompt mn-tx">{q.prompt}</h2>
          {q.hint ? <p className="mn-hint mn-tx">{q.hint}</p> : null}
        </div>
        {handZone}
      </>
    );
    bar = (
      <>
        {suggestion ? (
          <div className="mn-panel mn-bubble" role="status">
            <div className="mn-tx">&ldquo;{suggestion.typed}&rdquo; &rarr; <b>&ldquo;{suggestion.to}&rdquo;</b></div>
            <div className="mn-px">Submit again to confirm, or edit</div>
          </div>
        ) : null}
        <form key={shake} className={`mn-answer-row${shake ? ' mn-shake' : ''}`} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className={`mn-timer mn-px${remaining <= 5 ? ' is-low' : ''}`} aria-label={`${remaining} seconds left`}>
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
              <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(238,217,138,.9)" strokeWidth="3" strokeDasharray={`${C * pct} ${C}`} />
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
        <div className="mn-drain" aria-hidden><span style={{ width: `${pct * 100}%` }} /></div>
        <p className="mn-msg mn-tx" role="status" aria-live="polite">{msg ?? ''}</p>
        <div className="mn-row is-center" style={{ marginTop: 2 }}>
          <button type="button" className="mn-btn mn-px is-ghost is-small focus:outline-none" disabled={busy} onClick={() => void giveUp('skipped')}>Pass</button>
          {q.kind === 'conference' ? <AddConferenceButton /> : null}
        </div>
      </>
    );
  } else if (phase === 'result' && result) {
    const resQ = questions.find((x) => x.position === result.position);
    const last = result.position >= count;
    centre = handZone;
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
                <TierIcon tier={t} size={38} label={`Question ${x.position}: ${tierMeta(t).name}`} />
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
    <div className="mn-stage">
      <div className={`mn-bg${phase === 'result' && (result?.tier ?? 0) >= 60 ? ' is-up' : ''}`} aria-hidden />
      <div className="mn-shade" aria-hidden />
      <div className="mn-scan" aria-hidden />
      <div className="mn-motes" aria-hidden>
        {MOTES.map((m, i) => (
          <span
            key={i}
            className={`mn-mote${m.paper ? ' is-paper' : ''}`}
            style={{ left: `${m.left}%`, '--d': `${m.d}s`, '--delay': `${m.delay}s`, '--x': `${m.x}px` } as CSSProperties}
          />
        ))}
      </div>

      {preview && game?.preview ? (
        <div className="mn-preview mn-px" role="note">
          <span>Preview of MUNillion #{game.number} for {formatDate(game.date)}. It only shows on /games once it&apos;s published</span>
          <Link className="mn-link" href="/admin/munillion">Review answers</Link>
        </div>
      ) : null}
      {phase === 'intro' || phase === 'nogame' || phase === 'loading' || phase === 'error' ? header : null}
      {phase !== 'loading' ? hud : null}
      <section className="mn-centre" aria-label="MUNillion">{centre}</section>
      {bar ? <div className="mn-bar-zone">{bar}</div> : null}
    </div>
  );
}
