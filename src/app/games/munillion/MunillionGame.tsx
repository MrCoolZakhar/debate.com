'use client';

// MUNillion: seven MUN questions a day, 30 seconds each, the rarer the answer
// the more points (owner, 26 Nov 2026). The database keeps the clock and the
// score (munillion_open / _answer / _skip); this page only draws them, so a
// reload never resets a question's time and nobody can see the answers before
// they finish. Scores: 100 Gavel, 85 Best Delegate, 60 Outstanding Delegate,
// 30 Honourable Mention, 10 Participation Certificate, 0 Absent.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { DeskScene, TierIcon } from '@/components/munillion/PixelArt';
import {
  MAX_POINTS,
  TIER_ORDER,
  conferenceHref,
  munAnswer,
  munOpen,
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

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function msToNextUtcMidnight(now: number): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(0, next - now);
}

function hms(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

function Countdown({ prefix }: { prefix: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <p className="mn-countdown">{prefix} {hms(msToNextUtcMidnight(now))}</p>;
}

function firstOpenPosition(questions: MunQuestion[], answers: Record<number, MunPlayAnswer>): number {
  for (const q of questions) {
    const a = answers[q.position];
    if (!a || a.tier === null) return q.position;
  }
  return questions.length + 1;
}

export default function MunillionGame() {
  const params = useSearchParams();
  const preview = params.get('preview') === '1';
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [today, setToday] = useState<MunToday | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [answers, setAnswers] = useState<Record<number, MunPlayAnswer>>({});
  const [total, setTotal] = useState(0);
  const [pos, setPos] = useState(1);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResultView | null>(null);
  const [reveal, setReveal] = useState<MunReveal | null>(null);
  const [bump, setBump] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const expiringRef = useRef(false);

  const questions = useMemo(() => today?.questions ?? [], [today]);
  const count = questions.length || 7;
  const q = questions.find((x) => x.position === pos) ?? null;
  const game = today?.game ?? null;

  const startQuestion = useCallback((position: number, secondsLeft: number) => {
    expiringRef.current = false;
    setPos(position);
    setInput('');
    setMsg(null);
    setResult(null);
    setDeadline(Date.now() + Math.max(0, secondsLeft) * 1000);
    setNow(Date.now());
    setPhase('question');
  }, []);

  const loadReveal = useCallback(async () => {
    setReveal(null);
    try {
      setReveal(await munReveal(preview));
    } catch (e) {
      notifyErr(friendlyError(e, "Couldn't load today's answers"));
    }
  }, [preview]);

  const load = useCallback(async () => {
    try {
      const t = await munToday(preview);
      setToday(t);
      if (!t.game) { setPhase('nogame'); return; }
      const map: Record<number, MunPlayAnswer> = {};
      for (const a of t.play?.answers ?? []) map[a.position] = a;
      setAnswers(map);
      setTotal(t.play?.total ?? 0);
      if (t.play?.finished) {
        setPhase('summary');
        void loadReveal();
        return;
      }
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
    if (authLoading) return;
    void load();
  }, [authLoading, userId, load]);

  const openQuestion = useCallback(async (position: number) => {
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
    setResult({ position, tier, label: r.label ?? null, sub: r.sub ?? null, slug: r.slug ?? null, typed, reason });
    setBump((b) => b + 1);
    setPhase('result');
  }, []);

  const giveUp = useCallback(async (reason: 'late' | 'skipped') => {
    if (!q) return;
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
    if (!text || busy || !q) return;
    setBusy(true);
    try {
      const r = await munAnswer(q.position, text, preview);
      if (!r.ok) { await load(); return; }
      if (r.status === 'unknown') {
        setShake((s) => s + 1);
        if ((r.attempts_left ?? 1) <= 0) setMsg("That's every try for this one");
        else if (q.kind === 'conference') setMsg('Not on Gavelling yet. Try another, or add yours with the plus');
        else if (q.kind === 'number') setMsg('Type a resolution number, like 242');
        else setMsg('Not on our list. Try another');
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
    if (!result) return;
    const after = result.position + 1;
    if (after > count) {
      setPhase('summary');
      void loadReveal();
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

  const tiersInOrder = useMemo(
    () => questions.map((x) => answers[x.position]?.tier ?? null),
    [questions, answers],
  );

  const share = useCallback(async () => {
    if (!game) return;
    const text = shareText(game.number, total, tiersInOrder);
    try {
      if (typeof navigator !== 'undefined' && navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      notifyOk('Copied. Paste it anywhere');
    } catch {
      /* the share sheet was closed */
    }
  }, [game, total, tiersInOrder]);

  const resetMyPlay = useCallback(async () => {
    if (!game) return;
    try {
      const c = await getFreshAuthedClient();
      if (!c) return;
      const { data, error } = await c.rpc('munillion_admin_reset_my_play', { p_number: game.number });
      if (error || !(data as { ok?: boolean })?.ok) { notifyErr("Couldn't reset your play"); return; }
      setReveal(null);
      setResult(null);
      await load();
      notifyOk('Your play was reset');
    } catch (e) {
      notifyErr(friendlyError(e, "Couldn't reset your play"));
    }
  }, [game, load]);

  const level = total / MAX_POINTS;
  const signedIn = !!today?.signed_in;
  const streak = today?.streak ?? 0;
  const answeredCount = questions.filter((x) => answers[x.position]?.tier !== null && answers[x.position] !== undefined).length;

  // ── pieces ────────────────────────────────────────────────────────────────

  const hud = (
    <div className="mn-hud">
      <div className="mn-box">
        <div className="mn-box-label">Points</div>
        <div className="mn-box-value">{total}</div>
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
        <div className="mn-progress-label">
          {phase === 'summary' ? 'Done for today' : `Question ${Math.min(pos, count)} of ${count}`}
        </div>
      </div>
      <div className="mn-box" style={{ textAlign: 'right' }}>
        <div className="mn-box-label">Streak</div>
        <div className="mn-box-value">{streak}</div>
      </div>
    </div>
  );

  let center: ReactNode = null;

  if (phase === 'loading') {
    center = <div className="mn-card" aria-hidden style={{ minHeight: 320, background: 'rgba(27,56,40,.06)' }} />;
  } else if (phase === 'error') {
    center = (
      <div className="mn-card">
        <h2 className="mn-h2">Couldn&apos;t Load Today&apos;s Game</h2>
        <p className="mn-p">Check your connection and try again</p>
        <div className="mn-row">
          <button type="button" className="mn-btn focus:outline-none" onClick={() => { setPhase('loading'); void load(); }}>Try again</button>
        </div>
      </div>
    );
  } else if (phase === 'nogame') {
    center = (
      <div className="mn-card">
        <h2 className="mn-h2">The First MUNillion Is Almost Here</h2>
        <p className="mn-p">Seven questions go live at midnight UTC. Come back and raise your placard</p>
        <Countdown prefix="Next check in" />
      </div>
    );
  } else if (phase === 'intro' && game) {
    const started = answeredCount > 0;
    center = (
      <div className="mn-card">
        <div className="mn-kicker">MUNillion #{game.number} · {formatDate(game.date)}</div>
        <h2 className="mn-h2" style={{ marginTop: 10 }}>{started ? 'Pick Up Where You Left Off' : "Today's Seven Questions"}</h2>
        <p className="mn-p">
          Thirty seconds each, one answer per question. Common answers keep your hand low, rare ones raise your placard, and one answer on every list wins the gavel
        </p>
        <div className="mn-row">
          <button type="button" className="mn-btn focus:outline-none" disabled={busy} onClick={() => void openQuestion(pos)}>
            {started ? `Continue with question ${pos}` : "Start today's game"}
          </button>
          {!signedIn ? (
            <button type="button" className="mn-link focus:outline-none" onClick={() => openAuth({ next: '/games' })}>
              Sign in to keep your streak on every device
            </button>
          ) : null}
        </div>
      </div>
    );
  } else if (phase === 'question' && q) {
    const pct = q.seconds > 0 ? Math.max(0, Math.min(100, (remainingMs / (q.seconds * 1000)) * 100)) : 0;
    center = (
      <div className="mn-card">
        <div className="mn-kicker">Question {q.position} of {count}</div>
        <h2 className="mn-prompt">{q.prompt}</h2>
        {q.hint ? <p className="mn-hint">{q.hint}</p> : null}
        <form
          key={shake}
          className={`mn-answer-row${shake ? ' mn-shake' : ''}`}
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          <div className={`mn-timer${remaining <= 5 ? ' is-low' : ''}`} aria-label={`${remaining} seconds left`}>{remaining}</div>
          <input
            ref={inputRef}
            className="mn-input"
            value={input}
            onChange={(e) => { setInput(e.target.value); if (msg) setMsg(null); }}
            placeholder={q.kind === 'number' ? 'A number' : 'Your answer'}
            inputMode={q.kind === 'number' ? 'numeric' : 'text'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            maxLength={120}
            aria-label="Your answer"
            disabled={busy && !input}
          />
          <button type="submit" className="mn-btn focus:outline-none" disabled={busy || !input.trim()}>Answer</button>
        </form>
        <div className="mn-bar" aria-hidden><span style={{ width: `${pct}%` }} /></div>
        <p className="mn-msg" role="status" aria-live="polite">{msg ?? ''}</p>
        <div className="mn-row" style={{ marginTop: 6 }}>
          <button type="button" className="mn-btn is-ghost is-small focus:outline-none" disabled={busy} onClick={() => void giveUp('skipped')}>Pass</button>
          {q.kind === 'conference' ? <AddConferenceButton /> : null}
        </div>
      </div>
    );
  } else if (phase === 'result' && result) {
    const meta = tierMeta(result.tier);
    const resQ = questions.find((x) => x.position === result.position);
    const last = result.position >= count;
    const label = result.label || result.typed;
    center = (
      <div className="mn-card mn-result">
        <div className="mn-kicker">Question {result.position} of {count}</div>
        <div className="mn-result-icon" style={{ marginTop: 14 }}>
          <TierIcon tier={result.tier} size={112} label={meta.name} />
        </div>
        <div className="mn-tier-name">{meta.name}</div>
        <div className={`mn-points${result.tier === 0 ? ' is-zero' : ''}`}>+{result.tier} points</div>
        {result.tier > 0 && label ? (
          <div className="mn-label">
            {result.slug ? (
              <a href={conferenceHref(result.slug)} target="_blank" rel="noopener noreferrer">{label}</a>
            ) : label}
            {result.sub ? <div className="mn-sub">{result.sub}</div> : null}
          </div>
        ) : null}
        <p className="mn-p">
          {result.reason === 'late' ? 'Out of time' : result.reason === 'skipped' ? 'You passed on this one' : meta.line}
        </p>
        <div className="mn-row is-center" style={{ marginTop: 22 }}>
          <button type="button" className="mn-btn focus:outline-none" disabled={busy} onClick={() => void goNext()}>
            {last ? 'See your results' : 'Next question'}
          </button>
          {resQ?.kind === 'conference' ? <AddConferenceButton small={false} /> : null}
        </div>
      </div>
    );
  } else if (phase === 'summary' && game) {
    center = (
      <div className="mn-card" style={{ textAlign: 'center' }}>
        <div className="mn-kicker">MUNillion #{game.number} · {formatDate(game.date)}</div>
        <div className="mn-total" style={{ marginTop: 14 }}>{total}<small> / {MAX_POINTS}</small></div>
        <p className="mn-p" style={{ marginTop: 6 }}>{streak} day{streak === 1 ? '' : 's'} in a row</p>
        <div className="mn-icons">
          {questions.map((x) => {
            const t = answers[x.position]?.tier ?? 0;
            return (
              <figure key={x.position}>
                <TierIcon tier={t} size={40} label={`Question ${x.position}: ${tierMeta(t).name}`} />
                <figcaption>{t}</figcaption>
              </figure>
            );
          })}
        </div>
        <div className="mn-row is-center">
          <button type="button" className="mn-btn focus:outline-none" onClick={() => void share()}>Share your score</button>
          {!signedIn ? (
            <button type="button" className="mn-btn is-ghost focus:outline-none" onClick={() => openAuth({ next: '/games' })}>Sign in to save your streak</button>
          ) : (
            <Link className="mn-btn is-ghost focus:outline-none" href="/account/games" style={{ textDecoration: 'none' }}>Your past games</Link>
          )}
          {preview ? (
            <button type="button" className="mn-btn is-gold is-small focus:outline-none" onClick={() => void resetMyPlay()}>Reset my play</button>
          ) : null}
        </div>
        <Countdown prefix="Next game in" />
        <div style={{ textAlign: 'left' }}>
          <RevealList reveal={reveal} />
        </div>
      </div>
    );
  }

  return (
    <>
      {preview && game?.preview ? (
        <div className="mn-preview" role="note">
          <span>Preview of MUNillion #{game.number} for {formatDate(game.date)}. Players can&apos;t see it until it&apos;s published</span>
          <Link className="mn-link" href="/admin/munillion">Review answers</Link>
        </div>
      ) : null}
      <div className="mn-wrap">
        <aside className="mn-scene-col" aria-label="Your placard">
          <div className="mn-scene-frame">
            <DeskScene level={level} points={total} bump={bump} />
          </div>
        </aside>

        <section aria-label="MUNillion">
          {hud}
          {center}
        </section>

        <aside className="mn-side">
          <div className="mn-frame" style={{ padding: 18 }}>
            <h2 className="mn-h3">Today</h2>
            <ol className="mn-today">
              {Array.from({ length: count }, (_, i) => {
                const p = i + 1;
                const a = answers[p];
                const done = a && a.tier !== null;
                const qq = questions.find((x) => x.position === p);
                const isNow = !done && (phase === 'question' || phase === 'result') && p === pos;
                return (
                  <li key={p}>
                    {done ? (
                      <TierIcon tier={a.tier} size={28} label={tierMeta(a.tier).name} />
                    ) : (
                      <span className={`mn-numsq${isNow ? ' is-now' : ''}`}>{p}</span>
                    )}
                    <span>
                      {done ? (
                        a.tier && (a.label || a.typed) ? (
                          a.slug ? <a href={conferenceHref(a.slug)} target="_blank" rel="noopener noreferrer">{a.label || a.typed}</a> : a.label || a.typed
                        ) : <span className="mn-muted">Absent</span>
                      ) : isNow && qq ? qq.prompt : <span className="mn-muted">Question {p}</span>}
                    </span>
                    {done ? <span className="mn-pts">{a.tier}</span> : null}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="mn-frame" style={{ padding: 18 }}>
            <h2 className="mn-h3">How Scoring Works</h2>
            <ul className="mn-legend">
              {TIER_ORDER.map((t) => (
                <li key={t}>
                  <TierIcon tier={t} size={28} label={tierMeta(t).name} />
                  <span>{tierMeta(t).name}</span>
                  <span className="mn-pts">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
