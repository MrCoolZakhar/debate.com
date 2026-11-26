'use client';

// The end-of-game overview: for each question, the player's answer, the Gavel
// answer and the answer key grouped by score. Conference answers link to
// their page on Gavelling; the conference question also carries the plus.

import { Fragment } from 'react';
import { TierIcon } from '@/components/munillion/PixelArt';
import {
  ADD_CONFERENCE_HREF,
  conferenceHref,
  tierMeta,
  type MunReveal,
  type MunRevealAnswer,
  type MunRevealQuestion,
} from '@/lib/munillion';
import AddConferenceButton from './AddConferenceButton';

function AnswerText({ a, kind }: { a: MunRevealAnswer; kind: MunRevealQuestion['kind'] }) {
  const text = kind === 'number' ? `${a.answer}${a.note ? ` (${a.note})` : ''}` : a.answer;
  if (a.slug) {
    return (
      <a href={conferenceHref(a.slug)} target="_blank" rel="noopener noreferrer">
        {text}
      </a>
    );
  }
  return <>{text}</>;
}

function MineLine({ q }: { q: MunRevealQuestion }) {
  const m = q.mine;
  const tier = m?.tier ?? 0;
  const meta = tierMeta(tier);
  const label = m?.label || m?.typed;
  return (
    <div className="mn-tier-row is-mine">
      <TierIcon tier={tier} size={28} label={meta.name} />
      <div>
        <b>Your answer · {meta.name} · {tier}</b>
        <p>
          {label ? (
            m?.slug ? (
              <a href={conferenceHref(m.slug)} target="_blank" rel="noopener noreferrer">{label}</a>
            ) : (
              label
            )
          ) : (
            <span className="mn-muted">No answer</span>
          )}
          {m?.typed && m.label && m.typed.trim().toLowerCase() !== m.label.trim().toLowerCase() ? (
            <span className="mn-muted"> (you typed {m.typed})</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

export default function RevealList({ reveal }: { reveal: MunReveal | null }) {
  if (!reveal) {
    return <div className="mn-answers" aria-hidden><div className="mn-answer-card" style={{ height: 160, background: 'rgba(27,56,40,.06)' }} /></div>;
  }
  if (!reveal.ok || !reveal.questions) return null;
  return (
    <div className="mn-answers">
      {reveal.questions.map((q) => (
        <section key={q.position} className="mn-answer-card" aria-label={`Question ${q.position} answers`}>
          <h3>{q.position}. {q.prompt}</h3>
          <MineLine q={q} />
          {q.gavel ? (
            <div className="mn-tier-row">
              <TierIcon tier={100} size={28} label="Gavel" />
              <div>
                <b>Gavel · 100</b>
                <p><AnswerText a={q.gavel} kind={q.kind} /></p>
              </div>
            </div>
          ) : null}
          {q.tiers.map((t) => {
            const meta = tierMeta(t.tier);
            const more = t.total - t.answers.length;
            return (
              <div key={t.tier} className="mn-tier-row">
                <TierIcon tier={t.tier} size={28} label={meta.name} />
                <div>
                  <b>{meta.name} · {t.tier}</b>
                  <p>
                    {t.answers.map((a, i) => (
                      <Fragment key={`${a.answer}-${i}`}>
                        {i > 0 ? ', ' : ''}
                        <AnswerText a={a} kind={q.kind} />
                      </Fragment>
                    ))}
                    {more > 0 ? <span className="mn-muted">{` and ${more} more`}</span> : null}
                  </p>
                </div>
              </div>
            );
          })}
          {q.kind === 'number' && q.default_tier ? (
            <div className="mn-tier-row">
              <TierIcon tier={q.default_tier} size={28} label={tierMeta(q.default_tier).name} />
              <div>
                <b>{tierMeta(q.default_tier).name} · {q.default_tier}</b>
                <p>Any other resolution from 1 to {q.number_max ?? 0}</p>
              </div>
            </div>
          ) : null}
          {q.kind === 'conference' && q.default_tier ? (
            <div className="mn-tier-row">
              <TierIcon tier={q.default_tier} size={28} label={tierMeta(q.default_tier).name} />
              <div>
                <b>{tierMeta(q.default_tier).name} · {q.default_tier}</b>
                <p>Every other conference on Gavelling</p>
                <div className="mn-row" style={{ marginTop: 10 }}>
                  <AddConferenceButton href={ADD_CONFERENCE_HREF} />
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
