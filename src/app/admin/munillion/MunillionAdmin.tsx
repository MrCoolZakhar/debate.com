'use client';

// ── MUNillion review (/admin/munillion) ─────────────────────────────────────
//
// Peter reads every answer list here before a game is published. Every read
// and write is a munillion_admin_* function (platform admins only, enforced in
// the database: reason 'not_admin' otherwise). They return jsonb
// { ok:false, reason } on a refusal instead of raising, so every write checks
// `ok`. After each write the current game is read again; nothing is optimistic.
// /admin keeps raw error text, but known reason codes are said in plain words.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import GSelect from '@/components/GSelect';
import { DatePicker } from '@/components/DatePicker';
import { NEU, NeuCard, OUTFIT } from '@/components/neu';
import { TierIcon } from '@/components/munillion/PixelArt';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { tierMeta, type QuestionKind } from '@/lib/munillion';

// ── Shapes ──────────────────────────────────────────────────────────────────

interface AdminAnswer {
  id: string;
  answer: string;
  tier: number;
  aliases: string[] | null;
  note: string | null;
  link_slug: string | null;
}

interface AdminMiss { key: string; players: number; example: string }

interface AdminQuestion {
  id: string;
  position: number;
  prompt: string;
  hint: string | null;
  kind: QuestionKind;
  default_tier: number | null;
  number_max: number | null;
  seconds: number | null;
  answers: AdminAnswer[];
  misses: AdminMiss[] | null;
}

interface AdminGame {
  id: string;
  number: number;
  date: string;
  published: boolean;
  plays: number;
  finished: number;
}

interface AdminView {
  game: AdminGame | null;
  games: { number: number; date: string; published: boolean }[];
  questions: AdminQuestion[];
}

type Reply = { ok: boolean; reason?: string; position?: number; id?: string } & Record<string, unknown>;

// ── Helpers ─────────────────────────────────────────────────────────────────

