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

export default function FeedbackLogPanel({ committee, chairName, onClose }: {
  committee: Committee; chairName: string; onClose: () => void;
}) {
  const { language } = useLanguage();
  const cfg = getScoringConfig(committee);
  const factors = cfg.factors.filter((f) => f.enabled);
  const rows = useMemo(() => speechRows(committee), [committee.messages]);
  const [state, setState] = useState<Record<string, RowState>>({});
  const loadedRef = useRef(false);

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

  return (
    <div className="fixed top-0 right-0 bottom-0 z-40 w-[26rem] max-w-full flex flex-col shadow-2xl"
      style={{ backgroundColor: '#FAF8F3', borderLeft: '1px solid #DDD4C0', fontFamily: "'Poppins','Outfit',sans-serif" }}>
      <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ backgroundColor: '#1B3828' }}>
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#EED98A' }} />
        <span className="text-sm font-black tracking-wide" style={{ color: '#EED98A' }}>Feedback log</span>
        <span className="text-[10px]" style={{ color: 'rgba(238,217,138,0.6)' }}>private to chairs</span>
        <button onClick={onClose} className="ms-auto text-[#EDE7D8] hover:text-white text-lg leading-none">✕</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {rows.length === 0 && (
          <p className="text-xs text-center py-8" style={{ color: '#9A8A78' }}>Speeches will appear here as delegates speak.</p>
        )}
        {[...rows].reverse().map((row) => {
          const rs = state[row.key] ?? { content: '', scores: {} };
          return (
            <div key={row.key} className="rounded-xl p-2.5" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <FlagImg code={getCountryByName(row.country)?.code ?? ''} size={18} className="shrink-0" />
                <span className="text-sm font-semibold truncate flex-1" style={{ color: '#1C1410' }}>{getCountryDisplayName(row.country, language)}</span>
                <span className="text-[10px] font-mono" style={{ color: '#9A8A78' }}>{row.context.replace(/-/g, ' ')} · {row.seconds}s</span>
                <span className="text-[10px] font-mono" style={{ color: '#9A8A78' }}>{row.timestamp ? new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
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
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {factors.map((f) => (
                    <label key={f.id} className="flex items-center gap-1 text-[10px]" style={{ color: '#6A5A4A' }}>
                      <span className="truncate max-w-[80px]">{f.name}</span>
                      <input type="number" min={1} max={cfg.factorScaleMax} value={rs.scores[f.id] ?? ''}
                        onChange={(e) => setScore(row, f.id, parseInt(e.target.value) || 0)}
                        className="w-10 text-center bg-white border border-[#DDD4C0] rounded px-1 py-0.5 outline-none focus:border-[#1B3828]" />
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
