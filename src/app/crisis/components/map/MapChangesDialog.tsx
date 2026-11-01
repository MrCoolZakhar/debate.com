'use client';
// Gavelling Crisis: "N changes to the map". One notification per send says how many things changed; this is what opens
// from it (the map page with ?changes=<epoch ms of the send>, or ?since=<epoch ms> for the one growing notice that bundles
// every change since that moment). A small map plays the send like a short video (units
// glide from where they were, new ones appear, borders and areas change; Play, Pause, a scrubber to rewind and replay),
// and under it a breakdown of every change with an icon per kind. A row closes the pop-up and flies the real map to that
// item. With ?changes= only the rows of that one send are used (rows made at the moment of the send share its time); with
// ?since= every row from that moment until now is used. crisis_history returns only what this viewer may see. The breakdown
// is grouped by troops, borders, areas and characters, oldest first so the newest sits last. A pop-up never opens another:
// a row leaves this one.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag, LocateFixed, Pause, PenTool, Play, RotateCcw, Shield, UserRound, type LucideIcon } from 'lucide-react';
import { crisisError } from '@/lib/crisis/api';
import { crisisHistory } from '@/lib/crisis/history';
import { timeAgo } from '@/lib/crisis/format';
import { Btn, CK, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CrisisDialog from '../delegate/CrisisDialog';
import ChangesReplay, { progressOf, startOf } from '../history/ChangesReplay';
import { focusForAny, parseAnyChange, type AnyChange, type AnyFilter } from '../history/charChange';
import { ChangeDisc, PieceLine, describe, useChangeCtx, type ChangeCtx, type Described } from '../history/changeKit';
import { prefersReducedMotion } from './mapAnimate';
import type { FocusRequest } from './mapFocusFly';

/** The groups of the breakdown, in the order they are listed. */
const GROUPS: Array<{ filter: AnyFilter; label: string; Icon: LucideIcon }> = [
  { filter: 'troops', label: 'Troops', Icon: Shield },
  { filter: 'borders', label: 'Borders', Icon: Flag },
  { filter: 'areas', label: 'Areas', Icon: PenTool },
  { filter: 'characters', label: 'Characters', Icon: UserRound },
];
/** Rows made by one send share its time; a second either way covers rounding. */
const SAME_SEND_MS = 1000;

/** The epoch ms in `?changes=` or `?since=`, or null when it is not one. */
export function readChangesStamp(raw: string | null | undefined): number | null {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 1e12 ? Math.round(n) : null;
}

/** The most rows one look back reads (the history function's own cap). */
const SINCE_LIMIT = 3000;

const countText = (n: number) => `${n} ${n === 1 ? 'Change' : 'Changes'} to the Map`;

/** The breakdown. Memoised: the video above changes every frame, this does not. */
const ChangeList = memo(function ChangeList({ rows, ctx, onPick, onHot }: {
  rows: Array<{ c: AnyChange; d: Described }>; ctx: ChangeCtx; onPick: (c: AnyChange) => void; onHot: (id: string | null) => void;
}) {
  return (
    <div>
      {rows.map(({ c, d }, i) => (
        <button
          key={c.rowId} type="button"
          className="crisis-change-row flex w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E2424] hover:bg-[rgba(142,36,36,0.04)]"
          style={{ gap: 12, padding: '11px 6px', border: 0, borderTop: i ? `1px solid ${CK.hair}` : 0, background: 'transparent', cursor: 'pointer', font: 'inherit', borderRadius: 10, minWidth: 0, animationDelay: `${Math.min(i, 12) * 28}ms` }}
          onClick={() => onPick(c)}
          onMouseEnter={() => onHot(c.rowId)} onMouseLeave={() => onHot(null)} onFocus={() => onHot(c.rowId)} onBlur={() => onHot(null)}
          aria-label={`${d.title}. Show it on the map`}
        >
          <ChangeDisc d={d} />
          <span className="min-w-0 flex-1">
            <b style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</b>
            {d.lines.map((l, j) => <span key={j} style={{ display: 'block', marginTop: 3 }}><PieceLine pieces={l} ctx={ctx} /></span>)}
          </span>
          <span className="crisis-change-go flex-shrink-0 self-center" style={{ color: CK.red, lineHeight: 0 }} aria-hidden title="Show it on the map"><LocateFixed size={19} strokeWidth={1.5} /></span>
        </button>
      ))}
    </div>
  );
});

export default function MapChangesDialog({ stamp, since = false, onClose, onPick }: { stamp: number; /** true: every change from `stamp` until now; false: the one send made at `stamp`. */ since?: boolean; onClose: () => void; onPick: (req: Omit<FocusRequest, 'n'>) => void }) {
  const { ref, staff } = useCrisis();
  const ctx = useChangeCtx();
  const [changes, setChanges] = useState<AnyChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    crisisHistory(ref, since ? { limit: SINCE_LIMIT } : { until: new Date(stamp).toISOString(), limit: 500 })
      .then((rows) => {
        if (cancelled) return;
        const mine = rows
          .filter((r) => {
            const at = new Date(r.created_at).getTime();
            return since ? at >= stamp - SAME_SEND_MS : Math.abs(at - stamp) <= SAME_SEND_MS;
          })
          .map(parseAnyChange)
          .filter((c): c is AnyChange => !!c)
          .reverse();   // oldest first: the order they play in
        setChanges(mine);
      })
      .catch((e) => { if (!cancelled) setError(crisisError(e, 'Could not load these changes.')); });
    return () => { cancelled = true; };
  }, [ref, stamp, since]);

  // ── the video: t from 0 (before the send) to 1 (now) ──
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(0);
  useEffect(() => { tRef.current = t; });
  const n = changes?.length ?? 0;
  const durationMs = 3200 + Math.min(n, 30) * 70;
  const ready = !!changes && changes.length > 0 && !!ctx.world;
  const started = useRef(false);
  useEffect(() => {
    // Plays once when everything is there; with reduced motion it waits at the end until Play is pressed.
    if (!ready) return;
    const id = window.setTimeout(() => {
      if (started.current) return;
      started.current = true;
      if (prefersReducedMotion()) setT(1); else setPlaying(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [ready]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const from = tRef.current >= 1 ? 0 : tRef.current;
    const t0 = performance.now() - from * durationMs;
    const tick = (now: number) => {
      const next = (now - t0) / durationMs;
      if (next >= 1) { setT(1); setPlaying(false); return; }
      setT(next);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [playing, durationMs]);

  const toggle = () => { if (playing) setPlaying(false); else { if (tRef.current >= 1) setT(0); setPlaying(true); } };
  const atEnd = t >= 1 && !playing;

  // What the video is showing now: the change that started last.
  const nowIdx = useMemo(() => {
    if (!changes || t <= 0) return -1;
    let idx = -1;
    changes.forEach((_, i) => { if (t >= startOf(i, changes.length) && progressOf(t, i, changes.length) < 1) idx = i; });
    return idx;
  }, [changes, t]);

  const rows = useMemo(() => (changes ?? []).map((c) => ({ c, d: describe(c, ctx) })), [changes, ctx]);
  const groups = useMemo(
    () => GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.c.filter === g.filter) })).filter((g) => g.rows.length > 0),
    [rows],
  );

  const pick = useCallback((c: AnyChange) => {
    const f = focusForAny(c);
    onPick({ ...f, shape: c.type === 'shape' ? c.shapeId : undefined, char: c.type === 'character' ? c.charId : undefined });
  }, [onPick]);

  const by = staff ? changes?.find((c) => c.by)?.by ?? null : null;
  const eyebrow = `${since ? 'Started ' : ''}${timeAgo(new Date(stamp).toISOString())}${by ? ` · by ${by}` : ''}`;
  const title = changes && changes.length ? countText(changes.length) : 'Changes to the Map';

  return (
    <CrisisDialog title={title} eyebrow={eyebrow} onClose={onClose} width={780}>
      <style>{`
        @keyframes crisisChangeRowIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .crisis-change-row { animation: crisisChangeRowIn 220ms cubic-bezier(0.22,1,0.36,1) both; }
        .crisis-change-row:hover .crisis-change-go, .crisis-change-row:focus-visible .crisis-change-go { opacity: 1; transform: none; }
        .crisis-change-go { opacity: 0.55; transition: opacity 150ms ease-out, transform 150ms ease-out; }
        .crisis-scrub { width: 100%; accent-color: ${CK.red}; }
        @media (prefers-reduced-motion: reduce) { .crisis-change-row { animation: none; } .crisis-change-go { transition: none; } }
      `}</style>

      {error ? (
        <div role="alert" className="flex items-center flex-wrap" style={{ gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: CK.red }}>{error}</span>
          <Btn size="sm" tone="ghost" onClick={onClose}>Close</Btn>
        </div>
      ) : changes === null ? (
        <div className="flex flex-col" style={{ gap: 12 }}><Skeleton h={300} r={18} /><Skeleton h={22} w={260} /><Skeleton h={18} w={180} /></div>
      ) : changes.length === 0 ? (
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: CK.ink }}>There is nothing to show for this one</p>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: CK.inkSoft }}>The changes are no longer in the history, or none of them are for your cabinet.</p>
          <div style={{ marginTop: 16 }}><Btn tone="ghost" onClick={onClose}>Close</Btn></div>
        </div>
      ) : (
        <div>
          <ChangesReplay world={ctx.world} changes={changes} ctx={ctx} t={t} hot={hot} />
          <div className="flex items-center" style={{ gap: 12, marginTop: 12 }}>
            <Btn size="sm" tone="ghost" onClick={toggle} icon={playing ? <Pause size={15} strokeWidth={1.5} aria-hidden /> : atEnd ? <RotateCcw size={15} strokeWidth={1.5} aria-hidden /> : <Play size={15} strokeWidth={1.5} aria-hidden />}>
              {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
            </Btn>
            <input
              type="range" min={0} max={1000} step={1} value={Math.round(t * 1000)} className="crisis-scrub focus:outline-none"
              aria-label="Move through the changes, from before to after"
              onChange={(e) => { setPlaying(false); setT(Number(e.target.value) / 1000); }}
            />
          </div>
          <div className="flex justify-between" style={{ fontSize: 12, fontWeight: 700, color: CK.muted, marginTop: 2 }} aria-hidden>
            <span>Before</span>
            <span style={{ color: CK.inkSoft, textAlign: 'center', overflowWrap: 'anywhere', padding: '0 8px' }}>{nowIdx >= 0 ? describe(changes[nowIdx], ctx).title : ''}</span>
            <span>Now</span>
          </div>

          <h3 style={{ margin: '18px 0 0', fontSize: 15, fontWeight: 800, color: CK.ink }}>Everything That Changed</h3>
          {groups.map((g) => (
            <section key={g.filter} aria-label={g.label} style={{ marginTop: 12 }}>
              <h4 className="flex items-center" style={{ gap: 7, margin: '0 0 2px', fontSize: 13, fontWeight: 800, color: CK.inkSoft }}>
                <g.Icon size={16} strokeWidth={1.5} aria-hidden />
                <span>{g.label}</span>
                <span style={{ fontWeight: 600, color: CK.muted, fontVariantNumeric: 'tabular-nums' }}>{g.rows.length}</span>
              </h4>
              <ChangeList rows={g.rows} ctx={ctx} onPick={pick} onHot={setHot} />
            </section>
          ))}
          <div style={{ marginTop: 14 }}><Btn tone="ghost" onClick={onClose}>Close</Btn></div>
        </div>
      )}
    </CrisisDialog>
  );
}