const INK = NEU.ink;
const INK_SOFT = NEU.inkSoft;
const FOREST = '#1B3828';
const DEEP_GOLD = '#B6871F';
const GROUP_TIERS = [100, 85, 60, 30, 10] as const;
const TIER_OPTIONS = GROUP_TIERS.map((t) => ({ value: String(t), label: `${tierMeta(t).name} (${t})` }));
// The database allows 85, 60, 30 or 10 here (the Gavel is always one named answer).
const DEFAULT_TIER_OPTIONS = [{ value: '', label: 'Not set' }, ...[85, 60, 30, 10].map((t) => ({ value: String(t), label: `${tierMeta(t).name} (${t})` }))];
const KIND_WORD: Record<QuestionKind, string> = { list: 'List', number: 'Number', conference: 'Conference' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SHOW_FIRST = 40;

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}` : (iso ?? '');
}

/** A refusal said in plain words. Unknown codes are shown as they are (this is /admin). */
function reasonText(r: Reply): string {
  switch (r.reason) {
    case 'not_admin': return 'Only Gavelling staff can review MUNillion';
    case 'not_signed_in': return 'Sign in to review MUNillion';
    case 'needs_seven': return 'A game needs exactly seven questions before it can be published';
    case 'needs_gavel': return `Question ${r.position ?? '?'} has no Gavel answer`;
    case 'date_taken': return 'Another game already uses that date';
    case 'not_found': return 'That game or answer was not found';
    case 'duplicate': return 'That answer is already on the list';
    case 'empty': return 'Type an answer first';
    case 'bad_tier': return 'That tier is not allowed here';
    case 'bad_value': return 'Seconds must be 10 to 120, and the tier 85, 60, 30 or 10';
    default: return r.reason ? `Refused: ${r.reason}` : 'Something went wrong';
  }
}

async function callAdmin(fn: string, args: Record<string, unknown>): Promise<Reply> {
  // The signed-in client is read fresh at call time, never held in state.
  const client = await getFreshAuthedClient().catch(() => null);
  if (!client) return { ok: false, reason: 'not_signed_in' };
  const { data, error } = await client.rpc(fn, args);
  if (error) return { ok: false, reason: error.message };
  return (data ?? { ok: false, reason: 'empty answer' }) as Reply;
}

function splitAliases(text: string): string[] {
  return text.split(',').map((s) => s.trim()).filter(Boolean);
}

const FIELD: CSSProperties = {
  boxSizing: 'border-box', width: '100%', minHeight: 40, padding: '6px 12px', borderRadius: 10,
  border: '1.5px solid rgba(27,56,40,0.22)', background: '#FFFFFF', color: INK,
  fontFamily: OUTFIT, fontSize: 14, fontWeight: 500,
};
const FIELD_CLASS = 'focus:outline-none focus:border-[#1B3828] focus:shadow-[0_0_0_3px_rgba(27,56,40,0.13)]';

const LABEL: CSSProperties = { display: 'block', marginBottom: 4, fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK_SOFT };

function Btn({
  children, onClick, variant = 'primary', disabled, small, ariaLabel,
}: {
  children: ReactNode; onClick: () => void; variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean; small?: boolean; ariaLabel?: string;
}) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: small ? 34 : 42, padding: small ? '0 12px' : '0 18px', borderRadius: 10,
    fontFamily: OUTFIT, fontSize: small ? 13 : 14, fontWeight: 700, whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  };
  const look: CSSProperties = variant === 'primary'
    ? { border: 'none', color: '#FFFFFF', background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%)' }
    : variant === 'danger'
      ? { border: '1.5px solid #8B2020', color: '#FFFFFF', background: '#8B2020' }
      : { border: `1.5px solid ${INK}`, color: INK, background: '#FFFFFF' };
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2" style={{ ...base, ...look }}>
      {children}
    </button>
  );
}

function BigCount({ value, word }: { value: number; word: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5" style={{ fontFamily: OUTFIT, color: INK_SOFT, fontSize: 14 }}>
      <span style={{ fontWeight: 800, fontSize: 28, lineHeight: 1, letterSpacing: '-0.03em', color: FOREST, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {word}
    </span>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: NEU.base }}>
      <SiteNav />
      {children}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function MunillionAdmin() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [view, setView] = useState<AdminView | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const numberRef = useRef<number | null>(null);

  // `loading` starts true, so only a game switch or Try again raises it (in the handler).
  const apply = useCallback((res: Reply, number: number | null, mine: number) => {
    if (mine !== seq.current) return;
    if (!res.ok) {
      if (res.reason === 'not_admin' || res.reason === 'not_signed_in') setBlocked(reasonText(res));
      else setLoadError(reasonText(res));
      setLoading(false);
      return;
    }
    const next: AdminView = {
      game: (res.game as AdminGame | null) ?? null,
      games: (res.games as AdminView['games']) ?? [],
      questions: ((res.questions as AdminQuestion[]) ?? []).slice().sort((a, b) => a.position - b.position),
    };
    numberRef.current = next.game?.number ?? number;
    setLoadError(null);
    setView(next);
    setLoading(false);
  }, []);

  const load = useCallback((number: number | null): Promise<void> => {
    const mine = ++seq.current;
    return callAdmin('munillion_admin_game', { p_number: number }).then((res) => apply(res, number, mine));
  }, [apply]);

  useEffect(() => {
    if (authLoading || !userId) return;
    void load(null);
  }, [authLoading, userId, load]);

  /** One write: check ok, say what happened, read the current game again. */
  const act = useCallback(async (fn: string, args: Record<string, unknown>, done: string): Promise<boolean> => {
    setBusy(true);
    const res = await callAdmin(fn, args);
    if (!res.ok) {
      setBusy(false);
      notifyErr(reasonText(res), 'munillion-admin');
      return false;
    }
    notifyOk(done, 'munillion-admin');
    await load(numberRef.current);
    setBusy(false);
    return true;
  }, [load]);

  const signedOut = !authLoading && !userId;

  if (authLoading || (!signedOut && loading && !view && !blocked)) {
    return (
      <Shell>
        <div className="flex justify-center" style={{ padding: '96px 0' }}><Loader size={40} /></div>
      </Shell>
    );
  }

  if (blocked || signedOut) {
    return (
      <Shell>
        <div className="flex items-center justify-center text-center px-6" style={{ minHeight: '60vh' }}>
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 16, fontWeight: 700, color: INK }}>{blocked ?? 'Sign in to review MUNillion'}</p>
        </div>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center gap-4 text-center px-6" style={{ minHeight: '60vh' }}>
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 15, color: INK }}>{loadError ?? 'Could not load MUNillion'}</p>
          <Btn onClick={() => { setLoading(true); void load(null); }}>Try again</Btn>
        </div>
      </Shell>
    );
  }

  const { game } = view;

  return (
    <Shell>
      <main className="mx-auto w-full max-w-[1500px] px-5 md:px-8 py-9">
        <h1 style={{ margin: '0 0 20px', fontFamily: OUTFIT, fontWeight: 900, fontSize: 27, letterSpacing: '-0.02em', color: INK }}>
          MUNillion Review
        </h1>

        {!game ? (
          <NeuCard style={{ padding: 24 }}>
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 15, color: INK }}>There are no games yet</p>
          </NeuCard>
        ) : (
          <>
            <GameBar view={view} game={game} act={act} busy={busy} onPick={(n) => { setLoading(true); void load(n); }} />
            <div className="flex flex-col gap-5 mt-6">
              {view.questions.map((q) => (
                <QuestionCard key={`${q.id}|${q.prompt}|${q.hint}|${q.default_tier}|${q.number_max}|${q.seconds}`} q={q} act={act} busy={busy} />
              ))}
            </div>
          </>
        )}
      </main>
    </Shell>
  );
}

// ── The game bar ────────────────────────────────────────────────────────────

type Act = (fn: string, args: Record<string, unknown>, done: string) => Promise<boolean>;

function GameBar({ view, game, act, busy, onPick }: {
  view: AdminView; game: AdminGame; act: Act; busy: boolean; onPick: (n: number) => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const options = view.games.map((g) => ({
    value: String(g.number),
    label: `#${g.number} · ${formatDate(g.date)} · ${g.published ? 'Published' : 'Draft'}`,
  }));

  return (
    <NeuCard style={{ padding: 20 }}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div style={{ width: 'min(100%, 300px)' }}>
          <label style={LABEL} htmlFor="mun-game">Game</label>
          <GSelect
            id="mun-game"
            value={String(game.number)}
            onChange={(v) => { setConfirmReset(false); onPick(Number(v)); }}
            options={options}
          />
        </div>

        <div style={{ width: 'min(100%, 220px)' }}>
          <label style={LABEL} htmlFor="mun-date">Date</label>
          <DatePicker
            id="mun-date"
            value={game.date}
            onChange={(iso) => {
              if (!iso || iso === game.date) return;
              void act('munillion_admin_publish', { p_number: game.number, p_published: game.published, p_date: iso }, 'Date saved');
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: game.published ? FOREST : INK_SOFT }}>
            {game.published ? 'Published' : 'Draft'}
          </span>
          <Btn
            disabled={busy}
            variant={game.published ? 'ghost' : 'primary'}
            onClick={() => void act(
              'munillion_admin_publish',
              { p_number: game.number, p_published: !game.published, p_date: game.date },
              game.published ? 'Game unpublished' : 'Game published',
            )}
          >
            {game.published ? 'Unpublish' : 'Publish'}
          </Btn>
        </div>

        <div className="flex items-center gap-6">
          <BigCount value={game.plays} word={game.plays === 1 ? 'play' : 'plays'} />
          <BigCount value={game.finished} word="finished" />
        </div>

        <div className="flex flex-wrap items-center gap-3 md:ml-auto">
          <a
            href="/games?preview=1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
            style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Preview the game
            <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
          </a>
          {confirmReset ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span style={{ fontFamily: OUTFIT, fontSize: 13, color: INK }}>Delete your own play of #{game.number}?</span>
              <Btn small variant="danger" disabled={busy} onClick={() => {
                void act('munillion_admin_reset_my_play', { p_number: game.number }, 'Your play was reset').then(() => setConfirmReset(false));
              }}>Reset</Btn>
              <Btn small variant="ghost" onClick={() => setConfirmReset(false)}>Keep it</Btn>
            </span>
          ) : (
            <Btn small variant="ghost" disabled={busy} onClick={() => setConfirmReset(true)}>Reset my play</Btn>
          )}
        </div>
      </div>
    </NeuCard>
  );
}

