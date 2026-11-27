'use client';

// The end-of-game answers, Krillion style (owner, 26 Nov 2026): one row per
// round with your answer and score; tapping a row opens every answer on the
// list, filterable by score and searchable. Conference answers link to their
// page on Gavelling, and the conference round carries the plus.

import { useMemo, useState } from 'react';
import { TierIcon } from '@/components/munillion/PixelArt';
import { ADD_CONFERENCE_HREF, TIER_ORDER, conferenceHref, munConfAdd, tierMeta, type MunReveal, type MunRevealQuestion } from '@/lib/munillion';
import AddConferenceButton from './AddConferenceButton';
import CountryFlag from './Flag';

const PAGE = 120;

function fold(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function Round({ q, open, onToggle }: { q: MunRevealQuestion; open: boolean; onToggle: () => void }) {
  const [filter, setFilter] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);

  const mine = q.mine;
  const mineTier = mine?.tier ?? 0;
  const mineLabel = mine?.label || mine?.typed || '';
  const mineKey = fold(mine?.label ?? '');

  const counts = useMemo(() => {
    const c = new Map<number, number>();
    for (const a of q.answers) c.set(a.tier, (c.get(a.tier) ?? 0) + 1);
    return c;
  }, [q.answers]);

  const filtered = useMemo(() => {
    const needle = fold(query.trim());
    return q.answers.filter((a) => {
      if (filter !== 'all' && a.tier !== filter) return false;
      if (!needle) return true;
      return fold(a.answer).includes(needle) || fold(a.note ?? '').includes(needle) || fold(a.country ?? '').includes(needle);
    });
  }, [q.answers, filter, query]);

  const visible = filtered.slice(0, shown);
  const bodyId = `mn-round-${q.position}`;

  return (
    <div className={`mn-round${open ? ' is-open' : ''}`}>
      <button type="button" className="mn-round-btn focus:outline-none" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className="mn-round-n mn-px">{q.position}</span>
        <TierIcon tier={mineTier} size={28} label={tierMeta(mineTier).name} />
        <span>
          <span className="mn-round-q mn-tx">{q.prompt}</span>
          <span className="mn-round-a mn-tx">{mine?.tier ? <CountryFlag country={mine.country} size={18} /> : null}{mineLabel || 'Absent'}</span>
        </span>
        <span className="mn-round-pts mn-px">{mineTier}</span>
        <span className="mn-round-chev mn-px" aria-hidden>&#9656;</span>
      </button>

      {q.kind === 'conference' && q.missed && q.missed.length ? (
        <div className="mn-add-cta">
          {q.missed.slice(-3).map((name) => (
            <button
              key={name}
              type="button"
              className="mn-add-big mn-tx focus:outline-none"
              onClick={() => {
                // the tab opens inside the click; the wish to add it is recorded for us
                window.open(ADD_CONFERENCE_HREF, '_blank', 'noopener');
                void munConfAdd(name, 'reveal').catch(() => {});
              }}
            >
              <span className="mn-add-plus" aria-hidden>+</span>
              Add {name} to Gavelling
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div id={bodyId} className="mn-round-body">
          <div className="mn-filters" role="group" aria-label="Show answers by score">
            <button type="button" className={`mn-filter mn-px focus:outline-none${filter === 'all' ? ' is-on' : ''}`} onClick={() => { setFilter('all'); setShown(PAGE); }}>
              All {q.answers.length}
            </button>
            {TIER_ORDER.filter((t) => counts.has(t)).map((t) => (
              <button
                key={t}
                type="button"
                className={`mn-filter mn-px focus:outline-none${filter === t ? ' is-on' : ''}`}
                onClick={() => { setFilter(t); setShown(PAGE); }}
              >
                {tierMeta(t).name} {counts.get(t)}
              </button>
            ))}
          </div>
          <input
            className="mn-search mn-tx"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
            placeholder="Search all answers"
            aria-label={`Search the answers to question ${q.position}`}
            autoComplete="off"
            spellCheck={false}
          />
          <ul className="mn-list">
            {visible.map((a, i) => {
              const isMine = !!mineKey && fold(a.answer) === mineKey;
              const text = q.kind === 'number' ? `Resolution ${a.answer}` : a.answer;
              return (
                <li key={`${a.answer}-${i}`} className={isMine ? 'is-mine' : undefined}>
                  <TierIcon tier={a.tier} size={22} label={tierMeta(a.tier).name} />
                  <span>
                    <span className="mn-a mn-tx">
                      <CountryFlag country={a.country} size={18} />
                      {a.slug ? <a href={conferenceHref(a.slug)} target="_blank" rel="noopener noreferrer">{text}</a> : text}
                    </span>
                    {(() => {
                      // a conference names its host country beside its full name; a president's note already is the country
                      const parts = [a.note && a.note !== a.answer ? a.note : null,
                        a.slug && a.country && a.country !== a.note ? a.country : null].filter(Boolean);
                      return parts.length ? <span className="mn-note mn-tx">{parts.join(' · ')}</span> : null;
                    })()}
                  </span>
                  <span className="mn-px">+{a.tier}</span>
                </li>
              );
            })}
            {visible.length === 0 ? <li><span /><span className="mn-a mn-tx">Nothing matches that</span><span /></li> : null}
          </ul>
          <div className="mn-list-foot mn-px">
            <span>{Math.min(shown, filtered.length)} of {filtered.length} answers</span>
            {filtered.length > shown ? (
              <button type="button" className="mn-filter mn-px focus:outline-none" onClick={() => setShown((n) => n + PAGE)}>Show more</button>
            ) : null}
          </div>
          {q.source ? (
            <p className="mn-source mn-tx" style={{ margin: '12px 0 0', justifyContent: 'flex-start' }}>
              <span className="mn-info mn-px" aria-hidden>i</span>
              <span>
                {q.source.note}
                {q.source.url ? <> <a className="mn-link" href={q.source.url} target="_blank" rel="noopener noreferrer">Source</a></> : null}
              </span>
            </p>
          ) : null}
          {q.kind === 'number' && q.default_tier ? (
            <p className="mn-note mn-tx" style={{ marginTop: 10 }}>
              Any other resolution from 1 to {q.number_max ?? 0} scores {tierMeta(q.default_tier).name} ({q.default_tier})
            </p>
          ) : null}
          {q.kind === 'conference' ? (
            <div className="mn-row">
              <AddConferenceButton />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function RevealList({ reveal }: { reveal: MunReveal | null }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!reveal) {
    return <div className="mn-answers" aria-hidden><div style={{ height: 120, background: 'rgba(238,217,138,.06)' }} /></div>;
  }
  if (!reveal.ok || !reveal.questions) return null;
  return (
    <div className="mn-answers">
      <div className="mn-answers-head mn-px"><b>The Answers</b><span>Tap a round for every answer</span></div>
      {reveal.questions.map((q) => (
        <Round key={q.position} q={q} open={open === q.position} onToggle={() => setOpen((o) => (o === q.position ? null : q.position))} />
      ))}
    </div>
  );
}
