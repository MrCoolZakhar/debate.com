'use client';

import { useEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { FlagImg } from '@/components/FlagImg';
import { Committee } from '@/lib/types';
import { getCountryByName, getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { useLanguage } from '@/contexts/LanguageContext';
import { getScoringConfig } from '@/lib/scoring';
import { addFeedback, getFeedbackForCommittee, type FeedbackLevel } from '@/lib/committeeService';

interface DraftState { scores: Record<string, number>; note: string; saved: boolean; }

export default function RecapComposer({ committee, chairName, onClose }: {
  committee: Committee; chairName: string; onClose: () => void;
}) {
  const { language } = useLanguage();
  const cfg = getScoringConfig(committee);
  const factors = cfg.factors.filter((f) => f.enabled);
  const [level, setLevel] = useState<FeedbackLevel>('session');
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const loadedLevel = useRef<string | null>(null);

  const delegates = [...committee.delegates].sort((a, b) => compareCountryNames(a.country, b.country, language));

  // Pre-fill drafts from the latest existing recap at this level.
  useEffect(() => {
    if (loadedLevel.current === level) return;
    loadedLevel.current = level;
    (async () => {
      const all = await getFeedbackForCommittee(committee.id);
      const atLevel = all.filter((f) => f.level === level);
      const next: Record<string, DraftState> = {};
      for (const d of committee.delegates) {
        const latest = atLevel.filter((f) => f.country === d.country)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
        if (latest) next[d.country] = { scores: latest.factorScores ?? {}, note: latest.content ?? '', saved: true };
      }
      setDrafts(next);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, committee.id]);

  const setScore = (country: string, factorId: string, v: number) =>
    setDrafts((p) => ({ ...p, [country]: { ...(p[country] ?? { scores: {}, note: '', saved: false }), scores: { ...(p[country]?.scores ?? {}), [factorId]: v }, saved: false } }));
  const setNote = (country: string, note: string) =>
    setDrafts((p) => ({ ...p, [country]: { ...(p[country] ?? { scores: {}, note: '', saved: false }), note, saved: false } }));

  const save = (country: string) => {
    const d = drafts[country];
    if (!d) return;
    addFeedback(committee.id, country, chairName, d.note, { level, factorScores: d.scores });
    setDrafts((p) => ({ ...p, [country]: { ...d, saved: true } }));
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(28,20,16,0.45)' }} onClick={onClose}>
        <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: '88vh', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', fontFamily: "'Poppins','Outfit',sans-serif" }} onClick={(e) => e.stopPropagation()}>
          <div className="px-5 py-3 flex items-center gap-3 shrink-0" style={{ backgroundColor: '#1B3828' }}>
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#EED98A' }} />
            <span className="text-sm font-black tracking-wide" style={{ color: '#EED98A' }}>Recap</span>
            <button onClick={onClose} className="ms-auto text-[#EDE7D8] hover:text-white text-lg leading-none">✕</button>
          </div>

          <div className="flex gap-1 px-4 pt-3 shrink-0">
            {(['session', 'conference'] as FeedbackLevel[]).map((lvl) => (
              <button key={lvl} onClick={() => setLevel(lvl)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors"
                style={{ backgroundColor: level === lvl ? '#1B3828' : 'transparent', color: level === lvl ? '#EED98A' : '#6A5A4A', border: level === lvl ? 'none' : '1px solid #DDD4C0' }}>
                {lvl} recap
              </button>
            ))}
          </div>
          <p className="text-[11px] px-4 pt-2 shrink-0" style={{ color: '#9A8A78' }}>
            {level === 'conference' ? 'The cumulative recap delegates receive at the end.' : 'A checkpoint recap for this session.'} Notes stay private.
          </p>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {delegates.map((d) => {
              const draft = drafts[d.country] ?? { scores: {}, note: '', saved: false };
              return (
                <div key={d.id} className="rounded-xl p-3" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <FlagImg code={getCountryByName(d.country)?.code ?? ''} size={18} className="shrink-0" />
                    <span className="text-sm font-semibold flex-1 truncate" style={{ color: '#1C1410' }}>{getCountryDisplayName(d.country, language)}</span>
                    <button onClick={() => save(d.country)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: draft.saved ? '#3D7A52' : '#1B3828', color: '#EED98A' }}>
                      {draft.saved ? 'Saved ✓' : 'Save'}
                    </button>
                  </div>
                  {factors.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {factors.map((f) => (
                        <label key={f.id} className="flex items-center gap-1 text-[11px]" style={{ color: '#6A5A4A' }}>
                          <span>{f.name}</span>
                          <input type="number" min={1} max={cfg.factorScaleMax} value={draft.scores[f.id] ?? ''}
                            onChange={(e) => setScore(d.country, f.id, parseInt(e.target.value) || 0)}
                            className="w-12 text-center bg-[#FAF8F3] border border-[#DDD4C0] rounded px-1 py-0.5 outline-none focus:border-[#1B3828]" />
                          <span style={{ color: '#9A8A78' }}>/{cfg.factorScaleMax}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <input value={draft.note} onChange={(e) => setNote(d.country, e.target.value)} placeholder="Private note (optional)…"
                    className="w-full text-xs bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1.5 outline-none focus:border-[#1B3828]" style={{ color: '#1C1410' }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Portal>
  );
}
