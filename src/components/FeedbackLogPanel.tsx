'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FlagImg } from '@/components/FlagImg';
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

  // On speaker change: new turn, and after 5s auto-focus the live card (chair can scroll anytime before then).
  useEffect(() => {
    turnStartRef.current = Date.now();
    const id = setTimeout(() => {
      currentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 5000);
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
  const step = (item: FeedItem, factorId: string, cur: number, delta: number) => {
    let next = (cur || 0) + delta;
    if (next < 1) next = 0;
    if (next > cfg.factorScaleMax) next = cfg.factorScaleMax;
    setScore(item, factorId, next);
  };

  const kindStyle: Record<ItemKind, React.CSSProperties> = {
    past: { opacity: 0.55, border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF' },
    live: { opacity: 1, border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', boxShadow: '0 0 0 2px #B8844A' },
    next: { opacity: 0.8, border: '1px dashed #DDD4C0', backgroundColor: '#FAF8F3' },
  };

  return (
    <div className="w-full shrink-0 flex flex-col" style={{ height: 200, borderTop: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', fontFamily: "'Poppins','Outfit',sans-serif" }}>
      <div className="flex items-center gap-2 px-4 py-1.5 shrink-0" style={{ borderBottom: '1px solid #DDD4C0' }}>
        <div className="w-1 h-3.5 rounded-full" style={{ backgroundColor: '#EED98A' }} />
        <span className="text-xs font-black tracking-wide" style={{ color: '#1B3828' }}>Feedback log</span>
        <span className="text-[10px]" style={{ color: '#9A8A78' }}>· private to chairs</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
        {items.length === 0 ? (
          <p className="text-xs px-1 py-4" style={{ color: '#9A8A78' }}>Comments appear here as delegates take the floor.</p>
        ) : items.map((item) => {
          const rs = state[item.key] ?? { content: '', scores: {}, country: item.country };
          const label = item.kind === 'next'
            ? 'up next'
            : `${item.context.replace(/-/g, ' ')}${item.seconds ? ` · ${item.seconds}s` : ''}${item.timestamp ? ` · ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`;
          return (
            <div
              key={item.key}
              ref={item.kind === 'live' ? currentCardRef : undefined}
              className="rounded-xl p-2 shrink-0"
              style={kindStyle[item.kind]}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <FlagImg code={getCountryByName(item.country)?.code ?? ''} size={18} className="shrink-0" />
                <span className="text-sm font-semibold truncate" style={{ color: '#1C1410' }}>{getCountryDisplayName(item.country, language)}</span>
                <span className="text-[9px] font-mono uppercase tracking-wide" style={{ color: item.kind === 'live' ? '#B8844A' : '#9A8A78' }}>{label}</span>
              </div>
              <div className="flex items-stretch gap-2">
                <input
                  value={rs.content}
                  onChange={(e) => setNote(item, e.target.value)}
                  onBlur={() => persist(item, rs.content, rs.scores)}
                  placeholder="Private note…"
                  className="flex-1 min-w-0 text-xs bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1.5 outline-none focus:border-[#1B3828]"
                  style={{ color: '#1C1410' }}
                />
                {factors.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    {factors.slice(0, 4).map((f) => {
                      const v = rs.scores[f.id] ?? 0;
                      return (
                        <div key={f.id} className="flex flex-col items-center">
                          <span className="text-[8px] uppercase tracking-wide truncate max-w-[56px]" style={{ color: '#9A8A78' }}>{f.name}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => step(item, f.id, v, -1)} aria-label={`Decrease ${f.name}`}
                              className="flex items-center justify-center rounded-md font-bold leading-none"
                              style={{ width: 24, height: 24, border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1B3828' }}>−</button>
                            <span className="text-xs font-mono text-center" style={{ width: 16, color: v > 0 ? '#1B3828' : '#9A8A78' }}>{v > 0 ? v : '–'}</span>
                            <button onClick={() => step(item, f.id, v, 1)} aria-label={`Increase ${f.name}`}
                              className="flex items-center justify-center rounded-md font-bold leading-none"
                              style={{ width: 24, height: 24, border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1B3828' }}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
