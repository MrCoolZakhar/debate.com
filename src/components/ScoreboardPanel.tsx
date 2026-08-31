'use client';

import { useEffect, useState } from 'react';
import Portal from '@/components/Portal';
import { FlagImg } from '@/components/FlagImg';
import { Committee } from '@/lib/types';
import { getCountryByName, getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { useLanguage } from '@/contexts/LanguageContext';
import { computeObjectiveScore, computeLedger, parseLedgerEvents, getScoringConfig, computeQualityScore, computeHeadline, type LedgerRow } from '@/lib/scoring';
import { logEvent, getFeedbackForCommittee, type FeedbackEntry } from '@/lib/committeeService';

interface MatrixRow {
  country: string;
  gsl: number; caucus: number; seconds: number;
  motions: number; rtr: number; wp: number; dr: number;
  manual: number; total: number;
}

function buildMatrix(committee: Committee): MatrixRow[] {
  const events = parseLedgerEvents(committee);
  return committee.delegates.map((d) => {
    const mine = events.filter((e) => e.country === d.country);
    const speeches = mine.filter((e) => (e.type ?? 'speech') === 'speech');
    const gsl = speeches.filter((e) => e.context === 'speakers-list').length;
    const caucus = speeches.filter((e) => e.context !== 'speakers-list').length;
    const seconds = speeches.reduce((s, e) => s + (e.seconds ?? 0), 0);
    const motions = mine.filter((e) => e.type === 'motion-raised').length;
    const rtr = mine.filter((e) => e.type === 'right-of-reply').length;
    const docs = (committee.documents ?? []).filter((doc) => doc.sponsors.includes(d.country));
    const wp = docs.filter((doc) => doc.type === 'working-paper').length;
    const dr = docs.filter((doc) => doc.type === 'draft-resolution').length;
    const manual = mine
      .filter((e) => e.type === 'manual-award' || e.type === 'manual-deduct')
      .reduce((s, e) => s + (e.type === 'manual-deduct' ? -Math.abs(e.value ?? 0) : Math.abs(e.value ?? 0)), 0);
    const total = computeObjectiveScore(committee, d.country).total;
    return { country: d.country, gsl, caucus, seconds, motions, rtr, wp, dr, manual, total };
  });
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ScoreboardPanel({ committee, onClose }: { committee: Committee; onClose: () => void }) {
  const { language } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'ranking' | 'matrix'>('ranking');
  const [awardAmt, setAwardAmt] = useState('');
  const [awardNote, setAwardNote] = useState('');
  const [deduct, setDeduct] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);

  useEffect(() => {
    getFeedbackForCommittee(committee.id).then(setFeedback);
  }, [committee.id]);

  const cfg = getScoringConfig(committee);
  // Headline = objective total blended with quality (chair recap factor scores) per config.
  const headlineFor = (country: string) => {
    const obj = computeObjectiveScore(committee, country).total;
    const quality = computeQualityScore(feedback, country, cfg);
    return computeHeadline(obj, quality, cfg.scoreBlend);
  };

  const ranked = [...committee.delegates]
    .map((d) => ({ country: d.country, total: headlineFor(d.country) }))
    .sort((a, b) => b.total - a.total || compareCountryNames(a.country, b.country, language));

  const matrix = buildMatrix(committee);

  const flag = (country: string) => (
    <FlagImg code={getCountryByName(country)?.code ?? ''} size={20} className="shrink-0" />
  );

  const submitManual = () => {
    const amt = parseInt(awardAmt);
    if (!selected || !awardAmt || isNaN(amt) || amt <= 0 || !awardNote.trim()) return;
    logEvent(committee.id, {
      country: selected,
      type: deduct ? 'manual-deduct' : 'manual-award',
      value: amt, note: awardNote.trim(),
    }, committee.code, committee.dbChairJoinSuffix ?? undefined);
    setAwardAmt(''); setAwardNote('');
  };

  const exportCsv = () => {
    // Comment on a specific speech (matched by country + context + seconds), as in the drill-in.
    const commentFor = (country: string, r: LedgerRow): string => {
      if (r.type !== 'speech') return '';
      const fb = feedback.find((f) => f.level === 'speech' && f.country === country &&
        (f.speechContext ?? '') === (r.context ?? '') && (f.speechSeconds ?? 0) === (r.seconds ?? 0));
      return fb?.content ?? '';
    };

    const header = ['Delegation', 'GSL', 'Caucus', 'Speaking (s)', 'Motions', 'RTR', 'WP', 'DR', 'Manual', 'Total'];
    const lines = [header.join(',')];
    matrix.forEach((r) => {
      lines.push([
        getCountryDisplayName(r.country, language), r.gsl, r.caucus, r.seconds,
        r.motions, r.rtr, r.wp, r.dr, r.manual, r.total,
      ].map(csvEscape).join(','));
    });

    // Detailed per-speech / event breakdown (topics + comments + points).
    lines.push('');
    lines.push('Per-speech / event breakdown');
    lines.push(['Delegation', 'Time', 'Source', 'Detail', 'Comment', 'Points'].map(csvEscape).join(','));
    [...committee.delegates]
      .sort((a, b) => compareCountryNames(a.country, b.country, language))
      .forEach((d) => {
        const led = [...computeLedger(committee, d.country)].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        led.forEach((r) => {
          const time = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
          lines.push([getCountryDisplayName(d.country, language), time, r.label, r.detail, commentFor(d.country, r), r.pts].map(csvEscape).join(','));
        });
      });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${committee.code}-scoreboard.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const drillRows: LedgerRow[] = selected ? computeLedger(committee, selected) : [];
  // Group ledger rows by sourceId for a subtotalled drill-in.
  const grouped: { sourceId: string; label: string; rows: LedgerRow[]; subtotal: number }[] = [];
  for (const r of drillRows) {
    let g = grouped.find((x) => x.sourceId === r.sourceId);
    if (!g) { g = { sourceId: r.sourceId, label: r.label, rows: [], subtotal: 0 }; grouped.push(g); }
    g.rows.push(r); g.subtotal += r.pts;
  }
  const drillTotal = drillRows.reduce((s, r) => s + r.pts, 0);

  // The chair's private note on a specific speech (matched by context + seconds).
  const speechComment = (r: LedgerRow): string | null => {
    if (r.type !== 'speech' || !selected) return null;
    const fb = feedback.find((f) => f.level === 'speech' && f.country === selected &&
      (f.speechContext ?? '') === (r.context ?? '') && (f.speechSeconds ?? 0) === (r.seconds ?? 0));
    return fb && fb.content ? fb.content : null;
  };

  return (
    <Portal>
      <style>{`@keyframes sbFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(28,20,16,0.45)' }} onClick={onClose}>
        {/* Height is capped as a % of the overlay, NEVER in vh: this modal is portalled into
            #fit-root, which is scale()d, so vh resolves against the real viewport while the
            overlay's own box is only FitToScreen's BASE_H. On tall screens 88vh overflowed
            that box and the header/footer were pushed off-screen (and unreachable, because a
            centred flex item overflows in both directions). % matches Motions/Documents. */}
        <div className="w-full max-w-3xl max-h-[92%] rounded-2xl overflow-hidden flex flex-col" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', fontFamily: "'Poppins','Outfit',sans-serif" }} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="px-5 py-3 flex items-center gap-3 shrink-0 sticky top-0 z-10" style={{ backgroundColor: '#1B3828' }}>
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#EED98A' }} />
            <span className="text-sm font-black tracking-wide" style={{ color: '#EED98A' }}>Scoreboard</span>
            <div className="ms-auto flex items-center gap-2">
              <button onClick={exportCsv} className="text-xs font-bold px-3 py-1.5 rounded-lg gv-lift" style={{ backgroundColor: '#EED98A', color: '#1B3828' }}>Export CSV</button>
              <button onClick={onClose} className="text-[#EDE7D8] hover:text-white text-lg leading-none">✕</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3 shrink-0">
            {(['ranking', 'matrix'] as const).map((id) => (
              <button key={id} onClick={() => { setTab(id); setSelected(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                style={{ backgroundColor: tab === id ? '#1B3828' : 'transparent', color: tab === id ? '#EED98A' : '#6A5A4A', border: tab === id ? 'none' : '1px solid #DDD4C0' }}>
                {id === 'ranking' ? 'Ranking' : 'Matrix'}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {/* Ranking + drill-in */}
            {tab === 'ranking' && !selected && (
              <div className="space-y-1" style={{ animation: 'sbFade 160ms ease-out' }}>
                {ranked.map((r, i) => (
                  <button key={r.country} onClick={() => setSelected(r.country)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-start transition-colors"
                    style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF' }}>
                    <span className="text-xs w-5 text-end font-mono shrink-0" style={{ color: '#9A8A78' }}>{i + 1}</span>
                    {flag(r.country)}
                    <span className="flex-1 text-sm font-semibold truncate" style={{ color: '#1C1410' }}>{getCountryDisplayName(r.country, language)}</span>
                    <span className="text-sm font-black px-2.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>{r.total}</span>
                    <span className="text-xs shrink-0" style={{ color: '#9A8A78' }}>▸</span>
                  </button>
                ))}
                {ranked.length === 0 && <p className="text-xs text-center py-6" style={{ color: '#9A8A78' }}>No delegates yet</p>}
              </div>
            )}

            {tab === 'ranking' && selected && (
              <div style={{ animation: 'sbFade 160ms ease-out' }}>
                <button onClick={() => setSelected(null)} className="text-xs font-bold mb-3" style={{ color: '#1B3828' }}>← Back</button>
                <div className="flex items-center gap-3 mb-4">
                  {flag(selected)}
                  <span className="text-lg font-black" style={{ color: '#1C1410' }}>{getCountryDisplayName(selected, language)}</span>
                  <span className="ms-auto text-2xl font-black" style={{ color: '#1B3828' }}>{drillTotal}</span>
                </div>

                {/* Grouped itemized ledger */}
                {grouped.map((g) => (
                  <div key={g.sourceId} className="mb-3">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[11px] font-bold tracking-wide uppercase" style={{ color: '#1B3828' }}>{g.label}</span>
                      <span className="text-xs font-mono font-bold" style={{ color: g.subtotal < 0 ? '#8B2020' : '#1B3828' }}>{g.subtotal < 0 ? '' : '+'}{g.subtotal}</span>
                    </div>
                    <div className="space-y-0.5">
                      {g.rows.map((r, i) => {
                        const comment = speechComment(r);
                        return (
                          <div key={i} className="px-2 py-1 rounded transition-colors" style={{ backgroundColor: '#FFFFFF', border: '1px solid #DDD4C0' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#FFFFFF'; }}>
                            <div className="flex justify-between text-xs gap-2">
                              <span className="truncate" style={{ color: '#6A5A4A' }}>{r.detail || r.label}{r.timestamp ? ` · ${new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                              <span className="font-mono shrink-0" style={{ color: r.pts < 0 ? '#8B2020' : '#1C1410' }}>{r.pts < 0 ? '' : '+'}{r.pts}</span>
                            </div>
                            {comment && <p className="text-[11px] italic mt-0.5" style={{ color: '#6A5A4A' }}>&ldquo;{comment}&rdquo;</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {grouped.length === 0 && <p className="text-xs py-4" style={{ color: '#9A8A78' }}>No scored activity yet</p>}

                {/* Manual award / deduct */}
                <div className="mt-4 pt-4 p-3 rounded-xl" style={{ borderTop: '1px solid #DDD4C0', backgroundColor: '#EDE7D8' }}>
                  <p className="text-[11px] font-bold tracking-wide uppercase mb-2" style={{ color: '#1B3828' }}>Manual adjustment</p>
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setDeduct(false)} className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: !deduct ? '#1B3828' : 'transparent', color: !deduct ? '#EED98A' : '#6A5A4A', border: '1px solid #DDD4C0' }}>+ Award</button>
                    <button onClick={() => setDeduct(true)} className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: deduct ? '#8B2020' : 'transparent', color: deduct ? '#FFFFFF' : '#6A5A4A', border: '1px solid #DDD4C0' }}>− Deduct</button>
                    <input type="number" min={1} value={awardAmt} onChange={(e) => setAwardAmt(e.target.value)} placeholder="pts"
                      className="w-16 text-sm text-center bg-white border border-[#DDD4C0] rounded-lg px-1.5 py-1 outline-none focus:border-[#1B3828]" style={{ color: '#1C1410' }} />
                  </div>
                  <input value={awardNote} onChange={(e) => setAwardNote(e.target.value)} placeholder="Reason (required)"
                    className="w-full text-sm bg-white border border-[#DDD4C0] rounded-lg px-2.5 py-1.5 mb-2 outline-none focus:border-[#1B3828]" style={{ color: '#1C1410' }} />
                  <button onClick={submitManual} disabled={!awardAmt || !awardNote.trim()}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 gv-lift" style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>Apply</button>
                </div>
              </div>
            )}

            {/* Matrix */}
            {tab === 'matrix' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#1B3828' }}>
                      {['', 'GSL', 'Cauc', 'Time', 'Mot', 'RTR', 'WP', 'DR', '±', 'Total'].map((h, i) => (
                        <th key={i} className="text-end px-2 py-1.5 font-bold" style={{ borderBottom: '2px solid #DDD4C0', textAlign: i === 0 ? 'start' : 'end' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...matrix].sort((a, b) => b.total - a.total).map((r) => (
                      <tr key={r.country}>
                        {/* Cap the name column so a long delegation name truncates instead of
                            widening the table (which would force the whole row to scroll). */}
                        <td className="px-2 py-1.5" style={{ borderBottom: '1px solid #DDD4C0', maxWidth: 220 }}>
                          <span className="flex items-center gap-1.5 min-w-0"><span className="shrink-0 flex">{flag(r.country)}</span><span className="truncate" style={{ color: '#1C1410' }} title={getCountryDisplayName(r.country, language)}>{getCountryDisplayName(r.country, language)}</span></span>
                        </td>
                        <td className="text-end px-2 py-1.5 font-mono" style={{ borderBottom: '1px solid #DDD4C0', color: '#6A5A4A' }}>{r.gsl}</td>
                        <td className="text-end px-2 py-1.5 font-mono" style={{ borderBottom: '1px solid #DDD4C0', color: '#6A5A4A' }}>{r.caucus}</td>
                        <td className="text-end px-2 py-1.5 font-mono" style={{ borderBottom: '1px solid #DDD4C0', color: '#6A5A4A' }}>{r.seconds}s</td>
                        <td className="text-end px-2 py-1.5 font-mono" style={{ borderBottom: '1px solid #DDD4C0', color: '#6A5A4A' }}>{r.motions}</td>
                        <td className="text-end px-2 py-1.5 font-mono" style={{ borderBottom: '1px solid #DDD4C0', color: '#6A5A4A' }}>{r.rtr}</td>
                        <td className="text-end px-2 py-1.5 font-mono" style={{ borderBottom: '1px solid #DDD4C0', color: '#6A5A4A' }}>{r.wp}</td>
                        <td className="text-end px-2 py-1.5 font-mono" style={{ borderBottom: '1px solid #DDD4C0', color: '#6A5A4A' }}>{r.dr}</td>
                        <td className="text-end px-2 py-1.5 font-mono" style={{ borderBottom: '1px solid #DDD4C0', color: r.manual < 0 ? '#8B2020' : '#6A5A4A' }}>{r.manual}</td>
                        <td className="text-end px-2 py-1.5 font-mono font-black" style={{ borderBottom: '1px solid #DDD4C0', color: '#1B3828' }}>{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
