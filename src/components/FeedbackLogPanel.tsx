'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FlagImg } from '@/components/FlagImg';
import Portal from '@/components/Portal';
import { Committee } from '@/lib/types';
import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { useLanguage } from '@/contexts/LanguageContext';
import { getScoringConfig } from '@/lib/scoring';
import { addFeedback, updateFeedback, getFeedbackForCommittee } from '@/lib/committeeService';

type ItemKind = 'past' | 'live' | 'next';
interface FeedItem {
  key: string;
  kind: ItemKind;
  country: string;
  context: string;
  seconds?: number;
  timestamp?: string;
}
interface RowState { id?: string; content: string; scores: Record<string, number>; country: string; reconciled?: boolean; }

interface PastSpeech { country: string; context: string; seconds: number; timestamp: string; }
function pastSpeeches(committee: Committee): PastSpeech[] {
  return (committee.messages ?? [])
    .filter((m) => m.sender === '__system__' && m.recipient === '__log__' && m.content.startsWith('__log__:'))
    .map((m) => { try { return JSON.parse(m.content.slice('__log__:'.length)); } catch { return null; } })
    .filter((e): e is { country: string; type?: string; context?: string; seconds?: number; timestamp?: string } =>
      !!e && (!e.type || e.type === 'speech') && typeof e.seconds === 'number')
    .map((e) => ({ country: e.country, context: e.context ?? 'speakers-list', seconds: e.seconds ?? 0, timestamp: e.timestamp ?? '' }));
}

// The context the live/upcoming speakers will be logged under (for later reconciliation).
function liveContext(committee: Committee): string {
  if (committee.caucus) return committee.caucus.type === 'unmoderated' ? 'unmoderated-caucus' : 'moderated-caucus';
  return 'speakers-list';
}

