'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FlagImg } from '@/components/FlagImg';
import { Committee } from '@/lib/types';
import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { useLanguage } from '@/contexts/LanguageContext';
import { getScoringConfig } from '@/lib/scoring';
import { addFeedback, updateFeedback, getFeedbackForCommittee } from '@/lib/committeeService';

interface SpeechRow {
  key: string;       // country|timestamp
  country: string;
  context: string;
  seconds: number;
  timestamp: string;
}

interface RowState { id?: string; content: string; scores: Record<string, number>; }

// Parse speech log events into capture rows (chronological).
function speechRows(committee: Committee): SpeechRow[] {
  return (committee.messages ?? [])
    .filter((m) => m.sender === '__system__' && m.recipient === '__log__' && m.content.startsWith('__log__:'))
    .map((m) => { try { return JSON.parse(m.content.slice('__log__:'.length)); } catch { return null; } })
    .filter((e): e is { country: string; type?: string; context?: string; seconds?: number; timestamp?: string } =>
      !!e && (!e.type || e.type === 'speech') && typeof e.seconds === 'number')
    .map((e) => ({
      key: `${e.country}|${e.timestamp ?? ''}`,
      country: e.country,
      context: e.context ?? 'speakers-list',
      seconds: e.seconds ?? 0,
      timestamp: e.timestamp ?? '',
    }));
}

export default function FeedbackLogPanel({ committee, chairName, currentCountry }: {
  committee: Committee; chairName: string; currentCountry: string | null;
}) {
  const { language } = useLanguage();
  const cfg = getScoringConfig(committee);
  const factors = cfg.factors.filter((f) => f.enabled);
  const rows = useMemo(() => speechRows(committee), [committee.messages]);
  const [state, setState] = useState<Record<string, RowState>>({});
  const loadedRef = useRef(false);
  const currentCardRef = useRef<HTMLDivElement | null>(null);

  // Newest first — the leading (left) edge holds the most recent speech.
  const ordered = useMemo(() => [...rows].reverse(), [rows]);
  // First card (newest) belonging to the live speaker — the one we ring + scroll to.
  const highlightKey = currentCountry ? ordered.find((r) => r.country === currentCountry)?.key ?? null : null;

  // Pre-fill from existing 'speech' feedback — greedy match by country+context+seconds.
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      const all = await getFeedbackForCommittee(committee.id);
      const speechFb = all.filter((f) => f.level === 'speech');
      const used = new Set<string>();
      const next: Record<string, RowState> = {};
      for (const r of rows) {
        const match = speechFb.find((f) =>
          !used.has(f.id) && f.country === r.country &&
          (f.speechContext ?? '') === r.context && (f.speechSeconds ?? 0) === r.seconds);
        if (match) {
          used.add(match.id);
          next[r.key] = { id: match.id, content: match.content, scores: match.factorScores ?? {} };
        }
      }
      if (Object.keys(next).length) setState((prev) => ({ ...next, ...prev }));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee.id, rows.length]);

  // Scroll the live speaker's card into view when the speaker changes.
  useEffect(() => {
    currentCardRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, [highlightKey]);

  const persist = async (row: SpeechRow, content: string, scores: Record<string, number>) => {
    const cur = state[row.key];
    if (cur?.id) {
      updateFeedback(cur.id, { content, factorScores: scores });
    } else {
      const id = await addFeedback(committee.id, row.country, chairName, content, {
        level: 'speech', factorScores: scores, speechContext: row.context, speechSeconds: row.seconds,
      });
      if (id) setState((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? { content, scores }), id } }));
    }
  };

  const setNote = (row: SpeechRow, content: string) =>
    setState((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? { scores: {} }), content } }));
  const setScore = (row: SpeechRow, factorId: string, v: number) =>
    setState((prev) => {
      const cur = prev[row.key] ?? { content: '', scores: {} };
      const scores = { ...cur.scores, [factorId]: v };
      const nextRow = { ...cur, scores };
      persist(row, nextRow.content, scores);
      return { ...prev, [row.key]: nextRow };
    });

  // +/− stepper: clamp 1…max; stepping below 1 unsets (0).
  const step = (row: SpeechRow, factorId: string, cur: number, delta: number) => {
    let next = (cur || 0) + delta;
    if (next < 1) next = 0;
    if (next > cfg.factorScaleMax) next = cfg.factorScaleMax;
    setScore(row, factorId, next);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex flex-col"
      style={{ backgroundColor: '#FAF8F3', borderTop: '1px solid #DDD4C0', maxHeight: '200px', fontFamily: "'Poppins','Outfit',sans-serif" }}>
      <div className="flex items-center gap-2 px-4 py-1.5 shrink-0" style={{ borderBottom: '1px solid #DDD4C0' }}>
        <div className="w-1 h-3.5 rounded-full" style={{ backgroundColor: '#EED98A' }} />
        <span className="text-xs font-black tracking-wide" style={{ color: '#1B3828' }}>Feedback log</span>
        <span className="text-[10px]" style={{ color: '#9A8A78' }}>· private to chairs</span>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        {ordered.length === 0 ? (
          <p className="text-xs px-4 py-6" style={{ color: '#9A8A78' }}>Speeches will appear here as delegates speak.</p>
        ) : (
          <div className="flex gap-2 p-2.5" style={{ width: 'max-content' }}>
            {ordered.map((row) => {
              const rs = state[row.key] ?? { content: '', scores: {} };
              const isCurrent = row.key === highlightKey;
              return (
                <div
                  key={row.key}
                  ref={isCurrent ? currentCardRef : undefined}
                  className="rounded-xl p-2.5 shrink-0"
                  style={{ width: 260, border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', boxShadow: isCurrent ? '0 0 0 2px #B8844A' : undefined }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <FlagImg code={getCountryByName(row.country)?.code ?? ''} size={18} className="shrink-0" />
                    <span className="text-sm font-semibold truncate flex-1" style={{ color: '#1C1410' }}>{getCountryDisplayName(row.country, language)}</span>
                    <span className="text-[9px] font-mono shrink-0" style={{ color: '#9A8A78' }}>
                      {row.context.replace(/-/g, ' ')} · {row.seconds}s{row.timestamp ? ` · ${new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </span>
                  </div>
                  <input
                    value={rs.content}
                    onChange={(e) => setNote(row, e.target.value)}
                    onBlur={() => persist(row, rs.content, rs.scores)}
                    placeholder="Private note…"
                    className="w-full text-xs bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1.5 outline-none focus:border-[#1B3828]"
                    style={{ color: '#1C1410' }}
                  />
                  {factors.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {factors.map((f) => {
                        const v = rs.scores[f.id] ?? 0;
                        return (
                          <div key={f.id} className="flex items-center gap-1.5">
                            <span className="text-[10px] truncate flex-1" style={{ color: '#6A5A4A' }}>{f.name}</span>
                            <button onClick={() => step(row, f.id, v, -1)} aria-label={`Decrease ${f.name}`}
                              className="flex items-center justify-center rounded-md font-bold leading-none"
                              style={{ width: 24, height: 24, border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1B3828' }}>−</button>
                            <span className="text-xs font-mono text-center" style={{ width: 18, color: v > 0 ? '#1B3828' : '#9A8A78' }}>{v > 0 ? v : '–'}</span>
                            <button onClick={() => step(row, f.id, v, 1)} aria-label={`Increase ${f.name}`}
                              className="flex items-center justify-center rounded-md font-bold leading-none"
                              style={{ width: 24, height: 24, border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1B3828' }}>+</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