// ── One question ────────────────────────────────────────────────────────────

function QuestionCard({ q, act, busy }: { q: AdminQuestion; act: Act; busy: boolean }) {
  const [prompt, setPrompt] = useState(q.prompt);
  const [hint, setHint] = useState(q.hint ?? '');
  const [defTier, setDefTier] = useState(q.default_tier == null ? '' : String(q.default_tier));
  const [numMax, setNumMax] = useState(q.number_max == null ? '' : String(q.number_max));
  const [seconds, setSeconds] = useState(q.seconds == null ? '' : String(q.seconds));
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const addRef = useRef<HTMLDivElement | null>(null);
  const [prefill, setPrefill] = useState({ text: '', n: 0 });

  const showNumMax = q.kind === 'number';
  const showDefTier = q.kind === 'number' || q.kind === 'conference';
  const dirty = prompt !== q.prompt
    || hint !== (q.hint ?? '')
    || (showDefTier && defTier !== (q.default_tier == null ? '' : String(q.default_tier)))
    || (showNumMax && numMax !== (q.number_max == null ? '' : String(q.number_max)))
    || seconds !== (q.seconds == null ? '' : String(q.seconds));

  const toInt = (s: string): number | null => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Math.round(Number(s)));

  const save = () => void act('munillion_admin_update_question', {
    p_question: q.id,
    p_prompt: prompt.trim(),
    p_hint: hint.trim(),
    p_default_tier: showDefTier ? toInt(defTier) : null,
    p_number_max: showNumMax ? toInt(numMax) : null,
    p_seconds: toInt(seconds),
  }, `Question ${q.position} saved`);

  // Answers, grouped by tier, filtered by the search box (text or alias).
  const needle = search.trim().toLowerCase();
  const matches = (a: AdminAnswer) => !needle
    || a.answer.toLowerCase().includes(needle)
    || (a.aliases ?? []).some((x) => x.toLowerCase().includes(needle));
  const knownTiers = new Set<number>(GROUP_TIERS);
  const otherTiers = Array.from(new Set(q.answers.map((a) => a.tier))).filter((t) => !knownTiers.has(t)).sort((a, b) => b - a);
  const groupOrder = [...GROUP_TIERS, ...otherTiers];

  const misses = q.misses ?? [];

  return (
    <NeuCard style={{ padding: 20 }}>
      {/* Heading: position, kind word, and the editable text */}
      <div className="flex flex-wrap items-baseline gap-3 mb-3">
        <h2 style={{ margin: 0, fontFamily: OUTFIT, fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em', color: INK }}>Question {q.position}</h2>
        <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: DEEP_GOLD }}>{KIND_WORD[q.kind] ?? q.kind}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label style={LABEL} htmlFor={`q-prompt-${q.id}`}>Prompt</label>
          <input id={`q-prompt-${q.id}`} className={FIELD_CLASS} style={FIELD} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div>
          <label style={LABEL} htmlFor={`q-hint-${q.id}`}>Hint</label>
          <input id={`q-hint-${q.id}`} className={FIELD_CLASS} style={FIELD} value={hint} onChange={(e) => setHint(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mt-3">
        {showDefTier && (
          <div style={{ width: 'min(100%, 240px)' }}>
            <label style={LABEL} htmlFor={`q-def-${q.id}`}>{q.kind === 'conference' ? 'Tier for a listed conference' : 'Tier for other numbers'}</label>
            <GSelect id={`q-def-${q.id}`} value={defTier} onChange={setDefTier} options={DEFAULT_TIER_OPTIONS} />
          </div>
        )}
        {showNumMax && (
          <div style={{ width: 'min(100%, 140px)' }}>
            <label style={LABEL} htmlFor={`q-max-${q.id}`}>Highest number</label>
            <input id={`q-max-${q.id}`} type="number" inputMode="numeric" className={FIELD_CLASS} style={FIELD} value={numMax} onChange={(e) => setNumMax(e.target.value)} />
          </div>
        )}
        <div style={{ width: 'min(100%, 110px)' }}>
          <label style={LABEL} htmlFor={`q-sec-${q.id}`}>Seconds</label>
          <input id={`q-sec-${q.id}`} type="number" inputMode="numeric" className={FIELD_CLASS} style={FIELD} value={seconds} onChange={(e) => setSeconds(e.target.value)} />
        </div>
        <Btn disabled={busy || !dirty || prompt.trim() === ''} onClick={save}>Save question</Btn>
      </div>

      {/* Tier counts, big number and word */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 pt-4" style={{ borderTop: '1px solid rgba(27,56,40,0.1)' }}>
        {groupOrder.map((t) => {
          const n = q.answers.filter((a) => a.tier === t).length;
          if (n === 0 && !GROUP_TIERS.includes(t as typeof GROUP_TIERS[number])) return null;
          return (
            <span key={t} className="inline-flex items-center gap-2">
              <TierIcon tier={t} size={22} label={tierMeta(t).name} />
              <BigCount value={n} word={tierMeta(t).name} />
            </span>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mt-4" style={{ maxWidth: 420 }}>
        <Search size={16} strokeWidth={1.5} aria-hidden style={{ position: 'absolute', left: 12, top: 12, color: INK_SOFT }} />
        <input
          className={FIELD_CLASS}
          style={{ ...FIELD, paddingLeft: 36 }}
          placeholder="Search answers and aliases"
          aria-label={`Search answers of question ${q.position}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Answers by tier */}
      <div className="flex flex-col gap-5 mt-4">
        {groupOrder.map((t) => {
          const all = q.answers.filter((a) => a.tier === t);
          const list = all.filter(matches);
          if (needle && list.length === 0) return null;
          if (!needle && all.length === 0) {
            return t === 100 ? (
              <p key={t} style={{ margin: 0, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: '#8B2020' }}>No Gavel answer yet</p>
            ) : null;
          }
          const open = !!expanded[t] || !!needle || list.length <= SHOW_FIRST;
          const rows = open ? list : list.slice(0, SHOW_FIRST);
          return (
            <section key={t} aria-label={tierMeta(t).name}>
              <h3 className="inline-flex items-center gap-2" style={{ margin: '0 0 6px', fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: INK }}>
                <TierIcon tier={t} size={20} label="" />
                {tierMeta(t).name}
                <span style={{ color: DEEP_GOLD, fontVariantNumeric: 'tabular-nums' }}>{needle ? `${list.length} of ${all.length}` : all.length}</span>
              </h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {rows.map((a) => (
                  <AnswerRow
                    key={a.id}
                    a={a}
                    kind={q.kind}
                    busy={busy}
                    confirming={confirmId === a.id}
                    onAskRemove={() => setConfirmId(a.id)}
                    onCancelRemove={() => setConfirmId(null)}
                    onRemove={() => void act('munillion_admin_remove_answer', { p_answer: a.id }, 'Answer removed').then(() => setConfirmId(null))}
                    onTier={(tier) => void act('munillion_admin_set_tier', { p_answer: a.id, p_tier: tier }, `Moved to ${tierMeta(tier).name}`)}
                  />
                ))}
              </ul>
              {!open && (
                <div className="mt-2">
                  <Btn small variant="ghost" onClick={() => setExpanded((e) => ({ ...e, [t]: true }))}>Show all {list.length} answers</Btn>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Add an answer */}
      <div ref={addRef}><AddAnswer q={q} act={act} busy={busy} prefill={prefill} /></div>

      {/* Missed answers */}
      <section className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(27,56,40,0.1)' }} aria-label="Missed answers">
        <div className="flex items-baseline gap-2 mb-2">
          <h3 style={{ margin: 0, fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: INK }}>Missed Answers</h3>
          <span style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: DEEP_GOLD, fontVariantNumeric: 'tabular-nums' }}>{misses.length}</span>
        </div>
        {misses.length === 0 ? (
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT }}>Nobody has typed an answer the list missed</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 280, overflowY: 'auto' }}>
            {misses.map((m) => (
              <li key={m.key} className="flex flex-wrap items-center gap-3 py-2" style={{ borderTop: '1px solid rgba(27,56,40,0.07)' }}>
                <div className="min-w-0 flex-1">
                  <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: INK }}>{m.example}</p>
                  <p className="[overflow-wrap:anywhere]" style={{ margin: '1px 0 0', fontFamily: OUTFIT, fontSize: 12, color: INK_SOFT }}>key {m.key}</p>
                </div>
                <BigCount value={m.players} word={m.players === 1 ? 'player' : 'players'} />
                <Btn small variant="ghost" onClick={() => {
                  setPrefill((p) => ({ text: m.example, n: p.n + 1 }));
                  addRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }}>Add as answer</Btn>
              </li>
            ))}
          </ul>
        )}
      </section>
    </NeuCard>
  );
}

// ── One answer ──────────────────────────────────────────────────────────────

function AnswerRow({ a, kind, busy, confirming, onAskRemove, onCancelRemove, onRemove, onTier }: {
  a: AdminAnswer; kind: QuestionKind; busy: boolean; confirming: boolean;
  onAskRemove: () => void; onCancelRemove: () => void; onRemove: () => void; onTier: (tier: number) => void;
}) {
  const aliases = (a.aliases ?? []).filter(Boolean);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2" style={{ borderTop: '1px solid rgba(27,56,40,0.07)' }}>
      <div className="min-w-0 flex-1" style={{ flexBasis: 260 }}>
        <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: INK }}>
          {a.answer}
          {kind === 'conference' && a.link_slug && (
            <>
              {' '}
              <a
                href={`/conferences/${encodeURIComponent(a.link_slug)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
                style={{ fontSize: 12, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                {a.link_slug}
              </a>
            </>
          )}
        </p>
        {aliases.length > 0 && (
          <p className="[overflow-wrap:anywhere]" style={{ margin: '1px 0 0', fontFamily: OUTFIT, fontSize: 12, color: INK_SOFT }}>Also: {aliases.join(', ')}</p>
        )}
        {a.note && (
          <p className="[overflow-wrap:anywhere]" style={{ margin: '1px 0 0', fontFamily: OUTFIT, fontSize: 12, color: INK_SOFT }}>{a.note}</p>
        )}
        {kind !== 'conference' && a.link_slug && (
          <p style={{ margin: '1px 0 0', fontFamily: OUTFIT, fontSize: 12, color: INK_SOFT }}>Link {a.link_slug}</p>
        )}
      </div>

      {confirming ? (
        <div className="inline-flex flex-wrap items-center gap-2">
          <span style={{ fontFamily: OUTFIT, fontSize: 13, color: INK }}>Remove this answer?</span>
          <Btn small variant="danger" disabled={busy} onClick={onRemove}>Remove</Btn>
          <Btn small variant="ghost" onClick={onCancelRemove}>Keep it</Btn>
        </div>
      ) : (
        <div className="inline-flex items-center gap-2">
          <div style={{ width: 220 }}>
            <GSelect
              size="sm"
              value={String(a.tier)}
              disabled={busy}
              aria-label={`Tier of ${a.answer}`}
              onChange={(v) => onTier(Number(v))}
              options={TIER_OPTIONS.some((o) => o.value === String(a.tier)) ? TIER_OPTIONS : [...TIER_OPTIONS, { value: String(a.tier), label: `${tierMeta(a.tier).name} (${a.tier})` }]}
            />
          </div>
          <button
            type="button"
            onClick={onAskRemove}
            disabled={busy}
            aria-label={`Remove ${a.answer}`}
            className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded-lg"
            style={{ minHeight: 34, padding: '0 8px', border: 'none', background: 'transparent', color: '#8B2020', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: OUTFIT, fontSize: 13, fontWeight: 700 }}
          >
            <Trash2 size={15} strokeWidth={1.5} aria-hidden />
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

// ── Add an answer ───────────────────────────────────────────────────────────

function AddAnswer({ q, act, busy, prefill }: { q: AdminQuestion; act: Act; busy: boolean; prefill: { text: string; n: number } }) {
  const [answer, setAnswer] = useState('');
  const [aliases, setAliases] = useState('');
  const [tier, setTier] = useState('85');
  const [note, setNote] = useState('');
  const [slug, setSlug] = useState('');

  // The missed-answers list asks this row to take an example as its answer
  // (state adjusted during render, not in an effect).
  const [seen, setSeen] = useState(prefill.n);
  if (seen !== prefill.n) { setSeen(prefill.n); setAnswer(prefill.text); }

  const add = async () => {
    const ok = await act('munillion_admin_add_answer', {
      p_question: q.id,
      p_answer: answer.trim(),
      p_tier: Number(tier),
      p_aliases: splitAliases(aliases),
      p_note: note.trim() || null,
      p_link_slug: q.kind === 'conference' ? (slug.trim() || null) : null,
    }, 'Answer added');
    if (ok) { setAnswer(''); setAliases(''); setNote(''); setSlug(''); }
  };

  return (
    <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(27,56,40,0.1)' }}>
      <h3 style={{ margin: '0 0 8px', fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: INK }}>Add an Answer</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div style={{ flex: '2 1 220px' }}>
          <label style={LABEL} htmlFor={`add-a-${q.id}`}>Answer</label>
          <input id={`add-a-${q.id}`} className={FIELD_CLASS} style={FIELD} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </div>
        <div style={{ flex: '2 1 220px' }}>
          <label style={LABEL} htmlFor={`add-al-${q.id}`}>Aliases, comma separated</label>
          <input id={`add-al-${q.id}`} className={FIELD_CLASS} style={FIELD} value={aliases} onChange={(e) => setAliases(e.target.value)} />
        </div>
        <div style={{ flex: '1 1 210px', maxWidth: 260 }}>
          <label style={LABEL} htmlFor={`add-t-${q.id}`}>Tier</label>
          <GSelect id={`add-t-${q.id}`} value={tier} onChange={setTier} options={TIER_OPTIONS} />
        </div>
        <div style={{ flex: '2 1 220px' }}>
          <label style={LABEL} htmlFor={`add-n-${q.id}`}>Note</label>
          <input id={`add-n-${q.id}`} className={FIELD_CLASS} style={FIELD} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {q.kind === 'conference' && (
          <div style={{ flex: '1 1 180px' }}>
            <label style={LABEL} htmlFor={`add-s-${q.id}`}>Conference slug</label>
            <input id={`add-s-${q.id}`} className={FIELD_CLASS} style={FIELD} value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        )}
        <Btn disabled={busy || answer.trim() === ''} onClick={() => void add()}>
          <Plus size={16} strokeWidth={1.5} aria-hidden />
          Add answer
        </Btn>
      </div>
    </div>
  );
}