export default function FeedbackLogPanel({ committee, chairName, currentCountry }: {
  committee: Committee; chairName: string; currentCountry: string | null;
}) {
  const { language } = useLanguage();
  const cfg = getScoringConfig(committee);
  const factors = cfg.factors.filter((f) => f.enabled);
  const ctx = liveContext(committee);

  const past = useMemo(() => pastSpeeches(committee), [committee.messages]);
  // Upcoming queue (GSL or caucus), excluding whoever currently holds the floor.
  const queue = (committee.caucus ? committee.caucusQueue : committee.speakersList) ?? [];
  const upcoming = queue.filter((s) => s.country !== currentCountry);

  const [state, setState] = useState<Record<string, RowState>>({});
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const creatingRef = useRef<Set<string>>(new Set());
  const loadedRef = useRef(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const turnStartRef = useRef<number>(Date.now());

  // Focus-dock state. The focused bubble is the hero (editing UI); the live bubble is
  // primary by default. Hover lifts/sharpens any non-focused bubble.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  // Live card key — a fresh turn (even same country, e.g. right of reply) gets a new card.
  const liveKey = currentCountry ? `live|${currentCountry}|${turnStartRef.current}` : null;

  const items: FeedItem[] = useMemo(() => {
    const out: FeedItem[] = [];
    for (const p of past) out.push({ key: `past|${p.country}|${p.timestamp}`, kind: 'past', country: p.country, context: p.context, seconds: p.seconds, timestamp: p.timestamp });
    if (currentCountry && liveKey) out.push({ key: liveKey, kind: 'live', country: currentCountry, context: ctx });
    for (const u of upcoming) out.push({ key: `next|${u.delegateId}`, kind: 'next', country: u.country, context: ctx });
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, currentCountry, liveKey, JSON.stringify(upcoming.map((u) => u.delegateId)), ctx]);

  // Prefill from existing 'speech' feedback — greedy match to past speeches by country+context+seconds.
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      const all = await getFeedbackForCommittee(committee.id);
      const fb = all.filter((f) => f.level === 'speech');
      const used = new Set<string>();
      const next: Record<string, RowState> = {};
      for (const p of past) {
        const match = fb.find((f) => !used.has(f.id) && f.country === p.country &&
          (f.speechContext ?? '') === p.context && (f.speechSeconds ?? 0) === p.seconds);
        if (match) {
          used.add(match.id);
          next[`past|${p.country}|${p.timestamp}`] = { id: match.id, content: match.content, scores: match.factorScores ?? {}, country: p.country, reconciled: true };
        }
      }
      if (Object.keys(next).length) setState((prev) => ({ ...next, ...prev }));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.id, past.length]);

  // On speaker change: new turn, focus returns to the live pill (it rolls into the slot).
  useEffect(() => {
    turnStartRef.current = Date.now();
    setFocusKey(null);
  }, [currentCountry]);

  // Reconcile live/upcoming comments onto a speech once it's actually logged.
  useEffect(() => {
    for (const p of past) {
      const pastKey = `past|${p.country}|${p.timestamp}`;
      if (stateRef.current[pastKey]?.id) continue;
      const candKey = Object.keys(stateRef.current).find((k) =>
        (k.startsWith('live|') || k.startsWith('next|')) &&
        stateRef.current[k].country === p.country &&
        stateRef.current[k].id && !stateRef.current[k].reconciled);
      if (!candKey) continue;
      const entry = stateRef.current[candKey];
      updateFeedback(entry.id!, { speechContext: p.context, speechSeconds: p.seconds });
      setState((prev) => ({
        ...prev,
        [pastKey]: { ...entry, reconciled: true },
        [candKey]: { ...prev[candKey], reconciled: true },
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.messages]);

  const persist = (item: FeedItem, content: string, scores: Record<string, number>) => {
    const cur = stateRef.current[item.key];
    if (cur?.id) { updateFeedback(cur.id, { content, factorScores: scores }); return; }
    if (creatingRef.current.has(item.key)) return;
    creatingRef.current.add(item.key);
    addFeedback(committee.id, item.country, chairName, content, {
      level: 'speech', factorScores: scores, speechContext: item.context, speechSeconds: item.seconds ?? null,
    }).then((id) => {
      creatingRef.current.delete(item.key);
      if (!id) return;
      setState((prev) => {
        const latest = prev[item.key] ?? { content, scores, country: item.country };
        if (latest.content !== content || JSON.stringify(latest.scores) !== JSON.stringify(scores)) {
          updateFeedback(id, { content: latest.content, factorScores: latest.scores });
        }
        return { ...prev, [item.key]: { ...latest, id, country: item.country } };
      });
    });
  };

  const setNote = (item: FeedItem, content: string) =>
    setState((prev) => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { scores: {}, country: item.country }), content, country: item.country } }));
  const setScore = (item: FeedItem, factorId: string, v: number) =>
    setState((prev) => {
      const cur = prev[item.key] ?? { content: '', scores: {}, country: item.country };
      const scores = { ...cur.scores, [factorId]: v };
      const nextRow = { ...cur, scores, country: item.country };
      persist(item, nextRow.content, scores);
      return { ...prev, [item.key]: nextRow };
    });

  const effectiveFocus = focusKey ?? liveKey;
  const focusIdx = items.findIndex((i) => i.key === effectiveFocus);

  // Roll the focused row to the vertical centre whenever focus changes.
  useEffect(() => {
    if (!effectiveFocus) return;
    const id = setTimeout(() => {
      rowRefs.current[effectiveFocus]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 30);
    return () => clearTimeout(id);
  }, [effectiveFocus]);

  // Per-factor dropdown menu, rendered through a Portal so it can't be clipped.
  const [menu, setMenu] = useState<{ key: string; item: FeedItem; factorId: string; rect: DOMRect } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.fb-portal-menu') && !t.closest('.fb-chip')) setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  const MENU_W = 174;
  const PILL_TRANSITION = 'transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease, opacity 260ms ease, box-shadow 260ms ease, background-color 260ms ease';
  const GRID_COL = 300;       // reserved so pills/grids stay aligned across rows
  const tagFor = (item: FeedItem) => item.context === 'speakers-list' ? 'GSL' : (committee.caucus?.motionLabel ?? 'CAUCUS');

  // Distance-based recede (index 0 = focused). Gentle on scale so pills stay wide.
  const scaleByDist = [1, 0.98, 0.96, 0.94];
  const opacityByDist = [1, 0.7, 0.55, 0.45];
  const blurByDist = [0, 0.6, 1.2, 1.6];

  // One 2×2 metric cell.
  const metricCell = (item: FeedItem, f: { id: string; name: string }, v: number, interactive: boolean) => {
    const set = v > 0;
    if (!interactive) {
      return (
        <div key={f.id} className="rounded-lg flex flex-col justify-center px-3 py-1.5" style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(255,255,255,0.5)' }}>
          <span className="text-[9px] uppercase tracking-wide truncate" style={{ color: '#B8AE9C' }}>{f.name}</span>
          <span className="text-base font-black leading-none" style={{ color: '#9A8A78' }}>{set ? v : '–'}</span>
        </div>
      );
    }
    return (
      <button
        key={f.id}
        className="fb-chip rounded-lg flex flex-col justify-center px-3 py-1.5 text-left"
        onClick={(e) => {
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const mk = `${item.key}|${f.id}`;
          setMenu((m) => (m?.key === mk ? null : { key: mk, item, factorId: f.id, rect }));
        }}
        style={{ border: `1px solid ${set ? '#1B3828' : '#DDD4C0'}`, backgroundColor: set ? '#1B3828' : '#FFFFFF' }}
      >
        <span className="text-[9px] uppercase tracking-wide truncate" style={{ color: set ? 'rgba(238,217,138,0.8)' : '#9A8A78' }}>{f.name}</span>
        <span className="text-base font-black leading-none" style={{ color: set ? '#EED98A' : '#1B3828' }}>{set ? v : '–'}</span>
      </button>
    );
  };

  const metricGrid = (item: FeedItem, rs: RowState, interactive: boolean) => (
    <div className="grid gap-2" style={{ width: GRID_COL, gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto' }}>
      {factors.slice(0, 4).map((f) => metricCell(item, f, rs.scores[f.id] ?? 0, interactive))}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ fontFamily: "'Poppins','Outfit',sans-serif" }}>
      <style>{`.fb-dock-scroll::-webkit-scrollbar{display:none}`}</style>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs px-4" style={{ color: '#9A8A78' }}>Comments appear here as delegates take the floor.</p>
        </div>
      ) : (
        <div className="fb-dock-scroll flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="min-h-full flex flex-col justify-center gap-3 py-8 px-6">
            {items.map((item, idx) => {
              const rs = state[item.key] ?? { content: '', scores: {}, country: item.country };
              const isLive = item.kind === 'live';
              const isFocused = item.key === effectiveFocus;
              const isHover = hoverKey === item.key && !isFocused;
              const scored = Object.values(rs.scores).some((x) => (x ?? 0) > 0);
              const dist = focusIdx >= 0 ? Math.min(Math.abs(idx - focusIdx), 3) : 0;

              let scale = scaleByDist[dist], opacity = opacityByDist[dist], blur = blurByDist[dist];
              let boxShadow = '0 3px 12px rgba(28,20,16,0.07)';
              if (isFocused) {
                scale = 1; opacity = 1; blur = 0;
                boxShadow = '0 0 0 2px #B8844A, 0 14px 36px rgba(28,20,16,0.18)';
              } else if (isHover) {
                scale = 1.02; opacity = 1; blur = 0;
                boxShadow = '0 10px 26px rgba(28,20,16,0.16)';
              }

              return (
                <div
                  key={item.key}
                  ref={(el) => { rowRefs.current[item.key] = el; }}
                  className="w-full flex items-center gap-3 shrink-0"
                  style={{ opacity, transition: PILL_TRANSITION }}
                >
                  {isFocused ? (
                    /* Active — wide, 2-row writing bubble */
                    <div
                      className="flex-1 min-w-0"
                      style={{
                        borderRadius: 22, backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(221,212,192,0.85)', boxShadow,
                        transform: `scale(${scale})`, transformOrigin: 'center', transition: PILL_TRANSITION,
                        padding: '12px 16px',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-black uppercase tracking-wider shrink-0" style={{ color: '#1B3828' }}>{tagFor(item)}</span>
                        <FlagImg code={getCountryByName(item.country)?.code ?? ''} size={26} className="shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-base font-bold" style={{ color: '#1C1410' }}>{getCountryDisplayName(item.country, language)}</span>
                        {!isLive && <button onClick={(e) => { e.stopPropagation(); setFocusKey(null); }} className="shrink-0 text-sm" style={{ color: '#9A8A78' }}>✕</button>}
                      </div>
                      <textarea
                        rows={2}
                        value={rs.content}
                        onChange={(e) => setNote(item, e.target.value)}
                        onBlur={() => persist(item, rs.content, rs.scores)}
                        placeholder="Private note…"
                        className="w-full mt-2 text-sm rounded-lg px-3 py-2 outline-none resize-none"
                        style={{ color: '#1C1410', backgroundColor: '#FAF8F3', border: '1px solid #EDE7D8' }}
                      />
                    </div>
                  ) : (
                    /* Collapsed capsule — shows the note written for this delegate */
                    <div
                      onMouseEnter={() => setHoverKey(item.key)}
                      onMouseLeave={() => setHoverKey((k) => (k === item.key ? null : k))}
                      onClick={() => setFocusKey(item.key)}
                      className="flex-1 min-w-0 flex items-center gap-3"
                      style={{
                        height: 54, borderRadius: 9999, backgroundColor: '#EDE7D8',
                        border: '1px solid rgba(221,212,192,0.85)', boxShadow,
                        transform: `scale(${scale})`, filter: blur ? `blur(${blur}px)` : 'none',
                        transformOrigin: 'center', transition: PILL_TRANSITION,
                        cursor: 'pointer', padding: '0 20px',
                      }}
                    >
                      <FlagImg code={getCountryByName(item.country)?.code ?? ''} size={22} className="shrink-0" />
                      <span className="font-semibold shrink-0" style={{ color: '#1C1410' }}>{getCountryDisplayName(item.country, language)}</span>
                      {rs.content && rs.content.trim()
                        ? <span className="flex-1 min-w-0 truncate text-sm" style={{ color: '#6A5A4A' }}>— {rs.content}</span>
                        : <span className="flex-1" />}
                      {scored && <span className="shrink-0 text-sm font-black" style={{ color: '#1B3828' }}>✓</span>}
                    </div>
                  )}

                  {/* 2×2 metric grid — interactive for focused, greyed read-only for nearest, absent otherwise */}
                  <div className="shrink-0" style={{ width: GRID_COL }}>
                    {factors.length > 0 && (isFocused || dist === 1) && metricGrid(item, rs, isFocused)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scoring menu — portaled so nothing clips it; opens upward, right-aligned to the cell. */}
      {menu && (() => {
        const v = (state[menu.item.key]?.scores ?? {})[menu.factorId] ?? 0;
        return (
          <Portal>
            <div
              className="fb-portal-menu rounded-xl p-2 shadow-xl"
              style={{
                position: 'fixed', zIndex: 50,
                left: Math.max(8, menu.rect.right - MENU_W),
                bottom: Math.max(8, window.innerHeight - menu.rect.top + 6),
                width: MENU_W,
                backgroundColor: '#FFFFFF', border: '1px solid #DDD4C0',
                fontFamily: "'Poppins','Outfit',sans-serif",
              }}
            >
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                {Array.from({ length: cfg.factorScaleMax }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => { setScore(menu.item, menu.factorId, n); setMenu(null); }}
                    className="rounded-md text-xs font-bold flex items-center justify-center"
                    style={{ height: 26, border: '1px solid #DDD4C0', backgroundColor: v === n ? '#1B3828' : '#FAF8F3', color: v === n ? '#EED98A' : '#1B3828' }}
                  >{n}</button>
                ))}
              </div>
              <button
                onClick={() => { setScore(menu.item, menu.factorId, 0); setMenu(null); }}
                className="mt-1.5 w-full text-[11px] font-bold rounded-md py-1"
                style={{ color: '#8B2020', border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF' }}
              >Clear</button>
            </div>
          </Portal>
        );
      })()}
    </div>
  );
}
