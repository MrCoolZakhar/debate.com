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
  const currentCardRef = useRef<HTMLDivElement | null>(null);
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

  // On speaker change: new turn, focus returns to the live bubble, and it glides to centre.
  useEffect(() => {
    turnStartRef.current = Date.now();
    setFocusKey(null);
    const id = setTimeout(() => {
      currentCardRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(id);
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

  // Per-factor dropdown menu, rendered through a Portal so it can't be clipped by the dock.
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
  const BUBBLE_TRANSITION = 'transform 240ms cubic-bezier(.2,.8,.2,1), filter 240ms ease, opacity 240ms ease, box-shadow 240ms ease';

  return (
    <div
      className="shrink-0 flex flex-col overflow-hidden"
      style={{
        height: 220, margin: 12, borderRadius: 24,
        border: '1px solid rgba(221,212,192,0.7)',
        boxShadow: '0 16px 48px rgba(28,20,16,0.22)',
        backgroundColor: 'rgba(250,248,243,0.82)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        fontFamily: "'Poppins','Outfit',sans-serif",
      }}
    >
      <style>{`.fb-dock-scroll::-webkit-scrollbar{display:none}`}</style>
      <div className="flex items-center gap-2 px-4 pt-2 pb-1 shrink-0">
        <div className="w-1 h-3 rounded-full" style={{ backgroundColor: 'rgba(238,217,138,0.8)' }} />
        <span className="text-[11px] font-bold tracking-wide" style={{ color: '#9A8A78' }}>Feedback log</span>
        <span className="text-[10px]" style={{ color: 'rgba(154,138,120,0.7)' }}>· private to chairs</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs px-4 py-6" style={{ color: '#9A8A78' }}>Comments appear here as delegates take the floor.</p>
      ) : (
        <div className="fb-dock-scroll flex-1 min-h-0 flex items-end gap-3 overflow-x-auto px-4 py-5" style={{ scrollbarWidth: 'none' }}>
          {items.map((item) => {
            const rs = state[item.key] ?? { content: '', scores: {}, country: item.country };
            const isLive = item.kind === 'live';
            const isFocused = item.key === effectiveFocus;
            const isHover = hoverKey === item.key && !isFocused;
            const scored = !!(rs.content && rs.content.trim()) || Object.values(rs.scores).some((x) => (x ?? 0) > 0);
            const label = item.kind === 'next'
              ? 'up next'
              : `${item.context.replace(/-/g, ' ')}${item.seconds ? ` · ${item.seconds}s` : ''}${item.timestamp ? ` · ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`;

            // Resolve the bubble's motion state.
            let transform = 'scale(1)', opacity = 1, filter = 'none';
            let boxShadow = '0 4px 14px rgba(28,20,16,0.08)';
            if (isFocused) {
              transform = 'scale(1.06)'; opacity = 1; filter = 'none';
              boxShadow = '0 0 0 2px #B8844A, 0 12px 32px rgba(28,20,16,0.18)';
            } else if (isHover) {
              transform = 'scale(1.04)'; opacity = 1; filter = 'none';
              boxShadow = '0 10px 26px rgba(28,20,16,0.16)';
            } else if (item.kind === 'next') {
              transform = 'scale(.9)'; opacity = 0.6; filter = 'blur(1.3px) saturate(.95)';
            } else {
              // past, or live that isn't currently focused
              transform = 'scale(.92)'; opacity = item.kind === 'live' ? 0.82 : 0.68; filter = 'none';
            }

            return (
              <div
                key={item.key}
                ref={isLive ? currentCardRef : undefined}
                onMouseEnter={() => setHoverKey(item.key)}
                onMouseLeave={() => setHoverKey((k) => (k === item.key ? null : k))}
                onClick={isFocused ? undefined : () => setFocusKey(item.key)}
                className="rounded-2xl shrink-0"
                style={{
                  transform, opacity, filter, boxShadow,
                  transition: BUBBLE_TRANSITION, transformOrigin: 'bottom center',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  border: '1px solid rgba(221,212,192,0.8)',
                  cursor: isFocused ? 'default' : 'pointer',
                  width: isFocused ? 300 : undefined,
                  padding: isFocused ? 14 : '10px 14px',
                }}
              >
                {isFocused ? (
                  <>
                    <div
                      className="flex items-center gap-2.5 mb-2"
                      onClick={isLive ? undefined : (e) => { e.stopPropagation(); setFocusKey(null); }}
                      style={{ cursor: isLive ? 'default' : 'pointer' }}
                    >
                      <FlagImg code={getCountryByName(item.country)?.code ?? ''} size={38} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xl font-black truncate leading-tight" style={{ color: '#1C1410' }}>{getCountryDisplayName(item.country, language)}</div>
                        <div className="text-[10px] font-mono uppercase tracking-wide truncate" style={{ color: isLive ? '#B8844A' : '#9A8A78' }}>{label}</div>
                      </div>
                      {!isLive && <span className="text-[11px] shrink-0" style={{ color: '#9A8A78' }}>▾</span>}
                    </div>
                    <input
                      value={rs.content}
                      onChange={(e) => setNote(item, e.target.value)}
                      onBlur={() => persist(item, rs.content, rs.scores)}
                      placeholder="Private note…"
                      className="w-full text-xs bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2.5 py-2 outline-none focus:border-[#1B3828]"
                      style={{ color: '#1C1410' }}
                    />
                    {factors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {factors.map((f) => {
                          const v = rs.scores[f.id] ?? 0;
                          return (
                            <button
                              key={f.id}
                              className="fb-chip flex items-center gap-1 rounded-lg text-xs font-semibold"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                const mk = `${item.key}|${f.id}`;
                                setMenu((m) => (m?.key === mk ? null : { key: mk, item, factorId: f.id, rect }));
                              }}
                              style={{ minHeight: 30, padding: '0 9px', border: '1px solid #DDD4C0', backgroundColor: v > 0 ? '#1B3828' : '#FFFFFF', color: v > 0 ? '#EED98A' : '#1B3828' }}
                            >
                              <span className="truncate" style={{ maxWidth: 90 }}>{f.name}</span>
                              <span>· {v > 0 ? v : '–'}</span>
                              <span style={{ fontSize: 9, opacity: 0.75 }}>▾</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <FlagImg code={getCountryByName(item.country)?.code ?? ''} size={18} className="shrink-0" />
                    <span className="text-sm font-semibold truncate" style={{ color: '#1C1410', maxWidth: 130 }}>{getCountryDisplayName(item.country, language)}</span>
                    {scored && <span className="text-xs font-black shrink-0" style={{ color: '#1B3828' }}>✓</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Scoring menu — portaled so the dock's overflow can't clip it; opens upward, right-aligned. */}
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
